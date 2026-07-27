'use client'

import * as React from 'react'
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Ban,
  Circle,
  Play,
  Square,
  Eraser,
  Bot,
  ListTodo,
  Users,
  Terminal,
  ChevronRight,
  Zap,
  Clock,
} from 'lucide-react'
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
 * AgentTaskProgressPane — Codex 风格 Agent 任务进度查看底部面板(2026-07-27 重构)
 *
 * Codex CLI TUI 架构对齐:
 * - 持久化底部面板(Bottom Pane),非右侧 Drawer
 * - 三栏分离:Tasks / Subagents / Terminals
 * - 原地更新(同位置重绘,非事件流追加)
 * - Plan 三状态(pending/in_progress/completed)+ explanation + 最多一个 in_progress 硬规则
 * - 子代理:昵称 + @handle + 彩色标签 + dead agents 可见 + inline 审批
 * - 进度可视化:spinner(in_progress)/ ✓(completed)/ 历史 bracket
 * - 折叠行为:长输出默认折叠,折叠态显示耗时
 * - 快捷键:Down 打开,Tab 切换排序,a 切换归档,v 切换 verbose
 *
 * 触发:AgentProgressTrigger 浮动按钮 / Down / Ctrl+Shift+J / 编程式 openPane(threadId)
 */

const STATUS_META: Record<
  AgentOverview['status'],
  { icon: React.ComponentType<{ className?: string }>; label: string; cls: string }
> = {
  idle: { icon: Circle, label: '空闲', cls: 'text-muted-foreground' },
  running: { icon: Loader2, label: '执行中', cls: 'text-primary' },
  completed: { icon: CheckCircle2, label: '已完成', cls: 'text-emerald-500' },
  failed: { icon: AlertCircle, label: '失败', cls: 'text-red-500' },
  interrupted: { icon: Ban, label: '已暂停', cls: 'text-amber-500' },
}

const STEP_STATUS_ICON: Record<PlanStepStatus, React.ComponentType<{ className?: string }>> = {
  pending: Circle,
  in_progress: Loader2,
  completed: CheckCircle2,
}

const STEP_STATUS_CLS: Record<PlanStepStatus, string> = {
  pending: 'text-muted-foreground',
  in_progress: 'text-primary',
  completed: 'text-emerald-500',
}

const COLUMN_META: Record<
  AgentProgressColumn,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  tasks: { label: 'Tasks', icon: ListTodo },
  subagents: { label: 'Subagents', icon: Users },
  terminals: { label: 'Terminals', icon: Terminal },
}

const SORT_LABEL: Record<AgentProgressSortMode, string> = {
  recent: '最近',
  duration: '耗时',
  status: '状态',
}

