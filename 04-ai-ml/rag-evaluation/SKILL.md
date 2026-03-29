---
name: rag-evaluation
description: Evaluate and improve RAG (Retrieval Augmented Generation) pipeline quality. Outputs retrieval evaluation metrics, answer quality benchmarks, end-to-end evaluation framework, and improvement roadmap.
argument-hint: [use case, document corpus, evaluation dataset size, latency requirements]
allowed-tools: Read, Write, Bash
---

# RAG Evaluation

RAG has two failure points: retrieval (wrong chunks fetched) and generation (wrong answer given right chunks). Evaluation must cover both. Without systematic evaluation, RAG improvements are guesswork and regressions are invisible.

## RAG Evaluation Framework

```
              ┌──────────────────────────────────────┐
              │         RAG PIPELINE                 │
              │                                      │
  Query → Retrieval → Chunks → Generation → Answer  │
              │    ↑              ↑                  │
              │  EVAL 1:        EVAL 2:               │
              │ Retrieval       Generation            │
              │ quality         quality               │
              └──────────────────────────────────────┘

EVAL 1 — Retrieval:
  Context Precision: Are retrieved chunks relevant?
  Context Recall: Are all relevant chunks retrieved?

EVAL 2 — Generation:
  Answer Faithfulness: Is the answer grounded in the retrieved context?
  Answer Relevance: Does the answer address the question?

END-TO-END:
  Correctness: Is the answer factually correct?
  Completeness: Does the answer cover all aspects?
```

## Evaluation Dataset Construction

```python
from anthropic import Anthropic
import json

client = Anthropic()

def generate_eval_dataset(documents: list[str], n_questions: int = 100) -> list[dict]:
    """Generate question-answer pairs from documents for evaluation."""
    eval_pairs = []
    
    for doc in documents[:n_questions]:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            messages=[{"role": "user", "content": f"""
Given this document, generate 2-3 evaluation questions with ground truth answers.
Focus on questions that require specific knowledge from the document.

Document:
{doc[:2000]}

Respond with JSON array:
[{{"question": "...", "answer": "...", "evidence": "exact quote from doc"}}]
"""}]
        )
        
        try:
            pairs = json.loads(response.content[0].text)
            for pair in pairs:
                pair["source_doc"] = doc
                eval_pairs.append(pair)
        except json.JSONDecodeError:
            pass
    
    return eval_pairs
```

## Retrieval Evaluation

```python
def evaluate_retrieval(
    eval_dataset: list[dict],
    rag_pipeline,
    k: int = 5,
) -> dict:
    """Evaluate retrieval quality: precision@k and recall@k."""
    
    precision_scores = []
    recall_scores = []
    
    for item in eval_dataset:
        # Retrieve chunks for the question
        retrieved_chunks = rag_pipeline.retrieve(item["question"], k=k)
        
        # Check which chunks contain the evidence
        evidence = item["evidence"].lower()
        relevant_retrieved = sum(
            1 for chunk in retrieved_chunks
            if any(sent.lower() in chunk["content"].lower()
                   for sent in evidence.split(". "))
        )
        
        # Precision@k: fraction of retrieved that are relevant
        precision = relevant_retrieved / k if k > 0 else 0
        precision_scores.append(precision)
        
        # Recall: did we retrieve the relevant chunk at all?
        recall = 1.0 if relevant_retrieved > 0 else 0.0
        recall_scores.append(recall)
    
    return {
        f"precision@{k}": sum(precision_scores) / len(precision_scores),
        "recall": sum(recall_scores) / len(recall_scores),
        "n_evaluated": len(eval_dataset),
    }
```

## Generation Evaluation (LLM-as-Judge)

```python
def evaluate_faithfulness(question: str, context: str, answer: str) -> dict:
    """Check if answer is grounded in context (not hallucinated)."""
    response = client.messages.create(
        model="claude-opus-4-5",  # Stronger model as judge
        max_tokens=512,
        messages=[{"role": "user", "content": f"""
Evaluate whether this answer is faithful to the provided context.

CONTEXT:
{context}

QUESTION: {question}
ANSWER: {answer}

Score from 0-1 where:
1.0 = Answer is fully supported by context, no hallucinations
0.5 = Answer is mostly supported but contains some unsupported claims
0.0 = Answer contains significant claims not in context (hallucination)

Respond with JSON: {{"score": 0.0-1.0, "reasoning": "...", "unsupported_claims": []}}
"""}]
    )
    return json.loads(response.content[0].text)

def evaluate_answer_relevance(question: str, answer: str) -> float:
    """Check if answer addresses the question."""
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        messages=[{"role": "user", "content": f"""
Does this answer address the question?

QUESTION: {question}
ANSWER: {answer}

Score 0-1: {{"score": 0.0-1.0}}
"""}]
    )
    return json.loads(response.content[0].text)["score"]
```

## RAGAS Framework Integration

```python
from ragas import evaluate
from ragas.metrics import (
    context_precision,
    context_recall,
    faithfulness,
    answer_relevancy,
)
from datasets import Dataset

# Build evaluation dataset
eval_data = {
    "question": [item["question"] for item in eval_dataset],
    "answer":   [rag_pipeline.query(item["question"]) for item in eval_dataset],
    "contexts": [
        [c["content"] for c in rag_pipeline.retrieve(item["question"])]
        for item in eval_dataset
    ],
    "ground_truth": [item["answer"] for item in eval_dataset],
}

dataset = Dataset.from_dict(eval_data)

results = evaluate(
    dataset,
    metrics=[context_precision, context_recall, faithfulness, answer_relevancy],
)

print(f"Context Precision:  {results['context_precision']:.3f}")
print(f"Context Recall:     {results['context_recall']:.3f}")
print(f"Faithfulness:       {results['faithfulness']:.3f}")
print(f"Answer Relevancy:   {results['answer_relevancy']:.3f}")
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Evaluating only end-to-end** | Can't isolate whether retrieval or generation is failing | Evaluate retrieval and generation independently |
| **Handcrafted eval dataset** | Dataset reflects developers' assumptions | Generate from documents; include adversarial cases |
| **Single metric** | Faithfulness alone misses retrieval failures | Suite: precision, recall, faithfulness, relevance |
| **No regression tracking** | Improvements may hurt other dimensions | Baseline all metrics before any change |
| **LLM judge without calibration** | Judge model may be biased | Validate judge against human annotations |

## 10 Rules

1. Separate retrieval evaluation from generation evaluation — failures are independent.
2. Evaluation dataset is generated from the actual document corpus — not hand-crafted.
3. Include adversarial questions (out-of-scope, ambiguous) in the eval set.
4. Track all four metrics: context precision, recall, faithfulness, answer relevance.
5. Regression test on every change — retrieval improvements can hurt generation and vice versa.
6. LLM-as-judge is fast but needs calibration against human judgement.
7. Faithfulness below 0.85 means the model is hallucinating — fix before deploying.
8. Context recall below 0.80 means relevant chunks aren't being retrieved — fix chunking or embedding.
9. Latency is a quality dimension — a correct answer in 30 seconds is worse than 80% correct in 1 second for most use cases.
10. Production sampling: evaluate 1-5% of live queries continuously — offline eval sets go stale.
