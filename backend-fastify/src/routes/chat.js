const llmService = require('../services/llm');
const { buildToolDefinitions, executeSkill } = require('../services/tool-executor');

module.exports = async function (fastify, options) {
  fastify.post('/stream', async (request, reply) => {
    const { messages, model, temperature, maxTokens } = request.body;

    if (!messages || !Array.isArray(messages)) {
      return reply.code(400).send({ error: 'Messages array is required' });
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

    raw.write('data: {"type":"start"}\n\n');

    try {
      const currentMessages = [systemMsg, ...messages];

      const result = await llmService.chatWithTools(currentMessages, { model, temperature, maxTokens, tools, executeSkill });

      if (result.stream) {
        for await (const chunk of result.stream) {
          if (typeof chunk === 'string') {
            raw.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
          } else {
            raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        }
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
