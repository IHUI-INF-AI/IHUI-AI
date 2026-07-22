'use client'

/**
 * SwarmTopologyView - Swarm mesh 拓扑可视化(2026-07-22 立)。
 *
 * 渲染:
 *  - SVG 画布(w-full h-72,viewBox 自适应)
 *  - 节点:rect rounded-md w-10 h-10 居中首字 + 状态色(idle 灰/running 蓝+脉冲/waiting 黄/completed 绿/failed 红)
 *  - 边:带箭头 + label + 类型色(pipeline 灰实线/parallel 灰虚线/debate 红/vote 绿/critique 橙/communication 蓝虚线)
 *  - 自动布局:环形(简化 force-directed,节点间距 ≥80px)
 *  - hover 节点:tooltip(agent name + role + status)
 *  - 点击节点:高亮其所有边
 *
 * 数据来源:useSwarmTopology hook(5s 轮询 /api/subagents/topology)
 *
 * AGENTS.md §4 UI 约束:
 *  - 禁 rounded-full(用 rounded-md rect)
 *  - 禁蓝色发光边框
 *  - 紧凑 w-full h-72 rounded-md border border-border bg-card
 */

import * as React from 'react'
import { useSwarmTopology } from '@/hooks/use-subagent-dispatch'
import { cn } from '@/lib/utils'
import type {
  SwarmTopology,
  TopologyNode,
  TopologyEdge,
  TopologyNodeStatus,
  TopologyEdgeType,
} from '@ihui/types/subagent-dispatch'

/** 节点状态 → 颜色 + 是否脉冲 */
const NODE_STATUS_STYLE: Record<
  TopologyNodeStatus,
  { fill: string; stroke: string; pulse: boolean }
> = {
  idle: { fill: 'fill-muted', stroke: 'stroke-muted-foreground/40', pulse: false },
  running: { fill: 'fill-blue-500/20', stroke: 'stroke-blue-500', pulse: true },
  waiting: { fill: 'fill-amber-500/15', stroke: 'stroke-amber-500', pulse: false },
  completed: { fill: 'fill-emerald-500/20', stroke: 'stroke-emerald-500', pulse: false },
  failed: { fill: 'fill-red-500/20', stroke: 'stroke-red-500', pulse: false },
}

/** 边类型 → 颜色 + 线型 */
const EDGE_TYPE_STYLE: Record<
  TopologyEdgeType,
  { stroke: string; dash: string }
> = {
  pipeline: { stroke: '#94a3b8', dash: 'none' }, // 灰实线
  parallel: { stroke: '#94a3b8', dash: '4 3' }, // 灰虚线
  debate: { stroke: '#ef4444', dash: 'none' }, // 红实线
  vote: { stroke: '#10b981', dash: 'none' }, // 绿实线
  critique: { stroke: '#f97316', dash: 'none' }, // 橙实线
  communication: { stroke: '#3b82f6', dash: '4 3' }, // 蓝虚线
}

/** 状态中文标签 */
const STATUS_LABEL: Record<TopologyNodeStatus, string> = {
  idle: '空闲',
  running: '运行中',
  waiting: '等待中',
  completed: '已完成',
  failed: '失败',
}

/** 环形布局:把节点均匀分布在圆周上,半径按节点数自适应 */
function layoutNodes(nodes: TopologyNode[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  const n = nodes.length
  if (n === 0) return positions

  // 单节点:居中
  if (n === 1) {
    positions.set(nodes[0]!.id, { x: 200, y: 130 })
    return positions
  }

  // 多节点:环形布局,半径保证节点间距 ≥80px
  const radius = Math.max(80, Math.min(140, (n - 1) * 25 + 60))
  const centerX = 200
  const centerY = 130
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2 // 从顶部开始
    positions.set(nodes[i]!.id, {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    })
  }
  return positions
}

interface SwarmTopologyViewProps {
  /** 可选外部注入拓扑(优先于 hook) */
  topology?: SwarmTopology
  /** 可选 className 覆盖 */
  className?: string
}

