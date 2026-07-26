---
name: quality-metrics
description: Define and track software quality metrics for code health, test effectiveness, and production reliability. Outputs metric definitions, dashboards, thresholds, and improvement plans.
argument-hint: [team size, product type, current pain points, existing tooling]
allowed-tools: Read, Write
---

# Quality Metrics

Quality metrics make the abstract concept of "software quality" measurable and improvable. Without metrics, quality discussions are subjective. With the right metrics, teams can detect degradation early, prioritise improvement work, and demonstrate progress.

## Quality Dimensions and Metrics

```
1. CODE HEALTH          2. TEST EFFECTIVENESS    3. PRODUCTION RELIABILITY
   Code coverage           Pass rate                Defect escape rate
   Cyclomatic complexity   Test execution time      Mean time to detect (MTTD)
   Technical debt ratio    Flakiness rate           Mean time to resolve (MTTR)
   Duplicate code %        Coverage per risk area   SLO error budget burn
   Static analysis score   Mutation score           Rollback rate

4. DELIVERY QUALITY     5. SECURITY QUALITY
   Change failure rate     Critical vulnerabilities open
   Deployment frequency    Mean time to patch
   Lead time for changes   Dependency age
   MTTR (DORA metric)      Security debt score
```

## Core Metric Definitions

```markdown
# Quality Metrics Definitions v1.0

## Defect Escape Rate
**Definition:** % of bugs found in production vs total bugs found (prod + pre-prod)
**Formula:** Production bugs / (Production bugs + Pre-prod bugs) × 100
**Target:** <10% (most defects caught pre-production)
**Measurement:** Monthly; count from bug tracker

## Change Failure Rate (DORA)
**Definition:** % of deployments causing a production incident
**Formula:** Failed deployments / Total deployments × 100
**Target:** <5% (elite performers)
**Measurement:** Per deployment; automated from CD pipeline

## Mean Time to Recover (MTTR)
**Definition:** Average time from incident start to resolution
**Target:** <1 hour (elite), <24 hours (high performer)
**Measurement:** From incident management tool (PagerDuty, Jira)

## Test Pass Rate
**Definition:** % of automated test runs that pass (excluding skipped)
**Target:** >98% in CI pipeline
**Measurement:** Daily from CI system

## Flakiness Rate
**Definition:** % of test runs that produce inconsistent results
**Formula:** Tests with >1 result flip in 30 days / Total tests
**Target:** <1% of tests flaky
**Measurement:** From test history tracking

## Code Coverage
**Definition:** % of production code executed by automated tests
**Target:** >75% line coverage; >65% branch coverage
**Measurement:** Per PR from coverage tool (pytest-cov, Istanbul)

## Mutation Score
**Definition:** % of code mutations (bugs injected) caught by tests
**Target:** >60% mutation score
**Measurement:** Monthly (slow to compute)

## Critical Vulnerability Age
**Definition:** Average days a critical CVE remains open
**Target:** <7 days for Critical, <30 days for High
**Measurement:** From vulnerability scanning tool
```

## Metrics Collection Pipeline

```python
import requests
from datetime import datetime, timedelta
from dataclasses import dataclass

@dataclass
class QualitySnapshot:
    date: str
    test_pass_rate: float
    code_coverage: float
    flakiness_rate: float
    change_failure_rate: float
    mttr_hours: float
    defect_escape_rate: float
    open_critical_vulns: int

class QualityMetricsCollector:
    def __init__(self, jira_url, github_token, sonar_token):
        self.jira_url = jira_url
        self.gh_headers = {"Authorization": f"token {github_token}"}
        self.sonar_token = sonar_token
    
    def collect_test_metrics(self, repo: str, days: int = 7) -> dict:
        """Collect test pass rate and flakiness from GitHub Actions."""
        since = (datetime.utcnow() - timedelta(days=days)).isoformat() + "Z"
        
        runs = requests.get(
            f"https://api.github.com/repos/{repo}/actions/runs",
            headers=self.gh_headers,
            params={"created": f">{since}", "per_page": 100},
        ).json()
        
        total = len(runs.get("workflow_runs", []))
        if total == 0:
            return {"pass_rate": None, "total_runs": 0}
        
        passed = sum(1 for r in runs["workflow_runs"] if r["conclusion"] == "success")
        return {
            "pass_rate": passed / total,
            "total_runs": total,
            "failed_runs": total - passed,
        }
    
    def collect_code_coverage(self, project_key: str) -> dict:
        """Collect coverage from SonarQube."""
        response = requests.get(
            f"https://sonarcloud.io/api/measures/component",
            params={
                "component": project_key,
                "metricKeys": "coverage,branch_coverage,duplicated_lines_density,"
                               "cognitive_complexity,sqale_debt_ratio",
            },
            auth=(self.sonar_token, ""),
        )
        measures = {m["metric"]: float(m["value"])
                   for m in response.json()["component"]["measures"]}
        return measures
    
    def collect_incident_metrics(self, days: int = 30) -> dict:
        """Calculate MTTR and change failure rate from incidents."""
        incidents = self._get_incidents(days)
        deployments = self._get_deployments(days)
        
        if not incidents:
            return {"mttr_hours": 0, "change_failure_rate": 0}
        
        mttr_values = [(i["resolved_at"] - i["created_at"]).seconds / 3600
                      for i in incidents if i.get("resolved_at")]
        
        failed_deploys = sum(1 for d in deployments if d.get("caused_incident"))
        
        return {
            "mttr_hours": sum(mttr_values) / len(mttr_values) if mttr_values else 0,
            "change_failure_rate": failed_deploys / len(deployments) if deployments else 0,
            "total_incidents": len(incidents),
        }
    
    def generate_snapshot(self, repo: str, project_key: str) -> QualitySnapshot:
        test_metrics = self.collect_test_metrics(repo)
        coverage = self.collect_code_coverage(project_key)
        incident = self.collect_incident_metrics()
        
        return QualitySnapshot(
            date=datetime.utcnow().strftime('%Y-%m-%d'),
            test_pass_rate=test_metrics.get("pass_rate", 0),
            code_coverage=coverage.get("coverage", 0) / 100,
            flakiness_rate=0,  # From separate flakiness tracker
            change_failure_rate=incident.get("change_failure_rate", 0),
            mttr_hours=incident.get("mttr_hours", 0),
            defect_escape_rate=0,  # From bug tracker
            open_critical_vulns=0,  # From vulnerability scanner
        )
```

