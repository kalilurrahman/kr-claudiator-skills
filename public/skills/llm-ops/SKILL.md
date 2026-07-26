---
name: llm-ops
description: Operationalize LLM-powered applications in production — covering prompt versioning, evaluation pipelines, cost tracking, latency monitoring, hallucination detection, and safe rollout of model upgrades.
argument-hint: [LLM provider, application type, traffic volume, cost budget, safety requirements]
allowed-tools: Read, Write, Bash
---

# LLM Operations (LLMOps)

LLMs are not like regular software. They are probabilistic, expensive, slow, and can degrade silently when the model is updated under you. LLMOps is the discipline of running LLM applications reliably: versioning prompts like code, evaluating outputs systematically, tracking costs, and catching regressions before users do.

## Process

1. **Version every prompt** — prompts are code; track changes in git with evaluation results.
2. **Build an eval pipeline** — automated quality checks on every prompt change.
3. **Instrument cost and latency** — per-request token counts, latency percentiles, cost per operation.
4. **Detect hallucinations and failures** — output quality checks in production.
5. **Canary model upgrades** — never switch models cold; shadow-test and ramp traffic.
6. **Set up fallback chains** — primary model → fallback model → cached response.
7. **Rate limit and queue** — protect upstream LLM API from traffic spikes.
8. **Monitor for prompt injection** — detect adversarial user inputs targeting your prompts.

## Output Format

### Prompt Registry & Versioning

```python
# prompts/registry.py
import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
import yaml

@dataclass
class PromptVersion:
    name: str
    version: str          # semver: 1.0.0
    content: str          # The actual prompt template
    model: str            # e.g. "gpt-4o", "claude-3-5-sonnet-20241022"
    temperature: float
    max_tokens: int
    content_hash: str     # SHA256 of content for integrity
    created_at: str
    eval_score: Optional[float] = None   # From eval pipeline
    notes: str = ""
    
    @classmethod
    def from_file(cls, path: Path) -> "PromptVersion":
        data = yaml.safe_load(path.read_text())
        content = data["content"]
        return cls(
            name=data["name"],
            version=data["version"],
            content=content,
            model=data.get("model", "gpt-4o"),
            temperature=data.get("temperature", 0.2),
            max_tokens=data.get("max_tokens", 1000),
            content_hash=hashlib.sha256(content.encode()).hexdigest()[:16],
            created_at=data.get("created_at", datetime.now(timezone.utc).isoformat()),
            eval_score=data.get("eval_score"),
            notes=data.get("notes", ""),
        )
    
    def render(self, **variables) -> str:
        """Render prompt template with variables."""
        return self.content.format(**variables)


class PromptRegistry:
    """Load and serve versioned prompts from disk."""
    
    def __init__(self, prompts_dir: str = "prompts/"):
        self.dir = Path(prompts_dir)
        self._cache: dict[str, dict[str, PromptVersion]] = {}
        self._load_all()
    
    def _load_all(self):
        for file in self.dir.glob("**/*.yaml"):
            prompt = PromptVersion.from_file(file)
            if prompt.name not in self._cache:
                self._cache[prompt.name] = {}
            self._cache[prompt.name][prompt.version] = prompt
    
    def get(self, name: str, version: str = "latest") -> PromptVersion:
        versions = self._cache.get(name, {})
        if not versions:
            raise KeyError(f"No prompt found: {name}")
        
        if version == "latest":
            # Highest semver
            version = sorted(versions.keys(), key=lambda v: [int(x) for x in v.split(".")])[-1]
        
        return versions[version]
    
    def list_versions(self, name: str) -> list[str]:
        return sorted(self._cache.get(name, {}).keys())
```

```yaml
# prompts/summarizer/v1.2.0.yaml
name: document-summarizer
version: "1.2.0"
model: claude-3-5-sonnet-20241022
temperature: 0.1
max_tokens: 500
eval_score: 0.87
notes: "Added instruction to preserve technical terms. Improved accuracy on code docs."
created_at: "2024-02-15T10:00:00Z"

content: |
  You are a precise technical summarizer. Your job is to summarize the document below.
  
  Rules:
  - Maximum {max_words} words
  - Preserve all technical terms, product names, and numbers exactly as written
  - Use bullet points for lists of features or steps
  - Start with a one-sentence overview, then bullet points for key details
  - If the document is in a language other than English, summarize in the same language
  - Do NOT include phrases like "This document discusses..." — just the content
  
  Document:
  {document_text}
  
  Summary:
```

