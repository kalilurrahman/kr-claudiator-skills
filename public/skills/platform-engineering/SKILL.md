---
name: platform-engineering
description: Build an internal developer platform (IDP) that abstracts infrastructure complexity — self-service environments, golden paths, service catalogs, and paved road toolchains for engineering teams.
argument-hint: [team size, cloud provider, existing tooling, developer pain points]
allowed-tools: Read, Write, Bash
---

# Platform Engineering

Platform engineering builds the paved roads that application developers travel. Instead of every team building their own CI/CD, service mesh, observability, and environment provisioning, the platform team builds it once — correctly, securely, and at scale. The product is a developer platform; the customers are your engineers.

## Platform Components

| Component | Purpose | Tools |
|-----------|---------|-------|
| Internal Developer Portal | Service catalog, self-service | Backstage |
| Golden Path Templates | Opinionated scaffolding for new services | Cookiecutter, Backstage Software Templates |
| Self-Service Environments | Spin up preview/dev environments on demand | Crossplane, Terraform + API |
| CI/CD Platform | Shared pipelines, build caching, artifact registry | GitHub Actions, Tekton |
| Observability Stack | Metrics, logs, traces pre-wired | Prometheus, Grafana, Loki |
| Secrets Management | Centralized secrets with audit | Vault, AWS Secrets Manager |
| Service Mesh | mTLS, traffic management, observability | Istio, Linkerd |

## Process

1. **Interview developers** — find the top 3-5 manual, error-prone, or slow tasks.
2. **Build golden path** — opinionated starter template with best practices baked in.
3. **Build self-service API** — developers should not need to file tickets to get environments.
4. **Automate security defaults** — RBAC, network policies, secret rotation built into the platform.
5. **Instrument adoption** — measure platform usage, developer satisfaction (DORA metrics).
6. **Iterate based on feedback** — treat platform as a product; have a roadmap and release notes.

## Output Format

### Backstage Service Catalog

```yaml
# catalog-info.yaml (in each service repo)
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: order-service
  title: Order Service
  description: Manages order creation, fulfillment, and tracking
  annotations:
    github.com/project-slug: "example/order-service"
    backstage.io/techdocs-ref: dir:.
    prometheus.io/alert-dashboard: "https://grafana.example.com/d/orders"
    pagerduty.com/service-id: "P1234AB"
  tags:
    - python
    - fastapi
    - critical
  links:
    - url: https://runbooks.example.com/order-service
      title: Runbooks
    - url: https://grafana.example.com/d/orders
      title: Dashboard
spec:
  type: service
  lifecycle: production
  owner: team:checkout
  system: ecommerce
  dependsOn:
    - component:inventory-service
    - component:payment-service
    - resource:orders-postgres
  providesApis:
    - order-api-v2
```

### Golden Path — Service Template

```yaml
# backstage/templates/python-service.yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: python-fastapi-service
  title: Python FastAPI Microservice
  description: Creates a new production-ready Python service with CI/CD, observability, and security defaults
spec:
  parameters:
    - title: Service Information
      properties:
        name:
          type: string
          title: Service name (kebab-case)
          pattern: "^[a-z][a-z0-9-]*$"
        description:
          type: string
        owner:
          type: string
          ui:field: OwnerPicker
        system:
          type: string
          ui:field: EntityPicker
          ui:options:
            catalogFilter:
              kind: System
    
    - title: Infrastructure
      properties:
        region:
          type: string
          enum: [us-east-1, eu-west-1, ap-southeast-1]
        database:
          type: boolean
          title: Include PostgreSQL database?
        cache:
          type: boolean
          title: Include Redis cache?
  
  steps:
    - id: fetch-template
      name: Fetch template
      action: fetch:template
      input:
        url: ./skeleton
        values:
          name: ${{ parameters.name }}
          owner: ${{ parameters.owner }}
    
    - id: publish
      name: Publish to GitHub
      action: publish:github
      input:
        allowedHosts: ["github.com"]
        repoUrl: github.com?repo=${{ parameters.name }}&owner=example
        defaultBranch: main
    
    - id: provision-infra
      name: Provision infrastructure
      action: http:backstage:request
      input:
        method: POST
        path: /api/platform/environments
        body:
          service: ${{ parameters.name }}
          database: ${{ parameters.database }}
          cache: ${{ parameters.cache }}
    
    - id: register
      name: Register in catalog
      action: catalog:register
      input:
        repoContentsUrl: ${{ steps.publish.output.repoContentsUrl }}
        catalogInfoPath: catalog-info.yaml
```

