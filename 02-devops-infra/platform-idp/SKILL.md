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
