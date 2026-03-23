---
name: etl-pipeline
description: Design and implement production-ready ETL/ELT pipelines for data warehousing and analytics. Covers extraction strategies, transformation logic, incremental loading, data quality, orchestration, schema evolution, and monitoring.
argument-hint: [data sources, transformation requirements, destination system, schedule]
allowed-tools: Read, Write, Bash
---

# ETL Pipeline Design

Design production-ready ETL (Extract-Transform-Load) and ELT pipelines that reliably move data from heterogeneous sources to analytical destinations. Goes beyond basic SQL — covers orchestration, incremental loading, data quality gates, schema evolution, SCD handling, and operational monitoring.

## Process

1. **Inventory sources.** Document each source: type (OLTP DB, API, file, stream), auth method, schema, volume, change frequency, and SLA constraints.
2. **Choose ETL vs ELT.** Transform before load (ETL) for sensitive data masking or when destination compute is expensive. Transform after load (ELT) when destination (Snowflake, BigQuery, Redshift) has cheap compute and raw storage is acceptable.
3. **Design extraction strategy.** Full refresh, incremental (watermark), CDC (change data capture), or log-based replication per source type.
4. **Define transformation logic.** Cleaning, deduplication, enrichment, type casting, business rule application, aggregation, join resolution.
5. **Model destination schema.** Fact/dimension star schema, SCD Type 1/2/3, surrogate keys, audit columns.
6. **Implement data quality gates.** Schema validation, null checks, range checks, referential integrity, row count reconciliation, freshness checks.
7. **Set up orchestration.** DAG definition, dependency management, retries, SLA alerts, backfill capability.
8. **Design monitoring.** Job duration, row counts in/out, error rates, data freshness, downstream impact alerts.
9. **Handle schema evolution.** Column additions, type changes, renames — forward/backward compatibility strategy.
10. **Plan for failure modes.** Partial load recovery, idempotent reruns, dead-letter queues for bad records.

## Output Format

### ETL Pipeline: [Pipeline Name]

**Sources:** [count and types]
**Destination:** [data warehouse / lake]
**Schedule:** [cron + timezone]
**Load Strategy:** [Full Refresh | Incremental | CDC]
**Orchestrator:** [Airflow / Prefect / dbt / Dagster]
**SLA:** [max acceptable latency]

---

## Airflow DAG — Incremental Load Pattern

