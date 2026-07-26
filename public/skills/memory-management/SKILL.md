---
name: memory-management
description: Diagnose and resolve memory issues in production systems. Outputs heap analysis, leak detection strategies, GC tuning recommendations, and memory-efficient design patterns.
argument-hint: [language/runtime, symptoms, heap size, GC type]
allowed-tools: Read, Write, Bash
---

# Memory Management

Memory problems manifest as slow leaks, sudden OOM crashes, or GC pauses degrading latency. Fixing them requires understanding allocation patterns, retention paths, and the GC model of your runtime — not just restarting the process.

## Process

1. **Confirm the symptom.** Is it a slow leak, sudden OOM, high GC pause, or high steady-state usage? Each has different causes.
2. **Establish a baseline.** Capture heap size, GC frequency, GC pause duration under normal load.
3. **Take a heap snapshot.** Before and after a suspected leak period. Compare object counts and retained sizes.
4. **Find retention paths.** What is holding a reference to the leaking objects? Walk the reference chain from GC roots.
5. **Fix the root cause.** Don't tune GC as a substitute for fixing leaks.
6. **Tune GC last.** After leaks are fixed, tune heap sizing and GC algorithm for your workload.
7. **Set memory limits explicitly.** Always set container/JVM/Node heap limits. Never rely on defaults in production.

## Heap Snapshot Analysis

```bash
# JVM — trigger heap dump
jmap -dump:format=b,file=heap.hprof <pid>
# Then analyse in Eclipse MAT or VisualVM

# Node.js — heap snapshot via v8
node --inspect app.js
# In Chrome DevTools → Memory → Take Heap Snapshot

# Python — tracemalloc
import tracemalloc
tracemalloc.start()
# ... run suspect code ...
snapshot = tracemalloc.take_snapshot()
top_stats = snapshot.statistics('lineno')
for stat in top_stats[:10]:
    print(stat)

# Go — pprof
import _ "net/http/pprof"
# GET /debug/pprof/heap → download and analyse:
go tool pprof -http=:8080 heap.out
```

## Common Leak Patterns

```python
# LEAK 1: Event listeners never removed
class DataProcessor:
    def __init__(self, event_bus):
        self._handlers = []
        # BAD: lambda captures self, never unregistered
        event_bus.on('data', lambda d: self.process(d))
    
    # FIX: Track and unsubscribe
    def __init__(self, event_bus):
        self._event_bus = event_bus
        self._handler = self._on_data
        event_bus.on('data', self._handler)
    
    def _on_data(self, data):
        self.process(data)
    
    def shutdown(self):
        self._event_bus.off('data', self._handler)

# LEAK 2: Unbounded cache
cache = {}  # grows forever

# FIX: LRU cache with size limit
from functools import lru_cache
from cachetools import LRUCache, cached

cache = LRUCache(maxsize=1000)

@cached(cache)
def expensive_lookup(key):
    return fetch_from_db(key)

# LEAK 3: Thread-local storage not cleared
import threading
_local = threading.local()

def handle_request(user_id):
    _local.user_id = user_id  # set but never cleared
    process()

# FIX: Always clean up
def handle_request(user_id):
    _local.user_id = user_id
    try:
        process()
    finally:
        del _local.user_id  # clean up after request

# LEAK 4: Circular references (pre-Python 3.4 or with __del__)
class Node:
    def __init__(self):
        self.children = []
        self.parent = None  # circular: child → parent → child

# FIX: Use weakref for back-references
import weakref
class Node:
    def __init__(self):
        self.children = []
        self._parent = None
    
    @property
    def parent(self):
        return self._parent() if self._parent else None
    
    @parent.setter
    def parent(self, node):
        self._parent = weakref.ref(node) if node else None
```

## JVM GC Tuning

```bash
# G1GC (default Java 9+) — recommended for most workloads
-XX:+UseG1GC
-Xms4g -Xmx4g          # Set min=max to prevent heap resizing
-XX:MaxGCPauseMillis=200  # Target pause time
-XX:G1HeapRegionSize=16m  # Larger regions for large objects
-XX:InitiatingHeapOccupancyPercent=45

# ZGC — for latency-sensitive (<10ms pauses)
-XX:+UseZGC
-Xmx16g
-XX:ConcGCThreads=4

# GC logging (always enable in production)
-Xlog:gc*:file=/var/log/app/gc.log:time,uptime:filecount=5,filesize=20m

# Diagnose GC issues
# High allocation rate → increase Eden space or reduce object creation
# Long GC pauses → reduce heap size or switch GC algorithm
# Frequent full GC → likely leak or undersized old gen

# G1GC problem flags
-XX:+PrintGCDetails        # Detailed GC logs
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/tmp/heapdump.hprof
```

