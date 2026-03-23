---
name: cost-optimization
description: Reduce cloud infrastructure costs through right-sizing, reserved capacity, spot instances, autoscaling, and waste elimination. Outputs cost analysis reports, rightsizing recommendations, and automated cleanup pipelines.
argument-hint: [cloud provider, current monthly spend, main cost drivers, optimization targets]
allowed-tools: Read, Write, Bash
---

# Cloud Cost Optimization

Cloud costs grow faster than usage because resources are over-provisioned, idle resources accumulate, and nobody owns the bill. Cost optimization is not a one-time project — it is a continuous engineering practice.

## Cost Reduction Hierarchy

1. **Eliminate waste** — delete unused resources (highest ROI, zero tradeoffs)
2. **Right-size** — match resource size to actual utilization
3. **Autoscale** — dynamically match capacity to demand
4. **Commit to reserved capacity** — 1-3 year commitments for stable workloads
5. **Use spot/preemptible instances** — for fault-tolerant, interruptible workloads
6. **Optimize data transfer** — reduce cross-region and egress costs

## Process

1. **Baseline current spend** — cost by service, team, environment, and resource type.
2. **Find waste** — idle EC2/RDS, unattached EBS, old snapshots, unused load balancers.
3. **Right-size compute** — analyze CPU/memory utilization; resize over-provisioned instances.
4. **Review storage classes** — move cold data to cheaper tiers automatically.
5. **Implement autoscaling** — eliminate weekend/night idle capacity.
6. **Purchase commitments** — savings plans or reserved instances for stable workloads.
7. **Set budgets and alerts** — automated alerts before budgets are exceeded.
8. **Implement tagging** — enforce cost allocation by team/service/environment.

## Output Format

### Cost Analysis Script (AWS)

```python
# cost_analysis/aws_cost_reporter.py
import boto3
from datetime import datetime, timedelta
from dataclasses import dataclass
from collections import defaultdict

@dataclass
class CostItem:
    service: str
    amount_usd: float
    change_pct: float  # vs. prior period
    top_resources: list

class AWSCostAnalyzer:
    def __init__(self):
        self.ce = boto3.client("ce")  # Cost Explorer
        self.ec2 = boto3.client("ec2")
        self.cloudwatch = boto3.client("cloudwatch")
    
    def get_cost_by_service(self, days: int = 30) -> list[CostItem]:
        end = datetime.today()
        start = end - timedelta(days=days)
        prior_start = start - timedelta(days=days)
        
        # Current period
        current = self.ce.get_cost_and_usage(
            TimePeriod={"Start": start.strftime("%Y-%m-%d"), "End": end.strftime("%Y-%m-%d")},
            Granularity="MONTHLY",
            Metrics=["UnblendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}]
        )
        
        # Prior period for comparison
        prior = self.ce.get_cost_and_usage(
            TimePeriod={"Start": prior_start.strftime("%Y-%m-%d"), "End": start.strftime("%Y-%m-%d")},
            Granularity="MONTHLY",
            Metrics=["UnblendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}]
        )
        
        current_costs = {
            g["Keys"][0]: float(g["Metrics"]["UnblendedCost"]["Amount"])
            for result in current["ResultsByTime"]
            for g in result["Groups"]
        }
        prior_costs = {
            g["Keys"][0]: float(g["Metrics"]["UnblendedCost"]["Amount"])
            for result in prior["ResultsByTime"]
            for g in result["Groups"]
        }
        
        items = []
        for service, amount in sorted(current_costs.items(), key=lambda x: -x[1]):
            prior_amount = prior_costs.get(service, 0)
            change_pct = ((amount - prior_amount) / prior_amount * 100) if prior_amount > 0 else 0
            items.append(CostItem(
                service=service,
                amount_usd=round(amount, 2),
                change_pct=round(change_pct, 1),
                top_resources=[]
            ))
        
        return items
    
    def find_idle_ec2(self) -> list[dict]:
        """Find EC2 instances with <5% CPU over 14 days — likely candidates for termination."""
        instances = self.ec2.describe_instances(
            Filters=[{"Name": "instance-state-name", "Values": ["running"]}]
        )
        
        idle = []
        end = datetime.utcnow()
        start = end - timedelta(days=14)
        
        for reservation in instances["Reservations"]:
            for instance in reservation["Instances"]:
                instance_id = instance["InstanceId"]
                instance_type = instance["InstanceType"]
                
                metrics = self.cloudwatch.get_metric_statistics(
                    Namespace="AWS/EC2",
                    MetricName="CPUUtilization",
                    Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
                    StartTime=start,
                    EndTime=end,
                    Period=86400,  # Daily
                    Statistics=["Average"]
                )
                
                if metrics["Datapoints"]:
                    avg_cpu = sum(d["Average"] for d in metrics["Datapoints"]) / len(metrics["Datapoints"])
                    
                    if avg_cpu < 5.0:  # Less than 5% avg CPU
                        name = next(
                            (t["Value"] for t in instance.get("Tags", []) if t["Key"] == "Name"),
                            "unnamed"
                        )
                        idle.append({
                            "instance_id": instance_id,
                            "instance_type": instance_type,
                            "name": name,
                            "avg_cpu_14d": round(avg_cpu, 2),
                            "monthly_cost_usd": INSTANCE_PRICES.get(instance_type, 0) * 720,
                        })
        
        return sorted(idle, key=lambda x: -x["monthly_cost_usd"])
    
    def find_unattached_ebs(self) -> list[dict]:
        """EBS volumes not attached to any instance — pure waste."""
        volumes = self.ec2.describe_volumes(
            Filters=[{"Name": "status", "Values": ["available"]}]
        )
        
        return [
            {
                "volume_id": v["VolumeId"],
                "size_gb": v["Size"],
                "volume_type": v["VolumeType"],
                "monthly_cost_usd": self._ebs_monthly_cost(v["VolumeType"], v["Size"]),
                "created": v["CreateTime"].isoformat(),
                "name": next((t["Value"] for t in v.get("Tags", []) if t["Key"] == "Name"), "unnamed"),
            }
            for v in volumes["Volumes"]
        ]
    
    def _ebs_monthly_cost(self, volume_type: str, size_gb: int) -> float:
        prices = {"gp3": 0.08, "gp2": 0.10, "io1": 0.125, "st1": 0.045, "sc1": 0.025}
        return round(prices.get(volume_type, 0.08) * size_gb, 2)
```

