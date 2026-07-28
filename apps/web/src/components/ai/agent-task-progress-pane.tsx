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
  ArrowDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
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
import { CopyButton } from './progress-sections/copy-button'
import { ProgressRing } from './progress-sections/progress-ring'
import {
  ConnectionStatus,
  ConnectionStatusDot,
  deriveConnectionState,
  type ConnectionState,
} from './progress-sections/connection-status'

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
  pending: 'text-muted-foreground/60',
  in_progress: 'text-primary',
  completed: 'text-emerald-500',
}

// ─── 单个 plan step 渲染(v10 memo 化:单个 step 变化不影响其他 step) ───
const PlanStepItem = React.memo(function PlanStepItem({
  step,
  index,
}: {
  step: PlanStep
  index: number
}) {
  const t = useTranslations('ai.pane')
  const Icon = PLAN_ICON[step.status]
  const stepLabel =
    step.status === 'in_progress'
      ? t('stepInProgress', { n: index + 1, step: step.step })
      : step.status === 'completed'
        ? t('stepCompleted', { n: index + 1, step: step.step })
        : t('stepPending', { n: index + 1, step: step.step })
  return (
    <div
      role="listitem"
      className={cn(
        'flex items-start gap-1.5 px-2 py-0.5 text-[11px] leading-relaxed transition-colors',
        step.status === 'in_progress' && 'bg-primary/10',
      )}
      aria-label={stepLabel}
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
        {/* explanation 副标题:仅 in_progress 步骤显示(plan 级 explanation,避免重复) */}
        {step.status === 'in_progress' && step.explanation && (
          <div className="mt-0.5 break-all text-[10px] text-muted-foreground/60">
            {step.explanation}
          </div>
        )}
      </div>
    </div>
  )
})

