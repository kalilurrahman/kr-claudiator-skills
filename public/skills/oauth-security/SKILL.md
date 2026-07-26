---
name: oauth-security
description: Secure OAuth 2.0 implementations against common attacks. Outputs threat model, security controls, token security hardening, and implementation review checklist.
argument-hint: [OAuth flow, client type, token types, identified threats]
allowed-tools: Read, Write
---

# OAuth Security

OAuth 2.0 has many implementation pitfalls. The spec is flexible; implementors fill gaps incorrectly. Common vulnerabilities include CSRF on the callback, open redirect abuse, token leakage via referrer headers, and insufficient token validation. Security requires implementing the spec correctly, not just partially.

## OAuth Threat Model

```markdown
## Common OAuth Attack Vectors

### 1. CSRF on Redirect URI (State Parameter Missing)
Attack: Attacker crafts authorization URL; tricks victim into authorising;
        steals the resulting code via forged callback.
Mitigation: State parameter — cryptographically random, verified on callback.

### 2. Open Redirect via redirect_uri
Attack: Attacker registers redirect_uri with slight variation;
        authorization code sent to attacker's server.
Mitigation: Exact match on registered redirect_uri — no wildcards.

### 3. Token Leakage via Referrer Header
Attack: Access token in URL fragment leaks in Referer header to third-party pages.
Mitigation: Tokens never in URL; use Authorization header only.

### 4. Authorization Code Interception (PKCE Bypass)
Attack: In public clients, authorization code intercepted and exchanged.
Mitigation: PKCE (Proof Key for Code Exchange) — S256 method.

### 5. JWT Algorithm Confusion
Attack: Server accepts "alg: none" or RS256 key used with HS256 algorithm.
Mitigation: Allowlist algorithms; validate strictly.

### 6. Token Replay
Attack: Stolen access or refresh token replayed by attacker.
Mitigation: Short token lifetimes; refresh token rotation; IP binding.
```

## Security Controls Implementation

```python
import secrets
import hashlib
import base64
from datetime import datetime, timedelta
import jwt
from jwt import PyJWKClient

# 1. State parameter — CSRF protection
def generate_state() -> str:
    return secrets.token_urlsafe(32)  # 256-bit random, URL-safe

def verify_state(received: str, expected: str) -> bool:
    return secrets.compare_digest(received, expected)  # Constant-time comparison

# 2. PKCE
def generate_pkce() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)  # 512-bit random
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).decode().rstrip("=")
    return verifier, challenge

# 3. Strict redirect_uri validation
REGISTERED_URIS = {
    "client_abc": {"https://app.example.com/callback"},
    "mobile_app": {"myapp://auth/callback"},
}

def validate_redirect_uri(client_id: str, redirect_uri: str) -> bool:
    allowed = REGISTERED_URIS.get(client_id, set())
    return redirect_uri in allowed  # Exact match only — no startsWith, no wildcards

# 4. JWT validation (strict)
JWKS_CLIENT = PyJWKClient("https://auth.example.com/.well-known/jwks.json")
ALLOWED_ALGORITHMS = ["RS256", "ES256"]  # Explicitly allowlisted

def validate_token(token: str, expected_audience: str) -> dict:
    # Reject "alg: none" by not including it in allowed algorithms
    header = jwt.get_unverified_header(token)
    if header.get("alg") not in ALLOWED_ALGORITHMS:
        raise ValueError(f"Algorithm not allowed: {header.get('alg')}")
    
    signing_key = JWKS_CLIENT.get_signing_key_from_jwt(token)
    
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=ALLOWED_ALGORITHMS,  # Never ["*"]
        audience=expected_audience,
        options={
            "require": ["exp", "iat", "iss", "sub", "aud"],
            "verify_exp": True,
            "verify_iat": True,
        }
    )

# 5. Refresh token rotation
async def rotate_refresh_token(old_token: str, client_id: str) -> dict:
    stored = await token_store.get_refresh_token(old_token)
    
    if not stored:
        # Possible token reuse attack — revoke all tokens for this user
        await token_store.revoke_all_user_tokens(stored.user_id)
        raise SecurityException("Refresh token reuse detected — all sessions revoked")
    
    if stored.client_id != client_id:
        raise ValueError("Token/client mismatch")
    
    # Rotate: invalidate old, issue new
    await token_store.revoke(old_token)
    new_access = generate_access_token(stored.user_id)
    new_refresh = secrets.token_urlsafe(32)
    await token_store.store_refresh_token(new_refresh, stored.user_id, client_id)
    
    return {"access_token": new_access, "refresh_token": new_refresh}
```

