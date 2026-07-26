---
name: feature-spec
description: Write comprehensive feature specifications that align engineering, design, and stakeholders before a single line of code is written. Outputs problem statement, requirements, edge cases, success metrics, and open questions.
argument-hint: [feature type, stage of discovery, stakeholders, implementation deadline]
allowed-tools: Read, Write
---

# Feature Specification

A feature spec converts an ambiguous idea into a shared understanding of what to build, why, and how to measure success. Written before design and engineering begin, it surfaces misalignments early when changes are cheap. A good spec asks hard questions; a bad spec defers them to sprint planning.

## Feature Spec Template

```markdown
# Feature Spec: [Feature Name]

**Status:** Draft | In Review | Approved | Shipped  
**Author:** @pm-name  
**Last updated:** YYYY-MM-DD  
**Target release:** Sprint 24 / Q2 2024  
**Stakeholders:** @eng-lead, @design-lead, @cs-lead, @data-lead

---

## 1. Problem Statement

### What problem are we solving?
[1-3 sentences. Be specific about the customer pain. Avoid describing the solution.]

Example: "B2B customers with multiple departments cannot share automations between teams without manually duplicating them. This creates maintenance burden (every team maintains their own version) and inconsistency (teams diverge over time). We see this pain in 23% of support tickets mentioning 'share' or 'team' in the last 90 days."

### Who has this problem?
**Primary:** [Customer segment, size, role]  
**Secondary:** [Other affected parties]

### How do we know this is real?
- Customer interview evidence: [links to notes]
- Support ticket analysis: [link to analysis]
- Usage data: [specific numbers]
- Sales feedback: [# deals mentioning this]

### What happens if we don't solve it?
[Consequence of inaction — churn risk, competitive gap, support cost]

---

## 2. Goals and Non-Goals

### Goals
- [ ] Enable users to share a workflow template with their team
- [ ] Allow template consumers to fork the template and customise it
- [ ] Maintain the connection: changes to the template propagate to consumers (optional)

### Non-Goals (explicitly out of scope)
- Cross-organisation sharing (future)
- Template versioning history
- Granular permission levels within a team (read/write/admin)
- Template marketplace (public templates) — not this release

---

## 3. Proposed Solution

### User story
As a **team admin**, I want to **publish a workflow as a shared team template** so that **my colleagues can use and build on my work without starting from scratch**.

### User flow

1. User opens an existing workflow they own
2. Actions menu → "Publish as Team Template"
3. Modal: enter template name, description, optional category tag
4. Confirm → template appears in team template library
5. Template consumers browse library → click "Use this template"
6. System creates a copy in their workspace → opens in editor
7. Consumer can edit their copy; original template unchanged

### Wireframes / Design links
[Link to Figma]

### Key design decisions

**Decision:** Template consumers get a fork (copy), not a live link to the original.
**Rationale:** Simpler implementation. Live sync requires conflict resolution complexity.
**Trade-off:** Changes to the original don't propagate. Acceptable for MVP.

**Decision:** Only admins can publish templates; all members can use them.
**Rationale:** Quality control. Too many templates creates noise.
**Trade-off:** Power users who aren't admins frustrated. Mitigate: easy admin request flow.

---

## 4. Requirements

### Functional requirements (P0 = must have, P1 = should have, P2 = nice to have)

| ID | Priority | Requirement |
|----|----------|-------------|
| FR-1 | P0 | Admin can publish a workflow as a team template |
| FR-2 | P0 | Published template appears in team template library |
| FR-3 | P0 | Any team member can browse and search the template library |
| FR-4 | P0 | Member can create a copy of a template in their workspace |
| FR-5 | P0 | Template copy is fully editable and independent |
| FR-6 | P1 | Admin can unpublish a template |
| FR-7 | P1 | Template has name, description, category tag, and author attribution |
| FR-8 | P1 | Template library supports search by name and tag |
| FR-9 | P2 | Admin can see usage count per template |
| FR-10 | P2 | Templates can be organised into folders |

### Non-functional requirements
- Template creation: < 2 seconds p99
- Template library load: < 1 second p99
- Templates searchable immediately after publish (no delay)

---

## 5. Edge Cases

| Scenario | Expected Behaviour |
|----------|-------------------|
| Admin publishes template then deletes their account | Template remains; attributed to "Former Team Member" |
| Member copies template then admin unpublishes | Member's copy is unaffected |
| Template name collision | Allowed — templates are identified by ID, not name |
| Empty template (0 steps) | Allow publish; consumer sees empty workflow |
| Template with broken integrations | Allow publish with warning; consumer sees broken integration |
| Team downgraded to free plan | Templates remain visible but new publishing disabled |

---

## 6. Success Metrics

### Primary (measured 30 days post-launch)
- **Template adoption:** % of teams with ≥1 published template: target 25%
- **Template usage:** % of accounts that use a template in their first 30 days: target 15%

### Secondary
- Templates published per team (average): target 3+
- Template → published workflow conversion: % who take a template live: target 60%

### Guardrail metrics (must not regress)
- Workflow creation time (p99): must not increase
- Support tickets about sharing/templates: should decrease

### Leading indicator
Weekly: # of templates published

---

## 7. Open Questions

| # | Question | Owner | Due | Answer |
|---|---------|-------|-----|--------|
| 1 | Do templates count toward workflow usage limits? | @eng-lead + @pm | Mar 20 | TBD |
| 2 | Can admins edit a template after publishing? | @design-lead | Mar 18 | TBD |
| 3 | What happens to copies when template is deleted? | @pm | Mar 20 | TBD |
| 4 | Should there be a max templates per team? | @pm | Mar 22 | TBD |

---

## 8. Dependencies and Risks

### Dependencies
- Design: Final wireframes (due Mar 20)
- Data: Template events instrumentation (coordinate with data team)
- Legal: No additional T&C changes required (confirmed)

### Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Template library becomes noisy with low-quality templates | Medium | Medium | Curation tools in admin panel (P2) |
| Low adoption due to discoverability | Medium | High | Feature announcement email + in-app tooltip |
| Engineers underestimate complexity | Low | High | Spike on permissions model (before sprint commitment) |

---

## 9. Technical Notes for Engineering

(PM summary of known technical constraints — engineering fills in full detail)

- Templates stored as workflow snapshots (JSON) in existing workflow table with `is_template: true` flag
- Template copies need deep clone — all step configs but not execution history
- Search: existing Elasticsearch index can be extended with template metadata
- Permissions: leverage existing team membership model; no new permission types

---

## 10. Launch Plan

- [ ] Feature flag: `team_templates` (default off)
- [ ] Beta: 5 accounts in beta programme (1 week)
- [ ] Limited rollout: 20% of accounts (1 week)
- [ ] General availability: all accounts
- [ ] Communications: in-app announcement, changelog, CS enablement doc
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Solution in problem statement** | "We need to add a share button" — skips the why | Problem first: what pain exists? Then solutions |
| **No non-goals** | Scope creep during development | Explicitly list what this release does NOT include |
| **Missing edge cases** | Engineers discover them in code review — too late | PM writes edge cases; engineer adds more before sprint |
| **No success metrics** | Can't determine if feature succeeded | Define metrics before building |
| **Deferring open questions** | Questions surface in sprint review | Resolve all P0 open questions before sprint starts |
| **Too much detail** | Spec becomes implementation plan — engineers stop thinking | Spec the "what"; engineers own the "how" |

## 10 Rules

1. Problem statement describes customer pain, not the solution — the solution comes later.
2. Non-goals are as important as goals — they prevent scope creep during development.
3. Edge cases are written by the PM before engineering asks — not discovered in code review.
4. Success metrics are defined before a single line of code is written.
5. Open questions must be resolved before the sprint starts — not during it.
6. Specs describe "what" and "why" — engineers own "how."
7. A spec that doesn't get pushback from engineering is probably too vague.
8. The spec is updated as decisions are made — it's a living document, not a one-time artefact.
9. Stakeholders review and approve before development starts — not during.
10. The shortest spec that answers all questions is the best spec — length is not quality.
