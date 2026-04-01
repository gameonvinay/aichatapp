const redisService = require('./redis');
const { webSearch } = require('../tools/web-search');
const { codeReview } = require('../tools/code-review');
const { summarize } = require('../tools/summarization');
const { extractData } = require('../tools/data-extraction');

const toolImplementations = {
  'web-search': webSearch,
  'code-review': codeReview,
  'summarization': summarize,
  'data-extraction': extractData,
};

async function buildToolDefinitions() {
  const agents = await redisService.getAllAgents();
  const tools = [];

  for (const agent of agents) {
    const skills = await redisService.getAgentSkills(agent.id);
    if (skills && skills.length > 0) {
      for (const skill of skills) {
        const hasImpl = toolImplementations[skill.name];
        tools.push({
          type: 'function',
          function: {
            name: `execute_skill_${agent.id}_${skill.name.replace(/[^a-zA-Z0-9_]/g, '_')}`,
            description: skill.description || `${hasImpl ? 'Execute' : 'Use'} ${skill.name} skill from agent ${agent.id}`,
            parameters: {
              type: 'object',
              properties: {
                agent_id: { type: 'string', const: agent.id },
                skill_name: { type: 'string', const: skill.name },
                input: { type: 'string', description: `Input for the ${skill.name} skill` },
              },
              required: ['agent_id', 'skill_name', 'input'],
            },
          },
        });
      }
    }
  }

  return tools;
}

async function executeSkill(agentId, skillName, input) {
  const impl = toolImplementations[skillName];

  if (impl) {
    try {
      const result = await impl(input);
      return { success: true, skill: skillName, agent: agentId, result };
    } catch (err) {
      return { error: `Skill ${skillName} execution failed: ${err.message}` };
    }
  }

  const skills = await redisService.getAgentSkills(agentId);
  if (!skills) return { error: `No skills found for agent ${agentId}` };

  const skill = skills.find(s => s.name === skillName);
  if (!skill) return { error: `Skill ${skillName} not found for agent ${agentId}` };

  if (skill.endpoint) {
    try {
      const response = await fetch(skill.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, skill, agent_id: agentId }),
      });
      if (response.ok) {
        const result = await response.json();
        return { success: true, result };
      }
      return { error: `Skill endpoint returned ${response.status}` };
    } catch (err) {
      return { error: `Failed to call skill endpoint: ${err.message}` };
    }
  }

  return {
    success: true,
    skill: skillName,
    agent: agentId,
    result: `Skill "${skillName}" was invoked with input: "${input}". This skill does not have a local implementation.`,
  };
}

module.exports = { buildToolDefinitions, executeSkill };
