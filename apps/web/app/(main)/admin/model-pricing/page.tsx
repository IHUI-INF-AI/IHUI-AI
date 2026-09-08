// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 模型定价看板(P3-9 成本真网计价):GET /api/model-pricing 单一价目源全量快照 —
// 模型级价目(前缀特异性排序)/厂商级兜底/运行时覆盖/覆盖率统计。
// 后端:ai-service routers/model_pricing_api.py(全局 JWT,信封契约)。

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowLeft, BadgeCheck, Boxes, Coins, Layers, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'

interface PriceEntry {
  model: string
  input: number
  output: number
}

interface PricingSnapshot {
  models: PriceEntry[]
  providers: Record<string, { input: number; output: number }>
  overrides: Record<string, { input: number; output: number }>
  coverage: { model_count: number; provider_count: number; override_count: number }
  meta: { source: string; note: string }
}

const fmtPrice = (v: number) => (v === 0 ? '$0' : `$${v.toFixed(v < 0.1 ? 3 : 2)}`)

export default function ModelPricingPage() {
  const t = useTranslations('adminModelPricing')
  const [tab, setTab] = React.useState<'models' | 'providers' | 'overrides'>('models')
  const { data, isLoading } = useQuery({
    queryKey: ['model-pricing'],
    queryFn: async () => {
      const res = await fetchApi<PricingSnapshot>('/api/model-pricing')
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    refetchInterval: 60_000,
  })

  const coverage = data?.coverage
  const rows: PriceEntry[] =
    tab === 'models'
      ? (data?.models ?? [])
      : tab === 'providers'
        ? Object.entries(data?.providers ?? {}).map(([model, p]) => ({ model, ...p }))
        : Object.entries(data?.overrides ?? {}).map(([model, p]) => ({ model, ...p }))

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/ai-cost"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t('backToCost')}
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <Coins className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        {coverage && (
          <span className="ml-2 inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">
            <BadgeCheck className="h-3 w-3" />
            {t('coverage', {
              models: coverage.model_count,
              providers: coverage.provider_count,
              overrides: coverage.override_count,
            })}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{data?.meta.note ?? t('subtitle')}</p>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border py-16 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> {t('loading')}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" /> {t('modelCount')}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-bold">{data.coverage.model_count}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Boxes className="h-3.5 w-3.5" /> {t('providerCount')}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-bold">
                {data.coverage.provider_count}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <BadgeCheck className="h-3.5 w-3.5" /> {t('overrideCount')}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-bold">
                {data.coverage.override_count}
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-2">
            {(['models', 'providers', 'overrides'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  tab === k ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'
                }`}
              >
                {t(k)}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">{t('name')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('inputPrice')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('outputPrice')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.model} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{row.model}</td>
                    <td className="px-4 py-2 text-right">{fmtPrice(row.input)}</td>
                    <td className="px-4 py-2 text-right">{fmtPrice(row.output)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                      {t('empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">{t('unitNote')}</p>
        </>
      )}
    </div>
  )
}
