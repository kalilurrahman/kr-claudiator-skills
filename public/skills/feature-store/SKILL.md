---
name: feature-store
description: Design and implement a feature store for ML — centralized feature computation, storage, serving, and reuse across models. Outputs online/offline store architecture, feature pipelines, point-in-time joins, and serving API.
argument-hint: [ML use cases, data sources, latency requirements, team size, existing infrastructure]
allowed-tools: Read, Write, Bash
---

# Feature Store

A feature store solves three ML engineering problems: training-serving skew (features computed differently at training vs. serving time), feature duplication (every team rebuilding the same features), and point-in-time correctness (using future data accidentally during training). A well-designed feature store makes features reliable, reusable, and fast.

## Architecture

```
Data Sources          Feature Pipelines         Storage             Serving
─────────────         ─────────────────         ───────             ───────
Transactions   ──▶   Batch transforms   ──▶    Offline store  ──▶  Training jobs
Events         ──▶   Streaming          ──▶    Online store   ──▶  Real-time API
User profiles  ──▶   On-demand          ──┘                   ──▶  Notebooks
```

## Process

1. **Define feature groups** — logical groupings (user features, item features, interaction features).
2. **Build offline pipeline** — batch computation for training data with point-in-time correctness.
3. **Build online pipeline** — low-latency serving for real-time inference.
4. **Implement feature serving API** — single endpoint for all model feature fetches.
5. **Add monitoring** — freshness, distribution drift, missing value rates.
6. **Register and document** — searchable catalog with owners, definitions, lineage.

## Output Format

### Feature Definition (Feast)

```python
# features/user_features.py
from datetime import timedelta
from feast import Entity, Feature, FeatureView, FileSource, ValueType, FeatureService
from feast.types import Float32, Int64, String, Bool
import pandas as pd

# Entity — the "who" features describe
user = Entity(
    name="user_id",
    value_type=ValueType.INT64,
    description="Unique user identifier",
    tags={"team": "platform", "pii": "false"},
)

item = Entity(
    name="item_id",
    value_type=ValueType.INT64,
    description="Product item identifier",
)

# Data source — where raw features come from
user_stats_source = FileSource(
    path="s3://ml-features/user_stats/",
    event_timestamp_column="event_timestamp",
    created_timestamp_column="created_timestamp",
)

# Feature view — group of related features with TTL
user_engagement_fv = FeatureView(
    name="user_engagement",
    entities=["user_id"],
    ttl=timedelta(days=1),    # Features expire after 1 day — triggers recomputation
    features=[
        Feature(name="session_count_7d",       dtype=Int64),
        Feature(name="session_count_30d",      dtype=Int64),
        Feature(name="avg_session_duration_s", dtype=Float32),
        Feature(name="purchase_count_7d",      dtype=Int64),
        Feature(name="purchase_count_30d",     dtype=Int64),
        Feature(name="total_spend_90d_usd",    dtype=Float32),
        Feature(name="days_since_last_active", dtype=Int64),
        Feature(name="is_subscriber",          dtype=Bool),
        Feature(name="preferred_category",     dtype=String),
    ],
    online=True,     # Also serve from online store (Redis)
    source=user_stats_source,
    tags={"team": "ml-platform", "version": "2.1"},
)

user_demographics_fv = FeatureView(
    name="user_demographics",
    entities=["user_id"],
    ttl=timedelta(days=30),   # Slower-changing features
    features=[
        Feature(name="account_age_days",   dtype=Int64),
        Feature(name="country_code",       dtype=String),
        Feature(name="signup_source",      dtype=String),
        Feature(name="device_type",        dtype=String),
    ],
    online=True,
    source=user_stats_source,
)

# Feature service — bundle features for a specific model
propensity_model_features = FeatureService(
    name="purchase_propensity_v2",
    features=[
        user_engagement_fv[["session_count_7d", "purchase_count_30d", "total_spend_90d_usd", "days_since_last_active", "is_subscriber"]],
        user_demographics_fv[["account_age_days", "country_code", "device_type"]],
    ],
    description="Features for purchase propensity model v2",
    tags={"model": "purchase-propensity", "version": "2"},
)
```

### Feature Pipeline (batch computation)

