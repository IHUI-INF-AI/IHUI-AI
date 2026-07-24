'use client'

/**
 * 知识图谱可视化页面(G5 - 2026-07-21)
 *
 * 功能:
 * - 输入文本 → 触发 NER 抽取 + 构建
 * - 渲染节点(实体,按 frequency 调整大小)+ 边(关系,按 weight 调整粗细)
 * - 圆形布局(无外部依赖)
 * - hover 节点高亮关联边
 *
 * 极简实现,避免引入 react-flow 等重依赖。后续可替换为 D3 / React Flow。
 */

import * as React from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Loader2,
  Network,
  Sparkles,
  Trash2,
  AlertCircle,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardHeader, CardTitle, CardContent, CardFooter } from '@ihui/ui-react'
import { Textarea } from '@/components/form'
import { cn } from '@/lib/utils'

interface GraphEntity {
  id: number
  name: string
  type: string
  description?: string | null
  frequency: number
}

interface GraphRelation {
  id: number
  source_entity_id: number
  target_entity_id: number
  relation_type: string
  weight: number
}

interface GraphData {
  owner_uuid: string
  entities: GraphEntity[]
  relations: GraphRelation[]
  stats: { entity_count: number; relation_count: number }
}

interface BuildResult {
  entities_added: number
  relations_added: number
  stub: boolean
}

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/** 圆形布局(半径按 entity 数量自适应) */
function layoutCircle(entities: GraphEntity[]): Map<number, { x: number; y: number }> {
  const map = new Map<number, { x: number; y: number }>()
  if (entities.length === 0) return map
  const cx = 400
  const cy = 300
  const radius = entities.length === 1 ? 0 : Math.min(280, 80 + entities.length * 12)
  entities.forEach((e, i) => {
    const angle = (i / entities.length) * Math.PI * 2 - Math.PI / 2
    map.set(e.id, {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    })
  })
  return map
}

