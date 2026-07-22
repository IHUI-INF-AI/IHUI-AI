'use client'

/**
 * SwarmTopologyView - Swarm mesh 拓扑可视化(2026-07-22 立,2026-07-22 深化)。
 *
 * 渲染:
 *  - SVG 画布(w-full h-72,viewBox 自适应)
 *  - 节点:rect rounded-md 居中首字 + 状态色(pending 灰/running 蓝+脉冲/completed 绿/failed 红/cancelled 黄)
 *  - 边:带箭头 + label + 类型色(pipeline 灰实线/parallel 灰虚线/debate 红/vote 绿/critique 橙/communication 蓝虚线)
 *  - 自动布局:环形(简化 force-directed,节点间距 ≥80px)
 *  - arbiter 节点(debate/vote 中心):稍大 + 紫色边框
 *  - hover 节点:简略 tooltip(agent name + role + status)
 *  - 点击节点:详细 tooltip(agent 角色 + 状态 + 耗时 + token)
 *  - 点击节点:高亮其所有边
 *
 * 深化:
 *  - 节点状态色基于 dispatchStatus(pending/running/completed/failed/cancelled)
 *  - 仲裁节点(isArbiter)居中渲染 + 紫色描边
 *  - 点击 tooltip 显示 durationMs + tokenUsage
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

/** dispatch 状态(用于精确颜色映射,从后端 RichTopologyNode 传入) */
type DispatchStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/** 扩展拓扑节点(后端 RichTopologyNode 的前端镜像,携带 dispatchStatus + 资源统计 + 仲裁标记) */
interface RichTopologyNode extends TopologyNode {
  dispatchStatus?: DispatchStatus
  durationMs?: number
  tokenUsage?: number
  isArbiter?: boolean
}

/** dispatch 状态 → 颜色 + 是否脉冲(优先于 TopologyNodeStatus) */
const DISPATCH_STATUS_STYLE: Record<
  DispatchStatus,
  { fill: string; stroke: string; pulse: boolean; label: string }
> = {
  pending: { fill: 'fill-muted', stroke: 'stroke-muted-foreground/40', pulse: false, label: '等待中' },
  running: { fill: 'fill-blue-500/20', stroke: 'stroke-blue-500', pulse: true, label: '运行中' },
  completed: { fill: 'fill-green-500/20', stroke: 'stroke-green-500', pulse: false, label: '已完成' },
  failed: { fill: 'fill-red-500/20', stroke: 'stroke-red-500', pulse: false, label: '失败' },
  cancelled: { fill: 'fill-yellow-500/20', stroke: 'stroke-yellow-500', pulse: false, label: '已取消' },
}

/** 节点状态 → 颜色 + 是否脉冲(回退,当无 dispatchStatus 时用) */
const NODE_STATUS_STYLE: Record<
  TopologyNodeStatus,
  { fill: string; stroke: string; pulse: boolean; label: string }
