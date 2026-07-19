import { getTranslations } from 'next-intl/server'
import { Activity, ArrowUpRight, Bot, DollarSign, Key, Zap } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

export default async function OverviewPage() {
  const t = await getTranslations('models')

  const stats = [
    {
      key: 'balance',
      icon: DollarSign,
      label: t('overview.stats.balance'),
      value: '¥ 128.50',
      change: '+¥ 50.00',
      changeType: 'up' as const,
    },
    {
      key: 'todayCalls',
      icon: Activity,
      label: t('overview.stats.todayCalls'),
      value: '1,284',
      change: '+12.5%',
      changeType: 'up' as const,
    },
    {
      key: 'todayCost',
      icon: Zap,
      label: t('overview.stats.todayCost'),
      value: '¥ 3.42',
      change: '-8.2%',
      changeType: 'down' as const,
    },
    {
      key: 'activeModels',
      icon: Bot,
      label: t('overview.stats.activeModels'),
      value: '8',
      change: '+2',
      changeType: 'up' as const,
    },
  ]

  const recentCalls = [
    { time: '14:32:05', model: 'GPT-4o', tokens: '2,453', cost: '¥ 0.061', status: 'success' },
    {
      time: '14:28:51',
      model: 'Claude 3.5 Sonnet',
      tokens: '1,872',
      cost: '¥ 0.056',
      status: 'success',
    },
    {
      time: '14:25:33',
      model: 'Gemini 2.0 Flash',
      tokens: '3,201',
      cost: '¥ 0.032',
      status: 'success',
    },
    { time: '14:21:08', model: 'DeepSeek V3', tokens: '1,205', cost: '¥ 0.003', status: 'success' },
    { time: '14:18:42', model: 'Qwen Max', tokens: '985', cost: '¥ 0.016', status: 'success' },
    { time: '14:15:27', model: 'GPT-4o mini', tokens: '654', cost: '¥ 0.001', status: 'success' },
    { time: '14:12:11', model: 'Grok 3', tokens: '1,532', cost: '¥ 0.046', status: 'failed' },
    { time: '14:08:54', model: 'GLM-4.5', tokens: '892', cost: '¥ 0.005', status: 'success' },
  ]

  const quickActions = [
    { icon: Key, label: t('overview.quickActions.createKey'), href: '/models/keys' },
    { icon: Bot, label: t('overview.quickActions.browseModels'), href: '/models' },
    { icon: Zap, label: t('overview.quickActions.viewUsage'), href: '/models/usage' },
    { icon: DollarSign, label: t('overview.quickActions.recharge'), href: '/models/billing' },
  ]

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('overview.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('overview.subtitle')}</p>
      </header>

      {/* 统计卡片 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.key}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span
                    className={
                      s.changeType === 'up'
                        ? 'flex items-center gap-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400'
                        : 'flex items-center gap-0.5 text-xs font-medium text-rose-600 dark:text-rose-400'
                    }
                  >
                    <ArrowUpRight
                      className={`h-3 w-3 ${s.changeType === 'down' ? 'rotate-90' : ''}`}
                    />
                    {s.change}
                  </span>
                </div>
                <div className="mt-3 text-2xl font-bold tracking-tight">{s.value}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 快速操作 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('overview.quickActions.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {quickActions.map((a) => {
              const Icon = a.icon
              return (
                <a
                  key={a.href}
                  href={a.href}
                  className="flex flex-col items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium">{a.label}</span>
                </a>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 最近调用 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('overview.recentCalls.title')}</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">{t('overview.recentCalls.time')}</th>
                  <th className="px-4 py-2 font-medium">{t('overview.recentCalls.model')}</th>
                  <th className="px-4 py-2 font-medium">{t('overview.recentCalls.tokens')}</th>
                  <th className="px-4 py-2 font-medium">{t('overview.recentCalls.cost')}</th>
                  <th className="px-4 py-2 font-medium">{t('overview.recentCalls.status')}</th>
                </tr>
              </thead>
              <tbody>
                {recentCalls.map((c, i) => (
                  <tr
                    key={i}
                    className="border-b border-border/40 text-xs last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{c.time}</td>
                    <td className="px-4 py-2.5 font-medium">{c.model}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.tokens}</td>
                    <td className="px-4 py-2.5">{c.cost}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          c.status === 'success'
                            ? 'inline-flex items-center rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400'
                            : 'inline-flex items-center rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400'
                        }
                      >
                        {t(`overview.recentCalls.statusLabels.${c.status}`)}
                      </span>
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
