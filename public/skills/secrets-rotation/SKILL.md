---
name: secrets-rotation
description: Design and implement automated secrets rotation for credentials, API keys, and certificates. Outputs rotation architecture, Lambda/script implementations, zero-downtime rotation procedures, and monitoring.
argument-hint: [secret types, rotation frequency, cloud provider, application stack]
allowed-tools: Read, Write, Bash
---

# Secrets Rotation

Static secrets are ticking time bombs. Leaked credentials with no rotation remain a threat indefinitely. Automated rotation reduces the blast radius of a compromise: a leaked secret that rotates every 24 hours is only useful for hours, not months. The challenge is rotating without downtime.

## Process

1. **Inventory all secrets.** API keys, DB passwords, TLS certs, service accounts, OAuth tokens. Classify by risk and rotation requirements.
2. **Store in a secrets manager.** AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager — never environment variables or config files.
3. **Design the rotation window.** Always maintain two valid credentials during transition (old + new). Applications use old while new propagates.
4. **Automate rotation.** Lambda functions (AWS), Cloud Functions (GCP), or Vault's built-in rotation.
5. **Update applications.** Applications must reload secrets dynamically — not cache at startup.
6. **Monitor rotation.** Alert on rotation failure, expiry approaching, last-rotated-age.
7. **Test rotation.** Verify zero-downtime rotation in staging before enabling in production.

## AWS Secrets Manager — Database Rotation

```python
# Lambda rotation function — RDS PostgreSQL
# Follows the 4-step rotation process:
# 1. createSecret: Generate new password
# 2. setSecret: Set new password in database  
# 3. testSecret: Verify new credentials work
# 4. finishSecret: Make new version the AWSCURRENT

import boto3
import json
import logging
import psycopg2
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    """Entry point for secrets rotation Lambda."""
    arn = event['SecretId']
    token = event['ClientRequestToken']
    step = event['Step']
    
    client = boto3.client('secretsmanager')
    metadata = client.describe_secret(SecretId=arn)
    
    if not metadata['RotationEnabled']:
        raise ValueError(f"Secret {arn} is not enabled for rotation")
    
    versions = metadata.get('VersionIdsToStages', {})
    if token not in versions:
        raise ValueError(f"Token {token} not associated with {arn}")
    if 'AWSCURRENT' in versions[token]:
        logger.info("Version is already current — nothing to do")
        return
    if 'AWSPENDING' not in versions[token]:
        raise ValueError(f"Token {token} is not AWSPENDING")
    
    if step == "createSecret":   _create_secret(client, arn, token)
    elif step == "setSecret":    _set_secret(client, arn, token)
    elif step == "testSecret":   _test_secret(client, arn, token)
    elif step == "finishSecret": _finish_secret(client, arn, token)
    else:
        raise ValueError(f"Invalid step: {step}")


def _create_secret(client, arn: str, token: str):
    """Generate new password and store as AWSPENDING."""
    try:
        client.get_secret_value(SecretId=arn, VersionStage="AWSPENDING",
                                VersionId=token)
        logger.info("createSecret: AWSPENDING version exists, skipping")
        return
    except client.exceptions.ResourceNotFoundException:
        pass
    
    current = json.loads(
        client.get_secret_value(SecretId=arn, VersionStage="AWSCURRENT")['SecretString']
    )
    
    import string, secrets
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    new_password = ''.join(secrets.choice(alphabet) for _ in range(32))
    
    new_secret = {**current, "password": new_password}
    
    client.put_secret_value(
        SecretId=arn,
        ClientRequestToken=token,
        SecretString=json.dumps(new_secret),
        VersionStages=["AWSPENDING"],
    )
    logger.info("createSecret: Generated and stored new password as AWSPENDING")


def _set_secret(client, arn: str, token: str):
    """Apply new password in the database."""
    pending = json.loads(
        client.get_secret_value(SecretId=arn, VersionStage="AWSPENDING",
                                VersionId=token)['SecretString']
    )
    current = json.loads(
        client.get_secret_value(SecretId=arn, VersionStage="AWSCURRENT")['SecretString']
    )
    
    conn = psycopg2.connect(
        host=current['host'],
        port=current.get('port', 5432),
        dbname=current['dbname'],
        user=current['username'],
        password=current['password'],
        connect_timeout=5,
    )
    conn.autocommit = True
    
    try:
        with conn.cursor() as cur:
            cur.execute(
                "ALTER USER %s WITH PASSWORD %s",
                (pending['username'], pending['password'])
            )
        logger.info(f"setSecret: Password updated for {pending['username']}")
    finally:
        conn.close()


def _test_secret(client, arn: str, token: str):
    """Verify the new credentials work."""
    pending = json.loads(
        client.get_secret_value(SecretId=arn, VersionStage="AWSPENDING",
                                VersionId=token)['SecretString']
    )
    conn = psycopg2.connect(
        host=pending['host'],
        port=pending.get('port', 5432),
        dbname=pending['dbname'],
        user=pending['username'],
        password=pending['password'],
        connect_timeout=5,
    )
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        logger.info("testSecret: New credentials verified successfully")
    finally:
        conn.close()


def _finish_secret(client, arn: str, token: str):
    """Promote AWSPENDING to AWSCURRENT."""
    current_version = next(
        v for v, stages in 
        client.describe_secret(SecretId=arn)['VersionIdsToStages'].items()
        if 'AWSCURRENT' in stages
    )
    
    if current_version == token:
        logger.info("finishSecret: Already current, nothing to do")
        return
    
    client.update_secret_version_stage(
        SecretId=arn,
        VersionStage="AWSCURRENT",
        MoveToVersionId=token,
        RemoveFromVersionId=current_version,
    )
    logger.info(f"finishSecret: Rotated {current_version} → {token}")
```

