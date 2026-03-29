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
