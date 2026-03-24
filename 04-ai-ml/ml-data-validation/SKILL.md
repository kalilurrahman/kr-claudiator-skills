---
name: ml-data-validation
description: Validate training and inference data for ML pipelines. Outputs schema contracts, statistical validation rules, drift detection, and data quality gates before model training.
argument-hint: [model type, data sources, training frequency, feature count, known data issues]
allowed-tools: Read, Write, Bash
---

# ML Data Validation

Garbage in, garbage out. ML data validation catches schema violations, statistical anomalies, and distribution drift before they corrupt model training or silently degrade inference. Without it, data issues manifest as mysterious model performance degradation weeks after the root cause.

## Process

1. **Define the schema contract.** Expected columns, types, value ranges, and cardinalities.
2. **Compute reference statistics.** On a known-good training dataset: mean, std, percentiles, null rates, category distributions.
3. **Set validation rules.** What deviations are acceptable? What trigger a warning vs a block?
4. **Validate at every pipeline stage.** Raw data ingestion, feature engineering, training data split, inference input.
5. **Detect drift.** Compare current data distribution against the reference. Alert when drift exceeds threshold.
6. **Gate on validation.** Training blocked if critical validations fail.
7. **Log all validation results.** Track data quality trends over time.

## Great Expectations Suite

```python
import great_expectations as ge
from great_expectations.core import ExpectationSuite
import pandas as pd

# Load or create expectation suite
context = ge.get_context()

# Build expectations from known-good data
def build_expectations_from_data(df: pd.DataFrame, suite_name: str) -> ExpectationSuite:
    validator = context.sources.pandas_default.read_dataframe(df)
    validator.expectation_suite_name = suite_name
    
    for col in df.columns:
        # Always: no unexpected nulls
        null_rate = df[col].isna().mean()
        if null_rate == 0:
            validator.expect_column_values_to_not_be_null(col)
        elif null_rate < 0.05:
            validator.expect_column_values_to_not_be_null(col,
                mostly=1 - null_rate * 1.5)  # Allow 50% more nulls than baseline
        
        if df[col].dtype in ['int64', 'float64']:
            q1, q99 = df[col].quantile([0.01, 0.99])
            validator.expect_column_values_to_be_between(col,
                min_value=float(q1 * 0.5 if q1 > 0 else q1 * 2),
                max_value=float(q99 * 2 if q99 > 0 else q99 * 0.5),
                mostly=0.99,
            )
            validator.expect_column_mean_to_be_between(col,
                min_value=float(df[col].mean() * 0.7),
                max_value=float(df[col].mean() * 1.3),
            )
        
        elif df[col].dtype == 'object':
            unique_count = df[col].nunique()
            if unique_count <= 50:  # Categorical
                validator.expect_column_values_to_be_in_set(col,
                    value_set=set(df[col].dropna().unique()))
    
    validator.save_expectation_suite(discard_failed_expectations=False)
    return validator.get_expectation_suite()

# Validate new data against expectations
def validate_dataset(df: pd.DataFrame, suite_name: str) -> dict:
    validator = context.sources.pandas_default.read_dataframe(df)
    results = validator.validate(expectation_suite_name=suite_name)
    
    summary = {
        "success": results.success,
        "total_expectations": len(results.results),
        "failed": sum(1 for r in results.results if not r.success),
        "critical_failures": [
            r.expectation_config.expectation_type
            for r in results.results
            if not r.success and r.expectation_config.meta.get("severity") == "critical"
        ],
    }
    return summary
```

## Custom Validation Rules

