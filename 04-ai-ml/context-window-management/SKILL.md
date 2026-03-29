---
name: context-window-management
description: Optimise LLM context windows for long-document processing, multi-turn conversations, and token efficiency. Outputs chunking strategies, compression techniques, and memory management patterns.
argument-hint: [model context limit, document types, conversation length, token budget]
allowed-tools: Read, Write
---

# Context Window Management

LLM context windows are limited and expensive. Effective context management determines what information the model sees, in what order, and how much context is consumed per token. Poor management causes truncation, high costs, and degraded output quality.

## Process

1. **Measure your token usage.** What consumes the most tokens: system prompt, history, documents, or output?
2. **Set a token budget.** Allocate tokens by priority: system prompt < history < retrieved context < user message.
3. **Choose retrieval strategy.** Don't stuff full documents — retrieve relevant chunks.
4. **Compress conversation history.** Summarise old turns; keep only recent messages verbatim.
5. **Monitor and alert.** Track tokens per request; alert when approaching limits.

## Token Budget Allocation

```python
import anthropic
import tiktoken

client = anthropic.Anthropic()
MODEL = "claude-opus-4-5"
MODEL_CONTEXT = 200_000  # claude-opus-4-5 context window
RESERVED_FOR_OUTPUT = 4096

# Token budget per component
BUDGET = {
    "system_prompt": 2_000,
    "conversation_history": 8_000,
    "retrieved_context": 40_000,
    "user_message": 2_000,
    "output": RESERVED_FOR_OUTPUT,
}

def count_tokens(text: str) -> int:
    enc = tiktoken.get_encoding("cl100k_base")
    return len(enc.encode(text))

def build_context_within_budget(
    system: str,
    history: list[dict],
    documents: list[str],
    user_message: str,
) -> tuple[str, list[dict], list[str]]:
    # Truncate system prompt if needed
    system_tokens = count_tokens(system)
    if system_tokens > BUDGET["system_prompt"]:
        system = system[:BUDGET["system_prompt"] * 4]  # rough char estimate
    
    # Compress history if over budget
    history_tokens = sum(count_tokens(m["content"]) for m in history)
    if history_tokens > BUDGET["conversation_history"]:
        history = compress_history(history, BUDGET["conversation_history"])
    
    # Fit documents within remaining budget
    available = MODEL_CONTEXT - RESERVED_FOR_OUTPUT
    available -= count_tokens(system) + sum(count_tokens(m["content"]) for m in history)
    available -= count_tokens(user_message)
    
    fitted_docs = fit_documents(documents, available)
    return system, history, fitted_docs

def compress_history(history: list[dict], token_limit: int) -> list[dict]:
    # Keep last 4 turns verbatim; summarise the rest
    recent = history[-4:]
    older = history[:-4]
    
    if not older:
        return recent
    
    older_text = "
".join(f"{m['role']}: {m['content']}" for m in older)
    summary = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=500,
        messages=[{"role": "user", "content": f"Summarise this conversation in 2-3 sentences:
{older_text}"}]
    ).content[0].text
    
    return [{"role": "assistant", "content": f"[Previous conversation summary: {summary}]"}] + recent

def fit_documents(docs: list[str], token_budget: int) -> list[str]:
    fitted = []
    remaining = token_budget
    for doc in docs:
        doc_tokens = count_tokens(doc)
        if doc_tokens <= remaining:
            fitted.append(doc)
            remaining -= doc_tokens
        elif remaining > 500:  # At least worth including truncated
            # Truncate to fit
            chars = remaining * 4
            fitted.append(doc[:chars] + "
[truncated]")
            break
    return fitted
```

## Sliding Window for Long Conversations

```python
class ConversationManager:
    """Manages conversation history within token budget."""
    
    MAX_HISTORY_TOKENS = 8000
    SUMMARY_TRIGGER = 12000  # Summarise when history exceeds this
    
    def __init__(self):
        self.messages: list[dict] = []
        self.summary: str | None = None
    
    def add_turn(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})
        
        history_tokens = sum(count_tokens(m["content"]) for m in self.messages)
        if history_tokens > self.SUMMARY_TRIGGER:
            self._compress()
    
    def _compress(self):
        # Summarise all but last 4 messages
        to_summarise = self.messages[:-4]
        text = "
".join(f"{m['role']}: {m['content'][:500]}" for m in to_summarise)
        
        new_summary = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            messages=[{"role": "user", "content": f"Summarise concisely:
{text}"}]
        ).content[0].text
        
        self.summary = new_summary
        self.messages = self.messages[-4:]
    
    def get_messages_for_api(self) -> list[dict]:
        if self.summary:
            return [
                {"role": "user", "content": f"[Context: {self.summary}]"},
                {"role": "assistant", "content": "Understood."},
            ] + self.messages
        return self.messages
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Stuffing full documents** | Context full; model can't use it all | Retrieve relevant chunks; summarise |
| **Keeping full history forever** | Context fills after 20 turns | Sliding window with summarisation |
| **No token monitoring** | Costs explode silently | Track tokens per request in observability |
| **Same context for all tasks** | Long context for simple tasks = waste | Tiered approach: light context for simple, full for complex |
| **Ignoring context order** | Model attention biased to end of context | Put most relevant content last |

## 10 Rules

1. Measure token usage per component — you can't optimise what you don't measure.
2. Retrieve, don't stuff — embeddings + retrieval beats putting entire documents in context.
3. Conversation history grows unbounded — implement sliding window with summarisation.
4. Token budget is allocated explicitly — system < history < documents < user message.
5. Most relevant content goes last — LLMs have recency bias in attention.
6. Monitor token costs per request in production — cost spikes reveal context bugs.
7. Compress history aggressively with cheap models (Haiku) — save budget for complex tasks.
8. Cache repeated context (system prompts, static docs) — reduce API costs significantly.
9. Chunk documents at natural boundaries — paragraph or section, not arbitrary character counts.
10. Test at context limit — models behave differently when context is full vs empty.
