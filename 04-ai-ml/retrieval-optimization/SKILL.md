---
name: retrieval-optimization
description: Optimise RAG retrieval quality through reranking, query expansion, hybrid search, and evaluation. Outputs retrieval pipeline improvements, evaluation metrics, and A/B testing framework.
argument-hint: [document corpus size, query types, current retrieval quality, latency budget]
allowed-tools: Read, Write, Bash
---

# Retrieval Optimization

The retrieval step is the most impactful component in a RAG pipeline. Poor retrieval means the LLM generates answers from wrong context — no prompt engineering fixes bad retrieval. Optimisation involves measuring retrieval quality, then applying targeted improvements: hybrid search, reranking, query expansion, or chunking changes.

## Retrieval Quality Metrics

```python
from dataclasses import dataclass
import numpy as np

@dataclass
class RetrievalEvalCase:
    query: str
    relevant_doc_ids: list[str]  # Ground truth

def evaluate_retrieval(cases: list[RetrievalEvalCase],
                        retrieve_fn, k: int = 5) -> dict:
    precision_scores, recall_scores, mrr_scores, ndcg_scores = [], [], [], []

    for case in cases:
        retrieved = retrieve_fn(case.query, top_k=k)
        retrieved_ids = [r["doc_id"] for r in retrieved]
        relevant = set(case.relevant_doc_ids)

        # Precision@k
        hits = sum(1 for rid in retrieved_ids if rid in relevant)
        precision_scores.append(hits / k)

        # Recall@k
        recall_scores.append(hits / len(relevant) if relevant else 0)

        # MRR (Mean Reciprocal Rank)
        mrr = 0
        for rank, rid in enumerate(retrieved_ids, 1):
            if rid in relevant:
                mrr = 1 / rank
                break
        mrr_scores.append(mrr)

        # nDCG@k
        dcg = sum(
            (1 if retrieved_ids[i] in relevant else 0) / np.log2(i + 2)
            for i in range(min(k, len(retrieved_ids)))
        )
        ideal_dcg = sum(1 / np.log2(i + 2) for i in range(min(len(relevant), k)))
        ndcg_scores.append(dcg / ideal_dcg if ideal_dcg > 0 else 0)

    return {
        f"precision@{k}": round(np.mean(precision_scores), 3),
        f"recall@{k}":    round(np.mean(recall_scores), 3),
        "mrr":            round(np.mean(mrr_scores), 3),
        f"ndcg@{k}":      round(np.mean(ndcg_scores), 3),
    }
```

## Reranking

```python
from anthropic import Anthropic

client = Anthropic()

def rerank_with_llm(query: str, candidates: list[dict], top_k: int = 3) -> list[dict]:
    """Use LLM to rerank retrieved candidates by relevance."""
    candidates_text = "

".join(
        f"[{i+1}] {c['content'][:500]}" for i, c in enumerate(candidates)
    )

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=100,
        messages=[{"role": "user", "content": f"""Rank these passages by relevance to the query.
Query: {query}

Passages:
{candidates_text}

Return only the indices of the top {top_k} most relevant passages in order, comma-separated.
Example: 3,1,5"""}],
    )

    try:
        indices = [int(i.strip()) - 1 for i in response.content[0].text.split(",")]
        return [candidates[i] for i in indices if i < len(candidates)]
    except Exception:
        return candidates[:top_k]

# Cross-encoder reranking (local model — more deterministic)
from sentence_transformers import CrossEncoder

cross_encoder = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

def rerank_with_cross_encoder(query: str, candidates: list[dict],
                               top_k: int = 3) -> list[dict]:
    pairs = [(query, c["content"]) for c in candidates]
    scores = cross_encoder.predict(pairs)
    ranked = sorted(zip(scores, candidates), key=lambda x: x[0], reverse=True)
    return [doc for _, doc in ranked[:top_k]]
```

## Query Expansion

```python
def expand_query(query: str) -> list[str]:
    """Generate alternative phrasings to improve recall."""
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        messages=[{"role": "user", "content": f"""Generate 3 alternative phrasings of this search query.
Return only the queries, one per line, no numbering.

Original query: {query}"""}],
    )

    alternatives = response.content[0].text.strip().split("
")
    return [query] + [a.strip() for a in alternatives if a.strip()]

def search_with_expansion(query: str, vector_store, top_k: int = 10) -> list[dict]:
    """Search with multiple query phrasings, merge and deduplicate results."""
    expanded = expand_query(query)
    all_results = {}

    for q in expanded:
        results = vector_store.search(q, top_k=top_k)
        for r in results:
            doc_id = r["doc_id"]
            if doc_id not in all_results or r["score"] > all_results[doc_id]["score"]:
                all_results[doc_id] = r

    # Return top-k by best score across all query variants
    return sorted(all_results.values(), key=lambda x: x["score"], reverse=True)[:top_k]
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No retrieval evaluation** | Don't know if retrieval is the bottleneck | Build eval set; measure P@k, MRR, nDCG |
| **Optimising LLM before retrieval** | Prompt tuning can't fix wrong context | Fix retrieval first |
| **Chunks too large** | Low precision — wrong content retrieved alongside right | 256-512 token chunks for retrieval |
| **Skipping reranking for speed** | Top-1 embedding match often wrong | Cross-encoder reranking on top-20, then top-3 |
| **Dense-only search** | Misses exact keyword matches | Hybrid search: dense + BM25 |

## 10 Rules

1. Measure retrieval quality before optimising anything else.
2. Build a ground-truth eval set — even 50 labelled queries reveals major issues.
3. Retrieve more candidates than you use (top-20), then rerank to top-5.
4. Cross-encoder reranking consistently outperforms embedding similarity alone.
5. Hybrid search (dense + BM25) outperforms pure semantic search for mixed queries.
6. Query expansion improves recall for short or ambiguous queries.
7. Small chunks for retrieval, large context for generation — parent-child chunking.
8. nDCG@k is the most informative single retrieval metric.
9. Retrieval latency budget: embedding (5ms) + ANN search (10ms) + reranking (50ms) = <100ms.
10. Monitor retrieval quality in production — distribution shift degrades embeddings over time.
