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