### S3 Intelligent Tiering

```python
# storage/s3_lifecycle.py
import boto3

def apply_cost_lifecycle_rules(bucket_name: str):
    s3 = boto3.client("s3")
    
    s3.put_bucket_lifecycle_configuration(
        Bucket=bucket_name,
        LifecycleConfiguration={
            "Rules": [
                {
                    "ID": "intelligent-tiering-all",
                    "Status": "Enabled",
                    "Filter": {"Prefix": ""},
                    "Transitions": [
                        {"Days": 30, "StorageClass": "INTELLIGENT_TIERING"},
                    ],
                },
                {
                    "ID": "archive-logs",
                    "Status": "Enabled",
                    "Filter": {"Prefix": "logs/"},
                    "Transitions": [
                        {"Days": 90, "StorageClass": "GLACIER_IR"},
                        {"Days": 365, "StorageClass": "DEEP_ARCHIVE"},
                    ],
                    "Expiration": {"Days": 2555},  # 7 years
                },
                {
                    "ID": "delete-incomplete-multipart",
                    "Status": "Enabled",
                    "Filter": {"Prefix": ""},
                    "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 7},
                },
            ]
        }
    )
    print(f"Applied lifecycle rules to {bucket_name}")
```

### Automated Waste Cleanup

```python
# automation/cleanup.py
import boto3

class WasteEliminator:
    """Automated cleanup of unambiguous waste. Always dry-run first."""
    
    def __init__(self, dry_run: bool = True):
        self.dry_run = dry_run
        self.ec2 = boto3.client("ec2")
    
    def delete_old_snapshots(self, retention_days: int = 30) -> list[str]:
        """Delete EBS snapshots older than retention_days with no tags."""
        cutoff = datetime.utcnow() - timedelta(days=retention_days)
        
        snapshots = self.ec2.describe_snapshots(OwnerIds=["self"])["Snapshots"]
        to_delete = [
            s for s in snapshots
            if s["StartTime"].replace(tzinfo=None) < cutoff
            and not s.get("Tags")  # Only untagged — tagged may be intentional
        ]
        
        deleted = []
        for snap in to_delete:
            if not self.dry_run:
                self.ec2.delete_snapshot(SnapshotId=snap["SnapshotId"])
            deleted.append(snap["SnapshotId"])
            print(f"{'[DRY RUN] ' if self.dry_run else ''}Deleted snapshot {snap['SnapshotId']}")
        
        return deleted
    
    def release_unattached_eips(self) -> list[str]:
        """Elastic IPs not associated with any resource cost $3.65/month each."""
        addresses = self.ec2.describe_addresses()["Addresses"]
        unassociated = [a for a in addresses if "AssociationId" not in a]
        
        released = []
        for addr in unassociated:
            if not self.dry_run:
                self.ec2.release_address(AllocationId=addr["AllocationId"])
            released.append(addr.get("PublicIp"))
        
        return released
```

