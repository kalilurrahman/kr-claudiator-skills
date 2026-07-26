---
name: concurrency-patterns
description: Design safe concurrent systems using appropriate synchronization primitives, async patterns, and parallelism strategies. Covers thread pools, async/await, actors, rate limiting, and common race condition fixes.
argument-hint: [language/runtime, problem type, CPU-bound vs IO-bound, throughput requirements]
allowed-tools: Read, Write, Bash
---

# Concurrency Patterns

Concurrency bugs are among the hardest to reproduce and debug. The goal is not to write clever concurrent code -- it is to write code where concurrency concerns are isolated, primitives are used correctly, and failure modes are explicit.

## Concurrency vs Parallelism

| Concept | Definition | When to use |
|---------|-----------|------------|
| Concurrency | Multiple tasks making progress (possibly interleaved) | IO-bound work: network, disk, DB |
| Parallelism | Multiple tasks running simultaneously on multiple cores | CPU-bound work: computation, data processing |
| Async/await | Single-threaded concurrency via event loop | IO-bound; Python asyncio, JS, Rust tokio |
| Thread pool | Multiple threads sharing work | IO or CPU bound; Java, Go, Python threading |
| Process pool | Multiple OS processes (bypass GIL) | CPU-bound in Python |
| Actor model | Isolated units communicating via messages | Complex stateful concurrent systems |

## Process

1. **Classify the work** -- IO-bound or CPU-bound? This determines the right primitive.
2. **Identify shared mutable state** -- every shared variable is a potential race condition.
3. **Choose the isolation strategy** -- eliminate sharing, use immutable data, or synchronize access.
4. **Select the concurrency primitive** -- mutex, semaphore, queue, channel, or actor.
5. **Implement with structured concurrency** -- ensure all tasks are properly awaited/joined.
6. **Add timeouts everywhere** -- no network call or lock acquisition without a timeout.
7. **Handle cancellation** -- tasks must be cleanly cancellable.
8. **Test for races** -- use race detectors (Go -race, ThreadSanitizer) and stress tests.
9. **Monitor concurrency health** -- queue depth, worker saturation, lock contention metrics.

## Core Patterns

### Thread Pool -- Bounded worker threads for IO-bound work

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

def fetch_url(url: str) -> dict:
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return {"url": url, "status": resp.status_code, "size": len(resp.content)}

urls = ["https://api.example.com/users/" + str(i) for i in range(100)]

# Bounded pool -- never spawn unbounded threads
with ThreadPoolExecutor(max_workers=20) as executor:
    futures = {executor.submit(fetch_url, url): url for url in urls}
    results, errors = [], []
    for future in as_completed(futures, timeout=60):
        url = futures[future]
        try:
            results.append(future.result())
        except Exception as e:
            errors.append({"url": url, "error": str(e)})

print(f"Success: {len(results)}, Failed: {len(errors)}")
```

### Process Pool -- Parallelism for CPU-bound work (bypasses Python GIL)

```python
from concurrent.futures import ProcessPoolExecutor
import numpy as np

def compute_stats(chunk: list) -> dict:
    arr = np.array(chunk)
    return {"mean": arr.mean(), "std": arr.std(), "max": arr.max()}

data_chunks = [list(range(i, i+10000)) for i in range(0, 100000, 10000)]

with ProcessPoolExecutor(max_workers=4) as executor:
    results = list(executor.map(compute_stats, data_chunks))
```

### Async/Await -- Single-threaded IO concurrency

```python
import asyncio
import aiohttp
from typing import List

async def fetch(session: aiohttp.ClientSession, url: str) -> dict:
    async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
        data = await resp.json()
        return {"url": url, "data": data}

