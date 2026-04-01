const db = require('../services/db');

module.exports = async function (fastify, options) {

  fastify.get('/', async () => {
    const conversations = await db.getConversations();
    return { conversations };
  });

  fastify.post('/', async (request, reply) => {
    const { title } = request.body;
    const conversation = await db.createConversation(title);
    return conversation;
  });

  fastify.get('/:id', async (request, reply) => {
    const conversation = await db.getConversation(request.params.id);
    if (!conversation) {
      return reply.code(404).send({ error: 'Conversation not found' });
    }
    const messages = await db.getMessages(request.params.id);
    return { conversation, messages };
  });

  fastify.patch('/:id', async (request, reply) => {
    const { title } = request.body;
    const conversation = await db.updateConversationTitle(request.params.id, title);
    if (!conversation) {
      return reply.code(404).send({ error: 'Conversation not found' });
    }
    return conversation;
  });

  fastify.delete('/:id', async (request, reply) => {
    await db.deleteConversation(request.params.id);
    return { deleted: true };
  });

  fastify.post('/:id/messages', async (request, reply) => {
    const { role, content, reasoning_content, tool_calls } = request.body;
    if (!role || !content) {
      return reply.code(400).send({ error: 'role and content are required' });
    }
    const message = await db.addMessage(
      request.params.id,
      role,
      content,
      reasoning_content,
      tool_calls || []
    );
    return message;
  });
};
