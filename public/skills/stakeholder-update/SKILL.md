---
name: stakeholder-update
description: Write a stakeholder update, status report, or executive summary for a product, feature, or initiative. Produces a concise, decision-oriented update that surfaces the right information for the audience.
argument-hint: [product or initiative name, update period, key metrics, decisions needed, audience]
allowed-tools: Read, Write
---

# Stakeholder Update Writer

Stakeholder updates are not status reports. A status report describes what happened. A good stakeholder update surfaces what matters, flags what requires attention, and makes it easy for the reader to act. The goal is to compress information into a format that respects the reader's time and enables fast decisions.

## Update Formats by Audience

| Audience | Format | Length | Frequency |
|---------|--------|--------|-----------|
| CEO / C-suite | 1-page memo or 3-bullet email | <500 words | Weekly or bi-weekly |
| Board / investors | Written memo + optional deck | 1–3 pages | Monthly / quarterly |
| Cross-functional team | Weekly update email or Slack message | <300 words | Weekly |
| Engineering team | Sprint report | <200 words | Per sprint |
| Sales team | Product news bulletin | <150 words | Monthly |
| External customers | Release notes or changelog | As needed | Per release |

## The 3-Section Structure

For any stakeholder update, the structure is:

1. **Status and progress** — what happened? What is the current state?
2. **What needs attention** — risks, blockers, decisions needed, items off track.
3. **What is next** — what happens in the next period?

The ratio should roughly be: 30% progress, 40% what needs attention, 30% next steps. Most bad updates spend 90% on progress and 0% on what needs attention.

## Process

1. **Identify the audience** — who is reading this, and what decisions do they make?
2. **Choose the format** — match the format to the audience and update frequency.
3. **Gather inputs** — sprint metrics, milestone status, blockers, decisions made.
4. **Write the lead** — start with the most important thing; do not bury the headline.
5. **Traffic light the status** — green / yellow / red per initiative or workstream.
6. **Flag what needs action** — be explicit about what you need from the reader.
7. **Write next steps with owners** — vague next steps will not happen.
8. **Keep it short** — if it takes more than 5 minutes to read, it is too long for most audiences.
9. **Send on schedule** — a consistent cadence builds trust; an ad-hoc update signals a crisis.
10. **Save** as `update-[initiative]-[period]-[audience].md`.

## Output Formats

### Executive Weekly Update (email format)

```markdown
Subject: Product Update — Week of [Date]

**Status:** 🟡 On track overall; one risk to flag

---

**What happened this week:**
- SSO development: on track for W8 GA. SAML now working in staging.
- Onboarding checklist: shipped to 10% of new users (controlled rollout). Day-7 activation: 31% (up from 23% baseline). 
- Salesforce integration scoping: 2 design partner calls completed; RFQ sent to Stripe partnership team.

**What needs your attention:**
- 🔴 RISK: Infra team's multi-region migration is 3 weeks behind. This affects our EU data residency feature, which was scoped for Q3. Two options: (1) descope EU residency to Q4, or (2) add a contractor to the infra team. I recommend option 1. Do you want to discuss before I communicate this to sales?
- 🟡 DECISION NEEDED: Legal needs your sign-off on the updated DPA before we can launch SSO to enterprise customers. [Link] — 10 min review.

**This coming week:**
- SSO: complete integration testing; target staging sign-off by Wednesday
- Onboarding: roll out to 50% of new users if W1 activation holds
- Roadmap: Q3 roadmap draft to you by Friday for review

---

Questions? I am available [hours/timezone]. Full details in the project tracker [Link].
```

---

### Product Status Dashboard (weekly doc)

```markdown
# Product Status: Week [N] — [Date Range]
**Overall status:** 🟡 On track with one risk
**Author:** [PM name]

---

## Initiative Status

| Initiative | Status | Last week | This week | Owner |
|-----------|--------|-----------|-----------|-------|
| SSO (SAML/OIDC) | 🟢 On track | SAML working in staging | Integration testing | @eng-lead |
| Onboarding checklist | 🟢 On track | Shipped to 10% of users | Expand to 50% if metrics hold | @pm |
| Salesforce integration | 🟡 Scoping | Design partner calls | Architecture review | @eng |
| SOC 2 preparation | 🔴 At risk | Pen test complete | Waiting on legal review (2 weeks late) | @security |
| EU data residency | 🔴 Blocked | — | Blocked on infra migration (3wk delay) | @infra |

---

## Key Metrics This Week

| Metric | Target | Actual | vs. Last week |
|--------|--------|--------|--------------|
| Day-7 activation | 35% | 31% | +8pp (baseline was 23%) |
| Trial-to-paid conversion | 9.5% | 8.1% | +0.2pp |
| Enterprise pipeline (SSO-blocked) | — | 8 deals, $800K | No change |
| P1 incidents | 0 | 1 | Resolved in 4h |

---

## Risks and Blockers

| Item | Severity | Impact | Owner | Action |
|------|---------|--------|-------|--------|
| Infra multi-region delay (3 weeks) | High | Delays EU data residency to Q4 | @infra | Decision needed: descope or add contractor |
| Legal DPA review overdue | Medium | Blocks SSO enterprise GA | @legal | PM to escalate to CLO |
| SOC 2 gap: vendor management policy | Low | Delays certification by 1 month | @security | Policy draft by EOW |

---

## Decisions Made This Week

1. Onboarding checklist rollout: approved incremental 10% → 50% → 100% rollout cadence
2. Salesforce integration: approved design partner program (3 customers) before full build

---

## Decisions Needed

| Decision | By whom | By when | Options |
|---------|---------|---------|---------|
| EU residency scope change | CEO | Friday | (1) Defer to Q4 / (2) Add contractor |
| DPA sign-off for SSO launch | CEO / Legal | Next Tuesday | Sign or flag changes |

---

## What Is Coming Next Week

- SSO: complete integration testing (target: Wed)
- Onboarding: expand to 50% of new users
- Roadmap: Q3 draft sent for review by Friday
- Salesforce: architecture proposal from engineering
```

