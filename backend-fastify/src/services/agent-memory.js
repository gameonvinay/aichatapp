// Agent Memory Service - Implements working, semantic, and episodic memory systems

class AgentMemory {
  constructor() {
    this.memoryStore = new Map();
  }

  /**
   * Initialize memory for an agent
   */
  async initializeAgentMemory(agentId) {
    const agentKey = `agent:${agentId}:memory`;

    // Initialize memory systems
    this.memoryStore.set(agentKey, {
      working: new Map(), // Short-term memory
      semantic: new Map(), // Long-term knowledge base
      episodic: [], // Event history
      metadata: {
        createdAt: new Date().toISOString(),
        lastAccessed: null,
        size: 0,
      },
    });

    return true;
  }

  /**
   * Store data in working memory (short-term)
   */
  async storeInWorkingMemory(agentId, key, data) {
    const agentKey = `agent:${agentId}:memory`;
    const memory = this.memoryStore.get(agentKey);

    if (!memory) {
      await this.initializeAgentMemory(agentId);
      return this.storeInWorkingMemory(agentId, key, data);
    }

    memory.working.set(key, {
      value: data,
      timestamp: new Date().toISOString(),
      ttl: Date.now() + 5 * 60 * 1000, // 5 minute TTL
    });

    memory.metadata.lastAccessed = new Date().toISOString();
    memory.metadata.size += 1;

    return true;
  }

  /**
   * Retrieve from working memory
   */
  async getFromWorkingMemory(agentId, key) {
    const agentKey = `agent:${agentId}:memory`;
    const memory = this.memoryStore.get(agentKey);

    if (!memory) return null;

    const item = memory.working.get(key);
    if (item && Date.now() > item.ttl) {
      // Remove expired item
      memory.working.delete(key);
      return null;
    }

    return item ? item.value : null;
  }

  /**
   * Store data in semantic memory (long-term knowledge)
   */
  async storeInSemanticMemory(agentId, key, data) {
    const agentKey = `agent:${agentId}:memory`;
    const memory = this.memoryStore.get(agentKey);

    if (!memory) {
      await this.initializeAgentMemory(agentId);
      return this.storeInSemanticMemory(agentId, key, data);
    }

    memory.semantic.set(key, {
      value: data,
      timestamp: new Date().toISOString(),
      metadata: {},
    });

    memory.metadata.lastAccessed = new Date().toISOString();
    memory.metadata.size += 1;

    return true;
  }

  /**
   * Retrieve from semantic memory
   */
  async getFromSemanticMemory(agentId, key) {
    const agentKey = `agent:${agentId}:memory`;
    const memory = this.memoryStore.get(agentKey);

    if (!memory) return null;

    const item = memory.semantic.get(key);
    return item ? item.value : null;
  }

  /**
   * Store episodic memory (event history)
   */
  async storeEpisodicMemory(agentId, event) {
    const agentKey = `agent:${agentId}:memory`;
    const memory = this.memoryStore.get(agentKey);

    if (!memory) {
      await this.initializeAgentMemory(agentId);
      return this.storeEpisodicMemory(agentId, event);
    }

    const episodicEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    // Keep only recent events (last 100)
    if (memory.episodic.length >= 100) {
      memory.episodic.shift();
    }

    memory.episodic.push(episodicEvent);
    memory.metadata.lastAccessed = new Date().toISOString();

    return episodicEvent.id;
  }

  /**
   * Retrieve recent episodic memories
   */
  async getRecentEpisodicMemory(agentId, limit = 10) {
    const agentKey = `agent:${agentId}:memory`;
    const memory = this.memoryStore.get(agentKey);

    if (!memory) return [];

    return memory.episodic.slice(-limit).reverse();
  }

  /**
   * Search semantic memory with keyword matching
   */
  async searchSemanticMemory(agentId, query) {
    const agentKey = `agent:${agentId}:memory`;
    const memory = this.memoryStore.get(agentKey);

    if (!memory) return [];

    const results = [];
    const lowerQuery = query.toLowerCase();

    for (const [key, item] of memory.semantic.entries()) {
      const content = JSON.stringify(item.value).toLowerCase();

      if (content.includes(lowerQuery)) {
        results.push({
          key,
          value: item.value,
          timestamp: item.timestamp,
        });
      }
    }

    return results;
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(agentId) {
    const agentKey = `agent:${agentId}:memory`;
    const memory = this.memoryStore.get(agentKey);

    if (!memory) return null;

    return {
      working: memory.working.size,
      semantic: memory.semantic.size,
      episodic: memory.episodic.length,
      metadata: memory.metadata,
    };
  }

  /**
   * Clear all memories for an agent
   */
  async clearAgentMemory(agentId) {
    const agentKey = `agent:${agentId}:memory`;

    this.memoryStore.delete(agentKey);

    return true;
  }

  /**
   * Get all memory systems for an agent
   */
  async getAllAgentMemory(agentId) {
    const agentKey = `agent:${agentId}:memory`;
    const memory = this.memoryStore.get(agentKey);

    if (!memory) return null;

    return {
      working: Object.fromEntries(memory.working),
      semantic: Object.fromEntries(memory.semantic),
      episodic: memory.episodic,
      metadata: memory.metadata,
    };
  }
}

// Export singleton instance
module.exports = new AgentMemory();
