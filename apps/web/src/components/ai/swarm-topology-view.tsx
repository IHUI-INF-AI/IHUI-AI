// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * SwarmTopologyView - Swarm mesh 拓扑可视化(2026-07-22 立,2026-07-22 深化 v2,2026-07-23 超越 v3)。
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
 * 超越 v3(新增 3 个导出组件):
 *  - CollaborationStream:协作消息流(SVG 时间轴,9 种协作类型颜色区分)
 *  - TopologyRecommendation:拓扑推荐视图(LLM 推荐编排方案可视化)
 *  - EvolutionTimeline:演化时间轴(agent prompt 版本演进)
 *
 * AGENTS.md §4 UI 约束:
 *  - 禁 rounded-full(用 rounded-md rect)
 *  - 禁蓝色发光边框
 *  - 禁 divide-y
 *  - 紧凑 w-full h-72 rounded-md border border-border bg-card
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useSwarmTopology } from '@/hooks/use-subagent-dispatch'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatDateOnly } from '@/lib/date-utils'
import { PortalPanel } from '@/components/feedback/portal-panel'
import {
  CHART_TEXT_LIGHT,
  CHART_RED,
  CHART_GREEN,
  CHART_ORANGE,
  CHART_BLUE,
  rnRadius,
} from '@ihui/design-tokens'
import type {
  SwarmTopologyV2,
  TopologyNode,
  TopologyEdge,
  TopologyNodeStatus,
  TopologyEdgeType,
  OrchestrationMode,
} from '@ihui/shared/subagents'

/** 扩展 dispatch 状态(增加 preempted / quota_exceeded) */
type ExtendedDispatchStatus =
  'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'preempted' | 'quota_exceeded'

/** 扩展拓扑节点(后端 RichTopologyNode 的前端镜像) */
interface RichTopologyNode extends TopologyNode {
  dispatchStatus?: ExtendedDispatchStatus
  durationMs?: number
  tokenUsage?: number
  isArbiter?: boolean
  isDagNode?: boolean
  dagNodeStatus?: ExtendedDispatchStatus
}

/** dispatch 状态 → 颜色 + 是否脉冲(label 走 i18n,见组件内 dispatchStatusLabel) */
const DISPATCH_STATUS_STYLE: Record<
  ExtendedDispatchStatus,
  { fill: string; stroke: string; pulse: boolean }
> = {
  pending: {
    fill: 'fill-muted',
    stroke: 'stroke-muted-foreground/40',
    pulse: false,
  },
  running: { fill: 'fill-blue-500/20', stroke: 'stroke-blue-500', pulse: true },
  completed: {
    fill: 'fill-green-500/20',
    stroke: 'stroke-green-500',
    pulse: false,
  },
  failed: { fill: 'fill-red-500/20', stroke: 'stroke-red-500', pulse: false },
  cancelled: {
    fill: 'fill-yellow-500/20',
    stroke: 'stroke-yellow-500',
    pulse: false,
  },
  preempted: {
    fill: 'fill-orange-500/20',
    stroke: 'stroke-orange-500',
    pulse: false,
  },
  quota_exceeded: {
    fill: 'fill-purple-500/20',
    stroke: 'stroke-purple-500',
    pulse: false,
  },
}

/** 节点状态 → 颜色(回退,当无 dispatchStatus 时用;label 走 i18n,见组件内 nodeStatusLabel) */
const NODE_STATUS_STYLE: Record<
  TopologyNodeStatus,
  { fill: string; stroke: string; pulse: boolean }
> = {
  idle: { fill: 'fill-muted', stroke: 'stroke-muted-foreground/40', pulse: false },
  running: { fill: 'fill-blue-500/20', stroke: 'stroke-blue-500', pulse: true },
  waiting: {
    fill: 'fill-muted',
    stroke: 'stroke-muted-foreground/40',
    pulse: false,
  },
  completed: {
    fill: 'fill-green-500/20',
    stroke: 'stroke-green-500',
    pulse: false,
  },
  failed: { fill: 'fill-red-500/20', stroke: 'stroke-red-500', pulse: false },
}