## Terraform — Rotation Configuration

```hcl
# RDS secret with automatic rotation
resource "aws_secretsmanager_secret" "db_password" {
  name                    = "production/rds/api-service/password"
  recovery_window_in_days = 7
  
  tags = {
    Environment = "production"
    Service     = "api-service"
    RotationDay = formatdate("YYYY-MM-DD", timestamp())
  }
}

resource "aws_secretsmanager_secret_rotation" "db_rotation" {
  secret_id           = aws_secretsmanager_secret.db_password.id
  rotation_lambda_arn = aws_lambda_function.rotation_lambda.arn
  
  rotation_rules {
    automatically_after_days = 30  # Rotate every 30 days
  }
}

# API key secret — manual rotation with reminders
resource "aws_secretsmanager_secret" "stripe_api_key" {
  name = "production/stripe/api-key"
  
  # Trigger reminder at 80% of rotation window
  tags = {
    RotationDays = "90"
    RotateBy     = timeadd(timestamp(), "2160h")  # 90 days
  }
}
```

## Application-Side Secret Reloading

```python
# Applications must reload secrets dynamically — not cache forever

import boto3
import json
import threading
import time
from datetime import datetime, timedelta

class RotatingSecretCache:
    """Thread-safe secret cache with TTL-based refresh."""
    
    def __init__(self, secret_arn: str, ttl_seconds: int = 300):
        self._client = boto3.client('secretsmanager')
        self._arn = secret_arn
        self._ttl = ttl_seconds
        self._secret = None
        self._expires_at = None
        self._lock = threading.Lock()
    
    def get(self) -> dict:
        with self._lock:
            if self._secret is None or datetime.utcnow() >= self._expires_at:
                self._refresh()
            return self._secret.copy()
    
    def _refresh(self):
        try:
            response = self._client.get_secret_value(SecretId=self._arn)
            self._secret = json.loads(response['SecretString'])
            self._expires_at = datetime.utcnow() + timedelta(seconds=self._ttl)
        except Exception as e:
            if self._secret:
                # Extend TTL by 60s on transient error — don't break
                self._expires_at = datetime.utcnow() + timedelta(seconds=60)
                raise RuntimeError(f"Secret refresh failed (using cached): {e}")
            raise  # No cached value — propagate error

# Usage
db_secret = RotatingSecretCache("production/rds/api-service/password", ttl_seconds=300)

def get_db_connection():
    secret = db_secret.get()
    return psycopg2.connect(
        host=secret['host'],
        user=secret['username'],
        password=secret['password'],  # Always fetched from cache, refreshed every 5min
        dbname=secret['dbname'],
    )
```

