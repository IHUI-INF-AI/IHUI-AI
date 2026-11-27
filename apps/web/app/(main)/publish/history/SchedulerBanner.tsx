// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import Link from 'next/link'
import { AlertTriangle, Activity } from 'lucide-react'

export interface SchedulerSnapshot {
  readonly state: 'ok' | 'warming' | 'stale' | 'stopped'
  readonly healthy: boolean
  readonly started: boolean
  readonly lastPollAt: string | null
  readonly lastPollOk: boolean | null
  readonly ageSec: number | null
  readonly pollIntervalSec: number
  readonly dueCount: number
  readonly runningCount: number
}

interface Props {
  readonly scheduler?: SchedulerSnapshot
  readonly overdue?: number
  readonly nextScheduledAt?: string | null
}

const TIME_FMT = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: 'Asia/Shanghai',
})

function fmtTime(value: string | null): string {
  if (!value) return '尚无'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '尚无' : TIME_FMT.format(date)
}

/**
 * 排期执行状态条。
 *
 * 只回答一个用户真正关心的问题:我排好的任务,后台到底有没有人在巡检、会不会按时发。
 * 超时优先报警;正常时保持一行低调的绿点,不抢任务列表的注意力。
 */
export function SchedulerBanner({ scheduler, overdue = 0, nextScheduledAt }: Props) {
  if (!scheduler) return null

  if (overdue > 0) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-2 rounded-md border border-rose-300/60 bg-rose-500/10 px-3 py-2 text-label text-rose-700 dark:border-rose-800 dark:text-rose-300"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="font-medium">有 {overdue} 条排期已超过 5 分钟未执行</span>
        <span className="text-rose-600/80 dark:text-rose-300/80">
          调度器可能没取到任务，建议先打开列表确认状态。
        </span>
        <Link href="/publish/history?status=scheduled" className="underline underline-offset-2">
          查看排期任务
        </Link>
      </div>
    )
  }

  if (scheduler.state === 'stopped') {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-2 rounded-md border border-rose-300/60 bg-rose-500/10 px-3 py-2 text-label text-rose-700 dark:border-rose-800 dark:text-rose-300"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="font-medium">自动发布调度未启动</span>
        <span>当前排期不会自动执行，请检查 AI 服务。</span>
      </div>
    )
  }

  if (scheduler.state === 'stale') {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300/60 bg-amber-500/10 px-3 py-2 text-label text-amber-800 dark:border-amber-800 dark:text-amber-300"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="font-medium">自动发布调度心跳异常</span>
        <span>
          最后巡检 {fmtTime(scheduler.lastPollAt)}
          {scheduler.lastPollOk === false ? '，最近一轮数据库不可用' : ''}。排期任务可能不会自动执行。
        </span>
      </div>
    )
  }

  if (scheduler.state === 'warming') {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-label text-muted-foreground">
        <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>自动发布调度启动中，首轮巡检最多 {scheduler.pollIntervalSec} 秒。</span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-muted/30 px-3 py-2 text-label text-muted-foreground">
      <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-sm bg-emerald-500" aria-hidden />
        自动发布调度正常
      </span>
      <span>上次巡检 {fmtTime(scheduler.lastPollAt)}</span>
      {scheduler.runningCount > 0 && <span>发布中 {scheduler.runningCount} 条</span>}
      {nextScheduledAt && (
        <span>
          下一条 {fmtTime(nextScheduledAt)}
          {Date.parse(nextScheduledAt) < Date.now() ? '（已到点）' : ''}
        </span>
      )}
    </div>
  )
}
