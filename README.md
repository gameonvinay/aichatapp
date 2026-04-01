# Deep Agents Learning Platform

A full-stack learning platform for mastering deep agents, event streaming, and real-time communication systems. Built with Fastify (backend) and Next.js + shadcn/ui (frontend).

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│           Frontend: Next.js + shadcn/ui         │
│  - React Server Components (SSR)                │
│  - SSE for real-time updates                    │
│  - Zustand state management                     │
└───────────────────┬─────────────────────────────┘
                    ↓ HTTP/WebSocket/SSE
┌───────────────────┴─────────────────────────────┐
│        Backend: Fastify + Node.js               │
│  - REST API endpoints                           │
│  - Kafka for event streaming                    │
│  - Redis for pub/sub state management           │
└───────────────────┬─────────────────────────────┘
                    ↓
┌───────────────────┴─────────────────────────────┐
│              Data Storage Layer                   │
│  - PostgreSQL with pgvector                     │
│  - Redis (state & pub/sub)                      │
└───────────────────────────────────────────────────┘
```

## Prerequisites

- Docker & Docker Compose (required)
- Node.js 18+ (for local development without Docker)

## Quick Start with Docker Compose

### 1. Clone and Navigate to Project Directory

```bash
cd /Users/vinaysaini/Projects/lmstudio
```

### 2. Start All Services

```bash
docker-compose up -d
```

This will start:
- **Frontend** (Next.js) on http://localhost:3000
- **Backend** (Fastify) on http://localhost:8080  
- **Redis** on localhost:6379
- **PostgreSQL + pgvector** on localhost:5432
- **Kafka** on localhost:9092/9093
- **ZooKeeper** on localhost:2181

### 3. View Logs (Optional)

```bash
docker-compose logs -f frontend-nextjs backend-fastify
```

## Available Endpoints

### Backend API (http://localhost:8080)

```bash
# Health check
curl http://localhost:8080/health

# Get all agents
curl http://localhost:8080/api/agents

# Register a new agent (example)
curl -X POST http://localhost:8080/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "id": "agent-1",
    "name": "Data Processing Agent",
    "type": "data-processing",
    "state": { "status": "online" },
    "skills": [
      {"name": "data-analysis", "category": "reasoning"},
      {"name": "transformations", "category": "action"}
    ]
  }'

# Get specific agent by ID
curl http://localhost:8080/api/agents/agent-1

# SSE streaming for an agent (keep connection open)
curl http://localhost:8080/api/agents/agent-1/stream

# Update agent state
curl -X PUT http://localhost:8080/api/agents/agent-1 \
  -H "Content-Type: application/json" \
  -d '{"status": "busy"}'

# Get agent skills
curl http://localhost:8080/api/agents/agent-1/skills

# Add skill to agent
curl -X POST http://localhost:8080/api/agents/agent-1/skills \
  -H "Content-Type: application/json" \
  -d '{"name": "machine-learning", "category": "reasoning"}'

# Assign task to agent
curl -X POST http://localhost:8080/api/agents/agent-1/tasks \
  -H "Content-Type: application/json" \
  -d '{"id": "task-1", "description": "Process dataset X"}'

# Mark task complete
curl -X POST http://localhost:8080/api/agents/agent-1/tasks/task-1/completed

# Create Kafka topic
curl -X POST http://localhost:8080/api/kafka/topics/my-topic

# Publish event to Kafka topic
curl -X POST http://localhost:8080/api/kafka/topics/my-topic/events \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, World!", "timestamp": "2026-03-27T12:00:00Z"}'
```

### Frontend (http://localhost:3000)

Visit http://localhost:3000 to see the agent dashboard. The dashboard displays all registered agents and updates in real-time via SSE.

## Project Structure

```
deep-agents-learning/
├── docker-compose.yml          # Service orchestration
├── README.md                   # This file

# Backend (Fastify)
backend-fastify/
├── Dockerfile                  # Backend container image
├── package.json                # Backend dependencies
└── src/                        # Backend source code
    ├── index.js               # Fastify server entry point
    ├── routes/                # API route handlers
    │   └── agents.js          # Agent management endpoints
    └── services/              # Service implementations
        ├── redis.js           # Redis pub/sub state management
        └── kafka.js           # Kafka event streaming

# Frontend (Next.js)
frontend-nextjs/
├── Dockerfile                  # Frontend container image
├── next.config.js             # Next.js configuration
├── tailwind.config.js         # Tailwind CSS configuration
├── globals.css                # Global styles
├── package.json               # Frontend dependencies
└── pages/                     # Next.js pages
    └── index.js              # Main dashboard page

# Shared components (used by both frontend and backend)
components/                     
├── AgentList.js              # List of all agents
└── AgentCard.js              # Individual agent display

# Learning resources (optional)
backend.md                      # Backend learning materials
frontend.md                     # Frontend learning materials
```

## Learning Path (Condensed - Highest Value Topics First)

### Phase 1: Core Foundation (~30 hours)
- React Server Components & SSE streaming
- Fastify server setup with REST API
- Redis for state management and pub/sub

### Phase 2: Event Streaming (~35 hours)
- Kafka basics (topics, producers, consumers)
- WebSocket coordination for real-time updates

### Phase 3: Vector Storage (~40 hours)
- pgvector for embedding similarity search

### Phase 4: Full System Integration (~30 hours)
- Complete multi-agent system with all components

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

### Kafka connection errors

Kafka requires ZooKeeper to be running:
```bash
docker-compose logs zookeeper
```

### View all service status

```bash
docker-compose ps
```

## Development Mode (without Docker)

For local development without Docker, you can run services directly:

1. Install dependencies in each service folder
2. Run local Redis, PostgreSQL, and Kafka instances
3. Update environment variables in `.env` files

## License

MIT - Feel free to use for learning purposes.