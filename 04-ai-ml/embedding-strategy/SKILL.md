---
name: embedding-strategy
description: Design embedding pipelines for semantic search, RAG, and recommendation systems. Outputs model selection, chunking strategy, index configuration, and retrieval evaluation framework.
argument-hint: [content type, query patterns, latency target, scale in documents, update frequency]
allowed-tools: Read, Write, Bash
---

# Embedding Strategy

Embeddings convert text (or images, audio) into dense vectors that capture semantic meaning. Similar content → similar vectors → efficient similarity search. Good embedding strategy requires matching the model to the content type, chunking documents appropriately, and optimising the index for your query patterns.

## Process

1. **Choose embedding model.** Match to content type: multilingual? Code? Long documents? Domain-specific?
2. **Design chunking strategy.** How to split documents — fixed size, sentence, paragraph, semantic, or recursive.
3. **Add metadata.** Attach source, date, category, and other filterable fields to each chunk.
4. **Choose vector store.** Pinecone, Weaviate, Qdrant, pgvector (Postgres), or FAISS (local).
5. **Define index configuration.** Distance metric, HNSW parameters, payload filtering.
6. **Build the pipeline.** Ingest → chunk → embed → store. Incremental update strategy.
7. **Evaluate retrieval quality.** Precision@k, Recall@k, MRR, NDCG on a labelled test set.
8. **Optimise.** Re-ranking, hybrid search, query expansion, or fine-tuning.

## Embedding Model Selection

| Model | Best For | Dimensions | Context | Notes |
|-------|---------|-----------|---------|-------|
| text-embedding-3-large | General English, RAG | 3072 (reducible) | 8191 tokens | Best quality, higher cost |
| text-embedding-3-small | High-volume, cost-sensitive | 1536 | 8191 tokens | Good quality, 5× cheaper |
| voyage-3 (Anthropic) | Enterprise RAG | 1024 | 32k tokens | Strong retrieval quality |
| nomic-embed-text | Local/private data | 768 | 8192 tokens | Open source, self-hosted |
| BAAI/bge-m3 | Multilingual | 1024 | 8192 tokens | 100+ languages |
| CodeBERT / StarCoder | Code search | 768 | Varies | Domain-specific code |

```python
# Model selection logic
def select_embedding_model(content_type: str, scale: str, multilingual: bool) -> str:
    if content_type == "code":
        return "nomic-ai/nomic-embed-code"
    if multilingual:
        return "BAAI/bge-m3"
    if scale == "high_volume":
        return "text-embedding-3-small"
    return "text-embedding-3-large"  # Default: quality first
```

## Chunking Strategies

```python
from langchain.text_splitter import (
    RecursiveCharacterTextSplitter,
    SentenceTransformersTokenTextSplitter,
)
from typing import List

# Strategy 1: Fixed-size with overlap (simplest, good baseline)
def chunk_fixed_size(text: str, chunk_size: int = 512, overlap: int = 64) -> List[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_text(text)

# Strategy 2: Sentence-based (better semantic coherence)
def chunk_by_sentence(text: str, tokens_per_chunk: int = 256) -> List[str]:
    splitter = SentenceTransformersTokenTextSplitter(
        chunk_overlap=20,
        tokens_per_chunk=tokens_per_chunk,
    )
    return splitter.split_text(text)

# Strategy 3: Semantic chunking (best quality, slower)
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

def chunk_semantic(text: str, embed_fn, threshold: float = 0.85) -> List[str]:
    """Split where semantic similarity drops between consecutive sentences."""
    sentences = text.split('. ')
    if len(sentences) <= 1:
        return [text]
    
    embeddings = embed_fn(sentences)
    chunks, current_chunk = [], [sentences[0]]
    
    for i in range(1, len(sentences)):
        sim = cosine_similarity([embeddings[i-1]], [embeddings[i]])[0][0]
        if sim < threshold:
            chunks.append('. '.join(current_chunk))
            current_chunk = [sentences[i]]
        else:
            current_chunk.append(sentences[i])
    
    if current_chunk:
        chunks.append('. '.join(current_chunk))
    return chunks

# Strategy 4: Parent-child (retrieval + context)
# Small chunks for precise retrieval; attach to parent for full context
def chunk_parent_child(document: dict, child_size: int = 256, parent_size: int = 1024):
    parent_chunks = chunk_fixed_size(document['content'], parent_size, overlap=0)
    result = []
    for i, parent in enumerate(parent_chunks):
        parent_id = f"{document['id']}_p{i}"
        children = chunk_fixed_size(parent, child_size, overlap=32)
        for j, child in enumerate(children):
            result.append({
                "chunk_id": f"{parent_id}_c{j}",
                "parent_id": parent_id,
                "parent_content": parent,    # For context in LLM
                "child_content": child,      # For embedding + retrieval
                "metadata": document['metadata'],
            })
    return result
```

