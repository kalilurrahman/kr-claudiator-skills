---
name: golden-path-testing
description: Design golden path tests that validate critical user journeys end-to-end. Outputs journey mapping, test scope decisions, data strategy, and reliability patterns.
argument-hint: [critical user journeys, tech stack, test framework, environment access]
allowed-tools: Read, Write
---

# Golden Path Testing

Golden path tests validate the most critical user journeys — the paths that must work for the business to function. Unlike comprehensive E2E tests, golden path tests are intentionally narrow: they cover the core happy paths that, if broken, cause immediate revenue or user impact. They run frequently and must be highly reliable.

## Identifying Golden Paths

```markdown
## Selection Criteria

A journey qualifies as a golden path if:
1. It generates significant revenue or drives core business value
2. Breaking it would cause immediate user-visible impact
3. It is frequently used (top N% by volume)
4. Its failure would require P1 incident response

## Example Golden Paths by Product Type

E-commerce:
  ✓ Search → Product Page → Add to Cart → Checkout → Order Confirmation
  ✓ Login → View Order History → Track Order
  ✗ Browse related products (nice to have, not revenue-critical)

SaaS:
  ✓ Sign Up → First Workspace → Create First Project → Invite Teammate
  ✓ Login → Create Report → Export → Share
  ✗ Customise profile photo (not revenue-critical)

Banking:
  ✓ Login (with MFA) → Check Balance → Transfer Funds
  ✓ Login → Pay Bill → Confirm Payment
  ✗ Download 2-year statement (infrequent; not critical)
```

## Golden Path Test Design

```python
import pytest
from playwright.sync_api import Page, expect

class TestCheckoutGoldenPath:
    """The single most critical user journey — must always pass."""

    @pytest.fixture(autouse=True)
    def setup(self, page: Page, base_url: str):
        self.page = page
        self.base_url = base_url

    def test_complete_purchase_flow(self):
        """
        Golden Path: Guest checkout — product to order confirmation.
        If this fails, revenue generation is impaired.
        SLA: Must pass 99.9% of runs (max 1 failure per 1000).
        """
        page = self.page

        # Step 1: Search for product
        page.goto(f"{self.base_url}/")
        page.fill('[data-testid="search-input"]', "blue widget")
        page.press('[data-testid="search-input"]', "Enter")
        expect(page.locator('[data-testid="product-card"]').first).to_be_visible(timeout=5000)

        # Step 2: View product
        page.locator('[data-testid="product-card"]').first.click()
        expect(page.locator('[data-testid="product-title"]')).to_be_visible()
        expect(page.locator('[data-testid="price"]')).to_contain_text("$")

        # Step 3: Add to cart
        page.click('[data-testid="add-to-cart"]')
        expect(page.locator('[data-testid="cart-count"]')).to_have_text("1")

        # Step 4: Checkout
        page.click('[data-testid="checkout-btn"]')
        page.fill('[data-testid="email"]', "test@goldenpath.invalid")
        page.fill('[data-testid="card-number"]', "4242424242424242")
        page.fill('[data-testid="card-expiry"]', "12/28")
        page.fill('[data-testid="card-cvc"]', "123")
        page.click('[data-testid="place-order"]')

        # Step 5: Confirm success
        expect(page.locator('[data-testid="order-confirmed"]')).to_be_visible(timeout=15000)
        order_id = page.locator('[data-testid="order-id"]').text_content()
        assert order_id, "Order ID not displayed"
```

## Golden Path Reliability Requirements

```python
# Golden path tests must be held to higher reliability standards
# than regular E2E tests — they must almost never fail due to test issues

# Reliability patterns:
class ReliableStep:
    MAX_RETRIES = 3
    RETRY_DELAY_MS = 500

    @staticmethod
    def click_with_retry(page, selector: str):
        """Retry click for transient DOM timing issues."""
        for attempt in range(ReliableStep.MAX_RETRIES):
            try:
                page.locator(selector).click(timeout=5000)
                return
            except Exception as e:
                if attempt == ReliableStep.MAX_RETRIES - 1:
                    raise
                page.wait_for_timeout(ReliableStep.RETRY_DELAY_MS)

    @staticmethod
    def fill_with_retry(page, selector: str, value: str):
        page.locator(selector).fill("")  # Clear first
        page.locator(selector).fill(value)
        # Verify the value was entered correctly
        actual = page.locator(selector).input_value()
        assert actual == value, f"Failed to fill {selector}: expected {value!r}, got {actual!r}"
```

## Data Strategy for Golden Path Tests

```markdown
## Test Data Approaches

APPROACH 1: Dedicated Test Accounts
  Pros: Stable; no interference with real users
  Cons: Test data accumulates; accounts may expire
  Pattern:
    - Pre-created accounts: test-golden-path@company.com
    - Reset state before each run via API
    - Separate test product catalog (real prices, fake inventory)

APPROACH 2: Generated Data per Run
  Pros: No state accumulation; fully isolated
  Cons: Slower; more setup
  Pattern:
    - Create test user via API (not UI)
    - Use `testuser+<uuid>@company.com` email pattern
    - Clean up after test (or let TTL expire)

APPROACH 3: Fixture Data (Recommended for Speed)
  Pros: Fast; predictable
  Cons: Must maintain fixture state
  Pattern:
    - Database seed applied before test run
    - Test uses known fixture IDs
    - Transaction rollback after test

## What NOT to Use
  - Production user accounts (GDPR, data contamination)
  - Real payment credentials (use test card numbers: 4242 4242 4242 4242)
  - Real email addresses (use `@goldenpath.invalid` domain)
```

## CI Configuration for Golden Paths

```yaml
# Golden path tests: run frequently, fast feedback
- name: Golden Path Tests
  run: pytest tests/golden_path/ -v --timeout=60
  env:
    BASE_URL: https://staging.example.com
    HEADLESS: "true"
  # Run on every merge to main AND every 15 minutes in production (synthetic monitoring)

# Alert when golden path fails
- name: Alert on failure
  if: failure()
  run: |
    curl -X POST $SLACK_WEBHOOK_URL       -d '{"text": "GOLDEN PATH FAILURE on ${{ github.ref }}: ${{ github.run_url }}"}'
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Too many golden paths** | Suite becomes slow; flaky | Max 5-10 golden paths per product area |
| **Testing edge cases in golden path** | Slow; defeats the purpose | Golden path = happy path only |
| **No SLA for golden path reliability** | Flakiness tolerated | <0.1% failure rate from test issues required |
| **Production data in tests** | GDPR; data contamination | Dedicated test accounts or synthetic data |
| **Only running on PR** | Production can degrade between PRs | Run on schedule (every 15 min) as synthetic monitoring |

## 10 Rules

1. Golden paths cover the 5-10 journeys that, if broken, cause immediate revenue or user impact.
2. Golden path tests are always happy path — no edge cases, no error conditions.
3. Reliability SLA is stricter than regular E2E: <0.1% failure rate from test infrastructure.
4. Golden path tests run on every merge to main AND on a schedule in production.
5. Failures alert immediately — not as a daily digest.
6. Test data is isolated: dedicated test accounts, test payment credentials, synthetic emails.
7. Each test is independent — no shared state or ordering dependencies.
8. Golden path scope is deliberately narrow — resist adding assertions "while we're there."
9. Execution time matters: each golden path test under 60 seconds.
10. Golden path failures are P1 until proven to be test infrastructure issues.

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

The canonical workflow for **Golden Path Testing** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Design golden path tests that validate critical user journeys end-to-end. Outputs journey mapping, test scope decisions, data strategy, and reliability patterns
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
