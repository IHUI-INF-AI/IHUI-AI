'use client'

import * as React from 'react'
import type { SwarmTopology, AgentRole, DispatchStatus } from '@ihui/shared/subagents/index'

const NODE_WIDTH = 160
const NODE_HEIGHT = 56
const GAP_X = 100
const GAP_Y = 40

const ROLE_FILL: Record<AgentRole, string> = {
  researcher: '#e0e7ff',
  coder: '#d1fae5',
  reviewer: '#fef3c7',
  architect: '#ede9fe',
  debugger: '#ffe4e6',
}
const ROLE_STROKE: Record<AgentRole, string> = {
  researcher: '#6366f1',
  coder: '#10b981',
  reviewer: '#f59e0b',
  architect: '#8b5cf6',
  debugger: '#f43f5e',
}
const ROLE_TEXT: Record<AgentRole, string> = {
  researcher: '#3730a3',
  coder: '#065f46',
  reviewer: '#92400e',
  architect: '#5b21b6',
  debugger: '#9f1239',
}
const ROLE_LABEL: Record<AgentRole, string> = {
  researcher: '研究员',
  coder: '编码员',
  reviewer: '评审员',
  architect: '架构师',
  debugger: '调试员',
}

const STATUS_DOT: Record<DispatchStatus, string> = {
  pending: '#94a3b8',
  running: '#3b82f6',
  completed: '#10b981',
  failed: '#f43f5e',
  cancelled: '#94a3b8',
  paused: '#f59e0b',
}
const STATUS_LABEL: Record<DispatchStatus, string> = {
  pending: '等待',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
  paused: '已暂停',
}

interface SwarmTopologyViewProps {
  topology: SwarmTopology | undefined
  className?: string
}

/** Swarm 网格布局:按 agentRole 分列,每列垂直堆叠 */
function layout(topology: SwarmTopology): {
  positions: Map<string, { x: number; y: number }>
  width: number
  height: number
} {
  const { nodes } = topology
  const byRole = new Map<AgentRole, string[]>()
  for (const n of nodes) {
    if (!byRole.has(n.agentRole)) byRole.set(n.agentRole, [])
    byRole.get(n.agentRole)!.push(n.id)
  }
  const roleCount = byRole.size
  const positions = new Map<string, { x: number; y: number }>()
  let maxCol = 1
  Array.from(byRole.entries()).forEach(([, ids], roleIdx) => {
    maxCol = Math.max(maxCol, ids.length)
    ids.forEach((id, i) => {
      positions.set(id, {
        x: 30 + roleIdx * (NODE_WIDTH + GAP_X),
        y: 40 + i * (NODE_HEIGHT + GAP_Y),
      })
    })
  })
  return {
    positions,
    width: 30 + roleCount * (NODE_WIDTH + GAP_X),
    height: 40 + maxCol * (NODE_HEIGHT + GAP_Y),
  }
}

export function SwarmTopologyView({ topology, className }: SwarmTopologyViewProps) {
  if (!topology || topology.nodes.length === 0) {
    return (
      <div className={`flex items-center justify-center py-10 text-sm text-muted-foreground ${className ?? ''}`}>
        Swarm 拓扑为空
      </div>
    )
  }

  const { positions, width, height } = layout(topology)

  return (
    <div className={`overflow-auto rounded-md border bg-background ${className ?? ''}`}>
      <svg width={width} height={height} role="img" aria-label="Swarm 拓扑可视化">
        <defs>
          <marker
            id="swarm-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
          </marker>
        </defs>

        {topology.edges.map((edge, i) => {
          const from = positions.get(edge.from)
          const to = positions.get(edge.to)
          if (!from || !to) return null
          const x1 = from.x + NODE_WIDTH
          const y1 = from.y + NODE_HEIGHT / 2
          const x2 = to.x
          const y2 = to.y + NODE_HEIGHT / 2
          const mx = (x1 + x2) / 2
          return (
            <g key={`edge-${i}`}>
              <path
                d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="1.5"
                markerEnd="url(#swarm-arrow)"
              />
              {edge.condition && (
                <text
                  x={mx}
                  y={(y1 + y2) / 2 - 4}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#64748b"
                >
                  {edge.condition}
                </text>
              )}
            </g>
          )
        })}

        {topology.nodes.map((node) => {
          const pos = positions.get(node.id)
          if (!pos) return null
          const fill = ROLE_FILL[node.agentRole]
          const stroke = ROLE_STROKE[node.agentRole]
          const textColor = ROLE_TEXT[node.agentRole]
          const dot = STATUS_DOT[node.status]
          return (
            <g key={node.id}>
              <rect
                x={pos.x}
                y={pos.y}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx="8"
                ry="8"
                fill={fill}
                stroke={stroke}
                strokeWidth="1.5"
              />
              <circle cx={pos.x + 10} cy={pos.y + 12} r="3" fill={dot} />
              <text x={pos.x + 18} y={pos.y + 16} fontSize="11" fontWeight="600" fill={textColor}>
                {node.id}
              </text>
              <text x={pos.x + 8} y={pos.y + 32} fontSize="10" fill={textColor}>
                {ROLE_LABEL[node.agentRole]} · {STATUS_LABEL[node.status]}
              </text>
              <text x={pos.x + 8} y={pos.y + 46} fontSize="10" fill={textColor}>
                {node.task.length > 20 ? `${node.task.slice(0, 20)}…` : node.task}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export { ROLE_LABEL as SWARM_ROLE_LABEL, STATUS_LABEL as SWARM_STATUS_LABEL }
