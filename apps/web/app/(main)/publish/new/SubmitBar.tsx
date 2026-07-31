'use client'

/**
 * 提交栏 + 提交后任务进度(从 new/page.tsx 抽出)
 *
 * 提交按钮 + 提交后用 TaskProgressBar 显示多平台发布进度(轮询 /api/publish/tasks/{id})。
 * 内部管理轮询:接收 submittedTaskId 后自动开始轮询,完成或超时停止。
 *
 * AGENTS.md §4:rounded-md(禁 rounded-full)/ 无分割线 / subtle hover
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Send } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { TaskProgressBar } from '@/components/publish/TaskProgressBar'
import type { ScheduleMode } from './ScheduleCard'

interface Target {
  readonly platform: string
  readonly status?: string
}

interface TaskDetailResponse {
  readonly id: number
  readonly status: string
  readonly targets?: ReadonlyArray<Target>
}

const POLL_INTERVAL_MS = 2000
const POLL_MAX_MS = 5 * 60 * 1000
const TERMINAL_STATUSES = new Set(['success', 'failed', 'skipped'])

export interface SubmitBarProps {
  readonly submitting: boolean
  readonly scheduleMode: ScheduleMode
  readonly onSubmit: (e: React.FormEvent) => void
  /** 提交后任务 ID(用于轮询进度),null/undefined 不轮询 */
  readonly submittedTaskId?: number | null
}

export function SubmitBar({
  submitting,
  scheduleMode,
  onSubmit,
  submittedTaskId = null,
}: SubmitBarProps) {
  const t = useTranslations('publish')
  const [targets, setTargets] = React.useState<ReadonlyArray<Target>>([])
  const [polling, setPolling] = React.useState(false)

  React.useEffect(() => {
    if (submittedTaskId === null || submittedTaskId === undefined) return
    setPolling(true)
    setTargets([])
    const startTime = Date.now()
    const id = setInterval(async () => {
      if (Date.now() - startTime > POLL_MAX_MS) {
        clearInterval(id)
        setPolling(false)
        return
      }
      try {
        const r = await fetchApi<TaskDetailResponse>(`/api/publish/tasks/${submittedTaskId}`)
        if (r.success && r.data) {
          setTargets(r.data.targets ?? [])
          const allDone =
            r.data.status === 'success' ||
            r.data.status === 'failed' ||
            (r.data.targets?.every((tg) => TERMINAL_STATUSES.has(tg.status ?? '')) ?? false)
          if (allDone) {
            clearInterval(id)
            setPolling(false)
          }
        }
      } catch {
        // 网络错误静默,继续轮询
      }
    }, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [submittedTaskId])

  const showProgress = submittedTaskId !== null && targets.length > 0
  const total = targets.length
  const completed = targets.filter((tg) => TERMINAL_STATUSES.has(tg.status ?? '')).length
  const failed = targets.filter((tg) => tg.status === 'failed').length
  const running = polling && completed < total

  return (
    <div className="space-y-3">
      {showProgress && (
        <TaskProgressBar completed={completed} total={total} failed={failed} running={running} />
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={submitting} onClick={onSubmit}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting
            ? t('new.submitting')
            : scheduleMode === 'now'
              ? t('new.submitNow')
              : t('new.submitSchedule')}
        </Button>
      </div>
    </div>
  )
}
