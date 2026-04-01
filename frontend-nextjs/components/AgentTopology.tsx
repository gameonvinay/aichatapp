"use client"

import React, { useMemo, useCallback } from "react"
import {
  ReactFlow, Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, type Node, type Edge, type OnConnect, BackgroundVariant,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

interface Agent { id: string; name?: string; type?: string; status?: string; skills?: unknown[] }
interface Connection { agentId: string; targetAgentId: string }
interface AgentTopologyProps { agents: Agent[]; connections: Connection[] }

export default function AgentTopology({ agents, connections }: AgentTopologyProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const computedNodes = useMemo<Node[]>(() => {
    if (!agents?.length) return []
    return agents.map((agent, idx) => ({
      id: agent.id, type: "default",
      data: {
        label: (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 600, fontSize: "13px", letterSpacing: "0.3px" }}>{agent.name || agent.id}</div>
            {agent.type && <div style={{ fontSize: "11px", color: "hsl(var(--foreground-muted))", marginTop: "2px" }}>{agent.type}</div>}
          </div>
        ),
        status: agent.status, skills: Array.isArray(agent.skills) ? agent.skills : [],
      },
      position: { x: 50 + idx * 220, y: 20 + Math.floor(idx / 3) * 200 },
      style: {
        minWidth: 180, border: "1px solid hsl(var(--border))", borderRadius: 10,
        background: "hsl(var(--background-card))", color: "hsl(var(--foreground))",
        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
      },
    }))
  }, [agents])

  const computedEdges = useMemo<Edge[]>(() => {
    if (!connections?.length) return []
    return connections.map((c, idx) => ({
      id: `e${idx}`, source: c.agentId, target: c.targetAgentId, animated: true,
      style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
    }))
  }, [connections])

  const onConnect: OnConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges])

  return (
    <div style={{
      backgroundColor: "hsl(var(--background-card))", borderRadius: "14px",
      border: "1px solid hsl(var(--border))", overflow: "hidden",
      boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
    }}>
      <div style={{ padding: "20px", borderBottom: "1px solid hsl(var(--border))" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 700, color: "hsl(var(--foreground))", margin: 0, letterSpacing: "0.5px" }}>
            TOPOLOGY
          </h2>
          <div style={{ display: "flex", gap: "8px" }}>
            <span style={{
              backgroundColor: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))",
              fontSize: "11px", fontWeight: 600, padding: "2px 10px", borderRadius: "6px", letterSpacing: "0.3px",
            }}>{computedNodes.length} agents</span>
            <span style={{
              backgroundColor: "hsl(var(--background-muted))", color: "hsl(var(--foreground-secondary))",
              fontSize: "11px", fontWeight: 600, padding: "2px 10px", borderRadius: "6px", letterSpacing: "0.3px",
            }}>{computedEdges.length} links</span>
          </div>
        </div>
      </div>
      <div style={{ height: "600px" }}>
        <ReactFlow nodes={computedNodes} edges={computedEdges} onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange} onConnect={onConnect} fitView>
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="hsl(var(--border) / 0.3)" />
          <Controls style={{ background: "hsl(var(--background-card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
          <MiniMap
            nodeColor={(node) => {
              const status = (node.data as any)?.status || "online"
              switch (status.toLowerCase()) {
                case "online": return "hsl(var(--status-online))"
                case "offline": return "hsl(var(--foreground-muted))"
                case "busy": return "hsl(var(--status-busy))"
                default: return "hsl(var(--status-online))"
              }
            }}
            maskColor="hsl(var(--background-page) / 0.8)"
            style={{ background: "hsl(var(--background-card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
          />
        </ReactFlow>
      </div>
    </div>
  )
}
