'use client'

import * as React from 'react'
import { BookOpen, FileText, Hammer, Search, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { hydrateAgentProgressPaneFromStorage } from '@/stores/agent-progress-pane'
import { useChatStore } from '@/stores/chat'
import { useModeStore } from '@/stores/mode'
import type { ChatMode } from '@ihui/types'
import { ConnectionStatusDot, deriveConnectionState } from './progress-sections/connection-status'
import { TaskListPopover } from './task-list-popover'
import { useAgentProgress } from '@/hooks/use-agent-progress'

// ChatMode 4 态元信息(从 current-mode-badge.tsx 整合而来)
const CHAT_MODE_META: Record<
  ChatMode,
  { icon: React.ComponentType<{ className?: string }>; i18nKey: string }
> = {
  build: { icon: Hammer, i18nKey: 'modeBuild' },
  plan: { icon: BookOpen, i18nKey: 'modePlan' },
  review: { icon: Search, i18nKey: 'modeReview' },
  spec: { icon: FileText, i18nKey: 'modeSpec' },
}

/**
 * AgentProgressTrigger — AI 输入框上方的"构建"按钮(2026-08-02 v9 codex 实时状态版)
 *
 * v9 改动(用户规则:"任务中实时显示当前任务进度状态 ... 当前是规划进度的时候就显示规划
 *  调用 mcp/插件时显示调用的名"):
 * - 点击按钮不再 toggle 全局 Pane(`useAgentProgressPaneStore.open`),改为切换本地
 *   `popoverOpen`,从 trigger 下方弹出一个 codex 风格浮动 popover(`TaskListPopover`)。
 * - 按钮文字实时显示当前任务状态:
 *   - 无活动:显示"任务列表"或 mode 名("构建"/"计划"等)
 *   - 流式中:显示 `currentTask.label`(如"规划进度" / "调用 web_search 工具" /
 *     "调用 xxx MCP" / "调用 yyy 插件" / "执行终端命令" / "执行中")
 *   - 有 plan 步骤进度:显示"构建 X/Y"格式
 * - 左侧构建图标(ChatMode icon)可定制:用户可传 `leftIcon` prop 覆盖,默认是 mode icon。
 *   按用户规则"唯一可以不一样的就是左侧得构建图标跟文字"——默认 codex 风格
 *   Hammer/BookOpen/Search/FileText,通过 mode 自动切换。
 *
 * v8 保留:trigger 永远渲染,无内容窜位。
 * v7 保留:ConnectionStatusDot 显示 SSE 连接状态。
 */
export function AgentProgressTrigger({
  className,
  onTriggerClick,
  leftIcon,
  leftIconText,
}: {
  className?: string
  onTriggerClick?: () => void
  /** 自定义左侧图标(默认根据 ChatMode 自动选择 Hammer/BookOpen/Search/FileText) */
  leftIcon?: React.ComponentType<{ className?: string }>
  /** 自定义左侧图标旁的文字(默认根据 ChatMode 自动选择"构建"/"计划"等) */
  leftIconText?: string
} = {}) {
  const t = useTranslations('chat')

  // v9:trigger 本地 popover 状态(不联动全局 Pane.open)
  const [popoverOpen, setPopoverOpen] = React.useState(false)
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null)

  // Phase 16: 从 useChatStore 获取 conversationId 用于推导连接状态
  const conversationId = useChatStore((s) => s.conversationId)

  // 当前 ChatMode(从 current-mode-badge 整合)
  const currentMode = useModeStore((s) => s.currentMode)
  const modeMeta = CHAT_MODE_META[currentMode]
  // 左侧图标:用户自定义 > ChatMode 默认
  const ModeIcon = leftIcon ?? modeMeta.icon
  const modeLabel = leftIconText ?? t(modeMeta.i18nKey)

  // v9:订阅 progress 状态(实时显示当前任务)
  // 注:这里直接调 useAgentProgress 与 Pane 同源,共享 SSE 流;
  // 但 useAgentProgress 内部已 useMemo 缓存,无副作用。
  const progress = useAgentProgress(conversationId)
  const { planSteps, currentTask, isStreaming, overview } = progress

  // 当前步骤(用于"构建 X/Y"格式显示)
  const completedSteps = overview.completedSteps
  const totalSteps = planSteps.length
  const inProgressIdx = planSteps.findIndex((s) => s.status === 'in_progress')
  const currentStepNumber = inProgressIdx >= 0 ? inProgressIdx + 1 : completedSteps

  // 实时状态文字优先级(用户规则):
  // 1) 流式且有 currentTask → currentTask.label
  // 2) 有 plan 步骤且有进度 → "构建 X/Y"(保留 v8 风格)
  // 3) 空闲 → mode label("构建" / "计划" / "审查" / "规格")
  const liveStatusText = React.useMemo<string>(() => {
    if (isStreaming && currentTask.kind !== 'idle' && currentTask.label) {
      return currentTask.label
    }
    if (totalSteps > 0) {
      return `${modeLabel} ${String(currentStepNumber).padStart(2, '0')}/${String(totalSteps).padStart(2, '0')}`
    }
    return modeLabel
  }, [isStreaming, currentTask, totalSteps, currentStepNumber, modeLabel])

  // 是否有"实时状态"(流式任务)→ 用于文字色突出 + 加 spinner
  const hasLiveActivity = isStreaming && currentTask.kind !== 'idle'

  // Phase 16: 推导连接状态
  const connectionState = React.useMemo(
    () =>
      deriveConnectionState(
        isStreaming,
        progress.overview.reconnectAttempt,
        !!progress.overview.error,
        conversationId,
      ),
    [isStreaming, progress.overview.reconnectAttempt, progress.overview.error, conversationId],
  )

  // Phase 24(2026-07-29):客户端 mount 后同步 localStorage 中的 open/pinned
  React.useEffect(() => {
    hydrateAgentProgressPaneFromStorage()
  }, [])

  // v9:trigger 永远渲染(无内容窜位),popover 浮层独立
  return (
    <>
      <button
        ref={setAnchorEl}
        type="button"
        onClick={() => {
          setPopoverOpen((v) => !v)
          onTriggerClick?.()
        }}
        aria-label={hasLiveActivity ? `任务进度 ${liveStatusText}` : `${modeLabel}任务`}
        aria-expanded={popoverOpen}
        aria-haspopup="dialog"
        title={`${liveStatusText} (Ctrl+Shift+J)`}
        className={cn(
          // 尺寸 + 圆角
          'inline-flex h-8 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium transition-colors duration-150 ease-out',
          // 容器背景色 + 描边
          'border border-border bg-card text-foreground/80',
          // hover subtle 颜色变化
          'hover:bg-accent hover:text-accent-foreground',
          // 有实时活动时文字用 primary 色突出
          hasLiveActivity && 'text-primary',
          // popover 打开态
          popoverOpen && 'bg-accent text-accent-foreground',
          // 外部传入的 className 覆盖
          className,
        )}
        data-testid="agent-progress-trigger"
        data-popover-open={popoverOpen}
        data-live-activity={hasLiveActivity}
      >
        {/* 左侧构建图标(可定制) + mode 文字 — codex 风格"构建"标记 */}
        <span
          className="inline-flex items-center gap-1 rounded-md bg-muted/60 p-1 text-xs font-medium text-foreground/80"
          style={{ transform: 'none' }}
          data-testid="chat-mode-badge"
          data-mode={currentMode}
        >
          <ModeIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{modeLabel}</span>
        </span>
        {/* 实时状态:流式任务时显示 spinner + 任务名 */}
        {hasLiveActivity ? (
          <span
            className="inline-flex items-center gap-1 whitespace-nowrap"
            data-testid="agent-progress-live-status"
          >
            <Loader2
              className="h-3 w-3 animate-spin text-primary"
              aria-hidden="true"
              data-testid="agent-progress-live-spinner"
            />
            <span className="truncate max-w-[180px]" title={liveStatusText}>
              {liveStatusText}
            </span>
          </span>
        ) : (
          /* 静态状态:连接状态点 + 任务列表标签(无活动时) */
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <ConnectionStatusDot state={connectionState} />
            <span>任务列表</span>
          </span>
        )}
      </button>
      {/* v9:浮动 popover(codex 风格任务列表) — 由 trigger 本地 state 控制 */}
      {popoverOpen && anchorEl && (
        <TaskListPopover anchorEl={anchorEl} onClose={() => setPopoverOpen(false)} />
      )}
    </>
  )
}

export default AgentProgressTrigger
