# System Design

This folder contains a curated collection of AI skills (prompts) related to **System Design**.

## 📚 Available Skills

| Skill | Name | Description |
|-------|------|-------------|
| [api-gateway](./api-gateway/SKILL.md) | api-gateway | Design and configure API gateway architecture covering routing, authentication, rate limiting, request transformation, and observability. Outputs gateway configuration for Kong, AWS API Gateway, or Nginx, with traffic management and security policies. |
| [api-versioning](./api-versioning/SKILL.md) | api-versioning | Design an API versioning strategy for a REST or GraphQL API. Covers version negotiation, deprecation lifecycle, migration guides, and backward compatibility rules. |
| [architecture-decision](./architecture-decision/SKILL.md) | architecture-decision | Document architecture decisions with ADRs (Architecture Decision Records). Outputs decision context, options, trade-offs, and rationale. |
| [bulkhead-pattern](./bulkhead-pattern/SKILL.md) | bulkhead-pattern | Implement bulkhead patterns to isolate failures and prevent cascade. Outputs thread pool isolation, semaphore limits, service partition designs, and circuit breaker integration. |
| [cdc-patterns](./cdc-patterns/SKILL.md) | cdc-patterns | Design a Change Data Capture (CDC) pipeline to stream database changes to downstream consumers. Outputs connector config, schema design, consumer patterns, ordering guarantees, and failure handling. |
| [cqrs-pattern](./cqrs-pattern/SKILL.md) | cqrs-pattern | Implement Command Query Responsibility Segregation separating read and write models. Outputs command handlers, query handlers, read model synchronization, and eventual consistency patterns. |
| [data-replication](./data-replication/SKILL.md) | data-replication | Design data replication strategies for high availability, read scaling, and disaster recovery. Outputs replication topology, consistency model, failover procedures, and lag monitoring setup. |
| [database-sharding](./database-sharding/SKILL.md) | database-sharding | Design a horizontal database sharding strategy to scale beyond the limits of a single database node. Covers shard key selection, sharding strategies, cross-shard queries, rebalancing, and operational challenges. |
| [distributed-cache](./distributed-cache/SKILL.md) | distributed-cache | Design distributed caching with Redis or Memcached. Outputs cache topology, eviction strategy, invalidation patterns, consistency model, and failure handling. |
| [distributed-systems](./distributed-systems/SKILL.md) | distributed-systems | Design distributed systems with consensus algorithms, partitioning, and eventual consistency. Outputs system architecture, CAP trade-offs, and failure handling. |
| [event-sourcing](./event-sourcing/SKILL.md) | event-sourcing | Implement event sourcing pattern where state is derived from an immutable sequence of events. Outputs event store design, aggregate patterns, projection builders, and command/event handlers. |
| [global-cdn-design](./global-cdn-design/SKILL.md) | global-cdn-design | Design global CDN architecture for static assets, API caching, and edge computing. Outputs CDN topology, cache rules, origin shield configuration, and performance optimisation strategy. |
| [high-availability](./high-availability/SKILL.md) | high-availability | Design high-availability systems with redundancy, failover, and disaster recovery. Outputs architecture diagrams, SLA targets, and failure modes. |
| [load-balancing](./load-balancing/SKILL.md) | load-balancing | Design load balancing architecture — algorithms, health checking, session affinity, layer 4 vs layer 7, geographic distribution, and failover strategies for high-availability services. |
| [message-queue](./message-queue/SKILL.md) | message-queue | Design message queue architectures using Kafka, RabbitMQ, or SQS. Outputs topic/queue design, producer/consumer patterns, dead letter queues, ordering guarantees, and scaling configuration. |
| [multi-tenancy](./multi-tenancy/SKILL.md) | multi-tenancy | Design multi-tenant SaaS architecture with tenant isolation, data partitioning, resource quotas, and tenant-aware observability. Outputs isolation patterns, row-level security, schema provisioning, and quota enforcement. |
| [saga-pattern](./saga-pattern/SKILL.md) | saga-pattern | Design distributed transactions using the Saga pattern to maintain data consistency across microservices without two-phase commit. Covers choreography vs orchestration, compensating transactions, failure handling, and implementation examples. |
| [scalability-plan](./scalability-plan/SKILL.md) | scalability-plan | Design scalability strategies for horizontal and vertical scaling. Outputs capacity planning, bottleneck analysis, and scaling triggers. |
| [service-mesh](./service-mesh/SKILL.md) | service-mesh | Design and implement service mesh architecture using Istio or Linkerd. Outputs traffic management config, mTLS setup, observability pipelines, circuit breakers, and canary deployment policies. |
| [strangler-fig-pattern](./strangler-fig-pattern/SKILL.md) | strangler-fig-pattern | Migrate legacy monoliths to modern architecture using the Strangler Fig pattern. Outputs migration strategy, routing layer design, feature extraction sequence, and rollback procedures. |
| [system-design-doc](./system-design-doc/SKILL.md) | system-design-doc | Create comprehensive system design documents with architecture diagrams, component specs, data flows, and scaling strategies. |

---
[⬅ Back to Main Repository](../README.md)
