---
name: disaster-recovery
description: Design and document a disaster recovery plan for a production system. Covers RTO/RPO definition, failover architecture, backup verification, runbooks, and regular DR testing procedures.
argument-hint: [system name, cloud provider, RTO/RPO requirements, data criticality]
allowed-tools: Read, Write, Bash
---

# Disaster Recovery Planning

A DR plan that has never been tested is a hypothesis, not a plan. DR is not a backup -- it is the entire capability to restore service after a catastrophic failure. The goal is to define, document, practice, and continuously improve recovery from every class of failure.

## Core Metrics

| Metric | Definition | How to set it |
|--------|-----------|---------------|
| RTO (Recovery Time Objective) | Maximum acceptable downtime | Based on business cost of outage per hour |
| RPO (Recovery Point Objective) | Maximum acceptable data loss | Based on transaction value and backup frequency |
| MTTR (Mean Time To Recovery) | Average actual recovery time | Measured from real incidents and DR tests |
| RLO (Recovery Level Objective) | Minimum service level during recovery | Which features must work first? |

## DR Tiers by RTO/RPO

| Tier | RTO | RPO | Strategy | Cost |
|------|-----|-----|----------|------|
| Active-Active | < 1 min | 0 | Multi-region with load balancing | Very high |
| Active-Passive (warm) | 5-30 min | < 5 min | Standby region pre-warmed | High |
| Pilot Light | 30-60 min | < 15 min | Core infra running; app scaled down | Medium |
| Backup-Restore | 4-24 hours | 1-24 hours | Restore from backup | Low |

## Process

1. **Define RTO and RPO** -- get business sign-off; these drive all architecture decisions.
2. **Inventory critical systems** -- what must recover, in what order, with what dependencies?
3. **Choose DR strategy** -- active-active, warm standby, pilot light, or backup-restore.
4. **Design backup architecture** -- frequency, retention, encryption, cross-region replication.
5. **Write recovery runbooks** -- step-by-step, tested procedures for each failure class.
6. **Automate failover where possible** -- human-triggered failover is slow and error-prone.
7. **Define communication plan** -- who is notified, how, in what order during a DR event.
8. **Schedule DR tests** -- test at minimum quarterly; treat a failed test as a production incident.
9. **Measure and improve** -- track actual RTO vs target; improve after every test.
10. **Review annually** -- systems change; DR plans must change with them.

## Output Format

### DR Plan Document

```markdown
# Disaster Recovery Plan: [System Name]
**Version:** [N]  **Last tested:** [Date]  **Owner:** [Name]
**RTO:** [X hours]  **RPO:** [Y hours]  **Tier:** [Warm standby]

---

## System Overview

**Primary region:** us-east-1
**DR region:** us-west-2
**Architecture:** Active-passive warm standby
**Data stores:** PostgreSQL (RDS Multi-AZ), Redis (ElastiCache), S3

---

## Failure Scenarios and Recovery Procedures

### Scenario 1: Single AZ failure (most common)
**Detection:** CloudWatch alarm — ALB healthy host count < 2
**Recovery:** Automatic — Multi-AZ RDS and ALB handle this
**Expected RTO:** < 2 minutes (automatic)
**Runbook:** Automatic; monitor for 15 min; page on-call if not recovered

### Scenario 2: Full region failure
**Detection:** CloudWatch cross-region health check fails for > 5 min
**Recovery:** Manual trigger — promote DR region
**Expected RTO:** 30 minutes
**Runbook:** See DR-RUNBOOK-002

### Scenario 3: Data corruption / accidental deletion
**Detection:** Application errors + data validation alerts
**Recovery:** Point-in-time restore from RDS snapshot
**Expected RTO:** 2-4 hours (depends on data volume)
**Expected RPO:** Up to 5 minutes (RDS automated backup)
**Runbook:** See DR-RUNBOOK-003

### Scenario 4: Ransomware / security incident
**Detection:** Security team alert; anomalous encryption activity
**Recovery:** Full restore from immutable S3 backup (WORM policy)
**Expected RTO:** 4-24 hours
**Runbook:** See DR-RUNBOOK-004 + Incident Response Plan
```

