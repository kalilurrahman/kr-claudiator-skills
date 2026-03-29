---
name: argocd-deployment
description: Deploy and manage applications with Argo CD GitOps. Outputs Application manifests, sync strategies, health checks, RBAC configuration, and multi-environment promotion workflows.
argument-hint: [number of clusters, environments, team size, existing CI system]
allowed-tools: Read, Write, Bash
---

# Argo CD Deployment

Argo CD implements GitOps: your Git repository is the source of truth for Kubernetes state. Argo CD continuously reconciles what's in Git with what's running in the cluster. Deployments become Git commits — reviewed, auditable, and rollback-able.

## Process

1. **Install Argo CD** into a dedicated namespace in each cluster.
2. **Create Application resources** that point to your Git repo and target cluster/namespace.
3. **Define sync policies.** Auto-sync (reconcile on commit) vs manual (human approval required).
4. **Set health checks.** Argo CD detects when a deployment is unhealthy and alerts.
5. **Configure RBAC.** Who can sync, delete, and create applications.
6. **Multi-environment promotion.** Use App of Apps or ApplicationSets for environment promotion.

## Application Manifest

```yaml
# argo-cd/apps/api-service.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: api-service-production
  namespace: argocd
  annotations:
    notifications.argoproj.io/subscribe.on-sync-succeeded.slack: deployments
    notifications.argoproj.io/subscribe.on-sync-failed.pagerduty: oncall
spec:
  project: production

  source:
    repoURL: https://github.com/company/k8s-manifests.git
    targetRevision: main
    path: environments/production/api-service
    # For Helm charts:
    # helm:
    #   valueFiles: [values-production.yaml]

  destination:
    server: https://k8s-production.example.com
    namespace: production

  syncPolicy:
    automated:
      prune: true        # Remove resources deleted from Git
      selfHeal: true     # Re-sync if cluster drifts from Git
      allowEmpty: false  # Never sync to empty (safety)
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
      - RespectIgnoreDifferences=true
    retry:
      limit: 3
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m

  # Ignore fields managed by the cluster (not Git)
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas    # HPA manages this

  revisionHistoryLimit: 10
```

## App of Apps Pattern (Multi-Environment)

```yaml
# Root app — manages all environment apps
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: platform-apps
  namespace: argocd
spec:
  source:
    repoURL: https://github.com/company/k8s-manifests.git
    targetRevision: main
    path: argo-cd/apps         # This folder contains all other Application YAMLs
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

## ApplicationSet — DRY Multi-Environment

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: api-service-environments
  namespace: argocd
spec:
  generators:
    - list:
        elements:
          - env: staging
            cluster: https://k8s-staging.example.com
            namespace: staging
            autoSync: "true"
          - env: production
            cluster: https://k8s-production.example.com
            namespace: production
            autoSync: "false"   # Manual sync for production

  template:
    metadata:
      name: "api-service-{{env}}"
    spec:
      project: "{{env}}"
      source:
        repoURL: https://github.com/company/k8s-manifests.git
        targetRevision: main
        path: "environments/{{env}}/api-service"
      destination:
        server: "{{cluster}}"
        namespace: "{{namespace}}"
      syncPolicy:
        automated:
          prune: "{{autoSync}}"
          selfHeal: "{{autoSync}}"
```

## Promotion Workflow

```bash
# Staging → Production promotion workflow

# 1. Image built and pushed by CI
# 2. CI updates staging manifest (kustomize or helm values)
git clone https://github.com/company/k8s-manifests.git
cd k8s-manifests

# Update staging image tag
kustomize edit set image api-service=ghcr.io/company/api:v1.2.3
git commit -am "chore: bump api-service to v1.2.3 in staging"
git push
# Argo CD auto-syncs staging

# 3. After staging validation, promote to production
# (manual PR or automated after smoke tests pass)
cd environments/production/api-service
kustomize edit set image api-service=ghcr.io/company/api:v1.2.3
git commit -am "chore: promote api-service v1.2.3 to production"
git push
# Argo CD shows OutOfSync; human approves sync in UI/CLI

# 4. Sync production
argocd app sync api-service-production --prune

# 5. Verify rollout
argocd app wait api-service-production --health --timeout 300
```

## RBAC Configuration

```yaml
# argocd-rbac-cm ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-rbac-cm
  namespace: argocd
data:
  policy.csv: |
    # Developers: read-only on all apps, sync on non-prod
    p, role:developer, applications, get,    */*, allow
    p, role:developer, applications, sync,   staging/*, allow
    p, role:developer, applications, sync,   dev/*, allow

    # Ops team: full access except delete on production
    p, role:ops, applications, *,     */*, allow
    p, role:ops, applications, delete, production/*, deny

    # Bind SSO groups
    g, company:engineers, role:developer
    g, company:platform,  role:ops
    g, company:admin,     role:admin

  policy.default: role:readonly
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Auto-sync on production** | Bad commit auto-deploys without human review | Auto-sync staging; manual sync production |
| **No prune** | Deleted resources linger in cluster | `prune: true` in sync policy |
| **Secrets in Git** | Credentials exposed in repository | Use External Secrets Operator or sealed-secrets |
| **One App for everything** | Sync blast radius too large | One Application per service |
| **No health checks** | Argo CD shows synced even when pods are crashing | Define custom health checks for CRDs |

## 10 Rules

1. Git is the source of truth — no manual kubectl apply in production.
2. Auto-sync for staging and dev; manual approval for production.
3. Always enable `prune: true` — resources deleted from Git should be deleted from the cluster.
4. Secrets never go in Git — use External Secrets Operator or Vault integration.
5. App of Apps or ApplicationSet keeps multi-environment DRY.
6. RBAC restricts production sync to ops/senior engineers — not all developers.
7. Notifications on sync-success and sync-failed — every deployment is visible.
8. `selfHeal: true` automatically corrects cluster drift from Git state.
9. `ignoreDifferences` for HPA-managed replicas — don't fight the autoscaler.
10. `argocd app wait --health` in CI after promotion — confirm deployment health before marking release complete.
