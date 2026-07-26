---
name: compliance-framework
description: Build and maintain compliance programmes for SOC 2, ISO 27001, GDPR, HIPAA, or PCI DSS. Outputs control mapping, evidence collection procedures, gap analysis, and audit readiness checklist.
argument-hint: [target frameworks, current security maturity, audit timeline, industry/data types]
allowed-tools: Read, Write
---

# Compliance Framework

Compliance is the systematic demonstration that your security practices meet defined standards. The goal is not to pass audits — it is to maintain security controls that also happen to satisfy auditors. Compliance built backwards from audit requirements creates checkbox security; compliance built from genuine security practice creates both security and audit readiness.

## Process

1. **Identify applicable frameworks.** SOC 2 (B2B SaaS trust), ISO 27001 (international, enterprise), GDPR (EU data), HIPAA (health data), PCI DSS (payment cards). Overlap is significant — implement once, map to many.
2. **Gap analysis.** Current state vs framework requirements. Prioritise by risk and audit timeline.
3. **Build the control library.** Every required control mapped to owner, evidence type, and testing frequency.
4. **Implement controls.** Technical (automated) controls first; process controls second.
5. **Collect evidence.** Automated where possible. Screenshots as last resort.
6. **Continuous monitoring.** Controls that rely on manual evidence decay. Automate monitoring.
7. **Prepare for audit.** Evidence organised, controls tested, personnel briefed.

## Framework Comparison

| Framework | Scope | Audience | Audit | Renewal |
|-----------|-------|---------|-------|---------|
| SOC 2 Type II | Security, Availability, Confidentiality, Privacy, Processing Integrity | US B2B customers | 3rd-party auditor | Annual |
| ISO 27001 | Information Security Management System | Global enterprise | Certification body | 3 years (annual surveillance) |
| GDPR | EU personal data processing | EU data subjects | Supervisory authority | Ongoing |
| HIPAA | Protected Health Information | US health sector | OCR (HHS) | Ongoing |
| PCI DSS v4 | Cardholder data | Payment processors | QSA | Annual |

## SOC 2 Control Mapping

```markdown
# SOC 2 Trust Service Criteria — Control Mapping

## CC6: Logical and Physical Access Controls

### CC6.1 — Logical access to information assets is restricted to authorised users

**Control:** Access to production systems requires MFA and VPN.  
**Owner:** Security Team  
**Implementation:** Okta SSO + Duo MFA for all production access; Tailscale VPN required.  
**Evidence type:** Automated monthly report from Okta showing MFA enforcement rate.  
**Testing frequency:** Quarterly access review; monthly automated evidence collection.  
**Automated monitoring:** Pagerduty alert if MFA bypass detected.

| Sub-control | Implementation | Evidence | Frequency |
|------------|---------------|---------|-----------|
| Unique user accounts | Okta directory | User list report | Monthly |
| MFA enforcement | Okta + Duo | MFA policy screenshot + audit log | Quarterly |
| Access request process | ServiceNow | Approved access tickets | Per event |
| Access reviews | Quarterly process | Review completion records | Quarterly |
| Privileged access | Separate admin accounts | IAM role listing | Monthly |
| Offboarding | Automated via HR system | Deprovisioning tickets | Per event |

### CC6.2 — Prior to issuing credentials, completeness and accuracy of registration is validated

**Control:** New user provisioning requires manager approval.
**Evidence:** ServiceNow tickets showing manager approval before Okta account creation.

### CC6.3 — Access is removed when no longer needed

**Control:** Automated deprovisioning triggered by HR system on termination.
**Evidence:** HRIS termination record + Okta deactivation timestamp within 24 hours.
```

## GDPR Control Checklist

