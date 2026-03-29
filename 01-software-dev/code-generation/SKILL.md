---
name: code-generation
description: Design and implement code generation pipelines from schemas, OpenAPI specs, or domain models. Outputs generator architecture, template design, validation strategy, and CI integration.
argument-hint: [source format, target language, generation scope, customisation requirements]
allowed-tools: Read, Write, Bash
---

# Code Generation

Code generation eliminates boilerplate, ensures consistency, and keeps code in sync with a source of truth (schema, spec, or model). The design challenge is determining what to generate (repetitive, low-value code) vs what to handwrite (unique business logic), and how to handle customisation without losing regeneration ability.

## Process

1. **Identify the source of truth.** OpenAPI spec, JSON Schema, Protobuf, database schema, or custom DSL.
2. **Define what to generate.** Types, clients, server stubs, validation code, documentation, test fixtures.
3. **Choose the generator.** OpenAPI Generator, Quicktype, sqlc, codegen, or custom Jinja/Mustache templates.
4. **Design the customisation strategy.** Generated files are overwritten; custom files extend them. Never edit generated files.
5. **Integrate into CI.** Regenerate on schema change; fail CI if generated code is out of sync.
6. **Version the schema.** Generated code is a build artifact; track schema changes carefully.

## OpenAPI → TypeScript Client

```yaml
# openapi.yaml (source of truth)
openapi: 3.0.3
info:
  title: Orders API
  version: 2.0.0
paths:
  /orders:
    post:
      operationId: createOrder
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOrderRequest'
      responses:
        '201':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
components:
  schemas:
    CreateOrderRequest:
      type: object
      required: [customerId, items]
      properties:
        customerId: { type: string }
        items:
          type: array
          items:
            $ref: '#/components/schemas/OrderItem'
    Order:
      type: object
      properties:
        orderId: { type: string }
        status: { type: string, enum: [draft, confirmed, shipped] }
        totalAmount: { type: number }
```

```bash
# Generate TypeScript client from OpenAPI spec
npx @openapitools/openapi-generator-cli generate   -i openapi.yaml   -g typescript-fetch   -o src/generated/api-client   --additional-properties=typescriptThreePlus=true,supportsES6=true

# Generated: src/generated/api-client/
#   api/OrdersApi.ts    — typed API methods
#   models/Order.ts     — TypeScript interfaces
#   models/index.ts
```

```typescript
// Custom wrapper (never edit generated files — extend them)
// src/api/orders.ts
import { OrdersApi, CreateOrderRequest } from '../generated/api-client';

const api = new OrdersApi({ basePath: process.env.API_BASE_URL });

export async function placeOrder(request: CreateOrderRequest) {
  const order = await api.createOrder({ createOrderRequest: request });
  return order;
}
```

## Database Schema → Go Code (sqlc)

```sql
-- schema.sql (source of truth)
CREATE TABLE orders (
    id          UUID PRIMARY KEY,
    customer_id UUID NOT NULL,
    status      TEXT NOT NULL,
    total_cents INTEGER NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL
);

-- queries/orders.sql
-- name: GetOrder :one
SELECT * FROM orders WHERE id = $1;

-- name: ListOrdersByCustomer :many
SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC;

-- name: CreateOrder :one
INSERT INTO orders (id, customer_id, status, total_cents, created_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;
```

```yaml
# sqlc.yaml
version: "2"
sql:
  - engine: postgresql
    queries: queries/
    schema: schema.sql
    gen:
      go:
        package: db
        out: internal/db
        emit_interface: true
```

```bash
sqlc generate
# Generates: internal/db/
#   models.go       — Order struct
#   orders.sql.go   — GetOrder, ListOrdersByCustomer, CreateOrder methods
#   db.go           — DBTX interface
```

## Custom Template-Based Generator

```python
# generator.py — custom Jinja2 code generator
from jinja2 import Environment, FileSystemLoader
import json
from pathlib import Path

env = Environment(loader=FileSystemLoader("templates/"))

def generate_from_schema(schema_path: str, output_dir: str):
    schema = json.loads(Path(schema_path).read_text())
    output = Path(output_dir)
    output.mkdir(exist_ok=True)
    
    for model_name, model_def in schema["models"].items():
        # Generate Python dataclass
        code = env.get_template("model.py.j2").render(
            model_name=model_name,
            fields=model_def["fields"],
        )
        (output / f"{to_snake(model_name)}.py").write_text(code)
        
        # Generate TypeScript interface
        ts = env.get_template("model.ts.j2").render(
            model_name=model_name,
            fields=model_def["fields"],
        )
        (output / f"{model_name}.ts").write_text(ts)
```

```
{# templates/model.py.j2 #}
# AUTO-GENERATED — DO NOT EDIT. Source: {{ schema_path }}
from dataclasses import dataclass
from typing import Optional

@dataclass
class {{ model_name }}:
{% for field in fields %}
    {{ field.name }}: {% if not field.required %}Optional[{% endif %}{{ field.python_type }}{% if not field.required %}]{% endif %}{% if not field.required %} = None{% endif %}

{% endfor %}
```

## CI Sync Check

```yaml
# .github/workflows/codegen-check.yml
- name: Regenerate and check for drift
  run: |
    # Regenerate all generated code
    make generate
    
    # Fail if any generated files changed (drift detected)
    if ! git diff --exit-code src/generated/; then
      echo "FAIL: Generated code is out of sync with schema."
      echo "Run 'make generate' and commit the changes."
      git diff src/generated/
      exit 1
    fi
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Editing generated files** | Changes lost on next generation | Generated files are read-only; extend via wrappers |
| **Generating business logic** | Generated logic is wrong; unmaintainable | Generate types, clients, stubs — not business rules |
| **No drift detection in CI** | Schema evolves; generated code silently stale | CI fails on drift |
| **Complex templates** | Template maintenance becomes its own burden | Simple templates; complex logic in the generator script |
| **Generating everything** | Massive generated surface area | Generate only repetitive, schema-driven code |

## 10 Rules

1. Generated files are never edited — mark them with a header warning.
2. The schema is the source of truth — generated code is a build artifact.
3. CI detects drift — regenerate and check for diff on every PR.
4. Custom logic extends generated code via wrappers — never in generated files.
5. Simple templates are maintainable templates — move complex logic to the generator script.
6. Generate types, clients, and stubs — not business logic or algorithms.
7. Version the schema alongside the generated code — they change together.
8. Test the generator, not just the generated code.
9. Document what is generated and from where — future engineers shouldn't have to discover this.
10. Consider what changes when the schema evolves — breaking changes in generation require migration.