```python
# dags/etl_orders_pipeline.py
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.postgres.hooks.postgres import PostgresHook
from airflow.providers.snowflake.hooks.snowflake import SnowflakeHook
from datetime import datetime, timedelta
import pandas as pd
import logging

logger = logging.getLogger(__name__)

default_args = {
    "owner": "data-engineering",
    "depends_on_past": False,
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "retry_exponential_backoff": True,
    "max_retry_delay": timedelta(minutes=60),
    "email_on_failure": True,
    "email": ["data-alerts@company.com"],
    "sla": timedelta(hours=2),
}

with DAG(
    dag_id="etl_orders_incremental",
    default_args=default_args,
    schedule_interval="0 2 * * *",  # 2 AM UTC daily
    start_date=datetime(2024, 1, 1),
    catchup=True,
    max_active_runs=1,
    tags=["etl", "orders", "production"],
) as dag:

    def extract_orders(**context):
        execution_date = context["execution_date"]
        next_execution_date = context["next_execution_date"]
        pg_hook = PostgresHook(postgres_conn_id="source_postgres")
        query = """
            SELECT order_id, customer_id, order_date, status, total_amount, updated_at
            FROM orders
            WHERE updated_at >= %(start_ts)s AND updated_at < %(end_ts)s
        """
        df = pg_hook.get_pandas_df(query, parameters={
            "start_ts": execution_date.isoformat(),
            "end_ts": next_execution_date.isoformat(),
        })
        logger.info(f"Extracted {len(df)} rows")
        if df.empty:
            return None
        output_path = f"/tmp/orders_{execution_date.strftime('%Y%m%d')}.parquet"
        df.to_parquet(output_path, index=False)
        return {"row_count": len(df), "output_path": output_path}

    def validate_extract(**context):
        ti = context["task_instance"]
        result = ti.xcom_pull(task_ids="extract_orders")
        if result is None:
            return
        df = pd.read_parquet(result["output_path"])
        errors = []
        for col in ["order_id", "customer_id", "order_date"]:
            if df[col].isna().sum() > 0:
                errors.append(f"NULL values in {col}")
        if df["order_id"].duplicated().any():
            errors.append("Duplicate order_ids found")
        if (df["total_amount"] < 0).any():
            errors.append("Negative total_amount values found")
        valid_statuses = {"pending", "processing", "shipped", "delivered", "cancelled"}
        invalid = set(df["status"].str.lower().unique()) - valid_statuses
        if invalid:
            errors.append(f"Invalid status values: {invalid}")
        if errors:
            raise ValueError("Data quality failed:\n" + "\n".join(errors))
        logger.info(f"Validation passed: {len(df)} rows")

    def transform_orders(**context):
        ti = context["task_instance"]
        result = ti.xcom_pull(task_ids="extract_orders")
        if result is None:
            return
        df = pd.read_parquet(result["output_path"])
        df["order_date"] = pd.to_datetime(df["order_date"])
        df["total_amount"] = df["total_amount"].astype("float64")
        df["order_year"] = df["order_date"].dt.year
        df["order_month"] = df["order_date"].dt.month
        df["order_quarter"] = df["order_date"].dt.quarter
        df["is_high_value"] = df["total_amount"] > 1000.0
        df["status"] = df["status"].str.lower().str.strip()
        from datetime import timezone
        df["etl_loaded_at"] = datetime.now(timezone.utc)
        df["etl_batch_date"] = context["execution_date"].date()
        output_path = result["output_path"].replace(".parquet", "_transformed.parquet")
        df.to_parquet(output_path, index=False)
        return {"row_count": len(df), "output_path": output_path}

    def load_to_snowflake(**context):
        ti = context["task_instance"]
        result = ti.xcom_pull(task_ids="transform_orders")
        if result is None:
            logger.info("No transformed data — skipping load")
            return
        df = pd.read_parquet(result["output_path"])
        sf_hook = SnowflakeHook(snowflake_conn_id="snowflake_prod")
        temp_table = f"orders_staging_{context['execution_date'].strftime('%Y%m%d_%H%M%S')}"
        sf_hook.run(f"CREATE TEMPORARY TABLE {temp_table} LIKE analytics.fact_orders;")
        sf_hook.insert_rows(
            table=temp_table,
            rows=df.values.tolist(),
            target_fields=df.columns.tolist(),
        )
        sf_hook.run(f"""
            MERGE INTO analytics.fact_orders AS target
            USING {temp_table} AS source
            ON target.order_id = source.order_id
            WHEN MATCHED THEN UPDATE SET
                status = source.status,
                total_amount = source.total_amount,
                etl_loaded_at = source.etl_loaded_at
            WHEN NOT MATCHED THEN INSERT (
                order_id, customer_id, order_date, status, total_amount,
                order_year, order_month, order_quarter, is_high_value,
                etl_loaded_at, etl_batch_date
            ) VALUES (
                source.order_id, source.customer_id, source.order_date, source.status,
                source.total_amount, source.order_year, source.order_month,
                source.order_quarter, source.is_high_value,
                source.etl_loaded_at, source.etl_batch_date
            );
        """)
        logger.info(f"Loaded {result['row_count']} rows into analytics.fact_orders")

    t_extract  = PythonOperator(task_id="extract_orders",   python_callable=extract_orders)
    t_validate = PythonOperator(task_id="validate_extract", python_callable=validate_extract)
    t_transform= PythonOperator(task_id="transform_orders", python_callable=transform_orders)
    t_load     = PythonOperator(task_id="load_to_snowflake",python_callable=load_to_snowflake)

    t_extract >> t_validate >> t_transform >> t_load
```

---

## Destination Schema Design

```sql
-- Fact table with audit columns
CREATE TABLE analytics.fact_orders (
    order_sk        VARCHAR(32)    NOT NULL,   -- surrogate key (MD5 hash)
    order_id        BIGINT         NOT NULL,   -- natural key
    customer_id     BIGINT         NOT NULL,
    order_date      DATE           NOT NULL,
    status          VARCHAR(20)    NOT NULL,
    total_amount    DECIMAL(12,2)  NOT NULL,
    order_year      SMALLINT       NOT NULL,
    order_month     SMALLINT       NOT NULL,
    order_quarter   SMALLINT       NOT NULL,
    is_high_value   BOOLEAN        NOT NULL DEFAULT FALSE,
    etl_loaded_at   TIMESTAMP_NTZ  NOT NULL,
    etl_batch_date  DATE           NOT NULL,
    PRIMARY KEY (order_sk),
    UNIQUE (order_id)
)
CLUSTER BY (order_year, order_month);

-- Pipeline run metadata
CREATE TABLE meta.pipeline_runs (
    run_id          BIGINT AUTOINCREMENT PRIMARY KEY,
    pipeline_name   VARCHAR(100)   NOT NULL,
    batch_date      DATE           NOT NULL,
    rows_loaded     BIGINT         NOT NULL DEFAULT 0,
    status          VARCHAR(20)    NOT NULL,
    run_at          TIMESTAMP_NTZ  NOT NULL,
    error_message   TEXT
);
```

