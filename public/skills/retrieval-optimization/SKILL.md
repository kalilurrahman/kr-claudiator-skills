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

The canonical workflow for **Retrieval Optimization** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Optimise RAG retrieval quality through reranking, query expansion, hybrid search, and evaluation. Outputs retrieval pipeline improvements, evaluation metrics, a
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