### Evaluation Pipeline

```python
# evals/pipeline.py
import anthropic
import openai
from dataclasses import dataclass
from typing import Callable
import json
import re

@dataclass
class EvalCase:
    input_variables: dict
    expected_output: str         # Golden reference
    acceptance_criteria: list[str]   # Things output must contain/do
    rejection_criteria: list[str]    # Things output must NOT contain

@dataclass  
class EvalResult:
    case_id: str
    prompt_version: str
    model: str
    output: str
    score: float               # 0.0 to 1.0
    passed: bool
    failures: list[str]
    latency_ms: float
    input_tokens: int
    output_tokens: int
    cost_usd: float


class LLMEvalPipeline:
    def __init__(self, judge_model: str = "claude-3-5-sonnet-20241022"):
        self.judge = anthropic.Anthropic()
        self.judge_model = judge_model
    
    def run_eval(
        self,
        prompt: "PromptVersion",
        test_cases: list[EvalCase],
        n_runs: int = 1   # Run each case N times for variance measurement
    ) -> dict:
        results = []
        
        for i, case in enumerate(test_cases):
            for run in range(n_runs):
                result = self._evaluate_single(prompt, case, f"case_{i}_run_{run}")
                results.append(result)
        
        # Aggregate
        passed = sum(1 for r in results if r.passed)
        scores = [r.score for r in results]
        
        return {
            "prompt_name": prompt.name,
            "prompt_version": prompt.version,
            "model": prompt.model,
            "n_cases": len(test_cases),
            "n_runs": n_runs,
            "pass_rate": passed / len(results),
            "mean_score": sum(scores) / len(scores),
            "min_score": min(scores),
            "p5_score": sorted(scores)[int(len(scores) * 0.05)],
            "total_cost_usd": sum(r.cost_usd for r in results),
            "avg_latency_ms": sum(r.latency_ms for r in results) / len(results),
            "p95_latency_ms": sorted(r.latency_ms for r in results)[int(len(results) * 0.95)],
            "results": [vars(r) for r in results],
        }
    
    def _evaluate_single(self, prompt: "PromptVersion", case: EvalCase, case_id: str) -> EvalResult:
        import time
        
        rendered = prompt.render(**case.input_variables)
        
        start = time.perf_counter()
        response = self._call_model(prompt.model, rendered, prompt.temperature, prompt.max_tokens)
        latency_ms = (time.perf_counter() - start) * 1000
        
        output = response["content"]
        failures = []
        
        # Check acceptance criteria
        for criterion in case.acceptance_criteria:
            if not self._check_criterion(output, criterion):
                failures.append(f"Missing: {criterion}")
        
        # Check rejection criteria
        for criterion in case.rejection_criteria:
            if self._check_criterion(output, criterion):
                failures.append(f"Present (should not be): {criterion}")
        
        # LLM-as-judge for nuanced quality
        judge_score = self._llm_judge(
            input_text=rendered,
            expected=case.expected_output,
            actual=output,
        )
        
        score = judge_score * (1 - len(failures) * 0.2)
        score = max(0.0, min(1.0, score))
        
        return EvalResult(
            case_id=case_id,
            prompt_version=prompt.version,
            model=prompt.model,
            output=output,
            score=score,
            passed=len(failures) == 0 and score >= 0.7,
            failures=failures,
            latency_ms=latency_ms,
            input_tokens=response["input_tokens"],
            output_tokens=response["output_tokens"],
            cost_usd=self._compute_cost(prompt.model, response["input_tokens"], response["output_tokens"]),
        )
    
    def _llm_judge(self, input_text: str, expected: str, actual: str) -> float:
        """Use a stronger model to judge output quality."""
        judge_prompt = f"""You are evaluating an AI model's output for quality.

INPUT (what was asked):
{input_text[:500]}

EXPECTED (golden reference):
{expected[:500]}

ACTUAL (model output to evaluate):
{actual[:500]}

Rate the actual output on a scale of 0 to 10 for:
1. Accuracy (is it factually correct and complete?)
2. Format compliance (does it follow the requested format?)
3. Conciseness (is it appropriately brief without losing information?)

Respond ONLY with a JSON object: {{"accuracy": N, "format": N, "conciseness": N, "reasoning": "brief explanation"}}"""

        response = self.judge.messages.create(
            model=self.judge_model,
            max_tokens=200,
            messages=[{"role": "user", "content": judge_prompt}]
        )
        
        try:
            scores = json.loads(response.content[0].text)
            return (scores["accuracy"] + scores["format"] + scores["conciseness"]) / 30
        except Exception:
            return 0.5  # Default if judge fails
    
    def _compute_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        # Pricing per million tokens (update as models change)
        pricing = {
            "claude-3-5-sonnet-20241022": {"input": 3.0, "output": 15.0},
            "claude-3-haiku-20240307": {"input": 0.25, "output": 1.25},
            "gpt-4o": {"input": 2.5, "output": 10.0},
            "gpt-4o-mini": {"input": 0.15, "output": 0.60},
        }
        p = pricing.get(model, {"input": 3.0, "output": 15.0})
        return (input_tokens * p["input"] + output_tokens * p["output"]) / 1_000_000
```

