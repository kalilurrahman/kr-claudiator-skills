---
name: agentic-workflow
description: Design and implement LLM-powered agentic workflows with tool use, planning, memory, and multi-agent coordination. Outputs agent architecture, tool definitions, evaluation framework, and safety controls.
argument-hint: [task type, tools available, autonomy level, human-in-the-loop requirements]
allowed-tools: Read, Write, Bash
---

# Agentic Workflow Design

Agentic workflows let LLMs take sequences of actions — calling tools, searching the web, writing code, coordinating with other agents — to complete complex tasks autonomously. The design challenge is balancing autonomy (getting things done without hand-holding) with reliability (not taking wrong or harmful actions).

## Process

1. **Define the task and scope.** What does the agent accomplish? What is explicitly out of scope? What can it never do?
2. **Identify required tools.** Each tool does one thing. Tools are the agent's interface to the world.
3. **Choose the architecture.** Single agent with tools, multi-agent with orchestrator, or hierarchical. Start simple.
4. **Design the planning loop.** ReAct (Reason + Act), plan-then-execute, or reflection loops.
5. **Implement memory.** Working memory (context window), episodic memory (conversation history), semantic memory (vector store).
6. **Define human-in-the-loop checkpoints.** What actions require approval? What is irreversible?
7. **Build evaluation.** Automated tests for tool calling accuracy, task completion, and safety.
8. **Add guardrails.** Input/output filters, action allowlists, cost limits, iteration caps.

## Architecture Patterns

```
Pattern 1: Single Agent + Tools (start here)
  User → Agent → [search, code_exec, file_write, api_call] → Result
  Best for: Well-defined tasks, single domain, <10 tool calls

Pattern 2: Orchestrator + Specialist Agents  
  User → Orchestrator → [ResearchAgent, WriterAgent, ReviewerAgent] → Result
  Best for: Complex multi-step tasks, parallel work streams

Pattern 3: Hierarchical (Manager → Workers)
  Manager Agent
    ├── SubAgent A (research)
    ├── SubAgent B (analysis)
    └── SubAgent C (drafting)
  Best for: Large parallelisable tasks

Pattern 4: Reflection / Critique Loop
  Agent → Draft → Critic Agent → Revise → Final
  Best for: High-quality output requirements (code, reports, plans)
```

## Tool Definition

```python
from anthropic import Anthropic
from typing import Any
import json

client = Anthropic()

# Tool schema — clear name, description, and typed parameters
TOOLS = [
    {
        "name": "search_web",
        "description": "Search the web for current information. Use when you need facts, news, or data not in your training.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query. Be specific and use key terms."
                },
                "max_results": {
                    "type": "integer",
                    "description": "Number of results to return (1-10)",
                    "default": 5
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "run_python",
        "description": "Execute Python code in a sandboxed environment. Use for calculations, data processing, or generating outputs. Returns stdout and any errors.",
        "input_schema": {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "Python code to execute. Import only standard library modules."
                },
                "timeout_seconds": {
                    "type": "integer",
                    "description": "Max execution time (1-30 seconds)",
                    "default": 10
                }
            },
            "required": ["code"]
        }
    },
    {
        "name": "write_file",
        "description": "Write content to a file. Use only for final outputs, not intermediate work.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Relative file path"},
                "content": {"type": "string", "description": "File content"},
                "mode": {"type": "string", "enum": ["write", "append"], "default": "write"}
            },
            "required": ["path", "content"]
        }
    }
]
```

## ReAct Agent Loop

