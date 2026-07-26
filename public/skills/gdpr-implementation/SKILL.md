---
name: gdpr-implementation
description: Implement GDPR compliance controls in software systems. Outputs data subject rights implementation, consent management, retention automation, breach notification procedures, and DPA templates.
argument-hint: [data types processed, EU user base size, existing systems, DPA relationships]
allowed-tools: Read, Write
---

# GDPR Implementation

GDPR is not a documentation exercise — it requires technical controls embedded in your systems. Article 25 mandates privacy by design. Implementation covers six areas: lawful basis, consent, data subject rights, retention, security, and breach response.

## Data Subject Rights (Articles 15-22)

```python
from datetime import datetime, timedelta
import json

class GDPRRightsService:
    def __init__(self, db, storage):
        self.db = db
        self.storage = storage

    async def handle_access_request(self, user_id: str) -> dict:
        """Article 15: Return all personal data within 30 days."""
        data = {
            "profile": await self.db.fetchone(
                "SELECT id, email, name, phone, address, created_at FROM users WHERE id = $1",
                [user_id]
            ),
            "orders": await self.db.fetchall(
                "SELECT id, status, total, created_at FROM orders WHERE customer_id = $1",
                [user_id]
            ),
        }
        await self.db.execute(
            "INSERT INTO dsr_requests (user_id, type, requested_at, deadline) VALUES ($1,'access',NOW(),$2)",
            [user_id, datetime.utcnow() + timedelta(days=30)]
        )
        return {"user_id": user_id, "data": data}

    async def handle_erasure_request(self, user_id: str) -> dict:
        """Article 17: Right to erasure with legal hold check."""
        legal_hold = await self.db.fetchone(
            "SELECT * FROM legal_holds WHERE user_id = $1 AND active = true", [user_id]
        )
        if legal_hold:
            return {"status": "denied", "reason": "Legal hold in place"}

        # Anonymise profile (preserve referential integrity)
        await self.db.execute("""
            UPDATE users SET
                email = CONCAT('deleted-', id, '@gdpr.deleted'),
                name = 'Deleted User', phone = NULL, address = NULL,
                gdpr_erased_at = NOW()
            WHERE id = $1""", [user_id])

        # Delete from marketing lists
        await self.db.execute("DELETE FROM email_subscriptions WHERE user_id = $1", [user_id])

        # Anonymise analytics (preserve aggregates)
        await self.db.execute(
            "UPDATE user_events SET user_id = 'gdpr-erased' WHERE user_id = $1", [user_id]
        )

        # NOTE: Financial transactions retained 7 years (legal obligation)
        await self.db.execute(
            "INSERT INTO dsr_requests (user_id, type, requested_at, completed_at) VALUES ($1,'erasure',NOW(),NOW())",
            [user_id]
        )
        return {"status": "completed", "retained": ["financial_transactions (7 year legal obligation)"]}

    async def handle_portability_request(self, user_id: str) -> bytes:
        """Article 20: Export data in machine-readable JSON."""
        data = await self.handle_access_request(user_id)
        return json.dumps(data["data"], default=str, indent=2).encode("utf-8")
```

## Consent Management

```python
from enum import Enum

class ConsentPurpose(str, Enum):
    MARKETING_EMAIL   = "marketing_email"
    ANALYTICS         = "analytics"
    PERSONALISATION   = "personalisation"
    THIRD_PARTY_SHARE = "third_party_share"

class ConsentManager:
    async def record_consent(self, user_id: str, purpose: ConsentPurpose,
                              granted: bool, ip: str, text_version: str) -> None:
        await self.db.execute("""
            INSERT INTO consent_records
                (user_id, purpose, granted, recorded_at, ip_address, text_version)
            VALUES ($1, $2, $3, NOW(), $4, $5)
        """, [user_id, purpose, granted, ip, text_version])

    async def check_consent(self, user_id: str, purpose: ConsentPurpose) -> bool:
        record = await self.db.fetchone("""
            SELECT granted FROM consent_records
            WHERE user_id = $1 AND purpose = $2
            ORDER BY recorded_at DESC LIMIT 1
        """, [user_id, purpose])
        return bool(record and record["granted"])
```

## Retention Automation

```sql
-- Daily job: enforce retention policies
-- Run as cron: 0 2 * * * psql -c "..."

-- Anonymise analytics events older than 2 years
UPDATE user_events
SET user_id = 'retention-expired'
WHERE event_time < NOW() - INTERVAL '2 years'
  AND user_id != 'retention-expired';

-- Delete user sessions older than 1 year
DELETE FROM user_sessions
WHERE started_at < NOW() - INTERVAL '1 year';

-- Financial records: flag for 7-year check (DO NOT DELETE automatically)
SELECT COUNT(*) FROM transactions
WHERE created_at < NOW() - INTERVAL '7 years'
  AND NOT retention_reviewed;
```

## 72-Hour Breach Notification Template

```markdown
GDPR BREACH NOTIFICATION — [YYYY-MM-DD]

Incident ID: INC-YYYYMMDD-NNN
Discovery Time: YYYY-MM-DD HH:MM UTC
DPA Notification Deadline: [Discovery + 72 hours]

Nature: [What happened — data accessed/exfiltrated/lost]
Personal data categories: [email, name, order history, etc.]
Approximate subjects affected: ~N users
Likely consequences: [Low/Medium/High risk + explanation]
Measures taken: [Containment, remediation, user notification plan]

Lead supervisory authority: [ICO / CNIL / BSI]
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **GDPR as documentation only** | Non-compliant despite having policies | Technical controls in code |
| **Hard deleting users** | Breaks referential integrity | Anonymise in place |
| **Single accept-all consent** | Violates granularity requirement | Separate consent per purpose |
| **No retention automation** | Data kept forever | Scheduled deletion with audit log |
| **Missing DSR tracking** | Can not prove compliance | Log every request with deadline |

## 10 Rules

1. Data mapping first — you cannot protect data you have not inventoried.
2. Consent is granular, revocable, and documented with timestamp and version.
3. Right to erasure has exceptions — legal obligation allows retention.
4. 72-hour DPA notification is a legal deadline — have the template ready.
5. Retention policies are enforced by code — manual deletion is unreliable.
6. Every DSR request is logged with deadline — missed deadlines are violations.
7. Portability means machine-readable JSON.
8. Right to erasure requests propagate to backups.
9. Sub-processor DPAs must be in place before sharing data.
10. Privacy impact assessments required for high-risk new processing activities.

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

The canonical workflow for **Gdpr Implementation** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Implement GDPR compliance controls in software systems. Outputs data subject rights implementation, consent management, retention automation, breach notificatio
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
