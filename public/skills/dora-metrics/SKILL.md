---
name: dora-metrics
description: Implement DORA metrics to measure software delivery performance. Outputs metric definitions, data collection pipeline, dashboards, and improvement strategies for each performance tier.
argument-hint: [CI/CD tools, incident tracking system, deployment frequency, team size]
allowed-tools: Read, Write, Bash
---

# DORA Metrics

DORA (DevOps Research and Assessment) metrics measure software delivery performance across four dimensions: how often you deploy, how quickly you recover from failures, how often changes succeed, and how fast you deliver from commit to production. Together they indicate whether a team delivers reliably and quickly.

## The Four Metrics

```
DEPLOYMENT FREQUENCY
  What: How often production deployments happen
  Elite: Multiple times per day
  High: Once per day to once per week
  Medium: Once per week to once per month
  Low: Less than once per month

LEAD TIME FOR CHANGES
  What: Time from code commit to production
  Elite: <1 hour
  High: 1 day to 1 week
  Medium: 1 week to 1 month
  Low: 1–6 months

CHANGE FAILURE RATE
  What: % of deployments causing incidents/rollbacks
  Elite: 0–5%
  High: 5–10%
  Medium: 10–15%
  Low: 15–45%

MEAN TIME TO RECOVER (MTTR)
  What: Time to restore service after a failure
  Elite: <1 hour
  High: <1 day
  Medium: 1 day to 1 week
  Low: >1 week
```

## Data Collection

```python
# Collect DORA metrics from CI/CD and incident management systems

import requests
from datetime import datetime, timedelta
from dataclasses import dataclass

@dataclass
class DORAMetrics:
    period_start: datetime
    period_end: datetime
    deployment_frequency_per_day: float
    lead_time_hours_p50: float
    lead_time_hours_p90: float
    change_failure_rate_pct: float
    mttr_hours_p50: float
    performance_tier: str

class DORACollector:
    def __init__(self, github_token: str, pagerduty_token: str):
        self.gh_headers = {"Authorization": f"token {github_token}"}
        self.pd_headers = {"Authorization": f"Token token={pagerduty_token}"}
    
    def collect(self, repo: str, days: int = 30) -> DORAMetrics:
        since = datetime.utcnow() - timedelta(days=days)
        
        # Deployment frequency — from GitHub deployments or workflow runs
        deployments = self._get_deployments(repo, since)
        freq = len(deployments) / days
        
        # Lead time — time from first commit in PR to deployment
        lead_times = self._get_lead_times(repo, deployments)
        
        # Change failure rate — deployments that triggered an incident
        incidents = self._get_incidents(since)
        failed = sum(1 for d in deployments if self._caused_incident(d, incidents))
        cfr = (failed / len(deployments) * 100) if deployments else 0
        
        # MTTR — from incident_triggered to incident_resolved
        mttrs = [(i["resolved_at"] - i["triggered_at"]).total_seconds() / 3600
                 for i in incidents if i.get("resolved_at")]
        
        import statistics
        metrics = DORAMetrics(
            period_start=since,
            period_end=datetime.utcnow(),
            deployment_frequency_per_day=freq,
            lead_time_hours_p50=statistics.median(lead_times) if lead_times else 0,
            lead_time_hours_p90=sorted(lead_times)[int(len(lead_times)*0.9)] if lead_times else 0,
            change_failure_rate_pct=cfr,
            mttr_hours_p50=statistics.median(mttrs) if mttrs else 0,
            performance_tier=self._tier(freq, lead_times, cfr, mttrs),
        )
        return metrics
    
    def _tier(self, freq, lead_times, cfr, mttrs) -> str:
        lead_p50 = sorted(lead_times)[len(lead_times)//2] if lead_times else 999
        mttr_p50 = sorted(mttrs)[len(mttrs)//2] if mttrs else 999
        
        if freq >= 1 and lead_p50 <= 1 and cfr <= 5 and mttr_p50 <= 1:
            return "Elite"
        elif freq >= 1/7 and lead_p50 <= 168 and cfr <= 10 and mttr_p50 <= 24:
            return "High"
        elif freq >= 1/30 and lead_p50 <= 720 and cfr <= 15 and mttr_p50 <= 168:
            return "Medium"
        return "Low"
```

## SQL Queries for DORA

