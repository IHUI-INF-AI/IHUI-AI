'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { executeAgentStream, cancelAgent } from '@ihui/api-client'
import type { AgentExecuteRequest, AgentStreamEvent, AgentStreamCallbacks } from '@ihui/api-client'
import type {
  AgentToolCall,
  AgentChange,
  TerminalTask,
  PlanStep,
  PlanStepStatus,
} from '@/hooks/use-agent-progress'
import type { InlineDiffInfo } from '@/components/ai/types'
import {
  FoldableSectionProvider,
  formatDuration,
} from '@/components/ai/progress-sections/foldable-section'
import { ThinkingSection } from '@/components/ai/progress-sections/thinking-section'
import { ToolCallsSection } from '@/components/ai/progress-sections/tool-calls-section'
import { ChangesSection } from '@/components/ai/progress-sections/changes-section'
import { TerminalSection } from '@/components/ai/progress-sections/terminal-section'
import {
  Bot,
  Play,
  Square,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ListTodo,
  Circle,
  Check,
} from 'lucide-react'

/**
 * AgentPane — IDE Agent 面板(对标 Claude Code 的 AI 自主编码)
 *
 * 布局:竖向三段式(顶部输入 / 中部进度 / 底部结果+控制)
 * 数据流:executeAgentStream (SSE) → useState 聚合 → 复用 progress-sections 渲染
 *
 * 设计决策:
 * - 不复用 useAgentProgress hook(它耦合 useAgentStream + threadId + 多个 store,
 *   不适合 IDE 面板独立场景);改为直接消费 executeAgentStream 的 SSE 事件。
 * - 复用 progress-sections 的 4 个 section 组件(ThinkingSection/ToolCallsSection/
 *   ChangesSection/TerminalSection),它们接口纯数据,无 store 依赖。
 * - 复用 use-agent-progress 的类型定义(AgentToolCall/AgentChange/TerminalTask/PlanStep)。
 */

