import { getTranslations } from 'next-intl/server'
import { ArrowUpRight, Check, DollarSign, Wallet } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

export default async function BillingPage() {
  const t = await getTranslations('models')
  const tp = await getTranslations('modelsBillingPage')

  const packages = [
    {
      name: t('billing.packages.starter'),
      price: '¥ 9.9',
      bonus: t('billing.packages.starterBonus'),
      features: tp.raw('packages.starter.features') as string[],
      cta: t('billing.packages.cta'),
      highlighted: false,
    },
    {
      name: t('billing.packages.pro'),
      price: '¥ 99',
      bonus: t('billing.packages.proBonus'),
      features: tp.raw('packages.pro.features') as string[],
      cta: t('billing.packages.cta'),
      highlighted: true,
    },
    {
      name: t('billing.packages.enterprise'),
      price: '¥ 999',
      bonus: t('billing.packages.enterpriseBonus'),
      features: tp.raw('packages.enterprise.features') as string[],
      cta: t('billing.packages.cta'),
      highlighted: false,
    },
  ]

  const transactions = [
    {
      id: 'TX20260718001',
      type: 'recharge',
      amount: 99,
      balance: 128.5,
      time: '2026-07-18 14:32',
      status: 'success',
    },
    {
      id: 'TX20260715008',
      type: 'consume',
      amount: -3.42,
      balance: 29.5,
      time: '2026-07-15 23:59',
      status: 'success',
    },
    {
      id: 'TX20260715007',
      type: 'consume',
      amount: -2.18,
      balance: 32.92,
      time: '2026-07-15 16:24',
      status: 'success',
    },
    {
      id: 'TX20260710003',
      type: 'recharge',
      amount: 50,
      balance: 35.1,
      time: '2026-07-10 09:12',
      status: 'success',
    },
    {
      id: 'TX20260705002',
      type: 'consume',
      amount: -8.65,
      balance: -14.9,
      time: '2026-07-05 11:08',
      status: 'success',
    },
    {
      id: 'TX20260701001',
      type: 'recharge',
      amount: 9.9,
      balance: -6.25,
      time: '2026-07-01 10:00',
      status: 'success',
    },
  ]

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('billing.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('billing.subtitle')}</p>
      </header>

      {/* 余额卡片 */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="sm:col-span-1">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
              {t('billing.currentBalance')}
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight">¥ 128.50</div>
            <Button className="mt-3 h-8 w-full gap-1.5 text-xs">
              <DollarSign className="h-3.5 w-3.5" />
              {t('billing.recharge')}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">{t('billing.monthConsume')}</div>
            <div className="mt-2 text-2xl font-bold">¥ 285.40</div>
            <div className="mt-1 flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400">
              <ArrowUpRight className="h-3 w-3" />
              {tp('consumeTrend', { n: 8.7 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">{t('billing.totalRecharge')}</div>
            <div className="mt-2 text-2xl font-bold">¥ 1,500.00</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {tp('rechargeCount', { n: 6 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 充值套餐 */}
      <div>
        <h2 className="mb-3 text-base font-semibold">{t('billing.packages.title')}</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {packages.map((p) => (
            <Card
              key={p.name}
              className={p.highlighted ? 'relative border-primary shadow-md' : 'relative'}
            >
              {p.highlighted && (
                <span className="absolute -top-2 left-4 inline-flex items-center rounded bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {t('billing.packages.recommended')}
                </span>
              )}
              <CardContent className="p-5">
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight">{p.price}</span>
                  <span className="text-xs text-muted-foreground">
                    {t('billing.packages.once')}
                  </span>
                </div>
                <div className="mt-1 text-xs text-primary">{p.bonus}</div>
                <ul className="mt-4 space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-4 h-8 w-full text-xs"
                  variant={p.highlighted ? 'default' : 'outline'}
                >
                  {p.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 交易记录 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('billing.transactions.title')}</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">{t('billing.transactions.id')}</th>
                  <th className="px-4 py-2 font-medium">{t('billing.transactions.type')}</th>
                  <th className="px-4 py-2 font-medium">{t('billing.transactions.amount')}</th>
                  <th className="px-4 py-2 font-medium">{t('billing.transactions.balance')}</th>
                  <th className="px-4 py-2 font-medium">{t('billing.transactions.time')}</th>
                  <th className="px-4 py-2 font-medium">{t('billing.transactions.status')}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-border/40 text-xs last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{tx.id}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          tx.type === 'recharge'
                            ? 'inline-flex items-center rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400'
                            : 'inline-flex items-center rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground'
                        }
                      >
                        {t(`billing.transactions.types.${tx.type}`)}
                      </span>
                    </td>
                    <td
                      className={
                        tx.amount > 0
                          ? 'px-4 py-2.5 font-medium text-emerald-600 dark:text-emerald-400'
                          : 'px-4 py-2.5 font-medium text-foreground'
                      }
                    >
                      {tx.amount > 0 ? '+' : ''}¥ {Math.abs(tx.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">¥ {tx.balance.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{tx.time}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        {t(`billing.transactions.statusLabels.${tx.status}`)}
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
