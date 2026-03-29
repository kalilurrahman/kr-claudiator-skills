---
name: ai-cost-optimisation
description: Optimise LLM and AI infrastructure costs through model selection, caching, batching, and prompt engineering. Outputs cost analysis, model tiering strategy, and 30-day reduction plan.
argument-hint: [current monthly spend, model usage, traffic patterns, latency requirements]
allowed-tools: Read, Write
---

# Ai Cost Optimisation

AI costs can grow 10x faster than usage if left unmanaged. Systematic cost optimisation combines model tiering, caching, batching, and prompt efficiency to achieve 40-80% cost reduction without degrading quality.

## Cost Optimisation Levers

```
1. MODEL TIERING (biggest impact)
   Route tasks to cheapest model that handles them well.
   
   Haiku ($0.25/$1.25 per M tokens):   Simple classification, extraction
   Sonnet ($3/$15 per M tokens):       Most reasoning tasks
   Opus ($15/$75 per M tokens):        Complex reasoning, accuracy-critical

   Routing logic:
   - Simple yes/no? → Haiku
   - Standard completion? → Sonnet
   - Complex reasoning / accuracy-critical? → Opus

2. CACHING (40-80% reduction for repeat queries)
   - Exact match: identical prompts → cache response
   - Anthropic prompt caching: long stable system prompts cached at 10% cost
   - Semantic cache: similar queries → same cached response

3. BATCHING (50% reduction in throughput-tolerant workloads)
   - Anthropic Batch API: 50% discount for async processing
   - Batch classification jobs overnight

4. PROMPT OPTIMISATION
   - Remove redundant instructions
   - Compress system prompts
   - Use structured output to reduce output tokens
   - Few-shot examples only when needed

5. RESPONSE TRUNCATION
   - Set max_tokens appropriate to expected output length
   - Stop sequences to end generation early
```

## Model Routing Implementation

```python
from anthropic import Anthropic

client = Anthropic()

def route_to_model(task_type: str, complexity: str) -> str:
    routing = {
        ("classification", "simple"): "claude-haiku-4-5-20251001",
        ("extraction", "simple"):     "claude-haiku-4-5-20251001",
        ("summarisation", "medium"):  "claude-sonnet-4-6",
        ("reasoning", "complex"):     "claude-opus-4-5",
        ("code", "any"):              "claude-sonnet-4-6",
    }
    return routing.get((task_type, complexity), "claude-sonnet-4-6")

def classify_sentiment(text: str) -> str:
    model = route_to_model("classification", "simple")
    response = client.messages.create(
        model=model,
        max_tokens=10,    # Very short output — sentiment is one word
        messages=[{
            "role": "user",
            "content": f"Classify as positive/negative/neutral: {text[:500]}"
        }]
    )
    return response.content[0].text.strip()
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Using Opus for every task | 60x cost vs Haiku for simple tasks | Model tiering by task complexity |
| No caching for deterministic requests | Paying for identical completions | Cache temperature=0 requests |
| Streaming when not needed | More tokens in practice | Use standard completion for batch |
| No max_tokens | Runaway long responses | Set max_tokens to 2x expected output |
| Logging full prompts always | Storage cost grows | Log metadata only; store prompts in S3 with TTL |

## 10 Rules

1. Measure cost per task type before optimising — know where spend is concentrated.
2. Model tiering provides the biggest savings — match complexity to model capability.
3. Cache deterministic requests — identical prompts should never call the API twice.
4. Use Anthropic Batch API for bulk workloads — 50% discount for async processing.
5. Set max_tokens appropriate to the task — never leave it uncapped.
6. Compress system prompts — every 1000 tokens you remove saves $15/M calls with Opus.
7. Track cost per team, per model, and per application weekly.
8. Budget alerts at 80% and 100% prevent surprise bills.
9. Quality check before switching to cheaper models — regression testing required.
10. Prompt caching for long stable system prompts — 90% cost reduction on prefix tokens.

