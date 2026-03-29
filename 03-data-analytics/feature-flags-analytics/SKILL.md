---
name: feature-flags-analytics
description: Analyse feature flag experiments to measure impact on key metrics. Outputs statistical test selection, sample size calculation, results interpretation, and ship/no-ship decision framework.
argument-hint: [metric type, expected effect size, traffic volume, experiment duration, platform]
allowed-tools: Read, Write, Bash
---

# Feature Flag Analytics

Feature flags enable controlled experiments — route X% of users to a new experience and measure the impact. Interpreting results correctly requires proper statistical testing, sufficient sample sizes, and avoiding common pitfalls like peeking, novelty effects, and SUTVA violations.

## Experiment Design

```python
from scipy import stats
import numpy as np
from math import ceil

def calculate_sample_size(
    baseline_rate: float,  # Current conversion rate (e.g., 0.05 = 5%)
    minimum_detectable_effect: float,  # Relative MDE (e.g., 0.10 = 10% lift)
    alpha: float = 0.05,   # Significance level
    power: float = 0.80,   # Statistical power
) -> int:
    """Calculate minimum sample size per variant."""
    p1 = baseline_rate
    p2 = baseline_rate * (1 + minimum_detectable_effect)
    
    # Z-scores
    z_alpha = stats.norm.ppf(1 - alpha / 2)  # Two-tailed
    z_beta = stats.norm.ppf(power)
    
    pooled_p = (p1 + p2) / 2
    
    n = (z_alpha * np.sqrt(2 * pooled_p * (1 - pooled_p)) +
         z_beta * np.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2
    n /= (p2 - p1) ** 2
    
    return ceil(n)

# Example: Checkout conversion rate (5%), want to detect 10% lift
n = calculate_sample_size(0.05, 0.10)
print(f"Sample size needed: {n:,} per variant")
print(f"With 1000 conversions/day: {ceil(n*2/1000)} days minimum")
```

## Results Analysis

```python
from scipy.stats import chi2_contingency, ttest_ind
from dataclasses import dataclass

@dataclass
class ExperimentResult:
    metric: str
    control_n: int
    control_value: float
    variant_n: int
    variant_value: float
    relative_lift: float
    p_value: float
    confidence_interval: tuple
    significant: bool
    practical_significance: bool
    decision: str

def analyse_conversion_experiment(
    control_conversions: int,
    control_visitors: int,
    variant_conversions: int,
    variant_visitors: int,
    metric_name: str = "conversion_rate",
    alpha: float = 0.05,
    min_practical_effect: float = 0.02,  # 2pp minimum to ship
) -> ExperimentResult:
    control_rate = control_conversions / control_visitors
    variant_rate = variant_conversions / variant_visitors
    
    # Chi-squared test for proportions
    contingency = [[control_conversions, control_visitors - control_conversions],
                   [variant_conversions, variant_visitors - variant_conversions]]
    chi2, p_value, _, _ = chi2_contingency(contingency)
    
    # 95% confidence interval for difference
    diff = variant_rate - control_rate
    se = np.sqrt(control_rate*(1-control_rate)/control_visitors +
                 variant_rate*(1-variant_rate)/variant_visitors)
    ci = (diff - 1.96*se, diff + 1.96*se)
    
    relative_lift = (variant_rate - control_rate) / control_rate
    significant = p_value < alpha
    practical = abs(diff) >= min_practical_effect
    
    # Decision logic
    if significant and practical and relative_lift > 0:
        decision = "SHIP — statistically and practically significant improvement"
    elif significant and relative_lift < 0:
        decision = "NO SHIP — statistically significant harm"
    elif not significant:
        decision = "NO SHIP — insufficient evidence (increase sample size or accept null)"
    else:
        decision = "JUDGEMENT CALL — statistically significant but below practical threshold"
    
    return ExperimentResult(
        metric=metric_name,
        control_n=control_visitors, control_value=control_rate,
        variant_n=variant_visitors, variant_value=variant_rate,
        relative_lift=relative_lift,
        p_value=p_value,
        confidence_interval=ci,
        significant=significant,
        practical_significance=practical,
        decision=decision,
    )

# Example results output
result = analyse_conversion_experiment(
    control_conversions=487, control_visitors=9740,   # 5.0% rate
    variant_conversions=538, variant_visitors=9682,   # 5.56% rate
)
print(f"Lift: {result.relative_lift:.1%}")
print(f"p-value: {result.p_value:.4f}")
print(f"CI: ({result.confidence_interval[0]:.3f}, {result.confidence_interval[1]:.3f})")
print(f"Decision: {result.decision}")
```

## Common Pitfalls

```markdown
## Pitfall 1: Peeking (Early Stopping)
Problem: Checking results daily and stopping when p < 0.05 inflates false positives.
Fix: Define stopping rules upfront. Use sequential testing (always-valid p-values) 
     if you must peek: statsig, CUPED, or Bayesian methods.

## Pitfall 2: Novelty Effect
Problem: New features show short-term lift from curiosity; fades after 1-2 weeks.
Fix: Run experiments for at least 2× the novelty window (typically 2-4 weeks).
     Check: Does lift persist in the last week vs the first week?

## Pitfall 3: Network Effects (SUTVA Violation)
Problem: Control and variant users interact (referrals, social features).
Fix: Cluster randomisation (randomise by group, not individual).
     Or: Accept potential underestimate of true effect.

## Pitfall 4: Multiple Comparisons
Problem: Testing 20 metrics gives ~1 false positive by chance (p<0.05).
Fix: Pre-specify 1-2 primary metrics. Apply Bonferroni correction for secondary.

## Pitfall 5: Simpson's Paradox
Problem: Aggregate result hides opposite segment results.
Fix: Always segment results by major dimensions (new vs returning, mobile vs desktop).
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Stopping early on positive results** | Inflated false positives | Pre-commit to sample size; don't stop early |
| **No guardrail metrics** | Conversion improves but satisfaction tanks | Always define guardrails before starting |
| **Testing everything at once** | Can't attribute effect to single change | One change per experiment |
| **Underpowered experiments** | "No effect" actually means "couldn't detect" | Calculate sample size first; don't run underpowered |
| **Ignoring segment results** | Positive aggregate hides harm to key segments | Segment analysis is mandatory |

## 10 Rules

1. Calculate sample size before starting — don't stop when you see significance.
2. Pre-specify primary metrics and guardrails — changing them post-hoc is p-hacking.
3. Run experiments for at least 2 weeks — novelty effects distort early results.
4. Statistical significance is necessary but not sufficient — require practical significance too.
5. Segment results by new/returning, mobile/desktop, plan tier — aggregates hide important patterns.
6. A non-significant result means "we don't have enough evidence" — not "no effect".
7. Check guardrail metrics — a conversion win that harms NPS is not a win.
8. Document every experiment decision — why you ran it, what you found, what you shipped.
9. Ship only when both statistically and practically significant in the right direction.
10. Holdback 5% of users from major launches — compare 3 months later to measure long-term impact.