```sql
-- Deployment frequency (from CI/CD events table)
SELECT
    DATE_TRUNC('week', deployed_at) AS week,
    COUNT(*) AS deployments,
    COUNT(*) / 7.0 AS deployments_per_day,
    ROUND(COUNT(*) / 7.0, 2) AS deployments_per_day_rounded
FROM deployments
WHERE environment = 'production'
  AND deployed_at >= NOW() - INTERVAL '90 days'
GROUP BY 1
ORDER BY 1;

-- Lead time (commit to production)
SELECT
    d.deployment_id,
    d.deployed_at,
    MIN(c.committed_at) AS first_commit_in_deploy,
    EXTRACT(EPOCH FROM (d.deployed_at - MIN(c.committed_at))) / 3600 AS lead_time_hours
FROM deployments d
JOIN deployment_commits dc ON d.deployment_id = dc.deployment_id
JOIN commits c ON dc.commit_sha = c.sha
WHERE d.environment = 'production'
  AND d.deployed_at >= NOW() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY lead_time_hours;

-- Change failure rate
SELECT
    COUNT(*) AS total_deployments,
    COUNT(i.incident_id) AS failed_deployments,
    ROUND(COUNT(i.incident_id) * 100.0 / COUNT(*), 1) AS cfr_pct
FROM deployments d
LEFT JOIN incidents i ON i.caused_by_deployment_id = d.deployment_id
WHERE d.environment = 'production'
  AND d.deployed_at >= NOW() - INTERVAL '30 days';

-- MTTR
SELECT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY mttr_hours) AS p50_hours,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY mttr_hours) AS p90_hours,
    AVG(mttr_hours) AS avg_hours
FROM (
    SELECT
        EXTRACT(EPOCH FROM (resolved_at - triggered_at)) / 3600 AS mttr_hours
    FROM incidents
    WHERE triggered_at >= NOW() - INTERVAL '30 days'
      AND resolved_at IS NOT NULL
) sub;
```

## Dashboard Metrics

```markdown
## DORA Weekly Dashboard — Week of 2024-03-11

### Performance Tier: HIGH ⚡

| Metric | Value | Tier | Target | Trend |
|--------|-------|------|--------|-------|
| Deployment Frequency | 2.3/day | Elite | ≥1/day | ↑ |
| Lead Time p50 | 4.2h | High | <1h | → |
| Lead Time p90 | 18.1h | High | <24h | ↓ improving |
| Change Failure Rate | 3.1% | Elite | <5% | → |
| MTTR p50 | 45min | Elite | <1h | ↑ |

### Actions
- Lead time bottleneck: 3h average in code review (p50) → implement review SLAs
- 1 incident this week attributed to deployment → investigate root cause
```

## Improvement Strategies

```markdown
## Improving Each Metric

### Low Deployment Frequency
- Root cause: large batches, long approval chains, manual steps
- Fix: Smaller PRs, automated testing gates, remove manual approval for low-risk changes
- Target: Deploy multiple times per day

### High Lead Time
- Root cause: long PR review wait, slow CI, manual testing, release trains
- Fix: Review SLAs (2h), parallel CI, feature flags for continuous deployment
- Target: Commit to production <1 day

### High Change Failure Rate
- Root cause: insufficient testing, poor observability, no canary
- Fix: Expand test coverage, canary releases, feature flags, better rollback
- Target: <5% of deployments cause incidents

### High MTTR
- Root cause: poor alerting, no runbooks, slow rollback
- Fix: SLO-based alerting, runbooks, one-click rollback, on-call training
- Target: <1 hour to restore
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Gaming deployment frequency** | Many tiny meaningless deployments | Count meaningful deployments; define what counts |
| **Excluding incidents from CFR** | Looks better on paper | Include all production incidents |
| **Measuring team vs team** | Competition, not learning | Compare team to their own historical trend |
| **Collecting data but not acting** | Metrics without improvement actions | Quarterly review with concrete action items |
| **Only measuring, not improving** | Metrics are the goal, not delivery quality | Metrics indicate health; fix root causes |

## 10 Rules

1. DORA measures outcomes, not activity — not story points, not lines of code.
2. Compare a team to their own history — not to other teams.
3. All four metrics matter — elite in one and low in another is not elite delivery.
4. Lead time starts at first commit, not PR creation — idle time between commits counts.
5. Change failure rate includes rollbacks and hotfixes — not just P1 incidents.
6. MTTR is measured from incident detection, not from customer report.
7. Gaming metrics (tiny deployments, hiding incidents) is worse than honest low performance.
8. Quarterly improvement targets for each metric — metrics without targets produce no improvement.
9. Dashboard is visible to everyone including leadership — not hidden in an engineering tool.
10. The goal is continuous delivery of value, not high DORA scores — the scores indicate whether you're on track.
