---
name: batch-processing-api
description: Design APIs for batch data submission, processing, and result retrieval. Outputs async batch endpoint design, progress tracking, error handling, and retry strategy.
argument-hint: [batch size, processing time, client type, failure handling requirements]
allowed-tools: Read, Write
---

# Batch Processing API

Batch APIs process large sets of records that would time out or be inefficient as individual requests. The design challenge is accepting large inputs, processing asynchronously, reporting progress, handling partial failures, and allowing retries without reprocessing already-succeeded items.

## Process

1. **Accept batch synchronously; process asynchronously.** Validate and queue quickly; return a job ID.
2. **Design idempotency.** Client-provided idempotency keys prevent duplicate jobs on retry.
3. **Track per-item results.** Each item in the batch succeeds or fails independently.
4. **Expose progress endpoint.** Clients poll for status and can retrieve partial results.
5. **Handle partial failures.** Return what succeeded; let clients retry only what failed.
6. **Webhook or polling.** Notify on completion or provide polling endpoint.
7. **Set size limits.** Maximum batch size per request; rate limits on batch submission.

## Batch Job API Design

```python
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from enum import Enum
import asyncio
from datetime import datetime
from uuid import UUID, uuid4

app = FastAPI()

class BatchStatus(str, Enum):
    PENDING   = "pending"
    RUNNING   = "running"
    COMPLETED = "completed"
    FAILED    = "failed"
    PARTIAL   = "partial"    # Some items failed

class BatchItem(BaseModel):
    item_id: str             # Client-assigned ID for each item
    data: dict

class BatchRequest(BaseModel):
    items: List[BatchItem] = Field(min_items=1, max_items=1000)
    idempotency_key: str     # Unique per batch submission
    webhook_url: Optional[str] = None   # Notify when complete
    callback_on_partial: bool = True    # Notify even if some items fail

class ItemResult(BaseModel):
    item_id: str
    status: str   # "success" | "failed" | "skipped"
    result: Optional[Any] = None
    error: Optional[str] = None
    processed_at: Optional[datetime] = None

class BatchJobResponse(BaseModel):
    job_id: str
    status: BatchStatus
    total_items: int
    completed_items: int
    failed_items: int
    created_at: datetime
    completed_at: Optional[datetime] = None
    results: Optional[List[ItemResult]] = None  # Included when complete

# Submit batch
@app.post("/api/v1/batches", response_model=BatchJobResponse, status_code=202)
async def submit_batch(
    request: BatchRequest,
    background_tasks: BackgroundTasks,
    claims: dict = Depends(require_auth),
):
    # Idempotency check
    existing = await job_store.get_by_idempotency_key(request.idempotency_key)
    if existing:
        return existing  # Return existing job (safe to call twice)
    
    # Validate all items upfront
    errors = []
    for item in request.items:
        try:
            validate_item(item.data)
        except ValidationError as e:
            errors.append({"item_id": item.item_id, "error": str(e)})
    
    if len(errors) == len(request.items):
        raise HTTPException(422, {"message": "All items invalid", "errors": errors})
    
    # Create job record
    job = BatchJob(
        job_id=str(uuid4()),
        status=BatchStatus.PENDING,
        total_items=len(request.items),
        completed_items=0,
        failed_items=len(errors),
        created_at=datetime.utcnow(),
        idempotency_key=request.idempotency_key,
        webhook_url=request.webhook_url,
        items=request.items,
        pre_validation_errors=errors,
    )
    await job_store.save(job)
    
    # Queue for async processing
    background_tasks.add_task(process_batch, job.job_id)
    
    return BatchJobResponse(
        job_id=job.job_id,
        status=BatchStatus.PENDING,
        total_items=job.total_items,
        completed_items=0,
        failed_items=len(errors),
        created_at=job.created_at,
    )

# Check job status
@app.get("/api/v1/batches/{job_id}", response_model=BatchJobResponse)
async def get_batch_status(job_id: str, include_results: bool = False,
                           claims: dict = Depends(require_auth)):
    job = await job_store.get(job_id)
    if not job:
        raise HTTPException(404, f"Batch job {job_id} not found")
    
    # Only include results when complete (or when requested + running)
    results = None
    if include_results or job.status in [BatchStatus.COMPLETED, BatchStatus.PARTIAL]:
        results = await job_store.get_results(job_id)
    
    return BatchJobResponse(
        job_id=job.job_id,
        status=job.status,
        total_items=job.total_items,
        completed_items=job.completed_items,
        failed_items=job.failed_items,
        created_at=job.created_at,
        completed_at=job.completed_at,
        results=results,
    )

# Get only failed items (for retry)
@app.get("/api/v1/batches/{job_id}/failures")
async def get_failures(job_id: str, claims: dict = Depends(require_auth)):
    job = await job_store.get(job_id)
    if not job:
        raise HTTPException(404)
    
    failures = await job_store.get_results(job_id, status_filter="failed")
    return {
        "job_id": job_id,
        "failed_items": len(failures),
        "failures": failures,
        "retry_hint": "Resubmit only failed items with a new idempotency_key",
    }

# Cancel a pending/running job
@app.delete("/api/v1/batches/{job_id}", status_code=204)
async def cancel_batch(job_id: str, claims: dict = Depends(require_auth)):
    job = await job_store.get(job_id)
    if not job:
        raise HTTPException(404)
    if job.status not in [BatchStatus.PENDING, BatchStatus.RUNNING]:
        raise HTTPException(409, f"Cannot cancel job in status: {job.status}")
    await job_store.update_status(job_id, BatchStatus.FAILED, reason="Cancelled by user")
```

## Background Processing

