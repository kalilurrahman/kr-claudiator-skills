---
name: event-tracking-plan
description: Design a comprehensive event tracking plan for product analytics. Outputs event taxonomy, tracking spec, implementation guide, and governance process.
argument-hint: [product type, analytics platform, team structure, current tracking gaps]
allowed-tools: Read, Write
---

# Event Tracking Plan

An event tracking plan defines what user actions to track, how to name them, what properties to capture, and who owns each event. Without a plan, teams end up with thousands of inconsistently named events that nobody trusts. With one, analytics becomes the shared language of product decisions.

## Process

1. **Define the questions first.** What product decisions will this data inform? Work backwards to events.
2. **Establish naming conventions.** Consistent naming enables reliable queries and reduces confusion.
3. **Write the tracking spec.** For every event: trigger, properties, example payload.
4. **Assign ownership.** Every event has an owner responsible for keeping it current.
5. **Implement and verify.** QA each event before launch; verify in analytics platform.
6. **Maintain.** Deprecate old events; update specs when the product changes.

## Naming Convention

```
Format: {object}_{action}

Object: the thing being acted on (lowercase, singular)
Action: what happened (past tense verb, lowercase)

Examples:
  page_viewed             — User viewed a page
  product_clicked         — User clicked on a product
  cart_item_added         — Item added to cart
  checkout_started        — Checkout flow started
  order_completed         — Order placed successfully
  account_created         — New account registered
  feature_used            — Feature was used (be more specific when possible)

Anti-patterns:
  ✗ click_product         — action before object
  ✗ productClicked        — camelCase (use snake_case)
  ✗ buttonClick           — too generic (which button?)
  ✗ trackEvent            — not meaningful
```

## Core Event Taxonomy

```typescript
// Segment / Amplitude / Mixpanel event spec

// LIFECYCLE EVENTS
analytics.track('account_created', {
  user_id: string,
  signup_method: 'email' | 'google' | 'github',
  referral_source: string | null,
  plan_type: 'free' | 'pro' | 'enterprise',
});

analytics.track('session_started', {
  session_id: string,
  user_id: string | null,      // null for anonymous
  platform: 'web' | 'ios' | 'android',
  entry_page: string,
  utm_source: string | null,
  utm_campaign: string | null,
});

// ENGAGEMENT EVENTS
analytics.track('feature_used', {
  feature_name: string,        // Specific feature slug
  context: string,             // Where in the app
  user_id: string,
  is_first_use: boolean,
});

analytics.track('search_performed', {
  query: string,               // Normalised (no PII)
  result_count: number,
  filters_applied: string[],
  source: 'header' | 'page' | 'modal',
});

// CONVERSION EVENTS
analytics.track('checkout_started', {
  user_id: string,
  cart_item_count: number,
  cart_total_usd: number,
  source: 'cart_page' | 'buy_now',
});

analytics.track('order_completed', {
  order_id: string,
  user_id: string,
  order_total_usd: number,
  item_count: number,
  payment_method: 'card' | 'paypal' | 'apple_pay',
  is_first_order: boolean,
  coupon_used: boolean,
});
```

## Full Event Spec Template

```markdown
## Event: checkout_started

**Description:** Fires when user initiates the checkout flow from any entry point.
**Trigger:** User clicks "Checkout" button, cart is non-empty.
**Owner:** @product-checkout-pm
**Status:** Active
**First added:** 2024-01-15
**Last updated:** 2024-03-01

### Properties

| Property | Type | Required | Example | Notes |
|----------|------|----------|---------|-------|
| user_id | string | yes | "usr_abc123" | Anonymous: session_id |
| session_id | string | yes | "sess_xyz789" | |
| cart_item_count | integer | yes | 3 | |
| cart_total_usd | number | yes | 59.99 | Before tax/shipping |
| source | string | yes | "cart_page" | cart_page, product_page, mini_cart |
| has_coupon | boolean | no | false | |
| is_mobile | boolean | yes | false | |

### Example Payload
```json
{
  "event": "checkout_started",
  "userId": "usr_abc123",
  "properties": {
    "session_id": "sess_xyz789",
    "cart_item_count": 3,
    "cart_total_usd": 59.99,
    "source": "cart_page",
    "has_coupon": false,
    "is_mobile": false
  },
  "timestamp": "2024-03-15T14:30:00.000Z"
}
```

### Downstream Usage
- Checkout funnel analysis
- Cart abandonment calculation
- Conversion rate by source
```

## Governance Process

```markdown
## Event Tracking Governance

### Adding a New Event
1. Copy event spec template
2. Submit PR to tracking-plan repo
3. PM + data analyst review
4. Implement and QA in staging
5. Verify in analytics platform before merging

### Deprecating an Event
1. Mark event as `deprecated` in spec
2. Check for active dashboards/queries using this event
3. Announce in #data Slack channel
4. Remove after 90 days with no usage

### Event Naming Review
Monthly review in #tracking-plan channel:
- Inconsistencies flagged
- Deprecated events cleaned up
- New event requests reviewed

### Who Can Add Events
- Any engineer, with PM + data analyst sign-off
- Critical events (conversion, payment) require data team review
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Tracking everything** | Event flood; nobody knows what to use | Track decisions you need to make; nothing more |
| **Tracking PII in event properties** | Privacy violation; GDPR issues | Track user_id; never name, email, or payment details |
| **Events not in tracking plan** | Unknown events; no documentation | All events must be specced before implementation |
| **No QA of events** | Events fire with wrong data or not at all | Verify every event in analytics debugger before launch |
| **Never deprecating events** | 500 events, 400 unused; nobody trusts anything | Deprecation process; clean up quarterly |

## 10 Rules

1. Define the questions before designing the events — events exist to answer product questions.
2. Naming convention is non-negotiable — consistent names enable reliable analysis.
3. No PII in event properties — track user_id, not email or name.
4. Every event is specced before implementation — no undocumented events.
5. QA every event with a debugger before launch — wrong properties are worse than no properties.
6. Events fire on action completion — not on click (completion = value delivered).
7. Every event has an owner — orphaned events are never maintained.
8. Deprecation is a regular process — remove events nobody uses.
9. Super properties (user_id, session_id, platform) are set once globally — not per event.
10. An event tracking plan is a product — it evolves with the product and needs regular maintenance.

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

The canonical workflow for **Event Tracking Plan** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Design a comprehensive event tracking plan for product analytics. Outputs event taxonomy, tracking spec, implementation guide, and governance process.
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
