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

The canonical workflow for **Knowledge Graph Rag** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Build RAG systems enhanced with knowledge graphs for multi-hop reasoning and relationship queries. Outputs graph schema, hybrid retrieval pipeline, and query ro
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
