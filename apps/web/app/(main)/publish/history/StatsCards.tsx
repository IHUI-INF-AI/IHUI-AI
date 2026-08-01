'use client'

/**
 * 统计卡片(从 history/page.tsx 抽出)
 *
 * 4 个统计卡片:总数 / 成功 / 失败 / 成功率。
 *
 * AGENTS.md §4:rounded-md(禁 rounded-full)/ 无分割线 / 无渐变遮罩
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@ihui/ui-react'

export interface StatsCardsProps {
  readonly stats: {
    readonly tasks?: {
      readonly total?: number
      readonly success?: number
      readonly failed?: number
      readonly partial?: number
    }
  }
}

export function StatsCards({ stats }: StatsCardsProps) {
  const t = useTranslations('publish')
  const total = stats.tasks?.total ?? 0
  const success = stats.tasks?.success ?? 0
  const failed = stats.tasks?.failed ?? 0
  const rate = total && success ? `${((success / total) * 100).toFixed(1)}%` : '-'

  return (
    <div className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-4">
      <Card>
        <CardContent className="p-3">
          <div className="text-xs text-muted-foreground">{t('stats.totalTasks')}</div>
          <div className="mt-1 text-lg font-semibold">{total}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <div className="text-xs text-muted-foreground">{t('stats.totalSuccess')}</div>
          <div className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400">
            {success}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <div className="text-xs text-muted-foreground">{t('stats.totalFailed')}</div>
          <div className="mt-1 text-lg font-semibold text-rose-600 dark:text-rose-400">
            {failed}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <div className="text-xs text-muted-foreground">{t('stats.successRate')}</div>
          <div className="mt-1 text-lg font-semibold">{rate}</div>
        </CardContent>
      </Card>
    </div>
  )
}
