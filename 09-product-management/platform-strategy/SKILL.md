---
name: platform-strategy
description: Develop a platform strategy that creates an ecosystem around your product. Outputs platform definition, ecosystem design, API strategy, marketplace model, and network effect cultivation.
argument-hint: [product type, existing integrations, developer audience, competitive moat, revenue model]
allowed-tools: Read, Write
---

# Platform Strategy

A platform creates value by enabling interactions between two or more user groups — and the platform itself benefits from the network effects this creates. Becoming a platform is not just about building an API; it requires deliberate ecosystem design, developer experience investment, and governance.

## Platform vs Product

```
PRODUCT: Creates value for its users directly
  Example: A CRM manages your customer relationships
  Value: Proportional to features

PLATFORM: Creates value by facilitating interactions between groups
  Example: Salesforce AppExchange connects ISVs with Salesforce customers
  Value: Grows with the size and quality of the ecosystem
  Network effects: More developers → more apps → more customers → more developers

BECOMING A PLATFORM:
  1. You have a distribution advantage (many users/customers)
  2. Third parties want to reach those users
  3. Third parties can extend your product better than you can alone
  4. The extensions create value for your users (not just the third party)
```

## Platform Design

```markdown
## Platform Design Framework

### 1. Core Interaction
What is the fundamental transaction between participants?
  Salesforce: ISVs build apps → Enterprise customers buy/install apps
  Shopify: Developers build integrations → Merchants extend their stores
  Slack: App developers build bots/integrations → Teams use them in workflows

### 2. Participant Groups
Who are the sides of the platform?
  Side A: [Developers / ISVs / Partners] — create value
  Side B: [Your existing customers] — consume value
  Pricing: Often subsidise one side to attract the other
  (Developers often get free access; customers pay for apps)

### 3. Network Effects
What makes the platform more valuable as it grows?
  Direct: More apps → better for customers; more customers → better for developers
  Data: More usage → better recommendations/matching
  Social: More colleagues using same tools → easier to collaborate

### 4. Platform Governance
Who can participate? What are the rules?
  Open: Anyone can build (Twitter before API restrictions)
  Curated: Reviewed before publishing (App Store model)
  Enterprise: Vetted partners only (security-sensitive)

Choose based on: trust level, quality control needs, desired ecosystem size
```

## API as Platform Foundation

```python
# Platform APIs must be more stable and backwards-compatible than internal APIs
# Breaking changes break third-party integrations — not just your own code

class PlatformAPIPolicy:
    """
    API versioning and deprecation policy for platform partners.
    """
    # Minimum notice before breaking change: 12 months (vs 3 months for internal)
    DEPRECATION_NOTICE_MONTHS = 12

    # Supported API versions simultaneously: 2 (vs 1 for internal)
    SUPPORTED_VERSIONS = 2

    # Developer SLA: p99 latency < 500ms; availability > 99.9%
    LATENCY_P99_MS = 500
    AVAILABILITY_TARGET = 0.999

    # Partner onboarding: sandbox → production review → certification
    ONBOARDING_STAGES = ["sandbox", "review", "certified", "featured"]
```

## Developer Experience (DX)

```markdown
## DX Maturity Model

LEVEL 1: Basic API access
  - API reference docs
  - Authentication guide
  - Rate limiting docs
  Time-to-first-API-call: Hours

LEVEL 2: Friction-reduced
  - Interactive API explorer (Swagger UI)
  - Quick start guides with code examples
  - Official SDKs in major languages
  Time-to-first-API-call: 30 minutes

LEVEL 3: Developer ecosystem
  - Sandbox environment (no production data, no billing)
  - Sample apps and templates
  - Developer community (forum / Discord)
  - Webhook simulator
  Time-to-first-API-call: 10 minutes

LEVEL 4: Full platform
  - App marketplace with discovery
  - Certification programme
  - Co-marketing for featured partners
  - Dedicated developer relations team
  - Revenue share for marketplace apps
  Time-to-first-API-call: 5 minutes
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **API without ecosystem thinking** | API exists but no network effects | Design participant interactions; cultivate community |
| **Extracting too much from ecosystem** | Partners leave for better platforms | Revenue share; marketing support; co-selling |
| **No certification or quality bar** | Low-quality apps damage platform reputation | App review; quality standards; user ratings |
| **Platform before distribution** | No one to distribute to | Build product first; platform after PMF |
| **Breaking API changes** | Destroys developer trust | 12-month deprecation notice; multiple supported versions |

## 10 Rules

1. Platforms create value through facilitation — not just through features.
2. Network effects are the moat — design for them from day one.
3. Subsidise the hard side of the platform (usually developers) to attract participants.
4. API stability is a promise — breaking changes destroy developer trust.
5. Developer experience is a product — invest in it like a customer-facing product.
6. Governance determines platform quality — choose open vs curated based on trust needs.
7. Marketplace discovery is as important as the apps themselves.
8. Revenue share aligns incentives — partners invest more when they share in success.
9. Platforms need a minimum critical mass — don't launch a marketplace with 3 apps.
10. Platform strategy requires 3-5 year commitment — it cannot be undone if abandoned.
