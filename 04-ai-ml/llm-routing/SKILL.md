---
name: llm-routing
description: Route LLM requests to the optimal model based on complexity, cost, and latency. Outputs routing logic, model selection criteria, cost-quality tradeoffs, and fallback chains.
argument-hint: [models available, cost constraints, latency requirements, quality requirements]
allowed-tools: Read, Write
---

# LLM Routing

Not every request needs the most powerful model. A simple classification task can run on Claude Haiku at 1/50th the cost of Claude Opus. LLM routing matches requests to the cheapest model that can handle them adequately, reducing costs dramatically without hurting quality on tasks that matter.

## Routing Architecture

```python
from anthropic import Anthropic
from enum import Enum
from typing import Optional
import re

client = Anthropic()

class ModelTier(Enum):
    FAST_CHEAP  = "claude-haiku-4-5-20251001"    # ~$0.25/1M tokens
    BALANCED    = "claude-sonnet-4-6"              # ~$3/1M tokens
    POWERFUL    = "claude-opus-4-5"                # ~$15/1M tokens

class RoutingDecision:
    def __init__(self, model: str, reason: str, estimated_cost_multiplier: float):
        self.model = model
        self.reason = reason
        self.cost_multiplier = estimated_cost_multiplier

class LLMRouter:
    """Route requests to optimal model based on task characteristics."""
    
    # Complexity signals
    SIMPLE_PATTERNS = [
        r"summarize in \d+ words",
        r"classify (?:this|the following)",
        r"extract (?:the|all) \w+",
        r"translate to \w+",
        r"is this (?:positive|negative|neutral)",
        r"what is the \w+ of",
    ]
    
    COMPLEX_SIGNALS = [
        "analyze", "evaluate", "design", "architect",
        "compare and contrast", "pros and cons",
        "explain the tradeoffs", "write a detailed",
        "create a comprehensive", "step by step",
    ]
    
    CODE_SIGNALS = [
        "```", "code", "function", "class", "implement",
        "debug", "refactor", "algorithm",
    ]
    
    def route(self, prompt: str, system: Optional[str] = None,
              max_tokens: int = 1024, require_quality: bool = False) -> RoutingDecision:
        
        # Override: explicit quality requirement
        if require_quality:
            return RoutingDecision(
                ModelTier.POWERFUL.value, "Quality required", 1.0
            )
        
        prompt_lower = prompt.lower()
        combined = f"{system or ''} {prompt}".lower()
        
        # Simple classification/extraction → cheap model
        if any(re.search(p, prompt_lower) for p in self.SIMPLE_PATTERNS):
            return RoutingDecision(ModelTier.FAST_CHEAP.value, "Simple task", 0.02)
        
        # Code generation → balanced model
        if any(sig in combined for sig in self.CODE_SIGNALS):
            return RoutingDecision(ModelTier.BALANCED.value, "Code task", 0.2)
        
        # Complex reasoning → powerful model
        complex_count = sum(1 for sig in self.COMPLEX_SIGNALS if sig in combined)
        if complex_count >= 2:
            return RoutingDecision(ModelTier.POWERFUL.value, "Complex reasoning", 1.0)
        
        # Long prompts often need more reasoning
        if len(prompt) > 3000:
            return RoutingDecision(ModelTier.BALANCED.value, "Long prompt", 0.2)
        
        # Default: balanced
        return RoutingDecision(ModelTier.BALANCED.value, "Default", 0.2)
    
    def call(self, prompt: str, system: Optional[str] = None,
             max_tokens: int = 1024, require_quality: bool = False) -> tuple[str, dict]:
        decision = self.route(prompt, system, max_tokens, require_quality)
        
        response = client.messages.create(
            model=decision.model,
            max_tokens=max_tokens,
            system=system or "You are a helpful assistant.",
            messages=[{"role": "user", "content": prompt}],
        )
        
        metadata = {
            "model_used": decision.model,
            "routing_reason": decision.reason,
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        }
        return response.content[0].text, metadata

router = LLMRouter()
```

## Quality-Based Fallback Chain

```python
async def call_with_quality_fallback(
    prompt: str,
    quality_threshold: float = 0.8,
    max_attempts: int = 3,
) -> dict:
    """Start cheap; escalate to more powerful model if quality insufficient."""
    
    models = [
        ModelTier.FAST_CHEAP.value,
        ModelTier.BALANCED.value,
        ModelTier.POWERFUL.value,
    ]
    
    for i, model in enumerate(models[:max_attempts]):
        response = client.messages.create(
            model=model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        answer = response.content[0].text
        
        # Evaluate quality (using fast model as judge)
        quality = await evaluate_response_quality(prompt, answer)
        
        if quality >= quality_threshold or i == max_attempts - 1:
            return {
                "answer": answer,
                "model": model,
                "quality_score": quality,
                "escalated": i > 0,
            }
        
        # Quality insufficient — try next tier
    
    return {"answer": answer, "model": model, "quality_score": quality, "escalated": True}

async def evaluate_response_quality(question: str, answer: str) -> float:
    """Use cheap model to evaluate if answer is complete and responsive."""
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=128,
        messages=[{"role": "user", "content": f"""
Rate this answer quality 0-1:
Q: {question[:200]}
A: {answer[:500]}
JSON: {{"score": 0.0-1.0}}"""}]
    )
    import json
    return json.loads(response.content[0].text)["score"]
```

## Cost Tracking

```python
MODEL_COSTS = {
    "claude-haiku-4-5-20251001": {"input": 0.25, "output": 1.25},   # per 1M tokens
    "claude-sonnet-4-6":          {"input": 3.00, "output": 15.00},
    "claude-opus-4-5":            {"input": 15.00, "output": 75.00},
}

def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    rates = MODEL_COSTS.get(model, MODEL_COSTS["claude-sonnet-4-6"])
    return (input_tokens * rates["input"] + output_tokens * rates["output"]) / 1_000_000

# Monthly savings estimate
def routing_savings_report(request_log: list[dict]) -> dict:
    actual_cost = sum(r["cost"] for r in request_log)
    
    # What if all requests used Opus?
    opus_cost = sum(
        calculate_cost("claude-opus-4-5", r["input_tokens"], r["output_tokens"])
        for r in request_log
    )
    
    return {
        "actual_cost": actual_cost,
        "if_all_opus": opus_cost,
        "savings": opus_cost - actual_cost,
        "savings_pct": (opus_cost - actual_cost) / opus_cost * 100,
    }
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **One model for all tasks** | Over-spending on simple tasks | Route by complexity |
| **Always using cheapest model** | Quality suffers on complex tasks | Start cheap; escalate on quality signals |
| **No quality evaluation** | Can't know if routing decisions are correct | Sample and evaluate routed responses |
| **Routing without logging** | Can't optimise routing rules | Log model used, routing reason, quality |
| **Complex routing rules** | Rules become unmaintainable | Keep rules simple; use ML-based router for scale |

## 10 Rules

1. Simple extraction/classification → cheapest model; complex reasoning → most capable.
2. Quality-based fallback chains > static routing for variable-complexity requests.
3. Log every routing decision — you need data to improve routing rules.
4. Measure actual quality by model tier on your specific use case — benchmarks don't predict real-world quality.
5. Cost savings are real only if quality is maintained — track both together.
6. Route at the feature/task level, not the application level.
7. User-facing tasks may warrant higher quality than internal/batch tasks.
8. System prompts affect complexity assessment — include them in routing logic.
9. Code generation benefits from specialised models — don't route all code tasks to general models.
10. Revisit routing rules quarterly — models improve; thresholds that made sense today may not next quarter.
