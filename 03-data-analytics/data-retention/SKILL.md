---
name: data-retention
description: Design data retention policies covering deletion schedules, archival tiers, compliance requirements, and right-to-erasure workflows. Outputs retention schedules, automated deletion jobs, anonymization strategies, and audit trails.
argument-hint: [data types, compliance requirements (GDPR/CCPA/HIPAA), storage costs, query requirements for old data]
allowed-tools: Read, Write, Bash
---

# Data Retention

Data retention balances legal compliance, storage cost, and query requirements. Too little retention violates business needs; too much creates compliance risk and storage cost. Every piece of data needs an explicit retention policy.

## Process

1. **Inventory all data** — what data exists, where it's stored, who owns it.
2. **Classify by sensitivity** — PII, financial, operational, logs, analytics.
3. **Determine legal requirements** — GDPR (3 years financial, erasure on request), HIPAA (6 years), CCPA.
4. **Define retention periods** — by data type, not one-size-fits-all.
5. **Design archival tiers** — hot (active DB) → warm (compressed archive) → cold (S3 Glacier).
6. **Automate deletion** — manual processes are forgotten; schedule deletion jobs.
7. **Implement right-to-erasure** — GDPR Article 17 requires deletion within 30 days of request.
8. **Audit the audit trail** — deletion logs must themselves be retained.

## Output Format

### Retention Policy Definition

```yaml
# data-retention-policy.yaml
version: "1.0"
last_reviewed: "2024-01-15"
next_review: "2025-01-15"

data_categories:
  user_accounts:
    description: "User registration data, preferences, authentication"
    contains_pii: true
    retention_period: "active + 3 years after account deletion"
    legal_basis: "GDPR Art. 6(1)(b) - contract; 7-year financial retention"
    storage: [postgres, s3]
    deletion_method: anonymize  # Replace with anonymous values
    right_to_erasure: true
    notes: "Retain transaction records 7 years for tax; anonymize PII"
  
  order_records:
    description: "Purchase history, invoices, shipping details"
    contains_pii: true  # Shipping address, name
    retention_period: "7 years from transaction date"
    legal_basis: "Tax law requires 7-year financial record retention"
    storage: [postgres, s3_archive]
    deletion_method: anonymize_pii_keep_financial
    right_to_erasure: false  # Overridden by financial law
    notes: "Shipping address anonymized; order amounts retained for tax"
  
  event_logs:
    description: "User behavior events, clickstream"
    contains_pii: true  # IP address, user_id
    retention_period: "13 months"  # Analytics comparison to prior year
    legal_basis: "GDPR Art. 6(1)(f) - legitimate interest"
    storage: [s3, redshift]
    deletion_method: delete
    right_to_erasure: true
    archive_after: "3 months"   # Move to cold storage after 3 months
  
  application_logs:
    description: "Server logs, error logs, access logs"
    contains_pii: true  # IP addresses
    retention_period: "90 days"
    legal_basis: "Security and debugging"
    storage: [cloudwatch, s3]
    deletion_method: delete
    right_to_erasure: true
    notes: "IP addresses pseudonymized after 30 days"
  
  analytics_aggregates:
    description: "Pre-aggregated metrics, no individual user data"
    contains_pii: false
    retention_period: "indefinite"
    legal_basis: "No PII; business analytics"
    storage: [redshift, s3]
    deletion_method: n/a
```

### Automated Deletion Jobs

