// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { AlertCircle, ArrowLeft, Database, Gauge, Layers, Loader2, Wallet, Zap } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { EMPTY_GOVERNANCE, PillarSection, TrendSection } from './AgentGovernanceSections'
import type { AgentGovernance, TrendDay } from './AgentGovernanceSections'

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const pct = (v: number | null | undefined): string =>
  v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`

export default function AgentGovernancePage() {
  const t = useTranslations('agentGovernance')
  const locale = useLocale()
  const numFmt = React.useMemo(() => new Intl.NumberFormat(locale), [locale])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'agent-governance'],
    queryFn: () => api<AgentGovernance>('/api/v1/ai/usage/agent').catch(() => null),
    retry: false,
    staleTime: 30_000,
  })

  const d = data ?? EMPTY_GOVERNANCE
  const degraded = d.degraded_model ? String(d.degraded_model) : null
  const trend: TrendDay[] = d.trend ?? []
  const today = trend.length > 0 ? trend[trend.length - 1] : null
  const byPillar = today?.by_pillar ?? {}

  const cards = [
    {
      key: 'usage',
      label: t('usagePercent'),
      value: pct(d.usage_percent),
      icon: Gauge,
      cls: 'text-primary',
    },
    {
      key: 'today',
      label: t('todayTokens'),
      value: numFmt.format(d.today_tokens ?? 0),
      icon: Zap,
      cls: 'text-amber-600 dark:text-amber-400',
    },
    {
      key: 'pillarUsage',
      label: t('pillarUsage'),
      value: pct(d.pillar_usage_percent),
      icon: Layers,
      cls: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      key: 'remaining',
      label: t('remainingTokens'),
      value: numFmt.format(d.remaining_tokens ?? 0),
      icon: Wallet,
      cls: 'text-purple-600 dark:text-purple-400',
    },
  ]

  return (
    <div className="space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Gauge className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex h-6 items-center rounded-md px-2 text-xs font-medium',
              d.enabled
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {d.enabled ? t('enabledBadge') : t('disabledBadge')}
          </span>
          <Link
            href="/admin/ai-cost"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm hover:bg-muted/50"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t('backToCost')}</span>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : !data ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Database className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
            <p className="text-xs text-muted-foreground/70">{t('emptyHint')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {degraded && (
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-md bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t('degradedOn')}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{degraded}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
            {cards.map((c) => {
              const Icon = c.icon
              return (
                <Card key={c.key}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className={cn('rounded-md bg-muted p-2', c.cls)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs text-muted-foreground">{c.label}</p>
                      <p className="text-xl font-semibold tabular-nums">{c.value}</p>
                      {c.key === 'pillarUsage' && (
                        <p className="truncate font-mono text-[10px] text-muted-foreground">
                          {d.pillar}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-2">
            <TrendSection trend={trend} />
            <PillarSection byPillar={byPillar} />
          </div>
        </>
      )}
    </div>
  )
}
