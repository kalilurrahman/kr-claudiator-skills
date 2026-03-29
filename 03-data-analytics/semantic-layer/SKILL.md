---
name: semantic-layer
description: Design a semantic layer that provides a consistent business metric definitions across all analytics tools. Outputs metric definitions, dbt metrics setup, and BI tool integration.
argument-hint: [BI tools, metric complexity, team structure, existing data models]
allowed-tools: Read, Write
---

# Semantic Layer

A semantic layer sits between the data warehouse and BI tools, defining business metrics once and making them consistent across every tool that queries them.

## What Is a Semantic Layer

Without a semantic layer: different analysts define "revenue" differently in different tools, leading to conflicting reports. The semantic layer defines "revenue" once; every tool uses that definition.

```
Without:  Looker query → own SQL → different answer
          Tableau query → own SQL → different answer
          Ad-hoc query  → own SQL → different answer

With:     Looker query → Semantic Layer → one answer
          Tableau query → Semantic Layer → same answer
          Ad-hoc query  → Semantic Layer → same answer
```

## dbt Metrics (MetricFlow)

```yaml
# models/metrics/revenue.yml
metrics:
  - name: monthly_recurring_revenue
    label: MRR
    description: Monthly recurring revenue from active subscriptions
    model: ref('fct_subscriptions')
    calculation_method: sum
    expression: mrr_amount
    timestamp: subscription_date
    time_grains: [month, quarter, year]
    dimensions:
      - plan_type
      - customer_segment
      - region
    filters:
      - field: is_active
        operator: '='
        value: 'true'
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Metric defined in every BI tool separately | Conflicting numbers | Define once in semantic layer |
| No versioning | Breaking changes silent | Version metrics; deprecation process |
| Business logic in dashboards | Hard to maintain | Push logic to semantic layer |

## 10 Rules

1. Define each metric once — consumers read, they do not define.
2. Metrics have owners who approve changes.
3. Version metrics — changes go through a deprecation process.
4. Test metric calculations — wrong numbers are worse than no numbers.
5. All BI tools connect through the semantic layer.
6. Document each metric: definition, formula, data source, owner.
7. Metric names match business terminology exactly.
8. Breaking changes require consumer migration support.
9. Audit metric usage — remove unused metrics.
10. Semantic layer is tested in CI like any other code.

