---
name: tech-debt-audit
description: Audit a codebase for technical debt, categorize findings by impact and effort, and produce a prioritized remediation plan with effort estimates and business justification.
argument-hint: [codebase or service name, team size, known pain points, business context]
allowed-tools: Read, Write, Bash
---

# Technical Debt Audit

Technical debt is not inherently bad — it is borrowed time. The problem is untracked, unmanaged debt that compounds interest in the form of slower delivery, higher defect rates, and engineer frustration. This audit makes debt visible, quantified, and prioritized so teams can make informed tradeoff decisions.

## Debt Taxonomy

| Type | Description | Examples |
|------|-------------|---------|
| Code debt | Hard-to-understand, duplicate, or fragile code | God classes, deep nesting, magic numbers |
| Architecture debt | Design decisions that no longer fit scale or requirements | Monolith blocking team autonomy, wrong data store |
| Dependency debt | Outdated libraries, EOL runtimes, security vulnerabilities | Node 14 EOL, log4j 1.x, unpinned deps |
| Test debt | Missing, flaky, or slow tests that reduce confidence | <40% coverage, 30-min CI, no integration tests |
| Documentation debt | Missing or wrong docs, no runbooks, tribal knowledge | Undocumented APIs, no incident playbooks |
| Infrastructure debt | Manual processes, snowflake servers, no IaC | Click-ops deployments, pets not cattle |
| Security debt | Known vulnerabilities, overprivileged access, no rotation | Hardcoded secrets, unpatched CVEs, root DB access |

## Process

1. **Gather inputs** — codebase access, CI metrics, incident history, team pain points survey, dependency manifests.
2. **Run automated scans** — static analysis, dependency vulnerability scan, test coverage, code complexity.
3. **Interview the team** — 30-min session: "What slows you down most? What are you afraid to touch?"
4. **Categorize findings** — assign type, severity (High/Medium/Low), and effort (S/M/L/XL).
5. **Estimate impact** — developer time lost per week, incident correlation, hiring/onboarding friction.
6. **Prioritize** — High impact + Low effort = do now. High impact + High effort = plan carefully.
7. **Write remediation plan** — specific tasks, owners, timelines, success metrics.
8. **Build the business case** — translate debt cost into engineering velocity and revenue impact.
9. **Get commitment** — negotiate a % of sprint capacity for debt reduction (typically 20%).
10. **Save** as `tech-debt-audit-[service]-[date].md`.

## Automated Scan Commands

```bash
# Python — complexity and coverage
pip install radon coverage pylint
radon cc src/ -a -s          # cyclomatic complexity
radon mi src/ -s             # maintainability index
coverage run -m pytest && coverage report --fail-under=70
pylint src/ --output-format=text > lint-report.txt

# JavaScript/TypeScript
npx eslint . --format json > eslint-report.json
npx jsinspect src/           # duplicate code detection
npx license-checker --onlyAllow 'MIT;ISC;Apache-2.0;BSD-2-Clause;BSD-3-Clause'

# Dependencies — vulnerability scan
pip-audit                    # Python
npm audit --json             # Node
trivy fs .                   # any language (container-aware)
snyk test                    # broad language support

# Outdated dependencies
pip list --outdated
npm outdated
./gradlew dependencyUpdates  # Gradle

# Dead code
vulture src/ --min-confidence 80   # Python dead code
ts-prune                           # TypeScript unused exports

# Secrets in code
gitleaks detect --source . -v
trufflehog filesystem .

# Infrastructure
tfsec .                      # Terraform security
checkov -d .                 # IaC policy checks
```

## Output Format