> = {
  idle: { fill: 'fill-muted', stroke: 'stroke-muted-foreground/40', pulse: false, label: '空闲' },
  running: { fill: 'fill-blue-500/20', stroke: 'stroke-blue-500', pulse: true, label: '运行中' },
  waiting: { fill: 'fill-muted', stroke: 'stroke-muted-foreground/40', pulse: false, label: '等待中' },
  completed: { fill: 'fill-green-500/20', stroke: 'stroke-green-500', pulse: false, label: '已完成' },
  failed: { fill: 'fill-red-500/20', stroke: 'stroke-red-500', pulse: false, label: '失败' },
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

/** 获取节点样式(优先 dispatchStatus,回退 TopologyNodeStatus) */
function getNodeStyle(node: RichTopologyNode): {
  fill: string
  stroke: string
  pulse: boolean
  label: string
} {
  if (node.dispatchStatus) {
    return DISPATCH_STATUS_STYLE[node.dispatchStatus]
  }
  return NODE_STATUS_STYLE[node.status]
}

/** 格式化耗时 */
function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/** 格式化 token 数 */
function formatTokens(tokens?: number): string {
  if (tokens === undefined || tokens === null) return '-'
  if (tokens < 1000) return `${tokens}`
  return `${(tokens / 1000).toFixed(1)}k`
}

/** 环形布局:把节点均匀分布在圆周上,半径按节点数自适应 */
function layoutNodes(
  nodes: RichTopologyNode[],
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  const n = nodes.length
  if (n === 0) return positions

  // 分离 arbiter 和普通节点
  const arbiters = nodes.filter((node) => node.isArbiter)
  const regular = nodes.filter((node) => !node.isArbiter)

  const centerX = 200
  const centerY = 130

  // 单节点:居中
  if (n === 1) {
    positions.set(nodes[0]!.id, { x: centerX, y: centerY })
    return positions
  }

  // 有 arbiter 的情况:arbiter 居中,其他节点环绕
  if (arbiters.length === 1 && regular.length > 0) {
    // arbiter 居中
    positions.set(arbiters[0]!.id, { x: centerX, y: centerY })
    // 普通节点环绕
    const radius = Math.max(80, Math.min(140, regular.length * 22 + 50))
    for (let i = 0; i < regular.length; i++) {
      const angle = (i / regular.length) * Math.PI * 2 - Math.PI / 2
      positions.set(regular[i]!.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      })
    }
    return positions
  }

  // 无 arbiter 或多个 arbiter:所有节点环形布局
  const radius = Math.max(80, Math.min(140, (n - 1) * 25 + 60))
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2
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

  // 将 nodes 转为 RichTopologyNode(运行时携带额外字段)
  const richNodes: RichTopologyNode[] = topology.nodes as RichTopologyNode[]

  const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null)

  const positions = React.useMemo(
    () => layoutNodes(richNodes),
    [richNodes],
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

  const isEmpty = richNodes.length === 0

  // 选中节点的详细信息(点击 tooltip)
  const selectedNode = selectedNodeId
    ? richNodes.find((n) => n.id === selectedNodeId)
    : null
  const selectedPos = selectedNode ? positions.get(selectedNode.id) : null

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
            const offset = 22
            const x1 = from.x + (dx / dist) * offset
            const y1 = from.y + (dy / dist) * offset
            const x2 = to.x - (dx / dist) * offset
            const y2 = to.y - (dy / dist) * offset
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
          {richNodes.map((node: RichTopologyNode) => {
            const pos = positions.get(node.id)
            if (!pos) return null
            const style = getNodeStyle(node)
            const isSelected = selectedNodeId === node.id
            const isHovered = hoveredNodeId === node.id
            const isDimmed = highlightNodeId && highlightNodeId !== node.id
            // arbiter 节点稍大(48x48)+ 紫色描边
            const nodeSize = node.isArbiter ? 48 : 40
            const halfSize = nodeSize / 2
            const rx = pos.x - halfSize
            const ry = pos.y - halfSize
            const arbiterStroke = node.isArbiter ? 'stroke-purple-500' : style.stroke
            const arbiterStrokeWidth = node.isArbiter ? 2 : 1.2
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
                    width={nodeSize + 6}
                    height={nodeSize + 6}
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
                  width={nodeSize}
                  height={nodeSize}
                  rx="6"
                  ry="6"
                  className={cn(style.fill, arbiterStroke)}
                  strokeWidth={isSelected || isHovered ? 2.5 : arbiterStrokeWidth}
                  opacity={isDimmed ? 0.4 : 1}
                />
                {/* arbiter 标记(中心点) */}
                {node.isArbiter && (
                  <circle
                    cx={halfSize}
                    cy={halfSize - 8}
                    r="2"
                    className="fill-purple-500"
                  />
                )}
                {/* 节点首字(label 第一个字符) */}
                <text
                  x={halfSize}
                  y={halfSize}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-foreground text-[11px] font-medium"
                  style={{
                    fontSize: node.isArbiter ? '13px' : '11px',
                    fontWeight: 600,
                  }}
                  opacity={isDimmed ? 0.4 : 1}
                >
                  {node.label.charAt(0)}
                </text>
                {/* 节点名(label 全文,放在 rect 下方) */}
                <text
                  x={halfSize}
                  y={nodeSize + 12}
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

      {/* Hover Tooltip(简略) */}
      {hoveredNodeId &&
        !selectedNodeId &&
        richNodes.find((n: RichTopologyNode) => n.id === hoveredNodeId) &&
        (() => {
          const node = richNodes.find(
            (n: RichTopologyNode) => n.id === hoveredNodeId,
          )!
          const pos = positions.get(node.id)
          if (!pos) return null
          const leftPct = (pos.x / 400) * 100
          const topPct = (pos.y / 260) * 100
          const style = getNodeStyle(node)
          return (
            <div
              className="pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-2 py-1 text-[10px] shadow-md"
              style={{
                left: `${Math.min(leftPct + 6, 70)}%`,
                top: `${Math.max(topPct - 12, 0)}%`,
              }}
            >
              <div className="font-medium text-foreground">
                {node.label}
                {node.isArbiter && (
                  <span className="ml-1 text-purple-500">仲裁</span>
                )}
              </div>
              <div className="text-muted-foreground">
                角色:{node.role} · {style.label}
              </div>
            </div>
          )
        })()}

      {/* Click Detail Tooltip(详细:角色 + 状态 + 耗时 + token) */}
      {selectedNode && selectedPos && (
        <div
          className="absolute z-20 w-44 rounded-md border border-border bg-popover px-2.5 py-2 text-[10px] shadow-lg"
          style={{
            left: `${Math.min((selectedPos.x / 400) * 100 + 6, 55)}%`,
            top: `${Math.max((selectedPos.y / 260) * 100 - 10, 0)}%`,
          }}
        >
          <div className="mb-1 flex items-center gap-1 font-medium text-foreground">
            <span>{selectedNode.label}</span>
            {selectedNode.isArbiter && (
              <span className="rounded-sm bg-purple-500/10 px-1 text-[9px] text-purple-600">
                仲裁节点
              </span>
            )}
          </div>
          <div className="space-y-0.5 text-muted-foreground">
            <div>角色:{selectedNode.role}</div>
            <div>
              状态:
              <span
                className={cn(
                  'ml-1 font-medium',
                  selectedNode.dispatchStatus === 'completed' && 'text-green-600',
                  selectedNode.dispatchStatus === 'running' && 'text-blue-600',
                  selectedNode.dispatchStatus === 'failed' && 'text-red-600',
                  selectedNode.dispatchStatus === 'cancelled' && 'text-yellow-600',
                  selectedNode.dispatchStatus === 'pending' && 'text-muted-foreground',
                )}
              >
                {getNodeStyle(selectedNode).label}
              </span>
            </div>
            <div>耗时:{formatDuration(selectedNode.durationMs)}</div>
            <div>Token:{formatTokens(selectedNode.tokenUsage)}</div>
          </div>
          <div className="mt-1 text-[9px] text-muted-foreground/60">
            点击空白取消 · 再次点击同一节点取消
          </div>
        </div>
      )}

      {/* 选中状态提示 */}
      {selectedNodeId && !selectedNode && (
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
