'use client'

import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { Coins, Loader2, TrendingUp, TrendingDown, Gift } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Button } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface PointsSummary {
  points: number
  totalEarned: number
  totalSpent: number
}

interface Transaction {
  id: string
  points: number
  reason: string
  type: 'earn' | 'spend'
  createdAt: string
}

interface RedeemItem {
  id: string
  name: string
  points: number
  image?: string | null
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function MemberPointsPage() {
  const t = useTranslations('memberPointsPage')
  const locale = useLocale()
  const summaryQ = useQuery({
    queryKey: ['member', 'points-summary'],
    queryFn: () =>
      api<{ points: PointsSummary }>('/api/points')
        .then((d) => d.points)
        .catch(() => ({ points: 0, totalEarned: 0, totalSpent: 0 })),
  })
  const txQ = useQuery({
    queryKey: ['member', 'points-tx'],
    queryFn: () =>
      api<{ list: Transaction[] }>('/api/points/transactions')
        .then((d) => d.list ?? [])
        .catch(() => [] as Transaction[]),
  })
  const redeemQ = useQuery({
    queryKey: ['member', 'points-redeem'],
    queryFn: () =>
      api<{ list: RedeemItem[] }>('/api/points/redeem')
        .then((d) => d.list ?? [])
        .catch(() => [] as RedeemItem[]),
  })

  const summary = summaryQ.data
  const txs = txQ.data ?? []
  const redeemItems = redeemQ.data ?? []

  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Coins className="h-5 w-5 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{t('summary.current')}</p>
            <p className="mt-1 text-xl font-bold text-primary">{summary?.points ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{t('summary.earned')}</p>
            <p className="mt-1 flex items-center gap-1 text-xl font-bold text-emerald-600 dark:text-emerald-500">
              <TrendingUp className="h-4 w-4" />
              {summary?.totalEarned ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{t('summary.spent')}</p>
            <p className="mt-1 flex items-center gap-1 text-xl font-bold text-red-600 dark:text-red-500">
              <TrendingDown className="h-4 w-4" />
              {summary?.totalSpent ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">{t('txTitle')}</h2>
        <Card>
          <CardContent className="p-0">
            {txQ.isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('loading')}
              </div>
            ) : txs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('txEmpty')}</p>
            ) : (
              <ul className="space-y-1">
                {txs.slice(0, 20).map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center gap-3 rounded-md px-4 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{tx.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {dateFmt.format(new Date(tx.createdAt))}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 text-sm font-semibold',
                        tx.points >= 0
                          ? 'text-emerald-600 dark:text-emerald-500'
                          : 'text-red-600 dark:text-red-500',
                      )}
                    >
                      {tx.points >= 0 ? '+' : ''}
                      {tx.points}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Gift className="h-4 w-4" />
          {t('redeemTitle')}
        </h2>
        {redeemQ.isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : redeemItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
            <Gift className="h-8 w-8 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">{t('redeemEmpty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {redeemItems.map((item) => (
              <Card key={item.id} className="transition-colors hover:bg-accent">
                <CardContent className="space-y-2 p-3">
                  <p className="line-clamp-2 text-sm font-medium">{item.name}</p>
                  <p className="text-sm font-semibold text-primary">
                    {t('pointsUnit', { n: item.points })}
                  </p>
                  <Button variant="outline" size="sm" className="w-full">
                    {t('redeemBtn')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {summaryQ.error && <Alert variant="danger" description={(summaryQ.error as Error).message} />}
    </div>
  )
}
