---
name: openapi-design
description: Design and document REST APIs using the OpenAPI 3.1 specification — schemas, security definitions, response codes, examples, and SDK generation. Outputs complete OpenAPI specs, documentation, and validation tooling.
argument-hint: [API domain, authentication method, consumer base, documentation requirements]
allowed-tools: Read, Write, Bash
---

# OpenAPI Design

OpenAPI is the contract between your API and its consumers. A well-designed OpenAPI spec is accurate (matches actual API behavior), complete (all endpoints, all error codes), and useful (rich examples, clear descriptions). It drives documentation, SDK generation, mock servers, and contract testing.

## Design Principles

- **Design spec first** — write the OpenAPI spec before implementation; the spec is the design document.
- **Be prescriptive about errors** — document all error codes, not just 200; consumers need to handle failures.
- **Use $ref for reuse** — schemas, parameters, and responses defined once and referenced everywhere.
- **Rich examples** — every endpoint should have request and response examples, not just schemas.
- **Semantic versioning in the URL** — `/api/v1/` not `/api/`.

## Process

1. **Define the domain model** — identify the core resources and their relationships.
2. **Design endpoints** — CRUD + actions; resource-oriented URLs.
3. **Define schemas with validation** — types, formats, required fields, patterns, constraints.
4. **Specify error responses** — 400, 401, 403, 404, 409, 422, 429, 500 for every endpoint.
5. **Add security definitions** — bearer token, API key, OAuth flows.
6. **Write examples** — realistic, not `string` and `0`.
7. **Validate the spec** — lint against OpenAPI rules.
8. **Generate SDK and docs** — from spec, not from code.

## Output Format

### Complete OpenAPI 3.1 Spec

