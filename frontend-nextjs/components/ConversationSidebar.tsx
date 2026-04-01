"use client"

import { useEffect } from "react"
import { useConversationStore } from "@/hooks/useConversationStore"
import { Plus, MessageSquare, Trash2, Loader2 } from "lucide-react"

interface ConversationSidebarProps {
  onSelectConversation: (id: string) => void
  onNewChat: () => void
  activeConversationId: string | null
}

export default function ConversationSidebar({
  onSelectConversation,
  onNewChat,
  activeConversationId,
}: ConversationSidebarProps) {
  const {
    conversations,
    isLoading,
    fetchConversations,
    deleteConversation,
  } = useConversationStore()

  useEffect(() => {
    fetchConversations()
  }, [])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteConversation(id)
  }

  return (
    <div style={{
      width: "260px",
      backgroundColor: "#1e1e2e",
      borderRight: "1px solid #2a2a3e",
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      flexShrink: 0,
    }}>
      {/* New Chat Button */}
      <div style={{ padding: "16px" }}>
        <button
          onClick={onNewChat}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            width: "100%",
            padding: "10px 14px",
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            border: "none",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: 500,
            color: "#fff",
            cursor: "pointer",
          }}
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>

      {/* Conversation List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 16px" }}>
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "24px" }}>
            <Loader2 size={20} className="animate-spin" color="#6366f1" />
          </div>
        ) : conversations.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "24px 16px",
            color: "#6b7280",
            fontSize: "13px",
          }}>
            <MessageSquare size={24} style={{ marginBottom: "8px", opacity: 0.5 }} />
            <p>No conversations yet</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  background: conv.id === activeConversationId ? "#2a2a3e" : "transparent",
                  transition: "background 0.15s",
                  fontSize: "13px",
                  color: conv.id === activeConversationId ? "#fff" : "#a1a1aa",
                }}
                onMouseEnter={(e) => {
                  if (conv.id !== activeConversationId) {
                    e.currentTarget.style.background = "#2a2a3e"
                  }
                }}
                onMouseLeave={(e) => {
                  if (conv.id !== activeConversationId) {
                    e.currentTarget.style.background = "transparent"
                  }
                }}
              >
                <MessageSquare size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
                <span style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {conv.title}
                </span>
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    opacity: conv.id === activeConversationId ? 0.7 : 0,
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "1" }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = conv.id === activeConversationId ? "0.7" : "0"
                  }}
                >
                  <Trash2 size={12} color="#ef4444" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
