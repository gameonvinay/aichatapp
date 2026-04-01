// Redis service for agent state management and pub/sub messaging

const Redis = require("ioredis");
require("dotenv").config();

let pubClient = null;
let subClient = null;
let agentStates = new Map(); // In-memory state for development

/**
 * Initialize Redis pub/sub clients
 */
async function initializeClients() {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  pubClient = new Redis(redisUrl);
  subClient = new Redis(redisUrl);

  await Promise.all([pubClient.ping(), subClient.ping()]);

  console.log("Redis clients initialized successfully");
}

/**
 * Get or create pub client (for publishing messages)
 */
function getPubClient() {
  return pubClient;
}

/**
 * Get or create sub client (for subscribing to messages)
 */
function getSubscriber() {
  return subClient;
}

/**
 * Save agent state to Redis with optional TTL (Time-To-Live) in seconds
 */
async function saveAgentState(agentId, state, ttlSeconds = null) {
  const key = `agent:${agentId}:state`;

  if (ttlSeconds) {
    await pubClient.setex(key, ttlSeconds, JSON.stringify(state));
  } else {
    await pubClient.set(key, JSON.stringify(state));
  }

  // Also keep in-memory for quick access during development
  agentStates.set(agentId, state);

  return true;
}

/**
 * Get agent state from Redis
 */
async function getAgentState(agentId) {
  const key = `agent:${agentId}:state`;

  // Try Redis first, then fall back to in-memory state
  const redisState = await pubClient.get(key);

  if (redisState) {
    return JSON.parse(redisState);
  }

  // Fall back to in-memory state (development)
  return agentStates.get(agentId);
}

/**
 * Publish an update event to all subscribers of an agent's updates channel
 */
async function publishAgentUpdate(agentId, update) {
  const channel = `agent:${agentId}:updates`;

  // Extract nested agent data if present to avoid flattening
  const agentData = update.agent || {};
  const updateType = update.type;
  const updateWithoutAgent = { ...update };
  delete updateWithoutAgent.agent;
  delete updateWithoutAgent.type;

  // Save state - merge agent data properly
  const currentState = await getAgentState(agentId) || {};
  const newState = {
    ...currentState,
    ...agentData,
    ...updateWithoutAgent,
    type: agentData.type || currentState.type,
    status: agentData.status || currentState.status,
  };
  await saveAgentState(agentId, newState);

  // Publish update to subscribers
  await pubClient.publish(channel, JSON.stringify(update));

  return true;
}

/**
 * Remove agent state from Redis and in-memory storage
 */
async function removeAgentState(agentId) {
  const key = `agent:${agentId}:state`;

  await pubClient.del(key);
  agentStates.delete(agentId);

  return true;
}

/**
 * Save skills registry for an agent (array of skill objects)
 */
async function saveAgentSkills(agentId, skills) {
  const key = `agent:${agentId}:skills`;

  await pubClient.set(key, JSON.stringify(skills));
  agentStates.set(`${agentId}:skills`, skills);

  return true;
}

/**
 * Get skills registry for an agent
 */
async function getAgentSkills(agentId) {
  const key = `agent:${agentId}:skills`;

  // Try Redis first
  const redisSkills = await pubClient.get(key);

  if (redisSkills) {
    return JSON.parse(redisSkills);
  }

  // Fall back to in-memory state
  const skillState = agentStates.get(`${agentId}:skills`);

  // Also update in-memory with Redis data
  if (skillState === undefined && redisSkills) {
    agentStates.set(`${agentId}:skills`, JSON.parse(redisSkills));
  }

  return skillState || [];
}

/**
 * Register a new agent with initial state and skills
 */
async function registerAgent(agent) {
  const state = agent.state || {
    name: agent.name,
    type: agent.type,
    status: agent.status,
  };
  await saveAgentState(agent.id, state);

  if (agent.skills && Array.isArray(agent.skills)) {
    await saveAgentSkills(agent.id, agent.skills);
  }

  // Publish registration event
  await publishAgentUpdate(agent.id, { type: "agent.registered", agent });

  return true;
}

/**
 * Get all registered agents from in-memory storage (development)
 */
async function getAllAgents() {
  // Scan Redis for all agent state keys
  const keys = await pubClient.keys("agent:*:state");
  const agentIds = [...new Set(keys.map((k) => k.split(":")[1]))];

  const agents = [];
  for (const agentId of agentIds) {
    const state = await getAgentState(agentId);
    if (state) {
      agents.push({ id: agentId, ...state });
    }
  }

  return agents;
}

/**
 * Save delegation request to Redis for tracking
 */
async function saveDelegationRequest(delegation) {
  const key = `delegation:${delegation.id}`;

  await pubClient.setex(key, 3600, JSON.stringify(delegation)); // Store for 1 hour

  return true;
}

/**
 * Get delegation history from Redis
 */
async function getDelegationHistory() {
  // Get keys matching delegation: prefix
  const pattern = "delegation:*";
  let keys = await pubClient.keys(pattern);

  if (keys.length === 0) return [];

  const delegations = [];
  for (const key of keys.slice(-50)) {
    // Limit to last 50
    const delegation = JSON.parse(await pubClient.get(key));
    delegations.push(delegation);
    // Clean up old keys (keep last 50)
    await pubClient.del(key);
  }

  return delegations;
}

/**
 * Get tasks delegated to a specific agent from Redis
 */
async function getDelegatedTasks(agentId) {
  const key = `agent:${agentId}:delegated-tasks`;

  // Return tasks from Redis if available, otherwise use in-memory fallback
  const redisTasks = await pubClient.smembers(key);

  if (redisTasks.size > 0) {
    const tasks = [];
    for (const taskId of redisTasks) {
      const taskData = JSON.parse(await pubClient.get(`task:${taskId}`));
      tasks.push(taskData);
    }
    return tasks;
  }

  // Fallback to in-memory (development)
  const tasks = [];
  for (const [taskId] of agentStates.get(`${agentId}:delegated-tasks`) || []) {
    const taskData = agentStates.get(`task:${taskId}`);
    if (taskData) tasks.push(taskData);
  }

  return tasks;
}

/**
 * Mark a delegated task as completed in Redis
 */
async function completeDelegatedTask(delegationId, result, completedAt) {
  const key = `delegation:${delegationId}`;

  // Update with completion status and result
  await pubClient.setex(
    key,
    3600,
    JSON.stringify({
      ...JSON.parse((await pubClient.get(key)) || "{}"),
      status: "completed",
      result,
      completedAt,
    }),
  );

  return true;
}

/**
 * Get delegation history from Redis
 */
async function getDelegationHistory() {
  // Get keys matching delegation: prefix
  const pattern = "delegation:*";
  let keys = await pubClient.keys(pattern);

  if (keys.length === 0) return [];

  const delegations = [];
  for (const key of keys.slice(-50)) {
    // Limit to last 50
    const delegation = JSON.parse(await pubClient.get(key));
    delegations.push(delegation);
  }

  return delegations;
}

/**
 * Close all Redis connections gracefully
 */
async function closeConnections() {
  if (pubClient) await pubClient.quit();
  if (subClient) await subClient.quit();
}

module.exports = {
  initializeClients,
  getPubClient,
  getSubscriber,
  saveAgentState,
  getAgentState,
  publishAgentUpdate,
  removeAgentState,
  saveAgentSkills,
  getAgentSkills,
  registerAgent,
  getAllAgents,
  closeConnections,

  // Delegation methods
  saveDelegationRequest,
  getDelegatedTasks,
  completeDelegatedTask,
};
