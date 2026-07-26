---
name: multi-cloud-strategy
description: Design multi-cloud architectures for resilience, cost optimisation, or vendor independence. Outputs cloud placement decisions, abstraction layer strategy, data sovereignty approach, and operational model.
argument-hint: [primary cloud, secondary cloud, business drivers, workload types, team cloud expertise]
allowed-tools: Read, Write
---

# Multi-Cloud Strategy

Multi-cloud solves specific problems: disaster recovery across clouds, avoiding vendor lock-in for regulated workloads, cost arbitrage, or regulatory data sovereignty. It also adds operational complexity, networking costs, and tooling overhead. Solve a real problem — don't multi-cloud because it sounds strategic.

## Process

1. **Clarify the business driver.** DR? Cost? Lock-in avoidance? Regulatory? Each leads to a different architecture.
2. **Classify workloads.** Which workloads benefit from multi-cloud? Not everything should be replicated.
3. **Choose an abstraction strategy.** Lowest common denominator (Kubernetes everywhere) vs best-of-breed per cloud vs wrapper abstractions.
4. **Design the data layer.** Data replication is the hardest part. Consistency, latency, egress costs.
5. **Define the operational model.** One team? Cloud-specialist teams? Shared tooling?
6. **Measure total cost.** Multi-cloud has egress costs, tooling costs, and training costs that single-cloud doesn't.
7. **Document the failover procedures.** Multi-cloud DR only works if you test it.

## When to Use Multi-Cloud

```
USE MULTI-CLOUD when:
  ✓ Active-active DR requirement (RPO=0, RTO<minutes)
  ✓ Regulatory requirement to avoid single-vendor dependency
  ✓ Specific service only available on one cloud (use that cloud for that service)
  ✓ Data sovereignty: EU data must stay in EU, US in US
  ✓ Price arbitrage on commodity compute (spot/preemptible)

AVOID MULTI-CLOUD when:
  ✗ "We don't want to be locked in" (without specific threat)
  ✗ Team doesn't have expertise in both clouds
  ✗ You're pre-product-market-fit (operational overhead is ruinous)
  ✗ You're already struggling with single-cloud operations
  ✗ The math on egress costs doesn't work out
```

## Architecture Patterns

### Pattern 1: Active-Passive DR
```
Primary: AWS (us-east-1)          Secondary: GCP (us-central1)
┌──────────────────────┐          ┌──────────────────────┐
│  EKS + RDS + S3      │  async   │  GKE + CloudSQL       │
│  (handles all traffic│ ────────▶│  (warm standby)       │
│   normally)          │ replicate│  RPO: ~5min           │
└──────────────────────┘          └──────────────────────┘
         │                                  │
         └──────────┬───────────────────────┘
                    │
              Route53 / Cloudflare
              (failover on health check)

COST: ~30-40% overhead for standby
RTO: 5-15 minutes
RPO: 5 minutes (replication lag)
Use for: Regulated industries, critical services
```

### Pattern 2: Active-Active Multi-Region
```
AWS (us-east-1)         GCP (europe-west1)
┌────────────┐          ┌────────────┐
│ US Traffic │          │ EU Traffic │
│ EKS + RDS  │◄────────►│ GKE + Cloud│
│            │ sync     │ SQL        │
└────────────┘ (CockroachDB/Spanner) └────────────┘
       │                                   │
       └──────────── Cloudflare ───────────┘
                    (GeoDNS routing)

Use for: Global products with regional data sovereignty
COST: 2× infrastructure + significant egress
Complexity: HIGH — distributed transactions, conflict resolution
```

### Pattern 3: Cloud-of-Best-Services
```
AWS:              GCP:                Azure:
- S3 (storage)   - BigQuery (DWH)   - Azure AD (identity)
- EKS (compute)  - Vertex AI (ML)   - (nothing else)
- RDS (database)

Compute in AWS, analytics in GCP, identity in Azure.
Connect via private interconnects or VPN.
Use for: Best-of-breed without full redundancy
```

## Kubernetes Abstraction Layer

```yaml
# Using Crossplane for cloud-agnostic resource provisioning
# Works across AWS, GCP, Azure

# Abstract database — provisions RDS or CloudSQL based on target cluster
apiVersion: database.example.io/v1alpha1
kind: PostgreSQLInstance
metadata:
  name: orders-db
spec:
  parameters:
    storageGB: 100
    version: "15"
    tier: standard
  compositionSelector:
    matchLabels:
      cloud: aws          # Change to 'gcp' for GCP
      environment: production
  writeConnectionSecretToRef:
    name: orders-db-connection

---
# Cluster-level config per cloud
# kustomize/overlays/aws/kustomization.yaml
resources:
  - ../../base
patches:
  - target: { kind: Ingress }
    patch: |
      - op: replace
        path: /metadata/annotations/kubernetes.io~1ingress.class
        value: alb        # AWS Load Balancer Controller

# kustomize/overlays/gcp/kustomization.yaml
patches:
  - target: { kind: Ingress }
    patch: |
      - op: replace
        path: /metadata/annotations/kubernetes.io~1ingress.class
        value: gce        # GCP Ingress Controller
```

## Data Replication Strategy

