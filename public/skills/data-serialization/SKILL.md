---
name: data-serialization
description: Choose and implement data serialization formats for APIs, storage, and messaging. Outputs format comparison, schema design, versioning strategy, and performance benchmarks.
argument-hint: [use case, language ecosystem, schema evolution needs, performance requirements]
allowed-tools: Read, Write, Bash
---

# Data Serialization

Serialization converts in-memory data structures to a transmittable/storable format. Choosing the right format affects performance, schema evolution, human readability, and ecosystem compatibility. Most systems need at least two: one human-readable (JSON) and one efficient binary (Protobuf/Avro) format.

## Format Comparison

| Format | Type | Schema | Size | Speed | Evolution | Best For |
|--------|------|--------|------|-------|-----------|---------|
| JSON | Text | None/optional | Large | Slow | Loose | REST APIs, config |
| JSON Schema | Text | Explicit | Large | Slow | Versioned | Validated REST APIs |
| Protocol Buffers | Binary | Required | Small | Fast | Strict | gRPC, high-volume messaging |
| Apache Avro | Binary | Required | Smallest | Fast | Best | Kafka, data pipelines |
| MessagePack | Binary | None | Medium | Medium | Loose | Drop-in JSON replacement |
| CBOR | Binary | None | Medium | Medium | Loose | IoT, embedded |

## Protobuf Schema Design

```protobuf
// order.proto
syntax = "proto3";
package orders.v1;
option go_package = "github.com/company/api/orders/v1";

message Order {
    string order_id = 1;
    string customer_id = 2;
    OrderStatus status = 3;
    repeated OrderItem items = 4;
    Money total = 5;
    google.protobuf.Timestamp created_at = 6;
    
    // Reserved for future fields — prevents reuse of field numbers
    reserved 7, 8, 9;
    reserved "discount_code", "promo_id";
}

enum OrderStatus {
    ORDER_STATUS_UNSPECIFIED = 0;  // Required zero value for proto3
    ORDER_STATUS_DRAFT = 1;
    ORDER_STATUS_PENDING = 2;
    ORDER_STATUS_PAID = 3;
    ORDER_STATUS_SHIPPED = 4;
    ORDER_STATUS_DELIVERED = 5;
    ORDER_STATUS_CANCELLED = 6;
}

message OrderItem {
    string product_id = 1;
    string product_name = 2;
    int32 quantity = 3;
    Money unit_price = 4;
}

message Money {
    int64 amount_cents = 1;
    string currency_code = 2;  // ISO 4217
}
```

## Avro Schema (for Kafka)

```json
{
  "type": "record",
  "name": "OrderPlaced",
  "namespace": "com.company.orders.v1",
  "doc": "Event emitted when an order is placed",
  "fields": [
    {"name": "order_id", "type": "string", "doc": "UUID"},
    {"name": "customer_id", "type": "string"},
    {"name": "status", "type": {
      "type": "enum",
      "name": "OrderStatus",
      "symbols": ["DRAFT", "PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"]
    }},
    {"name": "total_cents", "type": "long"},
    {"name": "currency", "type": "string", "default": "USD"},
    {"name": "occurred_at", "type": "string", "doc": "ISO 8601 timestamp"},
    {"name": "metadata", "type": {"type": "map", "values": "string"}, "default": {}}
  ]
}
```

## Schema Evolution Rules

```
BACKWARD COMPATIBLE (new readers can read old data):
  ✓ Add optional field with default value
  ✓ Remove field (old field becomes null/default)
  ✓ Add value to enum (old readers ignore unknown values)

FORWARD COMPATIBLE (old readers can read new data):
  ✓ Remove field
  ✓ Add field (old reader ignores unknown field)

BREAKING (never do without major version bump):
  ✗ Rename field
  ✗ Change field type (int → string)
  ✗ Remove enum value (old readers crash on unknown)
  ✗ Change field number (Protobuf — changes wire encoding)
```

## Python Pydantic + JSON

```python
from pydantic import BaseModel, Field
from enum import Enum
from datetime import datetime
from typing import Optional

class OrderStatus(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    PAID = "paid"

class OrderItem(BaseModel):
    product_id: str
    product_name: str
    quantity: int = Field(ge=1, le=999)
    unit_price_cents: int = Field(ge=0)

class Order(BaseModel):
    order_id: str
    customer_id: str
    status: OrderStatus
    items: list[OrderItem]
    total_cents: int
    currency: str = "USD"
    created_at: datetime
    # V2 addition — Optional with default for backward compat
    discount_code: Optional[str] = None
    
    model_config = {"use_enum_values": True}

# Serialize
order = Order(...)
json_bytes = order.model_dump_json()
dict_repr = order.model_dump()
dict_repr_alias = order.model_dump(by_alias=True)  # camelCase keys

# Deserialize
order = Order.model_validate_json(json_bytes)
order = Order.model_validate(dict_data)
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Storing amounts as floats** | `0.1 + 0.2 != 0.3` — financial bugs | Store as integer cents; use Decimal for display |
| **No schema validation** | Bad data silently corrupts downstream | Schema validation at deserialization time |
| **Breaking schema changes without version bump** | Consumers crash silently | Backward-compatible changes only in same version |
| **Serializing entire ORM objects** | Leaks internal structure; couples API to DB | Explicit serialization layer (DTOs) |
| **Timestamps without timezone** | Ambiguous in multi-region; DST bugs | Always UTC; ISO 8601 with Z suffix |

## 10 Rules

1. Money is always integers (cents) — never floats.
2. Timestamps are always UTC ISO 8601 — never naive datetimes.
3. Schema changes must be backward compatible — add optional fields; never rename or remove.
4. Reserve field numbers in Protobuf when removing fields — prevents reuse.
5. Validate at deserialization time — fail fast on schema violations, not in business logic.
6. Separate serialization schemas (DTOs) from domain models — they change at different rates.
7. JSON for human-facing APIs; binary formats (Protobuf/Avro) for high-volume internal messaging.
8. Store raw bytes alongside decoded content for debugging — binary formats are unreadable otherwise.
9. Generate code from schemas — don't handwrite Protobuf/Avro structs.
10. Schema registry for Kafka Avro — centralize schema management; prevent incompatible producers.

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

The canonical workflow for **Data Serialization** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Choose and implement data serialization formats for APIs, storage, and messaging. Outputs format comparison, schema design, versioning strategy, and performance
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