## Embedding Pipeline

```python
import anthropic
import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
)
from datetime import datetime
from typing import List, Dict

# Initialise clients
anthro = anthropic.Anthropic()
qdrant = QdrantClient(url="http://qdrant:6333")

def embed_texts(texts: List[str], model: str = "voyage-3") -> List[List[float]]:
    """Batch embed with rate-limit handling."""
    import time
    embeddings = []
    batch_size = 96  # voyage-3 max batch
    
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        try:
            response = anthro.embeddings.create(model=model, input=batch)
            embeddings.extend([e.embedding for e in response.data])
        except anthropic.RateLimitError:
            time.sleep(60)
            response = anthro.embeddings.create(model=model, input=batch)
            embeddings.extend([e.embedding for e in response.data])
    return embeddings

def setup_collection(collection_name: str, dim: int = 1024):
    qdrant.recreate_collection(
        collection_name=collection_name,
        vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
    )

def ingest_documents(documents: List[Dict], collection: str):
    """Chunk, embed, and index a batch of documents."""
    chunks = []
    for doc in documents:
        for chunk_data in chunk_parent_child(doc):
            chunks.append(chunk_data)
    
    # Embed all child chunks
    texts = [c["child_content"] for c in chunks]
    vectors = embed_texts(texts)
    
    # Index into Qdrant
    points = [
        PointStruct(
            id=abs(hash(c["chunk_id"])) % (2**63),
            vector=vectors[i],
            payload={
                "chunk_id": c["chunk_id"],
                "parent_id": c["parent_id"],
                "child_content": c["child_content"],
                "parent_content": c["parent_content"],  # Context for LLM
                **c["metadata"],
                "indexed_at": datetime.utcnow().isoformat(),
            }
        )
        for i, c in enumerate(chunks)
    ]
    qdrant.upsert(collection_name=collection, points=points)

def search(query: str, collection: str, top_k: int = 5,
           filters: dict = None) -> List[Dict]:
    query_vector = embed_texts([query])[0]
    
    qdrant_filter = None
    if filters:
        qdrant_filter = Filter(must=[
            FieldCondition(key=k, match=MatchValue(value=v))
            for k, v in filters.items()
        ])
    
    results = qdrant.search(
        collection_name=collection,
        query_vector=query_vector,
        query_filter=qdrant_filter,
        limit=top_k,
        with_payload=True,
    )
    
    return [{
        "score": r.score,
        "content": r.payload["parent_content"],  # Full context for LLM
        "chunk": r.payload["child_content"],      # Matched chunk
        "source": r.payload.get("source"),
        "metadata": {k: v for k, v in r.payload.items()
                     if k not in ["child_content", "parent_content"]},
    } for r in results]
```

## Hybrid Search (Dense + Sparse)

