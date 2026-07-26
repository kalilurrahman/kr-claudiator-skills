---
name: security-champions
description: Build a security champions programme to scale security across engineering teams. Outputs programme structure, champion responsibilities, training curriculum, and metrics.
argument-hint: [company size, engineering team count, current security maturity, budget]
allowed-tools: Read, Write
---

# Security Champions Programme

A security champions programme embeds security advocates within engineering teams. Instead of a central security team reviewing everything (bottleneck), each team has a champion who knows security, raises issues early, and acts as a bridge to the central security team. Security scales with engineering.

## Programme Structure

```markdown
## Roles

### Security Champion (embedded in product team)
- 10-20% time allocation for security activities
- Attends monthly security champions meeting
- Runs threat modelling for their team's features
- Reviews PRs for security concerns (not a gate — a guide)
- First point of contact for team security questions
- Escalates to central security team when needed

### Security Team (central)
- Sets standards and policies
- Runs champion training and enablement
- Handles incidents and escalations
- Owns security tooling (SAST, DAST, scanning)
- Measures programme effectiveness

## Selection Criteria for Champions
- Genuine interest in security (volunteers, not volunteers-in-name-only)
- Strong engineering skills (credible to peers)
- Good communication (can translate security to non-security people)
- Committed — minimum 6-month tenure

## Team Coverage
Target: 1 champion per 8-12 engineers
Start: Identify 2-3 pilot champions in most security-sensitive teams
Scale: Add 1-2 champions per quarter
```

## Training Curriculum

```markdown
## Security Champions Training Programme

### Module 1: Foundations (Month 1)
- OWASP Top 10 — one session per vulnerability class
- Threat modelling fundamentals (STRIDE)
- Secure coding for the team's primary language
- Reading and acting on SAST results

### Module 2: Applied Security (Month 2)
- Authentication and authorisation patterns
- Cryptography essentials (not implementation — selection and use)
- API security (the OWASP API Top 10)
- Secrets management

### Module 3: Process and Culture (Month 3)
- Running a threat modelling session
- Writing security requirements for user stories
- How to give useful security feedback in code review
- When to escalate vs when to fix

### Ongoing (Monthly)
- Security champions meeting: share findings, discuss new threats
- Guest sessions: external researchers, red team findings
- Capture the flag (CTF) quarterly
- Annual security conference attendance (budget: $1,000/champion)

## Certification
Champions who complete the curriculum receive:
- Internal "Security Champion" title on team page
- SANS SEC401 or equivalent voucher (company-funded)
```

## Champion Responsibilities Template

```markdown
## Security Champion Handbook

### Your weekly activities (2-3 hours)
- [ ] Review security scanning results for your team's repos
- [ ] Attend team code reviews with security lens
- [ ] Answer team members' security questions

### Your monthly activities (3-5 hours)
- [ ] Attend monthly security champions meeting
- [ ] Run threat model for one upcoming feature
- [ ] Review one dependency update for security implications

### Your quarterly activities
- [ ] Review and update threat models for critical components
- [ ] Complete one module of security training
- [ ] Participate in tabletop exercise or CTF

### Escalation triggers (always involve security team)
- Potential data breach or exfiltration
- Critical vulnerability in production
- Compliance violation discovered
- Uncertainty about risk level of a finding
```

## Metrics