```python
import pandas as pd
import numpy as np
from dataclasses import dataclass, field
from typing import Callable, List, Optional

@dataclass
class ValidationRule:
    name: str
    check: Callable[[pd.DataFrame], bool]
    severity: str   # 'critical' (block training) | 'warning' (alert only)
    message: str

@dataclass
class ValidationResult:
    rule: str
    passed: bool
    severity: str
    message: str
    details: dict = field(default_factory=dict)

class MLDataValidator:
    def __init__(self, reference_stats: dict = None):
        self.reference = reference_stats or {}
        self.rules: List[ValidationRule] = []
    
    def add_rule(self, rule: ValidationRule):
        self.rules.append(rule)
    
    def validate(self, df: pd.DataFrame) -> List[ValidationResult]:
        results = []
        for rule in self.rules:
            try:
                passed = rule.check(df)
                results.append(ValidationResult(
                    rule=rule.name, passed=passed,
                    severity=rule.severity, message=rule.message,
                ))
            except Exception as e:
                results.append(ValidationResult(
                    rule=rule.name, passed=False,
                    severity=rule.severity,
                    message=f"Rule execution failed: {e}",
                ))
        return results
    
    def gate(self, results: List[ValidationResult]) -> tuple[bool, List[str]]:
        """Returns (can_proceed, list_of_critical_failures)"""
        failures = [r.message for r in results if not r.passed and r.severity == "critical"]
        return len(failures) == 0, failures


# Build a validator for a churn prediction model
def build_churn_model_validator(reference_df: pd.DataFrame) -> MLDataValidator:
    validator = MLDataValidator()
    
    # Schema rules (critical)
    required_cols = ['user_id', 'days_since_last_login', 'total_purchases',
                     'support_tickets_30d', 'plan_type', 'is_churned']
    
    validator.add_rule(ValidationRule(
        name="required_columns_present",
        check=lambda df: all(c in df.columns for c in required_cols),
        severity="critical",
        message=f"Missing required columns: {required_cols}",
    ))
    
    # Label integrity (critical)
    validator.add_rule(ValidationRule(
        name="label_binary",
        check=lambda df: set(df['is_churned'].unique()).issubset({0, 1, True, False}),
        severity="critical",
        message="Label 'is_churned' must be binary (0/1)",
    ))
    
    # Minimum rows (critical)
    validator.add_rule(ValidationRule(
        name="sufficient_data",
        check=lambda df: len(df) >= 1000,
        severity="critical",
        message="Training set must have at least 1000 rows",
    ))
    
    # Label balance (warning)
    ref_churn_rate = reference_df['is_churned'].mean()
    validator.add_rule(ValidationRule(
        name="label_balance",
        check=lambda df: abs(df['is_churned'].mean() - ref_churn_rate) < 0.1,
        severity="warning",
        message=f"Churn rate deviates >10% from reference ({ref_churn_rate:.1%})",
    ))
    
    # No target leakage (critical)
    post_churn_cols = ['cancellation_date', 'refund_amount', 'exit_survey_response']
    validator.add_rule(ValidationRule(
        name="no_target_leakage",
        check=lambda df: not any(c in df.columns for c in post_churn_cols),
        severity="critical",
        message=f"Target leakage — remove post-churn columns: {post_churn_cols}",
    ))
    
    # Duplicate check (warning)
    validator.add_rule(ValidationRule(
        name="no_user_id_duplicates",
        check=lambda df: df['user_id'].duplicated().sum() == 0,
        severity="warning",
        message="Duplicate user_ids detected — verify train/test split",
    ))
    
    # Numeric range sanity (critical)
    validator.add_rule(ValidationRule(
        name="days_since_login_range",
        check=lambda df: df['days_since_last_login'].between(0, 3650).all(),
        severity="critical",
        message="days_since_last_login must be 0-3650",
    ))
    
    return validator
```

## Distribution Drift Detection

