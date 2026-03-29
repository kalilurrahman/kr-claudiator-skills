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