function formatDuration(ms?: number): string {
  if (ms === undefined) return ''
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${m}m ${s}s`
}

function formatTime(iso?: string): string {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

/** 计算分位数(用于历史 bracket) */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx] ?? 0
}

/** 渲染历史 bracket:[====|====│=====> ] */
function HistoryBracket({
  elapsedMs,
  historicalDurations,
}: {
  elapsedMs?: number
  historicalDurations: number[]
}) {
  // 历史数据 < 5 条:显示"无历史数据"(Codex 行为,不伪造 bracket)
  if (historicalDurations.length < 5 || elapsedMs === undefined) {
    return (
      <span
        className="text-[10px] tabular-nums text-muted-foreground/60"
        data-testid="no-history"
      >
        无历史数据
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
  // 构造 bracket 字符串
  const chars: string[] = []
  for (let i = 0; i < 10; i++) {
    if (i === pos25) chars.push('|')
    else if (i === pos50) chars.push('│')
    else if (i === elapsedPos) chars.push('>')
    else if (i < elapsedPos) chars.push('=')
    else chars.push(' ')
  }
  const bracket = `[${chars.join('')}]`
  return (
    <span
      className="font-mono text-[10px] tabular-nums text-muted-foreground"
      data-testid="history-bracket"
      title={`25th: ${formatDuration(p25)} | median: ${formatDuration(p50)} | 75th: ${formatDuration(p75)} | elapsed: ${formatDuration(elapsedMs)}`}
    >
      {bracket}
    </span>
  )
}

/** Tasks 栏:Plan 步骤列表 */
function TasksColumn({
  steps,
  overview,
  sortMode,
  verbose,
}: {
  steps: PlanStep[]
  overview: AgentOverview
  sortMode: AgentProgressSortMode
  verbose: boolean
}) {
  if (steps.length === 0) {
    return (
      <EmptyState
        icon={ListTodo}
        text="暂无计划步骤"
        hint="等待 plan_updated 或 node_start 事件"
      />
    )
  }

  const sorted = [...steps]
  if (sortMode === 'duration') {
    sorted.sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
  } else if (sortMode === 'status') {
    const order: Record<PlanStepStatus, number> = { in_progress: 0, pending: 1, completed: 2 }
    sorted.sort((a, b) => order[a.status] - order[b.status])
  }
  // recent:保持原序(事件到达顺序)

  return (
    <ol className="space-y-0.5" data-testid="tasks-list">
      {sorted.map((step, idx) => {
        const Icon = STEP_STATUS_ICON[step.status]
        const showExplanation = step.explanation && verbose
        return (
          <li
            key={step.id}
            className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40"
            data-testid="task-item"
            data-status={step.status}
          >
            <span className="mt-0.5 w-4 shrink-0 text-center text-[10px] tabular-nums text-muted-foreground/60">
              {idx + 1}
            </span>
            <Icon
              className={cn(
                'mt-0.5 h-3.5 w-3.5 shrink-0',
                STEP_STATUS_CLS[step.status],
                step.status === 'in_progress' && 'animate-spin',
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="break-words text-xs font-medium">{step.step}</div>
              {showExplanation && (
                <div className="mt-0.5 break-words text-[10px] text-muted-foreground">
                  {step.explanation}
                </div>
              )}
            </div>
            {step.status === 'in_progress' && step.durationMs !== undefined && (
              <HistoryBracket
                elapsedMs={step.durationMs}
                historicalDurations={overview.historicalDurations}
              />
            )}
            {step.status === 'completed' && step.durationMs !== undefined && (
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {formatDuration(step.durationMs)}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Subagents 栏:子代理列表(昵称 + @handle + dead agents + inline 审批) */
function SubagentsColumn({
  subagents,
  showArchived,
  verbose,
  onApprove,
}: {
  subagents: Subagent[]
  showArchived: boolean
  verbose: boolean
  onApprove: (id: string) => void
}) {
  const visible = showArchived
    ? subagents
    : subagents.filter((s) => s.status === 'running' || s.status === 'spawned')

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={Users}
        text="暂无子代理"
        hint={showArchived ? '等待 subagent_spawn 事件' : '所有子代理已归档,按 a 显示'}
      />
    )
  }

  return (
    <ul className="space-y-1" data-testid="subagents-list">
      {visible.map((sub) => {
        const colorCls = SUBAGENT_COLOR_CLASS[sub.color]
        const isDead = sub.status === 'done' || sub.status === 'failed' || sub.status === 'dead'
        const statusLabel =
          sub.status === 'running'
            ? 'running'
            : sub.status === 'spawned'
              ? 'spawned'
              : sub.status === 'done'
                ? 'done ✓'
                : sub.status === 'failed'
                  ? 'failed ✗'
                  : 'dead'
        return (
          <li
            key={sub.id}
            className="rounded-md px-2 py-1.5 hover:bg-muted/40"
            data-testid="subagent-item"
            data-status={sub.status}
          >
            <div className="flex items-center gap-2">
              {sub.status === 'running' && (
                <Loader2 className={cn('h-3 w-3 shrink-0 animate-spin', colorCls)} />
              )}
              {sub.status === 'done' && <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />}
              {sub.status === 'failed' && <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />}
              {(sub.status === 'spawned' || sub.status === 'dead') && (
                <Circle className={cn('h-3 w-3 shrink-0', colorCls)} />
              )}
              <span className={cn('shrink-0 text-xs font-semibold', colorCls)}>{sub.handle}</span>
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                [{statusLabel}]
              </span>
              {isDead && sub.durationMs !== undefined && (
                <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {formatDuration(sub.durationMs)}
                </span>
              )}
            </div>
            {(sub.currentTask || sub.role || verbose) && (
              <div className="mt-1 pl-5 text-[10px] text-muted-foreground">
                {sub.role && <span className="mr-2">role: {sub.role}</span>}
                {sub.currentTask && <span className="break-words">┆ {sub.currentTask}</span>}
                {verbose && (
                  <span className="ml-2 font-mono text-[9px] text-muted-foreground/60">
                    {sub.threadId}
                  </span>
                )}
              </div>
            )}
            {sub.pendingApproval && (
              <div
                className="mt-1.5 flex items-center gap-2 pl-5"
                data-testid="inline-approval"
              >
                <span className="text-[10px] text-amber-600">需要审批</span>
                <Button
                  size="sm"
                  variant="default"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => onApprove(sub.id)}
                  data-testid="approve-btn"
                >
                  批准
                </Button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Terminals 栏:后台终端任务 */
function TerminalsColumn({
  terminals,
  toggleExpanded,
  isExpanded,
  showArchived,
}: {
  terminals: TerminalTask[]
  toggleExpanded: (id: string) => void
  isExpanded: (id: string) => boolean
  showArchived: boolean
}) {
  const visible = showArchived
    ? terminals
    : terminals.filter((t) => t.status === 'running')

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={Terminal}
        text="暂无终端任务"
        hint={showArchived ? '等待 terminal_start 事件' : '所有终端已归档,按 a 显示'}
      />
    )
  }

  return (
    <ul className="space-y-1" data-testid="terminals-list">
      {visible.map((term) => {
        const expanded = isExpanded(term.id)
        const hasOutput = term.output && term.output.length > 0
        const isLong = hasOutput && term.output!.length > 200
        // 长输出默认折叠(Codex 行为)
        const showOutput = expanded || !isLong
        return (
          <li
            key={term.id}
            className="rounded-md px-2 py-1.5 hover:bg-muted/40"
            data-testid="terminal-item"
            data-status={term.status}
          >
            <div className="flex items-center gap-2">
              {term.status === 'running' && (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
              )}
              {term.status === 'completed' && (
                <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
              )}
              {term.status === 'failed' && (
                <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
              )}
              <code className="min-w-0 flex-1 break-words font-mono text-[11px]">
                $ {term.command}
              </code>
              {isLong && (
                <button
                  type="button"
                  onClick={() => toggleExpanded(term.id)}
                  className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  aria-label={expanded ? '折叠' : '展开'}
                  data-testid="toggle-output-btn"
                >
                  <ChevronRight
                    className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')}
                  />
                </button>
              )}
              {term.durationMs !== undefined && (
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  <Zap className="mr-0.5 inline h-2.5 w-2.5" />
                  {formatDuration(term.durationMs)}
                </span>
              )}
            </div>
            {hasOutput && showOutput && (
              <pre className="mt-1 ml-5 max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-sm bg-muted/40 p-1.5 font-mono text-[10px] leading-relaxed">
                {term.output}
              </pre>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function EmptyState({
  icon: Icon,
  text,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>
  text: string
  hint?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
      <Icon className="h-6 w-6 text-muted-foreground/40" />
      <p className="text-xs text-muted-foreground">{text}</p>
      {hint && <p className="text-[10px] text-muted-foreground/60">{hint}</p>}
    </div>
  )
}

/** 主 Bottom Pane 组件 */
export function AgentTaskProgressPane() {
  const open = useAgentProgressPaneStore((s) => s.open)
  const threadId = useAgentProgressPaneStore((s) => s.threadId)
  const activeColumn = useAgentProgressPaneStore((s) => s.activeColumn)
  const threadIdInput = useAgentProgressPaneStore((s) => s.threadIdInput)
  const verbose = useAgentProgressPaneStore((s) => s.verbose)
  const showArchived = useAgentProgressPaneStore((s) => s.showArchived)
  const sortMode = useAgentProgressPaneStore((s) => s.sortMode)
  const closePane = useAgentProgressPaneStore((s) => s.closePane)
  const setActiveColumn = useAgentProgressPaneStore((s) => s.setActiveColumn)
  const setThreadIdInput = useAgentProgressPaneStore((s) => s.setThreadIdInput)
  const submitThreadId = useAgentProgressPaneStore((s) => s.submitThreadId)
  const setThreadId = useAgentProgressPaneStore((s) => s.setThreadId)
  const toggleExpanded = useAgentProgressPaneStore((s) => s.toggleExpanded)
  const isExpanded = useAgentProgressPaneStore((s) => s.isExpanded)

  const progress = useAgentProgress(threadId)
  const { overview, planSteps, subagents, terminals, isStreaming } = progress

  const handleStart = React.useCallback(() => {
    if (threadId) {
      progress.start()
    }
  }, [threadId, progress])

  const handleStop = React.useCallback(() => {
    progress.stop()
  }, [progress])

  const handleClear = React.useCallback(() => {
    progress.clear()
    setThreadId(null)
  }, [progress, setThreadId])

  const handleInputSubmit = React.useCallback(() => {
    submitThreadId()
  }, [submitThreadId])

  const handleApprove = React.useCallback((id: string) => {
    // 审批通过:此处可对接真实审批 API,当前仅占位(避免引入新依赖)
    void id
  }, [])

  // Down 键关闭 Pane(Esc 也支持)
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closePane()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, closePane])

  if (!open) return null

  const statusMeta = STATUS_META[overview.status]
  const StatusIcon = statusMeta.icon
  const activeColumnMeta = COLUMN_META[activeColumn]
  const ActiveColumnIcon = activeColumnMeta.icon

  return (
    <div
      className={cn(
        'pointer-events-auto fixed inset-x-0 bottom-0 z-sticky',
        'mx-auto flex max-h-[60vh] w-full flex-col border-t border-border bg-card shadow-lg',
      )}
      role="region"
      aria-label="Agent 任务进度底部面板"
      data-testid="agent-progress-pane"
    >
      {/* Header:标题 + 状态 + threadId + 控制按钮 */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Bot className="h-4 w-4 shrink-0 text-primary" />
        <span className="shrink-0 text-sm font-semibold">Agent 任务进度</span>
        <StatusIcon
          className={cn('h-3.5 w-3.5 shrink-0', statusMeta.cls, overview.status === 'running' && 'animate-spin')}
          data-testid={`status-${overview.status}`}
        />
        <span className="shrink-0 text-xs text-muted-foreground">{statusMeta.label}</span>
        {threadId && (
          <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
            #{verbose ? threadId : threadId.slice(0, 8)}
          </span>
        )}
        {isStreaming && (
          <Loader2 data-testid="pane-streaming" className="h-3 w-3 shrink-0 animate-spin text-primary" />
        )}

        {/* 模式指示器 */}
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="rounded-sm bg-muted px-1.5 py-0.5" data-testid="sort-indicator">
            sort: {SORT_LABEL[sortMode]}
          </span>
          <span
            className={cn('rounded-sm px-1.5 py-0.5', verbose ? 'bg-primary/10 text-primary' : 'bg-muted')}
            data-testid="verbose-indicator"
          >
            v: {verbose ? 'on' : 'off'}
          </span>
          <span
            className={cn('rounded-sm px-1.5 py-0.5', showArchived ? 'bg-primary/10 text-primary' : 'bg-muted')}
            data-testid="archived-indicator"
          >
            a: {showArchived ? 'on' : 'off'}
          </span>
        </div>

        {threadId && (
          <div className="flex items-center gap-1">
            {isStreaming ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleStop}
                className="h-7 gap-1 px-2 text-xs"
                data-testid="stop-btn"
              >
                <Square className="h-3 w-3" />
                停止
              </Button>
            ) : (
              <Button
                size="sm"
                variant="default"
                onClick={handleStart}
                className="h-7 gap-1 px-2 text-xs"
                data-testid="start-btn"
              >
                <Play className="h-3 w-3" />
                启动
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClear}
              className="h-7 gap-1 px-2 text-xs"
              data-testid="clear-btn"
            >
              <Eraser className="h-3 w-3" />
              清空
            </Button>
          </div>
        )}
      </div>

      {/* ThreadId 输入栏(仅 threadId 未设置时显示) */}
      {!threadId && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-3 py-2">
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
            placeholder="输入 threadId 后回车开始查看..."
            className="min-w-0 flex-1 bg-transparent px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none"
            data-testid="thread-id-input"
          />
          <Button
            size="sm"
            variant="default"
            onClick={handleInputSubmit}
            className="h-7 px-2.5 text-xs"
          >
            查看
          </Button>
        </div>
      )}

      {/* 三栏切换:Tasks / Subagents / Terminals */}
      <div
        className="flex items-center gap-1 border-b border-border px-3 py-1.5"
        role="tablist"
        aria-label="Agent 进度栏"
      >
        {(['tasks', 'subagents', 'terminals'] as AgentProgressColumn[]).map((col) => {
          const meta = COLUMN_META[col]
          const Icon = meta.icon
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
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
              data-testid={`column-${col}`}
            >
              <Icon className="h-3 w-3" />
              {meta.label}
              {count > 0 && (
                <span
                  className={cn(
                    'rounded-sm px-1 text-[10px] tabular-nums',
                    isActive ? 'bg-primary/20' : 'bg-muted',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
        <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/60">
          <Clock className="h-2.5 w-2.5" />
          {overview.sessionStart ? formatTime(overview.sessionStart) : '--:--:--'}
        </div>
      </div>

      {/* 内容区:根据 activeColumn 渲染对应栏 */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {activeColumn === 'tasks' && (
          <TasksColumn
            steps={planSteps}
            overview={overview}
            sortMode={sortMode}
            verbose={verbose}
          />
        )}
        {activeColumn === 'subagents' && (
          <SubagentsColumn
            subagents={subagents}
            showArchived={showArchived}
            verbose={verbose}
            onApprove={handleApprove}
          />
        )}
        {activeColumn === 'terminals' && (
          <TerminalsColumn
            terminals={terminals}
            toggleExpanded={toggleExpanded}
            isExpanded={isExpanded}
            showArchived={showArchived}
          />
        )}
      </div>

      {/* Footer:快捷键提示 */}
      <div className="flex items-center gap-3 border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground/70">
        <span>
          <kbd className="rounded-sm bg-muted px-1">↓</kbd> 打开
        </span>
        <span>
          <kbd className="rounded-sm bg-muted px-1">Tab</kbd> 切换排序
        </span>
        <span>
          <kbd className="rounded-sm bg-muted px-1">a</kbd> 归档
        </span>
        <span>
          <kbd className="rounded-sm bg-muted px-1">v</kbd> verbose
        </span>
        <span>
          <kbd className="rounded-sm bg-muted px-1">Ctrl+Shift+J</kbd> 切换
        </span>
        <span className="ml-auto">
          <ActiveColumnIcon className="mr-1 inline h-2.5 w-2.5" />
          {activeColumnMeta.label}
        </span>
      </div>
    </div>
  )
}

export default AgentTaskProgressPane
