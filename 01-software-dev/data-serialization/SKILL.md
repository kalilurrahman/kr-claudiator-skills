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
