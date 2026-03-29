---
name: red-team-planning
description: Plan and execute red team exercises to find security weaknesses before attackers do. Outputs exercise scope, attack scenarios, rules of engagement, findings framework, and remediation tracking.
argument-hint: [target systems, team size, duration, rules of engagement, compliance requirements]
allowed-tools: Read, Write
---

# Red Team Planning

Red teaming is adversarial security testing where a team simulates realistic attacks to find weaknesses that traditional testing misses. Unlike penetration testing (point-in-time technical assessment), red teaming tests people, processes, and technology together over an extended period.

## Exercise Types

```
ASSUMED BREACH
  Start with compromised endpoint or credentials
  Test detection, response, and lateral movement prevention
  Duration: 1-2 weeks
  Best for: Testing incident response capabilities

FULL RED TEAM
  Start from nothing; attempt to achieve objectives
  Tests full kill chain: recon, initial access, persistence, exfiltration
  Duration: 4-8 weeks
  Best for: Mature security programmes

PURPLE TEAM
  Red and blue teams work together; run-detect-learn-run
  Immediate feedback loop; maximises learning
  Duration: 2-5 days per scenario
  Best for: Building detection capabilities

SOCIAL ENGINEERING
  Phishing, vishing (phone), physical access
  Tests human and process controls
  Duration: 1-2 weeks
```

## Rules of Engagement

```markdown
# Red Team Exercise Rules of Engagement

**Exercise Name:** Project Tempest
**Period:** 2024-04-01 to 2024-05-15
**Authorisation:** Signed by CISO + Legal

## Scope — IN SCOPE
- Production web applications (api.example.com, app.example.com)
- Corporate network (10.0.0.0/8)
- Employee phishing (approved employee list only)
- Cloud infrastructure (AWS account ID: 123456789)

## Scope — OUT OF SCOPE
- Third-party SaaS services (Salesforce, Stripe)
- Physical locations (no physical intrusion)
- Denial of service attacks
- Data exfiltration of real customer data

## Objectives (Flags)
1. Access to customer PII database
2. Admin access to CI/CD pipeline
3. Access to production secrets

## Communication
- Immediate Stop Criteria: Evidence of real attack from external party
- Emergency contact: CISO (name, phone, Signal)
- Daily check-in: 9am via Signal group
- Deconfliction channel for blue team alerts

## Get Out of Jail Free
Each red team member carries a signed authorisation letter.
If challenged, immediately contact CISO before explaining.

## Data Handling
All found vulnerabilities encrypted and deleted after remediation.
No real data leaves the engagement environment.
```

## Attack Scenario Library

```markdown
## Scenario 1: Phishing → Credential Theft → Internal Pivot

Objective: Gain access to internal systems via spear phishing
Kill chain:
  1. OSINT: LinkedIn, job postings, GitHub — identify targets and tech stack
  2. Spear phishing: targeted email to engineering team
  3. Credential harvesting: clone login portal
  4. MFA bypass attempt: SIM swap, push notification fatigue
  5. Internal access: corporate VPN, internal tools
  6. Lateral movement: network scanning, privilege escalation
  7. Objective: admin access to production CI/CD

## Scenario 2: Supply Chain Attack

Objective: Compromise via a third-party dependency
Kill chain:
  1. Identify widely used internal packages (GitHub)
  2. Find maintainer accounts
  3. Attempt maintainer account compromise
  4. Inject malicious code into package
  5. Wait for CI/CD to pull and execute

## Scenario 3: Cloud Misconfiguration

Objective: Exfiltrate data via exposed cloud resources
Kill chain:
  1. Enumerate S3 buckets via common naming patterns
  2. Scan for public buckets or misconfigured IAM
  3. Access data without credentials
  4. Pivot to other resources using found credentials
```

## Findings Report Structure

```markdown
# Red Team Findings Report — Project Tempest

## Executive Summary
Exercise duration: 6 weeks
Objectives achieved: 2/3
Critical findings: 2 | High: 4 | Medium: 8

## Objective Achievement
| Objective | Achieved | Method | Time to Achieve |
|-----------|---------|--------|-----------------|
| Customer PII access | YES | SQL injection via API | 8 days |
| CI/CD admin access | YES | GitHub token in S3 bucket | 3 days |
| Production secrets | NO | Blocked by Vault policy | — |

## Timeline (Kill Chain)
Day 1-2: Recon — identified target employees via LinkedIn
Day 3:   Phishing email sent to 12 engineering targets
Day 4:   2 employees clicked; 1 entered credentials
Day 5:   Lateral movement — found S3 bucket with GitHub token
Day 8:   SQL injection discovered in search API

## Critical Finding: SQL Injection in Search API

Severity: CRITICAL (CVSS: 9.8)
Description: [Full technical detail]
Impact: Access to full customer database (450,000 records)
Evidence: [Screenshot/proof, sanitised]
Remediation: Parameterised queries; input validation
Owner: @backend-team
Fix deadline: 7 days

## Blue Team Detection Assessment
| Attack Stage | Detected | Time to Detect | Alert Generated |
|-------------|---------|----------------|-----------------|
| Phishing emails | YES | 2 hours | Email security alert |
| Credential use from new IP | NO | — | No alert |
| S3 bucket access | NO | — | No alert |
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No rules of engagement** | Ambiguity leads to scope creep or legal issues | Signed RoE before day one |
| **Red team as blame exercise** | Defenders become defensive | Purple team approach; shared learning |
| **Findings without remediation** | Testing without fixing | Every finding has owner and deadline |
| **Annual-only exercises** | Defences age; attacks evolve | Quarterly purple team + annual full red team |
| **Testing only technical controls** | Human/process gaps missed | Include social engineering and physical |

## 10 Rules

1. Signed authorisation from CISO + Legal before any activity.
2. Rules of engagement define scope, objectives, and stop criteria — in writing.
3. Emergency deconfliction channel prevents blue team from responding to a real attack.
4. Every red team member carries authorisation documentation.
5. Objectives are business-meaningful, not just technical flags.
6. Findings are shared with blue team for detection improvement, not just remediation.
7. All real data found during exercise is encrypted, not accessed, and deleted after.
8. Post-exercise purple team session maximises learning from each scenario.
9. Every finding has a named owner and a remediation deadline.
10. Validate remediations — re-test each finding after fix to confirm it works.
