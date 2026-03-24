---
name: synthetic-monitoring
description: Implement synthetic monitoring to proactively detect production issues. Outputs probe scripts, alert configurations, SLA dashboards, and incident escalation rules.
argument-hint: [critical user journeys, SLA targets, global regions, alerting tools]
allowed-tools: Read, Write
---

# Synthetic Monitoring

Synthetic monitoring runs scripted user journeys against production continuously, detecting outages and degradation before real users report them. Unlike real-user monitoring (RUM), synthetics run 24/7 from controlled locations and catch issues in low-traffic periods.

## Process

1. **Identify critical user journeys.** Login, checkout, search, key API calls. Prioritise by revenue impact.
2. **Write probe scripts.** Simulate the journey step-by-step. Assert each step succeeds.
3. **Deploy from multiple regions.** Detect regional outages and CDN issues.
4. **Set SLA thresholds.** p99 latency targets and availability targets per journey.
5. **Configure escalation.** Alert immediately on failure; page on repeated failures.
6. **Build dashboards.** Uptime, latency trends, pass/fail history by region.
7. **Maintain probes.** Update when UI or API changes; dead probes create false confidence.

## Playwright Synthetic Check

```python
# synthetics/checkout_flow.py
# Runs every 5 minutes from US-East, EU-West, AP-Southeast

from playwright.sync_api import sync_playwright, expect
import time
import json
from dataclasses import dataclass
from datetime import datetime

@dataclass
class ProbeResult:
    probe_name: str
    success: bool
    duration_ms: int
    error: str = None
    steps: dict = None

def run_checkout_probe(base_url: str) -> ProbeResult:
    steps = {}
    start = time.time()
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 720},
            user_agent="SyntheticMonitor/1.0",
        )
        page = context.new_page()
        
        try:
            # Step 1: Load homepage
            t = time.time()
            page.goto(base_url, timeout=10000)
            expect(page).to_have_title("Example Store")
            steps["homepage_load_ms"] = int((time.time() - t) * 1000)
            
            # Step 2: Search for product
            t = time.time()
            page.fill('[data-testid="search-input"]', "blue widget")
            page.press('[data-testid="search-input"]', "Enter")
            page.wait_for_selector('[data-testid="product-card"]', timeout=5000)
            steps["search_ms"] = int((time.time() - t) * 1000)
            
            # Step 3: Add to cart
            t = time.time()
            page.click('[data-testid="product-card"]:first-child [data-testid="add-to-cart"]')
            expect(page.locator('[data-testid="cart-count"]')).to_have_text("1")
            steps["add_to_cart_ms"] = int((time.time() - t) * 1000)
            
            # Step 4: Checkout page loads
            t = time.time()
            page.click('[data-testid="checkout-button"]')
            page.wait_for_url("**/checkout", timeout=5000)
            expect(page.locator('[data-testid="order-summary"]')).to_be_visible()
            steps["checkout_load_ms"] = int((time.time() - t) * 1000)
            
            total_ms = int((time.time() - start) * 1000)
            return ProbeResult(
                probe_name="checkout_flow",
                success=True,
                duration_ms=total_ms,
                steps=steps,
            )
        
        except Exception as e:
            return ProbeResult(
                probe_name="checkout_flow",
                success=False,
                duration_ms=int((time.time() - start) * 1000),
                error=str(e),
                steps=steps,
            )
        finally:
            browser.close()
```

## API Health Probes

```python
# synthetics/api_probes.py
import httpx
import time
from typing import Optional

class APIProbe:
    def __init__(self, base_url: str, timeout: float = 5.0):
        self.base_url = base_url
        self.client = httpx.Client(timeout=timeout, follow_redirects=True)
    
    def probe_health(self) -> dict:
        start = time.time()
        response = self.client.get(f"{self.base_url}/health")
        latency = int((time.time() - start) * 1000)
        
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        body = response.json()
        assert body.get("status") == "healthy", f"Unhealthy: {body}"
        assert body.get("db") == "ok", f"DB unhealthy: {body}"
        assert body.get("cache") == "ok", f"Cache unhealthy: {body}"
        
        return {"probe": "health", "latency_ms": latency, "success": True}
    
    def probe_critical_api(self, auth_token: str) -> dict:
        """Test the most critical API endpoint with authentication."""
        start = time.time()
        response = self.client.get(
            f"{self.base_url}/api/v1/products",
            headers={"Authorization": f"Bearer {auth_token}"},
            params={"page_size": 1},
        )
        latency = int((time.time() - start) * 1000)
        
        assert response.status_code == 200
        body = response.json()
        assert "items" in body
        assert len(body["items"]) > 0, "No products returned — possible data issue"
        
        return {"probe": "products_api", "latency_ms": latency, "success": True}
    
    def probe_payment_gateway(self) -> dict:
        """Check payment gateway connectivity (dry run — no actual charge)."""
        start = time.time()
        response = self.client.post(
            f"{self.base_url}/api/v1/payments/ping",
            headers={"X-Synthetic": "true"},  # Backend skips actual charge
        )
        latency = int((time.time() - start) * 1000)
        
        assert response.status_code == 200
        return {"probe": "payment_gateway", "latency_ms": latency, "success": True}
```

