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
