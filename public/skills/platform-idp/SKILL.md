---
name: platform-idp
description: Design an Internal Developer Platform (IDP) that reduces cognitive load for engineers. Outputs platform capabilities, golden paths, self-service workflows, and adoption strategy.
argument-hint: [team size, current pain points, golden path services, tooling maturity]
allowed-tools: Read, Write
---

# Internal Developer Platform (IDP)

An IDP abstracts infrastructure complexity behind self-service workflows, letting developers focus on features instead of YAML. A platform succeeds when it provides "golden paths" — opinionated, pre-built paths for the most common workflows that are easier to follow than to deviate from.

## Platform Capabilities Framework

```
LEVEL 1: VISIBILITY
  What teams have, what state it's in
  Service catalogue, cost visibility, dependency map

LEVEL 2: SELF-SERVICE PROVISIONING
  Create environments, provision databases, manage secrets
  Backstage, Port.io, or custom portal

LEVEL 3: GOLDEN PATHS
  Opinionated templates for services, pipelines, infrastructure
  New service in 15 minutes, not 3 weeks

LEVEL 4: AUTOMATED OPERATIONS
  Auto-scaling, auto-remediation, automated security checks
  Reduce toil to near-zero for common operations
```

## Backstage Service Catalog

```yaml
# catalog-info.yaml (in each service repo)
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: orders-api
  title: Orders API
  description: Handles order creation, management, and fulfilment
  annotations:
    github.com/project-slug: company/orders-api
    backstage.io/techdocs-ref: dir:.
    pagerduty.com/service-id: P1ABC23
    datadoghq.com/service-name: orders-api
  tags:
    - go
    - grpc
    - critical
  links:
    - url: https://grafana.company.com/d/orders
      title: Monitoring Dashboard
    - url: https://runbooks.company.com/orders-api
      title: Runbooks
spec:
  type: service
  lifecycle: production
  owner: orders-team
  system: order-management
  dependsOn:
    - component:inventory-api
    - resource:orders-postgres
    - resource:orders-redis
  providesApis:
    - orders-grpc-api
```

## Golden Path: New Service Template

```yaml
# .github/workflows/create-service.yml
name: Create New Service

on:
  workflow_dispatch:
    inputs:
      service_name:
        description: Service name (kebab-case)
        required: true
      team:
        description: Owning team
        required: true
      language:
        description: Primary language
        type: choice
        options: [go, python, typescript, java]

jobs:
  scaffold:
    runs-on: ubuntu-latest
    steps:
      - name: Scaffold service from template
        run: |
          # Create repo from template
          gh repo create company/${{ inputs.service_name }}             --template company/service-template-${{ inputs.language }}             --private
          
          # Provision base infrastructure
          cd infra/services
          cp -r _template ${{ inputs.service_name }}
          sed -i "s/SERVICE_NAME/${{ inputs.service_name }}/g" ${{ inputs.service_name }}/*.tf
          
          # Add to service catalog
          cat > catalog-info.yaml << EOF
          apiVersion: backstage.io/v1alpha1
          kind: Component
          metadata:
            name: ${{ inputs.service_name }}
            annotations:
              github.com/project-slug: company/${{ inputs.service_name }}
          spec:
            type: service
            lifecycle: experimental
            owner: ${{ inputs.team }}
          EOF
          
          # Create PagerDuty service, Datadog dashboards, etc.
          python3 scripts/provision_service.py             --name ${{ inputs.service_name }}             --team ${{ inputs.team }}
```

## Self-Service Database Provisioning

```python
# Platform API: POST /provision/database
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class DatabaseRequest(BaseModel):
    service_name: str
    team: str
    environment: str       # dev | staging | prod
    engine: str            # postgres | mysql | redis
    size: str              # small | medium | large
    reason: str            # Required for prod

@app.post("/provision/database")
async def provision_database(req: DatabaseRequest):
    if req.environment == "prod":
        # Require manager approval for production
        ticket = await create_approval_ticket(req)
        return {"status": "pending_approval", "ticket_id": ticket.id}
    
    # Auto-provision dev/staging
    db = await terraform_apply({
        "module": "rds",
        "service": req.service_name,
        "team": req.team,
        "environment": req.environment,
        "instance_class": SIZE_MAP[req.size],
        "tags": {
            "Team": req.team,
            "Service": req.service_name,
            "ManagedBy": "platform-idp",
        }
    })
    
    # Inject secret into Vault
    await vault_client.write(
        f"secret/{req.environment}/{req.service_name}/db",
        {"connection_string": db.connection_string}
    )
    
    return {
        "status": "provisioned",
        "secret_path": f"secret/{req.environment}/{req.service_name}/db",
        "console_url": db.console_url,
    }
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Platform as mandatory gatekeeper** | Bottleneck; engineers route around it | Platform as product — teams choose to use it |
| **Building without user research** | Platform solves wrong problems | Interview engineers quarterly; measure NPS |
| **One team builds for all** | Platform becomes outdated | Product model: platform team + contributor model |
| **No golden path — just tools** | Engineers still figure it out themselves | Opinionated templates for the most common patterns |
| **Complexity hidden but not solved** | Engineers confused when they need to deviate | Escape hatches + documentation for going off-path |

## 10 Rules

1. Platform is a product — it has users (developers), metrics (adoption, NPS), and a backlog.
2. Golden paths are opinionated — one recommended way to do common things, not all the ways.
3. Self-service means zero tickets for provisioning dev and staging resources.
4. Measure cognitive load reduction — time to first deployment for a new service is the headline metric.
5. Platform teams don't review every PR — they set guardrails and let teams move.
6. Escape hatches are documented — going off-path must be possible, even if harder.
7. Built-in security and compliance defaults — secure by default, not secure by checkbox.
8. Cost transparency is built in — every provisioned resource shows cost to the owning team.
9. Adoption is voluntary and won by value — forced adoption creates resentment.
10. Internal platform SLAs — the platform must be more reliable than what it replaces.

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

The canonical workflow for **Platform Idp** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Design an Internal Developer Platform (IDP) that reduces cognitive load for engineers. Outputs platform capabilities, golden paths, self-service workflows, and 
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
