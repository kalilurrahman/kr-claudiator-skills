---
name: okr-writer
description: Write clear, measurable OKRs for product teams — objectives that inspire, key results that measure outcomes, and initiative mapping that connects work to results. Outputs draft OKRs with grading rubrics, check-in templates, and failure pattern analysis.
argument-hint: [team mission, strategic priorities, current metrics, time period]
allowed-tools: Read, Write
---

# OKR Writer

OKRs (Objectives and Key Results) are the most commonly misused goal-setting framework. The common failure: writing activities as key results ("launch feature X"), setting targets so achievable they require no stretch, or having so many OKRs that nothing is a priority. Good OKRs are uncomfortable — they require choosing what matters above all else.

## OKR Structure

**Objective:** Qualitative, inspiring, directional. Answers: "What are we trying to achieve?" Should be memorable and motivating. Does NOT have a number in it.

**Key Results (3-5 per objective):** Quantitative, measurable outcomes. Answers: "How will we know we achieved it?" Must be numbers. Represents the evidence that the objective was achieved.

**Initiatives:** The work done to achieve KRs. NOT part of the OKR itself — tracked separately. Common mistake is writing initiatives as KRs.

## OKR vs. Activity (Most Common Mistake)

| Activity (BAD) | Outcome (GOOD) |
|----------------|----------------|
| Launch integration dashboard | Dashboard active users reach 60% of eligible team |
| Ship SAML SSO | 5 enterprise accounts with SSO enabled |
| Reduce P1 bug count | Mean time to resolution for P1 bugs < 4 hours |
| Improve onboarding | New user activation rate reaches 70% within 7 days |
| Conduct 20 customer interviews | Findings validated with 100+ survey respondents |
| Build recommendation engine | Recommendation click-through rate reaches 18% |
| Revamp pricing page | Trial-to-paid conversion improves from 8% to 13% |

## Target Setting

OKRs should be set so that achieving 70% of the target counts as good. If you always achieve 100%, your targets are too easy.

| Achievement Level | Interpretation |
|------------------|----------------|
| 0-30% | Fundamental problem — wrong strategy, execution failure, or invalid assumption |
| 40-60% | Made progress but significant gaps; analyze why |
| 70% | Solid — this is the expected outcome for a well-set OKR |
| 100% | Either you set the bar too low, or this was an exceptional quarter |
| >100% | Celebrate, then ask: was the original target too conservative? |

## OKR Hierarchy

```
Company OKR
└── Team OKR (ladders up to company OKR)
    └── Individual OKR (ladders up to team OKR)
        └── Weekly priorities (initiatives driving KRs)
```

Every team OKR must explicitly link to a company OKR. If you cannot make the link, the team OKR should not exist.

## Choosing Metrics for Key Results

Good KR metrics are:
- **Outcome-oriented**: measures user/business impact, not team output
- **In your control**: team can meaningfully influence the number
- **Baselined**: you know the starting value before setting the target
- **Measurable weekly**: you can check progress without waiting for month-end
- **Non-gameable**: cannot be gamed without actually achieving the intent

**Metric selection hierarchy:**
1. Revenue / retention impact (highest business value signal)
2. User behavior change (activation, engagement, adoption rates)
3. Quality / reliability indicators (error rates, NPS, CSAT)
4. Leading indicators (funnel metrics that predict the above)
5. Avoid: vanity metrics, output metrics, effort metrics

## Process

1. **Start with company/product strategy** — OKRs must ladder up.
2. **Identify 1-3 objectives** — fewer is better; more than 3 means no priorities.
3. **Write the objective** — inspirational, directional, no numbers.
4. **Write 3-5 key results per objective** — measurable, time-bound outcomes.
5. **Validate against failure modes** — activities or outcomes? Baselines known?
6. **Map initiatives** — what work will move these KRs?
7. **Assign KR owners** — each KR needs a DRI (directly responsible individual).
8. **Set check-in cadence** — weekly or biweekly progress updates.
9. **Hold mid-quarter review** — course correct before it is too late.
10. **Grade and retrospect** — at quarter end, document what you learned.

