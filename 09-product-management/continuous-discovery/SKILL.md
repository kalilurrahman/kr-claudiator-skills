---
name: continuous-discovery
description: Build a continuous product discovery practice that generates a steady stream of customer insights. Outputs weekly interview cadence, opportunity identification, assumption testing, and discovery-to-delivery connection.
argument-hint: [team size, product stage, existing discovery practices, customer access]
allowed-tools: Read, Write
---

# Continuous Discovery

Continuous discovery (from Teresa Torres) is the practice of making regular, small customer touchpoints a team habit — rather than infrequent large research projects. The goal is to continuously generate customer insights that drive better product decisions, rather than relying on big discovery sprints that quickly become stale.

## The Continuous Discovery Habit

```markdown
## Core Habit

At minimum once per week, the product trio (PM, Designer, Engineer) must:
  1. Talk to a current or potential customer (30-60 minute interview)
  2. Surface new opportunities from what they learned
  3. Map opportunities to the opportunity solution tree
  4. Identify assumptions in proposed solutions
  5. Design small experiments to test those assumptions

This is NOT a research project. It is a weekly ritual.

## Why Continuous Beats Episodic

EPISODIC (typical): 6-week research project → 50-page report → insights already stale
CONTINUOUS: 1 interview/week → insights integrated immediately → decisions based on current data

"Talking to customers once a week is better than a 6-month research project once a year."
— Teresa Torres
```

## Weekly Interview Structure

```markdown
## The 30-Minute Customer Interview

**Booking**: Recruit 5 customers per week; aim for 1 completed session
**Compensation**: Gift card ($50-100) or product credit

### Opening (5 min)
"Tell me about yourself and how you use [product]."
"What were you trying to accomplish the last time you [core use case]?"

### Story mining (15 min) — PAST ONLY, specific stories
"Walk me through what you did last time you [task]."
"What happened before that? What did you do next?"
"How did that make you feel? What was frustrating about that?"
"What did you try first? Why did that not work?"

Avoid: "What do you usually do?" → hypothetical, not actual
Avoid: "Would you use feature X?" → asking for feature opinions
Seek: Specific stories about what they actually did

### Closing (5 min)
"Is there anything else I should understand about how you work?"
"Who else do you know who faces this challenge?"

### Never ask:
"Do you like this idea?" → confirmation bias
"Would you pay $X for this?" → hypothetical pricing
"What features would you want?" → feature requests ≠ customer problems
```

## Opportunity Solution Tree

```markdown
## OST Structure

OUTCOME (What business outcome are we trying to achieve?)
  └── OPPORTUNITIES (What customer needs, desires, and pain points stand in the way?)
        ├── Opportunity 1: "Hard to onboard new team members quickly"
        │     └── Solutions: Guided onboarding wizard | Template library | Video walkthroughs
        │           └── Assumptions to test: "Templates will be used within first week"
        ├── Opportunity 2: "Users don't know when tasks are complete"
        │     └── Solutions: Status notifications | Completion animations | Dashboard view
        └── Opportunity 3: "Hard to find recent work"
              └── Solutions: Search | Recent activity feed | Favourites

## OST Rules
- Outcomes come from business strategy (not PMs)
- Opportunities come from customers (not PMs)
- Solutions come from the team (PM + Design + Engineering)
- One outcome per OST (not multiple competing outcomes)
- Opportunities nest (sub-opportunities refine parent opportunities)
```

## Assumption Testing

```python
# Map solutions to their critical assumptions before building
from dataclasses import dataclass
from enum import Enum

class AssumptionType(str, Enum):
    DESIRABILITY  = "desirability"   # Do customers want this?
    VIABILITY     = "viability"      # Will it work for the business?
    FEASIBILITY   = "feasibility"    # Can we build it?
    USABILITY     = "usability"      # Can users use it?

@dataclass
class Assumption:
    solution: str
    assumption: str
    assumption_type: AssumptionType
    importance: int      # 1-10: How important is this assumption?
    confidence: int      # 1-10: How confident are we it's true?

    @property
    def priority_score(self) -> int:
        """High importance + low confidence = test this first."""
        return self.importance * (10 - self.confidence)

# Example: Template library solution
assumptions = [
    Assumption(
        solution="Template library",
        assumption="Users will find pre-built templates relevant to their workflow",
        assumption_type=AssumptionType.DESIRABILITY,
        importance=9, confidence=4,  # High priority to test
    ),
    Assumption(
        solution="Template library",
        assumption="Users will customise templates rather than use them as-is",
        assumption_type=AssumptionType.USABILITY,
        importance=7, confidence=5,
    ),
]

# Sort by priority: highest priority assumptions tested first
assumptions.sort(key=lambda a: a.priority_score, reverse=True)

# Design the smallest possible experiment for each assumption:
# - Show template designs in a prototype (30 min usability study)
# - Count which templates users select in a fake door test
# - Interview users who completed onboarding about what they needed
```

## Discovery Repository

```markdown
## Structuring Insights for the Team

After each interview, the PM captures:

**Date**: 2024-03-15
**Customer**: Mid-market SaaS company, Engineering Manager, 50-person team
**Story**: Tried to onboard 3 new engineers last month

**Quote**: "I had to manually recreate the same project setup 3 times — 
there's no way to create a template for it."

**Opportunity**: New team members face repeated setup friction (no templates)

**Assumptions it challenges/confirms**:
- Confirms: Template usage would save significant time (estimated: 2h per hire)
- Challenges: We assumed users wanted to start from scratch; they want to copy

**OST placement**: Opportunity 1.2 (sub-opportunity of "Hard to onboard")

---

Patterns across 10+ interviews → opportunity becomes high confidence
Single interview mention → low signal; track but don't act alone
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Infrequent big research projects** | Insights stale; decisions made without customer data | Weekly interview habit; small and continuous |
| **Asking for feature ideas** | Customers request solutions, not problems | Ask about past behaviour; surface opportunities |
| **PM interviews alone** | Design and engineering miss context | Full product trio in every interview |
| **Insights die in reports** | Team reads once; no action | Insights mapped directly to OST; integrated into decisions |
| **Testing too many assumptions at once** | Can't attribute which assumption was wrong | One assumption per experiment |

## 10 Rules

1. One customer interview per week minimum — a habit, not a project.
2. The full product trio (PM, Design, Engineering) attends every interview.
3. Ask about past behaviour — never hypothetical future behaviour.
4. Opportunities come from customers; solutions come from the team.
5. The Opportunity Solution Tree is a living document — updated after every interview.
6. Map every proposed solution to its critical assumptions before building.
7. Test the highest-importance, lowest-confidence assumptions first.
8. Experiments are the smallest thing that tests the assumption — not an MVP.
9. Discovery and delivery run in parallel — not sequentially.
10. Insights are shared with the team weekly — discovery is not the PM's private knowledge.
