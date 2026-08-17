'use client'

/**
 * 任务卡片(从 history/page.tsx 抽出)
 *
 * 单个发布任务卡,可折叠。展开后显示子 target 列表 + TaskProgressBar。
 *
 * AGENTS.md §4:rounded-md(禁 rounded-full)/ 无分割线 / 无渐变遮罩
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { Card, CardContent } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { PLATFORM_KEY } from '../helpers'
import { TaskProgressBar } from '@/components/publish/TaskProgressBar'

interface Target {
  readonly platform: string
  readonly accountId?: number
  readonly status?: string
  readonly url?: string | null
  readonly error?: string | null
  readonly durationMs?: number
}

interface PlatformResult {
  readonly platform: string
  readonly success: boolean
  readonly publishedUrl?: string | null
  readonly platformContentId?: string | null
  readonly errorMessage?: string | null
  readonly durationMs?: number
}

export interface TaskCardProps {
  readonly task: {
    readonly id: number
    readonly title: string
    readonly status: string
    readonly createdAt?: string
    readonly platformCount?: number
    readonly format?: string
    readonly targets?: ReadonlyArray<Target>
    readonly platforms?: ReadonlyArray<PlatformResult>
    readonly error?: string | null
  }
  readonly expanded: boolean
  readonly onToggle: (id: number) => void
}

const STATUS_LABEL: Record<string, string> = {
  success: '成功',
  failed: '失败',
  pending: '待处理',
  running: '运行中',
  skipped: '跳过',
}

const STATUS_STYLE: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  failed: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  skipped: 'bg-muted text-muted-foreground',
}

const TIME_FMT = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Shanghai',
})

const TERMINAL_STATUSES = new Set(['success', 'failed', 'skipped'])

function fmtDuration(ms?: number): string {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}min`
}

export function TaskCard({ task, expanded, onToggle }: TaskCardProps) {
  const t = useTranslations('publish')
  const statusKey = task.status in STATUS_STYLE ? task.status : 'pending'
  const targets = task.targets ?? []
  const platforms = task.platforms ?? []
  // 有真实单平台结果(platforms)时优先用它渲染;否则回退到 targets
  const usePlatforms = platforms.length > 0
  const completed = usePlatforms
    ? platforms.filter((p) => p.success).length
    : targets.filter((tg) => TERMINAL_STATUSES.has(tg.status ?? '')).length
  const failed = usePlatforms
    ? platforms.filter((p) => !p.success).length
    : targets.filter((tg) => tg.status === 'failed').length
  const total = usePlatforms ? platforms.length : targets.length
  const running = task.status === 'running' || task.status === 'pending'

  return (
    <Card>
      <CardContent className="p-3 min-[640px]:p-3">
        <button
          type="button"
          onClick={() => onToggle(task.id)}
          className="flex w-full items-center gap-3 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{task.title}</span>
              <span
                className={cn(
                  'shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
                  STATUS_STYLE[statusKey],
                )}
              >
                {STATUS_LABEL[task.status] ?? task.status}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span>
                {t('history.time')}:{' '}
                {task.createdAt ? TIME_FMT.format(new Date(task.createdAt)) : '-'}
              </span>
              {typeof task.platformCount === 'number' && <span>平台数: {task.platformCount}</span>}
              {task.format && <span className="font-mono">{task.format}</span>}
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0" />
          )}
        </button>

        {expanded && (
          <div className="mt-3 space-y-2 rounded-md bg-muted/40 p-3 text-xs">
            {total > 0 && (
              <>
                <TaskProgressBar
                  completed={completed}
                  total={total}
                  failed={failed}
                  running={running}
                />
                <div className="space-y-1">
                  {usePlatforms
                    ? platforms.map((p, i) => (
                        <div
                          key={`${p.platform}-${i}`}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <span className="font-medium">
                            {t(PLATFORM_KEY[p.platform] ?? 'platforms.unknown')}
                          </span>
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px]',
                              STATUS_STYLE[p.success ? 'success' : 'failed'],
                            )}
                          >
                            {STATUS_LABEL[p.success ? 'success' : 'failed']}
                          </span>
                          {p.durationMs !== undefined && p.durationMs !== null && (
                            <span className="text-muted-foreground">
                              {fmtDuration(p.durationMs)}
                            </span>
                          )}
                          {p.publishedUrl && (
                            <a
                              href={p.publishedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {t('history.openUrl')}
                            </a>
                          )}
                          {p.errorMessage && (
                            <span className="text-rose-600 dark:text-rose-400">
                              {p.errorMessage}
                            </span>
                          )}
                        </div>
                      ))
                    : targets.map((tg, i) => (
                        <div
                          key={`${tg.accountId ?? tg.platform}-${i}`}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <span className="font-medium">
                            {t(PLATFORM_KEY[tg.platform] ?? 'platforms.unknown')}
                          </span>
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px]',
                              STATUS_STYLE[tg.status ?? 'pending'] ?? STATUS_STYLE.pending,
                            )}
                          >
                            {STATUS_LABEL[tg.status ?? 'pending'] ?? tg.status}
                          </span>
                          {tg.durationMs !== undefined && tg.durationMs !== null && (
                            <span className="text-muted-foreground">
                              {fmtDuration(tg.durationMs)}
                            </span>
                          )}
                          {tg.url && (
                            <a
                              href={tg.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {t('history.openUrl')}
                            </a>
                          )}
                          {tg.error && (
                            <span className="text-rose-600 dark:text-rose-400">{tg.error}</span>
                          )}
                        </div>
                      ))}
                </div>
              </>
            )}
            {task.error && (
              <pre className="thin-scroll max-h-32 overflow-auto rounded bg-rose-50 p-2 text-[10px] text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {task.error}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
