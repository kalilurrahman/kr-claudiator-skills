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
