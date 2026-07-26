---
name: dependency-injection
description: Implement dependency injection patterns for testable, decoupled application architecture. Outputs DI container configuration, interface-based design, factory patterns, and testing strategies across Python, TypeScript, and Go.
argument-hint: [language, framework, container preference, testing requirements]
allowed-tools: Read, Write, Bash
---

# Dependency Injection

Dependency injection makes components receive their dependencies from the outside rather than creating them internally. This decouples components from concrete implementations, enables testing with mocks, and makes wiring explicit and auditable.

## Output Format

### Python (FastAPI with dependency system)

```python
# dependencies/database.py
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
import os

engine = create_async_engine(os.environ["DATABASE_URL"], echo=False, pool_size=10)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

```python
# repositories/order_repository.py — interface + implementation
from abc import ABC, abstractmethod
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

class OrderRepository(ABC):
    @abstractmethod
    async def get(self, order_id: str) -> Optional[dict]: ...
    
    @abstractmethod
    async def create(self, data: dict) -> dict: ...
    
    @abstractmethod
    async def update(self, order_id: str, data: dict) -> dict: ...


class PostgresOrderRepository(OrderRepository):
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get(self, order_id: str) -> Optional[dict]:
        result = await self.db.execute(
            select(Order).where(Order.id == order_id)
        )
        order = result.scalar_one_or_none()
        return order.__dict__ if order else None
    
    async def create(self, data: dict) -> dict:
        order = Order(**data)
        self.db.add(order)
        await self.db.flush()
        return order.__dict__
    
    async def update(self, order_id: str, data: dict) -> dict:
        result = await self.db.execute(
            update(Order).where(Order.id == order_id).values(**data).returning(Order)
        )
        return result.scalar_one().__dict__
```

```python
# services/order_service.py
class OrderService:
    """Depends on abstract interfaces — testable without real DB."""
    
    def __init__(
        self,
        order_repo: OrderRepository,           # Interface, not implementation
        inventory_client: InventoryClient,     # Interface
        event_bus: EventBus,                   # Interface
        logger: Logger = None,
    ):
        self.repo = order_repo
        self.inventory = inventory_client
        self.events = event_bus
        self.logger = logger or logging.getLogger(__name__)
    
    async def create_order(self, user_id: str, items: list) -> dict:
        for item in items:
            if not await self.inventory.is_available(item["product_id"]):
                raise OutOfStockError(item["product_id"])
        
        order = await self.repo.create({"user_id": user_id, "items": items, "status": "pending"})
        await self.events.publish("order.created", {"order_id": order["id"]})
        return order
```

```python
# api/dependencies.py — FastAPI DI wiring
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

def get_order_repository(db: AsyncSession = Depends(get_db)) -> OrderRepository:
    return PostgresOrderRepository(db)

def get_inventory_client() -> InventoryClient:
    return HttpInventoryClient(base_url=settings.INVENTORY_SERVICE_URL)

def get_event_bus() -> EventBus:
    return KafkaEventBus(bootstrap_servers=settings.KAFKA_BROKERS)

def get_order_service(
    repo: OrderRepository = Depends(get_order_repository),
    inventory: InventoryClient = Depends(get_inventory_client),
    events: EventBus = Depends(get_event_bus),
) -> OrderService:
    return OrderService(repo, inventory, events)

# Route using dependency
@router.post("/orders")
async def create_order(
    request: CreateOrderRequest,
    service: OrderService = Depends(get_order_service),
):
    return await service.create_order(request.user_id, request.items)
```

```python
# tests/test_order_service.py — test with mocks, not real dependencies
import pytest
from unittest.mock import AsyncMock

@pytest.fixture
def mock_repo():
    repo = AsyncMock(spec=OrderRepository)
    repo.create.return_value = {"id": "order-123", "status": "pending"}
    return repo

@pytest.fixture
def mock_inventory():
    inv = AsyncMock(spec=InventoryClient)
    inv.is_available.return_value = True
    return inv

@pytest.fixture
def mock_events():
    return AsyncMock(spec=EventBus)

@pytest.fixture
def service(mock_repo, mock_inventory, mock_events):
    return OrderService(mock_repo, mock_inventory, mock_events)

@pytest.mark.asyncio
async def test_create_order_calls_inventory_check(service, mock_inventory):
    await service.create_order("user-1", [{"product_id": "prod-1", "quantity": 1}])
    mock_inventory.is_available.assert_called_once_with("prod-1")

@pytest.mark.asyncio
async def test_create_order_raises_when_out_of_stock(service, mock_inventory):
    mock_inventory.is_available.return_value = False
    with pytest.raises(OutOfStockError):
        await service.create_order("user-1", [{"product_id": "prod-1", "quantity": 1}])

# Override dependencies in integration tests
@pytest.fixture
def app_with_mock_db():
    app = create_app()
    mock_repo = AsyncMock(spec=OrderRepository)
    app.dependency_overrides[get_order_repository] = lambda: mock_repo
    return app, mock_repo
```

### TypeScript (InversifyJS)

```typescript
// di/container.ts
import { Container } from 'inversify';
import 'reflect-metadata';

const TYPES = {
  OrderRepository: Symbol('OrderRepository'),
  InventoryClient: Symbol('InventoryClient'),
  EventBus: Symbol('EventBus'),
  OrderService: Symbol('OrderService'),
  Database: Symbol('Database'),
};

// Interfaces
interface IOrderRepository {
  get(id: string): Promise<Order | null>;
  create(data: Partial<Order>): Promise<Order>;
}

// Implementations
@injectable()
class PostgresOrderRepository implements IOrderRepository {
  constructor(@inject(TYPES.Database) private db: Database) {}
  
  async get(id: string) { /* ... */ }
  async create(data: Partial<Order>) { /* ... */ }
}