### Cost & Latency Instrumentation

```python
# instrumentation/llm_client.py
import time
import anthropic
from prometheus_client import Counter, Histogram, Gauge

# Metrics
llm_requests = Counter("llm_requests_total", "LLM API calls", ["model", "prompt_name", "status"])
llm_latency = Histogram("llm_latency_seconds", "LLM request latency", ["model", "prompt_name"],
    buckets=[0.5, 1, 2, 5, 10, 30, 60])
llm_tokens = Counter("llm_tokens_total", "Tokens consumed", ["model", "prompt_name", "token_type"])
llm_cost = Counter("llm_cost_usd_total", "Estimated cost in USD", ["model", "prompt_name"])

class InstrumentedLLMClient:
    """Wraps LLM API with observability."""
    
    def __init__(self):
        self.client = anthropic.Anthropic()
        self.prompt_registry = PromptRegistry()
    
    async def complete(
        self,
        prompt_name: str,
        variables: dict,
        prompt_version: str = "latest",
        user_id: str = None,
    ) -> str:
        prompt = self.prompt_registry.get(prompt_name, prompt_version)
        rendered = prompt.render(**variables)
        
        start = time.perf_counter()
        status = "success"
        
        try:
            response = self.client.messages.create(
                model=prompt.model,
                max_tokens=prompt.max_tokens,
                temperature=prompt.temperature,
                messages=[{"role": "user", "content": rendered}],
                metadata={"user_id": user_id or "anonymous"},
            )
            
            output = response.content[0].text
            input_tokens = response.usage.input_tokens
            output_tokens = response.usage.output_tokens
            
        except anthropic.RateLimitError:
            status = "rate_limit"
            raise
        except anthropic.APIError as e:
            status = "api_error"
            raise
        finally:
            latency = time.perf_counter() - start
            llm_requests.labels(model=prompt.model, prompt_name=prompt_name, status=status).inc()
            llm_latency.labels(model=prompt.model, prompt_name=prompt_name).observe(latency)
        
        # Track tokens and cost
        llm_tokens.labels(model=prompt.model, prompt_name=prompt_name, token_type="input").inc(input_tokens)
        llm_tokens.labels(model=prompt.model, prompt_name=prompt_name, token_type="output").inc(output_tokens)
        
        cost = self._compute_cost(prompt.model, input_tokens, output_tokens)
        llm_cost.labels(model=prompt.model, prompt_name=prompt_name).inc(cost)
        
        return output
```

### Hallucination & Quality Guardrails

