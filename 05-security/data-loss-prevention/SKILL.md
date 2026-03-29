---
name: data-loss-prevention
description: Implement data loss prevention controls to detect and prevent sensitive data exfiltration. Outputs DLP policy design, detection rules, response procedures, and monitoring dashboards.
argument-hint: [data sensitivity, regulatory requirements, channels to monitor, existing tooling]
allowed-tools: Read, Write
---

# Data Loss Prevention (DLP)

DLP prevents sensitive data from leaving your control — through accidental sharing, misconfigured storage, or malicious exfiltration. Modern DLP operates at three layers: data at rest (storage scanning), data in motion (network/API monitoring), and data in use (endpoint/application controls).

## Process

1. **Classify your data.** What sensitive data exists? PII, PCI, PHI, trade secrets, credentials?
2. **Map data flows.** Where does sensitive data go? Which systems, APIs, third-party services?
3. **Define DLP policies.** What detection rules? What response actions?
4. **Implement controls.** At-rest scanning, in-motion inspection, application-level controls.
5. **Alert and respond.** Detect, alert, block, and investigate violations.
6. **Review and tune.** False positives erode trust; tune regularly.

## Detection Patterns

```python
import re
from dataclasses import dataclass
from typing import Optional

@dataclass
class DLPMatch:
    pattern_name: str
    severity: str  # critical, high, medium
    match_count: int
    sample: str    # Redacted sample for investigation

class DLPScanner:
    """Scan text for sensitive data patterns."""
    
    PATTERNS = {
        # Credentials
        "aws_access_key": (
            r'AKIA[0-9A-Z]{16}',
            "critical"
        ),
        "private_key": (
            r'-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----',
            "critical"
        ),
        "generic_api_key": (
            r'(?i)(api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*["\']?[A-Za-z0-9_\-]{20,}',
            "high"
        ),
        # PII
        "us_ssn": (
            r'\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b',
            "critical"
        ),
        "credit_card": (
            r'\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b',
            "critical"
        ),
        "email": (
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            "medium"
        ),
        "phone_us": (
            r'\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b',
            "medium"
        ),
        # Financial
        "iban": (
            r'\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}\b',
            "high"
        ),
    }
    
    def scan(self, text: str, max_sample_len: int = 20) -> list[DLPMatch]:
        matches = []
        for name, (pattern, severity) in self.PATTERNS.items():
            found = re.findall(pattern, text)
            if found:
                # Redact the actual value for safe logging
                sample = re.sub(pattern, lambda m: f"[{name.upper()}]", text[:200])
                matches.append(DLPMatch(
                    pattern_name=name,
                    severity=severity,
                    match_count=len(found),
                    sample=sample[:max_sample_len],
                ))
        return matches

scanner = DLPScanner()

# API middleware — scan request/response for accidental PII
async def dlp_middleware(request, call_next):
    # Scan request body
    if request.method in ["POST", "PUT", "PATCH"]:
        body = await request.body()
        matches = scanner.scan(body.decode(errors='ignore'))
        for match in matches:
            if match.severity == "critical":
                logger.warning(f"DLP: Critical data in request", extra={
                    "pattern": match.pattern_name,
                    "endpoint": request.url.path,
                    "method": request.method,
                })
    
    response = await call_next(request)
    
    # Scan response body (sample only to reduce overhead)
    if response.headers.get("content-type", "").startswith("application/json"):
        body_bytes = b""
        async for chunk in response.body_iterator:
            body_bytes += chunk
        
        matches = scanner.scan(body_bytes[:5000].decode(errors='ignore'))
        for match in [m for m in matches if m.severity in ["critical", "high"]]:
            logger.error(f"DLP: Sensitive data in API response", extra={
                "pattern": match.pattern_name,
                "endpoint": request.url.path,
                "severity": match.severity,
            })
    
    return response
```

## Storage DLP — S3 Bucket Scanning

```python
import boto3

def scan_s3_bucket_for_pii(bucket_name: str, sample_size: int = 1000):
    """Scan a sample of S3 objects for PII."""
    s3 = boto3.client('s3')
    scanner = DLPScanner()
    findings = []
    
    paginator = s3.get_paginator('list_objects_v2')
    count = 0
    
    for page in paginator.paginate(Bucket=bucket_name):
        for obj in page.get('Contents', []):
            if count >= sample_size:
                break
            
            # Only scan text files
            key = obj['Key']
            if not any(key.endswith(ext) for ext in ['.csv', '.json', '.txt', '.log']):
                continue
            
            try:
                body = s3.get_object(Bucket=bucket_name, Key=key)['Body']
                # Sample first 10KB
                content = body.read(10240).decode(errors='ignore')
                matches = scanner.scan(content)
                
                for match in matches:
                    if match.severity in ["critical", "high"]:
                        findings.append({
                            "bucket": bucket_name,
                            "key": key,
                            "pattern": match.pattern_name,
                            "severity": match.severity,
                        })
            except Exception:
                pass
            
            count += 1
    
    return findings
```

## DLP Policy Response Actions

```markdown
## Response Matrix

| Severity | Data Type | In Motion | At Rest |
|---------|-----------|-----------|---------|
| Critical | Credentials (API keys, passwords) | BLOCK + ALERT + REVOKE | ALERT + QUARANTINE |
| Critical | PCI card numbers | BLOCK + ALERT | ALERT + ENCRYPT |
| High | SSN / National ID | ALERT + REVIEW | ALERT + RESTRICT |
| Medium | Email addresses (bulk) | LOG + ALERT at threshold | CLASSIFY |
| Low | Phone numbers | LOG | LOG |

## Alert Thresholds
- Any single critical finding: immediate alert to security team
- >100 email addresses in single response: alert
- >10 medium findings per hour from same service: alert
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Scanning everything always** | Performance impact; noise | Sample + risk-based scanning; not every byte |
| **Blocking on false positives** | Legitimate traffic blocked | Tune rules before enabling block mode; start with alert-only |
| **PII in logs** | Logs become a PII exfiltration path | Scrub PII from logs; use IDs instead |
| **DLP without data classification** | Don't know what to protect | Classification precedes DLP policy |
| **No response playbook** | Alert fires, no one knows what to do | Every alert severity has a defined response |

## 10 Rules

1. Data classification comes before DLP — you can't protect what you haven't identified.
2. Start in alert-only mode — tune false positives before enabling blocking.
3. Critical findings (credentials, card numbers) alert the security team immediately.
4. Never log the actual sensitive value — log the pattern name and a redacted sample.
5. Scan both inbound (accidental submission) and outbound (exfiltration) data flows.
6. Regular storage scanning catches misconfigured buckets before attackers do.
7. DLP in CI/CD catches credentials committed to code before they reach production.
8. Response actions are automated where possible — humans can't review every alert.
9. Review false positive rates monthly — high FP rates mean alerts are ignored.
10. DLP findings feed into the risk register — track remediation, not just detection.