```python
# Combine semantic (dense) + keyword (sparse BM25) search
# Better recall, especially for exact matches and rare terms

from qdrant_client.models import SparseVector, SparseVectorParams
from rank_bm25 import BM25Okapi

def hybrid_search(query: str, collection: str, alpha: float = 0.7) -> List[Dict]:
    """
    alpha: weight for dense search (1-alpha for sparse)
    alpha=1.0 → pure semantic | alpha=0.0 → pure keyword
    """
    # Dense retrieval
    dense_results = search(query, collection, top_k=20)
    dense_scores = {r["chunk"]: r["score"] * alpha for r in dense_results}
    
    # Sparse retrieval (BM25)
    # (In production: use Qdrant sparse vectors or Elasticsearch BM25)
    sparse_results = bm25_search(query, collection, top_k=20)
    sparse_scores = {r["chunk"]: r["score"] * (1 - alpha) for r in sparse_results}
    
    # Combine scores (RRF or linear combination)
    combined = {}
    all_chunks = set(dense_scores) | set(sparse_scores)
    for chunk in all_chunks:
        combined[chunk] = dense_scores.get(chunk, 0) + sparse_scores.get(chunk, 0)
    
    # Return top-k by combined score
    return sorted(combined.items(), key=lambda x: x[1], reverse=True)[:5]
```

## Retrieval Evaluation

```python
# Evaluate retrieval quality with labelled test set
from dataclasses import dataclass

@dataclass
class RetrievalTestCase:
    query: str
    relevant_doc_ids: list[str]  # Ground truth relevant documents

def evaluate_retrieval(test_cases: list[RetrievalTestCase],
                       collection: str, k: int = 5) -> dict:
    precision_scores, recall_scores, mrr_scores = [], [], []
    
    for case in test_cases:
        results = search(case.query, collection, top_k=k)
        retrieved_ids = [r["metadata"].get("doc_id") for r in results]
        relevant = set(case.relevant_doc_ids)
        
        # Precision@k: fraction of retrieved that are relevant
        hits = sum(1 for rid in retrieved_ids if rid in relevant)
        precision_scores.append(hits / k)
        
        # Recall@k: fraction of relevant that are retrieved
        recall_scores.append(hits / len(relevant) if relevant else 0)
        
        # MRR: reciprocal rank of first relevant result
        mrr = 0
        for rank, rid in enumerate(retrieved_ids, 1):
            if rid in relevant:
                mrr = 1 / rank
                break
        mrr_scores.append(mrr)
    
    return {
        f"precision@{k}": round(sum(precision_scores) / len(precision_scores), 3),
        f"recall@{k}": round(sum(recall_scores) / len(recall_scores), 3),
        "mrr": round(sum(mrr_scores) / len(mrr_scores), 3),
    }
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Chunks too large** | Low precision — irrelevant context pulled in | 256-512 tokens for retrieval chunks |
| **Chunks too small** | Low recall — splits coherent ideas | 128-256 token minimum; semantic chunking |
| **No overlap** | Context lost at chunk boundaries | 10-15% overlap between adjacent chunks |
| **Embedding the question verbatim** | Mismatch between question style and document style | Hypothetical document embeddings (HyDE) for RAG |
| **No metadata filtering** | Retrieval across irrelevant docs adds noise | Filter by category, date, source before similarity search |
| **Stale index** | Embeddings don't reflect updated documents | Incremental upsert pipeline on document changes |
| **Single embedding model forever** | Better models released; no migration path | Versioned collections; migration tooling |

## 10 Rules

1. Match the embedding model to content type — general models underperform on code and domain-specific text.
2. Chunk size and retrieval quality are inversely related — smaller chunks = higher precision, lower recall.
3. Parent-child chunking gives the best of both: small chunks for retrieval, large context for the LLM.
4. Always include metadata filters — retrieval over irrelevant documents degrades quality.
5. Evaluate retrieval quality with labelled test cases before optimising prompts.
6. Hybrid search (dense + sparse) outperforms pure semantic search for mixed queries.
7. Re-ranking retrieved results with a cross-encoder improves precision at low additional cost.
8. Embed at update time, not at query time — pre-computed embeddings avoid latency spikes.
9. Monitor retrieval quality over time — data drift degrades embeddings silently.
10. Version your collections — embedding model upgrades require re-indexing all documents.
