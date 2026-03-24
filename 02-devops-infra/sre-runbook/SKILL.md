---
name: sre-runbook
description: Write SRE runbooks for incident response, on-call procedures, and service recovery. Outputs structured runbooks with SLOs, alert response playbooks, escalation paths, and post-incident templates.
argument-hint: [service name, SLO targets, on-call rotation, alert types]
allowed-tools: Read, Write
---

# SRE Runbook

A runbook is executable documentation. When an alert fires at 3am, the on-call engineer should be able to open the runbook and follow steps to diagnose and recover — without needing to wake up the service owner or search Slack history.

## Process

1. **Define SLOs first.** Availability %, latency p99, error rate. Without SLOs, you don't know what "broken" means.
2. **Enumerate alert types.** For each alert, write a dedicated playbook: what it means, immediate actions, escalation.
3. **Write diagnosis steps.** Structured decision tree: check X, if Y do Z, else do W.
4. **Document recovery procedures.** Exact commands, not vague instructions. Tested and verified.
5. **Define escalation paths.** Who to call and when. Include contact info and rotation.
6. **Add runbook links to alerts.** Every PagerDuty/alertmanager alert links directly to its runbook section.
7. **Review after every incident.** If the runbook didn't help, update it. Runbooks rot.

## Service Overview Template

```markdown
# Runbook: [Service Name]

**Last Updated:** YYYY-MM-DD  
**Owner:** @team-name  
**Slack:** #service-name-oncall  
**Dashboard:** https://grafana.example.com/d/service-name  
**Logs:** https://kibana.example.com/app/discover?q=service:service-name  
**Traces:** https://jaeger.example.com/search?service=service-name  
**Repository:** https://github.com/company/service-name  

## SLOs

| Indicator | Target | Measurement | Burn Rate Alert |
|-----------|--------|-------------|-----------------|
| Availability | 99.9% (43min/month error budget) | Success rate on /health | 1h window >14.4× |
| Latency p99 | < 500ms | API gateway p99 | 1h p99 > 1000ms |
| Error rate | < 0.1% | 5xx / total requests | 5min > 1% |

## Architecture

[service name] handles [what it does].

Dependencies:
- PostgreSQL (orders database) — critical
- Redis (session cache) — degraded mode if unavailable
- Stripe API (payments) — critical for checkout flow
- Email service — non-critical, async

Entry points:
- API Gateway → ECS Fargate (port 8080)
- SQS queue `order-events` → Worker (port 8081)
```

## Alert Playbooks

```markdown
## Alert: HighErrorRate

**Severity:** P1  
**Condition:** error_rate > 1% for 5 minutes  
**Runbook link:** This section  

### Immediate Actions (first 5 minutes)
1. Check dashboard: is it localised to one endpoint or global?
   - Dashboard: https://grafana.example.com/d/service-errors
2. Check recent deployments:
   ```
   kubectl rollout history deployment/service-name -n production
   ```
3. If deployed in last 30 minutes → rollback immediately (see Rollback section)
4. Check error logs:
   ```
   kubectl logs -l app=service-name -n production --since=10m | grep ERROR
   ```

### Diagnosis Decision Tree
```
High error rate detected
├── Recent deployment? → ROLLBACK immediately
├── Upstream dependency down?
│   ├── PostgreSQL → see Database Playbook
│   ├── Redis → service degrades gracefully (check logs for REDIS_UNAVAIL)
│   └── Stripe → payment errors only; other flows should work
├── Traffic spike?
│   └── Check HPA: kubectl get hpa -n production
│       └── If at max replicas → scale manually (see Scaling section)
└── Unknown cause → escalate to service owner (see Escalation)
```

### Recovery Verification
```bash
# Confirm error rate returning to normal
kubectl top pods -n production -l app=service-name
curl -s https://api.example.com/health | jq .
# Check error rate in Grafana — should return below 0.1% within 5min of fix
```

---

## Alert: HighLatency

**Severity:** P2  
**Condition:** p99 latency > 1000ms for 10 minutes  

### Immediate Actions
1. Identify slow endpoints:
   ```
   # Grafana query: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) by (endpoint)
   ```
2. Check database slow queries:
   ```sql
   SELECT query, calls, mean_exec_time, total_exec_time
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC LIMIT 20;
   ```
3. Check Redis hit rate:
   ```
   redis-cli info stats | grep keyspace
   ```
4. Check GC pressure (JVM):
   ```
   kubectl exec -n production deploy/service-name -- jstat -gc 1 5
   ```

---

## Alert: PodCrashLooping

**Severity:** P1  

### Immediate Actions
1. Get crash reason:
   ```bash
   kubectl describe pod -l app=service-name -n production | grep -A 20 "Last State"
   kubectl logs -l app=service-name -n production --previous
   ```
2. Common causes:
   - OOMKilled → increase memory limit (see Resource Limits section)
   - Config error → check ConfigMap/Secret changes
   - Failed health check → service not starting; check startup logs
3. If OOMKilled: `kubectl set resources deployment/service-name --limits=memory=2Gi -n production`
```

