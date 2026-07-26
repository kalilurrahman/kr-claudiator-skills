---
name: configuration-management
description: Design robust configuration management for applications across environments. Outputs configuration schema, validation, secret handling, feature flag integration, and change management.
argument-hint: [language, environments, secret types, feature flag needs, deployment platform]
allowed-tools: Read, Write
---

# Configuration Management

Good configuration management separates what changes between environments (config) from what doesn't (code), validates config at startup, and manages secrets separately from non-sensitive values. Bad config management is how you leak production credentials to developers and deploy to production with dev settings.

## Configuration Hierarchy

```
Priority (highest to lowest):
1. Environment variables
2. Secrets manager (AWS SSM, Vault)
3. Environment-specific config file (.env.production)
4. Default config file (.env.defaults)
5. Hardcoded defaults in code

Principle: Override at the highest needed level only.
```

## Pydantic Settings (Python)

```python
# config/settings.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, validator, SecretStr
from typing import Optional
import os

class DatabaseSettings(BaseSettings):
    url: str = Field(description="PostgreSQL connection URL")
    pool_size: int = Field(default=10, ge=1, le=100)
    max_overflow: int = Field(default=20, ge=0)
    echo: bool = Field(default=False)

class RedisSettings(BaseSettings):
    url: str = Field(default="redis://localhost:6379")
    max_connections: int = Field(default=20)

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",   # DATABASE__URL maps to database.url
        case_sensitive=False,
    )
    
    # Application
    app_name: str = "myapp"
    environment: str = Field(default="development",
                              pattern="^(development|staging|production|test)$")
    debug: bool = False
    log_level: str = Field(default="INFO",
                           pattern="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")
    
    # Infrastructure
    database: DatabaseSettings
    redis: RedisSettings
    
    # Secrets (never logged)
    secret_key: SecretStr
    stripe_api_key: SecretStr
    sendgrid_api_key: SecretStr
    
    # Feature flags
    enable_new_checkout: bool = False
    enable_beta_features: bool = False
    
    @validator("environment")
    def validate_environment(cls, v):
        return v.lower()
    
    @property
    def is_production(self) -> bool:
        return self.environment == "production"
    
    @property
    def is_development(self) -> bool:
        return self.environment == "development"

# Validate at import time — fail fast on startup
try:
    settings = Settings()
except Exception as e:
    import sys
    print(f"FATAL: Configuration error: {e}", file=sys.stderr)
    sys.exit(1)
```

## Environment Files

```bash
# .env.defaults — committed to repo (no secrets)
APP_NAME=myapp
DATABASE__POOL_SIZE=10
DATABASE__MAX_OVERFLOW=20
LOG_LEVEL=INFO
ENABLE_NEW_CHECKOUT=false

# .env.production — in secrets manager, not repo
ENVIRONMENT=production
DATABASE__URL=postgresql://user:pass@prod-db:5432/app
REDIS__URL=redis://prod-redis:6379
SECRET_KEY=<from secrets manager>
STRIPE_API_KEY=<from secrets manager>
DEBUG=false

# .env — local dev only (gitignored)
ENVIRONMENT=development
DATABASE__URL=postgresql://localhost:5432/app_dev
SECRET_KEY=dev-secret-not-for-production
STRIPE_API_KEY=sk_test_...
DEBUG=true
```

## TypeScript / Node.js Configuration

```typescript
// config/index.ts
import { z } from "zod";

const configSchema = z.object({
  environment: z.enum(["development", "staging", "production", "test"]),
  port: z.coerce.number().int().min(1).max(65535).default(3000),
  database: z.object({
    url: z.string().url(),
    poolSize: z.coerce.number().int().min(1).max(100).default(10),
  }),
  redis: z.object({
    url: z.string().default("redis://localhost:6379"),
  }),
  secrets: z.object({
    jwtSecret: z.string().min(32),
    stripeKey: z.string().startsWith("sk_"),
  }),
  features: z.object({
    newCheckout: z.coerce.boolean().default(false),
    betaFeatures: z.coerce.boolean().default(false),
  }),
});

function loadConfig() {
  const result = configSchema.safeParse({
    environment: process.env.NODE_ENV,
    port: process.env.PORT,
    database: {
      url: process.env.DATABASE_URL,
      poolSize: process.env.DATABASE_POOL_SIZE,
    },
    redis: { url: process.env.REDIS_URL },
    secrets: {
      jwtSecret: process.env.JWT_SECRET,
      stripeKey: process.env.STRIPE_API_KEY,
    },
    features: {
      newCheckout: process.env.ENABLE_NEW_CHECKOUT,
      betaFeatures: process.env.ENABLE_BETA_FEATURES,
    },
  });
  
  if (!result.success) {
    console.error("Configuration error:", result.error.format());
    process.exit(1);
  }
  
  return result.data;
}

export const config = loadConfig();
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Secrets in .env committed to repo** | Credentials leaked in git history | .env in .gitignore; secrets from secrets manager |
| **No startup validation** | Bad config discovered at runtime, not start | Validate all required config at boot; fail fast |
| **Hardcoded environment checks** | `if os.environ == "production"` scattered everywhere | Use typed config properties (`config.is_production`) |
| **Secrets in application logs** | Logs contain API keys | Use `SecretStr` / redact before logging |
| **Different code per environment** | Untested code paths reach production | Same code; different config |
| **Config in database** | Startup depends on DB; circular dependency | Env vars or files for startup config |

## 10 Rules

1. Validate all configuration at startup — a misconfigured app should not start.
2. Secrets are separate from configuration — use a secrets manager, not .env files.
3. Never commit secrets to version control — not even in gitignored files in a shared repo.
4. Use typed configuration objects — never access `os.environ["KEY"]` scattered through business logic.
5. The same code runs in all environments — only config differs.
6. Config files for non-secrets can be committed — separate dev, staging, and production files.
7. Secrets are never logged — use SecretStr or equivalent to prevent accidental logging.
8. Required config missing at startup = fatal error — clear message, immediate exit.
9. Feature flags in config allow code to ship before features are visible.
10. Config changes are deployments — treat them with the same care as code changes.

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

The canonical workflow for **Configuration Management** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Design robust configuration management for applications across environments. Outputs configuration schema, validation, secret handling, feature flag integration
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
