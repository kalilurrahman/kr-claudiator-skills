---
name: customer-advisory-board
description: Build and run a customer advisory board (CAB) that generates strategic product insights. Outputs member selection criteria, meeting structure, engagement model, and insight integration process.
argument-hint: [product stage, customer segment, CAB goals, existing customer relationships]
allowed-tools: Read, Write
---

# Customer Advisory Board (CAB)

A Customer Advisory Board is a select group of customers who advise the product team on strategy, priorities, and market direction. Unlike user research (operational insights) or customer success (relationship health), a CAB provides strategic guidance from engaged, influential customers. Done well, it creates advocates, validates roadmaps, and surfaces market intelligence competitors don't have.

## CAB Design

```markdown
## Member Selection Criteria

Size: 8-12 members (manageable for deep engagement; diverse enough for breadth)
Meeting frequency: Quarterly (in-person) + monthly optional async updates

Selection criteria:
  ✓ Power users: Heavy usage of core product; not just license holders
  ✓ Strategic accounts: Large or high-growth customers (future value)
  ✓ Thought leaders: Known in their industry; can amplify insights
  ✓ Constructive critics: Willing to challenge you directly
  ✓ Diverse: Different industries, company sizes, geographies, use cases

Avoid:
  ✗ Only your happiest customers (creates bias)
  ✗ Customers currently in a dispute or at churn risk
  ✗ Customers who only want to influence their own feature requests
  ✗ Executives who won't actually use the product

## Member Benefits (why they say yes)
  - Early access to roadmap (with NDA)
  - Influence on product direction
  - Peer networking with other leaders
  - Access to your executives and product leadership
  - Recognition (case studies, speaking opportunities)
  - Product credits or premium support tier
```

## Meeting Structure

```markdown
## Quarterly CAB Meeting Agenda (Full Day)

### Pre-meeting (2 weeks before)
  Send pre-read: Current state, metrics, proposed agenda
  Survey: "What's your most critical challenge in [domain] this quarter?"
  NDA reminder and confidentiality expectations

### Morning: Strategic Context (3 hours)
  Welcome + ground rules (15 min)
    "What's said in this room stays here"
    "We want criticism more than praise"

  State of the market (30 min)
    What are you seeing in the industry? Share your perspective.
    Open to CAB: "Do you agree? What are we missing?"

  Product review: Last quarter's progress (45 min)
    What we shipped, what we learned
    Metrics: Are we succeeding? Where are we struggling?
    Be honest about failures — it builds trust

  Roadmap preview (60 min) — UNDER NDA
    Share 6-12 month direction (not individual features)
    Structured feedback: sticky notes → group discussion
    Key question: "What would you stop building to focus on [direction]?"

### Lunch: Relationship building (60 min)
  Structured: seat people for cross-pollination (not by company)

### Afternoon: Deep Dives (3 hours)
  Choose 2-3 topics most relevant to CAB
  Example sessions:
    "How are you measuring ROI from [product]?" (peer learning)
    "What would need to be true for you to bet your company on us?" (strategic)
    "Show us your biggest workflow pain points" (discovery)

  Working session: Prioritisation exercise
    Give each member 5 sticky dots
    Apply to a list of opportunity areas
    Discuss: Why did you vote that way?

### Closing (30 min)
  PM/CPO: What we heard and what we'll do with it
  Next meeting: Date, theme, action items
  Thank you

### Post-meeting (1 week after)
  Summary document sent to all CAB members
  "What we heard, what we're going to do about it"
  Follow up on any commitments made
```

## CAB Insights Integration

```markdown
## From CAB to Product Decisions

DO:
  ✓ Document every insight with source context
  ✓ Bring CAB insights to OST (Opportunity Solution Tree) as evidence
  ✓ Reference CAB feedback when prioritising roadmap items
  ✓ Close the loop: tell CAB when their input influenced a decision

DON'T:
  ✗ Treat CAB as a feature request session
  ✗ Over-weight individual requests (1 person ≠ 1000 customers)
  ✗ Promise to build what they ask — promise to consider
  ✗ Share competitive intelligence from one CAB member with another

## Insight Categories
  Market signal (strong): 3+ CAB members independently raise same theme
  Strategic input (moderate): 1-2 members with deep industry experience
  Individual request (weak): Single customer's specific use case
  Validation: CAB confirms (or denies) a hypothesis you already had
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Only happy customers** | You hear what you want; miss hard truths | Include constructive critics; ask uncomfortable questions |
| **Feature request meeting** | CAB becomes backlog prioritisation | Strategic questions about market, trends, challenges |
| **No follow-up** | CAB members feel ignored; churn from board | Document insights; close the loop on every commitment |
| **Too many members** | Can't facilitate meaningful dialogue | 8-12 is optimal; separate regional or segment boards for more |
| **Infrequent meetings** | Insights go stale; relationships weaken | Quarterly in-person + monthly async touchpoint |

## 10 Rules

1. CAB members are strategic advisors — not a focus group for feature validation.
2. Select members who will challenge you — not just confirm your direction.
3. Share honest metrics and failures — trust is built through transparency.
4. Roadmap sharing is under NDA — members advise before it is public.
5. Never promise to build what CAB requests — promise to consider and close the loop.
6. Document every insight — CAB input drives decisions only if it is captured and shared.
7. Member benefits must be real — early access, executive time, peer networking.
8. Facilitate structured exercises — open discussion rewards the most vocal, not the wisest.
9. Post-meeting summary closes the loop — "here's what we heard and what we'll do."
10. Rotate members every 12-18 months — fresh perspectives; prevent entrenchment.


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
