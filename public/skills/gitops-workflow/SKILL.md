---
name: gitops-workflow
description: Implement GitOps deployment workflows where Git is the single source of truth for infrastructure and application state. Outputs ArgoCD/Flux configuration, repository structure, promotion workflows, and drift detection.
argument-hint: [Kubernetes cluster, GitOps tool (ArgoCD/Flux), environment count, deployment frequency]
allowed-tools: Read, Write, Bash
---

# GitOps Workflow

GitOps makes Git the single source of truth for both infrastructure and application deployments. Every change goes through a PR; the GitOps operator continuously reconciles cluster state to match what's in Git. Drift is automatically corrected; rollbacks are just git reverts.

## Process

1. **Separate config repo from app repo** — application code and deployment configs are different concerns.
2. **Define environment structure** — overlays or branches per environment (dev/staging/prod).
3. **Install GitOps operator** — ArgoCD or Flux watches the config repo.
4. **Create Application/Kustomization** — declarative definition of what to deploy where.
5. **Set up promotion workflow** — automated PR from dev→staging→prod with gates.
6. **Configure drift detection** — alert or auto-remediate when cluster diverges from Git.
7. **Manage secrets** — sealed secrets or external secrets operator, never plaintext in Git.

## Output Format

### Repository Structure

```
infra-config/
├── base/                          # Shared base configurations
│   ├── order-service/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── hpa.yaml
│   │   └── kustomization.yaml
│   └── user-service/
│       └── ...
├── environments/
│   ├── dev/
│   │   ├── kustomization.yaml    # Overlays for dev
│   │   └── patches/
│   │       └── order-service-patch.yaml
│   ├── staging/
│   │   ├── kustomization.yaml
│   │   └── patches/
│   └── production/
│       ├── kustomization.yaml
│       └── patches/
├── clusters/
│   ├── dev-cluster/
│   │   └── apps.yaml             # ArgoCD ApplicationSet
│   ├── staging-cluster/
│   └── prod-cluster/
└── secrets/
    └── sealed/                    # SealedSecrets (encrypted)
```

### Kustomize Overlays

```yaml
# base/order-service/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
spec:
  replicas: 1   # Overridden per environment
  selector:
    matchLabels:
      app: order-service
  template:
    metadata:
      labels:
        app: order-service
    spec:
      containers:
        - name: order-service
          image: myregistry/order-service:latest  # Image tag patched by CI
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
---
# base/order-service/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
  - hpa.yaml
```

```yaml
# environments/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: production

resources:
  - ../../base/order-service
  - ../../base/user-service

patches:
  - path: patches/order-service-production.yaml

images:
  - name: myregistry/order-service
    newTag: "1.5.3"   # Updated by promotion workflow
  - name: myregistry/user-service
    newTag: "2.1.0"
```

```yaml
# environments/production/patches/order-service-production.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
spec:
  replicas: 10    # Production scale
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-service-hpa
spec:
  minReplicas: 10
  maxReplicas: 50
```

### ArgoCD Configuration

```yaml
# clusters/prod-cluster/apps.yaml — ApplicationSet creates apps for all services
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: production-apps
  namespace: argocd
spec:
  generators:
    - git:
        repoURL: https://github.com/myorg/infra-config
        revision: main
        directories:
          - path: base/*   # One app per service directory
  
  template:
    metadata:
      name: '{{path.basename}}-production'
    spec:
      project: production
      
      source:
        repoURL: https://github.com/myorg/infra-config
        targetRevision: main
        path: environments/production
        
        kustomize:
          namePrefix: ""
      
      destination:
        server: https://kubernetes.default.svc
        namespace: production
      
      syncPolicy:
        automated:
          prune: true          # Remove resources deleted from Git
          selfHeal: true       # Correct drift automatically
          allowEmpty: false
        
        syncOptions:
          - CreateNamespace=true
          - PrunePropagationPolicy=foreground
          - ServerSideApply=true
        
        retry:
          limit: 5
          backoff:
            duration: 5s
            factor: 2
            maxDuration: 3m
      
      revisionHistoryLimit: 10
      
      ignoreDifferences:
        - group: apps
          kind: Deployment
          jsonPointers:
            - /spec/replicas   # HPA manages replicas; ignore Git value
---
# ArgoCD project with RBAC
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: production
  namespace: argocd
spec:
  description: Production workloads
  
  sourceRepos:
    - https://github.com/myorg/infra-config
  
  destinations:
    - namespace: production
      server: https://kubernetes.default.svc
  
  clusterResourceWhitelist:
    - group: ''
      kind: Namespace
  
  namespaceResourceWhitelist:
    - group: apps
      kind: Deployment
    - group: ''
      kind: Service
    - group: autoscaling
      kind: HorizontalPodAutoscaler
  
  roles:
    - name: deploy
      description: Can sync but not delete apps
      policies:
        - p, proj:production:deploy, applications, sync, production/*, allow
        - p, proj:production:deploy, applications, get, production/*, allow
      groups:
        - engineers
```

