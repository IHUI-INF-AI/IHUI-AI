'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@ihui/ui-react'

import { fetchApi } from '@/lib/api'
import { ApiLogFilter } from './ApiLogFilter'
import { ApiLogTable } from './ApiLogTable'
import type { ApiLog } from './types'
import { BackButton } from '@/components/common'

interface ApiLogRaw {
  id: string
  method: string
  path: string
  statusCode: number
  duration: number
  createdAt: string
}

interface ApiLogsData {
  list: ApiLogRaw[]
  total: number
}

export default function ApiLogsPage() {
  const t = useTranslations('adminTools')

  const [statusFilter, setStatusFilter] = React.useState<'all' | string>('all')
  const [endpointFilter, setEndpointFilter] = React.useState('')
  const [page, setPage] = React.useState(1)
  const pageSize = 15

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'api-logs', page, statusFilter, endpointFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (endpointFilter) params.set('endpoint', endpointFilter)
      const r = await fetchApi<ApiLogsData>(`/api/admin/api-logs?${params.toString()}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const paged: ApiLog[] = (data?.list ?? []).map((r) => ({
    id: r.id,
    method: r.method,
    endpoint: r.path,
    statusCode: r.statusCode,
    latency: r.duration,
    time: r.createdAt,
    ip: '-',
    user: '-',
  }))
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const curPage = Math.min(page, totalPages)

  React.useEffect(() => {
    setPage(1)
  }, [statusFilter, endpointFilter])

  return (
    <div className="space-y-4">
      <BackButton />
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ScrollText className="h-6 w-6 text-primary" />
          {t('apiLogs.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('apiLogs.subtitle')}</p>
      </div>

      <ApiLogFilter
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        endpointFilter={endpointFilter}
        setEndpointFilter={setEndpointFilter}
      />

      <ApiLogTable paged={paged} isLoading={isLoading} />

      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t('apiLogs.total', { count: total })} · {curPage}/{totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={curPage <= 1}
              onClick={() => setPage(curPage - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={curPage >= totalPages}
              onClick={() => setPage(curPage + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
