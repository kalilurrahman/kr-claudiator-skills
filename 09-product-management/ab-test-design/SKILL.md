---
name: ab-test-design
description: Design a statistically valid A/B test for a product feature or change. Produces a test plan with hypothesis, metrics, sample size calculation, risk assessment, and analysis plan.
argument-hint: [feature or change to test, primary metric, current baseline, traffic volume]
allowed-tools: Read, Write
---

# A/B Test Design

A poorly designed A/B test produces misleading results that lead to wrong product decisions. A well-designed test answers one clear question with statistical rigor, includes pre-specified metrics, and accounts for the risks of shipping a losing variant.

## Test Design Principles

1. **One change per test** — testing multiple changes simultaneously makes it impossible to attribute the result.
2. **Pre-specify your metrics** — choose your primary metric before you see the data; changing it after is p-hacking.
3. **Calculate sample size before starting** — running a test until you like the result inflates false positives.
4. **Randomize at the right unit** — user-level randomization for most tests; company-level for B2B products.
5. **Watch for novelty effects** — new UI elements may temporarily improve engagement; run tests long enough to outlast novelty.

## Process

1. **Write the hypothesis** — "If we [change X], then [metric Y] will [increase/decrease] by [Z%] because [mechanism]."
2. **Choose primary and secondary metrics** — one primary metric (the one that decides); 2–3 guardrail metrics (what must not get worse).
3. **Calculate sample size** — use a power calculator; document the assumptions.
4. **Define the minimum detectable effect (MDE)** — the smallest change that would matter to the business.
5. **Set statistical parameters** — significance level (α = 0.05), statistical power (80% or 90%).
6. **Estimate run time** — based on daily traffic to the test surface.
7. **Define segmentation** — which users are eligible? Which are excluded?
8. **Plan the analysis** — what does a winner look like? How will you handle inconclusive results?
9. **Assess risk** — what is the worst-case outcome if the variant wins and you ship it?
10. **Get sign-off** — PM, engineering, and data analysis should agree before test launches.

## Sample Size Calculator Reference

```
Required sample size (per variant):
n = 2 × (Zα/2 + Zβ)² × p(1-p) / MDE²

Where:
  p = baseline conversion rate (e.g., 0.09 for 9%)
  MDE = minimum detectable effect (e.g., 0.015 for 1.5pp change)
  Zα/2 = 1.96 (for α = 0.05, two-tailed)
  Zβ = 0.84 (for 80% power) or 1.28 (for 90% power)

Example:
  Baseline: 9%, MDE: 1.5pp, α = 0.05, power = 80%
  n = 2 × (1.96 + 0.84)² × 0.09(0.91) / (0.015)²
  n = 2 × 7.84 × 0.0819 / 0.000225
  n ≈ 5,700 users per variant (11,400 total)
```

**Quick reference — users needed per variant:**

| Baseline rate | MDE (+1pp) | MDE (+2pp) | MDE (+5pp) |
|--------------|-----------|-----------|-----------|
| 5% | 18,500 | 4,800 | 800 |
| 10% | 31,500 | 8,000 | 1,300 |
| 20% | 47,500 | 12,000 | 1,900 |
| 40% | 54,000 | 13,600 | 2,200 |

## Output Format

