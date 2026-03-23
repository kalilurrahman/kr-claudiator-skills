---
name: pricing-strategy
description: Design a product pricing strategy covering model selection, tier structure, value metric identification, packaging, and pricing research. Covers freemium, usage-based, per-seat, and enterprise packaging with worked examples.
argument-hint: [product type, customer segments, current stage, competitive context, revenue goal]
allowed-tools: Read, Write
---

# Pricing Strategy

Pricing is one of the highest-leverage product decisions. A 1% improvement in price realisation typically adds 2–4× more profit than a 1% reduction in variable costs. Yet most startups under-price by 20–40% because they anchor on cost rather than value. Good pricing starts with understanding the value delivered, not the cost to build it.

## Pricing Model Selection

| Model | Best for | Downside |
|-------|---------|---------|
| Flat rate | Simple product; single ICP; easy to explain | Leaves money on the table for high-usage customers |
| Per-seat | Collaboration tools; expansion via hiring | Penalises adoption; teams hide seats |
| Usage-based | Infrastructure, API, data products | Unpredictable revenue; complex to explain |
| Tiered / per-feature | Products with clear feature segments | Tier boundary confusion; complexity |
| Freemium | High-volume, low-touch; network effects | Free users are a cost centre; conversion hard |
| Outcome-based | Mature, high-trust relationship; measurable outcome | Hard to measure; shared risk |
| Enterprise custom | Complex requirements; large deals | Long sales cycles; hard to scale |

## Value Metric — the unit you charge on

The value metric is what scales with customer value. Choosing the wrong one destroys growth.

```
Good value metrics:
  Slack:     messages sent (switched to seats — aligned with value of coordination)
  Twilio:    API calls / SMS sent (customer pays as they grow)
  Snowflake: compute credits (customer pays for what they use)
  HubSpot:   contacts (scales with marketing database size)
  Figma:     editors (designers; viewers free — drives adoption)

Bad value metrics:
  Storage GB   — commoditised; race to zero; wrong lever
  Users        — penalises adoption; teams hide seats; wrong lever for consumer products
  Projects     — artificial limit; customers resent hitting it
```

## Process

1. **Define the customer segments** — who buys, and what outcome do they pay for?
2. **Identify the value metric** — what grows when your customer gets more value?
3. **Research willingness to pay** — van Westendorp PSM, conjoint analysis, or direct interviews.
4. **Map the competitive landscape** — where do you sit on the value/price spectrum?
5. **Design the tier structure** — good / better / best; each tier should expand 3–5× in value.
6. **Set the free tier** (if freemium) — free must be genuinely useful; not a crippled demo.
7. **Define the enterprise package** — what does a large customer need that SMBs do not?
8. **Build the pricing page** — clarity, trust signals, anchoring, and comparison table.
9. **Instrument pricing telemetry** — track conversion by plan, expansion, churn by plan.
10. **Review pricing annually** — price anchors to value delivered; both change over time.

## Output Format

### Pricing Research: van Westendorp Price Sensitivity Meter

```markdown
## Price Sensitivity Research — [Product Name]

**Method:** van Westendorp PSM (n=47 target customers, 30-min interviews)
**Date:** [Month Year]

### Four Questions Asked

For the [core use case] problem, at what price would this product be:

1. **Too cheap** (so cheap you'd question quality): $___
2. **Cheap** (a bargain, great value): $___
3. **Expensive** (you'd think carefully but might buy): $___
4. **Too expensive** (you wouldn't consider it): $___

### Results

| Price point | Respondents saying "too cheap" | Respondents saying "too expensive" |
|------------|-------------------------------|-----------------------------------|
| $49/mo | 68% | 2% |
| $99/mo | 34% | 8% |
| $149/mo | 12% | 19% |
| $199/mo | 4% | 38% |
| $299/mo | 1% | 71% |

**Acceptable price range:** $99 – $199/month
**Optimal price point (PMC):** ~$149/month
**Point of marginal cheapness (PMCheap):** $99/month

### Recommendation
Launch at $149/month for the Growth tier.
Strong majority finds $99 "cheap" — pricing headroom exists above that.
Consider $99 for the Starter tier to drive initial adoption.
```

### Tier Structure Template

