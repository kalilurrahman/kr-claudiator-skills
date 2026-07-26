---
name: data-governance
description: Establish data governance frameworks covering ownership, quality standards, access control, and compliance. Outputs governance policy, data stewardship model, classification scheme, and audit procedures.
argument-hint: [regulatory requirements, data sensitivity, team size, existing data catalog]
allowed-tools: Read, Write
---

# Data Governance

Data governance defines who owns data, who can access it, what quality standards apply, and how it is used. Without governance, data quality degrades, compliance exposure grows, and analytical work produces conflicting numbers. Governance is not bureaucracy — it is the infrastructure that makes data trustworthy.

## Process

1. **Define the governance model.** Centralised (one team owns all standards), federated (domain teams own their data with central standards), or data mesh (domains fully own). Choose based on org size and maturity.
2. **Classify data.** Sensitivity tiers: public, internal, confidential, restricted (PII, PCI, PHI). Different controls per tier.
3. **Assign ownership.** Data domain owners (accountable) and data stewards (operational). Every dataset has a named owner.
4. **Define quality standards.** Completeness, accuracy, timeliness, consistency targets per domain.
5. **Implement access control.** Role-based access by classification tier. No blanket access.
6. **Set up the data catalog.** Searchable inventory of all data assets with owners, schemas, and lineage.
7. **Establish audit procedures.** Who accessed what, when. Compliance reporting automation.
8. **Run data quality checks.** Automated quality gates in pipelines. SLA for data freshness.

## Data Classification Scheme

```markdown
## Classification Tiers

### RESTRICTED (Tier 1)
Definition: Data with legal, regulatory, or severe business risk if exposed.
Examples: PII (name + email + DOB), financial account numbers, health records, credentials, encryption keys.
Controls:
  - Encryption at rest (AES-256) and in transit (TLS 1.2+)
  - Access requires approval + MFA + audit log
  - Minimum access principle — role-specific, time-limited
  - No export to personal devices
  - Anonymise before use in non-production
  - Retention: as per regulation (GDPR Article 5, HIPAA, PCI DSS)

### CONFIDENTIAL (Tier 2)
Definition: Internal business data that could harm competitive position or operations if disclosed.
Examples: Revenue data, customer lists (non-PII), product roadmaps, employee performance data.
Controls:
  - Access restricted to employees on need-to-know basis
  - No sharing with third parties without NDA + DPA
  - Audit log on bulk exports

### INTERNAL (Tier 3)
Definition: General business operational data — not intended for public.
Examples: Internal metrics, system logs (non-PII), process documentation.
Controls:
  - Employee access by default
  - External sharing requires approval

### PUBLIC (Tier 4)
Definition: Approved for external publication.
Examples: Press releases, published reports, open datasets.
Controls:
  - Review before publication
  - No controls post-publication
```

## Governance Policy Template

```markdown
# Data Governance Policy v2.1

**Effective:** 2024-01-01 | **Owner:** Chief Data Officer | **Review:** Annual

## 1. Data Ownership

Every data domain has:
- **Data Domain Owner** (executive): accountable for data quality and compliance
- **Data Steward** (operational): day-to-day management, quality monitoring, access requests

| Domain | Domain Owner | Data Steward | Slack | Catalog |
|--------|-------------|--------------|-------|---------|
| Customer | VP Product | @jane-data | #data-customer | link |
| Orders | VP Engineering | @bob-data | #data-orders | link |
| Finance | CFO | @finance-data | #data-finance | link |

## 2. Data Quality Standards

| Dimension | Definition | Target | Measurement |
|-----------|-----------|--------|-------------|
| Completeness | % of required fields populated | >99% | Daily dbt test |
| Accuracy | % of records matching source of truth | >99.5% | Weekly reconciliation |
| Timeliness | Data age at time of reporting | <4 hours for ops; <24h for analytics | Pipeline monitoring |
| Consistency | Agreement across systems | 100% for financial data | Cross-system checks |
| Uniqueness | No unexpected duplicates | 0 duplicate PKs | dbt uniqueness test |

## 3. Access Control

Access request process:
1. Submit request via ServiceNow (data.access.request)
2. Data steward reviews (SLA: 2 business days)
3. Domain owner approves for Tier 1/2
4. Access provisioned; expires in 90 days (Tier 1) or 1 year (Tier 2)
5. Access reviewed quarterly; unused access revoked

## 4. Retention and Deletion

| Classification | Retention | Deletion Method |
|---------------|-----------|-----------------|
| Restricted (PII) | GDPR: until purpose fulfilled + 30 days | Secure overwrite, verified |
| Confidential | 7 years (financial) | Standard deletion |
| Internal | 3 years | Standard deletion |
| Public | Indefinite | N/A |
```

## dbt Data Quality Tests

