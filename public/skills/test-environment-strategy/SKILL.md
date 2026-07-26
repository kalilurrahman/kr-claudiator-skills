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

The canonical workflow for **Test Environment Strategy** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Design a test environment strategy providing reliable, representative, and cost-efficient environments at each SDLC stage. Outputs environment topology, data ma
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
