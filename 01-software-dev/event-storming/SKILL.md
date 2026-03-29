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