## Node.js Memory Management

```javascript
// Set heap limit explicitly (default is ~1.5GB)
// node --max-old-space-size=4096 app.js

// Monitor heap in code
function logMemory() {
  const used = process.memoryUsage();
  console.log({
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
    external: `${Math.round(used.external / 1024 / 1024)}MB`,
    rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
  });
}

// Detect leaks — heap growing between GC cycles
const v8 = require('v8');
setInterval(() => {
  const stats = v8.getHeapStatistics();
  if (stats.used_heap_size > stats.heap_size_limit * 0.85) {
    console.warn('Heap usage >85% — possible leak');
  }
}, 30000);

// Stream large datasets — never buffer entire result
// BAD
async function exportAll() {
  const rows = await db.query('SELECT * FROM events'); // millions of rows
  return JSON.stringify(rows); // OOM
}

// GOOD
async function exportAll(res) {
  const stream = db.queryStream('SELECT * FROM events');
  stream.pipe(new JSONTransformStream()).pipe(res);
}
```

## Go Memory Profiling

```go
package main

import (
    "net/http"
    _ "net/http/pprof"
    "runtime"
)

func main() {
    // Enable pprof endpoint
    go http.ListenAndServe(":6060", nil)
    
    // Manual GC stats
    var m runtime.MemStats
    runtime.ReadMemStats(&m)
    fmt.Printf("Alloc: %v MB\n", m.Alloc/1024/1024)
    fmt.Printf("Sys: %v MB\n", m.Sys/1024/1024)
    fmt.Printf("NumGC: %v\n", m.NumGC)
}

// Capture and analyse:
// go tool pprof http://localhost:6060/debug/pprof/heap
// go tool pprof http://localhost:6060/debug/pprof/goroutine  # goroutine leaks

// Common Go leak: goroutines blocked on channels that never close
func leaky(ch <-chan int) {
    go func() {
        for v := range ch { // goroutine leaks if ch never closed
            process(v)
        }
    }()
}

// Fix: use context cancellation
func fixed(ctx context.Context, ch <-chan int) {
    go func() {
        for {
            select {
            case <-ctx.Done():
                return
            case v, ok := <-ch:
                if !ok { return }
                process(v)
            }
        }
    }()
}
```

## Memory-Efficient Design Patterns

| Pattern | When to Use | Memory Saving |
|---------|-------------|--------------|
| **Object pooling** | Frequent allocation/deallocation of same-size objects | Eliminates GC pressure |
| **Flyweight** | Many objects sharing common state | Share immutable state |
| **Lazy loading** | Large objects not always needed | Defer until accessed |
| **Streaming** | Processing large datasets | O(1) instead of O(n) memory |
| **Off-heap storage** | JVM: large caches that cause GC | Bypass GC entirely |
| **Weak references** | Caches that should yield under pressure | Auto-eviction by GC |

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Infinite in-memory cache** | Grows until OOM | LRU/TTL eviction |
| **Unsubscribed listeners** | Event handlers hold object graphs alive | Explicit lifecycle/teardown |
| **Large object graphs in sessions** | HTTP sessions retaining megabytes per user | Store only session IDs; fetch from cache |
| **Heap dumps in prod without trigger** | Performance hit, disk fill | Only on OOM or explicit operator trigger |
| **GC tuning before fixing leaks** | Masks root cause | Fix leaks first |
| **Unbounded queues** | Worker queues grow under load | Bounded queues with backpressure |
| **String interning abuse** | Interned strings never GC'd | Only intern truly global constants |

## 10 Rules

1. Always set explicit memory limits — never rely on OS defaults in production.
2. Heap growth between GC cycles is a leak. Heap growth within a cycle is normal allocation.
3. Fix leaks before tuning GC. GC tuning on a leaky app is rearranging deck chairs.
4. Profile under production-representative load — synthetic tests undercount real leaks.
5. Stream large datasets; never buffer them in memory.
6. Weak references are the right tool for caches. Strong references keep objects alive forever.
7. Always dispose: close streams, deregister listeners, cancel timers.
8. Pool expensive objects (DB connections, threads, buffers) — create once, reuse many times.
9. Set heap dump on OOM in every JVM process — you need the evidence post-mortem.
10. Memory and latency are linked — high GC pause = latency spike. Monitor both together.
