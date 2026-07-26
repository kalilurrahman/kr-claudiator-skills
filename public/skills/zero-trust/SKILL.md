---
name: zero-trust
description: Design and implement zero-trust network architecture — never trust, always verify. Outputs identity-aware proxy config, mTLS policies, device trust enforcement, micro-segmentation rules, and continuous verification pipelines.
argument-hint: [current perimeter model, identity provider, cloud provider, compliance requirements]
allowed-tools: Read, Write, Bash
---

# Zero Trust Architecture

Zero trust replaces the castle-and-moat perimeter model — "trust everything inside the network" — with continuous verification: every request is authenticated, authorized, and encrypted regardless of where it originates. The network is assumed hostile.

## Core Principles

| Old Model | Zero Trust |
|-----------|-----------|
| Trust the network perimeter | Trust no network, including internal |
| Verify once at login | Verify every request, continuously |
| Broad network access | Least-privilege micro-segmentation |
| VPN for remote access | Identity-aware proxy for every resource |
| Static firewall rules | Dynamic policy based on identity + device posture |

## Process

1. **Inventory assets** — every service, database, device, and human identity that needs access to what.
2. **Define protect surfaces** — critical data, applications, assets (not the attack surface — the thing worth protecting).
3. **Map transaction flows** — how data flows between systems; who talks to what and why.
4. **Implement identity foundation** — SSO, MFA, short-lived credentials, device certificates.
5. **Deploy identity-aware proxy** — all internal resources accessed via proxy, never directly.
6. **Enforce mTLS** — mutual TLS for service-to-service; workload identity via SPIFFE/SPIRE.
7. **Micro-segment networks** — replace broad VLANs with per-service network policies.
8. **Continuous monitoring** — log every request, detect anomalies, revoke on signals.
9. **Automate posture checks** — device health, patch status, certificate validity checked on every access.

## Output Format

### Identity Foundation (SPIFFE/SPIRE for Workload Identity)

```yaml
# spire-server-config.hcl
server {
  bind_address = "0.0.0.0"
  bind_port    = "8081"
  trust_domain = "prod.example.com"
  data_dir     = "/opt/spire/data/server"
  log_level    = "INFO"

  ca_subject {
    country      = ["US"]
    organization = ["Example Corp"]
    common_name  = ""
  }

  ca_ttl        = "24h"   # Short-lived CA
  default_svid_ttl = "1h" # Short-lived workload certs
}

plugins {
  DataStore "sql" {
    plugin_data {
      database_type = "postgres"
      connection_string = "postgresql://spire:${SPIRE_DB_PASS}@postgres:5432/spire?sslmode=require"
    }
  }

  NodeAttestor "k8s_psat" {
    plugin_data {
      clusters = {
        "prod-cluster" = {
          service_account_allow_list = ["spire:spire-agent"]
        }
      }
    }
  }

  KeyManager "disk" {
    plugin_data {
      keys_path = "/opt/spire/data/server/keys.json"
    }
  }
}
```

```yaml
# spire-agent-config.hcl
agent {
  data_dir     = "/opt/spire/data/agent"
  log_level    = "INFO"
  server_address = "spire-server"
  server_port  = "8081"
  trust_domain = "prod.example.com"
  socket_path  = "/run/spire/sockets/agent.sock"
}

plugins {
  NodeAttestor "k8s_psat" {
    plugin_data {
      cluster    = "prod-cluster"
      token_path = "/var/run/secrets/tokens/spire-agent"
    }
  }

  WorkloadAttestor "k8s" {
    plugin_data {
      skip_kubelet_verification = false
    }
  }

  KeyManager "memory" { plugin_data {} }
}
```

```yaml
# SPIFFE registration entry — order-service gets an identity
apiVersion: spire.spiffe.io/v1alpha1
kind: ClusterSPIFFEID
metadata:
  name: order-service
spec:
  spiffeIDTemplate: "spiffe://prod.example.com/ns/{{ .PodMeta.Namespace }}/sa/{{ .PodSpec.ServiceAccountName }}"
  podSelector:
    matchLabels:
      app: order-service
  dnsNameTemplates:
    - "order-service.production.svc.cluster.local"
```