```python
import subprocess
import tempfile
import os
from typing import Optional

def execute_tool(tool_name: str, tool_input: dict) -> str:
    """Execute a tool and return the result as a string."""
    if tool_name == "search_web":
        # Integration with search API
        results = search_api.search(tool_input["query"], 
                                    n=tool_input.get("max_results", 5))
        return json.dumps(results)
    
    elif tool_name == "run_python":
        code = tool_input["code"]
        timeout = tool_input.get("timeout_seconds", 10)
        
        # Sandboxed execution
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            f.flush()
            try:
                result = subprocess.run(
                    ["python3", f.name],
                    capture_output=True, text=True, timeout=timeout,
                    cwd="/tmp"  # Restricted working directory
                )
                output = result.stdout
                if result.stderr: output += f"\nSTDERR: {result.stderr}"
                return output or "(no output)"
            except subprocess.TimeoutExpired:
                return f"Error: Execution timed out after {timeout}s"
            finally:
                os.unlink(f.name)
    
    elif tool_name == "write_file":
        # Sanitise path — prevent directory traversal
        path = os.path.basename(tool_input["path"])
        safe_path = os.path.join("/tmp/agent_outputs", path)
        os.makedirs(os.path.dirname(safe_path), exist_ok=True)
        mode = "a" if tool_input.get("mode") == "append" else "w"
        with open(safe_path, mode) as f:
            f.write(tool_input["content"])
        return f"Written {len(tool_input['content'])} chars to {path}"
    
    return f"Unknown tool: {tool_name}"


def run_agent(task: str, max_iterations: int = 20) -> str:
    """Main agent loop with iteration cap and tool execution."""
    messages = [{"role": "user", "content": task}]
    
    system_prompt = """You are a helpful AI assistant with access to tools.
    Work through tasks step-by-step. Think carefully before each action.
    When you have completed the task, respond with your final answer without using any tools.
    
    Guidelines:
    - Use search_web for factual information you don't know
    - Use run_python for calculations, data processing, and analysis
    - Use write_file only for final deliverables, not scratch work
    - Be efficient — don't repeat searches or recompute the same thing"""
    
    for iteration in range(max_iterations):
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=4096,
            system=system_prompt,
            tools=TOOLS,
            messages=messages,
        )
        
        # No tool use — agent is done
        if response.stop_reason == "end_turn":
            text_blocks = [b.text for b in response.content if hasattr(b, 'text')]
            return "\n".join(text_blocks)
        
        # Process tool calls
        messages.append({"role": "assistant", "content": response.content})
        tool_results = []
        
        for block in response.content:
            if block.type == "tool_use":
                print(f"[Iteration {iteration+1}] Tool: {block.name}({block.input})")
                result = execute_tool(block.name, block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                })
        
        messages.append({"role": "user", "content": tool_results})
    
    return "Max iterations reached. Partial result may be incomplete."
```

## Multi-Agent Orchestration

```python
# Orchestrator that coordinates specialist agents
class ResearchOrchestrator:
    def __init__(self):
        self.client = Anthropic()
    
    def run(self, research_question: str) -> dict:
        # Phase 1: Plan
        plan = self._plan(research_question)
        
        # Phase 2: Parallel research (multiple sub-agents)
        import asyncio
        research_results = asyncio.run(
            self._parallel_research(plan["subtopics"])
        )
        
        # Phase 3: Synthesise
        synthesis = self._synthesise(research_question, research_results)
        
        # Phase 4: Review (critic agent)
        review = self._critique(synthesis)
        
        return {"synthesis": synthesis, "critique": review, "sources": research_results}
    
    def _plan(self, question: str) -> dict:
        response = self.client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1024,
            messages=[{"role": "user", "content": f"""
                Break this research question into 3-5 focused subtopics to investigate:
                {question}
                
                Respond with JSON: {{"subtopics": ["subtopic1", "subtopic2", ...]}}
            """}]
        )
        return json.loads(response.content[0].text)
    
    async def _parallel_research(self, subtopics: list) -> list:
        import asyncio
        tasks = [self._research_subtopic(t) for t in subtopics]
        return await asyncio.gather(*tasks)
    
    async def _research_subtopic(self, subtopic: str) -> dict:
        # Each subtopic runs as its own agent with search tools
        result = run_agent(f"Research this specific topic thoroughly: {subtopic}")
        return {"subtopic": subtopic, "findings": result}
    
    def _synthesise(self, question: str, research: list) -> str:
        research_text = "\n\n".join(
            f"**{r['subtopic']}**\n{r['findings']}" for r in research
        )
        response = self.client.messages.create(
            model="claude-opus-4-5",
            max_tokens=4096,
            messages=[{"role": "user", "content": f"""
                Synthesise these research findings into a comprehensive answer to:
                {question}
                
                Research findings:
                {research_text}
            """}]
        )
        return response.content[0].text
```

## Safety and Guardrails

