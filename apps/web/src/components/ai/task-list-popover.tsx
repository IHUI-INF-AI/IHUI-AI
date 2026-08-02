'use client'

import * as React from 'react'
import { Check, Circle, Loader2, X, Hammer } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chat'
import { useAgentProgress } from '@/hooks/use-agent-progress'
import type { PlanStep } from '@/hooks/use-agent-progress'
import { useModeStore } from '@/stores/mode'
import { useTranslations } from 'next-intl'

/**
 * TaskListPopover — Codex 风格任务列表浮动 popover(2026-08-02 v2)
 *
 * 设计目标:在 AgentProgressTrigger 按钮下方弹出一个浅色卡片,
 * 内含 plan step 列表(完成态/进行中/未开始三态),底部"第 X / Y 步"指示器。
 * 完美对标 codex 截图样式:
 *  - 头部:左侧构建图标 + "构建"标签(可定制) + 实时状态文字
 *  - 已完成 step:文字 line-through 灰化,左侧圆形描边内含勾选 icon
 *  - 进行中 step:文字正常,左侧圆形描边内含 spinner 动画
 *  - 未开始 step:左侧纯空心圆,文字 muted
 *  - 底部"第 X / Y 步"+ Loader2 loading 图标
 *
 * 位置策略:由父组件(AgentProgressTrigger)提供 anchorEl,
 * 用 getBoundingClientRect 计算 popover 的 fixed 位置(下方居中)。
 *
 * 数据流:从 useChatStore.conversationId 拉取 threadId,
 * 调 useAgentProgress(threadId) 拿到 planSteps + tools,
 * 派生 currentTask(规划/MCP/插件调用名称)。
 */

interface TaskListPopoverProps {
  /** popover 锚点元素(trigger 按钮 DOM),用于计算弹出位置 */
  anchorEl: HTMLElement | null
  /** 关闭回调(点击 popover 外部 / Esc 键时触发) */
  onClose: () => void
  /** 自定义 className */
  className?: string
}

const STEP_ICON_CLS: Record<PlanStep['status'], string> = {
  completed: 'text-muted-foreground/70',
  in_progress: 'text-primary',
  pending: 'text-muted-foreground/40',
}

export function TaskListPopover({ anchorEl, onClose, className }: TaskListPopoverProps) {
  // 关闭行为:点击外部 + Esc 键
  const popoverRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!anchorEl) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node
      // 点击 anchor(trigger 按钮)时也关闭
      if (anchorEl.contains(target)) return
      if (popoverRef.current && popoverRef.current.contains(target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    // 延迟挂载,避免点击 trigger 自身时立即触发 close
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', onClick)
      window.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [anchorEl, onClose])

  // 计算 popover 位置(fixed 定位,从 anchor 下方居中弹出)
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null)
  React.useEffect(() => {
    if (!anchorEl) {
      setPosition(null)
      return
    }
    const update = () => {
      const rect = anchorEl.getBoundingClientRect()
      // 默认下方居中,若空间不足改为上方
      const popoverWidth = 320
      const margin = 8
      let left = rect.left + rect.width / 2 - popoverWidth / 2
      // 边界 clamp:防止超出视口
      left = Math.max(margin, Math.min(window.innerWidth - popoverWidth - margin, left))
      const spaceBelow = window.innerHeight - rect.bottom
      const popoverMaxHeight = 400
      let top: number
      if (spaceBelow >= popoverMaxHeight + margin || spaceBelow >= 200) {
        // 下方弹出
        top = rect.bottom + 6
      } else {
        // 上方弹出
        top = Math.max(margin, rect.top - 6 - popoverMaxHeight)
      }
      setPosition({ top, left })
    }
    update()
    // 监听 anchor 位置变化(滚动 / resize / DOM 移动)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [anchorEl])

  if (!anchorEl) return null
  if (!position) return null

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="任务列表"
      data-testid="task-list-popover"
      // z-popover(2001):与现有 Pane 同级,确保浮在 input 卡片之上
      className={cn(
        'fixed z-popover w-[320px] max-w-[calc(100vw-16px)] rounded-lg border border-border bg-popover text-popover-foreground shadow-lg',
        'animate-in fade-in-0 zoom-in-95',
        className,
      )}
      style={{ top: position.top, left: position.left }}
    >
      <TaskListContent onClose={onClose} />
    </div>
  )
}

