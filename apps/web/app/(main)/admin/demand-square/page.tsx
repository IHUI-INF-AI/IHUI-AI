'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { LayoutGrid, Hourglass, CheckCircle2, XCircle, ClipboardList } from 'lucide-react'

import { exportToExcel } from '@/lib/export-utils'
import { cn } from '@/lib/utils'
import { Button } from '@ihui/ui'

import { DemandSquareFilter } from './DemandSquareFilter'
import { DemandSquareTable } from './DemandSquareTable'
import { DemandSquareDialog } from './DemandSquareDialog'
import { PAGE_SIZE, api, fetchExamine, EXPORT_COLUMNS } from './helpers'
import type { Examine, ExamineStats } from './types'

export default function AdminDemandSquarePage() {
  const t = useTranslations('admin.demandSquare')
  const qc = useQueryClient()

  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [rejectTarget, setRejectTarget] = React.useState<Examine | null>(null)
  const [reason, setReason] = React.useState('')
  const [err, setErr] = React.useState<string | null>(null)

  const { data: stats } = useQuery({
    queryKey: ['admin', 'demandSquare', 'stats'],
    queryFn: () => api<ExamineStats>('/api/examine/stats/summary'),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'demandSquare', status, page],
    queryFn: () => fetchExamine({ page, status }),
  })

  const approveMut = useMutation({
    mutationFn: (id: string) => api<Examine>(`/api/examine/${id}/approve`, { method: 'PUT' }),
    onSuccess: () => {
      toast.success(t('approveSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'demandSquare'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rejectMut = useMutation({
    mutationFn: () =>
      api<Examine>(`/api/examine/${rejectTarget!.id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ reason: reason.trim() }),
      }),
    onSuccess: () => {
      toast.success(t('rejectSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'demandSquare'] })
      closeReject()
    },
    onError: (e: Error) => setErr(e.message),
  })

  function openReject(rec: Examine) {
    setRejectTarget(rec)
    setReason('')
    setErr(null)
  }
  function closeReject() {
    if (rejectMut.isPending) return
    setRejectTarget(null)
    setReason('')
    setErr(null)
  }
  function submitReject(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!reason.trim()) {
      setErr(t('reasonRequired'))
      return
    }
    rejectMut.mutate()
  }
  function handleExport() {
    exportToExcel(
      '需求广场审核',
      EXPORT_COLUMNS,
      (data?.list ?? []) as unknown as Record<string, unknown>[],
    )
  }

  const records = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const statCards = [
    { key: 'total', value: stats?.total ?? 0, icon: ClipboardList, cls: 'text-primary' },
    { key: 'pending', value: stats?.pending ?? 0, icon: Hourglass, cls: 'text-amber-500' },
    { key: 'approved', value: stats?.approved ?? 0, icon: CheckCircle2, cls: 'text-emerald-500' },
    { key: 'rejected', value: stats?.rejected ?? 0, icon: XCircle, cls: 'text-destructive' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <LayoutGrid className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.key} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t(`stat_${s.key}`)}</span>
                <Icon className={cn('h-4 w-4', s.cls)} />
              </div>
              <p className="mt-2 text-2xl font-bold">{s.value}</p>
            </div>
          )
        })}
      </div>

      <DemandSquareFilter
        status={status}
        onStatusChange={(v) => {
          setStatus(v)
          setPage(1)
        }}
        onExport={handleExport}
      />

      <DemandSquareTable
        list={records}
        isLoading={isLoading}
        error={error as Error | null}
        onApprove={(id) => approveMut.mutate(id)}
        approvePending={approveMut.isPending}
        onReject={openReject}
        rejectPending={rejectMut.isPending}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('page', { page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
          </Button>
        </div>
      </div>

      <DemandSquareDialog
        open={!!rejectTarget}
        reason={reason}
        setReason={setReason}
        err={err}
        pending={rejectMut.isPending}
        onSubmit={submitReject}
        onClose={closeReject}
      />
    </div>
  )
}