### Identity-Aware Proxy (BeyondCorp / Cloudflare Access pattern)

```python
# proxy/zero_trust_proxy.py
import jwt
import httpx
import time
import hashlib
from dataclasses import dataclass
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import Response
import logging

logger = logging.getLogger("zero-trust-proxy")

@dataclass
class AccessContext:
    user_id: str
    email: str
    groups: list[str]
    device_id: str
    device_trusted: bool
    device_patch_level: str
    auth_time: int       # When the user last authenticated
    risk_score: float    # 0.0 = low risk, 1.0 = high risk

class ZeroTrustProxy:
    """
    Every request to internal services must pass through this proxy.
    No direct network access to services — even from inside the VPC.
    """
    
    def __init__(self):
        self.policies = PolicyEngine()
        self.device_trust = DeviceTrustService()
        self.risk_engine = RiskEngine()
    
    async def handle_request(self, request: Request) -> Response:
        # Step 1: Verify identity token (OIDC/JWT from IdP)
        context = await self._authenticate(request)
        
        # Step 2: Check device trust posture
        await self._verify_device(request, context)
        
        # Step 3: Re-authenticate if session is old (step-up auth)
        await self._check_session_freshness(context)
        
        # Step 4: Evaluate access policy
        resource = self._extract_resource(request)
        await self._authorize(context, resource, request.method)
        
        # Step 5: Compute risk score and block if too high
        risk = await self.risk_engine.score(context, request)
        if risk.score > 0.8:
            logger.warning(f"High risk access blocked: user={context.user_id} score={risk.score} resource={resource}")
            raise HTTPException(403, detail="Access blocked: anomalous behavior detected")
        
        # Step 6: Forward to upstream (mTLS automatically handled by SPIFFE)
        response = await self._proxy_upstream(request, context)
        
        # Step 7: Audit log
        self._audit(context, resource, request.method, response.status_code, risk.score)
        
        return response
    
    async def _authenticate(self, request: Request) -> AccessContext:
        token = request.headers.get("Authorization", "").removeprefix("Bearer ")
        if not token:
            raise HTTPException(401, detail="Authentication required")
        
        try:
            # Verify with IdP JWKS (cached, refreshed every 5 min)
            payload = jwt.decode(
                token,
                key=self._get_jwks(),
                algorithms=["RS256"],
                audience="zero-trust-proxy",
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(401, detail="Token expired — re-authenticate")
        except jwt.InvalidTokenError as e:
            raise HTTPException(401, detail=f"Invalid token: {e}")
        
        return AccessContext(
            user_id=payload["sub"],
            email=payload["email"],
            groups=payload.get("groups", []),
            device_id=request.headers.get("X-Device-ID", ""),
            device_trusted=False,  # Set in next step
            device_patch_level="",
            auth_time=payload.get("auth_time", 0),
            risk_score=0.0,
        )
    
    async def _verify_device(self, request: Request, context: AccessContext):
        device_cert = request.headers.get("X-Device-Certificate")
        
        if not device_cert:
            # Allow with lower trust — enforce step-up for sensitive resources
            context.device_trusted = False
            return
        
        device_info = await self.device_trust.verify_certificate(device_cert)
        
        if not device_info.is_managed:
            raise HTTPException(403, detail="Unmanaged device — enroll this device to access internal resources")
        
        if not device_info.is_patched:
            raise HTTPException(403, detail=f"Device {context.device_id} has outstanding critical patches — update before accessing this resource")
        
        if not device_info.disk_encrypted:
            raise HTTPException(403, detail="Device disk encryption required for internal resource access")
        
        context.device_trusted = True
        context.device_patch_level = device_info.patch_level
    
    async def _check_session_freshness(self, context: AccessContext):
        """Require recent authentication for sensitive operations."""
        age_minutes = (time.time() - context.auth_time) / 60
        
        # Require re-auth every 8 hours max
        if age_minutes > 480:
            raise HTTPException(401, detail="Session expired — re-authenticate", headers={"X-Reauth-Required": "true"})
    
    async def _authorize(self, context: AccessContext, resource: str, method: str):
        decision = await self.policies.evaluate(
            subject={
                "user_id": context.user_id,
                "groups": context.groups,
                "device_trusted": context.device_trusted,
            },
            action=method,
            resource=resource,
        )
        
        if not decision.allowed:
            logger.warning(f"Access denied: user={context.user_id} resource={resource} reason={decision.reason}")
            raise HTTPException(403, detail=f"Access denied: {decision.reason}")
    
    def _audit(self, context: AccessContext, resource: str, method: str, status: int, risk: float):
        logger.info("access_decision", extra={
            "user_id": context.user_id,
            "email": context.email,
            "device_id": context.device_id,
            "device_trusted": context.device_trusted,
            "resource": resource,
            "method": method,
            "status_code": status,
            "risk_score": round(risk, 3),
            "groups": context.groups,
        })
```

