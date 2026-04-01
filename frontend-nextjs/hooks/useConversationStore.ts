import { create } from "zustand"

export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface ConversationState {
  conversations: Conversation[]
  activeConversationId: string | null
  isLoading: boolean
  setConversations: (conversations: Conversation[]) => void
  setActiveConversation: (id: string | null) => void
  addConversation: (conversation: Conversation) => void
  removeConversation: (id: string) => void
  updateConversationTitle: (id: string, title: string) => void
  fetchConversations: () => Promise<void>
  createConversation: (title?: string) => Promise<Conversation | null>
  deleteConversation: (id: string) => Promise<void>
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  isLoading: false,

  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (id) => set({ activeConversationId: id }),

  addConversation: (conversation) =>
    set((state) => ({
      conversations: [conversation, ...state.conversations],
    })),

  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
    })),

  updateConversationTitle: (id, title) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title } : c
      ),
    })),

  fetchConversations: async () => {
    set({ isLoading: true })
    try {
      const res = await fetch("/api/conversations")
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      set({ conversations: data.conversations })
    } catch (err) {
      console.error("Failed to fetch conversations:", err)
    } finally {
      set({ isLoading: false })
    }
  },

  createConversation: async (title?: string) => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })
      if (!res.ok) throw new Error("Failed to create")
      const conversation = await res.json()
      get().addConversation(conversation)
      return conversation
    } catch (err) {
      console.error("Failed to create conversation:", err)
      return null
    }
  },

  deleteConversation: async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      get().removeConversation(id)
      if (get().activeConversationId === id) {
        set({ activeConversationId: null })
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err)
    }
  },
}))