```markdown
# GDPR Compliance Checklist

## Article 5 — Principles
- [ ] Data minimisation documented: collect only what's necessary
- [ ] Retention policies defined and enforced for all personal data types
- [ ] Purpose limitation documented: data used only for stated purpose
- [ ] Accuracy procedures: process for correcting inaccurate data

## Article 6 — Lawful Basis
- [ ] Lawful basis identified and documented for each processing activity
- [ ] Consent records maintained where consent is basis
- [ ] Legitimate interests assessment (LIA) for LI-based processing

## Article 13/14 — Privacy Notice
- [ ] Privacy policy published and accessible
- [ ] All required disclosures included (identity, purposes, retention, rights)
- [ ] Updated on material changes to processing

## Article 17 — Right to Erasure
- [ ] Erasure process documented and tested end-to-end
- [ ] All systems containing PII identified (including backups, logs, analytics)
- [ ] Erasure request response SLA: 30 days

## Article 25 — Data Protection by Design
- [ ] Privacy impact assessment (DPIA) process for new projects with high-risk processing
- [ ] Default settings are privacy-preserving
- [ ] Pseudonymisation implemented for analytics data

## Article 28 — Processor Agreements
- [ ] DPA (Data Processing Agreement) in place with all processors
- [ ] Processor inventory maintained and reviewed annually
- [ ] Sub-processor notification and approval process

## Article 32 — Security of Processing
- [ ] Encryption at rest: AES-256
- [ ] Encryption in transit: TLS 1.2+
- [ ] Access controls documented and tested
- [ ] Backup and recovery procedures tested annually

## Article 33/34 — Breach Notification
- [ ] Incident response plan includes GDPR breach notification
- [ ] DPA notification within 72 hours of discovery
- [ ] Data subjects notified when risk is high
- [ ] Breach register maintained
```

## Evidence Collection Automation

```python
# Auto-collect evidence for SOC 2 controls
import boto3
import json
from datetime import datetime, timedelta

class EvidenceCollector:
    def __init__(self, s3_bucket: str):
        self.s3 = boto3.client('s3')
        self.bucket = s3_bucket
        self.today = datetime.utcnow().strftime('%Y-%m-%d')
    
    def collect_all(self):
        self.collect_mfa_enforcement()
        self.collect_access_reviews()
        self.collect_encryption_status()
        self.collect_vulnerability_scan_results()
        self.collect_backup_verification()
    
    def collect_mfa_enforcement(self):
        """CC6.1 — MFA required for all users"""
        okta = OktaClient()
        users = okta.list_users()
        mfa_enrolled = [u for u in users if u['mfa_enrolled']]
        
        evidence = {
            "control": "CC6.1 MFA Enforcement",
            "collected_at": datetime.utcnow().isoformat(),
            "total_users": len(users),
            "mfa_enrolled": len(mfa_enrolled),
            "enforcement_rate": len(mfa_enrolled) / len(users),
            "non_enrolled": [u['email'] for u in users if not u['mfa_enrolled']],
        }
        
        self._save_evidence("cc6.1-mfa-enforcement", evidence)
        
        # Alert if enforcement rate drops below 100%
        if evidence["enforcement_rate"] < 1.0:
            self._alert(f"MFA not enrolled: {evidence['non_enrolled']}")
    
    def collect_encryption_status(self):
        """CC6.7 — Data encrypted at rest"""
        rds = boto3.client('rds')
        instances = rds.describe_db_instances()['DBInstances']
        
        unencrypted = [
            db['DBInstanceIdentifier']
            for db in instances
            if not db.get('StorageEncrypted', False)
        ]
        
        evidence = {
            "control": "CC6.7 Encryption at Rest",
            "collected_at": datetime.utcnow().isoformat(),
            "total_rds_instances": len(instances),
            "encrypted": len(instances) - len(unencrypted),
            "unencrypted": unencrypted,
            "compliant": len(unencrypted) == 0,
        }
        self._save_evidence("cc6.7-encryption", evidence)
        
        if unencrypted:
            self._alert(f"Unencrypted RDS instances: {unencrypted}", severity="CRITICAL")
    
    def collect_access_reviews(self):
        """A1.2 — Quarterly access reviews completed"""
        # Pull from ServiceNow: access review completion tickets
        snow = ServiceNowClient()
        reviews = snow.get_completed_reviews(
            since=datetime.utcnow() - timedelta(days=90)
        )
        evidence = {
            "control": "A1.2 Access Reviews",
            "collected_at": datetime.utcnow().isoformat(),
            "reviews_completed": len(reviews),
            "review_ids": [r['sys_id'] for r in reviews],
        }
        self._save_evidence("a1.2-access-reviews", evidence)
    
    def _save_evidence(self, control_id: str, evidence: dict):
        key = f"evidence/{self.today}/{control_id}.json"
        self.s3.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=json.dumps(evidence, indent=2),
            ContentType='application/json',
        )
    
    def _alert(self, message: str, severity: str = "WARNING"):
        print(f"[COMPLIANCE ALERT - {severity}] {message}")
        # → PagerDuty / Slack #compliance-alerts
```

