'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAgentProgressPaneStore } from '@/stores/agent-progress-pane'
import { useAgentProgress } from '@/hooks/use-agent-progress'
import type { PlanStep, PlanStepStatus } from '@/hooks/use-agent-progress'

/**
 * AgentTaskProgressPane — Codex 风格 plan steps popover(2026-07-27 v6 重构)
 *
 * v6 改动(用户规则):
 * - 从底部 fixed 全宽大弹窗改为小 popover(挂在 trigger 下方)
 * - 内容简化:只显示当前 agent 规划的任务进度列表(plan steps)
 * - 不再显示事件流/terminal/subagent 等(简洁)
 *
 * 样式:
 * - absolute 定位,top-full left-1/2 -translate-x-1/2(相对 trigger 居中)
 * - min-w-[280px] max-w-[400px],max-h-[320px] overflow-y-auto
 * - 圆角边框阴影(popover 风格)
 *
 * 内容:
 * - 空状态(threadId 为空或无 planSteps):"暂无任务计划,等待 agent 规划..."
 * - 有 planSteps:列表显示 □/⠋/✔ + step text + 耗时
 * - header:标题"任务计划" + 关闭按钮 ✕
 */

// ─── Codex 文本字符图标 ───────────────────────────────────────────────
const PLAN_CHAR: Record<PlanStepStatus, string> = {
  pending: '□',
  in_progress: '⠋',
  completed: '✔',
}
const PLAN_CLS: Record<PlanStepStatus, string> = {
  pending: 'text-muted-foreground',
  in_progress: 'text-primary',
  completed: 'text-emerald-500',
}

// Codex 真正循环 braille spinner(10 帧 120ms)
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
function Spinner({ className }: { className?: string }) {
  const [frame, setFrame] = React.useState(0)
  React.useEffect(() => {
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % SPINNER_FRAMES.length)
    }, 120)
    return () => window.clearInterval(id)
  }, [])
  return <span className={className}>{SPINNER_FRAMES[frame]}</span>
}

