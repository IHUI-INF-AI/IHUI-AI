'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Wallet, CircleDollarSign, CheckCircle2, Hourglass } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@ihui/ui'

import { SettlementFilter } from './SettlementFilter'
import { SettlementTable } from './SettlementTable'
import { PAGE_SIZE, api, fetchSettlements, createMoneyFmt } from './helpers'
import type { Settlement, SettlementSummary } from './types'

export default function AdminSettlementPage() {
  const t = useTranslations('admin.agents.settlement')
  const locale = useLocale()
  const qc = useQueryClient()

  const [status, setStatus] = React.useState('all')
  const [agentId, setAgentId] = React.useState('')
  const [orderNo, setOrderNo] = React.useState('')
  const [page, setPage] = React.useState(1)

  const { data: summary } = useQuery({
    queryKey: ['admin', 'agents', 'settlement', 'summary'],
    queryFn: () => api<SettlementSummary>('/api/settlement/summary'),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'agents', 'settlement', status, agentId, orderNo, page],
    queryFn: () => fetchSettlements({ page, status, agentId, orderNo }),
  })

  const settleMut = useMutation({
    mutationFn: (id: string) =>
      api<Settlement>('/api/settlement/settle', {
        method: 'POST',
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      toast.success(t('settleSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'agents', 'settlement'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const records = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const fmtAmount = createMoneyFmt(locale)

  const summaryCards = [
    {
      key: 'totalAmount',
      value: summary?.totalAmount ?? 0,
      icon: CircleDollarSign,
      cls: 'text-primary',
    },
    {
      key: 'settledAmount',
      value: summary?.settledAmount ?? 0,
      icon: CheckCircle2,
      cls: 'text-emerald-500',
    },
    {
      key: 'pendingAmount',
      value: summary?.pendingAmount ?? 0,
      icon: Hourglass,
      cls: 'text-amber-500',
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Wallet className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {summaryCards.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.key} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t(`summary_${s.key}`)}</span>
                <Icon className={cn('h-4 w-4', s.cls)} />
              </div>
              <p className="mt-2 text-2xl font-bold">{fmtAmount(s.value)}</p>
            </div>
          )
        })}
      </div>

      <SettlementFilter
        orderNo={orderNo}
        setOrderNo={(v) => {
          setOrderNo(v)
          setPage(1)
        }}
        agentId={agentId}
        setAgentId={(v) => {
          setAgentId(v)
          setPage(1)
        }}
        status={status}
        setStatus={(v) => {
          setStatus(v)
          setPage(1)
        }}
      />

      <SettlementTable
        list={records}
        isLoading={isLoading}
        error={error}
        settlePending={settleMut.isPending}
        onSettle={(id) => settleMut.mutate(id)}
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
    </div>
  )
}
