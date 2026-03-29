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
