---
name: monetization-strategy
description: Design and optimise product monetization models including pricing, packaging, and expansion revenue. Outputs pricing strategy, tier design, pricing experiments, and revenue forecasting.
argument-hint: [product type, customer segments, competitive landscape, current ARR, pricing maturity]
allowed-tools: Read, Write
---

# Monetization Strategy

Monetization is how your product captures value from the value it creates. The right model depends on your product type, customer segments, and competitive context. Getting pricing wrong — too low (leaves money on the table), too high (kills growth), or wrong structure (misaligned with value) — is one of the most expensive mistakes in product.

## Pricing Model Selection

```
PER-SEAT / PER-USER
  Pros: Aligned with adoption; predictable for customers
  Cons: Discourages expansion (teams hide users)
  Best for: Collaboration tools, CRMs, project management

USAGE-BASED
  Pros: Aligns with customer value; low barrier to entry
  Cons: Revenue unpredictable; customers manage spend anxiously
  Best for: APIs, data platforms, infrastructure, AI

OUTCOME-BASED
  Pros: Maximally aligned with value; highest WTP
  Cons: Hard to measure; requires trust; complex contracts
  Best for: Recruiting (cost per hire), payments (% of revenue)

FLAT-RATE TIERED
  Pros: Simple; predictable for both sides
  Cons: One-size-fits-none; difficult to capture enterprise value
  Best for: SMB SaaS; low-complexity products

PLATFORM + TRANSACTIONS
  Pros: High-margin expansion; network effects
  Cons: Requires scale; complex to implement
  Best for: Marketplaces, fintech, ecommerce

FREEMIUM
  Pros: Low acquisition cost; high top-of-funnel
  Cons: Conversion rates low; free tier support cost
  Best for: PLG products with viral loops
```

## Tier Design Framework

```markdown
## Three-Tier Design: Starter → Pro → Enterprise

### Design Principles
- Each tier must have a clear target persona
- Features should be differentiating, not arbitrary (don't create artificial limits)
- Price points must feel fair relative to value delivered
- Middle tier ("Pro") is typically highest-margin; design for it

### Feature Allocation Matrix

| Feature | Starter | Pro | Enterprise |
|---------|---------|-----|-----------|
| Core workflow | ✓ | ✓ | ✓ |
| Integrations | 2 | All | All + custom |
| Users | 1 | 5 | Unlimited |
| Storage | 10GB | 100GB | Unlimited |
| Analytics | Basic | Advanced | Custom |
| SSO / SAML | ✗ | ✗ | ✓ |
| Audit logs | ✗ | ✗ | ✓ |
| SLA / support | Community | Email (2hr) | Dedicated CSM |
| Price | $0/mo | $49/mo | Custom |

### What goes in Enterprise (not Pro):
  Security and compliance features (SSO, SAML, audit logs)
  Administrative controls (custom roles, org-wide policies)
  Advanced support (dedicated CSM, phone, SLA)
  Volume discounts + contractual commitments
```

## Pricing Experiment Framework

```python
from dataclasses import dataclass
from scipy import stats
import numpy as np

@dataclass
class PricingExperiment:
    name: str
    control_price: float      # Current price
    variant_price: float      # Test price
    metric: str               # "trial_to_paid_cvr" | "monthly_revenue_per_lead"
    duration_weeks: int       # How long to run

def estimate_experiment_size(
    baseline_cvr: float,     # Current conversion rate (e.g., 0.20)
    mde: float = 0.05,       # Minimum detectable effect (absolute)
    alpha: float = 0.05,
    power: float = 0.80,
) -> int:
    """Sample size per variant for conversion rate experiment."""
    p1 = baseline_cvr
    p2 = baseline_cvr + mde
    z_alpha = stats.norm.ppf(1 - alpha/2)
    z_beta = stats.norm.ppf(power)
    pooled_p = (p1 + p2) / 2
    n = (z_alpha * np.sqrt(2 * pooled_p * (1 - pooled_p)) +
         z_beta * np.sqrt(p1*(1-p1) + p2*(1-p2))) ** 2
    n /= (p2 - p1) ** 2
    return int(np.ceil(n))

# Example: test $49/mo vs $59/mo on trial conversion
experiment = PricingExperiment(
    name="price_lift_test_q2",
    control_price=49.0,
    variant_price=59.0,
    metric="trial_to_paid_cvr",
    duration_weeks=4,
)

n_per_variant = estimate_experiment_size(baseline_cvr=0.22, mde=0.04)
# If 500 trials/week → need n_per_variant / 500 = weeks to run
```

## Value Metric Identification

```markdown
## Finding Your Value Metric

The value metric is what you charge for — it should grow with the value the customer receives.

### Good Value Metrics
"Messages sent" (Twilio) — customer pays more as they use the product more
"Monthly active users" (Amplitude) — grows as customer's product grows
"Projects" (Basecamp, flat) — simple; but doesn't expand with value
"% of revenue processed" (Stripe) — perfectly aligned; customer success = our success

### Bad Value Metrics
"Seats" for tools where value is individual, not collaborative
"Storage" when the product's value is not about storage
Arbitrary "features" that don't map to how customers think about value

### Value Metric Discovery Process
1. List all ways customers use the product
2. For each: "Does a customer who uses this more get more value?"
3. For each: "Does a customer who uses this more cause us more cost?"
4. Choose metric where both answers are yes
5. Validate with pricing interviews: "What does success look like for you with this product?"
```

## Revenue Modelling

```python
def model_revenue_growth(
    current_customers: int,
    current_arpu: float,          # Average revenue per user/month
    monthly_new_customers: int,
    churn_rate_monthly: float,    # e.g., 0.02 = 2%/month
    expansion_rate_monthly: float, # e.g., 0.01 = 1%/month additional ARPU
    months: int = 24,
) -> list[dict]:
    customers = current_customers
    arpu = current_arpu
    results = []

    for month in range(months):
        mrr = customers * arpu
        customers = customers * (1 - churn_rate_monthly) + monthly_new_customers
        arpu = arpu * (1 + expansion_rate_monthly)

        results.append({
            "month": month + 1,
            "customers": int(customers),
            "arpu": round(arpu, 2),
            "mrr": round(mrr, 0),
            "arr": round(mrr * 12, 0),
        })

    return results
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Copying competitor pricing** | Their unit economics differ from yours | Price based on your customer's value, not competitor's |
| **Never testing price** | Leave money on table; never know willingness-to-pay | A/B test price on new signups (not existing customers) |
| **Arbitrary tier limits** | Customers frustrated by artificial friction | Limits should reflect real cost or value differences |
| **Annual contract only** | High-friction; misses SMB PLG segment | Monthly available; annual discounted |
| **No expansion mechanism** | Revenue flat after initial deal | Usage expansion or upsell path built into pricing model |

## 10 Rules

1. Price based on value delivered to the customer, not cost to you.
2. The value metric — what you charge for — should grow with customer value.
3. Three tiers is usually optimal: Starter, Pro, Enterprise.
4. Enterprise tier contains security, compliance, and support — not features.
5. Test price on new cohorts — never surprise existing customers with price changes.
6. Annual plan discount (20-30%) improves cash flow and reduces churn.
7. NRR >100% requires built-in expansion — design for it from the start.
8. Willingness-to-pay interviews with customers before setting price.
9. Freemium conversion rate and time-to-convert are key PLG pricing signals.
10. Raise prices once you find true product-market fit — early-stage underpricing is common and correctable.