## Datadog Synthetic Tests (Terraform)

```hcl
# Terraform — Datadog synthetic tests
resource "datadog_synthetics_test" "api_health" {
  name    = "API Health Check"
  type    = "api"
  subtype = "http"
  status  = "live"

  request_definition {
    method = "GET"
    url    = "https://api.example.com/health"
  }

  assertion {
    type     = "statusCode"
    operator = "is"
    target   = "200"
  }

  assertion {
    type     = "responseTime"
    operator = "lessThan"
    target   = "1000"  # ms
  }

  assertion {
    type        = "body"
    operator    = "validatesJSONPath"
    targetjsonpath {
      jsonpath    = "$.status"
      operator    = "is"
      targetvalue = "healthy"
    }
  }

  locations = ["aws:us-east-1", "aws:eu-west-1", "aws:ap-southeast-1"]

  options_list {
    tick_every = 60  # Run every 60 seconds

    retry {
      count    = 2
      interval = 300  # ms between retries
    }

    monitor_options {
      renotify_interval = 120  # Re-alert every 2 hours if still failing
    }
  }
}

resource "datadog_synthetics_test" "checkout_browser" {
  name    = "Checkout Flow (Browser)"
  type    = "browser"
  status  = "live"

  request_definition {
    method = "GET"
    url    = "https://www.example.com"
  }

  locations  = ["aws:us-east-1", "aws:eu-west-1"]
  device_ids = ["laptop_large", "mobile_small"]

  options_list {
    tick_every = 300  # Every 5 minutes
  }
}

# Alert: immediate on any failure
resource "datadog_monitor" "synthetic_critical" {
  name  = "Synthetic: Critical Journey Failing"
  type  = "synthetics alert"
  query = "avg(last_5m):avg:synthetics.http.response.time{test_id:${datadog_synthetics_test.api_health.id}} > 2000 OR min(last_2m):min:synthetics.http.uptime{test_id:${datadog_synthetics_test.api_health.id}} < 1"

  message = <<-EOT
    {{#is_alert}}
    CRITICAL: Synthetic check failing in {{location.name}}
    Check: {{synthetics.test_name}}
    Error: {{synthetics.error_message}}
    Runbook: https://wiki.example.com/runbooks/synthetic-failures
    @pagerduty-production
    {{/is_alert}}
  EOT

  thresholds = { critical = 1 }
  notify_no_data    = true
  no_data_timeframe = 10
}
```

## SLA Dashboard Metrics

```python
# Key metrics to track per synthetic probe:
# - Uptime % (99.9% = 43.8min/month allowed downtime)
# - p50, p95, p99 response time by region
# - Pass/fail rate over time
# - MTTR (mean time to recovery) after failure
# - False positive rate (probe failures due to probe bugs, not real outages)

# Uptime calculation
def calculate_uptime(results: list, window_hours: int = 24 * 30) -> float:
    total = len(results)
    successful = sum(1 for r in results if r["success"])
    return successful / total if total > 0 else 0.0

# SLA reporting
SLA_TARGETS = {
    "checkout_flow":    0.999,   # 99.9%
    "api_health":       0.9999,  # 99.99%
    "payment_gateway":  0.999,
    "search":           0.998,
}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Only testing health endpoint** | Complex flows fail while /health returns 200 | Test full user journeys, not just ping |
| **Single region probe** | Regional CDN/DNS issue invisible | Probe from 3+ regions on different continents |
| **No probe maintenance** | Probes fail silently when UI changes | Review probes on every major UI/API change |
| **Alerting on first failure** | Transient network issues cause false pages | Alert after 2+ consecutive failures |
| **Synthetic user creates real data** | Production contaminated with test orders | Use `X-Synthetic: true` header; clean up or use test accounts |
| **No escalation path** | Alert fires, nobody pages | Clear escalation: alert → Slack → PagerDuty |
| **Probes from single provider** | Provider outage = all probes fail (false alarm) | Use 2+ synthetic providers or cloud regions |

## 10 Rules

1. Probe critical user journeys, not just health endpoints — /health returning 200 while checkout is broken is the most common synthetic failure pattern.
2. Run probes from 3+ global regions — regional CDN and DNS failures are invisible from a single region.
3. Alert after 2 consecutive failures, not the first — transient network hiccups cause false alerts.
4. Synthetic users must not pollute production data — use test accounts and flag requests with a header.
5. Probe latency thresholds are derived from SLAs, not guesses — if SLA is 99th percentile <2s, probe at 2s.
6. Review and update probes on every major deploy — dead probes create false confidence.
7. Separate escalation paths for critical (immediate page) and non-critical (Slack alert) journeys.
8. Track MTTR from synthetic alert to resolution — it measures real incident response effectiveness.
9. Run probes continuously in production — not just when you remember to check.
10. Include a baseline comparison: today's p95 vs 7-day rolling p95 — performance degradation is as important as outages.
