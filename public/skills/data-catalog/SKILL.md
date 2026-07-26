---
name: data-catalog
description: Build or configure a data catalog to make data assets discoverable, documented, and governed. Covers metadata management, search, classification, ownership, freshness tracking, and integration with dbt and DataHub.
argument-hint: [catalog tool, data sources, team size, governance requirements]
allowed-tools: Read, Write, Bash
---

# Data Catalog

A data catalog is the front door to your data. It answers: what data exists, where is it, who owns it, is it trustworthy, and how do I use it? Without a catalog, data teams spend 30-40% of their time finding and understanding data instead of using it.

## Catalog Components

| Component | What it provides | Source |
|-----------|----------------|--------|
| Metadata inventory | What datasets exist, schema, location | Automated ingestion |
| Business glossary | Canonical definitions for key terms | Human-authored |
| Ownership | Who is responsible for this dataset | Engineering team |
| Freshness | When was this last updated, SLA status | Pipeline metadata |
| Quality | Data quality scores, test results | dbt tests, Great Expectations |
| Lineage | Where data came from, transformations | OpenLineage |
| Usage | Who queries this, how often | Query logs |
| Classification | PII, sensitive, public, confidential | Auto-detection + human review |

## Catalog Tool Selection

| Tool | Best for | Cost |
|------|---------|------|
| DataHub | Large orgs; broad connector support; self-hosted | Open source |
| OpenMetadata | Modern UI; built-in quality; self-hosted | Open source |
| Amundsen | Search-first; smaller orgs | Open source |
| Atlan | SaaS; strong UX; collaboration | Paid |
| Alation | Enterprise; governance; compliance | Paid |
| dbt docs | dbt-native teams; models only | Free with dbt |

## Process

1. **Choose a catalog tool** -- self-hosted open source vs managed SaaS.
2. **Connect data sources** -- warehouse, lakes, BI tools, DBs via connectors.
3. **Automate metadata ingestion** -- schema, statistics, lineage should flow in automatically.
4. **Establish ownership** -- every dataset must have a named owner and team.
5. **Define the business glossary** -- agree on canonical definitions for key business terms.
6. **Add classification rules** -- PII detection, sensitivity labels, compliance tags.
7. **Integrate quality scores** -- surface dbt test results in catalog entries.
8. **Enable search and discovery** -- full-text search by description, column, tag, owner.
9. **Measure catalog health** -- % of datasets with owners, descriptions, freshness metadata.
10. **Embed catalog in analyst workflow** -- integrate with BI tools so it is the path of least resistance.

## DataHub Dataset Metadata (Python API)

```python
from datahub.emitter.mce_builder import make_dataset_urn
from datahub.emitter.rest_emitter import DatahubRestEmitter
from datahub.metadata.schema_classes import (
    DatasetPropertiesClass, OwnershipClass, OwnerClass, OwnershipTypeClass,
    GlobalTagsClass, TagAssociationClass,
)

emitter = DatahubRestEmitter("http://datahub-gms:8080")
dataset_urn = make_dataset_urn("bigquery", "myproject.warehouse.orders_daily")

emitter.emit_mcp(entity_urn=dataset_urn, aspect=DatasetPropertiesClass(
    description="Daily order aggregates. Gold-tier. Updated daily by 09:00 UTC.",
    customProperties={
        "tier": "gold", "sla": "daily-9am-utc", "update_frequency": "daily"
    },
    externalUrl="https://dbt-docs.example.com/models/orders_daily",
))

emitter.emit_mcp(entity_urn=dataset_urn, aspect=OwnershipClass(owners=[
    OwnerClass(owner="urn:li:corpuser:data-team", type=OwnershipTypeClass.DATAOWNER)
]))

emitter.emit_mcp(entity_urn=dataset_urn, aspect=GlobalTagsClass(tags=[
    TagAssociationClass(tag="urn:li:tag:PII-Free"),
    TagAssociationClass(tag="urn:li:tag:Gold-Tier"),
]))
```

## dbt as Catalog Source

