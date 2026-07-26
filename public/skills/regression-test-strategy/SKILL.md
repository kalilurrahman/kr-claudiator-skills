---
name: regression-test-strategy
description: Design a regression testing strategy that catches bugs without slowing down delivery. Outputs test selection heuristics, risk-based prioritisation, suite partitioning, and CI execution plan.
argument-hint: [product type, team size, current test coverage, deployment frequency, pain points]
allowed-tools: Read, Write
---

# Regression Test Strategy

A regression test strategy defines which tests to run, when to run them, and how to respond to failures — balancing confidence against speed. Running every test on every commit is too slow; running nothing risks shipping regressions. The answer is risk-based prioritisation and intelligent test selection.

## Process

1. **Audit current tests.** How many tests? What coverage? What's the pass rate? How long does the suite take?
2. **Classify by risk and speed.** Fast unit tests run everywhere. Slow E2E tests run on merge.
3. **Define the test strategy.** Which tests run on PR? On merge? On deploy? Nightly?
4. **Implement affected-only testing.** Run only tests related to changed code.
5. **Tag and partition tests.** Critical, smoke, regression, nightly — runnable independently.
6. **Set failure policies.** Which failures block merge? Which are warnings?
7. **Track flakiness.** Quarantine flaky tests; fix or delete them.
8. **Review and optimise.** Monthly review: slowest tests, lowest-value tests, coverage gaps.

## Test Pyramid by Execution Frequency

```
ON EVERY COMMIT (< 2 minutes):
├── Unit tests — all
├── Linting + type checks
└── Fast integration tests (with test doubles)

ON EVERY PR (< 10 minutes):
├── Unit tests — all
├── Integration tests — affected modules
├── API tests — affected endpoints
└── Smoke tests — critical paths

ON MERGE TO MAIN (< 20 minutes):
├── Full integration test suite
├── API test suite — full
├── Security scans (SAST, dep scan)
└── Contract tests

NIGHTLY (no time limit):
├── Full E2E test suite
├── Performance tests
├── Cross-browser tests
├── Accessibility tests
└── Long-running data quality tests

PRE-PRODUCTION DEPLOY:
├── Smoke tests on staging
└── Synthetic monitors — verify critical journeys
```

## Risk-Based Test Prioritisation

```python
# Assign risk scores to determine test priority
from dataclasses import dataclass
from enum import Enum

class Impact(Enum):
    CRITICAL = 4   # Revenue, security, data loss
    HIGH     = 3   # Core user journey
    MEDIUM   = 2   # Secondary feature
    LOW      = 1   # Nice-to-have

class Probability(Enum):
    HIGH   = 3  # Changes frequently / complex
    MEDIUM = 2  # Moderate change frequency
    LOW    = 1  # Stable, simple

@dataclass
class TestCase:
    name: str
    area: str
    impact: Impact
    probability: Probability
    duration_ms: int
    tags: list

    @property
    def risk_score(self) -> int:
        return self.impact.value * self.probability.value

    @property
    def value_per_ms(self) -> float:
        return self.risk_score / max(self.duration_ms, 1)

# Prioritised test selection
def select_tests_for_pr(
    all_tests: list[TestCase],
    changed_files: list[str],
    time_budget_ms: int = 300_000  # 5 minutes
) -> list[TestCase]:
    # Always include: critical risk tests
    must_run = [t for t in all_tests if t.impact == Impact.CRITICAL]
    
    # Affected: tests related to changed files
    affected = [t for t in all_tests
                if any(f in t.tags for f in changed_files)
                and t not in must_run]
    
    # Fill remaining time budget by value/ms ratio
    budget = time_budget_ms - sum(t.duration_ms for t in must_run)
    optional = sorted([t for t in all_tests if t not in must_run and t not in affected],
                      key=lambda t: t.value_per_ms, reverse=True)
    
    selected = list(must_run) + list(affected)
    for t in optional:
        if budget > 0:
            selected.append(t)
            budget -= t.duration_ms
    
    return selected
```

## Pytest Tagging and Partitioning

```python
# conftest.py — tag-based test execution
import pytest

def pytest_configure(config):
    config.addinivalue_line("markers", "smoke: critical path smoke tests")
    config.addinivalue_line("markers", "regression: full regression suite")
    config.addinivalue_line("markers", "nightly: slow tests for nightly run only")
    config.addinivalue_line("markers", "security: security-focused tests")
    config.addinivalue_line("markers", "performance: performance benchmark tests")

# Usage in tests
@pytest.mark.smoke
@pytest.mark.regression
def test_checkout_completes_successfully():
    ...

@pytest.mark.nightly
@pytest.mark.performance
def test_checkout_p99_latency_under_500ms():
    ...

@pytest.mark.smoke
def test_health_endpoint_returns_200():
    ...
```

```yaml
# pytest.ini
[pytest]
markers =
    smoke: Critical path tests
    regression: Full regression
    nightly: Slow overnight tests
    security: Security tests
    performance: Performance benchmarks
```

