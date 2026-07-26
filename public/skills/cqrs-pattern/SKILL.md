---
name: cqrs-pattern
description: Implement Command Query Responsibility Segregation separating read and write models. Outputs command handlers, query handlers, read model synchronization, and eventual consistency patterns.
argument-hint: [domain, read/write ratio, consistency requirements, persistence technology]
allowed-tools: Read, Write, Bash
---

# CQRS Pattern

CQRS separates write operations (commands) from read operations (queries) into distinct models. The write model enforces business rules; the read model is optimized for queries. This enables independent scaling, tailored data models for each side, and better performance for read-heavy systems.

## When to Use CQRS

**Good fit:**
- Read/write ratio >10:1 (optimize reads independently)
- Complex domain logic on writes, simple projections on reads
- Different consistency requirements (strong writes, eventual reads)
- Event sourcing (CQRS pairs naturally with it)

**Not worth it:**
- Simple CRUD applications
- Small teams — operational complexity outweighs benefits
- Strong consistency required everywhere

## Output Format

### Command Side

```python
# commands/commands.py — Value objects, not actions
from dataclasses import dataclass
from typing import Optional

@dataclass(frozen=True)
class PlaceOrderCommand:
    user_id: str
    items: tuple          # Immutable
    shipping_address: dict
    idempotency_key: str   # Client-provided, for at-least-once safety

@dataclass(frozen=True)
class CancelOrderCommand:
    order_id: str
    user_id: str
    reason: str

@dataclass(frozen=True)
class UpdateShippingAddressCommand:
    order_id: str
    user_id: str
    new_address: dict
```

```python
# commands/handlers.py
import uuid
from dataclasses import dataclass

@dataclass
class CommandResult:
    success: bool
    aggregate_id: str
    error: Optional[str] = None

class PlaceOrderCommandHandler:
    def __init__(self, order_repo, inventory_service, event_bus):
        self.order_repo = order_repo
        self.inventory_service = inventory_service
        self.event_bus = event_bus
    
    async def handle(self, cmd: PlaceOrderCommand) -> CommandResult:
        # Idempotency check
        existing = await self.order_repo.find_by_idempotency_key(cmd.idempotency_key)
        if existing:
            return CommandResult(success=True, aggregate_id=existing.id)
        
        # Validate inventory (domain service)
        for item in cmd.items:
            if not await self.inventory_service.is_available(item["product_id"], item["quantity"]):
                return CommandResult(success=False, aggregate_id="", error="Item out of stock")
        
        # Create aggregate and execute command
        order_id = str(uuid.uuid4())
        order = OrderAggregate(order_id)
        order.place(
            user_id=cmd.user_id,
            items=list(cmd.items),
            total_cents=sum(i["price_cents"] * i["quantity"] for i in cmd.items),
            shipping_address=cmd.shipping_address,
        )
        
        # Persist (write model)
        await self.order_repo.save(order, idempotency_key=cmd.idempotency_key)
        
        # Publish events for read model sync
        for event in order.uncommitted_events():
            await self.event_bus.publish(event)
        
        return CommandResult(success=True, aggregate_id=order_id)


class CancelOrderCommandHandler:
    def __init__(self, order_repo, event_bus):
        self.order_repo = order_repo
        self.event_bus = event_bus
    
    async def handle(self, cmd: CancelOrderCommand) -> CommandResult:
        order = await self.order_repo.load(cmd.order_id)
        if not order:
            return CommandResult(success=False, aggregate_id="", error="Order not found")
        
        # Authorization check
        if order.user_id != cmd.user_id:
            return CommandResult(success=False, aggregate_id="", error="Not your order")
        
        try:
            order.cancel(reason=cmd.reason, cancelled_by=cmd.user_id)
        except InvalidStateTransition as e:
            return CommandResult(success=False, aggregate_id=cmd.order_id, error=str(e))
        
        await self.order_repo.save(order)
        for event in order.uncommitted_events():
            await self.event_bus.publish(event)
        
        return CommandResult(success=True, aggregate_id=cmd.order_id)
```

### Query Side (Read Models)

```python
# queries/queries.py
from dataclasses import dataclass
from typing import Optional

@dataclass(frozen=True)
class GetOrderQuery:
    order_id: str
    user_id: str   # For authorization

@dataclass(frozen=True)
class ListUserOrdersQuery:
    user_id: str
    status: Optional[str] = None
    page: int = 1
    page_size: int = 20

@dataclass(frozen=True)
class GetOrderSummaryQuery:
    user_id: str
    days: int = 30
```

