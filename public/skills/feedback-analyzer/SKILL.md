---
name: feedback-analyzer
description: Systematically analyze product feedback from multiple sources — support tickets, NPS responses, app reviews, user interviews, sales calls — into prioritized themes with evidence, signal strength ratings, and product action recommendations.
argument-hint: [feedback source, raw feedback data or file, product area focus]
allowed-tools: Read, Write
---

# Product Feedback Analyzer

Raw feedback is noise until it is structured. The goal is not to catalog every complaint — it is to identify the patterns that, if addressed, would move retention, acquisition, or expansion metrics. This skill transforms unstructured feedback into prioritized themes with evidence, frequency counts, and clear product implications.

## Why Feedback Analysis Fails

Common mistakes:
- **Recency bias**: the last 10 tickets dominate the analysis; a 6-month trend is invisible
- **Loudness bias**: vocal users or large accounts override the majority signal
- **Confirmation bias**: the analyst finds evidence for what the team already wants to build
- **No frequency data**: qualitative themes without "how often" are unactionable
- **Missing non-users**: only collecting feedback from active users misses churned users and never-converted prospects

## Feedback Sources and Their Signals

| Source | Signal Type | Bias | Best For |
|--------|------------|------|----------|
| NPS open-ends (Detractors) | Unprompted pain points | Active users only | Retention risk themes |
| Support tickets | Pain severe enough to report | Already-frustrated users | Friction and bugs |
| App store reviews | Broad population opinion | Public-facing only | Onboarding, UX, value prop |
| User interviews | Deep context and why | Selection bias (willing users) | Root cause analysis |
| Sales call transcripts | Pre-purchase objections | Prospective users | Acquisition blockers |
| Churn surveys | Exit reasons | Lagging indicator | Retention root causes |
| Community/Slack/forum | Power user preferences | Engaged users only | Advanced feature gaps |
| Session recordings | Behavioral frustration | No stated intent | UX friction |

Triangulate: the same theme appearing in NPS + support tickets + churn surveys is a high-confidence signal.

## Feedback Taxonomy

Before analyzing, agree on a taxonomy. Do not invent categories mid-analysis.

**Top-level categories (adjust for your product):**
- **Reliability**: bugs, downtime, sync failures, data accuracy
- **Performance**: speed, load times, timeouts
- **Usability**: confusing UI, workflow friction, discoverability
- **Missing features**: capabilities users want but product lacks
- **Pricing/packaging**: too expensive, wrong tier, missing features in lower tier
- **Onboarding**: hard to set up, slow time-to-value
- **Integrations**: missing connectors, broken APIs, sync issues
- **Support/documentation**: hard to find answers, slow response

## Process

1. **Define scope** — time period, feedback sources, product area.
2. **Collect raw data** — pull support tickets, NPS responses, reviews, etc.
3. **Label each item** — tag with category, sentiment (positive/negative/neutral), and severity.
4. **Count frequency** — how many items per category? What % of total?
5. **Identify sub-themes** — within each category, what specific patterns exist?
6. **Assess signal strength** — does this theme appear across multiple sources?
7. **Find representative quotes** — select 2-3 verbatim quotes per major theme.
8. **Score impact** — how does addressing this theme affect retention, activation, or revenue?
9. **Write the analysis** — prioritized themes with evidence, frequency, and recommendations.
10. **Distribute** — send to PM, design, eng, and leadership with a clear ask.

## Output Format

### Feedback Analysis Report

```
PRODUCT FEEDBACK ANALYSIS
Period: [Start date – End date]
Sources: [List all sources used]
Total items analyzed: [N]
Analyzer: [Name/team]
Date: [Report date]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[3–5 sentences. What is the headline finding? What is the highest-priority
theme and what does it imply for the product? What has changed since last
analysis period?]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THEME SUMMARY TABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Theme              | Freq  | % Total | Sources          | Trend    | Priority
-------------------|-------|---------|------------------|----------|----------
[Theme 1]          | [N]   | [X%]    | Tickets, NPS     | ↑ Rising | P0
[Theme 2]          | [N]   | [X%]    | Reviews, Churn   | → Stable | P1
[Theme 3]          | [N]   | [X%]    | Interviews       | ↓ Falling| P2
[Theme 4]          | [N]   | [X%]    | Sales calls      | ↑ Rising | P1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DETAILED THEMES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THEME 1: [Name] — [Frequency: N items, X% of total]
Signal strength: 🔴 HIGH / 🟡 MEDIUM / 🟢 LOW
Cross-source confirmation: [Which sources show this theme?]

What users are experiencing:
[2-3 sentences describing the pattern in the user's frame — not your interpretation yet]

Representative quotes:
- "[Verbatim quote]" — [Source, user segment, date]
- "[Verbatim quote]" — [Source, user segment, date]
- "[Verbatim quote]" — [Source, user segment, date]

Business impact:
- Retention: [Is this theme associated with churn? What % of churned users cited it?]
- Acquisition: [Is this blocking conversions or demos?]
- Expansion: [Does this prevent upsell?]

Root cause hypothesis:
[Why does this problem exist? What in the product, pricing, or process causes it?]

Recommended actions:
1. [Immediate / quick win — can be done in < 1 sprint]
2. [Medium-term — feature or UX change, 1–4 weeks]
3. [Longer-term — if this is a systematic issue]

---

THEME 2: [Name] — [Frequency: N items, X% of total]
[Repeat structure]
```

