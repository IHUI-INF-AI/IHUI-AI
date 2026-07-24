'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { FileText, Loader2, ChevronDown, ChevronRight, Search } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Input, Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface LogItem {
  id: string
  method: string
  path: string
  statusCode: number
  duration: number
  ip?: string
  keyName?: string
  createdAt: string
  request?: string
  response?: string
}

interface LogsData {
  list: LogItem[]
  total: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const STATUS_FILTERS = [
  { key: 'all' },
  { key: '2xx' },
  { key: '4xx' },
  { key: '5xx' },
] as const

const METHOD_CLASS: Record<string, string> = {
  GET: 'text-emerald-600 dark:text-emerald-400',
  POST: 'text-blue-600 dark:text-blue-400',
  PUT: 'text-amber-600 dark:text-amber-400',
  DELETE: 'text-rose-600 dark:text-rose-400',
  PATCH: 'text-purple-600 dark:text-purple-400',
}

export default function LogsPage() {
  const locale = useLocale()
  const t = useTranslations('developerLogsPage')
  const [statusFilter, setStatusFilter] = React.useState<string>('all')
  const [keyword, setKeyword] = React.useState('')
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})

  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['developer', 'logs', statusFilter, keyword],
    queryFn: () =>
      api<LogsData>(
        `/api/developer/logs?status=${statusFilter}&keyword=${encodeURIComponent(keyword)}`,
      ).catch(() => ({ list: [], total: 0 }) as LogsData),
  })

  const list = data?.list ?? []

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function statusClass(code: number) {
    if (code < 300) return 'text-emerald-600 dark:text-emerald-400'
    if (code < 500) return 'text-amber-600 dark:text-amber-400'
    return 'text-rose-600 dark:text-rose-400'
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <FileText className="h-5 w-5 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={statusFilter === f.key ? 'default' : 'outline'}
              onClick={() => setStatusFilter(f.key)}
            >
              {t(`statusFilter.${f.key}`)}
            </Button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-8 w-48 pl-8 text-xs"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('loading')}
            </div>
          ) : list.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <div className="divide-y">
              {list.map((log) => (
                <div key={log.id}>
                  <button
                    onClick={() => toggleExpand(log.id)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs transition-colors hover:bg-accent"
                  >
                    {expanded[log.id] ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className={cn('w-12 shrink-0 font-bold', METHOD_CLASS[log.method])}>
                      {log.method}
                    </span>
                    <span className="flex-1 truncate font-mono">{log.path}</span>
                    <span className={cn('shrink-0 font-medium', statusClass(log.statusCode))}>
                      {log.statusCode}
                    </span>
                    <span className="shrink-0 text-muted-foreground">{log.duration}ms</span>
                    <span className="shrink-0 text-muted-foreground">
                      {dateFmt.format(new Date(log.createdAt))}
                    </span>
                  </button>
                  {expanded[log.id] && (
                    <div className="space-y-2 border-t bg-muted/30 px-4 py-3 text-xs">
                      {log.keyName && (
                        <p className="text-muted-foreground">{t('keyValue', { value: log.keyName })}</p>
                      )}
                      {log.ip && <p className="text-muted-foreground">IP: {log.ip}</p>}
                      {log.request && (
                        <div>
                          <p className="mb-1 font-semibold">{t('requestBody')}</p>
                          <pre className="overflow-x-auto rounded bg-card p-2">
                            <code>{log.request}</code>
                          </pre>
                        </div>
                      )}
                      {log.response && (
                        <div>
                          <p className="mb-1 font-semibold">{t('responseBody')}</p>
                          <pre className="overflow-x-auto rounded bg-card p-2">
                            <code>{log.response}</code>
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