## Audit Readiness Checklist

```markdown
# SOC 2 Type II Audit Readiness — 30 Days Before

## Evidence Package
- [ ] All controls have evidence for the full audit period (typically 6-12 months)
- [ ] Evidence is organised by trust service criteria
- [ ] Automated evidence collection logs complete
- [ ] Screenshots have timestamps visible
- [ ] Policy documents version-controlled and signed

## Controls Testing
- [ ] All controls self-tested by control owners
- [ ] Exceptions documented with compensating controls
- [ ] Penetration test completed (within 12 months)
- [ ] Vulnerability management program up to date

## Policies and Procedures
- [ ] All policies reviewed and approved in last 12 months
- [ ] Information Security Policy
- [ ] Acceptable Use Policy
- [ ] Incident Response Plan (tested)
- [ ] Business Continuity Plan (tested)
- [ ] Vendor Management Policy

## Personnel
- [ ] Security awareness training records complete (all employees)
- [ ] Background checks on file for all employees with production access
- [ ] Onboarding/offboarding records complete
- [ ] Roles and responsibilities documented

## Technical Controls
- [ ] MFA enforced for all users (100%)
- [ ] All production access via SSO
- [ ] Encryption at rest verified on all data stores
- [ ] TLS 1.2+ enforced on all endpoints
- [ ] Logging enabled on all critical systems
- [ ] Audit logs retained for minimum 12 months
- [ ] Backup restoration tested in last 12 months

## Vendor / Third Party
- [ ] Vendor risk assessments up to date
- [ ] DPAs in place with all data processors
- [ ] Critical vendor SOC 2 reports collected
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Compliance-first, security-second** | Controls on paper only; actual security poor | Build genuine security controls; compliance maps to them |
| **Annual evidence scramble** | Auditors see frantic preparation, not ongoing practice | Continuous automated evidence collection |
| **Manual evidence only** | Doesn't scale; easy to miss; hard to trust | Automate evidence for technical controls |
| **Treating audit period as "on" time** | Controls only active when auditor watching | Controls are always active; evidence proves it |
| **Separate compliance and engineering teams** | Controls not embedded in engineering practice | Compliance as code; engineers own their controls |
| **No control owner** | When a control fails, no one is responsible | Every control has a named owner and backup |

## 10 Rules

1. Build genuine security; map to compliance frameworks — not the reverse.
2. Automate evidence collection for all technical controls — human-collected evidence is slow and unreliable.
3. Every control has a named owner and a defined testing frequency.
4. Compliance is continuous — not an annual event. Evidence collected year-round.
5. Implement once, map to many frameworks — most controls satisfy multiple standards.
6. Alert on control failures immediately — don't discover them during audit prep.
7. Policies are living documents — review and approve annually; version-control them.
8. Test your incident response plan — a plan that has never been exercised is fiction.
9. Vendor risk management includes collecting your critical vendors' compliance reports annually.
10. Treat the gap analysis as a prioritised engineering backlog — not an audit finding list.
