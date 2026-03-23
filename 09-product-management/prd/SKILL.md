---
name: prd
description: Write a complete Product Requirements Document from a feature idea or problem statement. Produces a structured PRD with goals, user stories, acceptance criteria, edge cases, and success metrics.
argument-hint: [feature name, problem statement, target users, business goal]
allowed-tools: Read, Write
---

# Product Requirements Document (PRD)

A PRD is the contract between product, engineering, and design. It defines what success looks like, why we are building this, and what "done" means — without prescribing implementation. A good PRD eliminates ambiguity before the first line of code is written.

## Process

1. **Define the problem first** — what pain exists today? What evidence proves it?
2. **State the business goal** — what metric moves and by how much?
3. **Define the user** — who specifically has this problem? Not "all users."
4. **Write user stories** — structured as "As [user], I want [action] so that [outcome]."
5. **Define acceptance criteria** — testable, unambiguous, written as pass/fail conditions.
6. **Map edge cases** — what happens with empty states, errors, limits, concurrent users?
7. **Define out of scope** — list what this PRD explicitly does NOT cover.
8. **Set success metrics** — how will you know it worked, and by when?
9. **Note dependencies** — design assets, API readiness, data requirements, legal review.
10. **Get sign-off** — product lead, engineering lead, design lead before development starts.

## Output Format

```markdown
# PRD: [Feature Name]
**Status:** Draft / In Review / Approved / Shipped
**Author:** [PM name]
**Created:** [Date]
**Last updated:** [Date]
**Eng lead:** [Name]
**Design lead:** [Name]
**Target release:** [Q3 2025 / Sprint 12]

---

## Problem Statement

**What is the problem?**
[1–2 sentences describing the specific pain, anchored in evidence]

**Who has this problem?**
[Specific user segment — e.g., "Admin users at companies with 10+ team members"]

**Evidence this problem exists:**
- [User research finding, support ticket volume, NPS verbatim, analytics data]
- [e.g., "34% of new users abandon setup at the 'Invite team' step (Mixpanel, Jan 2025)"]
- [e.g., "15 support tickets in Q1 about team invitation failures"]

**Current workaround:**
[What do users do today to solve this? Why is it insufficient?]

---

## Goals

**Business goal:**
[What metric moves? By how much? By when?]
e.g., "Reduce setup abandonment from 34% to below 20% by end of Q2 2025."

**User goal:**
[What outcome does the user achieve?]
e.g., "Admin can invite their team in under 2 minutes without IT involvement."

**Non-goals (explicitly out of scope):**
- [e.g., "Bulk CSV import of users — separate PRD"]
- [e.g., "SSO / SCIM provisioning — planned for Q3"]
- [e.g., "Permission management — existing RBAC is sufficient"]

---

## User Stories

### Must Have (P0)
- **US-01:** As an admin, I want to invite team members by email so that they can access the workspace without creating an account manually.
  - AC: Admin can enter multiple email addresses (comma-separated or one per line)
  - AC: Each invitee receives an email within 5 minutes of invite being sent
  - AC: Invite email contains a one-click join link valid for 7 days
  - AC: Admin sees pending invite status in team management view

- **US-02:** As an invitee, I want to join the workspace via email link so that I do not need to sign up through the main flow.
  - AC: Link lands on an accept page pre-filled with invitee's email
  - AC: If invitee has an existing account, link logs them in and adds them to workspace
  - AC: If invitee has no account, link creates account and adds them to workspace
  - AC: Expired link shows a clear error and option to request a new one

### Should Have (P1)
- **US-03:** As an admin, I want to set a role when inviting a user so that permissions are correct from day one.
  - AC: Role dropdown on invite form: Admin, Member, Viewer
  - AC: Default role is Member
  - AC: Role can be changed after invite is accepted

- **US-04:** As an admin, I want to resend or revoke a pending invitation so that I can manage incomplete invites.
  - AC: Pending invites show in team management with "Resend" and "Revoke" actions
  - AC: Revoking an invite invalidates the link immediately

### Nice to Have (P2)
- **US-05:** As an admin, I want to invite users via a shareable link so that I do not need individual email addresses.
  - AC: Admin can generate a workspace join link
  - AC: Link can be set to expire or be disabled

---

## Edge Cases

| Scenario | Expected behavior |
|----------|------------------|
| Invitee email already has an account in another workspace | Accept invite adds them to new workspace; does not affect existing workspace |
| Admin invites same email twice | Second invite resends; does not create duplicate pending invite |
| Invitee clicks expired link | Error page with "Request new invite" CTA; notifies admin via email |
| Admin account downgraded before invite accepted | Invitee joins at correct role; downgrade does not affect their role |
| 100+ pending invites | Team management table paginates at 50; search by email available |
| Email delivery failure | Retry 3x over 1 hour; admin notified of failure after 3 retries |
| Invitee closes tab mid-join | Session preserved; re-clicking link completes the flow |

---

## Success Metrics

| Metric | Baseline | Target | Measurement date |
|--------|----------|--------|-----------------|
| Setup abandonment rate | 34% | < 20% | 30 days post-launch |
| Invite acceptance rate | — | > 75% | 30 days post-launch |
| Time to first team invite | — | < 2 min (p50) | 14 days post-launch |
| Support tickets: invite-related | 15/quarter | < 5/quarter | 1 quarter post-launch |

---

## Dependencies

| Dependency | Owner | Status | Required by |
|-----------|-------|--------|-------------|
| Email sending infrastructure | Infra | Ready | Dev start |
| Design system — invite modal | Design | In progress | W2 of sprint |
| Legal review — email T&C | Legal | Not started | Before launch |
| RBAC v2 (for role assignment) | Platform | Shipped | Available now |

---

## Open Questions

| # | Question | Owner | Due date | Status |
|---|---------|-------|----------|--------|
| 1 | Should invite links be domain-restricted? (e.g., only @company.com) | PM + Sales | W2 | Open |
| 2 | What is the invite expiry window? 7 days or configurable? | PM | W1 | Open |
| 3 | Do we notify admin when invite is accepted? | PM + Design | W1 | Open |

---

## Out of Scope

- Bulk CSV user import
- SSO / SCIM provisioning
- Guest access (view-only, no account required)
- Custom invitation email branding
- Slack or calendar-based invitations

---

## Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| PM | [Name] | — | Pending |
| Eng Lead | [Name] | — | Pending |
| Design Lead | [Name] | — | Pending |
| Legal | [Name] | — | Pending |
```

