---
name: snapshot-testing
description: Implement snapshot testing for UI components, API responses, and data structures. Outputs snapshot configuration, update workflow, review guidelines, and CI integration.
argument-hint: [test framework, component type, snapshot storage, team workflow]
allowed-tools: Read, Write, Bash
---

# Snapshot Testing

Snapshot testing captures the output of a component or function and compares it against a stored reference on subsequent runs. It catches unexpected changes — but only if snapshots are reviewed carefully when updated. The value is proportional to your team's discipline around snapshot reviews.

## Process

1. **Write the test.** Render the component or call the function; capture output as snapshot.
2. **First run creates the snapshot.** Review it carefully — this is the baseline.
3. **Subsequent runs compare.** Failing snapshot = intentional change or bug. Investigate before updating.
4. **Update deliberately.** Only update when the change is intentional and verified correct.
5. **Review snapshot diffs in PRs.** Snapshot changes must be reviewed like code changes.
6. **Keep snapshots focused.** Small, stable snapshots are more useful than large fragile ones.

## Jest Snapshot Testing (React)

```typescript
// components/__tests__/OrderCard.test.tsx
import { render } from "@testing-library/react";
import { OrderCard } from "../OrderCard";

describe("OrderCard", () => {
  it("renders pending order correctly", () => {
    const { container } = render(
      <OrderCard
        order={{
          id: "ord-123",
          status: "pending",
          total: 59.99,
          createdAt: "2024-03-15T10:00:00Z",
          items: [{ name: "Widget", quantity: 2 }],
        }}
      />
    );
    expect(container).toMatchSnapshot();
  });

  it("renders confirmed order with different styling", () => {
    const { container } = render(
      <OrderCard
        order={{ id: "ord-456", status: "confirmed", total: 29.99, ... }}
      />
    );
    expect(container).toMatchSnapshot();
  });
});

// Inline snapshot — visible in test file, easier to review
it("formats currency correctly", () => {
  expect(formatCurrency(1234.56, "USD")).toMatchInlineSnapshot(
    `"$1,234.56"`
  );
});
```

## API Response Snapshots

```python
# tests/api/test_snapshots.py
import pytest
import json
from pathlib import Path

SNAPSHOT_DIR = Path("tests/snapshots")

def save_snapshot(name: str, data: dict):
    SNAPSHOT_DIR.mkdir(exist_ok=True)
    path = SNAPSHOT_DIR / f"{name}.json"
    path.write_text(json.dumps(data, indent=2, sort_keys=True))

def load_snapshot(name: str) -> dict:
    path = SNAPSHOT_DIR / f"{name}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())

def assert_matches_snapshot(name: str, actual: dict, update: bool = False):
    expected = load_snapshot(name)
    if expected is None or update:
        save_snapshot(name, actual)
        if update:
            print(f"Updated snapshot: {name}")
        return
    assert actual == expected, (
        f"Snapshot mismatch for {name}. "
        f"Run with UPDATE_SNAPSHOTS=1 to update."
    )

def test_order_list_response_shape(client, auth_headers):
    """Snapshot the response schema — catches unintended API changes."""
    response = client.get("/api/v1/orders?page_size=2", headers=auth_headers)
    assert response.status_code == 200
    
    # Normalise dynamic values before snapshot
    data = response.json()
    normalised = normalise_for_snapshot(data, dynamic_fields=["order_id", "created_at"])
    
    assert_matches_snapshot("order_list_response", normalised,
                            update=os.getenv("UPDATE_SNAPSHOTS") == "1")

def normalise_for_snapshot(data: dict, dynamic_fields: list) -> dict:
    """Replace dynamic values (IDs, timestamps) with stable placeholders."""
    import re, copy
    result = copy.deepcopy(data)
    def replace_dynamic(obj):
        if isinstance(obj, dict):
            for key in obj:
                if key in dynamic_fields:
                    obj[key] = f"<{key}>"
                else:
                    replace_dynamic(obj[key])
        elif isinstance(obj, list):
            for item in obj:
                replace_dynamic(item)
    replace_dynamic(result)
    return result
```

## Snapshot Review Workflow

```markdown
## PR Review: Snapshot Changes

When a snapshot diff appears in a PR, the reviewer must:

1. Read the diff carefully — every added/removed/changed line
2. Verify the change is intentional (matches the PR description)
3. Check for unintended changes (extra fields, changed styling, removed content)
4. Approve only after confirming the new snapshot is correct

NEVER approve snapshot updates with "looks fine" without reading the diff.
A snapshot update that hides a bug is worse than no snapshot at all.

## Update command
UPDATE_SNAPSHOTS=1 pytest tests/api/test_snapshots.py  # Python
npx jest --updateSnapshot                               # Jest
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Auto-approving snapshot updates** | Bugs hidden behind "snapshot updated" | Every snapshot diff reviewed line by line |
| **Snapshots of dynamic data** | IDs/timestamps change every run → always fails | Normalise dynamic values before snapshotting |
| **One huge snapshot** | Any change anywhere breaks the test; hard to review | Small, focused snapshots per component or behaviour |
| **Too many snapshots** | Snapshot fatigue; updates approved without review | Snapshot stable output only; unit test logic |
| **No snapshot in version control** | Baseline lost; snapshots regenerated silently | Snapshot files committed to git |

## 10 Rules

1. Snapshots are in version control — always committed, never gitignored.
2. Dynamic values (IDs, timestamps, randomness) are normalised before snapshotting.
3. Snapshot diffs in PRs are reviewed with the same scrutiny as code diffs.
4. Small, focused snapshots are more useful than large ones — one per distinct behaviour.
5. A failing snapshot is investigated before being updated — it might be a bug.
6. Inline snapshots for small values — they're visible in the test and easy to review.
7. File snapshots for larger structures — stored in `/tests/snapshots/`.
8. Update snapshots deliberately with an explicit flag, not automatically.
9. Snapshot the stable output shape, not every property — brittle snapshots are ignored.
10. Snapshot testing complements unit tests — it catches unexpected changes; unit tests verify specific behaviour.

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

The canonical workflow for **Snapshot Testing** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Implement snapshot testing for UI components, API responses, and data structures. Outputs snapshot configuration, update workflow, review guidelines, and CI int
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
