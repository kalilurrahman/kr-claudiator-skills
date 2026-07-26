---
name: vector-database
description: Design and implement a vector database for semantic search, RAG, and similarity lookups. Covers embedding strategy, index selection, query patterns, metadata filtering, and performance tuning.
argument-hint: [use case, embedding model, data volume, latency requirements, cloud preference]
allowed-tools: Read, Write, Bash
---

# Vector Database Design

Vector databases store high-dimensional embeddings and enable similarity search -- finding records semantically close to a query even with no keyword overlap. They underpin RAG systems, semantic search, recommendation engines, and anomaly detection.

## When to Use a Vector Database

| Use case | Example |
|---------|---------|
| Semantic search | "Find support tickets similar to this one" |
| RAG | Find relevant docs to pass to an LLM |
| Recommendation | Items similar to what this user bought |
| Duplicate detection | Find near-duplicate documents |
| Anomaly detection | Embedding far from all cluster centers = anomaly |

## Vector DB Options

| Database | Best for | Hosting |
|---------|---------|---------|
| Pinecone | Managed; production; high scale | Managed SaaS |
| Weaviate | Open source; hybrid search; rich metadata | Self-hosted / Managed |
| Qdrant | Open source; filtering; Rust performance | Self-hosted / Managed |
| Chroma | Local dev; embedded; simple API | Self-hosted |
| pgvector | Already on Postgres; low volume (<1M rows) | Self-hosted |
| Milvus | High scale; open source | Self-hosted |

## Process

1. **Choose the embedding model** -- OpenAI text-embedding-3-small, sentence-transformers, or domain-specific.
2. **Define the embedding strategy** -- chunk size, overlap, what fields to embed.
3. **Select the vector database** -- managed vs self-hosted; filtering needs; scale requirements.
4. **Design the index** -- HNSW for accuracy, IVF for scale, exact for small collections.
5. **Design metadata schema** -- what filters will queries need? Index those fields.
6. **Build the ingestion pipeline** -- embed at ingest; re-embed when source data changes.
7. **Implement query patterns** -- ANN search, hybrid (vector + keyword), filtered search.
8. **Tune for performance** -- ef_search, nprobe, batching.
9. **Monitor quality** -- track retrieval precision; use labeled test sets.
10. **Plan for model updates** -- embeddings must be regenerated when the embedding model changes.

## Pinecone Setup and Ingestion

```python
from pinecone import Pinecone, ServerlessSpec
from openai import OpenAI
import hashlib

pc    = Pinecone(api_key="YOUR_API_KEY")
oai   = OpenAI()

pc.create_index(
    name="support-tickets",
    dimension=1536,          # text-embedding-3-small dimension
    metric="cosine",
    spec=ServerlessSpec(cloud="aws", region="us-east-1")
)
index = pc.Index("support-tickets")

def embed_texts(texts: list[str]) -> list[list[float]]:
    resp = oai.embeddings.create(model="text-embedding-3-small", input=texts)
    return [item.embedding for item in resp.data]

def ingest_tickets(tickets: list[dict], batch_size: int = 100) -> None:
    for i in range(0, len(tickets), batch_size):
        batch      = tickets[i:i+batch_size]
        embeddings = embed_texts([f"{t['title']} {t['description']}" for t in batch])
        vectors    = [
            {
                "id":       hashlib.md5(t["id"].encode()).hexdigest(),
                "values":   emb,
                "metadata": {
                    "ticket_id": t["id"],
                    "title":     t["title"][:200],
                    "status":    t["status"],
                    "category":  t["category"],
                }
            }
            for t, emb in zip(batch, embeddings)
        ]
        index.upsert(vectors=vectors)
        print(f"Ingested {i + len(batch)} / {len(tickets)}")
```

## Semantic Search with Metadata Filters

```python
def find_similar_tickets(
    query: str,
    top_k: int = 5,
    status_filter: str = None,
    category_filter: str = None,
) -> list[dict]:
    query_vec = embed_texts([query])[0]

    metadata_filter = {}
    if status_filter:
        metadata_filter["status"] = {"$eq": status_filter}
    if category_filter:
        metadata_filter["category"] = {"$eq": category_filter}

    results = index.query(
        vector=query_vec,
        top_k=top_k,
        filter=metadata_filter or None,
        include_metadata=True,
    )
    return [
        {"ticket_id": m.metadata["ticket_id"], "title": m.metadata["title"], "score": m.score}
        for m in results.matches
        if m.score > 0.75   # drop low-confidence matches
    ]
```

