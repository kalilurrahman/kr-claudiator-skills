---
name: mcp-tool-orchestration
description: Wire Claude 5 to MCP servers (filesystem, git, DB, Jira, Notion) with typed tool contracts, per-tool guardrails, error taxonomies, and traceable retries.
argument-hint: [MCP servers, environments, auth model, allowed operations]
allowed-tools: Read, Write, Bash
model: claude-5-mythos | claude-5-fable
capability: Agentic Workflows
---

# MCP Tool Orchestration for Claude 5

> Claude 5 Mythos + Fable skill — Agentic Workflows. Optimised for Claude 5 Mythos (reasoning) and Claude 5 Fable (action / tool use), and backward-compatible with Claude Sonnet 4.5 and Opus 4.

## TL;DR

MCP turns Claude into a real operator. This skill defines the tool manifest, guardrail matrix, retry policy, and audit log format that keep tool calls safe, cheap, and reproducible.

## When to use this skill

- You are working with Claude 5 Mythos or Fable (or a downstream vendor exposing them).
- The task benefits from **agentic workflows** — do not use for tasks a smaller model handles cheaply.
- You need a repeatable, reviewable prompt — not a one-off chat.
- Output has to survive a code review, an audit, or a partner sign-off.

## When NOT to use this skill

- Simple lookups a smaller model (Haiku 4 / Sonnet 4.5) can serve at 10× lower cost.
- Real-time UX where 1M-token loads would break the latency budget.
- Tasks where a deterministic script would do — do not model what you can compute.

## Inputs (fill these in)

| Field | Required | Notes |
|---|---|---|
| `context_source` | ✅ | Repo path, doc set, ticket, screenshot, or MCP resource id |
| `goal` | ✅ | The single sentence definition of done |
| `audience` | ✅ | Reviewer, end-user, downstream agent, or auditor |
| `constraints` | ✅ | Token budget, step budget, permitted tools, forbidden ops |
| `output_shape` | ✅ | Free text / markdown / JSON schema / patch / PR |
| `citations` | ⛔ optional | Required for research, legal, medical, financial outputs |
| `escalation` | ⛔ optional | When to stop and ask a human |

## Operating Workflow

### 1. Frame the task
- Restate the goal in one sentence in your own words. If you cannot, ask.
- Identify the smallest input that still contains everything Claude needs.
- Decide whether the task is a **read** (Mythos), an **act** (Fable), or **read → act** (both).

### 2. Load the context
- Preserve original structure — headers, file boundaries, page numbers.
- Order matters: put stable, high-signal context first; volatile context last.
- Use XML-style tags (`<file>`, `<doc>`, `<ticket>`) to make regions addressable.
- Cache-friendly: keep the top of the prompt stable across calls to hit prompt-cache.

### 3. Specify the output contract
- Give the exact shape (markdown outline, JSON schema, or diff format).
- State the null policy — what does Claude do when a field is unknown?
- State the citation policy — is every claim traceable to an input region?

### 4. Run with guardrails
- Cap step count for Fable agents (typical: 8–25 steps).
- Log every tool call, its arguments, its response, and its latency.
- Route destructive ops (`rm`, `DROP`, `git push --force`) through an approval gate.

### 5. Verify and iterate
- Score output against the contract before returning to the user.
- If invalid, re-ask with the validator error appended — do not silently accept.
- Cache the successful prompt template — it is the reusable artefact.

## Output Format

The skill produces:

1. A **prompt template** (markdown or XML) ready to send to Claude 5.
2. A **contract** describing the expected response shape.
3. A **validator** (regex, JSON-schema, or unit-test snippet) that gates the response.
4. A **runbook** describing how to re-run, refresh cache, and escalate.

Example template head:

```xml
<system>
You are Claude 5 Agentic operating under the "mcp-tool-orchestration" skill.
Follow the output contract exactly. If a required field is unknown, return
null with a `reason` explaining what is missing. Never fabricate citations.
</system>

<context>
  <!-- structured, ordered, addressable -->
</context>

<task>
  <goal>{goal}</goal>
  <constraints>{constraints}</constraints>
  <output_shape>{output_shape}</output_shape>
</task>
```

## Decision Logic

- If the input **fits in a single Mythos window** → load it whole, no RAG.
- If the input **exceeds the window** → chunk with overlap, then run a reducer pass.
- If the task requires **action** → route through Fable with a tool manifest.
- If the task requires **verifiable claims** → force citations and reject un-cited claims in the validator.
- If confidence is low → escalate rather than guess.

## Anti-patterns

- **Summarising the input first.** Claude 5 does that better than your preprocessor and you lose fidelity.
- **Ambiguous tool schemas.** Vague names cost you retries — Claude will call the wrong tool.
- **Unbounded agent loops.** Every Fable run must have a step cap and a wall-clock cap.
- **Silent JSON re-parse.** If Claude returns invalid JSON, surface the error and re-ask — do not paper over it.
- **Cache-hostile prompts.** Injecting a timestamp at the top of the prompt kills prompt-cache and doubles your bill.
- **Mixing Mythos and Fable in one call.** Pick the right variant per step; do not ask Mythos to act or Fable to write a research memo.

## Quality Bar (definition of done)

- Output validates against the declared contract on the first pass ≥ 90% of the time.
- Every factual claim in a research-mode output carries a citation.
- Every tool call in an agent-mode output is logged with args, response, and duration.
- The prompt template is checked into the repo and versioned like code.
- A re-run with the same inputs produces a semantically equivalent output.

## Worked Micro-Example

**Goal.** MCP turns Claude into a real operator. This skill defines the tool manifest, guardrail matrix, retry policy, and audit log format that keep tool calls safe, cheap, and reproducible.

**Inputs.**
- `context_source`: (task-specific — see argument-hint)
- `goal`: single-sentence definition of done
- `output_shape`: JSON matching the schema in `/schemas/mcp-tool-orchestration.json`

**Run.**
1. Load context in the required order.
2. Send the templated prompt to Claude 5 Agentic.
3. Validate the response against `/schemas/mcp-tool-orchestration.json`.
4. On failure, re-ask with the validator error; cap at 2 retries.
5. Persist the successful response and the exact prompt used.

**Expected artefact.** A machine-readable output plus a human-readable summary that a reviewer can approve in under 5 minutes.

## Cadence

| Cadence | Action |
|---|---|
| Per run | Emit trace: prompt hash, model id, tokens in/out, tool calls, validator result |
| Per week | Review failure traces; tighten the schema, examples, or guardrails |
| Per month | Rotate examples; retire ones that no longer surface real failure modes |
| Per quarter | Re-benchmark against the current Claude 5 point release |

## Companion skills

- `prompt-engineering-playbook` — reusable prompt patterns across every model.
- `mcp-agent-architecture` — deeper wiring for MCP-based tool use.
- `rag-knowledge-systems` — when the corpus outgrows even a 1M window.
- `executive-briefs` — for turning Claude 5 output into partner-ready one-pagers.

## Rules (do not violate)

- Never present Claude 5 output as human-authored for regulated deliverables.
- Never let an agent execute a destructive command without a human gate.
- Never disable the validator "just to unblock a demo" — that is how bad outputs ship.
- Never hardcode secrets into the prompt; use tool-side injection.
- Never remove the AI Content Notice — Claude 5 hallucinates and every output requires human review.

## Closing note

Claude 5 Mythos and Fable are powerful because they behave like a careful colleague, not a magic oracle. This skill is the frame that keeps the colleague honest, cheap, and reviewable.
