import { getTranslations } from 'next-intl/server'
import { BarChart3, Clock, DollarSign, Zap } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

export default async function UsagePage() {
  const t = await getTranslations('models')

  const summary = [
    { icon: Zap, label: t('usage.summary.calls'), value: '12,847', change: '+15.3%' },
    { icon: BarChart3, label: t('usage.summary.tokens'), value: '8.42M', change: '+22.1%' },
    { icon: DollarSign, label: t('usage.summary.cost'), value: '¥ 285.40', change: '+8.7%' },
    { icon: Clock, label: t('usage.summary.avgLatency'), value: '856ms', change: '-12.4%' },
  ]

  const byModel = [
    { model: 'GPT-4o', calls: 3854, tokens: 2840000, cost: 142.5, pct: 49.9 },
    { model: 'Claude 3.5 Sonnet', calls: 2487, tokens: 1850000, cost: 78.4, pct: 27.5 },
    { model: 'Gemini 2.0 Flash', calls: 1923, tokens: 1450000, cost: 24.3, pct: 8.5 },
    { model: 'DeepSeek V3', calls: 1654, tokens: 1240000, cost: 18.6, pct: 6.5 },
    { model: 'Qwen Max', calls: 1287, tokens: 890000, cost: 12.4, pct: 4.3 },
    { model: 'GLM-4.5', calls: 892, tokens: 650000, cost: 5.8, pct: 2.0 },
    { model: 'Kimi K2', calls: 540, tokens: 420000, cost: 2.6, pct: 0.9 },
    { model: 'Doubao 1.6 Pro', calls: 210, tokens: 80000, cost: 0.8, pct: 0.3 },
  ]

  const ranges = [
    { key: 'today', label: t('usage.ranges.today') },
    { key: '7d', label: t('usage.ranges.7d') },
    { key: '30d', label: t('usage.ranges.30d') },
    { key: '90d', label: t('usage.ranges.90d') },
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('usage.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('usage.subtitle')}</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-1">
          {ranges.map((r, i) => (
            <button
              key={r.key}
              type="button"
              className={
                i === 1
                  ? 'h-7 rounded-md bg-background px-3 text-xs font-medium text-foreground shadow-sm'
                  : 'h-7 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground'
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {/* 汇总卡片 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((s) => {
          const Icon = s.icon
          const isDown = s.change.startsWith('-')
          return (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="mt-3 text-2xl font-bold tracking-tight">{s.value}</div>
                <div className="mt-0.5 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                  <span
                    className={
                      isDown
                        ? 'text-xs font-medium text-emerald-600 dark:text-emerald-400'
                        : 'text-xs font-medium text-rose-600 dark:text-rose-400'
                    }
                  >
                    {s.change}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 按模型分组 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('usage.byModel.title')}</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">{t('usage.byModel.model')}</th>
                  <th className="px-4 py-2 font-medium">{t('usage.byModel.calls')}</th>
                  <th className="px-4 py-2 font-medium">{t('usage.byModel.tokens')}</th>
                  <th className="px-4 py-2 font-medium">{t('usage.byModel.cost')}</th>
                  <th className="px-4 py-2 font-medium">{t('usage.byModel.share')}</th>
                </tr>
              </thead>
              <tbody>
                {byModel.map((m) => (
                  <tr
                    key={m.model}
                    className="border-b border-border/40 text-xs last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5 font-medium">{m.model}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {m.calls.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {m.tokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">¥ {m.cost.toFixed(2)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-sm bg-muted">
                          <div className="h-full bg-primary" style={{ width: `${m.pct}%` }} />
                        </div>
                        <span className="text-muted-foreground">{m.pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
