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
