---
name: test-environment-strategy
description: Design a test environment strategy providing reliable, representative, and cost-efficient environments at each SDLC stage. Outputs environment topology, data management, parity requirements, and provisioning automation.
argument-hint: [team size, deployment frequency, cloud provider, compliance requirements, budget]
allowed-tools: Read, Write
---

# Test Environment Strategy

Test environments bridge the gap between developer workstations and production. Poor environment strategy produces "works on my machine" bugs, slow feedback, and staging surprises. Good strategy provides fast, representative, isolated environments at each SDLC stage.

## Environment Hierarchy

```
LOCAL (developer machine)
  Purpose: Fast TDD; debugging
  Infrastructure: docker-compose
  Data: Generated seed data
  Cost: Zero cloud spend

PREVIEW (per Pull Request)
  Purpose: Integration testing; product review; stakeholder demos
  Infrastructure: Ephemeral cloud env (Vercel, Render, Fly.io)
  Data: Synthetic subset
  Auto-created on PR open; auto-destroyed on PR close
  Cost: Low (short-lived, ~$0.50/PR/day)

STAGING
  Purpose: Pre-production QA; release gating; load testing
  Infrastructure: Production-equivalent (same instance types, same config)
  Data: Anonymised production clone, refreshed weekly
  Permanent; deployed via CI/CD
  Cost: Medium (~30-50% of production)

PRODUCTION
  Purpose: Real users
  Infrastructure: Full HA; multi-AZ
  Data: Real customer data
  Access: CD pipeline only — no manual changes
```

## Preview Environment Automation

```yaml
# .github/workflows/preview.yml
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  deploy-preview:
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        id: preview
        run: |
          ENV="preview-pr-${{ github.event.number }}"
          flyctl deploy --app "myapp-${ENV}"             --image "ghcr.io/${{ github.repository }}:${{ github.sha }}"             --env ENVIRONMENT=preview             --env SEED_DATA=true
          echo "url=https://myapp-${ENV}.fly.dev" >> $GITHUB_OUTPUT

      - name: Comment URL on PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: "🚀 Preview: ${{ steps.preview.outputs.url }}
Destroyed when PR closes."
            })

  teardown:
    if: github.event.action == 'closed'
    steps:
      - run: flyctl apps destroy "myapp-preview-pr-${{ github.event.number }}" --yes
```

## Staging Parity Checklist

```markdown
## Infrastructure Parity
- [ ] Same cloud provider and region
- [ ] Same instance type family (staging can be smaller: 2 replicas vs 10)
- [ ] Same database engine and version
- [ ] Same cache version and configuration
- [ ] Same message broker and version

## Configuration Parity
- [ ] Same environment variables (staging-specific values)
- [ ] Same secrets rotation process
- [ ] Same TLS configuration and cipher suites
- [ ] Same network topology (VPC, subnets — smaller scale)

## Process Parity
- [ ] Staging deploys via same CI/CD pipeline as production
- [ ] Same IaC (Terraform) — different workspace, same code
- [ ] Database migrations run in staging before production
- [ ] Same monitoring and alerting stack (different thresholds OK)

## Common Parity Gaps That Cause Production Surprises
- Different DB versions → query behaviour differences
- Mocked external services in staging → integration bugs reach prod
- Shared DB between staging and dev → data contamination
- Staging on single AZ → misses multi-AZ failover bugs
```

## Data Management

```python
# Weekly anonymised production clone to staging
async def refresh_staging_data():
    """Clone production DB to staging with PII anonymised."""
    # 1. Dump production (read replica — no load on primary)
    subprocess.run(["pg_dump", "--no-owner", "-Fc",
                    "-h", PROD_READ_REPLICA, PROD_DB, "-f", "prod_dump.pgdump"])

    # 2. Restore to staging
    subprocess.run(["pg_restore", "--no-owner", "--clean",
                    "-h", STAGING_DB_HOST, "-d", STAGING_DB, "prod_dump.pgdump"])

    # 3. Anonymise PII in-place
    await staging_db.execute("""
        UPDATE users SET
            email = CONCAT('user-', id, '@staging.invalid'),
            name  = 'Test User ' || id,
            phone = NULL,
            address = NULL;

        UPDATE payment_methods SET
            card_last4 = '0000',
            billing_address = NULL;
    """)

    # 4. Verify anonymisation
    count = await staging_db.fetchone(
        "SELECT COUNT(*) FROM users WHERE email NOT LIKE '%@staging.invalid'"
    )
    assert count[0] == 0, "Anonymisation incomplete!"
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Manual environment setup** | Snowflakes; not reproducible | IaC for all environments |
| **Mocked services in staging** | Integration bugs reach production | Real sandbox APIs in staging |
| **No data refresh** | Staging diverges; misses production patterns | Weekly anonymised production clone |
| **Shared DB between environments** | Data contamination | Separate DB per environment |
| **Production access without audit** | Changes bypass CI/CD | Break-glass access only; all access logged |

## 10 Rules

1. Every environment provisioned via IaC — no manual setup, no snowflakes.
2. Staging is structurally identical to production — smaller scale, same architecture.
3. Migrations run in staging before production — staging is the final validation gate.
4. Preview environments auto-created per PR and auto-destroyed on close.
5. Production data never in non-production environments — anonymised copies only.
6. Staging data refreshed weekly — stale data misses production behaviour patterns.
7. CI/CD pipeline is the only path to staging and production — no manual deploys.
8. Separate secrets per environment — no shared secrets across environments.
9. Feature flags work in staging — test flag states before enabling in production.
10. Environment configuration is in version control — not in the heads of individuals.
