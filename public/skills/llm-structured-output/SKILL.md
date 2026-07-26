---
name: llm-structured-output
description: Reliably extract structured data from LLM responses using function calling, JSON mode, and validation. Outputs schema definitions, extraction patterns, retry logic, and parsing pipelines.
argument-hint: [output schema complexity, API provider, reliability requirements, failure handling]
allowed-tools: Read, Write
---

# LLM Structured Output

LLMs produce text, but applications need structured data — JSON objects, typed fields, lists, enums. Getting reliable structured output requires the right extraction method (function calling, JSON mode, or guided generation), schema design, and robust validation with retry.

## Extraction Methods

```
1. FUNCTION CALLING / TOOL USE (most reliable)
   Model outputs structured arguments for a "function"
   Supported: Anthropic, OpenAI, Gemini
   Reliability: Highest — model trained to produce valid schemas

2. JSON MODE (reliable, simpler)
   Model constrained to output valid JSON
   Supported: OpenAI, Mistral, Ollama
   Reliability: High — but schema compliance still needs validation

3. GUIDED GENERATION (outlines/instructor)
   Grammar-constrained decoding — physically impossible to produce invalid output
   Supported: Local models (Ollama, llama.cpp), some cloud APIs
   Reliability: Absolute for format; semantic correctness still needs checking

4. PROMPT ENGINEERING + PARSING (least reliable)
   Ask model to output JSON in prompt; parse response
   Reliability: Low — model can deviate from format
   Use: Only when API doesn't support better methods
```

## Anthropic Tool Use (Function Calling)

```python
import anthropic
from pydantic import BaseModel, Field
from typing import Optional
import json

client = anthropic.Anthropic()

# Define output schema as Pydantic model
class ProductReview(BaseModel):
    sentiment: str = Field(description="positive, negative, or neutral")
    score: int = Field(ge=1, le=5, description="Overall score 1-5")
    pros: list[str] = Field(description="List of positive points")
    cons: list[str] = Field(description="List of negative points")
    summary: str = Field(max_length=200, description="One-sentence summary")
    is_verified_purchase: Optional[bool] = None

def extract_review(review_text: str) -> ProductReview:
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        tools=[{
            "name": "extract_review",
            "description": "Extract structured information from a product review",
            "input_schema": ProductReview.model_json_schema(),
        }],
        tool_choice={"type": "tool", "name": "extract_review"},  # Force tool use
        messages=[{
            "role": "user",
            "content": f"Extract structured data from this review:

{review_text}"
        }],
    )
    
    # Find the tool use block
    for block in response.content:
        if block.type == "tool_use" and block.name == "extract_review":
            # Validate with Pydantic
            return ProductReview(**block.input)
    
    raise ValueError("Model did not return tool use block")

# With retry and validation
import tenacity

@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, max=10),
    retry=tenacity.retry_if_exception_type((ValueError, anthropic.APIError)),
)
def extract_review_with_retry(review_text: str) -> ProductReview:
    return extract_review(review_text)
```

## Batch Extraction Pipeline

```python
from pydantic import BaseModel, ValidationError
import asyncio
from typing import TypeVar

T = TypeVar("T", bound=BaseModel)

class ExtractionResult:
    def __init__(self, input_text: str):
        self.input = input_text
        self.result = None
        self.error = None
        self.attempts = 0

async def batch_extract(
    texts: list[str],
    schema: type[T],
    tool_name: str = "extract",
    concurrency: int = 10,
) -> list[ExtractionResult]:
    sem = asyncio.Semaphore(concurrency)
    
    async def extract_one(text: str) -> ExtractionResult:
        result = ExtractionResult(text)
        async with sem:
            for attempt in range(3):
                result.attempts = attempt + 1
                try:
                    response = await client.messages.create(
                        model="claude-haiku-4-5-20251001",
                        max_tokens=1024,
                        tools=[{"name": tool_name,
                                "description": f"Extract {schema.__name__}",
                                "input_schema": schema.model_json_schema()}],
                        tool_choice={"type": "tool", "name": tool_name},
                        messages=[{"role": "user", "content": text}],
                    )
                    for block in response.content:
                        if block.type == "tool_use":
                            result.result = schema(**block.input)
                            return result
                except ValidationError as e:
                    if attempt == 2:
                        result.error = f"Validation failed: {e}"
                except Exception as e:
                    if attempt == 2:
                        result.error = str(e)
                    await asyncio.sleep(2 ** attempt)
        return result
    
    return await asyncio.gather(*[extract_one(t) for t in texts])
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Prompt-only JSON extraction** | Model deviates from format; brittle | Use function calling / tool use |
| **No Pydantic validation** | Invalid data silently passes | Always validate extracted data against schema |
| **No retry on format failure** | Single extraction failure fails pipeline | Retry up to 3 times on validation errors |
| **Complex nested schemas** | Higher failure rate; harder to validate | Flatten schemas; extract in multiple passes |
| **No fallback for failed extractions** | Pipeline breaks on bad input | Track failures; handle gracefully |

## 10 Rules

1. Function calling / tool use is the most reliable extraction method — use it when available.
2. Always validate extracted data with Pydantic — never trust raw model output.
3. Retry on validation failures — models occasionally produce invalid output even with tool use.
4. Simple, flat schemas are more reliable than complex nested ones.
5. `tool_choice: {type: "tool", name: "..."}` forces tool use — don't rely on the model choosing.
6. Track extraction failure rates in production — >5% failure rate means schema redesign.
7. Separate extraction from downstream logic — extraction failures should not corrupt business state.
8. Use the cheapest capable model for extraction — it's often purely a formatting task.
9. Batch extractions with concurrency control — don't send 1000 requests in parallel.
10. Log failed extractions with the original text — you need the data to debug schema issues.

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

The canonical workflow for **Llm Structured Output** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Reliably extract structured data from LLM responses using function calling, JSON mode, and validation. Outputs schema definitions, extraction patterns, retry lo
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
