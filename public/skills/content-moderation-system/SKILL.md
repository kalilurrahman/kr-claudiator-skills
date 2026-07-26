---
name: content-moderation-system
description: Design content moderation systems combining automated classification with human review. Outputs classifier pipeline, review queue architecture, appeals process, and policy enforcement design.
argument-hint: [content types, volume per day, latency requirements, accuracy targets, regulatory requirements]
allowed-tools: Read, Write
---

# Content Moderation System

Content moderation protects users from harmful content while preserving legitimate speech. The challenge is scale (billions of pieces per day), accuracy (false positives censor valid content; false negatives allow harm), and latency. No system achieves 100% accuracy — design for the correct error rate tradeoff.

## Architecture

```
Content submitted
      │
      ▼
[Automated Classifier]
      │
  ┌───┴────────────────┐
  │                    │
High confidence      Low confidence
  │                    │
Auto-action        Human Review Queue
(approve/remove)   (priority-sorted by severity)
      │                    │
      └──────┬─────────────┘
             ▼
      [Appeals Layer]
             ▼
      [Policy Enforcement]
      (strikes, suspensions, reports)
```

## Classifier Pipeline

```python
import anthropic
import json
from dataclasses import dataclass
from enum import Enum

class ModerationDecision(str, Enum):
    APPROVE      = "approve"
    REMOVE       = "remove"
    HUMAN_REVIEW = "human_review"
    ESCALATE     = "escalate"  # Immediate action (CSAM, credible threats)

@dataclass
class ModerationResult:
    content_id: str
    decision: ModerationDecision
    confidence: float
    categories: list[str]
    severity: str   # none | low | medium | high | critical
    auto_actioned: bool

client = anthropic.Anthropic()

class ContentModerator:
    AUTO_REMOVE_THRESHOLD  = 0.95
    AUTO_APPROVE_THRESHOLD = 0.90

    def moderate(self, content: str) -> ModerationResult:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            messages=[{"role": "user", "content": f"""Classify for policy violations:

Content: {content[:2000]}

Categories: hate_speech, harassment, violence, sexual, spam, misinformation, self_harm

Return JSON: {{"categories_detected": [], "severity": "none|low|medium|high|critical", "confidence": 0.0-1.0, "reasoning": ""}}"""}]
        )

        result = json.loads(response.content[0].text)
        confidence = result["confidence"]
        severity = result["severity"]
        categories = result["categories_detected"]

        if severity == "critical":
            decision, auto_actioned = ModerationDecision.ESCALATE, True
        elif confidence >= self.AUTO_REMOVE_THRESHOLD and categories:
            decision, auto_actioned = ModerationDecision.REMOVE, True
        elif confidence <= (1 - self.AUTO_APPROVE_THRESHOLD) and not categories:
            decision, auto_actioned = ModerationDecision.APPROVE, True
        else:
            decision, auto_actioned = ModerationDecision.HUMAN_REVIEW, False

        return ModerationResult(
            content_id="", decision=decision, confidence=confidence,
            categories=categories, severity=severity, auto_actioned=auto_actioned
        )
```

## Human Review Queue (Priority-Sorted)

```sql
-- Review queue ordered by severity + SLA deadline
CREATE TABLE review_queue (
    content_id     UUID PRIMARY KEY,
    severity       TEXT NOT NULL,
    priority       SMALLINT NOT NULL,  -- 0=critical, 1=high, 2=medium, 3=low
    classifier_result JSONB,
    content_preview TEXT,
    sla_deadline   TIMESTAMPTZ NOT NULL,
    status         TEXT DEFAULT 'pending',
    reviewer_id    UUID,
    reviewed_at    TIMESTAMPTZ,
    review_decision TEXT
);

CREATE INDEX ON review_queue (priority ASC, sla_deadline ASC)
    WHERE status = 'pending';

-- SLA targets by severity
-- critical: 15 minutes | high: 2 hours | medium: 8 hours | low: 24 hours
```

## Appeals Process

```python
async def handle_appeal(content_id: str, user_id: str, reason: str) -> dict:
    decision = await db.get_moderation_decision(content_id)

    # Escalate borderline cases to senior reviewer
    if decision.confidence < 0.97 and decision.severity in ["low", "medium"]:
        await queue_for_senior_review(content_id, reason)
        return {"status": "under_review", "sla": "48 hours"}

    # Critical violations not eligible for appeal
    if decision.severity == "critical":
        return {"status": "denied", "reason": "Content violated critical safety policy"}

    # Standard appeal: second human reviewer
    await queue_for_appeal_review(content_id, reason, user_id)
    return {"status": "under_review", "sla": "72 hours"}
```

## Accuracy Measurement

```python
def measure_accuracy(sample: list[dict]) -> dict:
    """Sample production decisions; compare to human gold labels."""
    tp = sum(1 for s in sample if s["auto"] == "remove" and s["human"] == "remove")
    fp = sum(1 for s in sample if s["auto"] == "remove" and s["human"] == "approve")
    fn = sum(1 for s in sample if s["auto"] == "approve" and s["human"] == "remove")
    tn = sum(1 for s in sample if s["auto"] == "approve" and s["human"] == "approve")

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall    = tp / (tp + fn) if (tp + fn) > 0 else 0
    fpr       = fp / (fp + tn) if (fp + tn) > 0 else 0  # False positive rate

    return {
        "precision": precision,  # % of removals that were correct
        "recall": recall,        # % of violations caught
        "false_positive_rate": fpr,  # % of good content incorrectly removed
    }
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Fully automated only** | False positives silence legitimate speech | Human review for uncertain cases |
| **No appeals process** | Irreversible errors; legal risk | Every removal is appealable |
| **One threshold for all content** | Spam vs violence are different risks | Category-specific confidence thresholds |
| **No accuracy measurement** | Don't know if system is working | Monthly human audit of automated decisions |
| **FIFO review queue** | Critical content waits behind low-severity | Priority queue: severity + SLA deadline |

## 10 Rules

1. Automation handles volume; humans handle accuracy — neither alone is sufficient.
2. Review queue is priority-sorted by severity and SLA — critical content reviewed in minutes.
3. Every removal is appealable — irreversible actions without appeal rights are legally risky.
4. Confidence threshold determines the human review zone — not a binary decision.
5. Measure false positive and false negative rates separately — both are real costs.
6. Critical severity content bypasses queue — immediate automated action.
7. Reviewer specialisation improves quality — hate speech experts vs spam reviewers.
8. Monthly calibration between automation and human decisions corrects drift.
9. Transparency reports build trust — publish action counts and error rates.
10. Never make moderation decisions irreversible without human review for non-critical content.

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

The canonical workflow for **Content Moderation System** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Design content moderation systems combining automated classification with human review. Outputs classifier pipeline, review queue architecture, appeals process,
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
