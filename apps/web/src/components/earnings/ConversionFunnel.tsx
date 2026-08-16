'use client'

/**
 * 转化漏斗 — 注册 → 活跃 → BYOK → VIP 递减条形(CSS 实现)
 * emerald 色系渐深,显示每阶段留存率
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'

import { Card, CardContent } from '@ihui/ui-react'
import type { ConversionStageCode, ConversionStageStat } from '@/hooks/use-earnings'

interface Props {
  data: ConversionStageStat[]
  loading: boolean
}

const STAGE_CLS: Record<ConversionStageCode, string> = {
  register: 'bg-emerald-300/80 dark:bg-emerald-700/80',
  active: 'bg-emerald-400/80 dark:bg-emerald-600/80',
  byok: 'bg-emerald-500/80 dark:bg-emerald-500/80',
  vip: 'bg-emerald-600 dark:bg-emerald-400',
}

export function ConversionFunnel({ data, loading }: Props) {
  const t = useTranslations('earnings')
  const first = data[0]?.count ?? 1
  const labelKey: Record<ConversionStageCode, string> = {
    register: 'stageRegister',
    active: 'stageActive',
    byok: 'stageByok',
    vip: 'stageVip',
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div>
          <p className="text-sm font-semibold">{t('conversionFunnel')}</p>
          <p className="text-xs text-muted-foreground">{t('conversionFunnelDesc')}</p>
        </div>

        <div className="mt-4 space-y-2.5">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                  <div className="h-7 w-full animate-pulse rounded bg-muted" />
                </div>
              ))
            : data.map((s) => {
                const pct = (s.count / first) * 100
                return (
                  <div key={s.stage} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{t(labelKey[s.stage])}</span>
                      <span className="font-medium">
                        {s.count}
                        <span className="ml-1 text-muted-foreground">{pct.toFixed(1)}%</span>
                      </span>
                    </div>
                    <div className="h-6 w-full rounded-sm bg-muted/40">
                      <div
                        className={`flex h-full items-center rounded-sm ${STAGE_CLS[s.stage]} px-2`}
                        style={{ width: `${Math.max(8, pct)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
        </div>
      </CardContent>
    </Card>
  )
}
