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
 * AgentTaskProgressPane — Codex CLI TUI 风格 Agent 任务进度底部面板(2026-07-27 v3)
 *
 * Codex 一致性对齐(v3 强化):
 * - Header:进度百分比 + 任务计时 + currentNode + cursor 位置
 * - cursor ▶ 闪烁动画(Codex 标准)
 * - Subagent:token 消耗 + tool 调用次数 + 死亡原因
 * - Terminal:exit code 显示
 * - / 搜索过滤当前栏 + ? 帮助面板 + q 关闭
 * - 面板高度可 drag resize(200-720px)
 * - 切栏 cursor 智能保持(不重置 0)
 * - 真正循环 braille spinner(8 帧 120ms)
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

// Codex 真正循环 braille spinner(10 帧 120ms)
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

function formatTokenCount(n?: number): string {
  if (n === undefined || n === 0) return ''
  if (n < 1000) return `${n}t`
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
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

// ─── Cursor 高亮行前缀(闪烁 ▶,搜索模式时隐藏) ───────────────────
function CursorPrefix({ active, hidden }: { active: boolean; hidden?: boolean }) {
  const [visible, setVisible] = React.useState(true)
  React.useEffect(() => {
    if (!active || hidden) return
    const id = window.setInterval(() => {
      setVisible((v) => !v)
    }, 600)
    return () => window.clearInterval(id)
  }, [active, hidden])
  if (hidden) {
    return <span className="shrink-0 text-transparent"> </span>
  }
  return (
    <span className={cn('shrink-0', active ? 'text-primary' : 'text-transparent')}>
      {active ? (visible ? '▶' : ' ') : ' '}
    </span>
  )
}

// ─── 搜索高亮文本(匹配部分用 <mark> 包裹) ─────────────────────────
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const parts: React.ReactNode[] = []
  let cursor = 0
  let key = 0
  while (cursor < text.length) {
    const idx = lowerText.indexOf(lowerQuery, cursor)
    if (idx === -1) {
      parts.push(text.slice(cursor))
      break
    }
    if (idx > cursor) parts.push(text.slice(cursor, idx))
    parts.push(
      <mark key={key++} className="bg-yellow-300/60 px-0 rounded-sm">
        {text.slice(idx, idx + query.length)}
      </mark>,
    )
    cursor = idx + query.length
  }
  return <>{parts}</>
}

// ─── 搜索过滤工具 ────────────────────────────────────────────────────
function matchesQuery(text: string, query: string): boolean {
  if (!query) return true
  return text.toLowerCase().includes(query.toLowerCase())
}

// ─── ANSI 颜色码解析(终端输出彩色渲染) ─────────────────────────────
// 支持:\x1b[0m reset / \x1b[1m bold / \x1b[3x/4x/9x 颜色码
const ANSI_COLOR_MAP: Record<number, string> = {
  30: '#000000', 31: '#cc0000', 32: '#4e9a06', 33: '#c4a000',
  34: '#3465a4', 35: '#75507b', 36: '#06989a', 37: '#d3d7cf',
  90: '#555753', 91: '#ef2929', 92: '#8ae234', 93: '#fce94f',
  94: '#729fcf', 95: '#ad7fa8', 96: '#34e2e2', 97: '#eeeeec',
}

interface AnsiSegment {
  text: string
  color?: string
  bg?: string
  bold?: boolean
}

function parseAnsi(input: string): AnsiSegment[] {
  if (!input.includes('\x1b[')) return [{ text: input }]
  const segments: AnsiSegment[] = []
  let current: AnsiSegment = { text: '' }
  const regex = /\x1b\[([\d;]*)m/g
  let lastIdx = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(input)) !== null) {
    // push pending text
    if (match.index > lastIdx) {
      segments.push({ ...current, text: input.slice(lastIdx, match.index) })
    }
    const codes = match[1] ? match[1].split(';').map((n) => parseInt(n, 10)) : [0]
    for (const code of codes) {
      if (code === 0) {
        current = { text: '' }
      } else if (code === 1) {
        current.bold = true
      } else if (ANSI_COLOR_MAP[code]) {
        current.color = ANSI_COLOR_MAP[code]
      } else if (code >= 40 && code <= 47) {
        current.bg = ANSI_COLOR_MAP[code - 10]
      } else if (code >= 100 && code <= 107) {
        current.bg = ANSI_COLOR_MAP[code - 10]
      }
    }
    lastIdx = regex.lastIndex
  }
  if (lastIdx < input.length) {
    segments.push({ ...current, text: input.slice(lastIdx) })
  }
  return segments.filter((s) => s.text.length > 0)
}

