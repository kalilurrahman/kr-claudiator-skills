---
name: platform-strategy
description: Develop a platform strategy that creates an ecosystem around your product. Outputs platform definition, ecosystem design, API strategy, marketplace model, and network effect cultivation.
argument-hint: [product type, existing integrations, developer audience, competitive moat, revenue model]
allowed-tools: Read, Write
---

# Platform Strategy

A platform creates value by enabling interactions between two or more user groups — and the platform itself benefits from the network effects this creates. Becoming a platform is not just about building an API; it requires deliberate ecosystem design, developer experience investment, and governance.

## Platform vs Product

```
PRODUCT: Creates value for its users directly
  Example: A CRM manages your customer relationships
  Value: Proportional to features

PLATFORM: Creates value by facilitating interactions between groups
  Example: Salesforce AppExchange connects ISVs with Salesforce customers
  Value: Grows with the size and quality of the ecosystem
  Network effects: More developers → more apps → more customers → more developers

BECOMING A PLATFORM:
  1. You have a distribution advantage (many users/customers)
  2. Third parties want to reach those users
  3. Third parties can extend your product better than you can alone
  4. The extensions create value for your users (not just the third party)
```

## Platform Design

```markdown
## Platform Design Framework

### 1. Core Interaction
What is the fundamental transaction between participants?
  Salesforce: ISVs build apps → Enterprise customers buy/install apps
  Shopify: Developers build integrations → Merchants extend their stores
  Slack: App developers build bots/integrations → Teams use them in workflows

### 2. Participant Groups
Who are the sides of the platform?
  Side A: [Developers / ISVs / Partners] — create value
  Side B: [Your existing customers] — consume value
  Pricing: Often subsidise one side to attract the other
  (Developers often get free access; customers pay for apps)

### 3. Network Effects
What makes the platform more valuable as it grows?
  Direct: More apps → better for customers; more customers → better for developers
  Data: More usage → better recommendations/matching
  Social: More colleagues using same tools → easier to collaborate

### 4. Platform Governance
Who can participate? What are the rules?
  Open: Anyone can build (Twitter before API restrictions)
  Curated: Reviewed before publishing (App Store model)
  Enterprise: Vetted partners only (security-sensitive)

Choose based on: trust level, quality control needs, desired ecosystem size
```

## API as Platform Foundation

```python
# Platform APIs must be more stable and backwards-compatible than internal APIs
# Breaking changes break third-party integrations — not just your own code

class PlatformAPIPolicy:
    """
    API versioning and deprecation policy for platform partners.
    """
    # Minimum notice before breaking change: 12 months (vs 3 months for internal)
    DEPRECATION_NOTICE_MONTHS = 12

    # Supported API versions simultaneously: 2 (vs 1 for internal)
    SUPPORTED_VERSIONS = 2

    # Developer SLA: p99 latency < 500ms; availability > 99.9%
    LATENCY_P99_MS = 500
    AVAILABILITY_TARGET = 0.999

    # Partner onboarding: sandbox → production review → certification
    ONBOARDING_STAGES = ["sandbox", "review", "certified", "featured"]
```

## Developer Experience (DX)

