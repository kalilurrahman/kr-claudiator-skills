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

The canonical workflow for **Retry Patterns** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Implement retry patterns for resilient distributed systems. Outputs retry strategies, exponential backoff, circuit breaker integration, idempotency requirements
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
