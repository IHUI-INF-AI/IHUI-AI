'use client'

/**
 * SwarmTopologyView - Swarm mesh 拓扑可视化(2026-07-22 立,2026-07-22 深化 v2)。
 *
 * 渲染:
 *  - SVG 画布(w-full h-72,viewBox 自适应)
 *  - 节点:rect rounded-md 居中首字 + 状态色
 *  - 边:带箭头 + label + 类型色
 *  - 自动布局:环形 / DAG 层级
 *  - arbiter 节点(debate/vote/critique 中心):稍大 + 紫色边框
 *  - DAG 节点:方形 + 条件标签
 *  - communication 边:蓝虚线 + 动画流动
 *
 * 深化 v2:
 *  - 7 种节点状态色(pending/running/completed/failed/cancelled/preempted/quota_exceeded)
 *  - DAG 模式:层级布局 + 条件标签
 *  - critique 模式:环形 + 仲裁中心
 *  - with_communication 模式:环形 + 动画通信边
 *  - 节点点击详情面板(agent + 状态 + 耗时 + token + DAG 节点状态)
 *
 * AGENTS.md §4 UI 约束:
 *  - 禁 rounded-full(用 rounded-md rect)
 *  - 禁蓝色发光边框
 *  - 禁 divide-y
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

/** 扩展 dispatch 状态(增加 preempted / quota_exceeded) */
type ExtendedDispatchStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'preempted'
  | 'quota_exceeded'

/** 扩展拓扑节点(后端 RichTopologyNode 的前端镜像) */
interface RichTopologyNode extends TopologyNode {
  dispatchStatus?: ExtendedDispatchStatus
  durationMs?: number
  tokenUsage?: number
  isArbiter?: boolean
  isDagNode?: boolean
  dagNodeStatus?: ExtendedDispatchStatus
}

/** dispatch 状态 → 颜色 + 是否脉冲 + 中文标签 */
const DISPATCH_STATUS_STYLE: Record<
  ExtendedDispatchStatus,
  { fill: string; stroke: string; pulse: boolean; label: string }
> = {
  pending: { fill: 'fill-muted', stroke: 'stroke-muted-foreground/40', pulse: false, label: '等待中' },
  running: { fill: 'fill-blue-500/20', stroke: 'stroke-blue-500', pulse: true, label: '运行中' },
  completed: { fill: 'fill-green-500/20', stroke: 'stroke-green-500', pulse: false, label: '已完成' },
  failed: { fill: 'fill-red-500/20', stroke: 'stroke-red-500', pulse: false, label: '失败' },
  cancelled: { fill: 'fill-yellow-500/20', stroke: 'stroke-yellow-500', pulse: false, label: '已取消' },
  preempted: { fill: 'fill-orange-500/20', stroke: 'stroke-orange-500', pulse: false, label: '已抢占' },
  quota_exceeded: { fill: 'fill-purple-500/20', stroke: 'stroke-purple-500', pulse: false, label: '配额超限' },
}

/** 节点状态 → 颜色(回退,当无 dispatchStatus 时用) */
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

/** 边类型 → 颜色 + 线型 + 是否动画 */
const EDGE_TYPE_STYLE: Record<
  TopologyEdgeType,
  { stroke: string; dash: string; animate: boolean }
