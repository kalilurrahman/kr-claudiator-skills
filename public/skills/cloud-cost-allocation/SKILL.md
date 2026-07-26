---
name: cloud-cost-allocation
description: Implement cloud cost allocation, tagging policies, and showback/chargeback systems. Outputs tagging standards, cost allocation reports, anomaly detection, and team budget dashboards.
argument-hint: [cloud provider, team structure, current monthly spend, cost visibility maturity]
allowed-tools: Read, Write, Bash
---

# Cloud Cost Allocation

Cost allocation makes cloud spending visible, attributable, and actionable. Without it, teams do not know what they are spending, nobody optimises, and the bill surprises everyone at month end.

## Tagging Strategy

Every cloud resource must be tagged at creation time. Tags are enforced via AWS Service Control Policies, Azure Policy, or GCP Organization Constraints.

### Required tags
- Environment: production, staging, dev
- Team: backend, platform, ml, data
- Service: orders-api, ml-training, analytics-pipeline
- CostCenter: CC-1234
- Owner: alice@company.com

Enforce in Terraform:

    locals {
      required_tags = {
        Environment = var.environment
        Team        = var.team
        Service     = var.service_name
        CostCenter  = var.cost_center
        Owner       = var.owner_email
        ManagedBy   = "terraform"
      }
    }

AWS SCP to deny resource creation without required tags:

    {
      "Effect": "Deny",
      "Action": ["ec2:RunInstances", "rds:CreateDBInstance", "s3:CreateBucket"],
      "Resource": "*",
      "Condition": {
        "Null": {
          "aws:RequestedTag/Team": "true",
          "aws:RequestedTag/Service": "true"
        }
      }
    }

## Cost Allocation Report (Python + boto3)

    import boto3
    from datetime import datetime

    def get_team_costs(start_date, end_date):
        ce = boto3.client("cost-explorer", region_name="us-east-1")
        response = ce.get_cost_and_usage(
            TimePeriod={"Start": start_date, "End": end_date},
            Granularity="MONTHLY",
            GroupBy=[
                {"Type": "TAG", "Key": "Team"},
                {"Type": "TAG", "Key": "Service"},
            ],
            Metrics=["UnblendedCost"],
        )
        costs = {}
        for result in response["ResultsByTime"]:
            for group in result["Groups"]:
                team = group["Keys"][0].replace("Team$", "")
                service = group["Keys"][1].replace("Service$", "")
                amount = float(group["Metrics"]["UnblendedCost"]["Amount"])
                costs.setdefault(team, {})[service] = amount
        return costs

## Cost Anomaly Detection

AWS Cost Anomaly Detection monitors daily spend per service and alerts when a spike exceeds a threshold. Configure via Terraform:

    resource "aws_ce_anomaly_subscription" "alerts" {
      name      = "cost-anomaly-alerts"
      frequency = "DAILY"
      threshold_expression {
        dimension {
          key    = "ANOMALY_TOTAL_IMPACT_PERCENTAGE"
          values = ["20"]
          match_options = ["GREATER_THAN_OR_EQUAL"]
        }
      }
      subscriber {
        address = "platform-team@company.com"
        type    = "EMAIL"
      }
    }

## Budget Alerts

Set team-level budgets with alerts at 80% and 100%:

    resource "aws_budgets_budget" "team_budget" {
      name         = "backend-team-monthly"
      budget_type  = "COST"
      limit_amount = "5000"
      limit_unit   = "USD"
      time_unit    = "MONTHLY"

      notification {
        comparison_operator = "GREATER_THAN"
        threshold           = 80
        notification_type   = "ACTUAL"
        subscriber_email_addresses = ["backend-team@company.com"]
      }
    }

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| No required tags | Cannot attribute costs | Enforce via SCP/Policy at org level |
| Tagging after the fact | Data gaps hard to backfill | Tag at creation in IaC |
| Monthly reporting only | Spikes undetected for weeks | Daily anomaly detection |
| No team budgets | Overspend without warning | Budget with 80%/100% alerts per team |
| Single cost centre | No team accountability | Per-team cost allocation |

## 10 Rules

1. Tagging enforced by policy not convention - SCPs block untagged resource creation.
2. Every team has a monthly cost budget and owns it.
3. Cost anomaly detection fires within 24 hours of a spike.
4. Cost reported to teams weekly not just to finance monthly.
5. Untagged spend reported separately to drive tagging compliance.
6. FinOps review monthly: identify and action top 3 cost optimisations.
7. Spot/preemptible instances for batch workloads - 60-80% savings.
8. Reserved instances or savings plans for stable baseline workloads.
9. Right-size instances monthly - oversized instances are the biggest waste.
10. Cost is a product metric - teams own their cloud spend like their SLOs.


## Deep dive: applying this in practice

The sections above describe *what* to produce. This section describes *how* practitioners actually run this in the field, including the conversations, artefacts, and review loops that turn a one-page recommendation into a sustained outcome.

### The 30/60/90 cadence

A recommendation that is never revisited is a recommendation that quietly fails. Bake review checkpoints in from day one:

