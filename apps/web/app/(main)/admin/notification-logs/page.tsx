'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Bell } from 'lucide-react'
import { Button } from '@ihui/ui-react'

import { NotificationLogFilter } from './NotificationLogFilter'
import { NotificationLogTable } from './NotificationLogTable'
import { NotificationLogDetailDialog } from './NotificationLogDetailDialog'
import { PAGE_SIZE, RESOURCE, EMPTY_SEARCH, api, buildQueryParams } from './helpers'
import type { NotificationLog, NotificationLogSearch, ListData } from './types'

export default function NotificationLogsPage() {
  const t = useTranslations('admin.notificationLogs')
  const [search, setSearch] = React.useState<NotificationLogSearch>(EMPTY_SEARCH)
  const [page, setPage] = React.useState(1)
  const [detail, setDetail] = React.useState<NotificationLog | null>(null)

  const params = React.useMemo(() => buildQueryParams(search, page, PAGE_SIZE), [search, page])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'notification-logs', params],
    queryFn: () => api<ListData>(`${RESOURCE}?${new URLSearchParams(params)}`),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function handleSearchChange(patch: Partial<NotificationLogSearch>) {
    setSearch((prev) => ({ ...prev, ...patch }))
  }
  function handleReset() {
    setSearch(EMPTY_SEARCH)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Bell className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <NotificationLogFilter
        search={search}
        onSearchChange={handleSearchChange}
        onReset={handleReset}
        onQuery={() => setPage(1)}
      />

      <NotificationLogTable list={list} isLoading={isLoading} onDetail={setDetail} />

      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('total', { total, page, totalPages })}</span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {t('prev')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              {t('next')}
            </Button>
          </div>
        </div>
      )}

      <NotificationLogDetailDialog
        open={detail !== null}
        log={detail}
        onClose={() => setDetail(null)}
      />
    </div>
  )
}
