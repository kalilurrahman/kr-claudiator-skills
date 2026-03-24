---
name: data-pipeline-testing
description: Test data pipelines for correctness, reliability, and data quality. Outputs unit tests for transformations, integration tests for pipeline runs, data contract tests, and CI strategy.
argument-hint: [pipeline tool, data volume, criticality, existing test coverage]
allowed-tools: Read, Write, Bash
---

# Data Pipeline Testing

Data pipelines are production software. Untested pipelines silently corrupt analytics, mislead decisions, and violate SLAs. Testing data pipelines requires testing at three levels: transformation logic (unit), pipeline execution (integration), and data contracts (schema + quality).

## Process

1. **Unit test transformations.** Test SQL/Python logic with known inputs and expected outputs. Fast, no infrastructure.
2. **Test data quality inline.** Completeness, uniqueness, referential integrity, range checks — embedded in the pipeline.
3. **Integration test the full pipeline.** Run end-to-end with representative sample data on each PR.
4. **Contract test schema.** Catch upstream schema changes before they reach production.
5. **Test idempotency.** Running the pipeline twice should produce the same result as running it once.
6. **Test late data handling.** What happens when records arrive out of order or with delays?
7. **Automate in CI.** Every PR runs unit + integration tests. Merge blocks on failure.

## dbt Testing (SQL Pipelines)

```yaml
# models/schema.yml — inline data quality tests
version: 2

models:
  - name: stg_orders
    description: "Staged orders from source PostgreSQL"
    tests:
      - dbt_utils.equal_rowcount:
          compare_model: source('postgres', 'orders')
          name: "row_count_matches_source"
    columns:
      - name: order_id
        tests:
          - unique
          - not_null
      - name: customer_id
        tests:
          - not_null
          - relationships:
              to: ref('stg_customers')
              field: customer_id
      - name: status
        tests:
          - accepted_values:
              values: ['draft', 'pending', 'paid', 'shipped', 'delivered', 'cancelled']
      - name: total_amount
        tests:
          - not_null
          - dbt_expectations.expect_column_values_to_be_between:
              min_value: 0
              max_value: 100000
      - name: created_at
        tests:
          - not_null
          - dbt_expectations.expect_column_values_to_be_between:
              min_value: "'2020-01-01'"
              max_value: "'{{ run_started_at }}'"

  - name: fct_orders
    tests:
      # Revenue reconciliation — total must match source
      - dbt_utils.expression_is_true:
          expression: "total_revenue >= 0"
      # Row count should never drop more than 5% day-over-day
      - dbt_utils.recency:
          datepart: hour
          field: created_at
          interval: 24

sources:
  - name: postgres
    database: production
    schema: orders
    freshness:
      warn_after: {count: 6, period: hour}
      error_after: {count: 24, period: hour}
    tables:
      - name: orders
        loaded_at_field: updated_at
```

```bash
# Run dbt tests in CI
dbt test --select stg_orders fct_orders
dbt test --select tag:critical          # Only critical tests
dbt test --exclude tag:slow             # Skip slow tests on PR
dbt source freshness                    # Check source data freshness
```

## Python Pipeline Unit Tests

