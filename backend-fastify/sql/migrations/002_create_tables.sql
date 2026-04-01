-- Core tables for deep agents system

CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT DEFAULT 'basic',
    status TEXT DEFAULT 'online',
    
    -- JSON state for flexible agent properties
    state JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agents_skills (
    agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
    skill_name TEXT NOT NULL,
    category TEXT, -- reasoning, action, communication, data-processing
    
    PRIMARY KEY (agent_id, skill_name)
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
    
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending', -- pending, in_progress, completed
    
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    metadata JSONB DEFAULT '{}'
);

-- Index for finding agents by skill or status
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);

-- Agent skills index
CREATE INDEX IF NOT EXISTS idx_skills_category ON agents_skills(category);

-- Tasks indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Agent-Task relationship table (for multi-agent task assignment)
CREATE TABLE IF NOT EXISTS agent_task_assignments (
    id SERIAL PRIMARY KEY,
    task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
    
    role TEXT DEFAULT 'worker', -- coordinator, worker, contributor
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(task_id, agent_id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_assignments_task ON agent_task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_assignments_agent ON agent_task_assignments(agent_id);

-- Log table for audit trail
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    
    level TEXT DEFAULT 'info', -- debug, info, warning, error
    
    source TEXT,
    message TEXT NOT NULL,
    
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON system_logs(created_at);

-- Helper function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at columns
CREATE TRIGGER update_agents_updated_at 
    BEFORE UPDATE ON agents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE agents IS 'Agent entities in the deep agents system';
COMMENT ON TABLE tasks IS 'Tasks to be executed by agents';