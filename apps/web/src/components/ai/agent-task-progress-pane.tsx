'use client'

import * as React from 'react'
import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { useAgentProgressPaneStore } from '@/stores/agent-progress-pane'
import type { AgentProgressColumn, AgentProgressSortMode } from '@/stores/agent-progress-pane'
import { useAgentProgress } from '@/hooks/use-agent-progress'
import type {
  AgentOverview,
  PlanStep,
  PlanStepStatus,
  Subagent,
  TerminalTask,
} from '@/hooks/use-agent-progress'
import { SUBAGENT_COLOR_CLASS } from '@/hooks/use-agent-progress'

/**
 * AgentTaskProgressPane — Codex CLI TUI 风格 Agent 任务进度底部面板(2026-07-27 v2)
 *
 * Codex 一致性对齐(v2 强化):
 * - 等宽字体(font-mono)+ 高密度紧凑布局(终端风格)
 * - 文本字符图标替代 lucide:⠋ spinner / ✓ done / • pending / ✗ failed / ○ idle
 * - cursor 高亮(j/k 移动,Enter 展开,y/n 审批)
 * - 1/2/3 切换栏(Codex 标准三栏切换)
 * - 单行状态栏(替代 kbd 徽章):mode 指示 + cursor 位置 + 快捷键提示
 * - 历史 bracket `[====|====│=====> ]` + "无历史数据"降级
 * - 长输出默认折叠 + 折叠态显示 ⚡ 耗时
 */

// ─── Codex 文本字符图标(替代 lucide)───────────────────────────────────
const STATUS_CHAR: Record<AgentOverview['status'], string> = {
  idle: '○',
  running: '⠋',
  completed: '✓',
  failed: '✗',
  interrupted: '⏸',
}
const STATUS_CLS: Record<AgentOverview['status'], string> = {
  idle: 'text-muted-foreground',
  running: 'text-primary',
  completed: 'text-emerald-500',
  failed: 'text-red-500',
  interrupted: 'text-amber-500',
}

const STEP_CHAR: Record<PlanStepStatus, string> = {
  pending: '•',
  in_progress: '⠋',
  completed: '✓',
}
const STEP_CLS: Record<PlanStepStatus, string> = {
  pending: 'text-muted-foreground',
  in_progress: 'text-primary',
  completed: 'text-emerald-500',
}

// Codex 真正循环 braille spinner(8 帧 120ms)
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
function Spinner({ className }: { className?: string }) {
  const [frame, setFrame] = React.useState(0)
  React.useEffect(() => {
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % SPINNER_FRAMES.length)
    }, 120)
    return () => window.clearInterval(id)
  }, [])
  return <span className={className}>{SPINNER_FRAMES[frame]}</span>
}

// 状态字符(in_progress 用真 Spinner,其他用静态字符)
function StatusGlyph({
  status,
  char,
  className,
}: {
  status: 'in_progress' | 'running' | 'static'
  char: string
  className?: string
}) {
  if (status === 'in_progress' || status === 'running') {
    return <Spinner className={className} />
  }
  return <span className={className}>{char}</span>
}

const COLUMN_LABEL: Record<AgentProgressColumn, string> = {
  tasks: 'Tasks',
  subagents: 'Subagents',
  terminals: 'Terminals',
}
const COLUMN_KEY: Record<AgentProgressColumn, string> = {
  tasks: '1',
  subagents: '2',
  terminals: '3',
}

const SORT_LABEL: Record<AgentProgressSortMode, string> = {
  recent: 'recent',
  duration: 'duration',
  status: 'status',
}