## Output Format

### OKR Set Template

```
Team: [Team name]
Period: [Q3 2024: July 1 – September 30]
Team mission: [One sentence on why this team exists]
Company context: [Which company OKR(s) these ladder up to]

────────────────────────────────────────────────────────────────
OBJECTIVE 1: [Inspiring, directional, no numbers]

Why this objective: [1-2 sentences connecting to strategy]

KR # | Key Result                        | Baseline | Target | Owner | Grade
-----|-----------------------------------|----------|--------|-------|------
1.1  | [Measurable outcome with number]  | [Today]  | [Goal] | [DRI] |
1.2  | [Measurable outcome with number]  | [Today]  | [Goal] | [DRI] |
1.3  | [Measurable outcome with number]  | [Today]  | [Goal] | [DRI] |

Initiatives:
- [Initiative name]: expected impact on KR [#] by moving [metric] from X → Y
- [Initiative name]: expected impact on KR [#]

Risks: [What could prevent achieving this objective?]
Dependencies: [Other teams or external factors]
```

### Worked Example — Platform Product Team

**Team:** Platform Product  
**Period:** Q3 2024  
**Mission:** Enable every ops manager to monitor integrations without engineering help.  
**Ladders to:** Company OKR #2 — Reduce churn below 5% annually.

---

**Objective 1: Make integration reliability a competitive advantage**

*Why:* 40% of churned accounts cited "integration issues" in exit surveys. Winning on reliability is the fastest path to retention improvement.

| KR # | Key Result | Baseline | Target | Owner |
|------|-----------|----------|--------|-------|
| 1.1 | Dashboard WAU (% of eligible users) | 0% | 55% | Priya |
| 1.2 | Support tickets: "integration status" category | 120/mo | <50/mo | Marcus |
| 1.3 | Exit survey: integration issues cited as churn reason | 40% | <25% | Priya |
| 1.4 | Mean time to resolve integration failures | 48h | <4h | Marcus |

**Initiatives:**
- Integration health dashboard (NOW): Drives KR 1.1 and 1.2 — estimated −40 tickets/month
- Automated retry + alerting (NEXT): Drives KR 1.4 and KR 1.3
- Integration runbook in help center: Low effort, medium impact on KR 1.2

**Risks:** Dashboard adoption requires workflow change for ops managers; may need in-app nudges.
**Dependencies:** CS team for exit survey changes; Data team for analytics pipeline.

---

**Objective 2: Unlock enterprise segment through security readiness**

*Why:* 8 deals in pipeline are blocked on SAML SSO and audit logs. Closing 4 of 8 justifies the Q3 investment.

| KR # | Key Result | Baseline | Target | Owner |
|------|-----------|----------|--------|-------|
| 2.1 | Enterprise accounts with SAML SSO enabled | 0 | 5 | Yusra |
| 2.2 | Pipeline deals blocked by missing security features | 8 | <3 | Yusra |
| 2.3 | Enterprise ARR added from security-unblocked deals | $0 | $120K | Marcus |

**Initiatives:**
- SAML SSO implementation: 6-week build, enables KR 2.1 and 2.2
- Audit log export API: Required by 6 of 8 pipeline accounts
- Security questionnaire portal: Reduces sales cycle by 1–2 weeks

---

### OKR Grading Template (End of Quarter)

```
Quarter-End OKR Review
Team: ___________   Quarter: ___________   Date: ___________

OBJECTIVE 1: [Title]
KR 1.1 [metric]:  Baseline [X] → Target [Y] → Actual [Z] → Grade: [0.0–1.0]
KR 1.2 [metric]:  Baseline [X] → Target [Y] → Actual [Z] → Grade: [0.0–1.0]
KR 1.3 [metric]:  Baseline [X] → Target [Y] → Actual [Z] → Grade: [0.0–1.0]
Objective grade: [average]

What worked:
- [What drove progress]
What did not work:
- [Blockers, wrong assumptions]
Carry forward or close: [Decision]

OVERALL QUARTER GRADE: ___________
Key learnings for next OKR cycle:
- [Lesson 1]
- [Lesson 2]
```