### Worked Example

```
PRODUCT FEEDBACK ANALYSIS
Period: Q2 2024 (April 1 – June 30)
Sources: Support tickets (n=312), NPS Detractor open-ends (n=87),
         Churn survey (n=43), G2 reviews (n=29)
Total items analyzed: 471
Analyzer: Product team, condensed by Claude

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Integration reliability is the dominant theme this quarter, appearing
across all four sources and accounting for 38% of all feedback items.
This is a meaningful increase from Q1 (27%). Onboarding friction is
the second theme and shows the highest correlation with early churn
(within 30 days). Pricing feedback is flat vs. Q1 and concentrated
in the SMB segment. No new themes emerged; existing issues are growing
in severity.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THEME SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Theme                  | Freq | % Total | Sources              | Trend    | P
-----------------------|------|---------|----------------------|----------|--
Integration failures   | 178  | 38%     | Tickets,NPS,Churn,G2 | ↑ Rising | P0
Onboarding friction    | 94   | 20%     | Tickets,NPS,Churn    | ↑ Rising | P0
Missing integrations   | 61   | 13%     | NPS,G2,Sales         | → Stable | P1
Pricing complaints     | 48   | 10%     | Churn,NPS            | → Stable | P2
Performance/speed      | 44   | 9%      | Tickets,G2           | ↓ Falling| P2
Reporting gaps         | 31   | 7%      | NPS,Interviews       | → Stable | P2
Positive feedback      | 15   | 3%      | NPS,G2               | → Stable | N/A

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THEME 1: INTEGRATION FAILURES — 178 items (38%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Signal strength: 🔴 HIGH (confirmed in all 4 sources)

What users are experiencing:
Users report integration syncs failing silently or with
opaque error messages. The core frustration is not the
failure itself but the inability to diagnose and fix it
without engineering involvement.

Representative quotes:
- "We had stale Salesforce data for 3 days before anyone noticed."
  — Support ticket #4821, ops manager, mid-market
- "Your error messages are useless. 'Connection timed out' tells me nothing."
  — NPS detractor, score 2, B2B SaaS, 200 employees
- "This was the final straw. We couldn't build operational trust."
  — Churn survey, churned after 4 months

Business impact:
- Retention: 67% of churned accounts in Q2 cited integration issues
- Acquisition: 3 deals lost in Q2 per sales notes citing "reliability concerns"
- Expansion: 2 accounts downgraded citing "cost vs. reliability"

Root cause hypothesis:
The product currently logs errors at the infrastructure level only.
There is no user-facing translation layer or retry mechanism. Users
see raw API errors or nothing at all. Engineering time is consumed
by individual investigations rather than systemic monitoring.

Recommended actions:
1. [Quick win] Surface sync status and last-successful-sync timestamp
   in the existing UI — 1 sprint, high visibility impact
2. [Medium] Translate top-10 error codes into plain English with
   suggested remediation steps — 2 sprints
3. [Longer] Build integration health dashboard with alerting
   and one-click retry — current roadmap item, accelerate to Q3
```

## Signal Strength Scoring

Rate each theme's signal strength:

| Score | Criteria |
|-------|----------|
| 🔴 HIGH | Appears in 3+ sources; >15% of feedback; correlated with churn or NPS detractors |
| 🟡 MEDIUM | Appears in 2 sources; 5–15% of feedback; no direct churn correlation yet |
| 🟢 LOW | Appears in 1 source; <5% of feedback; isolated or niche user segment |

**Prioritization guidance:**
- 🔴 HIGH + churn correlation → P0, present to leadership this week
- 🔴 HIGH, no churn data yet → P1, add to next sprint planning
- 🟡 MEDIUM → P2, monitor next quarter
- 🟢 LOW → log, do not act unless a second source confirms

## Distribution Checklist

Before sending the analysis:
- [ ] Executive summary is ≤5 sentences and leads with the headline finding
- [ ] Every claim has a frequency count, not just anecdotes
- [ ] Representative quotes are verbatim, not paraphrased
- [ ] Each theme has a recommended action, not just a description
- [ ] Analysis compares to previous period (trend data)
- [ ] Audience-appropriate: full doc for PM/eng; 1-page summary for leadership

## Rules

- **Frequency before loudness** — the number of mentions matters more than the volume of the loudest user.
- **Always show trends** — a theme at 10% that is rising is more urgent than one at 20% that is falling.
- **Verbatim quotes beat paraphrases** — exact user words are more persuasive in stakeholder meetings.
- **Triangulate sources** — a theme in only one source is a hypothesis; two or more sources is a signal.
- **Include churned user feedback** — active users have a survivor bias; churned users reveal what killed retention.
- **Root cause, not symptoms** — dig into why the problem exists, not just that it exists.
- **Always recommend an action** — a feedback report with no recommended actions wastes everyone's time.
- **Score signal strength explicitly** — give readers a way to prioritize without re-reading all the evidence.
- **Separate sentiment from frequency** — strong negative language does not mean many users feel that way.
- **Distribute on a regular cadence** — monthly or quarterly analysis is more valuable than ad hoc reports.
