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
      width: "280px",
      backgroundColor: "hsl(var(--background-muted))",
      borderRight: "1px solid hsl(var(--border))",
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      flexShrink: 0,
    }}>
      <div style={{ padding: "20px 16px" }}>
        <button
          onClick={onNewChat}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            width: "100%",
            padding: "12px 14px",
            background: "transparent",
            border: "1px solid hsl(var(--primary) / 0.3)",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 600,
            color: "hsl(var(--primary))",
            cursor: "pointer",
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "hsl(var(--primary) / 0.1)"
            e.currentTarget.style.borderColor = "hsl(var(--primary) / 0.6)"
            e.currentTarget.style.boxShadow = "0 0 20px hsl(var(--primary) / 0.15)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent"
            e.currentTarget.style.borderColor = "hsl(var(--primary) / 0.3)"
            e.currentTarget.style.boxShadow = "none"
          }}
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 16px" }}>
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "24px" }}>
            <Loader2 size={20} className="animate-spin" color="hsl(var(--primary))" />
          </div>
        ) : conversations.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "32px 16px",
            color: "hsl(var(--foreground-muted))",
            fontSize: "12px",
            letterSpacing: "0.3px",
          }}>
            <MessageSquare size={20} style={{ marginBottom: "10px", opacity: 0.3 }} />
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
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  background: conv.id === activeConversationId
                    ? "hsl(var(--primary) / 0.08)"
                    : "transparent",
                  borderLeft: conv.id === activeConversationId
                    ? "2px solid hsl(var(--primary))"
                    : "2px solid transparent",
                  transition: "all 0.15s ease",
                  fontSize: "12px",
                  fontWeight: conv.id === activeConversationId ? 500 : 400,
                  color: conv.id === activeConversationId
                    ? "hsl(var(--primary))"
                    : "hsl(var(--foreground-secondary))",
                  letterSpacing: "0.2px",
                }}
                onMouseEnter={(e) => {
                  if (conv.id !== activeConversationId) {
                    e.currentTarget.style.background = "hsl(var(--background-hover))"
                  }
                }}
                onMouseLeave={(e) => {
                  if (conv.id !== activeConversationId) {
                    e.currentTarget.style.background = "transparent"
                  }
                }}
              >
                <MessageSquare size={13} style={{ flexShrink: 0, opacity: 0.5 }} />
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
                    opacity: conv.id === activeConversationId ? 0.6 : 0,
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "1" }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = conv.id === activeConversationId ? "0.6" : "0"
                  }}
                >
                  <Trash2 size={11} color="hsl(var(--error))" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
