import { create } from "zustand"

interface Skill {
  id: string
  name: string
  description: string
  category?: string
  tags?: string[]
}

interface SubAgent {
  id: string
  name: string
  type: string
  status: string
  skills?: Skill[]
  tasks?: unknown[]
}

interface AgentState {
  agents: SubAgent[]
  selectedAgent: SubAgent | null
  isLoading: boolean
  error: string | null
  setAgents: (agents: SubAgent[]) => void
  setSelectedAgent: (agent: SubAgent | null) => void
  updateAgent: (agentId: string, updates: Partial<SubAgent>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  addSubAgent: (agentId: string, subAgent: SubAgent) => void
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
  selectedAgent: null,
  isLoading: false,
  error: null,
  setAgents: (agents) => set({ agents }),
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  updateAgent: (agentId, updates) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId ? { ...a, ...updates } : a
      ),
      selectedAgent:
        state.selectedAgent?.id === agentId
          ? { ...state.selectedAgent, ...updates }
          : state.selectedAgent,
    })),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  addSubAgent: (agentId, subAgent) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId
          ? { ...a, subAgents: [...(a as any).subAgents || [], subAgent] }
          : a
      ),
    })),
}))
