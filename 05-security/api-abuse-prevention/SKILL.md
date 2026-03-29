---
name: api-abuse-prevention
description: Detect and prevent API abuse including credential stuffing, scraping, account takeover, and business logic abuse. Outputs detection rules, rate limiting strategy, bot fingerprinting, and incident response playbook.
argument-hint: [API type, abuse vectors, traffic volume, risk tolerance, existing tooling]
allowed-tools: Read, Write
---

# API Abuse Prevention

API abuse ranges from automated credential stuffing and scraping to sophisticated business logic attacks. Unlike traditional security vulnerabilities, abuse exploits valid functionality — authentication endpoints, search APIs, pricing endpoints — at scale. Prevention requires layered controls: rate limiting, behavioural analysis, and friction.

## Abuse Categories and Signals

```
CREDENTIAL STUFFING
  Pattern: High volume login attempts from many IPs; low success rate
  Signals: >10 failed logins from IP; IP in known breach lists; unusual UA
  Mitigation: Rate limit + CAPTCHA + MFA + password breach detection

ACCOUNT TAKEOVER
  Pattern: Login from new location after credential stuffing success
  Signals: New device/IP post-login; immediate sensitive action; bulk export
  Mitigation: Device fingerprinting; step-up auth on anomaly; fraud scoring

SCRAPING
  Pattern: High volume GET requests; no referrer; sequential IDs
  Signals: Requests too fast for humans; no JS execution; systematic patterns
  Mitigation: Rate limit; bot fingerprinting; content watermarking

BUSINESS LOGIC ABUSE
  Pattern: Exploiting pricing, discounts, referral bonuses
  Signals: Same IP/device creates many accounts; referral loops; promo code cycling
  Mitigation: Velocity checks; device fingerprinting; coupon limits

DENIAL OF WALLET
  Pattern: Triggering expensive operations (AI, SMS, email) at scale
  Signals: High per-user cost; automated patterns; no human behaviour
  Mitigation: Per-user quotas; cost-aware rate limits; anomaly detection
```

## Rate Limiting by Abuse Vector

```python
import redis.asyncio as aioredis
import time
import hashlib
from fastapi import Request, HTTPException

redis = aioredis.Redis(host="redis", port=6379, decode_responses=True)

class AbusePreventionMiddleware:
    """Layered rate limiting per endpoint type."""

    LIMITS = {
        # (window_seconds, max_attempts, scope)
        "login":           (300, 10,   "ip"),      # 10 logins per 5min per IP
        "login_user":      (3600, 20,  "user"),     # 20 logins per hour per user
        "password_reset":  (3600, 5,   "ip"),       # 5 resets per hour per IP
        "register":        (3600, 3,   "ip"),       # 3 signups per hour per IP
        "search":          (60,   30,  "user"),     # 30 searches per minute per user
        "bulk_export":     (86400, 2,  "user"),     # 2 bulk exports per day per user
        "api_global":      (60,   100, "api_key"),  # 100 requests per minute per key
    }

    async def check(self, endpoint_type: str, request: Request,
                    user_id: str = None, api_key: str = None) -> None:
        if endpoint_type not in self.LIMITS:
            return

        window, max_attempts, scope = self.LIMITS[endpoint_type]

        if scope == "ip":
            key_suffix = self._get_ip(request)
        elif scope == "user" and user_id:
            key_suffix = user_id
        elif scope == "api_key" and api_key:
            key_suffix = hashlib.sha256(api_key.encode()).hexdigest()[:16]
        else:
            return

        now = int(time.time())
        window_start = now - window
        bucket_key = f"abuse:{endpoint_type}:{scope}:{key_suffix}:{now // window}"

        count = await redis.incr(bucket_key)
        await redis.expire(bucket_key, window)

        if count > max_attempts:
            # Log for analysis
            await self._log_abuse(endpoint_type, scope, key_suffix, count)
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "rate_limit_exceeded",
                    "retry_after": window - (now % window),
                },
                headers={"Retry-After": str(window - (now % window))},
            )

    def _get_ip(self, request: Request) -> str:
        # Trust X-Forwarded-For only from known proxies
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            ip = forwarded.split(",")[0].strip()
            return hashlib.sha256(ip.encode()).hexdigest()[:16]  # Hash for privacy
        return hashlib.sha256(request.client.host.encode()).hexdigest()[:16]

    async def _log_abuse(self, endpoint_type: str, scope: str,
                          key: str, count: int):
        import structlog
        structlog.get_logger("abuse").warning(
            "rate_limit_triggered",
            endpoint=endpoint_type, scope=scope,
            key_hash=key[:8], count=count,
        )
```

## Credential Stuffing Detection