```python
# pipelines/user_engagement_pipeline.py
import pandas as pd
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window
from datetime import datetime, timezone

def compute_user_engagement_features(
    spark: SparkSession,
    events_path: str,
    output_path: str,
    as_of_date: datetime,
) -> None:
    """
    Compute user engagement features.
    as_of_date: compute features AS OF this date (for point-in-time correctness).
    """
    
    events = spark.read.parquet(events_path).filter(
        F.col("event_timestamp") <= as_of_date
    )
    
    # 7-day window
    w_7d = Window.partitionBy("user_id").orderBy("event_timestamp").rangeBetween(
        -7 * 86400, 0  # 7 days in seconds
    )
    
    # 30-day window
    w_30d = Window.partitionBy("user_id").orderBy("event_timestamp").rangeBetween(
        -30 * 86400, 0
    )
    
    # 90-day window for spend
    w_90d = Window.partitionBy("user_id").orderBy("event_timestamp").rangeBetween(
        -90 * 86400, 0
    )
    
    features = events.groupBy("user_id").agg(
        # Sessions
        F.countDistinct(
            F.when(F.col("event_type") == "session_start", F.col("session_id"))
            .filter(F.col("event_timestamp") >= F.date_sub(F.lit(as_of_date), 7))
        ).alias("session_count_7d"),
        
        F.countDistinct(
            F.when(F.col("event_type") == "session_start", F.col("session_id"))
            .filter(F.col("event_timestamp") >= F.date_sub(F.lit(as_of_date), 30))
        ).alias("session_count_30d"),
        
        # Average session duration (seconds)
        F.avg(
            F.when(F.col("event_type") == "session_end", F.col("session_duration_s"))
        ).alias("avg_session_duration_s"),
        
        # Purchases
        F.sum(
            F.when(
                (F.col("event_type") == "purchase") &
                (F.col("event_timestamp") >= F.date_sub(F.lit(as_of_date), 7)),
                1
            ).otherwise(0)
        ).alias("purchase_count_7d"),
        
        F.sum(
            F.when(
                (F.col("event_type") == "purchase") &
                (F.col("event_timestamp") >= F.date_sub(F.lit(as_of_date), 30)),
                1
            ).otherwise(0)
        ).alias("purchase_count_30d"),
        
        # Total spend (90 days)
        F.sum(
            F.when(
                (F.col("event_type") == "purchase") &
                (F.col("event_timestamp") >= F.date_sub(F.lit(as_of_date), 90)),
                F.col("amount_usd")
            ).otherwise(0)
        ).alias("total_spend_90d_usd"),
        
        # Recency
        F.datediff(
            F.lit(as_of_date),
            F.max("event_timestamp")
        ).alias("days_since_last_active"),
        
        # Most frequent category
        F.first(
            F.col("category"),
            ignorenulls=True
        ).alias("preferred_category"),
    ).withColumn(
        "event_timestamp", F.lit(as_of_date)
    ).withColumn(
        "created_timestamp", F.lit(datetime.now(timezone.utc))
    )
    
    features.write.mode("overwrite").parquet(output_path)
    print(f"Wrote {features.count():,} user feature rows to {output_path}")
```

### Point-in-Time Correct Training Dataset

```python
# training/feature_retrieval.py
from feast import FeatureStore
import pandas as pd
from datetime import datetime

def build_training_dataset(
    entity_df: pd.DataFrame,   # Must have: user_id, event_timestamp, label
    feature_service_name: str,
    output_path: str = None,
) -> pd.DataFrame:
    """
    Retrieve features as-of each event_timestamp in entity_df.
    This is point-in-time correct: no future data leakage.
    
    entity_df example:
      user_id | event_timestamp           | label
      1001    | 2024-01-15 10:30:00+00:00 | 1
      1002    | 2024-01-16 14:22:00+00:00 | 0
    """
    store = FeatureStore(repo_path=".")
    
    # Historical retrieval joins features as-of each row's timestamp
    training_df = store.get_historical_features(
        entity_df=entity_df,
        features=store.get_feature_service(feature_service_name),
    ).to_df()
    
    # Check for training-serving skew indicators
    null_rates = training_df.isnull().mean()
    high_null = null_rates[null_rates > 0.05]
    if not high_null.empty:
        print(f"Warning: high null rates in features: {high_null.to_dict()}")
    
    if output_path:
        training_df.to_parquet(output_path, index=False)
    
    return training_df


# Usage
entity_df = pd.read_parquet("s3://ml-data/propensity/training_entities.parquet")
training_data = build_training_dataset(
    entity_df=entity_df,
    feature_service_name="purchase_propensity_v2",
    output_path="s3://ml-data/propensity/training_features_20240201.parquet"
)

print(f"Training set: {len(training_data):,} rows, {len(training_data.columns)} features")
```

### Online Feature Serving API

