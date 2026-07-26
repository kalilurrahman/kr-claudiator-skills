---
name: launch-checklist
description: Generate a comprehensive product launch checklist covering engineering, design, marketing, legal, support, and analytics readiness. Outputs a trackable launch plan with owners, dependencies, and go/no-go criteria.
argument-hint: [product or feature name, launch type, team size, target date, target audience]
allowed-tools: Read, Write
---

# Product Launch Checklist

A failed launch is almost always a coordination failure, not a product failure. The feature works. The marketing is ready. But support is not trained, analytics are not instrumented, or legal has not signed off. This generates a complete, cross-functional launch checklist tailored to your launch type.

## Launch Type Framework

| Type | Scope | Risk | Process rigor |
|------|-------|------|--------------|
| **Soft launch** | Internal / beta / invite-only | Low | Light process |
| **Limited release** | Specific segment, feature-flagged | Medium | Standard process |
| **General availability (GA)** | All users, full rollout | High | Full checklist |
| **Major product launch** | New product or major feature with external announcement | Very high | Full checklist + comms |

## Output Format

```markdown
# Launch Checklist: [Feature/Product Name]

**Launch type:** [Soft / Limited / GA / Major]  
**Target launch date:** [Date]  
**PM owner:** [Name]  
**Engineering owner:** [Name]  
**Last updated:** [Date]

---

## Go/No-Go Criteria

*All P0 items must be complete. P1 items must be complete for GA. P2 items should be complete.*

| Criterion | Owner | Status | Notes |
|-----------|-------|--------|-------|
| [P0] Core user flow works end-to-end in production | QA | ✅ / ❌ / 🔄 | |
| [P0] No critical bugs open | Eng lead | | |
| [P0] Analytics events instrumented and verified | Analytics | | |
| [P0] Legal/compliance sign-off | Legal | | |
| [P0] Security review complete | Security | | |
| [P1] Support team trained | CS lead | | |
| [P1] Help documentation published | Docs | | |
| [P1] Rollback plan documented and tested | Eng | | |
| [P2] Marketing assets ready | Marketing | | |

**Go/No-Go decision:** [Name] on [Date]  
**Decision:** Go ✅ / No-Go ❌ / Conditional Go ⚠️ — [conditions]

---

## Engineering Readiness

### Code & Deployment
- [ ] Feature complete and code reviewed
- [ ] All P0/P1 bugs resolved; P2 bugs documented and accepted
- [ ] Feature flag configured — default: [on/off], rollout: [X%]
- [ ] Canary deployment plan documented
- [ ] Rollback procedure written and tested
- [ ] Database migrations tested and rolled back successfully in staging

### Performance & Scale
- [ ] Load tested at [N]x expected launch traffic
- [ ] P99 latency meets SLA: [<Xms]
- [ ] No memory leaks or resource exhaustion identified
- [ ] CDN/caching configured for new static assets

### Observability
- [ ] New endpoints added to monitoring dashboard
- [ ] Alert thresholds configured: error rate > [X%], latency > [Xms]
- [ ] Log levels appropriate for production (no debug logging at scale)
- [ ] On-call runbook updated with new failure modes

### Security
- [ ] Security review completed (OWASP, auth, input validation)
- [ ] PII handling reviewed and compliant
- [ ] API endpoints authenticated and authorized correctly
- [ ] Third-party dependencies reviewed for known CVEs

---

## Product & Design Readiness

### Core Experience
- [ ] Happy path tested by PM end-to-end in production/staging
- [ ] Error states designed and implemented
- [ ] Empty states designed and implemented
- [ ] Mobile experience tested (if applicable)
- [ ] Accessibility review completed (WCAG AA)

### Analytics & Instrumentation
- [ ] User flows instrumented with events — [list key events]
- [ ] Funnel analytics configured: [Step 1] → [Step 2] → ... → [conversion]
- [ ] Feature adoption metric defined and trackable
- [ ] A/B test configured (if applicable)
- [ ] Verified events firing in production — not just staging

### Feature Flag / Rollout Plan
- [ ] Feature flag created: [flag-name]
- [ ] Rollout plan documented: [0% → X% → 100% schedule]
- [ ] Rollout criteria defined: [what metric/signal triggers each expansion]
- [ ] Kill switch verified to work

---

## Customer-Facing Readiness

### Documentation
- [ ] Help center article written and reviewed
- [ ] In-product tooltip / onboarding text reviewed
- [ ] API documentation updated (if applicable)
- [ ] Video walkthrough recorded (if applicable for major features)

### Support
- [ ] Support team briefed with: what it does, common questions, known limitations
- [ ] FAQ documented for support team
- [ ] Support team has access to test the feature
- [ ] Escalation path defined for launch-related issues

### Customer Success (for enterprise features)
- [ ] CS team briefed
- [ ] Key accounts identified for proactive outreach
- [ ] Talking points prepared for account reviews
- [ ] Any customer commitments around this feature reviewed

---

## Communications Readiness

### Internal
- [ ] Engineering, design, CS, sales briefed
- [ ] Changelog / release notes written and reviewed
- [ ] Internal Slack announcement drafted

### External (GA and Major launches)
- [ ] Blog post / announcement written, reviewed, scheduled
- [ ] Email announcement drafted and approved
- [ ] Social media posts prepared
- [ ] Press / analyst outreach (if applicable) — embargo date: [date]
- [ ] Customer-facing release notes published or queued

### Sales Enablement
- [ ] Sales team briefed on what to say and not say
- [ ] Battlecard updated
- [ ] Demo environment updated with new feature
- [ ] Pricing/packaging implications communicated

---

## Legal & Compliance

- [ ] Privacy review complete (new data collected? New third-party sharing?)
- [ ] Terms of service changes reviewed (if applicable)
- [ ] Regulatory compliance checked: [GDPR / HIPAA / SOC2 / CCPA as applicable]
- [ ] Legal sign-off obtained: [Name] on [Date]

---

## Launch Day Plan

**T-24h:**
- [ ] Final go/no-go review with [names]
- [ ] Engineering on standby: [who is on-call]
- [ ] Communications queued and ready to send

**T-0 (launch):**
- [ ] Feature flag enabled at [X%]
- [ ] Monitoring dashboard open and watched
- [ ] External communications sent / published
- [ ] #launch-[name] Slack channel open for real-time updates

**T+2h:**
- [ ] Error rate check: [target threshold]
- [ ] Support queue check: [threshold for pausing rollout]
- [ ] Feature flag decision: expand to [Y%] or pause

**T+24h:**
- [ ] Full launch metrics review
- [ ] Decision: continue rollout to 100%, pause, or roll back
- [ ] Initial learnings documented

---

## Post-Launch (T+7d)

- [ ] Launch metrics reviewed vs. success criteria
- [ ] Top user feedback themes collected
- [ ] Top support issues documented
- [ ] Retrospective scheduled: [Date]
- [ ] Quick wins / follow-on work identified and prioritized
```

