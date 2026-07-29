'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import {
  Pin,
  PinOff,
  Minimize2,
  Maximize2,
  Circle,
  Loader2,
  Check,
  ListTodo,
  MessageSquare,
  ListTree,
  ChevronsUpDown,
  ChevronsDownUp,
  ArrowDown,
  Sparkles,
  HelpCircle,
  Keyboard,
  X,
  Timer,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import {
  useAgentProgressPaneStore,
  hydrateAgentProgressPaneFromStorage,
} from '@/stores/agent-progress-pane'
import { useChatStore } from '@/stores/chat'
import { useProgressJumpStore } from '@/stores/progress-jump-store'
import { useTimelineStore, type TimelineTabName } from '@/stores/timeline-store'
import { useAgentProgress } from '@/hooks/use-agent-progress'
import { useHoverPreview } from '@/hooks/use-hover-preview'
import type { PlanStep, PlanStepStatus, AgentToolCall, Subagent } from '@/hooks/use-agent-progress'
import {
  formatDuration,
  formatElapsed,
  FoldableSectionProvider,
} from './progress-sections/foldable-section'
import { ThinkingSection } from './progress-sections/thinking-section'
import { ToolCallsSection } from './progress-sections/tool-calls-section'
import { ChangesSection } from './progress-sections/changes-section'
import { TerminalSection } from './progress-sections/terminal-section'
import { OverviewSection } from './progress-sections/overview-section'
import { CopyButton } from './progress-sections/copy-button'
import { ProgressRing } from './progress-sections/progress-ring'
import {
  ConnectionStatus,
  ConnectionStatusDot,
  deriveConnectionState,
  type ConnectionState,
} from './progress-sections/connection-status'
import { HoverPreviewCard } from './progress-sections/hover-preview-card'
import { BatchHeader, type BatchStatus } from './progress-sections/batch-header'
import { Checklist, type ChecklistItemData } from './progress-sections/checklist'
import { ResourceBudget } from './progress-sections/resource-budget'
import { TimelineTab, flattenToTimelineEvents } from './progress-sections/timeline-tab'
import { SubAgentTaskTree } from './progress-sections/sub-agent-task-tree'

/**
 * AgentTaskProgressPane — AI 面板右上角的小 popover(2026-07-29 v17 终极根治)
 *
 * v17 改动(用户规则:"这个问题反复出现,能不能彻底根治解决好杜绝" — 把 v15 的 JS 坐标
 * 方案连根拔起,Pane 100% 由 CSS 控制,JS 零参与定位):
 * - **删除所有 JS 坐标计算**:positionStyle 不再读 paneAnchorRect,不再读 panePosition。
 *   Pane 通过 React Portal 挂载到 `[data-testid="ai-side-panel-container"]` 内部,
 *   容器自身 `position: fixed`,作为 Pane 的 containing block,Pane 用
 *   `position: absolute; top: 8px; right: 8px` 永远锚在 AI 面板右上角。
 * - **删除 v13 拖拽功能**:onHeaderMouseDown / onHeaderKeyDown / 拖拽 state / ref 全部移除。
 *   拖拽是这个 bug 的根源(JS 视口坐标 + 父容器 DOM 关系永远搞不清,任何状态机回退都会导致
 *   位置漂移 / click 吞掉 → minimize 按钮按下去没反应)。根治 = 不再需要拖拽,Pane 永远
 *   在容器右上角,resize / move / open / close 自动跟随,0 状态可漂移。
 * - **删除 v15 锚点 rect + 500ms 轮询 + resize listener**:
 *   `aside[data-testid="ai-side-panel-aside"]` 选择器 + setInterval(update, 500) 移除。
 *   不再需要"JS 反复读 DOM rect 重算位置" — 容器位置变了 Pane 跟着变,这是 CSS 排版的事。
 * - **删除 PanePosition / loadPanePosition / savePanePosition / clampPanePosition**:
 *   视口坐标 / localStorage 持久化 / 边界 clamp 全部废弃。绝对定位下 Pane 物理上就在
 *   容器内,无"出界"概念,无需 clamp。localStorage 旧值(`-v3` key)保留 — 清理时机
 *   留给后续 GC,本任务不主动清(避免影响其他用户配置)。
 * - **修复 minimize 按钮不好使的问题**:
 *   v13/v15 中,onHeaderMouseDown 在 header 上拦截 mousedown,minimize 按钮虽然在
 *   `target.closest('button, ...')` 早退分支里,但 `setIsDragging(true)` 后整个 Pane
 *   进入"拖拽中"状态,若 mouseup 漏触发或 drag state 没正确复位,后续 click 会被吞掉。
 *   v17 删除拖拽后,click 路径纯粹化,minimize 按钮 100% 触发 `setIsMinimized(true)`。
 *
 * v15 历史(已废弃,保留注释便于追溯):用 React Portal 渲染到 document.body + JS 视口
 * 坐标 + 500ms 轮询,根因 — JS 坐标在 React 时序下永远不稳定,反复出现位置漂移。
 *
 * v16 历史(已废弃,保留注释):ai-side-panel.tsx 已在 line 653-664 标注 Pane 锚点容器
 * 注释,等 Pane 自身改用 CSS absolute 锚定。v17 完成该工作。
 *
 * v13 历史(已废弃):拖拽支持。v17 因拖拽是 bug 根源,连同 v15 视口坐标一起删除。
 */

// ─── 模块级常量(避免每次 render 创建新数组,打破 React.memo 优化) ─────
const EMPTY_TOOLS: readonly AgentToolCall[] = Object.freeze(
  [] as AgentToolCall[],
) as readonly AgentToolCall[]

/** 步骤预算上限(对标 Trae Work 60 step budget) */
const STEP_BUDGET_TOTAL = 60

/** 时间窗匹配缓冲(避免边界跨越) */
const TOOL_TIME_WINDOW_TRAILING_MS = 5000
const TOOL_TIME_WINDOW_LEADING_MS = 1000

/** 每 step 默认预览的工具调用条数上限 */
const PREVIEW_TOOL_LIMIT = 4

/**
 * Pane 锚点容器选择器(v17 终极根治):与 ai-side-panel.tsx 的
 * `[data-testid="ai-side-panel-container"]` 对应。
 * Pane 用 React Portal 挂载到这个 div 内部,容器自身 position: fixed,
 * 作为 Pane 的 containing block,Pane absolute 内部,JS 零参与定位。
 */
const PANE_ANCHOR_SELECTOR = '[data-testid="ai-side-panel-container"]'

/** Skeleton 行数(v13:3 → 4,更符合常见 plan 步骤规模) */
const PLAN_SKELETON_ROWS = 4

/** 完成态庆祝横幅显示时长 */
const CELEBRATION_DURATION_MS = 3000

/** 快捷键分组(模块级 const 避免每次 render 重新创建) */
interface ShortcutItem {
  /** 键组合(如 "↑/↓" / "?" / "Esc") */
  keys: string
  /** i18n key — 描述,在 render 内调 t() 翻译 */
  i18nKey: string
}