```python
async def process_batch(job_id: str):
    job = await job_store.get(job_id)
    await job_store.update_status(job_id, BatchStatus.RUNNING)
    
    results = []
    # Process pre-validation errors immediately
    for err in job.pre_validation_errors:
        results.append(ItemResult(
            item_id=err["item_id"],
            status="failed",
            error=err["error"],
            processed_at=datetime.utcnow(),
        ))
    
    # Process valid items
    valid_items = [
        item for item in job.items
        if item.item_id not in {e["item_id"] for e in job.pre_validation_errors}
    ]
    
    # Process in sub-batches to limit memory usage
    SUB_BATCH_SIZE = 100
    completed = len(job.pre_validation_errors)
    failed = len(job.pre_validation_errors)
    
    for i in range(0, len(valid_items), SUB_BATCH_SIZE):
        sub_batch = valid_items[i:i + SUB_BATCH_SIZE]
        
        # Process concurrently within sub-batch
        tasks = [process_single_item(item) for item in sub_batch]
        sub_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for item, result in zip(sub_batch, sub_results):
            if isinstance(result, Exception):
                results.append(ItemResult(
                    item_id=item.item_id,
                    status="failed",
                    error=str(result),
                    processed_at=datetime.utcnow(),
                ))
                failed += 1
            else:
                results.append(ItemResult(
                    item_id=item.item_id,
                    status="success",
                    result=result,
                    processed_at=datetime.utcnow(),
                ))
                completed += 1
        
        # Update progress checkpoint
        await job_store.update_progress(job_id, completed=completed, failed=failed)
        await job_store.save_results(job_id, results[-len(sub_batch):])
    
    # Determine final status
    if failed == 0:
        final_status = BatchStatus.COMPLETED
    elif completed == 0:
        final_status = BatchStatus.FAILED
    else:
        final_status = BatchStatus.PARTIAL
    
    await job_store.update_status(
        job_id, final_status,
        completed_at=datetime.utcnow()
    )
    
    # Webhook notification
    if job.webhook_url:
        if final_status == BatchStatus.COMPLETED or job.callback_on_partial:
            await notify_webhook(job.webhook_url, job_id, final_status)

async def process_single_item(item: BatchItem) -> Any:
    """Process one item — override in application code."""
    # Example: import/transform/validate a record
    result = await external_service.process(item.data)
    return result
```

## Client-Side Retry Pattern

```python
# Client SDK with built-in retry for failed items
import httpx
import time

class BatchAPIClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.headers = {"X-API-Key": api_key, "Content-Type": "application/json"}
    
    def submit_and_wait(self, items: list, timeout: int = 300) -> dict:
        """Submit batch, poll until complete, return results."""
        import uuid
        
        response = httpx.post(
            f"{self.base_url}/api/v1/batches",
            headers=self.headers,
            json={
                "items": items,
                "idempotency_key": str(uuid.uuid4()),
            },
        )
        response.raise_for_status()
        job_id = response.json()["job_id"]
        
        # Poll with exponential backoff
        start = time.time()
        poll_interval = 1
        while time.time() - start < timeout:
            status_resp = httpx.get(
                f"{self.base_url}/api/v1/batches/{job_id}",
                headers=self.headers,
            )
            status = status_resp.json()
            
            if status["status"] in ["completed", "partial", "failed"]:
                # Fetch full results
                result_resp = httpx.get(
                    f"{self.base_url}/api/v1/batches/{job_id}",
                    headers=self.headers,
                    params={"include_results": True},
                )
                return result_resp.json()
            
            time.sleep(min(poll_interval, 30))
            poll_interval *= 1.5  # Exponential backoff
        
        raise TimeoutError(f"Batch job {job_id} did not complete within {timeout}s")
    
    def retry_failures(self, job_id: str) -> dict:
        """Fetch failed items and resubmit."""
        failures_resp = httpx.get(
            f"{self.base_url}/api/v1/batches/{job_id}/failures",
            headers=self.headers,
        )
        failures = failures_resp.json()["failures"]
        
        if not failures:
            return {"message": "No failures to retry"}
        
        # Resubmit only failed items
        retry_items = [{"item_id": f["item_id"], "data": f["original_data"]}
                       for f in failures]
        return self.submit_and_wait(retry_items)
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Synchronous processing** | Request times out for large batches | Accept synchronously, process async; return 202 + job_id |
| **No idempotency key** | Duplicate submissions on client retry | Require idempotency_key; return existing job on duplicate |
| **All-or-nothing batch** | One failure rejects entire batch | Per-item results; partial completion status |
| **No progress polling** | Client has no way to check long-running job | Status endpoint with item-level progress |
| **Unbounded batch size** | Memory exhaustion; slow responses | max_items limit; sub-batch internal processing |
| **No retry endpoint** | Clients re-submit entire batch to fix failures | `/batches/{id}/failures` endpoint for targeted retry |
| **Storing all results in memory** | OOM for large batches | Persist results to DB; stream from DB on retrieval |

## 10 Rules

1. Accept batches synchronously (validate + queue), process asynchronously — return 202 + job_id immediately.
2. Idempotency keys are required — client retries must not create duplicate jobs.
3. Per-item success/failure is the contract — one bad item never fails the entire batch.
4. Progress endpoint updates in real-time — clients need visibility into long-running jobs.
5. Store results incrementally — don't hold all results in memory until complete.
6. Provide a failures endpoint for targeted retry — clients shouldn't re-submit what succeeded.
7. Webhook notification on completion — long-polling is wasteful for very slow jobs.
8. Maximum batch size limits protect the service — document and enforce them clearly.
9. Cancellation is supported for pending and running jobs — clients need an escape hatch.
10. Sub-batch internally to control memory and parallelism — don't process all items simultaneously.
