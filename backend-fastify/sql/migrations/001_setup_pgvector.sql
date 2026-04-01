-- pgvector setup for PostgreSQL
-- This migration sets up vector embeddings using the pgvector extension

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

--------------------------------------------------------------------------------
-- Agent Embeddings Table for similarity search and semantic tasks
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_embeddings (
    id SERIAL PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    -- Embedding can be 1536 dims (OpenAI), 768 dims (E5), or other sizes
    embedding vector(1536) NOT NULL,
    
    -- Text content that was embedded (for reference/debugging)
    original_text TEXT,
    
    -- Metadata for filtering
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient cosine similarity search (recommended: ivfflat)
CREATE INDEX IF NOT EXISTS agent_embeddings_cosine_idx 
    ON agent_embeddings USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100);

-- Index for inner product similarity
CREATE INDEX IF NOT EXISTS agent_embeddings_ip_idx 
    ON agent_embeddings USING ivfflat (embedding vector_ip_ops) 
    WITH (lists = 100);

-- Index for Euclidean distance
CREATE INDEX IF NOT EXISTS agent_embeddings_l2_idx 
    ON agent_embeddings USING ivfflat (embedding vector_l2_ops) 
    WITH (lists = 100);

--------------------------------------------------------------------------------
-- Task embeddings for matching agents to tasks semantically
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_embeddings (
    id SERIAL PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    embedding vector(1536) NOT NULL,
    
    -- Original task description for reference
    original_text TEXT,
    
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for task-agent similarity matching
CREATE INDEX IF NOT EXISTS task_embeddings_cosine_idx 
    ON task_embeddings USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100);

--------------------------------------------------------------------------------
-- Skill embeddings for skill-based agent discovery and matching
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skill_embeddings (
    id SERIAL PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    embedding vector(1536) NOT NULL,
    
    -- Skill identifier/name reference
    skill_id TEXT NOT NULL,
    skill_name TEXT NOT NULL,
    
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for skill-based similarity search
CREATE INDEX IF NOT EXISTS skill_embeddings_cosine_idx 
    ON skill_embeddings USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100);

--------------------------------------------------------------------------------
-- Helper function to update updated_at on embeddin