// ─── 辅助函数 ────────────────────────────────────────────────────────
function formatDuration(ms?: number): string {
  if (ms === undefined) return ''
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${m}m${s}s`
}

function formatTime(iso?: string): string {
  if (!iso) return '--:--:--'
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso))
  } catch {
    return '--:--:--'
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx] ?? 0
}

/** 历史 bracket:[====|====│=====> ] */
function HistoryBracket({
  elapsedMs,
  historicalDurations,
}: {
  elapsedMs?: number
  historicalDurations: number[]
}) {
  if (historicalDurations.length < 5 || elapsedMs === undefined) {
    return (
      <span className="text-muted-foreground/50" data-testid="no-history">
        no-hist
      </span>
    )
  }
  const sorted = [...historicalDurations].sort((a, b) => a - b)
  const p25 = percentile(sorted, 25)
  const p50 = percentile(sorted, 50)
  const p75 = percentile(sorted, 75)
  const max = p75 > 0 ? p75 : 1
  const pos25 = Math.round((p25 / max) * 10)
  const pos50 = Math.round((p50 / max) * 10)
  const elapsedPos = Math.min(10, Math.round((elapsedMs / max) * 10))
  const chars: string[] = []
  for (let i = 0; i < 10; i++) {
    if (i === pos25) chars.push('|')
    else if (i === pos50) chars.push('│')
    else if (i === elapsedPos) chars.push('>')
    else if (i < elapsedPos) chars.push('=')
    else chars.push(' ')
  }
  return (
    <span
      className="text-muted-foreground"
      data-testid="history-bracket"
      title={`p25:${formatDuration(p25)} p50:${formatDuration(p50)} p75:${formatDuration(p75)} elapsed:${formatDuration(elapsedMs)}`}
    >
      [{chars.join('')}]
    </span>
  )
}

// ─── Cursor 高亮行前缀 ──────────────────────────────────────────────
function CursorPrefix({ active }: { active: boolean }) {
  return (
    <span className={cn('shrink-0', active ? 'text-primary' : 'text-transparent')}>
      {active ? '▶' : ' '}
    </span>
  )
}

// ─── Tasks 栏 ────────────────────────────────────────────────────────
function TasksColumn({
  steps,
  overview,
  sortMode,
  verbose,
  cursorIndex,
}: {
  steps: PlanStep[]
  overview: AgentOverview
  sortMode: AgentProgressSortMode
  verbose: boolean
  cursorIndex: number
}) {
  if (steps.length === 0) {
    return <EmptyState text="no plan steps" hint="waiting for plan_updated / node_start" />
  }

  const sorted = [...steps]
  if (sortMode === 'duration') {
    sorted.sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
  } else if (sortMode === 'status') {
    const order: Record<PlanStepStatus, number> = { in_progress: 0, pending: 1, completed: 2 }
    sorted.sort((a, b) => order[a.status] - order[b.status])
  }

  return (
    <div className="font-mono text-xs leading-tight" data-testid="tasks-list">
      {sorted.map((step, idx) => {
        const isCursor = idx === cursorIndex
        return (
          <div
            key={step.id}
            className={cn(
              'px-1 py-0.5',
              isCursor && 'bg-primary/20 border-l-2 border-primary',
            )}
            data-testid="task-item"
            data-status={step.status}
            data-cursor={isCursor}
          >
            <div className="flex items-start gap-1.5">
              <CursorPrefix active={isCursor} />
              <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground/60">
                {idx + 1}.
              </span>
              <StatusGlyph
                status={step.status === 'in_progress' ? 'in_progress' : 'static'}
                char={STEP_CHAR[step.status]}
                className={cn('w-3 shrink-0 text-center', STEP_CLS[step.status])}
              />
              <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">
                {step.step}
              </span>
              {step.status === 'in_progress' && (
                <HistoryBracket
                  elapsedMs={step.durationMs}
                  historicalDurations={overview.historicalDurations}
                />
              )}
              {step.status === 'completed' && step.durationMs !== undefined && (
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatDuration(step.durationMs)}
                </span>
              )}
            </div>
            {/* Codex:explanation 默认显示在 step 下方缩进 */}
            {step.explanation && (isCursor || verbose) && (
              <div className="mt-0.5 pl-9 text-muted-foreground/80 break-words whitespace-pre-wrap">
                └ {step.explanation}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Subagents 栏 ────────────────────────────────────────────────────
function SubagentsColumn({
  subagents,
  showArchived,
  verbose,
  cursorIndex,
  onApprove,
}: {
  subagents: Subagent[]
  showArchived: boolean
  verbose: boolean
  cursorIndex: number
  onApprove: (id: string, approve: boolean) => void
}) {
  const visible = showArchived
    ? subagents
    : subagents.filter((s) => s.status === 'running' || s.status === 'spawned')

  if (visible.length === 0) {
    return (
      <EmptyState
        text="no subagents"
        hint={showArchived ? 'waiting for subagent_spawn' : 'all archived, press a to show'}
      />
    )
  }

  return (
    <div className="font-mono text-xs leading-tight" data-testid="subagents-list">
      {visible.map((sub, idx) => {
        const isCursor = idx === cursorIndex
        const colorCls = SUBAGENT_COLOR_CLASS[sub.color]
        // Codex:dead agents(done/failed/dead)变灰,running 保留彩色
        const isDead = sub.status === 'done' || sub.status === 'failed' || sub.status === 'dead'
        const deadCls = isDead ? 'opacity-50' : ''
        const statusCls =
          sub.status === 'running'
            ? colorCls
            : sub.status === 'done'
              ? 'text-emerald-500'
              : sub.status === 'failed'
                ? 'text-red-500'
                : colorCls
        return (
          <div
            key={sub.id}
            className={cn(
              'px-1 py-0.5',
              isCursor && 'bg-primary/20 border-l-2 border-primary',
              deadCls,
            )}
            data-testid="subagent-item"
            data-status={sub.status}
            data-cursor={isCursor}
          >
            <div className="flex items-center gap-1.5">
              <CursorPrefix active={isCursor} />
              <StatusGlyph
                status={sub.status === 'running' ? 'running' : 'static'}
                char={
                  sub.status === 'done'
                    ? '✓'
                    : sub.status === 'failed'
                      ? '✗'
                      : '•'
                }
                className={cn('w-3 shrink-0 text-center', statusCls)}
              />
              <span className={cn('shrink-0 font-semibold', colorCls)}>{sub.handle}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground/70">
                [{sub.status}]
              </span>
              {sub.durationMs !== undefined && (
                <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                  {formatDuration(sub.durationMs)}
                </span>
              )}
            </div>
            {(isCursor || verbose) && (sub.currentTask || sub.role) && (
              <div className="pl-7 text-muted-foreground break-words whitespace-pre-wrap">
                {sub.role && <span className="mr-2">role:{sub.role}</span>}
                {sub.currentTask && <span>┆ {sub.currentTask}</span>}
                {verbose && (
                  <span className="ml-2 text-[10px] text-muted-foreground/50">{sub.threadId}</span>
                )}
              </div>
            )}
            {sub.pendingApproval && isCursor && (
              <div className="pl-7 text-amber-600" data-testid="inline-approval">
                needs approval: y=approve n=reject
                <Button
                  size="sm"
                  variant="default"
                  className="ml-2 h-5 px-1.5 text-[10px]"
                  onClick={() => onApprove(sub.id, true)}
                  data-testid="approve-btn"
                >
                  y
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-1 h-5 px-1.5 text-[10px]"
                  onClick={() => onApprove(sub.id, false)}
                  data-testid="reject-btn"
                >
                  n
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Terminals 栏 ────────────────────────────────────────────────────
function TerminalsColumn({
  terminals,
  isExpanded,
  showArchived,
  cursorIndex,
}: {
  terminals: TerminalTask[]
  isExpanded: (id: string) => boolean
  showArchived: boolean
  cursorIndex: number
}) {
  const visible = showArchived ? terminals : terminals.filter((t) => t.status === 'running')

  if (visible.length === 0) {
    return (
      <EmptyState
        text="no terminals"
        hint={showArchived ? 'waiting for terminal_start' : 'all archived, press a to show'}
      />
    )
  }

  return (
    <div className="font-mono text-xs leading-tight" data-testid="terminals-list">
      {visible.map((term, idx) => {
        const isCursor = idx === cursorIndex
        const expanded = isExpanded(term.id)
        const isLong = term.output && term.output.length > 200
        const statusCls =
          term.status === 'running'
            ? 'text-primary'
            : term.status === 'completed'
              ? 'text-emerald-500'
              : 'text-red-500'
        // Codex:折叠态显示最后 2-3 行输出预览,展开态显示全部
        const outputLines = term.output ? term.output.split('\n') : []
        const previewLines = outputLines.slice(-3)
        const showFull = expanded || !isLong
        return (
          <div
            key={term.id}
            className={cn(
              'px-1 py-0.5',
              isCursor && 'bg-primary/20 border-l-2 border-primary',
            )}
            data-testid="terminal-item"
            data-status={term.status}
            data-cursor={isCursor}
          >
            <div className="flex items-center gap-1.5">
              <CursorPrefix active={isCursor} />
              <StatusGlyph
                status={term.status === 'running' ? 'running' : 'static'}
                char={term.status === 'completed' ? '✓' : '✗'}
                className={cn('w-3 shrink-0 text-center', statusCls)}
              />
              <span className="shrink-0 text-muted-foreground">$</span>
              <code className="min-w-0 flex-1 break-all">{term.command}</code>
              {isLong && (
                <span className="shrink-0 text-muted-foreground/70">
                  {expanded ? '▾' : '▸'}
                </span>
              )}
              {term.durationMs !== undefined && (
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  ⚡{formatDuration(term.durationMs)}
                </span>
              )}
            </div>
            {/* Codex:展开态显示全部输出,折叠态显示最后 3 行预览 */}
            {showFull && term.output && (
              <pre className="mt-0.5 ml-7 max-h-24 overflow-y-auto whitespace-pre-wrap break-all bg-muted/30 p-1 text-[10px] leading-relaxed">
                {term.output}
              </pre>
            )}
            {!showFull && previewLines.length > 0 && (
              <pre className="mt-0.5 ml-7 whitespace-pre-wrap break-all text-[10px] leading-relaxed text-muted-foreground/60">
                {previewLines.join('\n')}
              </pre>
            )}
          </div>
        )
      })}
    </div>
  )
}

function EmptyState({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-6 text-center font-mono text-xs text-muted-foreground">
      <p>{text}</p>
      {hint && <p className="text-[10px] text-muted-foreground/60">{hint}</p>}
    </div>
  )
}

// ─── 主 Bottom Pane 组件 ─────────────────────────────────────────────
export function AgentTaskProgressPane() {
  const open = useAgentProgressPaneStore((s) => s.open)
  const threadId = useAgentProgressPaneStore((s) => s.threadId)
  const activeColumn = useAgentProgressPaneStore((s) => s.activeColumn)
  const threadIdInput = useAgentProgressPaneStore((s) => s.threadIdInput)
  const verbose = useAgentProgressPaneStore((s) => s.verbose)
  const showArchived = useAgentProgressPaneStore((s) => s.showArchived)
  const sortMode = useAgentProgressPaneStore((s) => s.sortMode)
  const cursorIndex = useAgentProgressPaneStore((s) => s.cursorIndex)
  const closePane = useAgentProgressPaneStore((s) => s.closePane)
  const setActiveColumn = useAgentProgressPaneStore((s) => s.setActiveColumn)
  const setThreadIdInput = useAgentProgressPaneStore((s) => s.setThreadIdInput)
  const submitThreadId = useAgentProgressPaneStore((s) => s.submitThreadId)
  const setThreadId = useAgentProgressPaneStore((s) => s.setThreadId)
  const toggleExpanded = useAgentProgressPaneStore((s) => s.toggleExpanded)
  const isExpanded = useAgentProgressPaneStore((s) => s.isExpanded)
  const moveCursor = useAgentProgressPaneStore((s) => s.moveCursor)

  const progress = useAgentProgress(threadId)
  const { overview, planSteps, subagents, terminals, isStreaming } = progress

  // 各栏可见条目数(用于 cursor clamp)
  const visibleCount = React.useMemo(() => {
    if (activeColumn === 'tasks') return planSteps.length
    if (activeColumn === 'subagents') {
      return showArchived
        ? subagents.length
        : subagents.filter((s) => s.status === 'running' || s.status === 'spawned').length
    }
    return showArchived ? terminals.length : terminals.filter((t) => t.status === 'running').length
  }, [activeColumn, planSteps, subagents, terminals, showArchived])

  // 当前 cursor 指向的条目 ID(用于 Enter 展开)
  const cursorId = React.useMemo<string | null>(() => {
    if (cursorIndex < 0 || cursorIndex >= visibleCount) return null
    if (activeColumn === 'tasks') return planSteps[cursorIndex]?.id ?? null
    if (activeColumn === 'subagents') {
      const visible = showArchived
        ? subagents
        : subagents.filter((s) => s.status === 'running' || s.status === 'spawned')
      return visible[cursorIndex]?.id ?? null
    }
    const visible = showArchived ? terminals : terminals.filter((t) => t.status === 'running')
    return visible[cursorIndex]?.id ?? null
  }, [cursorIndex, visibleCount, activeColumn, planSteps, subagents, terminals, showArchived])

  // 当前 cursor 指向的 subagent(用于 y/n 审批)
  const cursorSubagent = React.useMemo<Subagent | null>(() => {
    if (activeColumn !== 'subagents') return null
    const visible = showArchived
      ? subagents
      : subagents.filter((s) => s.status === 'running' || s.status === 'spawned')
    return visible[cursorIndex] ?? null
  }, [activeColumn, subagents, showArchived, cursorIndex])

  const handleStart = React.useCallback(() => {
    if (threadId) progress.start()
  }, [threadId, progress])

  const handleStop = React.useCallback(() => progress.stop(), [progress])

  const handleClear = React.useCallback(() => {
    progress.clear()
    setThreadId(null)
  }, [progress, setThreadId])

  const handleInputSubmit = React.useCallback(() => submitThreadId(), [submitThreadId])

  const handleApprove = React.useCallback((id: string, _approve: boolean) => {
    void id
  }, [])

  // Esc 关闭 + j/k/Enter/y/n/g/G/space(Codex 数据上下文快捷键)
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
      const ctrl = e.ctrlKey || e.metaKey
      const shift = e.shiftKey
      const alt = e.altKey
      const key = e.key.toLowerCase()

      if (e.key === 'Escape') {
        e.preventDefault()
        closePane()
        return
      }
      // j/↓ 下移 cursor
      if ((key === 'j' || e.key === 'ArrowDown') && !ctrl && !shift && !alt) {
        e.preventDefault()
        moveCursor(1, visibleCount)
        return
      }
      // k/↑ 上移 cursor
      if ((key === 'k' || e.key === 'ArrowUp') && !ctrl && !shift && !alt) {
        e.preventDefault()
        moveCursor(-1, visibleCount)
        return
      }
      // g:跳到第一项(Codex 标准)
      if (key === 'g' && !ctrl && !shift && !alt) {
        e.preventDefault()
        useAgentProgressPaneStore.getState().setCursor(0)
        return
      }
      // G:跳到最后一项(Codex 标准)
      if (key === 'g' && !ctrl && shift && !alt) {
        e.preventDefault()
        useAgentProgressPaneStore.getState().setCursor(Math.max(0, visibleCount - 1))
        return
      }
      // space/PgDn:向下翻页(5 项)
      if ((e.key === ' ' || e.key === 'PageDown') && !ctrl && !shift && !alt) {
        e.preventDefault()
        moveCursor(5, visibleCount)
        return
      }
      // Enter:展开/折叠当前项
      if (e.key === 'Enter' && !ctrl && !shift && !alt) {
        e.preventDefault()
        if (cursorId && (activeColumn === 'subagents' || activeColumn === 'terminals')) {
          toggleExpanded(cursorId)
        }
        return
      }
      // y:审批通过
      if (key === 'y' && !ctrl && !shift && !alt) {
        if (cursorSubagent?.pendingApproval) {
          e.preventDefault()
          handleApprove(cursorSubagent.id, true)
        }
        return
      }
      // n:审批拒绝
      if (key === 'n' && !ctrl && !shift && !alt) {
        if (cursorSubagent?.pendingApproval) {
          e.preventDefault()
          handleApprove(cursorSubagent.id, false)
        }
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closePane, moveCursor, visibleCount, cursorId, cursorSubagent, activeColumn, toggleExpanded, handleApprove])

  // Codex:cursor 移动时自动滚动到可视区
  const contentRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open) return
    const root = contentRef.current
    if (!root) return
    const cursorEl = root.querySelector('[data-cursor="true"]') as HTMLElement | null
    if (cursorEl) {
      cursorEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [open, cursorIndex, activeColumn, visibleCount])

  if (!open) return null

  const statusCls = STATUS_CLS[overview.status]
  const isRunning = overview.status === 'running'

  return (
    <div
      className={cn(
        'pointer-events-auto fixed inset-x-0 bottom-0 z-sticky',
        'mx-auto flex max-h-[60vh] w-full flex-col border-t border-border bg-card font-mono',
      )}
      role="region"
      aria-label="Agent 任务进度底部面板"
      data-testid="agent-progress-pane"
    >
      {/* Header:单行紧凑状态(Codex 风格)+ currentNode */}
      <div className="flex items-center gap-2 border-b border-border px-2 py-1 text-xs">
        <span className="shrink-0 font-semibold">Agent</span>
        <StatusGlyph
          status={isRunning ? 'running' : 'static'}
          char={STATUS_CHAR[overview.status]}
          className={cn('shrink-0', statusCls)}
        />
        <span className="shrink-0 text-muted-foreground" data-testid={`status-${overview.status}`}>
          {overview.status}
        </span>
        {/* Codex:显示当前执行节点 */}
        {overview.currentNode && (
          <span className="shrink-0 text-muted-foreground/80" data-testid="current-node">
            @ {overview.currentNode}
          </span>
        )}
        {threadId && (
          <span className="shrink-0 text-muted-foreground/70">
            #{verbose ? threadId : threadId.slice(0, 8)}
          </span>
        )}
        {isStreaming && (
          <span className="shrink-0 animate-pulse text-primary" data-testid="pane-streaming">
            ●
          </span>
        )}
        {/* Codex 风格模式指示器:单行内联文本 */}
        <span className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground/80">
          <span data-testid="sort-indicator">sort:{SORT_LABEL[sortMode]}</span>
          <span data-testid="verbose-indicator" className={verbose ? 'text-primary' : ''}>
            v:{verbose ? 'on' : 'off'}
          </span>
          <span data-testid="archived-indicator" className={showArchived ? 'text-primary' : ''}>
            a:{showArchived ? 'on' : 'off'}
          </span>
          <span>
            {cursorIndex + 1}/{Math.max(1, visibleCount)}
          </span>
        </span>
        {threadId && (
          <span className="ml-2 flex items-center gap-1">
            {isStreaming ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleStop}
                className="h-5 px-1.5 text-[10px]"
                data-testid="stop-btn"
              >
                stop
              </Button>
            ) : (
              <Button
                size="sm"
                variant="default"
                onClick={handleStart}
                className="h-5 px-1.5 text-[10px]"
                data-testid="start-btn"
              >
                run
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClear}
              className="h-5 px-1.5 text-[10px]"
              data-testid="clear-btn"
            >
              clr
            </Button>
          </span>
        )}
      </div>

      {/* ThreadId 输入栏(仅 threadId 未设置时显示) */}
      {!threadId && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-2 py-1">
          <span className="text-muted-foreground">{'>'}</span>
          <input
            type="text"
            value={threadIdInput}
            onChange={(e) => setThreadIdInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleInputSubmit()
              }
            }}
            placeholder="enter threadId..."
            className="min-w-0 flex-1 bg-transparent font-mono text-xs placeholder:text-muted-foreground focus:outline-none"
            data-testid="thread-id-input"
          />
          <Button
            size="sm"
            variant="default"
            onClick={handleInputSubmit}
            className="h-5 px-2 text-[10px]"
          >
            view
          </Button>
        </div>
      )}

      {/* 三栏切换:1/2/3 + 标签 + 计数(Codex 风格文本 tab) */}
      <div
        className="flex items-center gap-1 border-b border-border px-2 py-0.5 text-xs"
        role="tablist"
        aria-label="Agent 进度栏"
      >
        {(['tasks', 'subagents', 'terminals'] as AgentProgressColumn[]).map((col) => {
          const isActive = activeColumn === col
          const count =
            col === 'tasks'
              ? planSteps.length
              : col === 'subagents'
                ? subagents.length
                : terminals.length
          return (
            <button
              key={col}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveColumn(col)}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 font-mono transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
              data-testid={`column-${col}`}
            >
              <span className="text-[10px] text-muted-foreground/60">[{COLUMN_KEY[col]}]</span>
              <span>{COLUMN_LABEL[col]}</span>
              {count > 0 && (
                <span className="text-[10px] tabular-nums text-muted-foreground/70">({count})</span>
              )}
            </button>
          )
        })}
        <span className="ml-auto text-[10px] text-muted-foreground/60">
          {formatTime(overview.sessionStart ?? undefined)}
        </span>
      </div>

      {/* 内容区:根据 activeColumn 渲染对应栏 */}
      <div ref={contentRef} className="flex-1 overflow-y-auto px-1 py-1">
        {activeColumn === 'tasks' && (
          <TasksColumn
            steps={planSteps}
            overview={overview}
            sortMode={sortMode}
            verbose={verbose}
            cursorIndex={cursorIndex}
          />
        )}
        {activeColumn === 'subagents' && (
          <SubagentsColumn
            subagents={subagents}
            showArchived={showArchived}
            verbose={verbose}
            cursorIndex={cursorIndex}
            onApprove={handleApprove}
          />
        )}
        {activeColumn === 'terminals' && (
          <TerminalsColumn
            terminals={terminals}
            isExpanded={isExpanded}
            showArchived={showArchived}
            cursorIndex={cursorIndex}
          />
        )}
      </div>

      {/* Footer:Codex 风格单行状态栏(含 g/G/space) */}
      <div className="flex items-center gap-3 border-t border-border px-2 py-0.5 text-[10px] text-muted-foreground/70">
        <span>
          <span className="text-muted-foreground">j/k</span> move
        </span>
        <span>
          <span className="text-muted-foreground">g/G</span> top/bot
        </span>
        <span>
          <span className="text-muted-foreground">space</span> pgdn
        </span>
        <span>
          <span className="text-muted-foreground">Enter</span> expand
        </span>
        <span>
          <span className="text-muted-foreground">1/2/3</span> switch
        </span>
        <span>
          <span className="text-muted-foreground">Tab</span> sort
        </span>
        <span>
          <span className="text-muted-foreground">a</span> archived
        </span>
        <span>
          <span className="text-muted-foreground">v</span> verbose
        </span>
        <span>
          <span className="text-muted-foreground">y/n</span> approve
        </span>
        <span className="ml-auto">
          <span className="text-muted-foreground">Esc</span> close
        </span>
      </div>
    </div>
  )
}

export default AgentTaskProgressPane
