---
name: lakehouse-architecture
description: Design a lakehouse combining data lake flexibility with warehouse query performance. Outputs layer architecture, table format selection, partition strategy, and access control model.
argument-hint: [data volume, query patterns, team skills, cloud provider, latency requirements]
allowed-tools: Read, Write
---

# Lakehouse Architecture

The lakehouse combines the scalability and flexibility of a data lake (raw files on object storage) with the query performance and ACID guarantees of a data warehouse (optimised table formats, indexing, statistics). It avoids maintaining two separate systems — one for raw data, one for analytics.

## Core Components

```
┌─────────────────────────────────────────────────────┐
│              LAKEHOUSE ARCHITECTURE                  │
│                                                      │
│  Sources → Bronze → Silver → Gold → Consumption     │
│                                                      │
│  STORAGE: S3 / GCS / ADLS (object storage)          │
│  FORMAT:  Delta Lake / Apache Iceberg / Apache Hudi  │
│  ENGINE:  Spark / Trino / DuckDB / Athena            │
│  CATALOG: Unity Catalog / AWS Glue / Hive Metastore  │
└─────────────────────────────────────────────────────┘
```

## Medallion Architecture (Bronze / Silver / Gold)

```
BRONZE (Raw / Ingestion Layer)
  - Exact copy of source data — no transformation
  - Preserves original schema, including errors
  - Append-only; never modified after write
  - Retention: 1-3 years (full history)
  - Format: Delta/Iceberg with schema evolution
  - Access: Data engineering only

SILVER (Cleaned / Conformed Layer)  
  - Validated, cleaned, deduplicated
  - Standardised types, naming conventions
  - Joined with reference data (e.g., customer master)
  - Business entity-centric (Customer, Order, Product)
  - SCD Type 2 for slowly changing dimensions
  - Access: Data analysts, data scientists

GOLD (Business / Aggregated Layer)
  - Purpose-built for specific use cases
  - Pre-aggregated for reporting performance
  - Business-logic-applied metrics
  - Denormalised for query simplicity
  - Access: Business users, dashboards, APIs
```

## Table Format Selection

| Feature | Delta Lake | Apache Iceberg | Apache Hudi |
|---------|-----------|----------------|-------------|
| ACID transactions | ✓ | ✓ | ✓ |
| Time travel | ✓ | ✓ | ✓ |
| Schema evolution | ✓ | ✓ (best) | ✓ |
| Streaming ingest | ✓ | ✓ | ✓ (optimised) |
| Upserts (MERGE) | ✓ | ✓ | ✓ (optimised) |
| Spark integration | Native | Good | Good |
| Trino / Athena | Good | Native | Good |
| Best for | Databricks-heavy stacks | Multi-engine, Flink | High-frequency upserts |

**Recommendation:** Delta Lake for Databricks stacks. Iceberg for multi-engine / cloud-native.

## Delta Lake Implementation

```python
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, current_timestamp, sha2, concat_ws
from delta import DeltaTable

spark = SparkSession.builder \
    .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension") \
    .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog") \
    .getOrCreate()

# Bronze: append raw data with metadata columns
def write_bronze(df, table_path: str):
    (df
     .withColumn("_ingested_at", current_timestamp())
     .withColumn("_source_file", col("_metadata.file_path"))
     .write
     .format("delta")
     .mode("append")
     .option("mergeSchema", "true")   # Allow schema evolution
     .partitionBy("_date")            # Partition for pruning
     .save(table_path)
    )

# Silver: MERGE (upsert) for SCD Type 1
def merge_silver_orders(bronze_df, silver_path: str):
    silver = DeltaTable.forPath(spark, silver_path)
    
    (silver.alias("target")
     .merge(
         bronze_df.alias("source"),
         "target.order_id = source.order_id"
     )
     .whenMatchedUpdate(set={
         "status": "source.status",
         "updated_at": "source.updated_at",
         "_updated_at": "current_timestamp()",
     })
     .whenNotMatchedInsert(values={
         "order_id": "source.order_id",
         "customer_id": "source.customer_id",
         "status": "source.status",
         "total_amount": "source.total_amount",
         "created_at": "source.created_at",
         "updated_at": "source.updated_at",
         "_ingested_at": "current_timestamp()",
         "_updated_at": "current_timestamp()",
     })
     .execute()
    )

# Gold: aggregate with ZORDER optimisation
def build_gold_daily_revenue(silver_path: str, gold_path: str, date: str):
    orders = spark.read.format("delta").load(silver_path) \
        .filter(f"order_date = '{date}' AND status NOT IN ('cancelled', 'refunded')")
    
    daily = orders.groupBy("order_date", "country", "channel").agg(
        count("order_id").alias("order_count"),
        sum("total_amount").alias("revenue"),
        countDistinct("customer_id").alias("unique_customers"),
        avg("total_amount").alias("aov"),
    )
    
    (daily.write
     .format("delta")
     .mode("overwrite")
     .option("replaceWhere", f"order_date = '{date}'")
     .save(gold_path)
    )
    
    # ZORDER for common query patterns: by date+country
    spark.sql(f"""
        OPTIMIZE delta.`{gold_path}`
        ZORDER BY (order_date, country)
    """)
```