/** 边类型 → 颜色 + 线型 + 是否动画 */
const EDGE_TYPE_STYLE: Record<
  TopologyEdgeType,
  { stroke: string; dash: string; animate: boolean }
> = {
  pipeline: { stroke: CHART_TEXT_LIGHT, dash: 'none', animate: false },
  parallel: { stroke: CHART_TEXT_LIGHT, dash: '4 3', animate: false },
  debate: { stroke: CHART_RED, dash: 'none', animate: false },
  vote: { stroke: CHART_GREEN, dash: 'none', animate: false },
  critique: { stroke: CHART_ORANGE, dash: 'none', animate: false },
  communication: { stroke: CHART_BLUE, dash: '4 3', animate: true },
}

/** 获取节点样式(优先 dispatchStatus,回退 TopologyNodeStatus;label 走组件内 helper) */
function getNodeStyle(node: RichTopologyNode): {
  fill: string
  stroke: string
  pulse: boolean
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
function layoutNodes(nodes: RichTopologyNode[]): Map<string, { x: number; y: number }> {
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
  topology?: SwarmTopologyV2
  className?: string
}

export function SwarmTopologyView({
  topology: injectedTopology,
  className,
}: SwarmTopologyViewProps) {
  const query = useSwarmTopology()
  const t = useTranslations('swarmTopology')
  const topology = injectedTopology ?? query.data ?? { nodes: [], edges: [] }

  const richNodes: RichTopologyNode[] = topology.nodes as RichTopologyNode[]

  const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null)

  // 节点 tooltip 锚点(SVG <g> 元素,PortalPanel 支持 Element 锚点):
  // 原 hover/详情 tooltip 用 absolute 就地渲染,被容器 overflow-hidden 裁剪
  // (2026-09-15 修复:portal 到 body + fixed 定位,统一走 PortalPanel)。
  const hoverAnchorRef = React.useRef<SVGGElement | null>(null)
  const selectedAnchorRef = React.useRef<SVGGElement | null>(null)

  const positions = React.useMemo(() => layoutNodes(richNodes), [richNodes])

  // dispatch/节点状态 → 中文 label(i18n,替代原模块级硬编码 label 字段)
  const dispatchStatusLabel = React.useMemo<Record<ExtendedDispatchStatus, string>>(
    () => ({
      pending: t('dispatchStatus.pending'),
      running: t('dispatchStatus.running'),
      completed: t('dispatchStatus.completed'),
      failed: t('dispatchStatus.failed'),
      cancelled: t('dispatchStatus.cancelled'),
      preempted: t('dispatchStatus.preempted'),
      quota_exceeded: t('dispatchStatus.quota_exceeded'),
    }),
    [t],
  )
  const nodeStatusLabel = React.useMemo<Record<TopologyNodeStatus, string>>(
    () => ({
      idle: t('nodeStatus.idle'),
      running: t('nodeStatus.running'),
      waiting: t('nodeStatus.waiting'),
      completed: t('nodeStatus.completed'),
      failed: t('nodeStatus.failed'),
    }),
    [t],
  )
  // 节点显示 label(优先 dispatchStatus,回退 nodeStatus)
  const getNodeDisplayLabel = React.useCallback(
    (node: RichTopologyNode): string => {
      if (node.dispatchStatus) {
        return dispatchStatusLabel[node.dispatchStatus] ?? node.dispatchStatus
      }
      return nodeStatusLabel[node.status] ?? node.status
    },
    [dispatchStatusLabel, nodeStatusLabel],
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

  const selectedNode = selectedNodeId ? richNodes.find((n) => n.id === selectedNodeId) : null

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
          {t('emptyState')}
        </div>
      ) : (
        <>
          <svg viewBox="0 0 400 260" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
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
              const style = EDGE_TYPE_STYLE[edge.type] ?? {
                stroke: CHART_TEXT_LIGHT,
                dash: 'none',
                animate: false,
              }
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
                    stroke={isHighlighted ? CHART_BLUE : style.stroke}
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
                  onMouseEnter={(e) => {
                    hoverAnchorRef.current = e.currentTarget
                    setHoveredNodeId(node.id)
                  }}
                  onMouseLeave={() => {
                    hoverAnchorRef.current = null
                    setHoveredNodeId(null)
                  }}
                  onClick={(e) => {
                    const isSame = selectedNodeId === node.id
                    selectedAnchorRef.current = isSame ? null : e.currentTarget
                    setSelectedNodeId(isSame ? null : node.id)
                  }}
                >
                  {style.pulse && (
                    <rect
                      x="-3"
                      y="-3"
                      width={nodeSize + 6}
                      height={nodeSize + 6}
                      rx={rnRadius.lg}
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
                    rx={rnRadius.md}
                    ry={rnRadius.md}
                    className={cn(style.fill, dagStroke)}
                    strokeWidth={isSelected || isHovered ? 2.5 : arbiterStrokeWidth}
                    opacity={isDimmed ? 0.4 : 1}
                  />
                  {node.isArbiter && (
                    <circle cx={halfSize} cy={halfSize - 8} r="2" className="fill-purple-500" />
                  )}
                  {node.isDagNode && (
                    <circle cx={halfSize} cy={halfSize - 8} r="2" className="fill-cyan-500" />
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
                    <span className="text-muted-foreground">
                      {dispatchStatusLabel[status] ?? status}({count})
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Hover Tooltip(简略)— PortalPanel 统一浮层(原 absolute 就地渲染被容器
          overflow-hidden 裁剪,现 portal 到 body + fixed 定位,pointer-events-none
          避免挡住节点 hover) */}
      {(() => {
        const node =
          hoveredNodeId && !selectedNodeId
            ? richNodes.find((n: RichTopologyNode) => n.id === hoveredNodeId)
            : null
        if (!node || !hoverAnchorRef.current) return null
        return (
          <PortalPanel
            open
            anchorRef={hoverAnchorRef}
            side="top"
            align="start"
            gap={4}
            role="tooltip"
            className="pointer-events-none w-max max-w-[220px] rounded-md border border-border bg-popover px-2 py-1 text-[10px] shadow-md"
          >
            <div className="font-medium text-foreground">
              {node.label}
              {node.isArbiter && <span className="ml-1 text-purple-500">{t('arbiter')}</span>}
              {node.isDagNode && <span className="ml-1 text-cyan-500">DAG</span>}
            </div>
            <div className="text-muted-foreground">
              {t('roleLabel')}
              {node.role} · {getNodeDisplayLabel(node)}
            </div>
          </PortalPanel>
        )
      })()}

      {/* Click Detail Tooltip(详细:角色 + 状态 + 耗时 + token + DAG 状态)
          — PortalPanel 统一浮层;外点/Escape 关闭选中(与"点击空白取消"文案一致) */}
      {selectedNode && (
        <PortalPanel
          open
          anchorRef={selectedAnchorRef}
          side="bottom"
          align="start"
          gap={4}
          onClose={() => setSelectedNodeId(null)}
          className="w-48 rounded-md border border-border bg-popover px-2.5 py-2 text-[10px] shadow-lg"
        >
          <div className="mb-1 flex items-center gap-1 font-medium text-foreground">
            <span>{selectedNode.label}</span>
            {selectedNode.isArbiter && (
              <span className="rounded-sm bg-purple-500/10 px-1 text-[9px] text-purple-600">
                {t('arbiterBadge')}
              </span>
            )}
            {selectedNode.isDagNode && (
              <span className="rounded-sm bg-cyan-500/10 px-1 text-[9px] text-cyan-600">
                {t('dagBadge')}
              </span>
            )}
          </div>
          <div className="space-y-0.5 text-muted-foreground">
            <div>
              {t('roleLabel')}
              {selectedNode.role}
            </div>
            <div>
              {t('statusLabel')}
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
                {getNodeDisplayLabel(selectedNode)}
              </span>
            </div>
            <div>{`${t('durationLabel')}${formatDuration(selectedNode.durationMs)}`}</div>
            <div>Token:{formatTokens(selectedNode.tokenUsage)}</div>
            {selectedNode.isDagNode && selectedNode.dagNodeStatus && (
              <div>
                {t('dagStatusLabel')}
                <span className="ml-1 text-cyan-600">
                  {dispatchStatusLabel[selectedNode.dagNodeStatus] ?? selectedNode.dagNodeStatus}
                </span>
              </div>
            )}
          </div>
          <div className="mt-1 text-[9px] text-muted-foreground/60">{t('clickToCancel')}</div>
        </PortalPanel>
      )}

      {/* 选中状态提示 */}
      {selectedNodeId && !selectedNode && (
        <div className="absolute bottom-1 left-2 text-[10px] text-muted-foreground">
          {t('selectedNodeHint')}
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

// ===========================================================================
// 超越 v3:协作消息流 + 拓扑推荐视图 + 演化时间轴
// ===========================================================================

/** 协作消息类型(9 种) */
type CollaborationMessageType =
  | 'question'
  | 'answer'
  | 'result'
  | 'request_help'
  | 'propose_plan'
  | 'object'
  | 'accept'
  | 'delegate'
  | 'share_context'

/** 协作消息 */
interface CollaborationMessage {
  from: string
  to: string
  collaborationType: CollaborationMessageType
  content: string
  timestamp: string
  round: number
  planId?: string
  delegatedTo?: string
}

/** 协作记录 */
interface CollaborationRecord {
  dispatchId: string
  messages: CollaborationMessage[]
  relations: Array<{
    from: string
    to: string
    count: number
    types: CollaborationMessageType[]
  }>
}

/** 智能规划结果 */
interface AutoPlanAgent {
  role: string
  task: string
  depends_on: string[]
}
interface AutoPlanResult {
  orchestration: OrchestrationMode
  agents: AutoPlanAgent[]
  estimatedDuration: string
  estimatedCost: string
  reasoning: string
  topologyStats: Array<{ orchestration: string; successRate: number; sampleSize: number }>
  generatedAt: string
}

/** 演化版本 */
interface PromptPatch {
  originalText: string
  suggestedReplacement: string
  reason: string
}
interface EvolutionVersion {
  version: string
  prompt: string
  changes: PromptPatch[]
  createdAt: string
}
interface AgentEvolutionRecord {
  dispatchId: string
  agentRole: string
  taskDescription: string
  result: string
  retryCount: number
  userFeedback: string | undefined
  success: boolean
  durationMs: number
  tokenUsage: number
  recordedAt: string
}
interface EvolutionHistory {
  agentRole: string
  currentPrompt: string
  versions: EvolutionVersion[]
  recentRecords: AgentEvolutionRecord[]
}

/** 协作消息类型 → 颜色 + i18n 键名(模块级常量不持有 t,渲染处用 t(style.labelKey) 取词) */
const COLLAB_TYPE_STYLE: Record<
  CollaborationMessageType,
  { color: string; bg: string; labelKey: string }
> = {
  question: { color: 'text-blue-600', bg: 'bg-blue-500/15', labelKey: 'collabType.question' },
  answer: { color: 'text-green-600', bg: 'bg-green-500/15', labelKey: 'collabType.answer' },
  result: { color: 'text-emerald-600', bg: 'bg-emerald-500/15', labelKey: 'collabType.result' },
  request_help: {
    color: 'text-orange-600',
    bg: 'bg-orange-500/15',
    labelKey: 'collabType.request_help',
  },
  propose_plan: {
    color: 'text-violet-600',
    bg: 'bg-violet-500/15',
    labelKey: 'collabType.propose_plan',
  },
  object: { color: 'text-red-600', bg: 'bg-red-500/15', labelKey: 'collabType.object' },
  accept: { color: 'text-teal-600', bg: 'bg-teal-500/15', labelKey: 'collabType.accept' },
  delegate: { color: 'text-amber-600', bg: 'bg-amber-500/15', labelKey: 'collabType.delegate' },
  share_context: {
    color: 'text-cyan-600',
    bg: 'bg-cyan-500/15',
    labelKey: 'collabType.share_context',
  },
}

// ---------------------------------------------------------------------------
// CollaborationStream - 协作消息流(SVG 时间轴)
// ---------------------------------------------------------------------------

interface CollaborationStreamProps {
  dispatchId: string
  className?: string
}

export function CollaborationStream({ dispatchId, className }: CollaborationStreamProps) {
  const t = useTranslations('swarmTopology')
  const [record, setRecord] = React.useState<CollaborationRecord | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!dispatchId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const r = await fetchApi<CollaborationRecord>(`/api/subagents/${dispatchId}/collaboration`)
        if (!cancelled && r.success && r.data) setRecord(r.data)
        else if (!cancelled) setRecord(null)
      } catch {
        if (!cancelled) setRecord(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [dispatchId])

  if (loading) {
    return (
      <div
        className={cn(
          'rounded-md border border-border bg-card p-3 text-xs text-muted-foreground',
          className,
        )}
      >
        {t('loadingCollaboration')}
      </div>
    )
  }

  if (!record || record.messages.length === 0) {
    return (
      <div
        className={cn(
          'rounded-md border border-border bg-card p-3 text-xs text-muted-foreground',
          className,
        )}
      >
        {t('emptyCollaboration')}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2 rounded-md border border-border bg-card p-2.5', className)}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-foreground">
          {t('collaborationTitle', { count: record.messages.length })}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {t('relationsCount', { count: record.relations.length })}
        </span>
      </div>
      {/* 消息时间轴 */}
      <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
        {record.messages.map((msg, i) => {
          const style: { color: string; bg: string; labelKey: string } = COLLAB_TYPE_STYLE[
            msg.collaborationType
          ] ?? {
            color: 'text-emerald-600',
            bg: 'bg-emerald-500/15',
            labelKey: 'collabType.result',
          }
          return (
            <div key={i} className="flex items-stretch gap-1.5">
              {/* 时间轴线 + 圆点 */}
              <div className="flex flex-col items-center pt-0.5">
                <span className={cn('inline-block h-2 w-2 rounded-sm', style.bg)} />
                {i < record.messages.length - 1 && (
                  <span className="mt-0.5 h-full w-px bg-border" />
                )}
              </div>
              {/* 消息内容 */}
              <div className="flex-1 pb-1.5">
                <div className="flex items-center gap-1 text-[10px]">
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[9px]">
                    {msg.from}
                  </code>
                  <span className="text-muted-foreground">→</span>
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[9px]">
                    {msg.to}
                  </code>
                  <span
                    className={cn(
                      'rounded-sm px-1 py-0.5 text-[9px] font-medium',
                      style.bg,
                      style.color,
                    )}
                  >
                    {t(style.labelKey)}
                  </span>
                  <span className="text-muted-foreground/60">R{msg.round}</span>
                </div>
                <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                  {msg.content}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {/* 关系图摘要 */}
      {record.relations.length > 0 && (
        <div className="space-y-0.5 rounded-sm border border-border bg-muted/30 px-2 py-1">
          <div className="text-[10px] font-medium text-muted-foreground">{t('relationsTitle')}</div>
          {record.relations.map((rel, i) => (
            <div key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <code className="font-mono">{rel.from}</code>
              <span>→</span>
              <code className="font-mono">{rel.to}</code>
              <span className="text-muted-foreground/60">
                ({t('relationCount', { count: rel.count })})
              </span>
              <div className="flex gap-0.5">
                {rel.types.map((type) => {
                  const s: { color: string; bg: string; labelKey: string } = COLLAB_TYPE_STYLE[
                    type
                  ] ?? {
                    color: 'text-emerald-600',
                    bg: 'bg-emerald-500/15',
                    labelKey: 'collabType.result',
                  }
                  return (
                    <span key={type} className={cn('rounded-sm px-0.5 text-[8px]', s.bg, s.color)}>
                      {t(s.labelKey)}
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TopologyRecommendation - 拓扑推荐视图
// ---------------------------------------------------------------------------

interface TopologyRecommendationProps {
  plan: AutoPlanResult
  className?: string
}

/** 编排模式 → 颜色 + i18n 键名(渲染处取词) */
const ORCH_MODE_STYLE: Record<string, { color: string; bg: string; labelKey: string }> = {
  pipeline: { color: 'text-slate-600', bg: 'bg-slate-500/15', labelKey: 'orchMode.pipeline' },
  parallel: { color: 'text-slate-600', bg: 'bg-slate-500/15', labelKey: 'orchMode.parallel' },
  debate: { color: 'text-red-600', bg: 'bg-red-500/15', labelKey: 'orchMode.debate' },
  vote: { color: 'text-green-600', bg: 'bg-green-500/15', labelKey: 'orchMode.vote' },
  critique: { color: 'text-orange-600', bg: 'bg-orange-500/15', labelKey: 'orchMode.critique' },
  decomposed: { color: 'text-violet-600', bg: 'bg-violet-500/15', labelKey: 'orchMode.decomposed' },
  with_communication: {
    color: 'text-blue-600',
    bg: 'bg-blue-500/15',
    labelKey: 'orchMode.with_communication',
  },
}

export function TopologyRecommendation({ plan, className }: TopologyRecommendationProps) {
  const t = useTranslations('swarmTopology')
  const modeStyle: { color: string; bg: string; labelKey: string } = ORCH_MODE_STYLE[
    plan.orchestration
  ] ?? {
    color: 'text-slate-600',
    bg: 'bg-slate-500/15',
    labelKey: 'orchMode.parallel',
  }

  // 推导 agent 依赖层级(简单拓扑排序)
  const layers = React.useMemo(() => {
    const visited = new Set<string>()
    const result: AutoPlanAgent[][] = []
    while (visited.size < plan.agents.length) {
      const layer = plan.agents.filter(
        (a) => !visited.has(a.role) && a.depends_on.every((d) => visited.has(d)),
      )
      if (layer.length === 0) break
      for (const a of layer) visited.add(a.role)
      result.push(layer)
    }
    return result
  }, [plan.agents])

  return (
    <div
      className={cn('space-y-2 rounded-md border border-border bg-card p-2.5 text-xs', className)}
    >
      {/* 头部:编排模式 + 预估 */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'rounded-sm px-1.5 py-0.5 text-[10px] font-medium',
            modeStyle.bg,
            modeStyle.color,
          )}
        >
          {t(modeStyle.labelKey)}({plan.orchestration})
        </span>
        <span className="text-[10px] text-muted-foreground">
          {t('estimate', { duration: plan.estimatedDuration, cost: plan.estimatedCost })}
        </span>
      </div>

      {/* DAG 层级可视化 */}
      <div className="space-y-1.5">
        {layers.map((layer, layerIdx) => (
          <div key={layerIdx} className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-[9px] text-muted-foreground/60">
              L{layerIdx + 1}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {layer.map((agent) => (
                <div
                  key={agent.role}
                  className="rounded-md border border-border bg-background px-2 py-1"
                >
                  <div className="flex items-center gap-1">
                    <code className="font-mono text-[10px] text-foreground">{agent.role}</code>
                    {agent.depends_on.length > 0 && (
                      <span className="text-[8px] text-muted-foreground/60">
                        ← {agent.depends_on.join(',')}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                    {agent.task}
                  </div>
                </div>
              ))}
            </div>
            {layerIdx < layers.length - 1 && <span className="text-muted-foreground/40">↓</span>}
          </div>
        ))}
      </div>

      {/* 推理 */}
      <div className="rounded-sm border border-border bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">{t('reasoningLabel')}</span>
        {plan.reasoning}
      </div>

      {/* 历史统计 */}
      {plan.topologyStats.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {plan.topologyStats.map((s, i) => (
            <span
              key={i}
              className="rounded-sm bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground"
            >
              {s.orchestration}: {Math.round(s.successRate * 100)}%({s.sampleSize})
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// EvolutionTimeline - 演化时间轴
// ---------------------------------------------------------------------------

interface EvolutionTimelineProps {
  role: string
  className?: string
}

export function EvolutionTimeline({ role, className }: EvolutionTimelineProps) {
  const t = useTranslations('swarmTopology')
  const [history, setHistory] = React.useState<EvolutionHistory | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!role) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const r = await fetchApi<EvolutionHistory>(
          `/api/subagents/agents/${role}/evolution-history`,
        )
        if (!cancelled && r.success && r.data) setHistory(r.data)
        else if (!cancelled) setHistory(null)
      } catch {
        if (!cancelled) setHistory(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [role])

  if (loading) {
    return (
      <div
        className={cn(
          'rounded-md border border-border bg-card p-3 text-xs text-muted-foreground',
          className,
        )}
      >
        {t('loadingEvolution')}
      </div>
    )
  }

  if (!history || history.versions.length === 0) {
    return (
      <div
        className={cn(
          'rounded-md border border-border bg-card p-3 text-xs text-muted-foreground',
          className,
        )}
      >
        {t('emptyEvolution', { role })}
      </div>
    )
  }

  return (
    <div
      className={cn('space-y-2 rounded-md border border-border bg-card p-2.5 text-xs', className)}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-foreground">
          {t('evolutionTitle', {
            role,
            count: history.versions.length,
          })}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {t('recentTasksCount', { count: history.recentRecords.length })}
        </span>
      </div>

      {/* 版本时间轴 */}
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {history.versions.map((v, i) => (
          <React.Fragment key={v.version}>
            <div className="flex min-w-[100px] flex-col rounded-md border border-border bg-background px-1.5 py-1">
              <div className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-sm bg-violet-500" />
                <code className="font-mono text-[10px] font-medium text-foreground">
                  {v.version}
                </code>
              </div>
              <div className="mt-0.5 text-[9px] text-muted-foreground/60">
                {formatDateOnly(v.createdAt)}
              </div>
              <div className="mt-0.5 line-clamp-2 text-[9px] text-muted-foreground">
                {v.changes.length > 0
                  ? t('patchCount', { count: v.changes.length })
                  : t('initialVersion')}
              </div>
            </div>
            {i < history.versions.length - 1 && (
              <div className="flex items-center text-muted-foreground/40">→</div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* 当前 prompt */}
      <div className="rounded-sm border border-border bg-muted/30 px-2 py-1">
        <div className="text-[10px] font-medium text-muted-foreground">
          {t('currentPromptTitle', {
            version: history.versions[history.versions.length - 1]!.version,
          })}
        </div>
        <div className="mt-0.5 line-clamp-3 text-[11px] text-muted-foreground">
          {history.currentPrompt}
        </div>
      </div>

      {/* 最近任务记录 */}
      {history.recentRecords.length > 0 && (
        <div className="space-y-0.5">
          <div className="text-[10px] font-medium text-muted-foreground">{t('recentTasks')}</div>
          {history.recentRecords.slice(0, 5).map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px]"
            >
              <span className={r.success ? 'text-green-600' : 'text-red-500'}>
                {r.success ? '✓' : '✗'}
              </span>
              <span className="flex-1 truncate text-muted-foreground">{r.taskDescription}</span>
              {r.retryCount > 0 && (
                <span className="text-orange-500">{t('retryCount', { count: r.retryCount })}</span>
              )}
              <span className="text-muted-foreground/60">{Math.round(r.durationMs / 1000)}s</span>
            </div>
          ))}
        </div>
      )}

      {/* 最新版本的变更详情 */}
      {history.versions.length > 0 &&
        history.versions[history.versions.length - 1]!.changes.length > 0 && (
          <div className="space-y-0.5 rounded-sm border border-amber-500/30 bg-amber-500/5 px-2 py-1">
            <div className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
              {t('latestPatches', {
                version: history.versions[history.versions.length - 1]!.version,
              })}
            </div>
            {history.versions[history.versions.length - 1]!.changes.map((c, i) => (
              <div key={i} className="text-[10px]">
                <div className="text-red-500">- {c.originalText.slice(0, 50)}</div>
                <div className="text-green-600">+ {c.suggestedReplacement.slice(0, 50)}</div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

export default SwarmTopologyView
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