---

### Monthly Investor Update

```markdown
# [Company] Product Update — [Month Year]
**For:** [Investor names / Board]
**From:** [CEO / CPO]

---

## Headline

[One sentence: the most important product development this month]
e.g., "We shipped SSO to GA, unblocking 8 enterprise deals in the pipeline."

---

## Product Progress

**Shipped this month:**
- [Feature 1] — [1-sentence customer impact]
- [Feature 2] — [1-sentence customer impact]

**Key metrics:**
| Metric | Last month | This month | Target |
|--------|-----------|------------|--------|
| Day-7 activation | 23% | 31% | 35% |
| Trial-to-paid | 7.8% | 8.1% | 9.5% |
| NPS | 32 | 36 | 40 |

---

## Risks

1. [Risk] — [Likelihood: H/M/L] — [Mitigation]
2. [Risk] — [Likelihood] — [What we are doing]

---

## Ask

[Specific request from investors if any]
e.g., "If you have portfolio companies using Salesforce CRM, we would welcome a warm introduction for our integration design partner program."

---

## Next Month

- [Priority 1] — expected to ship by [date]
- [Priority 2] — entering development
- [Priority 3] — discovery phase
```

---

### Sales Team Product Bulletin (monthly)

```markdown
# Product News for Sales — [Month]

**New this month:**

1. **SSO is live** — You can now tell enterprise prospects we support SAML 2.0 and OIDC. This removes the security blocker from the 8 deals in your pipeline. Update your demo environment with the new SSO flow. [Loom walkthrough — 3 min]

2. **Onboarding is faster** — Day-7 activation is up 35% since we launched the new onboarding checklist. For prospects who objected to "complex setup," this is now your counter: "New customers are live and active in under 2 days."

**Coming next month:**
- Salesforce integration (beta with design partners — nominate your top 3 prospects)
- Scheduled reports (high demand from RevOps buyers)

**Competitive update:**
- Competitor A just raised Series D at $200M. They are going enterprise-only and raising prices. Our opportunity: their SMB customers are now underserved. Consider targeting their smaller customers who feel left behind.

**How to use this in deals:**
- [Objection: "Do you have SSO?"] → "Yes, we support SAML 2.0 and OIDC. Happy to set up a security review call."
- [Objection: "We're still using Competitor B"] → "Most companies outgrow Competitor B around 50+ seats. When you're ready to upgrade, we are designed to scale with you."
```

## Writing Tips for Stakeholder Updates

### Lead with the most important thing
Wrong: "This week the team worked on SSO. We also made progress on onboarding. Additionally..."
Right: "SSO is on track for W8 GA. Key risk: EU data residency is blocked — decision needed by Friday."

### Traffic light consistently
- Green: on track, no action needed
- Yellow: at risk, monitoring — may need attention
- Red: blocked or off track — action or decision required

Do not use yellow as a hedge when green is accurate. Do not use green when yellow is honest.

### Name the ask explicitly
Wrong: "Legal review is taking longer than expected."
Right: "Legal review needs your escalation. Without sign-off by Tuesday, SSO enterprise GA slips by 2 weeks. Please email [legal contact] or I can draft the message for you."

### Keep it short
- Executives read on mobile, between meetings
- Use bullet points for facts; sentences for context
- One paragraph max per initiative in a weekly update
- If it needs more detail, link to the detail — do not paste it

## Anti-Patterns to Avoid

| Anti-pattern | What it looks like | Fix |
|-------------|-------------------|-----|
| Status report, not stakeholder update | Lists everything that happened; no framing | Lead with headline, include only what requires attention |
| Buried lede | 4 paragraphs of good news before mentioning the critical risk | Put risks and asks in paragraph 1 |
| False green | Everything is green even when items are at risk | Be honest with yellow and red; trust is built by accuracy, not optimism |
| No ask | Update ends without a clear request | Every update should close with: "No action needed" or "I need [X] by [date]" |
| Too long | 2-page executive update | One page maximum; link to detail |
| Infrequent | Updates only when there is good news | Consistent cadence builds trust; silence signals problems |

## Rules

- **Lead with the headline** — the most important thing goes first; never bury it.
- **Traffic light clearly** — green means on track, red means needs action; do not use yellow as a hedge.
- **Make asks explicit** — every update should end with "no action needed" or a specific request.
- **Match length to audience** — executives want 5 minutes; engineers want 2 minutes; board wants 10 minutes.
- **Consistent cadence beats perfection** — send every week even if it is brief; cadence builds trust.
- **One note-taker / sender per update** — clarity of ownership prevents duplication and confusion.
- **Link to detail, do not paste it** — details belong in the tracker; summaries belong in the update.
- **Risk reporting is a strength** — flagging problems early is a sign of good judgment, not failure.
- **Quantify where possible** — "activation improved" is weaker than "activation increased 8pp to 31%."
- **Send on schedule regardless** — even a brief "everything on track, no decisions needed this week" is better than silence.