export default function KnowledgeGraphPage() {
  const t = useTranslations('knowledgeGraph')
  const tCommon = useTranslations('common')
  const qc = useQueryClient()
  const [text, setText] = React.useState('')
  const [highlightId, setHighlightId] = React.useState<number | null>(null)
  const [feedback, setFeedback] = React.useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const graphQuery = useQuery({
    queryKey: ['knowledgeGraph', 'data'],
    queryFn: () => api<GraphData>('/api/ai/knowledge-graph/data'),
    refetchOnWindowFocus: false,
  })

  const buildMutation = useMutation({
    mutationFn: (input: string) =>
      api<BuildResult>('/api/ai/knowledge-graph/build', {
        method: 'POST',
        body: JSON.stringify({ text: input }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['knowledgeGraph', 'data'] })
      setText('')
      setFeedback({
        type: 'success',
        msg: `${t('feedbackBuildSuccess', { entities: data.entities_added, relations: data.relations_added })}`,
      })
    },
    onError: (e) => {
      setFeedback({ type: 'error', msg: e instanceof Error ? e.message : String(e) })
    },
  })

  const clearMutation = useMutation({
    mutationFn: () => api<unknown>('/api/ai/knowledge-graph/data', { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['knowledgeGraph', 'data'] })
      setFeedback({ type: 'success', msg: t('feedbackClearSuccess') })
    },
    onError: (e) => {
      setFeedback({ type: 'error', msg: e instanceof Error ? e.message : String(e) })
    },
  })

  React.useEffect(() => {
    if (!feedback) return
    const tm = setTimeout(() => setFeedback(null), 3000)
    return () => clearTimeout(tm)
  }, [feedback])

  const data = graphQuery.data
  const entities = data?.entities ?? []
  const relations = data?.relations ?? []
  const positions = React.useMemo(() => layoutCircle(entities), [entities])

  // 节点 hover 时,高亮关联的 source/target
  const relatedEdgeIds = React.useMemo(() => {
    if (highlightId === null) return new Set<number>()
    const s = new Set<number>()
    relations.forEach((r) => {
      if (r.source_entity_id === highlightId || r.target_entity_id === highlightId) {
        s.add(r.id)
      }
    })
    return s
  }, [highlightId, relations])

  const onBuild = () => {
    if (!text.trim()) return
    buildMutation.mutate(text.trim())
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link href="/knowledge-rag" aria-label={tCommon('back')}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">{t('title')}</h1>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {t('stats', {
            entities: data?.stats.entity_count ?? 0,
            relations: data?.stats.relation_count ?? 0,
          })}
        </div>
      </div>

      {feedback && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
            feedback.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
          )}
        >
          <AlertCircle className="h-4 w-4" />
          <span>{feedback.msg}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            {t('buildSection')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={text}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
            placeholder={t('placeholder')}
            rows={4}
            maxLength={32000}
            disabled={buildMutation.isPending}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {t('charCount', { count: text.length })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending || entities.length === 0}
              >
                {clearMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span className="ml-1">{t('clearButton')}</span>
              </Button>
              <Button
                size="sm"
                onClick={onBuild}
                disabled={buildMutation.isPending || !text.trim()}
              >
                {buildMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span className="ml-1">{t('buildButton')}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('graphSection')}</CardTitle>
        </CardHeader>
        <CardContent>
          {graphQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {tCommon('loading')}
            </div>
          ) : graphQuery.isError ? (
            <div className="py-12 text-center text-sm text-destructive">
              {tCommon('error')}
            </div>
          ) : entities.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t('emptyState')}
            </div>
          ) : (
            <div className="overflow-auto rounded-md border bg-muted/30">
              <svg
                viewBox="0 0 800 600"
                className="h-[600px] w-full"
                role="img"
                aria-label={t('graphAriaLabel')}
              >
                {/* 边 */}
                {relations.map((r) => {
                  const src = positions.get(r.source_entity_id)
                  const tgt = positions.get(r.target_entity_id)
                  if (!src || !tgt) return null
                  const isHighlighted = relatedEdgeIds.has(r.id) || highlightId === null
                  const strokeWidth = Math.max(1, Math.min(4, Number(r.weight)))
                  return (
                    <g key={r.id}>
                      <line
                        x1={src.x}
                        y1={src.y}
                        x2={tgt.x}
                        y2={tgt.y}
                        stroke="currentColor"
                        strokeOpacity={isHighlighted ? 0.5 : 0.15}
                        strokeWidth={strokeWidth}
                        className="text-muted-foreground"
                      />
                      <text
                        x={(src.x + tgt.x) / 2}
                        y={(src.y + tgt.y) / 2 - 4}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[10px]"
                        opacity={isHighlighted ? 0.8 : 0.3}
                      >
                        {r.relation_type}
                      </text>
                    </g>
                  )
                })}
                {/* 节点 */}
                {entities.map((e) => {
                  const pos = positions.get(e.id)
                  if (!pos) return null
                  const r = Math.max(18, Math.min(48, 18 + e.frequency * 6))
                  const isHighlighted = highlightId === null || e.id === highlightId || relatedEdgeIds.size > 0
                  return (
                    <g
                      key={e.id}
                      onMouseEnter={() => setHighlightId(e.id)}
                      onMouseLeave={() => setHighlightId(null)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={r}
                        fill="hsl(var(--primary))"
                        fillOpacity={isHighlighted ? 0.85 : 0.35}
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                      />
                      <text
                        x={pos.x}
                        y={pos.y + 4}
                        textAnchor="middle"
                        className="fill-primary-foreground text-[12px] font-medium pointer-events-none"
                      >
                        {e.name.length > 6 ? e.name.slice(0, 6) + '…' : e.name}
                      </text>
                      <title>
                        {e.name} ({e.type}) · {t('frequencyLabel', { count: e.frequency })}
                      </title>
                    </g>
                  )
                })}
              </svg>
            </div>
          )}
        </CardContent>
        {entities.length > 0 && (
          <CardFooter className="text-xs text-muted-foreground">
            {t('legendHint')}
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
