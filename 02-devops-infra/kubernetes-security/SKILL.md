---
name: kubernetes-security
description: Harden Kubernetes clusters with RBAC, pod security, network policies, and supply chain controls. Outputs security baseline, admission policies, audit configuration, and hardening checklist.
argument-hint: [cluster type, workload sensitivity, compliance requirements, multi-tenancy needs]
allowed-tools: Read, Write
---

# Kubernetes Security

Kubernetes has a large attack surface — misconfigured RBAC, privileged pods, and exposed API servers are common breach vectors. A secure cluster implements defence-in-depth: restrict who can do what (RBAC), restrict what containers can do (Pod Security), restrict network traffic (NetworkPolicy), and detect anomalies (audit logging + Falco).

## RBAC Least Privilege

```yaml
# BAD — wildcard permissions are dangerous
kind: ClusterRole
rules:
  - apiGroups: ["*"]
    resources: ["*"]
    verbs: ["*"]

# GOOD — minimum required permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: order-service-role
  namespace: production
rules:
  # Only the secrets this service needs
  - apiGroups: [""]
    resources: ["secrets"]
    resourceNames: ["db-credentials", "api-keys"]
    verbs: ["get"]
  # Read own pods for health checks
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: order-service-binding
  namespace: production
subjects:
  - kind: ServiceAccount
    name: order-service
    namespace: production
roleRef:
  kind: Role
  name: order-service-role
  apiGroup: rbac.authorization.k8s.io
```

## Pod Security Standards

```yaml
# Apply Pod Security Standards at namespace level
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted

# Restricted pod spec (compliant with restricted standard)
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      serviceAccountName: order-service
      automountServiceAccountToken: false
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        runAsGroup: 10001
        fsGroup: 10001
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: api
          image: myapp:v1.2.3@sha256:abc123  # Pin to digest
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: [ALL]
          resources:
            requests: {cpu: 100m, memory: 256Mi}
            limits: {cpu: 500m, memory: 512Mi}
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}
```

## Kyverno Security Policies

```yaml
# Block latest tag — force digest or semver
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: disallow-latest-tag
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-image-tag
      match:
        any:
          - resources:
              kinds: [Pod]
              namespaces: [production, staging]
      validate:
        message: "Use a specific image tag or digest, not 'latest'"
        pattern:
          spec:
            containers:
              - image: "!*:latest"

---
# Require resource limits
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-resource-limits
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-limits
      match:
        any:
          - resources: {kinds: [Pod]}
      validate:
        message: "CPU and memory limits are required"
        pattern:
          spec:
            containers:
              - resources:
                  limits:
                    cpu: "?*"
                    memory: "?*"
```

## Audit Logging

```yaml
# audit-policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  # Log all requests at RequestResponse level for sensitive resources
  - level: RequestResponse
    resources:
      - group: ""
        resources: [secrets, configmaps]
      - group: "rbac.authorization.k8s.io"
        resources: [roles, clusterroles, rolebindings, clusterrolebindings]

  # Log metadata for pod operations
  - level: Metadata
    resources:
      - group: ""
        resources: [pods, pods/exec, pods/portforward]

  # Log nothing for read-only system operations
  - level: None
    users: [system:kube-scheduler, system:kube-controller-manager]
    verbs: [get, list, watch]
    resources:
      - group: ""
        resources: [pods, nodes, endpoints]
```

## Hardening Checklist

```
API Server
  [ ] Anonymous auth disabled (--anonymous-auth=false)
  [ ] Audit logging enabled
  [ ] --authorization-mode=Node,RBAC (not AlwaysAllow)
  [ ] --enable-admission-plugins includes PodSecurity

RBAC
  [ ] No wildcard permissions in production
  [ ] Service accounts have minimal permissions
  [ ] Cluster-admin binding count minimised (audit quarterly)
  [ ] automountServiceAccountToken=false unless needed

Workloads
  [ ] All pods: runAsNonRoot, readOnlyRootFilesystem
  [ ] All pods: capabilities dropped, no privilege escalation
  [ ] All pods: resource limits set
  [ ] All pods: seccomp profile RuntimeDefault or custom
  [ ] Images pinned to digest (not :latest)

Network
  [ ] Default-deny NetworkPolicy in all namespaces
  [ ] Ingress restricted to known sources
  [ ] Egress restricted to required destinations

Secrets
  [ ] Secrets encrypted at rest (etcd encryption)
  [ ] No secrets in environment variables — use volume mounts
  [ ] External secrets operator for secrets manager integration
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Cluster-admin for app service accounts** | App compromise = cluster compromise | Minimum RBAC for each service account |
| **Running as root** | Container escape easier from root | `runAsNonRoot: true` + fixed UID |
| **Latest image tag** | Unexpected updates; no reproducibility | Pin to digest: `image@sha256:...` |
| **No audit logging** | Security incidents undetectable | Audit policy + centralised log shipping |
| **Privileged containers** | Full host access | Never `privileged: true` in production |

## 10 Rules

1. Every pod runs as non-root with a fixed UID — no exceptions in production.
2. Service accounts have only the permissions they need — no wildcard RBAC.
3. Images are pinned to digest — tags are mutable; digests are not.
4. Audit logging enabled for secrets, RBAC changes, and pod exec — these are your incident trail.
5. Default-deny NetworkPolicy in every production namespace.
6. Resource limits on every container — no limits = noisy neighbour risk.
7. `readOnlyRootFilesystem: true` — writable filesystems allow persistence of malicious payloads.
8. Admission controllers (Kyverno/OPA) enforce policies at deploy time — not just at audit.
9. Rotate service account tokens regularly — use projected volumes with short TTL.
10. Run CIS Benchmark scans quarterly — `kube-bench` reports regressions in cluster hardening.
