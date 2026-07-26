---
name: data-partitioning
description: Design database and data lake partitioning strategies for scale, performance, and cost optimization. Outputs partitioning schemes, partition pruning patterns, maintenance procedures, and query optimization.
argument-hint: [database/storage system, data volume, access patterns, retention requirements]
allowed-tools: Read, Write, Bash
---

# Data Partitioning

Partitioning divides large tables or datasets into smaller, manageable pieces. Done right, queries scan only relevant partitions (partition pruning), maintenance is faster, and old data can be archived or dropped without touching active data.

## Partitioning Strategies

| Strategy | Use When | Example |
|----------|----------|---------|
| Range (time) | Time-series data, logs, events | Partition by month: `created_at` |
| Range (ID) | Numeric primary keys, sharding | Partition by user_id ranges |
| List | Discrete values, low cardinality | Partition by country, status |
| Hash | Even distribution, no natural key | Partition by hash(user_id) |
| Composite | Multiple dimensions | Range(year) + List(region) |

## Output Format

### PostgreSQL Table Partitioning

```sql
-- Time-based range partitioning for events table
CREATE TABLE events (
    event_id    UUID NOT NULL,
    user_id     VARCHAR(255) NOT NULL,
    event_type  VARCHAR(100) NOT NULL,
    payload     JSONB,
    occurred_at TIMESTAMPTZ NOT NULL,
    
    PRIMARY KEY (event_id, occurred_at)   -- Partition key must be in PK
) PARTITION BY RANGE (occurred_at);

-- Create monthly partitions
CREATE TABLE events_2024_01 PARTITION OF events
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE events_2024_02 PARTITION OF events
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Indexes on partitions (apply to all partitions)
CREATE INDEX ON events (user_id, occurred_at);
CREATE INDEX ON events (event_type, occurred_at);

-- Default partition for out-of-range data (catch-all)
CREATE TABLE events_default PARTITION OF events DEFAULT;
```

```sql
-- Automate partition creation with a stored procedure
CREATE OR REPLACE FUNCTION create_monthly_partition(table_name TEXT, year INT, month INT)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_name := table_name || '_' || year || '_' || LPAD(month::TEXT, 2, '0');
    start_date := DATE(year || '-' || LPAD(month::TEXT, 2, '0') || '-01');
    end_date := start_date + INTERVAL '1 month';
    
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
        partition_name, table_name, start_date, end_date
    );
    
    -- Create indexes on new partition
    EXECUTE format(
        'CREATE INDEX IF NOT EXISTS ON %I (user_id, occurred_at)',
        partition_name
    );
    
    RAISE NOTICE 'Created partition: %', partition_name;
END;
$$ LANGUAGE plpgsql;

-- Create next 3 months of partitions (run monthly via cron)
DO $$
DECLARE
    d DATE := DATE_TRUNC('month', NOW());
BEGIN
    FOR i IN 0..2 LOOP
        PERFORM create_monthly_partition(
            'events',
            EXTRACT(YEAR FROM d + (i || ' months')::INTERVAL)::INT,
            EXTRACT(MONTH FROM d + (i || ' months')::INTERVAL)::INT
        );
    END LOOP;
END $$;
```

```sql
-- Partition pruning — queries automatically scan only relevant partitions
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*), event_type
FROM events
WHERE occurred_at BETWEEN '2024-01-01' AND '2024-01-31'   -- Only scans events_2024_01
GROUP BY event_type;

-- Verify partition pruning in query plan:
-- "Partitions selected: 1 (out of 24)"

-- Drop old partitions instantly (no rewriting rows)
DROP TABLE events_2023_01;   -- Drops January 2023 data in milliseconds

-- Or archive before dropping
CREATE TABLE events_archive_2023_01 (LIKE events INCLUDING ALL);
INSERT INTO events_archive_2023_01 SELECT * FROM events_2023_01;
DROP TABLE events_2023_01;
```

