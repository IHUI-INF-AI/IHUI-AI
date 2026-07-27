'use client'

import * as React from 'react'
import {
  Pin,
  PinOff,
  Minimize2,
  Circle,
  Loader2,
  Check,
  ListTodo,
  MessageSquare,
  ChevronsUpDown,
  ChevronsDownUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgentProgressPaneStore } from '@/stores/agent-progress-pane'
import { useChatStore } from '@/stores/chat'
import { useAgentProgress } from '@/hooks/use-agent-progress'
import type { PlanStep, PlanStepStatus } from '@/hooks/use-agent-progress'
import { formatDuration, FoldableSectionProvider } from './progress-sections/foldable-section'
import { ThinkingSection } from './progress-sections/thinking-section'
import { ToolCallsSection } from './progress-sections/tool-calls-section'
import { SubagentSection } from './progress-sections/subagent-section'
import { ChangesSection } from './progress-sections/changes-section'
import { TerminalSection } from './progress-sections/terminal-section'
import { OverviewSection } from './progress-sections/overview-section'

/**
 * AgentTaskProgressPane — 输入容器右上角的小 popover(2026-07-28 v7 Trae Work 对齐)
 *
 * v7 改动(对标 Trae Work):
 * - PlanStep 状态用 SVG 图标(Circle/Loader2/Check)替代 Unicode 字符
 * - 新增进度条(细线 animated,completed 色)
 * - header 新增状态点(running 时 primary 色脉冲)
 * - 空状态加 MessageSquare 图标
 * - 折叠子区间距优化(mt-1.5)
 * - 移除手动 Spinner(Codex braille),统一用 Loader2
 */

// ─── 状态图标映射 ────────────────────────────────────────────────────
const PLAN_ICON: Record<PlanStepStatus, React.ComponentType<{ className?: string }>> = {
  pending: Circle,
  in_progress: Loader2,
  completed: Check,
}
const PLAN_CLS: Record<PlanStepStatus, string> = {
  pending: 'text-muted-foreground/40',
  in_progress: 'text-primary',
  completed: 'text-emerald-500',
}

// ─── 单个 plan step 渲染 ─────────────────────────────────────────────
function PlanStepItem({ step, index }: { step: PlanStep; index: number }) {
  const Icon = PLAN_ICON[step.status]
  return (
    <div
      className={cn(
        'flex items-start gap-1.5 px-2 py-0.5 text-[11px] leading-relaxed transition-colors',
        step.status === 'in_progress' && 'bg-primary/5',
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 h-3 w-3 shrink-0',
          PLAN_CLS[step.status],
          step.status === 'in_progress' && 'animate-spin',
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'flex-1 break-all',
              step.status === 'pending' && 'text-muted-foreground/60',
            )}
          >
            {index + 1}. {step.step}
          </span>
          {step.durationMs !== undefined && step.status !== 'pending' && (
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
              {formatDuration(step.durationMs)}
            </span>
          )}
          {step.tokenUsage !== undefined && step.tokenUsage > 0 && (
            <span
              className="shrink-0 text-[10px] tabular-nums text-muted-foreground/40"
              title={`${step.tokenUsage} tokens`}
            >
              {Math.round(step.tokenUsage / 1000)}k
            </span>
          )}
        </div>
        {/* explanation 副标题:仅 in_progress 步骤显示(plan 级 explanation,避免重复) */}
        {step.status === 'in_progress' && step.explanation && (
          <div className="mt-0.5 break-all text-[10px] text-muted-foreground/40">
            {step.explanation}
          </div>
        )}
      </div>
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

  // v9: 展开全部/折叠全部控制(null=各子区独立 / true=强制展开 / false=强制折叠)
  const [expandAll, setExpandAll] = React.useState<boolean | null>(null)

  // 从 useChatStore 同步 conversationId 作为 threadId(无需用户手动输入)
  const conversationId = useChatStore((s) => s.conversationId)
  React.useEffect(() => {
    if (conversationId !== threadId) {
      setThreadId(conversationId)
    }
  }, [conversationId, threadId, setThreadId])

  const progress = useAgentProgress(open ? threadId : null)
  const { planSteps, isStreaming, subagents, tools, changes, terminals, overview } = progress

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
  const progressPct = planSteps.length > 0 ? (completedCount / planSteps.length) * 100 : 0

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
      {/* Header:状态点 + 标题 + pin 按钮 + 关闭按钮 */}
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border px-2">
        {/* 状态点:running 时 primary 色脉冲,idle 时灰色 */}
        <span
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            isStreaming
              ? 'bg-primary animate-pulse'
              : planSteps.length > 0
                ? 'bg-emerald-500'
                : 'bg-muted-foreground/30',
          )}
        />
        <ListTodo className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        <span className="shrink-0 text-xs font-medium">任务计划</span>
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
        {/* v9: 展开全部/折叠全部按钮 */}
        <button
          type="button"
          onClick={() => setExpandAll(expandAll === true ? false : true)}
          aria-label={expandAll === true ? '折叠全部' : '展开全部'}
          title={expandAll === true ? '折叠全部' : '展开全部'}
          className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          data-testid="pane-expand-all"
        >
          {expandAll === true ? (
            <ChevronsDownUp className="h-3 w-3" />
          ) : (
            <ChevronsUpDown className="h-3 w-3" />
          )}
        </button>
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

      {/* 内容:plan steps 列表 + 折叠子区 */}
      <div className="max-h-[280px] overflow-y-auto overflow-x-hidden py-1" data-testid="plan-list">
        {/* 无 conversationId */}
        {!threadId && (
          <div className="flex flex-col items-center gap-1.5 px-2 py-6 text-center">
            <MessageSquare className="h-4 w-4 text-muted-foreground/30" />
            <span className="text-[11px] text-muted-foreground/60">开始对话后显示任务计划</span>
          </div>
        )}

        {/* 有 threadId 但无 planSteps */}
        {threadId && planSteps.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 px-2 py-6 text-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
            <span className="text-[11px] text-muted-foreground/60">等待 agent 规划任务...</span>
          </div>
        )}

        {/* plan steps 列表 + 进度条 */}
        {planSteps.length > 0 && (
          <>
            {planSteps.map((step, idx) => (
              <PlanStepItem key={step.id} step={step} index={idx} />
            ))}
            {/* 进度条 + 统计 */}
            <div className="mx-2 mt-1.5">
              {/* 细线进度条 */}
              <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {/* 统计文字 */}
              <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground/60">
                <span>
                  {completedCount}/{planSteps.length} 已完成
                </span>
                {isStreaming && (
                  <span className="flex items-center gap-0.5 text-primary">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    执行中
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        {/* 折叠子区:思考过程 / 工具调用 / Subagent 派单 / 文件变更 / 终端任务 / 任务总览(对齐 Trae Work) */}
        {threadId && (
          <FoldableSectionProvider value={{ expandAll, setExpandAll }}>
            <ThinkingSection
              content={overview.content}
              currentNode={overview.currentNode}
              isStreaming={isStreaming}
            />
            <ToolCallsSection tools={tools} />
            <SubagentSection subagents={subagents} />
            <ChangesSection changes={changes} />
            <TerminalSection terminals={terminals} />
            <OverviewSection overview={overview} isStreaming={isStreaming} />
          </FoldableSectionProvider>
        )}
      </div>
    </div>
  )
}

export default AgentTaskProgressPane
