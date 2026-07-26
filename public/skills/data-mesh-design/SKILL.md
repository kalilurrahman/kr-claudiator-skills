---
name: data-mesh-design
description: Design a data mesh architecture with domain ownership, data products, and federated governance. Outputs domain decomposition, data product contracts, self-serve platform requirements, and migration plan.
argument-hint: [number of domains, current data platform, team structure, regulatory requirements]
allowed-tools: Read, Write
---

# Data Mesh Design

Data mesh is a sociotechnical approach where domain teams own and serve their data as products, governed by federated standards and enabled by a self-serve data platform. It solves the centralised data team bottleneck that emerges in large organisations with many data-producing domains.

**Use data mesh when:** You have 5+ distinct business domains, a central data team is a bottleneck, domains have mature engineering teams, and data ownership is contested or unclear.

**Don't use data mesh when:** Small organisation (<100 engineers), single product, data team is not yet a bottleneck, or engineering maturity is low.

## Four Principles

```
1. DOMAIN OWNERSHIP
   Data is owned by the domain that generates it.
   The Orders team owns and serves orders data as a product.
   Not: central data team ETL-ing from Orders DB.

2. DATA AS A PRODUCT
   Each domain publishes data products with:
   - SLAs (freshness, availability, quality)
   - Versioned schema contracts
   - Self-service discovery and access
   - Ownership and support contact

3. SELF-SERVE DATA PLATFORM
   A platform team provides infrastructure that makes it easy
   for domains to build and serve data products.
   Domains should not need data engineering expertise to publish.

4. FEDERATED COMPUTATIONAL GOVERNANCE
   Central standards (classification, access control, quality)
   enforced by automated policy — not central approval workflows.
```

## Domain Decomposition

```markdown
## Domain Mapping — E-Commerce Platform

Step 1: Identify analytical data producing domains
  - Customer domain: user profiles, preferences, segments
  - Orders domain: order transactions, fulfilment, returns
  - Inventory domain: stock levels, SKUs, replenishment
  - Marketing domain: campaigns, attribution, spend
  - Finance domain: revenue, refunds, reconciliation

Step 2: Identify data consumer domains  
  - Recommendations: consumes customer + orders
  - Finance reporting: consumes orders + finance
  - Personalisation: consumes customer + marketing
  - Operations: consumes orders + inventory

Step 3: Identify cross-cutting concerns
  - Customer identity (shared across all domains)
  - Time dimensions (shared across all domains)
  → These become shared platform data products

Step 4: Map ownership
  Orders domain → Orders engineering team
  Customer domain → Growth engineering team
  Inventory → Supply chain engineering team
```

## Data Product Contract

```yaml
# data-product.yaml — lives in domain repo
apiVersion: dataproduct/v1
kind: DataProduct
metadata:
  name: orders.daily-order-summary
  version: 2.1.0
  owner: orders-engineering@company.com
  steward: analytics-orders@company.com
  domain: orders
  slack: "#data-orders"

description: |
  Daily aggregated order metrics per customer.
  One row per customer_id per calendar day.
  Source of truth for order-level analytics.

classification: confidential

sla:
  freshness: "Available by 06:00 UTC for previous day"
  availability: "99.5% monthly uptime"
  quality:
    completeness: ">99%"
    accuracy: ">99.5%"
  support_hours: "Mon-Fri 09:00-18:00 UTC"
  incident_sla: "P1: 1h | P2: 4h | P3: next business day"

schema:
  format: delta-parquet
  location: "s3://company-data-mesh/orders/daily-order-summary/v2/"
  columns:
    - name: customer_id     type: STRING    pii: false  nullable: false
    - name: order_date      type: DATE      pii: false  nullable: false
    - name: order_count     type: INTEGER   pii: false
    - name: total_revenue   type: DECIMAL   pii: false  description: "USD"
    - name: avg_order_value type: DECIMAL   pii: false

lineage:
  upstream:
    - "postgres://orders-db/orders.orders (CDC via Debezium)"
    - "postgres://orders-db/orders.order_items"
  downstream_known:
    - "finance.revenue-reporting"
    - "ml.customer-ltv-model"

access:
  request_url: "https://data.company.com/products/orders/daily-order-summary"
  approved_roles: [analyst, data-scientist]
  
compatibility:
  breaking_change_policy: "6 week deprecation notice; consumer migration support"
  changelog_url: "https://data.company.com/products/orders/daily-order-summary/changelog"
```

