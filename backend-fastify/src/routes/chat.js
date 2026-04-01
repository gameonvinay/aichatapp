const llmService = require('../services/llm');
const { buildToolDefinitions, executeSkill } = require('../services/tool-executor');
const db = require('../services/db');

module.exports = async function (fastify, options) {
  fastify.post('/stream', async (request, reply) => {
    const { messages, model, temperature, maxTokens, conversationId } = request.body;

    if (!messages || !Array.isArray(messages)) {
      return reply.code(400).send({ error: 'Messages array is required' });
    }

    let activeConversationId = conversationId;

    if (!activeConversationId) {
      const firstUserMsg = messages.find(m => m.role === 'user');
      const title = firstUserMsg ? firstUserMsg.content.slice(0, 80) : 'New Chat';
      const conv = await db.createConversation(title);
      activeConversationId = conv.id;
    }

    const userMsg = messages[messages.length - 1];
    if (userMsg && userMsg.role === 'user') {
      await db.addMessage(activeConversationId, 'user', userMsg.content);
    }

    const tools = await buildToolDefinitions();

    const systemMsg = {
      role: 'system',
      content: `You are a helpful AI assistant. You have access to agent skills. Use them when the user's request matches a skill's capability. If no skill is relevant, answer directly.`,
    };

    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });

    raw.write(`data: ${JSON.stringify({ type: 'start', conversationId: activeConversationId })}\n\n`);

    let fullContent = '';
    let fullReasoning = '';
    let collectedToolCalls = [];

    try {
      const currentMessages = [systemMsg, ...messages];

      const result = await llmService.chatWithTools(currentMessages, { model, temperature, maxTokens, tools, executeSkill });

      if (result.stream) {
        for await (const chunk of result.stream) {
          if (typeof chunk === 'string') {
            fullContent += chunk;
            raw.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
          } else {
            if (chunk.type === 'content') {
              fullContent += chunk.content;
            }
            if (chunk.type === 'reasoning' || chunk.type === 'reasoning_chunk') {
              fullReasoning += chunk.content;
            }
            if (chunk.type === 'tool_calls') {
              collectedToolCalls = chunk.calls;
            }
            raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        }
      }

      if (fullContent) {
        await db.addMessage(activeConversationId, 'assistant', fullContent, fullReasoning || null, collectedToolCalls);
      }

      raw.write('data: {"type":"done"}\n\n');
    } catch (err) {
      raw.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    }

    return new Promise(() => {});
  });

  fastify.get('/models', async (request, reply) => {
    const health = await llmService.checkHealth();
    return health;
  });
};