```python
class AgentGuardrails:
    """Enforce safety limits on agent execution."""
    
    FORBIDDEN_PATTERNS = [
        r'rm\s+-rf',          # Dangerous shell commands
        r'DROP\s+TABLE',       # Database destruction
        r'os\.system',         # Shell injection
        r'eval\(',             # Code injection
        r'__import__',         # Dynamic imports
    ]
    
    # Tools that require human approval before execution
    APPROVAL_REQUIRED = {"write_file", "send_email", "delete_record"}
    
    def __init__(self, max_cost_usd: float = 1.0, max_iterations: int = 20):
        self.max_cost = max_cost_usd
        self.max_iterations = max_iterations
        self.total_cost = 0.0
        self.iteration_count = 0
    
    def check_tool_call(self, tool_name: str, tool_input: dict) -> tuple[bool, str]:
        """Returns (allowed, reason). Called before each tool execution."""
        # Iteration cap
        self.iteration_count += 1
        if self.iteration_count > self.max_iterations:
            return False, f"Iteration limit ({self.max_iterations}) reached"
        
        # Cost cap
        if self.total_cost > self.max_cost:
            return False, f"Cost limit (${self.max_cost}) reached"
        
        # Code safety check
        if tool_name == "run_python":
            code = tool_input.get("code", "")
            import re
            for pattern in self.FORBIDDEN_PATTERNS:
                if re.search(pattern, code, re.IGNORECASE):
                    return False, f"Forbidden pattern detected: {pattern}"
        
        # Human approval for destructive actions
        if tool_name in self.APPROVAL_REQUIRED:
            approved = self._request_human_approval(tool_name, tool_input)
            if not approved:
                return False, "Human approval denied"
        
        return True, "allowed"
    
    def _request_human_approval(self, tool_name: str, tool_input: dict) -> bool:
        print(f"\n⚠️  APPROVAL REQUIRED")
        print(f"Tool: {tool_name}")
        print(f"Input: {json.dumps(tool_input, indent=2)}")
        response = input("Approve? (y/n): ")
        return response.lower() == 'y'
```

## Evaluation Framework

```python
import json
from dataclasses import dataclass

@dataclass
class AgentEvalCase:
    task: str
    expected_tools: list[str]    # Tools that should be called
    forbidden_tools: list[str]   # Tools that must NOT be called
    output_contains: list[str]   # Strings that must appear in output
    max_iterations: int = 10

EVAL_SUITE = [
    AgentEvalCase(
        task="What is 2^32?",
        expected_tools=["run_python"],
        forbidden_tools=["search_web"],
        output_contains=["4294967296"],
    ),
    AgentEvalCase(
        task="What was the closing price of AAPL yesterday?",
        expected_tools=["search_web"],
        forbidden_tools=[],
        output_contains=["AAPL", "$"],
        max_iterations=5,
    ),
]

def evaluate_agent(eval_cases: list[AgentEvalCase]) -> dict:
    results = []
    for case in eval_cases:
        tools_called = []
        
        # Patch tool executor to track calls
        original_execute = execute_tool
        def tracking_execute(name, inp):
            tools_called.append(name)
            return original_execute(name, inp)
        
        output = run_agent(case.task, max_iterations=case.max_iterations)
        
        score = {
            "task": case.task,
            "expected_tools_called": all(t in tools_called for t in case.expected_tools),
            "no_forbidden_tools": not any(t in tools_called for t in case.forbidden_tools),
            "output_correct": all(s in output for s in case.output_contains),
        }
        score["pass"] = all(score.values())
        results.append(score)
    
    pass_rate = sum(1 for r in results if r["pass"]) / len(results)
    return {"pass_rate": pass_rate, "results": results}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **No iteration cap** | Agent loops forever on hard problems | Always set max_iterations; default 20 |
| **Tools that do too much** | Hard to control, debug, test | One tool = one action; compose at agent level |
| **No human-in-the-loop for irreversible actions** | Agent deletes data, sends emails without oversight | Approval gates for destructive/external actions |
| **Unbounded cost** | Agent spins up 50 searches on one task | Per-run cost cap with hard stop |
| **No evaluation suite** | Can't measure if agent improvements help or hurt | Eval suite from day one |
| **Agentic for simple tasks** | Using 20 tool calls for something a single prompt handles | Single prompt first; agents only when necessary |
| **No sandboxing for code execution** | Agent runs arbitrary code on host system | Isolated container or subprocess with limited permissions |

## 10 Rules

1. Start with the simplest architecture — single agent + tools — before building multi-agent systems.
2. Every agent run has an iteration cap and cost cap. No exceptions.
3. Tools do one thing. Composition happens at the agent level, not within tools.
4. Irreversible actions (delete, send, write to production) require human approval gates.
5. Code execution is always sandboxed — never run agent-generated code on the host system.
6. Build an evaluation suite before optimising — you need to measure to improve.
7. Prompts are configuration — version-control them, treat changes as deployments.
8. Log every tool call with inputs and outputs — you need the trace to debug failures.
9. Agents fail in long tail ways — test adversarial inputs, edge cases, and ambiguous tasks.
10. The best agent is the one that completes the task with the fewest tool calls — efficiency is a quality signal.
