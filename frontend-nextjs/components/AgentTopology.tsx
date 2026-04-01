"use client"

import React, { useMemo, useCallback, useState } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnConnect,
  BackgroundVariant,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

interface Agent {
  id: string
  name?: string
  type?: string
  status?: string
  skills?: unknown[]
}

interface Connection {
  agentId: string
  targetAgentId: string
}

interface AgentTopologyProps {
  agents: Agent[]
  connections: Connection[]
}

const MIN_NODE_POSITION_X = 50
const MAX_NODE_POSITION_X = 450

export default function AgentTopology({ agents, connections }: AgentTopologyProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const computedNodes = useMemo<Node[]>(() => {
    if (!agents || agents.length === 0) return []

    const maxNodeIdx = agents.length - 1

    return agents.map((agent, idx) => {
      const availablePositions = Math.ceil(maxNodeIdx / 3)
      const xPositionStart = MIN_NODE_POSITION_X

      let nodeX: number, nodeY: number

      if (maxNodeIdx < 3) {
        nodeX = xPositionStart + idx * 200
        nodeY = 20
      } else {
        const row = Math.floor(idx / availablePositions)
        nodeX = xPositionStart + (idx % availablePositions) * 200
        nodeY = row * 200
      }

      return {
        id: agent.id,
        type: "default",
        data: {
          label: (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 600 }}>{agent.name || agent.id}</div>
              {agent.type && (
                <div style={{ fontSize: "12px", color: "hsl(var(--foreground-secondary))" }}>{agent.type}</div>
              )}
            </div>
          ),
          status: agent.status,
          skills: Array.isArray(agent.skills) ? agent.skills : [],
        },
        position: {
          x: Math.min(nodeX, MAX_NODE_POSITION_X),
          y: nodeY,
        },
        style: {
          minWidth: 180,
          border: "1px solid hsl(var(--border))",
          borderRadius: 8,
          background: "hsl(var(--background-card))",
          color: "hsl(var(--foreground))",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        },
      }
    })
  }, [agents])

  const computedEdges = useMemo<Edge[]>(() => {
    if (!connections || connections.length === 0) return []

    return connections.map((c, idx) => ({
      id: `e${idx}`,
      source: c.agentId,
      target: c.targetAgentId,
      animated: true,
      style: { stroke: "hsl(var(--primary))" },
    }))
  }, [connections])

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const nodeCount = computedNodes.length
  const edgeCount = computedEdges.length

  return (
    <div style={{
      backgroundColor: "hsl(var(--background-card))",
      borderRadius: "12px",
      border: "1px solid hsl(var(--border))",
      overflow: "hidden",
    }}>
      <div style={{ padding: "20px", borderBottom: "1px solid hsl(var(--border-light))" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "hsl(var(--foreground))", margin: 0 }}>
            Agent Topology
          </h2>
          <div style={{ display: "flex", gap: "8px" }}>
            <span style={{
              backgroundColor: "hsl(var(--background-muted))",
              color: "hsl(var(--foreground-secondary))",
              fontSize: "12px",
              fontWeight: 500,
              padding: "2px 10px",
              borderRadius: "9999px",
            }}>
              {nodeCount} agents
            </span>
            <span style={{
              backgroundColor: "hsl(var(--background-muted))",
              color: "hsl(var(--foreground-secondary))",
              fontSize: "12px",
              fontWeight: 500,
              padding: "2px 10px",
              borderRadius: "9999px",
            }}>
              {edgeCount} connections
            </span>
          </div>
        </div>
      </div>
      <div style={{ height: "600px" }}>
        <ReactFlow
          nodes={computedNodes}
          edges={computedEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          <Controls />
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
          />
        </ReactFlow>
      </div>
    </div>
  )
}