## Scaling Procedures

```bash
# Manual horizontal scale
kubectl scale deployment service-name --replicas=10 -n production

# Verify pods are Running
kubectl get pods -n production -l app=service-name -w

# Check HPA status
kubectl describe hpa service-name -n production

# Temporarily raise HPA max (requires terraform/GitOps update for persistence)
kubectl patch hpa service-name -n production -p '{"spec":{"maxReplicas":20}}'

# Vertical scale (requires rolling restart)
kubectl set resources deployment/service-name \
  --requests=cpu=500m,memory=1Gi \
  --limits=cpu=2,memory=2Gi \
  -n production
```

## Rollback Procedure

```bash
# 1. Identify previous stable revision
kubectl rollout history deployment/service-name -n production

# 2. Rollback to previous revision
kubectl rollout undo deployment/service-name -n production

# 3. Rollback to specific revision
kubectl rollout undo deployment/service-name --to-revision=3 -n production

# 4. Monitor rollout
kubectl rollout status deployment/service-name -n production

# 5. Verify health
kubectl get pods -n production -l app=service-name
curl https://api.example.com/health

# 6. Confirm error rate normalised in Grafana
```

## Database Recovery

```bash
# Check PostgreSQL replication lag
psql -h postgres-primary -U admin -c "
SELECT client_addr, state, sent_lsn, write_lsn, flush_lsn, replay_lsn,
       (sent_lsn - replay_lsn) AS replication_lag
FROM pg_stat_replication;"

# Identify long-running queries (kill if blocking)
psql -h postgres-primary -U admin -c "
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';"

# Kill blocking query
psql -h postgres-primary -U admin -c "SELECT pg_terminate_backend(<pid>);"

# Manual failover to replica (with DBA approval)
# See: https://internal.wiki/postgres-failover
```

## Escalation Path

```
P1 (service down / SLO burn > 14.4×):
  1. On-call engineer — immediate response
  2. After 15min no resolution → page service team lead
  3. After 30min no resolution → page VP Engineering

P2 (degraded / latency high):
  1. On-call engineer — response within 30min
  2. After 2h no resolution → Slack #service-name-oncall and tag team lead

Contact list:
  Team lead: @jane-smith (backup: @john-doe)
  DB support: #database-oncall
  Platform:   #platform-oncall
  Vendor (Stripe): https://support.stripe.com — account ID: ACC-12345
```

## Post-Incident Template

```markdown
# Incident Report: INC-YYYYMMDD-NNN

**Date:** YYYY-MM-DD  
**Duration:** HH:MM – HH:MM UTC (X minutes)  
**Severity:** P1/P2  
**Affected:** [what users/functionality was impacted]  
**Impact:** ~N users, $N revenue, N SLO minutes burned  

## Timeline
| Time (UTC) | Event |
|------------|-------|
| HH:MM | Alert fired |
| HH:MM | On-call acknowledged |
| HH:MM | Root cause identified |
| HH:MM | Fix deployed |
| HH:MM | Service restored |

## Root Cause
[One paragraph. What actually caused this?]

## What Went Well
- [Specific thing that helped]

## What Went Poorly  
- [Specific thing that made it worse]

## Action Items
| Action | Owner | Due Date |
|--------|-------|----------|
| Add alert for early detection | @name | YYYY-MM-DD |
| Update runbook with root cause | @name | YYYY-MM-DD |
| Fix underlying bug | @name | YYYY-MM-DD |
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Vague instructions** | "Check the database" — check what exactly? | Exact commands, exact metrics, exact thresholds |
| **No alert → runbook link** | Engineers search Slack during incidents | Every alert annotation includes runbook URL |
| **Runbook not tested** | Steps don't work under pressure | Runbook game days — follow it in staging |
| **No escalation contacts** | Who do I call at 3am? | Named people, not team aliases only |
| **Outdated contact info** | Former employee's number | Review runbook on every rotation change |
| **Missing rollback steps** | Fix takes longer than rollback | Rollback is always first option to restore service |

## 10 Rules

1. Runbooks are executable — every step is an exact command or a verifiable check, never prose.
2. Every alert links to its runbook section. No hunting during incidents.
3. Start with rollback — restoring service takes priority over finding root cause.
4. Decision trees beat walls of text — engineers make faster decisions with branching logic.
5. SLOs define "broken" — runbook triggers and severity levels derive from SLO burn rates.
6. Escalation paths name people, not teams. Teams don't answer phones.
7. Update the runbook after every incident before closing it.
8. Game-day the runbook quarterly — follow every step in staging to verify it works.
9. Runbooks live in the same repo as the service — they version together.
10. Short and scannable beats thorough and unread — an engineer in crisis reads in 10-second bursts.
