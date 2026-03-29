---
name: forecasting-models
description: Build time-series forecasting models for business metrics. Outputs model selection framework, Prophet/ARIMA implementation, evaluation methodology, production serving pattern, and uncertainty quantification.
argument-hint: [metric to forecast, data frequency, horizon, seasonality patterns, accuracy requirements]
allowed-tools: Read, Write, Bash
---

# Forecasting Models

Forecasting predicts future values of a time series: revenue, demand, traffic, capacity. Good forecasting requires understanding trend, seasonality, holidays, and exogenous variables. The best model is often not the most complex — a well-tuned baseline beats a poorly-tuned neural network.

## Model Selection Guide

```
< 2 years data, clear seasonality, need interpretability
→ Prophet (Meta) — excellent defaults; handles missing data; holidays

Stationary data, no clear seasonality
→ ARIMA / SARIMA — classical; well-understood; interpretable

Multiple related series (1000 products)
→ LightGBM/XGBoost with lag features — scales; captures cross-series

Long sequences, complex patterns, large data
→ Temporal Fusion Transformer — highest accuracy; needs much more data

ALWAYS BEAT THESE BASELINES FIRST:
  Naive:           forecast = last observed value
  Seasonal naive:  forecast = same period last year
  Moving average:  forecast = mean of last N periods
```

## Prophet Implementation

```python
from prophet import Prophet
from prophet.diagnostics import cross_validation, performance_metrics
import pandas as pd
import numpy as np

def train_revenue_forecast(df: pd.DataFrame) -> dict:
    """
    df columns: 'ds' (datetime) and 'y' (metric value)
    """
    model = Prophet(
        growth="linear",
        seasonality_mode="multiplicative",  # Revenue has multiplicative seasonality
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        changepoint_prior_scale=0.05,   # Regularisation
        interval_width=0.95,            # 95% prediction interval
    )

    model.add_seasonality(name="monthly", period=30.5, fourier_order=5)
    model.add_country_holidays(country_name="US")

    # Add regressors (external variables)
    model.add_regressor("marketing_spend")
    model.add_regressor("is_promotion")

    model.fit(df)

    # Forecast 90 days ahead
    future = model.make_future_dataframe(periods=90)
    future["marketing_spend"] = df["marketing_spend"].mean()
    future["is_promotion"] = 0

    forecast = model.predict(future)

    # Cross-validation evaluation
    cv_results = cross_validation(
        model,
        initial="365 days",  # Train on first year
        period="30 days",     # Retrain every 30 days
        horizon="90 days",    # Forecast 90 days ahead
        parallel="processes",
    )

    metrics = performance_metrics(cv_results)
    return {
        "model": model,
        "forecast": forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]],
        "mape": metrics["mape"].mean(),
        "coverage": metrics["coverage"].mean(),
    }
```

## SARIMA for Stationary Series

```python
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.tsa.stattools import adfuller
import itertools

def auto_sarima(series: pd.Series, seasonal_period: int = 12) -> dict:
    """Grid search for best SARIMA parameters."""
    adf_stat, p_value, *_ = adfuller(series.dropna())
    d_range = range(0, 2) if p_value > 0.05 else range(0, 1)

    best_aic = float("inf")
    best_model = None

    for p, d, q in itertools.product(range(0,3), d_range, range(0,3)):
        for P, D, Q in itertools.product(range(0,2), range(0,2), range(0,2)):
            try:
                model = SARIMAX(
                    series,
                    order=(p, d, q),
                    seasonal_order=(P, D, Q, seasonal_period),
                    enforce_stationarity=False,
                ).fit(disp=False)
                if model.aic < best_aic:
                    best_aic = model.aic
                    best_model = model
            except Exception:
                continue

    forecast = best_model.forecast(steps=12)
    ci = best_model.get_forecast(steps=12).conf_int()
    return {"model": best_model, "aic": best_aic, "forecast": forecast, "confidence_intervals": ci}
```

## Evaluation Framework

```python
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error, mean_squared_error

def evaluate_forecast(actuals: np.ndarray, predictions: np.ndarray,
                       lower: np.ndarray = None, upper: np.ndarray = None) -> dict:
    mae  = mean_absolute_error(actuals, predictions)
    mape = mean_absolute_percentage_error(actuals, predictions) * 100
    rmse = np.sqrt(mean_squared_error(actuals, predictions))
    bias = float(np.mean(predictions - actuals))  # Systematic over/under-prediction

    metrics = {"MAE": mae, "MAPE_pct": mape, "RMSE": rmse, "Bias": bias}

    if lower is not None and upper is not None:
        within = float(((actuals >= lower) & (actuals <= upper)).mean())
        metrics["PI_coverage_95pct"] = within * 100

    return metrics

# Always compare against baselines
def seasonal_naive(series: pd.Series, horizon: int, period: int = 12) -> np.ndarray:
    return np.array([series.iloc[-(period - (i % period))] for i in range(horizon)])
```

## Production Serving

```python
import mlflow
import mlflow.pyfunc
from datetime import datetime

class ForecastModel(mlflow.pyfunc.PythonModel):
    def load_context(self, context):
        import pickle
        with open(context.artifacts["model"], "rb") as f:
            self.model = pickle.load(f)

    def predict(self, context, model_input: pd.DataFrame) -> pd.DataFrame:
        # model_input: DataFrame with 'periods' and optional regressors
        horizon = model_input["periods"].iloc[0]
        future = self.model.make_future_dataframe(periods=horizon)

        for col in model_input.columns:
            if col not in ["periods"] and col in future.columns:
                future[col] = model_input[col].iloc[0]

        forecast = self.model.predict(future)
        return forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]].tail(horizon)

# Deploy
with mlflow.start_run():
    mlflow.pyfunc.log_model(
        "revenue_forecast",
        python_model=ForecastModel(),
        artifacts={"model": "prophet_model.pkl"},
        registered_model_name="revenue-forecast-v2",
    )
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Skipping the baseline** | Complex model might not beat naive | Always compare against seasonal naive first |
| **Evaluating on training data** | Overfitting invisible | Time-series cross-validation only |
| **Point forecast only** | No uncertainty quantification | Always report prediction intervals |
| **Ignoring seasonality** | Forecasts miss predictable patterns | Visualise decomposition; add seasonal component |
| **Static model** | Distribution shifts make model stale | Retrain on rolling window; monitor actuals vs forecast |

## 10 Rules

1. Beat the seasonal naive baseline before claiming a model works.
2. Time-series cross-validation only — never evaluate on training data.
3. Report prediction intervals — point forecasts without uncertainty are misleading.
4. Decompose the series first: trend + seasonality + residuals — understand before modelling.
5. MAPE breaks on near-zero values — use MAE for absolute accuracy comparison.
6. Residuals should be white noise — systematic patterns mean the model is missing something.
7. Retrain on a rolling window — models go stale as patterns change.
8. Monitor forecast accuracy in production — alert when MAPE degrades significantly.
9. Exogenous variables (marketing spend, holidays) often improve accuracy more than model complexity.
10. Quantify the cost of over- and under-prediction to choose the right accuracy metric.
