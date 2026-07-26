---
name: url-shortener-design
description: Design a URL shortener system at scale. Outputs encoding strategy, database schema, caching layer, analytics pipeline, and abuse prevention controls.
argument-hint: [scale requirements, analytics needs, custom domains, abuse vectors, read/write ratio]
allowed-tools: Read, Write
---

# URL Shortener Design

A URL shortener converts long URLs to short codes and redirects traffic. At scale (billions of URLs, millions of redirects/second) it becomes a distributed systems problem requiring caching, sharding, and abuse prevention.

## Scale Estimation

```
100M new URLs/day     = 1,157 writes/sec
10B redirects/day     = 115,740 reads/sec
Read:write ratio      = 100:1 — cache aggressively
5-year storage:       = 182.5B URLs * 500B = ~90TB
Short code space:     = 62^7 = 3.5 trillion unique codes
```

## Short Code Generation

```python
from string import ascii_letters, digits
import hashlib, secrets

ALPHABET = ascii_letters + digits  # 62 characters

def encode_id(n: int, length: int = 7) -> str:
    """Convert integer ID to base-62. Sequential — no collisions."""
    chars = []
    while n:
        chars.append(ALPHABET[n % 62])
        n //= 62
    while len(chars) < length:
        chars.append(ALPHABET[0])
    return "".join(reversed(chars))

def hash_url(url: str) -> str:
    """First 7 chars of MD5 in base62. Check collisions before storing."""
    n = int(hashlib.md5(url.encode()).hexdigest()[:10], 16)
    return encode_id(n, length=7)

def random_code(length: int = 7) -> str:
    """Cryptographically random — unpredictable."""
    return "".join(secrets.choice(ALPHABET) for _ in range(length))
```

## Database Schema

```sql
CREATE TABLE short_urls (
    id            BIGSERIAL PRIMARY KEY,
    short_code    VARCHAR(10) NOT NULL UNIQUE,
    long_url      TEXT NOT NULL,
    created_by    UUID,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    expires_at    TIMESTAMPTZ,
    is_active     BOOLEAN DEFAULT TRUE,
    custom_domain VARCHAR(255),    -- Branded short links
    domain_hash   VARCHAR(64)      -- Hash of destination domain for blocklist
);

CREATE INDEX ON short_urls (short_code);
CREATE INDEX ON short_urls (expires_at) WHERE expires_at IS NOT NULL;

-- Partitioned clicks table (high write volume)
CREATE TABLE clicks (
    short_code  VARCHAR(10) NOT NULL,
    clicked_at  TIMESTAMPTZ DEFAULT NOW(),
    ip_hash     VARCHAR(64),      -- SHA-256 of IP (GDPR-safe)
    country     VARCHAR(2),
    device_type VARCHAR(20)
) PARTITION BY RANGE (clicked_at);

-- Monthly partitions for efficient deletion
CREATE TABLE clicks_2024_03 PARTITION OF clicks
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
```

## Redirect Service (Hot Path)

```python
from fastapi import FastAPI, Response
from fastapi.responses import RedirectResponse
import redis.asyncio as redis

app = FastAPI()
cache = redis.Redis(host="redis", port=6379, decode_responses=True)

@app.get("/{short_code}")
async def redirect(short_code: str, response: Response):
    # L1: Redis (hot short codes — microseconds)
    cached_url = await cache.get(f"url:{short_code}")
    if cached_url:
        if cached_url == "DELETED":
            response.status_code = 404
            return {"error": "Link not found"}
        await record_click_async(short_code)  # Fire-and-forget
        return RedirectResponse(url=cached_url, status_code=301)

    # L2: Database (cold miss — milliseconds)
    record = await db.fetchone(
        "SELECT long_url, expires_at, is_active FROM short_urls WHERE short_code = $1",
        [short_code]
    )

    if not record or not record["is_active"]:
        await cache.setex(f"url:{short_code}", 3600, "DELETED")
        response.status_code = 404
        return {"error": "Link not found"}

    from datetime import datetime, timezone
    if record["expires_at"] and record["expires_at"] < datetime.now(timezone.utc):
        response.status_code = 410
        return {"error": "Link expired"}

    await cache.setex(f"url:{short_code}", 3600, record["long_url"])
    await record_click_async(short_code)
    return RedirectResponse(url=record["long_url"], status_code=301)
```

## Abuse Prevention

```python
BLOCKED_DOMAINS = {"malware-site.com", "phishing.net"}
MAX_URLS_PER_USER_PER_HOUR = 100

async def validate_url(url: str, user_id: str) -> tuple[bool, str]:
    from urllib.parse import urlparse
    domain = urlparse(url).netloc.lower().removeprefix("www.")

    if domain in BLOCKED_DOMAINS:
        return False, "Domain is blocked"

    # Google Safe Browsing API
    is_safe = await safe_browsing.check(url)
    if not is_safe:
        return False, "URL flagged as malicious"

    # Rate limit
    key = f"rate:url:{user_id}:{__import__('datetime').datetime.utcnow().strftime('%Y%m%d%H')}"
    count = await cache.incr(key)
    await cache.expire(key, 3600)
    if count > MAX_URLS_PER_USER_PER_HOUR:
        return False, "Rate limit exceeded"

    return True, ""
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No Redis cache** | DB hit on every redirect; can't scale | Redis cache for hot short codes |
| **Sequential IDs as short codes** | Predictable; users enumerate all links | Hash-based or random codes |
| **No expiry for links** | Database grows forever | Default expiry + explicit long-lived option |
| **Raw IPs in analytics** | GDPR violation | Hash IPs before storage |
| **No abuse prevention** | Becomes a phishing link distributor | Domain blocklist + Safe Browsing API |

## 10 Rules

1. Redis caches the hot redirect path — 99% of traffic hits cache, not DB.
2. Base-62 encoding of sequential IDs gives short, unique codes.
3. Collision handling is required for hash-based codes — always check before inserting.
4. Click analytics writes are fire-and-forget — never block the redirect path.
5. Link expiry is mandatory — expired links return 410 Gone.
6. 301 (permanent) for most links — browsers cache, reduces server load.
7. 302 (temporary) when link targets may change — more accurate analytics.
8. Analytics table partitioned by date — efficient deletion of old data.
9. Domain blocklist + Safe Browsing API prevents phishing abuse.
10. Rate limiting per user prevents bulk link creation for spam campaigns.

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

The canonical workflow for **Url Shortener Design** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Design a URL shortener system at scale. Outputs encoding strategy, database schema, caching layer, analytics pipeline, and abuse prevention controls.
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