```python
class CredentialStuffingDetector:
    """Detects automated login attacks via multi-signal analysis."""

    async def evaluate_login_attempt(
        self, request: Request, email: str, success: bool
    ) -> dict:
        ip = self._get_real_ip(request)
        ua = request.headers.get("User-Agent", "")

        signals = []
        risk_score = 0

        # Signal 1: IP failure rate (last 5 min)
        ip_failures = int(await redis.get(f"login_failures:ip:{ip}") or 0)
        if ip_failures > 5:
            signals.append("high_ip_failure_rate")
            risk_score += 30

        # Signal 2: Global failure rate for this email (ATO signal)
        email_hash = hashlib.sha256(email.lower().encode()).hexdigest()[:16]
        email_failures = int(await redis.get(f"login_failures:email:{email_hash}") or 0)
        if email_failures > 10:
            signals.append("high_email_failure_rate")
            risk_score += 40

        # Signal 3: Known bad IP reputation
        if await self._check_ip_reputation(ip):
            signals.append("ip_in_blocklist")
            risk_score += 50

        # Signal 4: Suspicious User-Agent
        if self._is_suspicious_ua(ua):
            signals.append("suspicious_user_agent")
            risk_score += 20

        # Signal 5: Request too fast (no human types that quickly)
        last_request = await redis.get(f"last_request:{ip}")
        if last_request and (time.time() - float(last_request)) < 0.5:
            signals.append("request_too_fast")
            risk_score += 30

        await redis.setex(f"last_request:{ip}", 60, str(time.time()))

        if not success:
            await redis.incr(f"login_failures:ip:{ip}")
            await redis.expire(f"login_failures:ip:{ip}", 300)
            await redis.incr(f"login_failures:email:{email_hash}")
            await redis.expire(f"login_failures:email:{email_hash}", 3600)

        return {
            "risk_score": risk_score,
            "signals": signals,
            "action": "block" if risk_score >= 70 else "challenge" if risk_score >= 40 else "allow",
        }

    def _is_suspicious_ua(self, ua: str) -> bool:
        suspicious = ["python-requests", "curl/", "wget/", "Go-http-client",
                       "libwww-perl", "Java/", "axios/", "node-fetch"]
        return any(s.lower() in ua.lower() for s in suspicious)

    async def _check_ip_reputation(self, ip: str) -> bool:
        # Query AbuseIPDB, Cloudflare, or your own blocklist
        return await abuseipdb.check(ip, confidence_threshold=75)
```

## Bot Fingerprinting

```javascript
// Client-side: collect signals for server-side bot scoring
// (Send in request headers or body alongside the API call)

const collectBotSignals = async () => {
  return {
    // Browser capability signals
    webgl: !!document.createElement('canvas').getContext('webgl'),
    canvas_fingerprint: getCanvasFingerprint(),
    screen: { width: screen.width, height: screen.height, depth: screen.colorDepth },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    languages: navigator.languages,
    platform: navigator.platform,

    // Behavioural signals
    mouse_move_events: window._mouseMoveCount || 0,
    key_events: window._keyEventCount || 0,
    scroll_events: window._scrollCount || 0,
    time_on_page_ms: Date.now() - window._pageLoadTime,

    // Automation detection
    webdriver: navigator.webdriver,
    plugins_count: navigator.plugins.length,
  };
};

// Server-side: score the signals
// Low mouse events + fast submission + webdriver=true = bot
```

## Abuse Incident Response

```markdown
## Playbook: Credential Stuffing Attack

Detection: >500 failed logins/min from distributed IPs

Step 1 (0-5 min): Triage
  - Check Datadog: login failure rate, affected accounts, IP distribution
  - Determine scope: how many IPs? how many accounts targeted?

Step 2 (5-15 min): Immediate Mitigation
  - Enable CAPTCHA on login page (feature flag: login_captcha=true)
  - Block top 100 attacking IPs (WAF rule)
  - Page security on-call if scope >1000 IPs

Step 3 (15-60 min): Deeper Response
  - Run query: accounts with >3 failures in 1h → force password reset
  - Add rule to WAF: block IPs with >20 login attempts/min globally
  - Check if any accounts successfully compromised (new IP post-success)

Step 4 (Post-incident):
  - Report: accounts targeted, % compromised, IPs blocked
  - Update blocklist with new IP ranges
  - Review: should MFA be mandatory for all accounts?
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Rate limiting only by IP** | Distributed attacks use many IPs | Multi-dimensional: IP + user + device + global |
| **CAPTCHA on all requests** | Friction kills conversion | Risk-based CAPTCHA: only trigger on high-risk signals |
| **Blocking without logging** | Can't analyse attack patterns | Log all blocks with full signal data |
| **No velocity checks on business logic** | Promo abuse, referral fraud invisible | Apply velocity checks to business-value endpoints |
| **Trusting X-Forwarded-For blindly** | Attackers spoof headers to bypass IP limits | Only trust from known proxy IPs |

## 10 Rules

1. Rate limit every endpoint — auth endpoints get the strictest limits.
2. Multi-dimensional rate limiting: IP + user + API key + global — attackers rotate IPs.
3. Risk-score login attempts — block high-risk, challenge medium-risk, allow low-risk.
4. Never rate-limit by IP alone for credential stuffing — distributed attacks bypass it.
5. Log every abuse signal — you need the data to tune thresholds and investigate.
6. CAPTCHA should be risk-triggered, not universal — universal CAPTCHA kills legitimate UX.
7. Blocklists expire — review and prune regularly to avoid blocking legitimate users.
8. Monitor business metrics for abuse — sudden spikes in promo usage or referrals signal fraud.
9. Incident response playbooks exist before attacks happen — write them now.
10. Share abuse intelligence with your WAF/CDN — block at the edge before traffic hits your servers.
