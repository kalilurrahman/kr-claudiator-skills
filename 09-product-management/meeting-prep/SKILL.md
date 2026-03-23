---
name: meeting-prep
description: Prepare for a product management meeting, including stakeholder alignment meetings, roadmap reviews, planning sessions, or executive updates. Produces an agenda, pre-read materials, and a facilitation guide.
argument-hint: [meeting type, attendees, goal, context or background]
allowed-tools: Read, Write
---

# Meeting Preparation

Good meeting preparation is the difference between a meeting that produces decisions and one that produces follow-up meetings. The goal is to arrive with a clear desired outcome, the right context pre-distributed, and a facilitation plan that keeps discussion focused.

## Meeting Types and Their Needs

| Meeting type | Primary goal | Key preparation |
|-------------|-------------|----------------|
| Roadmap review | Alignment on priorities | Scoring rationale, capacity model, tradeoffs |
| Executive update | Decision or buy-in | 1-pager, options with recommendations |
| Sprint planning | Scope agreement | Sized backlog, team capacity, dependency map |
| Stakeholder alignment | Reduce friction | Pre-read with your recommendation; anticipate objections |
| Incident post-mortem | Learning + prevention | Timeline, root cause, action items |
| Customer advisory board | Input gathering | Discussion guide, specific questions, JTBD framing |
| Product discovery | Problem validation | Research findings, hypotheses to test |
| OKR review | Progress + decisions | Scorecard, confidence update, proposed changes |

## Process

1. **Define the desired outcome** — what specific decision, alignment, or output should result from this meeting?
2. **Identify attendees and their interests** — who needs to be there? What does each person care about?
3. **Write the agenda** — time-boxed, with a clear purpose for each section.
4. **Build the pre-read** — share materials 24–48 hours before; good pre-reads make meetings 30% shorter.
5. **Anticipate objections** — what are the 3 most likely points of resistance? Prepare responses.
6. **Plan the decision-making process** — will you vote? Consult? The meeting facilitator decides?
7. **Prepare transition moments** — how will you move from discussion to decision?
8. **Assign roles** — facilitator, timekeeper, note-taker.
9. **Prepare the parking lot** — have a place to capture off-topic but important items.
10. **Define follow-up format** — who writes the summary? When? To whom?

## Output Format

### Meeting Brief (send 24–48 hours before)

```markdown
# Meeting Brief: [Meeting Name]
**Date:** [Date, time, timezone]
**Duration:** [45 min / 60 min]
**Location / Link:** [Zoom / Room / Google Meet]
**Facilitator:** [Name]

---

## Purpose
[One sentence: What will we accomplish in this meeting?]
e.g., "Align on Q3 product roadmap priorities and resolve the SSO vs. analytics debate."

## Desired Outcome
By the end of this meeting, we will have:
- [ ] Agreed on the top 3 P1 initiatives for Q3
- [ ] Resolved the prioritization conflict between SSO and reporting features
- [ ] Identified any capacity risks for Q3

## Pre-Read (please review before the meeting)
- [Link to roadmap draft] — 5 min read
- [Link to Q2 metrics summary] — 3 min read
- [Link to capacity model] — 2 min read

**If you read nothing else:** [One sentence summary of the most important thing to know going in]
e.g., "Engineering capacity for Q3 is 15% lower than planned due to two backfills. This is the constraint driving the tradeoff."

---

## Agenda

| Time | Item | Owner | Goal |
|------|------|-------|------|
| 0:00–0:05 | Context and goals | PM | Align on purpose |
| 0:05–0:20 | Q2 results review | PM | Shared baseline |
| 0:20–0:35 | Q3 roadmap proposal | PM | Present and discuss |
| 0:35–0:50 | Tradeoff discussion: SSO vs. reporting | All | Resolve priority conflict |
| 0:50–0:58 | Decisions and owners | PM | Confirm alignment |
| 0:58–1:00 | Next steps | PM | Assign and close |

---

## Key Decisions Needed
1. **SSO vs. reporting analytics** — which goes into Q3? [PM recommendation: SSO, because it unblocks 8 enterprise deals]
2. **APAC launch scope** — full feature parity or MVP? [PM recommendation: MVP only]
3. **Tech debt sprint** — approve 2-week investment in Q3 to unblock H2 velocity?

## Background (for context only — not for discussion)
[Any context that participants need but that should not consume meeting time]
```

---

### Facilitation Guide (for the meeting)