### Cost Budgets & Alerts

```python
# budgets/alerts.py
import boto3

def create_cost_budget(name: str, monthly_limit_usd: float, alert_pct: float = 80):
    budgets = boto3.client("budgets")
    account_id = boto3.client("sts").get_caller_identity()["Account"]
    
    budgets.create_budget(
        AccountId=account_id,
        Budget={
            "BudgetName": name,
            "BudgetLimit": {"Amount": str(monthly_limit_usd), "Unit": "USD"},
            "TimeUnit": "MONTHLY",
            "BudgetType": "COST",
        },
        NotificationsWithSubscribers=[
            {
                "Notification": {
                    "NotificationType": "ACTUAL",
                    "ComparisonOperator": "GREATER_THAN",
                    "Threshold": alert_pct,
                    "ThresholdType": "PERCENTAGE",
                },
                "Subscribers": [{"SubscriptionType": "EMAIL", "Address": "infra@example.com"}]
            },
            {
                "Notification": {
                    "NotificationType": "FORECASTED",
                    "ComparisonOperator": "GREATER_THAN",
                    "Threshold": 100,
                    "ThresholdType": "PERCENTAGE",
                },
                "Subscribers": [{"SubscriptionType": "EMAIL", "Address": "infra@example.com"}]
            }
        ]
    )
```

## Rules

- **Waste elimination before optimization** — deleting an idle RDS instance saves 100% of its cost; right-sizing saves 30%.
- **Tag everything from day one** — untagged resources cannot be attributed; enforce tagging in CI and IAM policies.
- **Reserved instances for predictable workloads only** — committing to reserved capacity for bursty workloads wastes money.
- **Spot instances require fault-tolerant architectures** — design for interruption first, then use spot.
- **Right-sizing requires 2+ weeks of utilization data** — never right-size based on peak or a single day.
- **Set budgets before you need them** — discovering overspend at month-end is too late; alert at 80% of budget.
- **Autoscaling to zero on evenings/weekends** — dev/staging environments do not need to run 24/7.
- **Compress and deduplicate before storing** — storage is cheap per GB, but logging uncompressed petabytes is not.
- **Cost optimization is a team sport** — engineers who write the code should see the cost it generates.
- **Measure savings, not just spending** — track cost per request, cost per user, and cost per transaction.

## Worked Example and Anti-Patterns

### Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| No runbook | On-call engineer has no guidance during incident | Write runbook before going to production |
| Single point of failure | One component down takes everything with it | Design for redundancy at every layer |
| No monitoring | Problems discovered by users, not engineers | Instrument before launch |
| Manual toil | Repeated manual steps slow down and introduce errors | Automate anything done more than twice |
| Undocumented decisions | Next engineer repeats the same mistakes | Use Architecture Decision Records (ADRs) |

### Rules

- **Start with the simplest thing that works** -- complexity should be earned, not assumed.
- **Make it observable before making it complex** -- logs, metrics, and traces first.
- **Automate toil** -- anything done manually more than twice should be scripted.
- **Document decisions** -- use ADRs; future engineers will thank you.
- **Test failure modes** -- chaos engineering starts small; break one thing at a time.
- **Prefer reversible decisions** -- irreversible architecture decisions need the most careful thought.
- **Own your runbooks** -- every service needs a runbook before it goes to production.
- **Measure before optimizing** -- do not optimize what you have not profiled.
- **Design for the 99th percentile user** -- the average case is not the hard case.
- **Keep it boring** -- stable, predictable, well-understood technology over cutting-edge.

