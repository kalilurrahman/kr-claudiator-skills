---
name: mobile-testing
description: Build comprehensive mobile testing strategies for iOS and Android apps. Outputs test pyramid, device coverage matrix, Appium/XCUITest patterns, performance testing, and CI integration.
argument-hint: [platform, team size, app complexity, device coverage requirements, CI system]
allowed-tools: Read, Write, Bash
---

# Mobile Testing

Mobile testing has unique challenges: device fragmentation (thousands of device/OS combinations), hardware sensors (camera, GPS, biometrics), network conditions, and battery state. A good mobile test strategy balances coverage against cost using a tiered approach.

## Mobile Test Pyramid

```
                ┌──────────────────┐
                │   Manual / ET    │  Exploratory; usability
                └──────────────────┘
              ┌────────────────────────┐
              │    UI/E2E Tests        │  Appium / XCUITest / Espresso
              └────────────────────────┘
            ┌──────────────────────────────┐
            │   Integration Tests          │  API contracts; real device optional
            └──────────────────────────────┘
          ┌────────────────────────────────────┐
          │   Unit Tests                       │  Business logic; no device needed
          └────────────────────────────────────┘
```

## Device Coverage Matrix

```markdown
## Priority Matrix for Test Execution

TIER 1 — Run on every PR (emulator/simulator)
  - Latest iOS (physical simulator)
  - Latest Android (emulator)
  - Your highest-traffic device/OS combination

TIER 2 — Run on merge to main (real devices via BrowserStack/Sauce Labs)
  - iOS N-1 (previous major version)
  - Android API 33, 34
  - Top 3 device models by user analytics

TIER 3 — Run weekly (broad coverage)
  - iOS N-2
  - Android API 31, 32
  - Tablet form factor
  - Low-end device (4GB RAM, older GPU)

TIER 4 — Manual / ad-hoc
  - Edge cases; new device releases
  - Accessibility testing (VoiceOver, TalkBack)
```

## Appium Tests (Cross-Platform)

```python
from appium import webdriver
from appium.webdriver.common.appiumby import AppiumBy
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import pytest

@pytest.fixture
def driver():
    caps = {
        "platformName": "iOS",
        "appium:platformVersion": "17.0",
        "appium:deviceName": "iPhone 15 Pro",
        "appium:app": "/path/to/MyApp.app",
        "appium:automationName": "XCUITest",
        "appium:newCommandTimeout": 60,
    }
    driver = webdriver.Remote("http://localhost:4723", caps)
    yield driver
    driver.quit()

def test_user_can_complete_checkout(driver):
    wait = WebDriverWait(driver, 10)

    # Tap product
    product = wait.until(EC.element_to_be_clickable(
        (AppiumBy.ACCESSIBILITY_ID, "product-widget-1")
    ))
    product.tap()

    # Add to cart
    add_btn = wait.until(EC.element_to_be_clickable(
        (AppiumBy.ACCESSIBILITY_ID, "add-to-cart-button")
    ))
    add_btn.tap()

    # Verify cart badge updated
    badge = wait.until(EC.visibility_of_element_located(
        (AppiumBy.ACCESSIBILITY_ID, "cart-badge")
    ))
    assert badge.text == "1"

    # Checkout
    driver.find_element(AppiumBy.ACCESSIBILITY_ID, "checkout-button").tap()

    # Confirm order placed
    success = wait.until(EC.visibility_of_element_located(
        (AppiumBy.ACCESSIBILITY_ID, "order-confirmation")
    ))
    assert success.is_displayed()
```

## XCUITest (iOS Native — Faster)

