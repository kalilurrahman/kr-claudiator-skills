---
name: incident-response
description: Execute a structured security incident response from detection through post-incident review. Covers the PICERL lifecycle, severity classification, containment playbooks, evidence preservation, communication templates, and blameless post-mortems.
argument-hint: [incident type, severity level, affected systems, regulatory context]
allowed-tools: Read, Write, Bash
---

# Security Incident Response

Incident response is not improvised — it is practiced. A structured response minimises damage, reduces recovery time, satisfies regulatory obligations, and produces the evidence needed for root cause analysis. Every security incident follows the same lifecycle regardless of its type.

## PICERL Lifecycle

| Phase | Goal | Key actions |
|-------|------|------------|
| Preparation | Ready before an incident | Playbooks, tools, on-call contacts, quarterly drills |
| Identification | Detect and confirm an incident | Alerts, log analysis, anomaly triage |
| Containment | Stop the bleeding | Isolate systems, revoke credentials, block IPs |
| Eradication | Remove the threat | Patch, rebuild, clean malware, close access paths |
| Recovery | Restore service safely | Staged restoration, enhanced monitoring, integrity checks |
| Lessons Learned | Prevent recurrence | Blameless post-mortem, timeline, controls improvement |

## Severity Classification

| Severity | Criteria | Response SLA | Examples |
|---------|---------|-------------|---------|
| P1 Critical | Active breach; customer data at risk; service down | Immediate, 24/7 | Ransomware; confirmed exfiltration; root compromise |
| P2 High | Potential breach; significant exposure | < 2 hours | Credential compromise; public S3 bucket; insider threat |
| P3 Medium | Limited impact; no confirmed breach | < 8 hours | Failed intrusion attempt; suspicious access pattern |
| P4 Low | Policy violation; no immediate risk | < 24 hours | Weak password; missing MFA; audit finding |

## Process

1. **Declare the incident** — assign severity, incident commander (IC), and communication lead.
2. **Assemble the response team** — security, engineering, legal, and communications as needed by severity.
3. **Identify and scope** — what systems are affected? What data is at risk? What is the blast radius?
4. **Preserve evidence first** — capture logs, snapshots, and memory dumps before containment actions destroy them.
5. **Contain** — isolate systems, revoke compromised credentials, block attacker access paths.
6. **Eradicate** — find and remove every trace of attacker access; close the exploited vulnerability.
7. **Restore** — bring systems back online with enhanced monitoring; verify integrity before declaring recovery.
8. **Communicate** — stakeholders, customers, and regulators as required by severity and applicable law.
9. **Post-incident review** — within 5 business days; blameless; produces a timeline and action items.
10. **Improve** — update playbooks, monitoring thresholds, and controls based on findings.

## Incident Declaration

```markdown
# Incident — INC-2025-042
**Declared:** 2025-01-15 14:32 UTC  
**Severity:** P1 Critical  
**Type:** Credential compromise / unauthorised API access  
**Incident Commander:** @alice  
**Communication Lead:** @bob  
**Status:** Containment in progress  

## What we know
- Unauthorised API access detected at 14:15 UTC from 203.0.113.42
- Pattern consistent with credential stuffing; 3 accounts confirmed compromised
- No evidence of data exfiltration at this time — investigation ongoing

## Affected systems
- api.example.com (authentication service)
- 3 user accounts: IDs 1001, 1042, 2817

## Actions taken
| Time (UTC) | Action | Who |
|-----------|--------|-----|
| 14:18 | Blocked 203.0.113.42 at WAF | @alice |
| 14:22 | Forced session invalidation on 3 accounts | @charlie |
| 14:30 | Enabled enhanced logging on auth service | @charlie |

## War room
Slack: #incident-042 | Zoom: [link]
Next update: 15:00 UTC
```

## Containment Playbook — Compromised User Account