```python
# retention/deletion_jobs.py
import logging
from datetime import datetime, timezone, timedelta
import boto3
import psycopg2
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

@dataclass
class DeletionResult:
    job_name: str
    rows_affected: int
    execution_time_ms: float
    errors: list[str]
    dry_run: bool

class RetentionJobRunner:
    def __init__(self, db_url: str, dry_run: bool = True):
        self.db_url = db_url
        self.dry_run = dry_run
    
    def run_all(self) -> list[DeletionResult]:
        """Run all scheduled retention jobs."""
        jobs = [
            self.delete_old_event_logs,
            self.anonymize_deleted_users,
            self.archive_old_orders,
            self.purge_expired_sessions,
            self.pseudonymize_old_access_logs,
        ]
        
        results = []
        for job in jobs:
            try:
                result = job()
                results.append(result)
                logger.info(f"Job {result.job_name}: {result.rows_affected} rows, dry_run={result.dry_run}")
            except Exception as e:
                logger.error(f"Job {job.__name__} failed: {e}")
                results.append(DeletionResult(
                    job_name=job.__name__,
                    rows_affected=0,
                    execution_time_ms=0,
                    errors=[str(e)],
                    dry_run=self.dry_run,
                ))
        
        return results
    
    def delete_old_event_logs(self) -> DeletionResult:
        """Delete event logs older than 13 months."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=395)  # 13 months
        
        start = datetime.now()
        rows = 0
        
        conn = psycopg2.connect(self.db_url)
        try:
            with conn.cursor() as cur:
                if self.dry_run:
                    cur.execute(
                        "SELECT COUNT(*) FROM event_logs WHERE occurred_at < %s",
                        (cutoff,)
                    )
                    rows = cur.fetchone()[0]
                    logger.info(f"[DRY RUN] Would delete {rows:,} event_logs before {cutoff.date()}")
                else:
                    # Delete in batches to avoid long locks
                    while True:
                        cur.execute("""
                            DELETE FROM event_logs
                            WHERE id IN (
                                SELECT id FROM event_logs
                                WHERE occurred_at < %s
                                LIMIT 10000
                            )
                        """, (cutoff,))
                        batch = cur.rowcount
                        conn.commit()
                        rows += batch
                        if batch == 0:
                            break
            
            self._log_deletion(conn, "event_logs", rows, cutoff)
        finally:
            conn.close()
        
        elapsed = (datetime.now() - start).total_seconds() * 1000
        return DeletionResult("delete_old_event_logs", rows, elapsed, [], self.dry_run)
    
    def anonymize_deleted_users(self) -> DeletionResult:
        """Replace PII with anonymous values for accounts deleted 30+ days ago."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        
        conn = psycopg2.connect(self.db_url)
        rows = 0
        try:
            with conn.cursor() as cur:
                if self.dry_run:
                    cur.execute(
                        "SELECT COUNT(*) FROM users WHERE deleted_at < %s AND is_anonymized = false",
                        (cutoff,)
                    )
                    rows = cur.fetchone()[0]
                else:
                    cur.execute("""
                        UPDATE users SET
                            email = 'deleted_' || id || '@anonymized.invalid',
                            name = 'Deleted User',
                            phone = NULL,
                            date_of_birth = NULL,
                            address = NULL,
                            profile_photo_url = NULL,
                            is_anonymized = true,
                            anonymized_at = NOW()
                        WHERE deleted_at < %s
                        AND is_anonymized = false
                    """, (cutoff,))
                    rows = cur.rowcount
                    conn.commit()
        finally:
            conn.close()
        
        elapsed = 0
        return DeletionResult("anonymize_deleted_users", rows, elapsed, [], self.dry_run)
    
    def _log_deletion(self, conn, table: str, rows: int, cutoff: datetime):
        """Audit log for all data deletion events."""
        if self.dry_run:
            return
        
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO data_deletion_audit_log (
                    table_name, rows_deleted, cutoff_date,
                    executed_at, job_type, executed_by
                ) VALUES (%s, %s, %s, NOW(), 'scheduled_retention', 'retention_job')
            """, (table, rows, cutoff))
            conn.commit()


# S3 Lifecycle for data lake
def configure_s3_lifecycle(bucket: str):
    s3 = boto3.client('s3')
    
    s3.put_bucket_lifecycle_configuration(
        Bucket=bucket,
        LifecycleConfiguration={
            'Rules': [
                {
                    'ID': 'event-logs-tiering',
                    'Status': 'Enabled',
                    'Filter': {'Prefix': 'event-logs/'},
                    'Transitions': [
                        {
                            'Days': 90,
                            'StorageClass': 'STANDARD_IA'   # Infrequent access after 90 days
                        },
                        {
                            'Days': 180,
                            'StorageClass': 'GLACIER_IR'    # Archive after 6 months
                        },
                    ],
                    'Expiration': {'Days': 395},             # Delete after 13 months
                },
                {
                    'ID': 'order-archive-tiering',
                    'Status': 'Enabled',
                    'Filter': {'Prefix': 'order-archive/'},
                    'Transitions': [
                        {
                            'Days': 365,
                            'StorageClass': 'GLACIER'        # Deep archive after 1 year
                        }
                    ],
                    # No expiration — financial records kept 7 years, managed manually
                },
                {
                    'ID': 'temp-files-cleanup',
                    'Status': 'Enabled',
                    'Filter': {'Prefix': 'temp/'},
                    'Expiration': {'Days': 7},
                },
            ]
        }
    )
```

