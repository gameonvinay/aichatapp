require("dotenv").config();

const fastify = require("fastify")({ logger: true });
const cors = require("@fastify/cors");
const helmet = require("@fastify/helmet");

// Register plugins
fastify.register(cors, { origin: "*" });
fastify.register(helmet);

// Import services
const redisService = require("./services/redis");
const kafkaService = require("./services/kafka");
const skillRegistry = require("./services/skill-registry");
const agentDelegationService = require("./services/agent-delegation");
const coordinatorAgentService = require("./services/coordinator-agent");
const db = require("./services/db");

// Import routes
const agentRoutes = require("./routes/agents");
const chatRoutes = require("./routes/chat");
const conversationRoutes = require("./routes/conversations");
fastify.register(agentRoutes, { prefix: "/api/agents" });
fastify.register(chatRoutes, { prefix: "/api/chat" });
fastify.register(conversationRoutes, { prefix: "/api/conversations" });

// Health check endpoint
fastify.get("/health", async (request, reply) => {
  return { status: "ok" };
});

// Kafka topic creation and event publishing endpoint
fastify.post("/api/kafka/topics/:topicName", async (request, reply) => {
  const topicName = request.params.topicName;
  await kafkaService.createTopic(topicName);

  return { created: true, topic: topicName };
});

// Publish event to Kafka topic
fastify.post("/api/kafka/topics/:topicName/events", async (request, reply) => {
  const topicName = request.params.topicName;
  const event = request.body;

  await kafkaService.publishEvent(topicName, event);

  return { published: true };
});

// Skill registry endpoints
fastify.post("/api/skills", async (request, reply) => {
  const { id, name, description, category, tags } = request.body;

  skillRegistry.registerSkill(id, {
    name,
    description,
    category,
    tags,
  });

  return { registered: true, skillId: id };
});

fastify.get("/api/skills/:skillId", async (request, reply) => {
  const skill = skillRegistry.getSkill(request.params.skillId);

  if (!skill) {
    return reply.code(404).send({ error: "Skill not found" });
  }

  return skill;
});

fastify.get("/api/skills", async (request, reply) => {
  return { skills: skillRegistry.getAllSkills() };
});

// Agent delegation endpoints
fastify.post("/api/agents/:agentId/delegations", async (request, reply) => {
  const { agentId } = request.params;
  const task = request.body;

  try {
    const delegation = await agentDelegationService.createDelegation(
      agentId,
      task,
    );

    return {
      delegation,
      status: "created",
    };
  } catch (error) {
    return reply.code(500).send({ error: error.message });
  }
});

fastify.post(
  "/api/delegations/:delegationId/execute",
  async (request, reply) => {
    const { delegationId } = request.params;

    try {
      const result =
        await agentDelegationService.executeDelegatedTask(delegationId);

      return {
        delegationId,
        result,
        status: "completed",
      };
    } catch (error) {
      return reply.code(500).send({ error: error.message });
    }
  },
);

fastify.get("/api/delegations/history", async (request, reply) => {
  const history = await agentDelegationService.getDelegationHistory();

  return { delegations: history };
});

// Coordinator agent endpoints
fastify.post("/api/agents/:agentId/coordinator", async (request, reply) => {
  const { agentId } = request.params;
  const config = request.body;

  try {
    const coordinator = await coordinatorAgentService.createCoordinatorAgent(
      agentId,
      config,
    );

    return {
      coordinator,
      status: "created",
    };
  } catch (error) {
    return reply.code(500).send({ error: error.message });
  }
});

fastify.post(
  "/api/agents/:coordinatorId/workers/:workerAgentId",
  async (request, reply) => {
    const { coordinatorId, workerAgentId } = request.params;

    try {
      await coordinatorAgentService.addWorkerAgent(
        coordinatorId,
        workerAgentId,
      );

      return {
        status: "worker_added",
        coordinatorId,
        workerAgentId,
      };
    } catch (error) {
      return reply.code(500).send({ error: error.message });
    }
  },
);

fastify.post("/api/coordinators/:coordinatorId/tasks", async (request, reply) => {
  const { coordinatorId } = request.params;
  const task = request.body;

  try {
    const result = await coordinatorAgentService.distributeTask(
      coordinatorId,
      task,
    );

    return {
      ...result,
      status: "distributed",
    };
  } catch (error) {
    return reply.code(500).send({ error: error.message });
  }
});

// SSE endpoint for agent updates
fastify.get("/api/agents/:agentId/stream", async (request, reply) => {
  const agentId = request.params.agentId;
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  // Create a dedicated Redis client for this SSE connection
  const Redis = require("ioredis");
  const subscriber = new Redis(redisUrl);

  // Write headers directly to the raw response for SSE streaming
  const raw = reply.raw;
  raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
    "Access-Control-Allow-Origin": "*",
  });

  const channel = `agent:${agentId}:updates`;
  await subscriber.subscribe(channel);

  // Send initial connection message
  raw.write(`data: ${JSON.stringify({ type: "connected", agentId })}\n\n`);

  const heartbeat = setInterval(() => {
    if (raw.destroyed) {
      clearInterval(heartbeat);
      return;
    }
    raw.write(":\n");
  }, 30000);

  const messageHandler = (ch, message) => {
    if (!raw.destroyed && ch === channel) {
      raw.write(`data: ${message}\n\n`);
    }
  };

  subscriber.on("message", messageHandler);

  raw.on("close", () => {
    clearInterval(heartbeat);
    subscriber.off("message", messageHandler);
    subscriber.unsubscribe(channel);
    subscriber.quit();
  });

  // Return a promise that never resolves — keeps the connection open
  return new Promise(() => {});
});

// Start server with service initialization
const start = async () => {
  try {
    // Initialize Redis clients
    await redisService.initializeClients();
    console.log("Redis clients initialized");

    // Initialize PostgreSQL pool
    const pool = db.getPool();
    await pool.query('SELECT 1');
    console.log("PostgreSQL connected");

    // Initialize Kafka (non-blocking, continues even if Kafka is unavailable)
    kafkaService.initializeKafka().catch((err) => {
      console.warn("Kafka initialization failed (non-critical):", err.message);
    });

    await fastify.listen({ host: "0.0.0.0", port: 8080 });
    console.log("Fastify server running on http://localhost:8080");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
