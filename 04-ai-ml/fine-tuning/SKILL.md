---
name: fine-tuning
description: Fine-tune a pre-trained language model for a specific task. Covers dataset preparation, LoRA/QLoRA techniques, training configuration, evaluation, merging, and deployment of fine-tuned models.
argument-hint: [base model, task type, dataset size, compute budget, evaluation metric]
allowed-tools: Read, Write, Bash
---

# LLM Fine-Tuning

Fine-tuning adapts a pre-trained model to a specific domain, task, or style. It is the right tool when prompt engineering cannot achieve the required accuracy, when inference cost must be reduced by using a smaller specialist model, or when the task requires consistent structured output that few-shot prompting cannot reliably produce.

## When to Fine-Tune vs Alternatives

| Approach | Choose when |
|---------|------------|
| Prompt engineering | Task is well-defined; GPT-4 class model is affordable; < 100 examples |
| RAG | Knowledge is external, frequently updated, or beyond model cutoff |
| Fine-tuning | Consistent format required; domain-specific vocabulary; cost matters; prompting falls short |
| Pre-training | Highly specialised domain with billions of domain tokens; very large budget |

## LoRA and PEFT — Parameter-Efficient Fine-Tuning

Full fine-tuning updates all model weights — expensive and prone to catastrophic forgetting. LoRA adds small low-rank adapter matrices to attention layers, training only ~0.5% of parameters with comparable quality.

```
Full fine-tune:  7B params updated, 80GB+ VRAM, multiple A100s
LoRA r=16:       ~40M params, 16GB VRAM, 1× A100
QLoRA (4-bit):   ~40M params, 6–10GB VRAM, 1× RTX 3090 / RTX 4090
```

## Process

1. **Define the task precisely** — classification, extraction, generation, summarisation, or translation?
2. **Collect and clean the dataset** — quality beats quantity; 1 000 excellent examples outperform 10 000 noisy ones.
3. **Format as instruction–response pairs** — match the base model's chat template exactly.
4. **Split train/validation/test** — 80/10/10; never touch the test split until final evaluation.
5. **Choose the base model** — Llama 3, Mistral, Phi-3 for open weights; GPT-4o-mini for managed.
6. **Choose the adaptation method** — LoRA for standard GPU, QLoRA for consumer GPU, full fine-tune for maximum quality.
7. **Configure training hyperparameters** — learning rate, batch size, epochs, LoRA rank.
8. **Train with early stopping** — monitor validation loss; stop when it stops improving.
9. **Evaluate on held-out test set** — task-specific metrics; compare to base model and GPT-4.
10. **Merge adapters and quantise** — fuse LoRA weights into base; quantise to 4/8-bit for efficient serving.

## Dataset Preparation

```python
from datasets import Dataset
import json, random

def format_alpaca(instruction: str, response: str) -> dict:
    """Alpaca format — the most widely supported instruction fine-tuning format."""
    return {"instruction": instruction, "input": "", "output": response}

def format_chatml(instruction: str, response: str, system: str = "") -> dict:
    """ChatML format — used by Llama 3 and Mistral instruct models."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user",      "content": instruction})
    messages.append({"role": "assistant", "content": response})
    return {"messages": messages}

def prepare_dataset(
    examples: list[dict],
    task: str,
    test_ratio: float = 0.1,
    val_ratio: float  = 0.1,
) -> dict:
    random.shuffle(examples)
    n     = len(examples)
    n_test = int(n * test_ratio)
    n_val  = int(n * val_ratio)
    return {
        "test":  examples[:n_test],
        "val":   examples[n_test:n_test + n_val],
        "train": examples[n_test + n_val:],
    }

def validate_dataset(examples: list[dict]) -> list[str]:
    """Catch common data preparation mistakes before training."""
    issues = []
    for i, ex in enumerate(examples):
        resp = ex.get("output", ex.get("response", ""))
        if len(resp) < 5:
            issues.append(f"Row {i}: response too short ({len(resp)} chars)")
        if resp == ex.get("instruction", ""):
            issues.append(f"Row {i}: response equals instruction — copy error")
        if len(ex.get("instruction", "")) < 10:
            issues.append(f"Row {i}: instruction too short")
    return issues
```