### Region Failover Runbook

```bash
#!/bin/bash
# DR-RUNBOOK-002: Full region failover us-east-1 -> us-west-2
# Estimated time: 30 minutes
# Required permissions: DR-Operator IAM role

set -euo pipefail
DR_REGION="us-west-2"
PRIMARY_REGION="us-east-1"

echo "[$(date -u)] Starting regional failover to $DR_REGION"
echo "Operator: $USER"
echo ""
echo "STEP 1: Verify primary region is actually down (do not failover on a false alarm)"
aws cloudwatch get-metric-statistics \
  --region $PRIMARY_REGION \
  --namespace AWS/ApplicationELB \
  --metric-name HealthyHostCount \
  --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 60 --statistics Average \
  --dimensions Name=LoadBalancer,Value=prod-alb
echo ""
read -p "Confirm primary is down (y/N): " confirm
[[ "$confirm" != "y" ]] && { echo "Failover cancelled."; exit 1; }

echo "[$(date -u)] STEP 2: Promote RDS read replica to primary in DR region"
aws rds promote-read-replica \
  --region $DR_REGION \
  --db-instance-identifier prod-postgres-dr \
  --backup-retention-period 7
echo "Waiting for promotion to complete..."
aws rds wait db-instance-available \
  --region $DR_REGION \
  --db-instance-identifier prod-postgres-dr
echo "RDS promotion complete."

echo "[$(date -u)] STEP 3: Scale up DR application fleet"
aws autoscaling update-auto-scaling-group \
  --region $DR_REGION \
  --auto-scaling-group-name prod-api-dr \
  --min-size 4 --max-size 20 --desired-capacity 6
echo "Waiting for instances to be healthy..."
sleep 120

echo "[$(date -u)] STEP 4: Update Route 53 to DR region"
aws route53 change-resource-record-sets \
  --hosted-zone-id ZXXXXXXXXXXXXX \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.example.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z1H1FL5HABSF5",
          "DNSName": "prod-alb-dr.us-west-2.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

echo "[$(date -u)] STEP 5: Verify DR region is serving traffic"
sleep 30
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.example.com/health)
echo "Health check status: $HTTP_STATUS"
[[ "$HTTP_STATUS" == "200" ]] && echo "SUCCESS: DR region is serving traffic" || echo "WARNING: Health check returned $HTTP_STATUS"

echo ""
echo "=== FAILOVER COMPLETE ==="
echo "Estimated DNS propagation: 1-5 minutes"
echo "Monitor for 30 minutes before declaring recovery complete."
echo "Notify stakeholders via incident channel."
```

### Backup Verification Script

```bash
#!/bin/bash
# Run weekly: verify backups are actually restorable
# A backup that cannot be restored is not a backup

set -euo pipefail
RESTORE_REGION="us-west-2"
TEST_INSTANCE="dr-verification-$(date +%Y%m%d)"

echo "[DR-TEST] Starting backup restoration verification - $(date -u)"

# 1. Restore latest RDS snapshot to a test instance
LATEST_SNAPSHOT=$(aws rds describe-db-snapshots \
  --db-instance-identifier prod-postgres \
  --query 'reverse(sort_by(DBSnapshots, &SnapshotCreateTime))[0].DBSnapshotIdentifier' \
  --output text)

echo "[DR-TEST] Restoring snapshot: $LATEST_SNAPSHOT"
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier $TEST_INSTANCE \
  --db-snapshot-identifier $LATEST_SNAPSHOT \
  --db-instance-class db.t3.medium \
  --no-multi-az \
  --region $RESTORE_REGION

aws rds wait db-instance-available \
  --db-instance-identifier $TEST_INSTANCE \
  --region $RESTORE_REGION

# 2. Run data integrity checks
TEST_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier $TEST_INSTANCE \
  --query 'DBInstances[0].Endpoint.Address' --output text \
  --region $RESTORE_REGION)

PSQL="psql -h $TEST_ENDPOINT -U admin -d app -t -c"
USER_COUNT=$($PSQL "SELECT COUNT(*) FROM users")
ORDER_COUNT=$($PSQL "SELECT COUNT(*) FROM orders")
echo "[DR-TEST] Users: $USER_COUNT, Orders: $ORDER_COUNT"

# 3. Compare row counts against expected baseline
EXPECTED_USERS=50000  # update this monthly
[[ $USER_COUNT -gt $((EXPECTED_USERS * 95 / 100)) ]] || {
  echo "ALERT: User count ($USER_COUNT) is more than 5% below expected ($EXPECTED_USERS)"
  exit 1
}

# 4. Cleanup
aws rds delete-db-instance \
  --db-instance-identifier $TEST_INSTANCE \
  --skip-final-snapshot \
  --region $RESTORE_REGION

echo "[DR-TEST] PASSED - Backup verification complete - $(date -u)"
```

