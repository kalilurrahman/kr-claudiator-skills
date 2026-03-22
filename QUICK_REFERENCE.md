# Quick Reference Guide

**One-page guide to using the Tech Skills Collection**

---

## 🎯 What Are These Skills?

Claude skills are structured prompts that guide AI to produce high-quality, production-ready technical documentation, code, and strategies. Each skill follows a proven pattern:

1. **Process** - Step-by-step methodology
2. **Output Format** - Concrete examples
3. **Rules** - Critical constraints

---

## 📂 Collection Structure

```
tech-skills-collection/
├── README.md                  # Full catalog of 100 skills
├── PROGRESS.md               # Completion status
├── QUICK_REFERENCE.md        # This file
│
├── 01-software-dev/          # 10 detailed + 10 cataloged
│   ├── api-design/
│   ├── database-schema/
│   ├── code-review/
│   └── ...
│
├── 02-devops-infra/          # 1 detailed + 14 cataloged
│   └── docker-compose/
│
├── 03-data-analytics/        # 1 detailed + 14 cataloged
│   └── etl-pipeline/
│
├── 04-ai-ml/                 # 1 detailed + 14 cataloged
│   └── ml-pipeline/
│
└── 05-security/              # 1 detailed + 9 cataloged
    └── security-audit/
```

---

## ⚡ Quick Start

### Use Case 1: API Development
```
Skills needed:
1. api-design          → Define endpoints
2. database-schema     → Design data model
3. error-handling      → Implement error responses
4. logging-strategy    → Add observability
```

### Use Case 2: Microservices Platform
```
Skills needed:
1. microservices-design → Service boundaries
2. docker-compose       → Local dev environment
3. async-patterns       → Background jobs
4. caching-strategy     → Performance optimization
```

### Use Case 3: Data Platform
```
Skills needed:
1. etl-pipeline        → Data ingestion
2. data-quality-checks → Validation (cataloged)
3. dashboard-design    → Visualization (cataloged)
```

### Use Case 4: ML System
```
Skills needed:
1. ml-pipeline         → Training pipeline
2. model-deployment    → Production serving (cataloged)
3. ml-monitoring       → Drift detection (cataloged)
```

---

## 🔍 Finding the Right Skill

### By Problem Type

| Problem | Recommended Skills |
|---------|-------------------|
| "Design an API" | api-design |
| "Set up logging" | logging-strategy |
| "Improve performance" | caching-strategy, async-patterns |
| "Fix security issues" | security-audit |
| "Build data pipeline" | etl-pipeline |
| "Deploy ML model" | ml-pipeline |
| "Containerize app" | docker-compose |

### By Role

| Role | Core Skills |
|------|------------|
| **Backend Engineer** | api-design, database-schema, error-handling, microservices-design |
| **Data Engineer** | etl-pipeline, data-warehouse-schema (cataloged), streaming-pipeline (cataloged) |
| **ML Engineer** | ml-pipeline, model-deployment (cataloged), ml-monitoring (cataloged) |
| **DevOps Engineer** | docker-compose, kubernetes-manifest (cataloged), ci-cd-pipeline (cataloged) |
| **Security Engineer** | security-audit, threat-modeling (cataloged), compliance-checklist (cataloged) |

---

## 📊 Skill Status Key

- **✅ Detailed** = Fully implemented (300-500 lines)
- **📝 Cataloged** = Documented in README, awaiting implementation

---

## 💡 How to Use a Skill

### Example: Using api-design Skill

**Step 1: Review the skill**
```bash
cat 01-software-dev/api-design/SKILL.md
```

**Step 2: Apply to your project**
- Follow the Process section
- Use the Output Format as template
- Adhere to the Rules

**Step 3: Customize**
- Adapt examples to your tech stack
- Add domain-specific requirements
- Integrate with other skills

---

## 🔗 Skill Combinations

### Common Workflows

**New Service Development:**
```
api-design → database-schema → error-handling → logging-strategy
                                                        ↓
                                            docker-compose → ci-cd-pipeline (cataloged)
```

**Performance Optimization:**
```
caching-strategy → async-patterns → database-schema (indexes)
```

**Security Hardening:**
```
security-audit → threat-modeling (cataloged) → encryption-strategy (cataloged)
```

**Data Platform:**
```
etl-pipeline → data-quality-checks (cataloged) → data-retention (cataloged)
```

---

## 📝 Detailed vs Cataloged Skills

### Detailed Skills (14)
**What you get:**
- 300-500 lines of comprehensive content
- Code examples in multiple languages
- Complete implementation patterns
- Monitoring and troubleshooting guides
- Real-world scenarios

**Example:** `api-design` includes:
- Complete REST/GraphQL spec
- Authentication flows
- Error handling patterns
- Rate limiting implementation
- OpenAPI YAML generation

### Cataloged Skills (86)
**What you get:**
- Clear description
- Key features
- Use cases
- Dependencies
- Category placement

**Purpose:** Blueprint for future detailed implementations

---

## 🎓 Skill Complexity Levels

### Beginner (Easy to Implement)
- git-workflow
- docker-compose
- logging-strategy
- error-handling

### Intermediate (Moderate Complexity)
- api-design
- database-schema
- etl-pipeline
- caching-strategy

### Advanced (High Complexity)
- microservices-design
- ml-pipeline
- security-audit
- async-patterns

---

## 📈 Next Steps

### For Contributors
1. Pick a cataloged skill
2. Follow the detailed skill template
3. Add code examples
4. Include monitoring guidance
5. Update README

### For Users
1. Browse README catalog
2. Identify relevant skills
3. Review detailed implementations
4. Adapt to your needs
5. Combine multiple skills

---

## 🔧 Template for New Skills

```markdown
---
name: skill-name
description: What this skill does
argument-hint: [required inputs]
allowed-tools: Read, Write, Bash
---

# Skill Name

## Process
1. Step 1
2. Step 2
...

## Output Format
### Section 1
Examples...

## Rules
- Rule 1
- Rule 2
...
```

---

## 📚 Additional Resources

- **Full Catalog:** See README.md
- **Progress Tracking:** See PROGRESS.md
- **Original Inspiration:** Claude PM skills (uploaded reference)

---

## ✨ Key Takeaways

1. **14 detailed skills** ready to use today
2. **86 cataloged skills** documented and planned
3. **100% coverage** across major tech domains
4. **Production-ready** patterns and best practices
5. **Extensible** - add your own skills easily

---

**Last Updated:** March 21, 2026  
**Version:** 1.0
