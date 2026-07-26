---
name: multi-agent-systems
description: Design and orchestrate multi-agent AI systems with specialist agents, coordination patterns, and shared memory. Outputs agent topology, communication protocol, error handling, and evaluation framework.
argument-hint: [task complexity, required specialisations, parallelism opportunities, safety requirements]
allowed-tools: Read, Write
---

# Multi-Agent Systems

Multi-agent systems decompose complex tasks across specialist agents that collaborate — one researches, one writes, one reviews. The design challenges are coordination (how agents communicate), memory (what state they share), and reliability (handling agent failures without failing the whole task).

## When to Use Multi-Agent

```
SINGLE AGENT FIRST — add agents only when:
  ✓ Task is too long for one context window
  ✓ Task has genuinely parallel subtasks
  ✓ Different subtasks need different specialisations
  ✓ Quality benefits from review/critique loop

MULTI-AGENT PATTERNS:
  Orchestrator → Workers (most common)
  Pipeline (Agent A → Agent B → Agent C)
  Parallel fan-out with reducer
  Debate (Agent A vs Agent B → Judge)
  Reflection (Writer → Critic → Writer)
```

## Orchestrator Pattern

```python
import anthropic
import asyncio
from dataclasses import dataclass
from typing import Any

client = anthropic.Anthropic()

@dataclass
class AgentResult:
    agent_name: str
    output: str
    success: bool
    error: str | None = None

class Orchestrator:
    """Coordinates specialist agents to complete complex tasks."""
    
    def __init__(self, model: str = "claude-opus-4-5"):
        self.model = model
    
    async def run(self, task: str) -> str:
        # Step 1: Plan — decompose task into subtasks
        plan = await self._plan(task)
        
        # Step 2: Execute subtasks (some parallel, some sequential)
        results = await self._execute(plan, task)
        
        # Step 3: Synthesise — combine results
        synthesis = await self._synthesise(task, results)
        
        return synthesis
    
    async def _plan(self, task: str) -> dict:
        response = client.messages.create(
            model=self.model,
            max_tokens=1024,
            messages=[{"role": "user", "content": f"""
                Decompose this task into 2-5 subtasks that can be worked on by specialist agents.
                For each subtask specify: agent_type, description, dependencies (list of prior subtask IDs).
                
                Task: {task}
                
                Respond with JSON: {{"subtasks": [{{"id": "1", "agent_type": "researcher", "description": "...", "dependencies": []}}]}}
            """}]
        )
        import json
        return json.loads(response.content[0].text)
    
    async def _execute(self, plan: dict, original_task: str) -> list[AgentResult]:
        completed: dict[str, AgentResult] = {}
        
        for subtask in plan["subtasks"]:
            # Wait for dependencies
            deps_output = {dep_id: completed[dep_id].output 
                          for dep_id in subtask.get("dependencies", [])
                          if dep_id in completed}
            
            result = await self._run_agent(
                agent_type=subtask["agent_type"],
                description=subtask["description"],
                context=deps_output,
                original_task=original_task,
            )
            completed[subtask["id"]] = result
        
        return list(completed.values())
    
    async def _run_agent(self, agent_type: str, description: str,
                          context: dict, original_task: str) -> AgentResult:
        agent_prompts = {
            "researcher": "You are a thorough researcher. Find and synthesise relevant information.",
            "writer": "You are a skilled writer. Create clear, well-structured content.",
            "critic": "You are a critical reviewer. Identify flaws, gaps, and improvements.",
            "coder": "You are an expert software engineer. Write clean, correct code.",
            "analyst": "You are a data analyst. Draw insights from information.",
        }
        
        system = agent_prompts.get(agent_type, "You are a helpful AI assistant.")
        
        context_text = "
".join(
            f"Prior work ({dep_id}):
{output}" 
            for dep_id, output in context.items()
        ) if context else ""
        
        try:
            response = client.messages.create(
                model="claude-sonnet-4-6" if agent_type != "critic" else "claude-opus-4-5",
                max_tokens=2048,
                system=system,
                messages=[{"role": "user", "content": f"""
                    Original task: {original_task}
                    
                    Your specific task: {description}
                    
                    {context_text}
                    
                    Complete your task thoroughly.
                """}]
            )
            return AgentResult(agent_name=agent_type, output=response.content[0].text, success=True)
        except Exception as e:
            return AgentResult(agent_name=agent_type, output="", success=False, error=str(e))
    
    async def _synthesise(self, task: str, results: list[AgentResult]) -> str:
        successful = [r for r in results if r.success]
        work_summary = "

".join(f"**{r.agent_name}**:
{r.output}" for r in successful)
        
        response = client.messages.create(
            model=self.model,
            max_tokens=4096,
            messages=[{"role": "user", "content": f"""
                Original task: {task}
                
                Work completed by specialist agents:
                {work_summary}
                
                Synthesise all work into a final, coherent response for the original task.
            """}]
        )
        return response.content[0].text
```

## Reflection Pattern (Writer + Critic)

```python
async def reflection_loop(task: str, max_rounds: int = 3) -> str:
    """Writer produces draft; Critic improves it; repeat."""
    
    draft = await write(task)
    
    for round in range(max_rounds):
        critique = await critique(draft, task)
        
        if "no significant improvements" in critique.lower():
            break
        
        draft = await revise(draft, critique, task)
    
    return draft

async def write(task: str) -> str:
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system="You are a skilled writer. Produce clear, comprehensive content.",
        messages=[{"role": "user", "content": f"Write: {task}"}]
    )
    return response.content[0].text

async def critique(draft: str, original_task: str) -> str:
    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=1024,
        system="You are a critical editor. Identify specific improvements needed. If the work is good, say so.",
        messages=[{"role": "user", "content": f"Task: {original_task}

Draft:
{draft}

Provide specific critique."}]
    )
    return response.content[0].text
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Multi-agent for simple tasks** | Unnecessary complexity and latency | Single agent first; add agents only when justified |
| **No error handling per agent** | One agent failure kills the whole pipeline | Each agent failure is handled; pipeline continues |
| **Agents calling agents recursively** | Infinite loops; unpredictable costs | Fixed topology; max depth limit |
| **No cost tracking** | Multi-agent costs multiply quickly | Track and cap total tokens per orchestration run |
| **Agents share mutable state** | Race conditions; inconsistent results | Immutable message passing between agents |

## 10 Rules

1. Single agent first — add specialist agents only when genuinely needed.
2. Orchestrator coordinates; workers execute — never let workers coordinate other workers.
3. Every agent has a single, clear responsibility.
4. Agents communicate through messages — no shared mutable state.
5. Each agent failure is handled gracefully — the orchestrator decides whether to retry or proceed.
6. Set cost caps per orchestration run — multi-agent costs multiply quickly.
7. The reflection pattern (write + critique + revise) improves quality for creative tasks.
8. Parallel execution for independent subtasks — don't serialize what can run concurrently.
9. Log every agent call with inputs and outputs — debugging requires the full trace.
10. Evaluate multi-agent systems on end-to-end task success — not individual agent performance.
