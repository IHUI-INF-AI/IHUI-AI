'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Database, Table2, Clock, Lightbulb, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface TableInfo {
  id: string
  name: string
  rows: number
  size: string
  indexSize: string
}

interface SlowQuery {
  id: string
  query: string
  latency: number
  calls: number
}

interface Suggestion {
  id: string
  type: 'index' | 'rewrite' | 'archive'
  title: string
  description: string
}

const MOCK_TABLES: TableInfo[] = [
  { id: '1', name: 'messages', rows: 1284210, size: '1.2 GB', indexSize: '320 MB' },
  { id: '2', name: 'orders', rows: 482310, size: '480 MB', indexSize: '120 MB' },
  { id: '3', name: 'users', rows: 96420, size: '92 MB', indexSize: '48 MB' },
  { id: '4', name: 'audit_logs', rows: 5240120, size: '3.4 GB', indexSize: '210 MB' },
  { id: '5', name: 'sessions', rows: 21450, size: '18 MB', indexSize: '8 MB' },
]

const MOCK_SLOW_QUERIES: SlowQuery[] = [
  { id: '1', query: 'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC', latency: 1240, calls: 8420 },
  { id: '2', query: 'SELECT COUNT(*) FROM audit_logs WHERE created_at > NOW() - INTERVAL 7 DAY', latency: 880, calls: 1240 },
  { id: '3', query: 'SELECT * FROM orders JOIN users ON orders.user_id = users.id WHERE orders.status = ?', latency: 620, calls: 3210 },
  { id: '4', query: 'UPDATE sessions SET data = ? WHERE token = ?', latency: 410, calls: 12450 },
]

const MOCK_SUGGESTIONS: Suggestion[] = [
  { id: '1', type: 'index', title: '为 messages.conversation_id 添加索引', description: '该列频繁出现在 WHERE 与 ORDER BY 中,添加复合索引 (conversation_id, created_at) 可显著降低延迟。' },
  { id: '2', type: 'archive', title: '归档 audit_logs 历史数据', description: 'audit_logs 表已超过 500 万行,建议将 90 天前数据归档至冷存储。' },
  { id: '3', type: 'rewrite', title: '优化 orders 联表查询', description: '建议为 orders.status 添加索引,并限制返回字段避免 SELECT *。' },
]

const SUGGESTION_STYLE: Record<Suggestion['type'], { bg: string; text: string; label: string }> = {
  index: { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'Index' },
  rewrite: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Rewrite' },
  archive: { bg: 'bg-purple-500/10', text: 'text-purple-600', label: 'Archive' },
}

export default function DatabaseOptimizationPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')

  const { data: tables = MOCK_TABLES, isLoading } = useQuery({
    queryKey: ['admin', 'db-opt', 'tables'],
    queryFn: async () => {
      const r = await fetchApi<TableInfo[]>('/api/admin/db-opt/tables')
      if (r.success && r.data) return r.data
      return MOCK_TABLES
    },
  })
  const { data: slowQueries = MOCK_SLOW_QUERIES } = useQuery({
    queryKey: ['admin', 'db-opt', 'slow-queries'],
    queryFn: async () => {
      const r = await fetchApi<SlowQuery[]>('/api/admin/db-opt/slow-queries')
      if (r.success && r.data) return r.data
      return MOCK_SLOW_QUERIES
    },
  })
  const { data: suggestions = MOCK_SUGGESTIONS } = useQuery({
    queryKey: ['admin', 'db-opt', 'suggestions'],
    queryFn: async () => {
      const r = await fetchApi<Suggestion[]>('/api/admin/db-opt/suggestions')
      if (r.success && r.data) return r.data
      return MOCK_SUGGESTIONS
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Database className="h-6 w-6 text-primary" />
          {t('dbOpt.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('dbOpt.subtitle')}</p>
      </div>

      {/* 表空间使用 */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Table2 className="h-5 w-5" />
          {t('dbOpt.tableUsage')}
        </h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {tc('search')}
          </div>
        ) : tables.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            {t('dbOpt.noData')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t('dbOpt.colTable')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('dbOpt.colRows')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('dbOpt.colSize')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('dbOpt.colIndexSize')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tables.map((tb) => (
                  <tr key={tb.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs font-medium">{tb.name}</td>
                    <td className="px-4 py-2.5">{tb.rows.toLocaleString()}</td>
                    <td className="px-4 py-2.5">{tb.size}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{tb.indexSize}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 慢查询列表 */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Clock className="h-5 w-5" />
          {t('dbOpt.slowQueries')}
        </h2>
        {slowQueries.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            {t('dbOpt.noData')}
          </div>
        ) : (
          <div className="space-y-2">
            {slowQueries.map((q) => (
              <div key={q.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <code className="flex-1 break-all rounded bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground">
                    {q.query}
                  </code>
                  <div className="flex shrink-0 items-center gap-3 text-xs">
                    <span className={cn('font-medium', q.latency > 1000 ? 'text-red-600' : 'text-amber-600')}>
                      {q.latency}ms
                    </span>
                    <span className="text-muted-foreground">{q.calls.toLocaleString()} {t('dbOpt.calls')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 优化建议 */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Lightbulb className="h-5 w-5" />
          {t('dbOpt.suggestions')}
        </h2>
        {suggestions.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            {t('dbOpt.noData')}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((s) => {
              const style = SUGGESTION_STYLE[s.type]
              return (
                <Card key={s.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{s.title}</CardTitle>
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', style.bg, style.text)}>
                        {style.label}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