```markdown
# A/B Test Plan: [Test Name]
**Date created:** [YYYY-MM-DD]
**Test owner:** [PM name]
**Engineering:** [Eng lead]
**Data:** [Data analyst]

---

## Hypothesis

**Null hypothesis:** Changing [X] has no effect on [metric Y].

**Alternative hypothesis:** If we [specific change], then [metric Y] will [increase/decrease] by at least [Z%] because [users will/won't do X due to mechanism Y].

**Example:**
"If we add an in-app onboarding checklist to the workspace home screen for new users, then Day-7 activation (completing 3+ core actions in 7 days) will increase by at least 20% (relative) from 23% to at least 27.6%, because new users currently lack a clear path to value and the checklist provides an explicit task list."

---

## Metrics

### Primary metric (the decision metric)
**Metric:** Day-7 activation rate
**Definition:** % of users who complete ≥3 core actions (create a project, invite a team member, set a due date) within 7 days of signup
**Baseline:** 23.1% (30-day average, Oct 2024)
**MDE:** +4pp absolute (20% relative improvement)
**Direction:** Increase only — a decrease means do not ship

### Secondary metrics (guardrails — must not degrade)
| Metric | Baseline | Acceptable threshold |
|--------|----------|---------------------|
| Day-1 retention | 61% | Must remain > 58% |
| Onboarding completion rate | 34% | Must remain > 30% |
| Support tickets per new user (7-day) | 0.8 | Must remain < 1.0 |

### Exploratory metrics (not decision-making, informational only)
- Day-30 retention (outcome of activation improvement)
- Checklist item completion by step (to learn which steps matter most)
- Time-to-first-value action (minutes)

---

## Sample Size and Duration

**Statistical parameters:**
- Significance level (α): 0.05 (5% false positive rate)
- Statistical power: 80% (20% false negative rate)
- Test type: Two-tailed

**Calculation:**
- Baseline: 23%, MDE: 4pp absolute
- Required per variant: ~7,200 users
- Required total: ~14,400 users

**Traffic eligibility:**
- New users only (signup within the test period)
- Excludes: invited users, SSO-provisioned users, accounts with >5 users on day 0

**Current new user volume:** ~320 per day eligible
**Required run time:** 14,400 / 320 = 45 days (6.5 weeks)
**Planned start date:** [Date]
**Planned end date:** [Date + 45 days]
**Minimum run time:** 14 days (even if sample size is reached; allows for day-of-week effects)

---

## Test Design

**Randomization unit:** User (not session or company)
**Randomization method:** User ID hash % 100 — variant A if hash < 50, variant B if hash >= 50
**Traffic split:** 50% control / 50% variant
**Holdout:** None (full 50/50 split)

**Control (A):**
[Description or screenshot of current experience]
"Current workspace home screen with no onboarding guidance."

**Variant (B):**
[Description or screenshot of the change]
"Workspace home screen with a 5-step onboarding checklist in the right sidebar, visible until all 5 steps are completed. Steps: (1) Create a project, (2) Add a task, (3) Invite a team member, (4) Set a due date, (5) Install the browser extension."

---

## Pre-Launch Checklist

- [ ] Hypothesis written and signed off by PM + data analyst
- [ ] Metrics and definitions agreed before test launch
- [ ] Sample size calculated and documented
- [ ] End date set (no peeking at results before end date)
- [ ] Tracking events added for all primary and secondary metrics
- [ ] QA completed — variant renders correctly on all browsers
- [ ] Monitoring alerts set for guardrail metrics
- [ ] Rollback plan defined (how quickly can variant be turned off?)

---

## Analysis Plan

**Who analyzes:** [Data analyst name]
**Analysis date:** [End date + 3 business days]
**Decision maker:** [PM name]

**Decision rules:**
- **Ship:** Variant B shows statistically significant (p < 0.05) increase in Day-7 activation AND no guardrail metric degraded below threshold.
- **Do not ship:** Variant B shows no significant effect OR activation increases but a guardrail degrades.
- **Extend test:** Sample size not reached by end date — extend by 1 week maximum.
- **Stop early:** If a guardrail metric degrades by >10% relative before end date, stop and investigate.

**Segments to analyze post-test:**
- By sign-up source (organic vs. paid vs. referral)
- By company size (solo vs. team)
- By plan (free vs. trial)
Note: these are for learning only; the primary decision is based on the full population.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Checklist causes confusion; activation drops | Low | High | Guardrail on Day-1 retention; stop early rule at -10% |
| Novelty effect inflates short-term activation | Medium | Medium | Run test minimum 6 weeks to outlast novelty |
| Checklist dismissed; no engagement | Medium | Low | Track checklist interaction rate as exploratory metric |
| Sample size not reached due to low traffic | Low | Medium | Extend test; do not change MDE to compensate |

**Worst-case scenario:** Variant B increases activation but reduces Day-1 retention (users feel overwhelmed). We will not ship if any guardrail degrades, even if the primary metric wins.
```

## Worked Example: Avoiding Common Mistakes

### Mistake 1: Stopping early when results look good

You launch a test. After 10 days, activation is +7pp and p = 0.03. You declare victory and ship.

**Problem:** You set a sample size of 14,400 but only collected 3,200. The p-value will fluctuate wildly with small samples — this "significant" result is probably noise.

**Rule:** Do not look at results until you reach the planned sample size and end date.

### Mistake 2: Changing the primary metric after seeing results

You pre-specified Day-7 activation as primary. The test ends and activation shows p = 0.12 (not significant). But Day-30 retention is up 15% with p = 0.03. You declare the test a success based on Day-30.

**Problem:** This is p-hacking. You tested 10 metrics; the probability of at least one false positive at α = 0.05 is high.

**Rule:** The primary metric decides. Secondary metrics inform; they do not override.

### Mistake 3: Testing at the session level in B2B

A user logs in 10 times during the test. If you randomize at the session level, the same user might see both control and variant.

**Rule:** In B2B products, randomize at the user or account level.

## A/B Test Types

| Test type | When to use | Complexity |
|-----------|------------|-----------|
| Simple A/B | One variant vs. control | Low |
| A/B/C | Two variants vs. control | Medium |
| Multivariate (MVT) | Multiple elements changing simultaneously | High (requires much larger sample) |
| Holdout test | Control group receives no changes for extended period | Medium |
| Switchback test | For marketplace / time-series effects | High |
| Bandit test | Dynamic allocation, faster convergence, lower regret | High |

## Anti-Patterns to Avoid

| Anti-pattern | Description | Fix |
|-------------|------------|-----|
| Peeking | Checking results before sample size is reached | Set a calendar reminder for end date only |
| HARKing | Hypothesizing After Results are Known | Write hypothesis before test launches |
| Multiple comparisons | Testing 10 metrics with α=0.05 each → ~40% chance of a false positive | Bonferroni correction or pre-specify one primary metric |
| Small MDE | Detecting a 0.1% change in 80% conversion rate requires millions of users | Set MDE at the minimum change that would change a business decision |
| User contamination | B2B users in different variants who collaborate | Randomize at account/company level |

## Rules

- **Hypothesis before launch** — write the full hypothesis including mechanism before you touch the code.
- **One primary metric** — the test succeeds or fails on one pre-specified metric.
- **Calculate sample size before starting** — do not run until it looks good; run until the number is reached.
- **Do not peek** — set the analysis date and do not open the dashboard until then.
- **Guardrail metrics protect users** — a test that wins on primary but breaks a guardrail should not ship.
- **B2B products randomize at account level** — user-level randomization causes contamination in team products.
- **Run long enough for novelty effects to fade** — minimum 2 weeks; 4–6 weeks for behavioral changes.
- **Segment analysis is for learning, not decisions** — use segment results to design the next test, not to declare a different winner.
- **Document the rollback plan** — before launching, know how quickly you can turn the variant off if something goes wrong.
- **Ship only when the primary metric wins and guardrails are intact** — do not negotiate your way to a ship decision.
