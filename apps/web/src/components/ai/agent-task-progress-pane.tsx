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
 * AgentTaskProgressPane — 消息区右上角的小 popover(2026-07-29 v16 根治方案)
 *
 * v16 改动(用户规则:问题反复出现,彻底根治解决好杜绝):
 * - 砍掉所有 JS 坐标计算 + getBoundingClientRect + setInterval 轮询:
 *   历史方案 v13/v14/v15 都因 React 重渲染时序与 JS 状态不同步导致 Pane 漂移
 *   (用户反馈"反复出现,彻底根治")
 * - 改用 CSS 原生绝对定位:Pane 通过 React Portal 挂到 AI 面板容器
 *   [data-testid="ai-side-panel-container"] 内部,该 div 自身 position:fixed,
 *   作为 Pane 的 containing block;Pane 用 `position: absolute; top: 8px; right: 8px`
 *   永远锚在 AI 面板右上角,零 JS 依赖,零漂移。
 * - 同步取消 Pane 拖拽功能(键盘 + 鼠标),用户不再需要手动调整位置
 *   (CSS 锚定方案下,位置永远不会错位,拖拽失去意义)
 * - 同步清理:PanePosition 接口 / loadPanePosition / savePanePosition / clampPanePosition
 *   / POSITION_STORAGE_KEY / KEYBOARD_STEP_PX / KEYBOARD_SHIFT_MULTIPLIER / DRAG_EDGE_MARGIN
 *   / PANE_ESTIMATED_WIDTH / PANE_ESTIMATED_HEIGHT / GripVertical icon 全部删除
 *
 * v15 改动(已被 v16 替代,保留历史):
 * - 根容器改用 React Portal 渲染到 document.body + `position: fixed`,
 *   完全脱离 aside(`overflow-hidden rounded-xl`)的 overflow 限制,
 *   Pane 可以悬浮在 AI 对话框外(超出 aside 边界显示),不再被边框裁切。
 * - 拖拽 clamp 改回 viewport 坐标系(不再基于 offsetParent 父容器),
 *   Pane 可在视口范围内自由拖动,不受 aside 边界约束。
 * - POSITION_STORAGE_KEY 升 v3,作废旧 v2 absolute 时代的父容器坐标
 *   (absolute 坐标基于父容器,fixed 坐标基于视口,二者不能互换)。
 * - 默认位置:相对视口右上角 `right: 16, top: 16`(留 16px 边距,避免贴边)。
 *
 * v14 改动(已被 v15 替代,保留历史):
 * - 根容器 `fixed` → `absolute`:父容器已是 `<div className="relative min-h-0 flex-1">`,
 *   用 absolute 后 popover 锚定到消息区右上角,而不是浏览器视口右上角
 * - 拖拽 bounds 从 viewport 改为父容器(offsetParent),拖不出消息区
 * - 拖拽位置 storage key 升 v2(`agent-progress-pane-position-v2`),作废旧 fixed 时代
 *   的视口坐标(否则 absolute 下会落到父容器外的位置)
 *
 * v13 改动(深度优化,沿用):
 * - 拖拽支持:header 可拖动,位置持久化到 localStorage,父容器边界 clamp
 * - 完成态庆祝:全部 plan steps completed 时显示 3s 横幅(Sparkles + emerald 渐变)
 * - plan skeleton 优化:4 items + `animate-skeleton` shimmer 渐变动画
 * - 空状态改进:无 threadId 时显示 3 个快速开始提示
 * - i18n 化所有硬编码中文(用 `ai.pane` 命名空间,新 key 不修改 JSON 文件,英文 fallback + next-intl dev warn)
 * - 步骤进度视觉强化:PlanStepItem status icon transition + scale 切换动画
 * - 键盘快捷键面板:按 ? 弹出 VSCode 风格帮助,Esc 关闭
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

/** Pane 默认锚点容器选择器(v16 根治方案,2026-07-29 立) */
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

