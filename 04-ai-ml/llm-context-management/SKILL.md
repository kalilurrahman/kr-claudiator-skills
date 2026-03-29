---
name: llm-context-management
description: Manage LLM context windows effectively for long conversations, document processing, and complex tasks. Outputs context budgeting, summarisation strategies, retrieval injection, and memory patterns.
argument-hint: [model context limit, conversation length, document size, memory requirements]
allowed-tools: Read, Write
---

# LLM Context Management

LLM context windows are finite. As conversations grow or documents get longer, you hit token limits. Context management strategies — summarisation, retrieval, chunking, and selective inclusion — keep the most relevant information in context while staying within limits.

## Context Budgeting

```python
import anthropic
from typing import Optional

# Context limits by model
CONTEXT_LIMITS = {
    "claude-opus-4-5":           200_000,
    "claude-sonnet-4-6":         200_000,
    "claude-haiku-4-5-20251001": 200_000,
}

# Token allocation strategy
CONTEXT_BUDGET = {
    "system_prompt":     2_000,   # Fixed
    "user_query":        1_000,   # Current message
    "retrieved_docs":   50_000,   # RAG context
    "conversation":     20_000,   # Recent history
    "output_reserve":   4_000,    # max_tokens
    # Remaining: buffer
}

def count_tokens(text: str, model: str = "claude-sonnet-4-6") -> int:
    """Estimate token count (rough: 1 token ≈ 4 chars)."""
    client = anthropic.Anthropic()
    # Use count_tokens API for accuracy
    response = client.messages.count_tokens(
        model=model,
        messages=[{"role": "user", "content": text}],
    )
    return response.input_tokens

def fits_in_context(messages: list, model: str, max_output: int = 4096) -> bool:
    client = anthropic.Anthropic()
    response = client.messages.count_tokens(
        model=model,
        messages=messages,
    )
    limit = CONTEXT_LIMITS.get(model, 200_000)
    return response.input_tokens + max_output <= limit
```

## Conversation Summarisation

```python
class ConversationManager:
    """Manages long conversations by summarising older turns."""
    
    def __init__(self, model: str = "claude-haiku-4-5-20251001",
                 max_tokens_before_summarise: int = 50_000):
        self.client = anthropic.Anthropic()
        self.model = model
        self.max_tokens = max_tokens_before_summarise
        self.messages: list[dict] = []
        self.summary: Optional[str] = None
    
    def add_message(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})
        
        # Check if we need to summarise
        token_count = self.client.messages.count_tokens(
            model=self.model, messages=self.messages
        ).input_tokens
        
        if token_count > self.max_tokens:
            self._summarise_older_messages()
    
    def _summarise_older_messages(self):
        """Keep last 10 messages; summarise the rest."""
        messages_to_summarise = self.messages[:-10]
        recent_messages = self.messages[-10:]
        
        if not messages_to_summarise:
            return
        
        # Create summary of older conversation
        summary_context = "
".join([
            f"{m['role'].upper()}: {m['content'][:500]}..."
            for m in messages_to_summarise
        ])
        
        existing_summary = f"Previous summary: {self.summary}

" if self.summary else ""
        
        response = self.client.messages.create(
            model="claude-haiku-4-5-20251001",  # Cheap model for summarisation
            max_tokens=1000,
            messages=[{"role": "user", "content": f"""
{existing_summary}Summarise this conversation history in 3-5 key points.
Focus on decisions made, information provided, and current task state.

{summary_context}

Summary:"""}]
        )
        
        self.summary = response.content[0].text
        self.messages = recent_messages
    
    def get_messages_with_context(self) -> tuple[str | None, list[dict]]:
        """Return (summary, messages) for API call."""
        system_addition = f"

Earlier conversation summary:
{self.summary}" if self.summary else ""
        return system_addition, self.messages
```

## Selective Context Injection (RAG)

```python
def build_context_window(
    query: str,
    documents: list[dict],
    conversation: list[dict],
    system_prompt: str,
    model: str = "claude-sonnet-4-6",
    max_total_tokens: int = 100_000,
) -> tuple[str, list[dict]]:
    """
    Prioritise what goes in context when space is tight.
    Priority: system > recent conversation > most relevant docs > older conversation
    """
    client = anthropic.Anthropic()
    
    # Always include: system prompt + current query
    reserved_tokens = count_tokens(system_prompt) + count_tokens(query) + 4096  # output
    available = max_total_tokens - reserved_tokens
    
    # 1. Include most recent conversation (always keep last 5 turns)
    recent = conversation[-10:]  # Last 5 exchanges
    recent_tokens = client.messages.count_tokens(model=model, messages=recent).input_tokens
    available -= recent_tokens
    
    # 2. Include most relevant documents (scored by similarity)
    docs_text = ""
    for doc in sorted(documents, key=lambda d: d["score"], reverse=True):
        doc_text = f"
[{doc['source']}]
{doc['content']}
"
        doc_tokens = count_tokens(doc_text)
        if available - doc_tokens > 0:
            docs_text += doc_text
            available -= doc_tokens
        else:
            break  # No more room
    
    # 3. Add older conversation if space allows
    older = conversation[:-10]
    for msg in reversed(older):  # Most recent of "older" first
        msg_tokens = count_tokens(msg["content"])
        if available - msg_tokens > 500:  # Leave buffer
            recent = [msg] + recent
            available -= msg_tokens
    
    enhanced_system = system_prompt
    if docs_text:
        enhanced_system += f"

Relevant context:
{docs_text}"
    
    return enhanced_system, recent
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Truncating from the middle** | Loses logical coherence | Truncate oldest turns; keep beginning (system) + recent |
| **No token counting** | Unexpected context overflow | Count tokens before sending; budget proactively |
| **Summarising too aggressively** | Loses detail needed for accuracy | Keep recent N turns verbatim; summarise only old turns |
| **Including all retrieved docs** | Irrelevant context degrades quality | Score and rank; include top-k within budget |
| **One context strategy for all tasks** | Chat needs different strategy than document Q&A | Different context managers per use case |

## 10 Rules

1. Count tokens before sending — never assume the context fits.
2. Prioritise context: system prompt > recent conversation > relevant docs > older history.
3. Summarise old conversation turns; keep recent turns verbatim.
4. Retrieved documents are ranked by relevance — include top-k within budget, not all.
5. Output tokens are reserved from the budget — don't use the full context for input.
6. Use fast/cheap models (Haiku) for summarisation and context compression.
7. Sliding window on conversation: always keep the last N turns.
8. Semantic chunking for documents — coherent chunks retrieve better than fixed-size splits.
9. Test context overflow explicitly — create tests that fill 90%+ of context window.
10. Log token usage per request — context budget management needs observability.