## Worked Example: Acceptance Criteria Best Practices

**Bad AC:** "The invite flow should be fast and easy to use."
**Why bad:** Not testable. "Fast" and "easy" are subjective.

**Good AC:** "Invite email is delivered within 5 minutes of submission in 99% of cases. Join link pre-fills invitee's email. Expired link shows an error message and a 'Request new invite' CTA within 1 second of page load."

**Bad AC:** "Handle errors gracefully."
**Why bad:** Unspecified. What errors? What is graceful?

**Good AC:** "If email delivery fails after 3 retries over 60 minutes, admin receives a dashboard notification with the failed email address and a 'Retry' action."

## PRD vs. Spec

| PRD | Spec / Tech Design |
|-----|-------------------|
| What and why | How |
| Written by PM | Written by engineering |
| Acceptance criteria | Implementation details |
| User-facing behavior | Database schema, API contracts |
| Business success metrics | System performance requirements |

PRDs define the what. Engineers write the how. Never put implementation details in a PRD.

## Anti-Patterns to Avoid

| Anti-pattern | What it looks like | Fix |
|-------------|-------------------|-----|
| Solution-first PRD | "Build a modal with a text field for..." | Start with the problem statement |
| Vague ACs | "Should work correctly" | Write testable pass/fail conditions |
| Missing non-goals | Scope expands during development | Explicitly list what is out of scope |
| No success metric | "We will know it worked when users are happy" | Define a specific metric with baseline and target |
| Approval theater | Sign-offs happen but nobody read it | Walk stakeholders through it in a 30-min review |
| Edge cases ignored | Happy path only in ACs | Enumerate error states, empty states, limits |

## Rules

- **Problem before solution** — the first section of every PRD is the problem statement, not the feature description.
- **Acceptance criteria must be testable** — if a QA engineer cannot write a test for it, rewrite the AC.
- **Non-goals are as important as goals** — scope creep happens when out-of-scope is not written down.
- **Every metric needs a baseline** — "improve conversion" without a baseline is unmeasurable.
- **Edge cases are not optional** — list at least 5 for any user-facing feature.
- **Open questions must have owners and due dates** — an unanswered question is a development blocker.
- **PRD is a living document** — update it as decisions are made; do not freeze it at first draft.
- **Keep implementation out** — a PRD that prescribes technology is a PRD that engineers will ignore.
- **Get sign-off before sprint start** — PRDs approved mid-sprint cause rework and scope changes.
- **Size matters** — a one-page PRD for a S feature; a ten-page PRD for an XL feature. Match depth to complexity.