async def fetch_all(urls: List[str]) -> List[dict]:
    async with aiohttp.ClientSession() as session:
        # Run all requests concurrently; collect results and errors
        tasks = [fetch(session, url) for url in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    successes = [r for r in results if not isinstance(r, Exception)]
    failures  = [r for r in results if isinstance(r, Exception)]
    print(f"Success: {len(successes)}, Failed: {len(failures)}")
    return successes

# Rate-limited async fetcher
async def fetch_with_semaphore(urls: List[str], max_concurrent: int = 10):
    sem = asyncio.Semaphore(max_concurrent)  # at most 10 in-flight at once

    async def bounded_fetch(session, url):
        async with sem:
            return await fetch(session, url)

    async with aiohttp.ClientSession() as session:
        tasks = [bounded_fetch(session, url) for url in urls]
        return await asyncio.gather(*tasks, return_exceptions=True)
```

### Mutex -- Protect shared mutable state

```python
import threading
from collections import defaultdict

class RequestCounter:
    """Thread-safe counter -- protects shared dict with a lock."""

    def __init__(self):
        self._counts = defaultdict(int)
        self._lock   = threading.Lock()

    def increment(self, endpoint: str) -> None:
        with self._lock:  # context manager releases lock even on exception
            self._counts[endpoint] += 1

    def get(self, endpoint: str) -> int:
        with self._lock:
            return self._counts[endpoint]

    def snapshot(self) -> dict:
        with self._lock:
            return dict(self._counts)  # return a copy, not the live dict

counter = RequestCounter()
```

### Read-Write Lock -- Concurrent reads, exclusive writes

```python
import threading

class RWLock:
    """Multiple concurrent readers OR one exclusive writer."""

    def __init__(self):
        self._read_ready   = threading.Condition(threading.Lock())
        self._readers      = 0

    def acquire_read(self):
        with self._read_ready:
            self._readers += 1

    def release_read(self):
        with self._read_ready:
            self._readers -= 1
            if self._readers == 0:
                self._read_ready.notify_all()

    def acquire_write(self):
        self._read_ready.acquire()
        while self._readers > 0:
            self._read_ready.wait()

    def release_write(self):
        self._read_ready.release()

# Simpler: use asyncio.Lock for async code, or threading.RLock for reentrant needs
```

### Producer-Consumer Queue -- Decouple work production from processing

```python
import queue
import threading
import time

class WorkerPool:
    def __init__(self, num_workers: int, process_fn):
        self._queue   = queue.Queue(maxsize=1000)  # bounded -- prevents memory explosion
        self._workers = []
        self._process = process_fn
        self._running = True

        for _ in range(num_workers):
            t = threading.Thread(target=self._worker, daemon=True)
            t.start()
            self._workers.append(t)

    def submit(self, item, timeout: float = 5.0) -> bool:
        try:
            self._queue.put(item, timeout=timeout)
            return True
        except queue.Full:
            return False  # back-pressure: caller decides what to do

    def _worker(self):
        while self._running:
            try:
                item = self._queue.get(timeout=1.0)
                try:
                    self._process(item)
                except Exception as e:
                    logging.error(f"Worker error: {e}")
                finally:
                    self._queue.task_done()
            except queue.Empty:
                continue

    def shutdown(self, wait: bool = True):
        self._running = False
        if wait:
            self._queue.join()  # wait for all items to be processed

pool = WorkerPool(num_workers=10, process_fn=send_notification)
pool.submit({"user_id": 42, "message": "Your order shipped"})
```

### Actor Model -- Isolated state, message-passing communication

```python
import asyncio
from dataclasses import dataclass
from typing import Any

@dataclass
class Message:
    type: str
    payload: Any
    reply_to: asyncio.Future = None

class Actor:
    """Each actor processes messages sequentially -- no shared state needed."""

    def __init__(self):
        self._mailbox = asyncio.Queue()
        self._task    = None

    async def start(self):
        self._task = asyncio.create_task(self._run())

    async def stop(self):
        await self._mailbox.put(Message(type="stop", payload=None))
        await self._task

    async def send(self, msg_type: str, payload: Any = None) -> Any:
        future = asyncio.get_event_loop().create_future()
        await self._mailbox.put(Message(type=msg_type, payload=payload, reply_to=future))
        return await future

    async def _run(self):
        while True:
            msg = await self._mailbox.get()
            if msg.type == "stop":
                break
            result = await self._handle(msg)
            if msg.reply_to and not msg.reply_to.done():
                msg.reply_to.set_result(result)

    async def _handle(self, msg: Message):
        raise NotImplementedError

class CounterActor(Actor):
    def __init__(self):
        super().__init__()
        self._count = 0  # no locks needed -- only this actor touches this state

    async def _handle(self, msg: Message):
        if msg.type == "increment":
            self._count += 1
        elif msg.type == "get":
            return self._count
```

### Circuit Breaker with Concurrency

```python
import threading, time
from enum import Enum

class State(Enum):
    CLOSED = "closed"       # normal operation
    OPEN   = "open"         # failing; reject immediately
    HALF_OPEN = "half_open" # testing recovery

class CircuitBreaker:
    def __init__(self, failure_threshold=5, timeout=60):
        self._state    = State.CLOSED
        self._failures = 0
        self._lock     = threading.Lock()
        self._threshold = failure_threshold
        self._timeout  = timeout
        self._opened_at = None

    def call(self, fn, *args, **kwargs):
        with self._lock:
            if self._state == State.OPEN:
                if time.time() - self._opened_at > self._timeout:
                    self._state = State.HALF_OPEN
                else:
                    raise RuntimeError("Circuit breaker is OPEN")

        try:
            result = fn(*args, **kwargs)
            with self._lock:
                self._failures = 0
                self._state    = State.CLOSED
            return result
        except Exception:
            with self._lock:
                self._failures += 1
                if self._failures >= self._threshold:
                    self._state    = State.OPEN
                    self._opened_at = time.time()
            raise
```

## Common Race Conditions and Fixes

| Race condition | Example | Fix |
|---------------|---------|-----|
| Check-then-act | `if key not in cache: cache[key] = compute()` | Use `setdefault()` or a lock |
| Read-modify-write | `counter += 1` from two threads | `threading.Lock()` or `threading.atomic` |
| Stale cache | Cache read between write and commit | Cache invalidation with versioning |
| Deadlock | Thread A holds lock 1, waits for lock 2; Thread B vice versa | Always acquire locks in same order |
| Livelock | Two threads keep yielding to each other | Add randomized backoff |
| Thread starvation | Low-priority threads never get CPU | Fair scheduling; bounded queues |

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Unbounded thread spawning | `Thread().start()` in a loop -- OOM or OS limits | Always use a bounded pool |
| No timeout on blocking calls | Thread hangs forever on slow network | Always set timeout on IO operations |
| Shared mutable global state | Race conditions everywhere | Isolate state per task or use queues |
| Catching all exceptions silently | Concurrent errors disappear | Log and re-raise; use future.exception() |
| Non-daemon threads forgotten | Process hangs on exit | Mark worker threads as daemon or shut down explicitly |
| Lock held across IO | Lock held while waiting for network = low throughput | Release lock before IO; use async |

## Rules

- **IO-bound = async or thread pool; CPU-bound = process pool** -- mixing these up wastes resources.
- **Bound every queue and pool** -- unbounded queues cause OOM; set maxsize always.
- **Always set timeouts** -- every blocking call must have a timeout; never wait forever.
- **No shared mutable state without a lock** -- if two threads touch the same variable, it needs protection.
- **Structured concurrency: always join/await** -- leaked tasks cause resource exhaustion and silent errors.
- **Test with race detectors** -- Go -race flag, ThreadSanitizer for C/C++, stress tests for Python.
- **Log concurrent errors with context** -- include worker ID, task ID, and the exception in every error log.
- **Prefer message passing over shared memory** -- queues and channels are safer than shared state.
- **Back-pressure is mandatory** -- producers must have a way to slow down when consumers lag.
- **Deadlock prevention: consistent lock ordering** -- acquire multiple locks in the same order everywhere.
