"use client"

import { useState } from "react"
import AgentCard from "./AgentCard"
import type { Agent } from "@/types/agent"

interface AgentListProps {
  agents: Agent[]
  onEdit: (agent: Agent) => void
  onDelete: (agentId: string) => void
}

export default function AgentList({ agents, onEdit, onDelete }: AgentListProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)

  if (!agents || agents.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "100px 20px" }}>
        <div style={{
          width: "64px", height: "64px", margin: "0 auto 20px", borderRadius: "16px",
          backgroundColor: "hsl(var(--background-muted))", border: "1px solid hsl(var(--border))",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="hsl(var(--foreground-muted))" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        </div>
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "hsl(var(--foreground))", margin: 0, letterSpacing: "0.3px" }}>No agents found</h3>
        <p style={{ fontSize: "13px", color: "hsl(var(--foreground-muted))", marginTop: "6px" }}>
          Click "Register" to get started
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "16px" }}>
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} isSelected={selectedAgent === agent.id}
          onSelect={() => setSelectedAgent(agent.id)} onEdit={() => onEdit(agent)} onDelete={() => onDelete(agent.id)} />
      ))}
    </div>
  )
}
