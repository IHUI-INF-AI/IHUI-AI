// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2, Music, Trash2, Video, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  COLUMN_RUNNING_STATUSES,
  COLUMN_WAITING_STATUSES,
  isInFlight,
  MediaKindBadge,
  MediaTaskStatusBadge,
  type MediaTask,
} from './task-parts'

/**
 * TaskKanban — 媒体任务三列看板(P3 #31 全局任务看板,2026-09-16 立,对标 Qoder My Quests)。
 *
 * 三列语义:
 *  - Running(进行中):processing —— provider 正在生成
 *  - Waiting(排队中):pending / accepted / submitted —— 已提交等待 provider
 *  - Completed(已完成):succeeded / failed / cancelled —— 全部终态(含失败,便于回看)
 *
 * 卡片操作:
 *  - 在途任务:取消(provider 取消 + 置 cancelled)
 *  - 全部任务:删除
 *  - chat_id 有值(任务由某条对话发起,后端落库时已关联):「打开会话」深链跳回
 *    /chat?conversationId=xxx;历史任务 chat_id 为空 → 不显示跳转入口(优雅降级)。
 */

/** 看板列分组纯函数(导出供单测;未知状态归入 completed 兜底,不丢任务)。 */
export function groupTasksByColumn(tasks: MediaTask[]): {
  running: MediaTask[]
  waiting: MediaTask[]
  completed: MediaTask[]
} {
  const running: MediaTask[] = []
  const waiting: MediaTask[] = []
  const completed: MediaTask[] = []
  for (const task of tasks) {
    if (COLUMN_RUNNING_STATUSES.includes(task.status)) running.push(task)
    else if (COLUMN_WAITING_STATUSES.includes(task.status)) waiting.push(task)
    else completed.push(task)
  }
  return { running, waiting, completed }
}

/** 卡片时间短格式(本地时区 MM-dd HH:mm,Intl.DateTimeFormat 无库依赖)。 */
function formatShortTime(v: string, locale: string): string {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

interface TaskKanbanProps {
  tasks: MediaTask[]
  loading: boolean
  error: Error | null
  cancelling: string | null
  deleting: string | null
  onCancel: (taskId: string) => void
  onDelete: (taskId: string) => void
}

export function TaskKanban({
  tasks,
  loading,
  error,
  cancelling,
  deleting,
  onCancel,
  onDelete,
}: TaskKanbanProps) {
  const t = useTranslations('mediaTasksPage')
  const locale = useLocale()
  const { running, waiting, completed } = React.useMemo(() => groupTasksByColumn(tasks), [tasks])

  const columns: Array<{
    key: 'running' | 'waiting' | 'completed'
    label: string
    items: MediaTask[]
    accentCls: string
  }> = [
    {
      key: 'running',
      label: t('colRunning'),
      items: running,
      accentCls: 'text-blue-600 dark:text-blue-400',
    },
    {
      key: 'waiting',
      label: t('colWaiting'),
      items: waiting,
      accentCls: 'text-amber-600 dark:text-amber-400',
    },
    {
      key: 'completed',
      label: t('colCompleted'),
      items: completed,
      accentCls: 'text-emerald-600 dark:text-emerald-400',
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {error.message}
      </div>
    )
  }

  return (
    <div className="grid gap-3 lg:grid-cols-3" data-testid="task-kanban">
      {columns.map((col) => (
        <section
          key={col.key}
          className="min-w-0 rounded-md bg-muted/30 p-2"
          data-testid={`kanban-col-${col.key}`}
        >
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <h3 className={cn('text-xs font-medium', col.accentCls)}>{col.label}</h3>
            <span className="tabular-nums text-[11px] text-muted-foreground">
              {col.items.length}
            </span>
          </div>
          {col.items.length === 0 ? (
            <p className="px-1 py-4 text-center text-[11px] text-muted-foreground/60">
              {t('colEmpty')}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {col.items.map((task) => (
                <TaskKanbanCard
                  key={task.id}
                  task={task}
                  locale={locale}
                  cancelling={cancelling === task.task_id}
                  deleting={deleting === task.task_id}
                  onCancel={onCancel}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}

/** 看板卡片:徽章行 + 描述 + 产物缩略 + 操作行(取消/删除/跳会话)。 */
function TaskKanbanCard({
  task,
  locale,
  cancelling,
  deleting,
  onCancel,
  onDelete,
}: {
  task: MediaTask
  locale: string
  cancelling: boolean
  deleting: boolean
  onCancel: (taskId: string) => void
  onDelete: (taskId: string) => void
}) {
  const t = useTranslations('mediaTasksPage')
  const urls = task.result ?? {}
  const imageThumb = urls.image_url ?? null
  const canJump = !!task.chat_id

  return (
    <li
      className="space-y-1.5 rounded-sm border border-border/50 bg-card/60 p-2"
      data-testid={`kanban-card-${task.task_id || task.id}`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <MediaKindBadge kind={task.kind} t={t} />
        <MediaTaskStatusBadge status={task.status} t={t} />
        <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
          {formatShortTime(task.created_at, locale)}
        </span>
      </div>

      {task.message && (
        <p
          className="line-clamp-2 text-[11px] leading-snug text-foreground/85"
          title={task.message}
        >
          {task.message}
        </p>
      )}

      {imageThumb && (
        // eslint-disable-next-line @next/next/no-img-element -- 动态远程图片降级用 img
        <img
          src={imageThumb}
          alt={task.message || 'media'}
          className="max-h-24 w-full rounded-sm border border-border/50 object-cover"
        />
      )}
      {!imageThumb && urls.video_url && (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <Video className="h-3 w-3" />
          {t('playable')}
        </span>
      )}
      {!imageThumb && !urls.video_url && urls.audio_url && (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <Music className="h-3 w-3" />
          {t('playable')}
        </span>
      )}

      <div className="flex items-center gap-1">
        {canJump && (
          <Link
            href={`/chat?conversationId=${encodeURIComponent(task.chat_id!)}`}
            className="inline-flex items-center gap-1 rounded-sm border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
            data-testid={`kanban-jump-${task.task_id || task.id}`}
          >
            <ExternalLink className="h-2.5 w-2.5" />
            <span>{t('jumpToChat')}</span>
          </Link>
        )}
        <span className="flex-1" />
        {isInFlight(task.status) && (
          <button
            type="button"
            onClick={() => onCancel(task.task_id)}
            disabled={cancelling}
            className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            data-testid={`kanban-cancel-${task.task_id || task.id}`}
          >
            {cancelling ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <X className="h-2.5 w-2.5" />
            )}
            <span>{cancelling ? t('cancelling') : t('cancel')}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(task.task_id)}
          disabled={deleting}
          aria-label={t('delete')}
          className="inline-flex items-center rounded-sm p-0.5 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          data-testid={`kanban-delete-${task.task_id || task.id}`}
        >
          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </button>
      </div>
    </li>
  )
}
