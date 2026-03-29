---
name: consensus-algorithms
description: Understand and apply distributed consensus algorithms for leader election, distributed locks, and consistent state. Outputs algorithm selection guide, Raft/Paxos explanation, implementation patterns, and failure scenario analysis.
argument-hint: [cluster size, consistency requirements, network characteristics, failure tolerance]
allowed-tools: Read, Write
---

# Consensus Algorithms

Consensus algorithms allow distributed nodes to agree on a single value even when some nodes fail. They underpin leader election, distributed locks, configuration management, and any system requiring strong consistency across replicas. Understanding consensus is essential for understanding Kubernetes, etcd, ZooKeeper, and Kafka.

## The Consensus Problem

```
CHALLENGE:
  N nodes must agree on a value
  Any node can fail (crash or network partition)
  No shared memory; only message passing

SAFETY requirements (what must never happen):
  Only a single value is decided
  A decided value was proposed by some node

LIVENESS requirement (what must eventually happen):
  Some value is eventually decided
  (Not guaranteed during partition — see CAP theorem)

CAP Theorem:
  Consistency (linearisability) + Availability + Partition Tolerance
  Choose 2. Consensus algorithms choose CP — consistency over availability.
```

## Raft (Most Understandable)

```
RAFT ROLES:
  Leader:    Receives writes; replicates to followers
  Follower:  Passively replicate from leader
  Candidate: Seeking election; in between leader terms

LEADER ELECTION:
  1. All nodes start as followers with random election timeout (150-300ms)
  2. If no heartbeat received before timeout → become Candidate
  3. Increment term; vote for self; request votes from peers
  4. Win majority → become Leader for this term
  5. Send heartbeats to prevent new elections

LOG REPLICATION:
  1. Leader receives write; appends to its log
  2. Leader sends AppendEntries to all followers
  3. Followers append to their log; acknowledge
  4. When majority acknowledge → entry is committed
  5. Leader notifies followers of commit; they apply to state machine

KEY PROPERTIES:
  - Leader has all committed entries (election guarantee)
  - Committed entries never overwritten
  - At most one leader per term
```

## etcd — Raft in Practice

```python
import etcd3
import time
import threading

# etcd uses Raft internally; provides distributed KV with watches

class DistributedLock:
    """Leader election / mutual exclusion using etcd leases."""

    def __init__(self, etcd_endpoints: list[str], lock_name: str, ttl: int = 30):
        self.client = etcd3.client(host=etcd_endpoints[0].split(":")[0],
                                    port=int(etcd_endpoints[0].split(":")[1]))
        self.lock_name = f"/locks/{lock_name}"
        self.ttl = ttl
        self._lease = None
        self._acquired = False
        self._keepalive_thread = None

    def acquire(self, timeout: float = None) -> bool:
        """Try to acquire the lock. Returns True if acquired."""
        deadline = time.time() + timeout if timeout else None

        while True:
            # Create a lease (auto-expires if we crash)
            self._lease = self.client.lease(self.ttl)
            lease_id = self._lease.id

            # Try to atomically create the lock key with our lease
            success, _ = self.client.transaction(
                compare=[self.client.transactions.version(self.lock_name) == 0],
                success=[self.client.transactions.put(self.lock_name, "locked",
                                                       lease=self._lease)],
                failure=[],
            )

            if success:
                self._acquired = True
                # Keep lease alive
                self._keepalive_thread = threading.Thread(
                    target=self._keepalive, daemon=True
                )
                self._keepalive_thread.start()
                return True

            if deadline and time.time() >= deadline:
                self._lease.revoke()
                return False

            time.sleep(0.1)

    def _keepalive(self):
        """Refresh lease to prevent expiry while we hold the lock."""
        for _ in self.client.refresh_lease(self._lease):
            if not self._acquired:
                break

    def release(self):
        """Release the lock by revoking the lease."""
        self._acquired = False
        if self._lease:
            self._lease.revoke()

    def __enter__(self):
        if not self.acquire(timeout=10):
            raise TimeoutError("Could not acquire distributed lock")
        return self

    def __exit__(self, *args):
        self.release()

# Usage
with DistributedLock(["etcd:2379"], "payment-processor", ttl=30) as lock:
    # Only one instance runs this at a time
    process_pending_payments()
```

## Leader Election Pattern

```python
import etcd3
import socket
import time
from typing import Callable

class LeaderElection:
    """
    Continuously tries to become leader.
    Calls on_become_leader() when leader; on_lose_leadership() when not.
    """

    def __init__(self, etcd_client, election_key: str, ttl: int = 15):
        self.client = etcd_client
        self.key = f"/elections/{election_key}"
        self.ttl = ttl
        self.node_id = socket.gethostname()
        self.is_leader = False

    def run(self, on_leader: Callable, on_follower: Callable):
        while True:
            lease = self.client.lease(self.ttl)
            success, _ = self.client.transaction(
                compare=[self.client.transactions.version(self.key) == 0],
                success=[self.client.transactions.put(
                    self.key, self.node_id, lease=lease
                )],
                failure=[],
            )

            if success:
                if not self.is_leader:
                    self.is_leader = True
                    on_leader()
                # Hold leadership while refreshing lease
                try:
                    for _ in self.client.refresh_lease(lease):
                        time.sleep(self.ttl / 3)
                except Exception:
                    pass  # Lost connectivity; will retry
            else:
                if self.is_leader:
                    self.is_leader = False
                    on_follower()
                # Check current leader
                value, _ = self.client.get(self.key)
                leader = value.decode() if value else "unknown"
                print(f"Following leader: {leader}")

            lease.revoke()
            time.sleep(1)
```

## Algorithm Comparison

| Algorithm | Understandability | Performance | Flexibility | Use Case |
|-----------|-------------------|-------------|-------------|---------|
| **Raft** | High | Good | Moderate | etcd, CockroachDB, TiDB |
| **Paxos** | Low | Good | High | Google Chubby, Spanner |
| **Zab (ZooKeeper)** | Medium | Good | Low | Kafka, Hadoop coordination |
| **PBFT** | Very Low | Poor | High | Byzantine fault tolerance |
| **Viewstamped Replication** | Medium | Good | Moderate | Research, some databases |

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Using consensus for high-throughput writes** | Consensus adds latency; not for every write | Consensus for coordination; eventual consistency for data |
| **Single etcd/ZooKeeper node** | Defeats the purpose — no fault tolerance | Minimum 3 nodes (tolerates 1 failure); 5 for 2-failure tolerance |
| **Ignoring network partitions** | Leader may not know it lost leadership | Lease-based approach; leader steps down if lease expires |
| **Rolling your own consensus** | Extremely hard to get right | Use etcd, ZooKeeper, or Consul |
| **Consensus for everything** | Over-engineered; slow | Consensus only for coordination; not for all state |

## 10 Rules

1. Never implement consensus from scratch — use etcd, ZooKeeper, or Consul.
2. Consensus clusters need odd numbers: 3, 5, or 7 nodes.
3. f+1 nodes must be healthy to make progress (f = number of tolerated failures).
4. Raft is correct and understandable — prefer it over Paxos when possible.
5. Leader leases expire — design systems to handle brief leadership gaps.
6. Network partitions cause leader election storms — tune timeouts carefully.
7. etcd is for coordination (locks, leader election, config) — not for large data.
8. Watch APIs (etcd, ZooKeeper) enable reactive systems without polling.
9. Split-brain is the worst failure mode — prefer unavailability over inconsistency.
10. Test consensus behaviour under partition — introduce network failures in staging.