## TLS Certificate Rotation

```bash
# cert-manager (Kubernetes) — automatic TLS rotation
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: api-tls
  namespace: production
spec:
  secretName: api-tls-secret
  duration: 2160h      # 90 days
  renewBefore: 360h    # Renew 15 days before expiry
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - api.example.com
EOF

# Monitor certificate expiry
kubectl get certificates -n production
# READY=True means cert is valid and not expiring

# Alert on approaching expiry (Prometheus)
# alert: CertificateExpiringInLessThan14Days
# expr: certmanager_certificate_expiration_timestamp_seconds - time() < 14 * 24 * 3600
```

## Rotation Monitoring

```python
# Lambda: daily check of all secrets rotation status
import boto3
from datetime import datetime, timedelta

def check_rotation_health(event, context):
    client = boto3.client('secretsmanager')
    paginator = client.get_paginator('list_secrets')
    
    alerts = []
    for page in paginator.paginate():
        for secret in page['SecretList']:
            name = secret['Name']
            
            # Check: rotation not enabled
            if not secret.get('RotationEnabled'):
                if secret.get('Tags', {}).get('RequiresRotation') == 'true':
                    alerts.append(f"ROTATION_DISABLED: {name}")
                continue
            
            # Check: last rotated too long ago
            last_rotated = secret.get('LastRotatedDate')
            if last_rotated:
                days_since = (datetime.utcnow().replace(tzinfo=last_rotated.tzinfo) 
                             - last_rotated).days
                rotation_days = int(secret.get('RotationRules', {}).get(
                    'AutomaticallyAfterDays', 90))
                
                if days_since > rotation_days + 7:  # 7 day grace
                    alerts.append(f"ROTATION_OVERDUE: {name} ({days_since}d since last rotation)")
            
            # Check: rotation failed
            if secret.get('LastRotationAttemptDate') and secret.get('LastRotatedDate'):
                if secret['LastRotationAttemptDate'] > secret['LastRotatedDate']:
                    alerts.append(f"ROTATION_FAILED: {name} — last attempt failed")
    
    if alerts:
        # → PagerDuty / Slack #security-alerts
        print("SECRETS ROTATION ALERTS:\n" + "\n".join(alerts))
        raise RuntimeError(f"Rotation health check failed: {len(alerts)} alerts")
    
    return {"status": "healthy", "secrets_checked": sum(1 for _ in paginator.paginate())}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Secrets in code/config files** | Committed to git; copied to every engineer's machine | Secrets manager only |
| **Caching secrets indefinitely** | App won't pick up rotated credentials | TTL-based cache refresh (5-15min) |
| **Rotating without dual-credential window** | Rotation causes downtime | Always maintain both old + new during transition |
| **No rotation monitoring** | Failures silent; secrets expire undetected | Daily Lambda check; alert on overdue or failed rotation |
| **Manual rotation** | Forgotten, inconsistent, undocumented | Automated rotation with audit trail |
| **Same secret across environments** | Production secret leaked via dev access | Separate secrets per environment |
| **Rotation during peak traffic** | Rotation failure causes production outage | Schedule rotation during low-traffic windows |

## 10 Rules

1. Every secret lives in a secrets manager — never in code, config, environment variables, or CI secrets if it can be automated.
2. Applications reload secrets dynamically — no caching beyond a few minutes.
3. Maintain two valid credentials during rotation — old credential stays valid until all apps confirm new one works.
4. Database password rotation rotates both the DB user password AND the secret simultaneously.
5. Monitor rotation health daily — alert on overdue rotation and failed rotation attempts.
6. Separate secrets per environment — dev, staging, and production never share credentials.
7. Rotation frequency matches secret risk: DB passwords (30d), API keys (90d), TLS certs (auto-renew at 14d).
8. Test rotation in staging before enabling in production — a failed rotation Lambda in production causes outage.
9. Audit all secret accesses — who read which secret and when.
10. Never log secret values — mask in application logs and rotation Lambda output.
