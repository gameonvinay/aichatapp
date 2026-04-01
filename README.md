# AI Chat App

A multi-agent AI chat application with real-time reasoning/thinking display and tool execution, powered by LM Studio.

## Features

- **Streaming chat** via SSE from frontend through backend to LM Studio
- **Reasoning/thinking tokens** streamed and displayed separately from final answer
- **Agentic tool execution loop** — LLM decides to call tools, executes them, feeds results back, iterates up to 5 times
- **Built-in tools**: web search, code review, summarization, data extraction
- **Multi-agent architecture** with coordinator/worker delegation
- **Agent skill registry** with dynamic tool building from registered skills
- **Agent memory** and state management via Redis
- **Event streaming** with Kafka (KRaft mode, no ZooKeeper)
- **Vector embeddings** with pgvector for semantic search

## Architecture

```
┌─────────────────────────────────────────────────┐
│           Frontend: Next.js + shadcn/ui         │
│  - App Router with React Server Components      │
│  - SSE streaming chat UI with reasoning display │
│  - Zustand state management                     │
│  - Agent topology visualization (@xyflow/react) │
└───────────────────┬─────────────────────────────┘
                    ↓ HTTP/SSE
┌───────────────────┴─────────────────────────────┐
│        Backend: Fastify + Node.js               │
│  - REST API endpoints                           │
│  - SSE streaming to frontend                    │
│  - Tool execution loop (LLM → tools → LLM)      │
│  - Kafka for event streaming                    │
│  - Redis for pub/sub & agent state              │
└───────────────────┬─────────────────────────────┘
                    ↓
┌───────────────────┴─────────────────────────────┐
│              Data & AI Layer                     │
│  - LM Studio (local LLM via OpenAI-compatible   │
│    API with reasoning_content support)          │
│  - PostgreSQL with pgvector                     │
│  - Redis (state, pub/sub, agent memory)         │
│  - Kafka (event streaming, KRaft mode)          │
└───────────────────────────────────────────────────┘
```

## Prerequisites

- Docker & Docker Compose
- LM Studio running locally with an OpenAI-compatible API

## Quick Start

### 1. Clone and start all services

```bash
git clone https://github.com/gameonvinay/aichatapp.git
cd aichatapp
docker-compose up -d
```

### 2. Configure LM Studio

Set your LM Studio endpoint in `backend-fastify/.env`:

```env
LM_STUDIO_URL=http://host.docker.internal:1234
```

Replace `http://host.docker.internal:1234` with your actual LM Studio URL.

### 3. Access the app

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080

## How It Works

### Chat Flow

1. User sends a message on the frontend
2. Request proxies through Next.js API route (`/api/chat/stream`)
3. Backend receives the message and builds tool definitions from registered agent skills
4. Backend streams to LM Studio via SSE
5. Response chunks (reasoning + content) stream back to the UI in real-time

### Tool Execution Loop

1. LLM receives the user message with available tool definitions
2. If the LLM decides to use a tool, it returns a `tool_calls` array
3. Backend executes the requested skill (web-search, code-review, summarization, data-extraction, or custom registered skills)
4. Tool results are fed back to the LLM as `tool` messages
5. Loop repeats (max 5 iterations) until the LLM produces a final answer
6. Final answer is streamed back with any reasoning tokens shown first

### Reasoning/Thinking Display

The streaming parser separates `reasoning_content` (or `reasoning`) tokens from regular `content` tokens. The UI displays the model's thinking process before showing the final answer.

## Services & Ports

| Service         | Port   | Description                          |
|-----------------|--------|--------------------------------------|
| Frontend        | 3000   | Next.js app with shadcn/ui           |
| Backend         | 8080   | Fastify API server                   |
| Redis           | 6379   | Agent state, pub/sub, memory         |
| PostgreSQL      | 5432   | Persistent storage + pgvector        |
| Kafka           | 9092   | Event streaming (KRaft mode)         |

## API Endpoints

### Health & Models

```bash
# Health check
curl http://localhost:8080/health

# Get available models from LM Studio
curl http://localhost:8080/api/chat/models
```

### Chat

```bash
# Streaming chat (SSE)
curl -X POST http://localhost:8080/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Search for the latest news about AI"}
    ]
  }'
```

Stream events:
- `{"type":"start"}` — connection opened
- `{"type":"reasoning_chunk","content":"..."}` — thinking token
- `{"type":"reasoning","content":"..."}` — complete reasoning block
- `{"type":"content","content":"..."}` — answer token
- `{"type":"tool_calls","calls":[...]}` — tool execution results
- `{"type":"done"}` — stream complete
- `{"type":"error","error":"..."}` — error

### Agents

