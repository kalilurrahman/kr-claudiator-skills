---
name: cryptographic-key-management
description: Design and implement cryptographic key management for encryption, signing, and secrets. Outputs key hierarchy design, KMS integration, rotation procedures, and audit controls.
argument-hint: [key types needed, compliance requirements, cloud provider, data sensitivity, team size]
allowed-tools: Read, Write
---

# Cryptographic Key Management

Poor key management is the most common way encryption is defeated in practice. Encrypting data with a key stored next to the data is not encryption — it is obfuscation. Proper key management involves a key hierarchy, hardware security modules (HSMs) or cloud KMS for root keys, automated rotation, and audit logging of every key operation.

## Key Hierarchy

```
ROOT KEY (Master Key)
  Stored in HSM or Cloud KMS — never exported, never in software
  Used to: encrypt/decrypt Data Encryption Keys (DEKs)
  Rotation: annual or on suspected compromise
  Examples: AWS KMS CMK, GCP Cloud KMS CryptoKey, Azure Key Vault key

    │ encrypts
    ▼

DATA ENCRYPTION KEY (DEK)
  Generated per data object or per-customer
  Encrypted with root key (envelope encryption)
  Stored alongside the ciphertext (safe because it is encrypted)
  Rotation: monthly or per data class policy

    │ encrypts
    ▼

APPLICATION DATA
  Database fields, files, backups, secrets
```

## Envelope Encryption Pattern

```python
import os
import boto3
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

class EnvelopeEncryption:
    """
    Envelope encryption: DEK encrypts data; KMS encrypts DEK.
    The encrypted DEK is stored alongside the ciphertext.
    This pattern allows rotating the root key without re-encrypting all data.
    """

    def __init__(self, kms_key_id: str, region: str = "us-east-1"):
        self.kms = boto3.client("kms", region_name=region)
        self.kms_key_id = kms_key_id

    def encrypt(self, plaintext: bytes, context: dict = None) -> dict:
        """
        Encrypt data using envelope encryption.
        Returns: encrypted_dek + ciphertext (both needed for decryption)
        """
        # 1. Ask KMS to generate a DEK (we never see the plaintext DEK in prod)
        response = self.kms.generate_data_key(
            KeyId=self.kms_key_id,
            KeySpec="AES_256",
            EncryptionContext=context or {},  # Additional authenticated data
        )

        plaintext_dek = response["Plaintext"]   # Ephemeral — use immediately
        encrypted_dek = response["CiphertextBlob"]

        # 2. Encrypt data with the plaintext DEK
        nonce = os.urandom(12)
        aesgcm = AESGCM(plaintext_dek)
        ciphertext = aesgcm.encrypt(nonce, plaintext, None)

        # 3. Zero out the plaintext DEK from memory
        # (Python can't guarantee this, but it's best practice)
        del plaintext_dek

        return {
            "encrypted_dek": base64.b64encode(encrypted_dek).decode(),
            "nonce": base64.b64encode(nonce).decode(),
            "ciphertext": base64.b64encode(ciphertext).decode(),
            "kms_key_id": self.kms_key_id,
            "context": context or {},
        }

    def decrypt(self, envelope: dict) -> bytes:
        """Decrypt envelope. KMS decrypts the DEK; we decrypt the data."""
        encrypted_dek = base64.b64decode(envelope["encrypted_dek"])
        nonce = base64.b64decode(envelope["nonce"])
        ciphertext = base64.b64decode(envelope["ciphertext"])

        # 1. Ask KMS to decrypt the DEK
        response = self.kms.decrypt(
            CiphertextBlob=encrypted_dek,
            EncryptionContext=envelope.get("context", {}),
        )
        plaintext_dek = response["Plaintext"]

        # 2. Decrypt data
        aesgcm = AESGCM(plaintext_dek)
        return aesgcm.decrypt(nonce, ciphertext, None)
```

## AWS KMS Integration

```python
import boto3

class KMSKeyManager:
    def __init__(self, region: str = "us-east-1"):
        self.kms = boto3.client("kms", region_name=region)

    def create_key(self, description: str, policy: dict = None) -> str:
        """Create a new CMK with key policy."""
        response = self.kms.create_key(
            Description=description,
            KeyUsage="ENCRYPT_DECRYPT",
            KeySpec="SYMMETRIC_DEFAULT",
            EnableKeyRotation=True,  # Auto-rotate annually
            Policy=str(policy) if policy else None,
            Tags=[
                {"TagKey": "Environment", "TagValue": "production"},
                {"TagKey": "Owner", "TagValue": "security-team"},
            ],
        )
        key_id = response["KeyMetadata"]["KeyId"]
        # Create alias for human-readable reference
        self.kms.create_alias(
            AliasName=f"alias/{description.replace(' ', '-').lower()}",
            TargetKeyId=key_id,
        )
        return key_id

    def rotate_key(self, key_id: str) -> None:
        """Manual rotation: create new key version, update references."""
        # Enable automatic rotation (annual)
        self.kms.enable_key_rotation(KeyId=key_id)

        # For immediate rotation: create new alias → old key becomes previous version
        # Re-encryption of existing ciphertext only needed for DEKs wrapped with old key
        # Application data doesn't need re-encryption (envelope encryption handles this)

    def list_key_grants(self, key_id: str) -> list:
        """Audit: who has access to this key."""
        grants = self.kms.list_grants(KeyId=key_id)
        return grants.get("Grants", [])

    def set_key_policy(self, key_id: str, policy: str) -> None:
        """Update key access policy."""
        self.kms.put_key_policy(
            KeyId=key_id,
            PolicyName="default",
            Policy=policy,
        )
```