```bash
# Run only smoke tests (PR pre-check — fast)
pytest -m smoke --timeout=30

# Run regression excluding nightly (merge gate)
pytest -m "regression and not nightly" --timeout=60

# Run full suite overnight
pytest --timeout=300

# Run security tests
pytest -m security

# Run affected tests only (using pytest-changed)
pytest --changed-since=origin/main
```

## Flakiness Tracking

```python
# Track test flakiness over time
import json
from pathlib import Path
from collections import defaultdict

class FlakinessTracker:
    def __init__(self, db_path: str = "test_flakiness.json"):
        self.db_path = Path(db_path)
        self.data = json.loads(self.db_path.read_text()) if self.db_path.exists() else {}
    
    def record_result(self, test_id: str, passed: bool, run_id: str):
        if test_id not in self.data:
            self.data[test_id] = {"passes": 0, "failures": 0, "quarantined": False}
        if passed:
            self.data[test_id]["passes"] += 1
        else:
            self.data[test_id]["failures"] += 1
        self._save()
    
    def get_flaky_tests(self, min_runs: int = 10, flakiness_threshold: float = 0.1) -> list:
        """Tests that fail >10% of the time are considered flaky."""
        flaky = []
        for test_id, stats in self.data.items():
            total = stats["passes"] + stats["failures"]
            if total >= min_runs:
                fail_rate = stats["failures"] / total
                if 0 < fail_rate <= flakiness_threshold:
                    flaky.append({"test": test_id, "fail_rate": fail_rate, "runs": total})
        return sorted(flaky, key=lambda x: x["fail_rate"], reverse=True)
    
    def quarantine(self, test_id: str):
        """Mark as quarantined — excluded from blocking CI but still tracked."""
        if test_id in self.data:
            self.data[test_id]["quarantined"] = True
            self._save()

# Quarantine policy: flaky test detected → quarantine → fix within 1 sprint or delete
```

## CI Configuration

```yaml
# .github/workflows/tests.yml
name: Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  smoke:
    name: Smoke Tests (fast)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install -r requirements-dev.txt
      - run: pytest -m smoke --timeout=30 -x  # -x = stop on first failure
        timeout-minutes: 5

  regression:
    name: Regression Tests
    runs-on: ubuntu-latest
    needs: smoke
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements-dev.txt
      - run: pytest -m "regression and not nightly"
               --timeout=60
               --junitxml=test-results.xml
               -n auto  # Parallel execution
        timeout-minutes: 15

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: test-results.xml

  nightly:
    name: Nightly Full Suite
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule'
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements-dev.txt
      - run: pytest --timeout=300 -n 4
        timeout-minutes: 60
```

## Regression Metrics

```markdown
## Weekly Test Health Report

| Metric | This Week | Last Week | Target |
|--------|-----------|-----------|--------|
| Suite duration (PR) | 8.2min | 9.1min | <10min |
| Suite duration (nightly) | 42min | 45min | <60min |
| Pass rate | 97.8% | 96.2% | >98% |
| Flaky tests | 3 | 7 | 0 |
| Tests quarantined | 2 | 2 | 0 |
| New tests added | 12 | 8 | >5/sprint |
| Code coverage | 78% | 76% | >75% |

## Action Items
- Fix quarantined tests: test_payment_timeout, test_email_delivery
- Add tests for recently-fixed bugs: ORD-1234, ORD-1256
- Delete 3 duplicate tests in test_checkout_legacy.py
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Running all tests on every commit** | 30-minute CI kills developer flow | Smoke tests on commit; full suite on merge |
| **No flakiness tracking** | Flaky tests erode confidence; nobody fixes them | Track and quarantine; SLA to fix or delete |
| **100% coverage target** | Test quantity over quality; trivial tests added | Coverage floor (80%), not ceiling; quality over quantity |
| **No tagging/partitioning** | Can't run targeted subsets | Tag from day one; maintain tag hygiene |
| **Tests without assertions** | Tests pass regardless of actual output | Review tests that have never failed |
| **Ignoring slow tests** | Suite creep: 2min suite becomes 45min | Monthly review of slowest 10 tests |
| **Deleting failing tests** | Regressions hidden | Fix or quarantine with tracking; never silently delete |

## 10 Rules

1. Smoke tests run on every commit and take under 2 minutes — they guard the most critical paths.
2. The merge gate suite runs in under 10 minutes — beyond that, developers bypass CI.
3. Flaky tests are quarantined within 24 hours and fixed within one sprint — they are bugs, not inconveniences.
4. Test selection for PRs is risk-based — more tests near the changed code, fewer far away.
5. Performance tests have explicit pass/fail thresholds, not just "run and observe."
6. Tests that have never failed are candidates for review — they may test nothing meaningful.
7. New bugs require new regression tests before fix is merged.
8. Track test suite duration weekly — creeping slowness kills CI adoption.
9. Coverage is a floor, not a goal — 75% with high-quality tests beats 95% with trivial ones.
10. The regression strategy is a living document — review and update every quarter.
