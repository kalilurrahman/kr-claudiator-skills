---
name: api-security-audit
description: Conduct a structured security audit of APIs. Outputs OWASP API Top 10 assessment, vulnerability findings with severity ratings, remediation recommendations, and executive summary.
argument-hint: [API type, authentication method, data sensitivity, endpoints count, previous findings]
allowed-tools: Read, Write, Bash
---

# API Security Audit

An API security audit systematically evaluates API endpoints for vulnerabilities following the OWASP API Security Top 10. APIs expose business logic directly — a broken authentication or missing authorisation check can expose every user's data, not just the attacker's.

## Process

1. **Enumerate all endpoints.** From OpenAPI spec, network traffic capture, or source code. Include undocumented endpoints.
2. **Map authentication and authorisation.** Who can call what? How is identity established? What resources does each role access?
3. **Test each OWASP API Top 10 category.** Structured test cases per category.
4. **Test business logic.** Workflows that should be atomic; rate limits on sensitive operations; state transitions.
5. **Test for information disclosure.** Error messages, verbose responses, headers.
6. **Report findings.** CVSS severity, reproduction steps, remediation.
7. **Verify remediations.** Retest all critical and high findings after fix.

## OWASP API Top 10 Assessment

```markdown
# API Security Assessment: [API Name]

**Date:** YYYY-MM-DD  
**Auditor:** [Name]  
**Scope:** [Base URL, versions, exclusions]  
**Authentication:** [JWT / API Key / OAuth 2.0]

---

## API1:2023 — Broken Object Level Authorization (BOLA/IDOR)

**Risk:** Attacker accesses another user's resources by manipulating object IDs in requests.

### Test Cases
```

```python
# BOLA test — access other user's resources
import requests

AUTH_A = {"Authorization": "Bearer <token_for_user_A>"}
AUTH_B = {"Authorization": "Bearer <token_for_user_B>"}
BASE = "https://api.example.com"

# Get user A's order IDs
orders_A = requests.get(f"{BASE}/orders", headers=AUTH_A).json()
order_id_A = orders_A[0]["id"]

# Attempt to access user A's order as user B
response = requests.get(f"{BASE}/orders/{order_id_A}", headers=AUTH_B)

if response.status_code == 200:
    print(f"VULNERABLE: BOLA — User B accessed User A's order {order_id_A}")
    print(f"Response: {response.json()}")
elif response.status_code in [403, 404]:
    print(f"PROTECTED: Returned {response.status_code}")

# Test numeric ID enumeration
for user_id in range(1, 100):
    r = requests.get(f"{BASE}/users/{user_id}/profile", headers=AUTH_B)
    if r.status_code == 200:
        print(f"EXPOSED: User B can access user {user_id}'s profile")
```

```markdown
### Findings

| # | Endpoint | Finding | Severity | Status |
|---|---------|---------|----------|--------|
| 1 | GET /orders/{id} | User B can access User A's orders by ID | CRITICAL | Open |
| 2 | GET /invoices/{id} | IDOR — sequential IDs enumerable | HIGH | Open |

---

## API2:2023 — Broken Authentication

**Test Cases:**
- Brute force login without rate limiting
- Token with invalid signature accepted
- Expired tokens accepted
- Password reset token reuse
- Predictable session tokens

```

