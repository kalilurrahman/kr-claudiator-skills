---
name: user-stories
description: Write well-formed user stories with acceptance criteria, edge cases, and definition of done for a feature or epic. Produces sprint-ready stories that engineering can estimate and design can use.
argument-hint: [feature or epic, user type, business goal, known constraints]
allowed-tools: Read, Write
---

# User Story Writer

User stories define what needs to happen from a user's perspective. They are not implementation specs — they are a conversation starter between product, engineering, and design. A well-written story has clear intent, testable acceptance criteria, and explicit edge cases so that "done" is unambiguous.

## Story Anatomy

```
As a [specific user type],
I want to [take a specific action],
So that [I achieve a specific outcome].

Acceptance Criteria:
- GIVEN [initial state], WHEN [user action], THEN [expected system response]
- [Additional testable conditions]

Definition of Done:
- [ ] Code merged to main
- [ ] Unit and integration tests written
- [ ] Design review completed
- [ ] Edge cases handled
- [ ] Documentation updated (if needed)
```

## INVEST Checklist

Every user story should be:
- **I**ndependent — can be built and delivered without depending on another incomplete story
- **N**egotiable — the how is negotiable; the user need is fixed
- **V**aluable — delivers value to the user or business
- **E**stimable — engineering can size it
- **S**mall — fits within one sprint (1–2 weeks)
- **T**estable — QA can write a test for every AC

## Process

1. **Start with the epic** — understand the full feature; then break into stories.
2. **Identify all user types** — who interacts with this? Admin, end user, anonymous visitor, API consumer?
3. **Write the story statement** — be specific about the user type; avoid generic "user."
4. **Write acceptance criteria in Given/When/Then** — one condition per bullet.
5. **Add edge cases** — what happens at limits? With bad input? After error states?
6. **Write the definition of done** — engineering + product agreement on what "shipped" means.
7. **Estimate complexity** — use story points or T-shirt sizing after writing ACs.
8. **Link to design specs** — attach Figma or design documentation if available.
9. **Identify dependencies** — does this story need another story or backend work to be done first?
10. **Review with engineering** — walk through ACs and edge cases before sprint planning.

## Output Format