```bash
#!/bin/bash
# Run as: ./contain-account.sh <user_id>
# Estimated time: 5 minutes

set -euo pipefail
USER_ID="$1"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "[$TIMESTAMP] Containing account: $USER_ID"

# Step 1 — Invalidate all active sessions
psql "$DATABASE_URL" -c "
  UPDATE user_sessions
  SET invalidated_at = NOW(), invalidated_reason = 'security_incident_INC-2025-042'
  WHERE user_id = '$USER_ID' AND invalidated_at IS NULL;"
echo "✓ Sessions invalidated"

# Step 2 — Revoke API keys
psql "$DATABASE_URL" -c "
  UPDATE api_keys
  SET revoked_at = NOW(), revoke_reason = 'security_incident'
  WHERE user_id = '$USER_ID' AND revoked_at IS NULL;"
echo "✓ API keys revoked"

# Step 3 — Require MFA re-enrolment on next login
psql "$DATABASE_URL" -c "
  UPDATE users SET mfa_required_at_next_login = TRUE WHERE id = '$USER_ID';"
echo "✓ MFA re-enrolment required"

# Step 4 — Preserve evidence before any further changes
mkdir -p "/tmp/incident-evidence/$USER_ID"
psql "$DATABASE_URL" -c "\COPY (
  SELECT * FROM audit_log
  WHERE user_id = '$USER_ID'
  AND created_at > NOW() - INTERVAL '48 hours'
  ORDER BY created_at
) TO STDOUT WITH CSV HEADER" > "/tmp/incident-evidence/$USER_ID/audit-log.csv"
echo "✓ Evidence preserved to /tmp/incident-evidence/$USER_ID/"

# Step 5 — Flag account for security review
psql "$DATABASE_URL" -c "
  UPDATE users SET account_status = 'security_hold', security_hold_reason = 'INC-2025-042'
  WHERE id = '$USER_ID';"

echo "[$TIMESTAMP] Containment complete for $USER_ID"
echo "Next: notify account owner by email; update incident log"
```

## Evidence Preservation Checklist

```markdown
## Evidence to Collect — Do this BEFORE containment changes destroy it

### Logs
- [ ] Application logs (access, error, audit) — minimum 48-hour window around incident
- [ ] Authentication logs — successful and failed login attempts
- [ ] Cloud audit trail (AWS CloudTrail / GCP Cloud Audit Logs) — all API calls
- [ ] WAF logs — full request/response for attacker IPs
- [ ] Database query logs (if data breach suspected)
- [ ] VPC flow logs — network-level activity

### System artefacts
- [ ] EBS snapshot of affected instances (before any remediation)
- [ ] Running process list: `ps aux > processes.txt`
- [ ] Open network connections: `ss -tulnp > connections.txt`
- [ ] Scheduled tasks / cron jobs
- [ ] Shell history: `cp ~/.bash_history /tmp/incident-evidence/`

### Access artefacts
- [ ] Active sessions at time of incident
- [ ] OAuth tokens issued in last 24 hours
- [ ] IAM role assumption events (AWS: `cloudtrail:LookupEvents`)
- [ ] API keys in use during the incident window
```

## Communication Templates

### Internal Status Update (every 30 minutes during P1)

```markdown
**INCIDENT UPDATE — INC-2025-042 — 15:00 UTC**
**Status:** Eradication in progress | **Severity:** P1

SUMMARY: Credential stuffing compromised 3 accounts at 14:15 UTC. Attacker blocked.
No confirmed data exfiltration. Root cause: accounts lacked MFA enforcement.

COMPLETED:
✓ Attacker IP blocked at WAF (14:18)
✓ 3 accounts isolated; password reset emails sent (14:22)
✓ Audit logs exported for all 3 accounts

IN PROGRESS:
→ Reviewing past 7-day audit logs for lateral movement
→ Checking if attacker accessed any sensitive endpoints

NEXT ACTIONS:
- 15:30 — Complete log review; determine full access scope
- 16:00 — Decision on customer notification requirement
- 16:30 — Security briefing for leadership

NEEDS FROM LEADERSHIP:
- Approval to send customer notification if data exposure confirmed
- Legal team on standby for GDPR 72-hour notification window
```

### Customer Notification (if data exposed)

```markdown
Subject: Important Security Notice Regarding Your Account

We are writing to inform you of a security incident that may have affected your account.

WHAT HAPPENED
On 15 January 2025, we detected unauthorised access to our systems. An attacker used
credentials that had been exposed in a previous breach at another service to access
a small number of accounts, including yours, between 14:15 and 14:22 UTC.

WHAT INFORMATION WAS INVOLVED
The attacker may have accessed: your name, email address, and account activity history.
Your payment information is stored separately and was not accessible.

WHAT WE HAVE DONE
- Blocked the attacker within 7 minutes of detection
- Reset your password and invalidated all active sessions
- Notified relevant regulatory authorities
- Implemented mandatory two-factor authentication for all accounts

WHAT YOU SHOULD DO
1. Set a new password using the secure link sent in a separate email
2. Enable two-factor authentication (instructions at help.example.com/2fa)
3. Review your account for any activity you do not recognise

We apologise for this incident. Questions: security@example.com
```

