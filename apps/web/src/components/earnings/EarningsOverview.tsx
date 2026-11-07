// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

  // BUG-91:后端可能返回非 null 却缺字段的对象,旧 `data ?? {…}` 只兜底 data===null,
  // 缺字段时 conversionRate 为 undefined → 裸 .toFixed 抛 TypeError 整块白屏。
  // 逐字段归一到确定数值(任意残缺对象都不再让数值方法裸调 undefined)。
  const d = {
    todayIncome: data?.todayIncome ?? 0,
    todayIncomeTrend: data?.todayIncomeTrend ?? 0,
    byokIncome: data?.byokIncome ?? 0,
    byokIncomeTrend: data?.byokIncomeTrend ?? 0,
    referralCount: data?.referralCount ?? 0,
    referralTrend: data?.referralTrend ?? 0,
    conversionRate: data?.conversionRate ?? 0,
    conversionTrend: data?.conversionTrend ?? 0,
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
      value: `${(d.conversionRate ?? 0).toFixed(1)}%`,
      icon: Percent,
      trend: d.conversionTrend,
      trendLabel: t('vsYesterday'),
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 tablet-min-[1024px]:grid-cols-4">
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
