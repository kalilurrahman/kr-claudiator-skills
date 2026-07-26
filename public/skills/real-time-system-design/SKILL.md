---
name: real-time-system-design
description: Design systems that deliver updates to clients in real time. Outputs technology selection (WebSocket/SSE/long-poll), connection management, scaling patterns, and failure handling.
argument-hint: [update frequency, client count, message direction, latency requirements]
allowed-tools: Read, Write
---

# Real-Time System Design

Real-time delivery — chat messages, live dashboards, collaborative editing, notifications — requires persistent connections or efficient polling. The right choice between WebSocket, Server-Sent Events (SSE), and long-polling depends on message direction, scale, and infrastructure constraints.

## Technology Selection

```
WEBSOCKET
  Bidirectional: client ↔ server
  Persistent TCP connection
  Best for: Chat, gaming, collaborative editing
  Complexity: Higher (connection management, reconnection)
  Scaling: Requires sticky sessions or pub/sub

SSE (Server-Sent Events)
  Unidirectional: server → client
  HTTP/1.1 persistent connection
  Best for: Live dashboards, notifications, feeds
  Complexity: Lower (native browser EventSource)
  Scaling: Same as regular HTTP; easier than WebSocket

LONG-POLLING
  Request-response pattern; server holds until data available
  Best for: Simple notifications, poor WebSocket environment
  Complexity: Simple; stateless server possible
  Latency: Higher than WebSocket/SSE; good enough for most

WEBHOOK (server-to-server)
  HTTP POST when event occurs
  Best for: B2B integrations, CI/CD notifications
  Complexity: Simple for server; client must have public endpoint
```

## WebSocket Server (Python/FastAPI)

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import dict
import json
import asyncio

app = FastAPI()

class ConnectionManager:
    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = {}  # room_id → [ws]
        self._user_connections: dict[str, WebSocket] = {}   # user_id → ws
    
    async def connect(self, websocket: WebSocket, room_id: str, user_id: str):
        await websocket.accept()
        self._connections.setdefault(room_id, []).append(websocket)
        self._user_connections[user_id] = websocket
    
    def disconnect(self, websocket: WebSocket, room_id: str, user_id: str):
        if room_id in self._connections:
            self._connections[room_id].remove(websocket)
        self._user_connections.pop(user_id, None)
    
    async def broadcast_to_room(self, room_id: str, message: dict, exclude_user: str = None):
        connections = self._connections.get(room_id, [])
        dead = []
        for ws in connections:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(ws)
        for ws in dead:
            connections.remove(ws)
    
    async def send_to_user(self, user_id: str, message: dict):
        ws = self._user_connections.get(user_id)
        if ws:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                self._user_connections.pop(user_id, None)

manager = ConnectionManager()

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, token: str = None):
    user_id = await verify_token(token)
    if not user_id:
        await websocket.close(code=4001)
        return
    
    await manager.connect(websocket, room_id, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Validate and process message
            if message["type"] == "chat":
                await manager.broadcast_to_room(
                    room_id,
                    {"type": "chat", "user_id": user_id, "text": message["text"]},
                    exclude_user=user_id,
                )
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id, user_id)
        await manager.broadcast_to_room(
            room_id, {"type": "user_left", "user_id": user_id}
        )
```

## SSE for Dashboards

```python
from fastapi.responses import StreamingResponse
import asyncio

@app.get("/api/v1/events")
async def event_stream(claims: dict = Depends(require_auth)):
    async def generate():
        while True:
            # Fetch latest metrics
            metrics = await get_live_metrics()
            yield f"data: {json.dumps(metrics)}

"
            await asyncio.sleep(1.0)  # Push every second
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering
        },
    )
```

## Scaling with Redis Pub/Sub

```python
import redis.asyncio as aioredis

# Problem: WebSocket connections are on different servers
# Solution: Redis pub/sub to broadcast across all instances

redis_client = aioredis.from_url("redis://redis:6379")

async def subscribe_to_room(room_id: str, websocket: WebSocket):
    async with redis_client.pubsub() as pubsub:
        await pubsub.subscribe(f"room:{room_id}")
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"].decode())

async def publish_to_room(room_id: str, message: dict):
    await redis_client.publish(
        f"room:{room_id}",
        json.dumps(message)
    )
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **WebSocket for read-only dashboards** | Bidirectional overhead | SSE is simpler for server-push-only |
| **No reconnection logic** | Network blip = permanent disconnect | Exponential backoff reconnection in client |
| **Broadcasting to all connections** | O(n) for every message | Room/topic-based pub/sub; targeted delivery |
| **No connection authentication** | Any client connects | Verify token before accepting WebSocket |
| **Stateful connections without pub/sub** | Can't scale horizontally | Redis pub/sub for cross-instance broadcasting |

## 10 Rules

1. WebSocket for bidirectional; SSE for server-push-only — don't use WebSocket for dashboards.
2. Authentication happens before accepting the connection — not after.
3. Clients always implement reconnection with exponential backoff.
4. Scale horizontally with Redis pub/sub — sticky sessions alone limit scale.
5. Heartbeats (ping/pong) detect dead connections — don't rely on OS TCP timeout.
6. Graceful shutdown drains connections — don't abruptly close active WebSockets.
7. Rate limit messages per connection — prevent DoS from high-frequency senders.
8. Monitor connection count, message throughput, and reconnection rate.
9. Design for missed messages — clients that disconnect may miss events; design replay or catch-up.
10. Test with connection failure injection — what happens when 20% of connections drop simultaneously?

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

The canonical workflow for **Real Time System Design** runs in five stages. Each stage has an explicit exit criterion so the skill knows when to advance.

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

> **Context:** Design systems that deliver updates to clients in real time. Outputs technology selection (WebSocket/SSE/long-poll), connection management, scaling patterns, an
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
