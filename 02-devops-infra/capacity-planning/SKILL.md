---
name: capacity-planning
description: Plan infrastructure capacity for current and future load. Outputs resource projections, scaling thresholds, cost forecasts, and capacity headroom recommendations.
argument-hint: [service type, current utilisation, growth rate, peak patterns]
allowed-tools: Read, Write, Bash
---

# Capacity Planning

Capacity planning prevents two failure modes: running out of capacity (outage) and over-provisioning (wasted budget). It requires knowing your current utilisation, your growth trajectory, your scaling behaviour, and your traffic patterns.

## Process

1. **Baseline current utilisation.** CPU, memory, disk, network, DB connections — at p50, p95, and peak.
2. **Model growth.** Historical growth rate + business forecast. Project 3, 6, 12 months.
3. **Identify scaling constraints.** What breaks first as load grows? Stateless services scale horizontally; databases, queues, and storage need different strategies.
4. **Define capacity thresholds.** Target utilisation ceiling (typically 60-70% CPU, 80% memory) to maintain headroom for spikes.
5. **Run load tests.** Confirm the system behaves as expected at 2× and 5× current load.
6. **Calculate cost projections.** Align capacity plan with budget cycle.
7. **Set automated scaling.** HPA, ASG, database read replicas — capacity responds to load automatically where possible.
8. **Review quarterly.** Actual vs forecast. Adjust the model.

## Baseline Metrics Collection

```bash
# Kubernetes — current resource utilisation
kubectl top pods -n production --sort-by=cpu
kubectl top nodes

# Utilisation vs requests/limits
kubectl get pods -n production -o json | python3 -c "
import json, sys
pods = json.load(sys.stdin)['items']
for p in pods:
    for c in p['spec']['containers']:
        r = c.get('resources', {})
        print(f\"{p['metadata']['name']}/{c['name']}: \
cpu_req={r.get('requests',{}).get('cpu','?')} \
mem_req={r.get('requests',{}).get('memory','?')} \
cpu_lim={r.get('limits',{}).get('cpu','?')}\")
"

# PostgreSQL connection utilisation
psql -c "
SELECT count(*) as active,
       max_conn,
       round(count(*) * 100.0 / max_conn, 1) as pct_used
FROM pg_stat_activity, (SELECT setting::int AS max_conn FROM pg_settings WHERE name='max_connections') mc
WHERE state != 'idle'
GROUP BY max_conn;"

# Disk I/O saturation
iostat -xz 1 10

# Network throughput
sar -n DEV 1 10
```

## Capacity Model (Python)

```python
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

class CapacityModel:
    def __init__(self, current_rps: float, current_cpu_pct: float,
                 current_memory_gb: float, monthly_growth_rate: float):
        self.current_rps = current_rps
        self.current_cpu_pct = current_cpu_pct
        self.current_memory_gb = current_memory_gb
        self.monthly_growth = monthly_growth_rate  # e.g. 0.15 = 15%/month
        
        # Capacity threshold — scale before hitting this
        self.cpu_threshold = 0.70
        self.memory_threshold = 0.80
    
    def project(self, months: int) -> pd.DataFrame:
        rows = []
        for m in range(months + 1):
            growth_factor = (1 + self.monthly_growth) ** m
            proj_rps = self.current_rps * growth_factor
            proj_cpu = self.current_cpu_pct * growth_factor
            proj_mem = self.current_memory_gb * growth_factor
            
            # How many replicas needed to stay under threshold?
            replicas_for_cpu = max(1, np.ceil(proj_cpu / (self.cpu_threshold * 100)))
            
            rows.append({
                "month": m,
                "date": datetime.now() + timedelta(days=30*m),
                "projected_rps": round(proj_rps),
                "cpu_pct_per_pod": round(proj_cpu / replicas_for_cpu, 1),
                "memory_gb_per_pod": round(proj_mem / replicas_for_cpu, 2),
                "replicas_needed": int(replicas_for_cpu),
                "cpu_headroom_pct": round(self.cpu_threshold * 100 - proj_cpu / replicas_for_cpu, 1),
                "scaling_required": proj_cpu / replicas_for_cpu > self.cpu_threshold * 100,
            })
        return pd.DataFrame(rows)
    
    def peak_capacity(self, peak_multiplier: float = 3.0) -> dict:
        """Capacity needed for peak (e.g. Black Friday 3× normal)"""
        return {
            "peak_rps": self.current_rps * peak_multiplier,
            "peak_cpu_pct": self.current_cpu_pct * peak_multiplier,
            "peak_replicas": max(1, int(np.ceil(
                self.current_cpu_pct * peak_multiplier / (self.cpu_threshold * 100)
            ))),
        }

# Usage
model = CapacityModel(
    current_rps=500,
    current_cpu_pct=35,
    current_memory_gb=4.2,
    monthly_growth_rate=0.10,
)

projection = model.project(12)
print(projection[['date', 'projected_rps', 'replicas_needed', 'cpu_headroom_pct']].to_string())

peak = model.peak_capacity(peak_multiplier=5.0)
print(f"\nPeak capacity needed: {peak}")
```

