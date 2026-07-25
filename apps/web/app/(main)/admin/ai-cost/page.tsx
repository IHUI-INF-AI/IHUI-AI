'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Coins, TrendingUp, Database, BarChart3, Zap, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { formatNumber as fmtNum } from '@/lib/date-utils'

interface AiCostSummary {
  totalCost: string | number
  totalTokens: number
  totalCalls: number
  cacheHitRate: number
}

interface ByModel {
  model: string
  cost: string | number
  tokens: number
  calls: number
}

interface ByDay {
  date: string
  cost: string | number
  tokens: number
  calls: number
}

interface AiCostDashboard {
  summary: AiCostSummary
  byModel: ByModel[]
  byDay: ByDay[]
  period: { startDate: string; endDate: string }
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY: AiCostDashboard = {
  summary: { totalCost: 0, totalTokens: 0, totalCalls: 0, cacheHitRate: 0 },
  byModel: [],
  byDay: [],
  period: { startDate: '', endDate: '' },
}

export default function AiCostPage() {
  const t = useTranslations('aiCost')
  const locale = useLocale()
  const [days, setDays] = React.useState(7)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'ai-cost', days],
    queryFn: () =>
      api<AiCostDashboard>(
        `/api/admin/ai/cost/dashboard?startDate=${new Date(Date.now() - days * 86400_000).toISOString()}&endDate=${new Date().toISOString()}`,
      ).catch(() => EMPTY),
    retry: false,
  })

  const d = data ?? EMPTY
  const curFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' })
  const totalCost = Number(d.summary.totalCost ?? 0) / 100

  const cards = [
    {
      key: 'totalCost',
      label: t('totalCost'),
      value: curFmt.format(totalCost),
      icon: Coins,
      cls: 'text-emerald-600',
    },
    {
      key: 'totalTokens',
      label: t('totalTokens'),
      value: fmtNum(d.summary.totalTokens ?? 0),
      icon: Database,
      cls: 'text-blue-600',
    },
    {
      key: 'totalCalls',
      label: t('totalCalls'),
      value: fmtNum(d.summary.totalCalls ?? 0),
      icon: Zap,
      cls: 'text-amber-600',
    },
    {
      key: 'cacheHit',
      label: t('cacheHitRate'),
      value: `${d.summary.cacheHitRate ?? 0}%`,
      icon: TrendingUp,
      cls: 'text-purple-600',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Coins className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <select
          aria-label={t('rangeLabel')}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value={1}>{t('range1d')}</option>
          <option value={7}>{t('range7d')}</option>
          <option value={30}>{t('range30d')}</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : isError || !data ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Database className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
            <p className="text-xs text-muted-foreground/70">{t('emptyHint')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => {
              const Icon = c.icon
              return (
                <Card key={c.key}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className={cn('rounded-md p-2', c.cls)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{c.label}</p>
                      <p className="text-xl font-semibold tabular-nums">{c.value}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4" />
                  {t('byModel')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {d.byModel.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t('noModelData')}
                  </p>
                ) : (
                  <ul className="divide-y">
                    {d.byModel.slice(0, 10).map((m) => (
                      <li
                        key={m.model}
                        className="flex items-center justify-between py-2 text-sm"
                      >
                        <span className="font-mono text-xs">{m.model}</span>
                        <span className="flex items-center gap-3 tabular-nums text-muted-foreground">
                          <span>{fmtNum(m.tokens)} tk</span>
                          <span className="text-foreground">
                            {curFmt.format(Number(m.cost) / 100)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" />
                  {t('byDay')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {d.byDay.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t('noDayData')}
                  </p>
                ) : (
                  <ul className="divide-y">
                    {d.byDay.slice(-10).map((row) => (
                      <li
                        key={row.date}
                        className="flex items-center justify-between py-2 text-sm"
                      >
                        <span className="font-mono text-xs">{row.date}</span>
                        <span className="flex items-center gap-3 tabular-nums text-muted-foreground">
                          <span>{fmtNum(row.tokens)} tk</span>
                          <span>{fmtNum(row.calls)} {t('calls')}</span>
                          <span className="text-foreground">
                            {curFmt.format(Number(row.cost) / 100)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
