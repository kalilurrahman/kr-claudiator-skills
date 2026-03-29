---
name: flaky-test-management
description: Detect, quarantine, fix, and prevent flaky tests in your test suite. Outputs flakiness detection pipeline, quarantine workflow, root cause categories, and prevention guidelines.
argument-hint: [test suite size, CI system, current flakiness rate, pain level]
allowed-tools: Read, Write, Bash
---

# Flaky Test Management

Flaky tests — tests that pass and fail without code changes — destroy developer trust in CI. Teams learn to re-run failed builds habitually, hiding real failures. Flaky tests must be systematically detected, quarantined, fixed, and prevented.

## Flakiness Detection

```python
import sqlite3
from datetime import datetime, timedelta

class FlakinessTracker:
    def __init__(self, db_path: str = "test_history.db"):
        self.db = sqlite3.connect(db_path)
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS test_runs (
                test_id TEXT NOT NULL,
                run_id TEXT NOT NULL,
                outcome TEXT NOT NULL,
                commit_hash TEXT,
                recorded_at TEXT NOT NULL
            )
        """)

    def record(self, test_id: str, run_id: str, outcome: str, commit_hash: str):
        self.db.execute(
            "INSERT INTO test_runs VALUES (?,?,?,?,?)",
            [test_id, run_id, outcome, commit_hash, datetime.utcnow().isoformat()]
        )
        self.db.commit()

    def get_flaky_tests(self, min_runs: int = 10, window_days: int = 14) -> list[dict]:
        """Tests that both pass AND fail — always flaky."""
        since = (datetime.utcnow() - timedelta(days=window_days)).isoformat()
        rows = self.db.execute("""
            SELECT
                test_id,
                COUNT(*) as total,
                SUM(outcome = 'pass') as passes,
                SUM(outcome = 'fail') as failures,
                ROUND(100.0 * SUM(outcome = 'fail') / COUNT(*), 1) as fail_pct
            FROM test_runs
            WHERE recorded_at > ?
            GROUP BY test_id
            HAVING total >= ?
              AND failures > 0
              AND passes > 0
            ORDER BY fail_pct DESC
        """, [since, min_runs]).fetchall()

        return [
            {
                "test_id": r[0], "total": r[1], "fails": r[3], "fail_pct": r[4],
                "severity": "critical" if r[4] > 20 else "high" if r[4] > 10 else "medium"
            }
            for r in rows
        ]
```

## Quarantine Workflow

```python
# conftest.py — skip quarantined tests in main CI; run in separate job
import pytest

QUARANTINED = {
    "tests/test_payment.py::test_webhook_timeout",
    "tests/test_email.py::test_async_delivery",
}

def pytest_collection_modifyitems(items):
    skip = pytest.mark.skip(reason="Quarantined: flaky — under investigation")
    for item in items:
        if f"{item.fspath}::{item.name}" in QUARANTINED:
            item.add_marker(skip)
```

```yaml
# CI: quarantined tests run separately — don't block merge
- name: Run quarantined tests (informational only)
  continue-on-error: true
  run: |
    pytest -m quarantined --reruns=3 --junitxml=quarantined.xml
```

## Root Causes and Fixes

```markdown
## Race Conditions / Timing
Symptom: Fails on slow CI; passes locally
Fix: Explicit condition polling instead of sleep()
Bad:  time.sleep(2)  # Hope the server started
Good: wait_until(lambda: server.is_ready(), timeout=30, interval=0.5)

## Shared State Between Tests
Symptom: Passes alone; fails in full suite
Fix: Isolated fixtures; rollback DB transactions after each test
Bad:  Class-level state shared between test methods
Good: Function-scoped fixture creates fresh state each test

## External Dependencies
Symptom: Fails when network is slow or external service is down
Fix: Mock external services in unit tests
Bad:  Real HTTP call to Stripe API in unit test
Good: `responses` or `httpx_mock` returns canned response

## Date/Time Sensitivity
Symptom: Fails at midnight; fails on specific dates
Fix: Inject a controllable clock; use `freezegun`
Bad:  datetime.now() compared to hardcoded date in test
Good: @freeze_time("2024-03-15") or inject fake clock

## Parallel Execution Conflicts
Symptom: Fails with -n auto; passes with -n 0
Fix: Separate database schema per worker
Bad:  All parallel workers share same DB rows
Good: pytest-xdist worker_id used to create isolated schemas
```

## Prevention Linting

```bash
# Check for common flakiness patterns in test files
grep -rn "time.sleep" tests/  # Flag all sleep() calls
grep -rn "random\." tests/    # Flag unseeded randomness
grep -rn "datetime.now()" tests/  # Flag non-injectable time

# Configure as pre-commit hook or CI check
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Retrying without fixing** | Masks the problem; wastes CI time | Quarantine + fix within one sprint |
| **Deleting flaky tests** | Hides bugs; coverage gap | Fix root cause; delete only if test adds no value |
| **No tracking** | Cannot identify systemic patterns | Record every test outcome; track trends |
| **Sleeping instead of waiting** | Timing-dependent; brittle | Poll with conditions and explicit timeouts |
| **Global state between tests** | Order-dependent; non-reproducible | Isolated fixtures; fresh state per test |

## 10 Rules

1. A test that sometimes fails is always wrong — investigate, don't retry.
2. Quarantine flaky tests within 24 hours — don't let them block CI.
3. Every quarantined test has an owner and a fix-or-delete deadline (one sprint).
4. Track test outcomes over time — detect flakiness before it becomes painful.
5. All flaky tests have a root cause: timing, isolation, external deps, or concurrency.
6. `time.sleep()` in tests is a red flag — replace with explicit condition polling.
7. Each test runs in complete isolation — no shared state between tests.
8. External services are mocked in unit tests — real calls only in integration tests.
9. Parallel execution requires test isolation — separate DB schema per worker.
10. Flakiness rate belongs on the quality dashboard — it is a team-level metric.
