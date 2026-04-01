// Coordinator Agent Service - Manages multiple worker agents in a hierarchical structure

const { Worker } = require("worker_threads");
const skillRegistry = require("./skill-registry");
const agentDelegationService = require("./agent-delegation");

class CoordinatorAgent {
  constructor() {
    this.agents = new Map();
    this.workerAgents = new Map();
    this.agentHierarchy = new Map(); // Parent-child relationships
  }

  /**
   * Create a coordinator agent that manages worker agents
   */
  async createCoordinatorAgent(agentId, config = {}) {
    const coordinatorAgent = {
      id: agentId,
      type: "coordinator",
      status: "online",
      createdAt: new Date().toISOString(),
      config,
      workerAgents: [],
      tasks: [],
      metrics: {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
      },
    };

    this.agents.set(agentId, coordinatorAgent);

    // Register with Redis for persistence
    const redisService = require("./redis");
    await redisService.registerAgent(coordinatorAgent);

    return coordinatorAgent;
  }

  /**
   * Add a worker agent to the coordinator's management
   */
  async addWorkerAgent(coordinatorId, workerAgentId) {
    const coordinator = this.agents.get(coordinatorId);

    if (!coordinator) {
      throw new Error(`Coordinator agent ${coordinatorId} not found`);
    }

    // Add to coordinator's worker agents list
    if (!coordinator.workerAgents.includes(workerAgentId)) {
      coordinator.workerAgents.push(workerAgentId);
    }

    // Establish parent-child relationship
    this.agentHierarchy.set(workerAgentId, {
      parentId: coordinatorId,
      type: "worker",
    });

    // Register the worker agent
    const redisService = require("./redis");
    await redisService.saveAgentState(workerAgentId, {
      type: "worker",
      status: "online",
      coordinatorId,
      createdAt: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Distribute a task to worker agents
   */
  async distributeTask(coordinatorId, task) {
    const coordinator = this.agents.get(coordinatorId);

    if (!coordinator) {
      throw new Error(`Coordinator agent ${coordinatorId} not found`);
    }

    // Create delegation for the task
    const delegation = await agentDelegationService.createDelegation(
      coordinatorId,
      task,
    );

    // Distribute to available worker agents (simple round-robin for now)
    const workerAgents = coordinator.workerAgents;

    if (workerAgents.length === 0) {
      throw new Error("No worker agents available to handle task");
    }

    // For simplicity, we'll just execute the delegation directly
    // In a real implementation, this would distribute to specific workers

    try {
      const result = await agentDelegationService.executeDelegatedTask(
        delegation.id,
      );

      // Update coordinator metrics
      coordinator.metrics.totalTasks += 1;
      coordinator.metrics.completedTasks += 1;

      return {
        delegationId: delegation.id,
        result,
        status: "completed",
      };
    } catch (error) {
      coordinator.metrics.totalTasks += 1;
      coordinator.metrics.failedTasks += 1;

      throw error;
    }
  }

  /**
   * Get coordinator agent information
   */
  getCoordinatorAgent(agentId) {
    return this.agents.get(agentId);
  }

  /**
   * Get all worker agents managed by a coordinator
   */
  getWorkerAgents(coordinatorId) {
    const coordinator = this.agents.get(coordinatorId);

    if (!coordinator) return [];

    return coordinator.workerAgents;
  }

  /**
   * Get agent hierarchy information
   */
  getAgentHierarchy(agentId) {
    return this.agentHierarchy.get(agentId);
  }

  /**
   * Get coordinator metrics
   */
  getCoordinatorMetrics(coordinatorId) {
    const coordinator = this.agents.get(coordinatorId);

    if (!coordinator) return null;

    return coordinator.metrics;
  }

  /**
   * Update coordinator agent status
   */
  async updateCoordinatorStatus(agentId, status) {
    const coordinator = this.agents.get(agentId);

    if (!coordinator) return false;

    coordinator.status = status;
    coordinator.lastUpdated = new Date().toISOString();

    // Update in Redis
    const redisService = require("./redis");
    await redisService.saveAgentState(agentId, {
      ...coordinator,
      status,
    });

    return true;
  }

  /**
   * Remove a worker agent from coordinator management
   */
  removeWorkerAgent(coordinatorId, workerAgentId) {
    const coordinator = this.agents.get(coordinatorId);

    if (!coordinator) return false;

    coordinator.workerAgents = coordinator.workerAgents.filter(
      (id) => id !== workerAgentId,
    );

    // Remove from hierarchy tracking
    this.agentHierarchy.delete(workerAgentId);

    return true;
  }

  /**
   * Get all coordinator agents
   */
  getAllCoordinators() {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.type === "coordinator",
    );
  }
}

// Export singleton instance
module.exports = new CoordinatorAgent();
