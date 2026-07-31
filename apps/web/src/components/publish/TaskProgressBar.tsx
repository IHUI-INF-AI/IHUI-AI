'use client'

/**
 * 任务进度条组件
 *
 * 用于发布任务卡展示多平台发布进度:成功部分(emerald)+ 失败部分(rose),其余 muted。
 * 中间显示文字 "已完成 8/10(成功 7,失败 1)";运行中时左侧 Loader2 旋转;
 * 总进度 100% 时显示 CheckCircle2 + "全部完成"。
 *
 * AGENTS.md §4:h-3 rounded-md 进度条(禁 rounded-full)/ 无分割线 / 禁渐变遮罩
 */

import * as React from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

export interface TaskProgressBarProps {
  readonly completed: number
  readonly total: number
  readonly failed: number
  readonly running: boolean
}

export function TaskProgressBar({
  completed,
  total,
  failed,
  running,
}: TaskProgressBarProps) {
  const t = useTranslations('publish')
  const safeTotal = Math.max(1, total)
  const successCount = Math.max(0, completed - failed)
  const successPct = (successCount / safeTotal) * 100
  const failedPct = (failed / safeTotal) * 100
  const allDone = completed >= total && total > 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs">
        {running ? (
          <Loader2 className="h-3 w-3 animate-spin text-amber-600 dark:text-amber-400" />
        ) : allDone ? (
          <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        ) : null}
        <span className="text-muted-foreground">
          {allDone
            ? t('taskAllComplete')
            : `${t('taskProgress')} ${completed}/${total}`}
        </span>
        <span className="text-emerald-600 dark:text-emerald-400">
          {t('stats.totalSuccess')} {successCount}
        </span>
        {failed > 0 && (
          <span className="text-rose-600 dark:text-rose-400">
            {t('stats.totalFailed')} {failed}
          </span>
        )}
      </div>
      <div className="relative h-3 overflow-hidden rounded-md bg-muted">
        <div
          className="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-300"
          style={{ width: `${successPct}%` }}
        />
        <div
          className="absolute inset-y-0 bg-rose-500 transition-all duration-300"
          style={{ left: `${successPct}%`, width: `${failedPct}%` }}
        />
      </div>
    </div>
  )
}
