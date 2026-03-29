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