## HPA Configuration

```yaml
# Kubernetes HPA — CPU + memory based
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-service-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-service
  minReplicas: 3           # Never below 3 for HA
  maxReplicas: 50          # Capacity ceiling (cost control)
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60   # Scale at 60% — leaves headroom
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 75
    - type: Pods           # Custom metric: requests per pod
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: 200
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30    # Fast scale-up
      policies:
        - type: Percent
          value: 100                    # Double replicas per 15s
          periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300   # Slow scale-down (5min)
      policies:
        - type: Percent
          value: 25
          periodSeconds: 60
```

## Database Capacity Planning

```sql
-- PostgreSQL: table size growth rate
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS data_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

-- Connection pool sizing
-- Max connections should be: (core_count * 2) + effective_spindle_count
-- For PgBouncer pool: target_session_time / avg_query_time = pool_size
```

## Capacity Planning Report Template

```markdown
# Capacity Report: [Service Name]
**Period:** Q1 2025 | **Reviewed:** 2025-01-15 | **Next review:** 2025-04-15

## Current State
| Resource | Current | Target Ceiling | Headroom |
|----------|---------|----------------|----------|
| CPU (avg) | 35% | 70% | 35% |
| Memory (avg) | 62% | 80% | 18% |
| DB connections | 45/200 | 160/200 | 77% |
| Disk (data) | 1.2TB | 4TB | 70% |
| RPS (peak) | 1,200 | — | — |

## Growth Forecast
**Historical rate:** 12% MoM  
**Business forecast:** 15% MoM (new market launch Q2)

| Month | Projected RPS | Replicas Needed | Est. Cost/mo |
|-------|--------------|-----------------|--------------|
| Now   | 1,200        | 6               | $2,400       |
| +3mo  | 1,720        | 9               | $3,600       |
| +6mo  | 2,460        | 13              | $5,200       |
| +12mo | 5,040        | 26              | $10,400      |

## Scaling Actions Required
- [ ] Increase HPA maxReplicas: 20 → 50 before Q2 launch
- [ ] Add PostgreSQL read replica before +3mo milestone (connections approaching 50%)
- [ ] Upgrade Redis to cluster mode at +6mo (memory projection: 85%)
- [ ] Storage auto-scaling: enable for RDS (projected to reach 75% by +4mo)

## Peak Capacity (Black Friday 5×)
- Replicas needed: 30 (current max: 20) — **ACTION REQUIRED**
- DB read replicas needed: 2 additional
- Estimated peak cost: $8,000/day
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Planning only at crisis** | Capacity gaps discovered during incidents | Quarterly review cadence |
| **Ignoring peak patterns** | Steady-state planning misses seasonal spikes | Model 3× and 5× peak scenarios |
| **No load testing** | Model is theoretical; real behaviour differs | Validate projections with load tests |
| **Autoscaling without ceiling** | Runaway scaling = runaway costs | Always set maxReplicas with cost awareness |
| **Scaling before profiling** | Adding capacity masks inefficiency | Profile first; sometimes 10× efficiency gain is possible |
| **DB connection count ignored** | Connection exhaustion before CPU limit | Model connections as a capacity dimension |
| **Annual planning only** | Business changes faster than annual cycles | Monthly data review, quarterly formal planning |

## 10 Rules

1. Establish baselines before projecting — you cannot plan from intuition alone.
2. Growth models include both organic and event-driven (launch, campaigns, seasonal) projections.
3. Plan to 70% CPU utilisation ceiling — 30% headroom absorbs spikes without incident.
4. Database capacity is a separate dimension from compute — connections, IOPS, storage growth.
5. Autoscaling is not a substitute for capacity planning — maxReplicas must be set deliberately.
6. Load test at 2× and 5× current load before every major launch.
7. Cost is part of the capacity plan — capacity without budget approval is just a wish.
8. Review actual vs forecast every quarter — update the growth model if reality diverges.
9. Plan peak capacity separately — Black Friday is not the same problem as daily steady state.
10. Start scaling actions 4–6 weeks before projected threshold is reached — lead time matters.