```yaml
# models/schema.yml — data quality tests as code
version: 2

models:
  - name: customers
    description: "Customer master data — Tier 1 (PII)"
    meta:
      owner: "@jane-data"
      domain: "Customer"
      classification: "restricted"
      pii_fields: ["email", "full_name", "date_of_birth", "phone"]
    columns:
      - name: customer_id
        description: "Unique customer identifier"
        tests:
          - unique
          - not_null
      - name: email
        tests:
          - not_null
          - unique
          - dbt_expectations.expect_column_values_to_match_regex:
              regex: '^[^@]+@[^@]+\.[^@]+$'
      - name: created_at
        tests:
          - not_null
          - dbt_expectations.expect_column_values_to_be_between:
              min_value: "'2020-01-01'"
              max_value: "'{{ run_started_at }}'"

  - name: orders
    meta:
      owner: "@bob-data"
      domain: "Orders"
      classification: "confidential"
      sla_freshness_hours: 4
    tests:
      - dbt_utils.expression_is_true:
          expression: "total_amount >= 0"
          name: "order_total_non_negative"
      - dbt_utils.expression_is_true:
          expression: "status in ('draft', 'pending', 'paid', 'shipped', 'delivered', 'cancelled')"
          name: "valid_order_status"
    columns:
      - name: order_id
        tests: [unique, not_null]
      - name: customer_id
        tests:
          - not_null
          - relationships:
              to: ref('customers')
              field: customer_id
```

## Data Catalog Entry Template

```yaml
# Data catalog entry (e.g. for DataHub, Alation, Collibra)
dataset:
  name: "orders.fact_orders"
  description: "Order transactions — one row per order. Source of truth for all order reporting."
  classification: confidential
  domain: Orders
  owner: "@bob-data"
  steward: "@bob-data"
  
  schema:
    - name: order_id        type: STRING    pii: false  description: "UUID"
    - name: customer_id     type: STRING    pii: false  description: "FK to customers"
    - name: total_amount    type: DECIMAL   pii: false  description: "Order total in USD cents"
    - name: status          type: STRING    pii: false  description: "Order lifecycle state"
    - name: created_at      type: TIMESTAMP pii: false
  
  lineage:
    upstream:
      - source: "postgres.orders.orders"
        transform: "dbt model: staging/stg_orders.sql"
    downstream:
      - "reporting.revenue_dashboard"
      - "ml.churn_model_features"
  
  quality:
    freshness_sla: 4h
    completeness_target: 99.5%
    last_quality_check: "2024-03-15T08:00:00Z"
    quality_score: 99.8%
  
  access:
    tier: confidential
    approved_roles: [analyst, data-scientist, finance-analyst]
    request_link: "https://data.company.com/access/orders"
```

## Audit and Compliance Automation

```python
# BigQuery audit log query — who accessed PII data
from google.cloud import bigquery

client = bigquery.Client()

audit_query = """
SELECT
    protopayload_auditlog.authenticationInfo.principalEmail AS user,
    resource.labels.dataset_id AS dataset,
    protopayload_auditlog.servicedata_v1_bigquery.jobCompletedEvent.job.jobConfiguration.query.query AS query_text,
    timestamp
FROM `project.dataset.cloudaudit_googleapis_com_data_access_*`
WHERE
    resource.labels.dataset_id = 'restricted_data'
    AND timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
ORDER BY timestamp DESC
LIMIT 1000;
"""

results = client.query(audit_query).result()
# Export to compliance reporting system
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No data owner** | Orphaned data — no one responsible for quality or access | Every dataset has a named owner, not a team |
| **Blanket access** | Analysts have access to all data including PII | Role-based access by classification |
| **Manual quality checks** | Checks skipped under time pressure | Automated quality tests in pipeline; block on failure |
| **Governance as pure documentation** | Policies exist but are not enforced | Implement controls in tooling; policy as code |
| **No lineage tracking** | Breaking changes upstream silently break downstream | Automated lineage from pipeline metadata |
| **GDPR compliance as one-time project** | Data practices drift over time | Continuous compliance monitoring |
| **Centralised bottleneck** | One team gates all data access | Federated ownership with central standards |

## 10 Rules

1. Every dataset has a named owner — a person, not a team.
2. Classify before building — don't retrofit classification onto a mature data platform.
3. Access control is enforced by tooling, not enforced by honour system.
4. Quality standards are measurable and automated — "good quality" is not a standard.
5. Data lineage is tracked automatically — manual lineage documentation is always wrong.
6. PII is never copied to non-production environments without anonymisation.
7. Retention policies are enforced by automation — scheduled deletion jobs, not manual cleanup.
8. Governance policies have owners and review dates — ungoverned governance documents are not governance.
9. Right to erasure (GDPR Article 17) requires knowing where every piece of PII lives — lineage makes this possible.
10. Federated governance scales; centralised governance becomes a bottleneck — enable domain ownership with central guardrails.
