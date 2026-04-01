const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://192.168.1.21:1234';

class LLMService {
  constructor() {
    this.baseUrl = LM_STUDIO_URL;
    this.defaultModel = 'mlx-qwen3.5-35b-a3b-claude-4.6-opus-reasoning-distilled';
  }

  async chat(messages, options = {}) {
    const { temperature = 0.7, maxTokens = 2048, tools = null } = options;

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model || 'local-model',
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(tools && { tools }),
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LM Studio API error: ${error}`);
    }

    return response.json();
  }

  async chatWithTools(messages, options = {}) {
    const { temperature = 0.7, maxTokens = 2048, tools = null, executeSkill } = options;
    const model = options.model || this.defaultModel;

    let currentMessages = [...messages];
    let iterations = 0;
    const maxIterations = 5;
    const toolCalls = [];

    while (iterations < maxIterations) {
      iterations++;

      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: currentMessages,
          temperature,
          max_tokens: maxTokens,
          ...(tools && { tools }),
          stream: false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LM Studio API error: ${error}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const message = choice?.message;

      if (!message) break;

      if (message.tool_calls && message.tool_calls.length > 0) {
        currentMessages.push({
          role: 'assistant',
          content: message.content,
          tool_calls: message.tool_calls,
        });

        for (const toolCall of message.tool_calls) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const toolCallInfo = {
              name: toolCall.function.name,
              input: args.input || JSON.stringify(args),
              output: null,
              status: 'executing',
            };
            toolCalls.push(toolCallInfo);

            const result = await executeSkill(args.agent_id, args.skill_name, args.input);
            toolCallInfo.output = result;
            toolCallInfo.status = 'completed';

            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          } catch (err) {
            const toolCallInfo = toolCalls.find(tc => tc.name === toolCall.function.name);
            if (toolCallInfo) {
              toolCallInfo.output = { error: err.message };
              toolCallInfo.status = 'error';
            }
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: err.message }),
            });
          }
        }
      } else {
        if (message.content) {
          const stream = this.streamContentOnly(currentMessages, { model, temperature, maxTokens, toolCalls });
          return { stream };
        }
        break;
      }
    }

    const stream = this.streamContentOnly(currentMessages, { model, temperature, maxTokens, toolCalls });
    return { stream };
  }

  async *streamContentOnly(messages, options = {}) {
    const { temperature = 0.7, maxTokens = 2048, toolCalls = [] } = options;
    const model = options.model || this.defaultModel;

    if (toolCalls.length > 0) {
      yield { type: 'tool_calls', calls: toolCalls };
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LM Studio API error: ${error}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let reasoningBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;

        const data = line.slice(6);
        if (data === '[DONE]') {
          if (reasoningBuffer.trim()) {
            yield { type: 'reasoning', content: reasoningBuffer.trim() };
          }
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          const content = delta?.content;
          const reasoning = delta?.reasoning_content || delta?.reasoning;

          if (reasoning) {
            reasoningBuffer += reasoning;
            yield { type: 'reasoning_chunk', content: reasoning };
          } else if (content) {
            if (reasoningBuffer.trim()) {
              yield { type: 'reasoning', content: reasoningBuffer.trim() };
              reasoningBuffer = '';
            }
            yield { type: 'content', content };
          }
          if (parsed.choices?.[0]?.finish_reason) {
            if (reasoningBuffer.trim()) {
              yield { type: 'reasoning', content: reasoningBuffer.trim() };
            }
            return;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`);
      if (response.ok) {
        const data = await response.json();
        return { connected: true, models: data.data || [] };
      }
      return { connected: false, error: 'API not responding' };
    } catch (err) {
      return { connected: false, error: err.message };
    }
  }
}

module.exports = new LLMService();
