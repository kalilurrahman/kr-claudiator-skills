---
name: metrics-analyzer
description: Analyze a product or business metric, diagnose root causes, and produce a structured investigation report with hypotheses, supporting data, and recommended actions.
argument-hint: [metric name, current vs. target value, time period, available data sources]
allowed-tools: Read, Write
---

# Product Metrics Analyzer

Metric analysis is a structured diagnostic process. A drop in a metric rarely has an obvious cause; a thoughtful analyst considers multiple hypotheses, eliminates alternatives systematically, and reaches a defensible conclusion before recommending action.

## Metric Taxonomy

| Layer | Metric type | Examples |
|-------|------------|---------|
| Business | Revenue and growth | ARR, MRR, ACV, churn rate, NRR |
| Product | Engagement and activation | DAU/MAU, activation rate, feature adoption |
| Funnel | Conversion | Trial starts, trial-to-paid, onboarding completion |
| Health | Retention | Day-7, Day-30, Day-90 retention; NPS |
| Quality | Reliability | Uptime, error rate, P95 latency |

## Diagnostic Process

1. **Define the metric clearly** — what exactly is being measured? Include the exact SQL/Mixpanel definition.
2. **Establish the anomaly** — when did the change start? What is the magnitude? Is this statistically significant?
3. **Segment the metric** — does the change affect all users equally, or is it concentrated in a specific cohort?
4. **Generate hypotheses** — list all plausible causes before investigating any one of them.
5. **Prioritize hypotheses** — rank by prior probability and ease of validation.
6. **Investigate top 3** — pull the data to confirm or eliminate each hypothesis.
7. **Find the root cause** — the specific change (code, behavior, external event) that explains the anomaly.
8. **Quantify the impact** — how much of the metric change is explained by the root cause?
9. **Recommend action** — what should change, and by when?
10. **Set monitoring** — what alert would catch this sooner next time?

## Output Format

```markdown
# Metric Analysis: [Metric Name]
**Date:** [YYYY-MM-DD]
**Analyst:** [PM / Data analyst]
**Metric:** [e.g., Trial-to-paid conversion rate]
**Definition:** [e.g., % of trial accounts that upgrade to any paid plan within 14 days of starting trial]
**Data source:** [Mixpanel / Amplitude / Looker / SQL]

---

## Observation

| Period | Value | Change | vs. Target |
|--------|-------|--------|-----------|
| Q4 2024 (baseline) | 9.2% | — | 9.0% (on target) |
| Jan 2025 | 8.8% | -0.4pp | -0.2pp vs. target |
| Feb 2025 | 7.1% | -1.7pp | -1.9pp vs. target |
| Mar 2025 (MTD) | 6.4% | -0.7pp | -2.6pp vs. target |

**Summary:** Trial-to-paid conversion has declined 2.8pp over 10 weeks. At current trajectory, Q1 will miss the 9.5% target by approximately 3.1pp, implying ~$180K shortfall in new MRR.

---

## Segmentation Analysis

Break down the metric to locate where the change is concentrated:

### By Plan at Start of Trial

| Trial source | Q4 baseline | Mar MTD | Change |
|-------------|------------|---------|--------|
| Self-serve (organic) | 11.2% | 7.8% | -3.4pp |
| Sales-assisted | 18.4% | 18.1% | -0.3pp |
| Partner referral | 8.9% | 8.7% | -0.2pp |

**Finding:** Decline is concentrated in self-serve / organic trials. Sales-assisted is stable.

### By Trial Start Cohort

| Trial started | Conversion rate | N |
|--------------|----------------|---|
| Nov 2024 | 10.1% | 2,140 |
| Dec 2024 | 9.6% | 1,980 |
| Jan 2025 | 8.4% | 2,310 |
| Feb 2025 | 6.9% | 2,890 |
| Mar 2025 (early) | 6.1% | 1,420 |

**Finding:** Jan 2025 cohort shows first significant drop; Feb shows acceleration. Correlates with Jan 14 product release.

### By Funnel Step

| Step | Q4 rate | Mar rate | Change |
|------|---------|----------|--------|
| Trial start → Workspace setup | 67% | 65% | -2pp |
| Workspace setup → First value action | 41% | 28% | -13pp |
| First value → Invite team | 58% | 56% | -2pp |
| Invite team → Upgrade | 34% | 33% | -1pp |

**Finding:** Drop is concentrated at "Workspace setup → First value action." This step broke or became significantly harder.

---

## Hypotheses

| # | Hypothesis | Prior probability | Ease to validate |
|---|-----------|------------------|-----------------|
| H1 | Jan 14 release broke or degraded onboarding flow | High | Easy — check error logs |
| H2 | Pricing change made upgrade less compelling | Medium | Easy — check conversion by plan |
| H3 | New user segment (lower intent) inflating trial volume | Medium | Easy — check lead source |
| H4 | Competitor launched and is drawing higher-intent users | Low | Medium — check referral data |
| H5 | Seasonal effect (January post-holiday slump) | Low | Easy — check YoY January data |

---

## Investigation

### H1: Jan 14 release degraded onboarding

**Data pulled:**
- Session recordings (FullStory) for users who failed "first value action" step: Jan 1–13 vs. Jan 15–31
- Error logs for `/api/workspace/setup` endpoint: Jan 1–Feb 28

**Findings:**
- Error rate on `/api/workspace/setup` spiked from 0.4% to 3.2% after Jan 14 deploy
- Session recordings show 68% of failed users reached a blank white screen at step 3 of workspace setup
- The blank screen appears to be a regression in the new template library feature (release notes reference: "workspace templates v2")

**Verdict:** Confirmed. This explains ~60% of the conversion decline.

### H2: Pricing change made upgrade less compelling

**Data pulled:** Trial-to-paid by plan tier; upgrade page conversion rate

**Findings:**
- Upgrade page conversion is stable (31% click → 28% complete, same as Q4)
- No pricing change went live in Jan 2025 — rule out

**Verdict:** Eliminated.

### H3: New user segment has lower intent

**Data pulled:** Lead source breakdown (Jan vs. Q4); activation rate by source

**Findings:**
- Organic trial volume increased 38% in Jan (SEO campaign launched Dec 20)
- SEO-sourced users have 4.1% conversion vs. 11.2% for direct traffic
- SEO volume is now 31% of total trials (was 12% in Q4)

**Verdict:** Confirmed. This explains ~30% of conversion decline. The mix shift from higher-intent to lower-intent trials is a structural change.

---

## Root Cause Summary

| Cause | Impact | Confidence |
|-------|--------|-----------|
| Workspace setup regression (Jan 14 deploy) | ~1.7pp of the 2.8pp decline | High |
| Lead source mix shift (SEO campaign) | ~0.8pp of the 2.8pp decline | High |
| Unexplained residual | ~0.3pp | Low |

---

## Recommendations

### Immediate (this week)
1. **Hotfix workspace setup regression** — revert or patch the template library feature causing blank screen. ETA: 2 days. Owner: @eng-lead.
   - Expected recovery: +1.5–1.7pp conversion within 2 weeks

### Short-term (this quarter)
2. **Segment-specific onboarding for SEO traffic** — SEO users have lower intent; they need more guided activation. Consider a simplified onboarding flow for users who arrive without a specific job-to-be-done.
   - Expected recovery: +0.3–0.5pp conversion over 6 weeks

### Monitoring
3. **Add conversion funnel alert** — alert when any funnel step drops >3pp week-over-week for 2 consecutive weeks. This would have caught H1 in week 1 instead of week 6.
   - Owner: @data-eng. ETA: 1 sprint.

---

## Projected Outcome

| Scenario | Q1 ending conversion | Q1 new MRR |
|---------|---------------------|-----------|
| No action | 6.2% | -$210K vs. target |
| Hotfix only | 7.9% | -$90K vs. target |
| Hotfix + onboarding | 8.4% | -$60K vs. target |
| Full recovery (Q2) | 9.5% | On target in Q2 |
```

