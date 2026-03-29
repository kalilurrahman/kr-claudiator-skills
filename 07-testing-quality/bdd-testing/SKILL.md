---
name: bdd-testing
description: Implement Behaviour-Driven Development with Gherkin scenarios, step definitions, and living documentation. Outputs feature files, step definitions, scenario organisation, and CI integration.
argument-hint: [language/framework, team structure, existing test coverage, stakeholder involvement]
allowed-tools: Read, Write, Bash
---

# BDD Testing (Behaviour-Driven Development)

BDD bridges the gap between business stakeholders and technical teams by expressing tests in plain language. Gherkin scenarios are executable specifications — they serve as documentation, acceptance criteria, and automated tests simultaneously. The value is alignment, not just test automation.

## Process

1. **Three amigos.** PM, developer, and tester write scenarios together before development. This surfaces ambiguity early.
2. **Write Gherkin scenarios.** Given-When-Then format describing behaviour from the user's perspective.
3. **Implement step definitions.** Map each Gherkin step to code.
4. **Run scenarios as tests.** Scenarios drive development (TDD-style) and serve as regression tests.
5. **Maintain living documentation.** Scenarios stay current with the product.

## Gherkin Feature Files

```gherkin
# features/checkout.feature

Feature: Order Checkout
  As a customer
  I want to complete my purchase
  So that I receive the items I want

  Background:
    Given I am a logged-in customer
    And my cart contains 2 items totalling $59.98

  Scenario: Successful checkout with valid payment
    When I proceed to checkout
    And I enter valid shipping address "123 Main St, Springfield"
    And I enter valid credit card ending in "4242"
    Then my order should be confirmed
    And I should receive a confirmation email
    And my cart should be empty

  Scenario: Checkout fails with declined card
    When I proceed to checkout
    And I enter valid shipping address "123 Main St, Springfield"
    And I enter declined card ending in "0002"
    Then I should see error "Your card was declined"
    And my cart should remain unchanged
    And no order should be created

  Scenario Outline: Minimum order validation
    Given my cart total is <cart_total>
    When I proceed to checkout
    Then I should <outcome>

    Examples:
      | cart_total | outcome                           |
      | $0.00      | see error "Cart is empty"         |
      | $4.99      | see error "Minimum order is $5"   |
      | $5.00      | be able to proceed                |
      | $500.00    | be able to proceed                |
```

## Step Definitions (Python / pytest-bdd)

```python
# tests/bdd/steps/checkout_steps.py
from pytest_bdd import given, when, then, parsers
import pytest

@pytest.fixture
def context():
    return {}

@given("I am a logged-in customer")
def logged_in_customer(context, api_client):
    token = api_client.login("test@example.com", "password")
    context["auth_headers"] = {"Authorization": f"Bearer {token}"}

@given(parsers.parse("my cart contains {count:d} items totalling {total}"))
def cart_with_items(context, count, total, api_client):
    context["cart_id"] = api_client.create_test_cart(
        headers=context["auth_headers"],
        item_count=count
    )

@when("I proceed to checkout")
def proceed_to_checkout(context, api_client):
    context["checkout_response"] = api_client.post(
        "/api/v1/checkout/start",
        headers=context["auth_headers"],
        json={"cart_id": context["cart_id"]}
    )

@when(parsers.parse('I enter valid credit card ending in "{last4}"'))
def enter_valid_card(context, last4, api_client):
    context["payment_response"] = api_client.post(
        "/api/v1/checkout/payment",
        headers=context["auth_headers"],
        json={"card_token": f"tok_{last4}", "checkout_id": context["checkout_id"]}
    )

@then("my order should be confirmed")
def order_confirmed(context):
    assert context["payment_response"].status_code == 201
    order = context["payment_response"].json()
    assert order["status"] == "confirmed"
    context["order_id"] = order["order_id"]

@then("I should receive a confirmation email")
def confirmation_email_sent(context, email_service):
    emails = email_service.get_sent_emails(to=context["customer_email"])
    assert any("Order Confirmed" in e["subject"] for e in emails)

@then(parsers.parse("I should see error {message}"))
def see_error(context, message):
    response = context.get("payment_response") or context.get("checkout_response")
    assert response.status_code in [400, 422]
    assert message.strip('"') in response.json().get("message", "")
```

## Step Definitions (JavaScript / Cucumber)

```javascript
// features/step_definitions/checkout.steps.js
const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

Given('I am a logged-in customer', async function() {
  await this.page.goto('/login');
  await this.page.fill('[data-testid=email]', 'test@example.com');
  await this.page.fill('[data-testid=password]', 'password');
  await this.page.click('[data-testid=login-btn]');
  await expect(this.page).toHaveURL('/dashboard');
});

When('I proceed to checkout', async function() {
  await this.page.click('[data-testid=checkout-btn]');
  await expect(this.page).toHaveURL('/checkout');
});

Then('my order should be confirmed', async function() {
  await expect(this.page.locator('[data-testid=order-confirmed]')).toBeVisible();
  this.orderId = await this.page.locator('[data-testid=order-id]').textContent();
});
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **BDD without three amigos** | Scenarios written by developers only; miss business perspective | PM + dev + tester write scenarios together |
| **UI-only BDD scenarios** | Brittle, slow, expensive to maintain | Prefer API-level steps; use UI only for user-visible behaviour |
| **Overly detailed steps** | `Given I click the blue button in the top-right corner` | Behaviour, not implementation: `Given I start a new order` |
| **One scenario per edge case** | 200 scenarios covering the same flow | Scenario outlines for data variations; separate scenarios for behaviour variations |
| **Scenarios not maintained** | Living documentation becomes stale | Scenarios run in CI; failing scenarios block merge |

## 10 Rules

1. Three amigos write scenarios before development — not after.
2. Scenarios describe behaviour from the user's perspective — not implementation details.
3. Each scenario tests one behaviour — not a full user journey.
4. Scenario outlines handle data variations — separate scenarios handle different behaviours.
5. Steps are reusable across scenarios — avoid duplicating step logic.
6. Background sets up shared preconditions — not all the context for each scenario.
7. Scenarios run in CI and block merge on failure — they are tests, not documentation.
8. Step definitions are thin — they delegate to existing test infrastructure.
9. Avoid UI automation for BDD where API calls are sufficient — it's faster and more stable.
10. The feature file is the specification — if it's not in Gherkin, it's not specified.
