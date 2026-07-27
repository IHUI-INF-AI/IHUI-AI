'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAgentProgressPaneStore } from '@/stores/agent-progress-pane'
import { useAgentProgress } from '@/hooks/use-agent-progress'
import type { SSEEvent } from '@ihui/types'
import type {
  AgentOverview,
  PlanStep,
  PlanStepStatus,
  Subagent,
  TerminalTask,
} from '@/hooks/use-agent-progress'
import { SUBAGENT_COLOR_CLASS } from '@/hooks/use-agent-progress'

/**
 * AgentTaskProgressPane — Codex CLI 流式事件日志风格(2026-07-27 v4 重构)
 *
 * Codex 真实样式对齐(基于 codex issue #4751 TUI 样本):
 * - 单栏流式事件日志(非三栏 TUI 数据浏览器)
 * - 事件按时间顺序追加,自动滚到底部
 * - 简洁事件项:`• <event-type> <summary>` + 可展开 ` └ <details>`
 * - 当前运行项:spinner `⠏ <running-task>`
 * - plan 用 □/✔ 嵌入流中(Updated Plan 事件)
 * - 关闭按钮 ✕ 可见(右上角,不依赖快捷键)
 * - 默认紧凑高度 240px(不占地方),可 drag resize [160, 600]
 *
 * 快捷键:Esc 关闭 / v 切换 verbose / Enter 展开 hover 项
 */

// ─── Codex 文本字符图标 ───────────────────────────────────────────────
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