// ─── Pane 挂载点解析(v16 根治方案) ────────────────────────────────
// v16(2026-07-29 立):Pane 不再用 JS 坐标计算 + getBoundingClientRect + setInterval 轮询
// (历史方案 v13/v14/v15 都因 JS 状态与 React 重渲染时序错位导致 Pane 漂移),
// 改用 CSS 原生绝对定位:Pane 通过 React Portal 挂到 AI 面板容器 [data-testid="ai-side-panel-container"]
// 内部,该 div 自身 position:fixed,作为 Pane 的 containing block;
// Pane 用 position:absolute + top:8px + right:8px 永远锚在 AI 面板右上角,零 JS 依赖。
// resolvePaneAnchor 一次性解析挂载点,SSR 期间返回 null 由调用方 fallback(不渲染)。
let _cachedAnchor: HTMLElement | null = null
function resolvePaneAnchor(): HTMLElement | null {
  if (_cachedAnchor && document.body.contains(_cachedAnchor)) return _cachedAnchor
  const el = document.querySelector(PANE_ANCHOR_SELECTOR) as HTMLElement | null
  if (el) _cachedAnchor = el
  return el
}

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

  // v16(2026-07-29):mounted 标志 + Pane 锚点解析
  // - mounted:SSR 安全(createPortal 需要 document,SSR 时不存在)
  const [paneAnchor, setPaneAnchor] = React.useState<HTMLElement | null>(null)
  // - paneAnchor:AI 面板容器 div(作为 Pane Portal 挂载点),useState 触发一次解析,
  //   解析失败时返回 null(AI 面板还没挂载,本轮不渲染 Pane,等下次)
    setPaneAnchor(resolvePaneAnchor())
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

  // v16 根治:不再需要 paneAnchorRect / loadPanePosition / clampPanePosition
  // Pane 位置由 CSS `position: absolute; top: 8px; right: 8px` 完全控制,
  // 锚到 paneAnchor(AI 面板容器)内部,JS 零坐标计算,零漂移。

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
  const paneRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open || pinned) return
    const onClick = (e: MouseEvent) => {
      // v16 根治:不再有拖拽态,直接判断 click-outside
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

  if (!open || !mounted || !paneAnchor) return null

  // v16(2026-07-29)根治方案:Pane 位置 100% 由 CSS 控制,零 JS 坐标计算
  // - Pane 用 position:absolute(top:8px, right:8px)锚到 paneAnchor(AI 面板容器 div)内部
  // - paneAnchor 自身 position:fixed,是 Pane 的 containing block
  // - 零 JS 漂移,不会因 React 重渲染时序错位
  // - AI 面板开关:Pane 跟着 paneAnchor 出现/消失(因为是它的子元素)
  // - Sidebar 折叠/AI 面板宽度变化:Pane 自动跟随(paneAnchor 位置由 CSS 决定)
  // 历史方案(v13-v15)都用 JS 算坐标 → 反复出现漂移问题,本次彻底砍掉
  const positionStyle: React.CSSProperties = {
    position: 'absolute',
    top: 8,
    right: 8,
  }

  // Phase 23(2026-07-29):最小化模式 — 渲染摘要条替代完整面板
  // 摘要条用同一 positionStyle + Portal 保持位置一致性,用户可点击展开按钮恢复
  // v16(2026-07-29):Portal 挂到 paneAnchor(AI 面板容器)内部,零 JS 坐标计算
  if (isMinimized) {
    return createPortal(
      <div className="z-popover" style={positionStyle} data-testid="pane-minimized-container">
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

  // v16(2026-07-29 根治方案):用 React Portal 渲染到 paneAnchor(AI 面板容器 div)内部
  // 优势:
  // 1. position:absolute + top:8 + right:8 → Pane 永远在 AI 面板右上角(由 CSS 保证,无 JS 计算)
  // 2. Pane 是 paneAnchor 子元素 → AI 面板开关时 Pane 跟着出现/消失
  // 3. 不受 aside overflow-hidden 限制(因为 Pane 在 aside 父元素,不在 aside 内)
  // 4. z-popover 保留:z-index 在 paneAnchor 子层内有效,确保 Pane 在 paneAnchor 内其他内容之上
  return createPortal(
    <div
      ref={paneRef}
      className={cn(
        // v16 根治:absolute(相对于 paneAnchor fixed 父元素),不再 fixed
        'absolute z-popover',
        'flex w-[280px] max-h-[60vh] flex-col',
        'overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md',
      )}
      style={positionStyle}
      role="complementary"
      aria-label={t('ariaLabel')}
      data-testid="agent-progress-pane"
    >
      {/* Header:状态点 + 标题 + 进度环 + ResourceBudget + tab 切换 + 工具按钮(v16:不再可拖拽,Pane 由 CSS 锚定) */}
      <div
        className={cn(
          'flex h-8 shrink-0 select-none items-center gap-1 border-b border-border px-2 outline-none',
          'focus-visible:ring-1 focus-visible:ring-ring/60 focus-visible:ring-offset-0',
        )}
        data-testid="pane-header"
        aria-label={t('dragHandle')}
        role="toolbar"
        tabIndex={0}
      >
        <ConnectionStatusDot
          state={connectionState}
          className={cn(
            'transition-all duration-300',
            connectionState === 'connected' && 'shadow-[0_0_0_1px_rgb(16_185_129/0.3)]',
            connectionState === 'reconnecting' && 'shadow-[0_0_0_1px_rgb(245_158_11/0.3)]',
            connectionState === 'disconnected' && 'shadow-[0_0_0_1px_rgb(239_68_68/0.3)]',
          )}
          data-no-drag="true"
        />
        <ListTodo className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" data-no-drag="true" />
        {planSteps.length > 0 && (
          <div data-no-drag="true">
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
          <div data-no-drag="true">
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
          <div data-no-drag="true">
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
        {/* v15: 实时计时器 — 仅在 sessionStart 存在时显示,每 1s 更新 */}
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
          data-no-drag="true"
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

// ─── v16(2026-07-29 立)根治方案后,以下导出已删除(JS 坐标计算全部砍掉):
// - clampPanePosition / loadPanePosition / savePanePosition(被 CSS absolute 替代)
// - KEYBOARD_STEP_PX / KEYBOARD_SHIFT_MULTIPLIER / POSITION_STORAGE_KEY(拖拽功能已删除)
// Pane 位置 100% 由 CSS `position: absolute; top: 8; right: 8` 控制,锚到 ai-side-panel-container 内
