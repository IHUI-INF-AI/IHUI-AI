'use client'

import * as React from 'react'
import { Pin, PinOff, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgentProgressPaneStore } from '@/stores/agent-progress-pane'
import { useChatStore } from '@/stores/chat'
import { useAgentProgress } from '@/hooks/use-agent-progress'
import type { PlanStep, PlanStepStatus } from '@/hooks/use-agent-progress'
import { formatDuration } from './progress-sections/foldable-section'
import { ThinkingSection } from './progress-sections/thinking-section'
import { ToolCallsSection } from './progress-sections/tool-calls-section'
import { SubagentSection } from './progress-sections/subagent-section'

/**
 * AgentTaskProgressPane — 输入容器右上角的小 popover(2026-07-27 v6.1 重构)
 *
 * v6.1 改动(用户规则):
 * - 位置:从 trigger 下方居中改为 trigger 容器右下方(对应"右上角"语义,带间距)
 * - 删除 threadId 输入框(自动从 useChatStore.conversationId 同步)
 * - 字体:从 font-mono 改为默认 sans 字体(跟项目整体风格一致)
 * - 新增 pin/unpin 按钮(钉住/取消置顶)
 *   - pinned=true(默认):popover 钉住,点击外部不关闭
 *   - pinned=false:popover 临时显示,点击外部或 Esc 关闭
 * - 关闭按钮 ✕ 始终可用
 *
 * 内容:
 * - 空状态(无 conversationId 或无 planSteps):"暂无任务计划,等待 agent 规划..."
 * - 有 planSteps:列表显示 □/⠋/✔ + step text + 耗时
 */

// ─── 状态字符图标 ────────────────────────────────────────────────────
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

// ─── 单个 plan step 渲染 ─────────────────────────────────────────────
function PlanStepItem({ step, index }: { step: PlanStep; index: number }) {
  return (
    <div className="flex items-start gap-1.5 px-2 py-0.5 text-[11px] leading-relaxed">
      <span className={cn('w-3 shrink-0', PLAN_CLS[step.status])}>
        {step.status === 'in_progress' ? (
          <Spinner className={PLAN_CLS[step.status]} />
        ) : (
          PLAN_CHAR[step.status]
        )}
      </span>
      <span className={cn('flex-1 break-all', PLAN_CLS[step.status])}>
        {index + 1}. {step.step}
      </span>
      {step.durationMs !== undefined && step.status !== 'pending' && (
        <span className="shrink-0 text-[10px] text-muted-foreground/60">
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
  const setThreadId = useAgentProgressPaneStore((s) => s.setThreadId)
  const pinned = useAgentProgressPaneStore((s) => s.pinned)
  const togglePin = useAgentProgressPaneStore((s) => s.togglePin)
  const toggle = useAgentProgressPaneStore((s) => s.toggle)
  const closePane = useAgentProgressPaneStore((s) => s.closePane)
  const setProgress = useAgentProgressPaneStore((s) => s.setProgress)

  // 从 useChatStore 同步 conversationId 作为 threadId(无需用户手动输入)
  const conversationId = useChatStore((s) => s.conversationId)
  React.useEffect(() => {
    if (conversationId !== threadId) {
      setThreadId(conversationId)
    }
  }, [conversationId, threadId, setThreadId])

  const progress = useAgentProgress(open ? threadId : null)
  const { planSteps, isStreaming, subagents, tools, overview } = progress

  // 同步 planSteps 进度到 store(供 trigger 显示 "01/06" 格式)
  React.useEffect(() => {
    const total = planSteps.length
    const currentIdx = planSteps.findIndex((s) => s.status === 'in_progress')
    const current = currentIdx >= 0 ? currentIdx + 1 : 0
    setProgress(current, total)
  }, [planSteps, setProgress])

  // Esc 关闭(unpin 状态下生效;pin 状态下 Esc 不关闭,避免误操作)
  React.useEffect(() => {
    if (!open || pinned) return
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
  }, [open, pinned, closePane])

  // click-outside 关闭(仅 unpin 状态)
  const paneRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open || pinned) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (paneRef.current && !paneRef.current.contains(target)) {
        // 不关闭 trigger 按钮点击(trigger 自己会 toggle)
        const trigger = document.querySelector('[data-testid="agent-progress-trigger"]')
        if (trigger && trigger.contains(target)) return
        closePane()
      }
    }
    // 延迟绑定,避免打开时的同一次 click 立即关闭
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', onClick)
    }, 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open, pinned, closePane])

  if (!open) return null

  const completedCount = planSteps.filter((s) => s.status === 'completed').length

  return (
    <div
      ref={paneRef}
      className={cn(
        // 位置:消息区右上角(固定,带 8px 间距,不随滚动移动)
        'absolute right-2 top-2 z-50',
        // 尺寸:紧凑 popover
        'w-[280px]',
        // 外观:圆角边框阴影,popover 风格
        'overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md',
      )}
      data-testid="agent-progress-pane"
    >
      {/* Header:标题 + pin 按钮 + 关闭按钮 */}
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border px-2">
        <span className="shrink-0 text-xs font-medium">任务计划</span>
        {isStreaming && (
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
        {/* pin/unpin 按钮 */}
        <button
          type="button"
          onClick={togglePin}
          aria-label={pinned ? '取消置顶' : '置顶'}
          className={cn(
            'inline-flex h-5 w-5 items-center justify-center rounded-sm transition-colors',
            pinned
              ? 'text-primary hover:bg-accent'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
          title={pinned ? '取消置顶(点击外部可关闭)' : '置顶(钉住,点击外部不关闭)'}
          data-testid="pane-pin"
        >
          {pinned ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
        </button>
        {/* 最小化按钮(跟 trigger 联动:点击 = toggle,等价于点 trigger 按钮) */}
        <button
          type="button"
          onClick={toggle}
          aria-label="最小化"
          className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          title="最小化(与触发按钮联动)"
          data-testid="pane-minimize"
        >
          <Minimize2 className="h-3 w-3" />
        </button>
      </div>

      {/* 内容:plan steps 列表 */}
      <div className="max-h-[280px] overflow-y-auto overflow-x-hidden py-1" data-testid="plan-list">
        {/* 无 conversationId */}
        {!threadId && (
          <div className="px-2 py-4 text-center text-[11px] text-muted-foreground">
            开始对话后显示任务计划
          </div>
        )}

        {/* 有 threadId 但无 planSteps */}
        {threadId && planSteps.length === 0 && (
          <div className="px-2 py-4 text-center text-[11px] text-muted-foreground">
            暂无任务计划,等待 agent 规划...
          </div>
        )}

        {/* plan steps 列表 */}
        {planSteps.length > 0 && (
          <>
            {planSteps.map((step, idx) => (
              <PlanStepItem key={step.id} step={step} index={idx} />
            ))}
            {/* 进度统计 */}
            <div className="mt-1 border-t border-border px-2 py-1 text-[10px] text-muted-foreground">
              {completedCount}/{planSteps.length} 已完成
            </div>
          </>
        )}

        {/* 折叠子区:思考过程 / 工具调用 / Subagent 派单(对齐 Trae Work) */}
        {threadId && (
          <>
            <ThinkingSection
              content={overview.content}
              currentNode={overview.currentNode}
              isStreaming={isStreaming}
            />
            <ToolCallsSection tools={tools} />
            <SubagentSection subagents={subagents} />
          </>
        )}
      </div>
    </div>
  )
}

export default AgentTaskProgressPane
