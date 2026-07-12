'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import {
  Check,
  X,
  Loader2,
  LayoutGrid,
  Hourglass,
  CheckCircle2,
  XCircle,
  ClipboardList,
  Download,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { cn } from '@/lib/utils'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'

interface Examine {
  id: string
  agentId: string
  userId: string | null
  status: string
  reason: string | null
  createdAt: string
  updatedAt: string
}

interface ExamineData {
  list: Examine[]
  total: number
  page: number
  pageSize: number
}

interface ExamineStats {
  total: number
  pending: number
  approved: number
  rejected: number
}

const PAGE_SIZE = 20
const STATUS_OPTIONS = ['pending', 'approved', 'rejected']

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  rejected: 'bg-destructive/10 text-destructive',
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function fetchExamine(params: { page: number; status: string }): Promise<ExamineData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.status !== 'all') qs.set('status', params.status)
  return api<ExamineData>(`/api/examine/list?${qs.toString()}`)
}

const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function AdminDemandSquarePage() {
  const t = useTranslations('admin.demandSquare')
  const tc = useTranslations('common')
  const locale = useLocale()
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

  const records = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  function handleExport() {
    exportToExcel(
      '需求广场审核',
      [
        { key: 'id', title: 'ID' },
        { key: 'agentId', title: 'Agent ID' },
        { key: 'userId', title: '用户 ID' },
        { key: 'status', title: '状态' },
        { key: 'reason', title: '原因' },
        { key: 'createdAt', title: '创建时间' },
        { key: 'updatedAt', title: '更新时间' },
      ],
      records as unknown as Record<string, unknown>[],
    )
  }

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

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
        >
          <SelectTrigger className={selectClass} aria-label={t('colStatus')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatus')}</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`status${s.charAt(0).toUpperCase()}${s.slice(1)}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <HasPermi code="demandSquare:export">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            {tc('export')}
          </Button>
        </HasPermi>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colAgent')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colUser')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colReason')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colCreatedAt')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <LayoutGrid className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              records.map((r) => (
                <TableRow key={r.id} className="transition-colors hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-mono text-xs">
                    {r.agentId ? r.agentId.slice(0, 8) : '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {r.userId ? r.userId.slice(0, 8) : '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_CLASS[r.status] ?? STATUS_CLASS.pending,
                      )}
                    >
                      {t(`status${r.status.charAt(0).toUpperCase()}${r.status.slice(1)}`)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    <span className="break-words">{r.reason || '-'}</span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {dateFmt.format(new Date(r.createdAt))}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    {r.status === 'pending' ? (
                      <div className="flex justify-end gap-1">
                        <HasPermi code="demandSquare:approve">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => approveMut.mutate(r.id)}
                            disabled={approveMut.isPending}
                            title={t('approve')}
                          >
                            <Check className="h-4 w-4 text-emerald-600" />
                          </Button>
                        </HasPermi>
                        <HasPermi code="demandSquare:reject">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openReject(r)}
                            disabled={rejectMut.isPending}
                            title={t('reject')}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </HasPermi>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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

      <Dialog open={!!rejectTarget} onOpenChange={(v) => !v && closeReject()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('rejectTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitReject} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ds-reason">
                {t('reason')} <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="ds-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeReject}
                disabled={rejectMut.isPending}
              >
                {tc('cancel')}
              </Button>
              <Button type="submit" variant="destructive" disabled={rejectMut.isPending}>
                {rejectMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('reject')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
