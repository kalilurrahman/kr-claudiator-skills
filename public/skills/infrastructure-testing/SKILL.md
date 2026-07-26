---
name: infrastructure-testing
description: Test infrastructure-as-code using automated frameworks. Covers unit tests for Terraform modules, integration tests with Terratest, compliance checks with OPA/Checkov, and drift detection.
argument-hint: [IaC tool, cloud provider, compliance requirements, test scope]
allowed-tools: Read, Write, Bash
---

# Infrastructure Testing

Infrastructure code is production code. Terraform modules, Helm charts, and Ansible playbooks deserve the same testing rigour as application code. Untested infrastructure causes outages, security vulnerabilities, and compliance failures.

## Testing Pyramid for IaC

| Level | What | Tools | Speed | Cost |
|-------|------|-------|-------|------|
| Static analysis | Syntax, style, security rules | tflint, checkov, tfsec | Seconds | Free |
| Unit tests | Module logic without real resources | Terraform test, mock providers | Minutes | Free |
| Integration tests | Real resources in isolated environment | Terratest, Kitchen-Terraform | 10-30 min | Cloud cost |
| Compliance tests | Policy enforcement | OPA, Conftest, AWS Config | Seconds-minutes | Free |
| Drift detection | Detect manual changes to live infra | terraform plan in CI, driftctl | Minutes | Free |

## Process

1. **Add static analysis to CI** -- tflint and checkov catch 80% of issues in seconds.
2. **Write unit tests for module logic** -- test variable defaults, validation, output values.
3. **Build integration test environments** -- ephemeral, isolated, destroyed after test.
4. **Define compliance policies** -- encode security and cost rules as code.
5. **Schedule drift detection** -- daily `terraform plan` against production detects manual changes.
6. **Test destruction** -- verify `terraform destroy` completes cleanly (no orphaned resources).
7. **Measure test coverage** -- which modules have no tests? Prioritize by risk.
8. **Run tests in CI on every PR** -- fail the PR if any test fails.

## Output Format

### Checkov Static Analysis (CI step)

```yaml
# .github/workflows/infra-test.yml
name: Infrastructure Tests
on: [push, pull_request]

jobs:
  static-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: tflint
        uses: terraform-linters/setup-tflint@v4
        with: { tflint_version: v0.50.0 }
      - run: |
          tflint --init
          tflint --recursive --format compact

      - name: Checkov security scan
        uses: bridgecrewio/checkov-action@master
        with:
          directory: ./terraform
          framework: terraform
          soft_fail: false
          output_format: cli,sarif
          output_file_path: checkov-results.sarif

      - name: tfsec
        uses: aquasecurity/tfsec-action@v1.0.0
        with:
          soft_fail: false

  terraform-validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: |
          for dir in $(find . -name "*.tf" -exec dirname {} \; | sort -u); do
            echo "Validating $dir"
            (cd "$dir" && terraform init -backend=false && terraform validate)
          done
```

### Terratest Integration Test

```go
// test/modules/vpc_test.go
package test

import (
    "testing"
    "github.com/gruntwork-io/terratest/modules/terraform"
    "github.com/gruntwork-io/terratest/modules/aws"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestVPCModule(t *testing.T) {
    t.Parallel()

    awsRegion := "us-east-1"

    terraformOptions := &terraform.Options{
        TerraformDir: "../../modules/vpc",
        Vars: map[string]interface{}{
            "name":               "test-vpc",
            "cidr_block":         "10.100.0.0/16",
            "availability_zones": []string{"us-east-1a", "us-east-1b"},
            "environment":        "test",
        },
        EnvVars: map[string]string{
            "AWS_DEFAULT_REGION": awsRegion,
        },
    }

    // Destroy after test completes
    defer terraform.Destroy(t, terraformOptions)
    terraform.InitAndApply(t, terraformOptions)

    // Verify outputs
    vpcID := terraform.Output(t, terraformOptions, "vpc_id")
    require.NotEmpty(t, vpcID, "VPC ID should not be empty")

    // Verify VPC exists and has correct CIDR
    vpc := aws.GetVpcById(t, vpcID, awsRegion)
    assert.Equal(t, "10.100.0.0/16", aws.GetCidrBlockOfVpc(t, vpc))

    // Verify subnets
    publicSubnetIDs  := terraform.OutputList(t, terraformOptions, "public_subnet_ids")
    privateSubnetIDs := terraform.OutputList(t, terraformOptions, "private_subnet_ids")
    assert.Len(t, publicSubnetIDs, 2, "Should have 2 public subnets")
    assert.Len(t, privateSubnetIDs, 2, "Should have 2 private subnets")

    // Verify tags
    tags := aws.GetTagsForVpc(t, vpcID, awsRegion)
    assert.Equal(t, "test", tags["Environment"])
    assert.Equal(t, "test-vpc", tags["Name"])
}

func TestRDSModuleWithRetry(t *testing.T) {
    t.Parallel()

    opts := &terraform.Options{
        TerraformDir: "../../modules/rds",
        Vars: map[string]interface{}{
            "instance_class": "db.t3.micro",
            "engine_version": "15.4",
            "multi_az":       false,  // single-AZ for tests (cost)
        },
        RetryableTerraformErrors: map[string]string{
            ".*timeout.*": "Transient timeout; retrying",
        },
        MaxRetries:         3,
        TimeBetweenRetries: 10 * time.Second,
    }
    defer terraform.Destroy(t, opts)
    terraform.InitAndApply(t, opts)

    endpoint := terraform.Output(t, opts, "endpoint")
    assert.Contains(t, endpoint, ".rds.amazonaws.com")
}
```

