---
name: jobs-to-be-done
description: Apply Jobs-to-be-Done framework to understand customer motivations and design solutions that address real underlying needs. Outputs job statements, context interviews, opportunity mapping, and solution criteria.
argument-hint: [product area, customer segment, discovery stage, research resources available]
allowed-tools: Read, Write
---

# Jobs to Be Done (JTBD)

Jobs to Be Done is a theory of customer motivation: customers don't buy products — they "hire" them to get a job done. The job is the progress they're trying to make in their life or work. Understanding the job, not the product, reveals why customers switch, what they value, and where real opportunities exist.

## Core Concepts

```
THE JOB:
  Functional: What they're trying to accomplish (send money internationally)
  Emotional: How they want to feel (confident, in control)
  Social: How they want to be perceived (competent, responsible)

THE FOUR FORCES:
  Push: pain with the current solution ("My current tool is too complex")
  Pull: attraction to the new solution ("This looks much simpler")
  Anxiety: fear about switching ("What if I lose my data?")
  Habit: attachment to current solution ("I know how to use this already")

THE SWITCH:
  Customers switch when Push + Pull > Anxiety + Habit

KEY INSIGHT:
  The competition is not your closest category competitor —
  it's whatever the customer is "hiring" today to get the same job done.
  (Excel is competing with your analytics tool)
```

## JTBD Interview Guide

```markdown
# JTBD Interview Protocol

**Goal:** Understand the circumstances, motivations, and decision process
that led the customer to look for and adopt (or reject) a solution.

**Duration:** 45-60 minutes  
**Format:** 1:1 video or phone (recording with consent)

## Introduction Script
"I want to understand the story of how you came to [use/consider] this product.
I'm not asking for product feedback — I want to understand your situation before
you started looking, what triggered the search, and what influenced your decision.
There are no right or wrong answers."

## The Timeline Interview

### 1. Set the scene: Before the switch
"Think back to when you first started looking for a solution.
What was going on in your work/life at that time?"
- What were you using before?
- What was frustrating about it? Can you give a specific example?
- What was the first moment you thought 'I need something different'?

### 2. The trigger: First thought
"When did you first think something needed to change?"
- What specifically happened? (Look for an event, not a general feeling)
- Had this happened before? Why act now and not then?
- What did you think would happen if you didn't change anything?

### 3. The search: Passive looking
"Before you actively searched, were there moments where you were open
to alternatives even if you weren't actively searching?"
- What caught your attention?
- Where did you look? (Google, peers, social media, ads?)
- What made you look more or less seriously at different options?

### 4. Active search
"Tell me about when you started actively searching."
- What search terms did you use?
- Which options did you seriously evaluate?
- What criteria mattered most?

### 5. The decision
"Walk me through the final decision."
- What nearly stopped you from switching?
- What ultimately made you commit?
- Who else was involved in the decision?

### 6. The hire and fire
"What did you 'fire' when you adopted this product?"
- What were you doing before that you stopped doing?
- What are you still doing the old way?

### 7. The job statement check
"In your own words, what were you really trying to accomplish?"
- Not 'use [product]' — what was the outcome you needed?

## Probing questions
- "Tell me more about that..."
- "Can you give me a specific example?"
- "What happened next?"
- "Why did that matter to you?"
- "Who else was affected?"
```

## Job Statement Format

```markdown
# Job Statements

## Format: When [situation], I want to [motivation], so I can [outcome].

## Example job statements (from interview analysis)

### Core functional job:
"When I need to share a complex analysis with my leadership team,
I want to turn raw data into a clear visual story quickly,
so I can communicate insights without needing a data analyst's help."

### Related jobs (smaller, enabling):
"When I'm preparing for a board presentation,
I want to pull live data into my slides automatically,
so I can spend my time on narrative instead of copy-pasting numbers."

"When a stakeholder asks a question I can't answer in the meeting,
I want to find the answer quickly without going back to my laptop,
so I can look competent and responsive in the moment."

### Emotional jobs:
"When I'm accountable for a business metric,
I want to feel confident that my numbers are accurate,
so I can defend my recommendations without second-guessing myself."

## Job map (stages of the job)
1. DEFINE: Identify what analysis is needed
2. GATHER: Collect the data from relevant sources
3. ANALYSE: Find the insight in the data
4. COMMUNICATE: Share the insight with stakeholders
5. ACT: Make the decision based on the insight
6. MEASURE: Track whether the decision worked

Your product should cover the full job map — or be very clear which stage you own.
```

## Switch Interview Analysis