// ─── 主组件 ──────────────────────────────────────────────────────────
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

  // v10: completedCount + progressPct 用 useMemo 缓存(避免每次 render 重新计算)
  const { completedCount, progressPct } = React.useMemo(() => {
    if (planSteps.length === 0) return { completedCount: 0, progressPct: 0 }
    const completed = planSteps.filter((s) => s.status === 'completed').length
    return {
      completedCount: completed,
      progressPct: (completed / planSteps.length) * 100,
    }
  }, [planSteps])

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

  // v11: 折叠子区键盘导航(roving tabindex)
  // ArrowUp/Down 在 section headers 间移动焦点,Home/End 跳首/末
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

  // Phase 17: 自动滚动到底部(用户位于底部时跟随新内容,滚上去后显示"跳到最新"按钮)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = React.useState(true)
  const [showJumpToLatest, setShowJumpToLatest] = React.useState(false)

  // 监听滚动位置:距底部 < 20px 视为"在底部"
  const onScroll = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const atBottom = distanceFromBottom < 20
    setAutoScroll(atBottom)
    setShowJumpToLatest(!atBottom && el.scrollHeight > el.clientHeight + 50)
  }, [])

  // 内容变化时自动滚动到底部(autoScroll=true 时)
  React.useEffect(() => {
    const el = scrollRef.current
    if (!el || !autoScroll) return
    // requestAnimationFrame 避免布局抖动
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

  if (!open) return null

  return (
    <div
      ref={paneRef}
      className={cn(
        // 位置:消息区右上角固定(absolute + right-2 top-2),用户特意要求设计放在这里
        // trigger 永远渲染(由 agent-progress-trigger.tsx 维护),open=true 时 invisible 占位
        // → popover absolute 浮在右上角不影响 inline 流 → 周围内容零窜位
        'absolute right-2 top-2 z-50',
        // 尺寸:紧凑 popover + 高度自适应(视口 60vh,内容多时整体滚动)
        'flex w-[280px] max-h-[60vh] flex-col',
        // 外观:圆角边框阴影,popover 风格
        'overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md',
      )}
      role="complementary"
      aria-label={t('pane.ariaLabel')}
      data-testid="agent-progress-pane"
    >
      {/* Header:状态点 + 标题 + pin 按钮 + 关闭按钮 */}
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border px-2">
        {/* Phase 16: 状态点(连接状态可视化) - 替换原静态点 */}
        <ConnectionStatusDot
          state={connectionState}
          className={cn(
            'transition-all duration-300',
            // 5 状态颜色(对标 Trae Work)
            connectionState === 'connected' && 'shadow-[0_0_0_1px_rgb(16_185_129/0.3)]',
            connectionState === 'reconnecting' && 'shadow-[0_0_0_1px_rgb(245_158_11/0.3)]',
            connectionState === 'disconnected' && 'shadow-[0_0_0_1px_rgb(239_68_68/0.3)]',
          )}
        />
        <ListTodo className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        <span className="shrink-0 text-xs font-medium">{t('title')}</span>
        {/* Phase 16: 进度环(中心显示百分比,带脉冲/庆祝动画) */}
        {planSteps.length > 0 && (
          <ProgressRing
            value={progressPct}
            state={ringState}
            centerMode="percent"
            size={16}
            strokeWidth={2}
            aria-label={t('pane.progressLabel', { pct: Math.round(progressPct) })}
          />
        )}
        {/* Phase 16: SSE 连接状态指示器(紧凑模式,仅异常状态显示文字) */}
        {connectionState !== 'connected' && connectionState !== 'connecting' && (
          <ConnectionStatus
            state={connectionState}
            reconnectAttempt={progress.overview.reconnectAttempt}
            totalAttempts={5}
            error={progress.overview.error}
            className="ml-0.5"
          />
        )}
        <div className="flex-1" />
        {/* v9: 展开全部/折叠全部按钮 */}
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
        {/* pin/unpin 按钮 */}
        <button
          type="button"
          onClick={togglePin}
          aria-label={pinned ? t('pane.unpin') : t('pane.pin')}
          className={cn(
            'inline-flex h-5 w-5 items-center justify-center rounded-sm transition-colors',
            pinned
              ? 'text-primary hover:bg-accent'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
          title={pinned ? `${t('pane.unpin')}(点击外部可关闭)` : `${t('pane.pin')}(钉住,点击外部不关闭)`}
          data-testid="pane-pin"
        >
          {pinned ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
        </button>
        {/* 最小化按钮(跟 trigger 联动:点击 = toggle,等价于点 trigger 按钮) */}
        <button
          type="button"
          onClick={toggle}
          aria-label={t('pane.minimize')}
          className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          title={`${t('pane.minimize')}(与触发按钮联动)`}
          data-testid="pane-minimize"
        >
          <Minimize2 className="h-3 w-3" />
        </button>
      </div>

      {/* 内容:plan steps 列表 + 折叠子区(min-h-0 + flex-1 让 popover 整体滚动,避免嵌套) */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-1"
        data-testid="plan-list"
      >
        {/* 无 conversationId */}
        {!threadId && (
          <div className="flex flex-col items-center gap-1.5 px-2 py-6 text-center">
            <MessageSquare className="h-4 w-4 text-muted-foreground/60" />
            <span className="text-[11px] text-muted-foreground/60">开始对话后显示任务计划</span>
          </div>
        )}

        {/* v9: 有 threadId 但无 planSteps — 骨架屏加载效果 */}
        {threadId && planSteps.length === 0 && (
          <div className="space-y-1 px-2 py-2" data-testid="plan-skeleton">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="h-3 w-3 shrink-0 animate-pulse rounded-sm bg-muted/60" />
                <div
                  className="h-2.5 animate-pulse rounded-sm bg-muted/60"
                  style={{ width: `${60 + i * 10}%` }}
                />
              </div>
            ))}
          </div>
        )}

        {/* plan steps 列表 + 进度条 */}
        {planSteps.length > 0 && (
          <>
            <div role="list" aria-label="任务步骤列表">
              {planSteps.map((step, idx) => (
                <PlanStepItem key={step.id} step={step} index={idx} />
              ))}
            </div>
            {/* v9: 统计文字(线性进度条已移除,改用 header 中的 SVG 圆环) */}
            <div
              className="mx-2 mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground/60"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="flex items-center gap-1">
                <span>{completedCount}/{planSteps.length} 已完成</span>
                <CopyButton
                  text={planSteps.map((s, i) => `${i + 1}. [${s.status}] ${s.step}`).join('\n')}
                  aria-label="复制任务计划"
                  data-testid="copy-plan-btn"
                />
              </span>
              {isStreaming && (
                <span className="flex items-center gap-0.5 text-primary" role="status">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  执行中
                </span>
              )}
            </div>
          </>
        )}

        {/* 折叠子区:思考过程 / 工具调用 / Subagent 派单 / 文件变更 / 终端任务 / 任务总览(对齐 Trae Work) */}
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
              <SubagentSection subagents={subagents} />
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

        {/* Phase 17: 跳到最新按钮(用户滚离底部时显示) */}
        {showJumpToLatest && (
          <button
            type="button"
            onClick={jumpToLatest}
            aria-label="跳到最新"
            title="跳到最新"
            className="absolute bottom-2 left-1/2 inline-flex h-6 -translate-x-1/2 items-center gap-0.5 rounded-md border border-border bg-popover px-2 text-[10px] text-muted-foreground shadow-sm transition-all hover:bg-accent hover:text-accent-foreground"
            data-testid="pane-jump-latest"
          >
            <ArrowDown className="h-2.5 w-2.5" />
            <span>最新</span>
          </button>
        )}
      </div>
    </div>
  )
}

export default AgentTaskProgressPane
