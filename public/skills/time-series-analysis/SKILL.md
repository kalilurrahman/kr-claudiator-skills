---
name: time-series-analysis
description: Analyse and model time series data for forecasting, anomaly detection, and trend analysis. Outputs decomposition approach, forecasting model selection, evaluation metrics, and production pipeline.
argument-hint: [metric type, seasonality patterns, forecast horizon, accuracy requirements]
allowed-tools: Read, Write, Bash
---

# Time Series Analysis

Time series data has temporal structure — order matters, recent values correlate with past values, and patterns repeat seasonally. Standard ML models that ignore this structure perform poorly. Time series analysis extracts trend, seasonality, and noise to enable accurate forecasting and anomaly detection.

## Decomposition

```python
from statsmodels.tsa.seasonal import seasonal_decompose
import pandas as pd
import numpy as np

# Load time series (daily sales)
df = pd.read_csv("sales.csv", parse_dates=["date"], index_col="date")
ts = df["revenue"].asfreq("D")

# Decompose into trend + seasonality + residual
result = seasonal_decompose(ts, model="multiplicative", period=7)  # 7=weekly

print(f"Trend range: {result.trend.min():.0f} - {result.trend.max():.0f}")
print(f"Seasonal range: {result.seasonal.min():.3f} - {result.seasonal.max():.3f}")
print(f"Residual std: {result.resid.std():.3f}")

# Visualise
result.plot()
```

## Forecasting with Prophet

```python
from prophet import Prophet
from prophet.diagnostics import cross_validation, performance_metrics
import pandas as pd

# Prepare data (Prophet requires ds, y columns)
df_prophet = df.reset_index().rename(columns={"date": "ds", "revenue": "y"})

# Define model with domain knowledge
model = Prophet(
    seasonality_mode="multiplicative",    # Revenue tends to scale multiplicatively
    yearly_seasonality=True,
    weekly_seasonality=True,
    daily_seasonality=False,
    changepoint_prior_scale=0.05,         # Smoothness of trend changes (lower = smoother)
    seasonality_prior_scale=10.0,
)

# Add custom seasonalities
model.add_seasonality(name="monthly", period=30.5, fourier_order=5)

# Add holidays
from prophet.make_holidays import make_holidays_df
holidays = make_holidays_df(year_list=[2023, 2024], country="US")
model = Prophet(holidays=holidays, holidays_prior_scale=10.0)

model.fit(df_prophet)

# Forecast 90 days forward
future = model.make_future_dataframe(periods=90)
forecast = model.predict(future)
print(forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]].tail(10))

# Cross-validation to measure accuracy
cv_results = cross_validation(
    model,
    initial="365 days",    # Train on 1 year
    period="30 days",      # Re-fit every 30 days
    horizon="90 days",     # Forecast 90 days ahead
)

metrics = performance_metrics(cv_results)
print(f"MAPE: {metrics['mape'].mean():.1%}")
print(f"RMSE: {metrics['rmse'].mean():.0f}")
```

## Anomaly Detection

```python
from statsmodels.tsa.statespace.sarimax import SARIMAX

def detect_anomalies(ts: pd.Series, sigma_threshold: float = 3.0) -> pd.Series:
    """Flag points more than N standard deviations from expected."""
    # Fit SARIMA model
    model = SARIMAX(ts, order=(1,1,1), seasonal_order=(1,1,1,7))
    result = model.fit(disp=False)
    
    # Get residuals
    residuals = result.resid
    mean_resid = residuals.mean()
    std_resid = residuals.std()
    
    # Anomalies are residuals beyond threshold
    anomalies = abs(residuals - mean_resid) > sigma_threshold * std_resid
    return anomalies

anomalies = detect_anomalies(ts)
print(f"Anomalous dates: {ts[anomalies].index.tolist()}")
```

## Evaluation Metrics

