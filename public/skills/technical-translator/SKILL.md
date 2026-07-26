---
name: technical-translator
description: Translate complex technical concepts, architecture decisions, and engineering trade-offs into clear language for non-technical stakeholders. Also translates business requirements back into precise technical specifications for engineers.
argument-hint: [technical concept or business requirement, target audience, context]
allowed-tools: Read, Write
---

# Technical Translation

The most expensive failure mode in product teams is miscommunication between engineers and business stakeholders. Engineers present architecture diagrams to executives who need revenue impact. PMs write vague requirements that engineers implement incorrectly. Technical translation is a two-way discipline: making technical realities legible to business audiences, and making business goals precise enough for engineers to act on.

## Two Directions of Translation

### Direction 1: Technical → Business

Convert engineering language into business impact, risk, and decisions.

**What engineers say vs. what stakeholders hear:**

| Engineers say | Stakeholders hear (wrongly) | What to say instead |
|--------------|----------------------------|---------------------|
| "We need to refactor the auth service" | "They want to rewrite something that works" | "Our login system is a single point of failure. One failure = all users locked out. This is a 2-week project to add redundancy and cut incident risk by 80%." |
| "We have 40% test coverage" | Nothing meaningful | "4 in 10 code changes have no automated safety net. This doubles the time to debug production issues." |
| "The database is hitting connection limits" | "There's a database problem" | "At our current growth rate, the site will start dropping requests in approximately 6 weeks. We have three options: [list options with cost and time]." |
| "We're accumulating technical debt" | "They're being slow again" | "We have 3 months of deferred maintenance. Shipping new features now takes 40% longer than it did a year ago because of this backlog." |
| "We need to migrate to microservices" | "Architecture project with no user value" | "Our current architecture means any bug in billing can crash the entire app. This migration creates isolation so a billing bug affects only billing." |

---

### Direction 2: Business → Technical

Convert business requirements into specifications engineers can implement unambiguously.

**What stakeholders say vs. what engineers need:**

| Stakeholders say | Engineers need |
|-----------------|----------------|
| "Make it faster" | "P95 API response time must be ≤ 200ms. Current P95 is 850ms. Acceptable regression: none." |
| "Make it more secure" | "Add rate limiting (100 req/min per IP), enforce HTTPS everywhere, add CSP headers, require 2FA for admin accounts." |
| "Users should be able to share things" | "Users can generate a shareable URL for any project. Link is public (no login required) and read-only. URL expires in 30 days. Analytics: track share link views separately from direct views." |
| "It should work on mobile" | "Support iOS Safari 15+, Chrome Android 108+, viewport 375px–428px. Touch targets ≥ 44px. No horizontal scroll. Core flows must work offline (read-only)." |
| "We need better reporting" | "Export CSV of all events in date range (filter by event type, user segment). Max export: 100k rows. Delivery: synchronous under 10k rows; async email link above 10k rows. Format: UTF-8 CSV with header row." |

---

## Process

1. **Identify the audience** — executive, board, sales team, legal, operations, support? Each has different vocabulary and priorities.
2. **Find the business consequence** — every technical fact has a business implication. Find it: risk, cost, time, revenue, customer experience.
3. **Use the "so what" test** — after every technical statement, ask "so what?" until you reach something the audience cares about.
4. **Lead with the business point** — put the impact first, the mechanism second. Executives decide from the first sentence.
5. **Use analogies for mechanisms** — analogies explain how something works without requiring technical knowledge.
6. **Quantify everything possible** — "slower" is noise; "200ms slower = 1% drop in conversion = $40k/month" is signal.
7. **Present options, not conclusions** — "we must do X" creates defensiveness; "here are 3 options with these trade-offs" invites collaboration.
8. **Translate requirements back** — once a business decision is made, restate it in precise technical language and confirm with the engineer.
9. **Document the translation** — write down both the business language and the technical spec. Misalignment surfaces months later.
10. **Close the loop** — after technical work is complete, report back in business terms: "We shipped the auth refactor. Incident risk is down 80%. No more single point of failure."

## Output Format

### Executive Summary: Technical Decision

