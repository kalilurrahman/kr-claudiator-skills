---
name: performance-profiling
description: Profile and optimise application performance using systematic measurement. Outputs hotspot analysis, flame graphs, optimisation recommendations, and before/after benchmarks.
argument-hint: [language, performance symptoms, application type, profiling tools available]
allowed-tools: Read, Write, Bash
---

# Performance Profiling

Performance profiling finds bottlenecks through measurement, not intuition. The golden rule: measure first, optimise second. Guessing wastes time and often optimises the wrong thing. Systematic profiling identifies exactly what to fix.

## Profiling Workflow

```
1. MEASURE — establish baseline (p50, p95, p99 latency; throughput)
2. PROFILE — capture where time is spent (CPU, I/O, memory)
3. ANALYSE — identify top hotspots (the 20% causing 80% of slowness)
4. OPTIMISE — fix one thing at a time
5. VERIFY — measure again; confirm improvement; check for regressions
6. REPEAT — next hotspot
```

## Python Profiling

```python
# CPU profiling with cProfile
import cProfile, pstats, io

def profile_function(fn, *args, **kwargs):
    pr = cProfile.Profile()
    pr.enable()
    result = fn(*args, **kwargs)
    pr.disable()
    
    stream = io.StringIO()
    stats = pstats.Stats(pr, stream=stream)
    stats.sort_stats('cumulative')
    stats.print_stats(20)  # Top 20 functions by cumulative time
    print(stream.getvalue())
    return result

# Run in production-like conditions
profile_function(process_order_batch, orders=test_orders)

# Line-level profiling with line_profiler
# pip install line_profiler
from line_profiler import LineProfiler

lp = LineProfiler()
lp_wrapper = lp(compute_order_totals)
lp_wrapper(orders)
lp.print_stats()
# Shows time per line — pinpoints exact slow line

# Memory profiling
# pip install memory_profiler
from memory_profiler import profile

@profile
def load_large_dataset(filepath):
    # Shows memory usage line by line
    data = pd.read_csv(filepath)
    result = data.groupby("category").sum()
    return result

# Continuous profiling in production (py-spy)
# py-spy top --pid <pid>         # Real-time CPU top
# py-spy record -o profile.svg --pid <pid>  # Flame graph
```

## Node.js Profiling

```javascript
// Built-in profiler
node --prof server.js        // Generate isolate-*.log
node --prof-process isolate-*.log > processed.txt  // Human-readable

// Clinic.js — production-safe profiling
npm install -g clinic
clinic doctor -- node server.js   // Diagnoses: CPU, I/O, memory
clinic flame -- node server.js    // Flame graph
clinic bubbleprof -- node server.js  // Async profiling

// Manual timing with high-resolution timer
const { performance, PerformanceObserver } = require("perf_hooks");

function measureFunction(name, fn) {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  console.log(`${name}: ${(end - start).toFixed(2)}ms`);
  return result;
}

// V8 heap snapshot (Node.js memory leak)
const v8 = require("v8");
const fs = require("fs");

function takeHeapSnapshot(filename) {
  const snapshot = v8.writeHeapSnapshot();
  fs.renameSync(snapshot, filename);
  console.log(`Heap snapshot: ${filename}`);
}
// Load in Chrome DevTools → Memory tab
```

## Go Profiling with pprof

```go
import (
    "net/http"
    _ "net/http/pprof"
    "runtime/pprof"
    "os"
)

// HTTP endpoint profiling
func main() {
    go http.ListenAndServe(":6060", nil)
    // GET http://localhost:6060/debug/pprof/
}

// Capture and analyse
// go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30
// go tool pprof -http=:8080 cpu.prof  → flame graph in browser

// CPU profile in tests
func BenchmarkProcessOrders(b *testing.B) {
    f, _ := os.Create("cpu.prof")
    pprof.StartCPUProfile(f)
    defer pprof.StopCPUProfile()
    
    for i := 0; i < b.N; i++ {
        ProcessOrders(testOrders)
    }
}
// go test -bench=. -cpuprofile=cpu.prof
// go tool pprof cpu.prof
```

