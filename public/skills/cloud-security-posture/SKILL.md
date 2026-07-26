---
name: cloud-security-posture
description: Assess and improve cloud security posture across AWS, GCP, or Azure. Outputs CSPM findings, misconfiguration remediation, IAM least-privilege analysis, and continuous monitoring setup.
argument-hint: [cloud provider, account count, compliance framework, current tooling]
allowed-tools: Read, Write, Bash
---

# Cloud Security Posture Management (CSPM)

Cloud misconfigurations are the leading cause of cloud security breaches — not sophisticated exploits. Publicly accessible S3 buckets, overly permissive IAM roles, and unencrypted databases are common findings. CSPM is the continuous practice of detecting, prioritising, and remediating these misconfigurations.

## Process

1. **Enable cloud-native security tools.** AWS Security Hub, GCP Security Command Center, Azure Defender for Cloud — free baselines with no agents.
2. **Deploy CSPM scanner.** Prowler (open source), Wiz, Orca, or Lacework for comprehensive multi-account coverage.
3. **Triage findings.** Prioritise by severity and exploitability. Critically exposed resources (public internet facing) first.
4. **Remediate programmatically.** Fix misconfigurations in IaC; detect drift with policy-as-code.
5. **Enforce with guardrails.** AWS SCPs, GCP Organization Policies — prevent misconfigurations from being created.
6. **IAM least privilege.** Analyse and reduce excessive permissions.
7. **Monitor continuously.** CloudTrail / Cloud Audit Logs — alert on high-risk API calls.

## AWS Security Assessment with Prowler

```bash
# Install and run Prowler — open source CSPM for AWS
pip install prowler

# Full assessment (all checks)
prowler aws --output-formats json html csv \
  --output-directory prowler-output/ \
  --log-level ERROR

# Focused: critical and high only
prowler aws \
  --severity critical high \
  --output-formats json \
  --output-directory prowler-output/

# Compliance framework: CIS AWS Benchmark
prowler aws --compliance cis_2.0_aws

# Specific service checks
prowler aws --services s3 iam ec2 rds

# Parse critical findings
python3 << 'EOF'
import json
from pathlib import Path

findings = []
for f in Path("prowler-output").glob("*.json"):
    data = json.loads(f.read_text())
    for r in data:
        if r.get('status') == 'FAIL' and r.get('severity') in ['critical', 'high']:
            findings.append({
                "check": r['check_id'],
                "title": r['check_title'],
                "severity": r['severity'],
                "resource": r.get('resource_id'),
                "region": r.get('region'),
                "remediation": r.get('remediation', {}).get('recommendation', {}).get('text'),
            })

findings.sort(key=lambda x: {'critical': 0, 'high': 1}.get(x['severity'], 2))
for f in findings[:20]:
    print(f"[{f['severity'].upper()}] {f['title']}")
    print(f"  Resource: {f['resource']}")
    print(f"  Fix: {f['remediation']}\n")
EOF
```

## IAM Least Privilege Analysis

