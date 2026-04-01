// Agent routes - REST API and SSE streaming

const redisService = require('../services/redis');
const kafkaService = require('../services/kafka');

/**
 * Register agents route with Fastify
 */
module.exports = async function (fastify, options) {
  // GET /api/agents - List all registered agents
  fastify.get('/', async (request, reply) => {
    const agents = await redisService.getAllAgents();

    return { count: agents.length, agents };
  });

  // GET /api/agents/:agentId - Get specific agent by ID
  fastify.get('/:agentId', async (request, reply) => {
    const agentId = request.params.agentId;

    // Try to get from Redis first, then in-memory
    const state = await redisService.getAgentState(agentId);

    if (!state) {
      return reply.code(404).send({ error: 'Agent not found' });
    }

    // Get skills if available
    const skills = await redisService.getAgentSkills(agentId);

    return { id: agentId, ...state, skills };
  });

  // POST /api/agents - Register a new agent
  fastify.post('/', { schema: { body: {} } }, async (request, reply) => {
    const agent = request.body;

    // Validate required fields
    if (!agent.id) {
      return reply.code(400).send({ error: 'Agent ID is required' });
    }

    // Register agent via Redis service (handles state + skills)
    await redisService.registerAgent(agent);

    return { registered: true, agent };
  });

  // PUT /api/agents/:agentId - Update an existing agent's state
  fastify.put('/:agentId', async (request, reply) => {
    const agentId = request.params.agentId;

    // Update state via Redis service (publishes update event)
    await redisService.publishAgentUpdate(agentId, request.body);

    return { updated: true };
  });

  // DELETE /api/agents/:agentId - Remove an agent
  fastify.delete('/:agentId', async (request, reply) => {
    const agentId = request.params.agentId;

    // Remove state and skills from Redis
    await redisService.removeAgentState(agentId);
    const key = `agent:${agentId}:skills`;
    await redisService.getPubClient().del(key);

    return { removed: true };
  });

  // GET /api/agents/:agentId/skills - Get agent skills
  fastify.get('/:agentId/skills', async (request, reply) => {
    const agentId = request.params.agentId;

    const skills = await redisService.getAgentSkills(agentId);
    
    if (!skills) {
      return reply.code(404).send({ error: 'Agent skills not found' });
    }

    return { agentId, skills };
  });

  // PUT /api/agents/:agentId/skills - Update agent skills
  fastify.put('/:agentId/skills', async (request, reply) => {
    const agentId = request.params.agentId;

    // Validate skills array
    if (!Array.isArray(request.body) || !request.body.every(skill => typeof skill === 'object')) {
      return reply.code(400).send({ error: 'Skills must be an array of objects' });
    }

    await redisService.saveAgentSkills(agentId, request.body);

    // Publish skills update event
    await redisService.publishAgentUpdate(agentId, { type: 'skills.updated', skills: request.body });

    return { updated: true };
  });

  // GET /api/agents/:agentId/skills - Add skill to agent
  fastify.post('/:agentId/skills', async (request, reply) => {
    const agentId = request.params.agentId;

    // Get existing skills, add new one, save
    const existingSkills = await redisService.getAgentSkills(agentId) || [];
    
    if (request.body && typeof request.body === 'object') {
      existingSkills.push(request.body);
    }

    await redisService.saveAgentSkills(agentId, existingSkills);
    
    // Publish skills update event
    await redisService.publishAgentUpdate(agentId, { type: 'skills.added', skill: request.body });

    return { added: true };
  });

  // GET /api/agents/:agentId/tasks - Get tasks assigned to agent
  fastify.get('/:agentId/tasks', async (request, reply) => {
    const agentId = request.params.agentId;

    // Get tasks from Redis (key: agent:{agentId}:tasks)
    const redisClient = await redisService.getPubClient();
    const tasksKey = `agent:${agentId}:tasks`;
    
    const tasksData = await redisClient.get(tasksKey);
    const tasks = tasksData ? JSON.parse(tasksData) : [];

    return { agentId, tasks };
  });

  // POST /api/agents/:agentId/tasks - Assign task to agent
  fastify.post('/:agentId/tasks', async (request, reply) => {
    const agentId = request.params.agentId;

    // Get existing tasks, add new one, save
    const redisClient = await redisService.getPubClient();
    const tasksKey = `agent:${agentId}:tasks`;

    let existingTasks = [];
    const tasksData = await redisClient.get(tasksKey);
    if (tasksData) {
      existingTasks = JSON.parse(tasksData);
    }

    if (request.body && typeof request.body === 'object') {
      existingTasks.push({ ...request.body, assignedAt: new Date().toISOString() });
    }

    await redisClient.set(tasksKey, JSON.stringify(existingTasks));

    // Publish task assignment event
    await redisService.publishAgentUpdate(agentId, { type: 'task.assigned', task: request.body });

    return { assigned: true };
  });

  // POST /api/agents/:agentId/tasks/:taskId/completed - Mark task complete
  fastify.post('/:agentId/tasks/:taskId/completed', async (request, reply) => {
    const agentId = request.params.agentId;
    const taskId = request.params.taskId;

    // Get existing tasks, mark as completed
    const redisClient = await redisService.getPubClient();
    const tasksKey = `agent:${agentId}:tasks`;

    let existingTasks = [];
    const tasksData = await redisClient.get(tasksKey);
    if (tasksData) {
      existingTasks = JSON.parse(tasksData);
    }

    const taskIndex = existingTasks.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
      existingTasks[taskIndex].completed = true;
      existingTasks[taskIndex].completedAt = new Date().toISOString();

      await redisClient.set(tasksKey, JSON.stringify(existingTasks));
    }

    // Publish task completion event
    await redisService.publishAgentUpdate(agentId, { type: 'task.completed', taskId });

    return { completed: true };
  });

  // SSE streaming endpoint - GET /api/agents/:agentId/stream (already registered in index.js)
  // This is where the SSE stream sends agent updates to the client
};
