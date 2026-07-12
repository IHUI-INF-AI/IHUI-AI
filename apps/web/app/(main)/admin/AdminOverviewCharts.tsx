'use client'

import { useTranslations } from 'next-intl'
import { TrendingUp, Folder } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { MiniChart } from '@/components/dashboard/mini-chart'
import { buildConic, RING_COLORS } from './helpers'
import type { DetailedStats } from './types'

interface Props {
  stats: DetailedStats
  numFmt: Intl.NumberFormat
}

export function AdminOverviewCharts({ stats, numFmt }: Props) {
  const t = useTranslations('dashboard.admin')
  const statusItems = stats.projectStatus.map((s) => ({
    label: t(`projectStatus.${s.key}`),
    value: s.value,
  }))
  const statusTotal = statusItems.reduce((s, x) => s + x.value, 0)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            {t('userGrowth')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t('userGrowthHint')}</p>
        </CardHeader>
        <CardContent>
          <MiniChart data={stats.userGrowth} height={140} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Folder className="h-4 w-4 text-primary" />
            {t('projectStatusTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div
              className="relative h-28 w-28 shrink-0 rounded-full"
              style={{ background: buildConic(statusItems) }}
            >
              <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-card">
                <span className="text-lg font-bold">{numFmt.format(statusTotal)}</span>
                <span className="text-[10px] text-muted-foreground">{t('totalLabel')}</span>
              </div>
            </div>
            <ul className="flex-1 space-y-2">
              {statusItems.map((s, i) => (
                <li key={s.label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: RING_COLORS[i % RING_COLORS.length] }}
                    />
                    {s.label}
                  </span>
                  <span className="font-medium">{numFmt.format(s.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
