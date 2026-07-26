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

---

## Deep Reference Playbook

The sections below extend this skill into a complete operating playbook so it can run end-to-end inside Claude Code, CoWork, or any agentic tool without further prompting. Pull only the sections you need for a given engagement.

### Inputs the skill must collect

Before producing any output, the skill confirms:

1. **Objective** — the single decision or artifact the user wants out of this session.
2. **Context** — system, team, customer, product, or domain the work sits inside.
3. **Constraints** — time, budget, headcount, regulatory, technical, political.
4. **Definition of done** — what "good" looks like and who signs it off.
5. **Audience** — who reads or consumes the output (engineer, exec, customer, regulator).
6. **Existing artifacts** — prior versions, related docs, dashboards, tickets.
7. **Risk appetite** — how reversible the decision is and how much ambiguity is acceptable.

If any of these are missing, the skill asks targeted clarifying questions before generating output. It never invents constraints the user did not state.

### Operating workflow

The canonical workflow for **Type System Design** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

**Stage 1 — Frame.** Restate the problem in one paragraph. Name the decision, the deadline, the stakeholders, and the success metric. Surface assumptions explicitly so they can be challenged.

**Stage 2 — Diagnose.** Inventory the current state with concrete evidence: metrics, quotes, screenshots, configs, tickets. Separate facts from interpretations. Identify the two or three root causes that explain most of the gap, not the long tail of symptoms.

**Stage 3 — Design.** Generate at least two viable options. For each option, capture: what changes, who owns it, what it costs, what it unblocks, what it risks, and how it could fail. Recommend one with a written rationale.

**Stage 4 — Execute.** Convert the chosen option into a sequenced plan: milestones, owners, dependencies, gating checks, communication cadence, and rollback triggers. Anything that cannot be assigned an owner and a date is not yet a plan.

**Stage 5 — Validate.** Define how success will be measured, when the measurement happens, and what action follows each possible result. Schedule the retrospective before the work starts, not after.

### Outputs the skill produces

Depending on the request, the skill returns one or more of:

- A one-page brief suitable for an executive reader.
- A detailed working document for the delivery team.
- A decision record capturing the choice, the alternatives, and the rationale.
- A risk register with probability, impact, owner, and mitigation.
- A sequenced action plan with named owners and explicit due dates.
- A measurement plan tied to the success metric.
- A communication plan for stakeholders inside and outside the team.

Every artifact uses clear headings, short paragraphs, and tables where comparison helps. No filler. No restating the prompt. No hedging language when a recommendation is warranted.

### Decision logic and trade-offs

The skill applies the following heuristics when choices are not obvious:

- **Prefer reversible decisions** taken quickly over irreversible decisions taken slowly.
- **Optimise for the constraint that bites first** — usually time, attention, or trust, not money.
- **Default to the simplest design** that meets the stated definition of done; add complexity only when a specific requirement forces it.
- **Make the cost of being wrong visible** so the reader can judge whether the recommendation is proportionate.
- **Name the people**, not the roles, when assigning ownership; ambiguous ownership produces ambiguous outcomes.

### Anti-patterns the skill refuses to emit

| Anti-pattern | Why it fails | What the skill does instead |
|---|---|---|
| Generic best-practice list with no context | Reader cannot act on it | Tailors recommendations to the stated constraints |
| Recommendation without trade-offs | Hides the cost of being wrong | Names the price paid for the recommendation |
| Plan with no owners or dates | Cannot be executed or tracked | Assigns a named owner and a date to every action |
| Metrics theatre | Measures activity, not outcome | Ties every metric back to the user or business outcome |
| Boil-the-ocean scope | Nothing ships | Cuts scope to the smallest valuable slice |
| Buried recommendation | Reader misses the point | Leads with the recommendation in the first paragraph |

### Quality bar

The skill self-checks each output against these gates before returning it:

1. Can a busy executive understand the recommendation from the first 150 words?
2. Is every claim either evidenced, labelled as an assumption, or removed?
3. Does every action have an owner and a date?
4. Are the trade-offs of the recommendation stated honestly?
5. Is there a measurable success criterion?
6. Would the author be comfortable defending this artifact in a review meeting?

If any gate fails, the skill rewrites the section before returning it.

### Worked micro-example

> **Context:** Design expressive type systems that catch bugs at compile time. Outputs type hierarchy, branded/nominal types, discriminated unions, generic constraints, and ty
>
> **Frame:** the team needs a defensible recommendation within five working days; the audience is a cross-functional steering group; the cost of delay is higher than the cost of being slightly wrong.
>
> **Diagnose:** the dominant constraint is decision latency, not analytical depth. Existing data is sufficient for a directional call.
>
> **Design:** two viable options surfaced. Option A optimises for speed and reversibility. Option B optimises for completeness but slips the deadline by two weeks.
>
> **Execute:** Option A recommended. Plan sequenced into a two-week sprint with named owners, a mid-point checkpoint, and a clear rollback trigger.
>
> **Validate:** success measured against a single leading indicator at day 30 and a single lagging indicator at day 90. Retrospective scheduled for day 35.

### Cadence and follow-through

A one-shot artifact rarely changes outcomes. The skill recommends a lightweight cadence to keep the work alive:

- **Weekly:** owner posts a five-line status (done, doing, blocked, risk, ask).
- **Fortnightly:** steering group reviews leading indicators and unblocks dependencies.
- **Monthly:** retrospective on what the data is teaching the team; adjust plan accordingly.
- **Quarterly:** revisit the original objective and decide whether to continue, pivot, or stop.

### Closing rules of thumb

1. Lead with the recommendation; supporting analysis follows.
2. Treat every output as a draft that will be challenged; pre-empt the obvious objections.
3. Prefer one strong recommendation over three weak options.
4. When the evidence is thin, say so; do not launder uncertainty as confidence.
5. Optimise for the next decision, not for the perfect document.
6. Make it easy for the reader to disagree with you in a structured way.
7. Ship the artifact; iterate against feedback rather than in private.