```swift
// OrderCheckoutTests.swift
import XCTest

final class OrderCheckoutTests: XCTestCase {
    let app = XCUIApplication()

    override func setUpWithError() throws {
        continueAfterFailure = false
        app.launchArguments = ["--uitesting", "--reset-state"]
        app.launch()
    }

    func testCheckoutFlow() throws {
        // Navigate to products
        app.tabBars.buttons["Shop"].tap()

        // Select first product
        let product = app.cells.firstMatch
        XCTAssertTrue(product.waitForExistence(timeout: 5))
        product.tap()

        // Add to cart
        app.buttons["Add to Cart"].tap()

        // Verify cart count
        let cartBadge = app.tabBars.buttons["Cart"].value as? String
        XCTAssertEqual(cartBadge, "1 item")

        // Complete checkout
        app.tabBars.buttons["Cart"].tap()
        app.buttons["Checkout"].tap()
        app.buttons["Place Order"].tap()

        // Verify success
        XCTAssertTrue(
            app.staticTexts["Order Confirmed"].waitForExistence(timeout: 10),
            "Order confirmation not shown"
        )
    }
}
```

## Performance Testing

```python
# Measure key performance metrics on device
def test_app_launch_time(driver):
    """App must launch in under 3 seconds (cold start)."""
    import time

    # Force cold start by killing app
    driver.terminate_app("com.example.myapp")
    time.sleep(2)

    start = time.time()
    driver.activate_app("com.example.myapp")

    # Wait for home screen
    WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((AppiumBy.ACCESSIBILITY_ID, "home-screen"))
    )
    launch_time = time.time() - start

    assert launch_time < 3.0, f"App launch took {launch_time:.2f}s (max 3.0s)"

def test_scroll_performance(driver):
    """Product list must scroll smoothly (no jank)."""
    # Use driver.get_performance_data() for iOS/Android performance data
    perf = driver.get_performance_data("com.example.myapp", "cpuinfo", 5)
    cpu_values = [float(row[1]) for row in perf[1:] if row[1] != ""]
    avg_cpu = sum(cpu_values) / len(cpu_values) if cpu_values else 0
    assert avg_cpu < 30, f"High CPU during scroll: {avg_cpu:.1f}%"
```

## CI Integration

```yaml
# .github/workflows/mobile-tests.yml
- name: Run unit tests (no device)
  run: |
    cd ios && xcodebuild test       -scheme MyApp       -destination 'platform=iOS Simulator,name=iPhone 15 Pro'
  timeout-minutes: 10

- name: Run UI tests on simulator (PR gate)
  run: |
    cd ios && xcodebuild test       -scheme MyAppUITests       -destination 'platform=iOS Simulator,name=iPhone 15 Pro'
  timeout-minutes: 20

- name: Run on real devices (merge to main)
  if: github.ref == 'refs/heads/main'
  run: |
    pytest tests/mobile/e2e/       --device-farm BrowserStack       --platforms "iOS 17.0:iPhone 15 Pro,iOS 16.0:iPhone 14"
  timeout-minutes: 45
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Only real device testing** | Slow; expensive; not scalable | Simulators for unit/integration; real devices for E2E |
| **No performance testing** | App jank discovered by users | Measure launch time and scroll FPS in CI |
| **Testing on latest iOS only** | Users on older versions encounter bugs | Device matrix covering N-2 iOS versions |
| **No accessibility testing** | VoiceOver/TalkBack users can't use app | Dedicated accessibility test run |
| **Flaky E2E tests accepted** | CI noise; bugs hidden | Apply same flaky test management as web |

## 10 Rules

1. Unit tests run without a device — business logic has no hardware dependency.
2. Simulators for development; real devices for release validation.
3. Device matrix covers your top 3 devices by usage analytics.
4. Launch time and memory usage are measured metrics — not subjective observations.
5. Accessibility IDs on interactive elements — not XPath or coordinate-based taps.
6. UI tests use app.launchArguments to set test state — no production backend calls.
7. Mobile E2E tests run in parallel across devices — serial is too slow.
8. Performance regression detected in CI — launch time delta from baseline fails build.
9. Network condition simulation: test on 3G, airplane mode, flaky connection.
10. Real device testing via cloud farm (BrowserStack, Sauce Labs) — maintaining a device lab doesn't scale.
