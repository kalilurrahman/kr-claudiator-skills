---
name: api-pagination-design
description: Design pagination strategies for APIs handling large datasets. Outputs offset, cursor, keyset, and seek pagination implementations with performance analysis.
argument-hint: [dataset size, sort requirements, real-time data, client type]
allowed-tools: Read, Write
---

# API Pagination Design

Pagination makes large datasets navigable without returning millions of rows. The right strategy depends on whether data is static or real-time, whether clients need random access, and the performance characteristics of your database.

## Strategy Comparison

```
OFFSET/LIMIT  → Page 1, 2, 3...
  Pros: Simple; random page access; easy total count
  Cons: Slow on large offsets (DB scans skipped rows); inconsistent on inserts
  Use: Small static datasets (<100k rows); admin UIs

CURSOR-BASED  → Next: "eyJpZCI6MTIzfQ..."
  Pros: Consistent; no skipped rows; O(1) regardless of position
  Cons: No random access; next/prev only; cursor expires
  Use: Feeds, timelines, API pagination for large datasets (recommended default)

KEYSET (SEEK) → After: id > 12345
  Pros: Fastest; uses DB index directly; no cursor encoding
  Cons: Requires stable sort column; no total count
  Use: High-performance APIs; infinite scroll
```

## Cursor-Based Pagination

```python
from fastapi import FastAPI, Query
from pydantic import BaseModel
from typing import Optional
import base64, json

class OrdersPage(BaseModel):
    items: list[dict]
    next_cursor: Optional[str] = None
    prev_cursor: Optional[str] = None
    has_more: bool

def encode_cursor(data: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(data).encode()).decode()

def decode_cursor(cursor: str) -> dict:
    return json.loads(base64.urlsafe_b64decode(cursor).decode())

@app.get("/api/v1/orders", response_model=OrdersPage)
async def list_orders(
    limit: int = Query(default=20, ge=1, le=100),
    cursor: Optional[str] = Query(default=None),
    order_by: str = Query(default="created_at", pattern="^(created_at|updated_at)$"),
):
    limit_with_extra = limit + 1  # Fetch one extra to detect has_more
    
    if cursor:
        cursor_data = decode_cursor(cursor)
        # Use composite cursor for stable pagination with ties
        rows = await db.execute(
            f"""SELECT * FROM orders
                WHERE (created_at, id) < (:cursor_ts, :cursor_id)
                ORDER BY created_at DESC, id DESC
                LIMIT :limit""",
            {"cursor_ts": cursor_data["ts"], "cursor_id": cursor_data["id"],
             "limit": limit_with_extra}
        )
    else:
        rows = await db.execute(
            f"SELECT * FROM orders ORDER BY created_at DESC, id DESC LIMIT :limit",
            {"limit": limit_with_extra}
        )
    
    has_more = len(rows) > limit
    items = rows[:limit]  # Drop the extra item
    
    next_cursor = None
    if has_more and items:
        last = items[-1]
        next_cursor = encode_cursor({"ts": last["created_at"].isoformat(), "id": last["id"]})
    
    return OrdersPage(items=items, next_cursor=next_cursor, has_more=has_more)
```

## Keyset Pagination (High Performance)

```sql
-- Fastest for large tables — uses index directly
-- After cursor: (created_at=2024-03-15, id=12345)

SELECT * FROM orders
WHERE (created_at, id) < ('2024-03-15T14:30:00', '12345')  -- Composite condition
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- Required index:
CREATE INDEX orders_pagination_idx ON orders (created_at DESC, id DESC);
-- This index makes the query O(log n) regardless of position in dataset
```

## Response Format

```json
{
  "items": [...],
  "pagination": {
    "has_more": true,
    "next_cursor": "eyJjcmVhdGVkX2F0IjoiMjAyNC0wMy0xNVQxNDozMDowMFoiLCJpZCI6IjEyMzQ1In0",
    "count": 20,
    "limit": 20
  }
}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **OFFSET on large tables** | `OFFSET 100000` scans 100k rows to discard | Keyset/cursor pagination |
| **No index on sort column** | Pagination query becomes full table scan | Index on every column used in ORDER BY |
| **Total count on every page** | `COUNT(*)` is expensive on large tables | Return count only on first page; omit otherwise |
| **Mutable cursor data** | Cursor encodes DB row data; leaks schema | Encode opaque tokens; decode server-side |
| **Unlimited page size** | `limit=99999` returns millions of rows | Max limit (100-1000) enforced server-side |

## 10 Rules

1. Cursor-based pagination is the default for production APIs — offset/limit only for small static datasets.
2. Composite cursor (timestamp + id) handles ties correctly — single-field cursors lose rows on duplicate values.
3. Always index the sort column(s) — unindexed pagination is a full table scan.
4. Return one extra item to detect `has_more` — avoids a separate COUNT query.
5. Cursors are opaque to clients — encode/decode server-side; never expose raw values.
6. Enforce maximum page size — unbounded limit is a DoS vector.
7. Stable sort is mandatory — random ORDER BY with pagination produces inconsistent results.
8. Cursor-only (no total count) is acceptable for infinite scroll — total counts are expensive.
9. Keyset pagination uses DB composite row comparison — it's faster than cursor comparison for most engines.
10. Document cursor expiry — cursors pointing to deleted rows need graceful handling.
