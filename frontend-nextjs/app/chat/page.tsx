"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Bot, Send, ChevronDown, ChevronRight, Brain, Wrench, Menu, X } from "lucide-react"
import ConversationSidebar from "@/components/ConversationSidebar"
import { useConversationStore } from "@/hooks/useConversationStore"

interface ToolCall {
  name: string
  input: string
  output: any
  status: 'executing' | 'completed' | 'error'
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  reasoning?: string
  toolCalls?: ToolCall[]
  timestamp: Date
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [isConnected, setIsConnected] = useState(true)
  const [isThinking, setIsThinking] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState("mlx-qwen3.5-35b-a3b-claude-4.6-opus-reasoning-distilled")
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const {
    activeConversationId,
    setActiveConversation,
    fetchConversations,
    updateConversationTitle,
  } = useConversationStore()

  useEffect(() => {
    checkConnection()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const checkConnection = async () => {
    try {
      const res = await fetch('/api/chat/models')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setIsConnected(data.connected || false)
      if (data.models) {
        const llmModels = data.models
          .filter((m: any) => m.id !== 'text-embedding-nomic-embed-text-v1.5')
          .map((m: any) => m.id)
        setModels(llmModels)
      }
    } catch (err) {
      console.error('Connection failed:', err)
      setIsConnected(false)
    }
  }

  const loadConversation = useCallback(async (id: string) => {
    setActiveConversation(id)
    try {
      const res = await fetch(`/api/conversations/${id}`)
      if (!res.ok) throw new Error("Failed to load")
      const data = await res.json()
      const loaded: Message[] = data.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        reasoning: m.reasoning_content || undefined,
        toolCalls: m.tool_calls && m.tool_calls.length ? m.tool_calls : undefined,
        timestamp: new Date(m.created_at),
      }))
      setMessages(loaded)
    } catch (err) {
      console.error("Failed to load conversation:", err)
    }
  }, [setActiveConversation])

  const startNewChat = useCallback(() => {
    setActiveConversation(null)
    setMessages([])
    setInput("")
  }, [setActiveConversation])

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    }

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setInput("")
    setIsStreaming(true)
    setIsThinking(true)

    try {
      const history = [
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user" as const, content: userMessage.content },
      ]

      const response = await fetch('/api/chat/stream', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          model: selectedModel,
          conversationId: activeConversationId,
        }),
      })

      if (!response.ok) throw new Error("Failed to send message")

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response body")

      const decoder = new TextDecoder()
      let receivedConversationId: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: false })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue

          const data = line.slice(6)
          try {
            const parsed = JSON.parse(data)

            if (parsed.type === "start" && parsed.conversationId) {
              receivedConversationId = parsed.conversationId
              if (!activeConversationId) {
                setActiveConversation(parsed.conversationId)
                fetchConversations()
              }
            }

            if (parsed.type === "content" && parsed.content) {
              if (isThinking) setIsThinking(false)
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessage.id
                    ? { ...m, content: m.content + parsed.content }
                    : m
                )
              )
            }
            if (parsed.type === "reasoning_chunk" && parsed.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessage.id
                    ? { ...m, reasoning: (m.reasoning || "") + parsed.content }
                    : m
                )
              )
            }
            if (parsed.type === "reasoning" && parsed.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessage.id
                    ? { ...m, reasoning: parsed.content }
                    : m
                )
              )
            }
            if (parsed.type === "tool_calls" && parsed.calls) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessage.id
                    ? { ...m, toolCalls: parsed.calls }
                    : m
                )
              )
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      if (!activeConversationId && receivedConversationId && messages.length === 0) {
        updateConversationTitle(receivedConversationId, userMessage.content.slice(0, 80))
        fetchConversations()
      }
    } catch (err) {
      setIsThinking(false)
      console.error("Chat error:", err)
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === assistantMessage.id) {
            if (!m.content && !m.reasoning && !m.toolCalls) {
              return { ...m, content: "Error: Failed to get response" }
            }
            return { ...m, content: m.content + "\n\n[Stream interrupted]" }
          }
          return m
        })
      )
    } finally {
      setIsStreaming(false)
      setIsThinking(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "hsl(var(--background-page))" }}>
      {/* Sidebar */}
      {sidebarOpen && (
        <ConversationSidebar
          onSelectConversation={loadConversation}
          onNewChat={startNewChat}
          activeConversationId={activeConversationId}
        />
      )}

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <header style={{
          backgroundColor: "hsl(var(--background-card))",
          borderBottom: "1px solid hsl(var(--border))",
          padding: "0 24px",
        }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              height: "64px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "8px",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  {sidebarOpen ? <X size={20} color="hsl(var(--foreground-secondary))" /> : <Menu size={20} color="hsl(var(--foreground-secondary))" />}
                </button>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-light)) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Bot size={20} color="#fff" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h1 style={{ fontSize: "16px", fontWeight: 600, color: "hsl(var(--foreground))", margin: 0 }}>
                    AI Chat
                  </h1>
                  <p style={{ fontSize: "12px", color: isConnected === true ? "hsl(var(--success))" : "hsl(var(--error))", margin: "2px 0 0" }}>
                    {isConnected === true ? "Connected to LM Studio" : "Not connected"}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {models.length > 0 && (
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() => setShowModelDropdown(!showModelDropdown)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 12px",
                        background: "hsl(var(--background-page))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "hsl(var(--foreground-secondary))",
                        cursor: "pointer",
                      }}
                    >
                      {selectedModel.includes("35b") ? "35B Opus" : selectedModel.includes("27b") ? "27B Opus" : selectedModel.includes("9b") ? "9B" : selectedModel.includes("4b") ? "4B" : selectedModel}
                      <ChevronDown size={14} />
                    </button>
                    {showModelDropdown && (
                      <div style={{
                        position: "absolute",
                        right: 0,
                        top: "100%",
                        marginTop: "4px",
                        background: "hsl(var(--background-card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        zIndex: 50,
                        minWidth: "220px",
                      }}>
                        {models.map((model) => (
                          <button
                            key={model}
                            onClick={() => { setSelectedModel(model); setShowModelDropdown(false); }}
                            style={{
                              display: "block",
                              width: "100%",
                              padding: "8px 12px",
                              background: selectedModel === model ? "hsl(var(--background-muted))" : "transparent",
                              border: "none",
                              borderBottom: "1px solid hsl(var(--background-muted))",
                              fontSize: "12px",
                              color: "hsl(var(--foreground-muted))",
                              textAlign: "left",
                              cursor: "pointer",
                            }}
                          >
                            {model}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Messages */}
        <main style={{
          flex: 1,
          maxWidth: "900px",
          width: "100%",
          margin: "0 auto",
          padding: "24px 0",
          overflowY: "auto",
        }}>
          {messages.length === 0 ? (
            <div style={{
              textAlign: "center",
              paddingTop: "80px",
              color: "hsl(var(--foreground-secondary))",
            }}>
              <Bot size={48} style={{ marginBottom: "16px", opacity: 0.5 }} />
              <p style={{ fontSize: "16px" }}>Start a conversation</p>
              <p style={{ fontSize: "13px", marginTop: "8px" }}>
                Your registered agents will be available as skills
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "0 16px" }}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "80%",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      background: msg.role === "user"
                        ? "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-light)) 100%)"
                        : "hsl(var(--background-card))",
                      color: msg.role === "user" ? "#fff" : "hsl(var(--foreground))",
                      border: msg.role === "assistant" ? "1px solid hsl(var(--border))" : "none",
                      fontSize: "14px",
                      lineHeight: "1.5",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {msg.role === "assistant" && msg.reasoning && (
                      <ReasoningAccordion content={msg.reasoning} />
                    )}
                    {msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0 && (
                      <ToolCallDisplay calls={msg.toolCalls} />
                    )}
                    {msg.content || (msg.role === "assistant" && isStreaming && msg.id === messages[messages.length - 1]?.id ? "" : null)}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Input */}
        <footer style={{
          backgroundColor: "hsl(var(--background-card))",
          borderTop: "1px solid hsl(var(--border))",
          padding: "16px 24px",
        }}>
          <div style={{
            maxWidth: "900px",
            margin: "0 auto",
            display: "flex",
            gap: "12px",
            alignItems: "flex-end",
          }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={1}
              disabled={isStreaming}
              style={{
                flex: 1,
                padding: "12px 16px",
                border: "1px solid hsl(var(--border))",
                borderRadius: "12px",
                fontSize: "14px",
                outline: "none",
                resize: "none",
                fontFamily: "inherit",
                minHeight: "48px",
                maxHeight: "150px",
              }}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              style={{
                background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-light)) 100%)",
                border: "none",
                borderRadius: "12px",
                width: "48px",
                height: "48px",
                cursor: isStreaming ? "not-allowed" : "pointer",
                flexShrink: 0,
              }}
            >
              <Send size={18} color="#fff" />
            </Button>
          </div>
        </footer>
      </div>

      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  )
}

