---
name: retro-facilitator
description: Facilitate a structured sprint or project retrospective. Outputs a meeting agenda, facilitation guide, synthesis framework, and action item tracker that drives real improvement.
argument-hint: [team size, sprint/project context, recurring issues, time available]
allowed-tools: Read, Write
---

# Sprint Retrospective Facilitator

A retrospective is only valuable if it produces real change. Most retros fail because they identify problems but not root causes, or they generate action items that nobody follows up on. This facilitates a retro that surfaces genuine issues, reaches shared understanding, and produces committed improvements.

## Process

1. **Set the stage** — create psychological safety before diving into problems.
2. **Gather data** — surface what actually happened, not just what people feel.
3. **Generate insights** — move from symptoms to root causes.
4. **Decide what to do** — prioritize and commit to specific changes.
5. **Close the loop** — check on last retro's actions before starting the next cycle.

## Facilitation Guide

### Before the retro (15–30 min prep)

**Gather data from the sprint:**
- Velocity vs. planned
- Stories completed, carried over, and abandoned
- Bug and incident count
- Customer escalations
- Team satisfaction pulse (anonymous survey if available)

**Review last retro's action items:**
- Which were done?
- Which were started?
- Which were not started? Why?

**Set up the board:**
- Columns: "What went well?" / "What could be better?" / "What puzzles us?" / "Action items"
- Timer for each section
- Voting dots ready

---

## Meeting Structure

```markdown
# Retrospective: [Sprint/Project Name]

**Date:** [Date]  
**Facilitator:** [Name]  
**Team:** [Names]  
**Duration:** [60–90 minutes]  
**Format:** [In-person / Remote — Miro / FigJam / Retro tool]

---

## Agenda

| Time | Activity | Owner | Purpose |
|------|----------|-------|---------|
| 0:00 | Check-in + safety check | Facilitator | Build trust |
| 0:05 | Review last retro actions | PM | Accountability |
| 0:15 | Data review: sprint stats | PM | Shared context |
| 0:20 | Individual writing (silent) | Everyone | Generate honest input |
| 0:30 | Grouping and discussion | Everyone | Identify themes |
| 0:50 | Prioritize themes | Everyone | Dot vote |
| 0:55 | Root cause analysis | Team | Go deeper |
| 1:10 | Action items | Team | Commit to change |
| 1:25 | Close + appreciation | Facilitator | End positively |

---

## Check-In (5 min)

*Purpose: build psychological safety before critical discussion*

**Prompt (choose one):**
- "In one word, how are you coming into this retro?"
- "On a scale of 1–5, how was this sprint for you personally? Why?"
- "What is one thing that happened this sprint you are proud of?"

*The facilitator goes first to model openness.*

---

## Last Retro Review (10 min)

*Review each action item from the last retro. Be honest about what happened.*

| Action | Owner | Status | Notes |
|--------|-------|--------|-------|
| [Action from last retro] | [Name] | ✅ Done / 🔄 In progress / ❌ Not done | [What happened] |

**Facilitator prompt:** "For anything not done — what got in the way? Is it still worth doing?"

---

## Sprint Data Review (5 min)

*Review facts before opinions. Shared context prevents argument about basic facts later.*

- Stories planned: [N]
- Stories completed: [N] ([X%])
- Stories carried over: [N] — [themes if any]
- Incidents/bugs: [N]
- Unplanned work: [estimate of %]

**Facilitator prompt:** "Does anything in this data surprise you?"

---

## Reflection: Individual Writing (10 min, silent)

*Everyone writes simultaneously — prevents groupthink and ensures all voices are heard.*

**Prompt for each column:**

**🟢 What went well?**  
"What do you want to make sure we keep doing? What worked? What should we be proud of?"

**🔴 What could be better?**  
"What slowed us down? What frustrated you? What would you change if you could?"

**❓ What puzzles us?**  
"What do you not understand? What feels like a symptom of something deeper?"

*Facilitator: set a timer for 8 minutes. Silence is productive — do not rush.*

---

## Discussion and Grouping (20 min)

**Step 1:** Each person reads their items aloud (one at a time). Facilitator groups duplicates.  
**Step 2:** Facilitator reads back the groups to confirm accuracy.  
**Step 3:** Team discusses themes — *not solutions yet, only understanding.*

**Facilitator prompts:**
- "Can you say more about what happened there?"
- "Did anyone else experience this?"
- "Is this new, or does it recur?"
- "What do you think caused this?"

---

## Prioritize (5 min)

**Dot voting:** Each person gets 3 dots to place on the items they think are most important to address.

**Facilitator:** "We will focus our action items on the top [2–3] themes."

*Note: voting prevents the loudest voice from determining what gets addressed.*

---

## Root Cause Analysis (15 min)

*For each prioritized theme, go deeper. Do not jump to solutions.*

**For each top-voted item, ask:**

**5 Whys technique:**
1. "Why did [problem] happen?" → [Answer]
2. "Why did [answer] happen?" → [Answer]
3. "Why..." → Continue until you reach a systemic or process cause

**Alternative: Fishbone / Ishikawa**
- What contributed to this from: Process / People / Tools / Communication / Environment?

**Example:**
- Problem: "Stories were carried over every sprint"
- Why? "Stories were too large"
- Why? "We did not break them down in planning"
- Why? "Planning meetings end before we finish grooming"
- Why? "Planning is scheduled for 1 hour but always takes 2"
- Root cause: **Planning time is insufficient; we need 2-hour planning slots**

*The root cause is the one you can actually act on.*

---

## Action Items (15 min)

*The most important part. Actions must be specific, owned, and time-bound.*

**For each root cause identified, define:**

| Action | Owner | By when | How we will know it is done |
|--------|-------|---------|---------------------------|
| [Specific action] | [Single name] | [Date or next sprint] | [Observable outcome] |

**Facilitator rules:**
- Every action gets a single owner — not "the team"
- Actions must be completable in the next sprint or 2 weeks maximum
- "Discuss" is not an action; it is a meeting. Schedule it with a date.
- Start with the highest-voted themes

**Good action:** "Engineering lead will extend sprint planning to 2 hours starting next sprint"  
**Bad action:** "Team will communicate better"

---

## Closing + Appreciation (5 min)

*End on a positive note. Retros that end on problems leave teams demoralized.*

**Appreciation round:** Each person names one thing another team member did well this sprint.  

**Facilitator:** "Thank you everyone. I will send the notes and action items within 24 hours."

---

## Post-Retro (within 24h)

Send to the team:
```
# Retro Summary — [Sprint/Date]

