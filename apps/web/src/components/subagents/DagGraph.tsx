'use client'

import * as React from 'react'
import type { DagDefinition, AgentRole } from '@ihui/shared/subagents/index'

const NODE_WIDTH = 180
const NODE_HEIGHT = 64
const H_GAP = 80
const V_GAP = 28

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

interface DagGraphProps {
  dag: DagDefinition | undefined
  className?: string
}

/** 简单分层布局:入度 0 → level 0,其余 level = max(前驱) + 1 */
function layout(dag: DagDefinition): {
  positions: Map<string, { x: number; y: number; level: number }>
  width: number
  height: number
} {
  const { nodes, edges } = dag
  const levelMap = new Map<string, number>()
  const inDeg = new Map<string, number>()
  const adj = new Map<string, string[]>()

  for (const n of nodes) {
    levelMap.set(n.id, 0)
    inDeg.set(n.id, 0)
    adj.set(n.id, [])
  }
  for (const e of edges) {
    if (!adj.has(e.from) || !inDeg.has(e.to)) continue
    adj.get(e.from)!.push(e.to)
    inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1)
  }

  // 拓扑 BFS 计算层级
  const queue: string[] = []
  for (const n of nodes) {
    if ((inDeg.get(n.id) ?? 0) === 0) queue.push(n.id)
  }
  const visited = new Set<string>()
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (visited.has(cur)) continue
    visited.add(cur)
    for (const next of adj.get(cur) ?? []) {
      const newLevel = (levelMap.get(cur) ?? 0) + 1
      if (newLevel > (levelMap.get(next) ?? 0)) levelMap.set(next, newLevel)
      queue.push(next)
    }
  }

  // 按 level 分组
  const byLevel = new Map<number, string[]>()
  for (const n of nodes) {
    const lv = levelMap.get(n.id) ?? 0
    if (!byLevel.has(lv)) byLevel.set(lv, [])
    byLevel.get(lv)!.push(n.id)
  }

  const positions = new Map<string, { x: number; y: number; level: number }>()
  const maxLevel = Math.max(0, ...Array.from(byLevel.keys()))
  let maxColSize = 1
  for (const [lv, ids] of byLevel) {
    maxColSize = Math.max(maxColSize, ids.length)
    ids.forEach((id, idx) => {
      positions.set(id, {
        x: 20 + lv * (NODE_WIDTH + H_GAP),
        y: 20 + idx * (NODE_HEIGHT + V_GAP),
        level: lv,
      })
    })
  }

  return {
    positions,
    width: 20 + (maxLevel + 1) * (NODE_WIDTH + H_GAP),
    height: 20 + maxColSize * (NODE_HEIGHT + V_GAP),
  }
}

export function DagGraph({ dag, className }: DagGraphProps) {
  if (!dag || dag.nodes.length === 0) {
    return (
      <div className={`flex items-center justify-center py-10 text-sm text-muted-foreground ${className ?? ''}`}>
        无 DAG 配置
      </div>
    )
  }

  const { positions, width, height } = layout(dag)

  return (
    <div className={`overflow-auto rounded-md border bg-background ${className ?? ''}`}>
      <svg width={width} height={height} role="img" aria-label="DAG 可视化">
        <defs>
          <marker
            id="dag-arrow"
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

        {dag.edges.map((edge, i) => {
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
                markerEnd="url(#dag-arrow)"
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

        {dag.nodes.map((node) => {
          const pos = positions.get(node.id)
          if (!pos) return null
          const fill = ROLE_FILL[node.agentRole]
          const stroke = ROLE_STROKE[node.agentRole]
          const textColor = ROLE_TEXT[node.agentRole]
          return (
            <g key={node.id}>
              <rect
                x={pos.x}
                y={pos.y}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx="6"
                ry="6"
                fill={fill}
                stroke={stroke}
                strokeWidth="1.5"
              />
              <text x={pos.x + 8} y={pos.y + 18} fontSize="11" fontWeight="600" fill={textColor}>
                {node.id}
              </text>
              <text x={pos.x + 8} y={pos.y + 34} fontSize="10" fill={textColor}>
                {ROLE_LABEL[node.agentRole]}
              </text>
              <text x={pos.x + 8} y={pos.y + 50} fontSize="10" fill={textColor}>
                {node.task.length > 22 ? `${node.task.slice(0, 22)}…` : node.task}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export { ROLE_LABEL as DAG_ROLE_LABEL }
