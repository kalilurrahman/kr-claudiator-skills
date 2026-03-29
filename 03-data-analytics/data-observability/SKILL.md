---
name: data-observability
description: Implement data observability to detect, alert on, and resolve data quality issues in pipelines and warehouses. Outputs freshness monitoring, anomaly detection, lineage tracking, and incident playbooks.
argument-hint: [data stack, pipeline complexity, SLA requirements, team size]
allowed-tools: Read, Write
---

# Data Observability

Data observability provides visibility into the health of your data pipelines and warehouse — detecting issues before downstream users and reports are affected.

## Five Pillars of Data Observability

1. **Freshness** — Is the data up to date? Was it updated when expected?
2. **Volume** — Is there the expected amount of data? Sudden drops or spikes indicate problems.
3. **Schema** — Did the structure change unexpectedly? New columns, removed columns, type changes.
4. **Distribution** — Are the values within expected ranges and distributions?
5. **Lineage** — If something is wrong, which pipelines and tables are affected?

## Freshness Monitoring (dbt)

```yaml
sources:
  - name: postgres
    tables:
      - name: orders
        loaded_at_field: updated_at
        freshness:
          warn_after: {count: 6, period: hour}
          error_after: {count: 24, period: hour}
```

## Volume Anomaly Detection

```python
import pandas as pd
from scipy import stats

def detect_volume_anomaly(table: str, current_count: int,
                          historical_counts: list) -> dict:
    z_score = (current_count - pd.Series(historical_counts).mean()) / pd.Series(historical_counts).std()
    is_anomaly = abs(z_score) > 3
    return {
        "table": table,
        "current_count": current_count,
        "z_score": round(z_score, 2),
        "is_anomaly": is_anomaly,
        "direction": "spike" if z_score > 0 else "drop",
    }
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Reactive monitoring only | Issues found by users, not systems | Proactive automated checks |
| Checking only final tables | Root cause in upstream pipeline | Monitor all pipeline stages |
| No lineage tracking | Cannot assess impact of failures | Automatic lineage from dbt metadata |

## 10 Rules

1. Monitor freshness, volume, schema, distribution, and lineage.
2. Alerts fire before business users notice issues.
3. Every alert has a runbook.
4. Data SLAs are defined and monitored.
5. Schema changes trigger validation before downstream tables are refreshed.
6. Lineage maps are auto-generated, not manually maintained.
7. Volume anomaly detection uses statistical baselines, not hard thresholds.
8. On-call rotation exists for data incidents, same as service incidents.
9. Data incidents have postmortems.
10. Data quality metrics are tracked over time — improving trend is the goal.