## pgvector (Postgres Extension)

```sql
-- Setup
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
    id        BIGSERIAL PRIMARY KEY,
    content   TEXT NOT NULL,
    embedding vector(1536),
    metadata  JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- HNSW index: fast approximate nearest neighbor
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Similarity search with filter
SELECT id, content, 1 - (embedding <=> '[... query vec ...]'::vector) AS similarity
FROM documents
WHERE metadata->>'status' = 'resolved'
ORDER BY embedding <=> '[... query vec ...]'::vector
LIMIT 5;
```

```python
import psycopg2
from pgvector.psycopg2 import register_vector

conn = psycopg2.connect(DATABASE_URL)
register_vector(conn)

def semantic_search(query_vec: list[float], top_k: int = 5) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, content, 1-(embedding<=>%s) AS sim FROM documents ORDER BY embedding<=>%s LIMIT %s",
            (query_vec, query_vec, top_k)
        )
        return [{"id": r[0], "content": r[1], "similarity": float(r[2])} for r in cur.fetchall()]
```

## RAG Chunking Strategy

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

def chunk_document(text: str, doc_id: str) -> list[dict]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,      # characters per chunk
        chunk_overlap=50,    # preserve context across boundaries
        separators=["\n\n", "\n", ". ", " "],
    )
    chunks = splitter.split_text(text)
    return [
        {"chunk_id": f"{doc_id}_{i}", "text": c, "doc_id": doc_id,
         "chunk_index": i, "total_chunks": len(chunks)}
        for i, c in enumerate(chunks)
    ]
```

## Weaviate Hybrid Search (vector + keyword)

```python
import weaviate
from weaviate.classes.query import MetadataQuery

client = weaviate.connect_to_local()
col    = client.collections.get("SupportTicket")

def hybrid_search(query: str, top_k: int = 5) -> list[dict]:
    # alpha=0 is pure BM25, alpha=1 is pure vector; 0.75 leans toward vector
    results = col.query.hybrid(
        query=query, alpha=0.75, limit=top_k,
        return_metadata=MetadataQuery(score=True),
        return_properties=["title", "status", "category"],
    )
    return [{"title": o.properties["title"], "score": o.metadata.score} for o in results.objects]
```

## Performance Tuning Reference

```
HNSW index parameters:
  m:                connections per node (higher = better recall, more memory)
  ef_construction:  build-time quality (higher = better index, slower build)
  ef (query time):  search quality (higher = better recall, slower queries)

For RAG (recall matters more than speed):
  m=32, ef_construction=200, ef=100

For recommendation (speed matters more):
  m=16, ef_construction=64, ef=50

Always batch embedding calls -- single calls are ~100x slower than batching.
```

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Embedding full documents without chunking | Long texts lose semantic precision | Chunk to 256-500 tokens with overlap |
| No metadata filtering | Retrieves results from wrong context | Filter by tenant, date, category before vector search |
| No similarity threshold | Returns low-quality matches | Drop matches below 0.7 cosine similarity |
| Not re-indexing on model change | Old and new embeddings are incompatible | Re-embed everything when switching models |
| pgvector without HNSW index | Sequential scan is very slow at scale | Always create HNSW or IVFFlat index |
| Single-item embedding calls | 100x slower than batched | Batch all embedding API calls |

## Rules

- **Chunk before embedding** -- one vector for a 10-page document represents nothing precisely.
- **Batch embedding calls** -- single-item calls are 100x slower; always batch to 100+ per request.
- **Set a similarity threshold** -- low-confidence matches degrade user experience silently.
- **Add metadata filters** -- vector search without filters returns results from all tenants and contexts.
- **Re-embed when switching models** -- embeddings from different models are not comparable; re-index everything.
- **Monitor retrieval quality** -- track recall@k and precision@k; build a labeled evaluation set.
- **Use hybrid search for production RAG** -- pure vector misses exact keyword matches; BM25+vector wins.
- **Choose index type by scale** -- exact for <100K; HNSW for 100K-10M; IVF for >10M.
- **Plan for model updates** -- build a re-indexing pipeline from day one; models improve frequently.
- **Cosine for text, euclidean for images** -- match the distance metric to how the embedding model was trained.