## Worked Example: Attribution of a Metric Change

**Metric:** Monthly Active Users dropped 8% MoM.

**Segmentation steps:**
1. New users vs. returning users → returning users dropped 11%, new users flat → retention problem
2. By plan → Free users dropped 14%, paid dropped 2% → free user retention issue
3. By cohort → Jan and Feb cohorts show 60-day retention cliff → specific to recent cohorts
4. By feature usage → Users who used "saved reports" feature: 82% retained; those who did not: 34% → feature adoption is the gap
5. Timeline → Cohorts from Dec and earlier have normal retention; Jan+ do not → something changed in January

**Hypothesis:** The new onboarding flow (launched Jan 14) reduces feature discovery, so fewer users find "saved reports" and hit the retention floor.

**Test:** Analyze feature adoption rate by cohort. Jan cohorts: 23% saved reports adoption (was 44% in Dec cohorts). Confirmed.

**Fix:** Surface saved reports earlier in the onboarding flow.

## Common Metric Pitfalls

| Pitfall | Example | Fix |
|---------|---------|-----|
| Averages hide segments | "Conversion is 8%" (enterprise is 22%, SMB is 3%) | Always segment before concluding |
| Correlation ≠ causation | "It dropped when we launched the new UI" | Test with A/B or controlled cohort analysis |
| Seasonality ignored | "DAU dropped 15% — alarming!" (on Dec 25) | Compare YoY, not just MoM |
| Metric definition drift | "Activation improved" (but definition changed) | Document metric definitions formally |
| Survivorship bias | "Our retained users love the product" (churned users are gone) | Include churned cohorts in analysis |

## Rules

- **Segment before concluding** — a metric average without segmentation hides the actual problem.
- **Generate multiple hypotheses** — the first obvious explanation is often wrong or incomplete.
- **Define the metric exactly** — include the formula, data source, and any filters before analyzing.
- **Quantify the impact** — how many percentage points, how much revenue, how many users? Vague impact = vague action.
- **Root cause, not symptom** — "users are dropping off" is a symptom; "the workspace setup API returns an error 3.2% of the time" is a root cause.
- **Separate findings from recommendations** — describe what the data shows first; recommend after.
- **Set up monitoring** — every analysis should end with an alert or dashboard that catches the same issue sooner next time.
- **Check for data quality issues first** — before diagnosing a business problem, confirm the tracking is correct.
- **Time-box the investigation** — decide before starting whether this deserves 2 hours, 2 days, or 2 weeks of investigation.
- **Present uncertainty** — state confidence level for each root cause; do not overclaim.
