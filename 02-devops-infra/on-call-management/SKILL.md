---
name: on-call-management
description: Design and operate an effective on-call rotation. Outputs rotation schedule, escalation policies, alert routing rules, on-call handbook, and well-being guidelines.
argument-hint: [team size, service criticality, time zones, current pain points, alerting tool]
allowed-tools: Read, Write
---

# On-Call Management

Effective on-call management ensures services are monitored 24/7 without burning out the people doing it. The goal is actionable alerts, clear escalation paths, appropriate response SLAs, and a culture where on-call is manageable — not traumatic.

## Rotation Design

```yaml
# PagerDuty schedule (Terraform)
resource "pagerduty_schedule" "primary" {
  name      = "Engineering Primary On-Call"
  time_zone = "UTC"

  layer {
    name                         = "Weekly Rotation"
    start                        = "2024-01-01T00:00:00Z"
    rotation_virtual_start       = "2024-01-01T09:00:00Z"
    rotation_turn_length_seconds = 604800  # 7 days

    users = [
      pagerduty_user.alice.id,
      pagerduty_user.bob.id,
      pagerduty_user.carol.id,
      pagerduty_user.dave.id,
    ]

    restriction {
      type              = "weekly_restriction"
      start_time_of_day = "09:00:00"
      start_day_of_week = 1  # Monday
      duration_seconds  = 432000  # Mon-Fri 09:00-18:00 business hours
    }
  }
}

# Escalation policy
resource "pagerduty_escalation_policy" "default" {
  name      = "Default Escalation"
  num_loops = 2

  rule {
    escalation_delay_in_minutes = 5
    target {
      type = "schedule_reference"
      id   = pagerduty_schedule.primary.id
    }
  }

  rule {
    escalation_delay_in_minutes = 15
    target {
      type = "schedule_reference"
      id   = pagerduty_schedule.secondary.id  # Backup on-call
    }
  }

  rule {
    escalation_delay_in_minutes = 30
    target {
      type = "user_reference"
      id   = pagerduty_user.eng_manager.id   # Manager escalation
    }
  }
}
```

## Alert Routing Rules

```yaml
# Only actionable alerts page on-call
# Severity matrix:

# P1 - Page immediately (24/7)
#   Service down, data loss risk, security breach, SLO critical burn
alerts:
  - name: ServiceDown
    severity: P1
    notify: [pagerduty_primary]
    response_sla: 5min

  - name: SLOCriticalBurnRate
    severity: P1
    notify: [pagerduty_primary]
    response_sla: 5min

# P2 - Page during business hours; Slack at night
  - name: HighErrorRate
    severity: P2
    notify:
      business_hours: [pagerduty_primary]
      off_hours: [slack_oncall_channel]
    response_sla: 30min

# P3 - Slack only, next business day
  - name: DiskUsageHigh
    severity: P3
    notify: [slack_oncall_channel]
    response_sla: next_business_day

# NEVER PAGE for:
# - Informational metrics
# - Metrics that auto-resolve in <5 min
# - Anything that has never needed human action
```

## On-Call Handbook

```markdown
# On-Call Handbook

## Before Your Shift
- [ ] Ensure laptop charged and internet reliable
- [ ] Test PagerDuty app works and alerts come through
- [ ] Know who your backup is (and their phone number)
- [ ] Review last 7 days of incidents for context
- [ ] Know your shift handoff time and who you're handing to

## During An Incident
1. **Acknowledge** the alert within 5 minutes (stops escalation)
2. **Assess** — is this a real incident or a flaky alert?
   - Check Grafana dashboard first (link in alert)
   - Check recent deployments (kubectl rollout history)
3. **Communicate** in #incidents-live: "Investigating [alert name] — [initial finding]"
4. **Decide**: rollback vs fix forward
   - If deployed in last 30 min → rollback first, investigate second
5. **Update** #incidents-live every 15 minutes
6. **Escalate** if not resolved in 30 min — never try to fix alone in the dark

## After An Incident
- Write incident summary in #incidents within 1 hour
- Create postmortem ticket if P1 or repeated issue
- Add runbook entry if one didn't exist

## Escalation
1. Can't reproduce → wait 2 cycles; if re-fires, escalate
2. Can reproduce but don't know fix → escalate to domain expert
3. Need access you don't have → escalate to senior on-call
4. Customer impact confirmed → loop in CS team

## Your Rights as On-Call
- You may not be contactable during a medical appointment, meal, or family emergency
- Incidents during off-hours are compensated (check HR policy)
- You may request a swap for personal commitments — slack #on-call-swaps
- More than 2 P1 incidents in a shift → flag to manager; reduce load or add rotation
```

## On-Call Health Metrics

```python
# Track these monthly to prevent burnout
metrics = {
    "pages_per_person_per_week": {
        "healthy": "< 2",
        "action_required": "> 5",
        "note": "High page rate → reduce alerts or increase rotation size"
    },
    "pct_actionable_alerts": {
        "healthy": "> 80%",
        "action_required": "< 50%",
        "note": "Low actionability → audit and remove noise alerts"
    },
    "incidents_per_month": {
        "healthy": "< 5 P1",
        "action_required": "> 10 P1",
        "note": "High incident rate → invest in reliability"
    },
    "avg_time_to_acknowledge": {
        "healthy": "< 5 min",
        "action_required": "> 15 min",
        "note": "Slow ACK → alert fatigue or staffing issue"
    },
    "mean_time_to_resolve": {
        "target_p1": "< 1 hour",
        "target_p2": "< 4 hours",
    }
}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Always-firing low-severity alerts** | Alert fatigue; real issues ignored | Alert only when human action required |
| **Same person always on-call** | Burnout; bus factor | Mandatory rotation; no opt-outs |
| **No runbooks** | Every incident solved by experience, not documentation | Runbook required for every alert |
| **No postmortems** | Same incidents repeat | Blameless postmortem for every P1 |
| **Paging for metrics not user-impacting** | Engineer woken for non-emergency | Tie every alert to user impact |

## 10 Rules

1. Only page when human action is required now — everything else is a ticket.
2. Every alert has a runbook — engineers should never have to Google at 3am.
3. Rotation size should give everyone a predictable, fair share of on-call time.
4. Alert fatigue kills effectiveness — audit and remove alerts that auto-resolve.
5. Escalation paths are defined before incidents — not discovered during them.
6. Postmortem after every P1 incident — without blame, with action items.
7. Track on-call health metrics monthly — pages/person/week is the key number.
8. Compensate out-of-hours pages — on-call is work, not implied by employment.
9. Acknowledge within 5 minutes — stops auto-escalation, signals a human is on it.
10. Make off-hours incidents visible — surface them in sprint retros; reliability is product work.
