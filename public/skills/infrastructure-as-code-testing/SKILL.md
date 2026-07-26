---
name: infrastructure-as-code-testing
description: Test Terraform, Pulumi, and CloudFormation infrastructure code before deployment. Outputs unit tests, integration tests, compliance checks, and CI pipeline for IaC validation.
argument-hint: [IaC tool, cloud provider, compliance framework, test framework]
allowed-tools: Read, Write, Bash
---

# Infrastructure as Code Testing

IaC is production code. Untested Terraform is how you accidentally delete a production database or open port 22 to 0.0.0.0/0. Test IaC at multiple levels: static analysis, unit tests against the plan, integration tests against real cloud, and compliance checks.

## Test Pyramid for IaC

```
                    ┌───────────────────┐
                    │ Compliance Tests  │  ← Policy checks (OPA, Checkov)
                    │    (slowest)      │    Run in CI, block merge
                    └───────────────────┘
                  ┌─────────────────────────┐
                  │  Integration Tests      │  ← Terratest, real cloud
                  │  (slow, $)             │    Run nightly or pre-release
                  └─────────────────────────┘
              ┌─────────────────────────────────┐
              │     Unit Tests                  │  ← Plan output assertions
              │  (fast, no cloud calls)         │    Run on every PR
              └─────────────────────────────────┘
          ┌─────────────────────────────────────────┐
          │     Static Analysis                      │  ← Lint, fmt, tflint
          │  (fastest, no cloud, no plan)            │    Run on every commit
          └─────────────────────────────────────────┘
```

## Static Analysis

```bash
# Format check
terraform fmt -check -recursive

# Validate syntax and provider schema
terraform validate

# TFLint — provider-specific rules
tflint --init
tflint --recursive

# .tflint.hcl
plugin "aws" {
  enabled = true
  version = "0.27.0"
  source  = "github.com/terraform-linters/tflint-ruleset-aws"
}

rules {
  terraform_naming_convention { enabled = true }
  terraform_required_version  { enabled = true }
  terraform_required_providers { enabled = true }
}

# Checkov — security and compliance scanning
checkov -d . --framework terraform --output sarif > checkov.sarif
checkov -d . --check CKV_AWS_20,CKV_AWS_57  # Specific checks
checkov -d . --skip-check CKV_AWS_79         # Skip with justification

# tfsec — Terraform security scanner  
tfsec . --format sarif --out tfsec.sarif
```

## Unit Testing — terraform-compliance

```gherkin
# tests/s3_security.feature
Feature: S3 Bucket Security
  Scenario: S3 buckets must not be public
    Given I have aws_s3_bucket defined
    Then it must contain bucket_policy
    And its bucket_policy must not contain "Principal": "*"

  Scenario: S3 buckets must have versioning enabled
    Given I have aws_s3_bucket defined
    Then it must contain versioning
    And its versioning configuration must contain enabled
    And its versioning enabled must be true

  Scenario: S3 buckets must have encryption
    Given I have aws_s3_bucket_server_side_encryption_configuration defined
    Then it must contain rule
```

```bash
# Run terraform-compliance against plan
terraform plan -out=tfplan.binary
terraform show -json tfplan.binary > tfplan.json
terraform-compliance -f tests/ -p tfplan.json
```

## Unit Testing — Terratest (Go)

```go
// test/vpc_test.go
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
        TerraformDir: "../modules/vpc",
        Vars: map[string]interface{}{
            "name":       "test-vpc",
            "cidr_block": "10.0.0.0/16",
            "azs":        []string{"us-east-1a", "us-east-1b"},
            "environment": "test",
        },
        EnvVars: map[string]string{
            "AWS_DEFAULT_REGION": awsRegion,
        },
    }

    // Destroy after test completes
    defer terraform.Destroy(t, terraformOptions)
    terraform.InitAndApply(t, terraformOptions)

    // Get outputs
    vpcID := terraform.Output(t, terraformOptions, "vpc_id")
    privateSubnets := terraform.OutputList(t, terraformOptions, "private_subnet_ids")
    publicSubnets := terraform.OutputList(t, terraformOptions, "public_subnet_ids")

    // Assert VPC exists with correct CIDR
    vpc := aws.GetVpcById(t, vpcID, awsRegion)
    assert.Equal(t, "10.0.0.0/16", vpc.CidrBlock)

    // Assert subnet counts
    assert.Equal(t, 2, len(privateSubnets))
    assert.Equal(t, 2, len(publicSubnets))

    // Assert private subnets have no direct internet route
    for _, subnetID := range privateSubnets {
        routeTable := aws.GetRouteTableForSubnet(t, subnetID, awsRegion)
        internetGatewayRoutes := aws.FindRouteTable(t, routeTable, "0.0.0.0/0")
        require.False(t, hasInternetGatewayRoute(internetGatewayRoutes),
            "Private subnet %s should not have direct internet route", subnetID)
    }
}

func TestRDSModule(t *testing.T) {
    t.Parallel()

    terraformOptions := &terraform.Options{
        TerraformDir: "../modules/rds",
        Vars: map[string]interface{}{
            "identifier":       "test-db",
            "instance_class":   "db.t3.micro",
            "engine":           "postgres",
            "engine_version":   "15",
            "database_name":    "testdb",
        },
    }
    defer terraform.Destroy(t, terraformOptions)
    terraform.InitAndApply(t, terraformOptions)

    dbAddress := terraform.Output(t, terraformOptions, "db_address")
    dbPort := terraform.Output(t, terraformOptions, "db_port")

    // Assert RDS is not publicly accessible
    dbIdentifier := terraform.Output(t, terraformOptions, "db_identifier")
    db := aws.GetRdsInstanceById(t, dbIdentifier, "us-east-1")
    assert.False(t, db.PubliclyAccessible, "RDS must not be publicly accessible")
    
    // Assert encryption at rest
    assert.True(t, db.StorageEncrypted, "RDS must have storage encryption enabled")
    
    // Assert connection works (from within VPC)
    // endpoint := fmt.Sprintf("%s:%s", dbAddress, dbPort)
    // ... connection test
}
```

