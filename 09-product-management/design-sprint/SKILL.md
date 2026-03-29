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