### OPA/Conftest Policy Tests

```rego
# policies/terraform/required_tags.rego
package terraform.required_tags

import future.keywords.in

required_tags := {"Environment", "Team", "CostCenter"}

deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_instance"
    resource.change.actions[_] in ["create", "update"]
    
    missing := required_tags - {k | resource.change.after.tags[k]}
    count(missing) > 0
    
    msg := sprintf(
        "EC2 instance '%s' is missing required tags: %v",
        [resource.address, missing]
    )
}

deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_s3_bucket"
    resource.change.actions[_] in ["create", "update"]
    
    not resource.change.after.tags["CostCenter"]
    msg := sprintf("S3 bucket '%s' must have a CostCenter tag", [resource.address])
}
```

```rego
# policies/terraform/no_public_s3.rego
package terraform.no_public_s3

deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_s3_bucket_public_access_block"
    
    not resource.change.after.block_public_acls
    msg := sprintf("S3 bucket ACL blocking must be enabled for '%s'", [resource.address])
}

deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_s3_bucket_acl"
    resource.change.after.acl == "public-read"
    msg := sprintf("S3 bucket '%s' must not have public-read ACL", [resource.address])
}
```

```bash
# Run OPA policies against Terraform plan
terraform plan -out=tfplan
terraform show -json tfplan > tfplan.json
conftest test tfplan.json --policy policies/terraform/
```

### Terraform Native Tests (Terraform 1.6+)

```hcl
# modules/s3/tests/bucket.tftest.hcl
run "creates_bucket_with_versioning" {
  command = apply

  variables {
    bucket_name  = "test-bucket-${run.id}"
    enable_versioning = true
    environment  = "test"
  }

  assert {
    condition     = aws_s3_bucket.main.bucket == "test-bucket-${run.id}"
    error_message = "Bucket name does not match input variable"
  }

  assert {
    condition     = aws_s3_bucket_versioning.main.versioning_configuration[0].status == "Enabled"
    error_message = "Versioning should be enabled"
  }

  assert {
    condition     = aws_s3_bucket_server_side_encryption_configuration.main != null
    error_message = "Encryption must be configured"
  }
}

run "rejects_public_access" {
  command = plan
  expect_failures = [aws_s3_bucket_acl.main]

  variables {
    bucket_name = "test-public-${run.id}"
    acl         = "public-read"  # Should fail validation
  }
}
```

### Drift Detection in CI

```yaml
# .github/workflows/drift-detection.yml
name: Drift Detection
on:
  schedule:
    - cron: '0 9 * * 1-5'  # weekdays at 9am
  workflow_dispatch:

jobs:
  detect-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/TerraformReadOnly
          aws-region: us-east-1

      - name: Terraform plan (drift check)
        id: plan
        run: |
          cd terraform/production
          terraform init
          terraform plan -detailed-exitcode -out=drift.tfplan 2>&1 | tee plan-output.txt
          echo "exit_code=$?" >> $GITHUB_OUTPUT
        continue-on-error: true

      - name: Alert on drift
        if: steps.plan.outputs.exit_code == '2'
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": ":rotating_light: Infrastructure drift detected in production!\n```$(cat plan-output.txt | tail -20)```",
              "channel": "#infra-alerts"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Testing only in production | First test is a real outage | Ephemeral test environments with Terratest |
| No cleanup after tests | Orphaned resources accumulate cost | Always `defer terraform.Destroy()` in tests |
| Testing with production state | Tests affect live infrastructure | Separate state backends per environment |
| No compliance-as-code | Policy drift discovered in audit | OPA/Conftest policies enforced in CI |
| Skipping destroy test | Module that cannot be destroyed is a liability | Explicitly test `terraform destroy` |
| Manual drift remediation | Drift is fixed manually; root cause ignored | Alert on drift; fix the process that caused it |

## Rules

- **Static analysis in every CI pipeline** -- checkov and tflint catch security issues before any resource is created.
- **Ephemeral test environments** -- integration tests create and destroy real resources; never test against shared environments.
- **Always defer destroy in Terratest** -- resource cleanup must happen even if the test fails.
- **Compliance-as-code is mandatory** -- OPA or Conftest policies enforced in CI; not just documentation.
- **Test module inputs, outputs, and side effects** -- a module test that only checks `terraform apply` succeeds is not a test.
- **Drift detection on a schedule** -- manual changes to production infrastructure must be caught and documented.
- **Separate state per environment** -- test, staging, and production must have isolated state backends.
- **Module tests must be idempotent** -- running the test twice produces the same result.
- **Track test cost** -- integration tests create real resources; monitor and optimize cloud cost of CI.
- **Failing test = blocked PR** -- infrastructure test failures are not optional; treat them the same as application test failures.