## Terraform: KMS Key with Least Privilege

```hcl
# Customer-managed key with strict access policy
resource "aws_kms_key" "database_encryption" {
  description             = "Database field encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true     # Annual rotation

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Key administrators (cannot use the key for crypto)
      {
        Sid    = "KeyAdministrators"
        Effect = "Allow"
        Principal = {
          AWS = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/SecurityAdminRole"]
        }
        Action   = ["kms:Create*", "kms:Describe*", "kms:Enable*", "kms:List*",
                     "kms:Put*", "kms:Update*", "kms:Revoke*", "kms:Disable*",
                     "kms:Get*", "kms:Delete*", "kms:ScheduleKeyDeletion"]
        Resource = "*"
      },
      # Application: encrypt and decrypt only
      {
        Sid    = "ApplicationCryptoOperations"
        Effect = "Allow"
        Principal = {
          AWS = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/ApiServiceRole"]
        }
        Action   = ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey",
                     "kms:GenerateDataKeyWithoutPlaintext"]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:EncryptionContext:Environment" = "production"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "database-encryption-key"
    Environment = "production"
    Owner       = "security-team"
  }
}
```

## Key Rotation Procedures

```markdown
## Key Rotation Runbook

### Automatic Rotation (AWS KMS)
KMS rotates CMK material annually automatically.
Existing ciphertext can still be decrypted with old key material.
New encryptions use new key material.
No application changes required.

### Manual Rotation (new key, re-wrap DEKs)
Required when: suspected key compromise, compliance mandate, key algorithm change

Step 1: Create new KMS key (terraform apply)
Step 2: Update application to encrypt new data with new key
Step 3: Background job: re-wrap all DEKs with new key
  - Read encrypted_dek → decrypt with old key → encrypt with new key → store
  - Run in batches; verify each batch before proceeding
Step 4: Update application to require new key for all operations
Step 5: Schedule deletion of old key (minimum 7-30 day waiting period)

### Emergency Rotation (key compromise)
Step 1: Immediately disable old key (kms:DisableKey)
Step 2: Create new key and update all services within 1 hour
Step 3: Audit all access logs for old key — who used it and when?
Step 4: Notify CISO and begin incident response procedure
Step 5: Re-wrap all DEKs with new key (priority: most sensitive data first)
```

## Audit Logging

```python
import boto3
from datetime import datetime

def audit_kms_usage(key_id: str, days_back: int = 7) -> list:
    """Query CloudTrail for KMS key usage."""
    cloudtrail = boto3.client("cloudtrail", region_name="us-east-1")

    events = []
    paginator = cloudtrail.get_paginator("lookup_events")

    for page in paginator.paginate(
        LookupAttributes=[
            {"AttributeKey": "ResourceType", "AttributeValue": "AWS::KMS::Key"},
            {"AttributeKey": "ResourceName", "AttributeValue": key_id},
        ],
        StartTime=datetime.utcnow() - timedelta(days=days_back),
    ):
        for event in page["Events"]:
            events.append({
                "time": event["EventTime"].isoformat(),
                "event": event["EventName"],
                "user": event.get("Username", "unknown"),
                "ip": event.get("CloudTrailEvent", {}).get("sourceIPAddress"),
            })

    # Alert on unexpected operations
    suspicious = [e for e in events if e["event"] in
                   ["DisableKey", "ScheduleKeyDeletion", "DeleteAlias", "PutKeyPolicy"]]
    if suspicious:
        alert_security_team(f"Suspicious KMS operations on {key_id}: {suspicious}")

    return events
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Hardcoding keys in source code** | Keys in git history forever | Environment variables → KMS → Secrets Manager |
| **Same key for all data** | One compromise exposes everything | Separate keys per data class and environment |
| **No key rotation** | Compromised key useful indefinitely | Annual auto-rotation minimum; 90 days for high-risk |
| **Storing plaintext DEK alongside ciphertext** | Renders encryption useless | Encrypt DEK with KMS before storing |
| **No access audit** | Can't detect key misuse | CloudTrail on all KMS operations; alert on anomalies |

## 10 Rules

1. Root keys never leave the HSM or cloud KMS — never store them in application memory.
2. Envelope encryption: DEK encrypts data; root key encrypts DEK.
3. Separate keys per data classification and environment — never share production keys.
4. Enable automatic annual rotation on all CMKs.
5. Encryption context binds ciphertext to its intended use — always use it.
6. Every key operation is logged to CloudTrail — audit weekly for anomalies.
7. Principle of least privilege: applications get Encrypt/Decrypt only; not key management.
8. Key deletion has a mandatory waiting period (7-30 days) — never delete immediately.
9. Re-encryption (rotating DEKs to new root key) is a background job, not a user-blocking operation.
10. Test key rotation procedures quarterly — an untested rotation procedure fails when you need it most.
