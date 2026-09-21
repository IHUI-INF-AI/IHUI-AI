// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// WATERMARK_PLACEHOLDER

'use client'

import * as React from 'react'
import { Loader2, Network, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

/**
 * MemoryGraphPanel — 记忆图谱可视化(P3 #41 阶段3 v1,2026-09-16 立)。
 *
 * 数据源:GET /api/memory/graph?query=xxx(关键词命中 + 一跳邻居 + 边)。
 * 布局:环形排布(命中节点高亮内环优先,邻居节点外环)——零新依赖、布局确定可测;
 * 力导向布局留后续增强(立项设计的 reactflow 方案)。
 * 交互:搜索 → 环形图 + 节点详情(悬停/点击显示全文)。
 */

interface GraphNode {
  id: string
  content: string
  importanceScore: string
  hit: boolean
}
interface GraphEdge {
  source: string
  target: string
  relation: string
  weight: string
}

/** 环形布局纯函数:节点均匀分布在圆上,返回坐标(供 SVG 渲染与单测)。 */
export function ringLayout(count: number, radius: number): Array<{ x: number; y: number }> {
  if (count <= 0) return []
  const cx = radius
  const cy = radius
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2 // 第一个节点在正上方
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
  })
}

/** 截断文本(节点标签显示)。 */
function clip(s: string, n = 40): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

export interface ForceLayoutEdge {
  source: string
  target: string
}

/**
 * 力导向布局纯函数(P1 #41 增强,2026-09-17 立):确定性模拟(无随机数,
 * 初始位置 = ringLayout),斥力(全对库仑)+ 边弹簧 + 向心力,固定迭代。
 * 同输入两次调用结果必须逐位相同(单测断言)。
 */
export function forceLayout(
  ids: string[],
  edges: ForceLayoutEdge[],
  width = 300,
  height = 300,
  iterations = 150,
): Array<{ x: number; y: number }> {
  const n = ids.length
  if (n === 0) return []
  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) / 2 - 20
  const pts = ringLayout(n, radius).map((p) => ({ x: p.x, y: p.y }))
  const index = new Map<string, number>(ids.map((id, i) => [id, i]))
  // 边映射为索引对(缺失端点忽略)
  const links: Array<[number, number]> = []
  for (const e of edges) {
    const a = index.get(e.source)
    const b = index.get(e.target)
    if (a !== undefined && b !== undefined && a !== b) links.push([a, b])
  }
  const kRep = 4200 // 斥力系数
  const kSpring = 0.06 // 弹簧系数
  const restLen = 90 // 边理想长度
  const kCenter = 0.015 // 向心系数
  const maxStep = 18 // 单轮位移上限
  for (let it = 0; it < iterations; it++) {
    const fx = new Array(n).fill(0)
    const fy = new Array(n).fill(0)
    // 斥力(全对)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pts[i]!.x - pts[j]!.x
        let dy = pts[i]!.y - pts[j]!.y
        let d2 = dx * dx + dy * dy
        if (d2 < 1) {
          // 重合节点:按固定方向微推,保持确定性
          dx = 0.01
          dy = 0.01 * (i + 1)
          d2 = dx * dx + dy * dy
        }
        const d = Math.sqrt(d2)
        const f = kRep / d2
        fx[i]! += (dx / d) * f
        fy[i]! += (dy / d) * f
        fx[j]! -= (dx / d) * f
        fy[j]! -= (dy / d) * f
      }
    }
    // 边弹簧
    for (const [a, b] of links) {
      const dx = pts[b]!.x - pts[a]!.x
      const dy = pts[b]!.y - pts[a]!.y
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01
      const f = kSpring * (d - restLen)
      fx[a]! += (dx / d) * f
      fy[a]! += (dy / d) * f
      fx[b]! -= (dx / d) * f
      fy[b]! -= (dy / d) * f
    }
    // 向心 + 限幅积分 + 边界 clamp
    for (let i = 0; i < n; i++) {
      fx[i] += (cx - pts[i]!.x) * kCenter
      fy[i] += (cy - pts[i]!.y) * kCenter
      let mx = fx[i]!
      let my = fy[i]!
      const mag = Math.sqrt(mx * mx + my * my)
      if (mag > maxStep) {
        mx = (mx / mag) * maxStep
        my = (my / mag) * maxStep
      }
      pts[i]!.x = Math.min(width, Math.max(0, pts[i]!.x + mx))
      pts[i]!.y = Math.min(height, Math.max(0, pts[i]!.y + my))
    }
  }
  return pts.map((p) => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 }))
}

