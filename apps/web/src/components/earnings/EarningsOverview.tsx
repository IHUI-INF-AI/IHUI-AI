'use client'

/**
 * 挣钱中心概览 — 4 个核心指标卡片
 * 今日收入 / BYOK 抽成 / 引流数 / 转化率
 */
import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Wallet, TrendingUp, Users, Percent } from 'lucide-react'

import { StatCard } from '@/components/data'
import type { EarningsOverview as EarningsOverviewData } from '@/hooks/use-earnings'

interface Props {
  data: EarningsOverviewData | null
  loading: boolean
}

export function EarningsOverview({ data, loading }: Props) {
  const t = useTranslations('earnings')
  const locale = useLocale()
  const currencyFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' })
  const numFmt = new Intl.NumberFormat(locale)

  const d = data ?? {
    todayIncome: 0,
    todayIncomeTrend: 0,
    byokIncome: 0,
    byokIncomeTrend: 0,
    referralCount: 0,
    referralTrend: 0,
    conversionRate: 0,
    conversionTrend: 0,
  }

  const cards = [
    {
      title: t('todayIncome'),
      value: currencyFmt.format(d.todayIncome),
      icon: Wallet,
      trend: d.todayIncomeTrend,
      trendLabel: t('vsYesterday'),
    },
    {
      title: t('byokIncome'),
      value: currencyFmt.format(d.byokIncome),
      icon: TrendingUp,
      trend: d.byokIncomeTrend,
      trendLabel: t('vsYesterday'),
    },
    {
      title: t('referralCount'),
      value: numFmt.format(d.referralCount),
      icon: Users,
      trend: d.referralTrend,
      trendLabel: t('vsYesterday'),
    },
    {
      title: t('conversionRate'),
      value: `${d.conversionRate.toFixed(1)}%`,
      icon: Percent,
      trend: d.conversionTrend,
      trendLabel: t('vsYesterday'),
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 tablet-lg:grid-cols-4">
      {cards.map((c) => (
        <StatCard
          key={c.title}
          title={c.title}
          value={c.value}
          icon={c.icon}
          trend={c.trend}
          trendLabel={c.trendLabel}
          loading={loading}
        />
      ))}
    </div>
  )
}