```markdown
# Technical Debt Audit: [Service / Codebase]
**Date:** [YYYY-MM-DD]
**Auditor:** [Name]
**Team:** [Team name]
**Codebase:** [Repo URL]
**LOC:** [Lines of code]

---

## Executive Summary

**Overall debt level:** 🔴 High / 🟡 Medium / 🟢 Manageable

**Key finding:** [One sentence — the most important problem]
e.g., "Test coverage at 23% and a 45-minute CI pipeline are adding approximately 8 hours/engineer/week of friction and are correlated with 60% of production incidents in the last quarter."

**Estimated weekly cost:** [X engineer-hours lost to debt-related friction]
**Recommended sprint allocation:** 20% capacity for 3 quarters to reach manageable level

---

## Findings by Category

### 🔴 Code Debt

| Finding | Location | Severity | Effort | Impact |
|---------|---------|---------|--------|--------|
| UserService: 1,400-line God class | `src/services/UserService.py` | High | L | Every user feature change touches this file; avg 3 merge conflicts/sprint |
| Duplicate order validation logic | `src/orders/`, `src/checkout/` | High | M | Bug fixed in one place, missed in other — caused incident #234 |
| Magic numbers throughout pricing | `src/pricing/*.py` | Medium | S | New engineer took 2 days to understand pricing model |
| Callback hell in legacy API client | `src/clients/legacy.js` | Medium | M | No error handling; silent failures in 3 flows |

**Cyclomatic complexity:** 23 functions with CC > 15 (threshold: 10)
**Duplicate code:** 14% (threshold: 5%)
**Avg function length:** 47 lines (target: < 20)

---

### 🔴 Test Debt

| Finding | Current | Target | Impact |
|---------|---------|--------|--------|
| Unit test coverage | 23% | 70% | High defect rate; fear of refactoring |
| Integration test coverage | 0% | Key flows covered | Database-level bugs reach production |
| CI pipeline duration | 45 min | < 12 min | 8 blocked hours/engineer/day |
| Flaky tests | 12 known | 0 | 3 false failures/day; engineers ignore CI |

**Incident correlation:** 60% of P1 incidents in Q1 involved code with < 20% coverage.

---

### 🟡 Dependency Debt

| Dependency | Current | Latest | Issue | Risk |
|-----------|---------|--------|-------|------|
| Python runtime | 3.8 | 3.12 | EOL Oct 2024 | Security patches unavailable |
| Django | 3.2 | 5.0 | LTS ends Apr 2024 | CVE exposure |
| requests library | 2.22.0 | 2.31.0 | 3 known CVEs | Data exfiltration risk |
| numpy | 1.21 | 1.26 | Compat issues with Python 3.12 | Blocks runtime upgrade |

**Critical CVEs:** 3 (CVSS > 8.0)
**High CVEs:** 7

---

### 🟡 Architecture Debt

| Finding | Severity | Effort | Business Impact |
|---------|---------|--------|----------------|
| All teams deploy via shared monolith | High | XL | One team's bug takes down all teams; 3 incidents in Q1 |
| Synchronous inter-service calls via HTTP | Medium | L | Cascading failures; UserService outage caused OrderService downtime |
| No database connection pooling | Medium | S | DB connection exhaustion under load (seen at 2x traffic) |
| Single-region deployment | Medium | L | No DR capability; estimated 4h MTTR on region failure |

---

### 🟢 Documentation Debt

| Finding | Severity | Effort |
|---------|---------|--------|
| No API documentation | Medium | M |
| 3 services have no runbooks | High | S |
| Onboarding takes 3 weeks (target: 1 week) | Medium | M |
| Architecture decision records: 0 | Low | S |

---

## Prioritized Remediation Plan

### Sprint 1–2: High impact, low effort (Quick wins)
- [ ] Fix 3 critical CVEs in dependencies — Owner: @sec-team — 1 sprint
- [ ] Add runbooks for 3 unrunbooked services — Owner: @on-call-team — 3 days
- [ ] Extract duplicate order validation into shared module — Owner: @orders-team — 1 sprint
- [ ] Enable database connection pooling — Owner: @infra — 2 days

### Sprint 3–6: High impact, medium effort
- [ ] Increase test coverage from 23% to 50% (focus: UserService, OrderService) — Owner: @team — 4 sprints
- [ ] Upgrade Python 3.8 → 3.12 + Django 3.2 → 4.2 — Owner: @platform — 3 sprints
- [ ] Refactor UserService into 3–4 focused services — Owner: @backend — 4 sprints
- [ ] Parallelize CI pipeline from 45 min to 15 min — Owner: @platform — 2 sprints

### Sprint 7–12: High impact, high effort (Planned investment)
- [ ] Introduce async messaging between services (Kafka/SQS) — Owner: @arch — 6 sprints
- [ ] Begin monolith decomposition (Orders domain first) — Owner: @orders-team — 6 sprints
- [ ] Multi-region deployment — Owner: @infra — 6 sprints

---

## Business Case

**Current cost of debt (weekly):**
- CI wait time: 8 engineers × 2 blocked hours/day × 5 days = 80 engineer-hours/week
- Incident investigation (poor test coverage): avg 4h × 3 incidents/week = 12 engineer-hours/week
- Onboarding friction (3 weeks vs 1 week): 2 new hires/quarter × 80h extra = 160h/quarter = 12h/week avg
- **Total: ~104 engineer-hours/week** ≈ 2.6 full-time engineers

**Cost of remediation (sprint allocation):**
- 20% of 8-engineer team = 1.6 engineers dedicated
- Over 3 quarters = ~480 engineer-days

**Payback period:** Approximately 2 quarters — velocity gains exceed remediation cost by Q3.

---

## Team Pain Point Survey Results

Asked: "What slows you down most?"
1. "I'm afraid to touch UserService — one change breaks unrelated things" (6/8 engineers)
2. "CI takes 45 minutes and fails randomly 30% of the time" (7/8)
3. "No runbook for the payment service — every incident we start from scratch" (5/8)
4. "Can't upgrade Python because of numpy compat issues" (3/8)
5. "Every PR touches the same 3 files and causes merge conflicts" (6/8)
```

## Scoring Model

Use a simple matrix to prioritize:

```
Priority Score = (Business Impact × 3) + (Developer Pain × 2) + (Risk × 2) - (Effort × 1)

Business Impact: 1–5 (5 = directly blocks revenue or causes incidents)
Developer Pain:  1–5 (5 = mentioned by >75% of team)
Risk:            1–5 (5 = active CVE or data loss risk)
Effort:          1–5 (5 = XL, months of work)
```

| Item | Impact | Pain | Risk | Effort | Score |
|------|--------|------|------|--------|-------|
| Fix CVEs | 4 | 2 | 5 | 1 | 25 |
| CI pipeline | 3 | 5 | 1 | 3 | 18 |
| Test coverage | 5 | 4 | 4 | 4 | 27 |
| UserService refactor | 4 | 5 | 2 | 5 | 21 |

## Debt Categories

### 1. Security Vulnerabilities (Critical)

#### [S1] SQL Injection in User Search
- **Location:** `api/search.py:45-62`
- **Issue:** Raw SQL query with string interpolation `f"SELECT * FROM users WHERE name = '{query}'"`
- **Impact:** Attackers can extract entire database, create admin accounts
- **Remediation:** Use parameterized queries `cursor.execute("SELECT * FROM users WHERE name = %s", [query])`
- **Effort:** 1 day (includes testing)
- **Priority:** P0 (Fix immediately)

#### [S2] Hardcoded AWS Credentials
- **Location:** `config/aws.py:12`
- **Issue:** `AWS_SECRET_KEY = "AKIAIOSFODNN7EXAMPLE"` committed to repo
- **Impact:** Anyone with repo access can compromise AWS account
- **Remediation:** Move to environment variables, rotate keys, enable AWS Secrets Manager
- **Effort:** 0.5 days
- **Priority:** P0 (Fix immediately)

#### [S3] Missing Authentication on Admin Endpoints
- **Location:** `api/admin.py:78-120`
- **Issue:** `/admin/delete-user` endpoint has no auth decorator
- **Impact:** Anyone can delete user accounts
- **Remediation:** Add `@require_admin_auth` decorator
- **Effort:** 0.5 days
- **Priority:** P0 (Fix immediately)

---

### 2. Performance Issues (High Impact)

#### [P1] N+1 Query in Order List
- **Location:** `views/orders.py:34`
- **Issue:** Fetching related user for each order in loop (100+ queries for 100 orders)
- **Impact:** Order page takes 8s to load, times out under load
- **Remediation:** Use `select_related('user')` in initial query
- **Effort:** 0.5 days
- **ROI:** Page load drops from 8s to 0.3s, reduces DB load 99%
- **Priority:** P1

#### [P2] Missing Index on orders.user_id
- **Location:** Database schema
- **Issue:** `WHERE user_id = ?` queries do full table scan
- **Impact:** User order history query takes 2.5s (will worsen as data grows)
- **Remediation:** `CREATE INDEX idx_orders_user_id ON orders(user_id)`
- **Effort:** 0.25 days (includes testing on staging)
- **ROI:** Query drops from 2.5s to 0.05s
- **Priority:** P1

#### [P3] Uncompressed Images Served
- **Location:** Frontend build
- **Issue:** 5MB product images served without compression
- **Impact:** Page load on mobile takes 15s, 60% bounce rate
- **Remediation:** Add image optimization pipeline (WebP, responsive sizes)
- **Effort:** 2 days
- **ROI:** Page load drops to 3s, estimated 20% bounce rate reduction
- **Priority:** P1

---

### 3. Code Quality (Maintainability)

#### [C1] 800-Line God Function
- **Location:** `services/order_processor.py:process_order()`
- **Issue:** Single function handles validation, payment, inventory, email, logging
- **Impact:** Cannot test individual steps, bug fixes break unrelated features
- **Remediation:** Extract to 6 smaller functions (validate, charge, reserve_inventory, send_email, log, handle_errors)
- **Effort:** 3 days
- **ROI:** Reduces bug introduction rate, enables unit testing each step
- **Priority:** P2

#### [C2] Duplicated Validation Logic
- **Location:** `api/users.py`, `api/auth.py`, `api/profile.py` (3 files)
- **Issue:** Email validation regex copied across 3 files with slight differences
- **Impact:** Bug fixes require changing 3 places, inconsistent validation
- **Remediation:** Extract to `validators.py:validate_email()`
- **Effort:** 0.5 days
- **ROI:** Single source of truth, consistent behavior
- **Priority:** P2 (Quick Win)

#### [C3] No Unit Tests for Payment Logic
- **Location:** `services/payment.py`
- **Issue:** 0% test coverage on payment processing (300 lines)
- **Impact:** Cannot safely refactor, production bugs caught by customers
- **Remediation:** Add unit tests for charge, refund, webhook handling
- **Effort:** 4 days
- **ROI:** Prevents production payment bugs (cost: customer trust, refund overhead)
- **Priority:** P1

---

### 4. Dependency Debt

#### [D1] Django 2.2 (EOL)
- **Location:** `requirements.txt`
- **Issue:** Django 2.2 end-of-life April 2022, no security patches
- **Impact:** Known CVEs (CVE-2023-XXXX), cannot use new features
- **Remediation:** Upgrade to Django 4.2 LTS
- **Effort:** 8 days (includes compatibility testing)
- **Priority:** P1

#### [D2] 14 Outdated NPM Packages
- **Location:** `package.json`
- **Issue:** React 16 (current: 18), Webpack 4 (current: 5), etc.
- **Impact:** Missing performance improvements, security patches
- **Remediation:** Upgrade packages incrementally, test after each
- **Effort:** 5 days
- **Priority:** P2

---

### 5. Scalability Issues

#### [SC1] Session Data in Database
- **Location:** `auth/sessions.py`
- **Issue:** Session tokens stored in PostgreSQL, queried on every request
- **Impact:** Database bottleneck at 1000+ concurrent users
- **Remediation:** Move to Redis for session storage
- **Effort:** 3 days
- **ROI:** Reduces DB load 30%, supports 10x more concurrent users
- **Priority:** P2 (defer until traffic grows)

---

## Anti-Patterns to Avoid

| Anti-pattern | What it looks like | Fix |
|-------------|-------------------|-----|
| Boiling the ocean | "We need to rewrite everything" | Incremental improvement; strangler fig pattern |
| Debt theater | Big audit report nobody acts on | Negotiate sprint allocation before publishing the audit |
| Ignoring team input | Audit based only on metrics | Engineer pain points reveal debt metrics miss |
| No success metrics | Debt reduced but nobody notices | Define "done": coverage %, CI time, incident rate |
| All or nothing | Won't fix unless fully resolved | Incremental improvement — 23% to 40% is valuable |
| Tech debt as punishment | Engineers feel blamed for existing debt | Frame as investment, not blame |

## Rules

- **Make debt visible before it is urgent** — an untracked debt audit is just the team ignoring problems it knows exist.
- **Quantify in engineer-hours** — "slow CI" is an opinion; "45-minute CI × 8 engineers = 6 hours/day" is a budget decision.
- **Interview the team** — automated tools find complexity; engineers know what actually hurts.
- **Prioritize by impact × effort** — fix high-impact low-effort items first; build momentum.
- **Negotiate capacity before starting** — 20% per sprint is the standard; get explicit commitment.
- **Measure before and after** — define the metric (CI time, coverage %, incident rate) and track it.
- **Frame as investment, not failure** — debt accumulates because teams moved fast; that was often the right call.
- **Incremental over big-bang** — strangler fig pattern; never stop the world for a rewrite.
- **Security debt gets expedited** — critical CVEs skip the backlog and go into the next sprint.
- **Revisit quarterly** — debt audit is not a one-time event; schedule a lightweight quarterly review.
