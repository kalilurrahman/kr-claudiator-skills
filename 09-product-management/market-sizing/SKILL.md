---
name: market-sizing
description: Estimate the size of a market using top-down and bottom-up methods. Produces a TAM/SAM/SOM analysis with assumptions documented, sensitivity analysis, and business implications for go-to-market strategy.
argument-hint: [market or product category, geographic scope, target customer, pricing model]
allowed-tools: Read, Write, Bash
---

# Market Sizing

Market sizing answers the question: "Is this worth pursuing?" It produces a defensible estimate of the addressable opportunity, not a precise number. The goal is to understand order of magnitude, validate assumptions, and identify the key levers that make the opportunity larger or smaller.

## Market Size Definitions

| Term | Definition | Use it for |
|------|-----------|-----------|
| TAM — Total Addressable Market | Total global demand for the category if you had 100% market share | Validating the ceiling |
| SAM — Serviceable Addressable Market | The portion of TAM your product and GTM can realistically reach | Realistic opportunity |
| SOM — Serviceable Obtainable Market | The share of SAM you can capture in 3–5 years | Business plan input |

## Two Methods

### Top-Down
Start with industry data (analyst reports, public company filings) and narrow to your segment.

```
TAM = [Total industry size from analyst report]
   × [Fraction that matches your category]
SAM = TAM × [Geographic scope] × [Customer segment match] × [Price point accessibility]
SOM = SAM × [Realistic market share in 3–5 years]
```

**Sources:** Gartner, IDC, Forrester, SEC filings, public company investor decks.

### Bottom-Up
Build from customer unit economics upward.

```
TAM = [Number of potential buyers] × [Price per buyer per year]
SAM = [Buyers reachable with your GTM] × [Price per buyer per year]
SOM = [Buyers you can win in 3–5 years] × [Price per buyer per year]
```

**Sources:** LinkedIn company data, industry association statistics, your own sales data.

**Use both methods and triangulate.** If they differ by >5x, revisit your assumptions.

## Process

1. **Define the market precisely** — what category? What customer? What geography? What price point?
2. **Identify market proxies** — what existing data sources give you population and spending data?
3. **Top-down estimate** — start with industry analyst market size; narrow to your segment.
4. **Bottom-up estimate** — count potential buyers × your pricing.
5. **Triangulate** — do both methods agree within 2–3x? If not, find the assumption causing the gap.
6. **Document every assumption** — each assumption should have a source or a clear rationale.
7. **Run sensitivity analysis** — how does the SOM change if your key assumption is 50% wrong?
8. **Segment the opportunity** — break down by geography, company size, or vertical.
9. **Assess competitive density** — how much of the SAM is already claimed by incumbents?
10. **Write implications** — what does this mean for pricing, GTM strategy, and fundraising narrative?

## Output Format