### Right-to-Erasure Workflow

```python
# gdpr/erasure_workflow.py
class ErasureRequestProcessor:
    """
    Process GDPR Article 17 right-to-erasure requests.
    Must complete within 30 days; best practice is 5-7 business days.
    """
    
    def __init__(self, db, s3_client, email_service):
        self.db = db
        self.s3 = s3_client
        self.email = email_service
    
    async def process_erasure_request(self, user_id: str, request_id: str) -> dict:
        results = {}
        
        # 1. Verify identity and log request
        await self.db.execute(
            "INSERT INTO erasure_requests (request_id, user_id, requested_at, status) VALUES ($1, $2, NOW(), 'processing')",
            request_id, user_id
        )
        
        # 2. Anonymize user account (keep shell for referential integrity)
        await self.db.execute("""
            UPDATE users SET
                email = 'erased_' || $1 || '@gdpr.invalid',
                name = 'Erased User',
                phone = NULL,
                date_of_birth = NULL,
                profile_photo_url = NULL,
                is_erased = true,
                erased_at = NOW()
            WHERE id = $1
        """, user_id)
        results["user_account"] = "anonymized"
        
        # 3. Delete behavioral data (not subject to financial retention)
        deleted_events = await self.db.fetchval(
            "WITH d AS (DELETE FROM event_logs WHERE user_id = $1 RETURNING 1) SELECT COUNT(*) FROM d",
            user_id
        )
        results["event_logs"] = f"deleted {deleted_events} rows"
        
        # 4. Anonymize orders (keep financial data, remove shipping address/name)
        await self.db.execute("""
            UPDATE orders SET
                shipping_name = 'Erased',
                shipping_address = '{"erased": true}',
                billing_name = 'Erased'
            WHERE user_id = $1
        """, user_id)
        results["orders"] = "shipping/billing PII anonymized"
        
        # 5. Delete from S3/data lake
        await self._delete_s3_data(user_id)
        results["data_lake"] = "user prefix deleted"
        
        # 6. Revoke all sessions and tokens
        await self.db.execute("DELETE FROM sessions WHERE user_id = $1", user_id)
        await self.db.execute("DELETE FROM refresh_tokens WHERE user_id = $1", user_id)
        results["sessions"] = "revoked"
        
        # 7. Mark request complete
        await self.db.execute(
            "UPDATE erasure_requests SET status='completed', completed_at=NOW(), results=$2 WHERE request_id=$1",
            request_id, json.dumps(results)
        )
        
        # 8. Send confirmation
        # (email the original address captured at request time, before anonymization)
        await self.email.send_erasure_confirmation(request_id=request_id)
        
        return results
    
    async def _delete_s3_data(self, user_id: str):
        """Delete all objects in user's S3 prefix."""
        paginator = self.s3.get_paginator('list_objects_v2')
        
        async for page in paginator.paginate(
            Bucket=settings.DATA_LAKE_BUCKET,
            Prefix=f"users/{user_id}/"
        ):
            for obj in page.get('Contents', []):
                self.s3.delete_object(Bucket=settings.DATA_LAKE_BUCKET, Key=obj['Key'])
```

## Rules

- **Every data element needs a retention period** — "keep forever" is a policy decision, not an oversight.
- **Financial data overrides erasure** — GDPR right-to-erasure yields to legal financial record-keeping obligations.
- **Anonymize instead of delete where referential integrity matters** — preserve IDs, replace PII with anonymous values.
- **Deletion jobs must be idempotent** — running twice should produce the same result as running once.
- **Audit the deletions** — deletion audit logs must themselves be retained (typically 7 years).
- **Test erasure workflows** — regularly verify that right-to-erasure requests actually remove data from all systems.
- **Staged deletion** — soft-delete → grace period → anonymize → hard delete. Never skip stages.
- **Cold storage is not deletion** — archiving to Glacier is not erasure; still subject to right-to-erasure.
- **Don't forget derived data** — analytics aggregates computed from PII may themselves contain PII.
- **Document legal basis for every retention period** — when a regulator asks, you need the citation.
