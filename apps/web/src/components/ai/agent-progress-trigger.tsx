// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import {
  BookOpen,
  ChevronDown,
  FileText,
  Hammer,
  ListTodo,
  MessageCircle,
  Search,
  Loader2,
} from 'lucide-react'
import {
  COMPOSER_MENU_ROW_CHEVRON_CLASS,
  COMPOSER_MENU_ROW_CLASS,
  COMPOSER_MENU_ROW_ICON_CLASS,
  COMPOSER_MENU_ROW_VALUE_CLASS,
} from '@/lib/composer-menu-row'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { INPUT_ATTACHMENT_BAR_BTN_BASE } from '@/lib/nav-styles'
import {
  hydrateAgentProgressPaneFromStorage,
  useAgentProgressPaneStore,
} from '@/stores/agent-progress-pane'
import { usePaneChatStore } from '@/stores/chat-pane-context'
import { usePaneModeStore } from '@/stores/mode'
import type { ChatMode } from '@ihui/types'
import { useAgentProgress } from '@/hooks/use-agent-progress'

// ChatMode 5 态元信息(从 current-mode-badge.tsx 整合而来;2026-09-14 补 ask 态)
const CHAT_MODE_META: Record<
  ChatMode,
  { icon: React.ComponentType<{ className?: string }>; i18nKey: string }