```yaml
# openapi.yaml
openapi: "3.1.0"

info:
  title: Orders API
  version: "2.0.0"
  description: |
    The Orders API manages order creation, fulfillment, and tracking.
    
    ## Authentication
    All endpoints require a Bearer token. Obtain a token via POST /auth/token.
    
    ## Rate Limiting
    Requests are limited by plan: Starter 60/min, Growth 600/min, Enterprise 6000/min.
    Rate limit status is returned in X-RateLimit-Remaining and X-RateLimit-Reset headers.
  contact:
    name: Platform Team
    email: platform@example.com
    url: https://docs.example.com
  license:
    name: Proprietary
  termsOfService: https://example.com/terms

servers:
  - url: https://api.example.com/v2
    description: Production
  - url: https://staging-api.example.com/v2
    description: Staging

tags:
  - name: Orders
    description: Order management
  - name: Fulfillment
    description: Shipping and delivery operations

security:
  - BearerAuth: []

paths:
  /orders:
    get:
      operationId: listOrders
      tags: [Orders]
      summary: List orders
      description: Returns a paginated list of orders. Results are sorted by created_at descending.
      parameters:
        - $ref: "#/components/parameters/PageSize"
        - $ref: "#/components/parameters/Cursor"
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, paid, shipped, delivered, cancelled]
          description: Filter by order status
        - name: user_id
          in: query
          schema:
            type: string
            format: uuid
          description: Filter by user ID
        - name: created_after
          in: query
          schema:
            type: string
            format: date-time
          example: "2024-01-01T00:00:00Z"
      responses:
        "200":
          description: Paginated list of orders
          headers:
            X-RateLimit-Remaining:
              $ref: "#/components/headers/RateLimitRemaining"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/OrderList"
              example:
                items:
                  - id: "ord_01hx2k3m4n5p6q7r"
                    status: "paid"
                    user:
                      id: "usr_01hx2k3m4n5p6q7s"
                      email: "alice@example.com"
                    total_cents: 4999
                    created_at: "2024-02-15T10:30:00Z"
                next_cursor: "eyJpZCI6Mn0="
                has_more: true
                total: 142
        "401":
          $ref: "#/components/responses/Unauthorized"
        "422":
          $ref: "#/components/responses/ValidationError"
        "429":
          $ref: "#/components/responses/RateLimited"
        "500":
          $ref: "#/components/responses/InternalError"
    
    post:
      operationId: createOrder
      tags: [Orders]
      summary: Create an order
      description: Creates a new order. Inventory is checked and held synchronously; payment is charged asynchronously.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateOrderRequest"
            example:
              user_id: "usr_01hx2k3m4n5p6q7s"
              items:
                - product_id: "prd_01hx2k3m4n5p6q7t"
                  quantity: 2
              shipping_address:
                line1: "123 Main St"
                city: "San Francisco"
                state: "CA"
                postal_code: "94102"
                country: "US"
      responses:
        "201":
          description: Order created successfully
          headers:
            Location:
              description: URL of the created order
              schema:
                type: string
              example: "/v2/orders/ord_01hx2k3m4n5p6q7r"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Order"
        "400":
          $ref: "#/components/responses/BadRequest"
        "404":
          description: User or product not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
              example:
                error: "product_not_found"
                message: "Product prd_xxx does not exist"
                details:
                  field: "items[0].product_id"
        "409":
          description: Insufficient inventory
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
              example:
                error: "insufficient_inventory"
                message: "Only 1 unit of Product XYZ available"
        "422":
          $ref: "#/components/responses/ValidationError"
        "429":
          $ref: "#/components/responses/RateLimited"

  /orders/{orderId}:
    parameters:
      - name: orderId
        in: path
        required: true
        schema:
          type: string
          pattern: "^ord_[a-z0-9]+$"
        example: ord_01hx2k3m4n5p6q7r
    
    get:
      operationId: getOrder
      tags: [Orders]
      summary: Get an order
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Order"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          $ref: "#/components/responses/Forbidden"
        "404":
          $ref: "#/components/responses/NotFound"

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT obtained from POST /auth/token
  
  parameters:
    PageSize:
      name: page_size
      in: query
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20
    Cursor:
      name: cursor
      in: query
      schema:
        type: string
      description: Pagination cursor from previous response's next_cursor field
  
  headers:
    RateLimitRemaining:
      description: Number of requests remaining in the current window
      schema:
        type: integer
  
  schemas:
    Order:
      type: object
      required: [id, status, user, items, total_cents, created_at, updated_at]
      properties:
        id:
          type: string
          pattern: "^ord_[a-z0-9]+$"
          description: Unique order identifier
          example: ord_01hx2k3m4n5p6q7r
        status:
          type: string
          enum: [pending, paid, shipped, delivered, cancelled, refunded]
        user:
          $ref: "#/components/schemas/UserRef"
        items:
          type: array
          items:
            $ref: "#/components/schemas/OrderItem"
          minItems: 1
        total_cents:
          type: integer
          minimum: 0
          description: Order total in USD cents
          example: 4999
        shipping_address:
          $ref: "#/components/schemas/Address"
        created_at:
          type: string
          format: date-time
          example: "2024-02-15T10:30:00Z"
        updated_at:
          type: string
          format: date-time
        _links:
          type: object
          properties:
            self:
              type: string
              example: "/v2/orders/ord_01hx2k3m4n5p6q7r"
            cancel:
              type: string
              example: "/v2/orders/ord_01hx2k3m4n5p6q7r/cancel"
    
    OrderList:
      type: object
      required: [items, has_more]
      properties:
        items:
          type: array
          items:
            $ref: "#/components/schemas/Order"
        next_cursor:
          type: string
          nullable: true
        has_more:
          type: boolean
        total:
          type: integer
          description: Total count (expensive query, may be omitted)
    
    CreateOrderRequest:
      type: object
      required: [user_id, items]
      properties:
        user_id:
          type: string
          format: uuid
        items:
          type: array
          items:
            type: object
            required: [product_id, quantity]
            properties:
              product_id:
                type: string
              quantity:
                type: integer
                minimum: 1
                maximum: 100
          minItems: 1
          maxItems: 50
        shipping_address:
          $ref: "#/components/schemas/Address"
        idempotency_key:
          type: string
          maxLength: 255
          description: Client-generated key for idempotent order creation
    
    Error:
      type: object
      required: [error, message]
      properties:
        error:
          type: string
          description: Machine-readable error code (snake_case)
          example: validation_error
        message:
          type: string
          description: Human-readable error message
        details:
          type: object
          description: Additional context about the error
        request_id:
          type: string
          description: Request ID for support reference
    
    ValidationError:
      allOf:
        - $ref: "#/components/schemas/Error"
        - type: object
          properties:
            errors:
              type: array
              items:
                type: object
                required: [field, message]
                properties:
                  field:
                    type: string
                    example: "items[0].quantity"
                  message:
                    type: string
                    example: "must be between 1 and 100"
                  code:
                    type: string
                    example: "out_of_range"
    
    Address:
      type: object
      required: [line1, city, country]
      properties:
        line1:
          type: string
          maxLength: 100
        line2:
          type: string
          maxLength: 100
          nullable: true
        city:
          type: string
          maxLength: 100
        state:
          type: string
          maxLength: 100
        postal_code:
          type: string
          maxLength: 20
        country:
          type: string
          pattern: "^[A-Z]{2}$"
          description: ISO 3166-1 alpha-2 country code
          example: US
    
    UserRef:
      type: object
      required: [id, email]
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
  
  responses:
    Unauthorized:
      description: Authentication required
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Error"
          example:
            error: unauthorized
            message: "Authentication required. Provide a valid Bearer token."
    
    Forbidden:
      description: Insufficient permissions
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Error"
          example:
            error: forbidden
            message: "You do not have permission to access this resource."
    
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Error"
          example:
            error: not_found
            message: "The requested resource does not exist."
    
    BadRequest:
      description: Invalid request
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Error"
    
    ValidationError:
      description: Request validation failed
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ValidationError"
    
    RateLimited:
      description: Rate limit exceeded
      headers:
        Retry-After:
          schema:
            type: integer
          description: Seconds until rate limit resets
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Error"
          example:
            error: rate_limit_exceeded
            message: "Rate limit of 60 requests/minute exceeded."
    
    InternalError:
      description: Internal server error
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Error"
          example:
            error: internal_error
            message: "An unexpected error occurred. Contact support with the request_id."
            request_id: "req_01hx2k3m4n5p6q7r"
```

