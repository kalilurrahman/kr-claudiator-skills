---
name: data-enrichment
description: Design data enrichment pipelines that augment first-party data with external sources. Outputs enrichment strategy, provider evaluation, pipeline design, match rate optimisation, and quality controls.
argument-hint: [data types to enrich, use cases, budget, privacy requirements, existing data assets]
allowed-tools: Read, Write
---

# Data Enrichment

Data enrichment adds context to your first-party data using external sources. A customer record enriched with firmographic data (company size, industry) enables better segmentation, scoring, and personalisation. The challenge is match rates, data quality, freshness, and cost.

## Enrichment Use Cases

```
FIRMOGRAPHIC (B2B)
  Sources: Clearbit, ZoomInfo, Apollo, LinkedIn, Crunchbase
  Adds: company_size, industry, revenue_range, funding_stage, tech_stack
  Use: Lead scoring, ICP matching, tier assignment

DEMOGRAPHIC (B2C)
  Sources: Experian, Acxiom, first-party surveys
  Adds: age_range, income_bracket, household_size, location_type
  Use: Personalisation, product recommendations

BEHAVIOURAL ENRICHMENT
  Sources: Intent data providers (Bombora, G2), review sites
  Adds: in_market_signals, competitor_usage, buying_intent
  Use: Sales prioritisation, timing of outreach

GEOGRAPHIC
  Sources: Google Maps API, MaxMind, IP geolocation
  Adds: timezone, metro_area, country, region, lat/lng
  Use: Regional pricing, localisation, compliance

TECHNOGRAPHIC
  Sources: BuiltWith, Wappalyzer, SimilarTech
  Adds: tech_stack, cms, ecommerce_platform, analytics_tools
  Use: Integration prioritisation, competitive intelligence
```

## Enrichment Pipeline

```python
import httpx
from pydantic import BaseModel
from typing import Optional
import asyncio

class ClearbitEnrichment(BaseModel):
    company_name: Optional[str] = None
    company_domain: Optional[str] = None
    company_size: Optional[str] = None      # "1-10", "11-50", "51-200", etc.
    industry: Optional[str] = None
    country: Optional[str] = None
    funding_stage: Optional[str] = None
    annual_revenue_range: Optional[str] = None
    linkedin_url: Optional[str] = None
    enriched_at: Optional[str] = None
    match_confidence: Optional[float] = None

class DataEnricher:
    def __init__(self, clearbit_api_key: str):
        self.client = httpx.AsyncClient(
            base_url="https://company.clearbit.com/v2",
            headers={"Authorization": f"Bearer {clearbit_api_key}"},
            timeout=10.0,
        )
    
    async def enrich_by_email(self, email: str) -> ClearbitEnrichment:
        try:
            resp = await self.client.get(
                "/combined/find",
                params={"email": email},
            )
            if resp.status_code == 200:
                data = resp.json()
                company = data.get("company", {})
                return ClearbitEnrichment(
                    company_name=company.get("name"),
                    company_domain=company.get("domain"),
                    company_size=company.get("metrics", {}).get("employeesRange"),
                    industry=company.get("category", {}).get("industry"),
                    country=company.get("geo", {}).get("country"),
                    funding_stage=company.get("crunchbase", {}).get("handle"),
                    enriched_at=datetime.utcnow().isoformat(),
                    match_confidence=1.0,
                )
            elif resp.status_code == 404:
                return ClearbitEnrichment(match_confidence=0.0)
            elif resp.status_code == 202:
                # Clearbit is looking it up asynchronously — retry later
                return ClearbitEnrichment(match_confidence=None)
        except httpx.TimeoutException:
            return ClearbitEnrichment(match_confidence=None)
    
    async def enrich_batch(self, emails: list[str]) -> dict[str, ClearbitEnrichment]:
        semaphore = asyncio.Semaphore(10)
        async def enrich_one(email):
            async with semaphore:
                result = await self.enrich_by_email(email)
                await asyncio.sleep(0.1)  # Rate limiting
                return email, result
        
        results = await asyncio.gather(*[enrich_one(e) for e in emails])
        return dict(results)
```

## Match Rate Optimisation

```sql
-- Measure enrichment match rates
SELECT
    DATE_TRUNC('week', enriched_at) AS week,
    COUNT(*) AS total_records,
    SUM(CASE WHEN match_confidence > 0 THEN 1 ELSE 0 END) AS matched,
    SUM(CASE WHEN match_confidence IS NULL THEN 1 ELSE 0 END) AS pending,
    ROUND(100.0 * SUM(CASE WHEN match_confidence > 0 THEN 1 ELSE 0 END)
          / COUNT(*), 1) AS match_rate,
    AVG(CASE WHEN match_confidence > 0 THEN match_confidence END) AS avg_confidence
FROM customer_enrichment
GROUP BY 1
ORDER BY 1 DESC;

-- Records most likely to enrich (prioritise by signal strength)
-- Business email domains match better than personal (gmail, yahoo)
SELECT email, created_at
FROM customers
WHERE enriched_at IS NULL
  AND email NOT LIKE '%@gmail%'
  AND email NOT LIKE '%@yahoo%'
  AND email NOT LIKE '%@hotmail%'
ORDER BY created_at DESC
LIMIT 1000;
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Enriching without consent** | GDPR violation in EU | Review legal basis; document legitimate interest |
| **Storing enriched PII without TTL** | Data minimisation violation | Enrich at point of use; or set retention policy |
| **Single provider dependency** | Provider outage or price increase | Multi-provider strategy with fallback |
| **No match confidence tracking** | Low-quality matches corrupt downstream models | Track confidence; use threshold for scoring models |
| **Enriching all records** | Cost waste on inactive accounts | Prioritise high-value or recently active accounts |

## 10 Rules

1. Legal basis for enrichment must be documented — GDPR legitimate interest or consent.
2. Match confidence is a first-class metric — low-confidence enrichment degrades model quality.
3. Enrich on demand or at point of use — not for all records by default.
4. Prioritise enrichment budget on high-value segments — not uniform across all customers.
5. Multi-provider waterfall: try primary, fall back to secondary for misses.
6. Freshness matters — firmographic data changes; re-enrich key accounts quarterly.
7. Store raw enriched data separate from derived attributes — enables reprocessing.
8. Track enrichment coverage by segment — "we have company_size for 70% of enterprise accounts".
9. Personal email domains (gmail, yahoo) match poorly — focus on business emails.
10. Enrichment is a complement to first-party data — never more trusted than your own signals.

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

The canonical workflow for **Data Enrichment** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Design data enrichment pipelines that augment first-party data with external sources. Outputs enrichment strategy, provider evaluation, pipeline design, match r
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
