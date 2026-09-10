// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'
// 2026-09-09 0-6 组件拆分:agent-pane.tsx(667 行)拆为文件夹结构。
// 主组件保留组合角色:Agent 执行状态 + SSE 事件流处理(executeAgentStream);
// 输入区/进度区/结果区已抽为独立子组件,纯函数收敛到 model.ts(消除主组件内重复实现)。
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { executeAgentStream, cancelAgent } from '@ihui/api-client'
import type { AgentExecuteRequest, AgentStreamEvent, AgentStreamCallbacks } from '@ihui/api-client'
import type { AgentToolCall, AgentChange, TerminalTask, PlanStep } from '@/hooks/use-agent-progress'
import { AgentInputArea } from './AgentInputArea'
import { AgentProgressArea } from './AgentProgressArea'
import { AgentResultFooter } from './AgentResultFooter'
import {
  CHANGE_TOOL_NAMES,
  deriveDiffInfoFromArgs,
  isPlanStepStatus,
  isTerminalStatus,
  parsePlanData,
  parseTerminalData,
  parseToolData,
} from './model'

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
      const diffInfo = deriveDiffInfoFromArgs(tool.toolName, tool.args, t('agentPane.unknownFile'))
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
      const id = td.id ?? 'term-' + ++terminalIdCounter.current
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
            id: 'plan-' + idx,
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
        const id = 'tool-' + ++toolIdCounter.current
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
            id: 'plan-' + idx,
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
      <AgentInputArea
        goal={goal}
        onGoalChange={setGoal}
        model={model}
        onModelChange={setModel}
        isRunning={isRunning}
        canRun={canRun}
        onRun={() => void run()}
      />

      {/* ─── 中部:Agent 进度展示区(可滚动) ─── */}
      <AgentProgressArea
        thinking={thinking}
        currentNode={currentNode}
        isRunning={isRunning}
        planSteps={planSteps}
        tools={tools}
        changes={changes}
        terminals={terminals}
        hasProgress={hasProgress}
      />

      {/* ─── 底部:结果 + 控制区 ─── */}
      <AgentResultFooter
        error={error}
        result={result}
        isRunning={isRunning}
        taskId={taskId}
        onStop={() => void stop()}
        onClear={clear}
      />
    </div>
  )
}

export default AgentPane
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