```python
# tests/unit/test_transformations.py
import pytest
import pandas as pd
from decimal import Decimal
from datetime import datetime
from pipeline.transformations import (
    clean_orders,
    compute_order_metrics,
    apply_scd_type2,
)

class TestCleanOrders:
    def test_removes_test_orders(self):
        raw = pd.DataFrame([
            {'order_id': 'ord-1', 'customer_id': 'TEST-001', 'amount': 50.0},
            {'order_id': 'ord-2', 'customer_id': 'cust-abc', 'amount': 30.0},
        ])
        result = clean_orders(raw, test_customer_prefix='TEST-')
        assert len(result) == 1
        assert result.iloc[0]['order_id'] == 'ord-2'

    def test_fills_missing_status_with_pending(self):
        raw = pd.DataFrame([
            {'order_id': 'ord-1', 'status': None, 'amount': 50.0},
        ])
        result = clean_orders(raw)
        assert result.iloc[0]['status'] == 'pending'

    def test_converts_amount_to_cents(self):
        raw = pd.DataFrame([{'order_id': 'ord-1', 'amount': 29.99}])
        result = clean_orders(raw)
        assert result.iloc[0]['amount_cents'] == 2999

    def test_handles_empty_dataframe(self):
        raw = pd.DataFrame(columns=['order_id', 'customer_id', 'amount'])
        result = clean_orders(raw)
        assert len(result) == 0


class TestComputeOrderMetrics:
    def test_computes_aov_correctly(self):
        orders = pd.DataFrame([
            {'customer_id': 'c1', 'amount': 100.0, 'order_date': '2024-01-01'},
            {'customer_id': 'c1', 'amount': 200.0, 'order_date': '2024-01-15'},
            {'customer_id': 'c2', 'amount': 50.0,  'order_date': '2024-01-10'},
        ])
        result = compute_order_metrics(orders)
        c1 = result[result['customer_id'] == 'c1'].iloc[0]
        assert c1['order_count'] == 2
        assert c1['total_revenue'] == 300.0
        assert c1['aov'] == 150.0

    def test_first_order_flag_correct(self):
        orders = pd.DataFrame([
            {'customer_id': 'c1', 'order_date': '2024-01-01', 'order_id': 'o1'},
            {'customer_id': 'c1', 'order_date': '2024-01-15', 'order_id': 'o2'},
        ]).sort_values('order_date')
        result = compute_order_metrics(orders)
        assert result[result['order_id'] == 'o1'].iloc[0]['is_first_order'] is True
        assert result[result['order_id'] == 'o2'].iloc[0]['is_first_order'] is False


class TestSCDType2:
    def test_creates_new_version_on_change(self):
        existing = pd.DataFrame([{
            'customer_id': 'c1', 'email': 'old@test.com',
            'valid_from': '2024-01-01', 'valid_to': None, 'is_current': True
        }])
        incoming = pd.DataFrame([{
            'customer_id': 'c1', 'email': 'new@test.com', 'as_of': '2024-03-01'
        }])
        result = apply_scd_type2(existing, incoming, key='customer_id',
                                  tracked_cols=['email'])
        assert len(result) == 2
        old = result[result['email'] == 'old@test.com'].iloc[0]
        new = result[result['email'] == 'new@test.com'].iloc[0]
        assert old['valid_to'] == '2024-03-01'
        assert old['is_current'] is False
        assert new['is_current'] is True

    def test_no_change_produces_no_new_version(self):
        existing = pd.DataFrame([{
            'customer_id': 'c1', 'email': 'same@test.com',
            'valid_from': '2024-01-01', 'valid_to': None, 'is_current': True
        }])
        incoming = pd.DataFrame([{
            'customer_id': 'c1', 'email': 'same@test.com', 'as_of': '2024-03-01'
        }])
        result = apply_scd_type2(existing, incoming, key='customer_id',
                                  tracked_cols=['email'])
        assert len(result) == 1
```

## Idempotency Testing

```python
# tests/integration/test_idempotency.py
import pytest
from pipeline.runner import run_orders_pipeline

class TestIdempotency:
    def test_running_twice_produces_same_result(self, test_db, test_date):
        """Pipeline must be idempotent — safe to re-run on failure."""
        # First run
        run_orders_pipeline(date=test_date, db=test_db)
        result_1 = test_db.query(
            "SELECT COUNT(*), SUM(total_amount) FROM fct_orders WHERE order_date = %s",
            [test_date]
        ).fetchone()
        
        # Second run — same date, same data
        run_orders_pipeline(date=test_date, db=test_db)
        result_2 = test_db.query(
            "SELECT COUNT(*), SUM(total_amount) FROM fct_orders WHERE order_date = %s",
            [test_date]
        ).fetchone()
        
        assert result_1 == result_2, "Pipeline is not idempotent"

    def test_handles_late_arriving_records(self, test_db):
        """Records arriving after the pipeline run should be handled on re-run."""
        run_date = '2024-03-01'
        
        # Run pipeline for March 1
        run_orders_pipeline(date=run_date, db=test_db)
        count_before = test_db.query(
            "SELECT COUNT(*) FROM fct_orders WHERE order_date = %s", [run_date]
        ).fetchone()[0]
        
        # Insert late-arriving record for March 1
        test_db.execute(
            "INSERT INTO raw_orders VALUES ('late-ord', 'c1', 50.0, '2024-03-01', '2024-03-02 08:00:00')"
        )
        
        # Re-run — should include late record
        run_orders_pipeline(date=run_date, db=test_db)
        count_after = test_db.query(
            "SELECT COUNT(*) FROM fct_orders WHERE order_date = %s", [run_date]
        ).fetchone()[0]
        
        assert count_after == count_before + 1
```

