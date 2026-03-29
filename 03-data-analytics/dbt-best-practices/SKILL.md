---
name: dbt-best-practices
description: Apply dbt best practices for scalable, maintainable analytics engineering. Outputs project structure, naming conventions, testing strategy, documentation standards, and CI/CD pipeline.
argument-hint: [data warehouse, team size, existing SQL complexity, testing coverage]
allowed-tools: Read, Write, Bash
---

# dbt Best Practices

dbt (data build tool) transforms raw data into analytics-ready models using SQL. Best practices ensure models are reliable, tested, documented, and maintainable as the team and data volume grows. The biggest anti-pattern is treating dbt like a SQL runner — it is a software engineering tool for data.

## Project Structure

```
dbt_project/
├── models/
│   ├── staging/          # Raw source cleaning: 1 model per source table
│   │   ├── _sources.yml  # Source definitions
│   │   ├── _stg_models.yml
│   │   └── stg_orders.sql
│   ├── intermediate/     # Business logic that doesn't belong in marts
│   │   └── int_order_items_pivoted.sql
│   └── marts/            # Business-facing: joins, aggregations, final tables
│       ├── core/
│       │   ├── _core_models.yml
│       │   └── fct_orders.sql
│       └── finance/
│           └── fct_revenue_daily.sql
├── seeds/                # Static reference data (CSVs)
├── snapshots/            # SCD Type 2
├── analyses/             # Ad-hoc queries (not materialised)
├── macros/               # Reusable Jinja functions
├── tests/                # Custom test definitions
└── dbt_project.yml
```

## Naming Conventions

```sql
-- Staging models: stg_{source}__{entity}
-- One source table → one staging model, no joins
stg_postgres__orders.sql
stg_stripe__charges.sql
stg_salesforce__accounts.sql

-- Intermediate models: int_{description}
-- Complex transformations used by multiple marts
int_orders_with_customer_info.sql
int_sessions_sessionised.sql

-- Fact tables: fct_{business_process}
fct_orders.sql          -- One row per order
fct_events.sql          -- One row per event
fct_order_items.sql     -- One row per order line

-- Dimension tables: dim_{entity}
dim_customers.sql
dim_products.sql
dim_date.sql

-- Summary tables: {agg_period}_{entity}
daily_revenue.sql
monthly_active_users.sql
```

## Staging Model Pattern

```sql
-- models/staging/stg_postgres__orders.sql
-- Rule: Clean and rename only. No joins. No business logic.
WITH source AS (
    SELECT * FROM {{ source('postgres', 'orders') }}
),

renamed AS (
    SELECT
        -- IDs
        id                          AS order_id,
        customer_id,
        
        -- Timestamps: always convert to UTC, standardise names
        created_at                  AS order_created_at,
        updated_at                  AS order_updated_at,
        confirmed_at,
        
        -- Measures: convert to standard units
        total_amount_cents / 100.0  AS order_total_usd,  -- cents → dollars
        
        -- Dimensions
        LOWER(status)               AS order_status,      -- normalise case
        COALESCE(currency, 'USD')   AS currency,
        
        -- Remove: internal_notes, system_columns, etc.
        
        -- Metadata
        _fivetran_synced            AS source_synced_at
    FROM source
)

SELECT * FROM renamed
```

## Testing Standards

```yaml
# models/marts/core/_core_models.yml
version: 2

models:
  - name: fct_orders
    description: "One row per order. Source of truth for all order reporting."
    meta:
      owner: analytics-engineering
      freshness_sla: 4h
    
    columns:
      - name: order_id
        description: "Unique order identifier"
        tests:
          - unique
          - not_null
      
      - name: customer_id
        tests:
          - not_null
          - relationships:
              to: ref('dim_customers')
              field: customer_id
      
      - name: order_status
        tests:
          - not_null
          - accepted_values:
              values: ['draft', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded']
      
      - name: order_total_usd
        tests:
          - not_null
          - dbt_expectations.expect_column_values_to_be_between:
              min_value: 0
              max_value: 100000
    
    tests:
      # Row count should never drop more than 5% day-over-day
      - dbt_utils.recency:
          datepart: hour
          field: order_created_at
          interval: 12
      
      # Reconciliation: total revenue should match source
      - dbt_utils.expression_is_true:
          expression: "order_total_usd >= 0"
```

## Materialisation Strategy

```yaml
# dbt_project.yml
models:
  dbt_project:
    staging:
      +materialized: view       # Staging: views (fast to build, always fresh)
      +tags: ["staging"]
    
    intermediate:
      +materialized: ephemeral  # Intermediate: inline (no table, just CTE)
    
    marts:
      +materialized: table      # Marts: tables (fast query performance)
      +tags: ["marts"]
      
      core:
        fct_orders:
          +materialized: incremental   # Large fact tables: incremental
          +unique_key: order_id
```

## Incremental Model Pattern

```sql
-- models/marts/core/fct_orders.sql
{{
  config(
    materialized='incremental',
    unique_key='order_id',
    on_schema_change='append_new_columns'
  )
}}

WITH orders AS (
    SELECT * FROM {{ ref('stg_postgres__orders') }}
    {% if is_incremental() %}
    -- Only process records updated since last run
    WHERE order_updated_at > (SELECT MAX(order_updated_at) FROM {{ this }})
    {% endif %}
)

SELECT
    order_id,
    customer_id,
    order_status,
    order_total_usd,
    order_created_at,
    order_updated_at
FROM orders
```

## CI/CD Pipeline

```yaml
# .github/workflows/dbt-ci.yml
name: dbt CI

on:
  pull_request:
    paths: ['models/**', 'tests/**', 'macros/**']

jobs:
  dbt-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install dbt
        run: pip install dbt-bigquery==1.7.*
      
      - name: dbt deps
        run: dbt deps
      
      - name: dbt build (affected models + tests)
        run: |
          # Get changed models from git diff
          CHANGED=$(git diff --name-only origin/main | grep 'models/' | sed 's/models\///' | sed 's/.sql//')
          
          # Build changed models and their downstream dependencies
          dbt build --select ${CHANGED// /,}+
        env:
          DBT_PROFILES_DIR: .
          BQ_PROJECT: ${{ secrets.BQ_CI_PROJECT }}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Business logic in staging** | Staging models diverge from source; hard to maintain | Staging cleans and renames only — no joins, no aggregations |
| **No tests** | Silent data quality failures reach dashboards | At minimum: unique + not_null on all primary keys |
| **Giant SQL files** | Unmaintainable; hard to debug | Break into smaller models; use intermediate layer |
| **Hardcoded dates** | Models break without maintenance | Use `{{ dbt_utils.date_trunc() }}` and relative dates |
| **No documentation** | New joiners can't understand the models | Every model has a description; every column has a definition |

## 10 Rules

1. Staging models are 1:1 with source tables — clean and rename, never join.
2. Every primary key has `unique` and `not_null` tests — no exceptions.
3. Business logic belongs in marts, not staging.
4. Incremental models require a `unique_key` — otherwise duplicates accumulate.
5. `ref()` and `source()` everywhere — never hardcode schema.table.
6. Document what each model represents in plain English — not just what columns mean.
7. CI runs dbt build (not just compile) on changed models — catch test failures before merge.
8. Fact tables are immutable facts — never delete or update rows; add corrections as new rows.
9. Materialisation strategy based on query frequency and size — views for small/fresh, tables for large/queried.
10. The staging → intermediate → marts layer structure scales with team size — maintain it from day one.