```python
# Auth test suite
def test_broken_authentication(base_url: str):
    findings = []
    
    # Test 1: Rate limiting on login
    for i in range(100):
        r = requests.post(f"{base_url}/auth/login", json={
            "email": "test@example.com",
            "password": f"wrongpass{i}"
        })
        if r.status_code != 429:
            if i == 50:  # 50 failed attempts without 429
                findings.append("NO_RATE_LIMIT: Login endpoint not rate limited after 50 attempts")
    
    # Test 2: Invalid JWT signature accepted
    import jwt, base64
    valid_token = get_valid_token()
    parts = valid_token.split('.')
    tampered = parts[0] + '.' + parts[1] + '.invalidsignature'
    r = requests.get(f"{base_url}/me", headers={"Authorization": f"Bearer {tampered}"})
    if r.status_code == 200:
        findings.append("INVALID_JWT: Server accepts tokens with invalid signatures")
    
    # Test 3: Algorithm confusion (alg:none)
    header = base64.urlsafe_b64encode(b'{"alg":"none","typ":"JWT"}').decode().rstrip('=')
    payload = base64.urlsafe_b64encode(b'{"sub":"1","role":"admin"}').decode().rstrip('=')
    none_token = f"{header}.{payload}."
    r = requests.get(f"{base_url}/me", headers={"Authorization": f"Bearer {none_token}"})
    if r.status_code == 200:
        findings.append("JWT_ALG_NONE: Server accepts unsigned (alg:none) JWTs")
    
    # Test 4: Expired token
    expired_token = generate_expired_token()
    r = requests.get(f"{base_url}/me", headers={"Authorization": f"Bearer {expired_token}"})
    if r.status_code == 200:
        findings.append("EXPIRED_TOKEN: Server accepts expired JWTs")
    
    return findings
```

```markdown
---

## API3:2023 — Broken Object Property Level Authorization (Mass Assignment)

**Test Cases:**
- Submit extra fields not in API spec (role, is_admin, plan_tier)
- Update read-only fields

```

```python
# Mass assignment test
def test_mass_assignment(base_url: str, token: str):
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get current user profile
    user = requests.get(f"{base_url}/me", headers=headers).json()
    original_role = user.get("role")
    
    # Attempt to elevate privileges via mass assignment
    payloads = [
        {"name": "Test", "role": "admin"},
        {"name": "Test", "is_admin": True},
        {"name": "Test", "plan": "enterprise"},
        {"name": "Test", "subscription_tier": "premium"},
        {"name": "Test", "credits": 999999},
    ]
    
    for payload in payloads:
        r = requests.patch(f"{base_url}/me", json=payload, headers=headers)
        if r.status_code == 200:
            updated = requests.get(f"{base_url}/me", headers=headers).json()
            for key, value in payload.items():
                if key != "name" and updated.get(key) == value:
                    print(f"VULNERABLE: Mass assignment — {key} updated to {value}")

---

## API4:2023 — Unrestricted Resource Consumption

def test_resource_consumption(base_url: str):
    findings = []
    
    # Test: No pagination limit
    r = requests.get(f"{base_url}/users?limit=99999")
    if r.status_code == 200 and len(r.json()) > 1000:
        findings.append("NO_PAGINATION_LIMIT: API returns >1000 items without limit")
    
    # Test: Large file upload
    large_data = b"A" * 100 * 1024 * 1024  # 100MB
    r = requests.post(f"{base_url}/upload", data=large_data,
                      headers={"Content-Type": "application/octet-stream"})
    if r.status_code == 200:
        findings.append("NO_UPLOAD_LIMIT: API accepts 100MB upload without restriction")
    
    # Test: Expensive query without rate limit
    for _ in range(100):
        r = requests.get(f"{base_url}/search?q=*&fields=*")
        if r.elapsed.total_seconds() > 5:
            findings.append("EXPENSIVE_QUERY: Unfiltered search takes >5s — DoS risk")
            break
    
    return findings
```

## Automated Scan with OWASP ZAP

```bash
# Full active scan with ZAP
docker run -v $(pwd):/zap/wrk \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-api-scan.py \
  -t https://api.example.com/openapi.json \
  -f openapi \
  -r zap-report.html \
  -J zap-report.json \
  -l WARN

# Parse results
python3 << 'EOF'
import json
with open('zap-report.json') as f:
    report = json.load(f)

for alert in report['site'][0]['alerts']:
    if alert['riskcode'] >= 2:  # Medium and above
        print(f"[{alert['risk']}] {alert['name']}")
        print(f"  URL: {alert['instances'][0]['uri']}")
        print(f"  Solution: {alert['solution'][:200]}")
        print()
EOF
```