## Launch Retrospective Template

Run 1–2 weeks after every GA launch:

```markdown
# Launch Retrospective: [Feature Name]

**Date:** [Date]  
**Attendees:** [Names]

**Launch results vs. success criteria:**
| Metric | Target | Actual | Notes |
|--------|--------|--------|-------|
| [Metric] | [target] | [actual] | |

**What went well:**
- [Specific thing that worked]

**What to improve:**
- [Specific issue with root cause and fix for next launch]

**Action items:**
| Action | Owner | By when |
|--------|-------|---------|
| [Checklist update] | PM | [Date] |
| [Process change] | [Owner] | [Date] |
```

## Rules

- **Go/No-Go is a real decision** — not a formality. P0 items not complete = no go.
- **Every item has an owner** — a checklist item with no owner is a liability.
- **Test in production, not just staging** — staging lies. Verify analytics events are firing in production.
- **Rollback plan before launch** — if you cannot roll back, you are not ready to launch.
- **Support training before launch, not after** — the first wave of users will contact support; they must be ready.
- **Analytics instrumentation is P0** — launching without measurement is launching blind.
- **Feature flag default-off** — new features should be off by default, turned on for test groups first.
- **Launch retrospective is mandatory** — it is the only way to improve your launch process.
- **Communicate delays proactively** — stakeholders who hear about delays at the last minute lose confidence.
- **Legal earlier than you think** — legal reviews take longer than expected and cannot be rushed.
