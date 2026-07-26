---
name: product-led-growth
description: Design and implement a product-led growth strategy where the product drives user acquisition, expansion, and retention. Outputs PLG model, activation metrics, viral loops, and freemium conversion strategy.
argument-hint: [product type, target segment, current growth motion, pricing model]
allowed-tools: Read, Write
---

# Product-Led Growth (PLG)

Product-led growth is a go-to-market strategy where the product itself is the primary driver of customer acquisition, expansion, and retention. Instead of sales-led (sales demos products) or marketing-led (marketing creates demand), PLG lets users discover value in the product before involving sales. Slack, Figma, and Notion are canonical examples.

## PLG Readiness Assessment

```markdown
## Is PLG Right For You?

HIGH PLG FIT (strong signals):
  ✓ Product delivers value within minutes of signup (not weeks of onboarding)
  ✓ Value is self-evident — users can understand the product without training
  ✓ Individual users or small teams can adopt without enterprise procurement
  ✓ Network effects or collaboration features (more valuable with more users)
  ✓ Free tier can deliver genuine value, not just a limited trial
  ✓ Word-of-mouth is already happening organically

LOW PLG FIT (warning signals):
  ✗ Requires 3-month implementation and data migration before value
  ✗ Price point requires CFO approval ($100k+/year)
  ✗ Regulatory requirement for procurement (healthcare, government)
  ✗ Only valuable after critical mass of users (cold start problem)
  ✗ Value is in services, not the product itself
```

## PLG Model Design

```markdown
## PLG Growth Model: [Product Name]

### Free Tier Design
Objective: Deliver genuine value; demonstrate full product potential

Free tier includes:
  - Core workflow (up to 3 projects)
  - Basic integrations (2 of 10 available)
  - 1 user seat

Free tier excludes (requires upgrade):
  - Team collaboration (>1 seat)
  - Advanced integrations
  - Admin controls / audit logs
  - Priority support

Freemium success metric:
  % of free users who reach the "aha moment" (first successful workflow)
  Target: >40% within 7 days

### Activation Funnel (Free to Active)
Signup → Email Verified → First Project Created → First Task Completed → Team Member Invited

Critical metric: % reaching "First Task Completed" within 7 days
  Current: 28% | Target: 45%
  Hypothesis: Onboarding checklist complexity is the bottleneck

### Viral Loop
How the product spreads organically:
  1. User creates shareable output (report, design, document)
  2. Shares with external collaborators
  3. Collaborators must sign up to comment/edit
  4. Collaborator experiences product value → upgrades or shares further

Viral coefficient (K): 0.3 currently → target 0.6

### Expansion Revenue Motion
Free → Pro: Individual power users hit seat or feature limits
Pro → Team: Projects become collaborative; team plan unlocks collaboration
Team → Enterprise: Security, SSO, audit logs become requirements at scale

Expansion metric: Net Revenue Retention (NRR) target >120%
```

## Activation Instrumentation

```python
# Track activation milestones for PLG funnel
from datetime import datetime, timedelta

class PLGActivationTracker:
    ACTIVATION_MILESTONES = [
        ("signup_completed", "Signed up"),
        ("email_verified", "Email verified"),
        ("first_project_created", "Created first project"),
        ("first_action_completed", "Completed first key action"),
        ("team_member_invited", "Invited a team member"),  # Viral hook
        ("integration_connected", "Connected an integration"),
    ]

    async def track_milestone(self, user_id: str, milestone: str) -> None:
        already_reached = await db.fetchone(
            "SELECT 1 FROM activation_milestones WHERE user_id = $1 AND milestone = $2",
            [user_id, milestone]
        )
        if not already_reached:
            await db.execute(
                "INSERT INTO activation_milestones (user_id, milestone, reached_at) VALUES ($1, $2, NOW())",
                [user_id, milestone]
            )

    async def get_activation_rate(self, milestone: str, cohort_days: int = 7) -> float:
        result = await db.fetchone("""
            SELECT
                COUNT(DISTINCT u.id) AS total_signups,
                COUNT(DISTINCT m.user_id) AS reached_milestone
            FROM users u
            LEFT JOIN activation_milestones m
                ON u.id = m.user_id
                AND m.milestone = $1
                AND m.reached_at <= u.created_at + INTERVAL '$2 days'
            WHERE u.created_at >= NOW() - INTERVAL '30 days'
        """, [milestone, cohort_days])

        if result["total_signups"] == 0:
            return 0.0
        return result["reached_milestone"] / result["total_signups"]
```

## Free-to-Paid Conversion Optimisation

```markdown
## Conversion Levers

USAGE LIMITS (friction-based triggers)
  "You've reached your 3 project limit"
  "Upgrade to invite more than 1 team member"
  Design: Show limit before hitting it; make upgrade path obvious

VALUE DEMONSTRATION (value-based triggers)
  "You've automated 47 hours this month — Premium users save even more"
  "Share this with your team" prompt appears when user creates something shareable
  Design: Show ROI before asking for money

SOCIAL PROOF AT DECISION POINT
  Upgrade modal shows: "3,847 teams like yours use Premium"
  Case study from similar company visible during trial

TIMING
  Offer upgrade after "aha moment" (first successful workflow) — not on signup
  Send email when user hits 80% of free tier limit (not 100%)
  Use in-product prompts, not just email

PRICING PAGE OPTIMISATION
  Annual plan prominently featured (20-30% discount)
  "Most popular" tag on recommended tier
  Feature comparison focused on user's usage patterns
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Free tier with no real value** | Users churn before experiencing value | Free tier must deliver genuine, lasting value |
| **Paywalling too early** | Users leave before "aha moment" | Delay upgrade prompts until after activation |
| **PLG without product analytics** | Flying blind; can't identify bottlenecks | Instrument the full activation funnel from day one |
| **Ignoring expansion revenue** | Acquiring users but not growing revenue | NRR is as important as new logo acquisition |
| **PLG for complex enterprise products** | Users can't self-serve; sales required for value | Hybrid: PLG for discovery; sales for large deals |

## 10 Rules

1. The product delivers genuine value in the free tier — not a hobbled trial.
2. "Aha moment" is defined and measured — it is the highest-leverage activation metric.
3. Upgrade prompts appear after the aha moment, not at signup.
4. Viral loops are built into the product — sharing, inviting, collaborating.
5. Activation funnel is instrumented and reviewed weekly.
6. Freemium → paid conversion is triggered by usage limits OR value demonstration — not arbitrary timers.
7. Net Revenue Retention (NRR) tracks expansion — PLG should drive >100% NRR.
8. Self-serve onboarding is a product feature, not a support function.
9. PLG and sales are complementary — PLG handles SMB; sales handles enterprise.
10. PLG requires product investment — it does not replace GTM investment.

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

The canonical workflow for **Product Led Growth** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Design and implement a product-led growth strategy where the product drives user acquisition, expansion, and retention. Outputs PLG model, activation metrics, v
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
