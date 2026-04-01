"use client"

import { useState, useEffect } from "react"
import { ChevronDown, ChevronUp, Zap, ClipboardList, Pencil, Trash2 } from "lucide-react"
import type { Skill, Task, Agent } from "@/types/agent"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

const statusConfig: Record<string, { dot: string; bg: string; text: string; border: string; label: string }> = {
  online: {
    dot: "#10b981",
    bg: "#ecfdf5",
    text: "#059669",
    border: "#a7f3d0",
    label: "Online",
  },
  offline: {
    dot: "#9ca3af",
    bg: "#f3f4f6",
    text: "#4b5563",
    border: "#d1d5db",
    label: "Offline",
  },
  busy: {
    dot: "#f59e0b",
    bg: "#fffbeb",
    text: "#d97706",
    border: "#fde68a",
    label: "Busy",
  },
}

interface AgentCardProps {
  agent: Agent
  isSelected: boolean
  onSelect: (id: string) => void
  onEdit: () => void
  onDelete: () => void
}

export default function AgentCard({ agent, isSelected, onSelect, onEdit, onDelete }: AgentCardProps) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [showSkills, setShowSkills] = useState(false)
  const [showTasks, setShowTasks] = useState(false)

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const response = await fetch(`${API_URL}/api/agents/${agent.id}/skills`)
        const data = await response.json()
        if (data.skills) {
          setSkills(data.skills)
        } else if (!data.error && agent.skills) {
          setSkills(agent.skills)
        }
      } catch (err) {
        console.error("Failed to fetch skills:", err)
      }
    }

    if (agent.id) {
      fetchSkills()
    }
  }, [agent.id, agent.skills])

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch(`${API_URL}/api/agents/${agent.id}/tasks`)
        const data = await response.json()
        if (data.tasks) {
          setTasks(data.tasks)
        }
      } catch (err) {
        console.error("Failed to fetch tasks:", err)
      }
    }

    if (agent.id) {
      fetchTasks()
    }
  }, [agent.id])

  const config = statusConfig[agent.status?.toLowerCase()] || statusConfig.online
  const activeTasks = tasks.filter((t) => !t.completed)
  const completedTasks = tasks.filter((t) => t.completed)

  return (
    <div
      onClick={() => onSelect(agent.id)}
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "12px",
        border: isSelected ? "1px solid #6366f1" : "1px solid #e2e8f0",
        boxShadow: isSelected ? "0 0 0 3px rgba(99,102,241,0.1)" : "0 1px 2px rgba(0,0,0,0.04)",
        cursor: "pointer",
        transition: "all 0.15s ease",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "20px 20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              backgroundColor: config.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <div style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: config.dot,
              }} />
            </div>
            <div>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", margin: 0 }}>
                {agent.name || agent.id}
              </h3>
              {agent.type && (
                <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0", textTransform: "capitalize" }}>
                  {agent.type}
                </p>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
              }}
              title="Edit agent"
            >
              <Pencil size={14} color="#64748b" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
              }}
              title="Delete agent"
            >
              <Trash2 size={14} color="#ef4444" />
            </button>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "3px 10px",
              borderRadius: "9999px",
              fontSize: "11px",
              fontWeight: 500,
              backgroundColor: config.bg,
              color: config.text,
              border: `1px solid ${config.border}`,
            }}>
              {config.label}
            </span>
          </div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #f1f5f9" }}>
        <button
          onClick={(e) => { e.stopPropagation(); setShowSkills(!showSkills) }}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Zap size={15} color="#94a3b8" />
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#334155" }}>Skills</span>
            {skills.length > 0 && (
              <span style={{
                backgroundColor: "#f1f5f9",
                color: "#475569",
                fontSize: "11px",
                fontWeight: 500,
                padding: "1px 7px",
                borderRadius: "9999px",
              }}>
                {skills.length}
              </span>
            )}
          </div>
          {showSkills ? <ChevronUp size={15} color="#94a3b8" /> : <ChevronDown size={15} color="#94a3b8" />}
        </button>
        {showSkills && (
          <div style={{ padding: "0 20px 16px" }}>
            {skills.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {skills.map((skill, idx) => (
                  <span key={idx} style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 500,
                    backgroundColor: "#eef2ff",
                    color: "#4338ca",
                  }}>
                    {skill.name || skill.description}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>No skills registered</p>
            )}
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid #f1f5f9" }}>
        <button
          onClick={(e) => { e.stopPropagation(); setShowTasks(!showTasks) }}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ClipboardList size={15} color="#94a3b8" />
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#334155" }}>Tasks</span>
            {activeTasks.length > 0 && (
              <span style={{
                backgroundColor: "#f1f5f9",
                color: "#475569",
                fontSize: "11px",
                fontWeight: 500,
                padding: "1px 7px",
                borderRadius: "9999px",
              }}>
                {activeTasks.length} active
              </span>
            )}
          </div>
          {showTasks ? <ChevronUp size={15} color="#94a3b8" /> : <ChevronDown size={15} color="#94a3b8" />}
        </button>
        {showTasks && (
          <div style={{ padding: "0 20px 16px" }}>
            {tasks.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {activeTasks.map((task, idx) => (
                  <div key={idx} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "#eff6ff",
                  }}>
                    <span style={{ fontSize: "12px", color: "#1e40af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {task.description || task.title}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: 500, color: "#3b82f6", marginLeft: "8px", whiteSpace: "nowrap" }}>
                      Active
                    </span>
                  </div>
                ))}
                {completedTasks.map((task, idx) => (
                  <div key={`completed-${idx}`} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "#f8fafc",
                    opacity: 0.6,
                  }}>
                    <span style={{ fontSize: "12px", color: "#64748b", textDecoration: "line-through", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {task.description || task.title}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: 500, color: "#94a3b8", marginLeft: "8px", whiteSpace: "nowrap" }}>
                      Done
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>No tasks assigned</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
