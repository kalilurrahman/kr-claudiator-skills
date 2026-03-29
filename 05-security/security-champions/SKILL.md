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
