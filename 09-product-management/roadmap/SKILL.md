---
name: roadmap
description: Build a strategic product roadmap from business goals and team capacity. Outputs a prioritized, time-horizoned plan with themes, milestones, dependencies, and stakeholder communication format.
argument-hint: [product strategy, team capacity, timeframe, key stakeholders]
allowed-tools: Read, Write
---

# Product Roadmap Builder

A roadmap is a communication tool, not a promise. It aligns stakeholders on direction and priorities while preserving flexibility to adapt. This builds a roadmap that is strategic, honest about uncertainty, and defensible to engineering, sales, and leadership.

## Process

1. **Start with strategy** — what are the 2–3 business outcomes this roadmap must serve? Roadmap without strategy is a task list.
2. **Group into themes** — cluster initiatives by strategic outcome, not by feature type.
3. **Horizon planning** — Now (committed, this quarter), Next (likely, next 2 quarters), Later (directional, 6+ months).
4. **Sequence by value and dependency** — what unlocks what? What pays for what?
5. **Validate with engineering** — get rough sizing before publishing.
6. **Capacity check** — map themes to team bandwidth, flag overcommitment.
7. **Identify dependencies and risks** — external APIs, internal platform, hiring, legal.
8. **Build the stakeholder view** — executive summary, sales, customer-facing versions.
9. **Define review cadence** — when will you revisit and who participates?
10. **Save** to `roadmap-[product]-[quarter].md`.

## Output Format

```markdown
# Product Roadmap: [Product Name]
**Period:** [Q1 2025 – Q4 2025]
**Last updated:** [Date]
**Owner:** [PM name]
**Next review:** [Date]

---

## Strategy Context

**Company objectives this roadmap serves:**
1. [OKR or strategic goal 1 — e.g., "Increase enterprise ACV by 40%"]
2. [OKR or strategic goal 2 — e.g., "Reduce time-to-value from 14 days to 3 days"]

**What we are optimizing for this period:** [Retention / Acquisition / Expansion / Efficiency]

**What we are explicitly NOT doing this period:** [e.g., "New product lines", "International expansion"]

---

## Themes

| # | Theme | Strategic Goal | Success Metric | Team |
|---|-------|----------------|----------------|------|
| 1 | [Enterprise Security] | [Unlock mid-market deals] | [5 enterprise logos by Q3] | Platform |
| 2 | [Onboarding & Activation] | [Reduce churn] | [Day-7 activation >60%] | Growth |
| 3 | [Integration Ecosystem] | [Reduce switching cost] | [10 native integrations] | API |

---

## NOW — This Quarter (Committed)

### Theme 1: [Enterprise Security]

| Initiative | Why it matters | Owner | Size | Status | Due |
|-----------|----------------|-------|------|--------|-----|
| SSO / SAML support | Blocker for 8 open enterprise deals | @eng-lead | L | On track | W6 |
| Audit log export | Compliance requirement for FSI segment | @eng-lead | M | At risk | W10 |
| Role-based permissions v2 | Granularity requested by 12 customers | @eng-lead | M | On track | W8 |

**Q[X] Milestones:**
- [W4]: Beta launch of SSO to 10 design partners
- [W8]: GA launch of RBAC v2
- [W12]: Audit log GA + compliance docs published

**Acceptance criteria:**
- SSO supports SAML 2.0 and OIDC
- Audit log exports to CSV/JSON, 90-day retention
- RBAC supports custom roles with field-level permissions

### Theme 2: [Onboarding & Activation]

| Initiative | Why it matters | Owner | Size | Status | Due |
|-----------|----------------|-------|------|--------|-----|
| Interactive product tour | Day-1 activation currently 23% → target 45% | @growth | S | On track | W4 |
| Empty state templates | Users stuck at blank canvas = 34% drop-off | @design | S | On track | W3 |
| Onboarding email sequence | 7-day drip has 18% open rate, needs rebuild | @marketing | M | On track | W5 |

---

## NEXT — Next 2 Quarters (Likely)

*Direction is set; sizing is rough. Subject to NOW results and Q[X] retro.*

### Theme 1: [Enterprise Security]
- **Advanced SCIM provisioning** — Automate user lifecycle management. Depends on SSO GA. (~L)
- **Data residency controls** — EU/APAC data localization for regulated industries. Depends on infra multi-region. (~XL)
- **Custom security policies** — Admin-defined session timeouts, IP allowlists. (~M)

**Key uncertainties:**
- If SSO adoption exceeds 50% in Q1, we fast-track SCIM provisioning
- Data residency timeline depends on infra team completing multi-region work

### Theme 2: [Onboarding & Activation]
- **In-app checklist + progress tracker** — Drive feature discovery beyond initial setup. (~M)
- **Role-based onboarding paths** — Different flows for admin vs. end user. (~L)
- **Trial-to-paid conversion optimization** — Paywall timing and upgrade prompts. (~M)

### Theme 3: [Integration Ecosystem]
- **Salesforce native integration** — Bi-directional sync with CRM. Highest sales-requested integration. (~XL)
- **Zapier / Make connector** — Self-serve automation for SMB segment. (~M)
- **Public API v2** — REST + webhook parity, pagination, rate limits. (~L)

---

## LATER — 6+ Months (Directional)

*Communicates direction, not commitment. Do not share specific timelines externally.*

- **AI-powered recommendations** — Proactive nudges based on usage patterns. Requires data platform investment.
- **Mobile app** — iOS/Android companion. Blocked on defining mobile-first use cases.
- **White-label / OEM** — Partner channel via embedded product. Requires platform architecture.
- **Advanced analytics suite** — Custom dashboards and data export for enterprise customers.

---

## Dependencies & Risks

| Item | Type | Blocks | Owner | Status | ETA |
|------|------|--------|-------|--------|-----|
| Multi-region infra | Internal | Data residency | Infra lead | In progress | Q3 |
| Salesforce API quota | External | Salesforce integration | Vendor | Pending | Q2 |
| Design system v3 | Internal | All frontend work | Design | 60% done | W6 |
| Legal review — data residency | Internal | EU launch | Legal | Not started | — |

**Top 3 risks:**
1. **Infra multi-region slips** — P: M / I: H — Mitigation: Decouple EU from other NEXT items.
2. **SSO scope creep** — P: M / I: M — Mitigation: Lock scope at SAML + OIDC; defer SCIM explicitly.
3. **Engineering capacity** — P: H / I: H — Mitigation: Protect 20% buffer for incidents and tech debt.

---

## Capacity Overview

| Team | Q[X] capacity (eng-weeks) | Committed | Buffer | Notes |
|------|--------------------------|-----------| -------|-------|
| Platform (6 eng) | 72 | 58 (80%) | 14 (20%) | 2 eng PTO W3–W5 |
| Growth (3 eng) | 36 | 27 (75%) | 9 (25%) | — |
| API (2 eng) | 24 | 18 (75%) | 6 (25%) | On-call included |

**Sizing key:** S = 1–2 weeks, M = 3–5 weeks, L = 6–10 weeks, XL = 10+ weeks

---

## What We Are NOT Building (This Period)

| Request | Requester | Why deferred | Revisit when |
|---------|-----------|--------------|--------------|
| Desktop app | 4 enterprise customers | High build cost; web covers 95% of use cases | Mobile data in Q3 |
| Custom domain | SMB customers | Low conversion impact vs. effort | H2 if churn data shows impact |
| Bulk data import v2 | CS team | v1 handles 90% of cases; redesign needs discovery | Q3 after user research |
| Offline mode | Sales demo requests | Core architecture change; not aligned with Q1 goals | Future architecture review |

---

## Stakeholder Communication Plan

### Executive summary (monthly)
- 3 bullets: what shipped, what is at risk, what is coming
- Traffic light status per theme
- Single ask: decisions needed or blockers to resolve

### Sales version (quarterly, public-safe)
- Theme names only, no dates on NEXT/LATER
- "We are investing in X" language, not "shipping X on [date]"
- Updated before QBRs

### Customer-facing roadmap (public portal)
- Problem statements, not feature names
- "Exploring / Building / Launched" status
- No timelines beyond current quarter
```

