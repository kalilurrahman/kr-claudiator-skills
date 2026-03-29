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
