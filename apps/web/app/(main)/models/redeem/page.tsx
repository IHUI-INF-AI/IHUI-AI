import { getTranslations } from 'next-intl/server'
import { CheckCircle2, Gift, Ticket } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@ihui/ui-react'

export default async function RedeemPage() {
  const t = await getTranslations('models')

  const history = [
    { code: 'IHUI-2026-SUMMER-001', amount: 50, time: '2026-07-15 10:32', status: 'success' },
    { code: 'IHUI-2026-VIP-GIFT-002', amount: 99, time: '2026-06-30 14:18', status: 'success' },
    { code: 'IHUI-2026-NEW-003', amount: 9.9, time: '2026-06-12 09:45', status: 'success' },
    { code: 'IHUI-EXPIRED-004', amount: 0, time: '2026-05-20 16:08', status: 'failed' },
  ]

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('redeem.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('redeem.subtitle')}</p>
      </header>

      {/* 兑换码输入 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Ticket className="h-4 w-4 text-primary" />
            {t('redeem.form.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder={t('redeem.form.placeholder')}
              className="flex-1 font-mono text-sm"
            />
            <Button className="gap-1.5">
              <Gift className="h-4 w-4" />
              {t('redeem.form.submit')}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t('redeem.form.tip')}</p>
        </CardContent>
      </Card>

      {/* 兑换记录 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('redeem.history.title')}</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">{t('redeem.history.code')}</th>
                  <th className="px-4 py-2 font-medium">{t('redeem.history.amount')}</th>
                  <th className="px-4 py-2 font-medium">{t('redeem.history.time')}</th>
                  <th className="px-4 py-2 font-medium">{t('redeem.history.status')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr
                    key={i}
                    className="border-b border-border/40 text-xs last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{h.code}</td>
                    <td className="px-4 py-2.5 font-medium text-emerald-600 dark:text-emerald-400">
                      {h.status === 'success' ? `+¥ ${h.amount.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{h.time}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          h.status === 'success'
                            ? 'inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400'
                            : 'inline-flex items-center gap-1 rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400'
                        }
                      >
                        {h.status === 'success' && <CheckCircle2 className="h-3 w-3" />}
                        {t(`redeem.history.statusLabels.${h.status}`)}
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