```python
# CockroachDB — multi-cloud distributed SQL
# Automatically replicates across regions/clouds

# Startup config for 3-region cluster (AWS us-east-1, GCP us-central1, Azure eastus)
"""
cockroach start \
  --locality=cloud=aws,region=us-east-1,zone=us-east-1a \
  --join=aws-node1:26257,gcp-node1:26257,azure-node1:26257 \
  --advertise-addr=<aws-public-ip> \
  ...
"""

# Zone survivability — tolerate full cloud outage
"""
ALTER DATABASE orders CONFIGURE ZONE USING
  num_replicas = 5,
  constraints = '{"+cloud=aws": 2, "+cloud=gcp": 2, "+cloud=azure": 1}',
  lease_preferences = '[[+cloud=aws]]';  -- Primary cloud for reads
"""

# S3-compatible object storage — works across clouds
import boto3

# AWS S3
s3_aws = boto3.client('s3',
    endpoint_url=None,  # Default AWS endpoint
    aws_access_key_id=AWS_KEY,
    aws_secret_access_key=AWS_SECRET,
)

# GCP GCS (S3-compatible via interop)
s3_gcp = boto3.client('s3',
    endpoint_url='https://storage.googleapis.com',
    aws_access_key_id=GCP_HMAC_KEY,
    aws_secret_access_key=GCP_HMAC_SECRET,
)

# Cloudflare R2 (S3-compatible, zero egress)
s3_r2 = boto3.client('s3',
    endpoint_url=f'https://{ACCOUNT_ID}.r2.cloudflarestorage.com',
    aws_access_key_id=R2_KEY,
    aws_secret_access_key=R2_SECRET,
)

# Same code, different endpoints
def upload_object(client, bucket: str, key: str, data: bytes):
    client.put_object(Bucket=bucket, Key=key, Body=data)
```

## Networking: Cloud Interconnects

```hcl
# Terraform — AWS Direct Connect + GCP Cloud Interconnect
# (or use Megaport/Equinix for carrier-neutral interconnect)

# AWS side
resource "aws_dx_connection" "to_gcp" {
  name      = "aws-to-gcp-interconnect"
  bandwidth = "1Gbps"
  location  = "EqDC2"   # Equinix DC2 colocation
}

# Alternatively: VPN (lower cost, higher latency)
resource "aws_vpn_gateway" "main" {
  vpc_id = aws_vpc.main.id
}

resource "aws_customer_gateway" "gcp" {
  bgp_asn    = 65000
  ip_address = google_compute_address.vpn.address
  type       = "ipsec.1"
}

resource "aws_vpn_connection" "aws_to_gcp" {
  vpn_gateway_id      = aws_vpn_gateway.main.id
  customer_gateway_id = aws_customer_gateway.gcp.id
  type                = "ipsec.1"
  static_routes_only  = false
}
```

## Operational Model

```markdown
## Cloud Team Structure Options

Option A: Platform team owns all clouds
  + Consistent standards
  + Single point of expertise
  - Bottleneck; deep expertise in 2+ clouds is hard

Option B: Cloud-specialist squads
  + Deep cloud expertise
  - Inconsistent tooling; harder to move engineers

Option C: Federated (recommended for most)
  + Platform team sets standards and shared tooling
  + Product teams choose cloud for their workload
  + Guardrails via policy-as-code

Shared tooling (cloud-agnostic):
  - Terraform (IaC) with provider per cloud
  - GitHub Actions (CI) — runs anywhere
  - Datadog (observability) — multi-cloud agent
  - Vault (secrets) — cloud-agnostic
  - Kubernetes (compute) — runs on any cloud

Cloud-specific:
  - Managed databases (RDS, CloudSQL, Azure SQL)
  - Object storage (S3, GCS, Blob) — use S3-compatible API
  - Managed ML (SageMaker, Vertex, Azure ML)
```

## Cost Model

```
Multi-cloud cost components:
  1. Egress between clouds: $0.08-0.09/GB (AWS and GCP)
     At 10TB/month: $800-900/month just in egress
  
  2. Double infrastructure (active-passive DR):
     AWS: $5,000/month → GCP warm standby: +$2,000/month
  
  3. Tooling: Crossplane, Datadog multi-cloud, Terraform Cloud
     Add $500-2,000/month depending on scale
  
  4. Engineering overhead:
     ~20-30% more ops time for dual-cloud operations
     Training: $2,000-5,000/engineer for second cloud cert

Total: expect 40-60% overhead vs single cloud for active-passive
Active-active: expect 100%+ overhead — you're essentially running two copies
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Multi-cloud as strategy, not solution** | Adds complexity with no specific benefit | Define the exact problem it solves first |
| **Lowest-common-denominator everything** | Using only features available on all clouds wastes cloud-specific value | Use cloud-native features where appropriate |
| **Ignoring egress costs** | Data movement between clouds is expensive | Model egress before choosing architecture |
| **No tested failover** | DR exists on paper but not in practice | Quarterly failover drills |
| **Different tooling per cloud** | Operational complexity doubles | Standardise on cloud-agnostic tooling layer |
| **Replicating everything** | Not all workloads need multi-cloud | Classify workloads; only replicate what matters |

## 10 Rules

1. Define the specific business problem before choosing multi-cloud — "vendor independence" is not a problem.
2. Egress costs are material — model them before committing to cross-cloud data flows.
3. Data is the hardest part — choose the replication strategy (CockroachDB, Spanner, async CDC) before the compute strategy.
4. Use Kubernetes as the compute abstraction — it's the most proven cloud-agnostic layer.
5. Standardise tooling (Terraform, Datadog, Vault) above the cloud layer.
6. Test failover — an untested DR plan is not a DR plan.
7. Active-active is 2-3× harder than active-passive — start with active-passive.
8. One team owns cloud standards; product teams own workload placement.
9. Cloud-native managed services (RDS, CloudSQL) beat self-managed even in multi-cloud — don't run your own Postgres.
10. Revisit the strategy annually — cloud capabilities change fast; what required multi-cloud last year may not today.
