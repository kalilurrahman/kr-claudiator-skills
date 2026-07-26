---
name: growth-framework
description: Build a systematic growth framework covering acquisition, activation, retention, referral, and revenue. Outputs growth model, lever identification, experiment roadmap, and tracking dashboard.
argument-hint: [business model, growth stage, current bottleneck, team size, key channels]
allowed-tools: Read, Write
---

# Growth Framework

A growth framework makes growth systematic rather than opportunistic. It maps the full customer lifecycle, identifies the biggest bottlenecks, and generates a prioritised experiment roadmap. Growth is not a single tactic — it is a repeatable system for finding, fixing, and scaling the levers that move your North Star Metric.

## AARRR Growth Model (Pirate Metrics)

```
ACQUISITION  → ACTIVATION → RETENTION → REFERRAL → REVENUE
  How do         First        Do they      Do they    Do we
  users find     value        come back?   tell       make
  you?           moment?                   others?    money?

Each stage is a funnel:
- Measure conversion rate at each stage
- Identify the biggest drop-off (the bottleneck)
- Focus experiments on the bottleneck
```

## Growth Model Worksheet

```markdown
# Growth Model: [Product Name]

Date: 2024-03-15 | Owner: Growth Lead

## Funnel Metrics (current baseline)

| Stage | Metric | Current | Target | Gap |
|-------|--------|---------|--------|-----|
| ACQUISITION | Weekly new trial signups | 450 | 600 | 150 |
| ACTIVATION | Signup → first core action (7 days) | 28% | 45% | 17pp |
| RETENTION | Month 1 → Month 2 | 52% | 65% | 13pp |
| REFERRAL | Referred signups / total signups | 8% | 20% | 12pp |
| REVENUE | Trial → paid conversion (30 days) | 22% | 30% | 8pp |

## Bottleneck Analysis

Weakest conversion: ACTIVATION (28%) — biggest absolute gap from target.

Evidence: Cohort data shows:
  - 62% of trial users never complete the first core action
  - Users who complete first core action in day 1 have 5× higher trial→paid conversion
  - Hotjar shows average user abandons on step 4 of 8-step onboarding

Conclusion: Activation is the primary bottleneck. 
A 10pp improvement in activation → estimated +120 paid accounts/month.

## Primary Growth Lever This Quarter: ACTIVATION

Secondary lever: RETENTION (because Month 1→2 retention affects LTV more than acquisition)
```

## Growth Experiment Framework

```markdown
# Growth Experiment: Streamlined Onboarding

**Hypothesis:** If we reduce the first-run experience from 8 steps to 3 steps
(focusing on the single action that predicts retention), then activation rate
will increase from 28% to ≥38% because users will reach value before losing momentum.

**Lever:** Activation  
**Primary metric:** % of new users who complete "first core action" within 7 days  
**Guardrail metrics:** Support contacts per user (must not increase), feature adoption (must not decrease)

**Test design:**
- Control: Current 8-step onboarding (50%)
- Variant: 3-step "quick win" onboarding (50%)
- Duration: 3 weeks (for statistical significance at expected volume)
- Sample size required: 850 per arm (at 80% power, α=0.05, min detectable effect: 8pp)

**Expected impact if successful:**
+10pp activation → +45 new activated users/week → +10 paid conversions/week → +$15k MRR

**Implementation:**
- Feature flag in LaunchDarkly: `onboarding_v2`
- Engineering estimate: 5 days (1 sprint)
- Rollout: 50/50 split by user_id hash

**Success criteria:**
- Primary: activation rate ≥ 36% in variant (statistically significant)
- Run for minimum 3 weeks before reading results

**Owner:** @growth-pm | **Engineer:** @growth-eng
**Start:** 2024-03-18 | **Read:** 2024-04-08
```

## ICE Prioritisation Framework

```python
from dataclasses import dataclass

@dataclass
class GrowthExperiment:
    name: str
    impact: int      # 1-10: Expected impact on NSM if successful
    confidence: int  # 1-10: How confident we are it will work (based on evidence)
    ease: int        # 1-10: How easy to implement (10 = trivial)
    
    @property
    def ice_score(self) -> float:
        return (self.impact * self.confidence * self.ease) / 10

experiments = [
    GrowthExperiment("3-step onboarding",          impact=8, confidence=7, ease=6),
    GrowthExperiment("In-app referral program",    impact=7, confidence=5, ease=4),
    GrowthExperiment("Email reactivation campaign",impact=5, confidence=8, ease=9),
    GrowthExperiment("Pricing page redesign",      impact=6, confidence=4, ease=5),
    GrowthExperiment("Integration marketplace",    impact=9, confidence=4, ease=2),
    GrowthExperiment("Contextual upgrade prompts", impact=6, confidence=7, ease=7),
]

for e in sorted(experiments, key=lambda x: x.ice_score, reverse=True):
    print(f"{e.ice_score:.1f} | {e.name}")
    
# Output:
# 42.0 | 3-step onboarding
# 29.4 | Contextual upgrade prompts
# 28.0 | Email reactivation campaign
# 16.8 | Pricing page redesign
# 14.4 | In-app referral program
#  7.2 | Integration marketplace
```

