"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Send, ChevronDown, ChevronRight, Brain, Wrench, Menu, X, Zap } from "lucide-react"
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

  useEffect(() => { checkConnection() }, [])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  const checkConnection = async () => {
    try {
      const res = await fetch('/api/chat/models')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setIsConnected(data.connected || false)
      if (data.models) {
        setModels(data.models.filter((m: any) => m.id !== 'text-embedding-nomic-embed-text-v1.5').map((m: any) => m.id))
      }
    } catch { setIsConnected(false) }
  }

  const loadConversation = useCallback(async (id: string) => {
    setActiveConversation(id)
    try {
      const res = await fetch(`/api/conversations/${id}`)
      if (!res.ok) throw new Error("Failed to load")
      const data = await res.json()
      setMessages(data.messages.map((m: any) => ({
        id: m.id, role: m.role, content: m.content,
        reasoning: m.reasoning_content || undefined,
        toolCalls: m.tool_calls?.length ? m.tool_calls : undefined,
        timestamp: new Date(m.created_at),
      })))
    } catch (err) { console.error("Failed to load conversation:", err) }
  }, [setActiveConversation])

  const startNewChat = useCallback(() => {
    setActiveConversation(null); setMessages([]); setInput("")
  }, [setActiveConversation])

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return

    const userMessage: Message = { id: Date.now().toString(), role: "user", content: input.trim(), timestamp: new Date() }
    const assistantMessage: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: "", timestamp: new Date() }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setInput(""); setIsStreaming(true); setIsThinking(true)

    try {
      const history = [...messages.map((m) => ({ role: m.role, content: m.content })), { role: "user" as const, content: userMessage.content }]
      const response = await fetch('/api/chat/stream', {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, model: selectedModel, conversationId: activeConversationId }),
      })
      if (!response.ok) throw new Error("Failed to send message")

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response body")
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: false })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue
          try {
            const parsed = JSON.parse(line.slice(6))
            if (parsed.type === "start" && parsed.conversationId && !activeConversationId) {
              setActiveConversation(parsed.conversationId); fetchConversations()
            }
            if (parsed.type === "content" && parsed.content) {
              if (isThinking) setIsThinking(false)
              setMessages((prev) => prev.map((m) => m.id === assistantMessage.id ? { ...m, content: m.content + parsed.content } : m))
            }
            if ((parsed.type === "reasoning_chunk" || parsed.type === "reasoning") && parsed.content) {
              setMessages((prev) => prev.map((m) => m.id === assistantMessage.id ? { ...m, reasoning: (m.reasoning || "") + parsed.content } : m))
            }
            if (parsed.type === "tool_calls" && parsed.calls) {
              setMessages((prev) => prev.map((m) => m.id === assistantMessage.id ? { ...m, toolCalls: parsed.calls } : m))
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error("Chat error:", err)
      setMessages((prev) => prev.map((m) => {
        if (m.id === assistantMessage.id) {
          if (!m.content && !m.reasoning && !m.toolCalls) return { ...m, content: "Error: Failed to get response" }
          return { ...m, content: m.content + "\n\n[Stream interrupted]" }
        }
        return m
      }))
    } finally { setIsStreaming(false); setIsThinking(false) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() } }

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "hsl(var(--background-page))" }}>
      {sidebarOpen && (
        <ConversationSidebar onSelectConversation={loadConversation} onNewChat={startNewChat} activeConversationId={activeConversationId} />
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <header style={{
          backgroundColor: "hsl(var(--background-muted) / 0.8)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid hsl(var(--border))",
          padding: "0 24px",
        }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "60px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
                <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
                  background: "none", border: "none", cursor: "pointer", padding: "8px", borderRadius: "8px",
                  display: "flex", alignItems: "center", color: "hsl(var(--foreground-muted))",
                }}>
                  {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
                <div style={{
                  width: "32px", height: "32px", borderRadius: "8px",
                  background: "hsl(var(--primary) / 0.1)", border: "1px solid hsl(var(--primary) / 0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Zap size={16} color="hsl(var(--primary))" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h1 style={{ fontSize: "14px", fontWeight: 700, color: "hsl(var(--foreground))", margin: 0, letterSpacing: "0.5px" }}>
                    AI CHAT
                  </h1>
                  <p style={{ fontSize: "11px", color: isConnected ? "hsl(var(--success))" : "hsl(var(--error))", margin: 0, fontWeight: 500, letterSpacing: "0.3px" }}>
                    {isConnected ? "ONLINE" : "OFFLINE"}
                  </p>
                </div>
              </div>

              {models.length > 0 && (
                <div style={{ position: "relative" }}>
                  <button onClick={() => setShowModelDropdown(!showModelDropdown)} style={{
                    display: "flex", alignItems: "center", gap: "8px", padding: "6px 14px",
                    background: "hsl(var(--background-card))", border: "1px solid hsl(var(--border))",
                    borderRadius: "8px", fontSize: "11px", fontWeight: 500, color: "hsl(var(--foreground-secondary))",
                    cursor: "pointer", letterSpacing: "0.3px",
                  }}>
                    {selectedModel.includes("35b") ? "35B" : selectedModel.includes("27b") ? "27B" : selectedModel.includes("9b") ? "9B" : selectedModel.includes("4b") ? "4B" : selectedModel.slice(0, 12)}
                    <ChevronDown size={12} />
                  </button>
                  {showModelDropdown && (
                    <div style={{
                      position: "absolute", right: 0, top: "100%", marginTop: "6px",
                      background: "hsl(var(--background-card))", border: "1px solid hsl(var(--border))",
                      borderRadius: "10px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", zIndex: 50, minWidth: "240px", overflow: "hidden",
                    }}>
                      {models.map((model) => (
                        <button key={model} onClick={() => { setSelectedModel(model); setShowModelDropdown(false) }} style={{
                          display: "block", width: "100%", padding: "10px 14px",
                          background: selectedModel === model ? "hsl(var(--primary) / 0.08)" : "transparent",
                          border: "none", borderBottom: "1px solid hsl(var(--border) / 0.5)",
                          fontSize: "11px", fontWeight: selectedModel === model ? 600 : 400,
                          color: selectedModel === model ? "hsl(var(--primary))" : "hsl(var(--foreground-secondary))",
                          textAlign: "left", cursor: "pointer", letterSpacing: "0.2px",
                        }}>
                          {model}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Messages */}
        <main style={{ flex: 1, maxWidth: "860px", width: "100%", margin: "0 auto", padding: "32px 0", overflowY: "auto" }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: "120px" }}>
              <div style={{
                width: "64px", height: "64px", margin: "0 auto 24px",
                borderRadius: "16px", background: "hsl(var(--primary) / 0.06)",
                border: "1px solid hsl(var(--primary) / 0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Zap size={28} color="hsl(var(--primary))" style={{ opacity: 0.6 }} />
              </div>
              <p style={{ fontSize: "18px", fontWeight: 600, color: "hsl(var(--foreground))", margin: 0, letterSpacing: "0.5px" }}>
                Start a conversation
              </p>
              <p style={{ fontSize: "13px", color: "hsl(var(--foreground-muted))", marginTop: "8px", letterSpacing: "0.2px" }}>
                Multi-agent AI with real-time tool execution
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "0 20px" }}>
              {messages.map((msg) => (
                <div key={msg.id} style={{
                  display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}>
                  <div style={{
                    maxWidth: "85%", padding: msg.role === "user" ? "14px 18px" : "0",
                    borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "none",
                    background: msg.role === "user" ? "hsl(var(--primary) / 0.12)" : "transparent",
                    border: msg.role === "user" ? "1px solid hsl(var(--primary) / 0.2)" : "none",
                    fontSize: "14px", lineHeight: "1.7", whiteSpace: "pre-wrap", wordBreak: "break-word",
                    color: msg.role === "user" ? "hsl(var(--foreground))" : "hsl(var(--foreground))",
                    fontWeight: 400, letterSpacing: "0.1px",
                  }}>
                    {msg.role === "assistant" && msg.reasoning && <ReasoningAccordion content={msg.reasoning} />}
                    {msg.role === "assistant" && msg.toolCalls?.length > 0 && <ToolCallDisplay calls={msg.toolCalls} />}
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Input */}
        <footer style={{
          padding: "16px 24px 24px",
          borderTop: "1px solid hsl(var(--border))",
          background: "hsl(var(--background-muted) / 0.5)",
        }}>
          <div style={{ maxWidth: "860px", margin: "0 auto", display: "flex", gap: "12px", alignItems: "flex-end" }}>
            <textarea
              value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              rows={1} disabled={isStreaming}
              style={{
                flex: 1, padding: "14px 18px",
                background: "hsl(var(--background-card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "14px", fontSize: "14px", color: "hsl(var(--foreground))",
                outline: "none", resize: "none", fontFamily: "inherit",
                minHeight: "50px", maxHeight: "150px",
              }}
            />
            <Button onClick={sendMessage} disabled={!input.trim() || isStreaming} style={{
              background: isStreaming ? "hsl(var(--foreground-muted) / 0.3)" : "hsl(var(--primary))",
              border: "none", borderRadius: "14px", width: "50px", height: "50px",
              cursor: isStreaming ? "not-allowed" : "pointer", flexShrink: 0,
              boxShadow: !isStreaming ? "0 0 20px hsl(var(--primary) / 0.2)" : "none",
              transition: "all 0.2s ease",
            }}>
              <Send size={18} color={isStreaming ? "hsl(var(--foreground-muted))" : "hsl(var(--background-page))"} />
            </Button>
          </div>
        </footer>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
        textarea::placeholder { color: hsl(var(--foreground-muted)); }
      `}</style>
    </div>
  )
}

function ReasoningAccordion({ content }: { content: string }) {
  const [isOpen, setIsOpen] = useState(false)
  if (!content) return null

  return (
    <div style={{ marginBottom: "12px", borderRadius: "10px", overflow: "hidden", border: "1px solid hsl(var(--border))" }}>
      <button onClick={() => setIsOpen(!isOpen)} style={{
        display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 14px",
        background: "hsl(var(--background-muted))", border: "none", cursor: "pointer",
        fontSize: "11px", fontWeight: 600, color: "hsl(var(--foreground-muted))",
        textAlign: "left", letterSpacing: "0.8px", textTransform: "uppercase",
      }}>
        <Brain size={13} color="hsl(var(--accent))" />
        <span style={{ flex: 1 }}>Thinking</span>
        {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>
      {isOpen && (
        <div style={{
          padding: "14px", background: "hsl(var(--background-muted) / 0.5)",
          borderTop: "1px solid hsl(var(--border))",
          fontSize: "13px", color: "hsl(var(--foreground-secondary))",
          lineHeight: "1.7", whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {content}
        </div>
      )}
    </div>
  )
}

function ToolCallDisplay({ calls }: { calls: ToolCall[] }) {
  return (
    <div style={{ marginBottom: "12px", borderRadius: "10px", overflow: "hidden", border: "1px solid hsl(var(--border))" }}>
      {calls.map((call, i) => (
        <div key={i} style={{
          padding: "12px 14px", background: "hsl(var(--background-muted))",
          borderBottom: i < calls.length - 1 ? "1px solid hsl(var(--border))" : "none",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <Wrench size={12} color="hsl(var(--primary))" />
            <span style={{ fontSize: "11px", fontWeight: 600, color: "hsl(var(--primary))", letterSpacing: "0.5px" }}>
              {call.name.replace(/execute_skill_/g, '').replace(/_/g, '.')}
            </span>
            <span style={{
              marginLeft: "auto", fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px",
              background: call.status === 'completed' ? 'hsl(var(--success-bg))' : call.status === 'error' ? 'hsl(var(--error-bg))' : 'hsl(var(--warning-bg))',
              color: call.status === 'completed' ? 'hsl(var(--success-fg))' : call.status === 'error' ? 'hsl(var(--error-fg))' : 'hsl(var(--warning-fg))',
              letterSpacing: "0.5px", textTransform: "uppercase",
            }}>
              {call.status}
            </span>
          </div>
          <div style={{ fontSize: "12px", color: "hsl(var(--foreground-secondary))", marginBottom: "4px" }}>
            <span style={{ fontWeight: 500, color: "hsl(var(--foreground-muted))" }}>Input:</span> {call.input}
          </div>
          {call.output && (
            <div style={{
              fontSize: "11px", color: "hsl(var(--foreground-muted))", maxHeight: "100px", overflow: "auto",
              padding: "8px 10px", background: "hsl(var(--background-card))", borderRadius: "6px",
              border: "1px solid hsl(var(--border))", fontFamily: "monospace",
            }}>
              {typeof call.output === 'object' ? JSON.stringify(call.output, null, 2).substring(0, 300) : String(call.output)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
