---
name: product-analytics
description: Build product analytics infrastructure to understand user behaviour, feature adoption, and business outcomes. Outputs event taxonomy, funnel analysis, retention queries, and reporting infrastructure.
argument-hint: [product type, analytics stack, team size, key business questions]
allowed-tools: Read, Write
---

# Product Analytics

Product analytics answers how users interact with your product, which features drive retention, and where users drop off. It requires good instrumentation, a consistent event taxonomy, and analysis frameworks that connect behaviour to business outcomes.

## Event Taxonomy Design

```markdown
## Core Event Categories

### User Identity Events
user_signed_up        — first account creation
user_logged_in        — authentication success
user_profile_updated  — profile data changed

### Activation Events
onboarding_started    — first step of onboarding
onboarding_step_completed — each step with step_name property
feature_first_used    — first time any feature is used (feature_name property)
activation_completed  — product-defined activation milestone

### Engagement Events
session_started       — app open / page load
feature_used          — any feature interaction (feature_name property)
content_viewed        — content consumption
search_performed      — with search_term, results_count

### Conversion Events
trial_started         — beginning of trial period
trial_converted       — trial → paid
subscription_upgraded — plan change
purchase_completed    — transaction (amount_usd, product_id)

### Retention Events
return_visit          — session after N days inactive
notification_clicked  — re-engagement
```

## Funnel Analysis SQL

```sql
-- Conversion funnel: Signup → Activation → Paid
WITH funnel_events AS (
    SELECT
        user_id,
        MAX(CASE WHEN event_name = 'user_signed_up' THEN 1 ELSE 0 END) AS signed_up,
        MAX(CASE WHEN event_name = 'activation_completed' THEN 1 ELSE 0 END) AS activated,
        MAX(CASE WHEN event_name = 'trial_converted' THEN 1 ELSE 0 END) AS converted,
        DATE_TRUNC('week', MIN(event_time)) AS signup_week
    FROM events
    WHERE event_time >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY user_id
),

funnel AS (
    SELECT
        signup_week,
        COUNT(*) AS total_signups,
        SUM(signed_up) AS signed_up_count,
        SUM(activated) AS activated_count,
        SUM(converted) AS converted_count
    FROM funnel_events
    GROUP BY signup_week
)

SELECT
    signup_week,
    total_signups,
    activated_count,
    ROUND(100.0 * activated_count / NULLIF(total_signups, 0), 1) AS activation_rate,
    converted_count,
    ROUND(100.0 * converted_count / NULLIF(activated_count, 0), 1) AS activation_to_paid,
    ROUND(100.0 * converted_count / NULLIF(total_signups, 0), 1) AS overall_conversion
FROM funnel
ORDER BY signup_week DESC;
```

## Feature Adoption Analysis

```sql
-- Feature adoption: % of active users who used each feature
WITH active_users AS (
    SELECT DISTINCT user_id
    FROM events
    WHERE event_time >= CURRENT_DATE - INTERVAL '30 days'
      AND event_name = 'session_started'
),

feature_adopters AS (
    SELECT
        properties->>'feature_name' AS feature,
        COUNT(DISTINCT user_id) AS adopters
    FROM events
    WHERE event_time >= CURRENT_DATE - INTERVAL '30 days'
      AND event_name = 'feature_used'
    GROUP BY 1
)

SELECT
    fa.feature,
    fa.adopters,
    COUNT(DISTINCT au.user_id) AS total_active_users,
    ROUND(100.0 * fa.adopters / COUNT(DISTINCT au.user_id), 1) AS adoption_rate
FROM active_users au
CROSS JOIN feature_adopters fa
GROUP BY fa.feature, fa.adopters
ORDER BY fa.adopters DESC;
```

## Amplitude / Mixpanel Query Patterns

```javascript
// Amplitude: DAU/MAU ratio (stickiness)
const stickiness = await amplitude.query({
  metrics: [
    { type: "FORMULA", formula: "DAU(A) / MAU(A)" }
  ],
  events: [{ event_type: "session_started" }],
  dateRange: { last_n_days: 90 },
  groupBy: [{ type: "userprop", value: "plan_tier" }]
});

// Time to activation (median)
const tta = await amplitude.query({
  metrics: [{ type: "ACTIVE", metric: "user_id" }],
  events: [
    { event_type: "user_signed_up", group_by: "session_id" },
    { event_type: "activation_completed" }
  ],
  funnel: true,
  conversion_window: { value: 14, unit: "days" }
});
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Tracking clicks, not actions** | Button clicked tells you nothing | Track the business action: order_placed, not checkout_button_clicked |
| **No event versioning** | Schema changes break dashboards | Version properties; deprecate gracefully |
| **PII in event properties** | Privacy violation; compliance risk | User IDs only; never email/name in events |
| **Sampling analytics data** | Important rare events missed | Full fidelity for business events; sample only high-volume diagnostics |
| **One analyst owns all analysis** | Bottleneck; analysts don't know product context | Self-serve tooling; product teams own their metrics |

## 10 Rules

1. Track actions (order_placed), not UI interactions (button_clicked) — actions have business meaning.
2. Event names are past tense verbs — they record facts.
3. Every event has user_id, session_id, timestamp, and event-specific properties.
4. PII never appears in event properties — use IDs; resolve to names in reporting tools.
5. Activation event is the single most important metric to track correctly — get the definition right first.
6. Funnel analysis uses ordered, not simultaneous, events — a user must complete steps in sequence.
7. Retention cohorts use the activation event, not sign-up — pre-activation users skew retention down.
8. Feature adoption denominator is active users, not all users — inactive users can't adopt features.
9. Events are immutable once fired — if you made a mistake, fire a new correct event; don't modify history.
10. Self-serve analytics infrastructure reduces the analytics team bottleneck — invest in tooling, not headcount.

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

The canonical workflow for **Product Analytics** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Build product analytics infrastructure to understand user behaviour, feature adoption, and business outcomes. Outputs event taxonomy, funnel analysis, retention
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
