---
name: workflow-orchestration
description: Design workflow orchestration systems for complex, multi-step business processes. Outputs orchestration pattern selection, Temporal/Airflow implementation, error handling strategy, and observability.
argument-hint: [workflow complexity, step count, failure requirements, team familiarity, language]
allowed-tools: Read, Write
---

# Workflow Orchestration

Workflow orchestration manages the execution of multi-step processes: scheduling steps, handling failures, retrying, and maintaining state across long-running operations. The challenge is making complex workflows reliable, observable, and debuggable when any individual step can fail.

## When to Use Orchestration

```
USE ORCHESTRATION when:
  ✓ Multi-step process with dependencies between steps
  ✓ Steps can fail and need automatic retry
  ✓ Process runs for minutes to months (long-running)
  ✓ You need visibility into process state
  ✓ Human approval gates required
  ✓ Compensation (rollback) needed on failure

USE SIMPLE QUEUES when:
  ✓ Single-step processing
  ✓ No dependencies between tasks
  ✓ Stateless; no need to track progress

ORCHESTRATION TOOLS:
  Temporal    — durable execution; code-first; any language
  Apache Airflow — DAG-based; Python; batch/data pipelines
  Step Functions — AWS-native; JSON DSL; serverless-friendly
  Prefect     — Python; data workflows; modern Airflow alternative
  Conductor   — Netflix; microservice workflows; polyglot
```

## Temporal — Code-First Orchestration

```python
from temporalio import activity, workflow
from temporalio.client import Client
from temporalio.worker import Worker
from datetime import timedelta
import asyncio

# Activities: individual steps (can be retried independently)
@activity.defn
async def validate_order(order_id: str) -> dict:
    """Validates order and returns order details."""
    order = await db.get_order(order_id)
    if not order:
        raise ValueError(f"Order {order_id} not found")
    return order.dict()

@activity.defn
async def reserve_inventory(order_id: str, items: list) -> str:
    """Reserves inventory; returns reservation ID."""
    reservation_id = await inventory_service.reserve(order_id, items)
    return reservation_id

@activity.defn
async def charge_payment(order_id: str, amount: float) -> str:
    """Charges payment; returns charge ID."""
    charge_id = await payment_service.charge(order_id, amount)
    return charge_id

@activity.defn
async def release_inventory(reservation_id: str) -> None:
    """Compensation: release reserved inventory on failure."""
    await inventory_service.release(reservation_id)

@activity.defn
async def refund_payment(charge_id: str) -> None:
    """Compensation: refund payment on failure."""
    await payment_service.refund(charge_id)

# Workflow: orchestrates activities with retry/compensation
@workflow.defn
class OrderFulfillmentWorkflow:
    @workflow.run
    async def run(self, order_id: str) -> dict:
        reservation_id = None
        charge_id = None

        try:
            # Step 1: Validate (3 retries, 5s backoff)
            order = await workflow.execute_activity(
                validate_order, order_id,
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=RetryPolicy(maximum_attempts=3, backoff_coefficient=2),
            )

            # Step 2: Reserve inventory
            reservation_id = await workflow.execute_activity(
                reserve_inventory, order_id, order["items"],
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=5),
            )

            # Step 3: Charge payment
            charge_id = await workflow.execute_activity(
                charge_payment, order_id, order["total"],
                start_to_close_timeout=timedelta(seconds=60),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )

            return {"status": "fulfilled", "charge_id": charge_id}

        except Exception as e:
            # Compensation: undo completed steps in reverse order
            if charge_id:
                await workflow.execute_activity(refund_payment, charge_id)
            if reservation_id:
                await workflow.execute_activity(release_inventory, reservation_id)
            raise

# Start a workflow instance
async def start_order_fulfillment(order_id: str):
    client = await Client.connect("localhost:7233")
    handle = await client.start_workflow(
        OrderFulfillmentWorkflow.run,
        order_id,
        id=f"order-fulfillment-{order_id}",  # Deduplication key
        task_queue="orders",
    )
    return handle.id
```

## Apache Airflow — DAG-Based (Data Pipelines)

```python
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.sensors.external_task import ExternalTaskSensor
from datetime import datetime, timedelta

default_args = {
    "owner": "data-team",
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "email_on_failure": True,
    "email": ["data-oncall@company.com"],
}

with DAG(
    dag_id="daily_revenue_report",
    default_args=default_args,
    schedule_interval="0 6 * * *",  # 6am UTC daily
    start_date=datetime(2024, 1, 1),
    catchup=False,  # Don't backfill missed runs
    tags=["revenue", "daily"],
) as dag:

    wait_for_etl = ExternalTaskSensor(
        task_id="wait_for_etl",
        external_dag_id="etl_pipeline",
        external_task_id="load_complete",
        timeout=3600,
    )

    compute_metrics = PythonOperator(
        task_id="compute_revenue_metrics",
        python_callable=lambda **ctx: compute_revenue(ctx["ds"]),
    )

    generate_report = PythonOperator(
        task_id="generate_report",
        python_callable=lambda **ctx: generate_pdf_report(ctx["ds"]),
    )

    send_report = PythonOperator(
        task_id="send_report",
        python_callable=lambda **ctx: email_report(ctx["ds"]),
    )

    wait_for_etl >> compute_metrics >> generate_report >> send_report
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **God workflow** | One workflow does everything; impossible to debug | Decompose into smaller workflows |
| **Activities that are not idempotent** | Retries cause duplicate side effects | Every activity is idempotent (use idempotency keys) |
| **Long activity timeouts** | Failed activities hold up workflow for hours | Set aggressive timeouts; activities retry independently |
| **No compensation** | Partial completion leaves inconsistent state | Implement saga pattern: compensate in reverse on failure |
| **Workflow for simple tasks** | Over-engineering single-step processes | Queues for single steps; orchestration for multi-step |

## 10 Rules

1. Activities must be idempotent — they will be retried on failure.
2. Compensation logic (undo) is as important as the happy path.
3. Every activity has an explicit timeout — no infinite waits.
4. Workflow IDs should be business-meaningful — enables deduplication.
5. Workflows are durable — they survive process restarts and crashes.
6. Keep workflows thin — business logic belongs in activities, not the orchestrator.
7. Each activity should do one thing — fine-grained retry granularity.
8. Version workflows carefully — long-running workflows may need to handle schema evolution.
9. Observability is built-in — use the platform's UI for debugging; add structured logging in activities.
10. Test failure scenarios — inject failures in activities to verify compensation works.
