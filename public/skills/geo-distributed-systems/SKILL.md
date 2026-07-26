---
name: geo-distributed-systems
description: Design systems that serve users globally with low latency. Outputs data placement strategy, consistency model, region routing, and conflict resolution approaches.
argument-hint: [user distribution, data residency requirements, latency targets, consistency requirements]
allowed-tools: Read, Write
---

# Geo-Distributed Systems

Distributing a system globally is not just deploying to multiple regions. It requires data placement decisions (where data lives), routing decisions (which region serves a request), consistency decisions (how regions stay in sync), and conflict resolution (what happens when concurrent writes collide).

## Architecture Patterns

```
ACTIVE-PASSIVE (simplest)
  One region handles all writes; others serve reads from replica.
  Consistency: Strong for reads from primary; eventual for replica reads.
  Latency: High for writes from non-primary regions.
  Use: Low-write applications with strong consistency needs.

ACTIVE-ACTIVE (complex, high performance)
  All regions accept reads and writes.
  Consistency: Eventual; conflicts possible.
  Latency: Low globally.
  Use: High-traffic global applications where eventual consistency is acceptable.

FOLLOW-THE-SUN
  Users in AU → AU region; users in EU → EU region.
  Data follows user timezone/geography.
  Consistency: Eventually consistent cross-region.
  Use: SaaS with per-customer data isolation.
```

## Data Placement Strategy

```python
from enum import Enum

class DataResidency(Enum):
    GLOBAL = "global"         # Replicated everywhere
    USER_HOME = "user_home"   # Lives in user's home region
    GDPR_EU = "eu-west"       # Must stay in EU
    US_ONLY = "us-east"       # US data sovereignty

# Per-entity placement rules
DATA_PLACEMENT = {
    "user_profile":     DataResidency.USER_HOME,      # GDPR compliance
    "product_catalog":  DataResidency.GLOBAL,          # Same everywhere
    "orders":           DataResidency.USER_HOME,       # User's data
    "analytics_events": DataResidency.USER_HOME,       # Data residency
    "public_content":   DataResidency.GLOBAL,          # No restrictions
}

def get_data_region(entity_type: str, user_region: str) -> str:
    placement = DATA_PLACEMENT.get(entity_type, DataResidency.GLOBAL)
    if placement == DataResidency.GLOBAL:
        return "us-east-1"  # Primary region for global data
    elif placement == DataResidency.USER_HOME:
        return user_region
    elif placement == DataResidency.GDPR_EU:
        return "eu-west-1"
    return user_region
```

## Region Routing

```python
# Cloudflare Workers — route at edge to nearest regional API
def route_to_region(request_country: str) -> str:
    EU_COUNTRIES = {"DE", "FR", "GB", "NL", "SE", "IT", "ES", "PL", "BE"}
    APAC_COUNTRIES = {"JP", "SG", "AU", "KR", "IN", "TW", "HK"}
    
    if request_country in EU_COUNTRIES:
        return "https://eu.api.example.com"
    elif request_country in APAC_COUNTRIES:
        return "https://ap.api.example.com"
    else:
        return "https://us.api.example.com"

# GeoDNS routing (Route53/Cloudflare)
# DNS returns different IPs based on resolver location
# us-east-1.api.example.com → US users
# eu-west-1.api.example.com → EU users
# ap-southeast-1.api.example.com → APAC users
```

## Conflict Resolution (CRDTs)

```python
# Last-write-wins (LWW) — simplest, loses concurrent updates
class LWWRegister:
    def __init__(self):
        self.value = None
        self.timestamp = 0
    
    def set(self, value, timestamp: float):
        if timestamp > self.timestamp:
            self.value = value
            self.timestamp = timestamp
    
    def merge(self, other: "LWWRegister"):
        self.set(other.value, other.timestamp)

# Vector clocks — detect conflicts, don't resolve automatically
class VectorClock:
    def __init__(self, node_id: str):
        self.clocks = {node_id: 0}
        self.node_id = node_id
    
    def increment(self):
        self.clocks[self.node_id] += 1
    
    def merge(self, other: "VectorClock"):
        for node, count in other.clocks.items():
            self.clocks[node] = max(self.clocks.get(node, 0), count)
    
    def happened_before(self, other: "VectorClock") -> bool:
        return (all(self.clocks.get(n, 0) <= other.clocks.get(n, 0) for n in self.clocks) and
                any(self.clocks.get(n, 0) < other.clocks.get(n, 0) for n in self.clocks))
    
    def concurrent_with(self, other: "VectorClock") -> bool:
        return (not self.happened_before(other) and
                not other.happened_before(self))
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Assuming low latency cross-region** | US to EU is 70-100ms baseline | Design for async; don't synchronously wait cross-region |
| **Strong consistency everywhere globally** | Requires cross-region consensus — very slow | Eventual consistency for non-critical; strong only where required |
| **Ignoring data residency** | GDPR violation for EU data outside EU | Map data types to residency requirements |
| **Active-active without conflict resolution** | Concurrent writes corrupt data | Choose: LWW, vector clocks, or application-specific CRDTs |
| **No region failover** | Region outage takes down global service | Automatic traffic shifting on region health failure |

## 10 Rules

1. Data residency requirements are non-negotiable — map them before designing data placement.
2. Cross-region latency is 50-200ms — design async; never block on cross-region calls.
3. Active-active requires a conflict resolution strategy — decide upfront, not after the first conflict.
4. Follow-the-sun routing reduces latency for globally distributed user bases.
5. Global data (product catalog, reference data) is replicated; user data follows the user.
6. GeoDNS is the first routing layer — steer users to the nearest healthy region.
7. Test region failover quarterly — untested failover is not failover.
8. Eventual consistency is the reality for active-active — design the application to accept it.
9. User's "home region" is determined at account creation — moving it is a migration, not a config change.
10. Cross-region writes are expensive — minimise them; batch where possible.


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