### OKR Check-In Format

**Weekly check-in (10 min, async or synchronous):**
```
KR 1.1: [Metric name]
  Current: [Value] / Target: [Value] = [X%] of target
  Status: 🟢 On track | 🟡 At risk | 🔴 Off track
  What moved the needle this week: [1 sentence]
  Blocker: [1 sentence or "None"]
  Next action: [Owner will do X by Y date]
```

**Mid-quarter review (30 min team meeting):**
- Grade each KR at current trajectory — if nothing changes, where do we land?
- Identify KRs at risk and the required intervention
- Decide if any initiatives should be accelerated or dropped
- Communicate risks to stakeholders: what is going well, what is at risk
- Flag invalidated assumptions — only revise targets if the underlying assumption was wrong

### OKR Setting Workshop Agenda (90 min)

```
0:00–0:10  Context: company OKRs and team mission reminder
0:10–0:30  Objective brainstorm (sticky notes): top 5–10 most important things
0:30–0:45  Converge: vote, debate, decide on 1–3 objectives
0:45–1:10  Draft key results: outcome-based, with baselines and targets
1:10–1:20  Anti-pattern review: check each KR for activities, vanity, uncontrollable factors
1:20–1:30  Initiative mapping: which initiatives move which KRs?
Post-session: DRI assignment and async review within 48 hours
```

## Anti-Patterns Reference

| Anti-Pattern | Example | Fix |
|-------------|---------|-----|
| Activity KR | "Launch onboarding wizard" | "Activation rate reaches 70% in 7 days" |
| Vanity metric | "Reach 1M page views" | "Users completing 3+ syncs/week: 500" |
| No baseline | "Increase NPS" | "NPS improves from 32 to 45" |
| Too many KRs | 8 KRs per objective | 3–5 max; more means too many priorities |
| Uncontrollable KR | "Raise Series B" | "Pipeline coverage reaches 3× target" |
| No check-ins | OKRs set and forgotten | Weekly 15-min check-in on calendar |
| Sandbagging | Target = last quarter's actuals | Push 20–30% beyond current performance |
| Copying last quarter | Same OKRs every quarter | OKRs evolve; repeating one signals it is now a BAU metric |
| All KRs green, objective missed | Wrong proxy metrics | Revisit KR selection — proxies can diverge from the actual goal |

## Stakeholder Alignment Checklist

Before publishing OKRs:
- [ ] Engineering lead confirms targets are achievable with proposed initiatives
- [ ] Design lead understands UX implications of each KR
- [ ] Data team can instrument and report on all KR metrics
- [ ] Each KR has a named DRI who accepts ownership
- [ ] OKRs ladder to at least one company-level OKR
- [ ] All baselines are confirmed in the analytics system
- [ ] Weekly check-in is scheduled on the team calendar

## Rules

- **3 objectives maximum per team per quarter** — if everything is a priority, nothing is.
- **Key results are outcomes, not activities** — if it does not have a number, it is not a KR.
- **Know your baseline before setting targets** — "improve NPS" means nothing without the starting value.
- **70% achievement is success** — consistent 100% means your targets are too low.
- **KRs must be in your control** — do not set KRs on company revenue unless you own that line.
- **Ladder to company strategy** — every team OKR must connect to at least one company OKR.
- **4 KRs per objective is ideal** — more than 5 means you have too many priorities in one objective.
- **No KR without an owner** — assign a DRI to every single key result.
- **Check in weekly** — OKRs not reviewed weekly are decorations, not goals.
- **Close the loop** — grade each KR at quarter end and document what you learned.
- **Verify metric instrumentation** — if you cannot measure the KR today, fix that before finalizing.
- **Initiatives are not OKRs** — the OKR is the destination; the initiative is the journey.