### Spec Validation CI

```bash
#!/bin/bash
# scripts/validate-openapi.sh
set -e

# Install tools
npm install -g @redocly/cli spectral-cli

# Validate OpenAPI spec structure
redocly lint openapi.yaml

# Check spec against style rules
spectral lint openapi.yaml --ruleset .spectral.yaml

# Verify spec matches actual implementation
npx dredd openapi.yaml http://localhost:8000

echo "OpenAPI spec is valid and matches implementation"
```

## Rules

- **Design spec first, implement second** — the spec is the design document; code implements the spec.
- **Every endpoint documents every error** — consumers cannot handle errors they don't know about.
- **Real examples, not placeholder strings** — `example: ord_01hx2k3m4n5p6q7r` not `example: string`.
- **Machine-readable error codes** — `error: "product_not_found"` enables consumers to handle specific errors programmatically.
- **$ref everything reusable** — copy-pasting schemas creates inconsistency; use references.
- **Validate the spec in CI** — a spec that doesn't lint is a spec with bugs.
- **Contract tests verify spec matches implementation** — Dredd or Schemathesis to catch drift.
- **Include idempotency key on mutations** — document it in the spec so SDK generators can surface it.
- **Deprecate in the spec before removing** — mark operations as deprecated with migration instructions before removing.
- **Generate SDKs from spec, not from code** — spec-generated SDKs stay in sync; hand-written SDKs drift.