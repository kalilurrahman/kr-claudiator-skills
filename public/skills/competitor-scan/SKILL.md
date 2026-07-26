---
name: competitor-scan
description: Conduct a structured competitive analysis of a product or feature set. Produces a comparison matrix, positioning gaps, competitive strengths and weaknesses, and strategic recommendations.
argument-hint: [your product, competitors to analyze, feature area or market context]
allowed-tools: Read, Write, Bash
---

# Competitive Analysis

Competitive analysis is not just feature comparison. It maps where competitors win, where they lose, and what whitespace your product can own. A good competitive scan produces positioning clarity, roadmap inputs, and sales battlecards.

## Analysis Dimensions

| Dimension | What to assess |
|-----------|---------------|
| Product capabilities | Feature completeness by category |
| Positioning | Target customer, value prop, messaging |
| Pricing | Model, tiers, per-unit pricing, enterprise terms |
| Go-to-market | Sales motion, channels, partner ecosystem |
| Strengths | Where competitors genuinely win |
| Weaknesses | Where they are vulnerable or receive complaints |
| Market momentum | Funding, hiring, customer growth signals |

## Research Sources

| Source | What it reveals |
|--------|----------------|
| Product website + docs | Public feature claims, positioning, pricing |
| G2 / Capterra reviews | Customer sentiment, real strengths and pain points |
| LinkedIn job postings | Engineering focus, growth areas, tech stack signals |
| App store reviews | Mobile product experience, user frustrations |
| Release notes / changelog | Recent feature velocity and priorities |
| Sales call recordings (Gong) | How they handle competitive deals |
| Twitter / LinkedIn | Messaging, customer announcements, culture signals |
| Crunchbase / PitchBook | Funding, stage, investor signals |

## Process

1. **Define scope** — which competitors and which product dimensions to compare.
2. **Primary research** — sign up for free trials; experience the product as a user.
3. **Secondary research** — G2 reviews, app store, changelog, docs.
4. **Score each dimension** — use a consistent 1–3 scale: 1 = weak, 2 = comparable, 3 = strong.
5. **Identify competitive moats** — what would be very hard to replicate? Data network effects, integrations depth, enterprise relationships.
6. **Map whitespace** — where do all competitors have gaps that customers need filled?
7. **Write battlecards** — 1-page win/lose summaries for each competitor, for sales use.
8. **Extract roadmap implications** — which gaps should you close? Which should you widen?
9. **Define your wedge** — the one or two dimensions where you want to be definitively best.
10. **Save** as `competitive-analysis-[market]-[date].md`.

## Output Format