### Apache Spark / Data Lake Partitioning

```python
# Partition parquet files by date for efficient querying
from pyspark.sql import SparkSession
from pyspark.sql.functions import year, month, dayofmonth, col

spark = SparkSession.builder.appName("data-pipeline").getOrCreate()

# Write with time-based partitioning
events_df.write \
    .partitionBy("year", "month", "day") \
    .mode("append") \
    .parquet("s3://data-lake/events/")

# Directory structure: s3://data-lake/events/year=2024/month=01/day=15/
# Allows predicate pushdown on date filters

# Read with partition pruning — only reads 2024-01-15 data
df = spark.read.parquet("s3://data-lake/events/") \
    .filter((col("year") == 2024) & (col("month") == 1) & (col("day") == 15))

# Check partition pruning in execution plan
df.explain(extended=True)
```

```python
# Hive-partitioned table in Athena / Glue
CREATE EXTERNAL TABLE events (
    event_id    STRING,
    user_id     STRING,
    event_type  STRING,
    payload     STRING
)
PARTITIONED BY (
    dt STRING    -- 'YYYY-MM-DD'
)
STORED AS PARQUET
LOCATION 's3://data-lake/events/'
TBLPROPERTIES ('parquet.compression'='SNAPPY');

-- Add partition after writing data
ALTER TABLE events ADD PARTITION (dt='2024-01-15')
LOCATION 's3://data-lake/events/dt=2024-01-15/';

-- Or auto-discover partitions
MSCK REPAIR TABLE events;

-- Query with partition filter (scans only relevant S3 prefixes)
SELECT COUNT(*), event_type
FROM events
WHERE dt >= '2024-01-01' AND dt < '2024-02-01'
GROUP BY event_type;
```

### Hash Partitioning (Even Distribution)

```sql
-- Hash partition for user data (no natural time key)
CREATE TABLE user_events (
    event_id  UUID NOT NULL,
    user_id   VARCHAR(255) NOT NULL,
    data      JSONB,
    PRIMARY KEY (event_id, user_id)
) PARTITION BY HASH (user_id);

-- 8 hash partitions — good for most cases
CREATE TABLE user_events_0 PARTITION OF user_events FOR VALUES WITH (MODULUS 8, REMAINDER 0);
CREATE TABLE user_events_1 PARTITION OF user_events FOR VALUES WITH (MODULUS 8, REMAINDER 1);
CREATE TABLE user_events_2 PARTITION OF user_events FOR VALUES WITH (MODULUS 8, REMAINDER 2);
CREATE TABLE user_events_3 PARTITION OF user_events FOR VALUES WITH (MODULUS 8, REMAINDER 3);
CREATE TABLE user_events_4 PARTITION OF user_events FOR VALUES WITH (MODULUS 8, REMAINDER 4);
CREATE TABLE user_events_5 PARTITION OF user_events FOR VALUES WITH (MODULUS 8, REMAINDER 5);
CREATE TABLE user_events_6 PARTITION OF user_events FOR VALUES WITH (MODULUS 8, REMAINDER 6);
CREATE TABLE user_events_7 PARTITION OF user_events FOR VALUES WITH (MODULUS 8, REMAINDER 7);
```

### Partition Maintenance