```python
import boto3
from datetime import datetime, timedelta

class IAMAnalyser:
    def __init__(self):
        self.iam = boto3.client('iam')
        self.access_analyser = boto3.client('accessanalyzer')
    
    def find_unused_permissions(self, days_threshold: int = 90) -> list:
        """Find permissions not used in the last N days."""
        findings = []
        
        # Generate service last accessed report
        paginator = self.iam.get_paginator('list_roles')
        for page in paginator.paginate():
            for role in page['Roles']:
                role_arn = role['Arn']
                
                try:
                    # Get last access for each service
                    response = self.iam.generate_service_last_accessed_details(Arn=role_arn)
                    job_id = response['JobId']
                    
                    # Wait for completion
                    import time
                    while True:
                        details = self.iam.get_service_last_accessed_details(JobId=job_id)
                        if details['JobStatus'] in ['COMPLETED', 'FAILED']: break
                        time.sleep(1)
                    
                    cutoff = datetime.utcnow() - timedelta(days=days_threshold)
                    unused_services = []
                    
                    for service in details.get('ServicesLastAccessed', []):
                        last_used = service.get('LastAuthenticated')
                        if last_used is None or last_used.replace(tzinfo=None) < cutoff:
                            unused_services.append(service['ServiceName'])
                    
                    if unused_services:
                        findings.append({
                            "role": role['RoleName'],
                            "role_arn": role_arn,
                            "unused_services": unused_services,
                            "recommendation": f"Remove permissions for: {', '.join(unused_services[:5])}",
                        })
                
                except Exception as e:
                    pass  # Skip roles we can't analyse
        
        return findings
    
    def find_overly_permissive_roles(self) -> list:
        """Find roles with wildcard permissions."""
        findings = []
        paginator = self.iam.get_paginator('list_roles')
        
        for page in paginator.paginate():
            for role in page['Roles']:
                # Get inline policies
                for policy_name in self.iam.list_role_policies(
                    RoleName=role['RoleName']
                )['PolicyNames']:
                    policy = self.iam.get_role_policy(
                        RoleName=role['RoleName'],
                        PolicyName=policy_name,
                    )['PolicyDocument']
                    
                    for statement in policy.get('Statement', []):
                        if statement.get('Effect') != 'Allow': continue
                        actions = statement.get('Action', [])
                        resources = statement.get('Resource', [])
                        
                        if isinstance(actions, str): actions = [actions]
                        if isinstance(resources, str): resources = [resources]
                        
                        if '*' in actions and '*' in resources:
                            findings.append({
                                "severity": "CRITICAL",
                                "role": role['RoleName'],
                                "policy": policy_name,
                                "finding": "AdministratorAccess equivalent — Action: *, Resource: *",
                            })
                        elif '*' in actions:
                            findings.append({
                                "severity": "HIGH",
                                "role": role['RoleName'],
                                "policy": policy_name,
                                "finding": f"Wildcard action on resources: {resources[:3]}",
                            })
        return findings
    
    def find_public_resources(self) -> list:
        """Find publicly accessible AWS resources."""
        findings = []
        
        # S3 public buckets
        s3 = boto3.client('s3')
        for bucket in s3.list_buckets()['Buckets']:
            name = bucket['Name']
            try:
                acl = s3.get_bucket_acl(Bucket=name)
                for grant in acl['Grants']:
                    if grant['Grantee'].get('URI') == 'http://acs.amazonaws.com/groups/global/AllUsers':
                        findings.append({
                            "severity": "CRITICAL",
                            "service": "S3",
                            "resource": name,
                            "finding": "Bucket publicly accessible via ACL",
                            "fix": f"aws s3api put-bucket-acl --bucket {name} --acl private"
                        })
                
                public_access = s3.get_public_access_block(Bucket=name)['PublicAccessBlockConfiguration']
                if not all(public_access.values()):
                    findings.append({
                        "severity": "HIGH",
                        "service": "S3",
                        "resource": name,
                        "finding": "Public access block not fully enabled",
                        "fix": f"aws s3api put-public-access-block --bucket {name} --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
                    })
            except Exception:
                pass
        
        # RDS public instances
        rds = boto3.client('rds')
        for db in rds.describe_db_instances()['DBInstances']:
            if db.get('PubliclyAccessible'):
                findings.append({
                    "severity": "CRITICAL",
                    "service": "RDS",
                    "resource": db['DBInstanceIdentifier'],
                    "finding": "RDS instance is publicly accessible",
                    "fix": f"aws rds modify-db-instance --db-instance-identifier {db['DBInstanceIdentifier']} --no-publicly-accessible --apply-immediately"
                })
        
        return findings
```

## Service Control Policies (AWS SCPs)