```yaml
# models/orders/orders_daily.yml
version: 2
models:
  - name: orders_daily
    description: |
      Daily aggregated order metrics. Gold-tier dataset.
      Updated daily by 09:00 UTC.

      When to use: Daily revenue and order count dashboards.
      When NOT to use: Real-time or hourly reporting (use orders_hourly).

    meta:
      owner: "@data-team"
      slack_channel: "#data-platform"
      tier: gold
      sla: "09:00 UTC daily"

    data_tests:
      - dbt_utils.recency:
          datepart: day
          field: date
          interval: 1

    columns:
      - name: revenue
        description: "Total revenue from completed orders in USD cents. Excludes refunded, pending, cancelled orders."
        meta:
          pii: false
          business_term: "daily_revenue"
        data_tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: ">= 0"
```

## PII Auto-Classification

```python
import re
from typing import List

PII_PATTERNS = {
    "email":   r"^(email|email_address|user_email|customer_email)$",
    "phone":   r"^(phone|phone_number|mobile|cell)$",
    "name":    r"^(first_name|last_name|full_name|display_name)$",
    "address": r"^(address|street|city|zip|postal_code)$",
    "ssn":     r"^(ssn|social_security|tax_id)$",
    "dob":     r"^(date_of_birth|dob|birth_date)$",
}

def classify_columns(columns: List[str]) -> dict:
    result = {}
    for col in columns:
        col_lower = col.lower()
        for pii_type, pattern in PII_PATTERNS.items():
            if re.match(pattern, col_lower):
                result[col] = {"classification": "PII", "pii_type": pii_type}
                break
        else:
            result[col] = {"classification": "non-PII"}
    return result
```

## Business Glossary Entry Template

```markdown
# Business Glossary: Revenue

**Term:** Revenue
**Owner:** Finance Data Team
**Status:** Approved

## Definition
Total monetary value of completed customer transactions in USD,
net of refunds, in the period the order status changed to 'completed'.

## Calculation
    revenue = SUM(order_total_cents) / 100
    WHERE order_status = 'completed' AND refunded_at IS NULL

## Canonical dataset
warehouse.orders_daily.revenue -- refreshed daily by 09:00 UTC

## What is NOT included
Pending orders, cancelled orders, fully refunded orders.

## Common mistakes
1. Using order_created vs order_completed date
2. Forgetting to divide cents by 100
3. Including pending orders in the filter
```

## Catalog Health SQL

```sql
WITH datasets AS (
  SELECT table_schema, table_name
  FROM information_schema.tables
  WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
),
catalog_meta AS (
  SELECT dataset_name, owner, description, last_updated, quality_score
  FROM data_catalog.datasets
)
SELECT
  COUNT(*)                                                          AS total_datasets,
  ROUND(COUNTIF(c.owner IS NOT NULL) / COUNT(*) * 100, 1)         AS owner_pct,
  ROUND(COUNTIF(LENGTH(c.description) > 20) / COUNT(*) * 100, 1)  AS desc_pct,
  ROUND(COUNTIF(c.quality_score IS NOT NULL) / COUNT(*) * 100, 1) AS quality_pct
FROM datasets d
LEFT JOIN catalog_meta c ON d.table_name = c.dataset_name
```

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Manual documentation only | Always stale | Automate schema and stats ingestion |
| No ownership enforcement | Orphaned datasets proliferate | Ownership is required; gate on it in CI |
| Catalog as compliance theater | Nobody uses it | Make it the entry point for data access requests |
| Ignoring usage metrics | Maintaining unused datasets | Surface usage counts; deprecate zero-query datasets |
| No quality signals | Analysts cannot tell if dataset is trustworthy | Integrate dbt test results and freshness scores |

## Rules

- **Automate metadata ingestion** -- manually maintained catalogs go stale within weeks.
- **Every dataset needs an owner** -- no owner means no accountability; make it a CI gate.
- **Business glossary is the source of truth** -- standardize metric definitions before building dashboards.
- **Surface quality signals** -- a catalog entry without quality information is incomplete.
- **Make the catalog path of least resistance** -- if analysts find data faster without it, they will bypass it.
- **Classify PII at ingestion time** -- automated detection prevents accidental exposure in non-prod.
- **Track freshness against SLAs** -- alert when data is late; freshness promises are part of the contract.
- **Measure catalog health monthly** -- owner coverage, description coverage, and freshness tracking are your KPIs.
- **Deprecate before deleting** -- mark unused datasets with a sunset date before removal.
- **Embed catalog in analyst workflow** -- integrate with BI tools so lineage and docs are one click away.