```bash
# Get all agents
curl http://localhost:8080/api/agents

# Register a new agent
curl -X POST http://localhost:8080/api/agents \
  -H "Content-Type: application/json" \
  -d '{"id":"agent-1","name":"Research Agent","type":"research"}'

# Get agent by ID
curl http://localhost:8080/api/agents/agent-1

# Update agent state
curl -X PUT http://localhost:8080/api/agents/agent-1 \
  -H "Content-Type: application/json" \
  -d '{"status":"busy"}'

# SSE stream for agent updates
curl http://localhost:8080/api/agents/agent-1/stream

# Get agent skills
curl http://localhost:8080/api/agents/agent-1/skills

# Add skill to agent
curl -X POST http://localhost:8080/api/agents/agent-1/skills \
  -H "Content-Type: application/json" \
  -d '{"name":"web-search","category":"action"}'

# Assign task to agent
curl -X POST http://localhost:8080/api/agents/agent-1/tasks \
  -H "Content-Type: application/json" \
  -d '{"id":"task-1","description":"Research topic X"}'

# Mark task complete
curl -X POST http://localhost:8080/api/agents/agent-1/tasks/task-1/completed
```

### Skills

```bash
# Register a skill
curl -X POST http://localhost:8080/api/skills \
  -H "Content-Type: application/json" \
  -d '{"id":"web-search","name":"Web Search","category":"action"}'

# Get all skills
curl http://localhost:8080/api/skills

# Get skill by ID
curl http://localhost:8080/api/skills/web-search
```

### Agent Delegation

```bash
# Delegate a task from one agent to another
curl -X POST http://localhost:8080/api/agents/agent-1/delegations \
  -H "Content-Type: application/json" \
  -d '{"targetAgentId":"agent-2","task":"Analyze this data"}'

# Execute a delegated task
curl -X POST http://localhost:8080/api/delegations/:delegationId/execute

# Get delegation history
curl http://localhost:8080/api/delegations/history
```

### Coordinator Agents

```bash
# Create a coordinator agent
curl -X POST http://localhost:8080/api/agents/agent-1/coordinator \
  -H "Content-Type: application/json" \
  -d '{"name":"Main Coordinator"}'

# Add a worker to a coordinator
curl -X POST http://localhost:8080/api/agents/coordinator-1/workers/worker-1

# Distribute a task across workers
curl -X POST http://localhost:8080/api/coordinators/coordinator-1/tasks \
  -H "Content-Type: application/json" \
  -d '{"description":"Process this dataset"}'
```

### Kafka Events

```bash
# Create a topic
curl -X POST http://localhost:8080/api/kafka/topics/my-topic

# Publish an event
curl -X POST http://localhost:8080/api/kafka/topics/my-topic/events \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","timestamp":"2026-04-01T00:00:00Z"}'
```

## Project Structure

```
aichatapp/
├── docker-compose.yml              # Service orchestration
├── README.md                       # This file
│
├── backend-fastify/
│   ├── Dockerfile
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.js                # Fastify server entry point
│       ├── routes/
│       │   ├── agents.js           # Agent CRUD, tasks, skills
│       │   └── chat.js             # Streaming chat endpoint
│       ├── services/
│       │   ├── llm.js              # LM Studio integration + tool loop + reasoning stream
│       │   ├── tool-executor.js    # Tool definitions & skill execution
│       │   ├── redis.js            # Redis client & agent state
│       │   ├── kafka.js            # Kafka producer/consumer
│       │   ├── coordinator-agent.js # Coordinator/worker management
│       │   ├── agent-delegation.js  # Task delegation between agents
│       │   ├── agent-memory.js      # Agent conversation memory
│       │   ├── skill-registry.js    # Dynamic skill registration
│       │   ├── embedding-pipeline.js # pgvector embedding pipeline
│       │   ├── pgvector-integration.js
│       │   ├── event-detection.js
│       │   ├── realtime-analytics.js
│       │   ├── worker-task.js
│       │   └── kafka-consumer-groups.js
│       └── tools/
│           ├── web-search.js       # Web search tool
│           ├── code-review.js      # Code review tool
│           ├── summarization.js    # Text summarization tool
│           └── data-extraction.js  # Data extraction tool
│
├── frontend-nextjs/
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── app/
│       ├── layout.tsx
│       ├── page.tsx
│       ├── chat/page.tsx           # Chat UI
│       └── api/chat/stream/route.ts # SSE proxy to backend
│
├── backend.md                      # Backend documentation
└── frontend.md                     # Frontend documentation
```

## Troubleshooting

### Backend won't start

Check if Redis is running:
```bash
docker-compose exec redis redis-cli ping
# Should return "PONG"
```

### Frontend can't connect to backend

Ensure the backend is accessible:
```bash
curl http://localhost:8080/health
# Should return {"status":"ok"}
```

### LM Studio not responding

Verify your LM Studio endpoint is correct and the server is running:
```bash
curl http://localhost:8080/api/chat/models
```

### Kafka connection errors

Check Kafka is healthy:
```bash
docker-compose logs kafka
```

### View all service status

```bash
docker-compose ps
```

## License

MIT
