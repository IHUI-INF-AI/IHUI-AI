'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { FileClock, Trash2, Loader2 } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'

import { JobLogsFilter } from './JobLogsFilter'
import { JobLogsTable } from './JobLogsTable'
import { JobLogDetailDialog } from './JobLogDetailDialog'
import { PAGE_SIZE, EMPTY_SEARCH, fetchJobLogs, clearJobLogs, deleteJobLog } from './helpers'
import type { JobLog, JobLogSearch } from './types'

export default function JobLogsPage() {
  const t = useTranslations('admin.scheduleLogs')
  const qc = useQueryClient()
  const [search, setSearch] = React.useState<JobLogSearch>(EMPTY_SEARCH)
  const [page, setPage] = React.useState(1)
  const [detail, setDetail] = React.useState<JobLog | null>(null)
  const [clearOpen, setClearOpen] = React.useState(false)

  const filter = React.useMemo(() => ({ ...search, page, pageSize: PAGE_SIZE }), [search, page])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'job-logs', filter],
    queryFn: () => fetchJobLogs(filter),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const clearMut = useMutation({
    mutationFn: () => clearJobLogs(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'job-logs'] })
      toast.success(t('clearSuccess'))
      setClearOpen(false)
      setPage(1)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string | number) => deleteJobLog(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'job-logs'] })
      toast.success(t('deleteSuccess'))
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function handleSearchChange(patch: Partial<JobLogSearch>) {
    setSearch((prev) => ({ ...prev, ...patch }))
  }
  function handleReset() {
    setSearch(EMPTY_SEARCH)
    setPage(1)
  }
  function handleDelete(item: JobLog) {
    delMut.mutate(item.jobLogId)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <FileClock className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <Button variant="outline" size="sm" onClick={() => setClearOpen(true)}>
          <Trash2 className="h-4 w-4" />
          {t('clearLogs')}
        </Button>
      </div>

      <JobLogsFilter
        search={search}
        onSearchChange={handleSearchChange}
        onReset={handleReset}
        onQuery={() => setPage(1)}
      />

      <JobLogsTable
        list={list}
        isLoading={isLoading}
        onDetail={setDetail}
        onDelete={handleDelete}
      />

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

      <JobLogDetailDialog open={detail !== null} log={detail} onClose={() => setDetail(null)} />

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmClearTitle')}</DialogTitle>
            <DialogDescription>{t('confirmClearDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setClearOpen(false)}
              disabled={clearMut.isPending}
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={clearMut.isPending}
              onClick={() => clearMut.mutate()}
            >
              {clearMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {t('confirmClear')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