## Self-Serve Platform Requirements

```markdown
## Platform Capabilities (provided by Platform team, not domain teams)

### Storage
  - Object storage (S3/GCS) with standard folder structure
  - Automatic lifecycle policies (TTL by classification)
  - Encryption at rest by default

### Compute
  - Spark cluster on-demand (domain teams submit jobs)
  - Scheduled job runner (no infra management by domains)
  - Serverless query (Athena/BigQuery) for ad-hoc

### Cataloguing
  - Auto-registration from data-product.yaml
  - Schema discovery and lineage tracking
  - Search and discovery UI

### Access Control
  - Policy-as-code enforcement of classification tiers
  - Self-service access request workflow (no central approval bottleneck)
  - Automatic RBAC provisioning on approval

### Observability
  - Data product health dashboard
  - Freshness monitoring and alerting
  - Quality score tracking over time
  - Consumer usage metrics

### Governance Automation
  - CI/CD validation of data-product.yaml schema
  - Automated PII scanning on new products
  - Compliance report generation
```

## Migration Plan from Centralised to Mesh

```markdown
## Phase 1: Foundation (months 1-3)
  - [ ] Deploy data catalog (DataHub or Collibra)
  - [ ] Define data product contract schema (YAML above)
  - [ ] Identify 2-3 pilot domains with willing teams
  - [ ] Platform team builds: storage standards, auto-registration, basic access control

## Phase 2: Pilot (months 3-6)
  - [ ] Pilot domains publish first data products
  - [ ] Platform team fills gaps identified by pilot domains
  - [ ] Define SLA monitoring and alerting
  - [ ] Migrate 2-3 central pipelines to domain ownership

## Phase 3: Rollout (months 6-12)
  - [ ] All domains onboarded (one per sprint)
  - [ ] Central ETL team transitions to platform team
  - [ ] Consumer self-service access fully automated
  - [ ] Governance automation deployed

## Phase 4: Optimise (ongoing)
  - [ ] Deprecate legacy central pipelines
  - [ ] Data product quality scoring published
  - [ ] Cross-domain join patterns standardised
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Data mesh without platform** | Domains re-invent infrastructure; inconsistency | Platform team provides self-serve before domains onboard |
| **Governance by committee** | Approval bottleneck replaces ETL bottleneck | Policy as code; automated enforcement |
| **Domain silos with no cross-domain joins** | Can't answer questions spanning domains | Shared product layer; standard join keys (customer_id) |
| **Big bang migration** | All domains at once overwhelms platform team | Phased migration: pilot → rollout |
| **No data product versioning** | Breaking changes silently break consumers | Versioned contracts with deprecation policy |
| **Platform team as gatekeeper** | Returns to centralised bottleneck | Platform enables; domains decide |
| **Skipping consumer feedback** | Products built for producers, not consumers | Mandate SLA tracking; consumer NPS on data products |

## 10 Rules

1. Domains own the data they generate — centrally managed pipelines are a smell.
2. Data products have SLAs, owners, and versioned contracts — not just tables in a warehouse.
3. The platform enables; it never owns domain data.
4. Federated governance means automated policy enforcement — not consensus meetings.
5. Start with 2-3 pilot domains — don't big-bang migrate everything.
6. Consumer discoverability is non-negotiable — a data product no one can find is not a product.
7. Breaking changes require deprecation notice — treat data consumers like API clients.
8. Freshness SLAs are as important as availability SLAs — stale data causes wrong decisions.
9. Shared join keys (customer_id, product_id) must be standardised across all domains.
10. Measure data mesh success by reduction in time-to-insight, not number of data products published.