// ---- 模型选项(硬编码常见模型,后续可接入 FALLBACK_MODELS) ----
const MODEL_OPTIONS: ReadonlyArray<{ value: string; labelKey?: string; label?: string }> = [
  { value: '', labelKey: 'agentPane.modelDefault' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
  { value: 'deepseek-chat', label: 'DeepSeek Chat' },
]

const CHANGE_TOOL_NAMES = new Set(['edit_file', 'write_file'])

// ---- SSE 事件数据提取(类型守卫 + 精确断言,零 any) ----

interface ToolEventData {
  id?: string
  name?: string
  toolName?: string
  args?: Record<string, unknown>
  arguments?: Record<string, unknown>
  result?: unknown
  error?: string
  iteration?: number
}

function parseToolData(event: AgentStreamEvent): ToolEventData {
  // AgentStreamEvent 含 [key: string]: unknown 兜底,此处精确断言为结构化字段
  return event as unknown as ToolEventData
}

interface TerminalEventData {
  id?: string
  command?: string
  status?: string
  output?: string
  exitCode?: number
}

function parseTerminalData(event: AgentStreamEvent): TerminalEventData {
  return event as unknown as TerminalEventData
}

interface PlanStepData {
  step: string
  status?: string
  startedAt?: string
  endedAt?: string
  durationMs?: number
}

interface PlanEventData {
  explanation?: string
  plan?: PlanStepData[]
}

function parsePlanData(event: AgentStreamEvent): PlanEventData {
  return event as unknown as PlanEventData
}

function isPlanStepStatus(v: unknown): v is PlanStepStatus {
  return v === 'pending' || v === 'in_progress' || v === 'completed'
}

function isTerminalStatus(v: unknown): v is TerminalTask['status'] {
  return v === 'running' || v === 'completed' || v === 'failed'
}

/** 从 tool args 推导 InlineDiffInfo(参考 use-agent-progress 的 deriveDiffInfoFromArgs) */
function deriveDiffInfoFromArgs(
  toolName: string,
  args: Record<string, unknown>,
  t: (key: string) => string,
): InlineDiffInfo | null {
  const pickStr = (keys: string[]): string => {
    for (const k of keys) {
      const v = args[k]
      if (typeof v === 'string') return v
    }
    return ''
  }

  const filePath =
    pickStr(['path', 'file_path', 'filePath', 'filename']) || t('agentPane.unknownFile')

  if (toolName === 'edit_file') {
    const oldContent = pickStr(['oldText', 'old_text', 'oldContent', 'old_content'])
    const newContent = pickStr(['newText', 'new_text', 'newContent', 'new_content'])
    if (!oldContent && !newContent) return null
    return { file_path: filePath, old_content: oldContent, new_content: newContent }
  }

  if (toolName === 'write_file') {
    const content = pickStr(['content', 'fileContent', 'file_content', 'text'])
    if (!content) return null
    return { file_path: filePath, old_content: '', new_content: content, is_new_file: true }
  }

  return null
}

// ---- Plan 步骤状态图标(模块级 const,避免每次 render 重建) ----
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

/** 简单 Plan 步骤列表(不复用 agent-task-progress-pane 的 PlanStepItem,它耦合 ProgressJumpStore) */
function PlanStepsList({ steps }: { steps: PlanStep[] }) {
  const t = useTranslations('ide')
  return (
    <div
      className="mx-1.5 mt-1.5 rounded-md border border-border/60 bg-muted/30 p-1"
      data-testid="agent-pane-plan-list"
    >
      <div className="mb-0.5 flex items-center gap-1 px-1 text-[11px] font-medium text-muted-foreground">
        <ListTodo className="h-3 w-3" aria-hidden />
        <span>{t('agentPane.plan')}</span>
        <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/60">
          {steps.filter((s) => s.status === 'completed').length}/{steps.length}
        </span>
      </div>
      <div className="space-y-0.5">
        {steps.map((step, idx) => {
          const Icon = PLAN_ICON[step.status]
          return (
            <div
              key={step.id}
              className="flex items-start gap-1.5 px-1 py-0.5 text-[11px] leading-relaxed"
              data-testid={`agent-pane-plan-step-${step.id}`}
            >
              <Icon
                className={cn(
                  'mt-0.5 h-3 w-3 shrink-0',
                  PLAN_CLS[step.status],
                  step.status === 'in_progress' && 'animate-spin',
                )}
                aria-hidden
              />
              <span
                className={cn(
                  'flex-1 break-all',
                  step.status === 'pending' && 'text-muted-foreground/60',
                )}
              >
                {idx + 1}. {step.step}
              </span>
              {step.durationMs !== undefined && step.status !== 'pending' && (
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
                  {formatDuration(step.durationMs)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- 主组件 ----
export function AgentPane() {
  const t = useTranslations('ide')

  // 输入区 state
  const [goal, setGoal] = React.useState('')
  const [model, setModel] = React.useState('')

  // 执行状态 state
  const [isRunning, setIsRunning] = React.useState(false)
  const [thinking, setThinking] = React.useState('')
  const [tools, setTools] = React.useState<AgentToolCall[]>([])
  const [terminals, setTerminals] = React.useState<TerminalTask[]>([])
  const [planSteps, setPlanSteps] = React.useState<PlanStep[]>([])
  const [result, setResult] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [taskId, setTaskId] = React.useState<string | null>(null)
  const [currentNode, setCurrentNode] = React.useState<string | null>(null)

  // refs
  const abortRef = React.useRef<AbortController | null>(null)
  const toolIdCounter = React.useRef(0)
  const terminalIdCounter = React.useRef(0)

  // changes 从 tools 派生(edit_file/write_file)
  const changes = React.useMemo<AgentChange[]>(() => {
    const list: AgentChange[] = []
    for (const tool of tools) {
      if (!CHANGE_TOOL_NAMES.has(tool.toolName)) continue
      const diffInfo = deriveDiffInfoFromArgs(tool.toolName, tool.args, t)
      if (!diffInfo) continue
      list.push({
        id: tool.id,
        filePath: diffInfo.file_path,
        toolName: tool.toolName,
        diffInfo,
        timestamp: tool.endedAt ?? tool.startedAt,
      })
    }
    return list
  }, [tools, t])

  // 清空会话
  const clear = React.useCallback(() => {
    setThinking('')
    setTools([])
    setTerminals([])
    setPlanSteps([])
    setResult('')
    setError(null)
    setTaskId(null)
    setCurrentNode(null)
  }, [])

  // 停止执行(abort SSE + 调 cancelAgent)
  const stop = React.useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    const currentTaskId = taskId
    if (currentTaskId) {
      try {
        await cancelAgent(currentTaskId)
      } catch {
        // 取消失败忽略(本地 abort 已停止 SSE 流)
      }
    }
    setIsRunning(false)
  }, [taskId])

  // 处理 SSE 事件(onEvent 兜底,处理 tool_result/terminal/plan_updated/node 等)
  // 仅用 setter 函数式更新 + 纯函数,引用稳定,空依赖安全
  const handleStreamEvent = React.useCallback((event: AgentStreamEvent) => {
    const type = event.type

    // tool_call 由 onToolCall 回调处理,此处跳过避免重复
    if (type === 'tool_call') return
    // plan(简单 steps 数组)由 onPlanProposed 处理,此处只处理 plan_updated(详细对象)
    if (type === 'plan') return

    if (type === 'tool_result') {
      const td = parseToolData(event)
      const resultId = td.id
      setTools((prev) => {
        let targetIdx = -1
        if (resultId) {
          targetIdx = prev.findIndex((it) => it.id === resultId)
        }
        if (targetIdx === -1) {
          // 无 id 时匹配最后一个 running 的同名 tool
          const name = td.name ?? td.toolName
          for (let i = prev.length - 1; i >= 0; i--) {
            const it = prev[i]
            if (it && it.status === 'running' && (!name || it.toolName === name)) {
              targetIdx = i
              break
            }
          }
        }
        if (targetIdx === -1) return prev
        const next = [...prev]
        const target = next[targetIdx]
        if (!target) return prev
        const updated: AgentToolCall = {
          ...target,
          status: td.error ? 'error' : 'success',
          result: td.result,
          error: td.error,
          endedAt: new Date().toISOString(),
        }
        const startMs = Date.parse(target.startedAt)
        if (!Number.isNaN(startMs)) {
          updated.durationMs = Math.max(0, Date.now() - startMs)
        }
        next[targetIdx] = updated
        return next
      })
      return
    }

    if (type === 'terminal_start') {
      const td = parseTerminalData(event)
      const id = td.id ?? `term-${++terminalIdCounter.current}`
      setTerminals((prev) => [
        ...prev,
        {
          id,
          command: td.command ?? '',
          status: 'running',
          startedAt: new Date().toISOString(),
        },
      ])
      return
    }

    if (type === 'terminal_end') {
      const td = parseTerminalData(event)
      const id = td.id ?? ''
      setTerminals((prev) => {
        if (!id) return prev
        const idx = prev.findIndex((it) => it.id === id)
        if (idx === -1) return prev
        const next = [...prev]
        const target = next[idx]
        if (!target) return prev
        const updated: TerminalTask = {
          ...target,
          status: isTerminalStatus(td.status) ? td.status : 'completed',
          output: td.output,
          endedAt: new Date().toISOString(),
        }
        if (td.exitCode !== undefined) updated.exitCode = td.exitCode
        const startMs = Date.parse(target.startedAt)
        if (!Number.isNaN(startMs)) {
          updated.durationMs = Math.max(0, Date.now() - startMs)
        }
        next[idx] = updated
        return next
      })
      return
    }

    if (type === 'plan_updated') {
      const pd = parsePlanData(event)
      if (pd.plan && Array.isArray(pd.plan)) {
        setPlanSteps(
          pd.plan.map((item, idx) => ({
            id: `plan-${idx}`,
            step: item.step,
            status: isPlanStepStatus(item.status) ? item.status : 'pending',
            explanation: pd.explanation,
            startedAt: item.startedAt,
            endedAt: item.endedAt,
            durationMs: item.durationMs,
          })),
        )
      }
      return
    }

    if (type === 'node_start') {
      const node = typeof event.node === 'string' ? event.node : null
      if (node) setCurrentNode(node)
      return
    }

    if (type === 'node_end') {
      setCurrentNode(null)
      return
    }

    if (type === 'task_id' || type === 'start') {
      if (event.task_id) setTaskId(event.task_id)
      return
    }
  }, [])

  // 执行 agent(SSE 流式)
  const run = React.useCallback(async () => {
    const trimmedGoal = goal.trim()
    if (!trimmedGoal || isRunning) return

    // 重置状态
    setThinking('')
    setTools([])
    setTerminals([])
    setPlanSteps([])
    setResult('')
    setError(null)
    setTaskId(null)
    setCurrentNode(null)
    setIsRunning(true)
    toolIdCounter.current = 0
    terminalIdCounter.current = 0

    const controller = new AbortController()
    abortRef.current = controller

    const params: AgentExecuteRequest = {
      goal: trimmedGoal,
      ...(model ? { model } : {}),
    }

    const callbacks: AgentStreamCallbacks = {
      onDelta: (delta) => {
        setThinking((prev) => prev + delta)
      },
      onToolCall: ({ name, args }) => {
        const id = `tool-${++toolIdCounter.current}`
        const now = new Date().toISOString()
        setTools((prev) => [
          ...prev,
          {
            id,
            toolName: name,
            args,
            status: 'running',
            startedAt: now,
          },
        ])
      },
      onPlanProposed: ({ steps }) => {
        if (!steps || steps.length === 0) return
        setPlanSteps(
          steps.map((step, idx) => ({
            id: `plan-${idx}`,
            step,
            status: 'pending' as const,
          })),
        )
      },
      onEvent: (event) => {
        handleStreamEvent(event)
      },
      onDone: (event) => {
        if (event.task_id) setTaskId(event.task_id)
        const doneResult =
          typeof event.result === 'string'
            ? event.result
            : typeof event.content === 'string'
              ? event.content
              : typeof event.message === 'string'
                ? event.message
                : ''
        if (doneResult) setResult(doneResult)
        setIsRunning(false)
        abortRef.current = null
      },
      onError: (err) => {
        setError(err)
        setIsRunning(false)
        abortRef.current = null
      },
    }

    try {
      await executeAgentStream(params, callbacks, { signal: controller.signal })
    } catch (err) {
      // abort 触发的 AbortError 已由 executeAgentStream 内部处理(调 onDone),不会到这里
      const msg = err instanceof Error ? err.message : t('agentPane.executeFailed')
      setError(msg)
      setIsRunning(false)
      abortRef.current = null
    }
  }, [goal, model, isRunning, handleStreamEvent, t])

  // 卸载时取消进行中的 SSE
  React.useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
      }
    }
  }, [])

  const hasProgress =
    !!thinking ||
    tools.length > 0 ||
    terminals.length > 0 ||
    planSteps.length > 0 ||
    !!result ||
    !!error

  const canRun = !isRunning && goal.trim().length > 0

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-card">
      {/* ─── 顶部:Agent 任务输入区 ─── */}
      <div className="shrink-0 space-y-2 bg-card p-2">
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              void run()
            }
          }}
          placeholder={t('agentPane.placeholder')}
          rows={3}
          disabled={isRunning}
          aria-label={t('agentPane.placeholder')}
          className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-60"
        />
        <div className="flex items-center gap-1.5">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={isRunning}
            aria-label={t('agentPane.modelSelect')}
            className="h-7 rounded-md border border-border bg-background px-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-60"
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.labelKey ? t(opt.labelKey) : opt.label}
              </option>
            ))}
          </select>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => void run()}
            disabled={!canRun}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="agent-pane-run-btn"
          >
            {isRunning ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <Play className="h-3 w-3" aria-hidden />
            )}
            <span>{t('agentPane.execute')}</span>
          </button>
        </div>
      </div>

      {/* ─── 中部:Agent 进度展示区(可滚动) ─── */}
      <div
        className="min-h-0 flex-1 overflow-y-auto bg-background/40 p-2"
        data-testid="agent-pane-progress"
      >
        {!hasProgress && (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
            <Bot className="h-8 w-8 text-muted-foreground/30" aria-hidden />
            <div className="text-xs text-muted-foreground/70">{t('agentPane.emptyHint')}</div>
          </div>
        )}
        {hasProgress && (
          <FoldableSectionProvider value={{ expandAll: null, setExpandAll: () => {} }}>
            <div className="space-y-1.5">
              {(thinking.length > 0 || currentNode !== null) && (
                <ThinkingSection
                  content={thinking}
                  currentNode={currentNode}
                  isStreaming={isRunning}
                />
              )}
              {planSteps.length > 0 && <PlanStepsList steps={planSteps} />}
              <ToolCallsSection tools={tools} />
              <ChangesSection changes={changes} />
              <TerminalSection terminals={terminals} />
            </div>
          </FoldableSectionProvider>
        )}
      </div>

      {/* ─── 底部:结果 + 控制区 ─── */}
      <div className="shrink-0 space-y-2 bg-card p-2">
        {error && (
          <div
            className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive"
            role="alert"
            data-testid="agent-pane-error"
          >
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span className="flex-1 break-all">{error}</span>
          </div>
        )}
        {!error && result && (
          <div
            className="rounded-md bg-muted/40 px-2 py-1.5 text-xs text-foreground/90"
            data-testid="agent-pane-result"
          >
            <div className="mb-0.5 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" aria-hidden />
              <span>{t('agentPane.result')}</span>
            </div>
            <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-foreground/80">
              {result}
            </pre>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void stop()}
            disabled={!isRunning}
            className="inline-flex h-6 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="agent-pane-stop-btn"
          >
            <Square className="h-3 w-3" aria-hidden />
            <span>{t('agentPane.stop')}</span>
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={isRunning}
            className="inline-flex h-6 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="agent-pane-clear-btn"
          >
            <Trash2 className="h-3 w-3" aria-hidden />
            <span>{t('agentPane.clear')}</span>
          </button>
          {taskId && (
            <span className="ml-auto truncate text-[10px] text-muted-foreground/60" title={taskId}>
              {t('agentPane.taskId')}: {taskId.slice(0, 8)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default AgentPane
