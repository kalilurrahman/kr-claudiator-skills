---
name: release-management
description: Design a release management process for coordinated, low-risk software releases. Outputs release workflow, change approval process, rollback procedures, and communication templates.
argument-hint: [deployment frequency, team count, regulatory requirements, current pain points]
allowed-tools: Read, Write
---

# Release Management

Release management coordinates the flow of software changes from development into production. For teams deploying multiple times per day, it's about automation and guardrails. For teams with compliance requirements, it's about evidence and approvals. Both share the goal: ship changes safely and repeatably.

## Release Process Maturity Levels

```
LEVEL 1: Scheduled releases (weekly/monthly)
  Manual approval → deploy window → rollback if issues
  Good for: regulated environments, small teams
  Risk: Big-bang deploys concentrate risk

LEVEL 2: Continuous delivery (PR merged = deployable)
  Automated pipeline → manual deploy trigger → monitoring
  Good for: most product teams
  Risk: Requires good test coverage and monitoring

LEVEL 3: Continuous deployment (PR merged = deployed)
  Fully automated → feature flags control exposure → automatic rollback
  Good for: mature teams with strong CI and observability
  Risk: Requires excellent test coverage and monitoring
```

## Release Workflow (CI/CD)

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'

jobs:
  release:
    runs-on: ubuntu-latest
    environment: production  # Requires approval in GitHub

    steps:
      - uses: actions/checkout@v4

      - name: Validate release tag
        run: |
          TAG=${GITHUB_REF#refs/tags/}
          if ! echo "$TAG" | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$'; then
            echo "Invalid tag format: $TAG"
            exit 1
          fi

      - name: Run smoke tests on staging
        run: pytest tests/smoke/ --base-url=https://api.staging.example.com

      - name: Deploy to production
        run: |
          kubectl set image deployment/api api=myapp:${GITHUB_REF#refs/tags/}
          kubectl rollout status deployment/api --timeout=5m

      - name: Verify deployment
        run: |
          sleep 30  # Let pods stabilise
          pytest tests/smoke/ --base-url=https://api.example.com

      - name: Notify team
        if: always()
        uses: slackapi/slack-github-action@v1
        with:
          channel-id: '#releases'
          payload: |
            {
              "text": "${{ job.status == 'success' && '✅' || '❌' }} Release ${{ github.ref_name }} ${{ job.status }}",
              "blocks": [{
                "type": "section",
                "text": {"type": "mrkdwn", "text": "Release `${{ github.ref_name }}` to production: *${{ job.status }}*
Diff: ${{ github.event.compare }}"}
              }]
            }
        env:
          SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
```

## Change Management (Regulated Environments)

```markdown
## Change Request Template

**Change ID:** CHG-2024-0315-001
**Requestor:** @eng-lead
**Approver:** @vp-engineering
**Type:** Standard | Emergency | Major
**Risk Level:** Low | Medium | High

### Summary
Deploy order-service v2.4.1 — fixes payment webhook timeout issue

### Changes Included
- Increase payment webhook timeout from 3s to 10s (ORD-1234)
- Fix null pointer in refund processor (ORD-1256)

### Testing Evidence
- Unit tests: 98.2% pass rate (CI pipeline: link)
- Integration tests: All passing (link)
- Staging deployment: Deployed 2024-03-14, no issues observed

### Rollback Plan
- Command: `kubectl rollout undo deployment/order-service`
- Time to rollback: < 5 minutes
- Data migration rollback: Not required (no schema changes)

### Communication Plan
- Pre-deployment: Slack #releases, 30 min notice
- Post-deployment: Slack #releases, status update
- On failure: Page on-call, use incident runbook

### Deployment Window
- When: 2024-03-15 02:00–04:00 UTC (low traffic)
- Duration: 30 minutes
- Approvals required: 1 (obtained: @vp-engineering)
```

## Release Notes Template

```markdown
## Release v2.4.1 — 2024-03-15

### What's Fixed
- **Payment webhooks**: Increased timeout from 3s to 10s, resolving 12% webhook failure rate (#ORD-1234)
- **Refund processor**: Fixed null pointer exception when refund reference is missing (#ORD-1256)

### What's Changed
- Order confirmation emails now sent within 30 seconds of placement (previously up to 5 minutes)

### Known Issues
- None

### Upgrade Notes
No action required. No schema changes or configuration updates.

### Stats
- 12 commits from 3 contributors
- 847 lines changed (+312 / -535)
- All tests passing (187 unit, 42 integration, 8 smoke)
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Manual deployments without runbook** | Different steps each time; errors in pressure | Automated pipeline; runbook for exceptions |
| **No rollback procedure** | Broken deploy stays broken | Automated rollback; tested quarterly |
| **Big-bang releases** | Large changes concentrate risk | Small, frequent deployments |
| **No smoke tests post-deploy** | Deployment "succeeds" but app is broken | Automated smoke tests after every deploy |
| **Change approval without evidence** | Rubber-stamp approvals | Test evidence required in every change request |

## 10 Rules

1. Every release is automated — no manual deployment steps in the critical path.
2. Rollback procedure is documented and tested before every release window.
3. Smoke tests run automatically after every production deployment.
4. Small releases reduce risk — a 10-line change is safer than a 1000-line change.
5. Release notes are written before deployment — not after.
6. Communication plan is part of the release — who to notify, when, and how.
7. Evidence precedes approval — test results, staging verification, impact analysis.
8. Release windows during low-traffic periods for major changes.
9. On-call engineer is paged before high-risk deployments begin.
10. Every failed deployment triggers a post-mortem within 48 hours.
