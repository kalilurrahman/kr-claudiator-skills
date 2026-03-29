---
name: graph-analytics
description: Design and implement graph analytics for network analysis, recommendation systems, and fraud detection. Outputs graph schema, traversal queries, and analytics algorithms.
argument-hint: [graph type, scale, query patterns, existing infrastructure, latency requirements]
allowed-tools: Read, Write
---

# Graph Analytics

Graph analytics models relationships between entities — customers, products, transactions — and answers questions that relational databases handle poorly: "who is connected to whom?", "what do similar users buy?", "is this transaction part of a fraud ring?"

## When to Use Graph Analytics

Use graph when the relationships are the data: fraud detection (transaction networks), recommendations (user-item bipartite graphs), organisational analysis (reporting hierarchies), knowledge graphs, and network topology.

## Property Graph Model (Neo4j)

```cypher
-- Create nodes and relationships
CREATE (u:User {id: 'user-1', name: 'Alice', tier: 'premium'})
CREATE (p:Product {id: 'prod-1', name: 'Widget', category: 'tools'})
CREATE (u)-[:PURCHASED {at: datetime(), amount: 49.99}]->(p)
CREATE (u)-[:SIMILAR_TO {score: 0.87}]->(u2:User {id: 'user-2'})

-- Recommendation: products purchased by similar users
MATCH (u:User {id: $user_id})-[:SIMILAR_TO]->(similar:User)
MATCH (similar)-[:PURCHASED]->(p:Product)
WHERE NOT (u)-[:PURCHASED]->(p)
RETURN p.id, p.name, count(similar) AS rec_strength
ORDER BY rec_strength DESC LIMIT 10

-- Fraud: find rings of connected accounts
MATCH path = (a:Account)-[:SHARED_IP|SHARED_DEVICE*1..3]-(b:Account)
WHERE a.id <> b.id AND b.is_flagged = true
RETURN a.id, length(path) AS distance, b.id AS flagged_account
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Graph for simple lookups | Overhead without benefit | Use graph only when relationship traversal is the query |
| Super-nodes (millions of edges) | Query performance collapses | Partition super-nodes; filter by relationship type |
| No index on node properties | Full graph scan | Create indexes on all lookup properties |

## 10 Rules

1. Use graph databases when relationship traversal is the primary query pattern.
2. Index all node properties used in WHERE clauses.
3. Avoid super-nodes — nodes with millions of relationships destroy query performance.
4. Graph schema design requires understanding query patterns first.
5. Start with a property graph model; evaluate specialised engines only at scale.
6. Shortest path and community detection are built-in — use them.
7. Graph algorithms run in batch for analytics; not on every API request.
8. Export subgraphs to property tables for high-volume reporting.
9. Version graph schemas — migrations are as hard as relational migrations.
10. Test graph queries with realistic data volumes — synthetic graphs hide performance issues.