- **Day 0 — Decision committed.** Owner, scope, success metrics, and the first-checkpoint date are recorded in the decision log. The artefact is linked from the team's working space so it is discoverable without asking.
- **Day 30 — Early-signal review.** Look at the leading indicators, not the lagging ones. Has the team actually started? Are the assumed dependencies real? Have any of the named risks materialised? Adjust scope, not the goal.
- **Day 60 — Course-correction window.** This is the last cheap moment to change direction. If the leading indicators are flat or negative, escalate. Silence at day 60 is the most expensive form of optimism.
- **Day 90 — Outcome review.** Measure against the success criteria captured on day 0, not against the story the team is telling now. Write the post-mortem (or pre-mortem-confirmed) in the same artefact so the rationale, the outcome, and the lessons live together.

### Stakeholder choreography

Decisions stall not because the analysis is wrong but because the choreography is wrong. Use a lightweight RACI on every recommendation:

| Role | Meaning | Anti-pattern |
|---|---|---|
| **Responsible** | Does the work | More than two people listed |
| **Accountable** | Owns the outcome, signs off | Shared accountability (always becomes no accountability) |
| **Consulted** | Two-way input before the decision | Consulted *after* the decision is made — purely performative |
| **Informed** | One-way notification after the decision | Informed people are asked to approve — wastes their time and yours |

If you cannot name a single Accountable person in one minute, the recommendation is not ready to ship.

### Writing for senior readers

Senior readers scan first, read second, and only re-read the parts they disagree with. Optimise for that pattern:

1. **Lead with the recommendation**, not the analysis. The reader should know what you want them to do before they finish the first paragraph.
2. **One screen, one page, one decision.** If the artefact needs scrolling on a laptop, it is too long for the audience it is written for.
3. **Tables beat paragraphs** for comparing options. Prose hides the trade-off; a table forces it into the open.
4. **Numbers beat adjectives.** Replace "significant" with the actual number. Replace "soon" with a date. Replace "improved" with a baseline and a target.
5. **Name the disconfirming evidence.** A recommendation that lists what would change the author's mind is read as honest; one that does not is read as advocacy.

### Common failure modes

| Failure mode | Symptom | Counter-move |
|---|---|---|
| **Analysis paralysis** | Weeks of investigation, no decision | Time-box the analysis. State the decision quality you can defend in the time available. |
| **HiPPO override** | Highest-paid person's opinion wins regardless of evidence | Force the trade-off table into the room before opinions are voiced |
| **Sunk-cost gravity** | Team defends the current path because of prior investment | Re-frame: what would we choose today with no prior investment? |
| **Scope creep at the checkpoint** | Review becomes a re-planning session | Separate "did this work?" from "what next?" Run them as two meetings. |
| **Stealth de-scoping** | Success metrics quietly soften between day 0 and day 90 | Lock the day-0 metrics into the artefact; require an explicit amendment to change them. |
| **Owner drift** | Accountable person leaves, no one re-assigns | Owner reassignment is a mandatory step in onboarding/offboarding the role |

### A worked example

> A product line is debating whether to invest in a major rewrite of a legacy service that has been failing under peak load.

A weak response: "We should rewrite it because the code is old."

A response that uses this skill:

> **Recommendation.** Do not rewrite. Invest one quarter in targeted performance work on the existing service and a parallel strangler-fig migration of the top two failing endpoints. Confidence: medium. Would change my mind if peak-load incidents continue at the current rate for two consecutive months after the performance work ships.
>
> **Options considered.** (1) Full rewrite — 9–12 months, ~$1.4M, high risk of partial delivery. (2) Performance fix in place — 6 weeks, ~$120K, addresses 80% of incident volume per last-quarter analysis. (3) Strangler-fig migration — 6 months for the two hottest endpoints, ~$400K, preserves optionality.
>
> **Plan.** Owner: Platform tech lead. Day 30: performance fix in staging with load test results. Day 60: production rollout and a 30-day incident-rate comparison. Day 90: decision on whether to expand the strangler-fig scope.
>
> **Risks.** (1) Performance fix masks a deeper architectural issue — mitigated by capturing flame graphs before and after. (2) Strangler-fig endpoints are not in fact the hottest ones — mitigated by re-running the traffic analysis at day 0. (3) Team capacity collides with a separate compliance deadline — escalated to the portfolio review on the next planning cycle.

That is the shape of output this skill should produce: a defensible, time-bound, owner-attached recommendation that respects the reader's time and survives turnover.

## Quick reference card

- One paragraph of context, three options with trade-offs, one recommendation with confidence, one plan with an owner and a date.
- If you cannot name the owner, the metric, and the checkpoint date in one breath, the artefact is not done.
- A decision without a written rationale is a rumour. A rationale without a checkpoint is a wish. A checkpoint without a metric is theatre.
- Reversibility matters more than people admit: one-way doors deserve the slow lane, two-way doors deserve the fast lane.
- The best artefacts in this category are short, dated, signed, and easy to find six months later.
