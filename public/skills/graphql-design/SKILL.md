---
name: graphql-design
description: Design GraphQL schemas, resolvers, and APIs for flexible data fetching. Outputs schema design, resolver architecture, N+1 prevention, pagination patterns, and security controls.
argument-hint: [data model, client types, existing REST APIs, performance requirements]
allowed-tools: Read, Write
---

# GraphQL Design

GraphQL gives clients exactly the data they request — no more, no less. This flexibility is powerful but requires careful schema design to prevent N+1 queries, over-fetching, and schema sprawl. Design the schema around the client's needs, not the database structure.

## Process

1. **Start with the client.** What data does each screen/use-case need? Design the schema around those queries, not the DB schema.
2. **Define types first.** Core entities as types with clear relationships.
3. **Design queries and mutations.** Queries for reads, mutations for writes. Use descriptive names.
4. **Handle N+1 queries.** Every list resolver needs DataLoader to batch DB calls.
5. **Add pagination.** Cursor-based for all list fields. Never return unbounded lists.
6. **Secure each field.** Auth at the resolver level, not just the route level.
7. **Set query complexity limits.** Prevent expensive nested queries from overwhelming the server.

## Schema Design

```graphql
# schema.graphql

type Query {
  order(id: ID!): Order
  orders(
    first: Int = 20
    after: String
    filter: OrderFilter
  ): OrderConnection!
  me: User!
}

type Mutation {
  createOrder(input: CreateOrderInput!): CreateOrderPayload!
  cancelOrder(id: ID!): CancelOrderPayload!
}

type Order {
  id: ID!
  status: OrderStatus!
  totalAmount: Money!
  customer: User!
  items: [OrderItem!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type OrderItem {
  id: ID!
  product: Product!
  quantity: Int!
  unitPrice: Money!
  lineTotal: Money!
}

type Money {
  amount: Float!
  currency: String!
  formatted: String!   # "$49.99" — computed field
}

enum OrderStatus {
  DRAFT
  PENDING
  PAID
  SHIPPED
  DELIVERED
  CANCELLED
}

# Relay-style pagination
type OrderConnection {
  edges: [OrderEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type OrderEdge {
  cursor: String!
  node: Order!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

input CreateOrderInput {
  items: [OrderItemInput!]!
  shippingAddressId: ID!
}

input OrderItemInput {
  productId: ID!
  quantity: Int!
}

type CreateOrderPayload {
  order: Order
  errors: [UserError!]!
}

type UserError {
  field: String
  message: String!
}
```

## Resolvers with DataLoader (N+1 Prevention)

```python
from strawberry import Schema, type, field, ID
from strawberry.dataloader import DataLoader
from typing import Optional
import asyncio

# DataLoader batches multiple individual loads into a single DB query
async def load_users_by_id(keys: list[str]) -> list:
    users = await db.fetchall(
        "SELECT * FROM users WHERE id = ANY($1)", [keys]
    )
    user_map = {str(u["id"]): u for u in users}
    return [user_map.get(key) for key in keys]  # Same order as keys

async def load_order_items(order_ids: list[str]) -> list:
    items = await db.fetchall(
        "SELECT * FROM order_items WHERE order_id = ANY($1)", [order_ids]
    )
    items_by_order = {}
    for item in items:
        items_by_order.setdefault(str(item["order_id"]), []).append(item)
    return [items_by_order.get(oid, []) for oid in order_ids]

@type
class Order:
    id: ID
    status: str

    @field
    async def customer(self, info) -> "User":
        # DataLoader: batches N customer loads into 1 DB query
        return await info.context.user_loader.load(self.customer_id)

    @field
    async def items(self, info) -> list["OrderItem"]:
        # DataLoader: batches item loads by order
        return await info.context.items_loader.load(self.id)

# Context factory — creates loaders per request
def get_context():
    return {
        "user_loader": DataLoader(load_fn=load_users_by_id),
        "items_loader": DataLoader(load_fn=load_order_items),
    }
```

## Query Complexity Limiting

```python
from graphql import build_schema
from graphql.validation import NoSchemaIntrospectionCustomRule
from graphql_query_complexity import QueryComplexityRule, SimpleEstimator

# Assign complexity to each field
estimator = SimpleEstimator(
    default_complexity=1,
    # More expensive fields cost more
    field_estimators={
        "Order.items": lambda **kwargs: 3,
        "orders": lambda first=20, **kwargs: first * 2,
    }
)

MAX_COMPLEXITY = 100

def validate_query_complexity(query, variables=None):
    from graphql_query_complexity import get_query_complexity
    complexity = get_query_complexity(schema, query, variables, [estimator])
    if complexity > MAX_COMPLEXITY:
        raise ValueError(
            f"Query complexity {complexity} exceeds maximum {MAX_COMPLEXITY}"
        )
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Schema mirrors database** | Leaks DB structure; tight coupling | Design schema around client use cases |
| **No DataLoader** | N+1 queries: 1 order query + N user queries | DataLoader on every relation resolver |
| **Unbounded lists** | `items` returns 100k records | Pagination on all list fields |
| **Auth at the route level only** | Schema introspection bypasses route auth | Resolve auth at each field/resolver |
| **Exposing all fields by default** | Internal fields leak to clients | Explicitly whitelist exposed fields |

## 10 Rules

1. Design the schema around client use cases — not the database schema.
2. Every list field has cursor-based pagination — no unbounded returns.
3. Every relation uses DataLoader — no exceptions, no N+1 queries.
4. Auth is enforced at the resolver level — route-level auth is not sufficient.
5. Query complexity limits prevent expensive nested queries from DOS-ing the server.
6. Mutations return a payload type with both `data` and `errors` fields.
7. Use enum types for status fields — string literals are not self-documenting.
8. Introspection is disabled in production for external-facing APIs.
9. Subscriptions use WebSockets only for truly real-time data — polling for everything else.
10. Schema versioning is managed through field deprecation, not breaking changes.