```python
def evaluate_forecast(actual: pd.Series, predicted: pd.Series) -> dict:
    errors = actual - predicted
    return {
        "MAE":  abs(errors).mean(),
        "RMSE": (errors**2).mean()**0.5,
        "MAPE": (abs(errors / actual)).mean() * 100,  # %
        "SMAPE": (2 * abs(errors) / (abs(actual) + abs(predicted))).mean() * 100,
        "bias": errors.mean(),  # Systematic over/under-forecast
    }
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Ignoring seasonality** | Trend model misses weekly/yearly patterns | Decompose first; model seasonality explicitly |
| **Training on test period** | Data leakage inflates accuracy metrics | Strict temporal train/test split |
| **Single point forecast only** | No uncertainty quantification | Always produce prediction intervals |
| **MAPE on near-zero values** | Division by zero / unstable metric | Use SMAPE or MAE for low-volume series |
| **One model for all series** | High-volume and low-volume metrics need different models | Cluster series; model per cluster |

## 10 Rules

1. Decompose before modelling — understand trend, seasonality, and noise separately.
2. Never use random train/test splits — always split by time (train on past; test on future).
3. Seasonal period must match domain knowledge — weekly for daily data, yearly for monthly.
4. Multiplicative seasonality for revenue — additive for metrics that can be negative.
5. Cross-validation uses walk-forward splits — not random k-fold.
6. Produce intervals, not just point forecasts — uncertainty is as important as the estimate.
7. MAPE is misleading for near-zero series — use SMAPE or MAE instead.
8. Residuals should be white noise — autocorrelated residuals mean the model missed structure.
9. Business events (promotions, holidays) are explicit features — don't let the model guess.
10. Forecast accuracy degrades with horizon — report accuracy at multiple forecast horizons.


## Deep dive: applying this in practice

The sections above describe *what* to produce. This section describes *how* practitioners actually run this in the field, including the conversations, artefacts, and review loops that turn a one-page recommendation into a sustained outcome.

### The 30/60/90 cadence

A recommendation that is never revisited is a recommendation that quietly fails. Bake review checkpoints in from day one:

- **Day 0 — Decision committed.** Owner, scope, success metrics, and the first-checkpoint date are recorded in the decision log. The artefact is linked from the team's working space so it is discoverable without asking.
- **Day 30 — Early-signal review.** Look at the leading indicators, not the lagging ones. Has the team actually started? Are the assumed dependencies real? Have any of the named risks materialised? Adjust scope, not the goal.
- **Day 60 — Course-correction window.** This is the last cheap moment to change direction. If the leading indicators are flat or negative, escalate. Silence at day 60 is the most expensive form of optimism.
- **Day 90 — Outcome review.** Measure against the success criteria captured on day 0, not against the story the team is telling now. Write the post-mortem (or pre-mortem-confirmed) in the same artefact so the rationale, the outcome, and the lessons live together.

### Stakeholder choreography

Decisions stall not because the analysis is wrong but because the choreography is wrong. Use a lightweight RACI on every recommendation:

| Role | Meaning | Anti-pattern |
|---|---|---|
| **Responsible** | Does the work | More than two people listed |
| **Accountable** | Owns the outcome, signs off | Shared accountability (always becomes no accountability) |
| **Consulted** | Two-way input before the decision | Consulted *after* the decision is made — purely performative |
| **Informed** | One-way notification after the decision | Informed people are asked to approve — wastes their time and yours |

If you cannot name a single Accountable person in one minute, the recommendation is not ready to ship.

### Writing for senior readers

Senior readers scan first, read second, and only re-read the parts they disagree with. Optimise for that pattern:

1. **Lead with the recommendation**, not the analysis. The reader should know what you want them to do before they finish the first paragraph.
2. **One screen, one page, one decision.** If the artefact needs scrolling on a laptop, it is too long for the audience it is written for.
3. **Tables beat paragraphs** for comparing options. Prose hides the trade-off; a table forces it into the open.
4. **Numbers beat adjectives.** Replace "significant" with the actual number. Replace "soon" with a date. Replace "improved" with a baseline and a target.
5. **Name the disconfirming evidence.** A recommendation that lists what would change the author's mind is read as honest; one that does not is read as advocacy.

### Common failure modes

| Failure mode | Symptom | Counter-move |
|---|---|---|
| **Analysis paralysis** | Weeks of investigation, no decision | Time-box the analysis. State the decision quality you can defend in the time available. |
| **HiPPO override** | Highest-paid person's opinion wins regardless of evidence | Force the trade-off table into the room before opinions are voiced |
| **Sunk-cost gravity** | Team defends the current path because of prior investment | Re-frame: what would we choose today with no prior investment? |
| **Scope creep at the checkpoint** | Review becomes a re-planning session | Separate "did this work?" from "what next?" Run them as two meetings. |
| **Stealth de-scoping** | Success metrics quietly soften between day 0 and day 90 | Lock the day-0 metrics into the artefact; require an explicit amendment to change them. |
| **Owner drift** | Accountable person leaves, no one re-assigns | Owner reassignment is a mandatory step in onboarding/offboarding the role |

### A worked example

> A product line is debating whether to invest in a major rewrite of a legacy service that has been failing under peak load.

A weak response: "We should rewrite it because the code is old."

A response that uses this skill:

> **Recommendation.** Do not rewrite. Invest one quarter in targeted performance work on the existing service and a parallel strangler-fig migration of the top two failing endpoints. Confidence: medium. Would change my mind if peak-load incidents continue at the current rate for two consecutive months after the performance work ships.
>
> **Options considered.** (1) Full rewrite — 9–12 months, ~$1.4M, high risk of partial delivery. (2) Performance fix in place — 6 weeks, ~$120K, addresses 80% of incident volume per last-quarter analysis. (3) Strangler-fig migration — 6 months for the two hottest endpoints, ~$400K, preserves optionality.
>
> **Plan.** Owner: Platform tech lead. Day 30: performance fix in staging with load test results. Day 60: production rollout and a 30-day incident-rate comparison. Day 90: decision on whether to expand the strangler-fig scope.
>
> **Risks.** (1) Performance fix masks a deeper architectural issue — mitigated by capturing flame graphs before and after. (2) Strangler-fig endpoints are not in fact the hottest ones — mitigated by re-running the traffic analysis at day 0. (3) Team capacity collides with a separate compliance deadline — escalated to the portfolio review on the next planning cycle.

That is the shape of output this skill should produce: a defensible, time-bound, owner-attached recommendation that respects the reader's time and survives turnover.

## Quick reference card

- One paragraph of context, three options with trade-offs, one recommendation with confidence, one plan with an owner and a date.
- If you cannot name the owner, the metric, and the checkpoint date in one breath, the artefact is not done.
- A decision without a written rationale is a rumour. A rationale without a checkpoint is a wish. A checkpoint without a metric is theatre.
- Reversibility matters more than people admit: one-way doors deserve the slow lane, two-way doors deserve the fast lane.
- The best artefacts in this category are short, dated, signed, and easy to find six months later.