```json
// Prevent root account usage
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyRootAccess",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "*",
      "Resource": "*",
      "Condition": {
        "StringLike": {
          "aws:PrincipalArn": "arn:aws:iam::*:root"
        }
      }
    },
    {
      "Sid": "RequireMFA",
      "Effect": "Deny",
      "NotAction": [
        "iam:CreateVirtualMFADevice",
        "iam:EnableMFADevice",
        "iam:GetUser",
        "iam:ListMFADevices",
        "iam:ListVirtualMFADevices",
        "iam:ResyncMFADevice",
        "sts:GetSessionToken"
      ],
      "Resource": "*",
      "Condition": {
        "BoolIfExists": {
          "aws:MultiFactorAuthPresent": "false"
        },
        "StringNotEquals": {
          "aws:PrincipalType": ["Service", "AssumedRole"]
        }
      }
    },
    {
      "Sid": "DenyDisableCloudTrail",
      "Effect": "Deny",
      "Action": [
        "cloudtrail:DeleteTrail",
        "cloudtrail:StopLogging",
        "cloudtrail:PutEventSelectors"
      ],
      "Resource": "*"
    },
    {
      "Sid": "EnforceDataResidency",
      "Effect": "Deny",
      "Action": "*",
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:RequestedRegion": ["us-east-1", "us-west-2"]
        },
        "StringNotLike": {
          "aws:PrincipalARN": "arn:aws:iam::*:role/AllowedGlobalRole"
        }
      }
    }
  ]
}
```

## CloudTrail Alerting

```python
# Alert on high-risk API calls
HIGH_RISK_EVENTS = {
    "ConsoleLogin":          "Root account login",
    "DeleteTrail":           "CloudTrail disabled",
    "StopLogging":           "CloudTrail logging stopped",
    "DeleteBucket":          "S3 bucket deleted",
    "PutBucketPolicy":       "S3 bucket policy changed",
    "CreateUser":            "IAM user created",
    "AttachUserPolicy":      "Admin policy attached to user",
    "CreateAccessKey":       "Access key created",
    "AuthorizeSecurityGroupIngress": "Security group opened",
}

# EventBridge rule to trigger Lambda on these events
# (Terraform)
resource "aws_cloudwatch_event_rule" "security_events" {
  name = "high-risk-api-calls"
  event_pattern = jsonencode({
    source      = ["aws.cloudtrail"]
    detail-type = ["AWS API Call via CloudTrail"]
    detail = {
      eventName = keys(HIGH_RISK_EVENTS)
    }
  })
}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Manual posture checks** | Drift undetected between audits | Continuous automated scanning |
| **Fixing findings in console only** | IaC drift; reverts on next deploy | Fix in Terraform/CloudFormation; never in console |
| **Alerting on all findings** | Alert fatigue → ignored alerts | Prioritise by severity + exposure (internet-facing first) |
| **No baseline** | Can't measure improvement | Score posture on day 1; track over time |
| **SCPs as afterthought** | Misconfigurations created before prevention | SCPs deployed before onboarding accounts |
| **Shared admin credentials** | No accountability; can't revoke individual access | Individual IAM users with MFA; no shared root |

## 10 Rules

1. Enable AWS Security Hub / GCP SCC / Azure Defender from day one — free baselines cost nothing.
2. Public internet-facing misconfigurations (S3 ACLs, RDS publicly accessible) are Priority 1 — all else waits.
3. Fix misconfigurations in IaC, not the console — console fixes revert on next deployment.
4. SCPs prevent misconfigurations from being created — they are more valuable than detection.
5. IAM least privilege is not a one-time exercise — review access quarterly and after every incident.
6. Root account has no access keys — ever. MFA required. Used only for break-glass scenarios.
7. CloudTrail is enabled in every region, every account, with log file integrity enabled.
8. Track posture score over time — a CSPM finding fixed and regressed is worse than unfixed.
9. Misconfigurations in dev/staging accounts are a preview of production — fix them.
10. CSPM findings without owners don't get fixed — assign every finding to a team with an SLA.