```markdown
## DX Maturity Model

LEVEL 1: Basic API access
  - API reference docs
  - Authentication guide
  - Rate limiting docs
  Time-to-first-API-call: Hours

LEVEL 2: Friction-reduced
  - Interactive API explorer (Swagger UI)
  - Quick start guides with code examples
  - Official SDKs in major languages
  Time-to-first-API-call: 30 minutes

LEVEL 3: Developer ecosystem
  - Sandbox environment (no production data, no billing)
  - Sample apps and templates
  - Developer community (forum / Discord)
  - Webhook simulator
  Time-to-first-API-call: 10 minutes

LEVEL 4: Full platform
  - App marketplace with discovery
  - Certification programme
  - Co-marketing for featured partners
  - Dedicated developer relations team
  - Revenue share for marketplace apps
  Time-to-first-API-call: 5 minutes
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **API without ecosystem thinking** | API exists but no network effects | Design participant interactions; cultivate community |
| **Extracting too much from ecosystem** | Partners leave for better platforms | Revenue share; marketing support; co-selling |
| **No certification or quality bar** | Low-quality apps damage platform reputation | App review; quality standards; user ratings |
| **Platform before distribution** | No one to distribute to | Build product first; platform after PMF |
| **Breaking API changes** | Destroys developer trust | 12-month deprecation notice; multiple supported versions |

## 10 Rules

1. Platforms create value through facilitation — not just through features.
2. Network effects are the moat — design for them from day one.
3. Subsidise the hard side of the platform (usually developers) to attract participants.
4. API stability is a promise — breaking changes destroy developer trust.
5. Developer experience is a product — invest in it like a customer-facing product.
6. Governance determines platform quality — choose open vs curated based on trust needs.
7. Marketplace discovery is as important as the apps themselves.
8. Revenue share aligns incentives — partners invest more when they share in success.
9. Platforms need a minimum critical mass — don't launch a marketplace with 3 apps.
10. Platform strategy requires 3-5 year commitment — it cannot be undone if abandoned.


## Deep dive: applying this in practice

The sections above describe *what* to produce. This section describes *how* practitioners actually run this in the field, including the conversations, artefacts, and review loops that turn a one-page recommendation into a sustained outcome.

### The 30/60/90 cadence

A recommendation that is never revisited is a recommendation that quietly fails. Bake review checkpoints in from day one:

- **Day 0 — Decision committed.** Owner, scope, success metrics, and the first-checkpoint date are recorded in the decision log. The artefact is linked from the team's working space so it is discoverable without asking.
- **Day 30 — Early-signal review.** Look at the leading indicators, not the lagging ones. Has the team actually started? Are the assumed dependencies real? Have any of the named risks materialised? Adjust scope, not the goal.
- **Day 60 — Course-correction window.** This is the last cheap moment to change direction. If the leading indicators are flat or negative, escalate. Silence at day 60 is the most expensive form of optimism.
- **Day 90 — Outcome review.** Measure against the success criteria captured on day 0, not against the story the team is telling now. Write the post-mortem (or pre-mortem-confirmed) in the same artefact so the rationale, the outcome, and the lessons live together.

### Stakeholder choreography

Decisions stall not because the analysis is wrong but because the choreography is wrong. Use a lightweight RACI on every recommendation:

| Role | Meaning | Anti-pattern |
|---|---|---|
| **Responsible** | Does the work | More than two people listed |
| **Accountable** | Owns the outcome, signs off | Shared accountability (always becomes no accountability) |
| **Consulted** | Two-way input before the decision | Consulted *after* the decision is made — purely performative |
| **Informed** | One-way notification after the decision | Informed people are asked to approve — wastes their time and yours |

If you cannot name a single Accountable person in one minute, the recommendation is not ready to ship.

### Writing for senior readers

Senior readers scan first, read second, and only re-read the parts they disagree with. Optimise for that pattern:

1. **Lead with the recommendation**, not the analysis. The reader should know what you want them to do before they finish the first paragraph.
2. **One screen, one page, one decision.** If the artefact needs scrolling on a laptop, it is too long for the audience it is written for.
3. **Tables beat paragraphs** for comparing options. Prose hides the trade-off; a table forces it into the open.
4. **Numbers beat adjectives.** Replace "significant" with the actual number. Replace "soon" with a date. Replace "improved" with a baseline and a target.
5. **Name the disconfirming evidence.** A recommendation that lists what would change the author's mind is read as honest; one that does not is read as advocacy.

### Common failure modes

| Failure mode | Symptom | Counter-move |
|---|---|---|
| **Analysis paralysis** | Weeks of investigation, no decision | Time-box the analysis. State the decision quality you can defend in the time available. |
| **HiPPO override** | Highest-paid person's opinion wins regardless of evidence | Force the trade-off table into the room before opinions are voiced |
| **Sunk-cost gravity** | Team defends the current path because of prior investment | Re-frame: what would we choose today with no prior investment? |
| **Scope creep at the checkpoint** | Review becomes a re-planning session | Separate "did this work?" from "what next?" Run them as two meetings. |
| **Stealth de-scoping** | Success metrics quietly soften between day 0 and day 90 | Lock the day-0 metrics into the artefact; require an explicit amendment to change them. |
| **Owner drift** | Accountable person leaves, no one re-assigns | Owner reassignment is a mandatory step in onboarding/offboarding the role |

### A worked example

> A product line is debating whether to invest in a major rewrite of a legacy service that has been failing under peak load.

A weak response: "We should rewrite it because the code is old."

A response that uses this skill:

> **Recommendation.** Do not rewrite. Invest one quarter in targeted performance work on the existing service and a parallel strangler-fig migration of the top two failing endpoints. Confidence: medium. Would change my mind if peak-load incidents continue at the current rate for two consecutive months after the performance work ships.
>
> **Options considered.** (1) Full rewrite — 9–12 months, ~$1.4M, high risk of partial delivery. (2) Performance fix in place — 6 weeks, ~$120K, addresses 80% of incident volume per last-quarter analysis. (3) Strangler-fig migration — 6 months for the two hottest endpoints, ~$400K, preserves optionality.
>
> **Plan.** Owner: Platform tech lead. Day 30: performance fix in staging with load test results. Day 60: production rollout and a 30-day incident-rate comparison. Day 90: decision on whether to expand the strangler-fig scope.
>
> **Risks.** (1) Performance fix masks a deeper architectural issue — mitigated by capturing flame graphs before and after. (2) Strangler-fig endpoints are not in fact the hottest ones — mitigated by re-running the traffic analysis at day 0. (3) Team capacity collides with a separate compliance deadline — escalated to the portfolio review on the next planning cycle.

That is the shape of output this skill should produce: a defensible, time-bound, owner-attached recommendation that respects the reader's time and survives turnover.

## Quick reference card

- One paragraph of context, three options with trade-offs, one recommendation with confidence, one plan with an owner and a date.
- If you cannot name the owner, the metric, and the checkpoint date in one breath, the artefact is not done.
- A decision without a written rationale is a rumour. A rationale without a checkpoint is a wish. A checkpoint without a metric is theatre.
- Reversibility matters more than people admit: one-way doors deserve the slow lane, two-way doors deserve the fast lane.
- The best artefacts in this category are short, dated, signed, and easy to find six months later.
