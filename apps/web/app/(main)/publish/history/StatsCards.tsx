'use client'

/**
 * 统计卡片（从 history/page.tsx 抽出，重构于 2026-08-12）
 *
 * 4 个统计卡片：总数 / 成功 / 失败 / 成功率。
 * 重写动机：原本使用 <CardContent className="p-3"> 试图压制 padding，但 ui-react CardContent
 *          默认值为 pt-0 + min-[640px]:p-6（响应式不对称），自定义 p-3 被 min- 覆盖、pt-0 没被覆盖，
 *          导致宽屏下 label 贴顶 + value 底 24px 空白（用户反馈"空间浪费"）。
 *          修复后 CardContent 默认对称 p-4/p-6，由 ui-react 卡根。
 *          本组件同步迁移到 StatCard，避免再踩坑。
 *
 * AGENTS.md §4:rounded-md(禁 rounded-full)/ 无分割线 / 无渐变遮罩
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { StatCard, StatGrid } from '@ihui/ui-react'

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
    <StatGrid cols={4}>
      <StatCard label={t('stats.totalTasks')} value={total} />
      <StatCard label={t('stats.totalSuccess')} value={success} variant="success" />
      <StatCard label={t('stats.totalFailed')} value={failed} variant="danger" />
      <StatCard label={t('stats.successRate')} value={rate} />
    </StatGrid>
  )
}
