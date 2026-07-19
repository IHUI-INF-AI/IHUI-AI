import { getTranslations } from 'next-intl/server'
import { Copy, Gift, Share2, Users } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

export default async function ReferralPage() {
  const t = await getTranslations('models')

  const stats = [
    { icon: Users, label: t('referral.stats.invited'), value: '24' },
    { icon: CheckCircle2Icon, label: t('referral.stats.activated'), value: '18' },
    { icon: Gift, label: t('referral.stats.reward'), value: '¥ 360.00' },
  ]

  const referrals = [
    { user: '张*明', joined: '2026-07-15', reward: 15, status: 'activated' },
    { user: '李*华', joined: '2026-07-12', reward: 15, status: 'activated' },
    { user: '王*强', joined: '2026-07-10', reward: 15, status: 'activated' },
    { user: '赵*芳', joined: '2026-07-08', reward: 0, status: 'pending' },
    { user: '钱*军', joined: '2026-07-05', reward: 15, status: 'activated' },
    { user: '孙*丽', joined: '2026-07-01', reward: 15, status: 'activated' },
  ]

  const inviteLink = 'https://ihui.ai/register?ref=IHUI2026ABC'

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('referral.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('referral.subtitle')}</p>
      </header>

      {/* 邀请链接 */}
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Share2 className="h-4 w-4 text-primary" />
            {t('referral.link.title')}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t('referral.link.tip')}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <div className="flex h-10 flex-1 items-center rounded-lg border border-input bg-background px-3 font-mono text-sm text-muted-foreground">
              {inviteLink}
            </div>
            <Button className="gap-1.5">
              <Copy className="h-4 w-4" />
              {t('referral.link.copy')}
            </Button>
          </div>
          <div className="mt-3 rounded-lg bg-background/60 p-3 text-xs text-muted-foreground">
            {t('referral.link.reward', { amount: '¥ 15.00' })}
          </div>
        </CardContent>
      </Card>

      {/* 统计 */}
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="mt-3 text-2xl font-bold tracking-tight">{s.value}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 邀请记录 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('referral.list.title')}</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">{t('referral.list.user')}</th>
                  <th className="px-4 py-2 font-medium">{t('referral.list.joined')}</th>
                  <th className="px-4 py-2 font-medium">{t('referral.list.reward')}</th>
                  <th className="px-4 py-2 font-medium">{t('referral.list.status')}</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r, i) => (
                  <tr
                    key={i}
                    className="border-b border-border/40 text-xs last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5 font-medium">{r.user}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.joined}</td>
                    <td className="px-4 py-2.5 font-medium text-emerald-600 dark:text-emerald-400">
                      {r.reward > 0 ? `+¥ ${r.reward.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          r.status === 'activated'
                            ? 'inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400'
                            : 'inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400'
                        }
                      >
                        {t(`referral.list.statusLabels.${r.status}`)}
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

function CheckCircle2Icon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}