### Self-Service Environment API

```python
# platform_api/environments.py
from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import subprocess, asyncio

app = FastAPI(title="Platform API")

class EnvironmentRequest(BaseModel):
    service: str
    environment: str = "preview"
    branch: str = "main"
    ttl_hours: int = 24
    database: bool = False
    cache: bool = False

@app.post("/environments")
async def provision_environment(req: EnvironmentRequest, bg: BackgroundTasks):
    env_id = f"{req.service}-{req.branch}-{req.environment}"[:50]
    
    bg.add_task(run_terraform_provision, env_id, req)
    
    return {
        "environment_id": env_id,
        "status": "provisioning",
        "estimated_ready_seconds": 120,
        "url": f"https://{env_id}.preview.example.com",
    }

async def run_terraform_provision(env_id: str, req: EnvironmentRequest):
    """Run Terraform to provision the environment."""
    workspace_vars = {
        "TF_VAR_service_name": req.service,
        "TF_VAR_environment_id": env_id,
        "TF_VAR_ttl_hours": str(req.ttl_hours),
        "TF_VAR_include_database": str(req.database).lower(),
        "TF_VAR_include_cache": str(req.cache).lower(),
    }
    
    proc = await asyncio.create_subprocess_exec(
        "terraform", "apply", "-auto-approve", f"-var-file=envs/{req.environment}.tfvars",
        cwd="/platform/terraform/service-environment",
        env={**os.environ, **workspace_vars},
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    
    stdout, stderr = await proc.communicate()
    
    if proc.returncode != 0:
        logger.error(f"Terraform failed for {env_id}: {stderr.decode()}")
        await notify_failure(env_id, stderr.decode())
    else:
        await notify_ready(env_id)
        await schedule_cleanup(env_id, req.ttl_hours)

@app.delete("/environments/{env_id}")
async def destroy_environment(env_id: str, bg: BackgroundTasks):
    bg.add_task(run_terraform_destroy, env_id)
    return {"environment_id": env_id, "status": "destroying"}
```

### DORA Metrics Dashboard

```python
# metrics/dora.py
"""Measure platform effectiveness via DORA metrics."""
import datetime
from github import Github

class DORAMetrics:
    def __init__(self, github_token: str, org: str):
        self.gh = Github(github_token)
        self.org = self.gh.get_organization(org)
    
    def deployment_frequency(self, repo_name: str, days: int = 30) -> float:
        """Deployments per day (Elite: >1/day, High: 1/week, Medium: 1/month)."""
        repo = self.org.get_repo(repo_name)
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=days)
        
        deployments = [
            d for d in repo.get_deployments(environment="production")
            if d.created_at > cutoff
        ]
        
        return len(deployments) / days
    
    def lead_time_for_changes(self, repo_name: str, days: int = 30) -> float:
        """Median time from commit to production (hours). Elite: <1hr."""
        repo = self.org.get_repo(repo_name)
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=days)
        
        lead_times = []
        for deployment in repo.get_deployments(environment="production"):
            if deployment.created_at < cutoff:
                break
            commit = repo.get_commit(deployment.sha)
            lead_time = (deployment.created_at - commit.commit.author.date).total_seconds() / 3600
            lead_times.append(lead_time)
        
        if not lead_times:
            return 0.0
        lead_times.sort()
        return lead_times[len(lead_times) // 2]  # Median
```

## Rules

- **Platform is a product — have a roadmap** — internal platforms without roadmaps accumulate technical debt and lose adoption.
- **Golden paths must be maintained** — an outdated template is worse than no template; set a quarterly review cadence.
- **Self-service means zero tickets** — if developers need to file a Jira to get an environment, the platform has failed.
- **Don't build what you can buy** — Backstage is open source; buy the SaaS layer rather than rebuilding the portal.
- **Measure adoption, not just availability** — a platform nobody uses is not a platform; track active teams and services.
- **Security defaults must be enforced, not optional** — RBAC, network policies, and secret management must be automatic.
- **Platform teams are on-call for the platform** — if the CI/CD platform goes down, platform engineers fix it.
- **Document everything in the portal** — knowledge in Slack channels is lost; the portal is the source of truth.
- **Treat migrations like product launches** — deprecating the old way requires documentation, migration support, and deadlines.
- **DORA metrics prove value** — measure deployment frequency and lead time before and after platform adoption.

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