```python
# queries/handlers.py — Query handlers read from optimized read models
class GetOrderQueryHandler:
    def __init__(self, read_db):
        self.db = read_db
    
    async def handle(self, query: GetOrderQuery) -> Optional[dict]:
        """Read from denormalized read model — no joins needed."""
        row = await self.db.fetchrow(
            """
            SELECT
                o.order_id, o.status, o.total_cents, o.created_at,
                o.user_id, o.payment_id, o.tracking_number,
                o.items,                        -- Pre-serialized JSON
                u.display_name as user_name,    -- Pre-joined at write time
                u.email as user_email
            FROM order_read_model o
            JOIN user_snapshot u ON u.user_id = o.user_id
            WHERE o.order_id = $1
            """,
            query.order_id
        )
        
        if not row:
            return None
        
        # Authorization: only owner or admin
        if row["user_id"] != query.user_id:
            return None   # Return None not 403 to avoid enumeration
        
        return dict(row)


class ListUserOrdersQueryHandler:
    def __init__(self, read_db):
        self.db = read_db
    
    async def handle(self, query: ListUserOrdersQuery) -> dict:
        """Paginated list — read model is pre-indexed for this exact access pattern."""
        conditions = ["user_id = $1"]
        params = [query.user_id]
        
        if query.status:
            conditions.append(f"status = ${len(params) + 1}")
            params.append(query.status)
        
        where = " AND ".join(conditions)
        offset = (query.page - 1) * query.page_size
        
        rows = await self.db.fetch(
            f"""
            SELECT order_id, status, total_cents, created_at, items_count
            FROM order_read_model
            WHERE {where}
            ORDER BY created_at DESC
            LIMIT {query.page_size} OFFSET {offset}
            """,
            *params
        )
        
        total = await self.db.fetchval(
            f"SELECT COUNT(*) FROM order_read_model WHERE {where}",
            *params
        )
        
        return {
            "items": [dict(r) for r in rows],
            "total": total,
            "page": query.page,
            "page_size": query.page_size,
        }


class GetOrderSummaryQueryHandler:
    """Analytics query — uses a separate, aggregated read model."""
    def __init__(self, analytics_db):
        self.db = analytics_db
    
    async def handle(self, query: GetOrderSummaryQuery) -> dict:
        return await self.db.fetchrow(
            """
            SELECT
                COUNT(*) as total_orders,
                COUNT(*) FILTER (WHERE status = 'delivered') as completed,
                COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                SUM(total_cents) FILTER (WHERE status != 'cancelled') as revenue_cents,
                AVG(total_cents) FILTER (WHERE status != 'cancelled') as avg_order_cents
            FROM order_read_model
            WHERE user_id = $1
            AND created_at > NOW() - INTERVAL '1 day' * $2
            """,
            query.user_id, query.days
        )
```

### Read Model Synchronization

```python
# sync/read_model_updater.py — listens to events, keeps read model current
import asyncio

class OrderReadModelUpdater:
    """
    Subscribes to domain events and updates read models.
    Must be idempotent — may receive duplicate events.
    """
    
    def __init__(self, read_db, event_bus):
        self.db = read_db
        self.event_bus = event_bus
    
    async def start(self):
        await self.event_bus.subscribe(
            topics=["OrderPlaced", "PaymentProcessed", "OrderShipped", "OrderCancelled"],
            handler=self.handle_event
        )
    
    async def handle_event(self, event_type: str, event_data: dict, event_id: str):
        # Idempotency: skip already-processed events
        already_processed = await self.db.fetchval(
            "SELECT 1 FROM processed_events WHERE event_id = $1",
            event_id
        )
        if already_processed:
            return
        
        async with self.db.transaction():
            if event_type == "OrderPlaced":
                await self.db.execute(
                    """
                    INSERT INTO order_read_model (
                        order_id, user_id, status, total_cents,
                        items, items_count, created_at, updated_at
                    ) VALUES ($1, $2, 'pending', $3, $4, $5, $6, $6)
                    ON CONFLICT (order_id) DO NOTHING
                    """,
                    event_data["aggregate_id"],
                    event_data["user_id"],
                    event_data["total_cents"],
                    json.dumps(event_data["items"]),
                    len(event_data["items"]),
                    event_data["occurred_at"],
                )
            
            elif event_type == "PaymentProcessed":
                await self.db.execute(
                    "UPDATE order_read_model SET status='paid', payment_id=$2, updated_at=$3 WHERE order_id=$1",
                    event_data["aggregate_id"],
                    event_data["payment_id"],
                    event_data["occurred_at"],
                )
            
            elif event_type == "OrderShipped":
                await self.db.execute(
                    """
                    UPDATE order_read_model 
                    SET status='shipped', tracking_number=$2, carrier=$3, updated_at=$4
                    WHERE order_id=$1
                    """,
                    event_data["aggregate_id"],
                    event_data["tracking_number"],
                    event_data["carrier"],
                    event_data["occurred_at"],
                )
            
            elif event_type == "OrderCancelled":
                await self.db.execute(
                    "UPDATE order_read_model SET status='cancelled', cancel_reason=$2, updated_at=$3 WHERE order_id=$1",
                    event_data["aggregate_id"],
                    event_data["reason"],
                    event_data["occurred_at"],
                )
            
            # Mark event as processed
            await self.db.execute(
                "INSERT INTO processed_events (event_id, processed_at) VALUES ($1, NOW())",
                event_id
            )
```

