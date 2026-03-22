# Tech Skills Collection - Complete Reference

**Version:** 2.0 (Batch 5)  
**Last Updated:** March 21, 2026  
**Status:** 27/100 detailed skills (27% complete)  
**Size:** 508 KB

---

## 📊 Quick Stats

| Metric | Value |
|--------|-------|
| Detailed Skills | 27 |
| Total Skills | 100 |
| Categories | 8 (all active) |
| Code Examples | 135+ |
| Lines of Documentation | ~10,000 |
| Average Skill Length | 380 lines |

---

## ✅ Completed Skills by Category

### 1. Software Development (14/20 - 70%) ⭐

1. **api-design** - REST/GraphQL API with OpenAPI specs
2. **async-patterns** - Queues, workers, Celery, SQS, Kafka
3. **caching-strategy** - Multi-layer caching, TTL, invalidation
4. **circuit-breaker** - Failure handling, states, fallbacks
5. **code-review** - Language-specific checklists
6. **database-schema** - DDL, indexes, migrations
7. **error-handling** - Error types, codes, logging
8. **feature-flags** - A/B testing, gradual rollouts
9. **git-workflow** - Branching strategies, CI/CD
10. **logging-strategy** - Structured logging, aggregation
11. **microservices-design** - Service boundaries, communication
12. **pagination-design** - Offset, cursor, keyset strategies
13. **rate-limiting** - Token bucket, distributed limiting
14. **tech-debt-audit** - Assessment, ROI, remediation

### 2. DevOps & Infrastructure (3/15 - 20%)

15. **ci-cd-pipeline** - GitHub Actions, deployment
16. **docker-compose** - Multi-container apps
17. **kubernetes-manifest** - K8s YAML, HPA, security

### 3. Data & Analytics (2/15 - 13%)

18. **etl-pipeline** - Airflow, transformations
19. **sql-optimization** - Query optimization, indexing

### 4. AI/ML Engineering (2/15 - 13%)

20. **ml-pipeline** - MLflow, training, evaluation
21. **model-deployment** - FastAPI, Docker, serving

### 5. Security & Compliance (1/10 - 10%)

22. **security-audit** - OWASP, threat modeling

### 6. System Design (1/10 - 10%)

23. **system-design-doc** - Architecture documentation

### 7. Testing & Quality (2/10 - 20%) ✅ NEW

24. **e2e-test** - Playwright/Cypress, page objects
25. **integration-test** - pytest, testcontainers, fixtures

### 8. API & Integration (2/5 - 40%) ✅ NEW

26. **graphql-schema** - Types, queries, DataLoader
27. **websocket-design** - Real-time, Socket.IO, Redis

---

## 📚 Documentation Files

- **INDEX.md** - High-level statistics and overview
- **README.md** - This file
- **PROGRESS.md** - Detailed completion tracking
- **QUICK_REFERENCE.md** - Usage guide

---

## 🚀 Quick Start

### Find a Skill
```bash
# Browse by category
ls 01-software-dev/
ls 02-devops-infra/
ls 07-testing-quality/

# View a skill
cat 01-software-dev/api-design/SKILL.md
```

### Use Cases

**Building a REST API:**
1. api-design → Define endpoints
2. database-schema → Data model
3. error-handling → Error responses
4. rate-limiting → Prevent abuse

**Deploying Microservices:**
1. microservices-design → Architecture
2. docker-compose → Local dev
3. kubernetes-manifest → Production
4. circuit-breaker → Resilience

**ML Pipeline:**
1. ml-pipeline → Training
2. model-deployment → Serving
3. api-design → Prediction API

---

## 📁 Directory Structure

```
tech-skills-collection/
├── INDEX.md                    # Statistics & overview
├── README.md                   # This file
├── PROGRESS.md                 # Completion tracker
├── QUICK_REFERENCE.md          # Usage guide
├── 01-software-dev/            # 14 skills
│   ├── api-design/
│   ├── rate-limiting/
│   └── ...
├── 02-devops-infra/            # 3 skills
├── 03-data-analytics/          # 2 skills
├── 04-ai-ml/                   # 2 skills
├── 05-security/                # 1 skill
├── 06-system-design/           # 1 skill
├── 07-testing-quality/         # 2 skills
└── 08-api-integration/         # 2 skills
```

---

## 🎯 Skill Format

Each skill follows this structure:

```yaml
---
name: skill-name
description: Brief description
argument-hint: [key parameters]
allowed-tools: Read, Write, Bash
---

# Skill Name

Purpose paragraph.

## Process
Step-by-step workflow.

## Output Format
Concrete examples.

## Rules
Specific, opinionable constraints.
```

---

## 📈 Progress Timeline

- **Initial:** 14 skills (Software Dev focus)
- **Batch 3:** +2 skills (rate-limiting, pagination)
- **Batch 4:** +6 skills (circuit-breaker, feature-flags, kubernetes)
- **Batch 5:** +5 skills (testing & API categories launched)

---

## 🔜 Next Priorities

1. **DevOps** - terraform, monitoring, secrets (13%)
2. **Data** - warehouse, streaming, quality (13%)
3. **AI/ML** - feature-eng, monitoring, RAG (13%)

---

**Version:** 2.0  
**License:** Educational Use  
**Format:** Claude MCP Skill Pattern
