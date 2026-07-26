---
name: api-client-sdk
description: Design and build API client SDKs that are idiomatic, reliable, and easy to use. Outputs SDK architecture, retry/backoff patterns, authentication handling, error types, and documentation strategy.
argument-hint: [target languages, API complexity, authentication types, distribution method]
allowed-tools: Read, Write
---

# API Client SDK Design

A well-designed SDK makes your API feel native to each language it supports. Poor SDKs require developers to understand your HTTP API before using the SDK — which defeats the purpose. Good SDKs are idiomatic, handle retries and errors gracefully, and make the common case trivially easy.

## SDK Design Principles

```
IDIOMATIC
  Use language conventions: Python snake_case, JS camelCase
  Return native types (datetime, not string timestamps)
  Support async/await where language-idiomatic

RELIABLE
  Automatic retry with exponential backoff on transient errors
  Timeout on all requests (never hang indefinitely)
  Handle rate limiting with Retry-After header

EASY TO USE
  Sensible defaults (timeout=30s, max_retries=3)
  Minimal configuration to get started
  Clear error messages with actionable context

TRANSPARENT
  Expose request/response details for debugging
  Allow request interceptors / logging
  Expose rate limit info to callers
```

## Python SDK

```python
# acme_sdk/client.py
from __future__ import annotations

import httpx
import time
import logging
from dataclasses import dataclass
from typing import Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class AcmeAPIError(Exception):
    def __init__(self, message: str, status_code: int, request_id: str = None, body: dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.request_id = request_id
        self.body = body or {}

class AcmeRateLimitError(AcmeAPIError):
    def __init__(self, retry_after: int, **kwargs):
        super().__init__(f"Rate limited. Retry after {retry_after}s", status_code=429, **kwargs)
        self.retry_after = retry_after

class AcmeAuthError(AcmeAPIError):
    pass

class AcmeNotFoundError(AcmeAPIError):
    pass

@dataclass
class ClientConfig:
    api_key: str
    base_url: str = "https://api.acme.com/v1"
    timeout: float = 30.0
    max_retries: int = 3
    retry_on_status: tuple = (429, 500, 502, 503, 504)

class AcmeClient:
    def __init__(self, config: ClientConfig):
        self._config = config
        self._http = httpx.Client(
            base_url=config.base_url,
            headers={
                "Authorization": f"Bearer {config.api_key}",
                "User-Agent": "acme-python-sdk/1.0.0",
                "Accept": "application/json",
            },
            timeout=config.timeout,
        )
        self.orders = OrdersResource(self)

    def _request(self, method: str, path: str, **kwargs) -> dict:
        last_error = None

        for attempt in range(self._config.max_retries + 1):
            try:
                response = self._http.request(method, path, **kwargs)
                request_id = response.headers.get("x-request-id")

                if response.status_code == 401:
                    raise AcmeAuthError("Invalid API key", 401, request_id)
                if response.status_code == 404:
                    raise AcmeNotFoundError("Resource not found", 404, request_id)
                if response.status_code == 429:
                    retry_after = int(response.headers.get("retry-after", 60))
                    if attempt < self._config.max_retries:
                        time.sleep(retry_after)
                        continue
                    raise AcmeRateLimitError(retry_after, request_id=request_id)
                if response.status_code >= 400:
                    body = response.json() if response.content else {}
                    raise AcmeAPIError(
                        body.get("message", f"HTTP {response.status_code}"),
                        response.status_code, request_id, body
                    )

                return response.json()

            except (httpx.TimeoutException, httpx.NetworkError) as e:
                last_error = e
                if attempt < self._config.max_retries:
                    wait = (2 ** attempt) * 0.5  # 0.5s, 1s, 2s
                    logger.warning(f"Request failed (attempt {attempt+1}), retrying in {wait}s: {e}")
                    time.sleep(wait)
                    continue
                raise AcmeAPIError(f"Request failed after {self._config.max_retries+1} attempts: {e}", 0)

    def get(self, path: str, **kwargs) -> dict:
        return self._request("GET", path, **kwargs)

    def post(self, path: str, json: dict = None, **kwargs) -> dict:
        return self._request("POST", path, json=json, **kwargs)

    def patch(self, path: str, json: dict = None, **kwargs) -> dict:
        return self._request("PATCH", path, json=json, **kwargs)

    def delete(self, path: str, **kwargs) -> dict:
        return self._request("DELETE", path, **kwargs)

class OrdersResource:
    def __init__(self, client: AcmeClient):
        self._client = client

    def list(self, page: int = 1, per_page: int = 20,
              status: str = None) -> dict:
        params = {"page": page, "per_page": per_page}
        if status:
            params["status"] = status
        return self._client.get("/orders", params=params)

    def get(self, order_id: str) -> dict:
        return self._client.get(f"/orders/{order_id}")

    def create(self, items: list[dict], shipping_address: str) -> dict:
        return self._client.post("/orders", json={
            "items": items,
            "shipping_address": shipping_address,
        })

    def cancel(self, order_id: str) -> dict:
        return self._client.post(f"/orders/{order_id}/cancel")

# Usage:
# from acme_sdk import AcmeClient, ClientConfig
# client = AcmeClient(ClientConfig(api_key="sk_..."))
# order = client.orders.create(items=[...], shipping_address="...")
```

## TypeScript SDK

```typescript
// src/client.ts
export class AcmeClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly maxRetries: number;

  constructor(config: { apiKey: string; baseUrl?: string; maxRetries?: number }) {
    this.apiKey  = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://api.acme.com/v1";
    this.maxRetries = config.maxRetries ?? 3;

    this.orders = new OrdersResource(this);
  }

  readonly orders: OrdersResource;

  async request<T>(method: string, path: string, options: RequestInit = {}): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        method,
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "acme-ts-sdk/1.0.0",
          ...options.headers,
        },
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("retry-after") ?? "60");
        if (attempt < this.maxRetries) {
          await sleep(retryAfter * 1000);
          continue;
        }
        throw new AcmeRateLimitError(retryAfter);
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new AcmeAPIError(body.message ?? `HTTP ${response.status}`, response.status, body);
      }

      return response.json() as Promise<T>;
    }

    throw lastError ?? new Error("Request failed after retries");
  }
}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **SDK that mirrors HTTP API 1:1** | Developers must understand HTTP to use SDK | Idiomatic resource-based methods |
| **No retry logic** | Transient errors require manual retry | Built-in exponential backoff |
| **Exposing raw HTTP responses** | Developers parse JSON manually | Return typed objects |
| **Silent failures** | SDK swallows errors; hard to debug | Typed exceptions with actionable messages |
| **No timeout** | SDK hangs forever on network issues | Default timeout (30s); configurable |

## 10 Rules

1. SDK should feel native to the language — idiomatic types, names, and patterns.
2. Retry transient errors (5xx, 429, network) automatically with exponential backoff.
3. Respect Retry-After header on 429 — don't retry sooner than the server requests.
4. Every request has an explicit timeout — never hang indefinitely.
5. Typed exceptions by error category: AuthError, NotFoundError, RateLimitError, APIError.
6. Resource-based organisation: `client.orders.create()` not `client.post("/orders")`.
7. Return typed objects or dicts, not raw HTTP responses.
8. SDK version pinned in User-Agent header — helps API team debug issues.
9. Changelog maintained with every release — consumers need to know what changed.
10. SDK tested against the real API (or a recorded cassette) — not just unit tests.
