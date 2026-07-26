---
name: progressive-delivery
description: Implement progressive delivery strategies including canary releases, feature flags, and traffic splitting. Outputs deployment pipeline, rollout configuration, automated rollback triggers, and observability requirements.
argument-hint: [deployment platform, traffic volume, rollback SLA, feature flag tooling]
allowed-tools: Read, Write
---

# Progressive Delivery

Progressive delivery releases changes to a subset of users first, measures impact, and expands or rolls back based on data. It separates deployment (code goes to production) from release (users get the feature). This reduces risk, enables data-driven decisions, and eliminates the big-bang release.

## Delivery Techniques

```
DARK LAUNCH
  Deploy code but route 0% traffic to new path
  Validate infrastructure and dependencies
  No user impact

CANARY RELEASE
  Route 1-5% traffic to new version
  Compare error rates, latency, business metrics
  Expand gradually if healthy; rollback if not

FEATURE FLAGS
  Decouple code deployment from feature exposure
  Target specific users, accounts, or % of population
  Instant rollback without redeployment

A/B TESTING
  Split traffic between control and variant
  Measure business impact (conversion, engagement)
  Statistical significance before deciding
```

## Argo Rollouts — Canary

```yaml
# argo-rollouts canary deployment
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: api-service
spec:
  replicas: 10
  strategy:
    canary:
      steps:
        - setWeight: 5    # 5% to canary
        - pause: {}       # Manual gate (or automated with analysis)
        - setWeight: 20
        - pause: {duration: 10m}
        - setWeight: 50
        - pause: {duration: 10m}
        - setWeight: 100  # Full rollout

      # Automated analysis before each step
      analysis:
        templates:
          - templateName: error-rate-check
        startingStep: 1

---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: error-rate-check
spec:
  metrics:
    - name: error-rate
      interval: 1m
      successCondition: result[0] < 0.01  # <1% error rate
      failureLimit: 3
      provider:
        prometheus:
          address: http://prometheus:9090
          query: |
            sum(rate(http_requests_total{status=~"5.*",version="{{args.version}}"}[5m]))
            /
            sum(rate(http_requests_total{version="{{args.version}}"}[5m]))
    
    - name: p99-latency
      interval: 1m
      successCondition: result[0] < 0.5  # <500ms p99
      failureLimit: 3
      provider:
        prometheus:
          query: |
            histogram_quantile(0.99,
              rate(http_request_duration_seconds_bucket{version="{{args.version}}"}[5m])
            )
```

## Feature Flag Progressive Rollout

```python
from launchdarkly import LDClient

ld = LDClient(sdk_key=os.environ["LD_SDK_KEY"])

# Progressive rollout rule in LaunchDarkly:
# Stage 1: Internal users only (0% of customers)
# Stage 2: Beta users (opted-in customers)
# Stage 3: 1% of all users
# Stage 4: 10% → 25% → 50% → 100%

def new_checkout_enabled(user_id: str, account_id: str) -> bool:
    return ld.variation("checkout-v2", {
        "key": user_id,
        "custom": {
            "account_id": account_id,
            "is_beta": is_beta_user(user_id),
            "is_internal": is_internal_user(user_id),
        }
    }, default=False)

# Automated rollout with metrics check
async def advance_rollout_if_healthy(flag_key: str, current_pct: int) -> int:
    """Advance rollout only if metrics are healthy."""
    metrics = await get_rollout_metrics(flag_key)
    
    if metrics["error_rate"] > 0.01:
        await alert(f"Rollout {flag_key} paused: error rate {metrics['error_rate']:.1%}")
        return current_pct  # Don't advance
    
    if metrics["p99_latency_ms"] > 500:
        await alert(f"Rollout {flag_key} paused: p99 latency {metrics['p99_latency_ms']}ms")
        return current_pct
    
    # Advance to next tier
    next_pct = {1: 5, 5: 10, 10: 25, 25: 50, 50: 100}.get(current_pct, 100)
    await ld.update_rollout_percentage(flag_key, next_pct)
    return next_pct
```

## Rollback Triggers

```markdown
## Automatic Rollback Conditions

Trigger immediate rollback if ANY of:
- Error rate > 1% (sustained 5 minutes)
- p99 latency > 2× baseline (sustained 5 minutes)  
- Any critical business metric anomaly (payment failure rate, checkout completion)
- Any P1 incident attributed to this release

## Rollback SLA
- Detection: < 2 minutes (automated metric check)
- Decision: < 5 minutes (automated or on-call engineer)
- Rollback execution: < 5 minutes (automated revert)
- Total: < 12 minutes from incident to rollback complete
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No automated analysis** | Manual review misses subtle regressions | Automated metric checks before each canary step |
| **Big jump percentages** | 0% → 50% → 100% skips early signals | Small increments: 1% → 5% → 20% → 50% → 100% |
| **Only technical metrics** | Low error rate but conversion drops | Include business metrics in analysis |
| **Feature flags never cleaned up** | Flag proliferation; dead code | Every flag has a target full-rollout date when created |
| **Canary without baseline** | Nothing to compare against | Always compare canary vs stable version in same window |

## 10 Rules

1. Deploy to production at 0% traffic before any customer sees it — dark launch validates infrastructure.
2. Small canary increments: 1% → 5% → 20% → 50% → 100% with analysis at each step.
3. Automated analysis gates every canary step — no manual approval required for healthy releases.
4. Rollback is automatic when error rate or latency thresholds are breached.
5. Business metrics are in the analysis — not just infrastructure metrics.
6. Feature flags are the rollback for feature releases — no redeployment needed.
7. Every feature flag has a removal date — flag debt accumulates like technical debt.
8. Canary and stable versions are compared in the same time window — not historically.
9. Document rollback runbooks before launch — not during incidents.
10. Progressive delivery requires good observability — without metrics, it's just slow deployment.

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

The canonical workflow for **Progressive Delivery** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Implement progressive delivery strategies including canary releases, feature flags, and traffic splitting. Outputs deployment pipeline, rollout configuration, a
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
