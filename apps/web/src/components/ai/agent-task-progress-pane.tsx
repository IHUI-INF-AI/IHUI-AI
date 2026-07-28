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
  ListTree,
  ChevronsUpDown,
  ChevronsDownUp,
  ArrowDown,
  Sparkles,
  GripVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { useAgentProgressPaneStore } from '@/stores/agent-progress-pane'
import { useChatStore } from '@/stores/chat'
import { useProgressJumpStore } from '@/stores/progress-jump-store'
import { useTimelineStore, type TimelineTabName } from '@/stores/timeline-store'
import { useAgentProgress } from '@/hooks/use-agent-progress'
import { useHoverPreview } from '@/hooks/use-hover-preview'
import type { PlanStep, PlanStepStatus, AgentToolCall, Subagent } from '@/hooks/use-agent-progress'
import { formatDuration, FoldableSectionProvider } from './progress-sections/foldable-section'
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
 * AgentTaskProgressPane — 输入容器右上角的小 popover(2026-07-28 v13)
 *
 * v13 改动(深度优化):
 * - 拖拽支持:header 可拖动,位置持久化到 localStorage(`agent-progress-pane-position`),viewport 边界 clamp
 * - 完成态庆祝:全部 plan steps completed 时显示 3s 横幅(Sparkles + emerald 渐变)
 * - plan skeleton 优化:4 items + `animate-skeleton` shimmer 渐变动画
 * - 空状态改进:无 threadId 时显示 3 个快速开始提示
 * - i18n 化所有硬编码中文(用 `ai.pane` 命名空间,新 key 不修改 JSON 文件,英文 fallback + next-intl dev warn)
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

/** Pane 拖拽位置 localStorage key(2026-07-28 v13 立,避免与 store 持久化冲突) */
const POSITION_STORAGE_KEY = 'agent-progress-pane-position'

/** Pane 拖拽边界留白(viewport 边缘) */
const DRAG_EDGE_MARGIN = 8

/** Pane 默认尺寸估算(用于 viewport clamp;实际宽高由 CSS w-[280px] max-h-[60vh] 决定) */
const PANE_ESTIMATED_WIDTH = 280
const PANE_ESTIMATED_HEIGHT = 400

/** Skeleton 行数(v13:3 → 4,更符合常见 plan 步骤规模) */
const PLAN_SKELETON_ROWS = 4

/** 完成态庆祝横幅显示时长 */
const CELEBRATION_DURATION_MS = 3000

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

// ─── 拖拽位置工具(localStorage 持久化 + viewport clamp) ─────────────
interface PanePosition {
  x: number
  y: number
}

function loadPanePosition(): PanePosition | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(POSITION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown }
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null
    if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null
    return { x: parsed.x, y: parsed.y }
  } catch {
    return null
  }
}

function savePanePosition(pos: PanePosition): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(pos))
  } catch {
    // 忽略 quota / private mode 错误
  }
}

