# Devops Infra

This folder contains a curated collection of AI skills (prompts) related to **Devops Infra**.

## 📚 Available Skills

| Skill | Name | Description |
|-------|------|-------------|
| [alerting-rules](./alerting-rules/SKILL.md) | alerting-rules | Design alerting rules for production monitoring with Prometheus, Grafana, PagerDuty. Outputs alert definitions, severity levels, escalation policies, and runbooks. |
| [ansible-playbook](./ansible-playbook/SKILL.md) | ansible-playbook | Write Ansible playbooks for server provisioning, configuration management, and application deployment. Outputs idempotent plays with roles, handlers, vault-encrypted secrets, and inventory management. |
| [backup-strategy](./backup-strategy/SKILL.md) | backup-strategy | Design backup and disaster recovery strategies with 3-2-1 rule, automated testing, and recovery procedures. Outputs backup schedules, retention policies, and RTO/RPO targets. |
| [blue-green-deploy](./blue-green-deploy/SKILL.md) | blue-green-deploy | Implement blue-green deployment strategy for zero-downtime releases with instant rollback capability. Outputs infrastructure configuration, traffic switching scripts, health check validation, and rollback procedures. |
| [canary-release](./canary-release/SKILL.md) | canary-release | Implement canary release strategy for gradual traffic shifting with automated promotion and rollback. Outputs traffic weight configuration, metric-based promotion gates, and rollback triggers. |
| [capacity-planning](./capacity-planning/SKILL.md) | capacity-planning | Plan infrastructure capacity for current and future load. Outputs resource projections, scaling thresholds, cost forecasts, and capacity headroom recommendations. |
| [ci-cd-advanced](./ci-cd-advanced/SKILL.md) | ci-cd-advanced | Design advanced CI/CD patterns with deployment strategies, progressive delivery, and rollback automation. Outputs pipeline configs, canary deployments, and blue-green setups. |
| [ci-cd-pipeline](./ci-cd-pipeline/SKILL.md) | ci-cd-pipeline | Design continuous integration and deployment pipelines. Outputs stages, testing, artifact management, deployment strategies, and rollback procedures. |
| [container-security](./container-security/SKILL.md) | container-security | Harden container images and Kubernetes workloads against attacks. Outputs secure Dockerfile patterns, admission policies, runtime security rules, and vulnerability scanning pipeline. |
| [cost-optimization](./cost-optimization/SKILL.md) | cost-optimization | Reduce cloud infrastructure costs through right-sizing, reserved capacity, spot instances, autoscaling, and waste elimination. Outputs cost analysis reports, rightsizing recommendations, and automated cleanup pipelines. |
| [developer-experience](./developer-experience/SKILL.md) | developer-experience | Improve developer experience through faster feedback loops, better local dev environments, reduced cognitive load, and tooling that gets out of the way. Outputs dev environment setup, pre-commit hooks, inner loop optimization, and DX metrics. |
| [disaster-recovery](./disaster-recovery/SKILL.md) | disaster-recovery | Design and document a disaster recovery plan for a production system. Covers RTO/RPO definition, failover architecture, backup verification, runbooks, and regular DR testing procedures. |
| [docker-compose](./docker-compose/SKILL.md) | docker-compose | Create production-ready Docker Compose configurations for multi-container applications. Outputs service definitions, networking, volumes, and environment management. |
| [gitops-workflow](./gitops-workflow/SKILL.md) | gitops-workflow | Implement GitOps deployment workflows where Git is the single source of truth for infrastructure and application state. Outputs ArgoCD/Flux configuration, repository structure, promotion workflows, and drift detection. |
| [helm-charts](./helm-charts/SKILL.md) | helm-charts | Create and manage Helm charts for Kubernetes application deployment. Outputs Chart.yaml, values.yaml, templates with best practices, named templates, hooks, and chart testing configuration. |
| [infrastructure-as-code-testing](./infrastructure-as-code-testing/SKILL.md) | infrastructure-as-code-testing | Test Terraform, Pulumi, and CloudFormation infrastructure code before deployment. Outputs unit tests, integration tests, compliance checks, and CI pipeline for IaC validation. |
| [infrastructure-testing](./infrastructure-testing/SKILL.md) | infrastructure-testing | Test infrastructure-as-code using automated frameworks. Covers unit tests for Terraform modules, integration tests with Terratest, compliance checks with OPA/Checkov, and drift detection. |
| [kubernetes-manifest](./kubernetes-manifest/SKILL.md) | kubernetes-manifest | Create production Kubernetes manifests with deployments, services, ingress, configs, and autoscaling. Outputs complete YAML with best practices. |
| [log-aggregation](./log-aggregation/SKILL.md) | log-aggregation | Design and implement centralized log aggregation pipelines using ELK Stack, CloudWatch Logs, or Loki. Outputs shipper configuration, parsing rules, retention policies, and search/alerting setup. |
| [monitoring-setup](./monitoring-setup/SKILL.md) | monitoring-setup | Setup monitoring with Prometheus, Grafana, alerting. Outputs metrics collection, dashboards, alert rules, and SLO tracking. |
| [multi-cloud-strategy](./multi-cloud-strategy/SKILL.md) | multi-cloud-strategy | Design multi-cloud architectures for resilience, cost optimisation, or vendor independence. Outputs cloud placement decisions, abstraction layer strategy, data sovereignty approach, and operational model. |
| [network-policy](./network-policy/SKILL.md) | network-policy | Design and implement Kubernetes NetworkPolicies and cloud security groups for zero-trust network segmentation. Outputs policy definitions, traffic flow diagrams, and validation tests. |
| [observability-platform](./observability-platform/SKILL.md) | observability-platform | Build a unified observability platform integrating metrics, logs, and traces (the three pillars). Outputs OpenTelemetry instrumentation, Prometheus + Grafana stack, centralized logging, and alerting runbooks. |
| [platform-engineering](./platform-engineering/SKILL.md) | platform-engineering | Build an internal developer platform (IDP) that abstracts infrastructure complexity — self-service environments, golden paths, service catalogs, and paved road toolchains for engineering teams. |
| [secrets-management](./secrets-management/SKILL.md) | secrets-management | Design secrets management with Vault, AWS Secrets Manager, encrypted storage. Outputs rotation policies, access controls, and audit logging. |
| [sre-runbook](./sre-runbook/SKILL.md) | sre-runbook | Write SRE runbooks for incident response, on-call procedures, and service recovery. Outputs structured runbooks with SLOs, alert response playbooks, escalation paths, and post-incident templates. |
| [terraform-module](./terraform-module/SKILL.md) | terraform-module | Production Terraform modules for infrastructure as code. Outputs reusable modules with variables, state management, and CI/CD integration. |

---
[⬅ Back to Main Repository](../README.md)
