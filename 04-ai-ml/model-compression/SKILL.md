---
name: model-compression
description: Compress and optimise ML models for production deployment. Outputs quantisation, pruning, and distillation approaches with size-accuracy tradeoff analysis.
argument-hint: [model type, target platform, latency budget, accuracy tolerance]
allowed-tools: Read, Write, Bash
---

# Model Compression

ML models trained for accuracy are often too large and slow for production. Compression reduces model size and inference latency — often with minimal accuracy loss. The three main techniques are quantisation (lower precision), pruning (removing weights), and distillation (training a smaller model to mimic a larger one).

## Quantisation

```python
import torch
from torch.quantization import quantize_dynamic, prepare_qat, convert
import torch.nn as nn

# POST-TRAINING QUANTISATION (PTQ) — fastest; some accuracy loss
model = load_model("model.pt")

# Dynamic quantisation — quantise weights only; activations computed in float
quantised = quantize_dynamic(
    model,
    {nn.Linear, nn.LSTM},  # Layers to quantise
    dtype=torch.qint8,
)

print(f"Original: {get_model_size(model):.1f}MB")
print(f"Quantised: {get_model_size(quantised):.1f}MB")

# QUANTISATION-AWARE TRAINING (QAT) — best accuracy; requires retraining
from torch.quantization import prepare_qat, convert

model.qconfig = torch.quantization.get_default_qat_qconfig("fbgemm")
prepare_qat(model, inplace=True)

# Fine-tune for a few epochs with quantisation simulation
for epoch in range(5):
    train_one_epoch(model, train_loader)

# Convert to quantised model
model.eval()
quantised_model = convert(model, inplace=False)

# INT4 via bitsandbytes (LLMs)
from transformers import AutoModelForCausalLM
import bitsandbytes as bnb

model_4bit = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-7b-hf",
    load_in_4bit=True,                    # INT4 quantisation
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True,       # Nested quantisation for more savings
    bnb_4bit_quant_type="nf4",            # NormalFloat4 — better for LLM weights
)
```

## Pruning

```python
import torch.nn.utils.prune as prune

def structured_pruning(model, amount: float = 0.3):
    """Remove the least important neurons/filters."""
    for name, module in model.named_modules():
        if isinstance(module, nn.Conv2d):
            # Structured: remove entire filters (maintains dense computation)
            prune.ln_structured(module, name="weight", amount=amount, n=2, dim=0)
        elif isinstance(module, nn.Linear):
            # Unstructured: zero out individual weights (requires sparse support)
            prune.l1_unstructured(module, name="weight", amount=amount)
    return model

def magnitude_pruning_with_finetune(model, target_sparsity: float = 0.5,
                                     train_loader, val_loader, epochs: int = 5):
    """Iterative magnitude pruning with fine-tuning between rounds."""
    rounds = 5
    per_round_sparsity = 1 - (1 - target_sparsity) ** (1/rounds)
    
    for round_num in range(rounds):
        # Prune by weight magnitude
        for module in model.modules():
            if isinstance(module, (nn.Linear, nn.Conv2d)):
                prune.l1_unstructured(module, "weight", amount=per_round_sparsity)
        
        # Fine-tune to recover accuracy
        finetune(model, train_loader, epochs=1)
        
        acc = evaluate(model, val_loader)
        sparsity = get_sparsity(model)
        print(f"Round {round_num+1}: sparsity={sparsity:.1%}, acc={acc:.3f}")
    
    # Make pruning permanent (remove masks)
    for module in model.modules():
        if isinstance(module, (nn.Linear, nn.Conv2d)):
            prune.remove(module, "weight")
    
    return model
```

## Knowledge Distillation

```python
class DistillationTrainer:
    """Train a small student model to mimic a large teacher model."""
    
    def __init__(self, teacher, student, temperature: float = 4.0, alpha: float = 0.7):
        self.teacher = teacher.eval()
        self.student = student
        self.T = temperature          # Higher T = softer probability distributions
        self.alpha = alpha            # Weight of distillation vs task loss
    
    def distillation_loss(self, student_logits, teacher_logits, labels):
        # Task loss: standard cross-entropy with hard labels
        task_loss = F.cross_entropy(student_logits, labels)
        
        # Distillation loss: KL divergence with soft teacher labels
        soft_teacher = F.softmax(teacher_logits / self.T, dim=-1)
        soft_student = F.log_softmax(student_logits / self.T, dim=-1)
        distill_loss = F.kl_div(soft_student, soft_teacher, reduction="batchmean")
        distill_loss *= self.T ** 2  # Scale by T^2 to normalise
        
        return self.alpha * distill_loss + (1 - self.alpha) * task_loss
    
    def train_epoch(self, dataloader, optimiser):
        self.student.train()
        for inputs, labels in dataloader:
            with torch.no_grad():
                teacher_logits = self.teacher(inputs)
            student_logits = self.student(inputs)
            
            loss = self.distillation_loss(student_logits, teacher_logits, labels)
            optimiser.zero_grad()
            loss.backward()
            optimiser.step()
```

## Compression Trade-off Analysis

```python
def compression_benchmark(model, test_loader, device="cpu"):
    techniques = {
        "original":     model,
        "int8_dynamic": quantize_dynamic(model, {nn.Linear}, dtype=torch.qint8),
        "pruned_30":    structured_pruning(copy.deepcopy(model), amount=0.3),
    }
    
    results = {}
    for name, m in techniques.items():
        size_mb = get_model_size(m)
        latency_ms = measure_latency(m, test_loader, device)
        accuracy = evaluate(m, test_loader)
        results[name] = {
            "size_mb": size_mb, "latency_ms": latency_ms, "accuracy": accuracy,
            "size_reduction": 1 - size_mb / get_model_size(model),
            "speedup": measure_latency(model, test_loader) / latency_ms,
        }
    return pd.DataFrame(results).T
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Compressing without benchmarking** | Unknown accuracy degradation | Measure accuracy before/after each technique |
| **One technique for all models** | Different architectures respond differently | Test multiple techniques; pick best trade-off |
| **No fine-tuning after pruning** | Accuracy collapses without recovery training | Always fine-tune after pruning |
| **Ignoring target hardware** | INT8 fast on CPU, INT4 fast on GPU | Profile on target hardware |
| **Over-compressing** | Chase size reduction at cost of accuracy | Define accuracy floor first; compress to floor |

## 10 Rules

1. Define the accuracy floor before compressing — what degradation is acceptable?
2. Profile on the target hardware — speedups vary dramatically between CPU, GPU, mobile.
3. PTQ first (no retraining), QAT if accuracy is insufficient.
4. INT8 quantisation typically achieves 4× size reduction with <1% accuracy loss on most models.
5. Pruning requires fine-tuning to recover accuracy — never prune and deploy without recovery.
6. Distillation is best when task-specific data is available for fine-tuning the student.
7. Benchmark all three techniques on your specific model and data — published results don't transfer.
8. Combine techniques: distill first (smaller architecture), then quantise the student.
9. Structured pruning (remove filters) is more hardware-friendly than unstructured (random weights).
10. Track accuracy vs latency vs size on a Pareto frontier — optimise the right trade-off for your deployment target.
