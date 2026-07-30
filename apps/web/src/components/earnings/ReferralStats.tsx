'use client'

/**
 * 引流统计 — 各渠道引流数横向条形图(CSS 实现)
 * 渠道:免费模型 / 13 平台发布 / 直接注册
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Gift, Share2, UserPlus } from 'lucide-react'

import { Card, CardContent } from '@ihui/ui-react'
import type { ReferralChannelCode, ReferralChannelStat } from '@/hooks/use-earnings'

interface Props {
  data: ReferralChannelStat[]
  loading: boolean
}

const CHANNEL_META: Record<
  ReferralChannelCode,
  { icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  'free-model': { icon: Gift, cls: 'bg-emerald-500 dark:bg-emerald-400' },
  publish: { icon: Share2, cls: 'bg-sky-500 dark:bg-sky-400' },
  direct: { icon: UserPlus, cls: 'bg-amber-500 dark:bg-amber-400' },
}

export function ReferralStats({ data, loading }: Props) {
  const t = useTranslations('earnings')
  const max = data.reduce((m, c) => Math.max(m, c.count), 0) || 1
  const total = data.reduce((s, c) => s + c.count, 0)

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">{t('referralStats')}</p>
            <p className="text-xs text-muted-foreground">{t('referralStatsDesc')}</p>
          </div>
          <p className="text-sm font-bold">{total}</p>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                <div className="h-6 w-full animate-pulse rounded bg-muted" />
              </div>
            ))
          ) : (
            data.map((c) => {
              const meta = CHANNEL_META[c.channel]
              const Icon = meta.icon
              const pct = (c.count / max) * 100
              const labelKey =
                c.channel === 'free-model'
                  ? 'channelFree'
                  : c.channel === 'publish'
                    ? 'channelPublish'
                    : 'channelDirect'
              return (
                <div key={c.channel} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {t(labelKey)}
                    </span>
                    <span className="font-medium">{c.count}</span>
                  </div>
                  <div className="h-2 w-full rounded-sm bg-muted/60">
                    <div
                      className={`h-full rounded-sm ${meta.cls}`}
                      style={{ width: `${Math.max(3, pct)}%` }}
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
