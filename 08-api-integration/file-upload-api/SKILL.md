---
name: file-upload-api
description: Design and implement secure file upload APIs with direct-to-storage uploads, virus scanning, and lifecycle management. Outputs upload flow design, presigned URL implementation, validation pipeline, and storage policy.
argument-hint: [file types, max file size, storage provider, security requirements, processing needed]
allowed-tools: Read, Write
---

# File Upload API

File upload is a common source of security vulnerabilities and operational complexity. The best pattern for production systems is presigned URLs: the API issues a time-limited URL directly to object storage, files never transit your API servers, and you validate after upload.

## Upload Flow Options

```
Option A: Direct to Server (simple, not recommended for large files)
  Client → POST /upload → API Server → S3/GCS
  Pros: Simple; full control at upload time
  Cons: Files transit API server; memory pressure; 30s timeout risk

Option B: Presigned URL (recommended for production)
  Client → GET /upload-url → API → presigned S3 URL → Client PUT → S3
  Pros: Files bypass API server; S3 handles scale; no timeouts
  Cons: Slightly more complex client-side

Option C: Multipart (for very large files >100MB)
  Client initiates multipart upload via API → chunks to S3 → complete
  Pros: Resumable; parallel chunks
  Cons: Most complex
```

## Presigned URL Implementation

```python
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel, Field
import boto3
import uuid
from datetime import datetime
from typing import Optional

app = FastAPI()
s3 = boto3.client('s3', region_name='us-east-1')
BUCKET = "company-uploads"

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # xlsx
}
MAX_SIZE_BYTES = 50 * 1024 * 1024  # 50MB

class UploadRequest(BaseModel):
    filename: str = Field(max_length=255)
    content_type: str
    file_size_bytes: int = Field(gt=0, le=MAX_SIZE_BYTES)
    purpose: str  # "profile_photo" | "document" | "attachment"

class UploadResponse(BaseModel):
    upload_id: str
    upload_url: str          # Presigned PUT URL for client
    expires_at: datetime
    confirm_url: str         # Client calls this after upload to trigger processing

@app.post("/api/v1/uploads/presign", response_model=UploadResponse)
async def get_presigned_upload_url(
    request: UploadRequest,
    claims: dict = Depends(require_auth),
):
    # Validate content type
    if request.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, f"Unsupported type: {request.content_type}. "
                                 f"Allowed: {sorted(ALLOWED_TYPES)}")
    
    # Validate filename (prevent path traversal)
    import re
    safe_filename = re.sub(r'[^a-zA-Z0-9._-]', '_', request.filename)
    
    # Generate storage key — never user-controlled
    upload_id = str(uuid.uuid4())
    s3_key = f"uploads/{claims['sub']}/{upload_id}/{safe_filename}"
    
    # Create upload record (status: pending)
    await upload_store.create({
        "upload_id": upload_id,
        "user_id": claims["sub"],
        "s3_key": s3_key,
        "original_filename": request.filename,
        "content_type": request.content_type,
        "file_size_bytes": request.file_size_bytes,
        "purpose": request.purpose,
        "status": "pending",
        "created_at": datetime.utcnow(),
    })
    
    # Generate presigned URL with content-type and size enforcement
    presigned_url = s3.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": BUCKET,
            "Key": s3_key,
            "ContentType": request.content_type,
            "ContentLength": request.file_size_bytes,
            "Metadata": {
                "upload-id": upload_id,
                "user-id": claims["sub"],
                "purpose": request.purpose,
            },
        },
        ExpiresIn=900,  # 15 minutes
        HttpMethod="PUT",
    )
    
    expires_at = datetime.utcnow().replace(second=0, microsecond=0)
    import datetime as dt
    expires_at = expires_at + dt.timedelta(seconds=900)
    
    return UploadResponse(
        upload_id=upload_id,
        upload_url=presigned_url,
        expires_at=expires_at,
        confirm_url=f"/api/v1/uploads/{upload_id}/confirm",
    )

@app.post("/api/v1/uploads/{upload_id}/confirm")
async def confirm_upload(upload_id: str, claims: dict = Depends(require_auth)):
    """Called by client after successful upload to S3."""
    upload = await upload_store.get(upload_id)
    if not upload or upload["user_id"] != claims["sub"]:
        raise HTTPException(404)
    if upload["status"] != "pending":
        raise HTTPException(409, f"Upload already {upload['status']}")
    
    # Verify file actually exists in S3
    try:
        head = s3.head_object(Bucket=BUCKET, Key=upload["s3_key"])
    except s3.exceptions.NoSuchKey:
        raise HTTPException(400, "File not found in storage — did you complete the upload?")
    
    # Verify size matches declared size
    actual_size = head["ContentLength"]
    if abs(actual_size - upload["file_size_bytes"]) > 1024:  # Allow 1KB tolerance
        await upload_store.update_status(upload_id, "failed", "Size mismatch")
        raise HTTPException(400, "File size doesn't match declared size")
    
    await upload_store.update_status(upload_id, "uploaded")
    
    # Trigger async processing (virus scan, thumbnail, etc.)
    await processing_queue.enqueue({
        "upload_id": upload_id,
        "s3_key": upload["s3_key"],
        "content_type": upload["content_type"],
        "purpose": upload["purpose"],
    })
    
    return {"upload_id": upload_id, "status": "processing", "message": "Upload confirmed"}
```

