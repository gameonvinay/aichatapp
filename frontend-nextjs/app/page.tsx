"use client"

import { useEffect, useState, useCallback } from "react"
import AgentList from "@/components/AgentList"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { RefreshCw, Bot, Plus, X, MessageSquare } from "lucide-react"
import Link from "next/link"
import type { Agent, Skill } from "@/types/agent"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

type ModalType = "register" | "edit" | null

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [subscriptions, setSubscriptions] = useState<Map<string, EventSource>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [modal, setModal] = useState<ModalType>(null)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)

  // Register form state
  const [formId, setFormId] = useState("")
  const [formName, setFormName] = useState("")
  const [formType, setFormType] = useState("research")
  const [formStatus, setFormStatus] = useState("online")
  const [formSkills, setFormSkills] = useState<Skill[]>([{ name: "" }])
  const [formError, setFormError] = useState("")

  const resetForm = () => {
    setFormId("")
    setFormName("")
    setFormType("research")
    setFormStatus("online")
    setFormSkills([{ name: "" }])
    setFormError("")
    setEditingAgent(null)
  }

  const openRegister = () => {
    resetForm()
    setModal("register")
  }

  const openEdit = (agent: Agent) => {
    setEditingAgent(agent)
    setFormId(agent.id)
    setFormName(agent.name || "")
    setFormType(agent.type || "")
    setFormStatus(agent.status || "online")
    setFormSkills(agent.skills?.length ? agent.skills : [{ name: "" }])
    setFormError("")
    setModal("edit")
  }

  const closeModal = () => {
    setModal(null)
    resetForm()
  }

  const addSkillField = () => setFormSkills([...formSkills, { name: "" }])

  const removeSkillField = (idx: number) => {
    if (formSkills.length > 1) {
      setFormSkills(formSkills.filter((_, i) => i !== idx))
    }
  }

  const updateSkillField = (idx: number, value: string) => {
    const updated = [...formSkills]
    updated[idx] = { name: value }
    setFormSkills(updated)
  }

  const registerAgent = async () => {
    if (!formId.trim()) {
      setFormError("Agent ID is required")
      return
    }

    try {
      const skills = formSkills.filter((s) => s.name?.trim()).map((s) => ({ name: s.name }))
      const body = {
        id: formId,
        name: formName || formId,
        type: formType,
        status: formStatus,
        skills,
      }

      const response = await fetch(`${API_URL}/api/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) throw new Error("Failed to register agent")

      await fetchAgents()
      closeModal()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong")
    }
  }

  const updateAgent = async () => {
    if (!editingAgent) return

    try {
      const skills = formSkills.filter((s) => s.name?.trim()).map((s) => ({ name: s.name }))

      await fetch(`${API_URL}/api/agents/${formId}/skills`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(skills),
      })

      await fetch(`${API_URL}/api/agents/${formId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, type: formType, status: formStatus }),
      })

      await fetchAgents()
      closeModal()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong")
    }
  }

  const deleteAgent = async (agentId: string) => {
    if (!confirm(`Delete agent "${agentId}"?`)) return

    try {
      await fetch(`${API_URL}/api/agents/${agentId}`, { method: "DELETE" })
      setAgents((prev) => prev.filter((a) => a.id !== agentId))
    } catch (err) {
      console.error("Failed to delete agent:", err)
    }
  }

  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/agents`)
      const data = await response.json()

      if (data.agents) {
        setAgents(data.agents)

        data.agents.forEach((agent: Agent) => {
          if (agent.id) {
            openSSESubscription(agent.id)
          }
        })
      }

      setIsLoading(false)
    } catch (err) {
      console.error("Failed to fetch agents:", err)
      setIsLoading(false)
    }
  }, [])

  const openSSESubscription = (agentId: string) => {
    if (subscriptions.has(agentId)) return

    const eventSource = new EventSource(`${API_URL}/api/agents/${agentId}/stream`)

    eventSource.onmessage = (event) => {
      const update = JSON.parse(event.data)
      if (update.type === "connected") return
      if (!update.agent) return

      setAgents((prev) =>
        prev.map((a) => {
          if (a.id === update.agent.id) return { ...a, ...update.agent }
          return a
        })
      )
    }

    eventSource.onerror = () => {
      console.error("SSE connection error for agent:", agentId)
    }

    const newSubscriptions = new Map(subscriptions)
    newSubscriptions.set(agentId, eventSource)
    setSubscriptions(newSubscriptions)

    return () => {
      eventSource.close()
    }
  }

  useEffect(() => {
    return () => {
      subscriptions.forEach((es) => es.close())
    }
  }, [subscriptions])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "hsl(var(--background-page))" }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-light)) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Bot size={20} color="#fff" />
              </div>
              <div>
                <h1 style={{ fontSize: "16px", fontWeight: 600, color: "hsl(var(--foreground))", margin: 0 }}>
                  Deep Agents Dashboard
                </h1>
                <p style={{ fontSize: "12px", color: "hsl(var(--foreground-secondary))", margin: "2px 0 0" }}>
                  {agents.length} agent{agents.length !== 1 ? "s" : ""} registered
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <Link href="/chat">
                <Button
                  style={{
                    background: "hsl(var(--background-muted))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 500,
                    padding: "8px 16px",
                    height: "36px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    color: "hsl(var(--foreground))",
                    textDecoration: "none",
                  }}
                >
                  <MessageSquare size={14} style={{ flexShrink: 0 }} />
                  Chat
                </Button>
              </Link>
              <Button
                onClick={openRegister}
                style={{
                  background: "hsl(var(--success))",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 500,
                  padding: "8px 16px",
                  height: "36px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <Plus size={14} style={{ flexShrink: 0 }} />
                Register Agent
              </Button>
              <Button
                onClick={fetchAgents}
                disabled={isLoading}
                style={{
                  background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-light)) 100%)",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 500,
                  padding: "8px 16px",
                  height: "36px",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <RefreshCw
                  size={14}
                  style={{ flexShrink: 0, animation: isLoading ? "spin 1s linear infinite" : "none" }}
                />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
        {isLoading ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "20px",
          }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                backgroundColor: "hsl(var(--background-card))",
                borderRadius: "12px",
                border: "1px solid hsl(var(--border))",
                padding: "24px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div style={{ flex: 1 }}>
                    <Skeleton className="h-3.5 w-3/5 mb-2" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                </div>
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <AgentList
            agents={agents}
            onEdit={openEdit}
            onDelete={deleteAgent}
          />
        )}
      </main>

      {/* Modal Overlay */}
      {modal && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "hsl(var(--background-card))",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "480px",
              maxHeight: "90vh",
              overflow: "auto",
              padding: "24px",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 600, color: "hsl(var(--foreground))", margin: 0 }}>
                {modal === "register" ? "Register New Agent" : "Edit Agent"}
              </h2>
              <button
                onClick={closeModal}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={18} color="hsl(var(--foreground-secondary))" />
              </button>
            </div>

            {/* Form */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Agent ID */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "hsl(var(--foreground-secondary))", marginBottom: "4px" }}>
                  Agent ID {modal === "register" && <span style={{ color: "hsl(var(--error))" }}>*</span>}
                </label>
                <input
                  type="text"
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  disabled={modal === "edit"}
                  placeholder="e.g. agent-researcher-001"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                    backgroundColor: modal === "edit" ? "hsl(var(--background-muted))" : "hsl(var(--background-card))",
                  }}
                />
              </div>

              {/* Name */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "hsl(var(--foreground-secondary))", marginBottom: "4px" }}>
                  Display Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Research Agent"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Type & Status row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "hsl(var(--foreground-secondary))", marginBottom: "4px" }}>
                    Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "14px",
                      outline: "none",
                      boxSizing: "border-box",
                      backgroundColor: "hsl(var(--background-card))",
                    }}
                  >
                    <option value="research">Research</option>
                    <option value="writing">Writing</option>
                    <option value="development">Development</option>
                    <option value="analysis">Analysis</option>
                    <option value="general">General</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "hsl(var(--foreground-secondary))", marginBottom: "4px" }}>
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "14px",
                      outline: "none",
                      boxSizing: "border-box",
                      backgroundColor: "hsl(var(--background-card))",
                    }}
                  >
                    <option value="online">Online</option>
                    <option value="busy">Busy</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>
              </div>

              {/* Skills */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 500, color: "hsl(var(--foreground-secondary))" }}>
                    Skills
                  </label>
                  <button
                    onClick={addSkillField}
                    type="button"
                    style={{
                      background: "none",
                      border: "none",
                      color: "hsl(var(--primary))",
                      fontSize: "12px",
                      fontWeight: 500,
                      cursor: "pointer",
                      padding: "2px 4px",
                    }}
                  >
                    + Add Skill
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {formSkills.map((skill, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        value={skill.name || ""}
                        onChange={(e) => updateSkillField(idx, e.target.value)}
                        placeholder="Skill name (e.g. web-search)"
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "14px",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      {formSkills.length > 1 && (
                        <button
                          onClick={() => removeSkillField(idx)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "4px",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <X size={16} color="hsl(var(--foreground-muted))" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Error */}
              {formError && (
                <div style={{
                  padding: "10px 12px",
                  backgroundColor: "hsl(var(--error-bg))",
                  border: "1px solid hsl(var(--error))",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "hsl(var(--error-fg))",
                }}>
                  {formError}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
                <button
                  onClick={closeModal}
                  style={{
                    padding: "8px 16px",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    backgroundColor: "hsl(var(--background-card))",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "hsl(var(--foreground-secondary))",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={modal === "register" ? registerAgent : updateAgent}
                  style={{
                    padding: "8px 20px",
                    border: "none",
                    borderRadius: "8px",
                background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-light)) 100%)",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  {modal === "register" ? "Register Agent" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
