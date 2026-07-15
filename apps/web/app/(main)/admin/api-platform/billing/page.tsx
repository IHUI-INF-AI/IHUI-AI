'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Receipt, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'

import { BillingSummaryCards } from './BillingSummaryCards'
import { BillingRecordsTable } from './BillingRecordsTable'
import { selectClass, api } from './helpers'
import type { BillingRecord, BillingSummary } from './types'

export default function AdminApiPlatformBillingPage() {
  const t = useTranslations('adminApiBilling')
  const [type, setType] = React.useState('all')
  const [status, setStatus] = React.useState('all')

  const { data: summary } = useQuery({
    queryKey: ['admin', 'api-platform', 'billing', 'summary'],
    queryFn: () => api<BillingSummary>('/api/admin/api-platform/billing/summary'),
  })

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['admin', 'api-platform', 'billing', type, status],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (type !== 'all') qs.set('type', type)
      if (status !== 'all') qs.set('status', status)
      return api<{ list: BillingRecord[] }>(
        `/api/admin/api-platform/billing?${qs.toString()}`,
      ).then((d) => d.list ?? [])
    },
  })

  const cards = [
    {
      label: t('totalRecharge'),
      value: summary?.totalRecharge ?? 0,
      icon: TrendingUp,
      cls: 'text-emerald-600',
    },
    {
      label: t('totalConsume'),
      value: summary?.totalConsume ?? 0,
      icon: TrendingDown,
      cls: 'text-amber-600',
    },
    {
      label: t('totalRefund'),
      value: summary?.totalRefund ?? 0,
      icon: Receipt,
      cls: 'text-red-600',
    },
    { label: t('balance'), value: summary?.balance ?? 0, icon: Wallet, cls: 'text-primary' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Receipt className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <BillingSummaryCards cards={cards} />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className={selectClass} aria-label={t('ariaType')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('typeAll')}</SelectItem>
            <SelectItem value="recharge">{t('typeRecharge')}</SelectItem>
            <SelectItem value="consume">{t('typeConsume')}</SelectItem>
            <SelectItem value="refund">{t('typeRefund')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className={selectClass} aria-label={t('ariaStatus')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('statusAll')}</SelectItem>
            <SelectItem value="pending">{t('statusPending')}</SelectItem>
            <SelectItem value="success">{t('statusSuccess')}</SelectItem>
            <SelectItem value="failed">{t('statusFailed')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <BillingRecordsTable list={records} isLoading={isLoading} />
    </div>
  )
}