## Top themes
1. [Theme] — root cause: [cause]
2. [Theme] — root cause: [cause]

## Action items
| Action | Owner | By when |
|--------|-------|---------|
| [Action] | [Name] | [Date] |

## What we keep doing
- [From "went well" section]

*See full retro board: [link]*
```
```

## Retro Format Variations

| Format | Good for | Duration |
|--------|---------|----------|
| Start / Stop / Continue | Quick, focused teams | 45 min |
| What went well / What to improve | Standard, beginner teams | 60 min |
| Mad / Sad / Glad | Teams needing emotional check-in | 60 min |
| 4Ls (Liked, Learned, Lacked, Longed for) | Project retrospectives | 75 min |
| Sailboat (wind, anchor, rocks) | Strategic retrospectives | 90 min |
| Timeline retro | Complex sprints with many events | 90 min |

## Common Retro Failure Modes

| Failure | Cause | Fix |
|---------|-------|-----|
| Same problems every sprint | Action items not followed up | Review last retro actions first, always |
| Only negatives discussed | No structured "went well" section | Protect time for positives |
| Loud voices dominate | No structured input collection | Silent writing before discussion |
| Action items never done | No single owner, no deadline | One owner per action, specific date |
| Nobody speaks honestly | Psychological safety absent | Check-in, emphasize no blame culture |
| Retro runs over time | No timeboxing | Use a visible timer; cut if needed |

## Rules

- **Review last retro's actions first** — without accountability, action items are theater.
- **Silent individual writing before discussion** — prevents groupthink and ensures introverts contribute.
- **Dot voting prioritizes democratically** — the loudest person does not set the agenda.
- **Root cause before solution** — jumping to solutions prevents teams from fixing the real problem.
- **One owner per action item** — "team will do X" means nobody does X.
- **Actions completable in one sprint** — long-term actions get deferred; short-term actions get done.
- **Facilitator does not dominate** — if you are PM and facilitating, stay neutral; do not advocate for your own items.
- **End positively** — appreciation rounds are not soft; they counterbalance the critical discussion.
- **Send notes within 24 hours** — action items lose momentum after 48 hours.
- **Measure improvement** — if a retro does not change anything, it is a waste of everyone's time.