@injectable()
class OrderService {
  constructor(
    @inject(TYPES.OrderRepository) private repo: IOrderRepository,
    @inject(TYPES.InventoryClient) private inventory: IInventoryClient,
    @inject(TYPES.EventBus) private events: IEventBus,
  ) {}
  
  async createOrder(userId: string, items: OrderItem[]): Promise<Order> {
    for (const item of items) {
      if (!await this.inventory.isAvailable(item.productId)) {
        throw new OutOfStockError(item.productId);
      }
    }
    const order = await this.repo.create({ userId, items, status: 'pending' });
    await this.events.publish('order.created', { orderId: order.id });
    return order;
  }
}

// Wire the container
const container = new Container();
container.bind<IOrderRepository>(TYPES.OrderRepository).to(PostgresOrderRepository);
container.bind<IInventoryClient>(TYPES.InventoryClient).to(HttpInventoryClient);
container.bind<IEventBus>(TYPES.EventBus).to(KafkaEventBus);
container.bind<OrderService>(TYPES.OrderService).to(OrderService);

// For testing — rebind with mocks
const testContainer = container.createChild();
testContainer.rebind<IOrderRepository>(TYPES.OrderRepository).toConstantValue(mockRepo);

export { container, TYPES };
```

### Go (Manual DI — idiomatic)

```go
// Go doesn't use DI containers — pass dependencies via constructors

// repository.go
type OrderRepository interface {
    Get(ctx context.Context, id string) (*Order, error)
    Create(ctx context.Context, order *Order) error
}

type postgresOrderRepository struct {
    db *sql.DB
}

func NewPostgresOrderRepository(db *sql.DB) OrderRepository {
    return &postgresOrderRepository{db: db}
}

// service.go
type OrderService struct {
    repo      OrderRepository
    inventory InventoryClient
    events    EventBus
    logger    *slog.Logger
}

func NewOrderService(
    repo OrderRepository,
    inventory InventoryClient,
    events EventBus,
    logger *slog.Logger,
) *OrderService {
    return &OrderService{
        repo: repo, inventory: inventory,
        events: events, logger: logger,
    }
}

// main.go — wire everything manually
func main() {
    db := connectDB(os.Getenv("DATABASE_URL"))
    logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
    
    orderRepo := NewPostgresOrderRepository(db)
    inventoryClient := NewHttpInventoryClient(os.Getenv("INVENTORY_URL"))
    eventBus := NewKafkaEventBus(os.Getenv("KAFKA_BROKERS"))
    
    orderService := NewOrderService(orderRepo, inventoryClient, eventBus, logger)
    orderHandler := NewOrderHandler(orderService)
    
    http.Handle("/orders", orderHandler)
    log.Fatal(http.ListenAndServe(":8080", nil))
}

// service_test.go — test with mock implementations
type mockOrderRepository struct {
    orders map[string]*Order
}

func (m *mockOrderRepository) Get(ctx context.Context, id string) (*Order, error) {
    if o, ok := m.orders[id]; ok {
        return o, nil
    }
    return nil, ErrNotFound
}

func TestCreateOrder_OutOfStock(t *testing.T) {
    mockRepo := &mockOrderRepository{orders: map[string]*Order{}}
    mockInventory := &mockInventoryClient{available: false}
    mockEvents := &mockEventBus{}
    
    svc := NewOrderService(mockRepo, mockInventory, mockEvents, slog.Default())
    _, err := svc.CreateOrder(context.Background(), "user-1", []OrderItem{})
    
    assert.ErrorIs(t, err, ErrOutOfStock)
    assert.Empty(t, mockEvents.published)
}
```

## Rules

- **Depend on interfaces, not implementations** — the service shouldn't know if it's using Postgres or SQLite.
- **Constructor injection over setter/field injection** — dependencies required at construction make them explicit.
- **One DI root** — wire the entire dependency graph in one place (`main.go`, `app.py`, `container.ts`).
- **Don't inject the container** — passing the DI container to components defeats the purpose.
- **Test by substituting implementations** — replace real DB with in-memory; real HTTP client with mock.
- **Keep interfaces narrow** — an interface with 2 methods is easier to mock than one with 20.
- **Avoid circular dependencies** — if A depends on B and B depends on A, extract a third component.
- **Factory functions over `new` everywhere** — centralize creation logic.
- **Log dependencies at startup** — logging what was injected helps debug misconfiguration.
- **DI ≠ service locator** — service locator pulls dependencies; DI pushes them in. They're opposite patterns.


## Worked Example and Anti-Patterns

### Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| No runbook | On-call engineer has no guidance during incident | Write runbook before going to production |
| Single point of failure | One component down takes everything with it | Design for redundancy at every layer |
| No monitoring | Problems discovered by users, not engineers | Instrument before launch |
| Manual toil | Repeated manual steps slow down and introduce errors | Automate anything done more than twice |
| Undocumented decisions | Next engineer repeats the same mistakes | Use Architecture Decision Records (ADRs) |

### Rules

- **Start with the simplest thing that works** -- complexity should be earned, not assumed.
- **Make it observable before making it complex** -- logs, metrics, and traces first.
- **Automate toil** -- anything done manually more than twice should be scripted.
- **Document decisions** -- use ADRs; future engineers will thank you.
- **Test failure modes** -- chaos engineering starts small; break one thing at a time.
- **Prefer reversible decisions** -- irreversible architecture decisions need the most careful thought.
- **Own your runbooks** -- every service needs a runbook before it goes to production.
- **Measure before optimizing** -- do not optimize what you have not profiled.
- **Design for the 99th percentile user** -- the average case is not the hard case.
- **Keep it boring** -- stable, predictable, well-understood technology over cutting-edge.