## Partition Strategy

```python
# Good partition keys: low-cardinality, often filtered on
# Bad partition keys: high-cardinality (UUID), rarely filtered

# Bronze: partition by ingest date
bronze_partitions = ["_year", "_month", "_day"]
# ~365 partitions/year, queries filter by date range

# Silver: partition by business date
silver_partitions = ["order_date"]
# Queries: WHERE order_date BETWEEN '2024-01-01' AND '2024-03-31'

# Gold: partition by date + country (if frequently filtered together)
gold_partitions = ["order_date", "country"]

# Partition size target: 128MB-1GB per file after compaction
# Too many small files = slow listing; too few large files = poor parallelism

# Compaction / OPTIMIZE — run after batch loads
spark.sql(f"OPTIMIZE delta.`{table_path}` WHERE order_date = '{date}'")

# Vacuum — remove old versions (default 7-day retention)
spark.sql(f"VACUUM delta.`{table_path}` RETAIN 168 HOURS")
```

## Time Travel and Audit

```sql
-- Query historical state (Delta Lake / Iceberg)
SELECT * FROM orders@v5                                    -- Version 5
SELECT * FROM orders TIMESTAMP AS OF '2024-01-15 00:00:00' -- Point in time

-- Audit: what changed?
SELECT * FROM (DESCRIBE HISTORY orders) LIMIT 10;

-- Restore to previous version after bad write
RESTORE TABLE orders TO VERSION AS OF 3;
RESTORE TABLE orders TO TIMESTAMP AS OF '2024-03-01';

-- Show data as it was yesterday
SELECT COUNT(*) FROM orders
TIMESTAMP AS OF current_timestamp() - INTERVAL 1 DAY;
```

## Catalog and Governance

```python
# Unity Catalog (Databricks) — 3-level namespace
# catalog.schema.table

# Create catalog structure
spark.sql("CREATE CATALOG IF NOT EXISTS production")
spark.sql("CREATE SCHEMA IF NOT EXISTS production.orders")
spark.sql("CREATE SCHEMA IF NOT EXISTS production.customers")

# Register table in catalog
spark.sql("""
    CREATE TABLE IF NOT EXISTS production.orders.fct_orders
    USING DELTA
    LOCATION 's3://company-lakehouse/gold/fct_orders/'
    TBLPROPERTIES (
        'delta.autoOptimize.optimizeWrite' = 'true',
        'delta.autoOptimize.autoCompact' = 'true',
        'classification' = 'confidential',
        'owner' = 'orders-team',
        'pii' = 'false'
    )
""")

# Column-level access control
spark.sql("""
    GRANT SELECT ON production.orders.fct_orders TO `analyst-role`;
    REVOKE SELECT (customer_email) ON production.customers.dim_customers FROM `analyst-role`;
""")
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Too many small files** | Listing 100k files = slow queries | OPTIMIZE/compaction after every batch load |
| **No partitioning** | Full table scan on 10TB table | Partition by the most common filter column |
| **Skipping Bronze layer** | No raw data history — can't reprocess on logic changes | Always land raw data before transforming |
| **VACUUM too aggressive** | Short retention = can't time travel or recover | Minimum 7-day VACUUM retention |
| **Writing Gold from Bronze directly** | Skip Silver = Gold has no reusable clean layer | Bronze → Silver → Gold always |
| **No table statistics** | Query optimiser makes bad plans | Run ANALYZE TABLE after large loads |
| **Overwriting entire table daily** | Slow; destroys history | Use `replaceWhere` for partition-scoped overwrites |

## 10 Rules

1. Bronze is immutable raw data — never transform in place, always append.
2. Silver is the single source of truth for clean, validated, deduplicated data.
3. Gold is purpose-built — one Gold table per major use case, not a general layer.
4. Compact small files after every batch load — a table with 100k files queries like a 1TB table.
5. Partition by the most common filter column — usually date for time-series data.
6. Time travel retention must exceed your incident detection + response time — minimum 7 days.
7. Every table has an owner, classification, and update cadence in the catalog.
8. Use MERGE for upserts — not delete+insert, which bypasses ACID guarantees.
9. Run OPTIMIZE with ZORDER based on actual query patterns — not guesses.
10. Schema evolution is managed (additive only) — removing or renaming columns is a breaking change requiring migration.
