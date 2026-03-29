---
name: file-storage-design
description: Design file storage systems for user uploads, media, and documents at scale. Outputs storage architecture, metadata schema, access control design, CDN strategy, and lifecycle management.
argument-hint: [file types, expected volume, access patterns, geographic distribution, compliance requirements]
allowed-tools: Read, Write
---

# File Storage Design

File storage design involves much more than picking S3. You need to think about metadata, access control, lifecycle management, CDN delivery, deduplication, and compliance. The storage tier is the easy part; the operational model around it is where complexity lives.

## Architecture

```
Upload Flow:
  Client → API (presigned URL) → Object Storage
                                       │
                                   Processing
                                  (scan, resize, transcode)
                                       │
                                   CDN Origin ← CDN Edge ← Users

Storage Tiers:
  Hot:    Frequently accessed (S3 Standard, GCS Standard) — high cost, low latency
  Warm:   Occasionally accessed (S3 IA, GCS Nearline) — lower cost
  Cold:   Archival (S3 Glacier, GCS Archive) — very low cost, high retrieval latency
  Delete: Lifecycle policies auto-transition and expire
```

## Metadata Schema

```sql
-- File metadata table
CREATE TABLE files (
    file_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL,           -- User or account
    owner_type      VARCHAR(20) NOT NULL,    -- 'user' | 'account' | 'system'
    
    -- Storage location
    storage_key     VARCHAR(1024) NOT NULL UNIQUE,  -- S3 key
    storage_bucket  VARCHAR(255) NOT NULL,
    cdn_url         VARCHAR(1024),           -- CDN URL (set after processing)
    
    -- File metadata
    original_name   VARCHAR(255) NOT NULL,
    content_type    VARCHAR(127) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    checksum_sha256 CHAR(64),               -- Set after upload confirmation
    
    -- Lifecycle
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    --  pending → uploaded → processing → ready | failed | quarantined
    purpose         VARCHAR(50),             -- profile_photo, document, attachment
    
    -- Access control
    visibility      VARCHAR(20) NOT NULL DEFAULT 'private',
    --  private | team | public
    
    -- Compliance
    classification  VARCHAR(20) NOT NULL DEFAULT 'internal',
    -- public | internal | confidential | restricted
    retention_until DATE,                   -- Null = keep indefinitely
    
    -- Audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ,            -- Soft delete
    
    -- Indexes for access patterns
    CONSTRAINT valid_status CHECK (status IN (
        'pending', 'uploaded', 'processing', 'ready', 'failed', 'quarantined', 'deleted'
    ))
);

CREATE INDEX ON files (owner_id, status);
CREATE INDEX ON files (created_at) WHERE deleted_at IS NULL;
CREATE INDEX ON files (retention_until) WHERE retention_until IS NOT NULL;
```

## Access Control

```python
class FileAccessControl:
    """Determines if a user can access a file."""
    
    async def can_access(self, file_id: str, requesting_user_id: str,
                          action: str = "read") -> bool:
        file = await file_repo.get(file_id)
        if not file or file.status == "deleted":
            return False
        
        # Owner always has access
        if file.owner_id == requesting_user_id:
            return True
        
        # Public files: anyone can read
        if file.visibility == "public" and action == "read":
            return True
        
        # Team files: members of same account can read
        if file.visibility == "team" and action == "read":
            return await account_service.same_account(
                file.owner_id, requesting_user_id
            )
        
        # Private: owner only
        return False
    
    async def generate_access_url(self, file_id: str, requesting_user_id: str,
                                   expires_in: int = 3600) -> str:
        if not await self.can_access(file_id, requesting_user_id):
            raise PermissionError(f"Access denied to file {file_id}")
        
        file = await file_repo.get(file_id)
        
        if file.visibility == "public":
            return file.cdn_url  # Public CDN URL, no expiry needed
        
        # Private/team: presigned URL
        return s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": file.storage_bucket, "Key": file.storage_key},
            ExpiresIn=expires_in,
        )
```

## Lifecycle Management

```python
# Terraform: S3 lifecycle rules
resource "aws_s3_bucket_lifecycle_configuration" "files" {
  bucket = aws_s3_bucket.files.id

  # Incomplete uploads cleanup
  rule {
    id     = "abort-incomplete-multipart"
    status = "Enabled"
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
  }

  # Transition old files to cheaper storage
  rule {
    id     = "transition-to-ia"
    status = "Enabled"
    filter { prefix = "processed/" }
    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }
    transition {
      days          = 365
      storage_class = "GLACIER"
    }
  }

  # Delete temp uploads not confirmed
  rule {
    id     = "cleanup-pending"
    status = "Enabled"
    filter { prefix = "uploads/pending/" }
    expiration { days = 1 }
  }
}

# Application-level retention enforcement
async def enforce_retention_policy():
    """Daily job: delete files past retention date."""
    expired = await db.execute(
        "SELECT file_id, storage_key, storage_bucket FROM files "
        "WHERE retention_until < NOW() AND deleted_at IS NULL"
    )
    for file in expired:
        await s3.delete_object(Bucket=file["storage_bucket"], Key=file["storage_key"])
        await db.execute(
            "UPDATE files SET deleted_at = NOW(), status = 'deleted' WHERE file_id = $1",
            [file["file_id"]]
        )
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Serving files directly from S3** | No CDN; high latency globally; high S3 request cost | CDN in front of S3 for public/semi-public files |
| **Storing file contents in database** | DB bloat; slow queries; backup issues | Object storage only; DB holds metadata |
| **No lifecycle policies** | Storage grows forever; cost escalates | Transition to cold storage; auto-expire temp files |
| **User-controlled file paths** | Path traversal; overwriting other users' files | Generate server-side UUIDs for storage keys |
| **Synchronous virus scanning** | Upload times out for large files | Async scan post-upload; quarantine if infected |
| **No soft delete** | Files accidentally deleted; no recovery | Soft delete (set deleted_at); hard delete after 30 days |

## 10 Rules

1. Object storage (S3/GCS) for files; relational DB for metadata — never mix.
2. CDN in front of storage for all public and semi-public files — latency and cost.
3. Generate server-side UUIDs for storage keys — user-controlled paths are a security risk.
4. Lifecycle policies are mandatory — auto-transition old files, auto-expire temp uploads.
5. Soft delete with a 30-day recovery window — hard deletes are irreversible.
6. Virus scan after upload, asynchronously — block access until scan completes.
7. Access control enforced at the application layer — presigned URLs for private files.
8. Metadata schema captures classification and retention — enables compliance automation.
9. Checksum stored post-upload — detect corruption and enable deduplication.
10. Monitor storage growth and costs by tier — unexpected growth signals a lifecycle gap.
