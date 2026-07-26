---
name: network-policy
description: Design and implement Kubernetes NetworkPolicies and cloud security groups for zero-trust network segmentation. Outputs policy definitions, traffic flow diagrams, and validation tests.
argument-hint: [cluster CNI plugin, services to isolate, ingress sources, egress destinations]
allowed-tools: Read, Write, Bash
---

# Network Policy

Network policies implement zero-trust at the network layer: deny all by default, allow only what is explicitly required. Without them, any pod in a cluster can reach any other pod — a compromised workload becomes a pivot point for lateral movement.

## Process

1. **Confirm CNI supports NetworkPolicy.** Calico, Cilium, Weave, or Antrea — Flannel does NOT enforce policies.
2. **Map traffic flows.** For each service: what calls it (ingress), what does it call (egress), what namespaces are involved.
3. **Apply default-deny.** One policy per namespace that denies all ingress and egress.
4. **Allowlist required flows.** Specific policies for each required connection.
5. **Allow DNS.** Always allow UDP 53 to kube-dns — everything breaks without it.
6. **Test policies.** Verify allowed traffic works; verify blocked traffic is denied.
7. **Monitor denies.** Cilium and Calico can log/metric dropped packets — alert on unexpected denies.

## Default Deny — Apply First

```yaml
# Apply to every production namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}        # Matches ALL pods in namespace
  policyTypes:
    - Ingress
    - Egress
  # No ingress or egress rules = deny all
```

## Allow DNS (Required)

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
      to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
```

## Service-to-Service Policies

```yaml
# Allow frontend → API
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-api
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api-service
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
          namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: production
      ports:
        - protocol: TCP
          port: 8080

---
# Allow API → database
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-to-database
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api-service
      ports:
        - protocol: TCP
          port: 5432

---
# Allow API egress to external payment API
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-egress-external
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api-service
  policyTypes:
    - Egress
  egress:
    - ports:
        - port: 443
          protocol: TCP
      to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8       # Not internal
              - 172.16.0.0/12
              - 192.168.0.0/16

---
# Allow monitoring (Prometheus scraping)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-prometheus-scraping
  namespace: production
spec:
  podSelector: {}             # All pods — metrics endpoint on all
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: monitoring
          podSelector:
            matchLabels:
              app: prometheus
      ports:
        - port: 9090
          protocol: TCP
        - port: 8080     # /metrics often on app port
          protocol: TCP
```

## Cilium NetworkPolicy (Extended)

```yaml
# Cilium adds L7 (HTTP, DNS, gRPC) policies
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: api-l7-policy
  namespace: production
spec:
  endpointSelector:
    matchLabels:
      app: api-service
  ingress:
    - fromEndpoints:
        - matchLabels:
            app: frontend
      toPorts:
        - ports:
            - port: "8080"
              protocol: TCP
          rules:
            http:
              - method: GET
                path: /api/v1/.*
              - method: POST
                path: /api/v1/orders
  egress:
    - toFQDNs:           # Allow by DNS name (not IP)
        - matchName: api.stripe.com
        - matchPattern: "*.stripe.com"
      toPorts:
        - ports:
            - port: "443"
              protocol: TCP
    - toEndpoints:
        - matchLabels:
            app: postgres
      toPorts:
        - ports:
            - port: "5432"
              protocol: TCP
```

## Validation Testing

```bash
# Deploy a test pod to verify policies
kubectl run netpol-test \
  --image=nicolaka/netshoot \
  --restart=Never \
  -n production \
  -- sleep 3600

# Test allowed connection (should succeed)
kubectl exec -n production netpol-test -- \
  curl -s --max-time 5 http://api-service:8080/health

# Test blocked connection (should fail/timeout)
kubectl exec -n production netpol-test -- \
  curl -s --max-time 5 http://postgres:5432  # should timeout

# Test cross-namespace (should fail if not allowed)
kubectl exec -n staging netpol-test -- \
  curl -s --max-time 5 http://api-service.production:8080/health

# Cilium policy verdicts (shows what is allowed/denied)
kubectl exec -n kube-system -c cilium \
  ds/cilium -- cilium policy get

# List Cilium drops
kubectl exec -n kube-system ds/cilium -c cilium -- \
  cilium monitor --type drop 2>&1 | head -50

# Calico policy debug
calicoctl get networkpolicy -n production -o yaml
kubectl logs -n kube-system -l k8s-app=calico-node | grep -i deny

# Cleanup test pod
kubectl delete pod netpol-test -n production
```

## AWS Security Groups (Cloud Layer)

```hcl
# Terraform — security groups for EKS node groups
resource "aws_security_group" "api_nodes" {
  name        = "api-nodes"
  description = "API service node group"
  vpc_id      = var.vpc_id

  # Allow inter-node communication within cluster
  ingress {
    description     = "Node to node"
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    self            = true
  }

  # Allow ALB to reach nodes
  ingress {
    description     = "ALB to API"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Egress: HTTPS to internet (Stripe, etc.)
  egress {
    description = "HTTPS to internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Egress: PostgreSQL RDS
  egress {
    description     = "API to RDS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.rds.id]
  }
}

resource "aws_security_group" "rds" {
  name        = "rds-postgres"
  description = "RDS PostgreSQL — API access only"
  vpc_id      = var.vpc_id

  ingress {
    description     = "API nodes only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.api_nodes.id]
  }

  # No egress for RDS
}
```

## Traffic Flow Map Template

```
namespace: production

[internet]
    │ HTTPS:443
    ▼
[ingress-nginx] ──────────────── namespace: ingress
    │ HTTP:8080
    ▼
[frontend] ──── allow ──────────► [api-service] ── allow ──► [redis:6379]
                                       │ allow
                                       ▼
                                  [postgres:5432]
                                       │
                              [monitoring namespace]
                                       │ allow (scrape)
                                  [prometheus]

BLOCKED:
  frontend → postgres (no policy)
  frontend → redis    (no policy)
  api-service → frontend (no policy)
  * → * across namespaces (default deny)
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No default deny** | Any pod can reach any other pod | Default-deny first; allowlist second |
| **Forgetting DNS egress** | Everything breaks silently | Always allow UDP/TCP 53 to kube-dns |
| **Using Flannel CNI** | NetworkPolicy objects created but not enforced | Use Calico, Cilium, or Antrea |
| **Namespace-only selectors** | Selects all pods in namespace, not just the target service | Combine namespaceSelector + podSelector |
| **Testing only happy path** | Blocked paths never verified | Test both allowed and blocked flows |
| **ipBlock for internal traffic** | IP ranges change; labels are stable | Use podSelector for internal; ipBlock for external |
| **No monitoring of drops** | Policy misconfiguration silent in production | Enable Cilium/Calico drop metrics |

## 10 Rules

1. Default-deny-all is the first policy applied to every namespace. Allowlisting comes after.
2. Always allow DNS egress — without it nothing works, and failure is silent and maddening.
3. Combine namespaceSelector AND podSelector — namespace-only is too broad.
4. Verify your CNI enforces NetworkPolicy before trusting it. Flannel silently ignores them.
5. Test blocked flows, not just allowed flows. Missing a deny is a security hole.
6. Label pods consistently — policies depend on labels. Unlabelled pods cannot be targeted precisely.
7. Egress policies are as important as ingress — compromised pods should not be able to exfiltrate data.
8. Use FQDN-based egress (Cilium) for external services — IP ranges change without warning.
9. Store NetworkPolicy manifests in Git alongside the service they protect.
10. Monitor policy drops in production — unexpected denies reveal misconfiguration or attacks.
