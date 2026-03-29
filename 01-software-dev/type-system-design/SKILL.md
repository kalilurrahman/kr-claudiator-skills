---
name: type-system-design
description: Design expressive type systems that catch bugs at compile time. Outputs type hierarchy, branded/nominal types, discriminated unions, generic constraints, and type-safe API patterns.
argument-hint: [language, codebase scale, team TypeScript experience, key domain concepts]
allowed-tools: Read, Write
---

# Type System Design

A well-designed type system catches entire categories of bugs before code runs. The goal is not maximal type coverage — it's using types to make illegal states unrepresentable and to guide developers toward correct usage.

## Core Patterns

### Branded/Nominal Types

```typescript
// Prevent mixing semantically different string IDs
declare const brand: unique symbol;
type Brand<T, B> = T & { [brand]: B };

type UserId    = Brand<string, "UserId">;
type OrderId   = Brand<string, "OrderId">;
type ProductId = Brand<string, "ProductId">;

const toUserId    = (id: string): UserId    => id as UserId;
const toOrderId   = (id: string): OrderId   => id as OrderId;
const toProductId = (id: string): ProductId => id as ProductId;

// Now this is a compile error:
function getOrder(orderId: OrderId): Order { ... }
const userId = toUserId("usr-123");
getOrder(userId);  // Error: Argument of type 'UserId' is not assignable to 'OrderId'
```

### Discriminated Unions (Make Illegal States Unrepresentable)

```typescript
// BAD — many invalid state combinations possible
interface Order {
  status: "draft" | "paid" | "shipped";
  paymentId?: string;    // Only valid when paid
  trackingNumber?: string; // Only valid when shipped
}

// GOOD — only valid states exist
type Order =
  | { status: "draft"; items: OrderItem[] }
  | { status: "paid";  items: OrderItem[]; paymentId: string }
  | { status: "shipped"; items: OrderItem[]; paymentId: string; trackingNumber: string };

// Exhaustive handling — compiler catches missing cases
function getStatusLabel(order: Order): string {
  switch (order.status) {
    case "draft":   return "Pending";
    case "paid":    return "Paid";
    case "shipped": return order.trackingNumber; // TypeScript knows this field exists here
    // No default needed — union is exhaustive
  }
}
```

### Generic Constraints

```typescript
// Constrained generics for type-safe utilities
type Repository<T extends { id: string }> = {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<T>;
  delete(id: string): Promise<void>;
};

// Result type — type-safe error handling
type Result<T, E extends Error = Error> =
  | { success: true;  value: T }
  | { success: false; error: E };

class ValidationError extends Error { constructor(public field: string, message: string) { super(message); } }
class NotFoundError extends Error {}

async function findOrder(id: OrderId): Promise<Result<Order, NotFoundError>> {
  const order = await db.orders.findById(id);
  if (!order) return { success: false, error: new NotFoundError(`Order ${id} not found`) };
  return { success: true, value: order };
}

// Caller handles both cases
const result = await findOrder(toOrderId("ord-123"));
if (result.success) {
  console.log(result.value.status); // TypeScript knows value: Order
} else {
  console.error(result.error.message); // TypeScript knows error: NotFoundError
}
```

### Template Literal Types

```typescript
// Type-safe event names
type EntityType = "order" | "user" | "product";
type EventAction = "created" | "updated" | "deleted";
type EventName = `${EntityType}.${EventAction}`;
// "order.created" | "order.updated" | ... (all 9 combinations)

type EventMap = {
  [K in EventName]: K extends `${infer E}.${infer A}`
    ? { entity: E; action: A; timestamp: string }
    : never;
};

function emit<K extends EventName>(event: K, payload: EventMap[K]): void { ... }
emit("order.created", { entity: "order", action: "created", timestamp: "..." }); // OK
emit("cart.created", { ... }); // Error: "cart.created" not assignable to EventName
```

### Readonly and Immutability

```typescript
// Deep readonly for domain objects
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

type ImmutableOrder = DeepReadonly<Order>;

// Opaque function inputs — prevent accidental mutation
function processOrder(order: Readonly<Order>): ProcessedOrder {
  // order.status = "paid"; // Error: Cannot assign to readonly property
  return { ...order, processedAt: new Date() };
}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **`any` everywhere** | Defeats type checking entirely | Use `unknown` + type guards; narrow incrementally |
| **Optional fields for state** | Invalid combinations compile | Discriminated unions per state |
| **String IDs without branding** | Wrong ID type passed silently | Branded types per entity |
| **Type assertions (`as`)** | Bypasses type safety | Use type guards with runtime checks |
| **Overly wide types** | `string` when `"draft" \| "paid"` is correct | Narrow types at boundaries |

## 10 Rules

1. Make illegal states unrepresentable — use discriminated unions, not optional fields.
2. Brand primitive types (string IDs, amounts) to prevent mixing.
3. `unknown` instead of `any` — forces explicit narrowing.
4. Exhaustive switch statements on discriminated unions — catch missing cases at compile time.
5. Result types for operations that can fail — no unchecked exceptions.
6. `Readonly<T>` for function parameters that must not be mutated.
7. Generic constraints express requirements — don't accept `any` when `{ id: string }` is sufficient.
8. Type aliases document intent — `UserId` is more readable than `string`.
9. Utility types (Pick, Omit, Partial) reuse and transform types — don't duplicate.
10. Types are documentation — readable types reduce the need for comments.
