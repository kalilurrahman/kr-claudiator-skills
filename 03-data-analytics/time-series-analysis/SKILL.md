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