```markdown
## [Technical Project Name] — Executive Summary

**What we are deciding:** [One sentence — what is the choice?]
**Why it matters now:** [What happens if we delay? Quantify if possible.]
**Recommended option:** [Option name]
**Cost:** [Engineering time + any infrastructure cost]
**Benefit:** [Business outcome — risk reduced, revenue protected, speed gained]
**Risk of inaction:** [What breaks, when, and what it costs]

---

### Options Considered

**Option A: [Name]**
- What it does: [1–2 sentences in plain language]
- Time: [X weeks/months]
- Cost: [$X or X engineer-weeks]
- Upside: [Business benefit]
- Downside: [What it does not solve or what risk remains]

**Option B: [Name]**
- [Same structure]

**Option C: Do nothing**
- What happens: [Specific consequence with timeline]
- Cost of inaction: [Estimate]

---

### Recommendation

[2–3 sentences. Why this option. What we commit to delivering. What we need from leadership (budget, time, decision).]

**Decision needed by:** [Date — and why that date]
```

### Technical Spec from Business Requirement

```markdown
## Technical Specification: [Feature Name]
**Translated from:** [Original business requirement]
**Author:** [PM]
**Date:** [Date]
**Reviewed by:** [Eng lead who confirmed this is accurate]

### Business Requirement (original)
"[Exact quote from stakeholder or PRD]"

### Technical Specification

**API endpoint:**
POST /api/v2/export
- Auth: Bearer token required (admin role)
- Request body: { start_date: ISO8601, end_date: ISO8601, event_types: string[], format: "csv" }
- Sync response (< 10k rows): 200 OK with Content-Type: text/csv
- Async response (≥ 10k rows): 202 Accepted with { job_id: uuid, estimated_time: seconds }
  - Async job sends email when complete with download link (expires 24h)
- Error: 400 if date range > 365 days; 403 if non-admin role

**Data included:**
- All events matching filter criteria
- Columns: event_id, user_id, event_type, timestamp (UTC), session_id, properties (JSON)
- Header row required
- Encoding: UTF-8 with BOM for Excel compatibility

**Performance requirement:**
- Sync export (< 10k rows): response within 5 seconds
- Async job completion: within 10 minutes for up to 100k rows

**Out of scope:**
- Real-time streaming (deferred)
- Excel (.xlsx) format (deferred — use CSV for now)
- Scheduled recurring exports (separate feature)
```

## Analogy Library

Use these analogies when explaining technical concepts to non-technical audiences:

| Technical concept | Analogy |
|------------------|---------|
| Technical debt | Deferred maintenance on a building — cheap to ignore now, expensive when it fails |
| Microservices | Separate departments in a company — a problem in HR does not shut down Sales |
| API rate limiting | A bouncer at a club — lets people in at a controlled rate to prevent overcrowding |
| Database index | A book's index — without it, you read the whole book to find one fact |
| Cache | A sticky note on your desk — faster than filing cabinet (database), but temporary |
| Load balancer | A bank with multiple tellers — customers queue once, get routed to any available teller |
| Zero downtime deployment | Replacing an airplane's engine mid-flight — swap new for old without passengers noticing |
| Encryption | A lockbox — data inside is unreadable without the key |
| CI/CD pipeline | A factory assembly line with quality checks at every stage |
| Test coverage | A safety net under a tightrope — not every fall is caught, but most are |

## Stakeholder Vocabulary Guide

| Audience | Vocabulary they use | What they care about | Avoid |
|----------|---------------------|---------------------|-------|
| CEO/Board | Revenue, growth, risk, competitive position | Strategic impact | Technical acronyms, implementation details |
| CFO | Cost, ROI, CapEx vs OpEx, headcount | Numbers and projections | Vague "efficiency" claims |
| Sales | Win rate, deal size, customer requests, feature gaps | What they can promise customers | Architecture, debt, infrastructure |
| Legal/Compliance | Liability, regulation, audit trails, data residency | Risk and documentation | "We think it's probably compliant" |
| Customer Success | Escalations, churn, NPS, manual workarounds | Customer experience | Internal technical details |
| Operations | Reliability, incidents, on-call burden, runbooks | Stability and process | Abstract architecture changes |

