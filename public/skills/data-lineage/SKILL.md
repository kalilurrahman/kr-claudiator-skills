---
name: data-lineage
description: Design and implement data lineage tracking across a data pipeline. Covers lineage capture strategies, metadata graphs, column-level lineage, impact analysis, and integration with dbt, Airflow, and OpenLineage.
argument-hint: [pipeline tool, data warehouse, lineage granularity needed, compliance requirement]
allowed-tools: Read, Write, Bash
---

# Data Lineage

Data lineage answers: where did this data come from, how was it transformed, and who depends on it? Without lineage, debugging data quality issues is archaeology. With it, impact analysis, root cause identification, and compliance audits take minutes instead of days.

## Lineage Granularity Levels

| Level | What is tracked | Use case |
|-------|----------------|---------|
| Job-level | Pipeline A produces Dataset B | High-level dependency view |
| Dataset-level | Table X transforms into Table Y | Impact analysis, data discovery |
| Column-level | revenue = price * quantity | Root cause analysis, PII tracking |
| Record-level | Row 42 in orders came from row 7 in events | Audit trails, GDPR erasure |

## Process

1. **Define the lineage scope** -- job, dataset, or column level? Driven by compliance and debugging needs.
2. **Choose the capture strategy** -- static analysis (parse SQL), runtime hooks (OpenLineage), or manual annotation.
3. **Select a lineage store** -- graph database (Neo4j), specialized tool (Marquez, Atlan, DataHub), or dbt docs.
4. **Instrument pipelines** -- add OpenLineage facets to Airflow, Spark, and dbt jobs.
5. **Build the lineage graph** -- nodes are datasets; edges are transformations with metadata.
6. **Enable impact analysis** -- given table X is changing, which downstream dashboards break?
7. **Enable root cause tracing** -- given bad data in report Y, which upstream source introduced it?
8. **Surface lineage in the data catalog** -- lineage is only valuable if analysts can discover and use it.
9. **Automate for new pipelines** -- new pipelines should automatically emit lineage events.
10. **Test lineage completeness** -- verify all production pipelines emit lineage metadata.

## OpenLineage Event (standard format)

```json
{
  "eventType": "COMPLETE",
  "eventTime": "2025-01-15T14:32:00Z",
  "run": {"runId": "d46e465b-d358-4d32-83d4-df2bf5d5e29a"},
  "job": {
    "namespace": "warehouse",
    "name": "transform_orders_daily",
    "facets": {
      "sql": {
        "query": "INSERT INTO orders_daily SELECT date_trunc('day', created_at) as date, SUM(total) as revenue FROM orders WHERE status = 'completed' GROUP BY 1"
      }
    }
  },
  "inputs": [{
    "namespace": "postgres://prod-db:5432",
    "name": "public.orders",
    "facets": {
      "schema": {
        "fields": [
          {"name": "id",         "type": "bigint"},
          {"name": "created_at", "type": "timestamp"},
          {"name": "total",      "type": "numeric"}
        ]
      }
    }
  }],
  "outputs": [{
    "namespace": "bigquery://project",
    "name": "warehouse.orders_daily",
    "facets": {
      "columnLineage": {
        "fields": {
          "date":    {"inputFields": [{"namespace": "postgres://prod-db:5432", "name": "public.orders", "field": "created_at"}]},
          "revenue": {"inputFields": [{"namespace": "postgres://prod-db:5432", "name": "public.orders", "field": "total"}]}
        }
      }
    }
  }]
}
```

## dbt Lineage Setup

```yaml
# models/orders/orders_daily.yml
version: 2
models:
  - name: orders_daily
    description: "Daily order aggregates. Source: orders table via stg_orders."
    meta:
      owner: data-team
      tier: gold
      sla: daily-9am
    columns:
      - name: revenue
        description: "Sum of completed order totals. Source: orders.total"
        meta:
          pii: false
          source_columns: ["orders.total"]
```