## Worked Example

**Situation:** B2B analytics tool, 200 customers, Series A. CEO wants "everything" in H1. You have 12 engineers.

**Strategy filter:**
- Company goal: $5M ARR from $2M — requires enterprise motion
- Enterprise blockers (per sales): SSO, audit logs, custom roles
- Activation is 23% (industry avg: 40%) — growth leaking at top of funnel

**Resulting theme prioritization:**
1. Enterprise Security — unlocks $1.5M in pipeline — **NOW**
2. Activation — fix the leaky bucket — **NOW**
3. Integrations — stickiness and expansion — **NEXT**
4. AI features — competitive moat — **LATER**

**CEO pushback conversation:**
> "We have 12 engineers and three themes. Committing to four means doing none well. Here is what we ship in H1 and why it maps directly to the ARR target. Here is what we are not building and why. I need your sign-off on this tradeoff."

## Stakeholder Scenarios

**Sales wants a customer commitment date:**
Wrong: Give a date to keep the deal moving.
Right: "We are targeting Q2 for SSO GA. I can add this customer to our beta at W8. I cannot commit to a contract SLA on a feature not yet shipped."

**Engineering says scope is too big:**
Right: "Let us scope-cut to the minimum version that unblocks the use case. What is the smallest SSO implementation that lets enterprise customers pass a security review? Ship that, then iterate."

**Exec adds a new priority mid-quarter:**
Right: "I can add this. What comes off? We are at 80% capacity. Here are the three items at risk if we add a new L initiative. Which tradeoff do you want to make?"

## Anti-Patterns to Avoid

| Anti-pattern | What it looks like | Fix |
|-------------|-------------------|-----|
| Feature factory | Long list of features with no strategic rationale | Group into themes tied to outcomes |
| Fake precision | Specific dates on LATER items | Use quarters or Now/Next/Later |
| No tradeoffs | Everything is "high priority" | Explicitly list what you are NOT building |
| Unsized work | 15 XL projects in one quarter | Validate capacity before publishing |
| Promise roadmap | Customers get exact dates, become contractual | Separate internal and external views |
| Engineering surprise | Roadmap published without eng input | Validate with tech lead first |
| Dependency blindness | Assumes all dependencies resolve on time | Surface every cross-team dependency |
| Quarterly reset | Roadmap changes entirely every 3 months | Preserve themes; update initiative priority |

## Rules

- **Themes over features** — group work by outcome, not by feature type.
- **Three horizons always** — Now/Next/Later prevents wishlist or rigid plan.
- **Capacity check before publishing** — a roadmap full of unscoped work is fiction.
- **"What we are NOT building" is as important as what you are** — defuses stakeholder lobbying.
- **Separate customer-facing from internal** — never give customers dates on NEXT/LATER items.
- **Strategic rationale for every theme** — if you cannot explain why a theme serves a goal, cut it.
- **Dependencies are first-class** — a roadmap that ignores dependencies is a disappointment schedule.
- **Review cadence is part of the roadmap** — specify how often updated and who participates.
- **Honest uncertainty beats false confidence** — "we think" and "subject to Q1 learnings" are correct.
- **A roadmap is not a contract** — state this explicitly to every new stakeholder.
