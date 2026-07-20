'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Banknote, ChevronLeft, ChevronRight, Check, X, Search } from 'lucide-react'
import { Input, Button } from '@ihui/ui'
import { Skeleton } from '@/components/ui/skeleton'
import { TruncatedText } from '@/components/common'
import { fetchApi } from '@/lib/api'
import { useWithdrawalMachine } from '@/lib/workflows'
import type { Withdrawal, WithdrawalListData, WithdrawalStatus } from './types'

const PAGE_SIZE = 20
const STATUS_OPTIONS: WithdrawalStatus[] = ['pending', 'approved', 'rejected', 'paid']
const STATUS_CLASS: Record<WithdrawalStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
  paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
}

export default function AdminWithdrawalPage() {
  const t = useTranslations('admin.withdrawal')
  const locale = useLocale()
  const qc = useQueryClient()
  const { can } = useWithdrawalMachine()
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState<WithdrawalStatus | 'all'>('pending')
  const [page, setPage] = React.useState(1)

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
  if (search) qs.set('keyword', search)
  if (status !== 'all') qs.set('status', status)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'withdrawal', search, status, page],
    queryFn: async () => {
      const r = await fetchApi<WithdrawalListData>(`/api/v1/admin/finance/withdrawal?${qs.toString()}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const auditMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { status: 'approved' | 'rejected'; remark?: string } }) =>
      fetchApi(`/api/v1/admin/finance/withdrawal/${id}/audit`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: (_d, vars) => {
      toast.success(t(vars.body.status === 'approved' ? 'approveSuccess' : 'rejectSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'withdrawal'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function handleAudit(w: Withdrawal, next: 'approved' | 'rejected') {
    if (auditMut.isPending) return
    const defaultRemark = next === 'rejected' ? t('defaultRejectRemark') : ''
    const remark = typeof window !== 'undefined' ? window.prompt(t('remarkPrompt'), defaultRemark) : null
    if (remark === null) return
    auditMut.mutate({ id: w.id, body: { status: next, remark: remark.trim() || undefined } })
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' })
  const num = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Banknote className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={t('searchPlaceholder')}
            className="pl-8"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as WithdrawalStatus | 'all')
            setPage(1)
          }}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="all">{t('statusAll')}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}` as 'status.pending')}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">{t('colUser')}</th>
              <th className="px-3 py-2 text-right">{t('colAmount')}</th>
              <th className="px-3 py-2 text-left">{t('colChannel')}</th>
              <th className="px-3 py-2 text-left">{t('colStatus')}</th>
              <th className="px-3 py-2 text-left">{t('colRemark')}</th>
              <th className="px-3 py-2 text-left">{t('colCreated')}</th>
              <th className="px-3 py-2 text-right">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-t border-border">
                  <td colSpan={7} className="px-3 py-2"><Skeleton className="h-6 w-full" /></td>
                </tr>
              ))
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  {t('empty')}
                </td>
              </tr>
            ) : (
              list.map((w: Withdrawal) => (
                <tr key={w.id} className="border-t border-border">
                  <td className="px-3 py-2">{w.userName ?? w.userId}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{num.format(w.amount)}</td>
                  <td className="px-3 py-2">{w.channel}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-md px-2 py-0.5 text-xs ${STATUS_CLASS[w.status]}`}>
                      {t(`status.${w.status}` as 'status.pending')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    <TruncatedText value={w.remark ?? '—'} className="max-w-[200px]" />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{fmt.format(new Date(w.createdAt))}</td>
                  <td className="px-3 py-2 text-right">
                    {w.status === 'pending' ? (
                      <div className="inline-flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={auditMut.isPending || !can({ type: 'APPROVE' })}
                          onClick={() => handleAudit(w, 'approved')}
                        >
                          <Check className="h-3.5 w-3.5" />
                          {t('approve')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={auditMut.isPending || !can({ type: 'REJECT' })}
                          onClick={() => handleAudit(w, 'rejected')}
                        >
                          <X className="h-3.5 w-3.5" />
                          {t('reject')}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
