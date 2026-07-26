---
name: finops-strategy
description: Implement FinOps practices to optimise cloud spend without sacrificing performance. Outputs cost allocation strategy, savings recommendations, tagging taxonomy, and budgeting framework.
argument-hint: [cloud provider, monthly spend, team structure, current waste areas, chargeback model]
allowed-tools: Read, Write
---

# FinOps Strategy

FinOps is the practice of bringing financial accountability to cloud spending. Engineering teams make cost decisions; finance teams need visibility; leadership needs predictability. FinOps bridges these by making costs visible, allocatable, and actionable.

## FinOps Lifecycle

```
INFORM → OPTIMISE → OPERATE

INFORM:
  Visibility into what is being spent, by whom, on what.
  Cost allocation, tagging, unit economics.

OPTIMISE:
  Right-size resources, eliminate waste, use commitments.
  Reserved instances, Savings Plans, spot instances.

OPERATE:
  Governance, budgets, anomaly detection, culture.
  Cost reviews, chargeback, incentive alignment.
```

## Tagging Taxonomy

```hcl
# All resources must have these tags — enforced by AWS SCPs / OPA
locals {
  required_tags = {
    Environment  = var.environment          # prod | staging | dev
    Team         = var.team                 # platform | orders | payments
    Product      = var.product              # api | worker | ml
    CostCenter   = var.cost_center          # 1001 | 1002 | 1003
    Owner        = var.owner_email          # team-lead@company.com
    Project      = var.project              # order-service | ml-pipeline
  }
}

# Apply to all resources
resource "aws_instance" "app" {
  # ...
  tags = merge(local.required_tags, {
    Name = "${var.team}-${var.product}-${var.environment}"
  })
}

# Enforce tagging policy (SCP)
{
  "Effect": "Deny",
  "Action": ["ec2:RunInstances", "rds:CreateDBInstance"],
  "Resource": "*",
  "Condition": {
    "Null": {
      "aws:RequestTag/Team": "true",
      "aws:RequestTag/CostCenter": "true"
    }
  }
}
```

## Cost Allocation Query (AWS Cost Explorer via Athena)

```sql
-- Monthly cost by team and service
SELECT
    resource_tags['user:Team'] AS team,
    resource_tags['user:Product'] AS product,
    line_item_product_code AS aws_service,
    SUM(line_item_unblended_cost) AS total_cost,
    SUM(line_item_usage_amount) AS usage_amount
FROM cur_table   -- AWS Cost and Usage Reports
WHERE
    line_item_line_item_type = 'Usage'
    AND year = '2024' AND month = '03'
    AND resource_tags['user:Team'] IS NOT NULL
GROUP BY 1, 2, 3
ORDER BY total_cost DESC
LIMIT 50;

-- Unit economics: cost per 1000 API requests
WITH api_costs AS (
    SELECT SUM(line_item_unblended_cost) AS compute_cost
    FROM cur_table
    WHERE resource_tags['user:Product'] = 'api'
      AND year = '2024' AND month = '03'
),
api_requests AS (
    SELECT SUM(request_count) AS total_requests
    FROM api_metrics
    WHERE month = '2024-03'
)
SELECT
    compute_cost,
    total_requests,
    ROUND(compute_cost / total_requests * 1000, 4) AS cost_per_1k_requests
FROM api_costs, api_requests;
```

## Savings Recommendations

