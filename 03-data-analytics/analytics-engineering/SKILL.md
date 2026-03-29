---
name: analytics-engineering
description: Apply analytics engineering practices to build reliable, tested, and documented data models. Outputs dbt project structure, model layering, testing strategy, and documentation standards.
argument-hint: [data warehouse, BI tools, team structure, current data quality]
allowed-tools: Read, Write
---

# Analytics Engineering

Analytics engineering applies software engineering best practices (version control, testing, CI/CD) to data transformation work, producing reliable data models that analysts and stakeholders can trust.

## dbt Project Structure

```
dbt_project/
  models/
    staging/       -- Raw source data, minimal transformations
      stg_orders.sql
      stg_customers.sql
    intermediate/  -- Business logic transformations
      int_order_items.sql
    marts/         -- Final tables for consumption
      fct_orders.sql
      dim_customers.sql
  tests/           -- Custom data tests
  macros/          -- Reusable SQL macros
  seeds/           -- Static reference data
```

## Model Layering

**Staging:** One-to-one with sources. Rename columns to standard conventions. Cast types. No business logic.

**Intermediate:** Apply business logic. Join staging models. Not exposed to end users directly.

**Marts (Facts and Dimensions):** Business-oriented, denormalised models ready for BI tools. One row per business entity per grain.

## Testing

```yaml
# schema.yml
models:
  - name: fct_orders
    columns:
      - name: order_id
        tests: [unique, not_null]
      - name: status
        tests:
          - accepted_values:
              values: [confirmed, shipped, delivered, cancelled]
      - name: total_amount
        tests:
          - dbt_expectations.expect_column_values_to_be_between:
              min_value: 0
              max_value: 1000000
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Business logic in BI tool | Cannot test or reuse | Move to dbt models |
| No tests | Silent data quality failures | Tests on every model |
| Raw source tables in reports | Breaks when source changes | Always go through staging layer |
| Models without documentation | Nobody knows what the model means | description required on every model |

## 10 Rules

1. Never expose raw source tables to BI tools — always go through dbt models.
2. Every model has a description and column descriptions.
3. Tests run in CI — failing tests block deployment.
4. Staging models are thin — no business logic, just cleaning.
5. Marts are denormalised for query performance.
6. Model naming convention: stg_, int_, fct_, dim_ prefixes.
7. Source freshness checks — stale data is detected automatically.
8. dbt docs are published and accessible to the whole company.
9. Breaking changes to mart models follow a deprecation process.
10. All SQL transformations in dbt — not in stored procedures or BI tools.

