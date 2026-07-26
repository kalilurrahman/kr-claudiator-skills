---
name: monorepo-management
description: Structure and manage monorepos with multiple packages or services. Outputs workspace configuration, build pipeline, dependency graph, code ownership rules, and CI optimisation strategy.
argument-hint: [language ecosystem, number of packages, team size, CI system]
allowed-tools: Read, Write, Bash
---

# Monorepo Management

A monorepo houses multiple packages or services in one repository. Atomic cross-package changes, shared tooling, and unified CI are the wins. The cost is build times and tooling complexity. The answer is build caching, affected-only CI, and explicit dependency management.

## Process

1. **Choose tooling.** Turborepo (JS/TS), Nx (JS/TS with plugins), Bazel (polyglot, large scale), Pants (Python), Gradle multi-project (JVM).
2. **Define workspace structure.** Separate apps, packages (libraries), and infrastructure. Clear naming conventions.
3. **Declare dependencies explicitly.** Every package lists its dependencies. No implicit cross-package imports.
4. **Configure build pipeline.** Task graph: build depends on lint + type-check; test depends on build; deploy depends on test.
5. **Enable caching.** Local cache first, remote cache for CI sharing. Cache keys based on inputs, not time.
6. **Set up affected-only CI.** Only run pipelines for packages changed by a PR. Use dependency graph to include transitively affected packages.
7. **Define code ownership.** CODEOWNERS file per package. Reviews required from owning team.
8. **Version strategy.** Independent versions per package (semver) or fixed/unified versioning.

## Directory Structure

```
monorepo/
├── apps/                          # Deployable applications
│   ├── api/                       # REST API service
│   ├── web/                       # Frontend app
│   └── worker/                    # Background job processor
├── packages/                      # Shared libraries
│   ├── ui/                        # Design system components
│   ├── auth/                      # Authentication library
│   ├── database/                  # DB client + migrations
│   ├── config/                    # Shared configuration
│   └── types/                     # Shared TypeScript types
├── tools/                         # Internal tooling
│   ├── eslint-config/
│   └── tsconfig/
├── infrastructure/                # IaC
│   ├── terraform/
│   └── k8s/
├── turbo.json                     # Turborepo config
├── pnpm-workspace.yaml            # Workspace definition
├── package.json
└── .github/
    ├── CODEOWNERS
    └── workflows/
```

## Turborepo Configuration

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env", "tsconfig.base.json"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],        // ^ = run dependencies first
      "outputs": ["dist/**", ".next/**"],
      "cache": true
    },
    "lint": {
      "outputs": [],
      "cache": true
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": [],
      "cache": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "cache": true,
      "env": ["CI", "NODE_ENV"]
    },
    "test:e2e": {
      "dependsOn": ["^build"],
      "cache": false                  // E2E tests not cached
    },
    "deploy": {
      "dependsOn": ["build", "test"],
      "cache": false                  // Deployments never cached
    },
    "dev": {
      "cache": false,
      "persistent": true             // Long-running dev servers
    }
  },
  "remoteCache": {
    "enabled": true
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'tools/*'
```

```json
// packages/auth/package.json
{
  "name": "@company/auth",
  "version": "1.4.2",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "lint": "eslint src/",
    "test": "vitest run",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "jsonwebtoken": "^9.0.0"
  },
  "devDependencies": {
    "@company/tsconfig": "workspace:*"
  },
  "peerDependencies": {
    "typescript": ">=5.0"
  }
}
```

## Nx Configuration (Alternative)

```json
// nx.json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "lint", "test", "type-check"],
        "remoteCache": { "enabled": true }
      }
    }
  },
  "targetDefaults": {
    "build": { "dependsOn": ["^build"] },
    "test":  { "dependsOn": ["build"] }
  },
  "affected": {
    "defaultBase": "main"
  }
}
```

## CI — Affected-Only Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  affected:
    runs-on: ubuntu-latest
    outputs:
      apps: ${{ steps.affected.outputs.apps }}
      packages: ${{ steps.affected.outputs.packages }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0          # Full history for affected calculation

      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Determine affected packages
        id: affected
        run: |
          AFFECTED=$(pnpm turbo run build --dry-run=json --filter='...[origin/main]' | jq -r '.packages[]')
          echo "apps=$(echo $AFFECTED | jq -R -s 'split(" ") | map(select(startswith("@company/app")))' -c)" >> $GITHUB_OUTPUT
          echo "packages=$(echo $AFFECTED | jq -R -s 'split(" ")' -c)" >> $GITHUB_OUTPUT

  lint-and-typecheck:
    needs: affected
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - name: Lint affected
        run: pnpm turbo run lint type-check --filter='...[origin/main]'

  test:
    needs: lint-and-typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - name: Test affected
        run: pnpm turbo run test --filter='...[origin/main]'
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run build --filter='...[origin/main]'
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

## CODEOWNERS

```
# .github/CODEOWNERS
# Default owners for everything
*                           @company/platform-team

# App ownership
/apps/api/                  @company/backend-team
/apps/web/                  @company/frontend-team
/apps/worker/               @company/backend-team

# Package ownership
/packages/ui/               @company/design-system-team
/packages/auth/             @company/security-team
/packages/database/         @company/platform-team

# Infrastructure
/infrastructure/            @company/infra-team

# CI/CD changes require platform approval
/.github/                   @company/platform-team
/turbo.json                 @company/platform-team
/pnpm-workspace.yaml        @company/platform-team
```

## Dependency Graph Management

```bash
# Visualise dependency graph (Turborepo)
pnpm turbo run build --graph

# Find what packages depend on a given package
pnpm turbo run build --filter='...^@company/auth'

# Run command in specific package and its dependencies
pnpm turbo run test --filter='@company/api...'

# List all affected packages since main
pnpm turbo run build --dry-run --filter='...[origin/main]'

# Nx dependency graph (interactive)
npx nx graph

# Check for circular dependencies
npx madge --circular --extensions ts apps/ packages/
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Implicit cross-package imports** | Bypasses declared dependencies; breaks build | Import only from published package entry points |
| **No remote cache** | Every CI run rebuilds from scratch | Set up Turborepo Remote Cache or Nx Cloud |
| **Running all tests on every PR** | CI takes 30min+ | Affected-only pipeline |
| **Shared mutable global config** | One package's change breaks others silently | Explicit config per package; extend shared base |
| **Circular dependencies** | Build order undefined, tests unreliable | Enforce with madge in CI |
| **No CODEOWNERS** | PRs merge without domain expert review | CODEOWNERS + required reviews per directory |
| **Versioning confusion** | Mixed independent/unified versioning | Choose one; use Changesets for independent semver |

## 10 Rules

1. Every package is independently buildable with its explicit dependencies only.
2. Remote cache is mandatory in CI — local-only cache gives no CI speedup.
3. Affected-only CI is a requirement, not an optimisation, past 10 packages.
4. No circular dependencies — enforce with automated detection in CI.
5. Package boundaries = team ownership boundaries. Align with CODEOWNERS.
6. Shared packages are products — breaking changes require migration guides and version bumps.
7. Dev scripts run concurrently with watch mode — `turbo run dev` should start everything needed.
8. Pin internal package versions with `workspace:*` — never use path imports across packages.
9. Cache keys must include all inputs — env vars, config files, lock files. Missed inputs cause stale caches.
10. Monorepo doesn't mean monolith — packages must have clear boundaries, separate deployable artifacts, and independent test suites.