## Quality Dashboard Template

```markdown
# Engineering Quality Dashboard — Week of 2024-03-11

## Summary: 🟡 FAIR (3 metrics below target)

### Production Reliability
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Change failure rate | 3.2% | <5% | 🟢 |
| MTTR | 47min | <60min | 🟢 |
| SLO availability | 99.94% | 99.9% | 🟢 |
| Defect escape rate | 14% | <10% | 🔴 |

### Test Quality
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| CI pass rate | 97.1% | >98% | 🟡 |
| Code coverage | 74% | >75% | 🟡 |
| Flaky tests | 4 | 0 | 🔴 |
| P99 test suite (PR) | 9.1min | <10min | 🟢 |

### Code Health
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Technical debt ratio | 2.1% | <3% | 🟢 |
| Duplicate code | 4.2% | <5% | 🟢 |
| Critical vulnerabilities | 0 | 0 | 🟢 |
| High vulnerabilities open >7d | 2 | 0 | 🔴 |

### Actions This Week
1. Fix 4 quarantined flaky tests (owner: @qa-lead, due: Fri)
2. Investigate defect escape spike (root cause review scheduled)
3. Patch 2 high CVEs in payment-service dependency (owner: @security, due: Wed)
```

## Improvement Plan

```markdown
# Quality Improvement Plan — Q2 2024

## Problem: High defect escape rate (14% vs 10% target)

Root cause analysis:
- Payment flow lacks integration tests (only unit tests)
- New features merged without corresponding test updates
- Regression suite doesn't cover mobile browsers

Actions:
1. Add payment integration test suite — target: 20 tests by end of sprint 2
   Owner: @backend-team | Due: April 30
2. PR policy: no merge without test for any bug fix
   Owner: @engineering-leads | Due: April 1 (policy change)  
3. Add mobile browser to regression matrix
   Owner: @qa-team | Due: May 15

Success criteria: Defect escape rate < 10% for 4 consecutive weeks

## Problem: 4 flaky tests

Current flaky tests:
- test_payment_webhook_timeout (flakiness: 23%)
- test_email_delivery_async (flakiness: 18%)
- test_search_after_bulk_insert (flakiness: 11%)
- test_session_expiry_concurrent (flakiness: 8%)

Fix plan:
- test_payment_webhook_timeout: Add proper async wait; not a timing hack
- test_email_delivery_async: Mock email service; don't depend on real SMTP
- test_search_after_bulk_insert: Add explicit index refresh
- test_session_expiry_concurrent: Fix race condition in test setup

All due: Sprint 2 end (April 19)
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Coverage as the only metric** | High coverage with bad tests; low-quality safety net | Include mutation score, defect escape rate |
| **Vanity metrics** | Lines of code, test count — easy to game | Outcome metrics: defect escape, MTTR, CFR |
| **No baseline** | Can't tell if metrics are improving | Record baseline on week 1; track weekly |
| **Metric without owner** | Nobody acts on declining metrics | Every metric has an owner and improvement SLA |
| **Too many metrics** | Dashboard paralysis; no focus | 5-7 primary metrics; more in drilldowns |
| **Measuring without acting** | Data collected but never drives decisions | Monthly quality review with improvement items |
| **Gaming metrics** | Coverage % gamed with trivial tests | Audit test quality; use mutation testing |

## 10 Rules

1. Outcome metrics (defect escape rate, MTTR, CFR) matter more than activity metrics (test count, coverage %).
2. Every metric has a target — "we track it" without a threshold is just data collection.
3. Every metric has an owner — declining metrics without owners stay declined.
4. Baseline before improving — you need week 1 data to show week 12 progress.
5. Five focused metrics beat twenty tracked-but-ignored metrics.
6. Flaky tests are a quality metric — track and target zero flakiness.
7. Review quality metrics monthly with the team — data without discussion drives no change.
8. Security metrics (CVE age, open vulns) belong in the quality dashboard — not a separate silo.
9. Improvement plans have deadlines — "eventually" means never.
10. Celebrate improvements — quality metrics are often invisible to stakeholders; make wins visible.