function clampPanePosition(x: number, y: number): PanePosition {
  if (typeof window === 'undefined') return { x, y }
  const maxX = Math.max(DRAG_EDGE_MARGIN, window.innerWidth - PANE_ESTIMATED_WIDTH - DRAG_EDGE_MARGIN)
  const maxY = Math.max(DRAG_EDGE_MARGIN, window.innerHeight - PANE_ESTIMATED_HEIGHT - DRAG_EDGE_MARGIN)
  return {
    x: Math.min(Math.max(DRAG_EDGE_MARGIN, x), maxX),
    y: Math.min(Math.max(DRAG_EDGE_MARGIN, y), maxY),
  }
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
            <span>
              {t('previewTokenK', { k: Math.round(data.step.tokenUsage / 1000) })}
            </span>
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
          className={cn(
            'mt-0.5 h-3 w-3 shrink-0 transition-colors duration-300',
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

// ─── 主组件(v13:Phase 20 全量集成) ─────────────────────────────────
export function AgentTaskProgressPane() {
  const t = useTranslations('ai.pane')
  const open = useAgentProgressPaneStore((s) => s.open)
  const threadId = useAgentProgressPaneStore((s) => s.threadId)
  const setThreadId = useAgentProgressPaneStore((s) => s.setThreadId)
  const pinned = useAgentProgressPaneStore((s) => s.pinned)
  const togglePin = useAgentProgressPaneStore((s) => s.togglePin)
  const toggle = useAgentProgressPaneStore((s) => s.toggle)
  const closePane = useAgentProgressPaneStore((s) => s.closePane)
  const setProgress = useAgentProgressPaneStore((s) => s.setProgress)

  // v9: 展开全部/折叠全部控制
  const [expandAll, setExpandAll] = React.useState<boolean | null>(null)

  // Phase 19: BatchHeader 折叠状态(默认折叠,避免初次打开时 pane 太长)
  const [batchCollapsed, setBatchCollapsed] = React.useState<boolean>(true)

  // v13: 拖拽位置状态(null = 首次打开,使用默认 right-2 top-2 定位)
  const [panePosition, setPanePosition] = React.useState<PanePosition | null>(null)
  // v13: 拖拽中状态(用于切换 cursor / 提升 z-index)
  const [isDragging, setIsDragging] = React.useState<boolean>(false)

  // 从 useChatStore 同步 conversationId + 读取 messages(用于 planStep↔message 关联)
  const conversationId = useChatStore((s) => s.conversationId)
  const chatMessages = useChatStore((s) => s.messages)
  React.useEffect(() => {
    if (conversationId !== threadId) {
      setThreadId(conversationId)
    }
  }, [conversationId, threadId, setThreadId])

  // v13: 客户端 mount 后加载保存的位置(SSR 时 window 不存在,延后到 effect)
  React.useEffect(() => {
    const saved = loadPanePosition()
    if (saved) setPanePosition(clampPanePosition(saved.x, saved.y))
  }, [])

  const progress = useAgentProgress(open ? threadId : null)
  const { planSteps, isStreaming, subagents, tools, changes, terminals, overview } = progress

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

  // Esc 关闭(unpin 状态下生效)
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
      // 拖拽中不触发 click-outside(避免 mouseup 误关闭)
      if (isDragging) return
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
  }, [open, pinned, closePane, isDragging])

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

  // BatchHeader 折叠切换回调
  const onBatchCollapsedChange = React.useCallback((next: boolean) => setBatchCollapsed(next), [])

  // v13: 拖拽处理器 — 鼠标按下时记录起点,移动时实时更新位置,抬起时持久化
  // 用 ref 记录最新位置,避免闭包陷阱(stale state)
  const positionRef = React.useRef<PanePosition | null>(null)
  const dragStateRef = React.useRef<{
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  // 同步 position state → ref(确保 onMouseUp 拿到最新值)
  positionRef.current = panePosition

  const onHeaderMouseDown = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // 只响应鼠标左键
      if (e.button !== 0) return
      // 排除点击按钮 / tab / 可交互子元素的情况(避免误触发拖拽)
      const target = e.target as HTMLElement
      if (target.closest('button, [role="tab"], input, [data-no-drag]')) return

      e.preventDefault()
      // 起始位置:无保存位置时,使用默认 right-2 top-2(viewport 坐标估算)
      const fallback =
        typeof window !== 'undefined'
          ? { x: window.innerWidth - PANE_ESTIMATED_WIDTH - DRAG_EDGE_MARGIN, y: DRAG_EDGE_MARGIN }
          : { x: 0, y: 0 }
      const current = positionRef.current ?? fallback
      dragStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: current.x,
        originY: current.y,
      }
      setIsDragging(true)

      const onMove = (ev: MouseEvent) => {
        const state = dragStateRef.current
        if (!state) return
        const dx = ev.clientX - state.startX
        const dy = ev.clientY - state.startY
        const next = clampPanePosition(state.originX + dx, state.originY + dy)
        setPanePosition(next)
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
        setIsDragging(false)
        // 持久化最新位置(用 ref 拿最新值,避免 stale closure)
        const final = positionRef.current
        if (final) savePanePosition(final)
        dragStateRef.current = null
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'grabbing'
    },
    [],
  )

  if (!open) return null

  // v13: 计算 pane 根容器的位置样式(有 position → fixed + left/top;无 position → 默认 right-2 top-2)
  const positionStyle: React.CSSProperties = panePosition
    ? { left: panePosition.x, top: panePosition.y, right: 'auto' }
    : { right: 8, top: 8 }

  return (
    <div
      ref={paneRef}
      className={cn(
        'fixed z-50',
        'flex w-[280px] max-h-[60vh] flex-col',
        'overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md',
        isDragging && 'shadow-lg',
      )}
      style={positionStyle}
      role="complementary"
      aria-label={t('ariaLabel')}
      data-testid="agent-progress-pane"
      data-dragging={isDragging ? 'true' : undefined}
    >
      {/* Header:状态点 + 标题 + 进度环 + ResourceBudget + tab 切换 + 工具按钮(v13:可拖拽) */}
      <div
        onMouseDown={onHeaderMouseDown}
        className={cn(
          'flex h-8 shrink-0 select-none items-center gap-1 border-b border-border px-2',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        data-testid="pane-header"
        aria-label={t('dragHandle')}
        role="toolbar"
      >
        <GripVertical
          className="h-3 w-3 shrink-0 text-muted-foreground/40"
          aria-hidden
          data-testid="pane-drag-grip"
        />
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
        <span className="shrink-0 text-xs font-medium" data-no-drag="true">
          {t('title')}
        </span>
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
        <button
          type="button"
          onClick={togglePin}
          aria-label={pinned ? t('unpin') : t('pin')}
          className={cn(
            'inline-flex h-5 w-5 items-center justify-center rounded-sm transition-colors',
            pinned
              ? 'text-primary hover:bg-accent'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
          title={pinned ? `${t('unpin')}(${t('pinHintUnpinned')})` : `${t('pin')}(${t('pinHintPinned')})`}
          data-testid="pane-pin"
        >
          {pinned ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
        </button>
        <button
          type="button"
          onClick={toggle}
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
                className="flex flex-col gap-2 px-3 py-4"
                data-testid="pane-empty-state"
              >
                <div className="flex flex-col items-center gap-1">
                  <MessageSquare className="h-4 w-4 text-muted-foreground/60" aria-hidden />
                  <span className="text-[11px] text-muted-foreground/60">
                    {t('emptyHint')}
                  </span>
                </div>
                {/* v13: 3 个快速开始提示,引导用户理解 pane 用途 */}
                <ul
                  className="space-y-0.5 text-[10px] text-muted-foreground/50"
                  data-testid="pane-empty-hints"
                  aria-label={t('emptyHintsLabel')}
                >
                  <li className="flex items-start gap-1.5">
                    <span className="shrink-0 text-primary/80">1.</span>
                    <span>{t('emptyHint1')}</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="shrink-0 text-primary/80">2.</span>
                    <span>{t('emptyHint2')}</span>
                  </li>
                  <li className="flex items-start gap-1.5">
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
    </div>
  )
}

export default AgentTaskProgressPane
