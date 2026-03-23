---
name: decision-doc
description: Write a structured decision document (RFC, ADR, or decision memo) that captures context, options considered, tradeoffs, and rationale. Produces durable, searchable records of why key decisions were made.
argument-hint: [decision to document, stakeholders involved, options considered, constraints]
allowed-tools: Read, Write
---

# Decision Document

Decisions made without documentation get relitigated. Someone joins the team, doesn't know why a particular approach was chosen, and restarts the debate. A decision document creates a permanent record of the context, options, tradeoffs, and rationale — so the team can move forward without revisiting settled questions, and future team members can understand the reasoning without asking.

## When to Write a Decision Document

Write a decision doc when:
- The decision is significant and not easily reversible
- Multiple options were seriously considered
- Stakeholders have different opinions
- Future team members will need to understand the reasoning
- The decision sets a precedent for future choices

Do NOT write a decision doc for:
- Trivial implementation details
- Decisions where there is one obvious right answer
- Decisions that will be reversed within a sprint

## Decision Document Formats

| Format | Use When | Audience |
|--------|----------|---------|
| Decision Memo (PM) | Product, strategy, or prioritization decisions | Exec, cross-functional stakeholders |
| RFC (Request for Comments) | Technical or process decisions needing broad input | Engineering team, before the decision is final |
| ADR (Architecture Decision Record) | Technical architecture decisions | Engineering, stored in the codebase |
| DACI/RACI + memo | Cross-team decisions with unclear ownership | Multiple teams |

## Process

1. **Write the context** — what is the situation that requires a decision?
2. **State the decision clearly** — one sentence, no hedging.
3. **List the options considered** — include the options you didn't choose and why.
4. **Document the tradeoffs** — what does each option cost? What does it enable?
5. **State the rationale** — why did this option win?
6. **Note what's out of scope** — what related questions does this decision NOT answer?
7. **Record the process** — who was consulted, who decided, when.
8. **Save in a durable, searchable location** — not Slack, not email.

## Output Format

### Decision Memo Template

---

# Decision: [Concise title of the decision]

**Status:** Proposed / Under Review / Decided / Superseded by [link]
**Decider:** [Name and role of the person who makes the final call]
**Date decided:** [Date]
**Stakeholders consulted:** [Names and roles]
**Stakeholders informed:** [Names and roles]
**Review date:** [When should this decision be revisited?]

---

## Context

[2-4 paragraphs describing the situation that requires a decision. What has changed? What constraint or opportunity is driving this? What happens if no decision is made?]

Be specific about:
- What signals or data led to this decision point
- What constraints exist (time, budget, technical, organizational)
- What is at stake if the wrong decision is made

---

## Decision Statement

[One clear sentence. No hedging.]

Example: "We will use path-based API versioning (/api/v2/) rather than header-based versioning for all new API endpoints."

---

## Options Considered

### Option A: [Name — the chosen option]

**Description:** [What this option entails, specifically]

**Pros:**
- [Specific advantage]
- [Specific advantage]
- [Specific advantage]

**Cons:**
- [Specific disadvantage or cost]
- [Specific disadvantage or cost]

**Estimated cost/effort:** [Rough estimate]
**Risk:** [Low / Medium / High — what could go wrong?]

---

### Option B: [Name — a rejected option]

**Description:** [What this option would have entailed]

**Pros:**
- [Why this was seriously considered]

**Cons:**
- [Why it was ultimately rejected — be specific]

**Why rejected:** [The specific reason this lost to Option A]

---

### Option C: [Name — e.g., "Do nothing" or "Defer"]

**Description:** Continue with current approach or postpone the decision.

**Why rejected:** [The cost of inaction or deferral that made this unacceptable]

---

## Rationale

[3-5 paragraphs explaining why Option A was chosen. Be honest about the tradeoffs — acknowledge what you're giving up. Connect the decision to the strategic context and the constraints named above.]

The rationale should answer:
- Why was this option better than the alternatives for this specific situation?
- What would have to be true for a different option to be correct?
- What evidence or data informed the decision?
- What are the known risks of this decision and how are they being managed?

---

## Tradeoffs Accepted

[Be explicit about what you are giving up with this decision.]

| We are trading... | For... | Because... |
|-------------------|--------|------------|
| [Capability/value given up] | [Capability/value gained] | [Reasoning] |
| Flexibility to change pricing model easily | Speed to market | We cannot build both in Q3; speed is more important given pipeline pressure |
| Optimal technical architecture | Reduced build time | We will accept tech debt now and refactor in Q4 when traffic patterns are clearer |

---

## Out of Scope

[What related questions does this decision NOT answer? Prevents scope creep and documents boundaries.]

This decision does not address:
- [Related question deferred to a future decision]
- [Related question owned by a different team]
- [Implementation detail that engineering will decide]

---

## Consequences

**If this decision is correct:**
[What should be true 3-6 months from now?]

**If this decision is wrong:**
[What signals would tell us we got it wrong? What would the reversibility cost be?]

**Follow-on decisions required:**
- [ ] [Decision that must be made next — owner, timing]
- [ ] [Decision that must be made next — owner, timing]

---

## Review History

| Date | Reviewer | Outcome |
|------|---------|---------|
| [Date] | [Names] | Approved / Revised / Superseded |

---

### Worked Example — Versioning Strategy Decision

**Decision:** Use URL path versioning (/api/v2/) for all API endpoints.
**Status:** Decided | **Date:** 2024-03-01 | **Decider:** Head of Engineering

**Context:** We are releasing a breaking API change in Q2 that will rename the `user_id` field to a nested `user` object. We have 12 external API consumers (3 enterprise customers, 9 integration partners). We need a versioning strategy that allows old consumers to keep working while new consumers get the improved API.

**Decision statement:** All new API versions will use URL path versioning (/api/v1/, /api/v2/).

**Options:**
- Option A (chosen): URL path versioning — explicit, visible, easy to test, well-understood.
- Option B: Header versioning — cleaner URLs but harder to test, less visible, unfamiliar to some consumer teams.
- Option C: No versioning — accept that all consumers must upgrade simultaneously. Rejected: 3 enterprise consumers have 60-day change management cycles; simultaneous cutover is not feasible.

**Rationale:** URL path versioning is chosen because (1) our enterprise consumers have explicitly said their API integration teams prefer explicit URLs for routing, (2) it is easily testable with curl and Postman without setting custom headers, and (3) the "URL pollution" downside is not significant given we plan to maintain at most 2 concurrent versions. Header versioning would be preferred if we had >20 API versions, which we do not.

**Tradeoffs accepted:** Slightly less "clean" URLs in exchange for significantly easier consumer debugging and testing.

## Rules

- **One decision per document** — a document that makes three decisions is three documents.
- **Separate context from rationale** — context describes the situation; rationale explains the reasoning.
- **Name the decider** — collective ownership means no accountability; one person decides.
- **Document rejected options** — the options you didn't choose explain the reasoning as much as the one you did.
- **Be honest about the tradeoffs** — a decision doc that pretends there are no downsides is not credible.
- **Store where it can be found** — Confluence, Notion, or as a markdown file in the repo; never in Slack or email.
- **Include a review date** — circumstances change; decisions should be revisited when they do.
- **Write it before the decision, not after** — a decision doc written after the decision was made is a justification, not reasoning.
- **Out-of-scope section prevents scope creep** — explicitly note what this decision does not cover.
- **Consequences section enables accountability** — document what success looks like and what would signal you were wrong.