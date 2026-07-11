'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, RotateCcw } from 'lucide-react'
import type { useTranslations } from 'next-intl'
import {
  Button,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'
import { cn } from '@/lib/utils'
import {
  type EduRefund,
  type RefundStatus,
  type PageData,
  api,
  PAGE_SIZE,
  REFUND_STATUS_CFG,
  selectClass,
  textareaClass,
} from './types'
import { Pagination } from './Pagination'

const REFUND_STATUS_TABS: { value: string; labelKey: 'all' | RefundStatus }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'pending', labelKey: 'pending' },
  { value: 'approved', labelKey: 'approved' },
  { value: 'rejected', labelKey: 'rejected' },
  { value: 'processing', labelKey: 'processing' },
  { value: 'completed', labelKey: 'completed' },
  { value: 'failed', labelKey: 'failed' },
]

export function RefundsTab({
  t,
  tc,
  dateFmt,
  currencyFmt,
}: {
  t: ReturnType<typeof useTranslations<'admin.orders'>>
  tc: ReturnType<typeof useTranslations<'common'>>
  dateFmt: Intl.DateTimeFormat
  currencyFmt: Intl.NumberFormat
}) {
  const qc = useQueryClient()
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [action, setAction] = React.useState<{
    refund: EduRefund
    mode: 'process' | 'handle'
  } | null>(null)
  const [form, setForm] = React.useState({ status: '', message: '' })
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'refunds', status, page],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (status !== 'all') qs.set('status', status)
      return api<PageData<EduRefund>>(`/api/admin/refunds?${qs.toString()}`)
    },
  })

  const mut = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { status: form.status }
      if (form.message.trim()) body[`${action!.mode}Message`] = form.message.trim()
      const url =
        action!.mode === 'process'
          ? `/api/admin/refunds/${action!.refund.id}/process`
          : `/api/admin/refunds/${action!.refund.id}/handle`
      return api(url, { method: 'PUT', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'refunds'] })
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] })
      setAction(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  function openProcess(r: EduRefund) {
    setAction({ refund: r, mode: 'process' })
    setForm({
      status: r.status === 'pending' ? 'approved' : r.status,
      message: r.processMessage ?? '',
    })
    setErr(null)
  }
  function openHandle(r: EduRefund) {
    setAction({ refund: r, mode: 'handle' })
    setForm({
      status: r.status === 'approved' ? 'processing' : r.status,
      message: r.handleMessage ?? '',
    })
    setErr(null)
  }
  function close() {
    if (mut.isPending) return
    setAction(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    mut.mutate()
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const refunds = data?.list ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
        {REFUND_STATUS_TABS.map((tb) => (
          <button
            key={tb.value}
            onClick={() => {
              setStatus(tb.value)
              setPage(1)
            }}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              status === tb.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`refundStatus_${tb.labelKey}`)}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t('orderNo')}</th>
              <th className="px-4 py-2.5 font-medium">{t('refundAmount')}</th>
              <th className="px-4 py-2.5 font-medium">{t('refundType')}</th>
              <th className="px-4 py-2.5 font-medium">{t('reason')}</th>
              <th className="px-4 py-2.5 font-medium">{t('status')}</th>
              <th className="px-4 py-2.5 font-medium">{t('applyTime')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </td>
              </tr>
            ) : refunds.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <RotateCcw className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noRefunds')}
                </td>
              </tr>
            ) : (
              refunds.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-mono text-xs">{r.orderNo}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {currencyFmt.format(Number(r.refundAmount))}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {t(`refundType_${r.refundType}`)}
                  </td>
                  <td className="max-w-xs break-words px-4 py-2.5 text-muted-foreground">
                    {r.reason ?? '-'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        REFUND_STATUS_CFG[r.status].cls,
                      )}
                    >
                      {t(`refundStatus_${r.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {r.applyTime ? dateFmt.format(new Date(r.applyTime)) : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {r.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => openProcess(r)}>
                          {t('process')}
                        </Button>
                      )}
                      {(r.status === 'approved' || r.status === 'processing') && (
                        <Button size="sm" variant="outline" onClick={() => openHandle(r)}>
                          {t('handle')}
                        </Button>
                      )}
                      {!['pending', 'approved', 'processing'].includes(r.status) && (
                        <span className="text-xs text-muted-foreground">{t('noAction')}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} setPage={setPage} t={t} />

      <Dialog open={!!action} onOpenChange={(o) => (!o && !mut.isPending ? close() : null)}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {action?.mode === 'process' ? t('processTitle') : t('handleTitle')}
              </DialogTitle>
              <DialogDescription>
                {action?.mode === 'process' ? t('processDesc') : t('handleDesc')}
              </DialogDescription>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            {action && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                <div className="font-mono text-xs">{action.refund.orderNo}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {currencyFmt.format(Number(action.refund.refundAmount))} ·{' '}
                  {t(`refundStatus_${action.refund.status}`)}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="r-status">{t('fieldStatus')}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {action?.mode === 'process'
                    ? (['approved', 'rejected'] as const).map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`refundStatus_${s}`)}
                        </SelectItem>
                      ))
                    : (['processing', 'completed', 'failed'] as const).map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`refundStatus_${s}`)}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-message">{t('fieldMessage')}</Label>
              <textarea
                id="r-message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder={t('messagePlaceholder')}
                rows={3}
                className={textareaClass}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={mut.isPending}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={mut.isPending}>
                {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
