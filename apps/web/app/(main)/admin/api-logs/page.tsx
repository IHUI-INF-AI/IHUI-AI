'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@ihui/ui'

import { ApiLogFilter } from './ApiLogFilter'
import { ApiLogTable } from './ApiLogTable'
import { genMockLogs } from './helpers'

export default function ApiLogsPage() {
  const t = useTranslations('adminTools')

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
      if (endpointFilter && !l.endpoint.toLowerCase().includes(endpointFilter.toLowerCase()))
        return false
      return true
    })
  }, [allLogs, statusFilter, endpointFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const paged = filtered.slice((curPage - 1) * pageSize, curPage * pageSize)

  React.useEffect(() => {
    setPage(1)
  }, [statusFilter, endpointFilter])

  return (
    <div className="space-y-6">
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

      {filtered.length > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t('apiLogs.total', { count: filtered.length })} · {curPage}/{totalPages}
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