## Anti-Patterns

| Anti-pattern | What it looks like | Fix |
|-------------|-------------------|-----|
| Jargon dumping | Presenting a sequence diagram to the board | Translate to "what breaks" and "what we gain" |
| Vague requirements | "Needs to be enterprise-ready" | Ask: "What does enterprise-ready mean to you? Give me 3 examples." |
| No options presented | "We must rewrite the backend" | Always offer at least 2–3 options with trade-offs |
| Skipping the "so what" | "P95 latency is 850ms" without context | "850ms latency = 1.2% lower conversion = ~$30k/month lost" |
| Over-simplifying | Losing accuracy to be accessible | Use analogies for mechanism; keep numbers precise |
| Translating without validating | Writing a spec and assuming engineers agree | Walk the engineer through the spec; ask "what did I miss?" |
| One-way translation only | Only doing tech-to-business | Also translate business decisions back to precise technical requirements |

## Rules

- **Lead with the business impact, not the technical mechanism** — executives make decisions from the first sentence; put the conclusion there.
- **The "so what" chain** — for every technical fact, ask "so what?" until you reach revenue, risk, time, or customer experience.
- **Quantify or qualify** — "slow" means nothing; "200ms slower than our SLA" or "2x slower than the industry benchmark" means something.
- **Analogies explain how; numbers explain why** — use analogies to make mechanisms accessible, use numbers to justify decisions.
- **Options, not verdicts** — presenting one option looks like you have already decided; presenting three options builds alignment.
- **Validate the translation** — have an engineer confirm the technical spec and a stakeholder confirm the business summary before distributing.
- **Avoid false precision** — "this will reduce churn by exactly 2.3%" when you mean "roughly 1–3%" erodes trust when actuals differ.
- **Match depth to audience** — a board needs 3 bullets; a VP Engineering needs a full spec; a support team needs a FAQ.
- **Document both directions** — write the business requirement AND the technical spec. Both live in the same ticket or doc.
- **Close the loop after delivery** — report outcomes in the same business terms you used to justify the work.

---

## Deep Reference Playbook

The sections below extend this skill into a complete operating playbook so it can run end-to-end inside Claude Code, CoWork, or any agentic tool without further prompting. Pull only the sections you need for a given engagement.

### Inputs the skill must collect

Before producing any output, the skill confirms:

1. **Objective** — the single decision or artifact the user wants out of this session.
2. **Context** — system, team, customer, product, or domain the work sits inside.
3. **Constraints** — time, budget, headcount, regulatory, technical, political.
4. **Definition of done** — what "good" looks like and who signs it off.
5. **Audience** — who reads or consumes the output (engineer, exec, customer, regulator).
6. **Existing artifacts** — prior versions, related docs, dashboards, tickets.
7. **Risk appetite** — how reversible the decision is and how much ambiguity is acceptable.

If any of these are missing, the skill asks targeted clarifying questions before generating output. It never invents constraints the user did not state.

### Operating workflow

The canonical workflow for **Technical Translator** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

**Stage 1 — Frame.** Restate the problem in one paragraph. Name the decision, the deadline, the stakeholders, and the success metric. Surface assumptions explicitly so they can be challenged.

**Stage 2 — Diagnose.** Inventory the current state with concrete evidence: metrics, quotes, screenshots, configs, tickets. Separate facts from interpretations. Identify the two or three root causes that explain most of the gap, not the long tail of symptoms.

**Stage 3 — Design.** Generate at least two viable options. For each option, capture: what changes, who owns it, what it costs, what it unblocks, what it risks, and how it could fail. Recommend one with a written rationale.

**Stage 4 — Execute.** Convert the chosen option into a sequenced plan: milestones, owners, dependencies, gating checks, communication cadence, and rollback triggers. Anything that cannot be assigned an owner and a date is not yet a plan.

**Stage 5 — Validate.** Define how success will be measured, when the measurement happens, and what action follows each possible result. Schedule the retrospective before the work starts, not after.