function ReasoningAccordion({ content }: { content: string }) {
  const [isOpen, setIsOpen] = useState(false)

  if (!content) return null

  return (
    <div style={{
      marginBottom: "8px",
      borderRadius: "8px",
      overflow: "hidden",
      border: "1px solid hsl(var(--border))",
      width: "100%",
    }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          width: "100%",
          padding: "8px 12px",
          background: "hsl(var(--background-page))",
          border: "none",
          cursor: "pointer",
          fontSize: "13px",
          color: "hsl(var(--foreground-secondary))",
          textAlign: "left",
        }}
      >
        <Brain size={14} />
        <span style={{ flex: 1 }}>Thinking</span>
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {isOpen && (
        <div style={{
          padding: "12px",
          background: "hsl(var(--background-page))",
          borderTop: "1px solid hsl(var(--border))",
          fontSize: "13px",
          color: "hsl(var(--foreground-secondary))",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          {content}
        </div>
      )}
    </div>
  )
}

function ToolCallDisplay({ calls }: { calls: ToolCall[] }) {
  return (
    <div style={{
      marginBottom: "8px",
      borderRadius: "8px",
      overflow: "hidden",
      border: "1px solid hsl(var(--border))",
    }}>
      {calls.map((call, i) => (
        <div key={i} style={{
          padding: "8px 12px",
          background: "hsl(var(--background-page))",
          borderBottom: i < calls.length - 1 ? "1px solid hsl(var(--border))" : "none",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "6px",
          }}>
            <Wrench size={14} color="hsl(var(--primary))" />
            <span style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "hsl(var(--foreground-muted))",
            }}>
              {call.name.replace(/execute_skill_/g, '').replace(/_/g, '.')}
            </span>
            <span style={{
              marginLeft: "auto",
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "12px",
              background: call.status === 'completed' ? 'hsl(var(--success-bg))' : call.status === 'error' ? 'hsl(var(--error-bg))' : 'hsl(var(--warning-bg))',
              color: call.status === 'completed' ? 'hsl(var(--success-fg))' : call.status === 'error' ? 'hsl(var(--error-fg))' : 'hsl(var(--warning-fg))',
            }}>
              {call.status}
            </span>
          </div>
          <div style={{
            fontSize: "12px",
            color: "hsl(var(--foreground-secondary))",
            marginBottom: "4px",
          }}>
            <span style={{ fontWeight: 500 }}>Input:</span> {call.input}
          </div>
          {call.output && (
            <div style={{
              fontSize: "12px",
              color: "hsl(var(--foreground-secondary))",
              maxHeight: "100px",
              overflow: "auto",
              padding: "6px 8px",
              background: "hsl(var(--background-card))",
              borderRadius: "4px",
              border: "1px solid hsl(var(--background-muted))",
            }}>
              <span style={{ fontWeight: 500 }}>Output:</span>{" "}
              {typeof call.output === 'object' ? JSON.stringify(call.output, null, 2).substring(0, 300) : String(call.output)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
