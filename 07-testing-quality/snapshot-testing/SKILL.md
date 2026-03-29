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
