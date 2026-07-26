---
name: api-versioning-strategy
description: Design an API versioning strategy that allows evolution without breaking existing clients. Outputs versioning scheme, compatibility rules, migration timeline, and consumer communication plan.
argument-hint: [API type, consumer count, change frequency, breaking change risk]
allowed-tools: Read, Write
---

# API Versioning Strategy

API versioning lets you evolve your API without breaking existing clients. The challenge is choosing a versioning approach that is simple to implement, easy for clients to understand, and compatible with your deployment and documentation tooling.

## Versioning Approaches

```
1. URL Path Versioning (most common)
   /api/v1/orders  →  /api/v2/orders
   Pros: Explicit, cacheable, easy to test
   Cons: Version in URL is "wrong" by REST purists

2. Header Versioning
   Accept: application/vnd.api+json; version=2
   Pros: Clean URLs
   Cons: Harder to test, not cacheable by default

3. Query Parameter
   /api/orders?version=2
   Pros: Easy to add for testing
   Cons: Not recommended for production; easily forgotten

4. Content Negotiation
   Accept: application/vnd.company.v2+json
   Pros: RESTful
   Cons: Complex; unfamiliar to many developers

RECOMMENDATION: URL path versioning for public APIs,
header versioning for internal APIs.
```

## Compatibility Rules

```python
# What requires a new version (breaking changes):
BREAKING_CHANGES = [
    "Removing a field from a response",
    "Renaming a field",
    "Changing a field type (string → integer)",
    "Changing HTTP status codes",
    "Removing an endpoint",
    "Making an optional field required",
    "Changing authentication scheme",
    "Modifying pagination format",
]

# What does NOT require a new version (non-breaking):
NON_BREAKING_CHANGES = [
    "Adding new optional fields to response",
    "Adding new optional request parameters",
    "Adding new endpoints",
    "Adding new enum values (with caution)",
    "Adding new HTTP methods to existing resources",
    "Bug fixes that don't change the contract",
]

# Robustness principle: clients should be written to ignore unknown fields
# so additive changes are safe
```

## URL Path Versioning Implementation

```python
from fastapi import FastAPI, APIRouter

app = FastAPI()

# v1 router — frozen, maintained for backwards compatibility
v1 = APIRouter(prefix="/api/v1")

@v1.get("/orders/{order_id}")
async def get_order_v1(order_id: str):
    order = await order_service.get(order_id)
    # v1 response format — never change this
    return {
        "order_ref": order.id,      # v1 used order_ref
        "status": order.status,
        "total_cost": order.total,   # v1 used total_cost
    }

# v2 router — current active version
v2 = APIRouter(prefix="/api/v2")

@v2.get("/orders/{order_id}")
async def get_order_v2(order_id: str):
    order = await order_service.get(order_id)
    # v2 response format — improved field names
    return {
        "order_id": order.id,        # renamed from order_ref
        "status": order.status,
        "total_amount": order.total, # renamed from total_cost
        "currency": order.currency,  # new field in v2
    }

app.include_router(v1)
app.include_router(v2)
```

## Version Lifecycle Policy

```markdown
## API Version Lifecycle

ACTIVE:    Current version — full support, new features added
MAINTAINED: Previous version — bug fixes only, no new features
DEPRECATED: Announced EOL — sunset headers, migration guide published
RETIRED:   Returns 410 Gone — remove code after 30 days of zero traffic

## Standard Timeline
- v1 → ACTIVE (launch)
- v2 launches → v1 becomes MAINTAINED
- v1 DEPRECATED: 6 months notice minimum
- v1 RETIRED after 6 months

## Version Support Commitment
- ACTIVE and MAINTAINED versions: SLA-backed support
- DEPRECATED: best-effort support, no new fixes
- We maintain at most 2 versions simultaneously (current + previous)
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Breaking changes in existing version** | Clients break silently | Never break a published version; create v+1 |
| **Too many active versions** | Maintenance burden; confusing for clients | Maximum 2 supported versions at once |
| **No deprecation notice** | Clients broken without warning | Minimum 6 months notice with migration guide |
| **Versioning every minor change** | Version proliferation | Non-breaking changes in same version |
| **No default version** | Old clients break when new version is default | Maintain explicit version routing; no implicit default |

## 10 Rules

1. Never make breaking changes to a published version — create a new version.
2. URL path versioning (/v1/, /v2/) is the default choice for public APIs.
3. Non-breaking changes (adding optional fields, new endpoints) go in the current version.
4. Support at most 2 versions simultaneously — v(n) and v(n-1).
5. Deprecation notice minimum 6 months before retirement.
6. Retired versions return 410 Gone with a migration guide URL in the body.
7. Add `Deprecation` and `Sunset` HTTP headers to deprecated version responses.
8. Write a migration guide before announcing deprecation — not after.
9. Track usage per version — retire only when traffic reaches zero.
10. Document the version lifecycle policy publicly — clients need to plan migrations.

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

The canonical workflow for **Api Versioning Strategy** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Design an API versioning strategy that allows evolution without breaking existing clients. Outputs versioning scheme, compatibility rules, migration timeline, a
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
