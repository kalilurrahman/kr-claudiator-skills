---
name: security-metrics
description: Define and track security programme metrics to measure effectiveness and communicate risk. Outputs KPI definitions, measurement methodology, dashboard design, and reporting cadence.
argument-hint: [security programme maturity, audience, compliance requirements, available tooling]
allowed-tools: Read, Write
---

# Security Metrics

Security metrics make the invisible visible — they turn security activities into data that leadership can act on and compare over time. The challenge is measuring outcomes (are we more secure?) not just activities (how many patches did we apply?).

## Metrics Framework

```markdown
## Tier 1: Operational Metrics (daily/weekly)
These tell you if security controls are functioning.

| Metric | Target | Measurement |
|--------|--------|-------------|
| Mean time to patch (Critical CVE) | <24 hours | Vuln scanner → patch timestamp |
| Mean time to patch (High CVE) | <7 days | Vuln scanner → patch timestamp |
| Critical CVEs unpatched >24h | 0 | Vuln scanner count |
| MFA adoption rate | 100% | IAM system |
| Certificate expiry warnings | 0 | Certificate monitoring |
| Failed login attempt rate | <5% | Auth system |

## Tier 2: Programme Metrics (monthly)
These tell you if the programme is improving.

| Metric | Target | Measurement |
|--------|--------|-------------|
| Security findings in prod (post-deploy) | <5% of total | Incident tagging |
| % code with SAST scan | >95% | CI/CD pipeline |
| Security champions coverage | 100% of teams | Programme tracking |
| Penetration test findings resolved | >90% in 90 days | Pentest tracker |
| Security debt backlog size | Declining | JIRA/tracker |

## Tier 3: Risk Metrics (quarterly)
These tell you what the residual risk profile looks like.

| Metric | Target | Measurement |
|--------|--------|-------------|
| CVSS severity distribution | Trend downward | Vuln scanner |
| Third-party risk coverage | >90% vendors assessed | Vendor risk programme |
| Incident severity distribution | More P3/P4, fewer P1/P2 | Incident management |
| Attack surface reduction | Quarterly decrease | Asset inventory |
```

## Metrics Collection

```python
import boto3
from datetime import datetime, timedelta
import json

class SecurityMetricsCollector:
    def collect_vulnerability_metrics(self) -> dict:
        """Collect from your vuln scanner (Qualys, Tenable, Snyk)."""
        # Example: AWS Inspector findings
        inspector = boto3.client("inspector2")
        
        findings = inspector.list_findings(
            filterCriteria={
                "severity": [{"comparison": "EQUALS", "value": "CRITICAL"}],
                "findingStatus": [{"comparison": "EQUALS", "value": "ACTIVE"}],
            }
        )["findings"]
        
        now = datetime.utcnow()
        critical_sla_breach = sum(
            1 for f in findings
            if (now - f["firstObservedAt"].replace(tzinfo=None)).total_seconds() > 86400
        )
        
        return {
            "critical_open": len(findings),
            "critical_sla_breach": critical_sla_breach,
            "critical_sla_compliance": f"{100 - 100*critical_sla_breach/max(len(findings),1):.1f}%"
        }
    
    def collect_mfa_metrics(self) -> dict:
        """Check MFA adoption across all users."""
        iam = boto3.client("iam")
        credential_report = self._get_credential_report(iam)
        
        total = len(credential_report)
        mfa_enabled = sum(1 for u in credential_report if u["mfa_active"] == "true")
        
        return {
            "total_users": total,
            "mfa_enabled": mfa_enabled,
            "mfa_adoption_rate": f"{100*mfa_enabled/total:.1f}%",
            "non_mfa_users": [u["user"] for u in credential_report if u["mfa_active"] == "false"]
        }
```

## Security Dashboard Template

```markdown
# Security Dashboard — March 2024

## Executive Summary
Security posture: 🟡 IMPROVING
- 2 critical findings resolved this week (↓ from 4 last week)
- MFA adoption: 98.2% (↑ 1.4pp from last month)
- No P1 incidents in 47 days

## Vulnerability Management
| Severity | Open | SLA Compliant | Avg Age (days) |
|----------|------|---------------|----------------|
| Critical | 1 | 0% ⚠ | 28 |
| High | 12 | 83% | 4.2 |
| Medium | 67 | 91% | 12.1 |

## Identity & Access
- MFA: 98.2% (2 users non-compliant — escalated)
- Privileged access reviews: 100% complete this quarter
- Orphaned accounts: 0 (last review: 2024-03-01)

## Security Debt
- Open security findings in backlog: 23 (↓ from 31)
- P1 security debt items: 0
- P2 security debt items: 3 (due Q2)
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Activity metrics only** | Patches applied ≠ risk reduced | Outcome metrics: SLA compliance, breach rate |
| **Too many metrics** | Dashboard fatigue; nothing acted on | 8-12 core metrics; detailed drilldowns |
| **No trending** | Point-in-time snapshot doesn't show direction | 13-week rolling trend on all metrics |
| **Metrics without owners** | Nobody responsible for improving the number | Named owner for each tier-1 metric |
| **Gaming the metric** | Closing vulnerabilities without fixing them | Review metrics for gaming signals quarterly |

## 10 Rules

1. Measure outcomes, not activities — SLA compliance matters more than "scans run".
2. 8-12 core metrics maximum — more causes paralysis.
3. Every metric has a target and an owner — data without accountability doesn't improve.
4. 13-week trend is more valuable than a single data point — direction matters.
5. Mean time to detect and mean time to respond are the most important incident metrics.
6. Vulnerability SLA compliance reveals programme effectiveness better than raw count.
7. Share security metrics with engineering leadership — security is a shared responsibility.
8. Review metrics for gaming quarterly — closing tickets without fixing issues is invisible without review.
9. Benchmark against your previous performance, not industry averages — you don't know their data quality.
10. Automate collection — manually compiled metrics become stale and get skipped under pressure.
