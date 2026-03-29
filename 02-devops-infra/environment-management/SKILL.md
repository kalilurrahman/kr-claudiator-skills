---
name: environment-management
description: Design and manage multiple deployment environments for development, staging, and production. Outputs environment topology, promotion workflow, configuration management, and parity strategy.
argument-hint: [team size, deployment frequency, cloud provider, compliance requirements]
allowed-tools: Read, Write
---

# Environment Management

Managing multiple environments — dev, staging, production, and feature branches — requires consistent tooling, environment parity, and clear promotion workflows. Poor environment management is a leading cause of "works on my machine" bugs and staging-to-production surprises.

## Environment Topology

```
LOCAL (developer machine)
  Purpose: Fast iteration, debugging
  Infrastructure: Docker Compose
  Data: Seed data or anonymised production subset
  Access: Developer only

DEVELOPMENT / PREVIEW (per PR or per feature)
  Purpose: Integration testing, product review
  Infrastructure: Short-lived, auto-provisioned per PR
  Data: Seed data
  Access: Developer + product team

STAGING
  Purpose: Pre-production validation; QA; load testing
  Infrastructure: Production-equivalent (same instance types, same config)
  Data: Anonymised production clone (refreshed weekly)
  Access: Engineering + QA + product

PRODUCTION
  Purpose: Real users
  Infrastructure: Full HA, multi-AZ
  Data: Real customer data
  Access: Break-glass only; all changes via CD pipeline
```

## Ephemeral Preview Environments

```yaml
# .github/workflows/preview.yml
name: Preview Environment

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy preview environment
        id: deploy
        run: |
          ENV_NAME="preview-pr-${{ github.event.number }}"
          
          # Render/Railway/Fly.io one-command preview deploy
          fly deploy             --app "myapp-${ENV_NAME}"             --image "ghcr.io/org/app:${{ github.sha }}"             --env "ENV_NAME=${ENV_NAME}"             --env "DATABASE_URL=${{ secrets.PREVIEW_DB_URL }}"
          
          URL="https://myapp-${ENV_NAME}.fly.dev"
          echo "preview_url=${URL}" >> $GITHUB_OUTPUT

      - name: Comment preview URL on PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `🚀 Preview environment deployed: ${{ steps.deploy.outputs.preview_url }}

This environment will be automatically destroyed when the PR is closed.`
            })

  teardown-preview:
    runs-on: ubuntu-latest
    on:
      pull_request:
        types: [closed]
    steps:
      - run: fly apps destroy "myapp-preview-pr-${{ github.event.number }}" --yes
```

## Configuration Management

```python
# Environment-specific configuration using environment variables
# Never hardcode environment names in business logic

import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Required in all environments
    database_url: str
    redis_url: str
    secret_key: str
    
    # Defaults differ by environment
    debug: bool = False
    log_level: str = "INFO"
    
    # Feature toggles (can differ by environment)
    enable_new_checkout: bool = False
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()

# Environment detection — use a single ENV variable
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")

# Never do this:
# if os.environ.get("STAGING"): ...
# if hostname == "staging.example.com": ...
```

## Environment Parity Checklist

```markdown
## Staging ↔ Production Parity Requirements

### Infrastructure Parity
- [ ] Same instance type family (staging can be smaller but same family)
- [ ] Same number of replicas (staging can use min=1)
- [ ] Same database engine version
- [ ] Same cache version (Redis, Memcached)
- [ ] Same message broker (Kafka version)

### Configuration Parity
- [ ] Same environment variables (with staging-appropriate values)
- [ ] Same secrets rotation process
- [ ] Same network topology (VPC, subnets, security groups — smaller scale)
- [ ] Same TLS configuration

### Process Parity
- [ ] Staging deploys via same CI/CD pipeline as production
- [ ] Staging uses same IaC (Terraform) — different workspace, same code
- [ ] Database migrations run in staging before production
- [ ] Same monitoring and alerting (different thresholds acceptable)

## Common Parity Gaps (and why they hurt)
- Different DB versions: query behaviour differs
- Different instance sizes with different memory: OOM in prod but not staging
- Mock external services in staging: integration bugs reach production
- Shared DB between staging and dev: data contamination
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Manual environment setup** | Snowflake environments; not reproducible | IaC for all environments; same Terraform code |
| **Staging uses mocked services** | Real integration bugs reach production | Use real sandbox APIs (Stripe test mode, etc.) |
| **No data refresh in staging** | Staging data diverges; misses production data patterns | Weekly anonymised production clone to staging |
| **Shared DB between environments** | Dev experiments pollute staging tests | Separate DB per environment; never share |
| **Production access without audit** | Changes bypassing CI/CD | Break-glass access only; all access logged and alerted |

## 10 Rules

1. Every environment is provisioned via IaC — no manual setup, no snowflakes.
2. Staging is a smaller but structurally identical replica of production.
3. Migrations run in staging before production — staging is the final validation gate.
4. Feature flags allow the same code to behave differently per environment.
5. Preview environments per PR catch integration issues before they reach staging.
6. Production data never exists in non-production environments — anonymised copies only.
7. Every environment gets a fresh secrets rotation — no shared secrets across environments.
8. CI/CD pipeline is the only path to staging and production — no manual deployments.
9. Staging data is refreshed weekly — stale data misses production behaviour patterns.
10. Environment configuration is in version control — not in the heads of individuals.
