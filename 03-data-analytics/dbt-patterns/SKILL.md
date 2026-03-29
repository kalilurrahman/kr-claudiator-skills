---
name: dbt-patterns
description: Build production dbt projects with best practices for modelling, testing, documentation, and performance. Outputs project structure, model patterns, macro library, and CI configuration.
argument-hint: [data warehouse, team size, model complexity, existing dbt maturity]
allowed-tools: Read, Write, Bash
---

# dbt Patterns

dbt (data build tool) transforms raw data in the warehouse into analytics-ready models using SQL and Jinja. Production dbt projects need consistent structure, comprehensive testing, materialization strategies, and CI pipelines — not just SQL files.

## Project Structure

```
models/
  staging/          # 1:1 with source tables — rename, retype, dedup
    stg_orders.sql
    stg_customers.sql
    schema.yml        # Source freshness + column tests
  intermediate/     # Complex joins and transformations
    int_orders_with_customers.sql
  marts/            # Business-ready aggregations
    orders/
      fct_orders.sql
      dim_customers.sql
      schema.yml
    finance/
      fct_revenue.sql
macros/
  generate_schema_name.sql
  cents_to_dollars.sql
  surrogate_key.sql
tests/              # Custom generic tests
seeds/              # Static reference data
snapshots/          # SCD Type 2
dbt_project.yml
profiles.yml
```

## Staging Model Pattern

```sql
-- models/staging/stg_orders.sql
-- Staging: rename, retype, dedup only — no business logic

with source as (
    select * from {{ source('postgres', 'orders') }}
),

renamed as (
    select
        -- Keys (consistent naming)
        id                                  as order_id,
        customer_id,
        
        -- Dates (always cast to date/timestamp)
        cast(created_at as timestamp)       as created_at,
        cast(updated_at as timestamp)       as updated_at,
        
        -- Enumerations (normalise to lowercase)
        lower(status)                       as status,
        
        -- Monetary amounts (rename to include unit)
        amount                              as total_amount_cents,
        
        -- Booleans (explicit naming)
        is_test_order,
        
        -- Metadata
        _fivetran_synced                    as _synced_at
    from source
    where _fivetran_deleted is false        -- Exclude soft-deleted rows
),

deduped as (
    -- Dedup: keep most recent version of each order
    select *
    from renamed
    qualify row_number() over (
        partition by order_id
        order by updated_at desc
    ) = 1
)

select * from deduped
```

## Mart Model Pattern

```sql
-- models/marts/orders/fct_orders.sql
-- Facts: one row per business event, grain clearly defined

{{
    config(
        materialized='incremental',
        unique_key='order_id',
        on_schema_change='sync_all_columns',
        indexes=[
            {'columns': ['customer_id'], 'type': 'btree'},
            {'columns': ['order_date'], 'type': 'btree'},
        ]
    )
}}

with orders as (
    select * from {{ ref('stg_orders') }}
    {% if is_incremental() %}
    where updated_at > (select max(updated_at) from {{ this }})
    {% endif %}
),

customers as (
    select * from {{ ref('dim_customers') }}
),

final as (
    select
        o.order_id,
        o.customer_id,
        c.customer_tier,
        c.acquisition_channel,
        o.status,
        date(o.created_at)                  as order_date,
        o.total_amount_cents,
        {{ cents_to_dollars('o.total_amount_cents') }} as total_amount_usd,
        o.created_at,
        o.updated_at
    from orders o
    left join customers c using (customer_id)
    where o.status not in ('cancelled', 'test')
)

select * from final
```

## Reusable Macros

```sql
-- macros/cents_to_dollars.sql
{% macro cents_to_dollars(column_name, precision=2) %}
    round({{ column_name }} / 100.0, {{ precision }})
{% endmacro %}

-- macros/surrogate_key.sql
{% macro surrogate_key(field_list) %}
    {{ dbt_utils.generate_surrogate_key(field_list) }}
{% endmacro %}

-- macros/get_column_values.sql
{% macro get_active_statuses(table_ref) %}
    {% set query %}
        select distinct status from {{ table_ref }}
        where status not in ('test', 'deleted')
    {% endset %}
    {% set results = run_query(query) %}
    {% if execute %}
        {% set values = results.columns[0].values() %}
        {{ return(values) }}
    {% endif %}
{% endmacro %}
```

## Schema Testing

```yaml
# models/marts/orders/schema.yml
version: 2

models:
  - name: fct_orders
    description: "One row per confirmed order. Source of truth for order analytics."
    meta:
      owner: "@data-team"
      domain: "orders"
    
    config:
      tags: ["finance", "critical"]
    
    columns:
      - name: order_id
        description: "UUID. Primary key."
        tests:
          - unique
          - not_null
      
      - name: customer_id
        tests:
          - not_null
          - relationships:
              to: ref('dim_customers')
              field: customer_id
      
      - name: status
        tests:
          - accepted_values:
              values: ['pending', 'paid', 'shipped', 'delivered']
      
      - name: total_amount_usd
        tests:
          - not_null
          - dbt_expectations.expect_column_values_to_be_between:
              min_value: 0
              max_value: 100000
```

## CI Configuration

```yaml
# .github/workflows/dbt-ci.yml
name: dbt CI

on:
  pull_request:
    paths: ['models/**', 'macros/**', 'tests/**', 'dbt_project.yml']

jobs:
  dbt-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      
      - run: pip install dbt-bigquery dbt-utils dbt-expectations
      
      - name: dbt deps
        run: dbt deps
        
      - name: dbt compile (syntax check)
        run: dbt compile --profiles-dir .dbt --target ci
      
      - name: dbt build (run + test affected models)
        run: |
          dbt build             --profiles-dir .dbt             --target ci             --select state:modified+             --state ./prod-artifacts             --full-refresh
        env:
          DBT_BIGQUERY_PROJECT: ${{ secrets.CI_BQ_PROJECT }}
          DBT_BIGQUERY_KEYFILE: ${{ secrets.CI_BQ_KEYFILE }}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Business logic in staging** | Hard to reuse; mixed concerns | Staging = rename/retype only; logic in marts |
| **No incremental strategy** | Full refresh on 1B-row table takes hours | Incremental with unique_key for large tables |
| **Tests only on PKs** | Quality issues in measures not caught | Test value ranges, relationships, accepted_values |
| **Undocumented models** | Nobody knows what a model means | schema.yml with description on every column |
| **Hardcoded date filters** | Break when environment changes | Use `is_incremental()` macro properly |

## 10 Rules

1. Staging models rename and type only — no business logic.
2. Unique key + incremental materialization for tables with >10M rows.
3. Every model has a schema.yml with description and column tests.
4. ref() and source() only — never raw table names in models.
5. Macros for repeated logic — don't copy-paste SQL transformations.
6. CI runs on affected models only (`state:modified+`) — not the full DAG.
7. Tag models by domain and criticality — enables selective testing and documentation.
8. Surrogate keys for dimensional models — never use natural keys as dimension PKs.
9. Document the grain explicitly — what does one row represent?
10. Source freshness tests in CI — stale source data should block model runs.