### Policy Definition (Open Policy Agent)

```rego
# policies/zero_trust.rego
package zero_trust

import future.keywords.if
import future.keywords.in

default allow := false

# Admin group has full access
allow if {
    "platform-admins" in input.subject.groups
    input.subject.device_trusted == true
}

# Engineers can read all internal services, write to non-production
allow if {
    "engineers" in input.subject.groups
    input.action in {"GET", "HEAD", "OPTIONS"}
    input.subject.device_trusted == true
}

allow if {
    "engineers" in input.subject.groups
    input.action in {"POST", "PUT", "PATCH", "DELETE"}
    not startswith(input.resource, "/production/")
    input.subject.device_trusted == true
}

# Production writes require both group membership AND MFA
allow if {
    "senior-engineers" in input.subject.groups
    startswith(input.resource, "/production/")
    input.subject.mfa_verified == true
    input.subject.device_trusted == true
    # Require fresh auth for production writes
    time.now_ns() - input.subject.auth_time_ns < 3600000000000  # 1 hour
}

# Service accounts (SPIFFE identities) get narrow access
allow if {
    startswith(input.subject.user_id, "spiffe://")
    service_allowed_resources[input.subject.user_id][input.resource]
    input.action in {"GET", "POST"}
}

service_allowed_resources := {
    "spiffe://prod.example.com/ns/production/sa/order-service": {
        "/inventory/check": true,
        "/payments/charge": true,
    },
    "spiffe://prod.example.com/ns/production/sa/user-service": {
        "/notifications/send": true,
    },
}

# Deny reason for audit
deny_reason := "untrusted device" if { input.subject.device_trusted == false }
deny_reason := "insufficient group membership" if {
    not "engineers" in input.subject.groups
    not "platform-admins" in input.subject.groups
}
deny_reason := "stale authentication" if {
    startswith(input.resource, "/production/")
    time.now_ns() - input.subject.auth_time_ns >= 3600000000000
}
```

### Network Micro-Segmentation (Kubernetes NetworkPolicy)

```yaml
# Default deny-all for production namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-default
  namespace: production
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
---
# Allow order-service to talk ONLY to inventory and payment
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: order-service-egress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: order-service
  policyTypes: [Egress]
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: inventory-service
      ports:
        - port: 8080
    - to:
        - podSelector:
            matchLabels:
              app: payment-service
      ports:
        - port: 8080
    - to:
        - namespaceSelector:
            matchLabels:
              name: kube-system
      ports:
        - port: 53     # DNS only
---
# Allow ingress to order-service ONLY from the zero-trust proxy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: order-service-ingress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: order-service
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: zero-trust-proxy
      ports:
        - port: 8080
    - from:
        - podSelector:
            matchLabels:
              app: order-service     # Allow intra-service (health checks)
```

### Device Trust Enforcement (MDM Integration)