> = {
  ask: { icon: MessageCircle, i18nKey: 'modeAsk' },
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
  iconOnly,
  variant = 'bar',
}: {
  className?: string
  onTriggerClick?: () => void
  leftIcon?: React.ComponentType<{ className?: string }>
  leftIconText?: string
  iconOnly?: boolean
  /**
   * bar = 底栏按钮(默认);row = + 菜单内的统一设置行;
   * status = 底栏常驻「实时状态」紧凑芯片(2026-11-04 第四轮,见下方注释)
   */
  variant?: 'bar' | 'row' | 'status'
} = {}) {
  const t = useTranslations('chat')

  // v10:全局 Pane open 状态(由 store 控制,持久化到 localStorage)
  const paneOpen = useAgentProgressPaneStore((s) => s.open)
  const togglePane = useAgentProgressPaneStore((s) => s.toggle)

  // Phase 16: 从按窗格寻址的 chat store 取 conversationId 用于推导连接状态(票60 长尾)
  const chatStore = usePaneChatStore()
  const conversationId = chatStore((s) => s.conversationId)

  // 当前 ChatMode(从 current-mode-badge 整合);票60 普查批:按窗格寻址
  const modeStore = usePaneModeStore()
  const currentMode = modeStore((s) => s.currentMode)
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

  // 2026-11-04 第四轮(用户规则:"任务进度实时状态不该降级到 2 击"):
  // 底栏常驻「实时状态」芯片 —— 流式期间恒显示(当前任务名 + spinner + 步数);
  // 流结束后仅当 Pane 仍打开时保留(芯片同时是 Pane 的开合锚点,它若消失,面板就失去
  // 对位元素、用户也失去"再点一下收起"的落点)。空闲且 Pane 关闭 ⇒ 返回 null,
  // 底栏回到极简三锚点(+ / 模型 / 发送·停止)。
  // 独立 testid `agent-progress-status`:同一 testid 若在底栏与「+ → 更多工具」抽屉
  // 各挂一处,Playwright strict mode 会因解析到多元素而报错(见 e2e 校准注释)。
  const showStatusChip = isStreaming || paneOpen
  if (variant === 'status' && !showStatusChip) return null

  // 芯片只显示"在做什么",步数单独用等宽数字落在右侧 —— 避免与 liveStatusText
  // 的 "构建 03/05" 形态重复拼成 "构建 03/05 03/05"。
  const statusLabel = isStreaming && currentTask.label ? currentTask.label : modeLabel

  // 2026-11-04:Ctrl+Shift+J 监听住在同文件的 AgentProgressShortcutHost —— 本触发器收进
  // 「+ → 更多工具」抽屉后只在菜单打开时挂载,监听留在这里会让快捷键随抽屉一起失效。
  // (宿主由 message-input 常驻挂载;输入法组合态放行规则见该组件内的 onKeyDown。)

  // v10:trigger 永远渲染,Pane 由 ai-side-panel.tsx mount,trigger 只切换 store.open
  // 2026-08-12 修复:移除原生 title= 属性(浏览器默认 tooltip 样式,无 border/无动画/
  // 字体颜色与项目不一致),改用项目统一 <Tooltip> 组件(Radix UI 实现,rounded-md +
  // bg-popover + border + Arrow + fade/zoom 动画)。hover/focus 时显示
  // `liveStatusText (Ctrl+Shift+J)`,确保快捷键提示与样式完全统一。
  // 2026-10-22 修复(CI e2e chat-mode-badge i18n ko 红根因):此前 aria-label 整串由
  // `任务进度 ${liveStatusText}` / `${modeLabel}任务` 手拼 —— 模式名走 t(),而「任务」/
  // 「任务进度」是组件内硬编码中文,非中文 locale 下渲染混血串(ko = 「빌드任务」),
  // e2e 又把混血串钉成了基线。现整串经 chat.taskProgressAria / chat.modeTaskAria
  // 五语言词包取形(ICU {status}/{mode}),zh-CN 形态逐字不变。锁定用例:
  // apps/web/tests/agent-progress-trigger-aria-i18n.test.tsx。
  // 2026-11-04 第四轮:status 变体 = 底栏常驻紧凑芯片(与 bar/row 共用同一份 store 与
  // useAgentProgress 订阅,只是形态不同;点击语义同样是 toggle Pane)。
  if (variant === 'status') {
    const StatusIcon = leftIcon ?? ListTodo
    return (
      <button
        type="button"
        onClick={() => {
          togglePane()
          onTriggerClick?.()
        }}
        aria-label={
          hasLiveActivity
            ? t('taskProgressAria', { status: liveStatusText })
            : t('modeTaskAria', { mode: modeLabel })
        }
        aria-expanded={paneOpen}
        aria-haspopup="dialog"
        className={cn(
          'flex h-8 max-w-[11rem] shrink-0 items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 text-label text-muted-foreground transition-colors duration-150 ease-out hover:bg-accent hover:text-accent-foreground',
          hasLiveActivity && 'border-primary/30 text-primary',
          className,
        )}
        data-testid="agent-progress-status"
        data-variant="status"
        data-popover-open={paneOpen}
        data-live-activity={hasLiveActivity}
        data-mode={currentMode}
      >
        {hasLiveActivity ? (
          <Loader2
            className="h-3.5 w-3.5 shrink-0 animate-spin"
            aria-hidden="true"
            data-testid="agent-progress-status-spinner"
          />
        ) : (
          <StatusIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="min-w-0 truncate">{statusLabel}</span>
        {totalSteps > 0 && (
          <span className="shrink-0 tabular-nums text-muted-foreground/70">
            {String(currentStepNumber).padStart(2, '0')}/{String(totalSteps).padStart(2, '0')}
          </span>
        )}
      </button>
    )
  }

  const RowIcon = leftIcon ?? ModeIcon
  const triggerButton = (
    <button
      type="button"
      onClick={() => {
        togglePane()
        onTriggerClick?.()
      }}
      aria-label={
        hasLiveActivity
          ? t('taskProgressAria', { status: liveStatusText })
          : t('modeTaskAria', { mode: modeLabel })
      }
      aria-expanded={paneOpen}
      aria-haspopup="dialog"
      className={cn(
        variant === 'row'
          ? COMPOSER_MENU_ROW_CLASS
          : cn(
              INPUT_ATTACHMENT_BAR_BTN_BASE,
              'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground duration-150 ease-out',
              iconOnly && 'h-8 w-8 justify-center p-0',
            ),
        hasLiveActivity && 'text-primary',
        className,
      )}
      data-testid="agent-progress-trigger"
      data-variant={variant}
      data-popover-open={paneOpen}
      data-live-activity={hasLiveActivity}
      data-mode={currentMode}
    >
      {variant === 'row' ? (
        <>
          <RowIcon className={COMPOSER_MENU_ROW_ICON_CLASS} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{t('taskProgressOpen')}</span>
          {hasLiveActivity && (
            <Loader2
              className="h-3 w-3 shrink-0 animate-spin text-primary"
              aria-hidden="true"
              data-testid="agent-progress-live-spinner"
            />
          )}
          <span className={COMPOSER_MENU_ROW_VALUE_CLASS}>
            {hasLiveActivity || totalSteps > 0 ? liveStatusText : t('taskProgressIdle')}
          </span>
          <ChevronDown className={COMPOSER_MENU_ROW_CHEVRON_CLASS} aria-hidden />
        </>
      ) : (
        <>
          <ModeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {!iconOnly && <span>{modeLabel}</span>}
          {hasLiveActivity && (
            <Loader2
              className="h-3 w-3 shrink-0 animate-spin"
              aria-hidden="true"
              data-testid="agent-progress-live-spinner"
            />
          )}
        </>
      )}
    </button>
  )

  // hover/focus 显示项目统一 Tooltip:实时任务名 + 快捷键提示,样式与项目全站一致
  return variant === 'row' ? (
    triggerButton
  ) : (
    <Tooltip content={`${liveStatusText} (Ctrl+Shift+J)`} side="bottom">
      {triggerButton}
    </Tooltip>
  )
}

/**
 * AgentProgressShortcutHost — Ctrl+Shift+J 的**唯一**全局监听宿主(2026-11-04 立)。
 *
 * 为什么必须独立成宿主:AgentProgressTrigger 已收进「+ → 更多工具」抽屉,抽屉关闭
 * 即卸载;监听若仍住在触发器里,快捷键会随抽屉一起消失(名义还在、实际失联)。
 * 反过来,宿主**只能挂一处** —— 两处同时挂载会让一次按键 toggle 两次(开了又关)。
 * 导出本组件的唯一目的是让单测能独立渲染它(见 tests/agent-task-progress-pane.test.tsx)。
 */
export function AgentProgressShortcutHost() {
  const togglePane = useAgentProgressPaneStore((s) => s.toggle)
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // 输入法组合态放行:中文/日文候选框里的 Ctrl+Shift+J 不抢
      if (e.isComposing) return
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault()
        togglePane()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [togglePane])
  return null
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
