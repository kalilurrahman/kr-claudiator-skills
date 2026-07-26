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

---

## Deep Reference Playbook

The sections below extend this skill into a complete operating playbook so it can run end-to-end inside Claude Code, CoWork, or any agentic tool without further prompting. Pull only the sections you need for a given engagement.

### Inputs the skill must collect

Before producing any output, the skill confirms:

1. **Objective** — the single decision or artifact the user wants out of this session.
2. **Context** — system, team, customer, product, or domain the work sits inside.
3. **Constraints** — time, budget, headcount, regulatory, technical, political.
4. **Definition of done** — what "good" looks like and who signs it off.
5. **Audience** — who reads or consumes the output (engineer, exec, customer, regulator).
6. **Existing artifacts** — prior versions, related docs, dashboards, tickets.
7. **Risk appetite** — how reversible the decision is and how much ambiguity is acceptable.

If any of these are missing, the skill asks targeted clarifying questions before generating output. It never invents constraints the user did not state.

### Operating workflow

The canonical workflow for **Model Compression** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

**Stage 1 — Frame.** Restate the problem in one paragraph. Name the decision, the deadline, the stakeholders, and the success metric. Surface assumptions explicitly so they can be challenged.

**Stage 2 — Diagnose.** Inventory the current state with concrete evidence: metrics, quotes, screenshots, configs, tickets. Separate facts from interpretations. Identify the two or three root causes that explain most of the gap, not the long tail of symptoms.

**Stage 3 — Design.** Generate at least two viable options. For each option, capture: what changes, who owns it, what it costs, what it unblocks, what it risks, and how it could fail. Recommend one with a written rationale.

**Stage 4 — Execute.** Convert the chosen option into a sequenced plan: milestones, owners, dependencies, gating checks, communication cadence, and rollback triggers. Anything that cannot be assigned an owner and a date is not yet a plan.

**Stage 5 — Validate.** Define how success will be measured, when the measurement happens, and what action follows each possible result. Schedule the retrospective before the work starts, not after.

### Outputs the skill produces

Depending on the request, the skill returns one or more of:

- A one-page brief suitable for an executive reader.
- A detailed working document for the delivery team.
- A decision record capturing the choice, the alternatives, and the rationale.
- A risk register with probability, impact, owner, and mitigation.
- A sequenced action plan with named owners and explicit due dates.
- A measurement plan tied to the success metric.
- A communication plan for stakeholders inside and outside the team.

Every artifact uses clear headings, short paragraphs, and tables where comparison helps. No filler. No restating the prompt. No hedging language when a recommendation is warranted.

### Decision logic and trade-offs

The skill applies the following heuristics when choices are not obvious:

- **Prefer reversible decisions** taken quickly over irreversible decisions taken slowly.
- **Optimise for the constraint that bites first** — usually time, attention, or trust, not money.
- **Default to the simplest design** that meets the stated definition of done; add complexity only when a specific requirement forces it.
- **Make the cost of being wrong visible** so the reader can judge whether the recommendation is proportionate.
- **Name the people**, not the roles, when assigning ownership; ambiguous ownership produces ambiguous outcomes.

### Anti-patterns the skill refuses to emit

| Anti-pattern | Why it fails | What the skill does instead |
|---|---|---|
| Generic best-practice list with no context | Reader cannot act on it | Tailors recommendations to the stated constraints |
| Recommendation without trade-offs | Hides the cost of being wrong | Names the price paid for the recommendation |
| Plan with no owners or dates | Cannot be executed or tracked | Assigns a named owner and a date to every action |
| Metrics theatre | Measures activity, not outcome | Ties every metric back to the user or business outcome |
| Boil-the-ocean scope | Nothing ships | Cuts scope to the smallest valuable slice |
| Buried recommendation | Reader misses the point | Leads with the recommendation in the first paragraph |

### Quality bar

The skill self-checks each output against these gates before returning it:

1. Can a busy executive understand the recommendation from the first 150 words?
2. Is every claim either evidenced, labelled as an assumption, or removed?
3. Does every action have an owner and a date?
4. Are the trade-offs of the recommendation stated honestly?
5. Is there a measurable success criterion?
6. Would the author be comfortable defending this artifact in a review meeting?

If any gate fails, the skill rewrites the section before returning it.

### Worked micro-example

> **Context:** Compress and optimise ML models for production deployment. Outputs quantisation, pruning, and distillation approaches with size-accuracy tradeoff analysis.
>
> **Frame:** the team needs a defensible recommendation within five working days; the audience is a cross-functional steering group; the cost of delay is higher than the cost of being slightly wrong.
>
> **Diagnose:** the dominant constraint is decision latency, not analytical depth. Existing data is sufficient for a directional call.
>
> **Design:** two viable options surfaced. Option A optimises for speed and reversibility. Option B optimises for completeness but slips the deadline by two weeks.
>
> **Execute:** Option A recommended. Plan sequenced into a two-week sprint with named owners, a mid-point checkpoint, and a clear rollback trigger.
>
> **Validate:** success measured against a single leading indicator at day 30 and a single lagging indicator at day 90. Retrospective scheduled for day 35.

### Cadence and follow-through

A one-shot artifact rarely changes outcomes. The skill recommends a lightweight cadence to keep the work alive:

- **Weekly:** owner posts a five-line status (done, doing, blocked, risk, ask).
- **Fortnightly:** steering group reviews leading indicators and unblocks dependencies.
- **Monthly:** retrospective on what the data is teaching the team; adjust plan accordingly.
- **Quarterly:** revisit the original objective and decide whether to continue, pivot, or stop.

### Closing rules of thumb

1. Lead with the recommendation; supporting analysis follows.
2. Treat every output as a draft that will be challenged; pre-empt the obvious objections.
3. Prefer one strong recommendation over three weak options.
4. When the evidence is thin, say so; do not launder uncertainty as confidence.
5. Optimise for the next decision, not for the perfect document.
6. Make it easy for the reader to disagree with you in a structured way.
7. Ship the artifact; iterate against feedback rather than in private.