```python
# scripts/partition_manager.py
import psycopg2
from datetime import datetime, timedelta

class PartitionManager:
    def __init__(self, db_url: str):
        self.conn = psycopg2.connect(db_url)
    
    def create_upcoming_partitions(self, table: str, months_ahead: int = 3):
        """Ensure partitions exist for the next N months."""
        now = datetime.now()
        
        with self.conn.cursor() as cur:
            for i in range(months_ahead + 1):
                target = now + timedelta(days=30 * i)
                year = target.year
                month = target.month
                
                cur.execute(
                    "SELECT create_monthly_partition(%s, %s, %s)",
                    (table, year, month)
                )
                self.conn.commit()
    
    def drop_old_partitions(self, table: str, retain_months: int = 12):
        """Drop partitions older than retain_months."""
        cutoff = datetime.now() - timedelta(days=30 * retain_months)
        
        with self.conn.cursor() as cur:
            # List all partitions
            cur.execute("""
                SELECT child.relname
                FROM pg_inherits
                JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
                JOIN pg_class child ON pg_inherits.inhrelid = child.oid
                WHERE parent.relname = %s
            """, (table,))
            
            partitions = [row[0] for row in cur.fetchall()]
        
        for partition in partitions:
            # Parse date from partition name (e.g., events_2023_01)
            parts = partition.split('_')
            try:
                year = int(parts[-2])
                month = int(parts[-1])
                partition_date = datetime(year, month, 1)
            except (ValueError, IndexError):
                continue
            
            if partition_date < cutoff:
                print(f"Dropping partition: {partition}")
                with self.conn.cursor() as cur:
                    cur.execute(f"DROP TABLE IF EXISTS {partition}")
                    self.conn.commit()
    
    def partition_stats(self, table: str) -> list:
        """Get row counts and sizes per partition."""
        with self.conn.cursor() as cur:
            cur.execute("""
                SELECT
                    child.relname as partition_name,
                    pg_size_pretty(pg_relation_size(child.oid)) as size,
                    pg_stat_get_live_tuples(child.oid) as row_count
                FROM pg_inherits
                JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
                JOIN pg_class child ON pg_inherits.inhrelid = child.oid
                WHERE parent.relname = %s
                ORDER BY child.relname
            """, (table,))
            return cur.fetchall()
```

## Rules

- **Partition key must appear in queries** — if your common queries don't filter by the partition key, partitioning adds overhead without benefit.
- **Create partitions before you need them** — a missing partition causes inserts to fail or go to the default partition.
- **Partition key in primary key** — PostgreSQL requires this; plan your primary key accordingly.
- **Don't over-partition** — too many small partitions (e.g., hourly for 5 years = 43,800 partitions) degrades planner performance.
- **Index each partition** — global indexes on partitioned tables have limitations; ensure partition-local indexes exist.
- **Test partition pruning** — use EXPLAIN to verify the planner is actually using partition pruning.
- **Automate partition creation** — missing a month's partition causes data loss or failures; automate it.
- **Drop, don't DELETE** — dropping a partition is instantaneous; DELETE on millions of rows is slow and generates WAL.
- **Data lake: partition on query patterns** — partition by the columns most commonly used in WHERE clauses.
- **Monitor partition skew** — hash partitions should have roughly equal row counts; investigate outliers.


## Worked Example and Anti-Patterns

### Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| No runbook | On-call engineer has no guidance during incident | Write runbook before going to production |
| Single point of failure | One component down takes everything with it | Design for redundancy at every layer |
| No monitoring | Problems discovered by users, not engineers | Instrument before launch |
| Manual toil | Repeated manual steps slow down and introduce errors | Automate anything done more than twice |
| Undocumented decisions | Next engineer repeats the same mistakes | Use Architecture Decision Records (ADRs) |

### Rules

- **Start with the simplest thing that works** -- complexity should be earned, not assumed.
- **Make it observable before making it complex** -- logs, metrics, and traces first.
- **Automate toil** -- anything done manually more than twice should be scripted.
- **Document decisions** -- use ADRs; future engineers will thank you.
- **Test failure modes** -- chaos engineering starts small; break one thing at a time.
- **Prefer reversible decisions** -- irreversible architecture decisions need the most careful thought.
- **Own your runbooks** -- every service needs a runbook before it goes to production.
- **Measure before optimizing** -- do not optimize what you have not profiled.
- **Design for the 99th percentile user** -- the average case is not the hard case.
- **Keep it boring** -- stable, predictable, well-understood technology over cutting-edge.