const PLAN_CHAR: Record<PlanStepStatus, string> = {
  pending: '□',
  in_progress: '⠋',
  completed: '✔',
}
const PLAN_CLS: Record<PlanStepStatus, string> = {
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

// ─── 辅助函数 ────────────────────────────────────────────────────────
function formatDuration(ms?: number): string {
  if (ms === undefined) return ''
  if (ms < 1000) return ''
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`
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

// ─── ANSI 颜色码解析(终端输出彩色渲染) ─────────────────────────────
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

// ─── 流式事件项类型 ──────────────────────────────────────────────────
type EventKind =
  | 'plan'          // • Updated Plan + 步骤列表
  | 'node'          // • Exploring / • Planning / • Deciding
  | 'tool'          // • Calling <tool> / • Ran <tool>
  | 'subagent'      // • @nickname spawned / • @nickname ended
  | 'terminal'      // • Running <cmd> / • Ran <cmd>
  | 'thinking'      // • <thinking text>
  | 'interrupt'     // ⏸ Waiting for approval
  | 'error'         // • Error: <msg>
  | 'done'          // • Done
  | 'session'       // • Session started

interface FlowEvent {
  id: string
  kind: EventKind
  title: string
  timestamp: string
  /** 详情行(缩进显示) */
  details?: string[]
  /** plan 步骤(plan 类型专用) */
  planSteps?: PlanStep[]
  /** 子代理信息(subagent 类型专用) */
  subagent?: Subagent
  /** 终端信息(terminal 类型专用) */
  terminal?: TerminalTask
  /** 是否当前运行中(spinner) */
  running?: boolean
  /** 状态样式类 */
  cls?: string
}

/** 从 SSE 事件流构建 FlowEvent 列表 */
function buildFlowEvents(
  events: SSEEvent[],
  planSteps: PlanStep[],
  subagents: Subagent[],
  terminals: TerminalTask[],
  overview: AgentOverview,
): FlowEvent[] {
  const flow: FlowEvent[] = []
  const seenPlanSnapshot = new Set<string>()

  for (const evt of events) {
    const id = `evt-${evt.timestamp}-${evt.type}`
    const ts = evt.timestamp

    switch (evt.type as string) {
      case 'session': {
        flow.push({ id, kind: 'session', title: 'Session started', timestamp: ts })
        break
      }
      case 'plan':
      case 'plan_updated': {
        // Codex:每次 plan 更新都显示为 "• Updated Plan" 事件,详情为当前 plan 步骤
        const snapshotKey = JSON.stringify(planSteps.map((s) => `${s.id}:${s.status}`))
        if (seenPlanSnapshot.has(snapshotKey)) break
        seenPlanSnapshot.add(snapshotKey)
        flow.push({
          id,
          kind: 'plan',
          title: 'Updated Plan',
          timestamp: ts,
          planSteps,
        })
        break
      }
      case 'node_start': {
        const nodeId = evt.nodeId ?? 'Working'
        flow.push({
          id,
          kind: 'node',
          title: nodeId,
          timestamp: ts,
          running: false, // 已完成的 node_start(历史)
        })
        break
      }
      case 'tool_call': {
        const data = evt.data as { name?: string; toolName?: string; args?: Record<string, unknown> } | undefined
        const toolName = data?.toolName ?? data?.name ?? 'tool'
        const fileArg = data?.args?.path ?? data?.args?.file_path ?? data?.args?.filePath
        const summary = fileArg ? `${toolName} ${fileArg}` : toolName
        flow.push({
          id,
          kind: 'tool',
          title: `Calling ${summary}`,
          timestamp: ts,
          running: true,
        })
        break
      }
      case 'tool_result': {
        const data = evt.data as { name?: string; toolName?: string; error?: string; result?: unknown } | undefined
        const toolName = data?.toolName ?? data?.name ?? 'tool'
        const errMsg = data?.error
        flow.push({
          id,
          kind: 'tool',
          title: errMsg ? `Ran ${toolName} (failed)` : `Ran ${toolName}`,
          timestamp: ts,
          cls: errMsg ? 'text-red-500' : undefined,
          details: errMsg ? [errMsg] : undefined,
        })
        break
      }
      case 'subagent_spawn': {
        const data = evt.data as { threadId?: string; id?: string; role?: string; task?: string; nickname?: string } | undefined
        const sid = data?.id ?? data?.threadId ?? id
        const sub = subagents.find((s) => s.id === sid)
        if (sub) {
          flow.push({
            id,
            kind: 'subagent',
            title: `${sub.handle} spawned${sub.role ? ` (${sub.role})` : ''}`,
            timestamp: ts,
            subagent: sub,
            details: sub.currentTask ? [sub.currentTask] : undefined,
          })
        }
        break
      }
      case 'subagent_end': {
        const data = evt.data as { id?: string; threadId?: string; status?: string; error?: string } | undefined
        const sid = data?.id ?? data?.threadId ?? ''
        const sub = subagents.find((s) => s.id === sid)
        if (sub) {
          const isFail = data?.status === 'failed' || !!data?.error
          flow.push({
            id,
            kind: 'subagent',
            title: `${sub.handle} ${data?.status ?? 'done'}${isFail ? ' — ' + (data?.error ?? '') : ''}`,
            timestamp: ts,
            subagent: sub,
            cls: isFail ? 'text-red-500' : 'text-muted-foreground',
          })
        }
        break
      }
      case 'terminal_start': {
        const data = evt.data as { id?: string; command?: string } | undefined
        const tid = data?.id ?? id
        const term = terminals.find((t) => t.id === tid)
        const cmd = term?.command ?? data?.command ?? 'command'
        flow.push({
          id,
          kind: 'terminal',
          title: `Running ${cmd}`,
          timestamp: ts,
          terminal: term,
          running: true,
        })
        break
      }
      case 'terminal_end': {
        const data = evt.data as { id?: string; exitCode?: number } | undefined
        const tid = data?.id ?? ''
        const term = terminals.find((t) => t.id === tid)
        const code = data?.exitCode ?? term?.exitCode
        const isFail = code !== undefined && code !== 0
        flow.push({
          id,
          kind: 'terminal',
          title: `Ran ${term?.command ?? 'command'} (exit ${code ?? 0})`,
          timestamp: ts,
          terminal: term,
          cls: isFail ? 'text-red-500' : 'text-muted-foreground',
          details: term?.output ? [term.output] : undefined,
        })
        break
      }
      case 'interrupt': {
        flow.push({
          id,
          kind: 'interrupt',
          title: 'Waiting for approval',
          timestamp: ts,
          cls: 'text-amber-500',
        })
        break
      }
      case 'error': {
        const msg = String(evt.data ?? '未知错误')
        flow.push({
          id,
          kind: 'error',
          title: `Error: ${msg}`,
          timestamp: ts,
          cls: 'text-red-500',
        })
        break
      }
      case 'done': {
        flow.push({
          id,
          kind: 'done',
          title: `Done${overview.error ? '' : ''}`,
          timestamp: ts,
          cls: 'text-emerald-500',
        })
        break
      }
      default:
        // token / state_update / custom 等不显示在事件流
        break
    }
  }

  // 追加当前运行中的项(spinner,非历史事件)
  if (overview.status === 'running') {
    // 优先级:running terminal > running subagent > currentNode
    const runningTerm = terminals.find((t) => t.status === 'running')
    if (runningTerm) {
      flow.push({
        id: 'live-terminal',
        kind: 'terminal',
        title: `Running ${runningTerm.command}`,
        timestamp: new Date().toISOString(),
        terminal: runningTerm,
        running: true,
        details: runningTerm.output ? [runningTerm.output] : undefined,
      })
    }
    const runningSub = subagents.find((s) => s.status === 'running' || s.status === 'spawned')
    if (runningSub) {
      flow.push({
        id: 'live-subagent',
        kind: 'subagent',
        title: `${runningSub.handle} ${runningSub.currentTask ?? 'working'}`,
        timestamp: new Date().toISOString(),
        subagent: runningSub,
        running: true,
        details: runningSub.currentTask ? [runningSub.currentTask] : undefined,
      })
    }
    if (overview.currentNode && !runningTerm && !runningSub) {
      flow.push({
        id: 'live-node',
        kind: 'node',
        title: overview.currentNode,
        timestamp: new Date().toISOString(),
        running: true,
      })
    }
  }

  return flow
}

// ─── 单个事件项渲染 ──────────────────────────────────────────────────
function FlowEventItem({
  event,
  verbose,
  expanded,
  onToggle,
}: {
  event: FlowEvent
  verbose: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const hasDetails = (event.details && event.details.length > 0) || !!event.planSteps
  const colorCls = event.cls ?? (event.kind === 'subagent' && event.subagent
    ? SUBAGENT_COLOR_CLASS[event.subagent.color]
    : event.running ? 'text-primary' : 'text-foreground')

  return (
    <div
      className={cn(
        'px-2 py-0.5 font-mono text-[11px] leading-relaxed',
        hasDetails && 'cursor-pointer hover:bg-accent/30',
      )}
      onClick={hasDetails ? onToggle : undefined}
      data-testid="flow-event"
      data-event-kind={event.kind}
    >
      <div className="flex items-start gap-1">
        {/* 前缀:running 用 spinner,其他用 • */}
        <span className={cn('shrink-0 w-3', colorCls)}>
          {event.running ? <Spinner className={colorCls} /> : '•'}
        </span>
        {/* 标题 */}
        <span className={cn('flex-1 break-all', colorCls)}>
          {event.title}
          {verbose && event.subagent && (
            <span className="ml-1 text-muted-foreground/60">{event.subagent.threadId}</span>
          )}
          {verbose && event.terminal && (
            <span className="ml-1 text-muted-foreground/60">{event.terminal.id}</span>
          )}
        </span>
        {/* 耗时 */}
        {event.subagent?.durationMs !== undefined && (
          <span className="shrink-0 text-muted-foreground/60">
            {formatDuration(event.subagent.durationMs)}
          </span>
        )}
        {event.terminal?.durationMs !== undefined && (
          <span className="shrink-0 text-muted-foreground/60">
            {formatDuration(event.terminal.durationMs)}
          </span>
        )}
        {/* token 消耗 */}
        {event.subagent?.tokenUsage !== undefined && event.subagent.tokenUsage > 0 && (
          <span className="shrink-0 text-muted-foreground/60">
            {formatTokenCount(event.subagent.tokenUsage)}
          </span>
        )}
        {/* 展开指示 */}
        {hasDetails && (
          <span className="shrink-0 text-muted-foreground/50">
            {expanded ? '▾' : '▸'}
          </span>
        )}
      </div>
      {/* 详情(展开时) */}
      {expanded && event.planSteps && (
        <div className="ml-4 mt-0.5 space-y-0.5">
          {event.planSteps.map((step, i) => (
            <div key={step.id} className="flex items-start gap-1">
              <span className={cn('shrink-0 w-3', PLAN_CLS[step.status])}>
                {step.status === 'in_progress' ? <Spinner className={PLAN_CLS[step.status]} /> : PLAN_CHAR[step.status]}
              </span>
              <span className={cn('flex-1 break-all', PLAN_CLS[step.status])}>
                {i + 1}. {step.step}
              </span>
              {step.durationMs !== undefined && step.status === 'completed' && (
                <span className="shrink-0 text-muted-foreground/60">
                  {formatDuration(step.durationMs)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {expanded && event.details && event.details.length > 0 && (
        <div className="ml-4 mt-0.5 space-y-0.5">
          {event.details.map((line, i) => (
            <div key={i} className="flex items-start gap-1 text-muted-foreground">
              <span className="shrink-0">└</span>
              <span className="flex-1 whitespace-pre-wrap break-all">
                <AnsiText text={line} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Resize Handle(顶部拖拽条 + 双击重置) ───────────────────────────
function ResizeHandle({
  height,
  onResize,
  onReset,
}: {
  height: number
  onResize: (h: number) => void
  onReset: () => void
}) {
  const draggingRef = React.useRef(false)
  const startYRef = React.useRef(0)
  const startHRef = React.useRef(height)

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      const delta = startYRef.current - e.clientY
      onResize(startHRef.current + delta)
    }
    const onUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false
        document.body.style.cursor = ''
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [onResize])

  return (
    <div
      className="flex h-1.5 shrink-0 cursor-ns-resize items-center justify-center bg-border/50 transition-colors hover:bg-border"
      onMouseDown={(e) => {
        draggingRef.current = true
        startYRef.current = e.clientY
        startHRef.current = height
        document.body.style.cursor = 'ns-resize'
        e.preventDefault()
      }}
      onDoubleClick={onReset}
      title="拖拽调整高度,双击重置"
      data-testid="resize-handle"
    >
      <span className="h-0.5 w-8 rounded-sm bg-muted-foreground/40" />
    </div>
  )
}

// ─── 主组件 ──────────────────────────────────────────────────────────
export function AgentTaskProgressPane() {
  const open = useAgentProgressPaneStore((s) => s.open)
  const threadId = useAgentProgressPaneStore((s) => s.threadId)
  const threadIdInput = useAgentProgressPaneStore((s) => s.threadIdInput)
  const verbose = useAgentProgressPaneStore((s) => s.verbose)
  const autoScroll = useAgentProgressPaneStore((s) => s.autoScroll)
  const paneHeight = useAgentProgressPaneStore((s) => s.paneHeight)
  const setThreadIdInput = useAgentProgressPaneStore((s) => s.setThreadIdInput)
  const submitThreadId = useAgentProgressPaneStore((s) => s.submitThreadId)
  const closePane = useAgentProgressPaneStore((s) => s.closePane)
  const toggleVerbose = useAgentProgressPaneStore((s) => s.toggleVerbose)
  const setAutoScroll = useAgentProgressPaneStore((s) => s.setAutoScroll)
  const toggleExpanded = useAgentProgressPaneStore((s) => s.toggleExpanded)
  const isExpanded = useAgentProgressPaneStore((s) => s.isExpanded)
  const setPaneHeight = useAgentProgressPaneStore((s) => s.setPaneHeight)

  // threadId 本地状态(同步 store)
  const [localThreadId, setLocalThreadId] = React.useState<string | null>(threadId)
  React.useEffect(() => {
    setLocalThreadId(threadId)
  }, [threadId])

  const progress = useAgentProgress(localThreadId)
  const { overview, planSteps, subagents, terminals, events, isStreaming } = progress

  // 构建流式事件列表
  const flowEvents = React.useMemo(
    () => buildFlowEvents(events, planSteps, subagents, terminals, overview),
    [events, planSteps, subagents, terminals, overview],
  )

  // 自动滚到底部
  const scrollRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open || !autoScroll) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [open, autoScroll, flowEvents.length, isStreaming])

  // Esc 关闭 / v 切换 verbose
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
      if (e.key === 'Escape') {
        e.preventDefault()
        closePane()
      } else if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        toggleVerbose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closePane, toggleVerbose])

  if (!open) return null

  const start = () => {
    if (!localThreadId) {
      toast.warning('请先输入 threadId', { description: '在上方输入框填入 Agent threadId 后再点 run' })
      return
    }
    progress.start()
  }

  const resetHeight = () => setPaneHeight(240)

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-sticky flex flex-col',
        'border-t border-border bg-card text-foreground shadow-lg',
      )}
      style={{ height: paneHeight }}
      data-testid="agent-progress-pane"
    >
      <ResizeHandle height={paneHeight} onResize={setPaneHeight} onReset={resetHeight} />

      {/* Header:简洁单行(状态 + threadId + 工具按钮 + ✕) */}
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-border px-2">
        <span className={cn('shrink-0 font-mono text-xs', STATUS_CLS[overview.status])} data-testid="pane-status">
          {overview.status === 'running' ? <Spinner className={STATUS_CLS[overview.status]} /> : STATUS_CHAR[overview.status]}
        </span>
        <span className="shrink-0 font-mono text-xs font-semibold">Agent</span>
        {localThreadId && (
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {verbose ? localThreadId : localThreadId.slice(0, 8)}
          </span>
        )}
        {/* SSE 重连指示 */}
        {overview.reconnectAttempt > 0 && (
          <span
            className="shrink-0 animate-pulse text-[10px] text-amber-500"
            title={`SSE 断连,正在重连(第 ${overview.reconnectAttempt}/5 次)`}
          >
            ↻{overview.reconnectAttempt}/5
          </span>
        )}
        {/* SSE error */}
        {overview.error && (
          <span className="shrink-0 text-[10px] text-red-500" title={overview.error}>
            ⚠
          </span>
        )}
        <div className="flex-1" />
        {/* threadId 输入框(threadId 为空时显示) */}
        {!localThreadId && (
          <input
            type="text"
            value={threadIdInput}
            onChange={(e) => setThreadIdInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submitThreadId()
              }
            }}
            placeholder="enter threadId..."
            className="h-5 w-40 rounded-sm border border-border bg-background px-1 font-mono text-[10px] focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            data-testid="thread-id-input"
          />
        )}
        {/* 启动按钮(threadId 存在时) */}
        {localThreadId && !isStreaming && overview.status !== 'running' && (
          <button
            type="button"
            onClick={start}
            className="h-5 rounded-sm border border-border bg-background px-1.5 font-mono text-[10px] hover:bg-accent"
            title="启动 Agent 流"
          >
            ▶
          </button>
        )}
        {/* 停止按钮 */}
        {isStreaming && (
          <button
            type="button"
            onClick={progress.stop}
            className="h-5 rounded-sm border border-border bg-background px-1.5 font-mono text-[10px] hover:bg-accent"
            title="停止流"
          >
            ■
          </button>
        )}
        {/* 清除按钮 */}
        {localThreadId && (
          <button
            type="button"
            onClick={() => {
              progress.clear()
              setLocalThreadId(null)
              useAgentProgressPaneStore.getState().setThreadId(null)
            }}
            className="h-5 rounded-sm border border-border bg-background px-1.5 font-mono text-[10px] hover:bg-accent"
            title="清除事件"
          >
            clr
          </button>
        )}
        {/* verbose 切换 */}
        <button
          type="button"
          onClick={toggleVerbose}
          className={cn(
            'h-5 rounded-sm border border-border bg-background px-1.5 font-mono text-[10px] hover:bg-accent',
            verbose && 'bg-accent text-accent-foreground',
          )}
          title="切换 verbose(显示原始 ID)"
        >
          v
        </button>
        {/* autoScroll 切换 */}
        <button
          type="button"
          onClick={() => setAutoScroll(!autoScroll)}
          className={cn(
            'h-5 rounded-sm border border-border bg-background px-1.5 font-mono text-[10px] hover:bg-accent',
            autoScroll && 'bg-accent text-accent-foreground',
          )}
          title="切换自动滚动"
        >
          {autoScroll ? '↓' : '—'}
        </button>
        {/* 关闭按钮 ✕(可见,不依赖快捷键) */}
        <button
          type="button"
          onClick={closePane}
          aria-label="关闭"
          className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-sm border border-border bg-background font-mono text-[10px] hover:bg-accent hover:text-accent-foreground"
          title="关闭 (Esc)"
          data-testid="pane-close"
        >
          ✕
        </button>
      </div>

      {/* 流式事件列表 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden py-1"
        data-testid="flow-list"
      >
        {flowEvents.length === 0 ? (
          <div className="px-2 py-4 text-center font-mono text-[11px] text-muted-foreground">
            {localThreadId ? 'waiting for events...' : 'enter threadId to start'}
          </div>
        ) : (
          flowEvents.map((evt) => (
            <FlowEventItem
              key={evt.id}
              event={evt}
              verbose={verbose}
              expanded={isExpanded(evt.id)}
              onToggle={() => toggleExpanded(evt.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default AgentTaskProgressPane