## Database Query Analysis

```sql
-- PostgreSQL: find slow queries
SELECT query, calls, mean_exec_time, total_exec_time, rows,
       100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- EXPLAIN ANALYZE — actual execution plan
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT o.*, c.email
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.status = 'pending'
  AND o.created_at > NOW() - INTERVAL '7 days';

-- Look for: Seq Scan on large table → add index
-- Look for: Nested Loop with large row estimates → check join order
-- Look for: high "Buffers: shared hit" ratio → good; low → disk reads

-- Add missing index
CREATE INDEX CONCURRENTLY idx_orders_status_created
ON orders(status, created_at)
WHERE status = 'pending';  -- Partial index — smaller, faster
```

## Benchmark Framework

```python
# benchmarks/test_order_processing.py
import pytest
import time
import statistics

class Benchmark:
    def __init__(self, name: str, iterations: int = 100):
        self.name = name
        self.iterations = iterations
        self.times = []

    def __enter__(self):
        self._start = time.perf_counter()
        return self

    def __exit__(self, *args):
        self.times.append(time.perf_counter() - self._start)

    def run(self, fn, *args, **kwargs):
        for _ in range(self.iterations):
            with self:
                fn(*args, **kwargs)
        return self.report()

    def report(self) -> dict:
        sorted_times = sorted(self.times)
        return {
            "name": self.name,
            "iterations": self.iterations,
            "mean_ms": statistics.mean(self.times) * 1000,
            "p50_ms": sorted_times[int(len(sorted_times) * 0.50)] * 1000,
            "p95_ms": sorted_times[int(len(sorted_times) * 0.95)] * 1000,
            "p99_ms": sorted_times[int(len(sorted_times) * 0.99)] * 1000,
        }

def test_order_processing_performance():
    b = Benchmark("process_order_batch", iterations=200)
    report = b.run(process_order_batch, test_orders[:100])
    print(report)
    assert report["p99_ms"] < 100, f"p99 {report['p99_ms']:.1f}ms exceeds 100ms target"
```

## Common Hotspots and Fixes

| Hotspot | Symptom | Fix |
|---------|---------|-----|
| N+1 DB queries | 1 query per item in loop | Batch query / eager load |
| Missing DB index | Seq Scan in EXPLAIN | Add index on filter/join column |
| Serialisation overhead | JSON encode/decode in hot path | Cache serialised form; use faster lib (orjson) |
| GC pressure | High GC pause rate | Object pooling; reduce allocation rate |
| Synchronous I/O in async code | Event loop blocked | asyncio.run_in_executor for blocking calls |
| Repeated expensive computation | Same calculation each request | Memoisation / cache |

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Optimising before measuring** | Fixing the wrong thing | Always profile first |
| **Micro-benchmarking in isolation** | Lab results don't match production | Profile under realistic load |
| **Optimising without baseline** | Can't prove improvement | Record baseline metrics before any changes |
| **One giant optimisation** | Hard to isolate which change helped | One change at a time; measure after each |
| **Ignoring I/O** | Fixing CPU while I/O is the bottleneck | Profile I/O separately (iostat, strace) |

## 10 Rules

1. Measure before optimising — intuition is usually wrong.
2. Establish a baseline with production-representative load before any changes.
3. Fix the biggest bottleneck first — the Pareto principle applies to performance.
4. Make one change at a time — verify it helped before the next change.
5. Profile the full stack — app, queries, network, and cache together.
6. N+1 query patterns are the most common database performance killer — fix them first.
7. Flame graphs reveal call chains, not just hot functions — use them for complex code.
8. Benchmarks live in the codebase — run them in CI to catch regressions.
9. p99 matters more than mean — the slowest requests are often the user-visible ones.
10. Accept "good enough" — premature optimisation is the root of all evil.
