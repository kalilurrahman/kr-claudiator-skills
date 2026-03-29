---
name: microservices-communication
description: Design communication patterns between microservices. Outputs synchronous vs asynchronous decision framework, service discovery approach, circuit breaker configuration, and observability strategy.
argument-hint: [service count, latency requirements, consistency requirements, team structure]
allowed-tools: Read, Write
---

# Microservices Communication

Microservices need to communicate. The choice between synchronous (HTTP/gRPC) and asynchronous (events/queues) has profound implications for coupling, resilience, and data consistency. Get this wrong and you end up with a distributed monolith — the worst of both worlds.

## Communication Decision Framework

```
USE SYNCHRONOUS (HTTP/gRPC) when:
  ✓ Response needed to continue (payment result, auth check)
  ✓ Simple request-response with immediate answer
  ✓ Strong consistency required within the request
  ✓ Low latency is critical (<100ms)

USE ASYNCHRONOUS (events/messages) when:
  ✓ Caller doesn't need the result immediately
  ✓ Multiple services need the same event (fan-out)
  ✓ Durability matters (don't lose the message)
  ✓ Services should be decoupled (publisher doesn't know subscribers)
  ✓ Handling spiky load (queue absorbs bursts)

NEVER:
  ✗ Synchronous chains of 5+ services — cascading failures
  ✗ Async where strong consistency is required — use sagas instead
  ✗ Both patterns for the same domain without clear rules
```

## Synchronous Communication (HTTP)

```python
# Service client with circuit breaker and retry
import httpx
from circuitbreaker import circuit
import tenacity

class InventoryServiceClient:
    BASE_URL = "http://inventory-service:8080"
    
    def __init__(self):
        self.client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            timeout=httpx.Timeout(connect=1.0, read=3.0),
            headers={"Content-Type": "application/json"},
        )
    
    @circuit(failure_threshold=5, recovery_timeout=30)
    @tenacity.retry(
        stop=tenacity.stop_after_attempt(3),
        wait=tenacity.wait_exponential(multiplier=0.5, max=5),
        retry=tenacity.retry_if_exception_type(httpx.TransientError),
    )
    async def reserve_stock(self, product_id: str, quantity: int,
                             order_id: str) -> dict:
        response = await self.client.post(
            "/api/v1/reservations",
            json={
                "product_id": product_id,
                "quantity": quantity,
                "reference_id": order_id,  # Idempotency
            },
        )
        response.raise_for_status()
        return response.json()
    
    async def get_stock_level(self, product_id: str) -> int:
        """Non-critical read — degrade gracefully on failure."""
        try:
            response = await self.client.get(f"/api/v1/products/{product_id}/stock")
            return response.json()["available"]
        except Exception:
            return -1  # Unknown — UI shows "Check availability"
```

## Async Communication (Events)

```python
# Event-driven: OrderService emits, InventoryService and NotificationService consume
# No direct dependency between services

from confluent_kafka import Producer, Consumer

# Order service — produces event
class OrderService:
    def __init__(self, producer: Producer):
        self._producer = producer
    
    async def place_order(self, order_data: dict) -> dict:
        order = await self._create_order(order_data)
        
        # Emit event — don't call inventory or notifications directly
        self._producer.produce(
            "orders.order.placed",
            key=order["id"],
            value=json.dumps({
                "eventType": "order.placed",
                "orderId": order["id"],
                "customerId": order["customer_id"],
                "items": order["items"],
                "totalAmount": order["total"],
                "occurredAt": datetime.utcnow().isoformat(),
            }),
        )
        return order

# Inventory service — consumes event
class InventoryEventConsumer:
    def handle_order_placed(self, event: dict):
        for item in event["items"]:
            self.reserve_stock(item["product_id"], item["quantity"],
                               reference=event["orderId"])
```

## Service Discovery

```yaml
# Kubernetes: service DNS is automatic
# inventory-service.production.svc.cluster.local:8080

# For service mesh (Istio) — traffic management, retries, circuit breaking
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: inventory-service
spec:
  hosts: [inventory-service]
  http:
    - timeout: 3s
      retries:
        attempts: 3
        perTryTimeout: 1s
        retryOn: gateway-error,connect-failure,retriable-4xx
      route:
        - destination:
            host: inventory-service
            port:
              number: 8080
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Synchronous chain >3 deep** | Cascading timeouts; one slow service fails all | Async for non-critical paths; saga for multi-step |
| **Direct DB access across services** | Tight coupling; breaks service ownership | API calls only; never shared DB |
| **Chatty services** | Too many small calls; high latency | Batch requests; aggregate data at caller |
| **Missing circuit breakers** | One failing service takes down callers | Circuit breaker on every synchronous client |
| **No correlation IDs** | Can't trace request across services | Propagate correlation ID in every call |

## 10 Rules

1. Synchronous only when the caller needs the result to continue processing.
2. Never chain more than 3 synchronous service calls — use async or saga patterns.
3. Every synchronous client has a circuit breaker and timeout.
4. Services own their data — no direct database access across service boundaries.
5. Propagate correlation IDs through every call — async and synchronous.
6. Async events are the integration contract — producers don't know their consumers.
7. Idempotency is required for all async message consumers — messages are delivered at-least-once.
8. Service clients are libraries — encapsulate retry, circuit breaking, and serialization.
9. Monitor inter-service latency and error rates as first-class SLIs.
10. Design for failure of any upstream service — every dependency can and will fail.
