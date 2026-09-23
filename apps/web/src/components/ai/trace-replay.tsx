// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Pause, Play, RotateCcw, Route, SkipForward } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { describeToolCall } from '@ihui/shared/chat'
import { StreamRow, type StreamStatus } from '@/components/chat/stream/stream-ui'
import type { ToolCall } from '@ihui/types'
import { advancePlayback, initialPlayback, traceStepDuration } from '@/lib/trace-replay'

/** 回放步骤状态 → 活动行统一状态词汇 */
const TRACE_STATUS: Partial<Record<ToolCall['status'], StreamStatus>> = {
  running: 'running',
  success: 'success',
  error: 'error',
  cancelled: 'skipped',
}

/**
 * TraceReplay — 执行轨迹回放(P3 #39 执行轨迹即文档,2026-09-16 立,对标 Codex
 * session JSONL 的产品化回放——竞品只有原始日志,无时序重演)。
 *
 * 数据源:assistant 消息的 toolCalls(id/toolName/args/result/status/durationMs
 * 天然齐全,零后端改动)。与静态工具卡片列表的差异化价值 = **时序重演**:
 * 播放按原始顺序逐步高亮,每步停留时长按真实耗时温和加权(cap 1.8s),
 * 重现 agent 的执行节奏;"这步很重"的体感保真,回放又不被慢工具拖死。
 *
 * 接入点:MessageItem(消息流,toolCalls≥2 才显示——单步没有"重演"意义)+
 * 后续分享页(第二阶段:分享快照补 toolCalls 后)。
 */
export function TraceReplay({ toolCalls }: { toolCalls: ToolCall[] }) {
  const t = useTranslations('traceReplay')
  const tStream = useTranslations('taskStatus')
  const [pb, setPb] = React.useState(() => initialPlayback(toolCalls.length))
  const timerRef = React.useRef<number | null>(null)

  const total = toolCalls.length

  const clearTimer = React.useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // 播放引擎:cursor 处的步骤停留 traceStepDuration 后推进一步
  React.useEffect(() => {
    if (!pb.playing || pb.finished) {
      clearTimer()
      return
    }
    const step = toolCalls[pb.cursor]
    const wait = traceStepDuration(step?.durationMs)
    timerRef.current = window.setTimeout(() => {
      setPb((p) => advancePlayback(p, total))
    }, wait)
    return clearTimer
  }, [pb, toolCalls, total, clearTimer])

  // 卸载清理
  React.useEffect(() => clearTimer, [clearTimer])

  // toolCalls 变化(如流式中追加)时重置
  React.useEffect(() => {
    setPb(initialPlayback(toolCalls.length))
  }, [toolCalls])

  if (total === 0) return null

  const handlePlay = () => {
    setPb((p) => {
      if (p.finished) return { cursor: 0, playing: true, finished: false } // 重播
      return { ...p, playing: !p.playing }
    })
  }
  const handleStep = () => {
    clearTimer()
    setPb((p) => advancePlayback({ ...p, playing: false }, total))
  }
  const handleReset = () => {
    clearTimer()
    setPb({ cursor: -1, playing: false, finished: false })
  }

  const active = pb.playing || pb.cursor >= 0

  return (
    <div
      className="mt-2 rounded-md border border-border/60 bg-muted/20 p-2"
      data-testid="trace-replay"
    >
      {/* 控制行 */}
      <div className="flex items-center gap-1.5">
        <Route className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
        <span className="text-xs font-medium text-muted-foreground">{t('title')}</span>
        <span className="text-[10px] tabular-nums text-muted-foreground/60">
          {t('stepCounter', { current: pb.cursor + 1, total })}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={handlePlay}
          disabled={total === 0}
          aria-label={pb.playing ? t('pause') : pb.finished ? t('replay') : t('play')}
          data-testid="trace-replay-play"
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none disabled:opacity-50"
        >
          {pb.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={handleStep}
          disabled={pb.finished}
          aria-label={t('stepForward')}
          data-testid="trace-replay-step"
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none disabled:opacity-50"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleReset}
          aria-label={t('reset')}
          data-testid="trace-replay-reset"
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 时间线 */}
      <ol className="mt-1.5 space-y-0.5">
        {toolCalls.map((call, i) => {
          const isCurrent = i === pb.cursor
          const isDone = i < pb.cursor
          const dimmed = active && !isCurrent && !isDone
          const view = describeToolCall({ toolName: call.toolName, args: call.args })
          const title = view.nameKey ? tStream(view.nameKey) : view.codeName
          return (
            <li
              key={call.id || i}
              data-testid={`trace-step-${i}`}
              data-trace-state={isCurrent ? 'current' : isDone ? 'done' : 'pending'}
            >
              {/* 回放步骤并入消息流活动行模板:同一字号/行高/状态图标,禁止再自配 9/10/11px 档,
                  也不得把 read_file 这类英文码名摆在界面上 */}
              <StreamRow
                status={TRACE_STATUS[call.status] ?? 'pending'}
                title={title}
                subject={view.subject}
                subjectKind={view.subjectKind}
                leading={`${i + 1}.`}
                elapsedMs={call.durationMs}
                trailing={t(`status_${call.status}` as 'status_success')}
                className={cn(
                  'rounded-sm px-1.5',
                  isCurrent && 'bg-primary/10 font-medium',
                  (isDone || !active) && 'text-muted-foreground',
                  dimmed && 'opacity-45',
                )}
                testId={`trace-row-${i}`}
              />
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default TraceReplay
