---
name: slos-and-error-budgets
description: Define Service Level Objectives and manage error budgets for reliability engineering. Outputs SLI/SLO definitions, error budget calculations, burn rate alerts, and reliability review process.
argument-hint: [service criticality, current availability, user impact, monitoring stack]
allowed-tools: Read, Write
---

# SLOs and Error Budgets

SLOs (Service Level Objectives) define the reliability target for a service. Error budgets are the allowed amount of unreliability — the difference between 100% and your SLO. When you have budget remaining, you ship features. When it's exhausted, you focus on reliability.

## SLI → SLO → SLA

```
SLI (Service Level Indicator):
  A quantitative measure of service behaviour
  Example: % of HTTP requests returning 2xx in a 5-minute window

SLO (Service Level Objective):
  Target for an SLI over a time window
  Example: 99.9% of requests return 2xx over 30 days

SLA (Service Level Agreement):
  External commitment with financial consequences for breaching SLO
  Example: 99.5% uptime or 10% refund

Error Budget:
  100% - SLO target = allowed unreliability
  99.9% SLO → 0.1% error budget = 43.8 minutes/month allowed downtime
```

## SLO Definitions

```yaml
# slo-definitions.yaml

services:
  checkout-api:
    slos:
      - name: availability
        description: "Fraction of successful checkout API requests"
        sli:
          type: request_success_rate
          good_events: "http_requests_total{status=~'2..',service='checkout'}"
          total_events: "http_requests_total{service='checkout'}"
        target: 0.999          # 99.9%
        window: 30d
        error_budget_minutes: 43.8
        
      - name: latency
        description: "Fraction of requests completing under 500ms"
        sli:
          type: request_latency
          threshold_ms: 500
          metric: "http_request_duration_seconds_bucket"
        target: 0.99           # 99% under 500ms
        window: 30d
```

## Error Budget Calculation

```python
from datetime import datetime, timedelta

class ErrorBudget:
    def __init__(self, slo_target: float, window_days: int = 30):
        self.slo_target = slo_target
        self.window_days = window_days
        self.window_minutes = window_days * 24 * 60

    @property
    def allowed_downtime_minutes(self) -> float:
        return self.window_minutes * (1 - self.slo_target)

    def remaining(self, current_success_rate: float) -> dict:
        actual_error_rate = 1 - current_success_rate
        budget_error_rate = 1 - self.slo_target
        consumed = actual_error_rate / budget_error_rate if budget_error_rate > 0 else 0
        remaining_pct = max(0, 1 - consumed)
        return {
            "slo_target": f"{self.slo_target:.3%}",
            "current_rate": f"{current_success_rate:.4%}",
            "budget_consumed_pct": f"{consumed:.1%}",
            "budget_remaining_pct": f"{remaining_pct:.1%}",
            "remaining_minutes": remaining_pct * self.allowed_downtime_minutes,
            "policy": "ship" if remaining_pct > 0.25 else "freeze" if remaining_pct > 0 else "incident",
        }

budget = ErrorBudget(slo_target=0.999, window_days=30)
print(budget.remaining(current_success_rate=0.9985))
# {'slo_target': '99.900%', 'current_rate': '99.8500%', 'budget_consumed_pct': '50.0%', ...}
```

## Burn Rate Alerts (Prometheus)

```yaml
# prometheus/slo-alerts.yaml
groups:
  - name: slo_burn_rates
    rules:
      # Fast burn: consuming budget too quickly
      - alert: HighErrorBudgetBurnRate
        expr: |
          (
            sum(rate(http_requests_total{status!~"2..", service="checkout"}[1h]))
            / sum(rate(http_requests_total{service="checkout"}[1h]))
          ) > 14.4 * (1 - 0.999)
        for: 5m
        labels:
          severity: critical
          service: checkout
        annotations:
          summary: "Error budget burning at >14.4x — exhausted in <2 hours at this rate"
          runbook: "https://wiki/runbooks/checkout-slo"

      # Slow burn: will exhaust budget before month end
      - alert: ModerateBudgetBurn
        expr: |
          (
            sum(rate(http_requests_total{status!~"2..", service="checkout"}[6h]))
            / sum(rate(http_requests_total{service="checkout"}[6h]))
          ) > 6 * (1 - 0.999)
        for: 30m
        labels:
          severity: warning
```

## Error Budget Policy

```markdown
# Error Budget Policy

## Thresholds and Actions

| Budget Remaining | Status | Engineering Policy |
|-----------------|--------|-------------------|
| >50% | Green | Full feature velocity; normal process |
| 25-50% | Yellow | Caution; prioritise reliability work in next sprint |
| 5-25% | Orange | Freeze non-critical releases; investigate root causes |
| 0-5% | Red | Reliability freeze; all focus on incidents and fixes |
| 0% (exhausted) | Emergency | No releases without VP sign-off; postmortem required |

## Monthly Review
- Review error budget consumption in weekly SRE sync
- Postmortem required for any single incident consuming >20% of monthly budget
- SLO review annually: adjust target up if consistently hitting it; adjust down if chronically missing
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **SLO = 100%** | No error budget → fear of change | Set achievable target; perfection is unshippable |
| **Measuring uptime not user experience** | Service "up" but users erroring | Measure what users experience (success rate, latency) |
| **No error budget policy** | Budget exhausted but no action | Documented policy: what happens at each threshold |
| **Alerting on SLO violation, not burn rate** | Alert fires too late (budget gone) | Burn rate alerts — project ahead |
| **Single window SLO** | Miss short spikes or month-end cliff | Multi-window: 1h + 6h + 72h burn rates |

## 10 Rules

1. SLOs should be slightly below what you can achieve — a target you always hit isn't a target.
2. Measure user-facing indicators — success rate and latency — not internal "up/down".
3. Error budgets make reliability negotiations data-driven — budget remaining = can ship; exhausted = must fix.
4. Burn rate alerts fire before the budget is gone — not after.
5. Fast burn (1h window) pages; slow burn (6h window) tickets.
6. Document the error budget policy before the first budget crisis.
7. Postmortem any incident consuming >20% of monthly budget.
8. Review SLOs annually — tighten when consistently met; loosen when chronically missed.
9. SLAs are a subset of SLOs — set SLA below SLO to give yourself headroom.
10. Every team that owns a service should own its SLO — not just SRE.
