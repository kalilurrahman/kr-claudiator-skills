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

---

## Deep Reference Playbook

The sections below extend this skill into a complete operating playbook so it can run end-to-end inside Claude Code, CoWork, or any agentic tool without further prompting. Pull only the sections you need for a given engagement.

### Inputs the skill must collect

Before producing any output, the skill confirms:

1. **Objective** — the single decision or artifact the user wants out of this session.
2. **Context** — system, team, customer, product, or domain the work sits inside.
3. **Constraints** — time, budget, headcount, regulatory, technical, political.
4. **Definition of done** — what "good" looks like and who signs it off.
5. **Audience** — who reads or consumes the output (engineer, exec, customer, regulator).
6. **Existing artifacts** — prior versions, related docs, dashboards, tickets.
7. **Risk appetite** — how reversible the decision is and how much ambiguity is acceptable.

If any of these are missing, the skill asks targeted clarifying questions before generating output. It never invents constraints the user did not state.

### Operating workflow

The canonical workflow for **Environment Management** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

**Stage 1 — Frame.** Restate the problem in one paragraph. Name the decision, the deadline, the stakeholders, and the success metric. Surface assumptions explicitly so they can be challenged.

**Stage 2 — Diagnose.** Inventory the current state with concrete evidence: metrics, quotes, screenshots, configs, tickets. Separate facts from interpretations. Identify the two or three root causes that explain most of the gap, not the long tail of symptoms.

**Stage 3 — Design.** Generate at least two viable options. For each option, capture: what changes, who owns it, what it costs, what it unblocks, what it risks, and how it could fail. Recommend one with a written rationale.

**Stage 4 — Execute.** Convert the chosen option into a sequenced plan: milestones, owners, dependencies, gating checks, communication cadence, and rollback triggers. Anything that cannot be assigned an owner and a date is not yet a plan.

**Stage 5 — Validate.** Define how success will be measured, when the measurement happens, and what action follows each possible result. Schedule the retrospective before the work starts, not after.

### Outputs the skill produces

Depending on the request, the skill returns one or more of:

- A one-page brief suitable for an executive reader.
- A detailed working document for the delivery team.
- A decision record capturing the choice, the alternatives, and the rationale.
- A risk register with probability, impact, owner, and mitigation.
- A sequenced action plan with named owners and explicit due dates.
- A measurement plan tied to the success metric.
- A communication plan for stakeholders inside and outside the team.

Every artifact uses clear headings, short paragraphs, and tables where comparison helps. No filler. No restating the prompt. No hedging language when a recommendation is warranted.

### Decision logic and trade-offs

The skill applies the following heuristics when choices are not obvious:

- **Prefer reversible decisions** taken quickly over irreversible decisions taken slowly.
- **Optimise for the constraint that bites first** — usually time, attention, or trust, not money.
- **Default to the simplest design** that meets the stated definition of done; add complexity only when a specific requirement forces it.
- **Make the cost of being wrong visible** so the reader can judge whether the recommendation is proportionate.
- **Name the people**, not the roles, when assigning ownership; ambiguous ownership produces ambiguous outcomes.

### Anti-patterns the skill refuses to emit

| Anti-pattern | Why it fails | What the skill does instead |
|---|---|---|
| Generic best-practice list with no context | Reader cannot act on it | Tailors recommendations to the stated constraints |
| Recommendation without trade-offs | Hides the cost of being wrong | Names the price paid for the recommendation |
| Plan with no owners or dates | Cannot be executed or tracked | Assigns a named owner and a date to every action |
| Metrics theatre | Measures activity, not outcome | Ties every metric back to the user or business outcome |
| Boil-the-ocean scope | Nothing ships | Cuts scope to the smallest valuable slice |
| Buried recommendation | Reader misses the point | Leads with the recommendation in the first paragraph |

### Quality bar

The skill self-checks each output against these gates before returning it:

1. Can a busy executive understand the recommendation from the first 150 words?
2. Is every claim either evidenced, labelled as an assumption, or removed?
3. Does every action have an owner and a date?
4. Are the trade-offs of the recommendation stated honestly?
5. Is there a measurable success criterion?
6. Would the author be comfortable defending this artifact in a review meeting?

If any gate fails, the skill rewrites the section before returning it.

### Worked micro-example

> **Context:** Design and manage multiple deployment environments for development, staging, and production. Outputs environment topology, promotion workflow, configuration man
>
> **Frame:** the team needs a defensible recommendation within five working days; the audience is a cross-functional steering group; the cost of delay is higher than the cost of being slightly wrong.
>
> **Diagnose:** the dominant constraint is decision latency, not analytical depth. Existing data is sufficient for a directional call.
>
> **Design:** two viable options surfaced. Option A optimises for speed and reversibility. Option B optimises for completeness but slips the deadline by two weeks.
>
> **Execute:** Option A recommended. Plan sequenced into a two-week sprint with named owners, a mid-point checkpoint, and a clear rollback trigger.
>
> **Validate:** success measured against a single leading indicator at day 30 and a single lagging indicator at day 90. Retrospective scheduled for day 35.

### Cadence and follow-through

A one-shot artifact rarely changes outcomes. The skill recommends a lightweight cadence to keep the work alive:

- **Weekly:** owner posts a five-line status (done, doing, blocked, risk, ask).
- **Fortnightly:** steering group reviews leading indicators and unblocks dependencies.
- **Monthly:** retrospective on what the data is teaching the team; adjust plan accordingly.
- **Quarterly:** revisit the original objective and decide whether to continue, pivot, or stop.

### Closing rules of thumb

1. Lead with the recommendation; supporting analysis follows.
2. Treat every output as a draft that will be challenged; pre-empt the obvious objections.
3. Prefer one strong recommendation over three weak options.
4. When the evidence is thin, say so; do not launder uncertainty as confidence.
5. Optimise for the next decision, not for the perfect document.
6. Make it easy for the reader to disagree with you in a structured way.
7. Ship the artifact; iterate against feedback rather than in private.