export function MemoryGraphPanel() {
  const t = useTranslations('memoryGraph')
  const [query, setQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [nodes, setNodes] = React.useState<GraphNode[] | null>(null)
  const [edges, setEdges] = React.useState<GraphEdge[]>([])
  const [selected, setSelected] = React.useState<GraphNode | null>(null)

  const handleSearch = async () => {
    const q = query.trim()
    if (!q || loading) return
    setLoading(true)
    setSelected(null)
    try {
      const r = await fetchApi<{ nodes: GraphNode[]; edges: GraphEdge[] }>(
        `/api/memory/graph?query=${encodeURIComponent(q)}`,
      )
      if (r.success && r.data) {
        setNodes(r.data.nodes)
        setEdges(r.data.edges)
      } else {
        setNodes([])
        setEdges([])
      }
    } catch {
      setNodes([])
      setEdges([])
    } finally {
      setLoading(false)
    }
  }

  const R = 130 // 布局半径(SVG 视口 300x300)
  const [layoutMode, setLayoutMode] = React.useState<'ring' | 'force'>('force')
  const positions =
    layoutMode === 'force'
      ? forceLayout(
          (nodes ?? []).map((n) => n.id),
          edges.map((e) => ({ source: e.source, target: e.target })),
        )
      : ringLayout(nodes?.length ?? 0, R)
  const posById = React.useMemo(() => {
    const m = new Map<string, { x: number; y: number }>()
    ;(nodes ?? []).forEach((n, i) => {
      const p = positions[i]
      if (p) m.set(n.id, p)
    })
    return m
  }, [nodes, positions])

  return (
    <div className="space-y-3" data-testid="memory-graph-panel">
      {/* 搜索行 */}
      <div className="flex items-center gap-1.5">
        <Network className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSearch()
          }}
          placeholder={t('searchPlaceholder')}
          className="h-7 min-w-0 flex-1 rounded-md border border-border bg-card px-2 text-xs outline-none focus:border-primary/60"
          data-testid="memory-graph-input"
        />
        <button
          type="button"
          onClick={() => void handleSearch()}
          disabled={loading || !query.trim()}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs text-foreground transition-colors hover:bg-accent/40 disabled:opacity-50"
          data-testid="memory-graph-search"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
          {t('searchBtn')}
        </button>
      </div>

      {/* 布局切换(P1 #41 增强:力导向 / 环形) */}
      {nodes && nodes.length > 1 && (
        <div className="flex items-center gap-1.5" data-testid="memory-graph-layout-toggle">
          {(['force', 'ring'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={layoutMode === mode}
              onClick={() => setLayoutMode(mode)}
              className={cn(
                'rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
                layoutMode === mode
                  ? 'border-primary/60 bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-accent/40',
              )}
            >
              {t(mode === 'force' ? 'layoutForce' : 'layoutRing')}
            </button>
          ))}
        </div>
      )}

      {/* 空态 */}
      {nodes === null && (
        <p className="py-6 text-center text-xs text-muted-foreground">{t('empty')}</p>
      )}
      {nodes !== null && nodes.length === 0 && (
        <p className="py-6 text-center text-xs text-muted-foreground">{t('noHits')}</p>
      )}

      {/* 环形图(SVG) */}
      {nodes && nodes.length > 0 && (
        <div className="overflow-hidden rounded-md border border-border/60 bg-muted/20">
          <svg viewBox="0 0 300 300" className="h-auto w-full" data-testid="memory-graph-svg">
            {/* 边 */}
            {edges.map((e, i) => {
              const a = posById.get(e.source)
              const b = posById.get(e.target)
              if (!a || !b) return null
              return (
                <g key={`e-${i}`}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="currentColor"
                    className="text-border"
                    strokeWidth={1}
                  />
                  <text
                    x={(a.x + b.x) / 2}
                    y={(a.y + b.y) / 2 - 2}
                    textAnchor="middle"
                    className="fill-muted-foreground"
                    fontSize={6}
                  >
                    {e.relation}
                  </text>
                </g>
              )
            })}
            {/* 节点 */}
            {(nodes ?? []).map((n, i) => {
              const p = positions[i]
              if (!p) return null
              return (
                <g
                  key={n.id}
                  onClick={() => setSelected(n)}
                  className="cursor-pointer"
                  data-testid={`memory-node-${i}`}
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={n.hit ? 10 : 7}
                    className={cnNode(n.hit, selected?.id === n.id)}
                    fillOpacity={0.9}
                  />
                  <text
                    x={p.x}
                    y={p.y - (n.hit ? 15 : 12)}
                    textAnchor="middle"
                    fontSize={7}
                    className={n.hit ? 'fill-foreground' : 'fill-muted-foreground'}
                  >
                    {clip(n.content, 24)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      )}

      {/* 选中节点详情 */}
      {selected && (
        <div
          className="rounded-md border border-border bg-card p-2 text-xs leading-relaxed text-foreground"
          data-testid="memory-node-detail"
        >
          {selected.content}
        </div>
      )}

      {/* 图例 */}
      {nodes && nodes.length > 0 && (
        <p className="text-[10px] text-muted-foreground/60">
          {t('legend', { hits: nodes.filter((n) => n.hit).length, total: nodes.length })}
        </p>
      )}
    </div>
  )
}

function cnNode(hit: boolean, selected: boolean): string {
  if (selected) return 'fill-primary stroke-primary'
  return hit ? 'fill-primary/60 stroke-primary/60' : 'fill-muted stroke-border'
}

export default MemoryGraphPanel