```markdown
## Programme Health Metrics

### Coverage
- % of engineering teams with an active champion: target 100%
- Champion tenure (avg): target >12 months

### Activity
- Threat models completed per quarter: target 1 per team
- Security issues raised by champions before vs after launch: target 80% pre-launch
- Response time from champion to team security questions: target <24h

### Effectiveness
- Security findings in production (champions vs non-champion teams): compare
- Champion-reported issues vs tool-reported issues ratio: target >30% champion-found
- Champion satisfaction score (quarterly survey): target >4/5
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Appointing, not recruiting** | Unwilling champions disengage quickly | Find volunteers; make the role desirable |
| **No time allocation** | Champions can't do the work | Formal 10-20% allocation; manager buy-in |
| **Champions as security gatekeepers** | Bottleneck; resented by team | Champions are guides and connectors, not approvers |
| **No central security team support** | Champions without expertise flounder | Weekly office hours; Slack channel; escalation path |
| **Measuring activity not outcomes** | Champions do busy work, not impactful work | Measure pre-launch findings, not training hours |

## 10 Rules

1. Champions volunteer — never appoint an unwilling champion.
2. Formal time allocation (10-20%) — security work without time is lip service.
3. Champions are connectors and guides, not gatekeepers.
4. Central security team invests in champions: training, tools, access, and respect.
5. Monthly champions meeting creates community and knowledge sharing.
6. Measure programme effectiveness by reduction in production security findings.
7. Celebrate champion contributions publicly — recognition drives retention.
8. Champions rotate every 12-18 months to spread knowledge; overlap for knowledge transfer.
9. Programme has a named owner in the security team — orphaned programmes die.
10. Start with 2-3 enthusiastic champions; scale only after the model is proven.


## Deep dive: applying this in practice

The sections above describe *what* to produce. This section describes *how* practitioners actually run this in the field, including the conversations, artefacts, and review loops that turn a one-page recommendation into a sustained outcome.

### The 30/60/90 cadence

A recommendation that is never revisited is a recommendation that quietly fails. Bake review checkpoints in from day one:

- **Day 0 — Decision committed.** Owner, scope, success metrics, and the first-checkpoint date are recorded in the decision log. The artefact is linked from the team's working space so it is discoverable without asking.
- **Day 30 — Early-signal review.** Look at the leading indicators, not the lagging ones. Has the team actually started? Are the assumed dependencies real? Have any of the named risks materialised? Adjust scope, not the goal.
- **Day 60 — Course-correction window.** This is the last cheap moment to change direction. If the leading indicators are flat or negative, escalate. Silence at day 60 is the most expensive form of optimism.
- **Day 90 — Outcome review.** Measure against the success criteria captured on day 0, not against the story the team is telling now. Write the post-mortem (or pre-mortem-confirmed) in the same artefact so the rationale, the outcome, and the lessons live together.

### Stakeholder choreography

Decisions stall not because the analysis is wrong but because the choreography is wrong. Use a lightweight RACI on every recommendation:

| Role | Meaning | Anti-pattern |
|---|---|---|
| **Responsible** | Does the work | More than two people listed |
| **Accountable** | Owns the outcome, signs off | Shared accountability (always becomes no accountability) |
| **Consulted** | Two-way input before the decision | Consulted *after* the decision is made — purely performative |
| **Informed** | One-way notification after the decision | Informed people are asked to approve — wastes their time and yours |

If you cannot name a single Accountable person in one minute, the recommendation is not ready to ship.

### Writing for senior readers

Senior readers scan first, read second, and only re-read the parts they disagree with. Optimise for that pattern:

1. **Lead with the recommendation**, not the analysis. The reader should know what you want them to do before they finish the first paragraph.
2. **One screen, one page, one decision.** If the artefact needs scrolling on a laptop, it is too long for the audience it is written for.
3. **Tables beat paragraphs** for comparing options. Prose hides the trade-off; a table forces it into the open.
4. **Numbers beat adjectives.** Replace "significant" with the actual number. Replace "soon" with a date. Replace "improved" with a baseline and a target.
5. **Name the disconfirming evidence.** A recommendation that lists what would change the author's mind is read as honest; one that does not is read as advocacy.

### Common failure modes

| Failure mode | Symptom | Counter-move |
|---|---|---|
| **Analysis paralysis** | Weeks of investigation, no decision | Time-box the analysis. State the decision quality you can defend in the time available. |
| **HiPPO override** | Highest-paid person's opinion wins regardless of evidence | Force the trade-off table into the room before opinions are voiced |
| **Sunk-cost gravity** | Team defends the current path because of prior investment | Re-frame: what would we choose today with no prior investment? |
| **Scope creep at the checkpoint** | Review becomes a re-planning session | Separate "did this work?" from "what next?" Run them as two meetings. |
| **Stealth de-scoping** | Success metrics quietly soften between day 0 and day 90 | Lock the day-0 metrics into the artefact; require an explicit amendment to change them. |
| **Owner drift** | Accountable person leaves, no one re-assigns | Owner reassignment is a mandatory step in onboarding/offboarding the role |

### A worked example

> A product line is debating whether to invest in a major rewrite of a legacy service that has been failing under peak load.

A weak response: "We should rewrite it because the code is old."

A response that uses this skill:

> **Recommendation.** Do not rewrite. Invest one quarter in targeted performance work on the existing service and a parallel strangler-fig migration of the top two failing endpoints. Confidence: medium. Would change my mind if peak-load incidents continue at the current rate for two consecutive months after the performance work ships.
>
> **Options considered.** (1) Full rewrite — 9–12 months, ~$1.4M, high risk of partial delivery. (2) Performance fix in place — 6 weeks, ~$120K, addresses 80% of incident volume per last-quarter analysis. (3) Strangler-fig migration — 6 months for the two hottest endpoints, ~$400K, preserves optionality.
>
> **Plan.** Owner: Platform tech lead. Day 30: performance fix in staging with load test results. Day 60: production rollout and a 30-day incident-rate comparison. Day 90: decision on whether to expand the strangler-fig scope.
>
> **Risks.** (1) Performance fix masks a deeper architectural issue — mitigated by capturing flame graphs before and after. (2) Strangler-fig endpoints are not in fact the hottest ones — mitigated by re-running the traffic analysis at day 0. (3) Team capacity collides with a separate compliance deadline — escalated to the portfolio review on the next planning cycle.

That is the shape of output this skill should produce: a defensible, time-bound, owner-attached recommendation that respects the reader's time and survives turnover.

## Quick reference card

- One paragraph of context, three options with trade-offs, one recommendation with confidence, one plan with an owner and a date.
- If you cannot name the owner, the metric, and the checkpoint date in one breath, the artefact is not done.
- A decision without a written rationale is a rumour. A rationale without a checkpoint is a wish. A checkpoint without a metric is theatre.
- Reversibility matters more than people admit: one-way doors deserve the slow lane, two-way doors deserve the fast lane.
- The best artefacts in this category are short, dated, signed, and easy to find six months later.
