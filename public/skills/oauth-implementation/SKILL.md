---
name: oauth-implementation
description: Implement OAuth 2.0 and OIDC flows for user authentication and API authorisation. Outputs flow diagrams, server-side implementation, token management, and security hardening.
argument-hint: [flow type, provider, client type, scopes needed, token storage requirements]
allowed-tools: Read, Write
---

# OAuth 2.0 / OIDC Implementation

OAuth 2.0 is an authorisation framework that lets users grant third-party applications access to their resources without sharing credentials. OpenID Connect (OIDC) adds identity on top of OAuth 2.0. Implementing it correctly requires understanding which flow to use, how to handle tokens securely, and how to validate tokens on every request.

## Flow Selection

```
Authorization Code + PKCE (browser/mobile apps — RECOMMENDED)
  User → App → Auth Server → User login → App gets code → exchange for tokens
  Use when: SPA, mobile app, any public client

Authorization Code (server-side web apps)
  Same flow but with client_secret; no PKCE required
  Use when: Server-rendered web app with secret management

Client Credentials (machine-to-machine)
  Service → Auth Server (with client_id + client_secret) → access token
  Use when: Service-to-service API access; no user involved

Device Code (input-constrained devices)
  TV, IoT device → Auth Server → user approves on phone → device gets token
  Use when: CLI tools, smart TVs, IoT devices

AVOID: Implicit flow (deprecated), Resource Owner Password (grants credentials to third party)
```

## Authorization Code + PKCE (FastAPI)

```python
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import RedirectResponse
import httpx
import secrets
import hashlib
import base64
import json
from urllib.parse import urlencode

app = FastAPI()

# Config (from environment)
OAUTH_CONFIG = {
    "client_id": "your-client-id",
    "client_secret": "your-client-secret",
    "authorization_endpoint": "https://auth.example.com/oauth/authorize",
    "token_endpoint": "https://auth.example.com/oauth/token",
    "userinfo_endpoint": "https://auth.example.com/userinfo",
    "redirect_uri": "https://app.example.com/auth/callback",
    "scopes": "openid profile email",
}

def generate_pkce() -> tuple[str, str]:
    """Generate PKCE code_verifier and code_challenge."""
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode()).digest()
    ).decode().rstrip("=")
    return code_verifier, code_challenge

@app.get("/auth/login")
async def login(request: Request):
    # Generate state + PKCE
    state = secrets.token_urlsafe(32)
    code_verifier, code_challenge = generate_pkce()
    
    # Store in session (server-side — never in URL)
    request.session["oauth_state"] = state
    request.session["code_verifier"] = code_verifier
    
    params = {
        "response_type": "code",
        "client_id": OAUTH_CONFIG["client_id"],
        "redirect_uri": OAUTH_CONFIG["redirect_uri"],
        "scope": OAUTH_CONFIG["scopes"],
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    
    auth_url = f"{OAUTH_CONFIG['authorization_endpoint']}?{urlencode(params)}"
    return RedirectResponse(auth_url)

@app.get("/auth/callback")
async def callback(request: Request, code: str = None, state: str = None, error: str = None):
    if error:
        raise HTTPException(400, f"OAuth error: {error}")
    
    # Validate state (CSRF protection)
    expected_state = request.session.pop("oauth_state", None)
    if not state or state != expected_state:
        raise HTTPException(400, "Invalid state parameter — possible CSRF attack")
    
    code_verifier = request.session.pop("code_verifier", None)
    
    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            OAUTH_CONFIG["token_endpoint"],
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": OAUTH_CONFIG["redirect_uri"],
                "client_id": OAUTH_CONFIG["client_id"],
                "client_secret": OAUTH_CONFIG["client_secret"],
                "code_verifier": code_verifier,  # PKCE verification
            },
        )
    
    if token_response.status_code != 200:
        raise HTTPException(400, f"Token exchange failed: {token_response.text}")
    
    tokens = token_response.json()
    access_token = tokens["access_token"]
    refresh_token = tokens.get("refresh_token")
    id_token = tokens.get("id_token")
    
    # Validate ID token
    user_claims = validate_id_token(id_token)
    
    # Store tokens securely (server-side session)
    request.session["user_id"] = user_claims["sub"]
    request.session["access_token"] = access_token  # Short-lived; OK in session
    if refresh_token:
        # Store refresh token server-side (NOT in browser storage)
        await store_refresh_token(user_claims["sub"], refresh_token)
    
    return RedirectResponse("/dashboard")
```

## Token Validation

```python
import jwt
from jwt import PyJWKClient

JWKS_CLIENT = PyJWKClient("https://auth.example.com/.well-known/jwks.json")

def validate_id_token(id_token: str, nonce: str = None) -> dict:
    """Validate OIDC ID token signature and claims."""
    # Get public key from JWKS endpoint
    signing_key = JWKS_CLIENT.get_signing_key_from_jwt(id_token)
    
    claims = jwt.decode(
        id_token,
        signing_key.key,
        algorithms=["RS256"],
        audience=OAUTH_CONFIG["client_id"],
        options={"require": ["exp", "iat", "sub", "aud", "iss"]},
    )
    
    # Validate issuer
    expected_issuer = "https://auth.example.com"
    if claims["iss"] != expected_issuer:
        raise ValueError(f"Invalid issuer: {claims['iss']}")
    
    # Validate nonce (if used for CSRF protection in implicit flow)
    if nonce and claims.get("nonce") != nonce:
        raise ValueError("Nonce mismatch")
    
    return claims

# Dependency for protected endpoints
from fastapi import Depends

async def get_current_user(request: Request) -> dict:
    """Extract and validate user from request."""
    user_id = request.session.get("user_id")
    access_token = request.session.get("access_token")
    
    if not user_id or not access_token:
        raise HTTPException(401, "Not authenticated")
    
    # Validate access token with auth server
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            OAUTH_CONFIG["userinfo_endpoint"],
            headers={"Authorization": f"Bearer {access_token}"},
        )
    
    if resp.status_code == 401:
        # Token expired — attempt refresh
        return await refresh_and_retry(user_id, request)
    
    if resp.status_code != 200:
        raise HTTPException(401, "Token invalid")
    
    return resp.json()
```