### Promotion Workflow (GitHub Actions)

```yaml
# .github/workflows/promote.yml — Automated promotion on merge to main
name: Promote to Production

on:
  push:
    branches: [main]
    paths:
      - 'src/**'

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    outputs:
      image_tag: ${{ steps.meta.outputs.version }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Docker meta
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: myregistry/order-service
          tags: |
            type=sha,prefix=,format=short
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: ${{ steps.meta.outputs.tags }}
  
  promote-staging:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
        with:
          repository: myorg/infra-config
          token: ${{ secrets.INFRA_REPO_TOKEN }}
      
      - name: Update image tag in staging
        run: |
          cd environments/staging
          kustomize edit set image myregistry/order-service:${{ needs.build-and-push.outputs.image_tag }}
      
      - name: Create PR to staging
        uses: peter-evans/create-pull-request@v6
        with:
          token: ${{ secrets.INFRA_REPO_TOKEN }}
          commit-message: "chore: promote order-service ${{ needs.build-and-push.outputs.image_tag }} to staging"
          title: "Deploy order-service ${{ needs.build-and-push.outputs.image_tag }} to staging"
          branch: "deploy/staging/order-service-${{ needs.build-and-push.outputs.image_tag }}"
          base: main
          auto-merge: true   # Auto-merge after CI passes

  promote-production:
    needs: [build-and-push, promote-staging]
    runs-on: ubuntu-latest
    environment: production   # Requires manual approval
    steps:
      - uses: actions/checkout@v4
        with:
          repository: myorg/infra-config
          token: ${{ secrets.INFRA_REPO_TOKEN }}
      
      - name: Update image tag in production
        run: |
          cd environments/production
          kustomize edit set image myregistry/order-service:${{ needs.build-and-push.outputs.image_tag }}
      
      - name: Commit and push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add environments/production/kustomization.yaml
          git commit -m "chore: promote order-service ${{ needs.build-and-push.outputs.image_tag }} to production"
          git push
```

### Flux Alternative

```yaml
# clusters/prod-cluster/flux-system/apps.yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: apps
  namespace: flux-system
spec:
  interval: 5m
  path: environments/production
  prune: true
  sourceRef:
    kind: GitRepository
    name: infra-config
  healthChecks:
    - apiVersion: apps/v1
      kind: Deployment
      name: order-service
      namespace: production
  postBuild:
    substitute:
      ENVIRONMENT: production
  timeout: 5m
---
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: infra-config
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/myorg/infra-config
  ref:
    branch: main
  secretRef:
    name: github-credentials
```

### Drift Detection Alert

```yaml
# monitoring/argocd-drift-alert.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: argocd-alerts
spec:
  groups:
    - name: argocd
      rules:
        - alert: ArgoCDAppOutOfSync
          expr: argocd_app_info{sync_status="OutOfSync"} == 1
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "ArgoCD app {{ $labels.name }} is out of sync"
            description: "App {{ $labels.name }} has drifted from Git for more than 5 minutes"
        
        - alert: ArgoCDAppUnhealthy
          expr: argocd_app_info{health_status!="Healthy"} == 1
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "ArgoCD app {{ $labels.name }} is unhealthy"
```

## Rules

- **Git is the only deploy mechanism** — no `kubectl apply` directly to production; all changes go through Git.
- **Never store plaintext secrets in Git** — use SealedSecrets, External Secrets Operator, or Vault.
- **Separate config and app repos** — deployment configuration changes at a different rate than application code.
- **Auto-sync with self-heal** — drift should be automatically corrected, not just alerted on.
- **PR-based promotion** — every environment promotion is a PR, enabling review and audit.
- **Prune enabled** — resources deleted from Git must be removed from the cluster (prune: true).
- **Ignore HPA-managed replicas** — if HPA controls replicas, tell ArgoCD to ignore that field.
- **Test manifests in CI** — run `kustomize build` + `kubeval` / `kubeconform` in PR checks.
- **Rollback = git revert** — training the team that reverting a commit is the rollback mechanism.
- **Environment branches vs. directories** — prefer directories + kustomize overlays over environment branches.