## LoRA Fine-Tuning with HuggingFace + TRL

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
from peft import LoraConfig, get_peft_model, TaskType
from trl import SFTTrainer

MODEL_NAME = "meta-llama/Meta-Llama-3-8B-Instruct"

# Load base model
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    torch_dtype=torch.bfloat16,
    device_map="auto",
    use_cache=False,           # disable KV cache during training
)

# LoRA adapter config
lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=16,                      # rank — higher = more capacity, more VRAM
    lora_alpha=32,             # scaling = lora_alpha / r; usually set to 2r
    lora_dropout=0.05,
    target_modules=[           # which attention projections to adapt
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    bias="none",
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
# → Trainable params: 41,943,040 || All params: 8,072,204,288 || 0.52%

training_args = TrainingArguments(
    output_dir="./llama3-finetuned",
    num_train_epochs=3,
    per_device_train_batch_size=2,
    gradient_accumulation_steps=8,   # effective batch = 2 × 8 = 16
    learning_rate=2e-4,
    bf16=True,                        # bfloat16 on A100; use fp16 on V100/T4
    warmup_ratio=0.03,
    lr_scheduler_type="cosine",
    evaluation_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="eval_loss",
    logging_steps=10,
    report_to="wandb",                # track experiments
)

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=val_dataset,
    dataset_text_field="text",
    max_seq_length=2048,
    packing=False,
)
trainer.train()
model.save_pretrained("./llama3-lora-adapter")
tokenizer.save_pretrained("./llama3-lora-adapter")
```

## QLoRA — Fine-Tuning on Consumer GPUs

```python
from transformers import BitsAndBytesConfig

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",        # NF4 is better than FP4 for LLMs
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,   # nested quantisation saves ~0.4 bits/param
)

model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    quantization_config=bnb_config,
    device_map="auto",
)

# Then apply LoRA exactly as above
# QLoRA lets you fine-tune 7B models on a single 16GB GPU
```

## Merge Adapters for Deployment

```python
from peft import PeftModel
from transformers import AutoModelForCausalLM

# Load base model in full precision for clean merge
base = AutoModelForCausalLM.from_pretrained(MODEL_NAME, torch_dtype=torch.bfloat16)

# Load and merge LoRA adapter weights
peft_model = PeftModel.from_pretrained(base, "./llama3-lora-adapter")
merged     = peft_model.merge_and_unload()   # fuse LoRA into base weights

# Save the merged model — this can be served like any HuggingFace model
merged.save_pretrained("./llama3-merged", safe_serialization=True)

# Optionally quantise the merged model for faster inference
# Use llama.cpp or bitsandbytes for 4-bit GGUF export
```

## Evaluation Framework

```python
import json
from sklearn.metrics import classification_report, f1_score

def generate_prediction(model, tokenizer, instruction: str) -> str:
    prompt  = f"<|user|>\n{instruction}\n<|assistant|>\n"
    inputs  = tokenizer(prompt, return_tensors="pt").to(model.device)
    outputs = model.generate(**inputs, max_new_tokens=256, temperature=0, do_sample=False)
    decoded = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return decoded.split("<|assistant|>")[-1].strip()

def evaluate_classification(model, tokenizer, test_examples: list) -> dict:
    y_true, y_pred = [], []
    for ex in test_examples:
        pred = generate_prediction(model, tokenizer, ex["instruction"])
        y_true.append(ex["output"].strip().lower())
        y_pred.append(pred.strip().lower())
    return {
        "accuracy":       sum(t == p for t, p in zip(y_true, y_pred)) / len(y_true),
        "macro_f1":       f1_score(y_true, y_pred, average="macro"),
        "report":         classification_report(y_true, y_pred),
    }

