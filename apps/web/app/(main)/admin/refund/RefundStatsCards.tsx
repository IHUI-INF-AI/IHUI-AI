'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { api } from './helpers'
import type { RefundStats } from './types'

interface RefundStatsCardsProps {
  currencyFmt: Intl.NumberFormat
}

export function RefundStatsCards({ currencyFmt }: RefundStatsCardsProps) {
  const t = useTranslations('admin.refund')
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'refund', 'stats'],
    queryFn: () => api<RefundStats>('/api/admin/refunds/stats'),
  })

  const cards = [
    { label: t('statsTotal'), value: data?.totalCount ?? 0, cls: 'text-foreground' },
    {
      label: t('statsAmount'),
      value: currencyFmt.format(Number(data?.totalAmount ?? 0)),
      cls: 'text-foreground',
    },
    {
      label: t('statsPending'),
      value: data?.pendingCount ?? 0,
      cls: 'text-amber-600 dark:text-amber-500',
    },
    {
      label: t('statsApproved'),
      value: data?.approvedCount ?? 0,
      cls: 'text-emerald-600 dark:text-emerald-500',
    },
    {
      label: t('statsRejected'),
      value: data?.rejectedCount ?? 0,
      cls: 'text-red-600 dark:text-red-500',
    },
    {
      label: t('statsCompleted'),
      value: data?.completedCount ?? 0,
      cls: 'text-emerald-600 dark:text-emerald-500',
    },
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