```python
# Extract lineage from dbt manifest.json
import json

def extract_dbt_lineage(manifest_path: str) -> dict:
    with open(manifest_path) as f:
        manifest = json.load(f)
    lineage = {}
    for node_id, node in manifest["nodes"].items():
        if node["resource_type"] != "model":
            continue
        lineage[node_id] = {
            "name":     node["name"],
            "upstream": node.get("depends_on", {}).get("nodes", []),
            "columns":  list(node.get("columns", {}).keys()),
        }
    return lineage

def find_downstream_impacts(lineage: dict, changed_model: str) -> list:
    """Given a changed model, find all downstream dependents."""
    impacted = []
    for model_id, meta in lineage.items():
        if changed_model in meta["upstream"]:
            impacted.append(meta["name"])
            impacted.extend(find_downstream_impacts(lineage, model_id))
    return list(set(impacted))
```

## Airflow + OpenLineage Integration

```python
# airflow.cfg
[openlineage]
transport = {"type": "http", "url": "http://marquez:5000"}

# Custom lineage emission for non-SQL operators
from openlineage.airflow.extractors.base import BaseExtractor, OperatorLineage
from openlineage.client.run import Dataset

class S3ToGCSExtractor(BaseExtractor):
    def extract(self) -> OperatorLineage:
        return OperatorLineage(
            inputs=[Dataset(namespace="s3://my-bucket", name=self.operator.source_key)],
            outputs=[Dataset(namespace="gs://my-gcs-bucket", name=self.operator.dest_object)]
        )
```

## Impact Analysis Query (Neo4j)

```cypher
// Find all dashboards affected by a change to the orders table
MATCH path = (source:Dataset {name: "orders"})
  -[:TRANSFORMED_TO*1..10]->
  (downstream:Dataset)
  -[:USED_BY]->
  (dashboard:Dashboard)
RETURN
  source.name AS changed_dataset,
  [node in nodes(path) | node.name] AS lineage_path,
  dashboard.name AS affected_dashboard,
  dashboard.owner AS notify_team
ORDER BY length(path)
```

## PII Column Lineage Tracking

```python
import re

PII_PATTERNS = {
    "email":   r"^(email|email_address|user_email)$",
    "phone":   r"^(phone|phone_number|mobile)$",
    "name":    r"^(first_name|last_name|full_name)$",
    "address": r"^(address|street|zip|postal_code)$",
}

def classify_columns(columns: list) -> dict:
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

## Freshness + Lineage Combined

```python
# Track both what transformed the data and when
class LineageEvent:
    def __init__(self, job_name: str, run_id: str):
        self.job_name  = job_name
        self.run_id    = run_id
        self.timestamp = datetime.utcnow()
        self.inputs    = []
        self.outputs   = []

    def to_openlineage(self) -> dict:
        return {
            "eventType":  "COMPLETE",
            "eventTime":  self.timestamp.isoformat() + "Z",
            "job":        {"namespace": "warehouse", "name": self.job_name},
            "run":        {"runId": self.run_id},
            "inputs":     [{"namespace": i["ns"], "name": i["name"]} for i in self.inputs],
            "outputs":    [{"namespace": o["ns"], "name": o["name"],
                           "facets": {"lifecycleStateChange": {"lifecycleStateChange": "OVERWRITE"}}}
                          for o in self.outputs],
        }
```

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Manual lineage documentation | Instantly stale | Instrument pipelines to emit lineage automatically |
| Job-level only | Cannot trace column-level bugs | Add column lineage for critical paths |
| Lineage in a silo | Engineers have it; analysts cannot see it | Surface in data catalog |
| No impact analysis tooling | Schema changes break dashboards silently | Build downstream impact check into CI |
| Lineage without freshness | Know the path but not when data arrived | Combine lineage with freshness metadata |

## Rules

- **Instrument at pipeline level, not manually** -- manually maintained lineage is always wrong.
- **Column-level lineage for compliance datasets** -- job-level is insufficient for GDPR and PII tracking.
- **Surface lineage in the catalog** -- lineage buried in a database nobody queries has zero value.
- **Build impact analysis tooling** -- the killer use case is "what breaks if I change X?"
- **Capture schema at run time** -- schemas change; record the schema as-of the run, not the current schema.
- **Test lineage completeness** -- verify all production pipelines emit lineage metadata.
- **Combine lineage with data quality** -- lineage tells you where; quality checks tell you what went wrong.
- **Tag PII at the source** -- once tagged, lineage propagates the classification downstream automatically.
- **Version lineage events** -- OpenLineage has a schema; version it so consumers are not broken by changes.
- **Lineage is a product** -- invest in UI and discoverability; raw graph data is not useful to analysts.
