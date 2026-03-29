---
name: knowledge-graph-rag
description: Build RAG systems enhanced with knowledge graphs for multi-hop reasoning and relationship queries. Outputs graph schema, hybrid retrieval pipeline, and query routing strategy.
argument-hint: [domain complexity, relationship density, query patterns, graph database choice]
allowed-tools: Read, Write
---

# Knowledge Graph RAG

Standard RAG retrieves documents based on semantic similarity. Knowledge Graph RAG adds structured relationships between entities, enabling multi-hop reasoning. Combine both for queries that need semantic search AND relational traversal.

## When to Use Knowledge Graph RAG

```
STANDARD RAG is sufficient for:
  - "What does feature X do?" (semantic lookup)
  - "How do I configure Y?" (document retrieval)

KNOWLEDGE GRAPH RAG adds value for:
  - Multi-hop: "Which accounts use both feature A and are at risk?"
  - Relationship traversal: "Who reports to this manager and what do they own?"
  - Aggregation over entities: "All products in category X with attribute Y"
```

## Graph Schema Design

```python
# Neo4j schema for SaaS product knowledge graph
from neo4j import GraphDatabase

driver = GraphDatabase.driver("bolt://localhost:7687", auth=("neo4j", "password"))

def setup_schema(tx):
    tx.run("CREATE CONSTRAINT IF NOT EXISTS FOR (c:Customer) REQUIRE c.id IS UNIQUE")
    tx.run("CREATE CONSTRAINT IF NOT EXISTS FOR (p:Product) REQUIRE p.id IS UNIQUE")
    tx.run("CREATE CONSTRAINT IF NOT EXISTS FOR (f:Feature) REQUIRE f.id IS UNIQUE")

def populate_customer_feature_graph(customers: list):
    with driver.session() as session:
        for customer in customers:
            session.execute_write(
                lambda tx: tx.run(
                    "MERGE (c:Customer {id: $id}) SET c.name = $name, c.plan = $plan",
                    id=customer["id"], name=customer["name"], plan=customer["plan"]
                )
            )
            for feature_id in customer.get("active_features", []):
                session.execute_write(
                    lambda tx: tx.run(
                        "MATCH (c:Customer {id: $cid}), (f:Feature {id: $fid}) MERGE (c)-[:USES]->(f)",
                        cid=customer["id"], fid=feature_id
                    )
                )
```

## Hybrid Retrieval Pipeline

```python
import anthropic
import json

client = anthropic.Anthropic()

def route_query(question: str) -> dict:
    """Determine if query needs graph, vector search, or both."""
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        messages=[{"role": "user", "content": f"""
            Does this question require:
            - graph: relationships between entities (who uses what, dependencies)
            - semantic: document/text lookup (how does X work, what is Y)
            
            Question: {question}
            
            Respond with JSON: {{"needs_graph": true/false, "needs_semantic": true/false, "reasoning": "brief reason"}}
        """}]
    )
    return json.loads(response.content[0].text)

def generate_cypher(question: str, schema_description: str) -> str:
    """Generate Neo4j Cypher from natural language question."""
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=f"Generate valid Neo4j Cypher queries. Schema: {schema_description}. Return only the Cypher query.",
        messages=[{"role": "user", "content": f"Generate Cypher for: {question}"}]
    )
    return response.content[0].text

def answer_with_hybrid_context(question: str, vector_search_fn, graph_db) -> str:
    routing = route_query(question)
    context_parts = []
    
    if routing.get("needs_graph"):
        schema = "(Customer)-[:USES]->(Feature), (Customer)-[:INTEGRATES_WITH]->(Integration)"
        cypher = generate_cypher(question, schema)
        try:
            with graph_db.session() as session:
                results = session.run(cypher).data()
            context_parts.append(f"Graph data:\n{json.dumps(results, indent=2)}")
        except Exception as e:
            context_parts.append(f"Graph query failed: {e}")
    
    if routing.get("needs_semantic"):
        chunks = vector_search_fn(question, top_k=5)
        context_parts.append(f"Documentation:\n" + "\n".join(chunks))
    
    context = "\n\n".join(context_parts)
    
    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=2048,
        messages=[{"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}]
    )
    return response.content[0].text
```

## Entity Resolution

```python
# The hardest problem: "ACME Corp" and "Acme Corporation" are the same customer
def resolve_entities(text: str, entity_db: dict) -> list[dict]:
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": f"""
            Identify entities in this text and match to known entities.
            Known entities: {list(entity_db.keys())}
            Text: {text}
            
            Return JSON list: [{{"mentioned": "text mention", "canonical_id": "id or null", "confidence": 0.0-1.0}}]
        """}]
    )
    return json.loads(response.content[0].text)
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Knowledge graph for everything** | Adds complexity without benefit for simple queries | Use graph only for relationship-heavy queries |
| **LLM-generated Cypher without validation** | Hallucinated queries fail or return wrong data | Validate Cypher syntax before execution |
| **Stale graph data** | Relationships reflect old state | CDC pipeline keeps graph in sync |
| **No depth limit** | Deep traversals timeout | MAX 3-4 hops in any query |
| **Ignoring entity resolution** | Same customer appears as multiple nodes | Deduplication before graph ingestion |

## 10 Rules

1. Knowledge graphs add value for multi-hop and relationship queries — not document retrieval.
2. Route queries at inference time — not all questions need the graph.
3. LLM-generated Cypher must be validated — hallucinations cause incorrect results.
4. Keep graph in sync via CDC — stale relationships produce wrong answers.
5. Vector store and graph are complementary — use both for different query types.
6. Entity resolution is the hardest problem — deduplicate before ingesting.
7. Start with a small, well-defined subgraph — expand as the use case proves value.
8. Graph traversal depth limit prevents runaway queries — max 3-4 hops.
9. Explain graph reasoning to users — "I found this by following X→Y→Z relationships."
10. Test graph queries with known data before deploying to production.
