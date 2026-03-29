---
name: model-serving-infrastructure
description: Design and deploy ML model serving infrastructure for low-latency production inference. Outputs serving architecture, batching strategy, scaling configuration, and SLO monitoring.
argument-hint: [model size, latency SLA, throughput requirement, hardware constraints, cloud provider]
allowed-tools: Read, Write
---

# Model Serving Infrastructure

Model serving is operationally different from web serving: models are memory-hungry, compute-intensive, and require hardware-aware deployment (GPUs/TPUs). The serving layer must balance latency (small batches, fast response) against throughput (large batches, efficient GPU utilisation).

## Architecture Options

```
OPTION 1: Cloud-managed inference (simplest)
  AWS SageMaker Inference | GCP Vertex AI | Azure ML
  Pros: No infrastructure management; auto-scaling
  Cons: Expensive; limited hardware control; cold starts
  Use: Smaller teams; variable traffic

OPTION 2: Self-hosted on GPU instances
  Triton Inference Server | TorchServe | vLLM
  Pros: Full control; cost efficient at scale; no cold starts
  Cons: Operational complexity; GPU management
  Use: High-throughput; cost-sensitive; specific hardware needs

OPTION 3: Serverless GPU (modal.com, Replicate)
  Pros: Scale-to-zero; no idle GPU cost
  Cons: Cold start latency (10-30s); limited customisation
  Use: Low-traffic; batch inference; experimentation
```

## vLLM Server (LLM Serving)

```python
# vllm_server.py — high-throughput LLM serving with continuous batching
from vllm import AsyncLLMEngine, AsyncEngineArgs, SamplingParams
from fastapi import FastAPI
from pydantic import BaseModel
import asyncio
import uuid

app = FastAPI()

# Engine configuration
engine_args = AsyncEngineArgs(
    model="meta-llama/Llama-3-8B-Instruct",
    tensor_parallel_size=2,     # Split across 2 GPUs
    gpu_memory_utilization=0.90, # Use 90% of GPU memory for KV cache
    max_model_len=8192,
    max_num_batched_tokens=32768,  # Continuous batching budget
    enable_prefix_caching=True,    # Cache common prefixes (system prompts)
)

engine = AsyncLLMEngine.from_engine_args(engine_args)

class CompletionRequest(BaseModel):
    prompt: str
    max_tokens: int = 512
    temperature: float = 0.7
    top_p: float = 0.95

@app.post("/v1/completions")
async def complete(request: CompletionRequest):
    sampling_params = SamplingParams(
        max_tokens=request.max_tokens,
        temperature=request.temperature,
        top_p=request.top_p,
    )

    request_id = str(uuid.uuid4())
    results_generator = engine.generate(
        request.prompt,
        sampling_params,
        request_id,
    )

    final_output = None
    async for output in results_generator:
        final_output = output

    return {
        "id": request_id,
        "text": final_output.outputs[0].text,
        "tokens_generated": len(final_output.outputs[0].token_ids),
    }
```

## Triton Inference Server (Non-LLM Models)

```python
# model_repository/classifier/config.pbtxt
"""
name: "classifier"
backend: "python"
max_batch_size: 64
input [{ name: "INPUT", data_type: TYPE_STRING, dims: [-1] }]
output [{ name: "OUTPUT", data_type: TYPE_FP32, dims: [10] }]
dynamic_batching {
  preferred_batch_size: [16, 32, 64]
  max_queue_delay_microseconds: 5000  # Wait up to 5ms to fill a batch
}
instance_group [{ count: 2, kind: KIND_GPU }]
"""

# model_repository/classifier/1/model.py
import triton_python_backend_utils as pb_utils
import numpy as np
import torch

class TritonPythonModel:
    def initialize(self, args):
        self.model = torch.load("model.pt")
        self.model.eval().cuda()

    def execute(self, requests):
        responses = []
        for request in requests:
            texts = pb_utils.get_input_tensor_by_name(request, "INPUT").as_numpy()
            inputs = self.tokenize(texts)
            with torch.no_grad():
                logits = self.model(**inputs).logits
            probs = torch.softmax(logits, dim=-1).cpu().numpy()
            output = pb_utils.Tensor("OUTPUT", probs.astype(np.float32))
            responses.append(pb_utils.InferenceResponse([output]))
        return responses
```

## Kubernetes Deployment for GPU Workloads

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-inference
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: vllm
          image: vllm/vllm-openai:latest
          resources:
            limits:
              nvidia.com/gpu: "2"    # 2 GPUs per pod
              memory: "80Gi"
            requests:
              memory: "60Gi"
          env:
            - name: HUGGING_FACE_HUB_TOKEN
              valueFrom:
                secretKeyRef:
                  name: hf-token
                  key: token
          command: ["python", "-m", "vllm.entrypoints.openai.api_server"]
          args:
            - "--model=meta-llama/Llama-3-8B-Instruct"
            - "--tensor-parallel-size=2"
            - "--gpu-memory-utilization=0.90"
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 60
            periodSeconds: 10
      nodeSelector:
        cloud.google.com/gke-accelerator: nvidia-l4

---
# Horizontal Pod Autoscaler based on GPU utilisation
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: llm-inference-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: llm-inference
  minReplicas: 1
  maxReplicas: 10
  metrics:
    - type: External
      external:
        metric:
          name: custom.googleapis.com/inference/queue_depth
        target:
          type: AverageValue
          averageValue: "10"  # Scale when >10 requests queued per pod
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Serving one request at a time** | GPU underutilised; low throughput | Dynamic batching or continuous batching |
| **No warm pool** | Cold starts dominate latency | Keep minimum pods warm; provisioned concurrency |
| **Oversized batches** | Tail latency explodes | Profile batch size vs latency tradeoff |
| **Single model per GPU** | GPU memory underutilised | Multiple model instances or tensor parallelism |
| **No request timeout** | Stuck requests block the queue | 30s timeout on all inference requests |

## 10 Rules

1. Dynamic batching is mandatory — serving one request at a time wastes GPU.
2. Measure GPU utilisation and memory — both are constraints in serving.
3. Latency SLO drives hardware choice — A100 for low-latency; T4 for cost-sensitive batch.
4. Continuous batching (vLLM) dramatically increases LLM throughput.
5. Model warm-up: first inference is always slow — don't count it in latency measurements.
6. Tensor parallelism splits large models across GPUs — 70B+ models require it.
7. Prefix caching dramatically reduces cost for repeated system prompts.
8. Autoscale on queue depth — not CPU/memory which are GPU workload proxies.
9. Rolling deployments for model updates — never stop all instances at once.
10. Monitor: p50/p95/p99 latency, GPU util, throughput, error rate, queue depth.
