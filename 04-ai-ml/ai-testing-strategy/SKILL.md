---
name: ai-testing-strategy
description: Design comprehensive testing strategies for AI-powered features and LLM applications. Outputs test taxonomy, evaluation harness, regression suite, human evaluation protocol, and CI integration.
argument-hint: [AI feature type, LLM provider, quality dimensions, production traffic volume]
allowed-tools: Read, Write, Bash
---

# AI Testing Strategy

Testing AI-powered features requires a fundamentally different approach than testing deterministic code. LLM outputs vary, quality is multidimensional, and failure modes are qualitative rather than binary. A good AI testing strategy covers automated evals, human evaluation, regression detection, and production monitoring.

## Test Taxonomy

```
1. UNIT TESTS (deterministic components)
   Test prompt construction, tool call parsing, response processing
   Traditional unit tests — fast, no LLM calls

2. EVAL TESTS (LLM quality assessment)
   Test LLM output quality against rubrics
   Use an LLM-as-judge or human annotation
   Slow, expensive — run on PR and nightly

3. REGRESSION TESTS (guard against degradation)
   Fixed set of inputs with expected behaviour
   Binary pass/fail or score threshold
   Catch model/prompt changes that degrade quality

4. HUMAN EVALUATION (gold standard)
   Periodic human rating of random production samples
   Calibrates automated evals against human judgement
   Monthly or quarterly

5. PRODUCTION MONITORING
   Sample production traffic, classify quality
   Alert on quality degradation
   Continuous
```

## Automated Evaluation Harness

```python
import anthropic
import json
from dataclasses import dataclass
from typing import Callable

client = anthropic.Anthropic()

@dataclass
class EvalCase:
    input: str
    expected_criteria: list[str]   # What the output must satisfy
    forbidden_criteria: list[str]  # What the output must NOT contain
    context: dict = None

@dataclass
class EvalResult:
    case_id: str
    output: str
    passed: bool
    scores: dict[str, float]
    reasoning: str

def llm_judge(output: str, criteria: list[str],
              forbidden: list[str]) -> EvalResult:
    """Use a stronger model to judge output quality."""
    criteria_text = "
".join(f"- {c}" for c in criteria)
    forbidden_text = "
".join(f"- {f}" for f in forbidden)

    judge_prompt = f"""Evaluate this AI assistant output.

OUTPUT TO EVALUATE:
{output}

REQUIRED CRITERIA (each must be satisfied):
{criteria_text}

FORBIDDEN PATTERNS (none must be present):
{forbidden_text}

Score each criterion 0-10. Return JSON:
{{
  "criteria_scores": {{"criterion": score, ...}},
  "forbidden_violations": ["violation", ...],
  "overall_score": 0-10,
  "reasoning": "brief explanation",
  "passed": true/false
}}"""

    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=1024,
        messages=[{"role": "user", "content": judge_prompt}],
    )

    judgment = json.loads(response.content[0].text)
    return judgment

class EvalHarness:
    def __init__(self, system_under_test: Callable[[str], str]):
        self.sut = system_under_test
        self.results = []

    def run(self, cases: list[EvalCase], pass_threshold: float = 7.0) -> dict:
        for i, case in enumerate(cases):
            output = self.sut(case.input)
            judgment = llm_judge(output, case.expected_criteria, case.forbidden_criteria)

            self.results.append({
                "case_id": f"case_{i}",
                "input": case.input,
                "output": output,
                "passed": judgment["passed"] and judgment["overall_score"] >= pass_threshold,
                "overall_score": judgment["overall_score"],
                "reasoning": judgment["reasoning"],
            })

        pass_rate = sum(1 for r in self.results if r["passed"]) / len(self.results)
        avg_score = sum(r["overall_score"] for r in self.results) / len(self.results)

        return {
            "pass_rate": pass_rate,
            "avg_score": avg_score,
            "total_cases": len(self.results),
            "passed": len([r for r in self.results if r["passed"]]),
            "failures": [r for r in self.results if not r["passed"]],
        }
```

## Regression Test Suite

```python
# tests/ai/regression_cases.py
REGRESSION_CASES = [
    EvalCase(
        input="Summarise this contract in 3 bullet points: [contract text]",
        expected_criteria=[
            "Contains exactly 3 bullet points",
            "Each bullet point summarises a key term",
            "Does not add information not in the original",
        ],
        forbidden_criteria=[
            "Includes legal advice",
            "Uses first person ('I think', 'I believe')",
        ],
    ),
    EvalCase(
        input="What is the capital of France?",
        expected_criteria=[
            "Answers Paris",
            "Response is concise (under 50 words)",
        ],
        forbidden_criteria=["Incorrect capital", "Excessive caveats"],
    ),
    # Add cases when production failures are discovered
]

# tests/ai/test_regression.py
def test_ai_quality_regression(capsys):
    harness = EvalHarness(system_under_test=my_ai_feature)
    results = harness.run(REGRESSION_CASES, pass_threshold=7.0)

    assert results["pass_rate"] >= 0.90, (
        f"AI quality regression: {results['pass_rate']:.1%} pass rate "
        f"(min 90%). Failures: {results['failures']}"
    )
    assert results["avg_score"] >= 7.5, (
        f"Average score {results['avg_score']:.1f} below threshold 7.5"
    )
```

## Production Monitoring

```python
import random
from datetime import datetime

class AIQualityMonitor:
    SAMPLE_RATE = 0.02  # Sample 2% of production traffic

    def monitor_response(self, user_input: str, ai_output: str,
                          feature_id: str) -> None:
        if random.random() > self.SAMPLE_RATE:
            return

        # Async quality classification using cheap model
        score = self._classify_quality(user_input, ai_output)

        # Store for trending
        self._record_metric(feature_id, score, datetime.utcnow())

        # Alert if quality drops
        rolling_avg = self._get_rolling_avg(feature_id, window_days=7)
        if rolling_avg < 6.5:
            self._alert(f"AI quality degradation in {feature_id}: "
                       f"7-day avg score {rolling_avg:.1f}")

    def _classify_quality(self, input_text: str, output: str) -> float:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",  # Cheap model for monitoring
            max_tokens=10,
            messages=[{"role": "user", "content": (
                f"Rate this AI response quality 1-10 (just the number):
"
                f"Input: {input_text[:200]}
Output: {output[:200]}"
            )}],
        )
        try:
            return float(response.content[0].text.strip())
        except ValueError:
            return 5.0  # Default on parse failure
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Exact string matching** | LLMs are non-deterministic; match fails on synonym | Semantic/rubric-based evaluation |
| **Testing with training data** | Inflated scores; doesn't reflect real usage | Held-out evaluation set from real queries |
| **Only automated evals** | Evals can be wrong; judge models have biases | Periodic human calibration of automated evals |
| **No regression suite** | Prompt changes silently degrade quality | Fixed regression cases run on every change |
| **Evaluating on one dimension** | A response can be accurate but unhelpful | Multi-dimensional rubrics (accuracy, clarity, safety, tone) |

## 10 Rules

1. Unit test deterministic code; LLM-judge stochastic outputs.
2. Every production failure becomes a regression test case.
3. LLM-as-judge needs a stronger model than the system under test.
4. Pass thresholds are calibrated against human ratings — not picked arbitrarily.
5. Regression suite runs on every prompt or model change — not just releases.
6. Human evaluation quarterly calibrates automated evals against ground truth.
7. Production sampling monitors for quality drift over time.
8. Multi-dimensional scoring beats single overall score — shows where quality degrades.
9. Evaluation prompt engineering matters as much as production prompt engineering.
10. Share eval results with the team — AI quality is a shared product concern.
