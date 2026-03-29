---
name: geo-distributed-systems
description: Design systems that serve users globally with low latency. Outputs data placement strategy, consistency model, region routing, and conflict resolution approaches.
argument-hint: [user distribution, data residency requirements, latency targets, consistency requirements]
allowed-tools: Read, Write
---

# Geo-Distributed Systems

Distributing a system globally is not just deploying to multiple regions. It requires data placement decisions (where data lives), routing decisions (which region serves a request), consistency decisions (how regions stay in sync), and conflict resolution (what happens when concurrent writes collide).

## Architecture Patterns

```
ACTIVE-PASSIVE (simplest)
  One region handles all writes; others serve reads from replica.
  Consistency: Strong for reads from primary; eventual for replica reads.
  Latency: High for writes from non-primary regions.
  Use: Low-write applications with strong consistency needs.

ACTIVE-ACTIVE (complex, high performance)
  All regions accept reads and writes.
  Consistency: Eventual; conflicts possible.
  Latency: Low globally.
  Use: High-traffic global applications where eventual consistency is acceptable.

FOLLOW-THE-SUN
  Users in AU → AU region; users in EU → EU region.
  Data follows user timezone/geography.
  Consistency: Eventually consistent cross-region.
  Use: SaaS with per-customer data isolation.
```

## Data Placement Strategy

```python
from enum import Enum

class DataResidency(Enum):
    GLOBAL = "global"         # Replicated everywhere
    USER_HOME = "user_home"   # Lives in user's home region
    GDPR_EU = "eu-west"       # Must stay in EU
    US_ONLY = "us-east"       # US data sovereignty

# Per-entity placement rules
DATA_PLACEMENT = {
    "user_profile":     DataResidency.USER_HOME,      # GDPR compliance
    "product_catalog":  DataResidency.GLOBAL,          # Same everywhere
    "orders":           DataResidency.USER_HOME,       # User's data
    "analytics_events": DataResidency.USER_HOME,       # Data residency
    "public_content":   DataResidency.GLOBAL,          # No restrictions
}

def get_data_region(entity_type: str, user_region: str) -> str:
    placement = DATA_PLACEMENT.get(entity_type, DataResidency.GLOBAL)
    if placement == DataResidency.GLOBAL:
        return "us-east-1"  # Primary region for global data
    elif placement == DataResidency.USER_HOME:
        return user_region
    elif placement == DataResidency.GDPR_EU:
        return "eu-west-1"
    return user_region
```

## Region Routing

```python
# Cloudflare Workers — route at edge to nearest regional API
def route_to_region(request_country: str) -> str:
    EU_COUNTRIES = {"DE", "FR", "GB", "NL", "SE", "IT", "ES", "PL", "BE"}
    APAC_COUNTRIES = {"JP", "SG", "AU", "KR", "IN", "TW", "HK"}
    
    if request_country in EU_COUNTRIES:
        return "https://eu.api.example.com"
    elif request_country in APAC_COUNTRIES:
        return "https://ap.api.example.com"
    else:
        return "https://us.api.example.com"

# GeoDNS routing (Route53/Cloudflare)
# DNS returns different IPs based on resolver location
# us-east-1.api.example.com → US users
# eu-west-1.api.example.com → EU users
# ap-southeast-1.api.example.com → APAC users
```

## Conflict Resolution (CRDTs)

```python
# Last-write-wins (LWW) — simplest, loses concurrent updates
class LWWRegister:
    def __init__(self):
        self.value = None
        self.timestamp = 0
    
    def set(self, value, timestamp: float):
        if timestamp > self.timestamp:
            self.value = value
            self.timestamp = timestamp
    
    def merge(self, other: "LWWRegister"):
        self.set(other.value, other.timestamp)

# Vector clocks — detect conflicts, don't resolve automatically
class VectorClock:
    def __init__(self, node_id: str):
        self.clocks = {node_id: 0}
        self.node_id = node_id
    
    def increment(self):
        self.clocks[self.node_id] += 1
    
    def merge(self, other: "VectorClock"):
        for node, count in other.clocks.items():
            self.clocks[node] = max(self.clocks.get(node, 0), count)
    
    def happened_before(self, other: "VectorClock") -> bool:
        return (all(self.clocks.get(n, 0) <= other.clocks.get(n, 0) for n in self.clocks) and
                any(self.clocks.get(n, 0) < other.clocks.get(n, 0) for n in self.clocks))
    
    def concurrent_with(self, other: "VectorClock") -> bool:
        return (not self.happened_before(other) and
                not other.happened_before(self))
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Assuming low latency cross-region** | US to EU is 70-100ms baseline | Design for async; don't synchronously wait cross-region |
| **Strong consistency everywhere globally** | Requires cross-region consensus — very slow | Eventual consistency for non-critical; strong only where required |
| **Ignoring data residency** | GDPR violation for EU data outside EU | Map data types to residency requirements |
| **Active-active without conflict resolution** | Concurrent writes corrupt data | Choose: LWW, vector clocks, or application-specific CRDTs |
| **No region failover** | Region outage takes down global service | Automatic traffic shifting on region health failure |

## 10 Rules

1. Data residency requirements are non-negotiable — map them before designing data placement.
2. Cross-region latency is 50-200ms — design async; never block on cross-region calls.
3. Active-active requires a conflict resolution strategy — decide upfront, not after the first conflict.
4. Follow-the-sun routing reduces latency for globally distributed user bases.
5. Global data (product catalog, reference data) is replicated; user data follows the user.
6. GeoDNS is the first routing layer — steer users to the nearest healthy region.
7. Test region failover quarterly — untested failover is not failover.
8. Eventual consistency is the reality for active-active — design the application to accept it.
9. User's "home region" is determined at account creation — moving it is a migration, not a config change.
10. Cross-region writes are expensive — minimise them; batch where possible.