# Always compare all three
results = {
    "fine_tuned": evaluate_classification(fine_tuned_model, tokenizer, test_examples),
    "base_model": evaluate_classification(base_model, tokenizer, test_examples),
    # Run GPT-4 predictions via API for ceiling comparison
}
print(f"Fine-tuned accuracy: {results['fine_tuned']['accuracy']:.1%}")
print(f"Base model accuracy: {results['base_model']['accuracy']:.1%}")
```

## OpenAI Fine-Tuning API (managed path)

```python
from openai import OpenAI
import json, time

client = OpenAI()

# Prepare JSONL training file
def to_openai_jsonl(examples: list[dict], path: str, system_prompt: str = "") -> None:
    with open(path, "w") as f:
        for ex in examples:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user",      "content": ex["instruction"]})
            messages.append({"role": "assistant", "content": ex["output"]})
            f.write(json.dumps({"messages": messages}) + "\n")

to_openai_jsonl(train_examples, "train.jsonl", system_prompt="You are a data extraction assistant.")

# Upload and start job
train_file = client.files.create(file=open("train.jsonl", "rb"), purpose="fine-tune")
job = client.fine_tuning.jobs.create(
    training_file=train_file.id,
    model="gpt-4o-mini-2024-07-18",
    hyperparameters={"n_epochs": 3, "learning_rate_multiplier": 1.8},
)

# Poll until complete
while True:
    job = client.fine_tuning.jobs.retrieve(job.id)
    print(f"Status: {job.status}")
    if job.status in ("succeeded", "failed"):
        break
    time.sleep(30)

# Use the fine-tuned model
if job.status == "succeeded":
    resp = client.chat.completions.create(
        model=job.fine_tuned_model,
        messages=[{"role": "user", "content": "Extract entities from: Apple reported $94B revenue."}]
    )
    print(resp.choices[0].message.content)
```

## Hyperparameter Reference

| Parameter | Typical range | Notes |
|-----------|--------------|-------|
| Learning rate | 1e-4 – 3e-4 | Lower than pre-training; cosine schedule |
| LoRA rank r | 8 – 64 | Higher = more capacity; 16 is a good default |
| lora_alpha | 2× rank | Scaling factor |
| Epochs | 1 – 5 | Overfit risk rises quickly after 3 |
| Batch size | 8 – 32 | Use gradient accumulation on small GPUs |
| Max seq length | 512 – 4096 | Longer = more VRAM; match to task |
| Warmup ratio | 0.03 – 0.1 | Stabilises early training |

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Fine-tuning before exhausting prompting | Unnecessary cost and time | Prompt engineer first; fine-tune when prompting plateaus |
| Noisy training data | Model learns noise and hallucinations | Hand-review 100 random examples before training begins |
| No held-out test set | Cannot measure real improvement | Reserve 10%; never train on it; evaluate once at the end |
| Training to zero train loss | Catastrophic overfit | Early stopping on validation loss |
| Not comparing to base model | Do not know if fine-tuning helped | Always baseline against untrained model and GPT-4 |
| Forgetting catastrophic forgetting | Fine-tuned model regresses on general tasks | Evaluate on general benchmarks as well as the target task |

## Rules

- **Exhaust prompt engineering first** — fine-tuning is expensive to iterate; prompting is free.
- **Quality > quantity for training data** — 500 hand-verified examples beat 5 000 scraped ones every time.
- **Reserve a test set and never touch it until the end** — validation is for tuning; test is for final evaluation only.
- **Use LoRA unless you have specific reasons not to** — 0.5% of parameters achieves 90% of full fine-tune quality.
- **Monitor validation loss every epoch** — stop when val loss stops decreasing; do not train to zero train loss.
- **Benchmark against base model AND GPT-4** — you need the floor (base) and the ceiling (GPT-4) to know where you stand.
- **Version training data alongside model weights** — you must be able to reproduce any training run from scratch.
- **Test for catastrophic forgetting** — run the fine-tuned model on general tasks to verify it has not regressed.
- **Plan a re-training cadence** — distribution shifts over time; schedule re-training when accuracy degrades.
- **Adapters are tied to one base model version** — re-train LoRA adapters whenever the base model is updated.
