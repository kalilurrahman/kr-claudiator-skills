---
name: async-api-design
description: Design asynchronous API patterns for long-running operations, webhooks, and event-driven integrations. Outputs polling endpoints, webhook delivery, callback patterns, and async job management.
argument-hint: [operation duration, client types, reliability requirements, event volume]
allowed-tools: Read, Write
---

# Async API Design

Synchronous APIs work when operations complete in under a few seconds. For longer operations — AI inference, video processing, bulk imports — async APIs decouple request acceptance from result delivery. The three patterns are polling, webhooks, and server-sent events.

## Pattern 1: Job-Based Polling (Most Reliable)

```python
from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from enum import Enum
import uuid
from datetime import datetime

app = FastAPI()

class JobStatus(str, Enum):
    PENDING    = "pending"
    PROCESSING = "processing"
    COMPLETED  = "completed"
    FAILED     = "failed"

# Submit operation → get job ID
@app.post("/api/v1/exports", status_code=202)
async def submit_export(request: ExportRequest,
                         background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())

    await jobs_store.create({
        "job_id": job_id,
        "status": JobStatus.PENDING,
        "created_at": datetime.utcnow().isoformat(),
        "input": request.dict(),
    })

    background_tasks.add_task(run_export_job, job_id, request)

    return {
        "job_id": job_id,
        "status": "pending",
        "poll_url": f"/api/v1/jobs/{job_id}",
        "estimated_duration_seconds": 60,
    }

# Poll for status
@app.get("/api/v1/jobs/{job_id}")
async def get_job_status(job_id: str):
    job = await jobs_store.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    response = {
        "job_id": job_id,
        "status": job["status"],
        "created_at": job["created_at"],
        "updated_at": job.get("updated_at"),
    }

    if job["status"] == JobStatus.COMPLETED:
        response["result"] = {"download_url": job["result_url"], "expires_in": 3600}

    if job["status"] == JobStatus.FAILED:
        response["error"] = job.get("error_message")

    # Retry-After header guides polling interval
    from fastapi.responses import JSONResponse
    headers = {}
    if job["status"] in [JobStatus.PENDING, JobStatus.PROCESSING]:
        headers["Retry-After"] = "5"  # Poll again in 5 seconds

    return JSONResponse(content=response, headers=headers)

# Cancel a pending/processing job
@app.delete("/api/v1/jobs/{job_id}", status_code=204)
async def cancel_job(job_id: str):
    job = await jobs_store.get(job_id)
    if not job:
        raise HTTPException(404)
    if job["status"] not in [JobStatus.PENDING, JobStatus.PROCESSING]:
        raise HTTPException(409, f"Cannot cancel job in status: {job['status']}")
    await jobs_store.update(job_id, {"status": "cancelled"})
```

## Pattern 2: Webhook Delivery

```python
import httpx
import asyncio
import json
from datetime import datetime

class WebhookDeliveryService:
    MAX_ATTEMPTS = 5
    BACKOFF_SECONDS = [1, 5, 30, 120, 600]  # Exponential backoff

    async def deliver(self, webhook_url: str, event: dict,
                      secret: str, attempt: int = 1) -> bool:
        payload = json.dumps(event, default=str)
        timestamp = int(datetime.utcnow().timestamp())

        # HMAC signature
        import hmac, hashlib
        sig = hmac.new(
            secret.encode(),
            f"{timestamp}.{payload}".encode(),
            hashlib.sha256
        ).hexdigest()

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    webhook_url,
                    content=payload,
                    headers={
                        "Content-Type": "application/json",
                        "X-Webhook-Signature": f"t={timestamp},v1={sig}",
                        "X-Webhook-Attempt": str(attempt),
                    },
                    timeout=5.0,
                )

            if 200 <= resp.status_code < 300:
                return True  # Success

            # 4xx: don't retry (client error)
            if 400 <= resp.status_code < 500:
                await self.log_permanent_failure(webhook_url, event, resp.status_code)
                return False

        except (httpx.TimeoutException, httpx.ConnectError):
            pass  # Fall through to retry

        # Retry on 5xx or network error
        if attempt < self.MAX_ATTEMPTS:
            delay = self.BACKOFF_SECONDS[attempt - 1]
            await asyncio.sleep(delay)
            return await self.deliver(webhook_url, event, secret, attempt + 1)

        await self.log_permanent_failure(webhook_url, event, "max_retries_exceeded")
        return False
```

## Pattern 3: Server-Sent Events (SSE)

```python
from fastapi.responses import StreamingResponse
import asyncio

@app.get("/api/v1/jobs/{job_id}/stream")
async def stream_job_progress(job_id: str):
    """SSE stream for real-time job progress updates."""
    async def event_generator():
        while True:
            job = await jobs_store.get(job_id)
            if not job:
                yield f"event: error
data: {json.dumps({'error': 'not found'})}

"
                break

            yield f"event: progress
data: {json.dumps({'status': job['status'], 'progress': job.get('progress', 0)})}

"

            if job["status"] in [JobStatus.COMPLETED, JobStatus.FAILED]:
                yield f"event: {job['status']}
data: {json.dumps(job.get('result', {}))}

"
                break

            await asyncio.sleep(2)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering
        }
    )
```

## Client-Side Polling Pattern

```typescript
// TypeScript client: poll until job completes
async function pollJobResult(jobId: string, maxWaitMs = 300_000): Promise<JobResult> {
  const start = Date.now();
  let pollIntervalMs = 1000;

  while (Date.now() - start < maxWaitMs) {
    const response = await fetch(`/api/v1/jobs/${jobId}`);
    const job = await response.json();

    if (job.status === "completed") return job.result;
    if (job.status === "failed") throw new Error(job.error);

    // Respect Retry-After header if present
    const retryAfter = response.headers.get("Retry-After");
    pollIntervalMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(pollIntervalMs * 1.5, 30_000);

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Job ${jobId} did not complete within ${maxWaitMs}ms`);
}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No Retry-After header** | Clients poll at maximum rate; unnecessary load | Return Retry-After header with recommended interval |
| **Webhook without signature** | Any attacker can send fake events | HMAC-SHA256 signature on every webhook |
| **No webhook retry** | Transient failures cause missed events | Exponential backoff with 5 attempts |
| **Polling without timeout** | Client polls forever on stuck job | Set maximum polling duration; return job status |
| **No job cancellation** | Users can't stop stuck jobs | DELETE endpoint cancels pending/processing jobs |

## 10 Rules

1. Return 202 Accepted immediately — never make clients wait more than 5 seconds.
2. Every job has a stable, predictable poll URL derived from the job ID.
3. Return `Retry-After` header to guide polling cadence — not every second.
4. Webhooks are signed with HMAC-SHA256 — consumers verify before processing.
5. Webhook delivery retries with exponential backoff — transient failures are expected.
6. 4xx webhook responses are not retried — they indicate a client configuration error.
7. Jobs are cancellable while pending or processing.
8. Job results are accessible via poll URL for at least 24 hours after completion.
9. SSE is preferred over long-polling for progress streams — it is more efficient.
10. Webhook event schemas are versioned — breaking changes require new event types.
