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

The canonical workflow for **Workflow Orchestration** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Design workflow orchestration systems for complex, multi-step business processes. Outputs orchestration pattern selection, Temporal/Airflow implementation, erro
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
