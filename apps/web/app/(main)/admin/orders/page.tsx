'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  RotateCcw,
  FileText,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ihui/ui'
import { cn } from '@/lib/utils'

// =============================================================================
// 类型定义(对齐 EduOrder / EduRefund / EduInvoiceApplication schema)
// =============================================================================

type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded'
type RefundStatus = 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed'
type InvoiceAppStatus = 'pending' | 'approved' | 'rejected' | 'invoicing' | 'invoiced' | 'canceled'

interface EduOrder {
  id: string
  orderNo: string
  userId: string
  orderType: string
  targetId?: string | null
  targetTitle?: string | null
  quantity: number
  originalPrice: string
  discountAmount: string
  payAmount: string
  payType?: string | null
  status: OrderStatus
  payTime?: string | null
  cancelTime?: string | null
  refundTime?: string | null
  remark?: string | null
  createdAt: string
  updatedAt: string
}

interface EduRefund {
  id: string
  orderId: string
  orderType: string
  orderNo: string
  userId: string
  reason?: string | null
  refundAmount: string
  refundType: string
  status: RefundStatus
  applyTime?: string | null
  processTime?: string | null
  completeTime?: string | null
  processMessage?: string | null
  handleMessage?: string | null
  createdAt: string
  updatedAt: string
}

interface EduInvoiceApplication {
  id: string
  orderId?: string | null
  userId: string
  invoiceType: string
  titleId?: string | null
  amount: string
  email?: string | null
  status: InvoiceAppStatus
  remark?: string | null
  createdAt: string
  updatedAt: string
}

interface PageData<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// =============================================================================
// 辅助
// =============================================================================

