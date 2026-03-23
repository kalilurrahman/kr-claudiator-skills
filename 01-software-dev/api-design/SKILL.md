---
name: api-design
description: Design a complete REST or GraphQL API from requirements. Outputs endpoints, request/response schemas, error handling, authentication, versioning strategy, and OpenAPI-ready documentation.
argument-hint: [resource names, operations needed, auth method, versioning strategy]
allowed-tools: Read, Write
---

# API Design

A well-designed API is a product. It should be intuitive to the first-time caller, predictable under error conditions, and stable across versions. Design the API contract before writing implementation code — changing a public API after clients exist is expensive.

## Design Principles

- **Resource-oriented** — URLs identify resources (nouns), HTTP methods express actions (verbs).
- **Consistent** — naming, casing, error formats, and pagination are uniform across every endpoint.
- **Predictable** — similar operations behave the same way everywhere.
- **Evolvable** — design for change from day one with versioning and extensible schemas.
- **Secure by default** — authentication and authorisation are required, not optional.

## HTTP Method Semantics

| Method | Use | Idempotent | Body |
|--------|-----|-----------|------|
| GET | Read resource(s) | Yes | No |
| POST | Create resource | No | Yes |
| PUT | Replace entire resource | Yes | Yes |
| PATCH | Partial update | No | Yes |
| DELETE | Remove resource | Yes | No |

## URL Design Rules

```
# Good
GET    /v1/orders              # list orders
GET    /v1/orders/{id}         # get specific order
POST   /v1/orders              # create order
PATCH  /v1/orders/{id}         # partial update
DELETE /v1/orders/{id}         # delete order
GET    /v1/orders/{id}/items   # sub-resource

# Bad
GET  /getOrders
POST /createNewOrder
GET  /order_detail?orderId=123
POST /orders/delete
```

## Process

1. **List all resources** — identify the nouns: users, orders, products, invoices.
2. **Define operations** — for each resource: which CRUD operations are needed?
3. **Define relationships** — which resources nest under others? (order → items)
4. **Design request schemas** — required fields, optional fields, types, constraints.
5. **Design response schemas** — what does success look like? What fields are always present?
6. **Define error format** — consistent error envelope across all endpoints.
7. **Design authentication** — JWT, API key, OAuth2 — pick one and apply consistently.
8. **Define pagination** — cursor or offset? Consistent across all list endpoints.
9. **Plan versioning** — URL versioning (`/v1/`) or header versioning.
10. **Write OpenAPI spec** — machine-readable contract for client generation and docs.

## Output Format

