'use client'

import { useTranslations } from 'next-intl'
import { TrendingUp, ShoppingCart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { RadarChart } from '@/components/charts/RadarChart'
import { LineChart } from '@/components/charts/LineChart'
import { PieChart } from '@/components/charts/PieChart'
import { RADAR_DATA, LINE_DAYS, EXPECTED_DATA, ACTUAL_DATA } from './helpers'
import type { DetailedStats } from './types'

interface Props {
  stats: DetailedStats
}

export function AdminExtraCharts({ stats }: Props) {
  const t = useTranslations('dashboard.admin')
  const te = useTranslations('admin.extraCharts')

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              {te('abilityRadar')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <RadarChart data={RADAR_DATA} size={260} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              {te('weeklyTrend')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Expected</p>
                <LineChart
                  data={EXPECTED_DATA}
                  xAxis={LINE_DAYS}
                  color="var(--color-rose-500)"
                  height={160}
                />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Actual</p>
                <LineChart data={ACTUAL_DATA} xAxis={LINE_DAYS} height={160} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4 text-primary" />
            {t('orderStatusDistribution')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t('orderStatusDistributionHint')}</p>
        </CardHeader>
        <CardContent className="flex justify-center">
          <PieChart
            donut
            size={220}
            data={[
              { label: t('paidCount'), value: stats.orderStats.paidCount, color: '#10b981' },
              { label: t('pendingCount'), value: stats.orderStats.pendingCount, color: '#f59e0b' },
              {
                label: t('otherOrders'),
                value: Math.max(
                  0,
                  stats.orderStats.totalCount -
                    stats.orderStats.paidCount -
                    stats.orderStats.pendingCount,
                ),
                color: '#94a3b8',
              },
            ]}
          />
        </CardContent>
      </Card>
    </>
  )
}