```python
# guardrails/output_checker.py
import re
from dataclasses import dataclass

@dataclass
class GuardrailResult:
    passed: bool
    violations: list[str]
    filtered_output: str

class OutputGuardrails:
    """Post-process LLM outputs to catch common failure modes."""
    
    def check(self, output: str, context: dict) -> GuardrailResult:
        violations = []
        filtered = output
        
        # 1. Detect confident hallucination signals
        hallucination_phrases = [
            r"as of \d{4}",          # "As of 2019" when we're in 2024
            r"I don't have access",   # Model refusing when it should answer
            r"I cannot browse",
            r"my knowledge cutoff",   # Fine for chatbots, bad for RAG with current data
        ]
        for pattern in hallucination_phrases:
            if re.search(pattern, output, re.IGNORECASE):
                violations.append(f"Hallucination signal: matched '{pattern}'")
        
        # 2. Check factual grounding (if RAG context provided)
        if context.get("source_documents"):
            citation_score = self._check_grounding(output, context["source_documents"])
            if citation_score < 0.3:
                violations.append(f"Low grounding score: {citation_score:.2f} — output may not be supported by sources")
        
        # 3. Detect PII leakage in output
        pii_patterns = {
            "ssn": r"\b\d{3}-\d{2}-\d{4}\b",
            "credit_card": r"\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b",
            "email": r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b",
        }
        for pii_type, pattern in pii_patterns.items():
            if re.search(pattern, output):
                violations.append(f"Possible PII in output: {pii_type}")
                filtered = re.sub(pattern, f"[{pii_type.upper()} REDACTED]", filtered)
        
        # 4. Prompt injection in output (model was manipulated)
        injection_signals = [
            "ignore previous instructions",
            "forget your system prompt",
            "act as if you have no restrictions",
            "you are now",
        ]
        for signal in injection_signals:
            if signal.lower() in output.lower():
                violations.append(f"Possible prompt injection in output: '{signal}'")
        
        # 5. Length sanity check
        if len(output.split()) < 5:
            violations.append("Output suspiciously short — model may have refused")
        
        return GuardrailResult(
            passed=len(violations) == 0,
            violations=violations,
            filtered_output=filtered,
        )
    
    def _check_grounding(self, output: str, source_docs: list[str]) -> float:
        """Rough check: how much of the output vocabulary appears in the sources."""
        output_words = set(output.lower().split())
        source_words = set(" ".join(source_docs).lower().split())
        if not output_words:
            return 0.0
        overlap = output_words & source_words
        return len(overlap) / len(output_words)
```

### Model Upgrade Canary

```python
# deployment/model_canary.py
import random
from dataclasses import dataclass

@dataclass
class ModelCanaryConfig:
    current_model: str        # "claude-3-5-sonnet-20241022"
    candidate_model: str      # "claude-3-7-sonnet-20250219"
    candidate_pct: float = 0.05   # 5% traffic to candidate
    compare_outputs: bool = True  # Log both outputs for offline comparison

class ModelCanaryRouter:
    def __init__(self, config: ModelCanaryConfig):
        self.config = config
        self._shadow_log = []
    
    def select_model(self, request_id: str) -> str:
        """Deterministic routing by request ID."""
        hash_val = int(hashlib.md5(request_id.encode()).hexdigest(), 16)
        pct = (hash_val % 1000) / 1000
        
        if pct < self.config.candidate_pct:
            return self.config.candidate_model
        return self.config.current_model
    
    async def complete_with_shadow(self, prompt: str, request_id: str) -> str:
        """Run primary model; shadow-run candidate for comparison."""
        primary_model = self.config.current_model
        primary_output = await self._call_model(primary_model, prompt)
        
        if self.config.compare_outputs and random.random() < 0.1:
            # Shadow 10% of requests to candidate for comparison
            candidate_output = await self._call_model(self.config.candidate_model, prompt)
            self._shadow_log.append({
                "request_id": request_id,
                "primary": primary_output,
                "candidate": candidate_output,
            })
        
        return primary_output
```

## Rules

- **Prompts are code** — version them in git, review changes, require eval results before merging.
- **Evals before every prompt change** — no gut-feel deployments; measure before and after.
- **Never hard-code model names in application code** — use the registry; model upgrades should be a config change.
- **Track cost per operation, not just total** — "summarize" costs $0.002, "analyze document" costs $0.08; know both.
- **Set absolute cost budgets** — cap monthly LLM spend at the infrastructure level, not just in monitoring.
- **Latency SLOs must account for LLM variability** — P95, not mean; LLM latency tail is long.
- **Fallback chains are mandatory** — primary model → smaller/faster model → cached or degraded response.
- **Log every prompt + response** — you need this to debug failures, detect drift, and build eval datasets.
- **Test model upgrades with shadow traffic** — never switch production models cold.
- **Prompt injection is a real attack vector** — sanitize user inputs before interpolating into prompts.