## Experiment Roadmap Template

```markdown
# Growth Experiment Roadmap — Q2 2024

## In Progress
| Experiment | Stage | Hypothesis | Start | Read | Owner |
|-----------|-------|-----------|-------|------|-------|
| 3-step onboarding | Running | +10pp activation | Mar 18 | Apr 8 | @growth-pm |
| Email trigger: day 3 nudge | Design | +5pp activation | Apr 1 | Apr 22 | @lifecycle |

## Backlog (prioritised by ICE)
| # | Experiment | ICE | Expected impact | Confidence |
|---|-----------|-----|----------------|-----------|
| 1 | Contextual upgrade prompt | 29 | +2pp trial→paid | High |
| 2 | Reactivation email sequence | 28 | +50 churned accounts | High |
| 3 | Referral reward program | 14 | +10% viral coefficient | Medium |
| 4 | Pricing page A/B | 12 | +3pp conversion | Medium |

## Completed (Last 90 days)
| Experiment | Result | Impact | Decision |
|-----------|--------|--------|---------|
| Social proof on signup page | Win (+4pp activation) | +18 paid/mo | Shipped |
| Progress bar in onboarding | No effect (p=0.31) | — | Reverted |
| Annual plan discount offer | Win (+8% annual %) | +$8k MRR | Shipped |
```

## Viral / Referral Loop Design

```markdown
## Referral Program Design

### Why users would refer:
Evidence: Top referral motivation in NPS verbatims: "My team needs to use this too"
Insight: Referrals are product-driven (need colleagues) not incentive-driven

### Referral mechanics:
1. SHARING PROMPT: After first successful workflow, show:
   "You've automated [X] hours this month! Share with your team →"
   
2. REFERRAL INCENTIVE:
   Referrer: 1 free month for each referred user who activates
   Referee: 30-day extended trial (vs standard 14)
   
3. IN-PRODUCT VIRAL:
   Shared workflow links require signup to view
   PDF exports include "Made with [Product]" watermark (with opt-out)
   
4. TRACKING:
   referral_link_created: when user generates referral link
   referral_link_clicked: when referee clicks
   referral_signup: when referee signs up via link
   referral_activated: when referee completes first core action

### K-factor calculation:
K = (Invites sent per user) × (Conversion rate of invites)
K > 1 = viral growth (referrals > churn)
Current K = 0.22 × 0.08 = 0.018 (well below viral threshold)
Target K = 0.40 × 0.20 = 0.08 (still not viral but meaningful contribution)
```

## Growth Dashboard

```markdown
## Weekly Growth Metrics — Week of 2024-03-11

### Funnel
| Stage | This Week | Last Week | WoW | Target | Status |
|-------|-----------|-----------|-----|--------|--------|
| New Trials | 487 | 451 | +8% | 600 | 🟡 |
| Activation Rate (7d) | 31% | 28% | +3pp | 45% | 🟡 |
| M1→M2 Retention | 54% | 52% | +2pp | 65% | 🟡 |
| Trial→Paid (30d) | 23% | 22% | +1pp | 30% | 🟡 |

### Experiments Running
- Onboarding v2: Day 12 | Variant ahead (34% vs 28%) | Not significant yet (p=0.14)

### This Week's Key Action
Activation rate improving — attributed to Day 3 email nudge experiment (shipped last week)
Continue monitoring; schedule qualitative interviews with non-activating users
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Optimising acquisition when activation is broken** | More users entering a leaky funnel | Fix the biggest drop-off first |
| **Running too many experiments** | Split attention; insufficient traffic per experiment | 2-3 running at a time maximum |
| **Reading results too early** | Novelty effect and sampling errors | Define minimum run duration before starting |
| **No guardrails** | Activation improves but NPS drops | Define guardrail metrics upfront |
| **No experiment velocity tracking** | Teams do experiments but not systematically | Track experiments per quarter; target 4-6/quarter |
| **Ignoring qualitative data** | Quantitative shows what, not why | Pair every experiment with user interviews |

## 10 Rules

1. Fix the biggest bottleneck first — optimising a later funnel stage while losing at an earlier one is waste.
2. Impact × Confidence × Ease (ICE) prioritises experiments — gut feel doesn't scale.
3. Define success criteria before starting an experiment — never read early.
4. Run 2-3 experiments maximum at once — more is noise, not velocity.
5. Every experiment has a hypothesis, primary metric, and guardrail metric.
6. Sample size is calculated upfront — running until you see what you want is p-hacking.
7. Failed experiments are valuable — they rule out hypotheses and guide the next test.
8. Ship winning experiments immediately — learning without shipping is waste.
9. Retention compounds more than acquisition — a 10% improvement in retention beats a 30% increase in acquisition over 12 months.
10. Growth is a system — acquisition, activation, retention, referral, and revenue are interconnected; optimise the system, not just one stage.
