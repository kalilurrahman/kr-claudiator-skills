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

The canonical workflow for **Opportunity Solution Tree** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Build and use Opportunity Solution Trees to connect product outcomes to customer opportunities and solutions. Outputs tree structure, prioritisation process, as
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