// ─── 辅助函数 ────────────────────────────────────────────────────────
function formatDuration(ms?: number): string {
  if (ms === undefined) return ''
  if (ms < 1000) return ''
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${m}m${s}s`
}

// ─── 单个 plan step 渲染 ─────────────────────────────────────────────
function PlanStepItem({ step, index }: { step: PlanStep; index: number }) {
  return (
    <div className="flex items-start gap-1.5 px-1 py-0.5 font-mono text-[11px] leading-relaxed">
      <span className={cn('shrink-0 w-3', PLAN_CLS[step.status])}>
        {step.status === 'in_progress' ? <Spinner className={PLAN_CLS[step.status]} /> : PLAN_CHAR[step.status]}
      </span>
      <span className={cn('flex-1 break-all', PLAN_CLS[step.status])}>
        {index + 1}. {step.step}
      </span>
      {step.durationMs !== undefined && step.status === 'completed' && (
        <span className="shrink-0 text-muted-foreground/60">
          {formatDuration(step.durationMs)}
        </span>
      )}
      {step.status === 'in_progress' && step.durationMs !== undefined && (
        <span className="shrink-0 text-muted-foreground/60">
          {formatDuration(step.durationMs)}
        </span>
      )}
    </div>
  )
}

// ─── 主组件 ──────────────────────────────────────────────────────────
export function AgentTaskProgressPane() {
  const open = useAgentProgressPaneStore((s) => s.open)
  const threadId = useAgentProgressPaneStore((s) => s.threadId)
  const threadIdInput = useAgentProgressPaneStore((s) => s.threadIdInput)
  const setThreadIdInput = useAgentProgressPaneStore((s) => s.setThreadIdInput)
  const submitThreadId = useAgentProgressPaneStore((s) => s.submitThreadId)
  const closePane = useAgentProgressPaneStore((s) => s.closePane)
  const setProgress = useAgentProgressPaneStore((s) => s.setProgress)

  // threadId 本地状态(同步 store)
  const [localThreadId, setLocalThreadId] = React.useState<string | null>(threadId)
  React.useEffect(() => {
    setLocalThreadId(threadId)
  }, [threadId])

  const progress = useAgentProgress(open ? localThreadId : null)
  const { planSteps, isStreaming } = progress

  // 同步 planSteps 进度到 store(供 trigger 显示 "01/06" 格式)
  React.useEffect(() => {
    const total = planSteps.length
    const currentIdx = planSteps.findIndex((s) => s.status === 'in_progress')
    const current = currentIdx >= 0 ? currentIdx + 1 : 0
    setProgress(current, total)
  }, [planSteps, setProgress])

  // Esc 关闭
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el) {
        const tag = el.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) {
          return
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        closePane()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closePane])

  if (!open) return null

  const start = () => {
    if (!localThreadId) {
      toast.warning('请先输入 threadId', { description: '在下方输入框填入 Agent threadId 后再点 run' })
      return
    }
    progress.start()
  }

  return (
    <div
      className={cn(
        'absolute top-full left-1/2 z-50 mt-1 -translate-x-1/2',
        'min-w-[280px] max-w-[400px]',
        'rounded-md border border-border bg-popover text-popover-foreground shadow-md',
      )}
      data-testid="agent-progress-pane"
    >
      {/* Header:标题 + 关闭按钮 */}
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-border px-2">
        <span className="shrink-0 font-mono text-xs font-semibold">任务计划</span>
        {localThreadId && isStreaming && (
          <span className="shrink-0 text-primary" title="streaming">
            <Spinner className="text-primary" />
          </span>
        )}
        {/* SSE 重连指示 */}
        {progress.overview.reconnectAttempt > 0 && (
          <span
            className="shrink-0 animate-pulse text-[10px] text-amber-500"
            title={`SSE 断连,正在重连(第 ${progress.overview.reconnectAttempt}/5 次)`}
          >
            ↻{progress.overview.reconnectAttempt}/5
          </span>
        )}
        <div className="flex-1" />
        {/* 关闭按钮 ✕ */}
        <button
          type="button"
          onClick={closePane}
          aria-label="关闭"
          className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          title="关闭 (Esc)"
          data-testid="pane-close"
        >
          ✕
        </button>
      </div>

      {/* 内容:plan steps 列表 */}
      <div className="max-h-[280px] overflow-y-auto overflow-x-hidden py-1" data-testid="plan-list">
        {/* threadId 为空时显示输入框 */}
        {!localThreadId && (
          <div className="flex items-center gap-1 px-2 py-1.5">
            <input
              type="text"
              value={threadIdInput}
              onChange={(e) => setThreadIdInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submitThreadId()
                }
              }}
              placeholder="enter threadId..."
              className="h-6 flex-1 rounded-sm border border-border bg-background px-1.5 font-mono text-[10px] focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              data-testid="thread-id-input"
            />
            <button
              type="button"
              onClick={submitThreadId}
              className="h-6 rounded-sm border border-border bg-background px-1.5 font-mono text-[10px] hover:bg-accent"
              title="确认 threadId"
            >
              ok
            </button>
          </div>
        )}

        {/* 有 threadId 但无 planSteps */}
        {localThreadId && planSteps.length === 0 && (
          <div className="px-2 py-4 text-center font-mono text-[11px] text-muted-foreground">
            暂无任务计划,等待 agent 规划...
          </div>
        )}

        {/* plan steps 列表 */}
        {planSteps.length > 0 && (
          <>
            {/* 启动/停止按钮(threadId 存在时) */}
            {localThreadId && !isStreaming && progress.overview.status !== 'running' && (
              <div className="border-b border-border px-2 py-1">
                <button
                  type="button"
                  onClick={start}
                  className="h-5 w-full rounded-sm border border-border bg-background font-mono text-[10px] hover:bg-accent"
                  title="启动 Agent 流"
                >
                  ▶ run
                </button>
              </div>
            )}
            {planSteps.map((step, idx) => (
              <PlanStepItem key={step.id} step={step} index={idx} />
            ))}
            {/* 进度统计 */}
            <div className="border-t border-border px-2 py-1 font-mono text-[10px] text-muted-foreground">
              {planSteps.filter((s) => s.status === 'completed').length}/{planSteps.length} 已完成
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default AgentTaskProgressPane
