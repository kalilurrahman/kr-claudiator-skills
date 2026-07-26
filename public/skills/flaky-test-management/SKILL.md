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

The canonical workflow for **Flaky Test Management** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Detect, quarantine, fix, and prevent flaky tests in your test suite. Outputs flakiness detection pipeline, quarantine workflow, root cause categories, and preve
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