## Compliance as Code — OPA/Conftest

```rego
# policies/s3_security.rego
package main

import future.keywords.if

# Deny public S3 buckets
deny[msg] if {
    resource := input.resource_changes[_]
    resource.type == "aws_s3_bucket"
    resource.change.after.acl == "public-read"
    msg := sprintf("S3 bucket '%v' must not have public-read ACL", [resource.address])
}

# Require encryption on S3
deny[msg] if {
    resource := input.resource_changes[_]
    resource.type == "aws_s3_bucket"
    not has_encryption(resource.address)
    msg := sprintf("S3 bucket '%v' must have server-side encryption", [resource.address])
}

has_encryption(bucket_address) if {
    resource := input.resource_changes[_]
    resource.type == "aws_s3_bucket_server_side_encryption_configuration"
    resource.change.after.bucket == bucket_address
}

# Require MFA delete on S3
deny[msg] if {
    resource := input.resource_changes[_]
    resource.type == "aws_s3_bucket_versioning"
    resource.change.after.versioning_configuration[_].mfa_delete != "Enabled"
    msg := sprintf("S3 bucket '%v' must have MFA delete enabled", [resource.address])
}

# Require tags
required_tags := ["Environment", "Owner", "CostCenter"]

deny[msg] if {
    resource := input.resource_changes[_]
    resource.type in ["aws_instance", "aws_rds_cluster", "aws_s3_bucket"]
    tag := required_tags[_]
    not resource.change.after.tags[tag]
    msg := sprintf("Resource '%v' missing required tag: %v", [resource.address, tag])
}
```

```bash
# Run conftest against terraform plan
terraform show -json tfplan.binary > tfplan.json
conftest test tfplan.json --policy policies/
```

## CI Pipeline

```yaml
# .github/workflows/terraform-test.yml
name: Terraform Tests

on:
  pull_request:
    paths: ['terraform/**', 'modules/**']
  push:
    branches: [main]

jobs:
  static-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with: { terraform_version: 1.7.0 }
      
      - name: Format check
        run: terraform fmt -check -recursive terraform/
      
      - name: Validate
        run: |
          cd terraform/
          terraform init -backend=false
          terraform validate
      
      - name: TFLint
        uses: terraform-linters/setup-tflint@v4
        run: tflint --recursive terraform/
      
      - name: Checkov
        uses: bridgecrewio/checkov-action@master
        with:
          directory: terraform/
          framework: terraform
          output_format: sarif
          output_file_path: checkov.sarif
          soft_fail: false
      
      - name: Upload Checkov results
        uses: github/codeql-action/upload-sarif@v3
        with: { sarif_file: checkov.sarif }

  plan-and-compliance:
    runs-on: ubuntu-latest
    needs: static-analysis
    env:
      AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID_CI }}
      AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY_CI }}
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      
      - name: Terraform Plan
        run: |
          cd terraform/environments/staging
          terraform init
          terraform plan -out=tfplan.binary
          terraform show -json tfplan.binary > tfplan.json
      
      - name: Compliance check (OPA/Conftest)
        run: |
          conftest test terraform/environments/staging/tfplan.json \
            --policy policies/ \
            --output table
      
      - name: terraform-compliance
        run: |
          terraform-compliance \
            -f tests/compliance/ \
            -p terraform/environments/staging/tfplan.json

  integration-tests:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    needs: plan-and-compliance
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: '1.22' }
      
      - name: Run Terratest
        run: |
          cd test/
          go test -v -timeout 30m -run TestVPCModule
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID_TEST }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY_TEST }}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No tests at all** | Manual review misses regressions | Static analysis at minimum on every PR |
| **Integration tests on every PR** | Slow (10-30min) and costly | Static + unit on PR; integration on merge or nightly |
| **No cleanup in integration tests** | Leaked resources accumulate cost | `defer terraform.Destroy(t, opts)` always |
| **Testing only happy path** | Security misconfigurations not caught | Compliance tests explicitly check security properties |
| **Hardcoded credentials in tests** | Secrets in code | IAM roles for CI; test-specific credentials with minimum permissions |
| **Skipping fmt and validate** | CI runs plan on invalid syntax | fmt and validate are 5-second checks — always run |
| **One monolithic integration test** | 45-minute test that tests everything | Isolated module tests with t.Parallel() |

## 10 Rules

1. Static analysis (fmt, validate, tflint, checkov) runs on every commit — it's free and fast.
2. Compliance checks run against the plan JSON — not against the code, against what will actually be created.
3. Integration tests always clean up with defer destroy — leaked cloud resources become surprise bills.
4. Test each module independently — not the whole environment in one test.
5. Use dedicated test accounts with limited permissions — not the production account.
6. Compliance policies live in the same repository as the IaC they govern.
7. Failed compliance checks block merge — not just warn.
8. Generate the plan in CI and test against it — the plan is the source of truth, not the code.
9. Integration tests run in parallel — `t.Parallel()` halves test time at no extra cost.
10. Write a test for every security finding — turn post-incident discoveries into permanent checks.
