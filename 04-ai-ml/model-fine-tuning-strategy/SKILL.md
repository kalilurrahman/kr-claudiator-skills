---
name: model-fine-tuning-strategy
description: Plan and execute model fine-tuning to improve performance on domain-specific tasks. Outputs fine-tuning decision framework, dataset preparation guidelines, evaluation strategy, and deployment plan.
argument-hint: [base model, target task, data availability, quality requirements, budget]
allowed-tools: Read, Write
---

# Model Fine Tuning Strategy

Fine-tuning adapts a pre-trained model to a specific task or domain by training on curated examples. It improves consistency, reduces prompt engineering overhead, and can significantly improve performance on narrow tasks — but requires quality training data and careful evaluation.

## When to Fine-Tune

Fine-tune when: prompt engineering alone cannot achieve required quality; consistency across thousands of requests is critical; domain-specific language or format is required; or cost reduction through a smaller fine-tuned model is justified.

Do NOT fine-tune when: your dataset is <1000 examples; the base model already performs well with good prompting; the task changes frequently; or you lack resources for evaluation and iteration.

## Dataset Preparation

Quality matters more than quantity. 500 high-quality examples outperform 10,000 mediocre ones.

```python
# Dataset format for instruction fine-tuning
training_examples = [
    {
        "messages": [
            {"role": "system", "content": "You are a customer support agent for Acme Corp."},
            {"role": "user", "content": "My order hasn't arrived after 2 weeks."},
            {"role": "assistant", "content": "I apologise for the delay with your order. Let me look that up immediately. Could you please share your order number so I can check its current status and arrange a resolution?"}
        ]
    },
    # ... 500+ more examples
]

# Quality checks
def validate_example(ex: dict) -> list:
    issues = []
    msgs = ex["messages"]
    if len(msgs) < 2: issues.append("Too few messages")
    if not any(m["role"] == "assistant" for m in msgs): issues.append("No assistant turn")
    last = msgs[-1]
    if last["role"] != "assistant": issues.append("Last message not from assistant")
    if len(last["content"]) < 20: issues.append("Response too short")
    return issues
```

## Evaluation Strategy

```python
# Evaluate fine-tuned model vs base model
import anthropic

client = anthropic.Anthropic()

def compare_models(test_cases: list, fine_tuned_id: str) -> dict:
    base_scores = []
    ft_scores = []

    for case in test_cases:
        # Base model
        base_resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=512,
            messages=case["messages"][:-1]  # All except expected response
        )
        # Fine-tuned model (when available via API)
        ft_resp = client.messages.create(
            model=fine_tuned_id,
            max_tokens=512,
            messages=case["messages"][:-1]
        )
        expected = case["messages"][-1]["content"]
        base_scores.append(evaluate_response(base_resp.content[0].text, expected))
        ft_scores.append(evaluate_response(ft_resp.content[0].text, expected))

    return {
        "base_model_avg": sum(base_scores) / len(base_scores),
        "fine_tuned_avg": sum(ft_scores) / len(ft_scores),
        "improvement": (sum(ft_scores) - sum(base_scores)) / len(base_scores),
    }
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Fine-tuning before prompt engineering | Expensive; often unnecessary | Exhaust prompt engineering first |
| Low-quality training data | Model learns bad patterns | Curate carefully; quality > quantity |
| No holdout test set | Cannot measure generalisation | 80/10/10 train/val/test split |
| Fine-tuning for knowledge | Model hallucinates facts | Use RAG for knowledge; fine-tune for style/format |
| No regression testing | Fine-tuned model worse on base tasks | Test on general benchmarks post fine-tune |

## 10 Rules

1. Exhaust prompt engineering before fine-tuning — it is faster and cheaper.
2. Training data quality is the single biggest determinant of fine-tuning success.
3. Minimum 500 high-quality examples; 2000+ for reliable results.
4. Always hold out a test set — never evaluate on training data.
5. Fine-tune for style, format, and consistency — not for factual knowledge.
6. Evaluate fine-tuned model against base model on both target task and general tasks.
7. Version fine-tuned models — track which dataset and base model produced each version.
8. Monitor fine-tuned model drift over time — performance can degrade as the world changes.
9. Cost analysis: fine-tuning cost vs prompt engineering overhead vs savings from smaller model.
10. Fine-tuning is a product decision, not just a technical one — requires stakeholder buy-in.