```markdown
## [Product Name] Pricing — v3 (Effective [Date])

### Pricing Principles
1. Price on value delivered, not cost to build.
2. Free tier is genuinely useful — not a crippled demo.
3. Every tier upgrade should feel like a clear step up in value.
4. Enterprise pricing removes friction for large customers.

---

### Free — $0/month
**Who it's for:** Individual contributors; personal projects; evaluation.

Includes:
- Up to [X] [value metric units] per month
- Core features: [list 3–5]
- Community support
- [Any network-effect feature — drives adoption]

Limits that drive upgrade:
- [Soft limit that teams hit naturally]
- No team collaboration / sharing
- No SSO / audit logs

---

### Growth — $[X]/month (or $[Y]/month billed annually — save 20%)
**Who it's for:** Small teams shipping product; 1–25 seats.

Everything in Free, plus:
- Up to [5–10× Free value metric units]
- Team collaboration features
- [3–5 features that matter for small teams]
- Email support with 48-hour SLA

*Most popular plan.* Seats: up to [N] included; $[Z]/seat above that.

---

### Business — $[X]/month
**Who it's for:** Growing companies with compliance and security needs; 25–200 seats.

Everything in Growth, plus:
- Unlimited [value metric]
- SSO (SAML / OIDC)
- Audit logs (90-day retention)
- Custom roles and permissions
- Priority support (8-hour SLA)
- SLA uptime guarantee (99.9%)
- [2–3 features that matter for mid-market]

---

### Enterprise — Custom pricing
**Who it's for:** Large organisations (200+ seats), regulated industries, global deployments.

Everything in Business, plus:
- Custom contract and invoicing
- Dedicated success manager
- Custom SLA (up to 99.99%)
- HIPAA / SOC 2 / ISO 27001 attestations
- Data residency options (EU, US, APAC)
- Onboarding, training, and professional services
- Volume discounts on [value metric]
- Custom integrations and API rate limits

Contact: sales@example.com
```

### Freemium Conversion Analysis

```markdown
## Freemium Funnel Analysis — [Quarter]

| Stage | Count | Rate |
|-------|-------|------|
| Sign-ups | 12,450 | — |
| Activated (hit activation event within 7 days) | 4,980 | 40% |
| Engaged (used 3+ times in 30 days) | 2,241 | 45% of activated |
| Converted to paid (within 90 days) | 336 | 15% of engaged |
| Overall sign-up → paid | 12,450 → 336 | 2.7% |

**Key finding:** Activation is the biggest drop-off (60% do not activate).
Improving activation from 40% to 55% would add ~50 conversions/quarter.

**Top reasons for not converting (exit survey, n=87):**
1. "Don't need more than the free tier" — 41%  (pricing limit may be too generous)
2. "Too expensive for my budget" — 28%  (pricing may be too high for ICP)
3. "Missing [feature X]" — 19%  (feature gap)
4. "No budget approval yet" — 12%  (timing / internal process)

**Recommended action:** Tighten the free tier limit on [value metric] by 30%.
Estimate: 15% increase in conversion rate from currently-free users hitting the limit.
```

### Enterprise Deal Structure

```markdown
## Enterprise Pricing Framework

### Inputs to Custom Pricing
- Number of seats (or [value metric] volume)
- Contract length: 1-year / 2-year / 3-year (discount: 0% / 10% / 20%)
- Payment terms: annual upfront / quarterly / monthly
- Add-ons: professional services, additional data residency, premium SLA

### Negotiation Floors (do not go below without VP approval)
- Minimum ACV: $[X]
- Maximum seat discount: [Y]% at [Z]+ seats
- Professional services: always at list price (no discount)

### What to Give vs What to Hold
| Customers often ask for | Offer | Hold firm on |
|------------------------|-------|-------------|
| Price discount | Extended contract term | Core platform price |
| More features in lower tier | Pilot period at higher tier | Feature tier structure |
| Unlimited seats | Volume-based seat pricing | Per-seat pricing model |
| Remove usage caps | Add monitoring + alerts | Unlimited without guardrails |
```

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Cost-plus pricing | Ignores value delivered; almost always underprices | Start with willingness-to-pay research |
| Too many tiers | Decision paralysis; customers do not upgrade | Maximum 4 public tiers; good/better/best model |
| Free tier too generous | No reason to pay; free users are a cost | Free must hit a wall customers care about |
| No annual discount | Customers churn monthly; no commitment | 15–25% annual discount standard SaaS |
| Ignoring packaging | Features in wrong tiers kills expansion | Map features to segment needs; not to cost |
| Never raising prices | Left-behind market pricing; existing customers subsidise new | Annual price review; grandfather for 12 months |

## Rules

- **Price on value, not cost** — what does the customer gain? That is the upper bound on price.
- **Validate with research before launch** — van Westendorp or conjoint; do not guess.
- **One value metric that scales with the customer** — seats, API calls, data volume; choose one.
- **Free tier must convert, not just acquire** — if free users never hit a wall, they never pay.
- **Annual plans anchor retention** — push annual at signup; offer 15–25% discount.
- **Enterprise pricing is a separate motion** — custom, relationship-driven; never put it in the public pricing table.
- **Track conversion and expansion by tier** — pricing decisions without cohort data are guesses.
- **Review pricing annually** — your value proposition and market change; your price should change with them.
- **Package, then price** — decide which features go in which tier before deciding the price of each tier.
- **Anchor with the highest tier** — show the Enterprise or highest-value tier first on the pricing page; anchors the rest.
