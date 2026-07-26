---
name: cloud-networking
description: Design and implement cloud network architecture with VPCs, subnets, security groups, and private connectivity. Outputs network topology, security group rules, PrivateLink configuration, and routing tables.
argument-hint: [cloud provider, workload types, compliance requirements, multi-region needs]
allowed-tools: Read, Write
---

# Cloud Networking

Cloud networking is the foundation of security and connectivity. A well-designed network isolates workloads, minimises internet exposure, enables private connectivity to managed services, and allows controlled inter-service communication. Bad network design is impossible to retrofit — design it right from day one.

## VPC Design Principles

```
SUBNETS BY TIER:
  Public:   Load balancers, NAT gateways, bastion hosts (have internet route)
  Private:  Application servers, containers (internet via NAT only)
  Isolated: Databases, caches (no internet, no NAT)

CIDR SIZING:
  VPC:      /16  (65,536 addresses — room to grow)
  Public:   /24  per AZ (254 addresses — just load balancers)
  Private:  /20  per AZ (4,094 addresses — most workloads)
  Isolated: /24  per AZ (254 addresses — databases)

MULTI-AZ: Always span 3 AZs for high availability
```

## Terraform — AWS VPC

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  name = "production"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnets = ["10.0.10.0/20", "10.0.26.0/20", "10.0.42.0/20"]
  database_subnets = ["10.0.100.0/24", "10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway     = true
  single_nat_gateway     = false  # One per AZ for HA
  enable_dns_hostnames   = true
  enable_dns_support     = true

  # Tags for subnet type discovery (EKS, ALB)
  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
  }
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }
}

# Security groups — minimal access
resource "aws_security_group" "alb" {
  name   = "alb"
  vpc_id = module.vpc.vpc_id

  ingress {
    description = "HTTPS from internet"
    from_port = 443; to_port = 443; protocol = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTP redirect"
    from_port = 80; to_port = 80; protocol = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    description     = "To app tier"
    from_port = 8080; to_port = 8080; protocol = "tcp"
    security_groups = [aws_security_group.app.id]
  }
}

resource "aws_security_group" "app" {
  name   = "app"
  vpc_id = module.vpc.vpc_id

  ingress {
    description     = "From ALB only"
    from_port = 8080; to_port = 8080; protocol = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    description     = "To RDS"
    from_port = 5432; to_port = 5432; protocol = "tcp"
    security_groups = [aws_security_group.rds.id]
  }
  egress {
    description = "HTTPS to internet (AWS APIs, external)"
    from_port = 443; to_port = 443; protocol = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "rds" {
  name   = "rds"
  vpc_id = module.vpc.vpc_id

  ingress {
    description     = "PostgreSQL from app only"
    from_port = 5432; to_port = 5432; protocol = "tcp"
    security_groups = [aws_security_group.app.id]
  }
  # No egress needed for RDS
}
```

## PrivateLink (No Internet for AWS Services)

```hcl
# S3 Gateway Endpoint — free, routes S3 traffic within AWS network
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = module.vpc.vpc_id
  service_name      = "com.amazonaws.us-east-1.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = module.vpc.private_route_table_ids
}

# ECR Interface Endpoints — pull container images without NAT
resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id              = module.vpc.vpc_id
  service_name        = "com.amazonaws.us-east-1.ecr.api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = module.vpc.private_subnets
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true
}

# Secrets Manager
resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id              = module.vpc.vpc_id
  service_name        = "com.amazonaws.us-east-1.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = module.vpc.private_subnets
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true
}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Everything in public subnets** | Direct internet exposure to databases | Databases in isolated subnets only |
| **0.0.0.0/0 egress in security groups** | Any outbound traffic allowed | Specific egress rules per destination |
| **Single NAT gateway** | AZ outage takes down all egress | One NAT per AZ |
| **No VPC endpoints** | AWS API traffic exits VPC via NAT → cost + latency | VPC endpoints for S3, ECR, Secrets Manager |
| **Shared security groups** | App and DB share group → misconfigured rules | Separate security group per tier |

## 10 Rules

1. Three tiers: public (LB only), private (apps), isolated (databases).
2. Databases never in public subnets — not even "temporarily".
3. Security groups are explicit allowlists — no inbound `0.0.0.0/0` except ALB port 443.
4. One NAT gateway per AZ — single NAT is a single point of failure.
5. VPC endpoints for S3, ECR, and Secrets Manager — reduce NAT costs and latency.
6. /16 VPC CIDR — sized for growth; you can't expand a VPC CIDR without pain.
7. Three AZs for all production subnets — two AZs means 50% capacity loss during AZ failure.
8. Infrastructure as code for all networking — no manual console changes.
9. Flow logs enabled — you need them for security investigations and cost attribution.
10. Test security group rules — automated compliance checks (AWS Config, Prowler) catch drift.

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

The canonical workflow for **Cloud Networking** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Design and implement cloud network architecture with VPCs, subnets, security groups, and private connectivity. Outputs network topology, security group rules, P
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
