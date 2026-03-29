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
