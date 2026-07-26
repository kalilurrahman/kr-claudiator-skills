---
name: test-coverage-strategy
description: Define a meaningful test coverage strategy beyond line counts. Outputs coverage goals by risk tier, measurement approach, gap analysis, and improvement roadmap.
argument-hint: [codebase size, risk profile, current coverage, CI tooling, team maturity]
allowed-tools: Read, Write, Bash
---

# Test Coverage Strategy

Coverage percentage is a floor, not a goal. 80% coverage with trivial tests is worse than 60% coverage with excellent tests of the riskiest code. A meaningful coverage strategy defines what to cover, how much, and how to measure coverage quality — not just quantity.

## Coverage Dimensions

```
LINE COVERAGE: % of lines executed
  Weakest measure — a line can execute without being tested correctly

BRANCH COVERAGE: % of if/else branches taken
  Better — tests both true and false paths

CONDITION COVERAGE: Each boolean sub-expression true and false
  Strongest for complex boolean logic

MUTATION COVERAGE: % of injected bugs (mutations) caught by tests
  Measures test quality, not just execution
  Target: >60% mutation score

PATH COVERAGE: All unique execution paths
  Combinatorially explosive — impractical for complex code
```

## Risk-Tiered Coverage Goals

```python
# Coverage targets by code risk tier
COVERAGE_TARGETS = {
    "tier_1_critical": {
        "examples": ["payment processing", "auth", "data export"],
        "line_coverage": 95,
        "branch_coverage": 90,
        "mutation_score": 70,
        "review": "Every line reviewed by senior engineer",
    },
    "tier_2_core": {
        "examples": ["order management", "user accounts", "billing"],
        "line_coverage": 85,
        "branch_coverage": 80,
        "mutation_score": 60,
        "review": "Coverage report reviewed each sprint",
    },
    "tier_3_standard": {
        "examples": ["search", "notifications", "analytics"],
        "line_coverage": 75,
        "branch_coverage": 65,
        "mutation_score": None,  # Not required
        "review": "Coverage floor enforced in CI",
    },
    "tier_4_low_risk": {
        "examples": ["UI formatting", "config parsing", "generated code"],
        "line_coverage": 50,
        "branch_coverage": None,
        "mutation_score": None,
        "review": "Exclude from coverage targets",
    },
}
```

## Coverage Configuration

```ini
# pytest: setup.cfg
[coverage:run]
source = src/
branch = True
omit =
    */migrations/*
    */tests/*
    */conftest.py
    src/generated/*
    src/config/settings.py

[coverage:report]
show_missing = True
fail_under = 75      # Global floor
exclude_lines =
    pragma: no cover
    def __repr__
    raise NotImplementedError
    if TYPE_CHECKING:
    @abstract
```

```javascript
// Jest: jest.config.js
module.exports = {
  collectCoverageFrom: [
    "src/**/*.{js,ts,jsx,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.tsx",
    "!src/generated/**",
  ],
  coverageThresholds: {
    global: {
      lines: 75,
      branches: 65,
      functions: 75,
      statements: 75,
    },
    // Higher threshold for critical paths
    "./src/payments/**": {
      lines: 95,
      branches: 90,
    },
  },
};
```

## Gap Analysis

```bash
# Find uncovered lines in critical paths
coverage run -m pytest tests/
coverage report --include="src/payments/*" --show-missing

# Identify riskiest uncovered code (high complexity + low coverage)
pip install radon
radon cc src/ -s -n B | head -20     # High complexity functions
coverage report --include="src/payments/*" --skip-covered | head -30  # Uncovered

# Mutation testing (Python)
pip install mutmut
mutmut run --paths-to-mutate=src/payments/
mutmut results
# Survived mutations = tests that don't catch bugs
```

## CI Enforcement

```yaml
# .github/workflows/coverage.yml
- name: Run tests with coverage
  run: |
    pytest --cov=src --cov-report=xml --cov-report=term-missing
    
    # Check critical path coverage separately
    python3 -c "
    import xml.etree.ElementTree as ET
    tree = ET.parse('coverage.xml')
    for pkg in tree.findall('.//package[@name="src/payments"]'):
        line_rate = float(pkg.attrib['line-rate'])
        if line_rate < 0.95:
            print(f'FAIL: payments coverage {line_rate:.1%} < 95%')
            exit(1)
    print('Payment coverage OK')
    "
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **100% coverage target** | Trivial tests added for coverage; masks quality | Risk-tiered targets; quality over quantity |
| **Line coverage only** | Branches untested; bugs hide in else clauses | Require branch coverage for tier 1-2 |
| **Coverage without mutation testing** | 100% line coverage can catch 0% of bugs | Mutation score on critical paths |
| **Same threshold for all code** | Generated code and payment code treated equally | Tiered targets by risk |
| **Coverage-driven test writing** | Tests written to hit lines, not verify behaviour | Write tests for behaviour; coverage is a by-product |

## 10 Rules

1. Coverage is a floor, not a goal — quality of tests matters more than the percentage.
2. Risk-tier your codebase — critical paths need 90%+; utility code can be 60%.
3. Branch coverage is more meaningful than line coverage — both paths of every if-else.
4. Mutation testing on critical paths — it measures whether tests actually catch bugs.
5. Exclude generated code, migrations, and configuration from coverage targets.
6. CI enforces minimum coverage — failing builds when coverage drops below floor.
7. Coverage reports show missing lines — not just percentages.
8. Never write tests purely to hit coverage numbers — tests must verify real behaviour.
9. Coverage gaps in the riskiest code are prioritised over total coverage percentage.
10. Review coverage trends over time — a declining trend indicates a coverage debt problem.

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

The canonical workflow for **Test Coverage Strategy** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Define a meaningful test coverage strategy beyond line counts. Outputs coverage goals by risk tier, measurement approach, gap analysis, and improvement roadmap.
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
