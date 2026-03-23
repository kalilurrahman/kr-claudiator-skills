---
name: penetration-test-plan
description: Plan a penetration test engagement for a web application, API, or infrastructure target. Produces scope definition, test methodology, rules of engagement, finding classification, and remediation SLAs.
argument-hint: [target system, test type, compliance requirement, timeline]
allowed-tools: Read, Write
---

# Penetration Test Plan

A penetration test is a controlled, authorized attempt to exploit vulnerabilities in a system. A well-defined plan ensures the test is safe, legally authorized, comprehensive, and produces actionable findings. Poor planning leads to scope creep, accidental outages, legal risk, or a report that cannot be acted on.

## Test Types

| Type | Scope | When to use |
|------|-------|------------|
| Black box | No prior knowledge of system | Simulates external attacker; realistic but shallow |
| Gray box | Partial knowledge (user credentials, basic architecture) | Balances realism with coverage; most common |
| White box | Full knowledge (source code, architecture, credentials) | Maximum coverage; pre-production validation |
| Red team | Full adversarial simulation including social engineering | Mature security programs; tests detection capability |
| Bug bounty | Continuous, researcher-driven | Complements periodic pen tests |

## OWASP Top 10 Coverage Checklist

Every web app pen test should cover:
- [ ] A01 Broken Access Control
- [ ] A02 Cryptographic Failures
- [ ] A03 Injection (SQL, NoSQL, Command, LDAP)
- [ ] A04 Insecure Design
- [ ] A05 Security Misconfiguration
- [ ] A06 Vulnerable and Outdated Components
- [ ] A07 Identification and Authentication Failures
- [ ] A08 Software and Data Integrity Failures
- [ ] A09 Security Logging and Monitoring Failures
- [ ] A10 Server-Side Request Forgery (SSRF)

## Process

1. **Define the scope** — exact systems, IP ranges, domains, APIs in scope and explicitly out of scope.
2. **Get written authorization** — signed Rules of Engagement (ROE) from asset owner and legal.
3. **Identify test type** — black/gray/white box; internal vs external; authenticated vs unauthenticated.
4. **Set timeline** — reconnaissance, scanning, exploitation, reporting phases with dates.
5. **Define communication protocol** — who to contact for critical findings, how to pause if something breaks.
6. **Establish test environment** — production test or staging? Data handling requirements?
7. **Run the test** — reconnaissance, scanning, vulnerability identification, exploitation, post-exploitation.
8. **Document findings** — every finding with CVSS score, reproduction steps, evidence, remediation.
9. **Classify and triage** — Critical/High/Medium/Low with remediation SLAs.
10. **Produce the report** — executive summary + technical findings + remediation roadmap.

## Output Format

### Rules of Engagement Document

```markdown
# Penetration Test — Rules of Engagement
**Engagement ID:** PT-[YYYY]-[NNN]
**Client:** [Organization name]
**Tester / Firm:** [Tester name or firm]
**Authorized by:** [Name, title, signature]
**Date:** [Start date] – [End date]

---

## Authorization

[Organization] hereby authorizes [Tester] to perform security testing against the systems defined
in this document for the period specified above. This document constitutes written authorization
as required by applicable computer fraud and unauthorized access laws.

**Asset owner signature:** ___________________ Date: ___________
**Legal approval:**        ___________________ Date: ___________
**CISO / Security lead:**  ___________________ Date: ___________

---

## Scope

### In Scope
| Target | Type | Environment | Notes |
|--------|------|-------------|-------|
| api.example.com | Web API | Production | All endpoints |
| app.example.com | Web app | Production | Authenticated + unauthenticated |
| 10.0.1.0/24 | Internal network | — | Jump box access provided |

### Explicitly Out of Scope
- Third-party SaaS services (Stripe, Salesforce, Sendgrid)
- DNS infrastructure (managed by registrar)
- Physical security
- Social engineering / phishing
- Denial of Service attacks
- aws.amazon.com (shared infrastructure)

---

## Test Parameters

**Test type:** Gray box — credentials for 3 user roles provided
**Testing hours:** Business hours only (09:00–17:00 [Timezone]) unless critical finding requires immediate notification
**Data handling:** No real PII to be exfiltrated; test with synthetic data only
**Destructive testing:** Not permitted without explicit prior approval for each action

---

## Communication Protocol

**Primary contact:** [Name] — [phone] — [email]
**Emergency contact:** [Name] — [phone] (24/7 for critical findings)
**Critical finding notification:** Within 2 hours of discovery by phone + email
**Daily status:** Brief email by 17:00 each test day
**Pause trigger:** Contact primary contact immediately if:
  - Production service disruption is detected
  - Real customer data is accessed unexpectedly
  - Attack infrastructure is detected by client security team
```

### Finding Classification

```markdown
## Severity Classification (CVSS v3.1 Base Score)

| Severity | CVSS Range | Remediation SLA | Example |
|----------|-----------|-----------------|---------|
| Critical | 9.0–10.0 | 24 hours | RCE without auth, SQLi with data dump |
| High | 7.0–8.9 | 7 days | Auth bypass, IDOR exposing all users |
| Medium | 4.0–6.9 | 30 days | Stored XSS, CSRF on state-changing actions |
| Low | 0.1–3.9 | 90 days | Missing security headers, verbose error messages |
| Informational | N/A | Best effort | Security improvement recommendations |
```

### Finding Template

