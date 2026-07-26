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

The canonical workflow for **Bdd Testing** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Implement Behaviour-Driven Development with Gherkin scenarios, step definitions, and living documentation. Outputs feature files, step definitions, scenario org
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