interface ShortcutGroup {
  /** i18n key */
  i18nKey: string
  items: ShortcutItem[]
}

const SHORTCUT_GROUPS: ReadonlyArray<ShortcutGroup> = [
  {
    i18nKey: 'shortcutsGroupNav',
    items: [
      { keys: '↑/↓', i18nKey: 'shortcutSectionNav' },
      { keys: 'Home/End', i18nKey: 'shortcutSectionFirstLast' },
    ],
  },
  {
    i18nKey: 'shortcutsGroupPane',
    items: [
      { keys: '?', i18nKey: 'shortcutShowHelp' },
      { keys: 'Esc', i18nKey: 'shortcutCloseHelp' },
    ],
  },
  {
    i18nKey: 'shortcutsGroupTrigger',
    items: [
      { keys: 'Ctrl+Shift+J', i18nKey: 'shortcutTogglePane' },
      { keys: '↑', i18nKey: 'shortcutOpenPane' },
    ],
  },
]

// ─── 状态图标映射 ────────────────────────────────────────────────────
const PLAN_ICON: Record<PlanStepStatus, React.ComponentType<{ className?: string }>> = {
  pending: Circle,
  in_progress: Loader2,
  completed: Check,
}
const PLAN_CLS: Record<PlanStepStatus, string> = {
  pending: 'text-muted-foreground/60',
  in_progress: 'text-primary',
  completed: 'text-emerald-500',
}

// ─── Preview 数据类型(传给 useHoverPreview 的 data) ──────────────────
interface PlanStepPreviewData {
  step: PlanStep
  index: number
  linkedMessagePreview: string | null
  relatedToolCount: number
}

// ─── Tab 切换按钮配置(模块级,避免打破 React.memo 优化) ───────────────
const TAB_BUTTONS: ReadonlyArray<{
  id: TimelineTabName
  /** i18n key — 模块级 const 无法直接调 t(),在 render 内用 key 调用 */
  i18nKey: 'tabInline' | 'tabTimeline'
  Icon: React.ComponentType<{ className?: string }>
}> = [
  { id: 'inline', i18nKey: 'tabInline', Icon: MessageSquare },
  { id: 'timeline', i18nKey: 'tabTimeline', Icon: ListTree },
]