```markdown
# User Stories: [Feature Name / Epic]
**Epic:** [Link to Jira epic or PRD]
**Sprint:** [Sprint 14 / Q2 2025]
**PM:** [Name]
**Eng lead:** [Name]
**Total stories:** [N]

---

## Epic: Team Invitation Flow

**Goal:** Allow admins to invite team members to the workspace via email without IT involvement.
**Success metric:** Reduce setup abandonment from 34% to < 20%; achieve 75% invite acceptance rate.

---

### Story 1: Admin sends email invitation
**Priority:** P0 (Must have)
**Story points:** 5
**Design:** [Figma link]

**Story:**
As a workspace admin,
I want to invite team members by entering their email addresses,
So that they can access the workspace without creating accounts manually.

**Acceptance Criteria:**

*Happy path:*
- GIVEN I am a workspace admin on the Team Management page, WHEN I click "Invite members," THEN a modal opens with an email input field and role selector.
- GIVEN I enter one or more valid email addresses (comma-separated), WHEN I click "Send invites," THEN each invitee receives an invitation email within 5 minutes.
- GIVEN I send invites successfully, WHEN I return to Team Management, THEN each invited email appears with "Pending" status and the date invited.
- GIVEN an invite is pending, WHEN I click "Resend," THEN a new invitation email is sent and the invite expiry resets to 7 days from now.
- GIVEN an invite is pending, WHEN I click "Revoke," THEN the invite is removed from the list and the link is invalidated immediately.

*Role assignment:*
- GIVEN I am sending an invite, WHEN I select a role (Admin / Member / Viewer), THEN the invitee joins with that role upon acceptance.
- GIVEN I do not select a role, WHEN I send the invite, THEN the default role of "Member" is applied.

*Edge cases:*
- GIVEN I enter an email address already in the workspace, WHEN I submit, THEN an inline error reads "This user is already a member" and the form does not submit for that address.
- GIVEN I enter a malformed email (e.g., "notanemail"), WHEN I submit, THEN an inline error reads "Enter a valid email address."
- GIVEN I enter 50 email addresses, WHEN I submit, THEN all 50 invites are sent; the form does not cap at a lower number.
- GIVEN the email sending service is unavailable, WHEN I submit, THEN the UI shows "Invites queued — emails will be delivered within the hour" and retries are attempted for 60 minutes.

**Definition of Done:**
- [ ] Invite modal implemented per Figma spec
- [ ] Role selector with Admin / Member / Viewer options
- [ ] Email delivery within 5 minutes (p99)
- [ ] Pending invites appear in Team Management with Resend + Revoke actions
- [ ] Revoking an invite invalidates the link (verified by attempting to use revoked link)
- [ ] All edge cases above covered by integration tests
- [ ] Manual QA sign-off from QA engineer

---

### Story 2: Invitee accepts invitation via email link
**Priority:** P0 (Must have)
**Story points:** 3
**Depends on:** Story 1 (invite must exist)

**Story:**
As an invited user,
I want to accept a workspace invitation by clicking the email link,
So that I can join the workspace without going through the standard sign-up flow.

**Acceptance Criteria:**

*New user (no existing account):*
- GIVEN I receive an invitation email, WHEN I click "Accept invitation," THEN I land on a join page pre-filled with my email address.
- GIVEN I am on the join page with no existing account, WHEN I set a password and click "Join workspace," THEN my account is created, I am logged in, and I land on the workspace home.
- GIVEN I join successfully, WHEN I land on workspace home, THEN the onboarding checklist is shown to me.

*Existing user:*
- GIVEN I have an existing account with the invited email, WHEN I click the invite link, THEN I am prompted to log in (not create a new account).
- GIVEN I log in successfully via invite link, WHEN I authenticate, THEN I am added to the invited workspace and redirected to its home page.
- GIVEN I already belong to the invited workspace, WHEN I click the invite link, THEN I am redirected to the workspace home with a toast: "You are already a member of this workspace."

*Expired / revoked link:*
- GIVEN the invite link has expired (>7 days), WHEN I click it, THEN I see an error page: "This invite has expired. Ask your admin to send a new one."
- GIVEN the invite was revoked by the admin, WHEN I click it, THEN I see: "This invite is no longer valid. Contact your workspace admin."
- GIVEN I see an expired invite error, WHEN the page loads, THEN there is a "Notify admin" button that sends the admin an email requesting a new invite.

**Definition of Done:**
- [ ] Join page renders with pre-filled email for both new and existing users
- [ ] New account creation flow completes without requiring standard sign-up
- [ ] Existing user login path works and adds to workspace without duplicate account creation
- [ ] Expired link error page with "Notify admin" functionality
- [ ] Revoked link error page
- [ ] Invite expiry window is 7 days (verified in integration tests)
- [ ] Onboarding checklist shown to new members who join via invite

---

### Story 3: Admin views and manages pending invites
**Priority:** P1 (Should have)
**Story points:** 2

**Story:**
As a workspace admin,
I want to see all pending invitations and their status,
So that I can follow up with people who have not accepted.

**Acceptance Criteria:**
- GIVEN I am on the Team Management page, WHEN I view the members list, THEN pending invites are shown in a separate section labeled "Pending invitations."
- GIVEN there are pending invitations, WHEN I view each row, THEN I can see: email address, role assigned, date invited, days until expiry.
- GIVEN an invite has been pending for more than 5 days, WHEN I view it, THEN it is highlighted with a "Expires soon" label.
- GIVEN I have no pending invitations, WHEN I view Team Management, THEN the "Pending invitations" section does not appear.

**Definition of Done:**
- [ ] Pending invites section appears in Team Management when invites exist
- [ ] Each pending invite shows: email, role, date sent, days until expiry
- [ ] "Expires soon" label on invites within 2 days of expiry
- [ ] Section hidden when no pending invites exist

---

### Story 4: Generate shareable invite link (optional)
**Priority:** P2 (Nice to have)
**Story points:** 5

**Story:**
As a workspace admin,
I want to generate a shareable join link,
So that I can invite users in bulk via Slack or email without entering individual addresses.

**Acceptance Criteria:**
- GIVEN I am on Team Management, WHEN I click "Create invite link," THEN a unique link is generated and displayed with a copy button.
- GIVEN I have an active invite link, WHEN a new user clicks it, THEN they follow the standard join flow and land in the workspace as a Member.
- GIVEN I want to disable the link, WHEN I click "Disable link," THEN the link is immediately invalidated and future clicks show an error.
- GIVEN an invite link is active, WHEN I view Team Management, THEN I see the link's status, creation date, and number of users who joined via it.

**Definition of Done:**
- [ ] Link generation and copy-to-clipboard functionality
- [ ] New users who click link complete join flow and join as Member
- [ ] Disable functionality invalidates link immediately
- [ ] Usage count tracked per link

---

## Story Map

```
Epic: Team Invitation
  │
  ├── P0: Send email invite (Story 1)
  │     └── P0: Accept via email link (Story 2) [depends on Story 1]
  │
  ├── P1: View pending invites (Story 3) [depends on Story 1]
  │
  └── P2: Shareable invite link (Story 4) [independent]