function AnsiText({ text }: { text: string }) {
  const segments = React.useMemo(() => parseAnsi(text), [text])
  if (segments.length === 1 && !segments[0]?.color && !segments[0]?.bg && !segments[0]?.bold) {
    return <>{segments[0]?.text}</>
  }
  return (
    <>
      {segments.map((seg, i) => (
        <span
          key={i}
          style={{
            color: seg.color,
            backgroundColor: seg.bg,
            fontWeight: seg.bold ? 'bold' : undefined,
          }}
        >
          {seg.text}
        </span>
      ))}
    </>
  )
}

// ─── Tasks 栏 ────────────────────────────────────────────────────────
function TasksColumn({
  steps,
  overview,
  sortMode,
  verbose,
  cursorIndex,
  searchQuery,
  searchMode,
  onSelectCursor,
}: {
  steps: PlanStep[]
  overview: AgentOverview
  sortMode: AgentProgressSortMode
  verbose: boolean
  cursorIndex: number
  searchQuery: string
  searchMode: boolean
  onSelectCursor: (idx: number) => void
}) {
  // 先搜索过滤,再排序
  const filtered = searchQuery
    ? steps.filter((s) => matchesQuery(s.step, searchQuery) || matchesQuery(s.explanation ?? '', searchQuery))
    : steps

  if (filtered.length === 0) {
    return (
      <EmptyState
        text={searchQuery ? 'no matches' : 'no plan steps'}
        hint={searchQuery ? `press Esc to clear "/${searchQuery}"` : 'waiting for plan_updated / node_start'}
      />
    )
  }

  const sorted = [...filtered]
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
              'cursor-pointer px-1 py-0.5 transition-colors hover:bg-accent/30',
              isCursor && 'bg-primary/20 border-l-2 border-primary',
            )}
            onClick={() => onSelectCursor(idx)}
            data-testid="task-item"
            data-status={step.status}
            data-cursor={isCursor}
          >
            <div className="flex items-start gap-1.5">
              <CursorPrefix active={isCursor} hidden={searchMode} />
              <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground/60">
                {idx + 1}.
              </span>
              <StatusGlyph
                status={step.status === 'in_progress' ? 'in_progress' : 'static'}
                char={STEP_CHAR[step.status]}
                className={cn('w-3 shrink-0 text-center', STEP_CLS[step.status])}
              />
              <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">
                <HighlightText text={step.step} query={searchQuery} />
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
              {step.tokenUsage !== undefined && step.tokenUsage > 0 && (
                <span className="shrink-0 tabular-nums text-muted-foreground/70">
                  {formatTokenCount(step.tokenUsage)}
                </span>
              )}
            </div>
            {/* explanation 默认显示在 step 下方缩进 */}
            {step.explanation && (isCursor || verbose) && (
              <div className="mt-0.5 pl-9 text-muted-foreground/80 break-words whitespace-pre-wrap">
                └ <HighlightText text={step.explanation} query={searchQuery} />
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
  searchQuery,
  searchMode,
  onSelectCursor,
  onToggleExpand,
  onApprove,
}: {
  subagents: Subagent[]
  showArchived: boolean
  verbose: boolean
  cursorIndex: number
  searchQuery: string
  searchMode: boolean
  onSelectCursor: (idx: number) => void
  onToggleExpand: (id: string) => void
  onApprove: (id: string, approve: boolean) => void
}) {
  const archived = showArchived
    ? subagents
    : subagents.filter((s) => s.status === 'running' || s.status === 'spawned')

  const filtered = searchQuery
    ? archived.filter(
        (s) =>
          matchesQuery(s.handle, searchQuery) ||
          matchesQuery(s.nickname, searchQuery) ||
          matchesQuery(s.currentTask ?? '', searchQuery) ||
          matchesQuery(s.role ?? '', searchQuery),
      )
    : archived

  if (filtered.length === 0) {
    return (
      <EmptyState
        text={searchQuery ? 'no matches' : 'no subagents'}
        hint={
          searchQuery
            ? `press Esc to clear "/${searchQuery}"`
            : showArchived
              ? 'waiting for subagent_spawn'
              : 'all archived, press a to show'
        }
      />
    )
  }

  return (
    <div className="font-mono text-xs leading-tight" data-testid="subagents-list">
      {filtered.map((sub, idx) => {
        const isCursor = idx === cursorIndex
        const colorCls = SUBAGENT_COLOR_CLASS[sub.color]
        // dead agents(done/failed/dead)变灰 + 删除线,running 保留彩色
        const isDead = sub.status === 'done' || sub.status === 'failed' || sub.status === 'dead'
        const deadCls = isDead ? 'opacity-50 line-through' : ''
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
              'cursor-pointer px-1 py-0.5 transition-colors hover:bg-accent/30',
              isCursor && 'bg-primary/20 border-l-2 border-primary',
              deadCls,
            )}
            onClick={() => onSelectCursor(idx)}
            onDoubleClick={() => onToggleExpand(sub.id)}
            data-testid="subagent-item"
            data-status={sub.status}
            data-cursor={isCursor}
          >
            <div className="flex items-center gap-1.5">
              <CursorPrefix active={isCursor} hidden={searchMode} />
              <StatusGlyph
                status={sub.status === 'running' ? 'running' : 'static'}
                char={sub.status === 'done' ? '✓' : sub.status === 'failed' ? '✗' : '•'}
                className={cn('w-3 shrink-0 text-center', statusCls)}
              />
              <span className={cn('shrink-0 font-semibold', colorCls)}>
                <HighlightText text={sub.handle} query={searchQuery} />
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground/70">
                [{sub.status}]
              </span>
              {sub.toolCalls !== undefined && sub.toolCalls > 0 && (
                <span className="shrink-0 tabular-nums text-muted-foreground/60">
                  🛠{sub.toolCalls}
                </span>
              )}
              {sub.tokenUsage !== undefined && sub.tokenUsage > 0 && (
                <span className="shrink-0 tabular-nums text-muted-foreground/60">
                  {formatTokenCount(sub.tokenUsage)}
                </span>
              )}
              {sub.durationMs !== undefined && (
                <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                  {formatDuration(sub.durationMs)}
                </span>
              )}
            </div>
            {/* running 默认显示 currentTask;非 running 仅 cursor/verbose 显示 */}
            {(sub.status === 'running' || isCursor || verbose) && (sub.currentTask || sub.role) && (
              <div className="pl-7 text-muted-foreground break-words whitespace-pre-wrap">
                {sub.role && <span className="mr-2">role:{sub.role}</span>}
                {sub.currentTask && (
                  <span>┆ <HighlightText text={sub.currentTask} query={searchQuery} /></span>
                )}
                {verbose && (
                  <span className="ml-2 text-[10px] text-muted-foreground/50">{sub.threadId}</span>
                )}
              </div>
            )}
            {/* 死亡原因显示在 currentTask 下方 */}
            {isDead && sub.failureReason && (isCursor || verbose) && (
              <div className="pl-7 text-red-500/80 break-words whitespace-pre-wrap">
                ✗ {sub.failureReason}
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
  searchQuery,
  searchMode,
  onSelectCursor,
  onToggleExpand,
}: {
  terminals: TerminalTask[]
  isExpanded: (id: string) => boolean
  showArchived: boolean
  cursorIndex: number
  searchQuery: string
  searchMode: boolean
  onSelectCursor: (idx: number) => void
  onToggleExpand: (id: string) => void
}) {
  const archived = showArchived ? terminals : terminals.filter((t) => t.status === 'running')
  const filtered = searchQuery
    ? archived.filter(
        (t) => matchesQuery(t.command, searchQuery) || matchesQuery(t.output ?? '', searchQuery),
      )
    : archived

  if (filtered.length === 0) {
    return (
      <EmptyState
        text={searchQuery ? 'no matches' : 'no terminals'}
        hint={
          searchQuery
            ? `press Esc to clear "/${searchQuery}"`
            : showArchived
              ? 'waiting for terminal_start'
              : 'all archived, press a to show'
        }
      />
    )
  }

  return (
    <div className="font-mono text-xs leading-tight" data-testid="terminals-list">
      {filtered.map((term, idx) => {
        const isCursor = idx === cursorIndex
        const expanded = isExpanded(term.id)
        const isLong = term.output && term.output.length > 200
        const statusCls =
          term.status === 'running'
            ? 'text-primary'
            : term.status === 'completed'
              ? 'text-emerald-500'
              : 'text-red-500'
        // 折叠态显示最后 2-3 行输出预览,展开态显示全部
        const outputLines = term.output ? term.output.split('\n') : []
        const previewLines = outputLines.slice(-3)
        const showFull = expanded || !isLong
        return (
          <div
            key={term.id}
            className={cn(
              'cursor-pointer px-1 py-0.5 transition-colors hover:bg-accent/30',
              isCursor && 'bg-primary/20 border-l-2 border-primary',
            )}
            onClick={() => onSelectCursor(idx)}
            onDoubleClick={() => onToggleExpand(term.id)}
            data-testid="terminal-item"
            data-status={term.status}
            data-cursor={isCursor}
          >
            <div className="flex items-center gap-1.5">
              <CursorPrefix active={isCursor} hidden={searchMode} />
              <StatusGlyph
                status={term.status === 'running' ? 'running' : 'static'}
                char={term.status === 'completed' ? '✓' : '✗'}
                className={cn('w-3 shrink-0 text-center', statusCls)}
              />
              <span className="shrink-0 text-muted-foreground">$</span>
              <code className="min-w-0 flex-1 break-all">
                <HighlightText text={term.command} query={searchQuery} />
              </code>
              {/* 退出码显示 */}
              {term.exitCode !== undefined && term.status !== 'running' && (
                <span
                  className={cn(
                    'shrink-0 tabular-nums',
                    term.exitCode === 0 ? 'text-emerald-500/70' : 'text-red-500/80',
                  )}
                  title={`exit code: ${term.exitCode}`}
                >
                  ⟨{term.exitCode}⟩
                </span>
              )}
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
            {/* 展开态显示全部输出(ANSI 彩色解析),折叠态显示最后 3 行预览 */}
            {showFull && term.output && (
              <pre className="mt-0.5 ml-7 max-h-24 overflow-y-auto whitespace-pre-wrap break-all bg-muted/30 p-1 text-[10px] leading-relaxed">
                <AnsiText text={term.output} />
              </pre>
            )}
            {!showFull && previewLines.length > 0 && (
              <pre className="mt-0.5 ml-7 whitespace-pre-wrap break-all text-[10px] leading-relaxed text-muted-foreground/60">
                <AnsiText text={previewLines.join('\n')} />
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

// ─── 搜索栏(/ 触发,带匹配数量) ────────────────────────────────────
function SearchBar({
  query,
  matchCount,
  totalCount,
  onQueryChange,
  onExit,
}: {
  query: string
  matchCount: number
  totalCount: number
  onQueryChange: (q: string) => void
  onExit: () => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])
  return (
    <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-2 py-1">
      <span className="text-primary">/</span>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || e.key === 'Enter') {
            e.preventDefault()
            onExit()
          }
        }}
        placeholder="filter current column..."
        className="min-w-0 flex-1 bg-transparent font-mono text-xs placeholder:text-muted-foreground focus:outline-none"
        data-testid="search-input"
      />
      {query && (
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70" data-testid="search-match-count">
          {matchCount}/{totalCount}
        </span>
      )}
      <span className="shrink-0 text-[10px] text-muted-foreground/60">Esc to clear</span>
    </div>
  )
}

// ─── 帮助面板(? 触发) ──────────────────────────────────────────────
function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 模态遮罩点击外部关闭;键盘用户通过关闭按钮(✕)提供等价交互
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      data-testid="help-panel"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 阻止点击冒泡到遮罩层(避免误关闭);键盘用户通过关闭按钮关闭 */}
      <div
        className="mx-4 max-h-[80%] max-w-md overflow-y-auto rounded-md border border-border bg-card p-4 font-mono text-xs shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="font-semibold text-primary">Codex Shortcuts</span>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="close help"
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
          <div><span className="text-foreground">↓</span> open pane</div>
          <div><span className="text-foreground">Esc / q</span> close</div>
          <div><span className="text-foreground">j/k</span> move cursor</div>
          <div><span className="text-foreground">g/G</span> top/bottom</div>
          <div><span className="text-foreground">space</span> page down</div>
          <div><span className="text-foreground">Enter</span> expand</div>
          <div><span className="text-foreground">1/2/3</span> switch column</div>
          <div><span className="text-foreground">Tab</span> cycle sort</div>
          <div><span className="text-foreground">a</span> toggle archived</div>
          <div><span className="text-foreground">v</span> toggle verbose</div>
          <div><span className="text-foreground">y/n</span> approve/reject</div>
          <div><span className="text-foreground">/</span> search</div>
          <div><span className="text-foreground">?</span> this help</div>
          <div><span className="text-foreground">Ctrl+Shift+J</span> toggle pane</div>
        </div>
      </div>
    </div>
  )
}

// ─── 高度调节手柄(drag resize + 双击重置) ──────────────────────────
function ResizeHandle({
  height,
  onHeightChange,
  onReset,
}: {
  height: number
  onHeightChange: (h: number) => void
  onReset: () => void
}) {
  const draggingRef = React.useRef(false)
  const startYRef = React.useRef(0)
  const startHeightRef = React.useRef(0)

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      const delta = startYRef.current - e.clientY
      onHeightChange(startHeightRef.current + delta)
    }
    const onUp = () => {
      draggingRef.current = false
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [onHeightChange])

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- 拖拽调整面板高度的 resize handle(鼠标专属交互,无法用键盘拖拽);role=separator 提供语义
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="resize panel height (double-click to reset)"
      onMouseDown={(e) => {
        e.preventDefault()
        draggingRef.current = true
        startYRef.current = e.clientY
        startHeightRef.current = height
        document.body.style.cursor = 'ns-resize'
      }}
      onDoubleClick={(e) => {
        e.preventDefault()
        onReset()
      }}
      className="flex h-1 cursor-ns-resize items-center justify-center border-t border-border bg-transparent hover:bg-primary/10"
      data-testid="resize-handle"
      title="drag to resize, double-click to reset"
    >
      <span className="h-0.5 w-10 rounded bg-muted-foreground/30" />
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
  const searchQuery = useAgentProgressPaneStore((s) => s.searchQuery)
  const searchMode = useAgentProgressPaneStore((s) => s.searchMode)
  const showHelp = useAgentProgressPaneStore((s) => s.showHelp)
  const paneHeight = useAgentProgressPaneStore((s) => s.paneHeight)
  const closePane = useAgentProgressPaneStore((s) => s.closePane)
  const setActiveColumn = useAgentProgressPaneStore((s) => s.setActiveColumn)
  const setThreadIdInput = useAgentProgressPaneStore((s) => s.setThreadIdInput)
  const submitThreadId = useAgentProgressPaneStore((s) => s.submitThreadId)
  const setThreadId = useAgentProgressPaneStore((s) => s.setThreadId)
  const toggleExpanded = useAgentProgressPaneStore((s) => s.toggleExpanded)
  const isExpanded = useAgentProgressPaneStore((s) => s.isExpanded)
  const moveCursor = useAgentProgressPaneStore((s) => s.moveCursor)
  const enterSearch = useAgentProgressPaneStore((s) => s.enterSearch)
  const exitSearch = useAgentProgressPaneStore((s) => s.exitSearch)
  const setSearchQuery = useAgentProgressPaneStore((s) => s.setSearchQuery)
  const toggleHelp = useAgentProgressPaneStore((s) => s.toggleHelp)
  const setPaneHeight = useAgentProgressPaneStore((s) => s.setPaneHeight)

  const progress = useAgentProgress(threadId)
  const { overview, planSteps, subagents, terminals, isStreaming } = progress

  // 各栏可见条目数(用于 cursor clamp + 切栏智能保持)
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

  // 全局快捷键:Esc/q 关闭 + j/k/Enter/y/n/g/G/space/?/q (Codex 数据上下文快捷键)
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      // 搜索模式下只处理 Esc/Enter(由 SearchBar 自身处理)
      if (useAgentProgressPaneStore.getState().searchMode) return
      // 帮助面板打开时,任意键关闭
      if (useAgentProgressPaneStore.getState().showHelp) {
        e.preventDefault()
        toggleHelp()
        return
      }
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
      // q:关闭面板(Codex 标准)
      if (key === 'q' && !ctrl && !shift && !alt) {
        e.preventDefault()
        closePane()
        return
      }
      // ?:切换帮助面板
      if (e.key === '?' && !ctrl && !shift && !alt) {
        e.preventDefault()
        toggleHelp()
        return
      }
      // /:进入搜索模式
      if (key === '/' && !ctrl && !shift && !alt) {
        e.preventDefault()
        enterSearch()
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
  }, [open, closePane, moveCursor, visibleCount, cursorId, cursorSubagent, activeColumn, toggleExpanded, handleApprove, enterSearch, toggleHelp])

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

  // 任务计时:从 sessionStart 累计
  const [elapsedSec, setElapsedSec] = React.useState(0)
  React.useEffect(() => {
    if (!open || !overview.sessionStart) {
      setElapsedSec(0)
      return
    }
    const startMs = Date.parse(overview.sessionStart)
    if (Number.isNaN(startMs)) return
    const tick = () => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - startMs) / 1000)))
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [open, overview.sessionStart])

  // 切栏时传入新栏 count,触发智能 cursor clamp
  const handleColumnSwitch = React.useCallback(
    (col: AgentProgressColumn) => {
      const count =
        col === 'tasks'
          ? planSteps.length
          : col === 'subagents'
            ? showArchived
              ? subagents.length
              : subagents.filter((s) => s.status === 'running' || s.status === 'spawned').length
            : showArchived
              ? terminals.length
              : terminals.filter((t) => t.status === 'running').length
      setActiveColumn(col, count)
    },
    [planSteps, subagents, terminals, showArchived, setActiveColumn],
  )

  if (!open) return null

  const statusCls = STATUS_CLS[overview.status]
  const isRunning = overview.status === 'running'
  const totalSteps = overview.totalSteps
  const completedSteps = overview.completedSteps
  const progressPct =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
  // 任务计时格式:mm:ss 或 hh:mm:ss
  const elapsedDisplay =
    elapsedSec >= 3600
      ? `${Math.floor(elapsedSec / 3600)}h${String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, '0')}m`
      : `${Math.floor(elapsedSec / 60)}m${String(elapsedSec % 60).padStart(2, '0')}s`

  return (
    <div
      className={cn(
        'pointer-events-auto fixed inset-x-0 bottom-0 z-sticky',
        'mx-auto flex w-full flex-col border-t border-border bg-card font-mono',
      )}
      style={{ height: `${paneHeight}px`, maxHeight: '90vh' }}
      role="region"
      aria-label="Agent 任务进度底部面板"
      data-testid="agent-progress-pane"
    >
      {/* Resize 手柄(drag 调节面板高度) */}
      <ResizeHandle height={paneHeight} onHeightChange={setPaneHeight} />

      {/* Header:单行紧凑状态(Codex 风格)+ currentNode + 进度百分比 + 任务计时 */}
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
        {/* Codex:进度百分比 + 任务计时 */}
        {totalSteps > 0 && (
          <span
            className="shrink-0 tabular-nums text-muted-foreground/80"
            data-testid="progress-indicator"
          >
            {completedSteps}/{totalSteps} ({progressPct}%)
          </span>
        )}
        {overview.sessionStart && (
          <span
            className="shrink-0 tabular-nums text-muted-foreground/70"
            data-testid="elapsed-indicator"
          >
            ⏱{elapsedDisplay}
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
          <span data-testid="cursor-indicator">
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

      {/* 搜索栏(/ 触发) */}
      {searchMode && (
        <SearchBar query={searchQuery} onQueryChange={setSearchQuery} onExit={exitSearch} />
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
              onClick={() => handleColumnSwitch(col)}
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
            searchQuery={searchQuery}
          />
        )}
        {activeColumn === 'subagents' && (
          <SubagentsColumn
            subagents={subagents}
            showArchived={showArchived}
            verbose={verbose}
            cursorIndex={cursorIndex}
            searchQuery={searchQuery}
            onApprove={handleApprove}
          />
        )}
        {activeColumn === 'terminals' && (
          <TerminalsColumn
            terminals={terminals}
            isExpanded={isExpanded}
            showArchived={showArchived}
            cursorIndex={cursorIndex}
            searchQuery={searchQuery}
          />
        )}
      </div>

      {/* Footer:Codex 风格单行状态栏(含 g/G/space/?//) */}
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
        <span>
          <span className="text-muted-foreground">/</span> search
        </span>
        <span>
          <span className="text-muted-foreground">?</span> help
        </span>
        <span>
          <span className="text-muted-foreground">q</span> quit
        </span>
        <span className="ml-auto">
          <span className="text-muted-foreground">Esc</span> close
        </span>
      </div>

      {/* 帮助面板(? 触发,覆盖整个 pane) */}
      {showHelp && <HelpPanel onClose={toggleHelp} />}
    </div>
  )
}

export default AgentTaskProgressPane
