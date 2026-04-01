const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    const url = process.env.POSTGRES_URL;
    if (url) {
      pool = new Pool({ connectionString: url });
    } else {
      pool = new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT) || 5432,
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
        database: process.env.POSTGRES_DB || 'paieval',
        ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
      });
    }
  }
  return pool;
}

async function createConversation(title) {
  const result = await getPool().query(
    'INSERT INTO conversations (title) VALUES ($1) RETURNING *',
    [title || 'New Chat']
  );
  return result.rows[0];
}

async function getConversations(limit = 50) {
  const result = await getPool().query(
    'SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT $1',
    [limit]
  );
  return result.rows;
}

async function getConversation(id) {
  const result = await getPool().query(
    'SELECT * FROM conversations WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

async function getMessages(conversationId) {
  const result = await getPool().query(
    'SELECT id, role, content, reasoning_content, tool_calls, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId]
  );
  return result.rows;
}

async function addMessage(conversationId, role, content, reasoningContent = null, toolCalls = []) {
  const result = await getPool().query(
    'INSERT INTO messages (conversation_id, role, content, reasoning_content, tool_calls) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [conversationId, role, content, reasoningContent, JSON.stringify(toolCalls)]
  );
  return result.rows[0];
}

async function updateConversationTitle(id, title) {
  const result = await getPool().query(
    'UPDATE conversations SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
    [title, id]
  );
  return result.rows[0] || null;
}

async function deleteConversation(id) {
  await getPool().query('DELETE FROM conversations WHERE id = $1', [id]);
  return true;
}

module.exports = {
  getPool,
  createConversation,
  getConversations,
  getConversation,
  getMessages,
  addMessage,
  updateConversationTitle,
  deleteConversation,
};