```markdown
# Facilitation Guide: [Meeting Name]
**For the facilitator's use only**

---

## Opening (0:00–0:05)
"Thanks for reviewing the pre-read. Today's goal is to leave with three confirmed Q3 priorities and a decision on the SSO vs. reporting trade-off. I will be time-boxing each section. If we hit a dead-end, I will call it out and we will move it to async or a follow-up."

## Context Set (0:05–0:20)
Present these 3 data points only — do not re-explain the whole quarter:
1. Activation rate: 23% (target was 35%) — we missed
2. Enterprise deals blocked by SSO: 8 (potential: $800K ARR)
3. Engineering capacity: 80% of plan (two open reqs not yet backfilled)

**Transition:** "Given this context, here is my recommendation for Q3..."

## Recommendation Presentation (0:20–0:35)
Key message: "I am recommending SSO first, reporting second, with the tech debt sprint in sprint 1."
Prepare for three likely objections:

| Objection | Likely source | Response |
|-----------|--------------|---------|
| "We promised customers the reporting feature" | Sales lead | "We scoped it into Q4. There is no written commitment — can you send me the specific quote if there is one? Reporting is P1 in Q4." |
| "SSO takes too long; what about the quick wins?" | CTO | "The quick wins add up to L-size work; they do not move the enterprise ARR needle. SSO closes 8 deals in pipeline." |
| "Why is tech debt in Q3?" | CEO | "Without this investment, every Q4 project takes 40% longer. Here is the specific estimate from the engineering lead." |

## Decision Forcing (0:35–0:50)
If discussion goes in circles, use: "Let me propose a way to make progress. We have three options: [A, B, C]. I want to do a quick temperature check — thumbs up for what you could live with. We do not need unanimous enthusiasm, just no strong objections."

## Parking Lot
Capture but do not discuss:
- Items that come up that are important but not on today's agenda
- Assign a follow-up owner before moving on

## Close (0:50–1:00)
Explicitly confirm:
1. "We decided [X]" — say it out loud, confirm agreement
2. "The owner of [action] is [name] by [date]"
3. "I will send the meeting notes by [time]"
```

---

### Meeting Notes Template (post-meeting)

```markdown
# Meeting Notes: [Meeting Name]
**Date:** [Date]
**Attendees:** [Names]
**Facilitator / Notes:** [Name]

---

## Decisions Made
1. [Decision] — made by [who] — [rationale]
2. [Decision] — made by [who] — [rationale]

## Action Items
| Action | Owner | Due date |
|--------|-------|---------|
| [e.g., Write SSO PRD] | @pm-name | [Date] |
| [e.g., Confirm capacity with engineering] | @eng-lead | [Date] |
| [e.g., Send roadmap to sales team] | @pm-name | [Date] |

## Key Discussion Points
- [Summarize major discussion — not verbatim, just conclusions]
- [Note any significant dissent or concerns raised]

## Parking Lot (deferred topics)
- [Topic] — to be addressed in [forum / next meeting / async]

## Next Meeting
**Topic:** [Follow-up meeting topic if needed]
**Date:** [Date]
**Owner:** [Who is scheduling it]
```

## Meeting Preparation by Type

### Executive / Board Update
- Lead with the ask or recommendation in the first 60 seconds
- Prepare a 1-pager (not a slide deck for regular updates)
- "1 page memo → 15 minute discussion" is the right format for most exec updates
- Anticipate: "What is the risk?" "What does success look like?" "What do you need from me?"

### Roadmap Review
- Share the scoring model, not just the final ranking — show your work
- Frame every roadmap as "this is my recommendation, here is the tradeoff"
- Come with a pre-decided answer; the meeting should validate, not discover
- If the meeting is going to surface new information that changes the roadmap, call it a discovery meeting, not a review

### Conflict Resolution
- Send a 1-pager with your recommendation 24 hours before — do not spring it in the meeting
- In the meeting, start with areas of agreement before disagreement
- "What would need to be true for you to support option B?" is more useful than debating positions
- If no resolution: identify the question that needs more data and assign it

### Sprint Planning
- Backlog should be groomed and sized before the meeting — sprint planning is not a sizing session
- Come with a capacity number from engineering; do not let sprint planning reveal it for the first time
- Prioritize the backlog before the meeting; sprint planning confirms, does not discover priority

## Anti-Patterns to Avoid

| Anti-pattern | What it looks like | Fix |
|-------------|-------------------|-----|
| No desired outcome | "We are meeting to discuss Q3" | Define specifically: "We will decide on the top 3 priorities" |
| No pre-read | Context is built in the meeting | Send materials 24–48 hours before; use first 5 min to align, not to educate |
| Decision theater | Meeting "decides" but the HiPPO overrides | Acknowledge the HiPPO model explicitly; consider a separate alignment conversation |
| Open-ended agenda | 60 minutes of "discussion" | Time-box every agenda item with a specific output |
| No note-taker | Meeting ends; decisions are remembered differently by each attendee | Assign a note-taker; send notes within 2 hours |
| Recurring meeting without purpose | "Our weekly sync" with no agenda | Every recurrence should have an explicit goal or be canceled |

## Rules

- **Define the desired outcome before building the agenda** — if you do not know what "done" looks like, the meeting will not produce it.
- **Send a pre-read** — good pre-reads cut meeting time by 30% and improve decision quality.
- **Come with a recommendation** — "should we do A or B?" is a lazy question; "I recommend A because X, here is my reasoning" starts a useful conversation.
- **Time-box everything** — open-ended discussion expands to fill available time.
- **Assign one note-taker** — shared notes are often no notes.
- **Confirm decisions out loud** — at the end of each decision point, state the conclusion explicitly.
- **Send notes within 2 hours** — decisions half-remembered by attendees become the next meeting's debate.
- **Parking lot is mandatory** — without it, important tangents derail the agenda.
- **Fewer attendees, better decisions** — invite only people who contribute to the specific decisions being made.
- **End with owners and dates** — an action without an owner and a due date will not happen.