```markdown
# Market Sizing: [Product / Market Category]
**Date:** [YYYY-MM-DD]
**Author:** [Name]
**Scope:** [Category] — [Geography] — [Customer segment]
**Pricing model:** [$X per user per year / $X per company per year]

---

## Summary

**TAM:** $[X]B — Total global market for [category]
**SAM:** $[X]B — [Your target geography and segment]
**SOM:** $[X]M — [Realistic 5-year capture]

**Key conclusion:** [One sentence on whether the opportunity is large enough and what it implies for strategy]

---

## Method 1: Top-Down

### Step 1: Total industry size
**Source:** [Analyst report or public filing]
- [e.g., "Gartner estimates the global project management software market at $7.3B in 2024, growing at 13% CAGR"]
- Total industry: $7.3B

### Step 2: Narrow to your category
- Project management software that serves B2B SaaS teams: ~35% of total market
- Segment size: $7.3B × 35% = $2.6B

### Step 3: Narrow to your geography
- North America + Western Europe: ~65% of B2B SaaS spend
- SAM (top-down): $2.6B × 65% = $1.7B

**Top-down SAM estimate: ~$1.7B**

---

## Method 2: Bottom-Up

### Step 1: Count the buyers

**Target customer:** Product and engineering teams at B2B SaaS companies, 10–500 employees.

| Company size | # Companies (US + EU) | Source |
|-------------|----------------------|--------|
| 10–50 employees | ~180,000 | LinkedIn company data |
| 51–200 employees | ~52,000 | LinkedIn company data |
| 201–500 employees | ~18,000 | PitchBook / Crunchbase |
| **Total** | **~250,000 companies** | |

**Assumption:** 60% of these are B2B SaaS or technology companies = ~150,000 target companies.

### Step 2: Average revenue per account

| Segment | Team size | ACV estimate | Basis |
|---------|-----------|-------------|-------|
| 10–50 employees | 8 team seats | $120/seat/year = $960/year | Our current pricing |
| 51–200 employees | 25 team seats | $120/seat/year = $3,000/year | Our current pricing |
| 201–500 employees | 60 team seats | $100/seat/year = $6,000/year | Volume discount |

**Weighted average ACV:** ~$2,400/year across all segments

### Step 3: Calculate SAM

SAM = 150,000 companies × $2,400 average ACV = **$360M**

---

## Triangulation

| Method | Estimate | Variance |
|--------|---------|---------|
| Top-down | $1.7B | — |
| Bottom-up | $360M | — |
| **Midpoint** | **~$700M** | 5x range |

**Gap analysis:** The 5x gap between methods is explained by:
1. The top-down figure includes all PM software (enterprise tools like Jira cost $80–200/user/year vs. our $120)
2. Bottom-up may undercount total buyer universe (excludes non-SaaS tech companies)
3. Enterprise segment (500+ employees) is excluded from bottom-up

**Revised SAM (including 500+ employee companies at $15K ACV):**
- Add ~20,000 enterprise companies × $15,000 = $300M additional
- Revised bottom-up SAM: ~$660M

**Conclusion:** SAM is likely in the $500M–$800M range. Use $650M as the base case.

---

## SOM Calculation (5-Year)

**Assumptions:**
- Year 1: Land 200 new accounts (current run rate: 12/month)
- Year 3: Grow to 1,500 accounts at $2,400 ACV = $3.6M ARR
- Year 5: Grow to 5,000 accounts at $2,600 ACV (expansion) = $13M ARR

| Year | Accounts | ACV | ARR | SOM % of SAM |
|------|---------|-----|-----|-------------|
| 1 | 400 | $2,000 | $0.8M | 0.1% |
| 3 | 1,500 | $2,400 | $3.6M | 0.6% |
| 5 | 5,000 | $2,600 | $13M | 2.0% |

**5-year SOM: $13M ARR (~2% of SAM)**

---

## Sensitivity Analysis

What happens to 5-year SOM if key assumptions change?

| Assumption | Base case | Pessimistic (-50%) | Optimistic (+50%) |
|-----------|----------|-------------------|------------------|
| Total addressable buyers | 150,000 | 75,000 | 225,000 |
| Win rate | 3% | 1.5% | 4.5% |
| Average ACV | $2,400 | $1,800 | $3,200 |
| 5-year ARR | $13M | $5M | $28M |

**Key insight:** Win rate has the largest impact. Improving win rate from 3% to 5% (via better onboarding or a stronger enterprise tier) more than doubles the SOM.

---

## Segment Breakdown

| Segment | SAM | Current penetration | Priority |
|---------|-----|-------------------|---------|
| US SaaS companies, 50–200 employees | $180M | 0.8% | P1 |
| EU SaaS companies, 50–200 employees | $120M | 0.1% | P2 |
| US SaaS companies, 10–50 employees | $80M | 0.4% | P3 (high volume, low ACV) |
| Enterprise 500+ employees | $270M | 0% (not yet serving) | Future |

---

## Strategic Implications

1. **The market is large enough** — $650M SAM is sufficient to build a $100M+ ARR business without needing > 15% market share.

2. **Enterprise is the biggest prize but requires investment** — $270M of SAM is in enterprise (500+). We are currently not equipped to serve this segment. SSO, SOC 2, and enterprise contracts are required.

3. **Win rate improvement is the highest-leverage variable** — current win rate in contested deals is approximately 22%. Moving to 35% has more impact than expanding total buyer universe.

4. **EU is underpenetrated** — 0.1% penetration vs. 0.8% in the US, despite $120M SAM. Consider localized onboarding and EU data residency as unlock mechanisms.

5. **Competitive density is rising** — 4 well-funded competitors serving the same SAM. Differentiation via self-serve enterprise features is the defensible wedge.
```

## Sourcing Market Data

| Situation | Source | Cost |
|-----------|--------|------|
| Industry analyst report | Gartner Magic Quadrant, IDC MarketScape | Free summaries; paid full reports |
| Public company filings | SEC EDGAR (10-K annual reports) — search competitor filings for market size claims | Free |
| LinkedIn company counts | LinkedIn Sales Navigator company search by employee count + industry | Paid subscription |
| VC / startup market sizing | Pitchbook, Crunchbase — look at competitor funding rounds; decks often cite TAM | Paid |
| Bottoms-up proxies | Bureau of Labor Statistics (US), Eurostat (EU) for employer counts | Free |
| Survey data | Your own NPS surveys, trial signup data | Free if you have it |

## Common Mistakes

| Mistake | Example | Fix |
|---------|---------|-----|
| TAM = SAM | "The global software market is $600B — our TAM is $600B" | Narrow to your actual category and customer |
| Circular reasoning | "We want to reach $50M ARR, so our SOM is $50M" | Build SOM from win rate × addressable buyers |
| Ignoring competition | "100% of SAM is available to us" | Apply competitive intensity discount (30–70% of SAM is captured by incumbents) |
| False precision | "Our TAM is $3.847B" | Use ranges: "TAM is $3–4B" |
| Wrong time horizon | "We can capture 30% of TAM" | 30% market share is extremely rare; 2–5% in 5 years is realistic |

## Rules

- **Use two methods, then triangulate** — a single method produces a number; two methods produce confidence.
- **Document every assumption** — a market size without assumptions is a guess.
- **SAM, not TAM, drives strategy** — TAM is for the pitch deck; SAM is for the business plan.
- **Sensitivity analysis is mandatory** — show how SOM changes if your biggest assumption is wrong.
- **False precision undermines credibility** — use ranges; do not claim precision you do not have.
- **Competitive density reduces SOM** — some SAM is already captured by incumbents; account for it.
- **Win rate is the most controllable variable** — focus improvement efforts on win rate, not market expansion.
- **Segment before sizing** — one large number is less useful than three smaller numbers by segment.
- **Update annually** — a 3-year-old market sizing analysis may miss new competitors or market shifts.
- **Connect to fundraising or planning** — always end with what the sizing implies for strategy.
