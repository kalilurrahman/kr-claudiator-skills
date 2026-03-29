---
name: data-virtualization
description: Implement data virtualisation to query distributed data sources without moving data. Outputs virtual layer design, query federation strategy, performance optimisation, and governance approach.
argument-hint: [data sources, query latency requirements, data volume, existing data infrastructure]
allowed-tools: Read, Write
---

# Data Virtualization

Data virtualisation presents a unified logical view of data from multiple heterogeneous sources — without physically moving or replicating the data. Instead of ETL pipelines that copy data into a central warehouse, virtual layers query data in-place. This reduces latency for time-sensitive data and eliminates the complexity of replication pipelines.

## When to Use Data Virtualization

```
USE VIRTUALIZATION when:
  ✓ Real-time or near-real-time data needed (can't wait for ETL)
  ✓ Data cannot be replicated (regulatory: GDPR data residency)
  ✓ Source system data used only occasionally (not worth ETL investment)
  ✓ Proof-of-concept before building full pipeline
  ✓ Federated query across multiple data warehouses

USE ETL/ELT instead when:
  ✓ Heavy transformations needed (virtualisation adds latency)
  ✓ Offline analytics (source systems unavailable 24/7)
  ✓ Historical analysis requires data retention beyond source
  ✓ Query performance is critical (virtualisation adds overhead)
  ✓ Complex ML feature computation
```

## Query Federation with Trino

```sql
-- Trino (formerly PrestoSQL) — federated SQL across any data source
-- No data moved; queries run in-place at each source

-- Example: Join Postgres (production) with Snowflake (warehouse) and S3 (raw files)
SELECT
    p.customer_id,
    p.email,                           -- From PostgreSQL (live production)
    s.total_orders,                    -- From Snowflake (analytics warehouse)
    s.lifetime_value,
    h.page_view_count                  -- From Hive (S3 raw files)
FROM postgresql.production.customers p
JOIN snowflake.analytics.customer_metrics s
    ON p.customer_id = s.customer_id
JOIN hive.raw_events.page_views h
    ON p.customer_id = h.user_id
WHERE p.created_at > DATE '2024-01-01'
  AND s.total_orders > 5;
```

```yaml
# Trino catalog configuration
# /etc/trino/catalog/postgresql.properties
connector.name=postgresql
connection-url=jdbc:postgresql://prod-db:5432/production
connection-user=trino_reader
connection-password=${ENV:POSTGRES_PASSWORD}

# /etc/trino/catalog/snowflake.properties
connector.name=snowflake
connection-url=jdbc:snowflake://account.snowflakecomputing.com/
connection-user=trino_reader
connection-password=${ENV:SNOWFLAKE_PASSWORD}
snowflake.warehouse=ANALYTICS_WH
snowflake.database=ANALYTICS

# /etc/trino/catalog/hive.properties
connector.name=hive
hive.metastore.uri=thrift://hive-metastore:9083
hive.s3.aws-access-key=${ENV:AWS_ACCESS_KEY}
hive.s3.aws-secret-key=${ENV:AWS_SECRET_KEY}
```

## dbt + Virtualisation

```sql
-- dbt model that queries across sources without moving data
-- Uses Trino as the execution engine

-- models/customer_360.sql
{{
  config(
    materialized='view',   -- Virtual; not materialised
    schema='virtual_layer'
  )
}}

WITH live_customers AS (
    -- Real-time from PostgreSQL via Trino federation
    SELECT
        customer_id,
        email,
        plan_type,
        created_at
    FROM {{ source('postgresql', 'customers') }}
    WHERE created_at >= CURRENT_DATE - INTERVAL '90' DAY
),

analytics_enrichment AS (
    -- Pre-aggregated from Snowflake warehouse
    SELECT
        customer_id,
        total_orders,
        lifetime_value,
        last_order_date
    FROM {{ source('snowflake', 'customer_metrics') }}
)

SELECT
    lc.customer_id,
    lc.email,
    lc.plan_type,
    ae.total_orders,
    ae.lifetime_value,
    ae.last_order_date,
    -- Computed at query time (not stored)
    CASE
        WHEN ae.last_order_date > CURRENT_DATE - INTERVAL '30' DAY THEN 'active'
        WHEN ae.last_order_date > CURRENT_DATE - INTERVAL '90' DAY THEN 'at_risk'
        ELSE 'churned'
    END AS customer_status
FROM live_customers lc
LEFT JOIN analytics_enrichment ae USING (customer_id)
```

## Performance Optimisation

```sql
-- Virtualisation adds latency — optimise strategically

-- 1. Predicate pushdown: push filters to source systems
-- Trino automatically pushes WHERE clauses to source connectors
-- Verify with EXPLAIN:
EXPLAIN
SELECT * FROM postgresql.production.orders
WHERE created_at > DATE '2024-01-01'
  AND status = 'paid';
-- Should show: ScanFilterProject[table=postgresql, filter=...]

-- 2. Materialise hot virtual views
-- For frequently-queried virtual tables, materialise in DWH
CREATE TABLE snowflake.analytics.customer_360_snapshot AS
SELECT * FROM trino_virtual_layer.customer_360
WHERE last_order_date >= CURRENT_DATE - INTERVAL '30' DAY;

-- Schedule refresh: every 4 hours via Airflow/Prefect

-- 3. Columnar pruning: select only needed columns
-- Never SELECT * from virtualised sources
SELECT customer_id, email, plan_type  -- Not SELECT *
FROM postgresql.production.customers;

-- 4. Partition pruning: always include partition key in WHERE
SELECT *
FROM hive.events.page_views
WHERE dt = '2024-03-15'  -- dt is the S3 partition key
  AND event_type = 'purchase';
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Virtualising everything** | High latency; source systems overloaded | Virtualise for real-time; ETL for historical/heavy analytics |
| **No query limits** | Expensive federated queries cause source outages | Query timeout; row limits; connection pooling |
| **SELECT * on virtual tables** | Fetches all columns from source | Always specify required columns |
| **Joining large virtual tables** | Massive cross-source data movement | Pre-aggregate at source; use virtual layer for final join |
| **No governance on virtual layer** | PII in virtual views accessible to all | Apply column-level security at virtual layer |

## 10 Rules

1. Data virtualisation is for real-time access and federation — not for replacing ETL at scale.
2. Always push predicates (WHERE clauses) to source systems — verify with EXPLAIN.
3. Never SELECT * from a virtual table — specify only required columns.
4. Materialise frequently-queried virtual views for performance — refreshed on a schedule.
5. Set query timeouts and row limits — runaway federated queries can take down source systems.
6. Governance applies at the virtual layer — column-level security filters PII before users query.
7. Source systems must be designed for additional read load — virtualisation adds queries.
8. Trino/Presto is the most mature open-source federation engine — preferred over building custom.
9. Latency budgets: virtual queries take 10-100x longer than warehouse queries — plan accordingly.
10. Test query plans with EXPLAIN before production deployment — unexpected full scans are common.
