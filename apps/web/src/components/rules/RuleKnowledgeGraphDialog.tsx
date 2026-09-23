// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, TrendingUp } from 'lucide-react'

import { cn } from '@/lib/utils'
import { rulesApi } from './rules-api'
import type { RuleKnowledgeGraph } from './types'
import type { Rule } from '@ihui/types'
import { Button, CloseButton } from '@ihui/ui-react'

interface RuleKnowledgeGraphDialogProps {
  rules: Rule[]
  onClose: () => void
}

/** 知识图谱 SVG(圆形布局,节点=规则,边=关系) */
function KnowledgeGraphSvg({
  graph,
  ruleNameMap,
}: {
  graph: RuleKnowledgeGraph
  ruleNameMap: Map<string, string>
}) {
  const W = 400
  const H = 300
  const cx = W / 2
  const cy = H / 2
  const radius = Math.min(W, H) / 2 - 40

  const nodeCount = graph.nodes.length
  // 圆形布局:每个节点均匀分布在圆周上
  const nodePositions = new Map<string, { x: number; y: number }>()
  graph.nodes.forEach((node, idx) => {
    const angle = (idx / Math.max(nodeCount, 1)) * 2 * Math.PI - Math.PI / 2
    nodePositions.set(node.ruleId, {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    })
  })

  const edgeColor = (type: string) => {
    if (type === 'duplicate') return 'stroke-yellow-500/50'
    if (type === 'complementary') return 'stroke-green-500/50'
    return 'stroke-red-500/50'
  }

  const nodeColor = (scope: string) => {
    if (scope === 'agent') return 'fill-blue-500/40'
    if (scope === 'workspace') return 'fill-purple-500/40'
    return 'fill-foreground/30'
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-72 w-full">
      {/* 边 */}
      {graph.edges.map((edge, idx) => {
        const s = nodePositions.get(edge.source)
        const t = nodePositions.get(edge.target)
        if (!s || !t) return null
        return (
          <line
            key={`edge-${idx}`}
            x1={s.x}
            y1={s.y}
            x2={t.x}
            y2={t.y}
            className={edgeColor(edge.type)}
            strokeWidth="1.5"
          />
        )
      })}
      {/* 节点 */}
      {graph.nodes.map((node) => {
        const pos = nodePositions.get(node.ruleId)
        if (!pos) return null
        const label = ruleNameMap.get(node.ruleId) ?? node.name
        return (
          <g key={`node-${node.ruleId}`}>
            <circle cx={pos.x} cy={pos.y} r="8" className={nodeColor(node.scope)} />
            <text
              x={pos.x}
              y={pos.y - 12}
              textAnchor="middle"
              className="fill-muted-foreground text-[7px]"
            >
              {label.slice(0, 8)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

const EDGE_TYPE_KEYS = {
  duplicate: 'kgDuplicate',
  complementary: 'kgComplementary',
  conflict: 'kgConflict',
} as const

function RuleKnowledgeGraphDialog({ rules, onClose }: RuleKnowledgeGraphDialogProps) {
  const t = useTranslations('rules')
  const tCommon = useTranslations('common')
  const [graph, setGraph] = React.useState<RuleKnowledgeGraph | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    rulesApi<RuleKnowledgeGraph>('/api/rules/knowledge-graph')
      .then((res) => {
        if (!cancelled) {
          setGraph(res)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const ruleNameMap = React.useMemo(() => new Map(rules.map((r) => [r.id, r.name])), [rules])

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 模态遮罩点击外部关闭;键盘用户通过关闭按钮(X)提供等价交互
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-white/40 p-3 dark:bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col space-y-3 rounded-lg border border-border bg-card p-3 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            <TrendingUp className="mr-1 inline h-3.5 w-3.5" />
            {t('knowledgeGraphTitle')}
          </span>
          <CloseButton aria-label={tCommon('close')} onClick={onClose} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('buildingGraph')}
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : graph ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-red-500/50" />
                {t('kgConflict')}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-yellow-500/50" />
                {t('kgDuplicate')}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-green-500/50" />
                {t('kgComplementary')}
              </span>
              <span className="ml-auto">
                {t('graphNodeEdgeCounts', {
                  nodes: graph.nodes.length,
                  edges: graph.edges.length,
                })}
              </span>
            </div>
            {graph.nodes.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                {t('noRulesToBuildGraph')}
              </p>
            ) : (
              <KnowledgeGraphSvg graph={graph} ruleNameMap={ruleNameMap} />
            )}
            {graph.edges.length > 0 && (
              <div className="thin-scroll max-h-32 space-y-1 overflow-y-auto">
                <p className="text-[10px] text-muted-foreground">{t('relationList')}</p>
                {graph.edges.map((edge, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-[10px]"
                  >
                    <span className="truncate">{ruleNameMap.get(edge.source) ?? edge.source}</span>
                    <span
                      className={cn(
                        'shrink-0 rounded-sm px-1 py-0',
                        edge.type === 'duplicate'
                          ? 'bg-yellow-500/10 text-yellow-600'
                          : edge.type === 'complementary'
                            ? 'bg-green-500/10 text-green-600'
                            : 'bg-red-500/10 text-red-600',
                      )}
                    >
                      {t(EDGE_TYPE_KEYS[edge.type])}
                    </span>
                    <span className="truncate">{ruleNameMap.get(edge.target) ?? edge.target}</span>
                    <span className="ml-auto shrink-0 text-muted-foreground">
                      {edge.similarity.toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div className="flex items-center justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            {tCommon('close')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export { RuleKnowledgeGraphDialog }
export type { RuleKnowledgeGraphDialogProps }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