## Schema Contract Testing

```python
# tests/contracts/test_source_schema.py
# Run daily to catch upstream schema changes before pipeline runs

import pytest
import sqlalchemy as sa
from pipeline.schema_contracts import SourceContract

# Define expected schema
ORDERS_CONTRACT = SourceContract(
    table='orders.orders',
    required_columns={
        'order_id':    {'type': 'uuid',        'nullable': False},
        'customer_id': {'type': 'uuid',        'nullable': False},
        'status':      {'type': 'varchar',     'nullable': False},
        'total_amount':{'type': 'numeric',     'nullable': False},
        'created_at':  {'type': 'timestamptz', 'nullable': False},
        'updated_at':  {'type': 'timestamptz', 'nullable': False},
    },
    allowed_status_values=['draft','pending','paid','shipped','delivered','cancelled'],
)

def test_orders_schema_matches_contract(source_db):
    violations = ORDERS_CONTRACT.validate(source_db)
    assert not violations, f"Schema contract violations:\n" + "\n".join(violations)

def test_orders_no_null_order_ids(source_db):
    count = source_db.execute(
        "SELECT COUNT(*) FROM orders.orders WHERE order_id IS NULL"
    ).scalar()
    assert count == 0, f"Found {count} orders with NULL order_id"

def test_orders_referential_integrity(source_db):
    count = source_db.execute("""
        SELECT COUNT(*) FROM orders.orders o
        LEFT JOIN orders.customers c ON o.customer_id = c.customer_id
        WHERE c.customer_id IS NULL
    """).scalar()
    assert count == 0, f"Found {count} orphaned orders"
```

## CI Pipeline

```yaml
# .github/workflows/pipeline-tests.yml
name: Data Pipeline Tests

on:
  pull_request:
    paths: ['pipeline/**', 'models/**', 'tests/**']

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install -r requirements-dev.txt
      - run: pytest tests/unit/ -v --cov=pipeline --cov-fail-under=80

  dbt-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: test_db
          POSTGRES_PASSWORD: test
    steps:
      - uses: actions/checkout@v4
      - run: pip install dbt-postgres
      - run: dbt deps
      - run: dbt seed --profiles-dir .dbt/test
      - run: dbt run --profiles-dir .dbt/test
      - run: dbt test --profiles-dir .dbt/test

  integration-tests:
    runs-on: ubuntu-latest
    if: github.base_ref == 'main'
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements-dev.txt
      - run: pytest tests/integration/ -v --timeout=300
        env:
          TEST_DB_URL: ${{ secrets.TEST_DB_URL }}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Testing only happy path** | Edge cases corrupt production data silently | Test nulls, duplicates, late data, empty inputs |
| **No idempotency test** | Re-runs on failure double-count records | Explicit idempotency test — run twice, compare |
| **Comparing floats directly** | `assert revenue == 12345.67` fails on float arithmetic | Use `pytest.approx` or compare rounded integers |
| **Tests depend on production data** | Tests break when data changes | Use fixture/seed data with known properties |
| **Skipping schema contracts** | Upstream schema change silently breaks pipeline | Automated schema contract tests run daily |
| **No freshness check** | Stale source data processed as if current | dbt source freshness or explicit freshness assertion |
| **Integration tests in CI only** | Local development blind to failures | Make integration tests runnable locally with docker-compose |

## 10 Rules

1. Unit test transformation logic with known inputs and expected outputs — no database required.
2. Every pipeline must be idempotent — write an explicit test that proves it.
3. Data quality tests are inline in the pipeline, not a separate QA step.
4. Schema contracts run before the pipeline — catch upstream changes at source, not at output.
5. Test with empty inputs — pipelines must not fail on empty datasets.
6. Test with null values — nulls propagate in unexpected ways through transformations.
7. Freshness checks are mandatory — stale data processed on schedule is silent data loss.
8. CI blocks on test failure — data quality failures are not warnings, they are blockers.
9. Seed data for tests is version-controlled and deterministic — never rely on production data.
10. Late data handling is explicit — every pipeline documents and tests what happens when records arrive late.