```markdown
## Finding #[N]: [Title]

**Severity:** Critical / High / Medium / Low
**CVSS Score:** [X.X] — [Vector string]
**CWE:** [CWE-XXX: Name]
**OWASP:** [A0X: Category]
**Affected component:** [URL / endpoint / system]

### Description
[Clear explanation of the vulnerability — what it is and why it exists]

### Business Impact
[What an attacker can do if this is exploited — data breach, account takeover, service disruption, etc.]

### Steps to Reproduce
1. Navigate to [URL]
2. Submit the following payload in the [field] parameter:
   ```
   [exact payload]
   ```
3. Observe [response / behavior]

### Evidence
[Screenshot or response snippet]
```
HTTP/1.1 200 OK
Content-Type: application/json

{"user_id": 1, "email": "admin@example.com", "role": "admin", ...}
```

### Root Cause
[Technical explanation of why this vulnerability exists]

### Remediation
[Specific, actionable fix]

**Short-term (mitigate immediately):**
- [Disable feature / add WAF rule / rotate credential]

**Long-term (fix properly):**
```python
# Vulnerable code
user = User.query.filter_by(id=request.args.get('id')).first()

# Fixed code — verify ownership before returning data
user = User.query.filter_by(
    id=request.args.get('id'),
    owner_id=current_user.id  # enforce access control
).first_or_404()
```

### References
- [CVE / CWE / OWASP link]
```

### Executive Summary Template

```markdown
# Penetration Test — Executive Summary

**Engagement:** [Name]  **Period:** [Dates]  **Tester:** [Name/Firm]

## Risk Overview

| Severity | Count | Remediated during test |
|----------|-------|----------------------|
| Critical | 1 | 0 |
| High | 4 | 1 |
| Medium | 8 | 3 |
| Low | 12 | 0 |
| Informational | 6 | — |

**Overall risk rating:** HIGH

## Key Findings
1. **[Critical] SQL Injection in /api/search** — allows unauthenticated database dump of all user records. Immediate remediation required.
2. **[High] Broken Object Level Authorization in /api/orders** — authenticated users can access any order by ID enumeration.
3. **[High] Session tokens not invalidated on logout** — stolen tokens remain valid indefinitely.

## Positive Findings
- HTTPS enforced on all endpoints; HSTS configured correctly
- Password hashing uses bcrypt with appropriate work factor
- Rate limiting present on authentication endpoints

## Remediation Priorities
[Link to full technical report with remediation roadmap]

## Attestation
This report represents a point-in-time assessment. Remediation of findings does not guarantee
the absence of other vulnerabilities. We recommend scheduling a re-test after remediation of
Critical and High findings.
```

## Test Methodology Phases

```
Phase 1 — Reconnaissance (Days 1–2)
  - Passive: OSINT, DNS enum, certificate transparency, job postings
  - Active: Port scan, service fingerprinting, web crawling, tech stack ID

Phase 2 — Scanning (Days 2–3)
  - Automated: Burp Suite Pro, OWASP ZAP, Nikto, Nmap
  - Manual: Review scan results; eliminate false positives

Phase 3 — Exploitation (Days 3–7)
  - Attempt to exploit identified vulnerabilities
  - Chain vulnerabilities where possible (e.g., SSRF → internal service access)
  - Document reproduction steps for every confirmed finding

Phase 4 — Post-Exploitation (Days 6–7)
  - Assess lateral movement from compromised position
  - Data access: what can be reached from compromised account?
  - Privilege escalation opportunities

Phase 5 — Reporting (Days 7–10)
  - Document all findings with CVSS, steps to reproduce, evidence
  - Executive summary + technical report
  - Remediation roadmap
  - Debrief call with client team
```

## Testing Tools

### Burp Suite
```
Configure proxy
Intercept/modify requests
Scanner for automated testing
```

### OWASP ZAP
```bash
zap-cli quick-scan https://example.com
# Automated vulnerability scanning
```

### SQLMap
```bash
sqlmap -u "https://site.com?id=1" --dump
# SQL injection testing
```

### Nmap
```bash
nmap -sV -sC example.com
# Port scanning, service detection
```

---

## Severity Scoring (CVSS)

```
Critical (9.0-10.0): RCE, Auth bypass, Full DB access
High (7.0-8.9): Stored XSS, Privilege escalation
Medium (4.0-6.9): Reflected XSS, CSRF
Low (0.1-3.9): Info disclosure, Missing headers
```

---

## Anti-Patterns to Avoid

| Anti-pattern | Risk | Fix |
|-------------|------|-----|
| No written authorization | Legal liability for tester and client | ROE signed before first packet sent |
| Vague scope | Test too narrow; important targets missed | Enumerate exact IPs, domains, endpoints |
| Testing production without safeguards | Accidental outage or data exposure | Define pause triggers; test in staging first |
| No critical finding escalation path | Critical vuln sits in draft report for days | Phone escalation within 2 hours of critical discovery |
| Automated-only test | Many vulnerabilities require human logic | Manual testing for all business logic flows |
| No retesting | Fixes are assumed but not verified | Schedule retest for Critical and High findings |

## Rules

- **Written authorization before any testing** — verbal permission is not protection against computer fraud charges.
- **Explicit out-of-scope list** — ambiguity always gets interpreted as in-scope during an active test.
- **Critical findings get a phone call** — do not wait for the report; notify within 2 hours.
- **Never exfiltrate real customer data** — use synthetic data; document that you could have accessed real data.
- **Pause before destructive actions** — confirm with client before dropping tables, crashing services, or overwriting data.
- **Reproduce every finding before reporting it** — unconfirmed vulnerabilities waste client remediation effort.
- **CVSS score every finding** — subjective severity labels cause argument; CVSS provides a consistent framework.
- **Include remediation code** — a finding without a fix is just a problem report; show the client how to fix it.
- **Retest after remediation** — findings closed without retest have unknown actual status.
- **Point-in-time caveat in every report** — a clean pen test does not mean a secure system.
