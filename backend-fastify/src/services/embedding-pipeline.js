// Embedding Pipeline Service - Handles embedding pipeline design with caching and deduplication

const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");

class EmbeddingPipeline {
  constructor() {
    this.pipelines = new Map();
    this.cache = new Map(); // In-memory cache for embeddings
    this.deduplicationCache = new Set(); // For tracking unique embeddings
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };

    // Cache configuration
    this.maxCacheSize = 1000;
    this.cacheTTL = 3600000; // 1 hour in milliseconds
    this.cacheCleanupInterval = null;

    // Initialize cache cleanup
    this.startCacheCleanup();
  }

  /**
   * Start automatic cache cleanup process
   */
  startCacheCleanup() {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }

    this.cacheCleanupInterval = setInterval(() => {
      const now = Date.now();
      let evictions = 0;

      // Remove expired entries from cache
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > this.cacheTTL) {
          this.cache.delete(key);
          evictions++;
        }
      }

      if (evictions > 0) {
        this.cacheStats.evictions += evictions;
      }
    }, 300000); // Run every 5 minutes
  }

  /**
   * Create a new embedding pipeline with specified steps
   */
  createPipeline(pipelineId, config = {}) {
    const defaultConfig = {
      id: pipelineId,
      name: config.name || `Pipeline ${pipelineId}`,
      steps: config.steps || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cacheEnabled: config.cacheEnabled !== false, // Default to enabled
      deduplicationEnabled: config.deduplicationEnabled !== false, // Default to enabled
      maxCacheSize: config.maxCacheSize || this.maxCacheSize,
      cacheTTL: config.cacheTTL || this.cacheTTL,
    };

    // Validate pipeline steps if provided
    const validatedSteps = this.validatePipelineSteps(config.steps || []);

    const pipeline = {
      ...defaultConfig,
      steps: validatedSteps,
    };

    this.pipelines.set(pipelineId, pipeline);

    return {
      success: true,
      pipelineId,
      pipeline,
    };
  }

  /**
   * Validate and normalize pipeline steps
   */
  validatePipelineSteps(steps) {
    return steps.map((step, index) => ({
      id: step.id || `step-${index}`,
      type: step.type || "embedding",
      name: step.name || `Step ${index + 1}`,
      model: step.model || "default",
      parameters: step.parameters || {},
      enabled: step.enabled !== false, // Default to enabled
      order: index,
    }));
  }

  /**
   * Add a step to an existing pipeline
   */
  addStepToPipeline(pipelineId, stepConfig) {
    const pipeline = this.pipelines.get(pipelineId);

    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    const step = this.validatePipelineSteps([stepConfig])[0];

    pipeline.steps.push(step);
    pipeline.updatedAt = new Date().toISOString();

    return {
      success: true,
      pipelineId,
      stepAdded: step,
    };
  }

  /**
   * Remove a step from a pipeline by ID or index
   */
  removeStepFromPipeline(pipelineId, stepIdOrIndex) {
    const pipeline = this.pipelines.get(pipelineId);

    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    const stepIndex =
      typeof stepIdOrIndex === "number"
        ? stepIdOrIndex
        : pipeline.steps.findIndex((s) => s.id === stepIdOrIndex);

    if (stepIndex === -1) {
      throw new Error(`Step ${stepIdOrIndex} not found in pipeline`);
    }

    const removedStep = pipeline.steps.splice(stepIndex, 1)[0];
    pipeline.updatedAt = new Date().toISOString();

    return {
      success: true,
      pipelineId,
      removedStep,
    };
  }

  /**
   * Update a step in an existing pipeline
   */
  updateStepInPipeline(pipelineId, stepId, updatedConfig) {
    const pipeline = this.pipelines.get(pipelineId);

    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    const stepIndex = pipeline.steps.findIndex((s) => s.id === stepId);

    if (stepIndex === -1) {
      throw new Error(`Step ${stepId} not found in pipeline`);
    }

    const updatedStep = {
      ...pipeline.steps[stepIndex],
      ...updatedConfig,
      updatedAt: new Date().toISOString(),
    };

    pipeline.steps[stepIndex] = updatedStep;
    pipeline.updatedAt = new Date().toISOString();

    return {
      success: true,
      pipelineId,
      updatedStep,
    };
  }

  /**
   * Get a specific pipeline by ID
   */
  getPipeline(pipelineId) {
    return this.pipelines.get(pipelineId);
  }

  /**
   * Get all pipelines
   */
  getAllPipelines() {
    return Array.from(this.pipelines.values());
  }

  /**
   * Get pipeline statistics
   */
  getPipelineStats(pipelineId) {
    const pipeline = this.pipelines.get(pipelineId);

    if (!pipeline) {
      return null;
    }

    return {
      pipelineId,
      name: pipeline.name,
      stepsCount: pipeline.steps.length,
      cacheEnabled: pipeline.cacheEnabled,
      deduplicationEnabled: pipeline.deduplicationEnabled,
      createdAt: pipeline.createdAt,
      updatedAt: pipeline.updatedAt,
      cacheStats: this.cacheStats,
    };
  }

  /**
   * Generate a unique hash for input data to use as cache key
   */
  generateCacheKey(input, pipelineId) {
    const dataString = JSON.stringify({
      input,
      pipeline: pipelineId,
    });

    return crypto.createHash("sha256").update(dataString).digest("hex");
  }

  /**
   * Process data through the embedding pipeline
   */
  async processThroughPipeline(pipelineId, inputData) {
    const pipeline = this.pipelines.get(pipelineId);

    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    // Check cache first if caching is enabled
    let cachedResult = null;

    if (pipeline.cacheEnabled) {
      const cacheKey = this.generateCacheKey(inputData, pipelineId);

      cachedResult = this.cache.get(cacheKey);

      if (cachedResult && Date.now() - cachedResult.timestamp < this.cacheTTL) {
        // Cache hit
        this.cacheStats.hits++;
        return cachedResult.value;
      } else if (cachedResult) {
        // Cache expired, remove it
        this.cache.delete(cacheKey);
        this.cacheStats.evictions++;
      } else {
        // Cache miss
        this.cacheStats.misses++;
      }
    }

    try {
      let result = inputData;

      // Process each step in the pipeline
      for (const step of pipeline.steps) {
        if (!step.enabled) continue;

        // Apply the transformation or embedding step
        result = await this.processStep(step, result);
      }

      // Cache the result if caching is enabled
      if (pipeline.cacheEnabled && !this.isCacheFull()) {
        const cacheKey = this.generateCacheKey(inputData, pipelineId);

        this.cache.set(cacheKey, {
          value: result,
          timestamp: Date.now(),
        });
      }

      return result;
    } catch (error) {
      console.error(`Failed to process pipeline ${pipelineId}:`, error);
      throw new Error(`Pipeline processing failed: ${error.message}`);
    }
  }

  /**
   * Process a single step in the pipeline
   */
  async processStep(step, inputData) {
    switch (step.type.toLowerCase()) {
      case "embedding":
        return this.generateEmbedding(inputData, step);

      case "text_processing":
        return this.processText(inputData, step);

      case "data_enrichment":
        return this.enrichText(inputData, step);

      default:
        // For unknown steps, just pass through the data
        return inputData;
    }
  }

  /**
   * Generate embedding for input text using a model
   */
  async generateEmbedding(inputData, step) {
    // In a real implementation, this would call an actual embedding model
    // For demonstration purposes, we'll create a hash-based "embedding"

    const text =
      typeof inputData === "string" ? inputData : JSON.stringify(inputData);

    // Check for deduplication if enabled
    const embeddingHash = this.generateEmbeddingHash(text, step.model);

    if (
      step.parameters.deduplicationEnabled !== false &&
      this.deduplicationCache.has(embeddingHash)
    ) {
      // Return cached embedding for duplicate input
      return this.getEmbeddingFromCache(embeddingHash);
    }

    // Create a vector-like embedding (simplified for demo)
    const dimensions = step.parameters.dimensions || 1536;

    // Generate a deterministic embedding based on input text
    const hash = crypto.createHash("sha256").update(text).digest("hex");

    const embedding = [];
    for (let i = 0; i < dimensions && i * 2 < hash.length; i++) {
      const hex = hash.substring(i * 2, (i + 1) * 2);
      embedding.push((parseInt(hex, 16) % 1000) / 1000); // Normalize to [0,1]
    }

    // Store in deduplication cache if enabled
    if (step.parameters.deduplicationEnabled !== false) {
      this.deduplicationCache.add(embeddingHash);
    }

    return embedding;
  }

  /**
   * Generate a hash for deduplication purposes
   */
  generateEmbeddingHash(text, model) {
    return crypto.createHash("sha256").update(`${text}-${model}`).digest("hex");
  }

  /**
   * Get embedding from cache (simulated)
   */
  getEmbeddingFromCache(hash) {
    // In a real implementation, this would return the actual cached embedding
    return [0.1, 0.2, 0.3]; // Placeholder for demonstration
  }

  /**
   * Process text with specific transformations
   */
  processText(inputData, step) {
    let processed = inputData;

    if (typeof processed === "string") {
      // Apply text transformations based on step parameters
      const transforms = step.parameters.transforms || [];

      for (const transform of transforms) {
        switch (transform.type) {
          case "lowercase":
            processed = processed.toLowerCase();
            break;

          case "remove_special_chars":
            processed = processed.replace(/[^a-zA-Z0-9\s]/g, "");
            break;

          case "tokenize":
            processed = processed.split(/\s+/).filter((t) => t.length > 0);
            break;

          default:
            // No transformation
            break;
        }
      }
    }

    return processed;
  }

  /**
   * Enrich text with additional metadata
   */
  enrichText(inputData, step) {
    const enriched = {
      ...inputData,
      processedAt: new Date().toISOString(),
      pipelineStep: step.name || "enrichment",
    };

    // Add metadata based on parameters
    if (step.parameters.addMetadata) {
      enriched.metadata = step.parameters.addMetadata;
    }

    return enriched;
  }

  /**
   * Check if cache is at maximum capacity
   */
  isCacheFull() {
    return this.cache.size >= this.maxCacheSize;
  }

  /**
   * Clear pipeline cache
   */
  clearPipelineCache(pipelineId) {
    // In a real implementation, this would filter cache by pipeline ID
    this.cache.clear();

    return {
      success: true,
      cleared: "all",
    };
  }

  /**
   * Clear specific pipeline cache
   */
  clearPipelineCacheById(pipelineId) {
    // In a real implementation, this would filter cache by pipeline ID
    const keysToRemove = [];

    for (const [key, entry] of this.cache.entries()) {
      if (key.includes(pipelineId)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      this.cache.delete(key);
    }

    return {
      success: true,
      cleared: keysToRemove.length,
    };
  }

  /**
   * Get cache statistics for a specific pipeline or overall
   */
  getCacheStats(pipelineId = null) {
    const stats = {
      ...this.cacheStats,
      currentCacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
    };

    if (pipelineId) {
      // Filter cache by pipeline ID for more specific stats
      const filteredSize = Array.from(this.cache.entries()).filter(([key]) =>
        key.includes(pipelineId),
      ).length;

      stats.filteredSize = filteredSize;
    }

    return stats;
  }

  /**
   * Get all cached embeddings (for debugging)
   */
  getAllCachedEmbeddings() {
    return Array.from(this.cache.entries()).map(([key, value]) => ({
      key,
      timestamp: value.timestamp,
      size: JSON.stringify(value.value).length,
    }));
  }

  /**
   * Get pipeline execution history (for monitoring)
   */
  getPipelineExecutionHistory(pipelineId, limit = 50) {
    // In a real implementation, this would maintain execution logs
    return [];
  }

  /**
   * Get pipeline performance metrics (for optimization)
   */
  getPipelinePerformanceMetrics(pipelineId) {
    // In a real implementation, this would track timing and resource usage
    return {
      pipelineId,
      processingTime: 0, // ms (simulated)
      cacheHitRate:
        this.cacheStats.hits > 0
          ? (this.cacheStats.hits /
              (this.cacheStats.hits + this.cacheStats.misses)) *
            100
          : 0,
      cacheSize: this.cache.size,
    };
  }

  /**
   * Update pipeline configuration (name, steps, etc.)
   */
  updatePipeline(pipelineId, updatedConfig) {
    const pipeline = this.pipelines.get(pipelineId);

    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    // Update pipeline properties
    Object.assign(pipeline, {
      ...updatedConfig,
      updatedAt: new Date().toISOString(),
    });

    // Validate and update steps if provided
    if (updatedConfig.steps) {
      pipeline.steps = this.validatePipelineSteps(updatedConfig.steps);
    }

    return {
      success: true,
      pipelineId,
      updatedPipeline: pipeline,
    };
  }

  /**
   * Delete a pipeline and its associated cache entries
   */
  deletePipeline(pipelineId) {
    const deleted = this.pipelines.delete(pipelineId);

    if (deleted) {
      // Remove any cached entries related to this pipeline
      const keysToRemove = [];

      for (const [key] of this.cache.entries()) {
        if (key.includes(pipelineId)) {
          keysToRemove.push(key);
        }
      }

      for (const key of keysToRemove) {
        this.cache.delete(key);
      }
    }

    return {
      success: deleted,
      pipelineId,
    };
  }

  /**
   * Export pipeline configuration to file (for persistence)
   */
  async exportPipeline(pipelineId, filePath) {
    const pipeline = this.pipelines.get(pipelineId);

    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    try {
      const exportData = {
        pipeline,
        exportedAt: new Date().toISOString(),
      };

      await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));

      return {
        success: true,
        filePath,
        pipelineId,
      };
    } catch (error) {
      console.error(`Failed to export pipeline ${pipelineId}:`, error);
      throw new Error(`Pipeline export failed: ${error.message}`);
    }
  }

  /**
   * Import pipeline configuration from file
   */
  async importPipeline(filePath) {
    try {
      const data = await fs.readFile(filePath, "utf8");
      const importData = JSON.parse(data);

      // Create pipeline from imported data
      const pipelineId = importData.pipeline.id;
      this.pipelines.set(pipelineId, importData.pipeline);

      return {
        success: true,
        pipelineId,
        importedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Failed to import pipeline from ${filePath}:`, error);
      throw new Error(`Pipeline import failed: ${error.message}`);
    }
  }

  /**
   * Get all unique embeddings (for deduplication analysis)
   */
  getUniqueEmbeddingsCount() {
    return this.deduplicationCache.size;
  }

  /**
   * Reset all pipeline statistics and caches
   */
  resetStatistics() {
    this.cache.clear();
    this.deduplicationCache.clear();

    // Reset stats
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };

    return {
      success: true,
      resetAt: new Date().toISOString(),
    };
  }

  /**
   * Get pipeline configuration as JSON
   */
  getPipelineConfig(pipelineId) {
    const pipeline = this.pipelines.get(pipelineId);

    if (!pipeline) {
      return null;
    }

    // Return clean configuration without internal state
    const config = {
      id: pipeline.id,
      name: pipeline.name,
      steps: pipeline.steps.map((step) => ({
        id: step.id,
        type: step.type,
        name: step.name,
        model: step.model,
        parameters: step.parameters,
        enabled: step.enabled,
      })),
      createdAt: pipeline.createdAt,
      updatedAt: pipeline.updatedAt,
      cacheEnabled: pipeline.cacheEnabled,
      deduplicationEnabled: pipeline.deduplicationEnabled,
    };

    return config;
  }

  /**
   * Validate that a pipeline has at least one step
   */
  validatePipeline(pipelineId) {
    const pipeline = this.pipelines.get(pipelineId);

    if (!pipeline) {
      return { valid: false, error: `Pipeline ${pipelineId} not found` };
    }

    if (!Array.isArray(pipeline.steps) || pipeline.steps.length === 0) {
      return { valid: false, error: `Pipeline ${pipelineId} has no steps` };
    }

    return { valid: true, error: null };
  }

  /**
   * Get all pipelines with validation status
   */
  getAllPipelinesWithValidation() {
    return Array.from(this.pipelines.entries()).map(([id, pipeline]) => ({
      id,
      name: pipeline.name,
      stepsCount: pipeline.steps.length,
      valid: this.validatePipeline(id).valid,
    }));
  }

  /**
   * Get pipeline steps with performance data (for optimization)
   */
  getPipelineStepPerformance(pipelineId) {
    // In a real implementation, this would track individual step performance
    const pipeline = this.pipelines.get(pipelineId);

    if (!pipeline) {
      return null;
    }

    return pipeline.steps.map((step) => ({
      stepId: step.id,
      name: step.name,
      type: step.type,
      enabled: step.enabled,
    }));
  }

  /**
   * Get pipeline cache hit rate over time (for monitoring)
   */
  getCacheHitRateHistory(pipelineId, hours = 24) {
    // In a real implementation, this would track historical cache performance
    return [];
  }

  /**
   * Get pipeline resource usage (simulated)
   */
  getResourceUsage(pipelineId) {
    // In a real implementation, this would monitor actual resource usage
    return {
      pipelineId,
      memoryUsage: 0, // bytes (simulated)
      cpuUsage: 0, // percentage (simulated)
      cacheSize: this.cache.size,
      uniqueEmbeddings: this.deduplicationCache.size,
    };
  }

  /**
   * Get pipeline status (active, idle, etc.)
   */
  getPipelineStatus(pipelineId) {
    const pipeline = this.pipelines.get(pipelineId);

    if (!pipeline) {
      return { status: "not_found" };
    }

    const stepsEnabled = pipeline.steps.filter((s) => s.enabled).length;

    return {
      status: stepsEnabled > 0 ? "active" : "idle",
      pipelineId,
      enabledSteps: stepsEnabled,
      totalSteps: pipeline.steps.length,
    };
  }

  /**
   * Get all pipelines with their current status and stats
   */
  getAllPipelinesStatus() {
    return Array.from(this.pipelines.entries()).map(([id, pipeline]) => ({
      id,
      name: pipeline.name,
      status: this.getPipelineStatus(id).status,
      stepsCount: pipeline.steps.length,
      cacheEnabled: pipeline.cacheEnabled,
      deduplicationEnabled: pipeline.deduplicationEnabled,
    }));
  }

  /**
   * Close all resources and clean up (for graceful shutdown)
   */
  async close() {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }

    // Clear all caches
    this.cache.clear();
    this.deduplicationCache.clear();

    return {
      success: true,
      closedAt: new Date().toISOString(),
    };
  }
}

// Export singleton instance
module.exports = new EmbeddingPipeline();
