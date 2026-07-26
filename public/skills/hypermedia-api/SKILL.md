---
name: hypermedia-api
description: Design hypermedia APIs (HATEOAS) that guide clients through available actions via links. Outputs link relation design, HAL/JSON:API format, state machine navigation, and client coupling reduction.
argument-hint: [API complexity, client types, developer audience, versioning concerns]
allowed-tools: Read, Write
---

# Hypermedia API Design (HATEOAS)

Hypermedia as the Engine of Application State (HATEOAS) embeds links in API responses that tell clients what actions are available next. Instead of clients hardcoding URLs and action logic, the server drives the workflow through links. This reduces coupling and enables server-side evolution without breaking clients.

## Core Concept

```
Without HATEOAS:
  Client knows: GET /orders/{id} → if status=="pending", POST /orders/{id}/confirm
  Client hardcodes business logic and URL structure

With HATEOAS:
  Server returns: order + links: [{rel: "confirm", href: "/orders/123/confirm", method: "POST"}]
  Client follows links by relation name — not hardcoded URLs
  Server can change URLs, add/remove actions without breaking clients
```

## HAL (Hypertext Application Language)

```python
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Any

app = FastAPI()

def hal_link(href: str, method: str = "GET", title: str = None) -> dict:
    link = {"href": href, "method": method}
    if title:
        link["title"] = title
    return link

def order_to_hal(order: dict, base_url: str) -> dict:
    """Convert order to HAL+JSON with appropriate action links."""
    order_id = order["id"]

    links = {
        "self": hal_link(f"{base_url}/orders/{order_id}"),
        "collection": hal_link(f"{base_url}/orders"),
    }

    # Only include links for valid state transitions
    status = order["status"]
    if status == "draft":
        links["confirm"] = hal_link(f"{base_url}/orders/{order_id}/confirm", "POST",
                                     "Confirm this order")
        links["cancel"] = hal_link(f"{base_url}/orders/{order_id}/cancel", "POST",
                                    "Cancel this order")

    elif status == "confirmed":
        links["ship"] = hal_link(f"{base_url}/orders/{order_id}/ship", "POST",
                                  "Mark as shipped")
        links["cancel"] = hal_link(f"{base_url}/orders/{order_id}/cancel", "POST",
                                    "Cancel this order")

    elif status == "shipped":
        links["deliver"] = hal_link(f"{base_url}/orders/{order_id}/deliver", "POST",
                                     "Mark as delivered")

    # No links for terminal states (delivered, cancelled)

    return {
        "_links": links,
        "id": order["id"],
        "status": order["status"],
        "total": order["total"],
        "created_at": order["created_at"],
    }

@app.get("/orders/{order_id}")
async def get_order(order_id: str, request):
    order = await db.get_order(order_id)
    base_url = str(request.base_url).rstrip("/")
    return order_to_hal(order, base_url)
```

## Link Relations

```python
# Standard IANA link relations (use these before inventing custom ones)
STANDARD_RELATIONS = {
    "self":     "The URL of the current resource",
    "next":     "The next page in a collection",
    "prev":     "The previous page in a collection",
    "first":    "The first page in a collection",
    "last":     "The last page in a collection",
    "item":     "An item in a collection",
    "collection": "The collection this item belongs to",
    "related":  "A related resource",
    "edit":     "URL to edit this resource",
    "delete":   "URL to delete this resource",
    "search":   "URL for searching",
}

# Custom relations (namespaced to avoid collisions)
CUSTOM_RELATIONS = {
    "acme:confirm":  "Confirm a draft order",
    "acme:cancel":   "Cancel an order",
    "acme:ship":     "Mark an order as shipped",
    "acme:deliver":  "Mark an order as delivered",
    "acme:refund":   "Initiate a refund",
}
```

## Collection with Pagination Links

```python
def paginated_collection(items: list, page: int, total: int,
                          per_page: int, base_url: str,
                          path: str, item_serializer) -> dict:
    total_pages = (total + per_page - 1) // per_page

    links = {
        "self":  hal_link(f"{base_url}{path}?page={page}&per_page={per_page}"),
        "first": hal_link(f"{base_url}{path}?page=1&per_page={per_page}"),
        "last":  hal_link(f"{base_url}{path}?page={total_pages}&per_page={per_page}"),
    }

    if page > 1:
        links["prev"] = hal_link(f"{base_url}{path}?page={page-1}&per_page={per_page}")
    if page < total_pages:
        links["next"] = hal_link(f"{base_url}{path}?page={page+1}&per_page={per_page}")

    return {
        "_links": links,
        "_embedded": {
            "items": [item_serializer(item, base_url) for item in items]
        },
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
    }
```

## Client-Side Link Following

```typescript
// Hypermedia-aware client: follows links by relation name
class HypermediaClient {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  async getOrder(orderId: string) {
    return this.fetch(`/orders/${orderId}`);
  }

  async followLink(resource: any, rel: string, body?: any) {
    const link = resource._links?.[rel];
    if (!link) throw new Error(`No link with rel="${rel}" available`);

    return this.fetch(link.href, link.method ?? "GET", body);
  }

  private async fetch(path: string, method = "GET", body?: any) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
}

// Usage: client drives workflow through links
const client = new HypermediaClient("https://api.acme.com/v1", "sk_...");
const order = await client.getOrder("ord-123");

if (order._links.confirm) {
  // Server says confirm is available — client doesn't need to know when
  const confirmed = await client.followLink(order, "confirm");
}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Hardcoding all possible links** | Client couples to URL structure | Only include links for valid current state |
| **Custom relation names without namespace** | Collision with standard relations | Namespace: `acme:confirm` not `confirm` |
| **HATEOAS without documentation** | Clients don't know what relations exist | Document all custom link relations |
| **Changing link relations without versioning** | Breaks clients that depend on relation names | Relation names are contracts; never rename |
| **HATEOAS on simple CRUD** | Over-engineering; adds complexity without benefit | Use HATEOAS for state-machine workflows; not simple resources |

## 10 Rules

1. Only include links that are valid in the current resource state — not all possible links.
2. Use standard IANA relation names where they exist; namespace custom ones.
3. Link `href` values are opaque to clients — clients follow links, not construct URLs.
4. `method` in the link tells the client the HTTP verb to use for that action.
5. Relation names are stable contracts — never rename a relation; add new ones instead.
6. Collections include pagination links: next, prev, first, last.
7. Document all custom link relations in the API reference.
8. HATEOAS is most valuable for complex state machines — not for simple CRUD.
9. Clients that follow links by relation name decouple from URL structure changes.
10. Test that all valid state transitions have corresponding links; invalid transitions have none.