```yaml
# OpenAPI 3.0 skeleton
openapi: 3.0.3
info:
  title: [API Name]
  version: 1.0.0
  description: [What this API does]

servers:
  - url: https://api.example.com/v1
    description: Production
  - url: https://api-staging.example.com/v1
    description: Staging

security:
  - bearerAuth: []

paths:
  /orders:
    get:
      summary: List orders
      operationId: listOrders
      tags: [Orders]
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, processing, shipped, delivered, cancelled]
        - name: cursor
          in: query
          schema:
            type: string
          description: Pagination cursor from previous response
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderList'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '422':
          $ref: '#/components/responses/ValidationError'

    post:
      summary: Create order
      operationId: createOrder
      tags: [Orders]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOrderRequest'
      responses:
        '201':
          description: Order created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
        '422':
          $ref: '#/components/responses/ValidationError'

  /orders/{id}:
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    get:
      summary: Get order
      operationId: getOrder
      tags: [Orders]
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
        '404':
          $ref: '#/components/responses/NotFound'
    patch:
      summary: Update order
      operationId: updateOrder
      tags: [Orders]
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateOrderRequest'
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
    delete:
      summary: Cancel order
      operationId: cancelOrder
      tags: [Orders]
      responses:
        '204':
          description: Deleted

components:
  schemas:
    Order:
      type: object
      required: [id, status, created_at, customer_id]
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        status:
          type: string
          enum: [pending, processing, shipped, delivered, cancelled]
        customer_id:
          type: string
          format: uuid
        total_amount:
          type: integer
          description: Amount in cents
        currency:
          type: string
          default: USD
        items:
          type: array
          items:
            $ref: '#/components/schemas/OrderItem'
        created_at:
          type: string
          format: date-time
          readOnly: true
        updated_at:
          type: string
          format: date-time
          readOnly: true

    CreateOrderRequest:
      type: object
      required: [customer_id, items]
      properties:
        customer_id:
          type: string
          format: uuid
        items:
          type: array
          minItems: 1
          items:
            type: object
            required: [product_id, quantity]
            properties:
              product_id:
                type: string
                format: uuid
              quantity:
                type: integer
                minimum: 1

    OrderList:
      type: object
      properties:
        data:
          type: array
          items:
            $ref: '#/components/schemas/Order'
        pagination:
          $ref: '#/components/schemas/Pagination'

    Pagination:
      type: object
      properties:
        next_cursor:
          type: string
          nullable: true
        has_more:
          type: boolean
        total:
          type: integer

    Error:
      type: object
      required: [error, message]
      properties:
        error:
          type: string
          description: Machine-readable error code
          example: validation_failed
        message:
          type: string
          description: Human-readable description
        details:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string
        request_id:
          type: string
          description: Trace ID for debugging

  responses:
    Unauthorized:
      description: Authentication required
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            error: unauthorized
            message: Valid authentication credentials are required
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            error: not_found
            message: The requested resource does not exist
    ValidationError:
      description: Invalid request
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            error: validation_failed
            message: Request validation failed
            details:
              - field: items
                message: At least one item is required

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

## Error Codes — Standard Set

| HTTP Status | Error code | When to use |
|-------------|-----------|-------------|
| 400 | `bad_request` | Malformed JSON or missing required fields |
| 401 | `unauthorized` | No or invalid auth token |
| 403 | `forbidden` | Authenticated but not authorised |
| 404 | `not_found` | Resource does not exist |
| 409 | `conflict` | Duplicate resource or state conflict |
| 422 | `validation_failed` | Request is valid JSON but fails business validation |
| 429 | `rate_limited` | Too many requests |
| 500 | `internal_error` | Unexpected server error |
| 503 | `service_unavailable` | Dependency down, try again |

## Pagination Patterns

### Cursor-based (recommended for large datasets)
```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6IjEyMyJ9",
    "has_more": true
  }
}
```
```
GET /orders?cursor=eyJpZCI6IjEyMyJ9&limit=20
```
Pros: stable under concurrent writes, efficient for large tables.
Cons: cannot jump to page N directly.

### Offset-based (simple, suits small datasets)
```json
{
  "data": [...],
  "pagination": {
    "total": 487,
    "offset": 40,
    "limit": 20
  }
}
```
Pros: supports random page access.
Cons: drifts under concurrent inserts/deletes.

## Authentication Patterns

### JWT Bearer (stateless, recommended for APIs)
```
Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...
```
- Tokens are self-contained and verified locally
- Include `exp`, `iat`, `sub`, `scope` claims
- Short expiry (15 min) + refresh token pattern

### API Key (simple, for server-to-server)
```
X-API-Key: sk_live_abc123
Authorization: Bearer sk_live_abc123
```
- Store hashed in database, never plaintext
- Prefix with environment (`sk_live_`, `sk_test_`)
- Include in every request log for tracing

## Versioning Strategy

### URL versioning (recommended)
```
/v1/orders    # stable
/v2/orders    # breaking change
```
- Visible, explicit, easy to route
- Support at least one previous major version for 12 months

### Deprecation process
1. Announce deprecation date in `Deprecation` response header
2. Add `Sunset` header with the removal date
3. Log usage of deprecated endpoints to notify active callers
4. Remove only after usage drops to zero or sunset date passes

## Worked Example: Order API Design Session

**Requirement:** "Build an API for our order management system"

**Step 1 — List resources:**
Orders, OrderItems, Customers, Products, Invoices

**Step 2 — Define operations:**
- Orders: CRUD + status transitions (confirm, ship, cancel)
- OrderItems: read-only (managed via order creation)
- Customers: CRUD
- Products: read-only from API (managed via admin)

**Step 3 — Identify non-obvious decisions:**
- Status transitions: use PATCH with `status` field, or dedicated action endpoints (`/orders/{id}/ship`)?
  → Use PATCH for simple status; dedicated endpoints for complex transitions with side effects
- Monetary values: float or integer cents?
  → Always integer cents — floats cause rounding errors in financial data
- IDs: auto-increment integers or UUIDs?
  → UUIDs — non-guessable, safe to expose, portable across systems

## Anti-Patterns to Avoid

| Anti-pattern | Example | Fix |
|-------------|---------|-----|
| Verbs in URLs | `POST /createOrder` | `POST /orders` |
| Inconsistent naming | `/userProfiles` and `/order_items` mixed | Pick snake_case or camelCase, apply everywhere |
| Returning 200 for errors | `{success: false, error: "not found"}` with HTTP 200 | Use proper HTTP status codes |
| Exposing internal IDs | Auto-increment `id: 4821` | Use UUIDs |
| Missing pagination | Return all 50,000 records | Always paginate list endpoints |
| Chatty API | 10 calls to build one screen | Design endpoints around client use cases |
| Breaking changes in same version | Change field type in `/v1/` | Bump to `/v2/` for breaking changes |

## Rules

- **Resources are nouns, methods are verbs** — never put actions in URLs except for non-CRUD operations.
- **Consistent error envelope** — every error response has the same shape across every endpoint.
- **Version from day one** — `/v1/` prefix even for internal APIs; you will need it eventually.
- **Monetary values as integer cents** — never use floats for money.
- **UUIDs for public IDs** — never expose auto-increment integers in public APIs.
- **Paginate every list endpoint** — no endpoint returns an unbounded collection.
- **Authentication on every endpoint by default** — opt-out for public endpoints, not opt-in.
- **Document every field** — description, type, example, and whether it is required or optional.
- **Use `readOnly` for server-generated fields** — `id`, `created_at`, `updated_at` are never in request bodies.
- **Test the contract, not the implementation** — API contract tests catch breaking changes before clients do.