## Post-Upload Processing Pipeline

```python
# Worker that processes uploads after S3 confirm
import boto3
import magic  # python-magic: file type verification

s3 = boto3.client('s3')
QUARANTINE_BUCKET = "company-quarantine"
PROCESSED_BUCKET = "company-assets"

async def process_upload(upload_id: str, s3_key: str, content_type: str, purpose: str):
    # Step 1: Download to temp file for scanning
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        s3.download_fileobj(BUCKET, s3_key, tmp)
        tmp_path = tmp.name
    
    try:
        # Step 2: Verify actual file type (not trusting content-type header)
        actual_type = magic.from_file(tmp_path, mime=True)
        if actual_type != content_type:
            await quarantine(upload_id, s3_key, f"Content-type mismatch: declared={content_type}, actual={actual_type}")
            return
        
        # Step 3: Virus scan (ClamAV or AWS GuardDuty Malware Protection)
        scan_result = await scan_for_malware(tmp_path)
        if scan_result["infected"]:
            await quarantine(upload_id, s3_key, f"Malware detected: {scan_result['threat']}")
            return
        
        # Step 4: Purpose-specific processing
        if purpose == "profile_photo" and content_type.startswith("image/"):
            processed_path = await resize_image(tmp_path, max_width=800, max_height=800)
            await strip_exif(processed_path)  # Remove GPS and metadata
        elif purpose == "document":
            processed_path = tmp_path  # No processing needed
        
        # Step 5: Move to processed bucket (remove from uploads bucket)
        final_key = s3_key.replace("uploads/", "assets/")
        s3.upload_file(processed_path, PROCESSED_BUCKET, final_key)
        s3.delete_object(Bucket=BUCKET, Key=s3_key)
        
        await upload_store.update({
            "upload_id": upload_id,
            "status": "ready",
            "final_url": f"https://assets.example.com/{final_key}",
            "processed_at": datetime.utcnow(),
        })
    
    finally:
        os.unlink(tmp_path)

async def quarantine(upload_id: str, s3_key: str, reason: str):
    """Move file to quarantine bucket and notify security."""
    quarantine_key = f"quarantine/{upload_id}/{s3_key.split('/')[-1]}"
    s3.copy_object(
        CopySource={"Bucket": BUCKET, "Key": s3_key},
        Bucket=QUARANTINE_BUCKET,
        Key=quarantine_key,
    )
    s3.delete_object(Bucket=BUCKET, Key=s3_key)
    await upload_store.update_status(upload_id, "quarantined", reason)
    await security_alerts.notify(f"File quarantined: {upload_id} - {reason}")
```

## S3 Bucket Security Policy

```hcl
# terraform — locked-down upload bucket
resource "aws_s3_bucket_policy" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Allow presigned upload from any (needed for presigned URLs)
      {
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.uploads.arn}/uploads/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-content-sha256" = "UNSIGNED-PAYLOAD"  # Presigned
          }
        }
      },
      # Block all public read
      {
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.uploads.arn}/*"
        Condition = {
          StringNotEquals = {
            "aws:PrincipalArn" = [
              aws_iam_role.upload_processor.arn,
              aws_iam_role.api_service.arn,
            ]
          }
        }
      }
    ]
  })
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Auto-delete pending uploads not confirmed within 24h
resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    id     = "cleanup-pending"
    status = "Enabled"
    expiration { days = 1 }
    filter { prefix = "uploads/" }
  }
}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Files transiting API server** | Memory pressure; timeout risk; scaling bottleneck | Presigned URLs — files go directly to S3 |
| **Trusting client content-type** | `image/jpeg` can be an executable | Verify actual MIME type with libmagic |
| **No virus scanning** | Malware uploaded and served to other users | ClamAV or cloud-native malware scanning |
| **User-controlled S3 key** | Path traversal; overwriting other users' files | Generate server-side UUIDs for keys |
| **Serving from upload bucket** | Unprocessed/unscanned files served to users | Process → move to assets bucket → serve from assets |
| **No upload size limit** | S3 charges for storage; DoS via large file | ContentLength constraint in presigned URL |
| **No expiry on presigned URLs** | Old URLs reused after legitimate use | 15-minute expiry on upload URLs |

## 10 Rules

1. Files never transit the API server — use presigned URLs for direct-to-storage uploads.
2. Server generates the S3 key — never accept key from client; path traversal is a real attack.
3. Enforce content-type and size in the presigned URL, not just in validation.
4. Verify actual file type with libmagic after upload — don't trust the Content-Type header.
5. Scan for malware before serving files to other users.
6. Strip metadata (EXIF, GPS) from images before storing final versions.
7. Serve from a processed assets bucket, not the upload bucket — unprocessed files stay private.
8. Presigned URL TTL is 15 minutes — enough for upload; short enough to limit misuse.
9. S3 lifecycle rules auto-delete unconfirmed uploads after 24 hours.
10. Quarantine suspected malware — never delete; you need it for forensics.