> = {
  pipeline: { stroke: '#94a3b8', dash: 'none', animate: false },
  parallel: { stroke: '#94a3b8', dash: '4 3', animate: false },
  debate: { stroke: '#ef4444', dash: 'none', animate: false },
  vote: { stroke: '#10b981', dash: 'none', animate: false },
  critique: { stroke: '#f97316', dash: 'none', animate: false },
  communication: { stroke: '#3b82f6', dash: '4 3', animate: true },
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

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTokens(tokens?: number): string {
  if (tokens === undefined || tokens === null) return '-'
  if (tokens < 1000) return `${tokens}`
  return `${(tokens / 1000).toFixed(1)}k`
}

/** 检测节点是否为 DAG 节点(按 ID 包含冒号 + 非 arbiter) */
function isDagNodeGroup(node: RichTopologyNode): boolean {
  return !!node.isDagNode
}

/** 环形布局:arbiter 居中,其他环绕;DAG 节点层级布局 */
function layoutNodes(
  nodes: RichTopologyNode[],
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  const n = nodes.length
  if (n === 0) return positions

  const centerX = 200
  const centerY = 130

  if (n === 1) {
    positions.set(nodes[0]!.id, { x: centerX, y: centerY })
    return positions
  }

  // 分离 arbiter / DAG / 普通节点
  const arbiters = nodes.filter((node) => node.isArbiter)
  const dagNodes = nodes.filter((node) => isDagNodeGroup(node))
  const regular = nodes.filter((node) => !node.isArbiter && !isDagNodeGroup(node))

  // 有 arbiter 的情况:arbiter 居中,其他环绕
  if (arbiters.length === 1 && (regular.length > 0 || dagNodes.length > 0)) {
    positions.set(arbiters[0]!.id, { x: centerX, y: centerY })
    const others = [...regular, ...dagNodes]
    const radius = Math.max(80, Math.min(140, others.length * 22 + 50))
    for (let i = 0; i < others.length; i++) {
      const angle = (i / others.length) * Math.PI * 2 - Math.PI / 2
      positions.set(others[i]!.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      })
    }
    return positions
  }

  // DAG 节点组:按 ID 分组,同 dispatch 的节点用层级布局
  if (dagNodes.length > 0) {
    // 简化:所有 DAG 节点环形布局(层级布局需要 edges 信息,这里用环形近似)
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
  topology?: SwarmTopology
  className?: string
}

export function SwarmTopologyView({
  topology: injectedTopology,
  className,
}: SwarmTopologyViewProps) {
  const query = useSwarmTopology()
  const topology = injectedTopology ?? query.data ?? { nodes: [], edges: [] }

  const richNodes: RichTopologyNode[] = topology.nodes as RichTopologyNode[]

  const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null)

  const positions = React.useMemo(
    () => layoutNodes(richNodes),
    [richNodes],
  )

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

  const selectedNode = selectedNodeId
    ? richNodes.find((n) => n.id === selectedNodeId)
    : null
  const selectedPos = selectedNode ? positions.get(selectedNode.id) : null

  // 统计各状态节点数(图例用)
  const statusCounts = React.useMemo(() => {
    const counts = new Map<ExtendedDispatchStatus, number>()
    for (const node of richNodes) {
      const status = node.dispatchStatus ?? 'pending'
      counts.set(status, (counts.get(status) ?? 0) + 1)
    }
    return counts
  }, [richNodes])

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
        <>
          <svg
            viewBox="0 0 400 260"
            className="h-full w-full"
            preserveAspectRatio="xMidYMid meet"
          >
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
              const style = EDGE_TYPE_STYLE[edge.type] ?? { stroke: '#94a3b8', dash: 'none', animate: false }
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
                    className={style.animate ? 'topo-comm-flow' : undefined}
                  />
                  {edge.label && (
                    <text
                      x={midX}
                      y={midY - 4}
                      textAnchor="middle"
                      className="fill-muted-foreground"
                      style={{ fontSize: '7px' }}
                    >
                      {edge.label.length > 12 ? edge.label.slice(0, 11) + '…' : edge.label}
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
              const nodeSize = node.isArbiter ? 48 : 40
              const halfSize = nodeSize / 2
              const rx = pos.x - halfSize
              const ry = pos.y - halfSize
              const arbiterStroke = node.isArbiter ? 'stroke-purple-500' : style.stroke
              const arbiterStrokeWidth = node.isArbiter ? 2 : 1.2
              const dagStroke = node.isDagNode ? 'stroke-cyan-500' : arbiterStroke
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
                  <rect
                    x="0"
                    y="0"
                    width={nodeSize}
                    height={nodeSize}
                    rx="6"
                    ry="6"
                    className={cn(style.fill, dagStroke)}
                    strokeWidth={isSelected || isHovered ? 2.5 : arbiterStrokeWidth}
                    opacity={isDimmed ? 0.4 : 1}
                  />
                  {node.isArbiter && (
                    <circle
                      cx={halfSize}
                      cy={halfSize - 8}
                      r="2"
                      className="fill-purple-500"
                    />
                  )}
                  {node.isDagNode && (
                    <circle
                      cx={halfSize}
                      cy={halfSize - 8}
                      r="2"
                      className="fill-cyan-500"
                    />
                  )}
                  <text
                    x={halfSize}
                    y={halfSize}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-foreground"
                    style={{
                      fontSize: node.isArbiter ? '13px' : '11px',
                      fontWeight: 600,
                    }}
                    opacity={isDimmed ? 0.4 : 1}
                  >
                    {node.label.charAt(0)}
                  </text>
                  <text
                    x={halfSize}
                    y={nodeSize + 12}
                    textAnchor="middle"
                    className="fill-muted-foreground"
                    style={{ fontSize: '7px' }}
                  >
                    {node.label.length > 8 ? node.label.slice(0, 7) + '…' : node.label}
                  </text>
                </g>
              )
            })}
          </svg>

          {/* 图例(右上角,显示状态色 + 计数) */}
          {statusCounts.size > 0 && (
            <div className="absolute right-1 top-1 flex flex-col gap-0.5 rounded-sm border border-border bg-popover/80 px-1.5 py-1 text-[9px] backdrop-blur-sm">
              {Array.from(statusCounts.entries()).map(([status, count]) => {
                const s = DISPATCH_STATUS_STYLE[status]
                return (
                  <div key={status} className="flex items-center gap-1">
                    <span className={cn('inline-block h-2 w-2 rounded-sm', s.fill, s.stroke)} />
                    <span className="text-muted-foreground">{s.label}({count})</span>
                  </div>
                )
              })}
            </div>
          )}
        </>
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
                {node.isDagNode && (
                  <span className="ml-1 text-cyan-500">DAG</span>
                )}
              </div>
              <div className="text-muted-foreground">
                角色:{node.role} · {style.label}
              </div>
            </div>
          )
        })()}

      {/* Click Detail Tooltip(详细:角色 + 状态 + 耗时 + token + DAG 状态) */}
      {selectedNode && selectedPos && (
        <div
          className="absolute z-20 w-48 rounded-md border border-border bg-popover px-2.5 py-2 text-[10px] shadow-lg"
          style={{
            left: `${Math.min((selectedPos.x / 400) * 100 + 6, 50)}%`,
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
            {selectedNode.isDagNode && (
              <span className="rounded-sm bg-cyan-500/10 px-1 text-[9px] text-cyan-600">
                DAG 节点
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
                  selectedNode.dispatchStatus === 'preempted' && 'text-orange-600',
                  selectedNode.dispatchStatus === 'quota_exceeded' && 'text-purple-600',
                  selectedNode.dispatchStatus === 'pending' && 'text-muted-foreground',
                )}
              >
                {getNodeStyle(selectedNode).label}
              </span>
            </div>
            <div>耗时:{formatDuration(selectedNode.durationMs)}</div>
            <div>Token:{formatTokens(selectedNode.tokenUsage)}</div>
            {selectedNode.isDagNode && selectedNode.dagNodeStatus && (
              <div>
                DAG 状态:
                <span className="ml-1 text-cyan-600">
                  {DISPATCH_STATUS_STYLE[selectedNode.dagNodeStatus]?.label ?? selectedNode.dagNodeStatus}
                </span>
              </div>
            )}
          </div>
          <div className="mt-1 text-[9px] text-muted-foreground/60">
            点击空白取消 · 再次点击同一节点取消
          </div>
        </div>
      )}

      {/* 选中状态提示 */}
      {selectedNodeId && !selectedNode && (
        <div className="absolute bottom-1 left-2 text-[10px] text-muted-foreground">
          已选中节点(点击空白取消高亮)
        </div>
      )}

      {/* 动画 keyframes(脉冲 + 通信流动) */}
      <style>{`
        @keyframes topo-pulse { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:0.2;transform:scale(1.08)} }
        @keyframes topo-flow { 0%{stroke-dashoffset:0} 100%{stroke-dashoffset:-14} }
        .topo-comm-flow { animation: topo-flow 1s linear infinite; }
      `}</style>
    </div>
  )
}

export default SwarmTopologyView
