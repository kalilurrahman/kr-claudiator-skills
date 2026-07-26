---
name: api-product-strategy
description: Develop an API as a product strategy with business model, developer experience, pricing, and ecosystem goals. Outputs API product vision, developer journey, monetization model, and success metrics.
argument-hint: [API type, target developer audience, business model, existing product context]
allowed-tools: Read, Write
---

# API Product Strategy

An API as a product treats the API itself as a product with its own strategy, pricing, developer experience, and success metrics — not just a technical integration point. Companies like Twilio, Stripe, and Plaid built billion-dollar businesses by treating their APIs as products. The PM role for API products combines product, developer experience, and platform thinking.

## API Product vs API Feature

```
API FEATURE: An API endpoint that exposes internal functionality
  PM focus: Correct, documented, stable
  Success: Internal teams use it; external partners can integrate

API PRODUCT: The API is the core value proposition sold to developers
  PM focus: Developer experience, time-to-value, pricing, ecosystem
  Success: Developers build and ship products using your API
  Metrics: API revenue, developer NPS, time-to-first-call, integration health
```

## Developer Journey Design

```markdown
## Stages of the Developer Journey

### 1. Discover (find the API)
Questions: "Does this solve my problem? Is it trustworthy?"
Channels: Documentation search, developer communities, word-of-mouth
Design for: Clear use cases; immediate "what can I build with this"

### 2. Evaluate (decide to try it)
Questions: "How hard is this? What does it cost? Will it scale?"
Materials: Quickstart in 5 minutes; sandbox; pricing page
Design for: Try before commitment; transparent pricing; confidence in reliability

### 3. Activate (first successful API call)
Questions: "Can I actually make this work?"
Support: SDKs; example code; interactive docs
Design for: Time-to-first-successful-call < 30 minutes

### 4. Build (integrate into their product)
Questions: "How do I handle [edge case]? What happens when it fails?"
Support: Full reference docs; error handling guide; webhooks; status page
Design for: Everything they need to ship to production

### 5. Grow (expand usage)
Questions: "How do I scale this? What else can I add?"
Support: Advanced guides; migration paths; volume pricing
Design for: Smooth scaling; no billing surprises; upgrade incentives

### 6. Advocate (recommend to others)
Questions: "Who else should use this?"
Design for: Amazing DX; developer community; referral programme
```

## API Product Metrics

```python
from dataclasses import dataclass

@dataclass
class APIProductMetrics:
    # Acquisition
    developer_signups_monthly: int
    signup_to_first_api_call_hours: float  # Activation time
    docs_satisfaction_nps: int             # Survey score

    # Activation
    pct_activated_7d: float   # % who make successful API call within 7 days
    time_to_first_call_minutes: float      # Median

    # Retention
    developer_churn_monthly: float
    api_uptime_pct: float
    p99_latency_ms: float

    # Revenue
    monthly_api_revenue: float
    arpu_developer: float
    revenue_per_api_call: float

    # Expansion
    avg_api_calls_per_developer_monthly: int
    developers_using_multiple_products: float

    # Net Promoter Score
    developer_nps: int
```

## API Pricing Models

```markdown
## Common API Pricing Structures

PER-CALL (usage-based)
  Example: $0.001 per API call after 10,000 free
  Pro: Low barrier; scales with value
  Con: Unpredictable for customers; finance teams dislike

PER-UNIT (resource-based)
  Example: Twilio — per SMS sent, per call minute
  Pro: Natural alignment with value delivered
  Con: Unit definition must be intuitive

TIERED (usage bands)
  Example: Starter: 50k calls/$99 | Growth: 500k/$499 | Enterprise: custom
  Pro: Predictable; easy to understand
  Con: Customers manage to tier boundaries; step-function risk

FLAT + OVERAGE
  Example: $299/month for 100k calls; $0.003/call after
  Pro: Predictable base; unlimited upside
  Con: Overage anxiety; customers underestimate usage

FREEMIUM → PAID
  Example: 10k calls/month free forever; paid above
  Pro: Low acquisition friction; generates pipeline
  Con: Free tier support cost; conversion rates low

## Choosing Your Model
  High-volume, predictable: Per-call or tiered
  Low-volume, high-value: Flat rate
  Developer acquisition priority: Freemium
  Enterprise-focused: Flat + custom enterprise contracts
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Docs as afterthought** | Developers churn in the first 10 minutes | Docs are the product; invest accordingly |
| **No sandbox environment** | Developers experiment with production data | Always provide a free sandbox |
| **Opaque pricing** | Developers don't know what they'll pay | Transparent pricing calculator |
| **Breaking changes without notice** | Breaks developer production systems | 12-month deprecation notice minimum |
| **No developer community** | Developers solve problems alone; churn | Forum, Discord, or Slack community |

## 10 Rules

1. Time-to-first-successful-API-call is the primary activation metric — target under 30 minutes.
2. Documentation is the product — invest in it proportionally to code.
3. A sandbox environment is non-negotiable — developers must be able to experiment without production risk.
4. Pricing must be transparent and predictable — billing surprises kill developer trust.
5. API stability is a promise — breaking changes require 12+ months notice.
6. Developer NPS is a leading indicator of API product health — measure it quarterly.
7. SDK quality matters as much as API quality — poor SDK = high friction.
8. A developer community accelerates adoption — developers trust other developers.
9. API error messages are product copy — they must be human-readable and actionable.
10. Monitor integration health in production — detect when customers' integrations break before they report it.

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

The canonical workflow for **Api Product Strategy** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Develop an API as a product strategy with business model, developer experience, pricing, and ecosystem goals. Outputs API product vision, developer journey, mon
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