```markdown
# Switch Analysis Template (synthesise from N interviews)

## What triggered the switch?
Pattern from 12 interviews:

**Primary trigger (8/12):** A specific failure moment — "The old tool gave me wrong numbers
in a board meeting. I was embarrassed. That was it."

**Secondary trigger (4/12):** Growth event — "When we expanded to 5 markets,
the spreadsheet model just collapsed."

**Implication:** Triggers are specific events, not chronic pain.
Marketing should target the event, not the general pain.

## Why did they hire us (pull)?
- "It looked like I could get started myself, without IT" (8/12)
- "The template for exactly our use case" (6/12)
- "A colleague I trust recommended it" (5/12)

## What almost stopped them (anxiety)?
- "I wasn't sure it would integrate with our data warehouse" (9/12)
- "Worried about getting IT approval" (7/12)
- "Didn't know if I could migrate my old reports" (5/12)

## What were they doing before (what did we replace)?
- Excel/Google Sheets + manual updates (7/12)
- A different BI tool they outgrew (3/12)
- Nothing — new job, new accountability (2/12)

## Key insight:
We're not competing with [Competitor X] — we're competing with Excel.
The job: "help me look competent with data in front of leadership."
Excel fails this job when the data becomes complex or the stakes get high.
```

## Opportunity Mapping

```markdown
# Job Map + Opportunity Analysis

For each stage of the job, rate: Importance to customer / Satisfaction with current solution
Opportunity = Importance + (Importance - Satisfaction)
High importance + low satisfaction = highest opportunity

| Job Stage | Importance (1-10) | Satisfaction (1-10) | Opportunity Score | Our Coverage |
|-----------|------------------|--------------------|--------------------|--------------|
| 1. Define analysis needed | 7 | 8 | 6 | Weak |
| 2. Gather data | 9 | 4 | 14 | Strong ← Focus |
| 3. Analyse | 8 | 5 | 11 | Medium ← Focus |
| 4. Communicate insights | 10 | 3 | 17 | Weak ← Biggest gap |
| 5. Act on insight | 7 | 7 | 7 | None |
| 6. Measure outcome | 6 | 4 | 8 | None |

**Biggest opportunity: Stage 4 — Communicate insights**
"Make the story from data" is critically important and barely covered by any tool.
This is the job-to-be-done for a new product direction.
```

## Solution Criteria from JTBD

```markdown
# Solution Criteria Derived from JTBD Research

These criteria come from the job, not from feature requests:

**Must haves (from the functional job):**
- Can get to first shareable output in < 30 minutes
- Live data connection (no manual refresh)
- Outputs that look polished without design skills

**Must haves (from the emotional job):**
- Numbers must be unambiguously correct (no doubt about source)
- Clear data provenance (where did this number come from?)

**Must haves (from the anxiety reduction job):**
- Data warehouse integration that doesn't require IT
- Easy migration of existing reports

**Nice to haves (from the social job):**
- Collaboration features (colleagues can comment, not just view)
- Attribution ("Sarah made this") for internal credibility
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Asking "what features do you want?"** | Feature requests ≠ underlying jobs | Ask about situations, triggers, and outcomes |
| **Defining jobs by product category** | "The job of using a BI tool" | Jobs exist in customer's life, not product categories |
| **Ignoring non-consumption** | Real competition is often "do nothing" | Ask what they did before; include "nothing" as a competitor |
| **One interview, one insight** | Individual interviews are idiosyncratic | Pattern-match across 8-12 interviews |
| **Forgetting the four forces** | Focusing on pull (features) ignores anxiety and habit | Explicitly research all four forces |
| **Job statements too vague** | "I want to be productive" gives no product direction | Specific situation + specific motivation + specific outcome |

## 10 Rules

1. The job is defined by the customer's desired progress, not by your product category.
2. Jobs have three layers: functional, emotional, and social — all three matter.
3. Interview about the past (what actually happened) not hypotheticals (what would you want).
4. Look for the trigger event — something specific happened that made change feel necessary.
5. The four forces determine switching: Push + Pull must exceed Anxiety + Habit.
6. "What did you fire?" reveals the real competition — it's often not your closest competitor.
7. Pattern-match across 8-12 interviews before drawing conclusions — individuals are idiosyncratic.
8. Map the full job (all stages) before deciding which stage to own.
9. Opportunity = high importance + low satisfaction — this matrix prioritises better than feature voting.
10. Solutions designed around jobs outlast solutions designed around features — features get copied; job mastery builds moats.
