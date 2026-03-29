---
name: api-product-strategy
description: Develop an API as a product strategy with business model, developer experience, pricing, and ecosystem goals. Outputs API product vision, developer journey, monetization model, and success metrics.
argument-hint: [API type, target developer audience, business model, existing product context]
allowed-tools: Read, Write
---

# API Product Strategy

An API as a product treats the API itself as a product with its own strategy, pricing, developer experience, and success metrics — not just a technical integration point. Companies like Twilio, Stripe, and Plaid built billion-dollar businesses by treating their APIs as products. The PM role for API products combines product, developer experience, and platform thinking.

## API Product vs API Feature

```
API FEATURE: An API endpoint that exposes internal functionality
  PM focus: Correct, documented, stable
  Success: Internal teams use it; external partners can integrate

API PRODUCT: The API is the core value proposition sold to developers
  PM focus: Developer experience, time-to-value, pricing, ecosystem
  Success: Developers build and ship products using your API
  Metrics: API revenue, developer NPS, time-to-first-call, integration health
```

## Developer Journey Design

```markdown
## Stages of the Developer Journey

### 1. Discover (find the API)
Questions: "Does this solve my problem? Is it trustworthy?"
Channels: Documentation search, developer communities, word-of-mouth
Design for: Clear use cases; immediate "what can I build with this"

### 2. Evaluate (decide to try it)
Questions: "How hard is this? What does it cost? Will it scale?"
Materials: Quickstart in 5 minutes; sandbox; pricing page
Design for: Try before commitment; transparent pricing; confidence in reliability

### 3. Activate (first successful API call)
Questions: "Can I actually make this work?"
Support: SDKs; example code; interactive docs
Design for: Time-to-first-successful-call < 30 minutes

### 4. Build (integrate into their product)
Questions: "How do I handle [edge case]? What happens when it fails?"
Support: Full reference docs; error handling guide; webhooks; status page
Design for: Everything they need to ship to production

### 5. Grow (expand usage)
Questions: "How do I scale this? What else can I add?"
Support: Advanced guides; migration paths; volume pricing
Design for: Smooth scaling; no billing surprises; upgrade incentives

### 6. Advocate (recommend to others)
Questions: "Who else should use this?"
Design for: Amazing DX; developer community; referral programme
```

## API Product Metrics

```python
from dataclasses import dataclass

@dataclass
class APIProductMetrics:
    # Acquisition
    developer_signups_monthly: int
    signup_to_first_api_call_hours: float  # Activation time
    docs_satisfaction_nps: int             # Survey score

    # Activation
    pct_activated_7d: float   # % who make successful API call within 7 days
    time_to_first_call_minutes: float      # Median

    # Retention
    developer_churn_monthly: float
    api_uptime_pct: float
    p99_latency_ms: float

    # Revenue
    monthly_api_revenue: float
    arpu_developer: float
    revenue_per_api_call: float

    # Expansion
    avg_api_calls_per_developer_monthly: int
    developers_using_multiple_products: float

    # Net Promoter Score
    developer_nps: int
```

## API Pricing Models

```markdown
## Common API Pricing Structures

PER-CALL (usage-based)
  Example: $0.001 per API call after 10,000 free
  Pro: Low barrier; scales with value
  Con: Unpredictable for customers; finance teams dislike

PER-UNIT (resource-based)
  Example: Twilio — per SMS sent, per call minute
  Pro: Natural alignment with value delivered
  Con: Unit definition must be intuitive

TIERED (usage bands)
  Example: Starter: 50k calls/$99 | Growth: 500k/$499 | Enterprise: custom
  Pro: Predictable; easy to understand
  Con: Customers manage to tier boundaries; step-function risk

FLAT + OVERAGE
  Example: $299/month for 100k calls; $0.003/call after
  Pro: Predictable base; unlimited upside
  Con: Overage anxiety; customers underestimate usage

FREEMIUM → PAID
  Example: 10k calls/month free forever; paid above
  Pro: Low acquisition friction; generates pipeline
  Con: Free tier support cost; conversion rates low

## Choosing Your Model
  High-volume, predictable: Per-call or tiered
  Low-volume, high-value: Flat rate
  Developer acquisition priority: Freemium
  Enterprise-focused: Flat + custom enterprise contracts
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Docs as afterthought** | Developers churn in the first 10 minutes | Docs are the product; invest accordingly |
| **No sandbox environment** | Developers experiment with production data | Always provide a free sandbox |
| **Opaque pricing** | Developers don't know what they'll pay | Transparent pricing calculator |
| **Breaking changes without notice** | Breaks developer production systems | 12-month deprecation notice minimum |
| **No developer community** | Developers solve problems alone; churn | Forum, Discord, or Slack community |

## 10 Rules

1. Time-to-first-successful-API-call is the primary activation metric — target under 30 minutes.
2. Documentation is the product — invest in it proportionally to code.
3. A sandbox environment is non-negotiable — developers must be able to experiment without production risk.
4. Pricing must be transparent and predictable — billing surprises kill developer trust.
5. API stability is a promise — breaking changes require 12+ months notice.
6. Developer NPS is a leading indicator of API product health — measure it quarterly.
7. SDK quality matters as much as API quality — poor SDK = high friction.
8. A developer community accelerates adoption — developers trust other developers.
9. API error messages are product copy — they must be human-readable and actionable.
10. Monitor integration health in production — detect when customers' integrations break before they report it.