## Token Security Hardening

```python
# Short lifetimes
ACCESS_TOKEN_TTL = timedelta(minutes=15)    # Never more than 1 hour
REFRESH_TOKEN_TTL = timedelta(days=30)      # Refresh window

# Secure token generation
def generate_access_token(user_id: str, scope: list[str]) -> str:
    now = datetime.utcnow()
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + ACCESS_TOKEN_TTL,
        "jti": secrets.token_urlsafe(16),  # Unique ID for revocation
        "scope": " ".join(scope),
        "iss": "https://auth.example.com",
        "aud": "https://api.example.com",
    }
    return jwt.encode(payload, PRIVATE_KEY, algorithm="RS256")
```

## Implementation Review Checklist

```markdown
## OAuth Security Review Checklist

### Authorization Server
- [ ] State parameter generated and verified on callback
- [ ] redirect_uri exact match only — no wildcards
- [ ] PKCE required for public clients (S256)
- [ ] Authorization codes single-use and short-lived (<10 min)
- [ ] Client secrets hashed in storage

### Token Security
- [ ] Access token TTL ≤ 15 minutes
- [ ] Refresh token rotation on every use
- [ ] JWT "alg: none" rejected
- [ ] JWT algorithm allowlist (not ["*"])
- [ ] Both "aud" and "iss" claims validated
- [ ] Token revocation endpoint implemented

### Transport
- [ ] HTTPS only — no HTTP fallback
- [ ] Tokens in Authorization header — never in URL query parameters
- [ ] No tokens in server logs
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Missing state parameter** | CSRF on callback | Generate state; verify on callback |
| **Wildcard redirect_uri** | Code sent to attacker-controlled URI | Exact match only |
| **JWT alg:none accepted** | Signature bypass | Allowlist algorithms; reject none |
| **Long access token TTL** | Leaked token valid for hours | 15 minutes maximum |
| **No refresh token rotation** | Stolen refresh token valid indefinitely | Rotate on every use; detect reuse |
| **Tokens in URL** | Leaks in browser history, logs, referrer | Authorization header only |

## 10 Rules

1. State parameter is mandatory — CSRF is real and exploitable without it.
2. redirect_uri is exact match — never startsWith or pattern match.
3. PKCE is required for all public clients — implicit flow is deprecated.
4. JWT algorithm is explicitly allowlisted — never trust the "alg" header blindly.
5. Validate both "aud" and "iss" — missing either enables cross-service token use.
6. Access token TTL is 15 minutes — short enough that a stolen token expires quickly.
7. Refresh token rotation detects theft — reuse attack triggers full session revocation.
8. Tokens never appear in URLs — Authorization header only; no query parameters.
9. Authorization codes are single-use — reject replays immediately.
10. Revocation endpoint is implemented and tested — logout means logout, including tokens.

---

## Deep Reference Playbook

The sections below extend this skill into a complete operating playbook so it can run end-to-end inside Claude Code, CoWork, or any agentic tool without further prompting. Pull only the sections you need for a given engagement.

### Inputs the skill must collect

Before producing any output, the skill confirms:

1. **Objective** — the single decision or artifact the user wants out of this session.
2. **Context** — system, team, customer, product, or domain the work sits inside.
3. **Constraints** — time, budget, headcount, regulatory, technical, political.
4. **Definition of done** — what "good" looks like and who signs it off.
5. **Audience** — who reads or consumes the output (engineer, exec, customer, regulator).
6. **Existing artifacts** — prior versions, related docs, dashboards, tickets.
7. **Risk appetite** — how reversible the decision is and how much ambiguity is acceptable.

If any of these are missing, the skill asks targeted clarifying questions before generating output. It never invents constraints the user did not state.

### Operating workflow

The canonical workflow for **Oauth Security** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

**Stage 1 — Frame.** Restate the problem in one paragraph. Name the decision, the deadline, the stakeholders, and the success metric. Surface assumptions explicitly so they can be challenged.

**Stage 2 — Diagnose.** Inventory the current state with concrete evidence: metrics, quotes, screenshots, configs, tickets. Separate facts from interpretations. Identify the two or three root causes that explain most of the gap, not the long tail of symptoms.

**Stage 3 — Design.** Generate at least two viable options. For each option, capture: what changes, who owns it, what it costs, what it unblocks, what it risks, and how it could fail. Recommend one with a written rationale.

**Stage 4 — Execute.** Convert the chosen option into a sequenced plan: milestones, owners, dependencies, gating checks, communication cadence, and rollback triggers. Anything that cannot be assigned an owner and a date is not yet a plan.

**Stage 5 — Validate.** Define how success will be measured, when the measurement happens, and what action follows each possible result. Schedule the retrospective before the work starts, not after.

### Outputs the skill produces

Depending on the request, the skill returns one or more of:

- A one-page brief suitable for an executive reader.
- A detailed working document for the delivery team.
- A decision record capturing the choice, the alternatives, and the rationale.
- A risk register with probability, impact, owner, and mitigation.
- A sequenced action plan with named owners and explicit due dates.
- A measurement plan tied to the success metric.
- A communication plan for stakeholders inside and outside the team.

Every artifact uses clear headings, short paragraphs, and tables where comparison helps. No filler. No restating the prompt. No hedging language when a recommendation is warranted.

### Decision logic and trade-offs

The skill applies the following heuristics when choices are not obvious:

- **Prefer reversible decisions** taken quickly over irreversible decisions taken slowly.
- **Optimise for the constraint that bites first** — usually time, attention, or trust, not money.
- **Default to the simplest design** that meets the stated definition of done; add complexity only when a specific requirement forces it.
- **Make the cost of being wrong visible** so the reader can judge whether the recommendation is proportionate.
- **Name the people**, not the roles, when assigning ownership; ambiguous ownership produces ambiguous outcomes.

### Anti-patterns the skill refuses to emit

| Anti-pattern | Why it fails | What the skill does instead |
|---|---|---|
| Generic best-practice list with no context | Reader cannot act on it | Tailors recommendations to the stated constraints |
| Recommendation without trade-offs | Hides the cost of being wrong | Names the price paid for the recommendation |
| Plan with no owners or dates | Cannot be executed or tracked | Assigns a named owner and a date to every action |
| Metrics theatre | Measures activity, not outcome | Ties every metric back to the user or business outcome |
| Boil-the-ocean scope | Nothing ships | Cuts scope to the smallest valuable slice |
| Buried recommendation | Reader misses the point | Leads with the recommendation in the first paragraph |

### Quality bar

The skill self-checks each output against these gates before returning it:

1. Can a busy executive understand the recommendation from the first 150 words?
2. Is every claim either evidenced, labelled as an assumption, or removed?
3. Does every action have an owner and a date?
4. Are the trade-offs of the recommendation stated honestly?
5. Is there a measurable success criterion?
6. Would the author be comfortable defending this artifact in a review meeting?

If any gate fails, the skill rewrites the section before returning it.

### Worked micro-example

> **Context:** Secure OAuth 2.0 implementations against common attacks. Outputs threat model, security controls, token security hardening, and implementation review checklist.
>
> **Frame:** the team needs a defensible recommendation within five working days; the audience is a cross-functional steering group; the cost of delay is higher than the cost of being slightly wrong.
>
> **Diagnose:** the dominant constraint is decision latency, not analytical depth. Existing data is sufficient for a directional call.
>
> **Design:** two viable options surfaced. Option A optimises for speed and reversibility. Option B optimises for completeness but slips the deadline by two weeks.
>
> **Execute:** Option A recommended. Plan sequenced into a two-week sprint with named owners, a mid-point checkpoint, and a clear rollback trigger.
>
> **Validate:** success measured against a single leading indicator at day 30 and a single lagging indicator at day 90. Retrospective scheduled for day 35.

### Cadence and follow-through

A one-shot artifact rarely changes outcomes. The skill recommends a lightweight cadence to keep the work alive:

- **Weekly:** owner posts a five-line status (done, doing, blocked, risk, ask).
- **Fortnightly:** steering group reviews leading indicators and unblocks dependencies.
- **Monthly:** retrospective on what the data is teaching the team; adjust plan accordingly.
- **Quarterly:** revisit the original objective and decide whether to continue, pivot, or stop.

### Closing rules of thumb

1. Lead with the recommendation; supporting analysis follows.
2. Treat every output as a draft that will be challenged; pre-empt the obvious objections.
3. Prefer one strong recommendation over three weak options.
4. When the evidence is thin, say so; do not launder uncertainty as confidence.
5. Optimise for the next decision, not for the perfect document.
6. Make it easy for the reader to disagree with you in a structured way.
7. Ship the artifact; iterate against feedback rather than in private.