```

## Sprint Recommendation

**Sprint 14 (P0 stories):** Story 1 + Story 2 = 8 story points
**Sprint 15 (P1 stories):** Story 3 = 2 points (can combine with other P1 work)
**Later sprint:** Story 4 = 5 points (schedule when P2 queue is prioritized)
```

## Acceptance Criteria Writing Guide

### Given/When/Then format
```
GIVEN [initial context / state],
WHEN [user takes an action],
THEN [the system responds with this observable outcome].
```

**Good AC:** "GIVEN I am logged in as admin, WHEN I click Invite, THEN a modal appears with an email field and role selector."

**Bad AC:** "The invite modal should appear when you click Invite." (Missing who, missing initial state, not testable without ambiguity.)

### AC categories to cover for every story
- Happy path (expected success flow)
- Validation (bad input, missing required fields)
- Edge cases (empty state, limits, concurrent actions)
- Error states (service down, timeout, failed operation)
- Permissions (does the right user type have access? does the wrong one get blocked?)

## Story Splitting Techniques

When a story is too large for one sprint:

| Technique | Example |
|-----------|---------|
| By user type | Admin sends invite / User accepts invite (two stories) |
| By happy path / edge cases | Ship happy path first; add edge cases next sprint |
| By input type | Email invite first; bulk CSV import second |
| By CRUD operations | Create + Read first; Update + Delete next sprint |
| By data source | Manual entry first; import from Salesforce second |

## Anti-Patterns to Avoid

| Anti-pattern | What it looks like | Fix |
|-------------|-------------------|-----|
| Technical story | "Refactor the auth service to support OAuth" | Reframe: "As a user, I want to log in with Google so that I don't need a separate password" |
| Vague AC | "The form should work correctly" | Write specific pass/fail conditions |
| Giant story | "Build the entire invitation system" | Split into 3–5 independent stories |
| Missing edge cases | Only happy path covered in ACs | Add error states, limits, permissions |
| No Definition of Done | "Done when engineering says done" | Explicit DoD checklist agreed before sprint start |

## Rules

- **One user, one action, one outcome** — if a story has two "wants," split it.
- **ACs must be testable** — if QA cannot write an automated or manual test for it, rewrite the AC.
- **Define "done" before the sprint starts** — DoD agreed by PM, engineering, and QA.
- **Include edge cases in the story, not separately** — edge cases discovered mid-sprint cause scope creep.
- **Stories should fit in one sprint** — if an estimate exceeds half the sprint capacity, split the story.
- **Independent stories ship faster** — avoid dependencies between stories within a sprint.
- **User types must be specific** — not "user"; say "admin user," "free plan user," "API consumer."
- **Acceptance criteria describe behavior, not implementation** — what the user sees, not how the code works.
- **Walk through ACs with engineering before sprint start** — questions raised in sprint planning are cheaper than rework mid-sprint.
- **Link to design before development begins** — a story without a Figma spec leads to re-design after build.
