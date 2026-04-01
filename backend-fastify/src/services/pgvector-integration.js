// PGVector Integration Service - Handles vector database operations with pgvector

const { Client } = require("pg");
const crypto = require("crypto");

class PGVectorIntegration {
  constructor() {
    this.client = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the PostgreSQL client with pgvector support
   */
  async initialize() {
    try {
      // Create a new PostgreSQL client with connection details from environment
      this.client = new Client({
        host: process.env.POSTGRES_HOST || "localhost",
        port: parseInt(process.env.POSTGRES_PORT) || 5432,
        user: process.env.POSTGRES_USER || "postgres",
        password: process.env.POSTGRES_PASSWORD || "postgres",
        database: process.env.POSTGRES_DB || "paieval",
        ssl:
          process.env.POSTGRES_SSL === "true"
            ? { rejectUnauthorized: false }
            : false,
      });

      // Connect to the database
      await this.client.connect();

      // Check if pgvector extension is available and enabled
      const checkExtension = await this.client.query(
        "SELECT * FROM pg_extension WHERE extname = 'vector'",
      );

      if (checkExtension.rows.length === 0) {
        console.warn(
          "pgvector extension not found. Please install it in your database.",
        );
      }

      this.isInitialized = true;
      console.log("PGVector integration initialized successfully");
    } catch (error) {
      console.error("Failed to initialize PGVector integration:", error);
      throw new Error(`PGVector initialization failed: ${error.message}`);
    }
  }

  /**
   * Create a table for storing vector embeddings with proper schema
   */
  async createVectorTable(tableName, dimensions = 1536) {
    if (!this.isInitialized) {
      throw new Error("PGVector integration not initialized");
    }

    try {
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          embedding VECTOR(${dimensions}) NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;

      await this.client.query(createTableQuery);

      // Create index for faster similarity search
      const createIndexQuery = `
        CREATE INDEX IF NOT EXISTS idx_${tableName}_embedding 
        ON ${tableName} USING ivfflat (embedding vector_l2_ops);
      `;

      await this.client.query(createIndexQuery);

      return { success: true, tableName };
    } catch (error) {
      console.error(`Failed to create vector table ${tableName}:`, error);
      throw new Error(`Table creation failed: ${error.message}`);
    }
  }

  /**
   * Insert a new vector embedding into the database
   */
  async insertVector(tableName, embedding, metadata = {}) {
    if (!this.isInitialized) {
      throw new Error("PGVector integration not initialized");
    }

    try {
      const insertQuery = `
        INSERT INTO ${tableName} (embedding, metadata)
        VALUES ($1, $2)
        RETURNING id;
      `;

      const result = await this.client.query(insertQuery, [
        embedding,
        metadata,
      ]);

      return {
        success: true,
        id: result.rows[0].id,
        tableName,
      };
    } catch (error) {
      console.error(`Failed to insert vector into ${tableName}:`, error);
      throw new Error(`Vector insertion failed: ${error.message}`);
    }
  }

  /**
   * Insert multiple vector embeddings at once
   */
  async insertVectors(tableName, vectors) {
    if (!this.isInitialized) {
      throw new Error("PGVector integration not initialized");
    }

    try {
      // Start a transaction for better performance
      await this.client.query("BEGIN");

      const insertQuery = `
        INSERT INTO ${tableName} (embedding, metadata)
        VALUES ($1, $2)
        RETURNING id;
      `;

      const insertedIds = [];

      for (const vector of vectors) {
        const result = await this.client.query(insertQuery, [
          vector.embedding,
          vector.metadata || {},
        ]);

        insertedIds.push(result.rows[0].id);
      }

      await this.client.query("COMMIT");

      return {
        success: true,
        insertedCount: insertedIds.length,
        ids: insertedIds,
      };
    } catch (error) {
      await this.client.query("ROLLBACK");
      console.error(`Failed to insert vectors into ${tableName}:`, error);
      throw new Error(`Batch vector insertion failed: ${error.message}`);
    }
  }

  /**
   * Perform similarity search using pgvector
   */
  async similaritySearch(tableName, queryVector, limit = 10) {
    if (!this.isInitialized) {
      throw new Error("PGVector integration not initialized");
    }

    try {
      const searchQuery = `
        SELECT id, metadata, 
               embedding <-> $1 AS distance
        FROM ${tableName}
        ORDER BY distance ASC
        LIMIT $2;
      `;

      const result = await this.client.query(searchQuery, [queryVector, limit]);

      return {
        success: true,
        results: result.rows.map((row) => ({
          id: row.id,
          metadata: row.metadata,
          distance: row.distance,
        })),
        count: result.rows.length,
      };
    } catch (error) {
      console.error(`Failed similarity search in ${tableName}:`, error);
      throw new Error(`Similarity search failed: ${error.message}`);
    }
  }

  /**
   * Perform similarity search with filtering
   */
  async filteredSimilaritySearch(
    tableName,
    queryVector,
    filters = {},
    limit = 10,
  ) {
    if (!this.isInitialized) {
      throw new Error("PGVector integration not initialized");
    }

    try {
      // Build dynamic query with filters
      let whereClause = "";
      const params = [queryVector, limit];

      if (Object.keys(filters).length > 0) {
        const filterConditions = [];

        for (const [key, value] of Object.entries(filters)) {
          // For simple equality filters
          if (typeof value === "string" || typeof value === "number") {
            filterConditions.push(
              `metadata->>'${key}' = $${params.length + 1}`,
            );
            params.push(value);
          }
        }

        if (filterConditions.length > 0) {
          whereClause = `WHERE ${filterConditions.join(" AND ")}`;
        }
      }

      const searchQuery = `
        SELECT id, metadata,
               embedding <-> $1 AS distance
        FROM ${tableName}
        ${whereClause}
        ORDER BY distance ASC
        LIMIT $${params.length};
      `;

      const result = await this.client.query(searchQuery, params);

      return {
        success: true,
        results: result.rows.map((row) => ({
          id: row.id,
          metadata: row.metadata,
          distance: row.distance,
        })),
        count: result.rows.length,
      };
    } catch (error) {
      console.error(
        `Failed filtered similarity search in ${tableName}:`,
        error,
      );
      throw new Error(`Filtered similarity search failed: ${error.message}`);
    }
  }

  /**
   * Update metadata for a specific vector
   */
  async updateVectorMetadata(tableName, id, newMetadata) {
    if (!this.isInitialized) {
      throw new Error("PGVector integration not initialized");
    }

    try {
      const updateQuery = `
        UPDATE ${tableName}
        SET metadata = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id;
      `;

      const result = await this.client.query(updateQuery, [newMetadata, id]);

      return {
        success: result.rows.length > 0,
        updatedId: result.rows[0]?.id || null,
      };
    } catch (error) {
      console.error(`Failed to update metadata for vector ${id}:`, error);
      throw new Error(`Metadata update failed: ${error.message}`);
    }
  }

  /**
   * Delete a vector by ID
   */
  async deleteVector(tableName, id) {
    if (!this.isInitialized) {
      throw new Error("PGVector integration not initialized");
    }

    try {
      const deleteQuery = `
        DELETE FROM ${tableName}
        WHERE id = $1
        RETURNING id;
      `;

      const result = await this.client.query(deleteQuery, [id]);

      return {
        success: result.rows.length > 0,
        deletedId: result.rows[0]?.id || null,
      };
    } catch (error) {
      console.error(`Failed to delete vector ${id}:`, error);
      throw new Error(`Vector deletion failed: ${error.message}`);
    }
  }

  /**
   * Get vector statistics for a table
   */
  async getVectorStats(tableName) {
    if (!this.isInitialized) {
      throw new Error("PGVector integration not initialized");
    }

    try {
      const countQuery = `
        SELECT COUNT(*) as total_vectors
        FROM ${tableName};
      `;

      const countResult = await this.client.query(countQuery);

      // Get approximate size of the table (in bytes)
      const sizeQuery = `
        SELECT pg_total_relation_size('${tableName}') as table_size;
      `;

      const sizeResult = await this.client.query(sizeQuery);

      return {
        success: true,
        totalVectors: parseInt(countResult.rows[0].total_vectors),
        tableSizeBytes: parseInt(sizeResult.rows[0].table_size),
        tableName,
      };
    } catch (error) {
      console.error(`Failed to get stats for ${tableName}:`, error);
      throw new Error(`Stats retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get all metadata for vectors in a table
   */
  async getAllVectorMetadata(tableName, limit = 100) {
    if (!this.isInitialized) {
      throw new Error("PGVector integration not initialized");
    }

    try {
      const query = `
        SELECT id, metadata
        FROM ${tableName}
        ORDER BY created_at DESC
        LIMIT $1;
      `;

      const result = await this.client.query(query, [limit]);

      return {
        success: true,
        metadata: result.rows.map((row) => ({
          id: row.id,
          metadata: row.metadata,
        })),
        count: result.rows.length,
      };
    } catch (error) {
      console.error(`Failed to get metadata from ${tableName}:`, error);
      throw new Error(`Metadata retrieval failed: ${error.message}`);
    }
  }

  /**
   * Search vectors by metadata criteria (without vector similarity)
   */
  async searchByMetadata(tableName, metadataFilter, limit = 10) {
    if (!this.isInitialized) {
      throw new Error("PGVector integration not initialized");
    }

    try {
      const whereConditions = [];
      const params = [limit];

      // Build WHERE clause from metadata filter
      for (const [key, value] of Object.entries(metadataFilter)) {
        whereConditions.push(`metadata->>'${key}' = $${params.length + 1}`);
        params.push(value);
      }

      const query = `
        SELECT id, metadata
        FROM ${tableName}
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT $1;
      `;

      const result = await this.client.query(query, params);

      return {
        success: true,
        results: result.rows.map((row) => ({
          id: row.id,
          metadata: row.metadata,
        })),
        count: result.rows.length,
      };
    } catch (error) {
      console.error(`Failed metadata search in ${tableName}:`, error);
      throw new Error(`Metadata search failed: ${error.message}`);
    }
  }

  /**
   * Create a vector embedding from text using SHA256 (simplified for demo)
   */
  createTextEmbedding(text, dimensions = 1536) {
    // In a real implementation, this would use an actual embedding model
    // For demonstration purposes, we'll create a deterministic hash-based vector

    const hash = crypto.createHash("sha256").update(text).digest("hex");

    // Convert hex to array of numbers (simplified approach)
    const vector = [];
    for (let i = 0; i < dimensions && i * 2 < hash.length; i++) {
      const hex = hash.substring(i * 2, (i + 1) * 2);
      vector.push((parseInt(hex, 16) % 1000) / 1000); // Normalize to [0,1]
    }

    return vector;
  }

  /**
   * Get all available tables with pgvector support
   */
  async getVectorTables() {
    if (!this.isInitialized) {
      throw new Error("PGVector integration not initialized");
    }

    try {
      const query = `
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE '%vector%';
      `;

      const result = await this.client.query(query);

      return {
        success: true,
        tables: result.rows.map((row) => row.tablename),
      };
    } catch (error) {
      console.error("Failed to get vector tables:", error);
      throw new Error(`Table listing failed: ${error.message}`);
    }
  }

  /**
   * Close the database connection
   */
  async close() {
    if (this.client) {
      await this.client.end();
      console.log("PGVector client connection closed");
    }
  }

  /**
   * Check if the integration is ready for use
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Get database connection status
   */
  getConnectionStatus() {
    return {
      connected: this.isInitialized,
      client: this.client ? "active" : null,
    };
  }

  /**
   * Get vector table schema information
   */
  async getTableSchema(tableName) {
    if (!this.isInitialized) {
      throw new Error("PGVector integration not initialized");
    }

    try {
      const query = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = $1;
      `;

      const result = await this.client.query(query, [tableName]);

      return {
        success: true,
        schema: result.rows,
      };
    } catch (error) {
      console.error(`Failed to get schema for ${tableName}:`, error);
      throw new Error(`Schema retrieval failed: ${error.message}`);
    }
  }

  /**
   * Perform a hybrid search combining vector and metadata
   */
  async hybridSearch(tableName, queryVector, metadataFilter = {}, limit = 10) {
    if (!this.isInitialized) {
      throw new Error("PGVector integration not initialized");
    }

    try {
      // For demonstration, we'll do a simple filtered search
      const result = await this.filteredSimilaritySearch(
        tableName,
        queryVector,
        metadataFilter,
        limit,
      );

      return {
        success: true,
        results: result.results,
        count: result.count,
        searchType: "hybrid",
      };
    } catch (error) {
      console.error(`Failed hybrid search in ${tableName}:`, error);
      throw new Error(`Hybrid search failed: ${error.message}`);
    }
  }

  /**
   * Get recent vectors with timestamp filtering
   */
  async getRecentVectors(tableName, hours = 24) {
    if (!this.isInitialized) {
      throw new Error("PGVector integration not initialized");
    }

    try {
      const query = `
        SELECT id, metadata, created_at
        FROM ${tableName}
        WHERE created_at >= NOW() - INTERVAL '${hours} hours'
        ORDER BY created_at DESC;
      `;

      const result = await this.client.query(query);

      return {
        success: true,
        vectors: result.rows.map((row) => ({
          id: row.id,
          metadata: row.metadata,
          createdAt: row.created_at,
        })),
        count: result.rows.length,
      };
    } catch (error) {
      console.error(`Failed to get recent vectors from ${tableName}:`, error);
      throw new Error(`Recent vector retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get vectors with specific metadata field values
   */
  async getVectorsByMetadataField(tableName, fieldName, fieldValue) {
    if (!this.isInitialized) {
      throw new Error("PGVector integration not initialized");
    }

    try {
      const query = `
        SELECT id, metadata
        FROM ${tableName}
        WHERE metadata->>'${fieldName}' = $1;
      `;

      const result = await this.client.query(query, [fieldValue]);

      return {
        success: true,
        vectors: result.rows.map((row) => ({
          id: row.id,
          metadata: row.metadata,
        })),
        count: result.rows.length,
      };
    } catch (error) {
      console.error(
        `Failed to get vectors by metadata field from ${tableName}:`,
        error,
      );
      throw new Error(`Metadata field search failed: ${error.message}`);
    }
  }

  /**
   * Get all vector tables with their statistics
   */
  async getAllVectorTableStats() {
    if (!this.isInitialized) {
      throw new Error("PGVector integration not initialized");
    }

    try {
      const tablesQuery = `
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE '%vector%';
      `;

      const tablesResult = await this.client.query(tablesQuery);

      const stats = [];

      for (const row of tablesResult.rows) {
        const tableStats = await this.getVectorStats(row.tablename);
        stats.push(tableStats);
      }

      return {
        success: true,
        tables: stats,
      };
    } catch (error) {
      console.error("Failed to get all vector table stats:", error);
      throw new Error(`Stats collection failed: ${error.message}`);
    }
  }

  /**
   * Create a new embedding pipeline for processing data
   */
  async createEmbeddingPipeline(pipelineName, steps) {
    // In a real implementation, this would store pipeline configuration
    console.log(`Creating embedding pipeline: ${pipelineName}`, steps);

    return {
      success: true,
      name: pipelineName,
      steps,
    };
  }

  /**
   * Get embedding pipeline configuration
   */
  async getEmbeddingPipeline(pipelineName) {
    // In a real implementation, this would retrieve pipeline configuration
    return null;
  }

  /**
   * Update embedding pipeline with new steps
   */
  async updateEmbeddingPipeline(pipelineName, updatedSteps) {
    // In a real implementation, this would update pipeline configuration
    console.log(`Updating embedding pipeline: ${pipelineName}`, updatedSteps);

    return {
      success: true,
      name: pipelineName,
      steps: updatedSteps,
    };
  }

  /**
   * Delete an embedding pipeline
   */
  async deleteEmbeddingPipeline(pipelineName) {
    // In a real implementation, this would remove pipeline configuration
    console.log(`Deleting embedding pipeline: ${pipelineName}`);

    return {
      success: true,
      name: pipelineName,
    };
  }
}

// Export singleton instance
module.exports = new PGVectorIntegration();