```python
# device_trust/mdm_checker.py
import httpx
from dataclasses import dataclass
from functools import lru_cache
import time

@dataclass
class DevicePosture:
    device_id: str
    is_managed: bool           # Enrolled in MDM (Jamf, Intune, etc.)
    is_patched: bool           # No critical patches outstanding
    disk_encrypted: bool       # FileVault / BitLocker enabled
    screen_lock_enabled: bool
    os_version: str
    patch_level: str
    compliance_status: str     # "compliant" | "warning" | "non-compliant"
    last_checked: float

class DeviceTrustService:
    def __init__(self, mdm_url: str, api_key: str):
        self.mdm_url = mdm_url
        self.headers = {"Authorization": f"Bearer {api_key}"}
        self._cache: dict[str, tuple[DevicePosture, float]] = {}
        self.cache_ttl = 300  # 5 min — don't hammer MDM on every request
    
    async def verify_certificate(self, device_cert: str) -> DevicePosture:
        """Verify device certificate and check MDM enrollment."""
        device_id = self._extract_device_id(device_cert)
        
        # Check cache
        if device_id in self._cache:
            posture, cached_at = self._cache[device_id]
            if time.time() - cached_at < self.cache_ttl:
                return posture
        
        # Query MDM API
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.mdm_url}/api/v2/devices/{device_id}/compliance",
                headers=self.headers,
                timeout=5.0
            )
        
        if resp.status_code == 404:
            return DevicePosture(
                device_id=device_id,
                is_managed=False,
                is_patched=False,
                disk_encrypted=False,
                screen_lock_enabled=False,
                os_version="unknown",
                patch_level="unknown",
                compliance_status="non-compliant",
                last_checked=time.time(),
            )
        
        data = resp.json()
        posture = DevicePosture(
            device_id=device_id,
            is_managed=True,
            is_patched=data.get("critical_patches_pending", 0) == 0,
            disk_encrypted=data.get("disk_encrypted", False),
            screen_lock_enabled=data.get("screen_lock_enabled", False),
            os_version=data.get("os_version", ""),
            patch_level=data.get("patch_level", ""),
            compliance_status=data.get("compliance_status", "unknown"),
            last_checked=time.time(),
        )
        
        self._cache[device_id] = (posture, time.time())
        return posture
```

### Continuous Monitoring & Anomaly Detection

```python
# monitoring/anomaly_detector.py
from collections import defaultdict
import statistics

class RiskEngine:
    def __init__(self):
        self._user_baselines: dict[str, dict] = {}  # Historical access patterns
    
    async def score(self, context, request) -> "RiskScore":
        signals = []
        
        # Impossible travel: access from two distant locations in short time
        if await self._is_impossible_travel(context.user_id, request):
            signals.append(("impossible_travel", 0.9))
        
        # New device: user has never accessed from this device
        if context.device_id not in self._known_devices(context.user_id):
            signals.append(("new_device", 0.4))
        
        # Unusual time: access at 3am for a user who normally works 9-5
        if self._is_unusual_time(context.user_id):
            signals.append(("unusual_time", 0.2))
        
        # High-value target with unmanaged device
        if not context.device_trusted and "/admin" in str(request.url):
            signals.append(("unmanaged_device_admin_access", 0.7))
        
        # Bulk data access: many requests in short window
        if await self._is_bulk_access(context.user_id, request):
            signals.append(("bulk_access", 0.5))
        
        # Combine signals (max, not sum — avoid false inflation)
        risk_score = max((score for _, score in signals), default=0.0)
        
        return RiskScore(
            score=risk_score,
            signals=[name for name, _ in signals],
            recommendation="block" if risk_score > 0.8 else "step_up_auth" if risk_score > 0.5 else "allow"
        )
```

## Rules

- **Never trust the network** — internal traffic requires the same authentication as external traffic.
- **Short-lived credentials everywhere** — tokens expire in hours, service certs expire in days; rotate automatically.
- **Device posture is part of the policy** — unmanaged or unpatched devices get no access to sensitive resources.
- **Least-privilege network segmentation** — services may only connect to the specific other services they need.
- **Log every access decision** — include user, device, resource, method, risk score, and grant/deny.
- **Step-up authentication for sensitive actions** — production writes require re-authentication within the last hour.
- **Workload identity, not service passwords** — use SPIFFE/SPIRE for service-to-service; never shared secrets.
- **Fail closed, not open** — if the policy engine is unavailable, deny access rather than defaulting to allow.
- **Test with red team exercises** — verify that lateral movement from a compromised host is actually blocked.
- **Automate certificate rotation** — expiring certs cause outages; automate renewal 72h before expiry.
