'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Gift, Loader2 } from 'lucide-react'

import { Card, CardContent, Button } from '@ihui/ui-react'

import { api } from './helpers'

interface RedeemItem {
  id: string
  name: string
  points: number
  image?: string | null
}

export function PointsRedeemList() {
  const t = useTranslations('points')
  const redeemQ = useQuery({
    queryKey: ['points', 'redeem'],
    queryFn: () => api<{ list: RedeemItem[] }>('/api/points/redeem').then((d) => d.list ?? []),
  })

  if (redeemQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin" />
        <span className="whitespace-nowrap">{t('loading')}</span>
      </div>
    )
  }

  if ((redeemQ.data ?? []).length === 0) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-center">
        <Gift className="h-8 w-8 shrink-0 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">{t('redeemEmpty')}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-3">
      {(redeemQ.data ?? []).map((item) => (
        <Card key={item.id} className="transition-colors hover:bg-accent">
          <CardContent className="space-y-2 p-3 min-[640px]:p-3">
            <p className="line-clamp-2 text-sm font-medium">{item.name}</p>
            <p className="text-sm font-semibold tabular-nums text-primary">
              {t('pointsUnit', { n: item.points })}
            </p>
            <Button variant="outline" size="sm" className="w-full whitespace-nowrap">
              {t('redeemBtn')}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
