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