const PAGE_SIZE = 10

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const ORDER_STATUS_CFG: Record<OrderStatus, { cls: string; dot: string }> = {
  pending: { cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500', dot: 'bg-amber-500' },
  paid: { cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500', dot: 'bg-emerald-500' },
  cancelled: { cls: 'bg-red-500/10 text-red-600 dark:text-red-500', dot: 'bg-red-500' },
  refunded: { cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-500', dot: 'bg-blue-500' },
}

const REFUND_STATUS_CFG: Record<RefundStatus, { cls: string }> = {
  pending: { cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500' },
  approved: { cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-500' },
  rejected: { cls: 'bg-red-500/10 text-red-600 dark:text-red-500' },
  processing: { cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-500' },
  completed: { cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  failed: { cls: 'bg-red-500/10 text-red-600 dark:text-red-500' },
}

const INVOICE_STATUS_CFG: Record<InvoiceAppStatus, { cls: string }> = {
  pending: { cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500' },
  approved: { cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-500' },
  rejected: { cls: 'bg-red-500/10 text-red-600 dark:text-red-500' },
  invoicing: { cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-500' },
  invoiced: { cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  canceled: { cls: 'bg-muted text-muted-foreground' },
}

const selectClass = 'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const textareaClass = 'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

// =============================================================================
// 主组件
// =============================================================================

type Tab = 'orders' | 'refunds' | 'invoices'

export default function AdminOrdersPage() {
  const t = useTranslations('admin.orders')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [tab, setTab] = React.useState<Tab>('orders')

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const currencyFmt = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
        {([
          { value: 'orders', icon: ShoppingCart, label: t('tabOrders') },
          { value: 'refunds', icon: RotateCcw, label: t('tabRefunds') },
          { value: 'invoices', icon: FileText, label: t('tabInvoices') },
        ] as { value: Tab; icon: React.ComponentType<{ className?: string }>; label: string }[]).map((tb) => (
          <button
            key={tb.value}
            onClick={() => setTab(tb.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === tb.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <tb.icon className="h-4 w-4" />
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'orders' && <OrdersTab t={t} dateFmt={dateFmt} currencyFmt={currencyFmt} />}
      {tab === 'refunds' && <RefundsTab t={t} tc={tc} dateFmt={dateFmt} currencyFmt={currencyFmt} />}
      {tab === 'invoices' && <InvoicesTab t={t} tc={tc} dateFmt={dateFmt} currencyFmt={currencyFmt} />}
    </div>
  )
}

// =============================================================================
// 订单 Tab
// =============================================================================

const ORDER_STATUS_TABS: { value: string; labelKey: 'all' | OrderStatus }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'pending', labelKey: 'pending' },
  { value: 'paid', labelKey: 'paid' },
  { value: 'cancelled', labelKey: 'cancelled' },
  { value: 'refunded', labelKey: 'refunded' },
]

function OrdersTab({
  t,
  dateFmt,
  currencyFmt,
}: {
  t: ReturnType<typeof useTranslations<'admin.orders'>>
  dateFmt: Intl.DateTimeFormat
  currencyFmt: Intl.NumberFormat
}) {
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'orders', status, page],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (status !== 'all') qs.set('status', status)
      return api<PageData<EduOrder>>(`/api/admin/orders?${qs.toString()}`)
    },
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const orders = data?.list ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
        {ORDER_STATUS_TABS.map((tb) => (
          <button
            key={tb.value}
            onClick={() => { setStatus(tb.value); setPage(1) }}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              status === tb.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`status_${tb.labelKey}`)}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t('orderNo')}</th>
              <th className="px-4 py-2.5 font-medium">{t('orderType')}</th>
              <th className="px-4 py-2.5 font-medium">{t('target')}</th>
              <th className="px-4 py-2.5 font-medium">{t('amount')}</th>
              <th className="px-4 py-2.5 font-medium">{t('payType')}</th>
              <th className="px-4 py-2.5 font-medium">{t('status')}</th>
              <th className="px-4 py-2.5 font-medium">{t('createdAt')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />{t('loading')}</td></tr>
            ) : error ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-destructive">{(error as Error).message}</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><ShoppingCart className="mx-auto mb-2 h-8 w-8 opacity-40" />{t('noData')}</td></tr>
            ) : (
              orders.map((o) => {
                const sc = ORDER_STATUS_CFG[o.status]
                return (
                  <tr key={o.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">{o.orderNo}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {t(`type_${o.orderType === 'course' ? 'course' : 'card'}`)}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-2.5">{o.targetTitle ?? '-'}</td>
                    <td className="px-4 py-2.5 font-medium">{currencyFmt.format(Number(o.payAmount))}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{o.payType ?? '-'}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', sc.cls)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
                        {t(`status_${o.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{dateFmt.format(new Date(o.createdAt))}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} setPage={setPage} t={t} />
    </div>
  )
}

// =============================================================================
// 退款 Tab
// =============================================================================

const REFUND_STATUS_TABS: { value: string; labelKey: 'all' | RefundStatus }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'pending', labelKey: 'pending' },
  { value: 'approved', labelKey: 'approved' },
  { value: 'rejected', labelKey: 'rejected' },
  { value: 'processing', labelKey: 'processing' },
  { value: 'completed', labelKey: 'completed' },
  { value: 'failed', labelKey: 'failed' },
]

function RefundsTab({
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
  const [action, setAction] = React.useState<{ refund: EduRefund; mode: 'process' | 'handle' } | null>(null)
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
      const url = action!.mode === 'process'
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
    setForm({ status: r.status === 'pending' ? 'approved' : r.status, message: r.processMessage ?? '' })
    setErr(null)
  }
  function openHandle(r: EduRefund) {
    setAction({ refund: r, mode: 'handle' })
    setForm({ status: r.status === 'approved' ? 'processing' : r.status, message: r.handleMessage ?? '' })
    setErr(null)
  }
  function close() { if (mut.isPending) return; setAction(null); setErr(null) }
  function submit(e: React.FormEvent) { e.preventDefault(); setErr(null); mut.mutate() }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const refunds = data?.list ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
        {REFUND_STATUS_TABS.map((tb) => (
          <button
            key={tb.value}
            onClick={() => { setStatus(tb.value); setPage(1) }}
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
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />{t('loading')}</td></tr>
            ) : error ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-destructive">{(error as Error).message}</td></tr>
            ) : refunds.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><RotateCcw className="mx-auto mb-2 h-8 w-8 opacity-40" />{t('noRefunds')}</td></tr>
            ) : (
              refunds.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-mono text-xs">{r.orderNo}</td>
                  <td className="px-4 py-2.5 font-medium">{currencyFmt.format(Number(r.refundAmount))}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{t(`refundType_${r.refundType}`)}</td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-muted-foreground">{r.reason ?? '-'}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', REFUND_STATUS_CFG[r.status].cls)}>
                      {t(`refundStatus_${r.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.applyTime ? dateFmt.format(new Date(r.applyTime)) : '-'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {r.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => openProcess(r)}>{t('process')}</Button>
                      )}
                      {(r.status === 'approved' || r.status === 'processing') && (
                        <Button size="sm" variant="outline" onClick={() => openHandle(r)}>{t('handle')}</Button>
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
              <DialogTitle>{action?.mode === 'process' ? t('processTitle') : t('handleTitle')}</DialogTitle>
              <DialogDescription>{action?.mode === 'process' ? t('processDesc') : t('handleDesc')}</DialogDescription>
            </DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            {action && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                <div className="font-mono text-xs">{action.refund.orderNo}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{currencyFmt.format(Number(action.refund.refundAmount))} · {t(`refundStatus_${action.refund.status}`)}</div>
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
      ? (['approved', 'rejected'] as const).map((s) => <SelectItem key={s} value={s}>{t(`refundStatus_${s}`)}</SelectItem>)
      : (['processing', 'completed', 'failed'] as const).map((s) => <SelectItem key={s} value={s}>{t(`refundStatus_${s}`)}</SelectItem>)}
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
              <Button type="button" variant="outline" onClick={close} disabled={mut.isPending}>{tc('cancel')}</Button>
              <Button type="submit" disabled={mut.isPending}>{mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{tc('save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =============================================================================
// 发票申请 Tab
// =============================================================================

const INVOICE_STATUS_TABS: { value: string; labelKey: 'all' | InvoiceAppStatus }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'pending', labelKey: 'pending' },
  { value: 'approved', labelKey: 'approved' },
  { value: 'rejected', labelKey: 'rejected' },
  { value: 'invoicing', labelKey: 'invoicing' },
  { value: 'invoiced', labelKey: 'invoiced' },
  { value: 'canceled', labelKey: 'canceled' },
]

function InvoicesTab({
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
      return api<PageData<EduInvoiceApplication>>(`/api/admin/invoices/applications?${qs.toString()}`)
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
  function close() { if (mut.isPending) return; setTarget(null); setErr(null) }
  function submit(e: React.FormEvent) { e.preventDefault(); setErr(null); mut.mutate() }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const apps = data?.list ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
        {INVOICE_STATUS_TABS.map((tb) => (
          <button
            key={tb.value}
            onClick={() => { setStatus(tb.value); setPage(1) }}
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
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />{t('loading')}</td></tr>
            ) : error ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-destructive">{(error as Error).message}</td></tr>
            ) : apps.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />{t('noInvoices')}</td></tr>
            ) : (
              apps.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {t(`invoiceType_${a.invoiceType}`)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium">{currencyFmt.format(Number(a.amount))}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{a.email ?? '-'}</td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-muted-foreground">{a.remark ?? '-'}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', INVOICE_STATUS_CFG[a.status].cls)}>
                      {t(`invoiceStatus_${a.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{dateFmt.format(new Date(a.createdAt))}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="outline" onClick={() => openStatus(a)}>{t('changeStatus')}</Button>
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
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            {target && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                <div className="font-medium">{currencyFmt.format(Number(target.amount))}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{t(`invoiceType_${target.invoiceType}`)} · {t(`invoiceStatus_${target.status}`)}</div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="inv-status">{t('fieldStatus')}</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as InvoiceAppStatus)}>
  <SelectTrigger className={selectClass}>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {(['pending', 'approved', 'rejected', 'invoicing', 'invoiced', 'canceled'] as const).map((s) => (
      <SelectItem key={s} value={s}>{t(`invoiceStatus_${s}`)}</SelectItem>
    ))}
  </SelectContent>
</Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={mut.isPending}>{tc('cancel')}</Button>
              <Button type="submit" disabled={mut.isPending}>{mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{tc('save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =============================================================================
// 分页(共用)
// =============================================================================

function Pagination({
  page,
  totalPages,
  total,
  setPage,
  t,
}: {
  page: number
  totalPages: number
  total: number
  setPage: (p: number) => void
  t: ReturnType<typeof useTranslations<'admin.orders'>>
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))}>
          <ChevronLeft className="h-4 w-4" />
          {t('prev')}
        </Button>
        <span className="text-sm text-muted-foreground">{t('page', { page, total: totalPages })}</span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
          {t('next')}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
