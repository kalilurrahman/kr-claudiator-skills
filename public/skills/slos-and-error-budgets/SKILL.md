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

---

## Deep Reference Playbook

The sections below extend this skill into a complete operating playbook so it can run end-to-end inside Claude Code, CoWork, or any agentic tool without further prompting. Pull only the sections you need for a given engagement.

### Inputs the skill must collect

Before producing any output, the skill confirms:

1. **Objective** — the single decision or artifact the user wants out of this session.
2. **Context** — system, team, customer, product, or domain the work sits inside.
3. **Constraints** — time, budget, headcount, regulatory, technical, political.
4. **Definition of done** — what "good" looks like and who signs it off.
5. **Audience** — who reads or consumes the output (engineer, exec, customer, regulator).
6. **Existing artifacts** — prior versions, related docs, dashboards, tickets.
7. **Risk appetite** — how reversible the decision is and how much ambiguity is acceptable.

If any of these are missing, the skill asks targeted clarifying questions before generating output. It never invents constraints the user did not state.

### Operating workflow

The canonical workflow for **Slos And Error Budgets** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

**Stage 1 — Frame.** Restate the problem in one paragraph. Name the decision, the deadline, the stakeholders, and the success metric. Surface assumptions explicitly so they can be challenged.

**Stage 2 — Diagnose.** Inventory the current state with concrete evidence: metrics, quotes, screenshots, configs, tickets. Separate facts from interpretations. Identify the two or three root causes that explain most of the gap, not the long tail of symptoms.

**Stage 3 — Design.** Generate at least two viable options. For each option, capture: what changes, who owns it, what it costs, what it unblocks, what it risks, and how it could fail. Recommend one with a written rationale.

**Stage 4 — Execute.** Convert the chosen option into a sequenced plan: milestones, owners, dependencies, gating checks, communication cadence, and rollback triggers. Anything that cannot be assigned an owner and a date is not yet a plan.

**Stage 5 — Validate.** Define how success will be measured, when the measurement happens, and what action follows each possible result. Schedule the retrospective before the work starts, not after.

### Outputs the skill produces

Depending on the request, the skill returns one or more of:

- A one-page brief suitable for an executive reader.
- A detailed working document for the delivery team.
- A decision record capturing the choice, the alternatives, and the rationale.
- A risk register with probability, impact, owner, and mitigation.
- A sequenced action plan with named owners and explicit due dates.
- A measurement plan tied to the success metric.
- A communication plan for stakeholders inside and outside the team.

Every artifact uses clear headings, short paragraphs, and tables where comparison helps. No filler. No restating the prompt. No hedging language when a recommendation is warranted.

### Decision logic and trade-offs

The skill applies the following heuristics when choices are not obvious:

- **Prefer reversible decisions** taken quickly over irreversible decisions taken slowly.
- **Optimise for the constraint that bites first** — usually time, attention, or trust, not money.
- **Default to the simplest design** that meets the stated definition of done; add complexity only when a specific requirement forces it.
- **Make the cost of being wrong visible** so the reader can judge whether the recommendation is proportionate.
- **Name the people**, not the roles, when assigning ownership; ambiguous ownership produces ambiguous outcomes.

### Anti-patterns the skill refuses to emit

| Anti-pattern | Why it fails | What the skill does instead |
|---|---|---|
| Generic best-practice list with no context | Reader cannot act on it | Tailors recommendations to the stated constraints |
| Recommendation without trade-offs | Hides the cost of being wrong | Names the price paid for the recommendation |
| Plan with no owners or dates | Cannot be executed or tracked | Assigns a named owner and a date to every action |
| Metrics theatre | Measures activity, not outcome | Ties every metric back to the user or business outcome |
| Boil-the-ocean scope | Nothing ships | Cuts scope to the smallest valuable slice |
| Buried recommendation | Reader misses the point | Leads with the recommendation in the first paragraph |

### Quality bar

The skill self-checks each output against these gates before returning it:

1. Can a busy executive understand the recommendation from the first 150 words?
2. Is every claim either evidenced, labelled as an assumption, or removed?
3. Does every action have an owner and a date?
4. Are the trade-offs of the recommendation stated honestly?
5. Is there a measurable success criterion?
6. Would the author be comfortable defending this artifact in a review meeting?

If any gate fails, the skill rewrites the section before returning it.

### Worked micro-example

> **Context:** Define Service Level Objectives and manage error budgets for reliability engineering. Outputs SLI/SLO definitions, error budget calculations, burn rate alerts, 
>
> **Frame:** the team needs a defensible recommendation within five working days; the audience is a cross-functional steering group; the cost of delay is higher than the cost of being slightly wrong.
>
> **Diagnose:** the dominant constraint is decision latency, not analytical depth. Existing data is sufficient for a directional call.
>
> **Design:** two viable options surfaced. Option A optimises for speed and reversibility. Option B optimises for completeness but slips the deadline by two weeks.
>
> **Execute:** Option A recommended. Plan sequenced into a two-week sprint with named owners, a mid-point checkpoint, and a clear rollback trigger.
>
> **Validate:** success measured against a single leading indicator at day 30 and a single lagging indicator at day 90. Retrospective scheduled for day 35.

### Cadence and follow-through

A one-shot artifact rarely changes outcomes. The skill recommends a lightweight cadence to keep the work alive:

- **Weekly:** owner posts a five-line status (done, doing, blocked, risk, ask).
- **Fortnightly:** steering group reviews leading indicators and unblocks dependencies.
- **Monthly:** retrospective on what the data is teaching the team; adjust plan accordingly.
- **Quarterly:** revisit the original objective and decide whether to continue, pivot, or stop.

### Closing rules of thumb

1. Lead with the recommendation; supporting analysis follows.
2. Treat every output as a draft that will be challenged; pre-empt the obvious objections.
3. Prefer one strong recommendation over three weak options.
4. When the evidence is thin, say so; do not launder uncertainty as confidence.
5. Optimise for the next decision, not for the perfect document.
6. Make it easy for the reader to disagree with you in a structured way.
7. Ship the artifact; iterate against feedback rather than in private.