### API Layer (Command/Query Dispatch)

```python
# api/orders.py
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/orders")

@router.post("/", status_code=201)
async def create_order(
    request: CreateOrderRequest,
    user: User = Depends(get_current_user),
    handler: PlaceOrderCommandHandler = Depends(get_place_order_handler),
):
    result = await handler.handle(PlaceOrderCommand(
        user_id=user.id,
        items=tuple(request.items),
        shipping_address=request.shipping_address,
        idempotency_key=request.idempotency_key or str(uuid.uuid4()),
    ))
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    
    return {"order_id": result.aggregate_id}


@router.get("/{order_id}")
async def get_order(
    order_id: str,
    user: User = Depends(get_current_user),
    handler: GetOrderQueryHandler = Depends(get_order_query_handler),
):
    result = await handler.handle(GetOrderQuery(order_id=order_id, user_id=user.id))
    if not result:
        raise HTTPException(status_code=404)
    return result


@router.get("/")
async def list_orders(
    status: str = None,
    page: int = 1,
    user: User = Depends(get_current_user),
    handler: ListUserOrdersQueryHandler = Depends(get_list_orders_handler),
):
    return await handler.handle(ListUserOrdersQuery(
        user_id=user.id,
        status=status,
        page=page,
    ))
```

### Read Model Schema

```sql
-- Denormalized for fast reads — pre-joined, pre-computed
CREATE TABLE order_read_model (
    order_id        UUID PRIMARY KEY,
    user_id         VARCHAR(255) NOT NULL,
    status          VARCHAR(50) NOT NULL,
    total_cents     INTEGER NOT NULL,
    items           JSONB NOT NULL,
    items_count     INTEGER NOT NULL,
    payment_id      VARCHAR(255),
    tracking_number VARCHAR(255),
    carrier         VARCHAR(100),
    cancel_reason   TEXT,
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL
);

-- Indexes for query access patterns
CREATE INDEX idx_orders_rm_user_status ON order_read_model(user_id, status);
CREATE INDEX idx_orders_rm_created ON order_read_model(created_at DESC);
CREATE INDEX idx_orders_rm_status ON order_read_model(status) WHERE status = 'pending';

-- Idempotency tracking
CREATE TABLE processed_events (
    event_id        VARCHAR(255) PRIMARY KEY,
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Rules

- **Commands are intentions, queries are questions** — commands may fail; queries always return something.
- **Read models are denormalized** — don't normalize read-side; optimize for query patterns, not storage.
- **Eventual consistency on the read side** — accept that reads may lag writes by milliseconds to seconds.
- **Idempotent read model updaters** — events may be delivered more than once; updates must be safe.
- **Don't share the database** — write model and read model can use different databases (write: Postgres, read: Redis or Elasticsearch).
- **Commands return IDs, not entities** — the command result is an ID; clients query the read model for current state.
- **Multiple read models from one event stream** — build as many read models as query patterns require.
- **Rebuild read models when needed** — they're disposable; replay events to rebuild when projection logic changes.
- **CQRS ≠ event sourcing** — they pair well, but either can exist without the other.
- **Don't add CQRS prematurely** — start simple, extract when read/write patterns clearly diverge.
