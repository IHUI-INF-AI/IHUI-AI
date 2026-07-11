'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, FileText } from 'lucide-react'
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
  type EduInvoiceApplication,
  type InvoiceAppStatus,
  type PageData,
  api,
  PAGE_SIZE,
  INVOICE_STATUS_CFG,
  selectClass,
} from './types'
import { Pagination } from './Pagination'

const INVOICE_STATUS_TABS: { value: string; labelKey: 'all' | InvoiceAppStatus }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'pending', labelKey: 'pending' },
  { value: 'approved', labelKey: 'approved' },
  { value: 'rejected', labelKey: 'rejected' },
  { value: 'invoicing', labelKey: 'invoicing' },
  { value: 'invoiced', labelKey: 'invoiced' },
  { value: 'canceled', labelKey: 'canceled' },
]

export function InvoicesTab({
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
  const [target, setTarget] = React.useState<EduInvoiceApplication | null>(null)
  const [newStatus, setNewStatus] = React.useState<InvoiceAppStatus>('pending')
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'invoices', status, page],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (status !== 'all') qs.set('status', status)
      return api<PageData<EduInvoiceApplication>>(
        `/api/admin/invoices/applications?${qs.toString()}`,
      )
    },
  })

  const mut = useMutation({
    mutationFn: () =>
      api(`/api/admin/invoices/applications/${target!.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'invoices'] })
      setTarget(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  function openStatus(app: EduInvoiceApplication) {
    setTarget(app)
    setNewStatus(app.status)
    setErr(null)
  }
  function close() {
    if (mut.isPending) return
    setTarget(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    mut.mutate()
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const apps = data?.list ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
        {INVOICE_STATUS_TABS.map((tb) => (
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
            {t(`invoiceStatus_${tb.labelKey}`)}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t('invoiceType')}</th>
              <th className="px-4 py-2.5 font-medium">{t('amount')}</th>
              <th className="px-4 py-2.5 font-medium">{t('email')}</th>
              <th className="px-4 py-2.5 font-medium">{t('remark')}</th>
              <th className="px-4 py-2.5 font-medium">{t('status')}</th>
              <th className="px-4 py-2.5 font-medium">{t('createdAt')}</th>
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
            ) : apps.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noInvoices')}
                </td>
              </tr>
            ) : (
              apps.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {t(`invoiceType_${a.invoiceType}`)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium">
                    {currencyFmt.format(Number(a.amount))}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{a.email ?? '-'}</td>
                  <td className="max-w-xs break-words px-4 py-2.5 text-muted-foreground">
                    {a.remark ?? '-'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        INVOICE_STATUS_CFG[a.status].cls,
                      )}
                    >
                      {t(`invoiceStatus_${a.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {dateFmt.format(new Date(a.createdAt))}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="outline" onClick={() => openStatus(a)}>
                      {t('changeStatus')}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} setPage={setPage} t={t} />

      <Dialog open={!!target} onOpenChange={(o) => (!o && !mut.isPending ? close() : null)}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t('changeStatusTitle')}</DialogTitle>
              <DialogDescription>{t('changeStatusDesc')}</DialogDescription>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            {target && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                <div className="font-medium">{currencyFmt.format(Number(target.amount))}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t(`invoiceType_${target.invoiceType}`)} · {t(`invoiceStatus_${target.status}`)}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="inv-status">{t('fieldStatus')}</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as InvoiceAppStatus)}>
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    [
                      'pending',
                      'approved',
                      'rejected',
                      'invoicing',
                      'invoiced',
                      'canceled',
                    ] as const
                  ).map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`invoiceStatus_${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
