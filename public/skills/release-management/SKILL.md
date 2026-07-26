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

The canonical workflow for **Release Management** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Design a release management process for coordinated, low-risk software releases. Outputs release workflow, change approval process, rollback procedures, and com
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