## Post-Incident Review Template

```markdown
# Post-Incident Review — INC-2025-042
**Date:** 2025-01-20 (5 days after incident)  
**Facilitator:** @security-lead  
**Attendees:** Engineering, Security, Legal, Product  
**Duration:** 90 minutes  
**Blameless policy:** We review systems and processes, not individuals.

## Incident Timeline

| Time UTC | Event |
|---------|-------|
| 14:00 | Attacker begins credential stuffing (detected in retrospect) |
| 14:15 | Alert fires: unusual failed-login rate on auth service |
| 14:22 | On-call engineer acknowledges alert |
| 14:32 | P1 declared; incident commander assigned |
| 14:18 | WAF rule blocks attacker IP |
| 14:22 | 3 accounts contained; password resets sent |
| 15:45 | Log review complete; full scope confirmed; no exfiltration |
| 16:30 | Customer notifications sent |
| 18:00 | Enhanced monitoring confirmed; incident closed |

## Root Cause

**Primary:** MFA was optional, not enforced. Credential stuffing succeeded because reused passwords were the only authentication factor.

**Contributing factors:**
1. Rate limiting on the login endpoint was set to 500 req/min/IP — too permissive.
2. Alert threshold was 1 000 failed logins before firing — took 15 minutes to trigger.
3. No automated account isolation — manual containment took 10 minutes after declaration.

## 5 Whys

1. Why were 3 accounts compromised? Attacker had valid credential pairs from another breach.
2. Why did the credentials work? MFA was not enforced; password was the only factor.
3. Why was MFA optional? Enforcement was deprioritised in the last two sprints.
4. Why was the attack not detected sooner? Alert threshold was set too high.
5. Why was the threshold too high? It was set during initial setup and never reviewed.

## What Went Well
- Detection to containment in < 20 minutes
- Clear incident commander role prevented decision conflicts
- Evidence was preserved before containment changed anything
- Communication to stakeholders was timely and clear

## What Could Be Improved
- 7-minute gap between alert firing and on-call acknowledgement
- Legal was not looped in until hour 2 (P1 requires immediate notification)
- No automated account isolation — manual steps added 10 minutes to containment

## Action Items

| Action | Owner | Priority | Due |
|--------|-------|---------|-----|
| Enforce MFA for all accounts (not optional) | @security | P1 | 2025-02-01 |
| Lower failed-login alert threshold to 100/5 min | @security | P1 | 2025-01-22 |
| Rate-limit login endpoint to 20 req/min per IP | @backend | P1 | 2025-01-25 |
| Add automated account isolation to containment playbook | @security | P2 | 2025-02-15 |
| Add Legal to P1 incident page immediately upon declaration | @security | P2 | 2025-01-20 |
| Quarterly credential-stuffing tabletop exercise | @security | P3 | 2025-04-01 |
```

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| No incident commander | Multiple people making conflicting decisions under pressure | One IC owns every decision; all actions route through them |
| Containment before evidence | Logs and artefacts destroyed before analysis | Always snapshot and export evidence first |
| Improvised communication | Conflicting messages reach customers and regulators | Communication lead role; all external messages reviewed |
| Skipping the post-mortem | Incident recurs within months | Mandatory blameless post-mortem within 5 business days |
| Under-classifying severity | P2 treated as P3 to avoid escalation | Use the matrix; let process determine severity, not politics |
| Hero-dependent response | Only one person knows how to contain a specific incident | Playbooks that anyone on the team can execute |

## Rules

- **Preserve evidence before containment** — taking down a system may destroy the logs needed to understand the breach.
- **One incident commander per incident** — split authority causes delays and conflicting actions under pressure.
- **Update stakeholders every 30 minutes during P1** — silence is interpreted as loss of control.
- **Legal must be looped in immediately on P1** — GDPR requires notification within 72 hours; the clock starts at discovery.
- **Blameless post-mortem is mandatory** — the goal is improving systems, not assigning fault to individuals.
- **Playbooks must be tested quarterly** — an untested playbook fails at the worst possible moment.
- **Severity drives response, not gut feel** — apply the classification matrix consistently; never downgrade to avoid escalation.
- **Log all actions during the response** — the incident timeline is written during the incident, not reconstructed after.
- **Isolate, do not shut down** — isolation preserves the system state for forensics; a hard shutdown may destroy evidence.
- **Regulators before press** — breach notification laws have hard deadlines; legal must review any public statement first.