```markdown
# Competitive Analysis: [Market / Feature Area]
**Date:** [YYYY-MM-DD]
**Author:** [PM name]
**Scope:** [e.g., Team collaboration tools for mid-market B2B SaaS]
**Your product:** [Product name]

---

## Competitor Overview

| Company | Stage | Pricing (start) | Target segment | Primary strength |
|---------|-------|-----------------|----------------|-----------------|
| [Competitor A] | Series C, $80M raised | $25/user/month | Enterprise | Deep Salesforce integration |
| [Competitor B] | Public (IPO 2022) | $12/user/month | SMB | Ease of use, onboarding |
| [Competitor C] | Bootstrapped | $8/user/month | Developer teams | API-first, flexibility |
| [Your product] | Series A, $18M raised | $15/user/month | Mid-market | [Your strength] |

---

## Feature Comparison Matrix

**Scoring:** 3 = Best-in-class / 2 = Solid / 1 = Weak or absent

| Feature Area | Your Product | Competitor A | Competitor B | Competitor C |
|-------------|-------------|-------------|-------------|-------------|
| **Onboarding** | | | | |
| Self-serve setup | 2 | 1 | 3 | 2 |
| Interactive product tour | 1 | 2 | 3 | 1 |
| Template library | 2 | 3 | 2 | 1 |
| **Collaboration** | | | | |
| Real-time editing | 2 | 3 | 2 | 1 |
| Commenting / mentions | 2 | 3 | 3 | 2 |
| Version history | 1 | 3 | 2 | 3 |
| **Enterprise / Security** | | | | |
| SSO (SAML/OIDC) | 1 | 3 | 2 | 1 |
| Audit logs | 1 | 3 | 1 | 2 |
| Custom roles / RBAC | 2 | 3 | 2 | 1 |
| SOC 2 Type II | 0 | 1 | 1 | 0 |
| **Integrations** | | | | |
| Native Salesforce | 0 | 3 | 1 | 0 |
| Slack | 2 | 3 | 3 | 2 |
| API + webhooks | 2 | 2 | 1 | 3 |
| Zapier / Make | 1 | 2 | 2 | 3 |
| **Reporting & Analytics** | | | | |
| Usage dashboard | 2 | 3 | 2 | 1 |
| Scheduled reports | 1 | 2 | 1 | 0 |
| Custom dashboards | 1 | 3 | 2 | 2 |
| **Pricing & Packaging** | | | | |
| Free tier | 2 | 1 | 3 | 2 |
| Transparent pricing | 2 | 1 | 3 | 3 |
| Volume discounts | 1 | 3 | 2 | 1 |

**Totals (sum / possible):**
| Your Product | Competitor A | Competitor B | Competitor C |
|-------------|-------------|-------------|-------------|
| 30 / 54 (56%) | 47 / 54 (87%) | 38 / 54 (70%) | 29 / 54 (54%) |

---

## Competitive Strengths and Weaknesses

### Competitor A (Enterprise Leader)
**Strengths:**
- Deepest enterprise security (SSO, audit logs, SOC 2 in progress)
- Best-in-class Salesforce integration — used as a selling point with RevOps buyers
- Strong customer success and professional services for onboarding

**Weaknesses (from G2 reviews, n=340):**
- "Incredibly slow to onboard — took 3 weeks with their team" (repeated theme in 1–3 star reviews)
- Pricing is opaque; most customers say they "had to negotiate" — no self-serve
- API is SOAP-based and widely criticized; developers avoid it

**Competitive opportunity:**
- Win against Competitor A when: buyer is developer-led, mid-market (<300 seats), needs fast self-serve setup
- Lose against Competitor A when: buyer is enterprise IT-led and already uses Salesforce

---

### Competitor B (SMB Favorite)
**Strengths:**
- Easiest onboarding — highly rated on G2 for "getting started fast"
- Broad user base and brand recognition; often the default comparison
- Generous free tier converts to strong top-of-funnel

**Weaknesses (from G2 reviews, n=820):**
- "Falls apart when you add more than 50 users — becomes slow and disorganized"
- Limited enterprise features: no SSO, no audit log, no custom roles
- Customer support rated poorly at scale; large accounts feel neglected

**Competitive opportunity:**
- Win against Competitor B when: account grows past 50 users and needs enterprise controls
- Expand head-to-head when: emphasizing growth path — "you'll outgrow Competitor B; we scale with you"

---

### Competitor C (Developer Tool)
**Strengths:**
- Best API in the market — comprehensive, well-documented, loved by developers
- Flexible data model; power users can customize deeply
- Strong community and open-source ecosystem

**Weaknesses:**
- Steep learning curve; non-technical users consistently struggle
- No managed onboarding or implementation support
- UI is functional but not polished; business users find it off-putting

**Competitive opportunity:**
- Win against Competitor C when: buyer includes non-technical stakeholders or is buying for a mixed team
- Lose against Competitor C when: buyer is pure developer team with high customization needs

---

## Whitespace Analysis

Features that no competitor does well, that customers need:

| Gap | Evidence | Your opportunity |
|----|---------|-----------------|
| Automated reporting for managers | Top NPS complaint across all competitors | Build scheduled reports first to own this space |
| Self-serve enterprise security | Competitor A requires professional services; others lack features | Self-serve SAML configuration = differentiation |
| Onboarding for non-technical users | Competitor C struggles here; Competitor B only handles simple cases | Interactive, role-based onboarding |
| Native HubSpot integration | None of the 3 have it; HubSpot is top-requested on all | First-mover advantage in HubSpot-native segment |

---

## Positioning Recommendations

**Own this space:** "The tool that scales with your team — enterprise-grade security without enterprise-grade complexity."

**Win message vs. Competitor A:** "Same enterprise security, self-serve setup, no professional services required."
**Win message vs. Competitor B:** "When your team grows past 50 people, you'll need us. Start now, grow without switching tools."
**Win message vs. Competitor C:** "All the API flexibility developers love, with the UX your business users will actually use."

---

## Roadmap Implications

| Gap to close | Priority | Timeline |
|-------------|---------|---------|
| Self-serve SSO (SAML) | P1 | Q2 (blocks enterprise deals) |
| Scheduled report delivery | P1 | Q2 (whitespace, NPS pain) |
| Salesforce integration | P2 | Q3 (required to win Competitor A deals) |
| SOC 2 Type II | P2 | Q3–Q4 (required for enterprise procurement) |
| HubSpot integration | P3 | Q4 (first-mover opportunity) |

---

## Sales Battlecards (Summary)

### vs. Competitor A
**When you hear:** "We already looked at Competitor A."
**Win angle:** Speed and self-service. "Competitor A requires 3 weeks of professional services to onboard. We can have your team live in a day."
**Watch out for:** If they have Salesforce as a hard requirement, escalate to partnership discussion.

### vs. Competitor B
**When you hear:** "We're already using Competitor B."
**Win angle:** Scale. "Competitor B is great for teams under 20. You're at [X size]. Do you have SSO? Audit logs? You'll need them for enterprise compliance."
**Watch out for:** Do not undermine their investment in Competitor B; frame as "graduation" not "mistake."
```