### Outputs the skill produces

Depending on the request, the skill returns one or more of:

- A one-page brief suitable for an executive reader.
- A detailed working document for the delivery team.
- A decision record capturing the choice, the alternatives, and the rationale.
- A risk register with probability, impact, owner, and mitigation.
- A sequenced action plan with named owners and explicit due dates.
- A measurement plan tied to the success metric.
- A communication plan for stakeholders inside and outside the team.

Every artifact uses clear headings, short paragraphs, and tables where comparison helps. No filler. No restating the prompt. No hedging language when a recommendation is warranted.

### Decision logic and trade-offs

The skill applies the following heuristics when choices are not obvious:

- **Prefer reversible decisions** taken quickly over irreversible decisions taken slowly.
- **Optimise for the constraint that bites first** — usually time, attention, or trust, not money.
- **Default to the simplest design** that meets the stated definition of done; add complexity only when a specific requirement forces it.
- **Make the cost of being wrong visible** so the reader can judge whether the recommendation is proportionate.
- **Name the people**, not the roles, when assigning ownership; ambiguous ownership produces ambiguous outcomes.

### Anti-patterns the skill refuses to emit

| Anti-pattern | Why it fails | What the skill does instead |
|---|---|---|
| Generic best-practice list with no context | Reader cannot act on it | Tailors recommendations to the stated constraints |
| Recommendation without trade-offs | Hides the cost of being wrong | Names the price paid for the recommendation |
| Plan with no owners or dates | Cannot be executed or tracked | Assigns a named owner and a date to every action |
| Metrics theatre | Measures activity, not outcome | Ties every metric back to the user or business outcome |
| Boil-the-ocean scope | Nothing ships | Cuts scope to the smallest valuable slice |
| Buried recommendation | Reader misses the point | Leads with the recommendation in the first paragraph |

### Quality bar

The skill self-checks each output against these gates before returning it:

1. Can a busy executive understand the recommendation from the first 150 words?
2. Is every claim either evidenced, labelled as an assumption, or removed?
3. Does every action have an owner and a date?
4. Are the trade-offs of the recommendation stated honestly?
5. Is there a measurable success criterion?
6. Would the author be comfortable defending this artifact in a review meeting?

If any gate fails, the skill rewrites the section before returning it.

### Worked micro-example

> **Context:** Translate complex technical concepts, architecture decisions, and engineering trade-offs into clear language for non-technical stakeholders. Also translates bus
>
> **Frame:** the team needs a defensible recommendation within five working days; the audience is a cross-functional steering group; the cost of delay is higher than the cost of being slightly wrong.
>
> **Diagnose:** the dominant constraint is decision latency, not analytical depth. Existing data is sufficient for a directional call.
>
> **Design:** two viable options surfaced. Option A optimises for speed and reversibility. Option B optimises for completeness but slips the deadline by two weeks.
>
> **Execute:** Option A recommended. Plan sequenced into a two-week sprint with named owners, a mid-point checkpoint, and a clear rollback trigger.
>
> **Validate:** success measured against a single leading indicator at day 30 and a single lagging indicator at day 90. Retrospective scheduled for day 35.

### Cadence and follow-through

A one-shot artifact rarely changes outcomes. The skill recommends a lightweight cadence to keep the work alive:

- **Weekly:** owner posts a five-line status (done, doing, blocked, risk, ask).
- **Fortnightly:** steering group reviews leading indicators and unblocks dependencies.
- **Monthly:** retrospective on what the data is teaching the team; adjust plan accordingly.
- **Quarterly:** revisit the original objective and decide whether to continue, pivot, or stop.

### Closing rules of thumb

1. Lead with the recommendation; supporting analysis follows.
2. Treat every output as a draft that will be challenged; pre-empt the obvious objections.
3. Prefer one strong recommendation over three weak options.
4. When the evidence is thin, say so; do not launder uncertainty as confidence.
5. Optimise for the next decision, not for the perfect document.
6. Make it easy for the reader to disagree with you in a structured way.
7. Ship the artifact; iterate against feedback rather than in private.
