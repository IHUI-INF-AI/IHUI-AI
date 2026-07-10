'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ScrollText, Filter, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

import { Button, Input, Label, Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface ApiLog {
  id: string
  time: string
  endpoint: string
  method: string
  statusCode: number
  latency: number
  ip: string
  user: string
}

const METHOD_COLOR: Record<string, string> = {
  GET: 'bg-blue-500/10 text-blue-600',
  POST: 'bg-emerald-500/10 text-emerald-600',
  PATCH: 'bg-amber-500/10 text-amber-600',
  PUT: 'bg-amber-500/10 text-amber-600',
  DELETE: 'bg-red-500/10 text-red-600',
}

function genMockLogs(): ApiLog[] {
  const methods = ['GET', 'POST', 'PATCH', 'DELETE']
  const endpoints = ['/api/agents', '/api/chat/messages', '/api/admin/users', '/api/orders', '/api/health', '/api/upload', '/api/members']
  const users = ['admin@ihui.ai', 'user01@ihui.ai', 'user02@ihui.ai', 'system', 'guest']
  const logs: ApiLog[] = []
  for (let i = 0; i < 58; i++) {
    const method = methods[Math.floor(Math.random() * methods.length)] ?? 'GET'
    const ok = Math.random() > 0.15
    const statusCode = ok ? (method === 'POST' ? 201 : 200) : ([400, 401, 403, 404, 500][Math.floor(Math.random() * 5)] ?? 500)
    logs.push({
      id: `log-${i}`,
      time: `2026-07-10 0${8 + (i % 9)}:${String((i * 7) % 60).padStart(2, '0')}:${String((i * 13) % 60).padStart(2, '0')}`,
      endpoint: endpoints[Math.floor(Math.random() * endpoints.length)] ?? '',
      method,
      statusCode,
      latency: Math.floor(Math.random() * 800) + 10,
      ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      user: users[Math.floor(Math.random() * users.length)] ?? '',
    })
  }
  return logs
}

const th = 'px-4 py-2.5 font-medium'
const selectClass = 'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function ApiLogsPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')

  const [statusFilter, setStatusFilter] = React.useState<'all' | string>('all')
  const [endpointFilter, setEndpointFilter] = React.useState('')
  const [page, setPage] = React.useState(1)
  const pageSize = 15

  const { data: allLogs = [], isLoading } = useQuery({
    queryKey: ['admin', 'api-logs'],
    queryFn: () => Promise.resolve(genMockLogs()),
  })

  const filtered = React.useMemo(() => {
    return allLogs.filter((l) => {
      if (statusFilter !== 'all') {
        if (statusFilter === '2xx' && !(l.statusCode >= 200 && l.statusCode < 300)) return false
        if (statusFilter === '4xx' && !(l.statusCode >= 400 && l.statusCode < 500)) return false
        if (statusFilter === '5xx' && !(l.statusCode >= 500)) return false
      }
      if (endpointFilter && !l.endpoint.toLowerCase().includes(endpointFilter.toLowerCase())) return false
      return true
    })
  }, [allLogs, statusFilter, endpointFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const paged = filtered.slice((curPage - 1) * pageSize, curPage * pageSize)

  React.useEffect(() => { setPage(1) }, [statusFilter, endpointFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ScrollText className="h-6 w-6 text-primary" />
          {t('apiLogs.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('apiLogs.subtitle')}</p>
      </div>

      {/* 筛选 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('apiLogs.filterStatus')}</Label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
                <option value="all">{t('apiLogs.allStatus')}</option>
                <option value="2xx">2xx</option>
                <option value="4xx">4xx</option>
                <option value="5xx">5xx</option>
              </select>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">{t('apiLogs.filterEndpoint')}</Label>
              <Input value={endpointFilter} onChange={(e) => setEndpointFilter(e.target.value)} placeholder="/api/..." className="h-9" />
            </div>
            <Button variant="outline" size="sm" onClick={() => { setStatusFilter('all'); setEndpointFilter('') }}>
              <Filter className="h-4 w-4" />
              {t('apiLogs.reset')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 日志列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />{tc('search')}
        </div>
      ) : paged.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          {t('apiLogs.noData')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className={th}>{t('apiLogs.colTime')}</th>
                <th className={th}>{t('apiLogs.colEndpoint')}</th>
                <th className={th}>{t('apiLogs.colMethod')}</th>
                <th className={th}>{t('apiLogs.colStatus')}</th>
                <th className={th}>{t('apiLogs.colLatency')}</th>
                <th className={th}>{t('apiLogs.colIp')}</th>
                <th className={th}>{t('apiLogs.colUser')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paged.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{l.time}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{l.endpoint}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-medium', METHOD_COLOR[l.method] ?? 'bg-muted text-muted-foreground')}>
                      {l.method}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn('font-medium', l.statusCode >= 500 ? 'text-red-600' : l.statusCode >= 400 ? 'text-amber-600' : 'text-emerald-600')}>
                      {l.statusCode}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn('text-xs', l.latency > 500 ? 'text-red-600' : l.latency > 200 ? 'text-amber-600' : 'text-muted-foreground')}>
                      {l.latency}ms
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{l.ip}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{l.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 分页 */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t('apiLogs.total', { count: filtered.length })} · {curPage}/{totalPages}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