### DR Test Schedule

```markdown
# DR Test Calendar

## Quarterly Full DR Test (tabletop + partial execution)
- [ ] Q1: Test Scenario 2 (region failover) — full execution in staging
- [ ] Q2: Test Scenario 3 (data corruption) — PITR restore in staging
- [ ] Q3: Test Scenario 1 (AZ failure) — inject fault in production, verify auto-recovery
- [ ] Q4: Test Scenario 4 (security incident) — tabletop exercise

## Monthly
- [ ] Verify latest backup can be restored (automated script)
- [ ] Check RDS read replica lag < 60 seconds
- [ ] Verify DR region scaling works (scale to 2, verify health, scale back)

## Weekly (automated)
- [ ] Backup existence check: last 7 daily snapshots present
- [ ] Cross-region S3 replication lag < 1 hour
- [ ] Route 53 health check functioning

## After every DR event
- [ ] Post-mortem within 48 hours
- [ ] Update RTO/RPO actuals vs targets
- [ ] Update runbooks with lessons learned
```

## Communication Plan

```markdown
# DR Communication Matrix

| Event | Who is notified | How | Within |
|-------|----------------|-----|--------|
| DR declared | CTO, VP Eng, On-call | Phone + Slack #incidents | 5 min |
| Customer impact confirmed | CEO, Support Lead, Comms | Slack + Email | 15 min |
| Status update | All stakeholders | Status page + Slack | Every 30 min |
| Recovery complete | All stakeholders | Status page + Email | Immediately |
| Post-mortem ready | Engineering, Leadership | Email + Slack | 48 hours |
```

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Untested DR plan | Plan fails exactly when needed | Quarterly tests are mandatory |
| Single-region backups | Region failure destroys backup too | Always replicate backups cross-region |
| Manual-only failover | Human error under stress | Automate steps 1-N; human approves trigger |
| No backup integrity check | Corrupted backup discovered during DR | Weekly restoration verification |
| DR plan not version-controlled | Outdated plan used in incident | Git repo for DR docs; review on every infra change |
| Hero-dependent recovery | Only one person knows the runbook | Runbooks executable by any team member |

## Rules

- **Test the plan, not the theory** -- DR drills are mandatory; untested plans are fiction.
- **Automate failover steps** -- humans make mistakes under pressure; automate everything automatable.
- **Cross-region backups always** -- a backup in the failed region is useless.
- **Verify backups weekly** -- a backup that cannot restore is not a backup.
- **Define RTO and RPO before designing** -- architecture decisions follow from these numbers.
- **Runbooks must work for anyone on the team** -- if only one person can execute the runbook, that is a risk.
- **Measure actual vs target RTO after every test** -- close the gap between plan and reality.
- **The communication plan is part of the DR plan** -- who to call and in what order must be written down.
- **Update the plan after every incident and test** -- living documentation beats perfect-at-creation documentation.
- **Treat a failed DR test like a production incident** -- post-mortem required; remediation tracked.
