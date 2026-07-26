---
name: event-storming
description: Facilitate event storming workshops to discover domain events, commands, aggregates, and bounded contexts. Outputs event map, domain vocabulary, bounded contexts, and modelling insights.
argument-hint: [domain complexity, team size, discovery vs design phase, available domain experts]
allowed-tools: Read, Write
---

# Event Storming

Event storming is a collaborative modelling workshop where domain experts and developers map a business domain using sticky notes. It surfaces the events that happen in the domain, reveals implicit workflows, identifies bounded contexts, and builds shared vocabulary — faster than weeks of requirements documents.

## Three Formats

```
BIG PICTURE (2-4 hours)
  Goal: Understand the whole domain; find bounded contexts
  Participants: All stakeholders, domain experts, developers
  Output: Domain event timeline, pain points, bounded contexts

PROCESS MODELLING (2-6 hours)
  Goal: Deep-dive a specific process; model the workflow
  Participants: Domain experts + developers for the area
  Output: Commands, events, aggregates, policies, actors

SOFTWARE DESIGN (1-3 hours)
  Goal: Model aggregates and bounded contexts for implementation
  Participants: Developers + domain expert
  Output: Aggregate boundaries, domain events, API design
```

## Big Picture Workshop

```markdown
## Setup
- 10+ metres of paper on the wall (or Miro/Mural for remote)
- Unlimited orange sticky notes (domain events)
- Blue/dark blue stickies (commands)
- Yellow stickies (actors/users)
- Purple stickies (policies — "when X happens, do Y")
- Pink stickies (external systems)
- Red stickies (problems/questions/hotspots)

## Step 1: Chaotic Exploration (30-45 min)
Everyone writes domain events on orange stickies — past tense, 
independently, without discussion. Place on wall in time order (left to right).
Examples: "OrderPlaced", "PaymentCaptured", "ItemShipped", "AccountCreated"

Do NOT discuss or organise during this step — just put stickies on wall.

## Step 2: Enforce the Timeline (20-30 min)
Facilitator walks left to right. Group moves stickies into rough time order.
Remove duplicates (keep the one with best language).
Surface gaps: "What had to happen before this event?"

## Step 3: Find Hotspots (20 min)
Red stickies mark:
- Confusion ("nobody agrees what this means")
- Complexity ("this is really hard to implement")
- Risk ("if this fails, the business loses money")
- Missing events ("something must happen here but we don't know what")

## Step 4: Identify Bounded Contexts (20-30 min)
Draw swimlanes around clusters of events that use consistent language.
Different language for the same concept = boundary.
"Customer" in marketing vs "Customer" in support = different things → two contexts.

## Step 5: Define the Vocabulary (ongoing)
Build the ubiquitous language glossary:
What does each term mean precisely, in this context?
What does it NOT include?
```

## Event Map Output Template

```markdown
# Event Map: E-Commerce Domain

## Timeline

ACQUISITION CONTEXT
  [UserSignedUp] [ProfileCompleted] [EmailVerified]

ORDERING CONTEXT  
  [CartCreated] [ItemAddedToCart] [ItemRemovedFromCart] 
  [CheckoutStarted] [ShippingAddressSubmitted] [OrderPlaced]
                                               ⚠️ HOTSPOT: fraud check here?

PAYMENT CONTEXT
  [PaymentMethodAdded] [PaymentAuthorised] [PaymentCaptured] [PaymentFailed]
  [RefundRequested] [RefundProcessed]

FULFILMENT CONTEXT
  [OrderConfirmed] [WarehouseNotified] [ItemPicked] [ItemPacked]
  [ShipmentCreated] [TrackingNumberAssigned] [ItemShipped] [ItemDelivered]
  
  ⚠️ HOTSPOT: Who owns "ItemDelivered"? Carrier? Us?

CUSTOMER SUPPORT CONTEXT
  [ReturnRequested] [ReturnApproved] [ReturnReceived] [ItemInspected]

## Bounded Contexts Identified
- Acquisition (Marketing owns): User, Profile, Subscription
- Ordering (Product owns): Cart, Order, Checkout
- Payment (Finance owns): Payment, Refund — NOTE: "Order" in payment context ≠ "Order" in ordering context
- Fulfilment (Operations owns): Shipment, Warehouse, Carrier
- Support (CS owns): Return, Complaint, Case

## Questions to Resolve
1. Who emits "OrderConfirmed"? Ordering or Payment context?
2. Does fulfilment subscribe to "PaymentCaptured" or "OrderConfirmed"?
3. What triggers a refund if payment fails after shipment?
```

## Process Modelling (Commands + Aggregates)

```markdown
## Adding Commands and Actors

For each domain event, ask: "What triggered this?"

ACTOR → COMMAND → [DOMAIN EVENT]
Customer → PlaceOrder → [OrderPlaced]
Customer → MakePayment → [PaymentAuthorised] or [PaymentFailed]
Warehouse System → MarkItemPicked → [ItemPicked]

POLICY → COMMAND → [DOMAIN EVENT]
"When PaymentCaptured → Send WarehouseNotification" → [WarehouseNotified]
"When ItemShipped → Send ShippingEmail" → [ShippingEmailSent]

## Aggregates
Cluster commands and events around the entity they affect:
- Order aggregate: PlaceOrder, CancelOrder, ConfirmOrder → OrderPlaced, OrderCancelled, OrderConfirmed
- Payment aggregate: AuthorisePayment, CapturePayment → PaymentAuthorised, PaymentCaptured
- Shipment aggregate: CreateShipment, MarkShipped, MarkDelivered → ShipmentCreated, ItemShipped, ItemDelivered
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Developers only** | Missing domain knowledge; models the code not the business | Domain experts are essential participants |
| **CRUD events** | "UserUpdated" has no business meaning | Business events: "UserAddressChanged", "UserUpgraded" |
| **Too formal too early** | Analysis paralysis; wrong level of detail | Chaotic first, then structure |
| **No hotspot follow-up** | Problems identified but not resolved | Every hotspot has an owner and resolution meeting |
| **One-off workshop** | Model stale as domain evolves | Revisit quarterly for active domains |

## 10 Rules

1. Domain experts are non-negotiable participants — developers alone produce a technical model, not a domain model.
2. Events are in past tense — they record facts, not intentions.
3. Start chaotic — get everything on the wall before organising anything.
4. Hotspots (red stickies) are the most valuable output — they reveal hidden complexity.
5. Different language for the same concept = bounded context boundary.
6. Every event has a cause — tracing backwards reveals the complete workflow.
7. Policies ("when X, then Y") reveal business rules that live nowhere in the code.
8. The vocabulary produced is the ubiquitous language — code must use the same terms.
9. Remote event storming (Miro/Mural) works well with good facilitation — don't skip it just because teams are distributed.
10. The model is a starting point, not a final design — it will evolve as understanding deepens.

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

The canonical workflow for **Event Storming** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Facilitate event storming workshops to discover domain events, commands, aggregates, and bounded contexts. Outputs event map, domain vocabulary, bounded context
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