export function SwarmTopologyView({
  topology: injectedTopology,
  className,
}: SwarmTopologyViewProps) {
  const query = useSwarmTopology()
  const topology = injectedTopology ?? query.data ?? { nodes: [], edges: [] }

  const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null)

  const positions = React.useMemo(
    () => layoutNodes(topology.nodes),
    [topology.nodes],
  )

  // 高亮边:selected 节点的所有边 / hover 节点的所有边
  const highlightNodeId = selectedNodeId ?? hoveredNodeId
  const highlightedEdgeKeys = React.useMemo(() => {
    if (!highlightNodeId) return new Set<string>()
    return new Set(
      topology.edges
        .filter((e: TopologyEdge) => e.from === highlightNodeId || e.to === highlightNodeId)
        .map((e: TopologyEdge) => `${e.from}->${e.to}`),
    )
  }, [topology.edges, highlightNodeId])

  const isEmpty = topology.nodes.length === 0

  return (
    <div
      className={cn(
        'relative w-full h-72 overflow-hidden rounded-md border border-border bg-card',
        className,
      )}
    >
      {isEmpty ? (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          暂无活跃 Subagent 拓扑(派发后此处显示节点)
        </div>
      ) : (
        <svg
          viewBox="0 0 400 260"
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* 箭头定义 */}
          <defs>
            <marker
              id="topo-arrow-default"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-slate-400" />
            </marker>
            <marker
              id="topo-arrow-highlight"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-blue-500" />
            </marker>
          </defs>

          {/* 渲染边 */}
          {topology.edges.map((edge: TopologyEdge, i: number) => {
            const from = positions.get(edge.from)
            const to = positions.get(edge.to)
            if (!from || !to) return null
            const key = `${edge.from}->${edge.to}`
            const isHighlighted = highlightedEdgeKeys.has(key)
            const style = EDGE_TYPE_STYLE[edge.type] ?? { stroke: '#94a3b8', dash: 'none' }
            // 节点宽 40 高 40,边端点缩进到节点边缘
            const dx = to.x - from.x
            const dy = to.y - from.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const offset = 22 // 节点半径(w-10/2=20 + 2px 间隙)
            const x1 = from.x + (dx / dist) * offset
            const y1 = from.y + (dy / dist) * offset
            const x2 = to.x - (dx / dist) * offset
            const y2 = to.y - (dy / dist) * offset
            // label 中点
            const midX = (x1 + x2) / 2
            const midY = (y1 + y2) / 2
            return (
              <g key={`edge-${i}`}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={isHighlighted ? '#3b82f6' : style.stroke}
                  strokeWidth={isHighlighted ? 2 : 1.2}
                  strokeDasharray={style.dash === 'none' ? undefined : style.dash}
                  markerEnd={`url(#${isHighlighted ? 'topo-arrow-highlight' : 'topo-arrow-default'})`}
                  opacity={highlightNodeId && !isHighlighted ? 0.25 : 1}
                />
                {edge.label && (
                  <text
                    x={midX}
                    y={midY - 4}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[7px]"
                    style={{ fontSize: '7px' }}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            )
          })}

          {/* 渲染节点 */}
          {topology.nodes.map((node: TopologyNode) => {
            const pos = positions.get(node.id)
            if (!pos) return null
            const style = NODE_STATUS_STYLE[node.status] ?? { fill: 'fill-muted', stroke: 'stroke-muted-foreground/40', pulse: false }
            const isSelected = selectedNodeId === node.id
            const isHovered = hoveredNodeId === node.id
            const isDimmed = highlightNodeId && highlightNodeId !== node.id
            // rect 中心定位:x - 20, y - 20(w-10 h-10 = 40x40)
            const rx = pos.x - 20
            const ry = pos.y - 20
            return (
              <g
                key={node.id}
                transform={`translate(${rx}, ${ry})`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onClick={() =>
                  setSelectedNodeId((cur) => (cur === node.id ? null : node.id))
                }
              >
                {/* 脉冲动画外圈(running 状态) */}
                {style.pulse && (
                  <rect
                    x="-3"
                    y="-3"
                    width="46"
                    height="46"
                    rx="8"
                    className="fill-blue-500/10 stroke-blue-500/30"
                    style={{
                      animation: 'topo-pulse 1.6s ease-in-out infinite',
                    }}
                  />
                )}
                {/* 主节点 rect(rounded-md,禁 rounded-full) */}
                <rect
                  x="0"
                  y="0"
                  width="40"
                  height="40"
                  rx="6"
                  ry="6"
                  className={cn(style.fill, style.stroke)}
                  strokeWidth={isSelected || isHovered ? 2 : 1.2}
                  opacity={isDimmed ? 0.4 : 1}
                />
                {/* 节点首字(label 第一个字符) */}
                <text
                  x="20"
                  y="20"
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-foreground text-[11px] font-medium"
                  style={{ fontSize: '11px', fontWeight: 500 }}
                  opacity={isDimmed ? 0.4 : 1}
                >
                  {node.label.charAt(0)}
                </text>
                {/* 节点名(label 全文,放在 rect 下方) */}
                <text
                  x="20"
                  y="52"
                  textAnchor="middle"
                  className="fill-muted-foreground text-[7px]"
                  style={{ fontSize: '7px' }}
                >
                  {node.label.length > 8 ? node.label.slice(0, 7) + '…' : node.label}
                </text>
              </g>
            )
          })}
        </svg>
      )}

      {/* Tooltip(hover 节点时显示) */}
      {hoveredNodeId &&
        topology.nodes.find((n: TopologyNode) => n.id === hoveredNodeId) &&
        (() => {
          const node = topology.nodes.find((n: TopologyNode) => n.id === hoveredNodeId)!
          const pos = positions.get(node.id)
          if (!pos) return null
          // tooltip 定位在节点右上方(SVG 坐标 → 百分比)
          const leftPct = (pos.x / 400) * 100
          const topPct = (pos.y / 260) * 100
          return (
            <div
              className="pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-2 py-1 text-[10px] shadow-md"
              style={{
                left: `${Math.min(leftPct + 6, 70)}%`,
                top: `${Math.max(topPct - 12, 0)}%`,
              }}
            >
              <div className="font-medium text-foreground">{node.label}</div>
              <div className="text-muted-foreground">
                角色:{node.role} · {STATUS_LABEL[node.status]}
              </div>
            </div>
          )
        })()}

      {/* 选中状态提示 */}
      {selectedNodeId && (
        <div className="absolute bottom-1 left-2 text-[10px] text-muted-foreground">
          已选中节点(点击空白取消高亮)·再次点击同一节点取消
        </div>
      )}

      {/* 脉冲动画 keyframes(注入 style 标签,避免依赖 globals.css) */}
      <style>{`@keyframes topo-pulse { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:0.2;transform:scale(1.08)} }`}</style>
    </div>
  )
}

export default SwarmTopologyView
