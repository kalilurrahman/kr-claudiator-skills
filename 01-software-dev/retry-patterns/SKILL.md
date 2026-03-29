---
name: retry-patterns
description: Implement retry patterns for resilient distributed systems. Outputs retry strategies, exponential backoff, circuit breaker integration, idempotency requirements, and failure budget design.
argument-hint: [operation type, failure modes, latency budget, idempotency requirements]
allowed-tools: Read, Write
---

# Retry Patterns

Retries are the first line of defence against transient failures in distributed systems. Done wrong, they amplify failures (thundering herd), cause data corruption (non-idempotent operations), or waste budget (retrying unrecoverable errors). Done right, they make systems self-healing.

## Retry Decision Tree

```
Should I retry?

Is the operation idempotent? ──No──► Never retry (or make it idempotent first)
         │
        Yes
         │
Is the error transient? ──No (4xx, business error)──► Don't retry
         │
        Yes (5xx, timeout, connection error)
         │
Is the retry budget exhausted? ──Yes──► DLQ or alert
         │
        No
         │
Apply backoff → retry
```

## Exponential Backoff with Jitter

```python
import random
import time
from functools import wraps
from typing import Callable, TypeVar, Type

T = TypeVar("T")

def retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    jitter: bool = True,
    retryable_exceptions: tuple = (Exception,),
    non_retryable_exceptions: tuple = (),
):
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except non_retryable_exceptions as e:
                    raise  # Never retry these
                except retryable_exceptions as e:
                    if attempt == max_attempts - 1:
                        raise  # Last attempt — propagate
                    
                    delay = min(base_delay * (exponential_base ** attempt), max_delay)
                    if jitter:
                        # Full jitter: random(0, delay) — avoids synchronized retries
                        delay = random.uniform(0, delay)
                    
                    time.sleep(delay)
        return wrapper
    return decorator

# Usage
@retry(
    max_attempts=3,
    base_delay=1.0,
    max_delay=30.0,
    retryable_exceptions=(ConnectionError, TimeoutError),
    non_retryable_exceptions=(ValidationError, AuthenticationError),
)
def call_payment_api(order_id: str, amount: float) -> dict:
    return payment_client.charge(order_id, amount)
```

## Tenacity (Production-Grade Python)

```python
import tenacity
import httpx

@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=1, max=30) +
         tenacity.wait_random(0, 2),                 # Jitter added
    retry=tenacity.retry_if_exception_type(
        (httpx.ConnectError, httpx.TimeoutException)
    ) | tenacity.retry_if_result(
        lambda r: r.status_code in [429, 503]         # Also retry these status codes
    ),
    reraise=True,
    before_sleep=tenacity.before_sleep_log(logger, logging.WARNING),
    after=tenacity.after_log(logger, logging.INFO),
)
async def call_external_api(url: str) -> httpx.Response:
    async with httpx.AsyncClient() as client:
        return await client.get(url, timeout=5.0)
```

## Retry with Idempotency Key

```python
import uuid

async def charge_with_retry(order_id: str, amount: float) -> dict:
    """Payment operations must be idempotent — use idempotency key."""
    idempotency_key = f"charge:{order_id}"  # Stable key for this operation
    
    for attempt in range(3):
        try:
            result = await stripe.charge.create(
                amount=amount,
                idempotency_key=idempotency_key,  # Stripe deduplicates by key
            )
            return result
        except stripe.APIConnectionError:
            if attempt == 2: raise
            await asyncio.sleep(2 ** attempt)
        except stripe.IdempotencyError:
            # Same key used differently — bug in caller, don't retry
            raise
```

## Circuit Breaker + Retry Interaction

```python
from circuitbreaker import circuit, CircuitBreakerError

@circuit(failure_threshold=5, recovery_timeout=30, expected_exception=Exception)
@retry(max_attempts=3, base_delay=1.0, retryable_exceptions=(ConnectionError,))
def resilient_call(url: str) -> dict:
    """
    Retry handles transient failures (3 attempts with backoff).
    Circuit breaker opens after 5 failures, preventing further retries
    for 30 seconds while downstream recovers.
    """
    return requests.get(url, timeout=5).json()

# Handle circuit open gracefully
try:
    result = resilient_call("http://service/api")
except CircuitBreakerError:
    # Circuit is open — return cached/degraded response
    result = get_cached_fallback()
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Retrying non-idempotent operations** | Duplicate charges, double sends | Make operations idempotent first; then retry |
| **Fixed delay retries** | Synchronized retries create thundering herd | Exponential backoff + jitter |
| **Retrying 4xx errors** | Client errors don't recover with retries | Only retry transient (5xx, network) errors |
| **Infinite retries** | System never gives up; blocks indefinitely | Max attempts + DLQ or circuit breaker |
| **No retry logging** | Can't diagnose retry storms in production | Log each retry attempt with delay and reason |

## 10 Rules

1. Never retry a non-idempotent operation — make it idempotent first.
2. Only retry transient errors (5xx, network timeouts) — never retry 4xx errors.
3. Exponential backoff with full jitter — prevents synchronized retry storms.
4. Maximum retry attempts with a clear failure path — DLQ, alert, or degrade.
5. Idempotency keys for external API calls — the retry sends the same key, deduplication happens server-side.
6. Circuit breaker pairs with retry — retry handles transient, circuit breaker handles sustained failure.
7. Log each retry with attempt number, delay, and exception — retries are invisible bugs otherwise.
8. Retry budget: the total time spent retrying must fit within the caller's timeout.
9. Different retry policies for different operations — payment (3 attempts, long backoff) vs health check (1 attempt).
10. Test retry behaviour explicitly — inject failures to verify idempotency and backoff calculation.
