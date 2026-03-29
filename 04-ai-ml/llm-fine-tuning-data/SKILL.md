---
name: llm-fine-tuning-data
description: Prepare high-quality datasets for LLM fine-tuning. Outputs data collection strategy, formatting standards, quality filtering pipeline, deduplication, and evaluation split design.
argument-hint: [fine-tuning objective, data sources, base model, target behaviour, volume available]
allowed-tools: Read, Write, Bash
---

# LLM Fine-Tuning Data Preparation

Fine-tuning is 80% data preparation and 20% model training. The quality, format, and diversity of training data determines more about the fine-tuned model's behaviour than hyperparameter choices. Garbage in, garbage out — at scale.

## Data Requirements by Fine-Tuning Type

```
INSTRUCTION FINE-TUNING (follow specific instructions)
  Format: {"prompt": "...", "completion": "..."}
  Volume: 1,000-50,000 examples
  Key: Diversity of instruction styles and domains

CHAT FINE-TUNING (conversational style)
  Format: {"messages": [{"role": "user"}, {"role": "assistant"}, ...]}
  Volume: 5,000-100,000 conversations
  Key: Multi-turn coherence; consistent persona

DOMAIN ADAPTATION (learn domain knowledge)
  Format: Continued pre-training on domain text
  Volume: 10M-1B+ tokens
  Key: High-quality domain text; minimal noise

RLHF / DPO (align to preferences)
  Format: {"prompt": "...", "chosen": "...", "rejected": "..."}
  Volume: 10,000-100,000 preference pairs
  Key: Clear preference signal; human rater agreement
```

## Data Collection and Formatting

```python
import json
import re
from dataclasses import dataclass
from typing import Optional

@dataclass
class TrainingExample:
    prompt: str
    completion: str
    source: str
    quality_score: Optional[float] = None

def format_for_anthropic_fine_tuning(examples: list[TrainingExample]) -> list[dict]:
    """Format for Anthropic's fine-tuning API."""
    formatted = []
    for ex in examples:
        formatted.append({
            "messages": [
                {"role": "user", "content": ex.prompt},
                {"role": "assistant", "content": ex.completion},
            ]
        })
    return formatted

def format_for_openai_fine_tuning(examples: list[TrainingExample]) -> list[dict]:
    """JSONL format for OpenAI fine-tuning."""
    return [
        {
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": ex.prompt},
                {"role": "assistant", "content": ex.completion},
            ]
        }
        for ex in examples
    ]
```

## Quality Filtering Pipeline

```python
from langdetect import detect
import hashlib

class DataQualityFilter:
    def __init__(self,
                 min_prompt_tokens: int = 10,
                 max_prompt_tokens: int = 2048,
                 min_completion_tokens: int = 5,
                 min_quality_score: float = 0.7):
        self.min_prompt_tokens = min_prompt_tokens
        self.max_prompt_tokens = max_prompt_tokens
        self.min_completion_tokens = min_completion_tokens
        self.min_quality_score = min_quality_score
        self._seen_hashes = set()

    def filter(self, examples: list[TrainingExample]) -> tuple[list, dict]:
        passed, stats = [], {"total": len(examples), "removed": {}}

        for ex in examples:
            reason = self._check(ex)
            if reason:
                stats["removed"][reason] = stats["removed"].get(reason, 0) + 1
            else:
                passed.append(ex)

        stats["passed"] = len(passed)
        return passed, stats

    def _check(self, ex: TrainingExample) -> Optional[str]:
        # Length checks
        prompt_tokens = len(ex.prompt.split())
        if prompt_tokens < self.min_prompt_tokens:
            return "prompt_too_short"
        if prompt_tokens > self.max_prompt_tokens:
            return "prompt_too_long"
        if len(ex.completion.split()) < self.min_completion_tokens:
            return "completion_too_short"

        # Language check (English only)
        try:
            if detect(ex.prompt) != "en":
                return "non_english"
        except Exception:
            return "language_detection_failed"

        # Quality score threshold
        if ex.quality_score is not None and ex.quality_score < self.min_quality_score:
            return "low_quality_score"

        # Deduplication (exact match via hash)
        content_hash = hashlib.sha256(
            f"{ex.prompt.strip()}{ex.completion.strip()}".encode()
        ).hexdigest()
        if content_hash in self._seen_hashes:
            return "duplicate"
        self._seen_hashes.add(content_hash)

        # PII detection (basic)
        pii_patterns = [
            r'\d{3}-\d{2}-\d{4}',  # SSN
            r'4[0-9]{12}(?:[0-9]{3})?',  # Credit card
        ]
        for pattern in pii_patterns:
            if re.search(pattern, ex.prompt + ex.completion):
                return "contains_pii"

        return None  # Passed all checks
```

## Dataset Splitting

```python
import random
from collections import defaultdict

def create_stratified_splits(
    examples: list[TrainingExample],
    train_pct: float = 0.90,
    val_pct: float = 0.05,
    test_pct: float = 0.05,
    seed: int = 42,
) -> dict:
    """Stratified split that preserves source distribution."""
    random.seed(seed)
    random.shuffle(examples)

    # Group by source for stratification
    by_source = defaultdict(list)
    for ex in examples:
        by_source[ex.source].append(ex)

    train, val, test = [], [], []
    for source_examples in by_source.values():
        n = len(source_examples)
        train_end = int(n * train_pct)
        val_end = train_end + int(n * val_pct)
        train.extend(source_examples[:train_end])
        val.extend(source_examples[train_end:val_end])
        test.extend(source_examples[val_end:])

    # Verify no data leakage
    train_prompts = {e.prompt for e in train}
    val_leakage = sum(1 for e in val if e.prompt in train_prompts)
    assert val_leakage == 0, f"Data leakage: {val_leakage} val examples in training set"

    return {"train": train, "val": val, "test": test}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Low-quality examples** | Model learns bad patterns | Quality score + human review of sample |
| **No deduplication** | Overfitting to repeated examples | Exact and near-duplicate removal |
| **Unbalanced sources** | Model biased toward one source style | Stratified sampling across sources |
| **PII in training data** | Privacy risk; possible memorisation | PII scanning + removal before training |
| **Test set contamination** | Inflated eval metrics | Strict train/val/test split; no leakage |

## 10 Rules

1. Data quality beats data quantity — 1,000 excellent examples outperform 100,000 mediocre ones.
2. Deduplicate before training — repeated examples cause overfitting.
3. Scan for PII before training — fine-tuned models can memorise and regurgitate training data.
4. Stratify splits by source — ensure each split has the same distribution.
5. Reserve a held-out test set — never evaluate fine-tuned models on training or validation data.
6. Human review a random sample of 100+ examples before training — catch systematic errors.
7. Track data provenance — know where every example came from.
8. Balance instruction diversity — a model trained on narrow instruction types generalises poorly.
9. Completion length distribution matters — highly skewed lengths bias generation style.
10. Iterate: fine-tune, evaluate, identify failures, add targeted examples for those failures.
