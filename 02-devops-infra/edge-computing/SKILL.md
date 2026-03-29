---
name: edge-computing
description: Design and deploy edge computing architectures that process data close to the source. Outputs edge node topology, workload placement strategy, synchronisation patterns, and observability approach.
argument-hint: [latency requirements, data volume, edge node constraints, cloud provider, connectivity]
allowed-tools: Read, Write
---

# Edge Computing

Edge computing processes data near its source — at CDN edge nodes, retail locations, factory floors, or IoT devices — rather than sending everything to a central cloud. This reduces latency, bandwidth costs, and dependency on connectivity. The challenge is managing distributed infrastructure that is harder to monitor, update, and debug than centralised systems.

## When to Use Edge

```
USE EDGE when:
  ✓ Latency requirement: <50ms to end user or device
  ✓ Bandwidth is expensive (satellite, cellular data)
  ✓ Data sovereignty: data must not leave a region
  ✓ Offline operation required (factory, retail POS)
  ✓ Real-time processing: video analytics, AR/VR
  ✓ High volume sensor/IoT data needing local filtering

KEEP IN CLOUD when:
  ✗ Complex ML training (GPU-intensive)
  ✗ Historical analytics across all locations
  ✗ Centralised business logic with global data
  ✗ Operations team has no edge experience
```

## Edge Topology Patterns

```
Pattern 1: CDN Edge (Cloudflare Workers, Lambda@Edge)
  User → Edge PoP (compute) → Origin (cloud)
  Best for: Web apps, API acceleration, personalisation
  Latency: <50ms globally
  Constraint: Stateless or short-lived state (KV store)

Pattern 2: Regional Edge (AWS Outposts, Azure Arc)
  Users → Regional cluster (full Kubernetes) → Cloud
  Best for: Data residency, regulated industries
  Latency: <10ms within region
  Constraint: Full DC-like setup at edge location

Pattern 3: Near-Edge (Retail/Factory Kubernetes)
  Devices → On-premises k3s/MicroK8s cluster → Cloud sync
  Best for: Offline-capable, real-time processing
  Latency: <1ms local
  Constraint: Limited hardware, network may be unreliable
```

## Cloudflare Workers (Stateless Edge)

```typescript
// worker.ts — runs at 300+ PoPs globally
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Route: personalise based on user's country
    const country = request.cf?.country ?? "US";
    const region = getRegion(country);

    // Edge caching with KV
    const cacheKey = `${url.pathname}:${country}`;
    const cached = await env.CACHE.get(cacheKey, "json");
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { "Content-Type": "application/json", "X-Cache": "HIT" }
      });
    }

    // Fetch from nearest origin
    const originUrl = `https://${region}.api.example.com${url.pathname}`;
    const response = await fetch(originUrl, {
      headers: { "X-Country": country }
    });
    const data = await response.json();

    // Cache at edge for 60 seconds
    await env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 60 });

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json", "X-Cache": "MISS" }
    });
  }
};

function getRegion(country: string): string {
  const EU = new Set(["GB","DE","FR","NL","SE","IT","ES"]);
  const APAC = new Set(["JP","SG","AU","IN","KR"]);
  if (EU.has(country)) return "eu-west-1";
  if (APAC.has(country)) return "ap-southeast-1";
  return "us-east-1";
}
```

## k3s Cluster on Edge Nodes

```yaml
# k3s on a retail edge node (Raspberry Pi 4 / mini PC)
# Install: curl -sfL https://get.k3s.io | sh -

# Edge workload deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pos-processor
  namespace: edge
spec:
  replicas: 1   # Single replica on edge hardware
  template:
    spec:
      containers:
        - name: processor
          image: registry.example.com/pos-processor:v1.2.3
          resources:
            requests: { cpu: 200m, memory: 256Mi }
            limits:   { cpu: 500m, memory: 512Mi }
          env:
            - name: STORE_ID
              valueFrom:
                configMapKeyRef:
                  name: edge-config
                  key: store_id
            - name: SYNC_INTERVAL
              value: "30s"    # Sync to cloud every 30s

---
# Local SQLite for offline operation
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: local-db
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: local-path
  resources:
    requests:
      storage: 10Gi
```

## Sync Pattern (Edge to Cloud)

```python
# Edge node: buffer locally, sync to cloud when connected
import sqlite3
import httpx
import asyncio
from datetime import datetime

class EdgeSyncManager:
    def __init__(self, store_id: str, cloud_url: str):
        self.store_id = store_id
        self.cloud_url = cloud_url
        self.db = sqlite3.connect("/data/local.db")
        self._setup_db()

    def _setup_db(self):
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS pending_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL,
                synced_at TEXT
            )
        """)

    def record_event(self, event_type: str, payload: dict):
        """Always succeeds — stores locally for later sync."""
        import json
        self.db.execute(
            "INSERT INTO pending_events (event_type, payload, created_at) VALUES (?,?,?)",
            [event_type, json.dumps(payload), datetime.utcnow().isoformat()]
        )
        self.db.commit()

    async def sync_to_cloud(self):
        """Best-effort sync — skips if cloud unreachable."""
        rows = self.db.execute(
            "SELECT id, event_type, payload FROM pending_events WHERE synced_at IS NULL LIMIT 100"
        ).fetchall()

        if not rows:
            return

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self.cloud_url}/api/v1/edge-events",
                    json={"store_id": self.store_id, "events": [
                        {"id": r[0], "type": r[1], "payload": r[2]} for r in rows
                    ]},
                    timeout=10.0,
                )
                resp.raise_for_status()
                ids = [r[0] for r in rows]
                self.db.execute(
                    f"UPDATE pending_events SET synced_at=? WHERE id IN ({','.join('?'*len(ids))})",
                    [datetime.utcnow().isoformat()] + ids
                )
                self.db.commit()
        except Exception:
            pass  # Will retry on next sync cycle
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Assuming connectivity** | Edge nodes lose connectivity regularly | Design for offline-first; sync as best-effort |
| **Deploying to edge without remote management** | Can't update or debug edge nodes at scale | Use Fleet (k3s), ArgoCD multi-cluster, or similar |
| **Stateful workloads at CDN edge** | Workers are ephemeral and stateless | Stateful data in KV store or central DB |
| **No data sovereignty consideration** | Regulated data leaves approved regions | Map data flows before choosing edge topology |
| **No offline fallback** | Edge failure cascades to user | Local processing + cloud sync, not cloud dependency |

## 10 Rules

1. Design for intermittent connectivity — edge nodes lose network and must function offline.
2. Buffer locally, sync eventually — never assume real-time cloud availability.
3. Remote management is mandatory — you cannot visit every edge node to update it.
4. Workload placement is deliberate: latency-sensitive at edge, analytics in cloud.
5. Data sovereignty requirements drive topology — know where each data type can live.
6. Edge hardware is constrained — resource limits are tighter than cloud; test on real hardware.
7. CDN edge (Workers) is stateless — persistent state goes in KV or cloud DB.
8. Monitor edge nodes as first-class infrastructure — uptime, resource usage, sync lag.
9. Staged rollouts apply to edge too — don't push bad code to 500 stores simultaneously.
10. Security is harder at edge — physical access is easier; encrypt everything, rotate credentials.