```python
import boto3
from dataclasses import dataclass

@dataclass
class SavingsOpportunity:
    resource_id: str
    resource_type: str
    current_monthly_cost: float
    optimised_monthly_cost: float
    monthly_savings: float
    recommendation: str
    effort: str  # low | medium | high

class CostOptimiser:
    def __init__(self):
        self.ec2 = boto3.client('ec2')
        self.ce = boto3.client('ce')
    
    def find_idle_resources(self) -> list[SavingsOpportunity]:
        opportunities = []
        
        # EC2 instances with <5% CPU for 2 weeks
        cw = boto3.client('cloudwatch')
        instances = self.ec2.describe_instances()
        
        for reservation in instances['Reservations']:
            for instance in reservation['Instances']:
                if instance['State']['Name'] != 'running':
                    continue
                
                cpu_stats = cw.get_metric_statistics(
                    Namespace='AWS/EC2',
                    MetricName='CPUUtilization',
                    Dimensions=[{'Name': 'InstanceId', 'Value': instance['InstanceId']}],
                    StartTime=datetime.utcnow() - timedelta(days=14),
                    EndTime=datetime.utcnow(),
                    Period=86400,
                    Statistics=['Average'],
                )
                
                avg_cpu = sum(p['Average'] for p in cpu_stats['Datapoints']) / max(len(cpu_stats['Datapoints']), 1)
                
                if avg_cpu < 5 and cpu_stats['Datapoints']:
                    monthly_cost = self._estimate_monthly_cost(instance['InstanceId'])
                    opportunities.append(SavingsOpportunity(
                        resource_id=instance['InstanceId'],
                        resource_type=f"EC2 {instance['InstanceType']}",
                        current_monthly_cost=monthly_cost,
                        optimised_monthly_cost=0,
                        monthly_savings=monthly_cost,
                        recommendation=f"Instance idle (avg CPU {avg_cpu:.1f}%). Consider terminating or downsizing.",
                        effort="low",
                    ))
        
        return opportunities
    
    def get_ri_recommendations(self) -> list[SavingsOpportunity]:
        """Savings Plans / Reserved Instance recommendations."""
        response = self.ce.get_reservation_purchase_recommendation(
            Service='Amazon EC2',
            LookbackPeriodInDays='SIXTY_DAYS',
            TermInYears='ONE_YEAR',
            PaymentOption='PARTIAL_UPFRONT',
        )
        # Parse and return recommendations
        ...
```

## Budget and Anomaly Detection

```hcl
# Terraform: AWS Budgets
resource "aws_budgets_budget" "monthly_total" {
  name              = "monthly-total-budget"
  budget_type       = "COST"
  limit_amount      = "50000"
  limit_unit        = "USD"
  time_unit         = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = ["finops@company.com", "engineering-leads@company.com"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "FORECASTED"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = ["finops@company.com", "cto@company.com"]
  }
}

resource "aws_budgets_budget" "team_budget" {
  for_each = var.team_budgets  # { "platform": 15000, "orders": 10000 }
  
  name         = "${each.key}-monthly-budget"
  budget_type  = "COST"
  limit_amount = tostring(each.value)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  
  cost_filter {
    name   = "TagKeyValue"
    values = ["user:Team$${each.key}"]
  }
}
```

## Monthly FinOps Report Template

```markdown
# Cloud Cost Report — March 2024

## Summary
Total spend: $47,832 (budget: $50,000 — 96%)
MoM change: +8% ($3,612)
YoY change: +22%
Savings implemented this month: $2,100

## Top Cost Drivers
| Team | Service | Cost | MoM | Note |
|------|---------|------|-----|------|
| Orders | EC2/ECS | $12,400 | +15% | Traffic growth |
| Platform | RDS | $8,200 | +2% | Stable |
| ML | SageMaker | $6,800 | +45% | New training job |

## Savings Opportunities (Total: $4,200/month)
1. 3× idle EC2 instances: $900/month — terminate (low effort)
2. RDS Multi-AZ dev environments: $1,200/month — downgrade to single-AZ in dev
3. Reserved Instances for baseline compute: $2,100/month savings — purchase 1yr RI

## Actions This Month
- [ ] Terminate idle EC2 instances (platform team, by Mar 20)
- [ ] Dev RDS downgrade (DBA team, by Mar 25)
- [ ] RI purchase approval (FinOps + Finance, by Mar 31)
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No tagging enforcement** | Can't allocate costs to teams | SCP + OPA policies block untagged resource creation |
| **Engineering doesn't see their costs** | No accountability | Team-level cost dashboards visible to all engineers |
| **Optimising dev environments last** | Easy savings ignored | Dev/staging often 30-40% of spend with the most waste |
| **Commitments without baseline analysis** | Buying RIs for the wrong instance types | 60-day usage analysis before any commitment purchase |
| **Chargeback without context** | Teams see cost without understanding | Show cost per unit (per request, per user) not just absolute |

## 10 Rules

1. Every resource has a Team and CostCenter tag — enforced by policy, not honour system.
2. Engineers see their team's cloud costs in a shared dashboard — not just finance.
3. Unit economics matter more than absolute cost — cost per API call, per user, per job.
4. Reserved Instances/Savings Plans require 60-day usage analysis first — never buy blind.
5. Dev and staging environments are the highest-ROI optimisation target — often 30-40% of spend.
6. Anomaly alerts fire at 20% above forecast — catch surprises before they become budget overruns.
7. Monthly cost reviews are engineering meetings, not finance meetings.
8. Idle resources older than 30 days are deleted — not "we'll do it eventually."
9. Spot/preemptible instances for stateless workloads — 70-80% savings, negligible risk.
10. FinOps is a culture, not a tool — the goal is engineers making cost-conscious decisions.
