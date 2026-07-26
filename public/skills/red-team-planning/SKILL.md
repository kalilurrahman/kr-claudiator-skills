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

The canonical workflow for **Red Team Planning** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Plan and execute red team exercises to find security weaknesses before attackers do. Outputs exercise scope, attack scenarios, rules of engagement, findings fra
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
