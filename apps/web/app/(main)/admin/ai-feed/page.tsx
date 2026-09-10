// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout'
import { fetchApi } from '@/lib/api'
import { Loader2, RefreshCw, Activity, AlertTriangle } from 'lucide-react'

/**
 * AI 资讯采集健康看板（管理端）。
 * 数据源: GET /api/ai-feed/stats（源状态 + 条目/快照数）。
 * 动作: 立即全量采集 POST /api/ai-feed/collect；源启用开关 PUT /api/ai-feed/sources/:id。
 */

interface AiFeedSource {
  id: string
  sourceCode: string
  sourceName: string
  category: string | null
  enabled: boolean
  sourceType: string
  lastFetchStatus: string | null
  lastFetchAt: string | null
  lastFetchCount: number | null
  endpoint: string | null
  description: string | null
}

interface SourceStatsItem {
  source: AiFeedSource
  itemCount: number
  snapshotCount: number
}

const STATUS_LABEL: Record<string, string> = { success: '成功', error: '失败', skipped: '跳过' }

function statusVariant(status: string | null): 'default' | 'destructive' | 'secondary' | 'outline' {
  if (status === 'success') return 'default'
  if (status === 'error') return 'destructive'
  return 'secondary'
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('zh-CN', { hour12: false })
}

export default function AiFeedHealthPage() {
  const qc = useQueryClient()

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'ai-feed', 'stats'],
    queryFn: async () => {
      const res = await fetchApi<{ list: SourceStatsItem[] }>('/api/ai-feed/stats')
      if (!res.success) throw new Error(res.error)
      return res.data?.list ?? []
    },
    retry: false,
    refetchInterval: 60_000,
  })

  const collectMut = useMutation({
    mutationFn: async () => {
      const res = await fetchApi<{ totalItems: number; fetchedSources: number }>(
        '/api/ai-feed/collect',
        { method: 'POST' },
      )
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['admin', 'ai-feed', 'stats'] })
      toastSummary(`采集完成：${d?.totalItems ?? 0} 条 / ${d?.fetchedSources ?? 0} 源`)
    },
    onError: (e: Error) => toastSummary(`采集失败：${e.message}`),
  })

  const toggleMut = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await fetchApi(`/api/ai-feed/sources/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ai-feed', 'stats'] }),
    onError: (e: Error) => toastSummary(`更新源失败：${e.message}`),
  })

  const list = data ?? []
  const byStatus = (s: string | null) => list.filter((x) => x.source.lastFetchStatus === s)
  const errorCount = byStatus('error').length
  const enabledCount = list.filter((x) => x.source.enabled).length
  const totalItems = list.reduce((a, x) => a + x.itemCount, 0)

  return (
    <div className="space-y-4 px-4 py-6">
      <PageHeader
        title="AI 资讯采集健康看板"
        subtitle="各数据源最近采集状态、条目量与一键重采"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
              刷新
            </Button>
            <Button size="sm" variant="destructive" onClick={() => collectMut.mutate()} disabled={collectMut.isPending}>
              {collectMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Activity className="mr-1 h-4 w-4" />}
              立即全量采集
            </Button>
          </div>
        }
      />

      {isError && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-2 py-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> 加载统计数据失败，请确认 API 可用后重试。
          </CardContent>
        </Card>
      )}

      {/* 汇总卡片 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="数据源总数" value={list.length} />
        <SummaryCard label="启用源" value={enabledCount} />
        <SummaryCard label="采集失败源" value={errorCount} danger={errorCount > 0} />
        <SummaryCard label="资讯条目(累计)" value={totalItems} />
      </div>

      {/* 源明细 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">数据源明细</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载中…
            </div>
          ) : list.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">暂无数据源</div>
          ) : (
            <div className="divide-y">
              {list.map(({ source: s, itemCount, snapshotCount }) => (
                <div key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{s.sourceName}</span>
                      <Badge variant="outline">{s.sourceCode}</Badge>
                      <Badge variant={statusVariant(s.lastFetchStatus)}>
                        {STATUS_LABEL[s.lastFetchStatus ?? ''] ?? s.lastFetchStatus ?? '未采集'}
                      </Badge>
                      {!s.enabled && <Badge variant="secondary">已停用</Badge>}
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {s.category ?? '未分类'} · {s.sourceType} · 最近采集 {fmtTime(s.lastFetchAt)} · 本次 {s.lastFetchCount ?? 0} 条 · 历史条目 {itemCount} · 快照 {snapshotCount}
                      {s.description ? ` · ${s.description}` : ''}
                    </p>
                  </div>
                  <Button
                    variant={s.enabled ? 'outline' : 'default'}
                    size="sm"
                    disabled={toggleMut.isPending}
                    onClick={() => toggleMut.mutate({ id: s.id, enabled: !s.enabled })}
                  >
                    {s.enabled ? '停用' : '启用'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  danger,
}: {
  label: string
  value: number
  danger?: boolean
}) {
  return (
    <Card className={danger ? 'border-destructive/60' : undefined}>
      <CardContent className="py-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold ${danger ? 'text-destructive' : ''}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function toastSummary(msg: string) {
  toast(msg)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
