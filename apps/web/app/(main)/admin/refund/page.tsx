'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
  X,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Label } from '@ihui/ui'
import { cn } from '@/lib/utils'

// =============================================================================
// 类型定义
// =============================================================================

type RefundStatus = 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed'

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

interface PageData<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

interface RefundStats {
  byStatus: Record<string, { count: number; totalAmount: string }>
  totalCount: number
  totalAmount: string
  pendingCount: number
  approvedCount: number
  rejectedCount: number
  completedCount: number
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

const REFUND_STATUS_CFG: Record<RefundStatus, { cls: string; dot: string }> = {
  pending: { cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500', dot: 'bg-amber-500' },
  approved: { cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-500', dot: 'bg-blue-500' },
  rejected: { cls: 'bg-red-500/10 text-red-600 dark:text-red-500', dot: 'bg-red-500' },
  processing: { cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-500', dot: 'bg-purple-500' },
  completed: { cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500', dot: 'bg-emerald-500' },
  failed: { cls: 'bg-red-500/10 text-red-600 dark:text-red-500', dot: 'bg-red-500' },
}

const STATUS_TABS: { value: string; labelKey: 'all' | RefundStatus }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'pending', labelKey: 'pending' },
  { value: 'approved', labelKey: 'approved' },
  { value: 'rejected', labelKey: 'rejected' },
  { value: 'processing', labelKey: 'processing' },
  { value: 'completed', labelKey: 'completed' },
  { value: 'failed', labelKey: 'failed' },
]

const textareaClass = 'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

// =============================================================================
// 主组件
// =============================================================================

export default function AdminRefundPage() {
  const t = useTranslations('admin.refund')
  const tc = useTranslations('common')
  const locale = useLocale()

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

      <StatsCards t={t} currencyFmt={currencyFmt} />
      <RefundList t={t} tc={tc} dateFmt={dateFmt} currencyFmt={currencyFmt} />
    </div>
  )
}

// =============================================================================
// 统计卡片
// =============================================================================

function StatsCards({
  t,
  currencyFmt,
}: {
  t: ReturnType<typeof useTranslations<'admin.refund'>>
  currencyFmt: Intl.NumberFormat
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'refund', 'stats'],
    queryFn: () => api<RefundStats>('/api/admin/refunds/stats'),
  })

