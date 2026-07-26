---
name: design-sprint
description: Facilitate a 5-day design sprint to solve critical product challenges and validate ideas. Outputs sprint plan, facilitation guide, prototype templates, and user testing protocol.
argument-hint: [problem to solve, team size, remote or in-person, design maturity, timeline]
allowed-tools: Read, Write
---

# Design Sprint

A design sprint is a 5-day structured process (from Google Ventures) for answering critical business questions through rapid design, prototyping, and user testing. It compresses months of deliberation into one week by making decisions quickly, building a realistic prototype, and testing with real users.

## Sprint Structure

```
MONDAY — MAP
  Understand the problem; define the long-term goal
  Expert interviews; HMW (How Might We) notes
  Sprint question: What is the riskiest assumption?
  Output: Problem map; sprint focus area

TUESDAY — SKETCH
  Each person sketches 3 solutions independently
  Crazy 8s exercise: 8 rough ideas in 8 minutes
  Detailed solution sketch (1 per person)
  Output: Competing solutions wall

WEDNESDAY — DECIDE
  Silent critique (sticky votes on best ideas)
  Decider picks the winning solution
  Create storyboard (15 frames of the prototype)
  Output: Storyboard ready for prototyping

THURSDAY — PROTOTYPE
  Build a facade of the solution (not functional code)
  Figma, slides, paper — whatever is fastest
  Goal: Realistic enough to get honest reactions
  Output: Prototype ready for testing

FRIDAY — TEST
  5 user interviews, each 45-60 minutes
  Team watches; notes patterns
  Debrief: What did we learn? What decisions can we make?
  Output: Clear direction decision
```

## Day-by-Day Facilitation Guide

```markdown
## Monday: Map (8 hours)

### Morning: Expert Interviews (3 hours)
Format: 30 min each, rotating guests (engineering lead, customer success, sales, existing users)
Questions to ask:
  "What's the most important thing we should accomplish this week?"
  "What are you afraid we might miss?"
  "What do our users struggle with most?"
Participants capture HMW (How Might We) notes on sticky notes.

### Afternoon: Map and Target (2 hours)
1. Draw the map (15 min)
   Stick figures on left (users) → simple steps → goal on right
   Keep it simple: 5-15 steps max

2. Long-Term Goal (15 min)
   Complete the sentence: "In 2 years, [product] will..."
   Decider proposes; team can challenge; Decider decides

3. Sprint Questions (30 min)
   "What questions must we answer this week to reach the long-term goal?"
   Vote on most important; Decider picks the focus

4. Pick target on the map (15 min)
   Circle the moment on the map to focus on
   Everything else is out of scope this week

## Tuesday: Sketch (8 hours)

### Lightning Demos (2 hours)
Each team member: 3-minute demo of inspiring solutions
(Not necessarily from your industry — any domain that solves a similar problem)
Note: "Interesting idea" not "copy this"

### The Four-Step Sketch (2 hours)
1. Notes (20 min): Walk the map and your HMW notes
2. Ideas (20 min): Rough ideas — no filter
3. Crazy 8s (8 min): Fold paper into 8 sections; sketch 8 ideas in 8 minutes
4. Solution sketch (30-60 min): 3-panel storyboard of your best idea

Rules: Self-explanatory without verbal description; anonymous until reveal

## Wednesday: Decide (8 hours)

### Art Museum (30 min)
Tape all solution sketches on the wall
Everyone reads in silence with dot stickers

### Heat Map (20 min)
Each person: place dots on interesting parts of each sketch (without discussing)

### Speed Critique (30 min)
Facilitator describes each sketch; team discusses
Note: promising concepts, questions, concerns

### Straw Poll + Decider Vote (15 min)
Each person votes for their favourite
Decider makes final call (even if outvoted)

### Storyboard (2 hours)
15 panels: opening scene → key steps → ending scene
Enough detail for prototype team to build without asking questions

## Thursday: Prototype (8 hours)

### Assign roles
- Maker 1-2: Build the screens in Figma
- Writer: Write all copy (the sprint lives or dies on the words)
- Asset collector: Gather images, screenshots, icons needed
- Stitcher: Connects the pieces into a clickable prototype
- Interviewer: Prepares the user testing script

### Goldilocks quality
Not too polished (wastes time), not too rough (users won't engage)
"Good enough to get an honest reaction"

## Friday: Test (8 hours)

### Interview structure (per user, 45-60 min)
1. Friendly welcome (5 min)
2. Context questions (5 min): Background, how they do this today
3. Introduce prototype (5 min): "We're testing this, not you"
4. Tasks (25 min): "Please try to [task]" — let them struggle
5. Debrief (10 min): Overall impressions

### Observation room
Team watches live (video call or one-way mirror)
Each person takes notes independently
5-column note sheet: user label | user quote | observation | positive | negative

### Debrief (2 hours)
Review all notes; identify patterns
What themes appeared across 3+ users?
Decision: Build it | Iterate | Pivot | Abandon
```

## Sprint Question Examples

```markdown
## Good Sprint Questions (risky assumptions to test)

"Will users trust [product] enough to share sensitive financial data?"
"Can first-time users complete [workflow] without any help?"
"Will [segment] pay a premium for [feature] over free alternatives?"
"Do users understand the difference between [concept A] and [concept B]?"
"Will [integration partner]'s users adopt [product] through the integration?"

## Bad Sprint Questions
"Is [product] good?" — Too vague
"Should we build [feature]?" — Yes/no question not suited to prototyping
"How can we acquire more users?" — Not testable with a prototype
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Boss-based decisions** | HiPPO overrides valuable input | Decider role is pre-assigned; decider listens first |
| **Building real product on Thursday** | Code is too slow; too polished | Figma/slides — prototyping, not engineering |
| **Testing with colleagues** | They know too much; not real users | 5 real users from target segment |
| **Too many participants** | Decision-making paralysis | 4-7 people max; include one Decider |
| **Sprint without a real problem** | Process as theatre | Sprint question must be genuinely uncertain |

## 10 Rules

1. One Decider with final authority — design sprints fail without clear decision power.
2. No devices except for research — phones and laptops off; everyone present.
3. "How Might We" reframes problems as opportunities — mandatory for Monday.
4. Sketches are anonymous until revealed — prevents anchoring and social influence.
5. Thursday prototype is a facade — the goal is user reactions, not working code.
6. 5 user tests reveal most patterns — beyond 5, learnings repeat.
7. Facilitator is time-keeper — the schedule is non-negotiable.
8. The sprint question is decided Monday — everything else serves answering it.
9. Friday debrief ends with a clear decision — sprint without a decision is incomplete.
10. Sprint outcomes include a documented decision, not just learnings.

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

The canonical workflow for **Design Sprint** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Facilitate a 5-day design sprint to solve critical product challenges and validate ideas. Outputs sprint plan, facilitation guide, prototype templates, and user
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
