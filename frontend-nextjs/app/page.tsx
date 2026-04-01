"use client"

import { useEffect, useState, useCallback } from "react"
import AgentList from "@/components/AgentList"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { RefreshCw, Plus, X, MessageSquare, Zap, Cpu } from "lucide-react"
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
  const [formId, setFormId] = useState("")
  const [formName, setFormName] = useState("")
  const [formType, setFormType] = useState("research")
  const [formStatus, setFormStatus] = useState("online")
  const [formSkills, setFormSkills] = useState<Skill[]>([{ name: "" }])
  const [formError, setFormError] = useState("")

  const resetForm = () => {
    setFormId(""); setFormName(""); setFormType("research"); setFormStatus("online")
    setFormSkills([{ name: "" }]); setFormError(""); setEditingAgent(null)
  }

  const openRegister = () => { resetForm(); setModal("register") }
  const openEdit = (agent: Agent) => {
    setEditingAgent(agent); setFormId(agent.id); setFormName(agent.name || "")
    setFormType(agent.type || ""); setFormStatus(agent.status || "online")
    setFormSkills(agent.skills?.length ? agent.skills : [{ name: "" }]); setFormError(""); setModal("edit")
  }
  const closeModal = () => { setModal(null); resetForm() }
  const addSkillField = () => setFormSkills([...formSkills, { name: "" }])
  const removeSkillField = (idx: number) => { if (formSkills.length > 1) setFormSkills(formSkills.filter((_, i) => i !== idx)) }
  const updateSkillField = (idx: number, value: string) => { const u = [...formSkills]; u[idx] = { name: value }; setFormSkills(u) }

  const registerAgent = async () => {
    if (!formId.trim()) { setFormError("Agent ID is required"); return }
    try {
      const skills = formSkills.filter((s) => s.name?.trim()).map((s) => ({ name: s.name }))
      const res = await fetch(`${API_URL}/api/agents`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: formId, name: formName || formId, type: formType, status: formStatus, skills }),
      })
      if (!res.ok) throw new Error("Failed to register agent")
      await fetchAgents(); closeModal()
    } catch (err) { setFormError(err instanceof Error ? err.message : "Something went wrong") }
  }

  const updateAgent = async () => {
    if (!editingAgent) return
    try {
      const skills = formSkills.filter((s) => s.name?.trim()).map((s) => ({ name: s.name }))
      await fetch(`${API_URL}/api/agents/${formId}/skills`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(skills) })
      await fetch(`${API_URL}/api/agents/${formId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: formName, type: formType, status: formStatus }) })
      await fetchAgents(); closeModal()
    } catch (err) { setFormError(err instanceof Error ? err.message : "Something went wrong") }
  }

  const deleteAgent = async (agentId: string) => {
    if (!confirm(`Delete agent "${agentId}"?`)) return
    try { await fetch(`${API_URL}/api/agents/${agentId}`, { method: "DELETE" }); setAgents((prev) => prev.filter((a) => a.id !== agentId)) }
    catch (err) { console.error("Failed to delete agent:", err) }
  }

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/agents`)
      const data = await res.json()
      if (data.agents) { setAgents(data.agents); data.agents.forEach((a: Agent) => { if (a.id) openSSESubscription(a.id) }) }
      setIsLoading(false)
    } catch { setIsLoading(false) }
  }, [])

  const openSSESubscription = (agentId: string) => {
    if (subscriptions.has(agentId)) return
    const es = new EventSource(`${API_URL}/api/agents/${agentId}/stream`)
    es.onmessage = (e) => {
      const update = JSON.parse(e.data)
      if (update.type === "connected" || !update.agent) return
      setAgents((prev) => prev.map((a) => a.id === update.agent.id ? { ...a, ...update.agent } : a))
    }
    const ns = new Map(subscriptions); ns.set(agentId, es); setSubscriptions(ns)
  }

  useEffect(() => { return () => { subscriptions.forEach((es) => es.close()) } }, [subscriptions])
  useEffect(() => { fetchAgents() }, [fetchAgents])

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "hsl(var(--background-page))" }}>
      {/* Header */}
      <header style={{
        backgroundColor: "hsl(var(--background-muted) / 0.8)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid hsl(var(--border))",
        padding: "0 24px",
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "60px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "8px",
                background: "hsl(var(--primary) / 0.1)", border: "1px solid hsl(var(--primary) / 0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Cpu size={16} color="hsl(var(--primary))" />
              </div>
              <div>
                <h1 style={{ fontSize: "14px", fontWeight: 700, color: "hsl(var(--foreground))", margin: 0, letterSpacing: "0.5px" }}>
                  AGENT COMMAND
                </h1>
                <p style={{ fontSize: "11px", color: "hsl(var(--foreground-muted))", margin: "2px 0 0", fontWeight: 500, letterSpacing: "0.3px" }}>
                  {agents.length} agent{agents.length !== 1 ? "s" : ""} active
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <Link href="/chat">
                <Button style={{
                  background: "transparent", border: "1px solid hsl(var(--border))", borderRadius: "8px",
                  fontSize: "12px", fontWeight: 500, padding: "0 14px", height: "34px", cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: "6px", color: "hsl(var(--foreground-secondary))",
                }}>
                  <MessageSquare size={13} />
                  Chat
                </Button>
              </Link>
              <Button onClick={openRegister} style={{
                background: "transparent", border: "1px solid hsl(var(--primary) / 0.3)", borderRadius: "8px",
                fontSize: "12px", fontWeight: 600, padding: "0 14px", height: "34px", cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: "6px", color: "hsl(var(--primary))",
                letterSpacing: "0.3px",
              }}>
                <Plus size={13} />
                Register
              </Button>
              <Button onClick={fetchAgents} disabled={isLoading} style={{
                background: "hsl(var(--primary))", border: "none", borderRadius: "8px",
                fontSize: "12px", fontWeight: 600, padding: "0 14px", height: "34px",
                cursor: isLoading ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: "6px",
                color: "hsl(var(--background-page))", letterSpacing: "0.3px",
                boxShadow: "0 0 16px hsl(var(--primary) / 0.2)",
              }}>
                <RefreshCw size={13} style={{ flexShrink: 0, animation: isLoading ? "spin 1s linear infinite" : "none" }} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
        {isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "16px" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                backgroundColor: "hsl(var(--background-card))", borderRadius: "12px",
                border: "1px solid hsl(var(--border))", padding: "24px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div style={{ flex: 1 }}><Skeleton className="h-3.5 w-3/5 mb-2" /><Skeleton className="h-3 w-2/5" /></div>
                </div>
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        ) : <AgentList agents={agents} onEdit={openEdit} onDelete={deleteAgent} />}
      </main>

      {/* Modal */}
      {modal && (
        <div onClick={closeModal} style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: "hsl(var(--background-card))", borderRadius: "16px",
            border: "1px solid hsl(var(--border))", width: "100%", maxWidth: "460px",
            maxHeight: "90vh", overflow: "auto", padding: "28px",
            boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "hsl(var(--foreground))", margin: 0, letterSpacing: "0.5px" }}>
                {modal === "register" ? "REGISTER AGENT" : "EDIT AGENT"}
              </h2>
              <button onClick={closeModal} style={{
                background: "none", border: "none", cursor: "pointer", padding: "4px", borderRadius: "6px",
                display: "flex", alignItems: "center", color: "hsl(var(--foreground-muted))",
              }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "hsl(var(--foreground-muted))", marginBottom: "6px", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                  Agent ID {modal === "register" && <span style={{ color: "hsl(var(--error))" }}>*</span>}
                </label>
                <input type="text" value={formId} onChange={(e) => setFormId(e.target.value)} disabled={modal === "edit"}
                  placeholder="e.g. agent-researcher-001"
                  style={{
                    width: "100%", padding: "10px 14px", background: "hsl(var(--background-muted))",
                    border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "13px",
                    color: "hsl(var(--foreground))", outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "hsl(var(--foreground-muted))", marginBottom: "6px", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                  Display Name
                </label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Research Agent"
                  style={{
                    width: "100%", padding: "10px 14px", background: "hsl(var(--background-muted))",
                    border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "13px",
                    color: "hsl(var(--foreground))", outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "hsl(var(--foreground-muted))", marginBottom: "6px", letterSpacing: "0.5px", textTransform: "uppercase" }}>Type</label>
                  <select value={formType} onChange={(e) => setFormType(e.target.value)} style={{
                    width: "100%", padding: "10px 14px", background: "hsl(var(--background-muted))",
                    border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "13px",
                    color: "hsl(var(--foreground))", outline: "none", boxSizing: "border-box",
                  }}>
                    {["research","writing","development","analysis","general","custom"].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "hsl(var(--foreground-muted))", marginBottom: "6px", letterSpacing: "0.5px", textTransform: "uppercase" }}>Status</label>
                  <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} style={{
                    width: "100%", padding: "10px 14px", background: "hsl(var(--background-muted))",
                    border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "13px",
                    color: "hsl(var(--foreground))", outline: "none", boxSizing: "border-box",
                  }}>
                    {["online","busy","offline"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "hsl(var(--foreground-muted))", letterSpacing: "0.5px", textTransform: "uppercase" }}>Skills</label>
                  <button onClick={addSkillField} style={{ background: "none", border: "none", color: "hsl(var(--primary))", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>+ Add</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {formSkills.map((skill, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "8px" }}>
                      <input type="text" value={skill.name || ""} onChange={(e) => updateSkillField(idx, e.target.value)} placeholder="Skill name"
                        style={{
                          flex: 1, padding: "10px 14px", background: "hsl(var(--background-muted))",
                          border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "13px",
                          color: "hsl(var(--foreground))", outline: "none", boxSizing: "border-box",
                        }}
                      />
                      {formSkills.length > 1 && (
                        <button onClick={() => removeSkillField(idx)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", color: "hsl(var(--foreground-muted))" }}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {formError && (
                <div style={{ padding: "10px 14px", backgroundColor: "hsl(var(--error-bg))", border: "1px solid hsl(var(--error) / 0.3)", borderRadius: "8px", fontSize: "12px", color: "hsl(var(--error-fg))" }}>
                  {formError}
                </div>
              )}

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
                <button onClick={closeModal} style={{
                  padding: "10px 18px", border: "1px solid hsl(var(--border))", borderRadius: "8px",
                  backgroundColor: "transparent", fontSize: "12px", fontWeight: 600, color: "hsl(var(--foreground-secondary))",
                  cursor: "pointer", letterSpacing: "0.3px",
                }}>Cancel</button>
                <button onClick={modal === "register" ? registerAgent : updateAgent} style={{
                  padding: "10px 22px", border: "none", borderRadius: "8px",
                  background: "hsl(var(--primary))", fontSize: "12px", fontWeight: 600,
                  color: "hsl(var(--background-page))", cursor: "pointer", letterSpacing: "0.3px",
                  boxShadow: "0 0 16px hsl(var(--primary) / 0.2)",
                }}>
                  {modal === "register" ? "Register" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
