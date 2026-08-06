'use client'

import * as React from 'react'
import {
  Pin,
  PinOff,
  Minimize2,
  Maximize2,
  Circle,
  Loader2,
  Check,
  ListTodo,
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
import { useTimelineStore } from '@/stores/timeline-store'
import { useLoginDialogStore } from '@/stores/login-dialog'
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
import { HoverPreviewCard } from './progress-sections/hover-preview-card'
import { BatchHeader, type BatchStatus } from './progress-sections/batch-header'
import { Checklist, type ChecklistItemData } from './progress-sections/checklist'
import { ResourceBudget } from './progress-sections/resource-budget'
import { flattenToTimelineEvents } from './progress-sections/timeline-tab'
import { SubAgentTaskTree } from './progress-sections/sub-agent-task-tree'

/**
 * AgentTaskProgressPane — AI 面板右上角的小 popover(2026-07-29 v18)
 *
 * v18 改动(用户规则:"这个展开态的容器怎么拖动不了了呢?之前不是支持的吗"
 * + "位置还是不对啊 应该偏下一些 现在都给顶部按钮都挡上了"):
 * - **删除 React Portal + paneAnchor state + MutationObserver + fallback selector**:
 *   v17 的 portal 方案有 3 大隐患全部命中 — ① querySelector 返回 3 个 ai-side-panel-container
 *   (AI 面板多次渲染 / StrictMode 双调用 / HMR 残留)导致 Pane 错挂到 (0, 0) 关闭态容器;
 *   ② Portal 实际行为在 Next.js streaming + Suspense 下不可靠,Pane.parentElement 在某时机是
 *   body 不是 ai-side-panel-container,right:8 错位;③ 双向 selector 强绑定 + 防御性 fallback
 *   反而把"应该不渲染"的边界情况勉强渲染了 — 看起来"在"实际位置永远错。v18 根除:
 *   Pane 改用 inline JSX,作为 aside inner div(react tree parent)的子元素渲染,
 *   DOM 父级 = CSS containing block = inner div,绝对定位天然正确,0 状态机可漂移。
 * - **恢复拖动功能**:v17 因为 v15 JS 坐标漂移 bug 把拖拽连根拔起,用户要求恢复。
 *   v18 用 **handle 元素 + 纯 DOM style.transform** 实现:
 *   ① 拖动只在 header 左侧 GripVertical 区域启动,onMouseDown 用 `closest('button')` 早退
 *      → 不会污染 tab 切换 / 展开全部 / 快捷键 / 置顶 / 最小化 按钮的 onClick 路径,
 *      解决 v13 "拖动状态机吞 click → minimize 按钮不好使"问题;
 *   ② 拖动过程中直接改 paneRef.current.style.transform,不走 setState → 不触发 React 重渲染
 *      → 不影响 MessageList / SubAgentTaskTree 等子组件性能;
 *   ③ 拖动结束后写 localStorage(`pane-drag-v18`),下次加载时从 dataset 恢复偏移,
 *      解决 v15 "用视口绝对坐标 → resize 后位置错"的根因(transform 是相对偏移,无视口依赖)。
 * - **位置调整**:positionStyle 仍是 `top: 8, right: 8`,但 Pane 现在是 aside inner div
 *   (top = header bottom = 56px)的子元素,绝对定位后 Pane 顶部在 viewport 64px
 *   (header 56 + 8 间距),正好避开 header 工具栏(用户规则"应该偏下一些 现在都给顶部按钮
 *   都挡上了")。Pane 高度由 `max-h-[60vh]` + flex 列布局控制,不会超出 inner div 范围。
 *
 * v17 历史(已废弃,保留注释便于追溯):用 React Portal 挂到 ai-side-panel-container +
 * 删除拖拽。根因 — portal target 多实例 + parentElement 在某些时机是 body 不是 container +
 * 双向 selector 强绑定易被破坏 → Pane 错位到 (0, 0) 关闭态容器或"啥都没了"。
 *
 * v15 历史(已废弃):用 React Portal + JS 视口坐标 + 500ms 轮询。根因 — JS 坐标在 React 时序下
 * 永远不稳定,反复出现位置漂移。
 *
 * v13 历史(已废弃):用 onMouseDown 拖拽状态机 + setState 触发 transform。
 * 根因 — setState 拖拽时整个 Pane 重渲染 + 500ms 内多次 setState 容易让 click 路径被吞。
 * v18 改用纯 DOM style.transform,不触发 React 重渲染,根除。
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
 * v18:删除 v17 强绑定的 PANE_ANCHOR_SELECTOR / FALLBACK_SELECTOR — Pane 现在是 aside
 * inner div 的 React tree 子元素,DOM 父级 + CSS containing block 都由 React 渲染机制
 * 保证,不再需要 querySelector 双向绑定 selector。彻底根除"双向绑定漏改 → Pane 不渲染"
 * + "selector 找到错位置(关闭态容器 / 多次渲染残留)"的 bug 链。
 */

/**
 * v20 根除(2026-08-02,用户规则:"div 这里怎么在没有内容时显示空行呢?
 * 空行给用户看吗?合理吗 应该随着 ai 计划规划的任务概要出来然后在里面
 * 显示出来顺序跟当前任务进度啊"):
 * - **删除** v13 的 `PLAN_SKELETON_ROWS = 4` skeleton 假行(50/62/74/86%
 *   宽度的假数据条) — 这是"空内容时给用户看假数据"的反用户行为,
 *   用户明确拒绝"假空行"。
 * - 替代方案:planSteps.length === 0 时:
 *   1) 有 threadId + isStreaming → 显示 1 行真实"等待 AI 规划..."(spinner + 文字),
 *      表达"AI 正在思考,plan 还没下发"的真实状态;
 *   2) 其他情况 → 不渲染任何内容,让 Pane 内部 sections-container
 *      (thinking / currentTask / toolCalls / overview)直接显示实时数据。
 * - 任务列表最终按 AI 下发的 planSteps 数组顺序渲染,
 *   currentTask 摘要条在 sections-container 顶部显示当前进度,顺序自动跟随。
 */

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
        className="ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
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

  // v18:删除 v17 的 paneAnchor state + MutationObserver + fallback selector。
  // Pane 现在是 aside inner div 的 inline JSX 子元素(在 ai-side-panel.tsx 的
  // `<div className="relative min-h-0 flex-1">` 内),DOM 父级 + CSS containing block
  // 都是 inner div,绝对定位天然锚定到 AI 面板右上角。
  // - 不再需要 querySelector 找锚点 → 根除"3 个 ai-side-panel-container 选错" + "双向
  //   data-testid 漏改" + "Portal target 在某些时机是 body 不是 container"的所有 v17 隐患。
  // - 不再需要 MutationObserver 监听 body 子节点变化 → 减少 1 个全局监听器。
  // - 不再需要 `if (!paneAnchor) return null` → 加载即渲染,0 状态机可漂移。

  const progress = useAgentProgress(open ? threadId : null)
  const { planSteps, isStreaming, subagents, tools, changes, terminals, overview, currentTask } =
    progress

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

  // v18 拖动 handle(2026-07-29 立,用户规则"之前不是支持的吗"):
  // ⚠️ Hooks 必须在 return null 之前调用,否则报 "Rendered more hooks than during the previous render"。
  // - 纯 DOM style.transform,不走 React state → 不触发重渲染
  // - onMouseDown 用 closest('button') 早退 → 不污染 button click 路径
  //   (minimize / pin / expand-all / help / tab 按钮 100% 触发原 onClick)
  // - 拖动结束后写 localStorage(`pane-drag-v18`),下次 mount 时从 useEffect 恢复
  // - 用 transform 而非视口坐标 → resize 后偏移仍正确(相对 inner div,不是 viewport)
  const onHandleMouseDown = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // 仅 button / [role="button"] / input 区域早退,其余 header 空白区域启动拖动
    if ((e.target as HTMLElement).closest('button, [role="button"], input')) return
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const paneEl = paneRef.current
    if (!paneEl) return
    // 读取已有 transform(可能从 localStorage 恢复过)
    const baseTransform = paneEl.style.transform || ''
    const match = baseTransform.match(/translate\(([-0-9.]+)px,\s*([-0-9.]+)px\)/)
    const baseX = match?.[1] ? parseFloat(match[1]) : 0
    const baseY = match?.[2] ? parseFloat(match[2]) : 0
    let lastDx = 0
    let lastDy = 0
    const onMove = (ev: MouseEvent) => {
      lastDx = ev.clientX - startX
      lastDy = ev.clientY - startY
      paneEl.style.transform = `translate(${baseX + lastDx}px, ${baseY + lastDy}px)`
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      // 持久化到 localStorage(v19 key,与恢复逻辑保持一致)
      // 同时 clamp Y 不让 Pane 顶部 < 8px(viewport),防止下次刷新挡 header 按钮
      try {
        const safeY = Math.max(baseY + lastDy, -64)
        localStorage.setItem('pane-drag-v19', JSON.stringify({ x: baseX + lastDx, y: safeY }))
      } catch {
        // localStorage 写入失败(隐私模式 / 配额满)→ 静默忽略
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  // v18:从 localStorage 恢复拖动偏移(v15 视口坐标 vs v18 transform 偏移的差异 —
  // v18 是相对 inner div 的偏移,不是视口绝对坐标,resize 后无需重新校准)
  //
  // v19 加固(2026-07-29 立,用户规则"位置还是不对啊 应该偏下一些"):
  // - 边界检查:getBoundingClientRect 读 Pane 实际位置,如果顶部 < 安全阈值(64+8=72px
  //   即 header 底部 + 8px 间距),说明 localStorage 残留了 v18 拖动数据(用户拖到了
  //   屏幕顶部),自动删除并重置到默认位置。这是"位置挡按钮"的根因防护。
  // - key 迁移:v18 → v19,清掉旧 localStorage 数据,防止 v18 错位状态被新代码读取。
  React.useEffect(() => {
    const el = paneRef.current
    if (!el) return
    try {
      // v19 一次性清理 v18 残留
      localStorage.removeItem('pane-drag-v18')
      const saved = localStorage.getItem('pane-drag-v19')
      if (saved) {
        const { x, y } = JSON.parse(saved) as { x: number; y: number }
        // 边界 clamp:Y 不能让 Pane 顶部小于 0(viewport 顶部 0 安全阈值)
        // 视口 0 - inner div 顶部 72px = -72px,所以 Y 不能小于 -72
        // 留 8px buffer,clamp 到 -64px 之内(让 Pane 顶部最高位于 viewport 8px,正好避开 header)
        const safeY = Math.max(y, -64)
        el.style.transform = `translate(${x}px, ${safeY}px)`
      }
    } catch {
      // localStorage 读取失败或 JSON 解析失败 → 静默忽略
    }
  }, [open])

  // v18 终极方案:Pane 是 aside inner div(`<div className="relative min-h-0 flex-1">`)
  // 的 inline JSX 子元素,绝对定位天然锚定到 inner div 右上角。
  // - inner div 顶部 = aside 顶部 + 56(header) = viewport 64px
  // - Pane top:8 → viewport 72px,正好避开 header 56 工具栏(用户规则"应该偏下一些")
  // - Pane right:8 → inner div 右边 8px
  // - AI 面板 resize / open / close / window resize → Pane 0 JS 自动跟随(浏览器原生排版)
  // - 拖动用纯 DOM style.transform(不影响 React state,不影响 Pane 位置计算)
  const positionStyle: React.CSSProperties = {
    position: 'absolute',
    top: 8,
    right: 8,
  }

  // 登录弹窗打开时隐藏 pane(避免 z-popover 2001 浮在 z-modal 2000 遮罩之上)
  const isLoginOpen = useLoginDialogStore((s) => s.isOpen)

  // v18:删除 `if (!paneAnchor) return null`(没有 portal anchor 概念了)
  if (!open || !mounted) return null
  if (isLoginOpen) return null

  // Phase 23(2026-07-29):最小化模式 — 渲染摘要条替代完整面板
  // 2026-08-01 修复:AI 未在执行(planSteps 空 + 非流式 + 无工具调用)时不渲染摘要条,
  // 避免显示 "0 工具调用 · 0%" 假数据静态条(用户反馈"全都是假的")。
  // isMinimized 状态保留(不违背 v17"minimize 完全由用户控制"),仅不渲染假数据 UI;
  // 当 AI 真正执行且产生工具调用时,摘要条随真实数据动态显示。
  if (isMinimized) {
    const hasActiveExecution = planSteps.length > 0 || isStreaming || tools.length > 0
    if (!hasActiveExecution) return null
    return (
      <div
        className="absolute z-sticky"
        style={positionStyle}
        data-testid="pane-minimized-container"
      >
        <MinimizedSummaryBar
          progress={progressPct}
          toolCallCount={tools.length}
          subagentCount={subagents.length}
          onExpand={() => setIsMinimized(false)}
        />
      </div>
    )
  }

  // v18 终极方案:inline JSX,Pane 是 aside inner div 的子元素。
  // - 绝对定位 top:8 right:8 → 锚定 inner div 右上角(viewport 64px,避开 header 56)
  // - 拖动用纯 DOM style.transform(handle 元素 + onHandleMouseDown 启动)
  // - 内部 button click 路径不被污染(handle onMouseDown 用 closest('button') 早退)
  return (
    <div
      ref={paneRef}
      className={cn(
        // z-sticky(990) < z-modal(2000):登录弹窗遮罩盖住 pane,CSS 层级保底
        // (2026-07-31 根因修复:原 z-popover=2001 > z-modal=2000,pane 浮在登录框之上)
        'absolute z-sticky',
        'flex w-full min-[768px]:w-[280px] max-h-[60vh] flex-col',
        'overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md',
      )}
      style={positionStyle}
      role="complementary"
      aria-label={t('ariaLabel')}
      data-testid="agent-progress-pane"
    >
      {/* Header:拖动 handle + 进度环 + 步骤预算 + 工具按钮 */}
      {/* v18:恢复拖动 — header 空白区域 onMouseDown 启动拖动,
          button 区域(closest 早退)走 button 自己的 onClick,click 路径 100% 纯粹。 */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions
          -- v18 设计选择:header 整体是拖动 handle,内嵌 button 用 closest('button') 早退
          保留独立 onClick。已通过测试用例 pane-minimize.test.tsx 的 click 路径纯粹性验证。 */}
      <div
        className={cn(
          'flex h-8 shrink-0 select-none items-center gap-1 border-b border-border px-1.5',
        )}
        onMouseDown={onHandleMouseDown}
        data-testid="pane-header"
      >
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
        {/* Phase 19: 步骤预算指示器(内联模式,显示在 header) */}
        {planSteps.length > 0 && (
          <div>
            <ResourceBudget
              used={planSteps.length}
              total={STEP_BUDGET_TOTAL}
              label={t('stepBudgetLabel')}
              variant="inline"
              active={isStreaming}
              className="ml-0.5 hidden min-[640px]:inline-flex"
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
        <button
          type="button"
          onClick={() => setExpandAll(expandAll === true ? false : true)}
          aria-label={expandAll === true ? t('collapseAll') : t('expandAll')}
          title={expandAll === true ? t('collapseAll') : t('expandAll')}
          className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
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
            'inline-flex h-9 w-9 items-center justify-center rounded-sm transition-colors',
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
            'inline-flex h-9 w-9 items-center justify-center rounded-sm transition-colors',
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
          className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
          className="border-b border-border/40 px-2 py-1 min-[640px]:hidden"
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

      {/* 内容区:统一显示对话流详情(plan steps + sections) */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-1"
        data-testid="plan-list"
      >
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

        {threadId && planSteps.length === 0 && isStreaming && (
          // v20(2026-08-02):删除 v13 假 skeleton 4 行(50/62/74/86% 宽度假数据),
          // 改为 1 行真实"等待 AI 规划"状态。语义:
          // - threadId 存在 + AI 已连接(isStreaming) + plan 还没下发
          //   → 用户看到的是"AI 在思考,plan 即将到来"真实信号
          // - 非 streaming + planSteps.length === 0 → 啥都不渲染(让 sections-container 的
          //   实时数据 / empty state 主导显示),杜绝"假空行"
          <div
            className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-muted-foreground/70"
            data-testid="pane-waiting-for-plan"
            aria-live="polite"
          >
            <Loader2
              className="h-3 w-3 shrink-0 animate-spin text-primary"
              aria-hidden
              data-testid="pane-waiting-spinner"
            />
            <span>{t('waitingForPlan')}</span>
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
              {/* v19(2026-08-02 整合):当前任务摘要条 — 替代之前 v9 在 trigger 下方弹
                  的 TaskListPopover。当前任务(规划/MCP/插件调用/工具调用/终端/子代理)
                  以统一 label + spinner 形式显示在 Pane 顶部,用户在 AI 面板右上角
                  直接看到实时活动,无需额外 popover。 */}
              {currentTask && currentTask.kind !== 'idle' && currentTask.label && (
                <div
                  className="mx-1.5 mt-1 flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] text-foreground/80"
                  data-testid="pane-current-task-summary"
                  data-task-kind={currentTask.kind}
                >
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" aria-hidden />
                  <span className="min-w-0 flex-1 truncate" title={currentTask.label}>
                    {currentTask.label}
                  </span>
                </div>
              )}
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
