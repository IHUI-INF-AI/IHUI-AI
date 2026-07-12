'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { AlertCircle } from 'lucide-react'

import { PageHeader } from '@/components/layout'
import { EMPTY_STATS, fetchDetailedStats } from './helpers'
import { AdminStatCards } from './AdminStatCards'
import { AdminOverviewCharts } from './AdminOverviewCharts'
import { AdminDistributionCharts } from './AdminDistributionCharts'
import { AdminExtraCharts } from './AdminExtraCharts'

export default function AdminDashboardPage() {
  const t = useTranslations('dashboard.admin')
  const locale = useLocale()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'stats', 'detailed'],
    queryFn: fetchDetailedStats,
    retry: false,
  })

  const stats = data ?? EMPTY_STATS
  const numFmt = new Intl.NumberFormat(locale)
  const curFmt = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          isError ? (
            <span className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-600 dark:text-amber-500">
              <AlertCircle className="h-3 w-3" />
              {t('loadFailed')}
            </span>
          ) : undefined
        }
      />

      <AdminStatCards stats={stats} isLoading={isLoading} numFmt={numFmt} />

      <AdminOverviewCharts stats={stats} numFmt={numFmt} />

      <AdminDistributionCharts stats={stats} numFmt={numFmt} curFmt={curFmt} />

      <AdminExtraCharts stats={stats} />
    </div>
  )
}
