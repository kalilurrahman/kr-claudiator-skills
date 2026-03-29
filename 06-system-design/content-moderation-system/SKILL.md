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
