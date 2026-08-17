'use client'

import * as React from 'react'
import { BookOpen, FileText, Hammer, Search, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { INPUT_ATTACHMENT_BAR_BTN_BASE } from '@/lib/nav-styles'
import {
  hydrateAgentProgressPaneFromStorage,
  useAgentProgressPaneStore,
} from '@/stores/agent-progress-pane'
import { useChatStore } from '@/stores/chat'
import { useModeStore } from '@/stores/mode'
import type { ChatMode } from '@ihui/types'
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
 * AgentProgressTrigger — AI 输入框上方的"构建"按钮(2026-08-02 v10 恢复 Pane 版)
 *
 * v10 改动(用户规则:"点 button 以后的弹窗怎么向下弹出呢 之前 ai 对话框右上角的
 * 那个容器呢 你给我改没了?谁让的" + "现在向下弹出的容器应该整合到右上角的容器中
 * 恢复右上角显示"):
 * - 删掉 v9 引入的本地 popoverOpen 状态 + TaskListPopover 组件(向下弹出的小卡片)。
 * - 恢复 v8 的全局 Pane 控制:点击 trigger 调 `useAgentProgressPaneStore.toggle()`,
 *   Pane 显隐由 store.open 控制。
 * - Pane 在 `ai-side-panel.tsx` 第 1062 行 mount,显示在 AI 面板右上角(用户原 v18 设计)。
 * - Pane 内部会显示 currentTask(规划/MCP/插件调用名),由 Pane 自己的渲染层整合。
 *   trigger 内部仍订阅 useAgentProgress 推 live status 给 button 文字用(spinner + 任务名),
 *   与 Pane 共享同一份 SSE 数据(无副作用,useMemo 缓存)。
 *
 * v9 已删:TaskListPopover / popoverOpen 状态 / anchorEl。
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

  // v10:全局 Pane open 状态(由 store 控制,持久化到 localStorage)
  const paneOpen = useAgentProgressPaneStore((s) => s.open)
  const togglePane = useAgentProgressPaneStore((s) => s.toggle)

  // Phase 16: 从 useChatStore 获取 conversationId 用于推导连接状态
  const conversationId = useChatStore((s) => s.conversationId)

  // 当前 ChatMode(从 current-mode-badge 整合)
  const currentMode = useModeStore((s) => s.currentMode)
  const modeMeta = CHAT_MODE_META[currentMode]
  // 左侧图标:用户自定义 > ChatMode 默认
  const ModeIcon = leftIcon ?? modeMeta.icon
  const modeLabel = leftIconText ?? t(modeMeta.i18nKey)

  // v10:订阅 progress 状态(实时显示当前任务)
  // 与 Pane 同源,共享 SSE 流;useAgentProgress 内部已 useMemo 缓存,无副作用。
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
    if (isStreaming && currentTask.label) {
      return currentTask.label
    }
    if (totalSteps > 0) {
      return `${modeLabel} ${String(currentStepNumber).padStart(2, '0')}/${String(totalSteps).padStart(2, '0')}`
    }
    return modeLabel
  }, [isStreaming, currentTask, totalSteps, currentStepNumber, modeLabel])

  // 是否有"实时状态"(流式任务时显示 spinner + 扫光,即使还没有具体任务名也显示"执行中")
  const hasLiveActivity = isStreaming

  // Phase 24(2026-07-29):客户端 mount 后同步 localStorage 中的 open/pinned
  React.useEffect(() => {
    hydrateAgentProgressPaneFromStorage()
  }, [])

  // 2026-08-05 修复:Ctrl+Shift+J 全局快捷键——UI 明示了该快捷键(title 提示 +
  // 帮助面板 shortcutTogglePane),但从未实现 keydown 监听,用户按了无反应(真 bug)。
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault()
        togglePane()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [togglePane])

  // v10:trigger 永远渲染,Pane 由 ai-side-panel.tsx mount,trigger 只切换 store.open
  // 2026-08-12 修复:移除原生 title= 属性(浏览器默认 tooltip 样式,无 border/无动画/
  // 字体颜色与项目不一致),改用项目统一 <Tooltip> 组件(Radix UI 实现,rounded-md +
  // bg-popover + border + Arrow + fade/zoom 动画)。hover/focus 时显示
  // `liveStatusText (Ctrl+Shift+J)`,确保快捷键提示与样式完全统一。
  const triggerButton = (
    <button
      ref={undefined}
      type="button"
      onClick={() => {
        console.error('[Trigger] onClick, paneOpen before toggle:', paneOpen)
        togglePane()
        console.error('[Trigger] after togglePane, store open:', useAgentProgressPaneStore.getState().open)
        onTriggerClick?.()
      }}
      aria-label={hasLiveActivity ? `任务进度 ${liveStatusText}` : `${modeLabel}任务`}
      aria-expanded={paneOpen}
      aria-haspopup="dialog"
      className={cn(
        // 尺寸 + 圆角
        'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors duration-150 ease-out',
        // 容器背景色 + 描边(始终 bg-card 白色,pane 打开态不再变灰)
        'border border-border bg-card text-foreground/80',
        // hover subtle 颜色变化(20% accent,轻微区分即可)
        'hover:bg-accent/20',
        // 有实时活动时文字用 primary 色突出
        hasLiveActivity && 'text-primary',
        // 外部传入的 className 覆盖
        className,
      )}
      data-testid="agent-progress-trigger"
      data-popover-open={paneOpen}
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
      {/* 实时状态:流式任务时只显示 spinner,避免与前面的 mode badge 文字重复 */}
      {hasLiveActivity ? (
        <span
          className="inline-flex items-center gap-1 whitespace-nowrap"
          data-testid="agent-progress-live-status"
        >
          <Loader2
            className="h-3 w-3 shrink-0 animate-spin text-primary"
            aria-hidden="true"
            data-testid="agent-progress-live-spinner"
          />
        </span>
      ) : null}
    </button>
  )

  // hover/focus 显示项目统一 Tooltip:实时任务名 + 快捷键提示,样式与项目全站一致
  return (
    <Tooltip content={`${liveStatusText} (Ctrl+Shift+J)`} side="bottom">
      {triggerButton}
    </Tooltip>
  )
}

export default AgentProgressTrigger