```python
from scipy import stats
import numpy as np

class DriftDetector:
    """Detect statistical drift between reference and current datasets."""
    
    def __init__(self, reference_df: pd.DataFrame):
        self.reference = reference_df
    
    def detect_drift(self, current_df: pd.DataFrame,
                     psi_threshold: float = 0.2,
                     ks_alpha: float = 0.05) -> dict:
        drift_report = {}
        
        for col in self.reference.columns:
            if col not in current_df.columns:
                drift_report[col] = {"status": "MISSING", "drift": True}
                continue
            
            if self.reference[col].dtype in ['int64', 'float64']:
                # KS test for continuous features
                stat, p_value = stats.ks_2samp(
                    self.reference[col].dropna(),
                    current_df[col].dropna()
                )
                # PSI for population stability
                psi = self._compute_psi(
                    self.reference[col].dropna(),
                    current_df[col].dropna()
                )
                drift_report[col] = {
                    "type": "continuous",
                    "ks_statistic": round(stat, 4),
                    "ks_p_value": round(p_value, 4),
                    "psi": round(psi, 4),
                    "drift": p_value < ks_alpha or psi > psi_threshold,
                    "severity": "critical" if psi > 0.25 else "warning" if psi > 0.1 else "ok",
                }
            
            elif self.reference[col].dtype == 'object':
                # Chi-squared for categorical
                ref_dist = self.reference[col].value_counts(normalize=True)
                cur_dist = current_df[col].value_counts(normalize=True)
                psi = self._compute_categorical_psi(ref_dist, cur_dist)
                drift_report[col] = {
                    "type": "categorical",
                    "psi": round(psi, 4),
                    "new_categories": list(set(current_df[col]) - set(self.reference[col])),
                    "drift": psi > psi_threshold,
                    "severity": "critical" if psi > 0.25 else "warning" if psi > 0.1 else "ok",
                }
        
        drifted = [col for col, r in drift_report.items() if r.get("drift")]
        return {
            "drifted_features": drifted,
            "drift_detected": len(drifted) > 0,
            "critical_drift": [c for c in drifted
                               if drift_report[c].get("severity") == "critical"],
            "details": drift_report,
        }
    
    def _compute_psi(self, reference: pd.Series, current: pd.Series,
                     bins: int = 10) -> float:
        breakpoints = np.percentile(reference, np.linspace(0, 100, bins + 1))
        breakpoints = np.unique(breakpoints)
        if len(breakpoints) < 2:
            return 0.0
        
        ref_counts, _ = np.histogram(reference, bins=breakpoints)
        cur_counts, _ = np.histogram(current, bins=breakpoints)
        
        ref_pct = (ref_counts + 1e-6) / len(reference)
        cur_pct = (cur_counts + 1e-6) / len(current)
        
        return float(np.sum((ref_pct - cur_pct) * np.log(ref_pct / cur_pct)))
    
    def _compute_categorical_psi(self, ref: pd.Series, cur: pd.Series) -> float:
        all_cats = set(ref.index) | set(cur.index)
        psi = 0.0
        for cat in all_cats:
            r = ref.get(cat, 1e-6)
            c = cur.get(cat, 1e-6)
            psi += (r - c) * np.log(r / c)
        return psi
```

## CI/CD Data Quality Gate

```python
# training_pipeline.py
def run_training_pipeline(data_path: str, model_output: str):
    df = pd.read_parquet(data_path)
    reference = pd.read_parquet("s3://ml-data/reference/churn_train_v1.parquet")
    
    # 1. Schema and quality validation
    validator = build_churn_model_validator(reference)
    results = validator.validate(df)
    can_proceed, failures = validator.gate(results)
    
    if not can_proceed:
        raise ValueError(f"Data validation failed — BLOCKING TRAINING:\n" +
                        "\n".join(failures))
    
    warnings = [r.message for r in results if not r.passed and r.severity == "warning"]
    if warnings:
        print(f"WARNING: {len(warnings)} data quality warnings:\n" + "\n".join(warnings))
    
    # 2. Drift detection
    detector = DriftDetector(reference)
    drift = detector.detect_drift(df)
    
    if drift["critical_drift"]:
        raise ValueError(f"Critical drift detected in features: {drift['critical_drift']}")
    
    if drift["drift_detected"]:
        print(f"WARNING: Drift detected in {len(drift['drifted_features'])} features")
    
    # 3. Proceed with training
    print("✓ Data validation passed — proceeding with training")
    train_model(df, model_output)
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Validating only at training** | Inference data can drift silently | Validate inference inputs in production |
| **Hard-coded thresholds** | Business context changes; thresholds become stale | Compute thresholds from reference data; review quarterly |
| **Blocking on all warnings** | Pipeline never runs | Distinguish critical (block) from warning (alert) |
| **No reference dataset** | Nothing to compare drift against | Snapshot the training dataset as the reference |
| **Ignoring feature distribution** | Training/serving skew degrades model | Compare feature distributions, not just schemas |
| **Skipping validation on retrain** | Assumes data quality is stable | Validate on every training run |
| **Logging only failures** | Can't track quality trends | Log all validation results; track quality scores over time |

## 10 Rules

1. Validate data at every stage: ingestion, feature engineering, train/test split, and inference.
2. Separate critical failures (block training) from warnings (alert team) — not everything needs to block.
3. Compute validation thresholds from reference data — don't hard-code them.
4. Drift detection requires a reference — snapshot the canonical training set on day one.
5. PSI > 0.2 is a critical drift signal requiring investigation before retraining.
6. Target leakage detection is mandatory — a high-performing model that leaks is worthless in production.
7. Duplicate check before train/test split — duplicates across the split inflate test performance.
8. Log all validation results with timestamps — you need the trend, not just pass/fail.
9. Test the validator itself — validation code that doesn't catch real issues is false confidence.
10. Validation gates are non-negotiable for production models — a pipeline that skips validation "just this once" will do it again.
