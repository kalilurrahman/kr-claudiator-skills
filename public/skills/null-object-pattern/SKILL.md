---
name: null-object-pattern
description: Eliminate null checks and NullPointerExceptions using the Null Object pattern. Outputs null object implementations, optional type usage, and refactoring strategies for null-heavy codebases.
argument-hint: [language, null hotspots, codebase scale, nullable vs non-nullable types]
allowed-tools: Read, Write
---

# Null Object Pattern

The Null Object pattern replaces null references with objects that implement the expected interface but do nothing (or return safe defaults). It eliminates scattered null checks, reduces NullPointerExceptions, and produces cleaner, more readable code.

## The Problem

```python
# BEFORE: null checks everywhere
def send_notification(order: Optional[Order], user: Optional[User]) -> None:
    if order is None:
        return
    if user is None:
        return
    if user.email is None:
        return
    if user.notification_preferences is None:
        send_email(user.email, format_order(order))
    elif user.notification_preferences.email_enabled:
        send_email(user.email, format_order(order))

# AFTER: null objects handle the no-op case
def send_notification(order: Order, user: User) -> None:
    # Both are guaranteed to be valid objects (or null objects)
    if user.wants_email_notification():
        send_email(user.email, format_order(order))
```

## Implementation

```python
from abc import ABC, abstractmethod
from typing import Optional

# Interface
class NotificationService(ABC):
    @abstractmethod
    def send_email(self, to: str, subject: str, body: str) -> None: ...
    
    @abstractmethod
    def send_sms(self, to: str, message: str) -> None: ...
    
    @property
    @abstractmethod
    def is_available(self) -> bool: ...

# Real implementation
class SendGridNotificationService(NotificationService):
    def send_email(self, to: str, subject: str, body: str) -> None:
        sendgrid_client.send(to=to, subject=subject, body=body)
    
    def send_sms(self, to: str, message: str) -> None:
        twilio_client.send(to=to, message=message)
    
    @property
    def is_available(self) -> bool:
        return True

# Null object — does nothing safely
class NullNotificationService(NotificationService):
    """Used when notifications are disabled, user opted out, or in tests."""
    
    def send_email(self, to: str, subject: str, body: str) -> None:
        pass  # Intentional no-op
    
    def send_sms(self, to: str, message: str) -> None:
        pass  # Intentional no-op
    
    @property
    def is_available(self) -> bool:
        return False

# Null user
class NullUser:
    """Represents an anonymous/unknown user — eliminates user null checks."""
    
    id = "anonymous"
    email = None
    name = "Guest"
    is_authenticated = False
    
    def wants_email_notification(self) -> bool:
        return False
    
    def has_permission(self, _permission: str) -> bool:
        return False
    
    def get_preference(self, key: str, default=None):
        return default

# Factory method — returns null object instead of None
class UserRepository:
    async def get(self, user_id: str) -> 'User':
        record = await db.fetchone("SELECT * FROM users WHERE id = $1", [user_id])
        if not record:
            return NullUser()  # Never return None
        return User.from_record(record)
```

## Optional Types (Modern Python)

```python
# Using Optional with explicit checks at boundaries only
from typing import Optional

# Repository returns Optional — caller handles at boundary
async def get_user(user_id: str) -> Optional[User]:
    ...

# Service converts Optional to Null Object at the boundary
async def process_for_user(user_id: str):
    user = await user_repo.get(user_id) or NullUser()
    # From here on, user is always a valid User-like object
    await notification_service.notify(user, message)
    await audit_log.record(user.id, "processed")
```

## Logger Null Object

```python
import logging

class NullLogger:
    """Drop-in replacement for logging.Logger — useful in tests."""
    def debug(self, *args, **kwargs): pass
    def info(self, *args, **kwargs): pass
    def warning(self, *args, **kwargs): pass
    def error(self, *args, **kwargs): pass
    def exception(self, *args, **kwargs): pass

# Usage in class — accepts real or null logger
class DataProcessor:
    def __init__(self, logger=None):
        self._logger = logger or NullLogger()
    
    def process(self, data):
        self._logger.info("Processing %d records", len(data))
        # No null check needed
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Null object that raises errors** | Defeats the purpose — use exceptions instead | Null objects silently do nothing or return safe defaults |
| **Returning None from repositories** | Every caller checks for None | Return null objects; let callers check `is_null` if needed |
| **Null objects hiding bugs** | Missing data silently ignored when it shouldn't be | Use null objects only where absence is a valid state |
| **Too many null object variants** | Maintenance burden | One null object per interface |
| **Mixing null objects and None** | Inconsistent; defeats the pattern | Commit to the pattern; never return None from the same method |

## 10 Rules

1. Null objects implement the same interface as real objects — callers don't need to check.
2. Null object methods are safe no-ops or return safe defaults — never raise exceptions.
3. Repositories return null objects, not None — eliminates null checks at every call site.
4. Null objects are immutable singletons — one instance shared everywhere.
5. Use `is_null` property if callers legitimately need to know — but most shouldn't.
6. Null objects are most valuable at boundaries: repositories, services, external clients.
7. Tests use null objects by default — real implementations only for integration tests.
8. The Null Object pattern is complementary to Optional types — use them at different layers.
9. Document null objects clearly — engineers need to know what they are and why.
10. Don't use null objects to hide missing required data — only where absence is valid.

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

The canonical workflow for **Null Object Pattern** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Eliminate null checks and NullPointerExceptions using the Null Object pattern. Outputs null object implementations, optional type usage, and refactoring strateg
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
