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

const SUGGESTION_STYLE: Record<Suggestion['type'], { bg: string; text: string; label: string }> = {
  index: { bg: 'bg-primary/10', text: 'text-primary', label: 'Index' },
  rewrite: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Rewrite' },
  archive: { bg: 'bg-purple-500/10', text: 'text-purple-600', label: 'Archive' },
}

export default function DatabaseOptimizationPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')

  const { data: tables, isLoading } = useQuery({
    queryKey: ['admin', 'db-opt', 'tables'],
    queryFn: async () => {
      const r = await fetchApi<TableInfo[]>('/api/admin/db-opt/tables')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })
  const { data: slowQueries } = useQuery({
    queryKey: ['admin', 'db-opt', 'slow-queries'],
    queryFn: async () => {
      const r = await fetchApi<SlowQuery[]>('/api/admin/db-opt/slow-queries')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })
  const { data: suggestions } = useQuery({
    queryKey: ['admin', 'db-opt', 'suggestions'],
    queryFn: async () => {
      const r = await fetchApi<Suggestion[]>('/api/admin/db-opt/suggestions')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const tablesList = tables ?? []
  const slowQueriesList = slowQueries ?? []
  const suggestionsList = suggestions ?? []

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
        ) : tablesList.length === 0 ? (
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
                {tablesList.map((tb) => (
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
        {slowQueriesList.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            {t('dbOpt.noData')}
          </div>
        ) : (
          <div className="space-y-2">
            {slowQueriesList.map((q) => (
              <div key={q.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <code className="flex-1 break-all rounded bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground">
                    {q.query}
                  </code>
                  <div className="flex shrink-0 items-center gap-3 text-xs">
                    <span
                      className={cn(
                        'font-medium',
                        q.latency > 1000 ? 'text-red-600' : 'text-amber-600',
                      )}
                    >
                      {q.latency}ms
                    </span>
                    <span className="text-muted-foreground">
                      {q.calls.toLocaleString()} {t('dbOpt.calls')}
                    </span>
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
        {suggestionsList.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            {t('dbOpt.noData')}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {suggestionsList.map((s) => {
              const style = SUGGESTION_STYLE[s.type]
              return (
                <Card key={s.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{s.title}</CardTitle>
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          style.bg,
                          style.text,
                        )}
                      >
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