// ─── 内容区(独立组件,便于复用 + 测试) ──────────────────────────
function TaskListContent({ onClose }: { onClose: () => void }) {
  const t = useTranslations('chat')
  // 从 useChatStore.conversationId 拉取 threadId(与 Pane 同源)
  const conversationId = useChatStore((s) => s.conversationId)
  const currentMode = useModeStore((s) => s.currentMode)
  const progress = useAgentProgress(conversationId)
  const { planSteps, currentTask, isStreaming, overview } = progress

  // 当前 step 索引(0-based,用于显示"第 X / Y 步")
  const inProgressIdx = planSteps.findIndex((s) => s.status === 'in_progress')
  const currentStepNumber = inProgressIdx >= 0 ? inProgressIdx + 1 : overview.completedSteps
  const totalSteps = planSteps.length
  const showStepCounter = totalSteps > 0

  // mode label(可定制,默认根据 ChatMode)
  const modeLabel = t('modeBuild') // 默认构建,可后续通过 prop 覆盖

  // 空态:无 plan steps + 无 currentTask — 也展示 header(可关闭 + mode 徽章)
  if (planSteps.length === 0 && currentTask.kind === 'idle') {
    return (
      <div className="overflow-hidden">
        {/* Header:左侧构建图标 + "构建"标签 + 关闭按钮(codex 风格) */}
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground/80"
            data-testid="task-list-header"
          >
            <span
              className="inline-flex h-5 items-center gap-1 rounded-md bg-muted/60 px-1.5 text-[10px] font-medium text-foreground/80"
              data-testid="task-list-mode-badge"
              data-mode={currentMode}
            >
              <Hammer className="h-3 w-3" aria-hidden="true" />
              <span>{modeLabel}</span>
            </span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
            data-testid="task-list-close"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </div>
        {/* 空态提示 */}
        <div className="px-4 py-6 text-center" data-testid="task-list-empty">
          <Circle className="mx-auto mb-2 h-5 w-5 text-muted-foreground/40" aria-hidden />
          <p className="text-xs text-muted-foreground">暂无任务,开始一段对话后这里会显示任务进度</p>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden">
      {/* Header:左侧构建图标 + "构建"标签 + 关闭按钮(codex 风格) */}
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground/80"
          data-testid="task-list-header"
        >
          <span
            className="inline-flex h-5 items-center gap-1 rounded-md bg-muted/60 px-1.5 text-[10px] font-medium text-foreground/80"
            data-testid="task-list-mode-badge"
            data-mode={currentMode}
          >
            <Hammer className="h-3 w-3" aria-hidden="true" />
            <span>{modeLabel}</span>
          </span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
          data-testid="task-list-close"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      </div>

      {/* Plan steps 列表(codex 风格) */}
      {planSteps.length > 0 && (
        <ol className="space-y-0.5 px-2 py-2" data-testid="task-list-steps">
          {planSteps.map((step) => {
            const isInProgress = step.status === 'in_progress'
            const isCompleted = step.status === 'completed'
            return (
              <li
                key={step.id}
                className="flex items-start gap-2 px-1.5 py-1"
                data-testid={`task-list-step-${step.id}`}
                data-status={step.status}
              >
                {/* 左侧圆形描边 + 状态图标(codex 风格) */}
                <span
                  className={cn(
                    'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-md border bg-card',
                    isCompleted
                      ? 'border-muted-foreground/40'
                      : isInProgress
                        ? 'border-primary'
                        : 'border-muted-foreground/30',
                  )}
                  aria-hidden
                >
                  {isCompleted ? (
                    <Check className={cn('h-2.5 w-2.5', STEP_ICON_CLS.completed)} strokeWidth={3} />
                  ) : isInProgress ? (
                    <Loader2
                      className={cn('h-2.5 w-2.5 animate-spin', STEP_ICON_CLS.in_progress)}
                    />
                  ) : (
                    <Circle className={cn('h-2.5 w-2.5', STEP_ICON_CLS.pending)} fill="none" />
                  )}
                </span>
                {/* 步骤文字 */}
                <span
                  className={cn(
                    'min-w-0 flex-1 text-[12px] leading-relaxed',
                    isCompleted && 'text-muted-foreground/70 line-through',
                    isInProgress && 'text-foreground',
                    !isCompleted && !isInProgress && 'text-muted-foreground/70',
                  )}
                >
                  {step.step}
                </span>
              </li>
            )
          })}
        </ol>
      )}

      {/* 底部"第 X / Y 步"指示器(codex 风格) */}
      {showStepCounter && (
        <div
          className="flex items-center justify-center gap-1.5 border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground"
          data-testid="task-list-footer"
        >
          {isStreaming && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden />
          )}
          <span className="tabular-nums">
            第 <span className="text-foreground/80">{currentStepNumber}</span> / {totalSteps} 步
          </span>
        </div>
      )}

      {/* 当前任务:规划/MCP/插件调用名称(无 plan steps 但有 currentTask 时显示) */}
      {planSteps.length === 0 && currentTask.kind !== 'idle' && (
        <div
          className="flex items-center gap-2 px-3 py-3 text-[12px] text-foreground/80"
          data-testid="task-list-current-task"
        >
          <Loader2 className="h-3 w-3 animate-spin text-primary" aria-hidden />
          <span>{currentTask.label}</span>
        </div>
      )}
      {/* 当前任务:有 plan steps 时,在底部也展示当前任务上下文(增强可见性) */}
      {planSteps.length > 0 && currentTask.kind !== 'idle' && currentTask.kind !== 'planning' && (
        <div
          className="flex items-center gap-1.5 border-t border-border/60 bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground"
          data-testid="task-list-current-task-inline"
        >
          <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" aria-hidden />
          <span className="truncate">{currentTask.label}</span>
        </div>
      )}
    </div>
  )
}

export default TaskListPopover
