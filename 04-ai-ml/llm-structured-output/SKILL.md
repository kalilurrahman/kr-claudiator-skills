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
