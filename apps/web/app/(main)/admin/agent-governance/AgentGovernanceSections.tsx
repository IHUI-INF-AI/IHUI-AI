// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Layers, TrendingUp } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'

export interface PillarUsage {
  tokens?: number
  cost?: number
  calls?: number
}
export interface TrendDay {
  date: string
  tokens: number
  cost?: number
  by_pillar?: Record<string, PillarUsage>
}
export interface AgentGovernance {
  enabled: boolean
  pillar: string
  usage_percent: number
  today_tokens: number
  pillar_usage_percent: number
  remaining_tokens: number
  degraded_model?: string | null
  trend?: TrendDay[]
  error?: string
}
export const EMPTY_GOVERNANCE: AgentGovernance = {
  enabled: false,
  pillar: 'terminal',
  usage_percent: 0,
  today_tokens: 0,
  pillar_usage_percent: 0,
  remaining_tokens: 0,
}

function useFmt(locale: string) {
  const numFmt = React.useMemo(() => new Intl.NumberFormat(locale), [locale])
  const dayFmt = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
    [locale],
  )
  return { numFmt, dayFmt }
}

export function TrendSection({ trend }: { trend: TrendDay[] }) {
  const t = useTranslations('agentGovernance')
  const locale = useLocale()
  const { numFmt, dayFmt } = useFmt(locale)
  const maxTokens = Math.max(...trend.map((r) => Number(r.tokens) || 0), 1)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          {t('trendTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {trend.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('pillarEmpty')}</p>
        ) : (
          trend.map((row) => (
            <div key={row.date} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs">{dayFmt.format(new Date(row.date))}</span>
                <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">
                  {numFmt.format(Number(row.tokens) || 0)} {t('tokenShort')}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-sm bg-muted">
                <div
                  className="h-full rounded-sm bg-primary/60"
                  style={{ width: `${((Number(row.tokens) || 0) / maxTokens) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

export function PillarSection({ byPillar }: { byPillar: Record<string, PillarUsage> }) {
  const t = useTranslations('agentGovernance')
  const locale = useLocale()
  const { numFmt } = useFmt(locale)
  const pillars = Object.entries(byPillar)
    .filter(([, p]) => (p.tokens ?? 0) > 0)
    .sort((a, b) => (b[1].tokens ?? 0) - (a[1].tokens ?? 0))
  const maxPillar = Math.max(...pillars.map(([, p]) => p.tokens ?? 0), 1)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4" />
          {t('byPillarTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {pillars.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('pillarEmpty')}</p>
        ) : (
          pillars.map(([name, p]) => (
            <div key={name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{name}</span>
                <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">
                  {numFmt.format(p.tokens ?? 0)} {t('tokenShort')}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-sm bg-muted">
                <div
                  className="h-full rounded-sm bg-emerald-500/60 dark:bg-emerald-400/60"
                  style={{ width: `${((p.tokens ?? 0) / maxPillar) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