## Token Refresh

```python
async def refresh_and_retry(user_id: str, request: Request) -> dict:
    """Attempt to refresh access token using stored refresh token."""
    refresh_token = await get_stored_refresh_token(user_id)
    if not refresh_token:
        raise HTTPException(401, "Session expired — please log in again")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            OAUTH_CONFIG["token_endpoint"],
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": OAUTH_CONFIG["client_id"],
                "client_secret": OAUTH_CONFIG["client_secret"],
            },
        )
    
    if response.status_code != 200:
        # Refresh failed — revoke session and force re-login
        await revoke_session(user_id)
        raise HTTPException(401, "Session expired — please log in again")
    
    tokens = response.json()
    new_access_token = tokens["access_token"]
    
    # Rotate refresh token if provided (refresh token rotation)
    if "refresh_token" in tokens:
        await store_refresh_token(user_id, tokens["refresh_token"])
        await revoke_old_refresh_token(refresh_token)
    
    request.session["access_token"] = new_access_token
    
    # Retry userinfo with new token
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            OAUTH_CONFIG["userinfo_endpoint"],
            headers={"Authorization": f"Bearer {new_access_token}"},
        )
    return resp.json()
```

## Client Credentials (M2M)

```python
# Service-to-service authentication
import asyncio
from datetime import datetime, timedelta

class M2MTokenManager:
    """Manages client credentials tokens with automatic refresh."""
    
    def __init__(self, client_id: str, client_secret: str, token_endpoint: str,
                 scopes: str):
        self._client_id = client_id
        self._client_secret = client_secret
        self._token_endpoint = token_endpoint
        self._scopes = scopes
        self._token = None
        self._expires_at = None
        self._lock = asyncio.Lock()
    
    async def get_token(self) -> str:
        async with self._lock:
            # Return cached token if still valid (with 60s buffer)
            if self._token and datetime.utcnow() < self._expires_at - timedelta(seconds=60):
                return self._token
            
            await self._fetch_token()
            return self._token
    
    async def _fetch_token(self):
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self._token_endpoint,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                    "scope": self._scopes,
                },
            )
        
        response.raise_for_status()
        data = response.json()
        self._token = data["access_token"]
        expires_in = data.get("expires_in", 3600)
        self._expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

# Usage in service client
token_manager = M2MTokenManager(
    client_id=os.environ["SERVICE_CLIENT_ID"],
    client_secret=os.environ["SERVICE_CLIENT_SECRET"],
    token_endpoint="https://auth.example.com/oauth/token",
    scopes="inventory:read inventory:write",
)

async def call_inventory_api(product_id: str) -> dict:
    token = await token_manager.get_token()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://inventory-api.internal/products/{product_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
    resp.raise_for_status()
    return resp.json()
```

## Security Checklist

```
Authorization Code + PKCE
  [ ] State parameter validated on callback (CSRF protection)
  [ ] PKCE code_verifier generated per request; S256 challenge method
  [ ] Redirect URI exactly matches registered URI (no wildcard)
  [ ] Authorization code one-time use (reject replays)
  [ ] Short authorization code TTL (1-2 minutes)

Token Security
  [ ] Access tokens short-lived (15-60 minutes)
  [ ] Refresh tokens stored server-side (NOT in localStorage)
  [ ] Refresh token rotation enabled
  [ ] ID token signature validated with JWKS
  [ ] Token audience (aud) claim validated
  [ ] Token issuer (iss) claim validated

General
  [ ] HTTPS only for all OAuth endpoints
  [ ] Client secret never exposed to browser
  [ ] Token introspection or JWKS validation on every request
  [ ] Revocation on logout
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Storing tokens in localStorage** | XSS can steal tokens | HttpOnly cookie or server-side session |
| **Skipping state parameter** | CSRF attack possible | Always generate and validate state |
| **Not validating ID token signature** | Token forgery possible | Validate signature with JWKS on every login |
| **Long-lived access tokens** | Leaked token usable for hours/days | Access token TTL: 15-60 minutes |
| **No refresh token rotation** | Stolen refresh token usable indefinitely | Rotate on each use; revoke old token |
| **Implicit flow** | Tokens in URL fragment; deprecated | Use Authorization Code + PKCE |
| **Not validating audience claim** | Token for service A accepted by service B | Always validate `aud` claim |

## 10 Rules

1. Authorization Code + PKCE is the correct flow for all browser and mobile clients.
2. State parameter is always generated and validated — it prevents CSRF attacks on the callback.
3. Access tokens belong in memory or HttpOnly cookies — never localStorage or sessionStorage.
4. Refresh tokens are stored server-side — never in the browser.
5. ID token signature is validated against JWKS on every authentication.
6. Both `aud` and `iss` claims are validated — not just the signature.
7. Access token TTL is 15-60 minutes; refresh tokens rotate on each use.
8. Client secrets never leave the server — they are not embedded in mobile apps or JavaScript.
9. Redirect URIs are exact matches — wildcard or open redirectors allow token theft.
10. Implement token revocation on logout — don't just delete the local cookie.