---

## dbt ELT Pattern

```sql
-- models/staging/stg_orders.sql
{{ config(
    materialized='incremental',
    unique_key='order_id',
    on_schema_change='append_new_columns',
    incremental_strategy='merge',
    cluster_by=['order_date']
) }}

WITH source AS (
    SELECT * FROM {{ source('raw', 'orders') }}
    {% if is_incremental() %}
        WHERE updated_at > (SELECT MAX(updated_at) FROM {{ this }})
    {% endif %}
),
cleaned AS (
    SELECT
        order_id::BIGINT                AS order_id,
        customer_id::BIGINT             AS customer_id,
        order_date::DATE                AS order_date,
        LOWER(TRIM(status))             AS status,
        total_amount::DECIMAL(12,2)     AS total_amount,
        updated_at::TIMESTAMP_NTZ       AS updated_at,
        CURRENT_TIMESTAMP()             AS dbt_loaded_at
    FROM source
    WHERE order_id IS NOT NULL
)
SELECT * FROM cleaned
```

```yaml
# models/staging/schema.yml
models:
  - name: stg_orders
    columns:
      - name: order_id
        tests: [unique, not_null]
      - name: status
        tests:
          - accepted_values:
              values: [pending, processing, shipped, delivered, cancelled]
      - name: total_amount
        tests:
          - not_null
          - dbt_expectations.expect_column_values_to_be_between:
              min_value: 0
              max_value: 1000000
```

---

## SCD Type 2 — Slowly Changing Dimensions

```sql
-- Dimension table with full history
CREATE TABLE analytics.dim_customers (
    customer_sk     BIGINT AUTOINCREMENT PRIMARY KEY,
    customer_id     BIGINT         NOT NULL,
    email           VARCHAR(255)   NOT NULL,
    name            VARCHAR(200)   NOT NULL,
    tier            VARCHAR(20),
    region          VARCHAR(50),
    valid_from      DATE           NOT NULL,
    valid_to        DATE,           -- NULL = current record
    is_current      BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP_NTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP()
);

-- SCD2 merge procedure
CREATE OR REPLACE PROCEDURE analytics.upsert_dim_customers(batch_date DATE)
RETURNS VARCHAR LANGUAGE SQL AS $$
BEGIN
    -- Expire changed records
    UPDATE analytics.dim_customers AS t
    SET valid_to = :batch_date - 1, is_current = FALSE
    FROM staging.customers_stage AS s
    WHERE t.customer_id = s.customer_id
      AND t.is_current = TRUE
      AND (t.email <> s.email OR t.name <> s.name OR t.tier <> s.tier);

    -- Insert new versions
    INSERT INTO analytics.dim_customers
        (customer_id, email, name, tier, region, valid_from, valid_to, is_current)
    SELECT s.customer_id, s.email, s.name, s.tier, s.region,
           :batch_date, NULL, TRUE
    FROM staging.customers_stage s
    LEFT JOIN analytics.dim_customers t
        ON t.customer_id = s.customer_id AND t.is_current = TRUE
    WHERE t.customer_id IS NULL
       OR t.email <> s.email OR t.name <> s.name OR t.tier <> s.tier;

    RETURN 'SCD2 complete for ' || :batch_date;
END;
$$;
```

---

## Data Quality Framework

```python
# data_quality/checks.py
from dataclasses import dataclass
from typing import Callable
import pandas as pd
import logging

logger = logging.getLogger(__name__)

@dataclass
class QualityCheck:
    name: str
    severity: str  # "error" blocks pipeline, "warning" alerts only
    check_fn: Callable[[pd.DataFrame], bool]
    error_msg: str

def run_quality_checks(df: pd.DataFrame, checks: list) -> dict:
    results = {"passed": [], "warnings": [], "errors": []}
    for check in checks:
        try:
            passed = check.check_fn(df)
        except Exception as e:
            passed = False
        if passed:
            results["passed"].append(check.name)
        elif check.severity == "error":
            results["errors"].append(check.error_msg)
        else:
            results["warnings"].append(check.error_msg)
    if results["errors"]:
        raise ValueError("Quality checks failed:\n" + "\n".join(results["errors"]))
    for w in results["warnings"]:
        logger.warning(f"Quality warning: {w}")
    return results

# Check factory functions
def not_null(col):
    return QualityCheck(f"not_null_{col}", "error",
        lambda df: df[col].notna().all(), f"NULLs in '{col}'")

def unique(col):
    return QualityCheck(f"unique_{col}", "error",
        lambda df: not df[col].duplicated().any(), f"Duplicates in '{col}'")

def row_count_min(n):
    return QualityCheck("row_count_min", "warning",
        lambda df: len(df) >= n, f"Row count below minimum {n}")

def freshness(ts_col, max_hours):
    from datetime import datetime, timezone, timedelta
    def check(df):
        latest = pd.to_datetime(df[ts_col]).max()
        cutoff = datetime.now(timezone.utc) - timedelta(hours=max_hours)
        return latest.replace(tzinfo=timezone.utc) >= cutoff
    return QualityCheck(f"freshness_{ts_col}", "error", check,
        f"'{ts_col}' data older than {max_hours} hours")
```

