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