## G2 Review Mining Template

When reading competitor reviews, extract:
- Most common phrase in 5-star reviews → their genuine strength
- Most common phrase in 1–2 star reviews → their genuine weakness
- Features mentioned as "missing" → gaps you can own
- Segments mentioned in reviews → who their real customer base is (may differ from positioning)

## Anti-Patterns to Avoid

| Anti-pattern | What it looks like | Fix |
|-------------|-------------------|-----|
| Feature list, no insight | "Competitor A has SSO; we don't" | Add: "This is blocking 8 deals in enterprise segment" |
| Rosy view of your product | You score yourself 3 everywhere | Ask sales and CS to score you honestly before comparing |
| Stale analysis | 2-year-old competitive scan | Schedule quarterly updates; set a reminder |
| Only obvious competitors | Ignore adjacent tools | Check what customers use when they churn or combine with your product |
| No primary research | Based entirely on marketing website | Sign up for the product; experience it as a user |

## Rules

- **Use primary research** — sign up for and use every competitor product before writing the analysis.
- **Score yourself honestly** — if you score yourself higher than customers do in reviews, the analysis is misleading.
- **Weight by customer segment** — a feature gap only matters if it affects a segment you are targeting.
- **Extract whitespace, not just gaps** — find the areas no competitor does well; that is your territory.
- **Build battlecards for sales** — competitive analysis that does not reach the sales team is wasted work.
- **Update quarterly** — a competitive analysis older than 6 months is probably wrong in important ways.
- **Map to your roadmap** — every competitive gap in a priority segment should appear in the roadmap discussion.
- **G2 reviews are primary sources** — customers describing their real experience beats marketing copy.
- **Segment your comparison** — Competitor A may win enterprise but lose SMB; analyze by segment.
- **Define your wedge** — pick 1–2 dimensions where you will be definitively best; do not try to win everywhere.
