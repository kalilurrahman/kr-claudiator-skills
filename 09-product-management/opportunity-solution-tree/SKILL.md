---
name: opportunity-solution-tree
description: Build and use Opportunity Solution Trees to connect product outcomes to customer opportunities and solutions. Outputs tree structure, prioritisation process, assumption mapping, and experiment design.
argument-hint: [product outcome, discovery data available, team size, decision-making context]
allowed-tools: Read, Write
---

# Opportunity Solution Tree (OST)

The Opportunity Solution Tree (Teresa Torres) is a visual tool that connects business outcomes to customer opportunities to product solutions. It prevents common product pitfalls: jumping to solutions before understanding opportunities, pursuing too many things at once, and losing connection between business goals and customer needs.

## Tree Structure

```
OUTCOME (business goal — drives everything)
    │
    ├── OPPORTUNITY 1 (customer need/pain/desire)
    │     ├── Sub-opportunity 1.1
    │     └── Sub-opportunity 1.2
    │           ├── SOLUTION A → Assumptions → Experiments
    │           └── SOLUTION B → Assumptions → Experiments
    │
    ├── OPPORTUNITY 2
    │     └── Sub-opportunity 2.1
    │           └── SOLUTION C → Assumptions → Experiments
    │
    └── OPPORTUNITY 3
          ├── Sub-opportunity 3.1
          └── Sub-opportunity 3.2
```

## Building the Tree

```markdown
## Step 1: Set the Outcome (from business strategy, not the PM)

Good outcomes:
  "Increase monthly active automating accounts from 2,800 to 4,000"
  "Reduce time-to-first-value from 14 days to 7 days"
  "Increase NRR from 105% to 120%"

Bad outcomes (too broad/vague):
  "Improve the product"
  "Increase revenue"
  "Make users happier"

Rule: One outcome per tree. Multiple outcomes create conflicting priorities.

## Step 2: Map Opportunities (from customer interviews)

Opportunities = customer needs, pains, desires that prevent the outcome

For "Reduce time-to-first-value":
  Opportunity 1: "New users don't know what to build first"
    Sub-opp 1.1: "Users can't find relevant templates for their industry"
    Sub-opp 1.2: "Users don't know which features matter for their use case"

  Opportunity 2: "Team adoption slows after first user sets up"
    Sub-opp 2.1: "Inviting teammates feels risky (what will they see?)"
    Sub-opp 2.2: "New teammates don't know how to get started"

  Opportunity 3: "Integration setup blocks progress"
    Sub-opp 3.1: "OAuth flow confusing for non-technical users"

## Step 3: Prioritise Opportunities (not solutions)

For each opportunity, assess:
  - Frequency: How many customers face this? (from interview count)
  - Importance: How much does this matter to customers? (1-5)
  - Alignment: How well does addressing this serve the business outcome?
  - Market size: Is this segment large enough?

Pick ONE branch to focus on per sprint/quarter.

## Step 4: Generate Solutions (team brainstorming)

For "Users can't find relevant templates for their industry":
  Solution A: Industry-filtered template gallery on onboarding
  Solution B: Onboarding questionnaire → recommended starting points
  Solution C: "Copy from existing project" option on first run

## Step 5: Map Assumptions and Experiments

For Solution A (Template Gallery):
  Assumption 1 (critical): Users will find pre-built templates relevant
    → Test: Show 10 users a prototype of 5 templates; do 3+ say "I'd use this"?
  Assumption 2: Users will choose a template over blank start
    → Test: A/B test blank start vs template prompt; measure which gets to first action faster
```

## OST in Practice

```python
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class Assumption:
    description: str
    type: str           # "desirability" | "usability" | "feasibility" | "viability"
    importance: int     # 1-10
    confidence: int     # 1-10
    experiment: str     # How to test this

    @property
    def test_priority(self) -> int:
        return self.importance * (10 - self.confidence)

@dataclass
class Solution:
    name: str
    description: str
    assumptions: list[Assumption] = field(default_factory=list)
    experiment_results: dict = field(default_factory=dict)

@dataclass
class Opportunity:
    name: str
    description: str
    evidence_count: int     # Number of interview mentions
    importance_score: float  # Average importance rating from interviews
    solutions: list[Solution] = field(default_factory=list)
    sub_opportunities: list["Opportunity"] = field(default_factory=list)

    @property
    def priority_score(self) -> float:
        return self.evidence_count * self.importance_score

@dataclass
class OST:
    outcome: str
    opportunities: list[Opportunity]

    def get_top_opportunities(self, n: int = 3) -> list[Opportunity]:
        all_opps = []
        def collect(opps):
            for opp in opps:
                all_opps.append(opp)
                collect(opp.sub_opportunities)
        collect(self.opportunities)
        return sorted(all_opps, key=lambda o: o.priority_score, reverse=True)[:n]

    def get_riskiest_assumptions(self) -> list[tuple]:
        results = []
        for opp in self.opportunities:
            for solution in opp.solutions:
                for assumption in solution.assumptions:
                    results.append((opp.name, solution.name, assumption))
        return sorted(results, key=lambda x: x[2].test_priority, reverse=True)
```

## Weekly OST Review

```markdown
## Weekly Discovery Review Agenda (30 min)

1. What did we learn this week? (Interview insights) — 10 min
   Add new opportunities discovered
   Update confidence on existing opportunities

2. OST review — 10 min
   Any opportunities to add/remove/restructure?
   Are we still focused on the right branch?

3. Assumption testing — 10 min
   Results from this week's experiments
   Next experiments to run

## Monthly OST Review (60 min)

1. Is our chosen outcome still the right one?
2. Are we making progress toward the outcome? (metrics review)
3. Have we learned enough to pivot our opportunity focus?
4. Which solutions should move to delivery?
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Solutions in the opportunity layer** | Jumping to solutions prematurely | Opportunities describe customer needs, not product features |
| **Multiple outcomes on one tree** | Team pursues conflicting priorities | One outcome per tree; separate trees for separate outcomes |
| **Static tree** | Customer understanding stops; tree goes stale | Update after every interview |
| **Skipping assumption testing** | Build wrong thing confidently | Assumptions are mapped and tested before building |
| **PM owns the tree alone** | Team not connected to customer insights | Full trio updates the tree together |

## 10 Rules

1. One outcome per tree — multiple outcomes create unfocused teams.
2. Opportunities come from customers — never from PM assumptions about customer needs.
3. Solutions come from the team — PM, design, and engineering brainstorm together.
4. Always explore multiple solutions per opportunity before choosing one.
5. Map assumptions before building — the riskiest assumption is tested first.
6. Prioritise opportunities using customer evidence, not intuition.
7. Focus on one branch at a time — the tree is for structure, not parallelism.
8. Update the tree after every customer interview — it is a living document.
9. The experiment is the smallest thing that tests the critical assumption.
10. Outcomes drive everything — if a solution doesn't serve the outcome, it doesn't belong.
