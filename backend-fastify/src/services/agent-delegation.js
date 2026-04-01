// Agent Delegation Service - Subagent delegation system with Web Workers and JSON-RPC

const {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} = require("worker_threads");
const fs = require("fs").promises;
const path = require("path");

class AgentDelegationService {
  constructor() {
    this.delegations = new Map();
    this.workerPool = [];
    this.nextDelegationId = 1;
  }

  /**
   * Create a new delegation request
   */
  async createDelegation(agentId, task, options = {}) {
    const delegationId = `delegation-${this.nextDelegationId++}`;

    const delegation = {
      id: delegationId,
      agentId,
      task,
      status: "pending",
      createdAt: new Date().toISOString(),
      options,
    };

    this.delegations.set(delegationId, delegation);

    // Store in Redis for persistence
    const redisService = require("./redis");
    await redisService.saveDelegationRequest(delegation);

    return delegation;
  }

  /**
   * Execute a delegated task using Web Workers
   */
  async executeDelegatedTask(delegationId) {
    const delegation = this.delegations.get(delegationId);

    if (!delegation) {
      throw new Error(`Delegation ${delegationId} not found`);
    }

    try {
      // Update status to in-progress
      delegation.status = "in_progress";
      delegation.startedAt = new Date().toISOString();

      // Store updated status
      const redisService = require("./redis");
      await redisService.saveDelegationRequest(delegation);

      // Create a Web Worker to handle the task
      const worker = new Worker(path.join(__dirname, "worker-task.js"), {
        workerData: {
          delegationId,
          task: delegation.task,
        },
      });

      // Handle worker completion
      return new Promise((resolve, reject) => {
        worker.on("message", async (result) => {
          // Update delegation status
          delegation.status = "completed";
          delegation.result = result;
          delegation.completedAt = new Date().toISOString();

          // Store completion
          await redisService.saveDelegationRequest(delegation);

          resolve(result);
        });

        worker.on("error", async (error) => {
          // Update delegation status to failed
          delegation.status = "failed";
          delegation.error = error.message;
          delegation.completedAt = new Date().toISOString();

          // Store failure
          await redisService.saveDelegationRequest(delegation);

          reject(error);
        });

        worker.on("exit", (code) => {
          if (code !== 0) {
            const error = new Error(`Worker stopped with exit code ${code}`);
            reject(error);
          }
        });
      });
    } catch (error) {
      // Update delegation status to failed
      delegation.status = "failed";
      delegation.error = error.message;

      const redisService = require("./redis");
      await redisService.saveDelegationRequest(delegation);

      throw error;
    }
  }

  /**
   * Get delegation history
   */
  async getDelegationHistory() {
    const redisService = require("./redis");
    return await redisService.getDelegationHistory();
  }

  /**
   * Get delegation by ID
   */
  getDelegation(delegationId) {
    return this.delegations.get(delegationId);
  }

  /**
   * Cancel a delegation
   */
  async cancelDelegation(delegationId) {
    const delegation = this.delegations.get(delegationId);

    if (delegation && delegation.status === "pending") {
      delegation.status = "cancelled";
      delegation.completedAt = new Date().toISOString();

      const redisService = require("./redis");
      await redisService.saveDelegationRequest(delegation);

      return true;
    }

    return false;
  }

  /**
   * Get all pending delegations
   */
  getPendingDelegations() {
    return Array.from(this.delegations.values()).filter(
      (d) => d.status === "pending",
    );
  }
}

// Export singleton instance
module.exports = new AgentDelegationService();