---

## Schema Evolution Handling

```python
def detect_schema_changes(incoming_cols: list, current_cols: list) -> dict:
    incoming, current = set(incoming_cols), set(current_cols)
    return {
        "added":     list(incoming - current),   # safe — add columns
        "removed":   list(current - incoming),   # dangerous — requires review
        "unchanged": list(incoming & current),
    }

def apply_column_additions(sf_hook, table: str, added_cols: list, col_types: dict):
    """Safely add new columns without downtime."""
    for col in added_cols:
        col_type = col_types.get(col, "VARCHAR(255)")
        sf_hook.run(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {col_type};")
        logger.info(f"Added column {col} ({col_type}) to {table}")
```

---

## Extraction Strategies by Source Type

| Source Type | Strategy | Tool | Notes |
|-------------|----------|------|-------|
| OLTP database (Postgres/MySQL) | Incremental watermark | SQLAlchemy + Airflow | Requires updated_at index |
| OLTP database (high volume) | CDC / log-based | Debezium + Kafka | Zero-latency, no source load |
| REST API | Cursor pagination | requests + retry | Rate limit aware |
| S3 / file drops | Partition scanning | boto3 + Spark | Track processed files |
| Event stream | Real-time consume | Kafka + Flink | Checkpoint offsets |
| SaaS platform | Fivetran / Airbyte | Managed connector | Fastest to implement |

---

## Rules

- **Design for idempotency first.** Rerunning a batch twice must yield the same result. Use MERGE/upsert — never blind INSERT.
- **Incremental by default.** Full refreshes don't scale past millions of rows. Use watermarks, sequence IDs, or CDC.
- **Validate before loading.** Quality gates catch upstream corruption before it contaminates analytics. Block on errors, warn on anomalies.
- **Separate extract, transform, load.** Each stage must be independently retryable and testable without re-running the others.
- **Stage before merging.** Write to a staging/temp table first, then MERGE into the target. A failed mid-load won't leave partial data.
- **Track every run.** Log pipeline name, batch window, row counts, status, and timestamps in a metadata table.
- **Handle schema evolution explicitly.** New columns are safe — automate them. Removed or renamed columns are breaking — gate with human review.
- **Use SCD Type 2 for slowly changing dimensions.** Preserve history for attributes that change (customer tier, address, pricing). Never silently overwrite.
- **Set SLAs, not just schedules.** Monitor both when the pipeline runs and when data is ready for consumers. Alert on both.
- **Dead-letter bad records.** Route malformed rows to a dead-letter table. Don't fail the whole pipeline over a few unparseable records.

## Incremental Loading Pattern

```python
def extract_incremental(table_name):
    # Get last successful watermark
    watermark = get_last_watermark(table_name)
    
    query = f"""
        SELECT * FROM {table_name}
        WHERE updated_at > %(watermark)s
        ORDER BY updated_at ASC
    """
    
    conn = psycopg2.connect(DATABASE_URL)
    df = pd.read_sql(query, conn, params={'watermark': watermark})
    
    # Save to staging
    df.to_parquet(f's3://staging/{table_name}/{date}.parquet')
    
    # Update watermark only after successful load
    if len(df) > 0:
        new_watermark = df['updated_at'].max()
        save_watermark(table_name, new_watermark)
    
    return len(df)
```

---

## Pipeline Architecture

```
[PostgreSQL]  ─┐
               │
[S3 CSV]      ─┼─→ [Extract] → [Transform] → [Load] → [Snowflake]
               │      ↓            ↓            ↓
[REST API]    ─┘   [Staging]  [Quality]   [Final Tables]
                     Area       Checks
```

---
