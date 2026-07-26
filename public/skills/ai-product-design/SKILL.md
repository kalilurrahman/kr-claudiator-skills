---
name: ai-product-design
description: Design AI-powered products that are useful, trustworthy, and safe. Outputs capability-first design process, failure mode analysis, human-in-the-loop patterns, and evaluation framework.
argument-hint: [product type, user sophistication, risk tolerance, regulatory context]
allowed-tools: Read, Write
---

# AI Product Design

AI products fail differently from traditional software. They fail probabilistically, fail on unexpected inputs, and can fail silently in ways users don't notice. Good AI product design accounts for model limitations, builds appropriate user trust, designs effective human-in-the-loop patterns, and evaluates the full failure surface.

## Design Process

```
1. START WITH THE JOB — what is the user trying to accomplish?
   AI is a means, not an end. Define success in user outcome terms.

2. CAPABILITY INVENTORY — what can the model actually do reliably?
   Run adversarial tests. Know the failure modes before designing around them.

3. DESIGN THE LOOP — where does the human stay in control?
   High-stakes decisions: AI suggests, human decides.
   Low-stakes, reversible: AI acts, human can undo.
   Irreversible, high-impact: human must confirm.

4. DESIGN FOR FAILURE — what happens when the AI is wrong?
   Error recovery paths. Graceful degradation. User feedback mechanisms.

5. BUILD TRUST CALIBRATION — users should trust AI appropriately.
   Not over-trust (accept everything) or under-trust (ignore everything).
   Transparent uncertainty. Explainable reasoning.

6. MEASURE OUTCOMES — not just accuracy, but user outcomes.
   Did using the AI feature help users accomplish the job faster/better?
```

## Human-in-the-Loop Patterns

```markdown
## Pattern 1: Suggestion + Confirmation
Use when: Action has side effects; mistakes are costly but recoverable.
Example: AI drafts email → user reviews → user sends.

UI pattern:
  [AI Suggestion] → [Edit] [Send as-is] [Discard]
  Show confidence: "High confidence suggestion" vs "Best guess"

## Pattern 2: AI-First with Undo
Use when: Action is low-stakes; speed matters; mistakes are easily reversible.
Example: AI autocategorises expense → user can recategorise.

UI pattern:
  AI applies action immediately → toast notification "Categorised as Travel"
  → [Undo] button visible for 30 seconds

## Pattern 3: Parallel Human + AI
Use when: AI assists but human expertise is required.
Example: AI flags suspicious transactions → human investigator reviews flagged items.

UI pattern:
  AI scores/filters → human reviews high-confidence flags → human makes decision
  Record human decisions to improve model

## Pattern 4: AI as Copilot
Use when: Complex task requiring expertise; AI augments but doesn't replace.
Example: AI code completion, AI writing assistant.

UI pattern:
  Human drives; AI offers inline suggestions → human accepts/rejects/modifies
  No automatic application; explicit accept step
```

## Confidence and Uncertainty

```python
# Show confidence appropriately — not always as a number
def confidence_to_ui_signal(confidence: float) -> dict:
    if confidence >= 0.95:
        return {"label": "High confidence", "icon": "✓", "style": "primary"}
    elif confidence >= 0.80:
        return {"label": "Review suggested", "icon": "⚠", "style": "warning"}
    else:
        return {"label": "Uncertain — please verify", "icon": "?", "style": "caution"}

# Uncertainty language in AI responses
UNCERTAINTY_PREFIXES = {
    "high":   "",                                  # State directly
    "medium": "Based on available information, ",
    "low":    "I'm not certain, but ",
    "none":   "I don't have enough information to ",
}

# Never claim certainty the model doesn't have
# Never say "I don't know" without pointing to next steps
```

## Failure Mode Analysis

```markdown
## AI Product Failure Mode Analysis Template

### Feature: [AI feature name]
### Capability: [What the AI does]

| Failure Mode | Likelihood | Impact | Detection | Mitigation |
|---|---|---|---|---|
| Hallucination (false facts) | Medium | High | User may not notice | Source citations; verify mode |
| Off-distribution input | High | Medium | Model may be overconfident | Confidence threshold; fallback to human |
| Adversarial input | Low | High | Not detected by model | Input validation; rate limiting |
| Bias in outputs | Medium | High | Only via evaluation | Bias testing; diverse eval set |
| Outdated knowledge | High | Medium | Model doesn't flag this | Knowledge cutoff disclosure; search integration |

### Safeguards
- Confidence threshold: route low-confidence to human review
- Output filters: post-process for safety violations
- Feedback loop: users can flag bad outputs
- Monitoring: track output patterns for drift
```

## Evaluation Framework

```python
# Beyond accuracy — measure what matters for users
evaluation_criteria = {
    "task_completion": "Did the user accomplish their goal using the AI feature?",
    "time_to_completion": "Is the AI feature faster than the baseline (no AI)?",
    "error_rate": "Do users make more/fewer errors with AI assistance?",
    "trust_calibration": "Do users know when to trust/verify AI outputs?",
    "satisfaction": "Do users prefer the AI-assisted experience?",
    "safety": "Does the AI ever produce harmful or misleading outputs?",
}

# A/B test structure for AI features
ab_test = {
    "control": "Original experience (no AI)",
    "variant": "AI-assisted experience",
    "primary_metric": "task_completion_rate",
    "guardrail_metrics": ["error_rate", "safety_violations", "user_reported_issues"],
    "analysis": "Compare both task completion AND error introduction",
}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **AI for everything** | AI where rule-based is sufficient wastes resources | AI only where probabilistic intelligence adds value |
| **No fallback path** | AI failure = product failure | Graceful degradation to non-AI experience |
| **Hiding uncertainty** | Users over-trust; miss important caveats | Show confidence; use uncertainty language |
| **No feedback mechanism** | Bad AI outputs persist | Easy way for users to flag wrong outputs |
| **Evaluating only accuracy** | High accuracy ≠ good user outcome | Measure user task completion, not just model metrics |
| **Automating irreversible actions** | Mistakes can't be undone | Human confirmation for high-impact, irreversible actions |

## 10 Rules

1. Start with the user job, not the AI capability — what does success look like for the user?
2. Design for the 10% of cases where the AI is wrong — not just the 90% where it's right.
3. High-stakes irreversible actions require human confirmation — no exceptions.
4. Show uncertainty appropriately — calibrated trust beats both over-trust and under-trust.
5. Always have a non-AI fallback — the AI path should be an enhancement, not a dependency.
6. Users need a feedback mechanism — every wrong AI output that goes unreported is a missed improvement.
7. Test adversarial inputs before launch — red-team the AI feature, not just the happy path.
8. Measure user outcomes, not just model accuracy — a less accurate model can produce better user outcomes.
9. Explain AI decisions where stakes are high — "you were flagged because..." is better than a binary decision.
10. Launch narrow and expand — a focused AI feature with excellent quality beats a broad one with mediocre quality.

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

The canonical workflow for **Ai Product Design** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Design AI-powered products that are useful, trustworthy, and safe. Outputs capability-first design process, failure mode analysis, human-in-the-loop patterns, a
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
