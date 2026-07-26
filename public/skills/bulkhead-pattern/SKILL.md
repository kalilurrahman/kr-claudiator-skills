---
name: bulkhead-pattern
description: Implement bulkhead patterns to isolate failures and prevent cascade. Outputs thread pool isolation, semaphore limits, service partition designs, and circuit breaker integration.
argument-hint: [service dependencies, failure modes, concurrency requirements, SLA targets]
allowed-tools: Read, Write
---

# Bulkhead Pattern

The bulkhead pattern isolates components of an application so that one failure doesn't bring down everything. Named after ship bulkheads that prevent flooding from spreading, it limits the blast radius of a failure.

## Process

1. **Identify failure domains.** Which dependencies can fail? What is their failure mode (slow, unavailable, error)?
2. **Group by criticality.** Separate critical paths from non-critical. Isolate third-party integrations.
3. **Choose isolation mechanism.** Thread pool isolation (heavyweight, strong) or semaphore isolation (lightweight, counts only).
4. **Size the pools.** Max threads/semaphores per dependency. Sized by max acceptable concurrent calls.
5. **Set timeouts.** Every call into an isolated dependency has a timeout.
6. **Integrate with circuit breakers.** Bulkheads prevent thread exhaustion; circuit breakers prevent repeated failing calls.
7. **Monitor pool saturation.** Alert when threads/semaphores are consistently at limit.

## Thread Pool Isolation

```python
from concurrent.futures import ThreadPoolExecutor
import threading
from typing import Callable, Any
import time

class BulkheadExecutor:
    """Isolated thread pool per dependency."""
    
    def __init__(self, name: str, max_workers: int, timeout: float = 5.0):
        self.name = name
        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix=name)
        self._timeout = timeout
        self._active = 0
        self._rejected = 0
        self._lock = threading.Lock()
    
    def execute(self, fn: Callable, *args, **kwargs) -> Any:
        with self._lock:
            self._active += 1
        try:
            future = self._executor.submit(fn, *args, **kwargs)
            return future.result(timeout=self._timeout)
        except Exception:
            with self._lock:
                self._rejected += 1
            raise
        finally:
            with self._lock:
                self._active -= 1
    
    @property
    def stats(self) -> dict:
        return {"name": self.name, "active": self._active, "rejected": self._rejected}

# One pool per external dependency
payment_pool   = BulkheadExecutor("payment-service",  max_workers=10, timeout=3.0)
inventory_pool = BulkheadExecutor("inventory-service", max_workers=20, timeout=2.0)
email_pool     = BulkheadExecutor("email-service",     max_workers=5,  timeout=10.0)

# Usage — each call isolated in its own pool
def checkout(order):
    # Payment failure can't exhaust inventory threads
    payment = payment_pool.execute(payment_service.charge, order)
    inventory = inventory_pool.execute(inventory_service.reserve, order)
    email_pool.execute(email_service.send_confirmation, order)  # Non-critical
    return {"payment": payment, "inventory": inventory}
```

## Semaphore Isolation (Lightweight)

```python
import threading
from contextlib import contextmanager

class SemaphoreBulkhead:
    """Count-based isolation — limits concurrent callers, not thread creation."""
    
    def __init__(self, name: str, max_concurrent: int, timeout: float = 1.0):
        self.name = name
        self._sem = threading.Semaphore(max_concurrent)
        self._timeout = timeout
        self._rejected_count = 0
    
    @contextmanager
    def acquire(self):
        acquired = self._sem.acquire(timeout=self._timeout)
        if not acquired:
            self._rejected_count += 1
            raise BulkheadFullError(f"{self.name} bulkhead at capacity")
        try:
            yield
        finally:
            self._sem.release()

class BulkheadFullError(Exception):
    pass

# Usage
inventory_bulkhead = SemaphoreBulkhead("inventory", max_concurrent=15, timeout=0.5)

def reserve_stock(item_id: str, qty: int):
    with inventory_bulkhead.acquire():
        return inventory_client.reserve(item_id, qty)

# Graceful degradation when bulkhead full
def reserve_with_fallback(item_id, qty):
    try:
        return reserve_stock(item_id, qty)
    except BulkheadFullError:
        # Degrade gracefully — queue for async processing
        reservation_queue.enqueue({"item_id": item_id, "qty": qty})
        return {"status": "queued", "estimated_confirmation": "2min"}
```

## Kubernetes Resource Partitioning

```yaml
# Separate node pools per criticality tier — physical bulkhead
# Tier 1: Critical (payment, auth)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-service
spec:
  template:
    spec:
      nodeSelector:
        tier: critical
      tolerations:
        - key: tier
          value: critical
          operator: Equal
          effect: NoSchedule
      # Guaranteed QoS — never evicted
      containers:
        - name: payment
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "500m"    # requests == limits = Guaranteed
              memory: "512Mi"

# Tier 2: Standard
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: email-service
spec:
  template:
    spec:
      nodeSelector:
        tier: standard
      containers:
        - name: email
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Single shared thread pool** | One slow dependency exhausts all threads | Separate pool per dependency |
| **Pools sized equally** | Critical paths get same resources as non-critical | Size by SLA and criticality |
| **No timeouts** | Slow dependency holds threads indefinitely | Timeout on every external call |
| **No monitoring** | Pool saturation invisible until outage | Alert on pool utilisation >80% |
| **Bulkhead without fallback** | Rejected calls just fail | Define degraded behaviour for each bulkhead |

## 10 Rules

1. Isolate each external dependency in its own pool — one slow service cannot exhaust resources for others.
2. Size pools conservatively — a small pool that rejects requests is safer than a large pool that deadlocks.
3. Every call through a bulkhead has an explicit timeout — infinite waits defeat isolation.
4. Combine with circuit breakers — bulkheads limit concurrent callers; circuit breakers stop calling failed services.
5. Non-critical features (email, recommendations) get smaller pools — they fail before critical paths.
6. Monitor pool saturation in production — consistently full pools indicate undersizing or a performance problem.
7. Define degraded behaviour for every bulkhead rejection — queue, cache, or default response.
8. Thread pool isolation is stronger than semaphore isolation — use it for the most critical dependencies.
9. Physical node pool separation for tier 1 services — shared nodes mean shared fate.
10. Test bulkhead behaviour with chaos engineering — inject latency to verify isolation works.

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

The canonical workflow for **Bulkhead Pattern** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Implement bulkhead patterns to isolate failures and prevent cascade. Outputs thread pool isolation, semaphore limits, service partition designs, and circuit bre
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
