---
name: service-catalog
description: Build and maintain a service catalog documenting all services, their owners, dependencies, and operational properties. Outputs catalog schema, ownership model, dependency map, and discovery tooling.
argument-hint: [number of services, team structure, existing docs, tooling preferences]
allowed-tools: Read, Write
---

# Service Catalog

A service catalog is the source of truth for every service in your organisation. Engineers waste hours during incidents looking for the right team, runbook, or dependency information. The catalog provides it in one place.

## Catalog Schema (Backstage)

Every service repository contains a `catalog-info.yaml`:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: orders-api
  description: "Core order management — lifecycle from draft to delivery"
  tags: [backend, critical, python]
  annotations:
    github.com/project-slug: company/orders-api
    pagerduty.com/service-id: P1234XY
    grafana/dashboard-url: "https://grafana.company.com/d/orders"
    runbook-url: "https://wiki.company.com/runbooks/orders-api"
spec:
  type: service
  lifecycle: production
  owner: group:backend-team
  dependsOn:
    - component:postgres-orders
    - component:redis-cache
    - component:payment-api
```

## Required Fields

Every service entry must have: name, description, owner (team), lifecycle, on-call rotation link, runbook URL, SLO target, and key dependencies. CI fails if catalog-info.yaml is missing or incomplete.

## Auto-Discovery

Scan all GitHub repositories nightly for catalog-info.yaml files. Services without entries are flagged to the CTO weekly for adoption or deprecation decision.

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Manual catalog updates | Always stale | catalog-info.yaml in source repo, auto-synced |
| No ownership required | Orphaned services | CI blocks merge without catalog-info.yaml |
| Catalog without runbooks | Useless in incidents | Runbook URL is required field |
| No dependency mapping | No blast radius analysis | spec.dependsOn required for all integrations |

## 10 Rules

1. catalog-info.yaml lives in each service repo — CI blocks merge without it.
2. Ownership is a team not an individual — individuals leave.
3. Runbook URL is mandatory — you need it at 3am.
4. All dependencies declared — enables blast radius analysis.
5. Lifecycle field enforced — deprecated services have removal dates.
6. Auto-discover new services from GitHub scans.
7. Service catalog linked from every monitoring alert.
8. Orphaned services audited monthly.
9. SLO target lives in the catalog.
10. Review and update entries whenever the service changes significantly.

