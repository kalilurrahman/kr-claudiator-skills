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

The canonical workflow for **Context Window Management** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Optimise LLM context windows for long-document processing, multi-turn conversations, and token efficiency. Outputs chunking strategies, compression techniques, 
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
