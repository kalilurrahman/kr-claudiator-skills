---
name: multimodal-ai
description: Build applications that combine text, image, audio, and structured data with multimodal AI models. Outputs input processing pipelines, prompt strategies, and evaluation frameworks.
argument-hint: [modalities needed, model capabilities, use case, latency requirements, cost constraints]
allowed-tools: Read, Write
---

# Multimodal Ai

Multimodal AI models process and reason across multiple data types — text, images, documents, audio — in a single inference call. This enables richer applications that combine visual understanding with language reasoning.

## Image + Text with Claude

```python
import anthropic
import base64
from pathlib import Path

client = anthropic.Anthropic()

def analyse_image(image_path: str, question: str) -> str:
    image_data = base64.standard_b64encode(Path(image_path).read_bytes()).decode()
    ext = image_path.rsplit('.', 1)[-1].lower()
    media_type = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
                  "png": "image/png", "gif": "image/gif",
                  "webp": "image/webp"}.get(ext, "image/jpeg")

    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64",
                                              "media_type": media_type,
                                              "data": image_data}},
                {"type": "text", "text": question}
            ]
        }]
    )
    return response.content[0].text

# Document analysis (PDF as image)
answer = analyse_image("invoice.png", "Extract the total amount, vendor name, and invoice date as JSON.")

# Product catalogue: analyse multiple images
def compare_products(image_paths: list, comparison_criteria: str) -> str:
    content = []
    for path in image_paths:
        data = base64.standard_b64encode(Path(path).read_bytes()).decode()
        content.append({"type": "image", "source": {"type": "base64",
                                                      "media_type": "image/jpeg",
                                                      "data": data}})
    content.append({"type": "text", "text": f"Compare these products: {comparison_criteria}"})
    response = client.messages.create(model="claude-opus-4-5", max_tokens=2048,
                                       messages=[{"role": "user", "content": content}])
    return response.content[0].text
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Sending raw large images | High cost and latency | Resize to max 1568px on longest edge before sending |
| No fallback for image failures | Silent failures | Graceful degradation to text-only mode |
| Prompts that ignore multimodal context | Model ignores image | Explicitly reference the image in your prompt |
| Processing all modalities every request | Wasteful | Only include relevant modalities for each query |

## 10 Rules

1. Resize images before sending — max 1568px on longest edge; reduces cost by 4x.
2. Specify the task explicitly — "look at the image and..." rather than assuming the model will.
3. Test with edge cases — blurry, rotated, low-contrast images.
4. Evaluate multimodal outputs differently — automated eval needs vision models as judges.
5. Cache processed image embeddings for repeated analysis of same images.
6. Include alt-text fallback for accessibility when generating image descriptions.
7. Image extraction from PDFs produces higher quality than sending the PDF directly.
8. Multiple images in one request: order them logically; reference them by number.
9. Monitor cost carefully — image tokens are significantly more expensive than text.
10. Build structured extraction prompts with JSON schemas for reliable parsing.