  const cards = [
    { label: t('statsTotal'), value: data?.totalCount ?? 0, cls: 'text-foreground' },
    { label: t('statsAmount'), value: currencyFmt.format(Number(data?.totalAmount ?? 0)), cls: 'text-foreground' },
    { label: t('statsPending'), value: data?.pendingCount ?? 0, cls: 'text-amber-600 dark:text-amber-500' },
    { label: t('statsApproved'), value: data?.approvedCount ?? 0, cls: 'text-blue-600 dark:text-blue-500' },
    { label: t('statsRejected'), value: data?.rejectedCount ?? 0, cls: 'text-red-600 dark:text-red-500' },
    { label: t('statsCompleted'), value: data?.completedCount ?? 0, cls: 'text-emerald-600 dark:text-emerald-500' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">{c.label}</div>
          <div className={cn('mt-1 text-xl font-bold tabular-nums', c.cls)}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : c.value}
          </div>
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// 退款列表
// =============================================================================

function RefundList({
  t,
  tc,
  dateFmt,
  currencyFmt,
}: {
  t: ReturnType<typeof useTranslations<'admin.refund'>>
  tc: ReturnType<typeof useTranslations<'common'>>
  dateFmt: Intl.DateTimeFormat
  currencyFmt: Intl.NumberFormat
}) {
  const qc = useQueryClient()
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [searchInput, setSearchInput] = React.useState('')
  const [action, setAction] = React.useState<{ refund: EduRefund; mode: 'audit' | 'reject' } | null>(null)
  const [reason, setReason] = React.useState('')
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'refund', 'list', status, page, search],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (status !== 'all') qs.set('status', status)
      if (search) qs.set('orderNo', search)
      return api<PageData<EduRefund>>(`/api/refunds?${qs.toString()}`)
    },
  })

  const mut = useMutation({
    mutationFn: () => {
      const url =
        action!.mode === 'audit'
          ? `/api/refunds/${action!.refund.id}/audit`
          : `/api/refunds/${action!.refund.id}/reject`
      const body: Record<string, unknown> =
        action!.mode === 'audit'
          ? { action: 'reject', reason: reason.trim() || undefined }
          : { reason: reason.trim() || undefined }
      return api(url, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'refund'] })
      setAction(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  function openAudit(r: EduRefund) {
    setAction({ refund: r, mode: 'audit' })
    setReason(r.processMessage ?? '')
    setErr(null)
  }
  function openReject(r: EduRefund) {
    setAction({ refund: r, mode: 'reject' })
    setReason('')
    setErr(null)
  }
  function close() { if (mut.isPending) return; setAction(null); setErr(null) }
  function submit(e: React.FormEvent) { e.preventDefault(); setErr(null); mut.mutate() }

  function doSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const refunds = data?.list ?? []

  // audit 弹窗中 approve 走单独的乐观调用
  const approveMut = useMutation({
    mutationFn: () =>
      api(`/api/refunds/${action!.refund.id}/audit`, {
        method: 'POST',
        body: JSON.stringify({ action: 'approve', reason: reason.trim() || undefined }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'refund'] })
      setAction(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  return (
    <div className="space-y-4">
      {/* 状态筛选 */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
        {STATUS_TABS.map((tb) => (
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

      {/* 搜索 */}
      <form onSubmit={doSearch} className="flex items-center gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button type="submit" variant="outline" size="sm">{t('search')}</Button>
      </form>

      {/* 列表表格 */}
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
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><RotateCcw className="mx-auto mb-2 h-8 w-8 opacity-40" />{t('noData')}</td></tr>
            ) : (
              refunds.map((r) => {
                const sc = REFUND_STATUS_CFG[r.status]
                return (
                  <tr key={r.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/admin/refund/${r.id}`} className="hover:underline">{r.orderNo}</Link>
                    </td>
                    <td className="px-4 py-2.5 font-medium">{currencyFmt.format(Number(r.refundAmount))}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{t(`refundType_${r.refundType}`)}</td>
                    <td className="max-w-xs truncate px-4 py-2.5 text-muted-foreground">{r.reason ?? '-'}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', sc.cls)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
                        {t(`status_${r.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.applyTime ? dateFmt.format(new Date(r.applyTime)) : '-'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {r.status === 'pending' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => openAudit(r)}>
                              <Check className="mr-1 h-3.5 w-3.5" />{t('approve')}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openReject(r)}>
                              <X className="mr-1 h-3.5 w-3.5" />{t('reject')}
                            </Button>
                          </>
                        )}
                        <Link href={`/admin/refund/${r.id}`}>
                          <Button size="sm" variant="ghost">{t('view')}</Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
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

      {/* 审核/驳回弹窗 */}
      <Dialog open={!!action} onOpenChange={(o) => (!o && !mut.isPending && !approveMut.isPending ? close() : null)}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{action?.mode === 'audit' ? t('auditTitle') : t('rejectTitle')}</DialogTitle>
              <DialogDescription>{action?.mode === 'audit' ? t('auditDesc') : t('rejectDesc')}</DialogDescription>
            </DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            {action && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                <div className="font-mono text-xs">{action.refund.orderNo}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {currencyFmt.format(Number(action.refund.refundAmount))} · {t(`status_${action.refund.status}`)}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="r-reason">{t('fieldReason')}</Label>
              <textarea
                id="r-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('reasonPlaceholder')}
                rows={3}
                className={textareaClass}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={mut.isPending || approveMut.isPending}>
                {tc('cancel')}
              </Button>
              {action?.mode === 'audit' ? (
                <>
                  <Button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setErr(null); approveMut.mutate() }}
                    disabled={approveMut.isPending}
                  >
                    {approveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Check className="mr-1 h-4 w-4" />{t('approve')}
                  </Button>
                  <Button type="submit" variant="destructive" disabled={mut.isPending}>
                    {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    <X className="mr-1 h-4 w-4" />{t('reject')}
                  </Button>
                </>
              ) : (
                <Button type="submit" variant="destructive" disabled={mut.isPending}>
                  {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('reject')}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