```python
# serving/feature_server.py
from fastapi import FastAPI, HTTPException
from feast import FeatureStore
from pydantic import BaseModel
import time
from prometheus_client import Histogram, Counter

app = FastAPI()
store = FeatureStore(repo_path=".")

feature_latency = Histogram("feature_serving_latency_seconds", "Feature serving latency", ["service"])
feature_errors = Counter("feature_serving_errors_total", "Feature serving errors", ["service", "error"])

class FeatureRequest(BaseModel):
    entity_rows: list[dict]     # [{"user_id": 1001}, {"user_id": 1002}]
    feature_service: str        # "purchase_propensity_v2"

class FeatureResponse(BaseModel):
    features: list[dict]
    latency_ms: float
    missing_values: int

@app.post("/features", response_model=FeatureResponse)
async def get_features(req: FeatureRequest):
    start = time.perf_counter()
    
    try:
        feature_vector = store.get_online_features(
            features=store.get_feature_service(req.feature_service),
            entity_rows=req.entity_rows,
        ).to_dict()
    except Exception as e:
        feature_errors.labels(service=req.feature_service, error=type(e).__name__).inc()
        raise HTTPException(500, detail=f"Feature retrieval failed: {e}")
    
    latency = (time.perf_counter() - start) * 1000
    feature_latency.labels(service=req.feature_service).observe(latency / 1000)
    
    # Pivot from column-oriented to row-oriented
    n = len(req.entity_rows)
    features = []
    missing = 0
    
    for i in range(n):
        row = {}
        for key, values in feature_vector.items():
            val = values[i]
            row[key] = val
            if val is None:
                missing += 1
        features.append(row)
    
    return FeatureResponse(
        features=features,
        latency_ms=round(latency, 2),
        missing_values=missing
    )

@app.get("/features/freshness/{feature_view}")
async def check_freshness(feature_view: str):
    """Check when features were last updated."""
    # Implementation would query the feature store metadata
    return {"feature_view": feature_view, "last_updated": "2024-02-15T06:00:00Z", "ttl_hours": 24}
```

### Feature Monitoring

```python
# monitoring/feature_monitor.py
from scipy import stats
import numpy as np

class FeatureMonitor:
    def __init__(self, reference_stats: dict):
        self.reference = reference_stats  # Stats from training data
    
    def check_distribution_drift(
        self,
        feature_name: str,
        current_values: list,
        threshold: float = 0.05
    ) -> dict:
        if feature_name not in self.reference:
            return {"status": "no_baseline", "feature": feature_name}
        
        ref = self.reference[feature_name]
        current = np.array([v for v in current_values if v is not None])
        
        if len(current) < 30:
            return {"status": "insufficient_data", "feature": feature_name}
        
        # KS test for drift
        stat, p_value = stats.ks_2samp(ref["sample"], current)
        
        # Missing value rate
        null_rate = sum(1 for v in current_values if v is None) / len(current_values)
        null_drift = abs(null_rate - ref.get("null_rate", 0)) > 0.05
        
        return {
            "feature": feature_name,
            "ks_statistic": round(float(stat), 4),
            "p_value": round(float(p_value), 4),
            "drift_detected": p_value < threshold,
            "null_rate": round(null_rate, 4),
            "null_rate_drift": null_drift,
            "current_mean": round(float(current.mean()), 4) if len(current) > 0 else None,
            "reference_mean": ref.get("mean"),
        }
```

## Rules

- **Point-in-time correctness is non-negotiable** — any feature computed with future data will inflate training metrics and fail in production.
- **One definition, many consumers** — features defined once in the store, reused by all models; no team recomputes `user_purchase_count_30d` independently.
- **Online and offline must match** — training-serving skew is the #1 source of silent model degradation; use the same feature definitions for both.
- **TTLs are business decisions** — a 7-day session count with a 30-day TTL is stale and misleading; TTL must be shorter than the feature's temporal validity.
- **Null rates are a feature of the feature** — track and alert on them; sudden null rate increases indicate upstream data pipeline failures.
- **Feature freshness is an SLA** — models depending on real-time features need freshness guarantees; define and monitor them.
- **Register everything** — undocumented features are unmaintainable; every feature needs an owner, definition, and lineage.
- **Version feature services with models** — when retraining, pin to the feature service version used during training.
- **Backfill is expensive — plan for it** — adding a new feature to historical training data requires backfilling; design pipelines to make this feasible.
- **Test with production-like null rates** — test sets should have the same null rates as production; filling nulls in tests but not production causes skew.