## Finding Report Template

```markdown
## Finding #1: Broken Object Level Authorization (BOLA)

**Severity:** CRITICAL (CVSS: 9.1)  
**Category:** API1:2023 BOLA  
**Endpoint:** `GET /api/v1/orders/{orderId}`  
**Status:** Open  

### Description
Any authenticated user can access any order by guessing or enumerating the order ID. The API does not verify that the requesting user owns the order.

### Reproduction Steps
1. Authenticate as User A and retrieve any order ID from `GET /orders`
2. Authenticate as User B
3. Request `GET /api/v1/orders/{order_id_from_user_A}` with User B's token
4. **Expected:** 403 Forbidden
5. **Actual:** 200 OK with User A's order data

### Impact
- Any authenticated user can enumerate and access all orders in the system
- Exposes PII (shipping address, items, payment method last 4)
- Estimated affected records: all orders (n=450,000)

### Remediation
```python
# Fix: Verify ownership before returning data
@router.get("/orders/{order_id}")
async def get_order(order_id: str, claims: dict = Depends(require_auth)):
    order = await order_repo.get(order_id)
    if not order:
        raise HTTPException(404)
    
    # ADD THIS CHECK:
    if order.customer_id != claims["sub"]:
        raise HTTPException(403, "Access denied")
    
    return order
```

**Priority:** Fix before next deployment  
**Estimated effort:** 2 hours
```

## Findings Summary

```markdown
# Executive Summary

**Total findings:** 12
**Critical:** 2 | **High:** 4 | **Medium:** 4 | **Low:** 2

| # | Finding | Severity | Endpoint |
|---|---------|----------|---------|
| 1 | BOLA — order access | CRITICAL | GET /orders/{id} |
| 2 | No rate limit on login | HIGH | POST /auth/login |
| 3 | Mass assignment on profile | HIGH | PATCH /me |
| 4 | Verbose error messages | MEDIUM | All endpoints |
| 5 | Missing CORS restrictions | MEDIUM | All endpoints |

**Risk Assessment:** HIGH — Critical BOLA vulnerability exposes all order data.  
**Recommended action:** Stop deployment; fix critical findings; retest before launch.
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Testing only documented endpoints** | Shadow APIs and debug endpoints missed | Crawl/proxy to discover undocumented endpoints |
| **Audit without production-like data** | Some vulnerabilities only surface with realistic data | Use anonymised prod data snapshot in test environment |
| **No retesting after fixes** | "Fixed" issues re-introduced or not actually fixed | Mandatory retest for Critical and High findings |
| **Generic remediations** | "Add authorisation checks" not actionable | Specific code fixes with line numbers |
| **Testing only happy path auth** | Weaknesses in error paths missed | Test token expiry, invalid signatures, malformed tokens |

## 10 Rules

1. Test BOLA on every endpoint that takes an object ID — it's the #1 API vulnerability.
2. Authentication testing includes expired tokens, invalid signatures, and algorithm confusion attacks.
3. Mass assignment testing submits all sensitive fields, not just obvious ones like `role` and `admin`.
4. Test rate limiting on all authentication, password reset, and sensitive action endpoints.
5. Enumerate endpoints from traffic capture, not just the OpenAPI spec — undocumented endpoints exist.
6. Every finding has exact reproduction steps — "we found IDOR" is not a finding; "authenticated as User B, request GET /orders/123 owned by User A, received 200" is.
7. Severity ratings use CVSS — not gut feel.
8. Retest all Critical and High findings after fixes before signing off.
9. Include remediation code, not just recommendations — developers fix faster with working examples.
10. The executive summary is written for the decision-maker, not the developer — risk, business impact, recommended action.
