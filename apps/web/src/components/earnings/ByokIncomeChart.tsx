'use client'

/**
 * BYOK 抽成收入趋势 — 最近 30 天 CSS 柱状图(无图表库依赖)
 * emerald 色系,hover 显示当日金额
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'

import { Card, CardContent } from '@ihui/ui-react'
import type { ByokIncomePoint } from '@/hooks/use-earnings'

interface Props {
  data: ByokIncomePoint[]
  loading: boolean
}

export function ByokIncomeChart({ data, loading }: Props) {
  const t = useTranslations('earnings')
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null)

  const max = React.useMemo(() => data.reduce((m, p) => Math.max(m, p.amount), 0) || 1, [data])
  const total = React.useMemo(() => data.reduce((s, p) => s + p.amount, 0), [data])

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">{t('byokTrend')}</p>
            <p className="text-xs text-muted-foreground">{t('byokTrendDesc')}</p>
          </div>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
            ¥{total.toFixed(2)}
          </p>
        </div>

        <div className="relative mt-4 h-32">
          {loading ? (
            <div className="flex h-full items-end gap-1">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 animate-pulse rounded-sm bg-muted"
                  style={{ height: '40%' }}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-full items-end gap-px">
              {data.map((p, i) => {
                const h = Math.max(4, (p.amount / max) * 100)
                const isHover = hoverIdx === i
                return (
                  <div
                    key={p.date}
                    className="group relative flex-1 cursor-pointer"
                    style={{ height: '100%' }}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                  >
                    <div
                      className={
                        isHover
                          ? 'w-full rounded-sm bg-emerald-500 dark:bg-emerald-400'
                          : 'w-full rounded-sm bg-emerald-300/70 dark:bg-emerald-700/70'
                      }
                      style={{ height: `${h}%`, marginTop: 'auto' }}
                    />
                    {isHover && (
                      <div className="absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-md">
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          ¥{p.amount.toFixed(2)}
                        </span>
                        <span className="ml-1 text-muted-foreground">{p.date.slice(5)}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t('last30Days')}</p>
      </CardContent>
    </Card>
  )
}