// ─── 单个 plan step 渲染(v13:i18n 化 hover 预览) ────────────────────
const PlanStepItem = React.memo(function PlanStepItem({
  step,
  index,
  linkedMessageId,
  linkedMessagePreview,
  relatedTools,
  isHighlighted,
}: {
  step: PlanStep
  index: number
  linkedMessageId: string | null
  linkedMessagePreview: string | null
  relatedTools: readonly AgentToolCall[]
  isHighlighted: boolean
}) {
  const t = useTranslations('ai.pane')
  const anchorRef = React.useRef<HTMLDivElement>(null)
  const Icon = PLAN_ICON[step.status]

  // ProgressJumpStore 接入点
  const setHoveredPlanStep = useProgressJumpStore((s) => s.setHoveredPlanStep)
  const setHoveredMessage = useProgressJumpStore((s) => s.setHoveredMessage)
  const requestJumpToMessage = useProgressJumpStore((s) => s.requestJumpToMessage)
  const flashHighlight = useProgressJumpStore((s) => s.flashHighlight)

  const stepLabel =
    step.status === 'in_progress'
      ? t('stepInProgress', { n: index + 1, step: step.step })
      : step.status === 'completed'
        ? t('stepCompleted', { n: index + 1, step: step.step })
        : t('stepPending', { n: index + 1, step: step.step })

  // HoverPreviewCard 接入点:buildContent + useHoverPreview(250ms 延迟 / 100ms 关闭)
  const previewData = React.useMemo<PlanStepPreviewData | null>(() => {
    if (
      step.status === 'pending' &&
      !step.explanation &&
      !linkedMessagePreview &&
      relatedTools.length === 0
    ) {
      return null
    }
    return {
      step,
      index,
      linkedMessagePreview,
      relatedToolCount: relatedTools.length,
    }
  }, [step, index, linkedMessagePreview, relatedTools.length])

  const buildPreviewContent = React.useCallback(
    (data: PlanStepPreviewData) => (
      <div className="space-y-1">
        <div className="text-[10px] text-muted-foreground/70">
          {t('previewStepNumberAndName', { n: data.index + 1, step: data.step.step })}
        </div>
        {data.step.explanation && (
          <div className="text-[10px] leading-relaxed text-muted-foreground/80">
            {data.step.explanation}
          </div>
        )}
        <div className="flex flex-wrap gap-x-2 text-[10px] text-muted-foreground/60">
          {data.step.durationMs !== undefined && (
            <span>{t('previewDuration', { duration: formatDuration(data.step.durationMs) })}</span>
          )}
          {data.step.tokenUsage !== undefined && data.step.tokenUsage > 0 && (
            <span>{t('previewTokenK', { k: Math.round(data.step.tokenUsage / 1000) })}</span>
          )}
          {data.relatedToolCount > 0 && (
            <span>{t('previewToolCalls', { n: data.relatedToolCount })}</span>
          )}
        </div>
        {data.linkedMessagePreview && (
          <div className="border-t border-border/40 pt-1 text-[10px] text-muted-foreground/60">
            <span className="font-medium text-foreground/70">{t('previewRelatedMessage')}</span>{' '}
            {data.linkedMessagePreview}
          </div>
        )}
      </div>
    ),
    [t],
  )

  const { visible, position, content, hoverHandlers } = useHoverPreview<PlanStepPreviewData>({
    buildContent: buildPreviewContent,
    // anchorRef 类型兼容:useHoverPreview 期望 RefObject<HTMLElement>,实际是 HTMLDivElement
    anchorRef: anchorRef as React.RefObject<HTMLElement>,
    data: previewData,
    delayMs: 250,
    closeDelayMs: 100,
  })

  // 点击跳转接入点
  const onClick = React.useCallback(() => {
    if (!linkedMessageId) return
    requestJumpToMessage(linkedMessageId)
    flashHighlight(linkedMessageId)
    // 最佳努力滚动:用 data-message-id 选择器(若 MessageList 加上即可工作)
    const el = document.querySelector(
      `[data-message-id="${linkedMessageId}"]`,
    ) as HTMLElement | null
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // 派发自定义事件,MessageList 未来监听可响应
    window.dispatchEvent(
      new CustomEvent('ihui:scroll-to-message', { detail: { messageId: linkedMessageId } }),
    )
  }, [linkedMessageId, requestJumpToMessage, flashHighlight])

  // 鼠标 hover 接入点:同步 store(setHoveredPlanStep + setHoveredMessage)
  const onMouseEnter = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      hoverHandlers.onMouseEnter(e)
      setHoveredPlanStep(step.id)
      if (linkedMessageId) setHoveredMessage(linkedMessageId)
    },
    [hoverHandlers, setHoveredPlanStep, setHoveredMessage, step.id, linkedMessageId],
  )
  const onMouseLeave = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      hoverHandlers.onMouseLeave(e)
      setHoveredPlanStep(null)
      setHoveredMessage(null)
    },
    [hoverHandlers, setHoveredPlanStep, setHoveredMessage],
  )
  // 键盘无障碍:Enter / Space 触发跳转(满足 jsx-a11y/click-events-have-key-events)
  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClick()
      }
    },
    [onClick],
  )

  // 步骤关联工具调用的精简 Checklist(仅 in_progress 时显示,避免噪声)
  const checklistItems: ChecklistItemData[] = React.useMemo(() => {
    if (relatedTools.length === 0) return []
    return relatedTools.slice(0, PREVIEW_TOOL_LIMIT).map<ChecklistItemData>((tool) => ({
      id: tool.id,
      label: tool.toolName,
      status:
        tool.status === 'success'
          ? 'completed'
          : tool.status === 'error'
            ? 'skipped'
            : 'in_progress',
      meta: tool.durationMs !== undefined ? formatDuration(tool.durationMs) : undefined,
    }))
  }, [relatedTools])

  // v13: status 变化时短暂 scale + transition 动画(从 in_progress 切到 completed 时尤其明显)
  // 用 ref 跟踪 prev status,变化时触发 400ms 缩放回弹
  const [iconBumpKey, setIconBumpKey] = React.useState<number>(0)
  const prevStatusRef = React.useRef<PlanStepStatus>(step.status)
  React.useEffect(() => {
    if (prevStatusRef.current !== step.status) {
      prevStatusRef.current = step.status
      setIconBumpKey((k) => k + 1)
    }
  }, [step.status])

  return (
    <>
      <div
        ref={anchorRef}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={hoverHandlers.onFocus}
        onBlur={hoverHandlers.onBlur}
        className={cn(
          'flex cursor-pointer items-start gap-1.5 px-2 py-0.5 text-[11px] leading-relaxed transition-colors',
          step.status === 'in_progress' && 'bg-primary/10',
          isHighlighted && 'bg-primary/5 ring-1 ring-primary/30',
        )}
        aria-label={stepLabel}
        data-testid={`plan-step-${step.id}`}
        data-plan-step-id={step.id}
      >
        <Icon
          // v13: 加 transition-all + scale 切换动画;key 变化时 React 重新挂载,触发原生 CSS 动画
          key={`icon-${iconBumpKey}`}
          className={cn(
            'mt-0.5 h-3 w-3 shrink-0 transition-all duration-300',
            PLAN_CLS[step.status],
            step.status === 'in_progress' && 'animate-spin',
            // status 切换时短暂放大回弹(在 tailwind 配置中需支持 animate-icon-pop)
            'animate-icon-pop',
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
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
                {formatDuration(step.durationMs)}
              </span>
            )}
            {step.tokenUsage !== undefined && step.tokenUsage > 0 && (
              <span
                className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60"
                title={`${step.tokenUsage} tokens`}
              >
                {Math.round(step.tokenUsage / 1000)}k
              </span>
            )}
          </div>
          {step.status === 'in_progress' && step.explanation && (
            <div className="mt-0.5 break-all text-[10px] text-muted-foreground/60">
              {step.explanation}
            </div>
          )}
          {/* Phase 19: 步骤关联工具调用 Checklist(仅 in_progress 时展开,避免长列表) */}
          {step.status === 'in_progress' && checklistItems.length > 0 && (
            <div className="mt-0.5">
              <Checklist items={checklistItems} dense data-testid={`plan-step-tools-${step.id}`} />
              {relatedTools.length > PREVIEW_TOOL_LIMIT && (
                <div className="pl-3 text-[10px] text-muted-foreground/50">
                  {t('moreItems', { n: relatedTools.length - PREVIEW_TOOL_LIMIT })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {visible && content !== null && (
        <HoverPreviewCard
          visible={visible}
          position={position}
          content={content}
          data-testid={`hover-preview-${step.id}`}
        />
      )}
    </>
  )
})

// ─── MinimizedSummaryBar:最小化模式摘要条(Phase 23,2026-07-29 立) ───
// 点击 minimize 按钮后,pane 不完全隐藏,而是显示 1-2 行摘要条:
// [AI 执行中 · 3 工具调用 · 2 子智能体 · 45% [展开]]
interface MinimizedSummaryBarProps {
  progress: number
  toolCallCount: number
  subagentCount: number
  onExpand: () => void
}

function MinimizedSummaryBar({
  progress,
  toolCallCount,
  subagentCount,
  onExpand,
}: MinimizedSummaryBarProps) {
  const t = useTranslations('ai.pane')
  return (
    <div
      className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs shadow-md"
      data-testid="pane-minimized-bar"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-3 w-3 animate-spin text-primary" aria-hidden />
      <span className="font-medium text-foreground">{t('minimizedRunning')}</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">
        {toolCallCount} {t('minimizedTools')}
      </span>
      {subagentCount > 0 && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {subagentCount} {t('minimizedSubagents')}
          </span>
        </>
      )}
      <span className="text-muted-foreground">·</span>
      <span className="font-medium text-primary">{Math.round(progress)}%</span>
      {/* 迷你进度条 */}
      <div
        className="h-1 w-16 overflow-hidden rounded-sm bg-muted/40"
        aria-hidden
        data-testid="pane-minimized-progress-track"
      >
        <div
          className="h-full rounded-sm bg-primary transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          data-testid="pane-minimized-progress-fill"
        />
      </div>
      <button
        type="button"
        onClick={onExpand}
        className="ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
        aria-label={t('expand')}
        title={t('expand')}
        data-testid="pane-expand"
      >
        <Maximize2 className="h-3 w-3" aria-hidden />
      </button>
    </div>
  )
}

// ─── 主组件(v13:Phase 20 全量集成) ─────────────────────────────────
export function AgentTaskProgressPane() {
  const t = useTranslations('ai.pane')
  const open = useAgentProgressPaneStore((s) => s.open)
  const threadId = useAgentProgressPaneStore((s) => s.threadId)
  const setThreadId = useAgentProgressPaneStore((s) => s.setThreadId)
  const pinned = useAgentProgressPaneStore((s) => s.pinned)
  const togglePin = useAgentProgressPaneStore((s) => s.togglePin)
  const closePane = useAgentProgressPaneStore((s) => s.closePane)
  const setProgress = useAgentProgressPaneStore((s) => s.setProgress)

  // v9: 展开全部/折叠全部控制
  const [expandAll, setExpandAll] = React.useState<boolean | null>(null)

  // Phase 19: BatchHeader 折叠状态(默认折叠,避免初次打开时 pane 太长)
  const [batchCollapsed, setBatchCollapsed] = React.useState<boolean>(true)

  // v13: 快捷键帮助面板开关(pane 打开时按 ? 弹出,Esc 或点关闭按钮收起)
  const [showHelp, setShowHelp] = React.useState<boolean>(false)

  // Phase 23(2026-07-29):最小化模式 — pane 不完全隐藏,显示 1-2 行摘要条
  const [isMinimized, setIsMinimized] = React.useState<boolean>(false)

  // v15: 实时计时器 tick(state-only,每 1000ms 递增,触发 Pane 内部重渲染)
  // 仅在 isStreaming / sessionStart 存在时启用,避免空闲 tick 浪费
  const [elapsedTick, setElapsedTick] = React.useState<number>(0)

  // v15: mounted 标志(SSR 安全 — createPortal 需要 document.body,SSR 时不存在)
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Phase 24(2026-07-29):客户端 mount 后同步 localStorage 中的 open/pinned 状态,
  // 避免 SSR 用默认值 false/true,CSR 却是 true 触发 hydration 错误
  // (与 agent-progress-trigger.tsx 的 hydrate 互为冗余 — hydrationApplied flag 保证幂等)
  React.useEffect(() => {
    hydrateAgentProgressPaneFromStorage()
  }, [])

  // 从 useChatStore 同步 conversationId + 读取 messages(用于 planStep↔message 关联)
  const conversationId = useChatStore((s) => s.conversationId)
  const chatMessages = useChatStore((s) => s.messages)
  React.useEffect(() => {
    if (conversationId !== threadId) {
      setThreadId(conversationId)
    }
  }, [conversationId, threadId, setThreadId])

  // v17 终极根治:Portal 锚点元素(AI 面板外层 div,作为 Pane 的 containing block)
  // - 用 state 而非 ref 是因为 createPortal 第二参必须是 element,需要触发重渲染
  // - mounted 后查询 document,这样 AI 面板在 mount 后任何时刻打开都能找到容器
  // - 容器不存在(AI 面板未挂载)时不渲染,避免 Pane 浮到 document.body(旧 v15 bug)
  const [paneAnchor, setPaneAnchor] = React.useState<HTMLElement | null>(null)
  React.useEffect(() => {
    if (!mounted) return
    const resolve = () => {
      const el = document.querySelector(PANE_ANCHOR_SELECTOR) as HTMLElement | null
      setPaneAnchor(el)
    }
    resolve()
    // AI 面板是 fixed 全局组件,挂载/卸载只会发生在 useAiPanelStore.open 切换
    // 时;open 切换会触发 AISidePanel 整体 mount/unmount,ai-side-panel-container
    // 也会跟着出现/消失。用 MutationObserver 监听 document.body 子节点变化即可。
    const observer = new MutationObserver(resolve)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [mounted])

  const progress = useAgentProgress(open ? threadId : null)
  const { planSteps, isStreaming, subagents, tools, changes, terminals, overview } = progress

  // v15: 实时计时器 — 仅在 streaming 或 sessionStart 存在时每秒 tick,空闲时停止
  // elapsed 派生:基于 sessionStart + 累计 tick 秒数,避免依赖当前 Date.now()(避免重渲染后时间跳变)
  const shouldTick = isStreaming || overview.sessionStart !== null
  React.useEffect(() => {
    if (!shouldTick) return
    const id = window.setInterval(() => {
      setElapsedTick((n) => n + 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [shouldTick])
  const elapsedLabel = React.useMemo<string>(() => {
    if (overview.sessionStart === null) return ''
    const startMs = Date.parse(overview.sessionStart)
    if (Number.isNaN(startMs)) return ''
    // elapsedTick 触发 setInterval 强制重算(本身不参与计算),此处读取以满足 eslint 检查
    const _tick = elapsedTick
    void _tick
    const totalSec = Math.floor((Date.now() - startMs) / 1000)
    return formatElapsed(totalSec)
  }, [overview.sessionStart, elapsedTick])

  // v15: 失败计数(派生)— failed subagent + failed tool
  const failureCount = React.useMemo<number>(() => {
    const failedSubagents = subagents.filter(
      (s) => s.status === 'failed' || s.status === 'dead',
    ).length
    const failedTools = tools.filter((t) => t.status === 'error').length
    const failedTerminals = terminals.filter((t) => t.status === 'failed').length
    return failedSubagents + failedTools + failedTerminals
  }, [subagents, tools, terminals])

  // v9: token 统计(汇总 planSteps + subagents 的 tokenUsage)
  const totalTokens = React.useMemo(() => {
    const planTokens = planSteps.reduce((sum, s) => sum + (s.tokenUsage ?? 0), 0)
    const subagentTokens = subagents.reduce((sum, s) => sum + (s.tokenUsage ?? 0), 0)
    return planTokens + subagentTokens
  }, [planSteps, subagents])

  const tokenRate = React.useMemo(() => {
    if (!overview.sessionStart || totalTokens === 0) return 0
    const startMs = Date.parse(overview.sessionStart)
    if (Number.isNaN(startMs)) return 0
    const elapsedSec = (Date.now() - startMs) / 1000
    if (elapsedSec < 1) return 0
    return Math.round(totalTokens / elapsedSec)
  }, [overview.sessionStart, totalTokens])

  const etaMs = React.useMemo<number | null>(() => {
    if (planSteps.length === 0) return null
    const completed = planSteps.filter(
      (s) => s.status === 'completed' && s.durationMs !== undefined,
    )
    if (completed.length === 0) return null
    const avgMs = completed.reduce((sum, s) => sum + (s.durationMs ?? 0), 0) / completed.length
    const remaining = planSteps.filter((s) => s.status === 'pending').length
    return remaining > 0 ? Math.round(avgMs * remaining) : null
  }, [planSteps])

  const contextUsage = totalTokens > 0 ? Math.min(100, (totalTokens / 128000) * 100) : 0

  // v10: completedCount + progressPct 用 useMemo 缓存
  const { completedCount, progressPct } = React.useMemo(() => {
    if (planSteps.length === 0) return { completedCount: 0, progressPct: 0 }
    const completed = planSteps.filter((s) => s.status === 'completed').length
    return {
      completedCount: completed,
      progressPct: (completed / planSteps.length) * 100,
    }
  }, [planSteps])

  // v13: 完成态庆祝横幅(全部 plan steps completed 时短暂显示)
  const [showCelebration, setShowCelebration] = React.useState<boolean>(false)
  const celebrationShownRef = React.useRef<boolean>(false)
  React.useEffect(() => {
    const allComplete = planSteps.length > 0 && progressPct >= 100
    if (allComplete && !celebrationShownRef.current) {
      celebrationShownRef.current = true
      setShowCelebration(true)
      const id = window.setTimeout(() => setShowCelebration(false), CELEBRATION_DURATION_MS)
      return () => window.clearTimeout(id)
    }
    // 当有新的 pending step 出现(任务重置/新 plan)时,重置庆祝标志以便再次触发
    if (!allComplete && planSteps.length === 0) {
      celebrationShownRef.current = false
    }
    return undefined
  }, [planSteps, progressPct])

  // v17 终极根治:删除 Phase 23 "idle 状态自动展开最小化面板" useEffect
  // 根因:这个 effect 在 `isMinimized && progressPct === 0 && tools.length === 0`
  //      时立刻 `setIsMinimized(false)`,把用户的 minimize 操作秒级撤销。
  //      表现为"按了 minimize 按钮,Pane 没变化"——按钮没坏,是 effect 在背后 reset。
  //      正确语义:minimize 完全由用户控制,点 minimize = 真要最小化,直到主动点展开为止。
  //      不允许任何"自动展开"逻辑干扰用户操作(自动展开的副作用是"按钮好像坏了")。
  // Phase 23(2026-07-29 立):idle 状态自动展开最小化面板
  // 当 AI 不在执行时(progressPct=0 且无工具调用),自动退出最小化模式
  // useEffect 依赖用原始 primitive(`progressPct` number / `tools.length` number),
  // 避免数组/对象引用每 render 新建导致的 effect 无限重跑(§useEffect 依赖项含对象引用陷阱)
  // React.useEffect(() => {  // <-- 2026-07-29 注释保留,v17 已删除
  //   if (isMinimized && progressPct === 0 && tools.length === 0) {
  //     setIsMinimized(false)
  //   }
  // }, [isMinimized, progressPct, tools.length])

  // Phase 16: 进度环状态推导
  const ringState: 'idle' | 'in_progress' | 'completed' = React.useMemo(() => {
    if (planSteps.length === 0) return 'idle'
    if (progressPct >= 100) return 'completed'
    if (isStreaming) return 'in_progress'
    return 'idle'
  }, [planSteps.length, progressPct, isStreaming])

  // Phase 16: SSE 连接状态推导
  const connectionState: ConnectionState = React.useMemo(
    () =>
      deriveConnectionState(
        isStreaming,
        progress.overview.reconnectAttempt,
        !!progress.overview.error,
        threadId,
      ),
    [isStreaming, progress.overview.reconnectAttempt, progress.overview.error, threadId],
  )

  // 同步 planSteps 进度到 store(供 trigger 显示 "01/06" 格式)
  React.useEffect(() => {
    const total = planSteps.length
    const currentIdx = planSteps.findIndex((s) => s.status === 'in_progress')
    const current = currentIdx >= 0 ? currentIdx + 1 : 0
    setProgress(current, total)
  }, [planSteps, setProgress])

  // Phase 19: planStep ↔ message 映射(时间窗 + 索引兜底)
  const planStepLinkMap = React.useMemo(() => {
    const m = new Map<string, { messageId: string; preview: string }>()
    const assistantMsgs = chatMessages.filter((msg) => msg.role === 'assistant')
    planSteps.forEach((step, idx) => {
      let match: { messageId: string; preview: string } | null = null
      // 1) 时间窗匹配:startedAt ~ endedAt
      if (step.startedAt && step.endedAt) {
        const startMs = Date.parse(step.startedAt)
        const endMs = Date.parse(step.endedAt)
        if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
          const found = assistantMsgs.find(
            (msg) => msg.createdAt >= startMs && msg.createdAt <= endMs,
          )
          if (found) match = { messageId: found.id, preview: found.content.slice(0, 80) }
        }
      }
      // 2) 索引兜底
      if (!match) {
        const fallback = assistantMsgs[idx]
        if (fallback) match = { messageId: fallback.id, preview: fallback.content.slice(0, 80) }
      }
      if (match) m.set(step.id, match)
    })
    return m
  }, [planSteps, chatMessages])

  // Phase 19: 把映射写入 ProgressJumpStore(供跨组件反向联动)
  const linkPlanStepToMessage = useProgressJumpStore((s) => s.linkPlanStepToMessage)
  React.useEffect(() => {
    planStepLinkMap.forEach((link, stepId) => {
      linkPlanStepToMessage(stepId, link.messageId)
    })
  }, [planStepLinkMap, linkPlanStepToMessage])

  // Phase 19: 切换会话时清空联动状态(避免脏数据)
  React.useEffect(() => {
    if (!open) {
      useProgressJumpStore.getState().clearAllLinks()
    }
  }, [open, threadId])

  // Phase 19: 每个 plan step 关联的工具调用(时间窗 + 缓冲)
  const toolsByStep = React.useMemo(() => {
    const map = new Map<string, readonly AgentToolCall[]>()
    planSteps.forEach((step) => {
      const startMs = step.startedAt ? Date.parse(step.startedAt) : Number.NaN
      const endMs = step.endedAt ? Date.parse(step.endedAt) : Date.now()
      if (Number.isNaN(startMs)) {
        map.set(step.id, EMPTY_TOOLS)
        return
      }
      const related = tools.filter((t) => {
        const tStart = Date.parse(t.startedAt)
        return (
          !Number.isNaN(tStart) &&
          tStart >= startMs - TOOL_TIME_WINDOW_LEADING_MS &&
          tStart <= endMs + TOOL_TIME_WINDOW_TRAILING_MS
        )
      })
      map.set(step.id, related)
    })
    return map
  }, [planSteps, tools])

  // Phase 19: BatchHeader 状态推导(running / completed / failed / partial)
  const subagentBatchStats = React.useMemo<{
    agentCount: number
    completedCount: number
    failedCount: number
    status: BatchStatus
  }>(() => {
    const completedCount = subagents.filter((s) => s.status === 'done').length
    const failedCount = subagents.filter((s) => s.status === 'failed' || s.status === 'dead').length
    const running = subagents.filter((s) => s.status === 'running' || s.status === 'spawned').length
    let status: BatchStatus = 'completed'
    if (running > 0) status = 'running'
    else if (failedCount > 0 && completedCount > 0) status = 'partial'
    else if (failedCount > 0) status = 'failed'
    return { agentCount: subagents.length, completedCount, failedCount, status }
  }, [subagents])

  // Phase 19: 时间线事件写入 TimelineStore(供 TimelineTab 渲染)
  const setEvents = useTimelineStore((s) => s.setEvents)
  React.useEffect(() => {
    const fallbackTs = new Date().toISOString()
    const events = flattenToTimelineEvents({
      plans: planSteps.map((p) => ({
        id: p.id,
        step: p.step,
        status: p.status,
        timestamp: p.startedAt ?? p.endedAt ?? fallbackTs,
        explanation: p.explanation,
      })),
      subagents: subagents.map((s) => ({
        id: s.id,
        nickname: s.nickname,
        handle: s.handle,
        status: s.status,
        spawnedAt: s.spawnedAt,
        currentTask: s.currentTask,
      })),
      tools: tools.map((t) => ({
        id: t.id,
        toolName: t.toolName,
        status: t.status,
        startedAt: t.startedAt,
        durationMs: t.durationMs,
      })),
    })
    setEvents(events)
  }, [planSteps, subagents, tools, setEvents])

  // Phase 19: 监听 pendingJumpToMessage → 最佳努力滚动到消息
  const pendingJump = useProgressJumpStore((s) => s.pendingJumpToMessage)
  React.useEffect(() => {
    if (!pendingJump) return
    const { messageId } = pendingJump
    const el = document.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement | null
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [pendingJump])

  // Phase 19: 高亮推导(从 store 派生 isHighlighted)
  const hoveredPlanStepId = useProgressJumpStore((s) => s.hoveredPlanStepId)
  const hoveredMessageId = useProgressJumpStore((s) => s.hoveredMessageId)
  const isStepHighlighted = React.useCallback(
    (stepId: string, linkedMessageId: string | null): boolean => {
      if (hoveredPlanStepId === stepId) return true
      if (linkedMessageId && hoveredMessageId === linkedMessageId) return true
      return false
    },
    [hoveredPlanStepId, hoveredMessageId],
  )

  // Phase 19: Timeline tab state
  const activeTab = useTimelineStore((s) => s.activeTab)
  const setActiveTab = useTimelineStore((s) => s.setActiveTab)

  // Esc 关闭(unpin 状态下生效) + 帮助面板关闭
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
      // 帮助面板打开时,Esc 优先关帮助,避免冒泡到外层 closePane
      if (e.key === 'Escape' && showHelp) {
        e.preventDefault()
        e.stopPropagation()
        setShowHelp(false)
        return
      }
      if (e.key === 'Escape' && !pinned) {
        e.preventDefault()
        closePane()
      }
      // v13: 按 ? (Shift+/) 切换帮助面板
      if (e.key === '?') {
        e.preventDefault()
        setShowHelp((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, pinned, closePane, showHelp])

  // v11: 折叠子区键盘导航
  const onSectionsKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (!target.matches('[data-section-header]')) return
    const container = e.currentTarget
    const headers = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[data-section-header]'),
    )
    if (headers.length === 0) return
    const currentIdx = headers.indexOf(target as HTMLButtonElement)
    if (currentIdx === -1) return
    let nextIdx = currentIdx
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        nextIdx = (currentIdx + 1) % headers.length
        break
      case 'ArrowUp':
        e.preventDefault()
        nextIdx = (currentIdx - 1 + headers.length) % headers.length
        break
      case 'Home':
        e.preventDefault()
        nextIdx = 0
        break
      case 'End':
        e.preventDefault()
        nextIdx = headers.length - 1
        break
      default:
        return
    }
    headers[nextIdx]?.focus()
  }

  // click-outside 关闭
  // v17 终极根治:删除 isDragging 拦截(无拖拽状态机,click 路径纯粹)
  const paneRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open || pinned) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (paneRef.current && !paneRef.current.contains(target)) {
        const trigger = document.querySelector('[data-testid="agent-progress-trigger"]')
        if (trigger && trigger.contains(target)) return
        closePane()
      }
    }
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', onClick)
    }, 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open, pinned, closePane])

  // Phase 17: 自动滚动逻辑
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = React.useState(true)
  const [showJumpToLatest, setShowJumpToLatest] = React.useState(false)

  const onScroll = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const atBottom = distanceFromBottom < 20
    setAutoScroll(atBottom)
    setShowJumpToLatest(!atBottom && el.scrollHeight > el.clientHeight + 50)
  }, [])

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el || !autoScroll) return
    const id = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
    return () => cancelAnimationFrame(id)
  }, [
    planSteps,
    tools.length,
    subagents.length,
    changes.length,
    terminals.length,
    progress.overview.content,
    autoScroll,
  ])

  const jumpToLatest = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    setAutoScroll(true)
  }, [])

  // 切换 tab 回调
  const onTabChange = React.useCallback(
    (tab: TimelineTabName) => () => setActiveTab(tab),
    [setActiveTab],
  )

  // v15: 滚动到首个失败项(subagent/tool/terminal)
  const scrollToFirstFailure = React.useCallback(() => {
    const failedSubagent = paneRef.current?.querySelector(
      '[data-testid^="subagent-item-"][data-status="failed"], [data-testid^="subagent-item-"][data-status="dead"]',
    )
    const failedTool = paneRef.current?.querySelector('[data-status="error"]')
    const first = failedSubagent ?? failedTool
    if (first instanceof HTMLElement) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // 视觉提示:短暂高亮 600ms
      first.classList.add('animate-flash-highlight')
      window.setTimeout(() => first.classList.remove('animate-flash-highlight'), 700)
    }
  }, [])

  // BatchHeader 折叠切换回调
  const onBatchCollapsedChange = React.useCallback((next: boolean) => setBatchCollapsed(next), [])

  // v17 终极根治:Pane 100% 由 CSS 锚定到 ai-side-panel-container 右上角。
  // - Pane 通过 React Portal 挂载到 paneAnchor 元素内部(ai-side-panel-container div)。
  // - 该容器自身 position: fixed,作为 Pane 的 containing block,Pane 用 absolute + top:8 + right:8。
  // - AI 面板 resize / open / close / window resize,Pane 自动跟随(浏览器原生排版,0 JS)。
  // - paneAnchor 还没拿到(AI 面板未挂载)= 不渲染 Pane,避免 v15 时代"浮到 document.body"bug。
  // - v15 的 500ms 轮询 + JS 坐标计算全部删除,根除"位置漂移"反复出现的根源。
  const positionStyle: React.CSSProperties = {
    position: 'absolute',
    top: 8,
    right: 8,
  }

  if (!open || !mounted) return null

  // v17 终极根治:Pane 锚点不存在(AI 面板关闭 / 未挂载)= 不渲染 Pane。
  // 旧 v15 行为是 fallback 到 {right: 16, top: 16} 浮在视口右上角 — 这是 v15 bug,
  // Pane 物理上脱离了 AI 面板,看起来"乱跑"。v17 直接 null,等下次 AI 面板打开再渲染。
  if (!paneAnchor) return null

  // Phase 23(2026-07-29):最小化模式 — 渲染摘要条替代完整面板
  // v17:摘要条和完整 Pane 用同一 positionStyle + 同一 Portal 锚点,位置天然一致
  if (isMinimized) {
    return createPortal(
      <div
        className="absolute z-popover"
        style={positionStyle}
        data-testid="pane-minimized-container"
      >
        <MinimizedSummaryBar
          progress={progressPct}
          toolCallCount={tools.length}
          subagentCount={subagents.length}
          onExpand={() => setIsMinimized(false)}
        />
      </div>,
      paneAnchor,
    )
  }

  // v17 终极根治:Pane 通过 Portal 挂到 ai-side-panel-container 内部,
  // CSS position: absolute + top: 8 + right: 8,JS 0 坐标计算。
  return createPortal(
    <div
      ref={paneRef}
      className={cn(
        'absolute z-popover',
        'flex w-[280px] max-h-[60vh] flex-col',
        'overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md',
      )}
      style={positionStyle}
      role="complementary"
      aria-label={t('ariaLabel')}
      data-testid="agent-progress-pane"
    >
      {/* Header:状态点 + 标题 + 进度环 + ResourceBudget + tab 切换 + 工具按钮 */}
      {/* v17:删除 onMouseDown / onKeyDown / cursor-grab / cursor-grabbing —
        Pane 100% CSS 锚定,不再可拖拽。 */}
      <div
        className={cn(
          'flex h-8 shrink-0 select-none items-center gap-1 border-b border-border px-2',
        )}
        data-testid="pane-header"
      >
        <ConnectionStatusDot
          state={connectionState}
          className={cn(
            'transition-all duration-300',
            connectionState === 'connected' && 'shadow-[0_0_0_1px_rgb(16_185_129/0.3)]',
            connectionState === 'reconnecting' && 'shadow-[0_0_0_1px_rgb(245_158_11/0.3)]',
            connectionState === 'disconnected' && 'shadow-[0_0_0_1px_rgb(239_68_68/0.3)]',
          )}
        />
        <ListTodo className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        {planSteps.length > 0 && (
          <div>
            <ProgressRing
              value={progressPct}
              state={ringState}
              centerMode="percent"
              size={16}
              strokeWidth={2}
              aria-label={t('progressLabel', { pct: Math.round(progressPct) })}
            />
          </div>
        )}
        {connectionState !== 'connected' && connectionState !== 'connecting' && (
          <div>
            <ConnectionStatus
              state={connectionState}
              reconnectAttempt={progress.overview.reconnectAttempt}
              totalAttempts={5}
              error={progress.overview.error}
              className="ml-0.5"
            />
          </div>
        )}
        {/* Phase 19: 步骤预算指示器(内联模式,显示在 header) */}
        {planSteps.length > 0 && (
          <div>
            <ResourceBudget
              used={planSteps.length}
              total={STEP_BUDGET_TOTAL}
              label={t('stepBudgetLabel')}
              variant="inline"
              active={isStreaming}
              className="ml-0.5 hidden sm:inline-flex"
              data-testid="pane-step-budget"
            />
          </div>
        )}
        {elapsedLabel && (
          <span
            className="ml-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-sm bg-muted/50 px-1 text-[10px] tabular-nums text-muted-foreground/70"
            data-testid="pane-elapsed"
            title={t('elapsedTitle', { time: elapsedLabel })}
            aria-label={t('elapsedTitle', { time: elapsedLabel })}
          >
            <Timer
              className={cn(
                'h-2.5 w-2.5',
                isStreaming ? 'animate-pulse text-primary' : 'text-muted-foreground/60',
              )}
              aria-hidden
            />
            {elapsedLabel}
          </span>
        )}
        <div className="flex-1" />
        {/* Phase 19: tab 切换(对话流/时间线) */}
        {TAB_BUTTONS.map((tab) => {
          const TabIcon = tab.Icon
          const active = activeTab === tab.id
          const label = t(tab.i18nKey)
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={onTabChange(tab.id)}
              className={cn(
                'inline-flex h-5 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-sm px-1 text-[10px] font-medium transition-colors',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground/70 hover:bg-accent/40 hover:text-foreground',
              )}
              data-testid={`pane-tab-${tab.id}`}
              title={label}
            >
              <TabIcon className="h-2.5 w-2.5" aria-hidden />
              <span>{label}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setExpandAll(expandAll === true ? false : true)}
          aria-label={expandAll === true ? t('collapseAll') : t('expandAll')}
          title={expandAll === true ? t('collapseAll') : t('expandAll')}
          className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          data-testid="pane-expand-all"
        >
          {expandAll === true ? (
            <ChevronsDownUp className="h-3 w-3" />
          ) : (
            <ChevronsUpDown className="h-3 w-3" />
          )}
        </button>
        {/* v13: 帮助按钮(打开/关闭快捷键面板) */}
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          aria-label={t('helpToggle')}
          aria-expanded={showHelp}
          aria-controls="pane-help-panel"
          title={t('helpToggle')}
          className={cn(
            'inline-flex h-5 w-5 items-center justify-center rounded-sm transition-colors',
            showHelp
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
          data-testid="pane-help-toggle"
        >
          <HelpCircle className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={togglePin}
          aria-label={pinned ? t('unpin') : t('pin')}
          className={cn(
            'inline-flex h-5 w-5 items-center justify-center rounded-sm transition-colors',
            pinned
              ? 'bg-primary/10 text-primary hover:bg-primary/20'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
          title={
            pinned ? `${t('unpin')}(${t('pinHintUnpinned')})` : `${t('pin')}(${t('pinHintPinned')})`
          }
          data-testid="pane-pin"
        >
          {pinned ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
        </button>
        <button
          type="button"
          onClick={() => setIsMinimized(true)}
          aria-label={t('minimize')}
          className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          title={`${t('minimize')}(${t('minimizeHint')})`}
          data-testid="pane-minimize"
        >
          <Minimize2 className="h-3 w-3" />
        </button>
      </div>

      {/* v13: 完成态庆祝横幅(全部 plan steps completed 时显示 3s) */}
      {showCelebration && (
        <div
          className="flex shrink-0 items-center gap-1.5 border-b border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-300"
          role="status"
          aria-live="polite"
          data-testid="pane-celebration-banner"
        >
          <Sparkles className="h-3 w-3 shrink-0 animate-pulse" aria-hidden />
          <span className="flex-1 truncate">{t('celebrate')}</span>
        </div>
      )}

      {/* v15: 失败状态条 — 当有 failed subagent/tool/terminal 时显示,点击滚动到首个失败项 */}
      {failureCount > 0 && (
        <button
          type="button"
          onClick={scrollToFirstFailure}
          className="flex shrink-0 w-full items-center gap-1.5 border-b border-destructive/30 bg-destructive/10 px-2 py-1 text-left text-[11px] text-destructive transition-colors hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive/60"
          aria-live="polite"
          data-testid="pane-failure-banner"
        >
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
          <span className="flex-1 truncate">{t('failureBanner', { n: failureCount })}</span>
          <span className="shrink-0 text-[10px] text-destructive/80">›</span>
        </button>
      )}

      {/* v13: 键盘快捷键帮助面板(VSCode 风格,按 ? 弹出,Esc 关闭) */}
      {showHelp && (
        <div
          id="pane-help-panel"
          role="dialog"
          aria-label={t('helpPanelTitle')}
          className="shrink-0 border-b border-border bg-muted/40 px-3 py-2"
          data-testid="pane-help-panel"
        >
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
              <Keyboard className="h-3 w-3 text-muted-foreground" aria-hidden />
              {t('helpPanelTitle')}
            </div>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              aria-label={t('helpClose')}
              className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              data-testid="pane-help-close"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
          <div
            className="space-y-2"
            role="list"
            aria-label={t('helpPanelTitle')}
            data-testid="pane-help-groups"
          >
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.i18nKey} role="listitem" className="space-y-0.5">
                <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
                  {t(group.i18nKey)}
                </div>
                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <li
                      key={item.i18nKey}
                      className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground/80"
                    >
                      <span>{t(item.i18nKey)}</span>
                      <kbd className="inline-flex h-4 shrink-0 items-center rounded-sm border border-border/60 bg-background px-1 font-mono text-[9px] font-medium text-foreground/80 shadow-sm">
                        {item.keys}
                      </kbd>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase 19: 移动端 ResourceBudget 块模式(无法在 header 内联时降级到内容顶部) */}
      {planSteps.length > 0 && (
        <div
          className="border-b border-border/40 px-2 py-1 sm:hidden"
          data-testid="pane-step-budget-block-wrapper"
        >
          <ResourceBudget
            used={planSteps.length}
            total={STEP_BUDGET_TOTAL}
            label={t('stepBudgetLabel')}
            variant="block"
            active={isStreaming}
            data-testid="pane-step-budget-block"
          />
        </div>
      )}

      {/* 内容区:根据 activeTab 切换 内联详情 vs 时间线视图 */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-1"
        data-testid="plan-list"
      >
        {/* Phase 19: 时间线视图(tab='timeline' 时) */}
        {activeTab === 'timeline' && (
          <TimelineTab showTabs={false} className="min-h-0" data-testid="pane-timeline-view" />
        )}

        {/* Phase 19: 对话流视图(tab='inline' 时,显示原有内容) */}
        {activeTab === 'inline' && (
          <>
            {!threadId && (
              <div
                className="flex flex-col items-center gap-1.5 px-3 py-5 text-center"
                data-testid="pane-empty-state"
              >
                <ListTodo
                  className="h-6 w-6 text-muted-foreground/30"
                  aria-hidden
                  data-testid="pane-empty-icon"
                />
                <div className="space-y-0.5">
                  <div
                    className="text-[12px] font-medium text-foreground/80"
                    data-testid="pane-empty-title"
                  >
                    {t('emptyTitle')}
                  </div>
                  <div className="text-[10px] leading-relaxed text-muted-foreground/60">
                    {t('emptySubtitle')}
                  </div>
                </div>
                {/* v13: 3 个快速开始提示,引导用户理解 pane 用途 */}
                <ul
                  className="mt-1 w-full space-y-0.5 text-left text-[10px] text-muted-foreground/60"
                  data-testid="pane-empty-hints"
                  aria-label={t('emptyHintsLabel')}
                >
                  <li className="flex items-start gap-1.5 rounded-sm px-1.5 py-0.5 transition-colors hover:bg-accent/30">
                    <span className="shrink-0 text-primary/80">1.</span>
                    <span>{t('emptyHint1')}</span>
                  </li>
                  <li className="flex items-start gap-1.5 rounded-sm px-1.5 py-0.5 transition-colors hover:bg-accent/30">
                    <span className="shrink-0 text-primary/80">2.</span>
                    <span>{t('emptyHint2')}</span>
                  </li>
                  <li className="flex items-start gap-1.5 rounded-sm px-1.5 py-0.5 transition-colors hover:bg-accent/30">
                    <span className="shrink-0 text-primary/80">3.</span>
                    <span>{t('emptyHint3')}</span>
                  </li>
                </ul>
              </div>
            )}

            {threadId && planSteps.length === 0 && (
              // v13: skeleton 行数 3 → 4,加 `animate-skeleton` shimmer 渐变动画
              <div className="space-y-1 px-2 py-2" data-testid="plan-skeleton">
                {Array.from({ length: PLAN_SKELETON_ROWS }, (_, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="h-3 w-3 shrink-0 animate-skeleton rounded-sm bg-gradient-to-r from-muted/40 via-muted/70 to-muted/40 bg-[length:200%_100%]" />
                    <div
                      className="h-2.5 animate-skeleton rounded-sm bg-gradient-to-r from-muted/40 via-muted/70 to-muted/40 bg-[length:200%_100%]"
                      style={{ width: `${50 + i * 12}%` }}
                    />
                  </div>
                ))}
              </div>
            )}

            {planSteps.length > 0 && (
              <>
                <div role="list" aria-label={t('planListLabel')}>
                  {planSteps.map((step, idx) => {
                    const link = planStepLinkMap.get(step.id) ?? null
                    return (
                      <PlanStepItem
                        key={step.id}
                        step={step}
                        index={idx}
                        linkedMessageId={link?.messageId ?? null}
                        linkedMessagePreview={link?.preview ?? null}
                        relatedTools={toolsByStep.get(step.id) ?? EMPTY_TOOLS}
                        isHighlighted={isStepHighlighted(step.id, link?.messageId ?? null)}
                      />
                    )
                  })}
                </div>
                <div
                  className="mx-2 mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground/60"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <span className="flex items-center gap-1">
                    <span>
                      {t('completedCount', { done: completedCount, total: planSteps.length })}
                    </span>
                    <CopyButton
                      text={planSteps.map((s, i) => `${i + 1}. [${s.status}] ${s.step}`).join('\n')}
                      aria-label={t('copyPlan')}
                      data-testid="copy-plan-btn"
                    />
                  </span>
                  {isStreaming && (
                    <span className="flex items-center gap-0.5 text-primary" role="status">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      {t('executing')}
                    </span>
                  )}
                </div>
              </>
            )}

            {threadId && (
              <FoldableSectionProvider value={{ expandAll, setExpandAll }}>
                <div
                  onKeyDown={onSectionsKeyDown}
                  role="toolbar"
                  aria-label={t('sectionsToolbarLabel')}
                  data-testid="sections-container"
                  className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
                >
                  <ThinkingSection
                    content={overview.content}
                    currentNode={overview.currentNode}
                    isStreaming={isStreaming}
                  />
                  <ToolCallsSection tools={tools} />
                  {/* Phase 19: BatchHeader 包装 subagents(默认折叠,展开后展示 SubAgentTaskTree) */}
                  {subagents.length > 0 && (
                    <>
                      <BatchHeader
                        batchIndex={1}
                        title={t('subagentBatch')}
                        agentCount={subagentBatchStats.agentCount}
                        completedCount={subagentBatchStats.completedCount}
                        failedCount={subagentBatchStats.failedCount}
                        status={subagentBatchStats.status}
                        collapsed={batchCollapsed}
                        onCollapsedChange={onBatchCollapsedChange}
                        defaultCollapsed={true}
                        className="mx-1.5 mt-1.5"
                        data-testid="subagent-batch-header"
                      />
                      {!batchCollapsed && (
                        <div className="mx-1.5 mt-1 space-y-1" data-testid="subagent-batch-body">
                          {subagents.map((sa: Subagent) => (
                            <SubAgentTaskTree
                              key={sa.id}
                              subagent={sa}
                              data-testid={`subagent-task-tree-${sa.id}`}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <ChangesSection changes={changes} />
                  <TerminalSection terminals={terminals} />
                  <OverviewSection
                    overview={overview}
                    isStreaming={isStreaming}
                    totalTokens={totalTokens}
                    tokenRate={tokenRate}
                    etaMs={etaMs}
                    contextUsage={contextUsage}
                  />
                </div>
              </FoldableSectionProvider>
            )}
          </>
        )}

        {/* Phase 17: 跳到最新按钮 */}
        {showJumpToLatest && (
          <button
            type="button"
            onClick={jumpToLatest}
            aria-label={t('jumpToLatest')}
            title={t('jumpToLatest')}
            className="absolute bottom-2 left-1/2 inline-flex h-6 -translate-x-1/2 items-center gap-0.5 rounded-md border border-border bg-popover px-2 text-[10px] text-muted-foreground shadow-sm transition-all hover:bg-accent hover:text-accent-foreground"
            data-testid="pane-jump-latest"
          >
            <ArrowDown className="h-2.5 w-2.5" />
            <span>{t('latest')}</span>
          </button>
        )}
      </div>
    </div>,
    paneAnchor,
  )
}

export default AgentTaskProgressPane
