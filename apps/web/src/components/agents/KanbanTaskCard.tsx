// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback/Tooltip'
import { CenteredText } from '@/components/common/CenteredText'
import { formatRelativeTime } from '@/lib/date-utils'
import type { AgentTaskStatus, AgentTaskTermination, KanbanTask } from '@ihui/types'
import {
  TERMINATION_LABEL_KEYS,
  UNRECOGNIZED_STATUS_LABEL_KEY,
  i18nLeafKey,
  isUnrecognizedKanbanTask,
} from '@ihui/types'

/**
 * 次级标记的 i18n 键末段:`agents.kanban.terminatedCancelled` → `terminatedCancelled`。
 * 命名空间由 `useTranslations('agents.kanban')` 绑定,键表本身只在 @ihui/types 有一份 ——
 * 在这里再写一份 `{cancelled:'…'}` 就是第二个真相(它过期时端上只会显示键名,不报错)。
 */
function terminationLabelSegment(termination: AgentTaskTermination): string {
  return i18nLeafKey(TERMINATION_LABEL_KEYS[termination])
}

/** 未识别档的徽章文案键末段(取末段与终态标记共用一份实现,不各写一遍 slice) */
const UNRECOGNIZED_LABEL_LEAF = i18nLeafKey(UNRECOGNIZED_STATUS_LABEL_KEY)

// ---------------------------------------------------------------------------
// 共享常量(供 KanbanColumn / TaskDetailDialog 复用)
// ---------------------------------------------------------------------------

export const STATUS_BADGE_CLASS: Record<AgentTaskStatus, string> = {
  triage: 'bg-muted text-muted-foreground',
  todo: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  ready: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  in_progress: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  blocked: 'bg-red-500/15 text-red-600 dark:text-red-400',
  done: 'bg-green-500/15 text-green-600 dark:text-green-400',
}

/**
 * "未识别"档的取样(独立呈现):刻意不复用任何已知档的颜色 ——
 * 借 done/blocked 的语义色就等于替一个没人认得的值判定成功或失败。
 * 中性灰只表达一件事:库里这个状态串不在六档内。
 */
export const UNRECOGNIZED_BADGE_CLASS = 'bg-muted text-muted-foreground'

export const PRIORITY_THRESHOLDS = { high: 10, medium: 1 } as const

export function getPriorityLevel(priority: number): 'high' | 'medium' | 'low' {
  if (priority >= PRIORITY_THRESHOLDS.high) return 'high'
  if (priority >= PRIORITY_THRESHOLDS.medium) return 'medium'
  return 'low'
}

export const PRIORITY_DOT_CLASS: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-gray-400',
}

/**
 * 合法状态流转 — 单一来源在 @ihui/types(agent-runtime.ts ALLOWED_TRANSITIONS),
 * 与 api transition 校验共用同一张表,避免前后端漂移。
 * re-export 保持 TaskDetailDialog 等下游 import 兼容。
 */
export { ALLOWED_TRANSITIONS as LEGAL_TRANSITIONS } from '@ihui/types'

// re-export 自 date-utils,保持 TaskDetailDialog 等下游 import 兼容
export { formatRelativeTime }

export function formatDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  if (ms < 0) return '—'
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ${sec % 60}s`
  const hr = Math.floor(min / 60)
  return `${hr}h ${min % 60}m`
}

// ---------------------------------------------------------------------------
// KanbanTaskCard 组件
// ---------------------------------------------------------------------------

export interface KanbanTaskCardProps {
  task: KanbanTask
  onSelect: (task: KanbanTask) => void
}

export function KanbanTaskCard({ task, onSelect }: KanbanTaskCardProps) {
  const t = useTranslations('agents.kanban')
  const locale = useLocale()
  const level = getPriorityLevel(task.priority)
  // 未识别档:原始状态串不在六档内(api 侧只在未识别时挂 rawStatus)。
  // 这一档必须独立呈现:既不能落进 STATUS_BADGE_CLASS 的某个已知档(那才是"静默当成已知"),
  // 也不能把 rawStatus 当文案渲染(它是外部可写的值 —— 界面文案位就是注入面)。
  const unrecognized = isUnrecognizedKanbanTask(task)

  return (
    <button
      type="button"
      onClick={() => onSelect(task)}
      className="w-full rounded-sm border border-border bg-card p-3 text-left shadow-sm transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-2">
        <span
          className={cn('mt-0.5 h-2 w-2 shrink-0 rounded-full', PRIORITY_DOT_CLASS[level])}
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium leading-snug">{task.name}</p>
          {task.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
          )}
          <div className="flex items-center gap-1.5 pt-0.5">
            <span
              className={cn(
                'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none',
                unrecognized ? UNRECOGNIZED_BADGE_CLASS : STATUS_BADGE_CLASS[task.status],
              )}
              data-testid={unrecognized ? 'kanban-status-unrecognized' : undefined}
              data-unrecognized-status={unrecognized ? task.rawStatus : undefined}
              aria-label={
                unrecognized ? `${t(UNRECOGNIZED_LABEL_LEAF)}: ${task.rawStatus ?? ''}` : undefined
              }
            >
              {unrecognized ? t(UNRECOGNIZED_LABEL_LEAF) : t(task.status)}
            </span>
            {/* 2026-09-28 拍板:六档状态枚举不动,但被折叠成 blocked 的三种终态要能点名 ——
                「已取消 / 配额超限 / 被抢占」重跑大概率就好,「待解阻塞」要先去解阻塞;
                两者同形会把用户的下一步动作指错方向。文案键取自 @ihui/types 那一张表,
                不在端内抄第二份名字表(§3 共享层优先)。 */}
            {task.termination && (
              <Tooltip content={t(terminationLabelSegment(task.termination))}>
                <span
                  data-testid={`kanban-termination-${task.termination}`}
                  className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground"
                >
                  {t(terminationLabelSegment(task.termination))}
                </span>
              </Tooltip>
            )}
            {/* 2-2 工作区锁徽标:任务持锁(进入 in_progress 抢到工作区锁)时显示 */}
            {task.lockedBy && (
              <Tooltip content={`${t('locked')}: ${task.lockedBy}`}>
                <span className="inline-flex items-center gap-0.5 rounded-md bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-medium leading-none text-orange-600 dark:text-orange-400">
                  <Lock className="h-2.5 w-2.5" aria-hidden />
                  {t('locked')}
                </span>
              </Tooltip>
            )}
            <span className="text-[10px] text-muted-foreground">
              {t('created')} {formatRelativeTime(task.createdAt, locale)}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

/** 空状态提示(列内无任务时) */
export function KanbanTaskCardEmpty() {
  const t = useTranslations('agents.kanban')
  return (
    <div className="flex items-center justify-center ui-card rounded-lg border border-dashed py-6 text-xs text-muted-foreground">
      <CenteredText enabled={false}>{t('empty')}</CenteredText>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
