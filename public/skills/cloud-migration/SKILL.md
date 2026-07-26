---
name: cloud-migration
description: Plan and execute cloud migrations using the 6R strategies. Outputs assessment framework, migration waves, risk analysis, cutover plan, and success metrics.
argument-hint: [source environment, target cloud, application count, timeline, compliance requirements]
allowed-tools: Read, Write
---

# Cloud Migration

Cloud migration moves applications from on-premises or another cloud to a target cloud environment. Success requires honest application assessment, selecting the right strategy for each application, sequencing migrations by risk, and planning for rollback at every step.

## The 6Rs Migration Strategies

```
RETIRE
  Application no longer needed — decommission
  ~10-20% of application portfolio typically

RETAIN
  Keep on-premises for now — too risky, compliance, or no ROI
  Revisit in 12-18 months

REHOST ("Lift and Shift")
  Move to cloud VMs with minimal changes
  Fastest, lowest risk, limited cloud benefits
  Use for: Legacy apps, time pressure, unknown internals

REPLATFORM ("Lift, Tinker, Shift")
  Minor optimisations: managed database, container, object storage
  Moderate effort; some cloud benefits
  Use for: Apps that benefit from managed services

REFACTOR / RE-ARCHITECT
  Redesign for cloud-native: microservices, serverless, event-driven
  Highest effort; highest cloud value
  Use for: Core business apps worth the investment

REPURCHASE
  Move to SaaS alternative
  Use for: Commodity apps (CRM, HR, email)
```

## Application Assessment

```python
from dataclasses import dataclass
from enum import Enum

class MigrationStrategy(Enum):
    RETIRE = "Retire"
    RETAIN = "Retain"
    REHOST = "Rehost"
    REPLATFORM = "Replatform"
    REFACTOR = "Refactor"
    REPURCHASE = "Repurchase"

@dataclass
class AppAssessment:
    name: str
    business_criticality: str    # critical | high | medium | low
    technical_complexity: str    # high | medium | low
    dependencies: list[str]      # other apps it depends on
    data_sensitivity: str        # pii | financial | internal | public
    monthly_cost_onprem: float
    estimated_cloud_cost: float
    compliance_requirements: list[str]
    recommended_strategy: MigrationStrategy
    migration_wave: int          # 1 = first, 5 = last

def recommend_strategy(app: dict) -> MigrationStrategy:
    # Decision tree
    if app.get("eol") or app.get("no_users_6mo"):
        return MigrationStrategy.RETIRE
    
    if app.get("compliance_blocks") or app.get("too_risky"):
        return MigrationStrategy.RETAIN
    
    if app.get("saas_available") and not app.get("heavy_customisation"):
        return MigrationStrategy.REPURCHASE
    
    if app.get("strategic_core") or app.get("microservices_target"):
        return MigrationStrategy.REFACTOR
    
    if app.get("managed_db_benefit") or app.get("containerisable"):
        return MigrationStrategy.REPLATFORM
    
    return MigrationStrategy.REHOST  # Default

def assign_wave(app: AppAssessment) -> int:
    # Wave 1: Low complexity, low criticality, no dependencies
    if app.technical_complexity == "low" and app.business_criticality in ["low", "medium"]:
        return 1
    # Wave 4-5: High criticality, high complexity, many dependencies
    if app.business_criticality == "critical" and len(app.dependencies) > 5:
        return 4
    return 2
```

## Migration Wave Plan

```markdown
## Migration Plan: Acme Corp → AWS

### Wave 1 (Months 1-3): Foundation + Low-Risk Apps
Goal: Prove the process; build team capability

Infrastructure:
- [ ] Landing Zone setup (VPC, IAM, GuardDuty, CloudTrail)
- [ ] Network connectivity (Direct Connect or VPN)
- [ ] Identity federation (Okta → AWS SSO)
- [ ] Monitoring baseline (CloudWatch, Datadog agent)

Applications (Rehost):
- Internal wiki (low criticality, no dependencies)
- Dev/test environments for all apps
- Static website

Success criteria:
- All Wave 1 apps running in cloud
- Network latency to HQ < 20ms
- Zero security incidents
- Team trained on AWS operations

### Wave 2 (Months 3-6): Mid-Tier Applications
Goal: Migrate 40% of portfolio

Applications:
- Reporting system (Replatform → RDS + EC2)
- File storage (Replatform → S3 + Lambda)
- Support ticketing (Repurchase → Zendesk)

### Wave 3 (Months 6-9): Core Business Systems
Goal: Migrate 70% of portfolio

Applications:
- Orders API (Replatform → ECS + RDS)
- Customer portal (Refactor → ECS + Aurora serverless)

### Wave 4 (Months 9-12): Critical Systems
Goal: 100% migration; decommission datacenter

Applications:
- Payment processing (Rehost + enhanced security controls)
- Core ERP (Retain — revisit 2025)
```

## Cutover Procedure

```markdown
## Production Cutover: Orders API

### Pre-Cutover Checklist (T-48h)
- [ ] Cloud environment performance tested at 2× production load
- [ ] Data migration completed and verified (row counts, checksums)
- [ ] Rollback procedure tested in staging
- [ ] On-call engineers notified and available
- [ ] Customer communications drafted (if downtime expected)
- [ ] Stakeholder approval obtained

### Cutover Window: Saturday 2am-4am UTC

T-0:00 — Begin cutover
  - Enable maintenance mode on on-prem app
  - Final data sync (WAL streaming or database dump)

T-0:15 — Verify data sync complete
  - Row count comparison on critical tables
  - Spot check 10 random records

T-0:30 — Switch DNS
  - Update Route53: orders.company.com → Cloud ALB
  - TTL set to 60s (pre-reduced from 300s)

T-0:45 — Verify cloud health
  - Smoke test all critical endpoints
  - Check error rate in Datadog
  - Verify payment processing end-to-end

T-1:00 — Declare success or rollback
  - If healthy: notify stakeholders
  - If issues: rollback DNS to on-prem

### Rollback Trigger
- Error rate > 1% for more than 5 minutes
- Any P1 functionality broken
- Database connectivity issues
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Lift-and-shift everything** | Cloud bill higher than on-prem | Assess each app; many need replatforming for ROI |
| **No wave planning** | Migrating critical apps first | Sequence by risk: low-risk first to prove the process |
| **No rollback plan** | Migration fails with no way back | Every cutover has a tested rollback procedure |
| **Migrating without landing zone** | Security, compliance gaps | Build foundation first: IAM, network, monitoring |
| **Ignoring data migration complexity** | Data sync failures delay cutover | Practice data migration multiple times before production |

## 10 Rules

1. Assess every application before migrating — strategy choice drives cost and complexity.
2. Wave plan by risk — low criticality first; learn before migrating critical systems.
3. Build the landing zone (IAM, networking, security) before the first application.
4. Every migration has a tested rollback procedure — not a theoretical one.
5. Data migration is almost always harder than application migration — plan for it explicitly.
6. Retire ~15-20% of the portfolio during migration — cloud migration is a cleanup opportunity.
7. TCO must include labour, training, and migration costs — not just cloud bills vs rack costs.
8. Run in parallel (both cloud and on-prem) before cutover — never big-bang cutover.
9. DNS TTL reduced to 60s before cutover — faster rollback if needed.
10. Decommission on-prem within 30 days of successful migration — dual running costs erode ROI.
