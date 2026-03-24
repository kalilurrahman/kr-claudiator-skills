---
name: bulkhead-pattern
description: Implement bulkhead patterns to isolate failures and prevent cascade. Outputs thread pool isolation, semaphore limits, service partition designs, and circuit breaker integration.
argument-hint: [service dependencies, failure modes, concurrency requirements, SLA targets]
allowed-tools: Read, Write
---

# Bulkhead Pattern

The bulkhead pattern isolates components of an application so that one failure doesn't bring down everything. Named after ship bulkheads that prevent flooding from spreading, it limits the blast radius of a failure.

## Process

1. **Identify failure domains.** Which dependencies can fail? What is their failure mode (slow, unavailable, error)?
2. **Group by criticality.** Separate critical paths from non-critical. Isolate third-party integrations.
3. **Choose isolation mechanism.** Thread pool isolation (heavyweight, strong) or semaphore isolation (lightweight, counts only).
4. **Size the pools.** Max threads/semaphores per dependency. Sized by max acceptable concurrent calls.
5. **Set timeouts.** Every call into an isolated dependency has a timeout.
6. **Integrate with circuit breakers.** Bulkheads prevent thread exhaustion; circuit breakers prevent repeated failing calls.
7. **Monitor pool saturation.** Alert when threads/semaphores are consistently at limit.

## Thread Pool Isolation

```python
from concurrent.futures import ThreadPoolExecutor
import threading
from typing import Callable, Any
import time

class BulkheadExecutor:
    """Isolated thread pool per dependency."""
    
    def __init__(self, name: str, max_workers: int, timeout: float = 5.0):
        self.name = name
        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix=name)
        self._timeout = timeout
        self._active = 0
        self._rejected = 0
        self._lock = threading.Lock()
    
    def execute(self, fn: Callable, *args, **kwargs) -> Any:
        with self._lock:
            self._active += 1
        try:
            future = self._executor.submit(fn, *args, **kwargs)
            return future.result(timeout=self._timeout)
        except Exception:
            with self._lock:
                self._rejected += 1
            raise
        finally:
            with self._lock:
                self._active -= 1
    
    @property
    def stats(self) -> dict:
        return {"name": self.name, "active": self._active, "rejected": self._rejected}

# One pool per external dependency
payment_pool   = BulkheadExecutor("payment-service",  max_workers=10, timeout=3.0)
inventory_pool = BulkheadExecutor("inventory-service", max_workers=20, timeout=2.0)
email_pool     = BulkheadExecutor("email-service",     max_workers=5,  timeout=10.0)

# Usage — each call isolated in its own pool
def checkout(order):
    # Payment failure can't exhaust inventory threads
    payment = payment_pool.execute(payment_service.charge, order)
    inventory = inventory_pool.execute(inventory_service.reserve, order)
    email_pool.execute(email_service.send_confirmation, order)  # Non-critical
    return {"payment": payment, "inventory": inventory}
```

## Semaphore Isolation (Lightweight)

```python
import threading
from contextlib import contextmanager

class SemaphoreBulkhead:
    """Count-based isolation — limits concurrent callers, not thread creation."""
    
    def __init__(self, name: str, max_concurrent: int, timeout: float = 1.0):
        self.name = name
        self._sem = threading.Semaphore(max_concurrent)
        self._timeout = timeout
        self._rejected_count = 0
    
    @contextmanager
    def acquire(self):
        acquired = self._sem.acquire(timeout=self._timeout)
        if not acquired:
            self._rejected_count += 1
            raise BulkheadFullError(f"{self.name} bulkhead at capacity")
        try:
            yield
        finally:
            self._sem.release()

class BulkheadFullError(Exception):
    pass

# Usage
inventory_bulkhead = SemaphoreBulkhead("inventory", max_concurrent=15, timeout=0.5)

def reserve_stock(item_id: str, qty: int):
    with inventory_bulkhead.acquire():
        return inventory_client.reserve(item_id, qty)

# Graceful degradation when bulkhead full
def reserve_with_fallback(item_id, qty):
    try:
        return reserve_stock(item_id, qty)
    except BulkheadFullError:
        # Degrade gracefully — queue for async processing
        reservation_queue.enqueue({"item_id": item_id, "qty": qty})
        return {"status": "queued", "estimated_confirmation": "2min"}
```

## Kubernetes Resource Partitioning

```yaml
# Separate node pools per criticality tier — physical bulkhead
# Tier 1: Critical (payment, auth)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-service
spec:
  template:
    spec:
      nodeSelector:
        tier: critical
      tolerations:
        - key: tier
          value: critical
          operator: Equal
          effect: NoSchedule
      # Guaranteed QoS — never evicted
      containers:
        - name: payment
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "500m"    # requests == limits = Guaranteed
              memory: "512Mi"

# Tier 2: Standard
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: email-service
spec:
  template:
    spec:
      nodeSelector:
        tier: standard
      containers:
        - name: email
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Single shared thread pool** | One slow dependency exhausts all threads | Separate pool per dependency |
| **Pools sized equally** | Critical paths get same resources as non-critical | Size by SLA and criticality |
| **No timeouts** | Slow dependency holds threads indefinitely | Timeout on every external call |
| **No monitoring** | Pool saturation invisible until outage | Alert on pool utilisation >80% |
| **Bulkhead without fallback** | Rejected calls just fail | Define degraded behaviour for each bulkhead |

## 10 Rules

1. Isolate each external dependency in its own pool — one slow service cannot exhaust resources for others.
2. Size pools conservatively — a small pool that rejects requests is safer than a large pool that deadlocks.
3. Every call through a bulkhead has an explicit timeout — infinite waits defeat isolation.
4. Combine with circuit breakers — bulkheads limit concurrent callers; circuit breakers stop calling failed services.
5. Non-critical features (email, recommendations) get smaller pools — they fail before critical paths.
6. Monitor pool saturation in production — consistently full pools indicate undersizing or a performance problem.
7. Define degraded behaviour for every bulkhead rejection — queue, cache, or default response.
8. Thread pool isolation is stronger than semaphore isolation — use it for the most critical dependencies.
9. Physical node pool separation for tier 1 services — shared nodes mean shared fate.
10. Test bulkhead behaviour with chaos engineering — inject latency to verify isolation works.
