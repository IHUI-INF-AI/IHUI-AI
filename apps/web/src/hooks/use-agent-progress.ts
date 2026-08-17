'use client'

import * as React from 'react'
import type { SSEEvent } from '@ihui/types'
import { useAgentStream } from './use-agent-stream'
import type { InlineDiffInfo } from '@/components/ai/types'

/**
 * use-agent-progress — Codex 风格 Agent 进度聚合 hook(2026-07-27 重构,Codex 对齐)
 *
 * Codex 权威契约对齐:
 * - Plan 步骤三状态:pending / in_progress / completed(非 running/done/error)
 * - 可选 explanation 字段(Codex UpdatePlanArgs.explanation)
 * - 硬规则:At most one step can be in_progress at a time(冗余校验,违反时自动降级为 pending)
 * - 子代理(Subagent):昵称 + @handle + dead agents 可见
 * - 终端任务(TerminalTask):后台终端执行
 *
 * 数据流:
 *   useAgentStream(threadId) → events[]
 *     → useMemo 聚合 → { planSteps, subagents, terminals, tools, changes, overview }
 */

/** Codex 对齐:Plan 步骤状态(三状态) */
export type PlanStepStatus = 'pending' | 'in_progress' | 'completed'

/** Codex 对齐:Plan 步骤(对应 Codex PlanItemArg + explanation) */
export interface PlanStep {
  id: string
  step: string
  status: PlanStepStatus
  /** 可选解释(Codex UpdatePlanArgs.explanation) */
  explanation?: string
  startedAt?: string
  endedAt?: string
  durationMs?: number
  /** Codex:step 累计 token 消耗(可选,由 status 事件更新) */
  tokenUsage?: number
  /** 2026-07-31 深度优化:错误标记(toolCalls error 时为 true,PlanStepsCard 显示红色错误样式) */
  error?: boolean
  /** 2026-07-31 深度优化:关联消息 ID(用于点击步骤跳转消息 + hover 联动) */
  sourceMessageId?: string
  /** 2026-07-31 深度优化:步骤分组编号(同一条 assistant 消息的步骤同组,组间视觉分隔) */
  groupIndex?: number
}

/** 子代理状态(spawned → running → done/failed,失败/完成保留为 dead) */
export type SubagentStatus = 'spawned' | 'running' | 'done' | 'failed' | 'dead'

/** 子代理(Codex v0.105.0:人类可读昵称 + @handle + 彩色标签) */
export interface Subagent {
  id: string
  /** 原始 threadId(verbose 模式显示) */
  threadId: string
  /** 人类可读昵称(从 threadId 派生或事件提供) */
  nickname: string
  /** @handle 标签(如 @validator) */
  handle: string
  /** 彩色标签(循环分配) */
  color: SubagentColor
  status: SubagentStatus
  role?: string
  spawnedAt: string
  endedAt?: string
  durationMs?: number
  /** 当前执行的任务摘要 */
  currentTask?: string
  /** 是否需要审批(child-thread approval) */
  pendingApproval?: boolean
  /** Codex:累计 token 消耗(由 status 事件更新) */
  tokenUsage?: number
  /** Codex:工具调用次数 */
  toolCalls?: number
  /** Codex:死亡原因(failed/dead 时的 error message) */
  failureReason?: string
  /** v10 Phase 5:subagent 内部工具调用列表(若事件携带 subagentId 则关联) */
  tools?: AgentToolCall[]
}

/** 子代理颜色(ANSI 风格,Web 适配为 Tailwind 类) */
export type SubagentColor = 'cyan' | 'blue' | 'green' | 'yellow' | 'magenta' | 'red'

/** 终端任务状态 */
export type TerminalStatus = 'running' | 'completed' | 'failed'

/** 终端任务(后台终端执行) */
export interface TerminalTask {
  id: string
  command: string
  status: TerminalStatus
  output?: string
  startedAt: string
  endedAt?: string
  durationMs?: number
  /** Codex:退出码(completed=0 / failed=非 0) */
  exitCode?: number
}

/** 工具调用(保留原有,用于 changes 派生) */
export interface AgentToolCall {
  id: string
  toolName: string
  args: Record<string, unknown>
  result?: unknown
  status: 'running' | 'success' | 'error'
  startedAt: string
  endedAt?: string
  durationMs?: number
  error?: string
  iteration?: number
}

/** 文件变更 */
export interface AgentChange {
  id: string
  filePath: string
  toolName: string
  diffInfo: InlineDiffInfo
  timestamp: string
}

/** 任务总览 */
export interface AgentOverview {
  status: 'idle' | 'running' | 'completed' | 'failed' | 'interrupted'
  currentNode: string | null
  plan: unknown
  content: string
  error: string | null
  interruptEvent: SSEEvent | null
  sessionStart: string | null
  totalSteps: number
  completedSteps: number
  inProgressSteps: number
  pendingSteps: number
  totalSubagents: number
  activeSubagents: number
  deadSubagents: number
  totalTerminals: number
  runningTerminals: number
  totalChanges: number
  /** 历史耗时样本(用于 bracket 分位数计算) */
  historicalDurations: number[]
  /** 当前重连尝试次数(0=正常,>0=正在重连) */
  reconnectAttempt: number
}

/** 当前正在执行的任务摘要(2026-08-02 新增,用于 TaskListPopover 实时显示)
 * - kind:
 *   - 'planning':正在规划(plan step 处于 in_progress 且无进行中的工具调用)
 *   - 'tool':正在调用工具(普通工具或插件/MCP)
 *   - 'subagent':正在子代理执行
 *   - 'terminal':正在终端命令执行
 *   - 'idle':无活动任务
 * - label:展示给用户的简短描述(如 "规划进度"、"调用 web_search"、"调用 browser 插件" 等)
 * - toolName / pluginName / mcpName:具体名称(若有)
 */
export interface CurrentTask {
  kind: 'idle' | 'planning' | 'tool' | 'subagent' | 'terminal'
  label: string
  toolName?: string
  pluginName?: string
  mcpName?: string
}

export interface UseAgentProgressReturn {
  overview: AgentOverview
  planSteps: PlanStep[]
  subagents: Subagent[]
  terminals: TerminalTask[]
  tools: AgentToolCall[]
  changes: AgentChange[]
  /** 当前正在执行的任务摘要(2026-08-02 新增) */
  currentTask: CurrentTask
  /** 原始 SSE 事件流(用于流式渲染) */
  events: SSEEvent[]
  isStreaming: boolean
  start: (input?: Record<string, unknown>) => void
  stop: () => void
  clear: () => void
}

/** 昵称池(Codex 风格:validator/reviewer/explorer/implementer 等) */
const NICKNAME_POOL = [
  'validator',
  'reviewer',
  'explorer',
  'implementer',
  'planner',
  'tester',
  'researcher',
  'optimizer',
  'debugger',
  'refactorer',
]

/** 子代理颜色池(循环分配) */
const COLOR_POOL: SubagentColor[] = ['cyan', 'blue', 'green', 'yellow', 'magenta', 'red']

/** 颜色 → Tailwind 类映射 */
export const SUBAGENT_COLOR_CLASS: Record<SubagentColor, string> = {
  cyan: 'text-cyan-500',
  blue: 'text-blue-500',
  green: 'text-emerald-500',
  yellow: 'text-amber-500',
  magenta: 'text-fuchsia-500',
  red: 'text-red-500',
}

/** 从 threadId 派生稳定昵称(同一 threadId 总是得到相同昵称) */
function deriveNickname(threadId: string, index: number): string {
  // 基于 threadId 哈希到 NICKNAME_POOL,保证稳定
  let hash = 0
  for (let i = 0; i < threadId.length; i++) {
    hash = (hash * 31 + threadId.charCodeAt(i)) >>> 0
  }
  const name = NICKNAME_POOL[hash % NICKNAME_POOL.length] ?? 'agent'
  // 若有多个同基础名,加序号
  return index === 0 ? name : `${name}-${index + 1}`
}

/** 从 tool_call / tool_result 事件 data 中提取结构化字段 */
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

function parseToolData(data: unknown): ToolEventData {
  if (!data || typeof data !== 'object') return {}
  return data as ToolEventData
}

/** 从 tool args 推导 InlineDiffInfo */
function deriveDiffInfoFromArgs(
  toolName: string,
  args: Record<string, unknown>,
): InlineDiffInfo | null {
  const pickStr = (keys: string[]): string => {
    for (const k of keys) {
      const v = args[k]
      if (typeof v === 'string') return v
    }
    return ''
  }

  const filePath = pickStr(['path', 'file_path', 'filePath', 'filename']) || '(未知文件)'

  if (toolName === 'edit_file') {
    const oldContent = pickStr(['oldText', 'old_text', 'oldContent', 'old_content'])
    const newContent = pickStr(['newText', 'new_text', 'newContent', 'new_content'])
    if (!oldContent && !newContent) return null
    return { file_path: filePath, old_content: oldContent, new_content: newContent }
  }

  if (toolName === 'write_file') {
    const content = pickStr(['content', 'fileContent', 'file_content', 'text'])
    if (!content) return null
    return {
      file_path: filePath,
      old_content: '',
      new_content: content,
      is_new_file: true,
    }
  }

  return null
}

const CHANGE_TOOL_NAMES = new Set(['edit_file', 'write_file'])

/** 从 SSE 事件提取 PlanStep(支持 plan_updated / plan / node_start / node_end) */
function extractPlanFromEvents(events: SSEEvent[]): PlanStep[] {
  // 调试:输出所有事件类型统计
  console.info(
    '[PlanDebug] total events:',
    events.length,
    'types:',
    events.map((e) => e.type).join(', '),
  )

  // 优先:Codex 风格 plan_updated 事件(权威快照)
  // 兼容 ai-service langgraph_stream.py 发出的 plan 事件(update 中含 "plan" 字段)
  const planSnapshots = events.filter(
    (e) => (e.type as string) === 'plan_updated' || (e.type as string) === 'plan',
  )
  console.info('[PlanDebug] plan/plan_updated snapshots:', planSnapshots.length)
  if (planSnapshots.length > 0) {
    const lastSnapshot = planSnapshots[planSnapshots.length - 1]
    if (!lastSnapshot) return []
    console.info(
      '[PlanDebug] last plan snapshot data:',
      JSON.stringify(lastSnapshot.data).slice(0, 500),
    )
    const data = lastSnapshot.data as
      | {
          explanation?: string
          plan?: Array<{
            step: string
            status: PlanStepStatus
            startedAt?: string
            endedAt?: string
            durationMs?: number
            tokenUsage?: number
          }>
          update?: {
            plan?: Array<{
              step: string
              status: PlanStepStatus
              startedAt?: string
              endedAt?: string
              durationMs?: number
              tokenUsage?: number
            }>
          }
        }
      | Array<{
          step: string
          status: PlanStepStatus
          startedAt?: string
          endedAt?: string
          durationMs?: number
          tokenUsage?: number
        }>
      | undefined
    // 兼容多种后端格式:
    // 1) data.plan 数组(标准格式)
    // 2) data.update.plan 数组(某些后端包装在 update 字段中)
    // 3) data 本身就是数组(极简格式)
    let rawPlan:
      | Array<{
          step: string
          status: PlanStepStatus
          startedAt?: string
          endedAt?: string
          durationMs?: number
          tokenUsage?: number
        }>
      | undefined
    let explanation: string | undefined
    if (Array.isArray(data)) {
      // 极简格式:data 本身就是数组(可能是 list[str] 或 list[PlanStep])
      rawPlan = data.map((item) => {
        if (typeof item === 'string') {
          return { step: item, status: 'pending' as PlanStepStatus }
        }
        return item as { step: string; status: PlanStepStatus }
      })
    } else if (data && typeof data === 'object') {
      rawPlan = data.plan ?? data.update?.plan
      explanation = data.explanation
      // 兼容 list[str] 格式(后端某些实现返回字符串数组而非对象数组)
      if (Array.isArray(rawPlan) && rawPlan.length > 0 && typeof rawPlan[0] === 'string') {
        rawPlan = (rawPlan as unknown as string[]).map((item) => ({
          step: item,
          status: 'pending' as PlanStepStatus,
          startedAt: undefined,
          endedAt: undefined,
          durationMs: undefined,
          tokenUsage: undefined,
        }))
      }
    }
    if (rawPlan && Array.isArray(rawPlan)) {
      const steps: PlanStep[] = rawPlan.map((item, idx) => {
        const step: PlanStep = {
          id: `plan-${idx}`,
          step: item.step,
          status: item.status,
          explanation,
        }
        // Codex:从 plan_updated 快照中提取时间戳(若上游提供)
        if (item.startedAt) step.startedAt = item.startedAt
        if (item.endedAt) step.endedAt = item.endedAt
        if (item.durationMs !== undefined) step.durationMs = item.durationMs
        if (item.tokenUsage !== undefined) step.tokenUsage = item.tokenUsage
        // 若有 startedAt 但无 durationMs,基于当前时间计算 in_progress 的 elapsedMs
        if (step.status === 'in_progress' && step.startedAt && step.durationMs === undefined) {
          const startMs = Date.parse(step.startedAt)
          if (!Number.isNaN(startMs)) {
            step.durationMs = Math.max(0, Date.now() - startMs)
          }
        }
        return step
      })
      // 硬规则:最多一个 in_progress(冗余校验,违反时只保留第一个,其余降级为 pending)
      const inProgressCount = steps.filter((s) => s.status === 'in_progress').length
      if (inProgressCount > 1) {
        let foundFirst = false
        for (const s of steps) {
          if (s.status === 'in_progress') {
            if (foundFirst) s.status = 'pending'
            foundFirst = true
          }
        }
      }
      return steps
    }
    console.info(
      '[PlanDebug] plan snapshot parsed but rawPlan empty or not array, rawPlan:',
      rawPlan,
    )
  }

  // 降级1:从 state_update 事件的 data.update 中提取 plan(兼容某些后端)
  const stateUpdateSnapshots = events.filter((e) => (e.type as string) === 'state_update')
  console.info('[PlanDebug] state_update snapshots:', stateUpdateSnapshots.length)
  if (stateUpdateSnapshots.length > 0) {
    const lastSnapshot = stateUpdateSnapshots[stateUpdateSnapshots.length - 1]
    if (!lastSnapshot) return []
    const update = (lastSnapshot.data as { update?: unknown } | undefined)?.update
    console.info(
      '[PlanDebug] last state_update update type:',
      typeof update,
      'is object:',
      !!update,
    )
    if (update && typeof update === 'object') {
      const updateObj = update as {
        plan?: Array<{
          step: string
          status: PlanStepStatus
          startedAt?: string
          endedAt?: string
          durationMs?: number
          tokenUsage?: number
        }>
        steps?: Array<{
          step: string
          status: PlanStepStatus
          startedAt?: string
          endedAt?: string
          durationMs?: number
          tokenUsage?: number
        }>
      }
      const rawPlan = updateObj.plan ?? updateObj.steps
      // 兼容 list[str] 格式(后端某些实现返回字符串数组而非对象数组)
      if (Array.isArray(rawPlan) && rawPlan.length > 0 && typeof rawPlan[0] === 'string') {
        const normalizedPlan = (rawPlan as unknown as string[]).map((item) => ({
          step: item,
          status: 'pending' as PlanStepStatus,
          startedAt: undefined,
          endedAt: undefined,
          durationMs: undefined,
          tokenUsage: undefined,
        }))
        if (normalizedPlan) {
          const steps: PlanStep[] = normalizedPlan.map((item, idx) => {
            const step: PlanStep = {
              id: `plan-${idx}`,
              step: item.step,
              status: item.status,
            }
            if (item.startedAt) step.startedAt = item.startedAt
            if (item.endedAt) step.endedAt = item.endedAt
            if (item.durationMs !== undefined) step.durationMs = item.durationMs
            if (item.tokenUsage !== undefined) step.tokenUsage = item.tokenUsage
            if (step.status === 'in_progress' && step.startedAt && step.durationMs === undefined) {
              const startMs = Date.parse(step.startedAt)
              if (!Number.isNaN(startMs)) {
                step.durationMs = Math.max(0, Date.now() - startMs)
              }
            }
            return step
          })
          const inProgressCount = steps.filter((s) => s.status === 'in_progress').length
          if (inProgressCount > 1) {
            let foundFirst = false
            for (const s of steps) {
              if (s.status === 'in_progress') {
                if (foundFirst) s.status = 'pending'
                foundFirst = true
              }
            }
          }
          return steps
        }
      }
      if (rawPlan && Array.isArray(rawPlan)) {
        const steps: PlanStep[] = rawPlan.map((item, idx) => {
          const step: PlanStep = {
            id: `plan-${idx}`,
            step: item.step,
            status: item.status,
          }
          if (item.startedAt) step.startedAt = item.startedAt
          if (item.endedAt) step.endedAt = item.endedAt
          if (item.durationMs !== undefined) step.durationMs = item.durationMs
          if (item.tokenUsage !== undefined) step.tokenUsage = item.tokenUsage
          if (step.status === 'in_progress' && step.startedAt && step.durationMs === undefined) {
            const startMs = Date.parse(step.startedAt)
            if (!Number.isNaN(startMs)) {
              step.durationMs = Math.max(0, Date.now() - startMs)
            }
          }
          return step
        })
        const inProgressCount = steps.filter((s) => s.status === 'in_progress').length
        if (inProgressCount > 1) {
          let foundFirst = false
          for (const s of steps) {
            if (s.status === 'in_progress') {
              if (foundFirst) s.status = 'pending'
              foundFirst = true
            }
          }
        }
        return steps
      }
      console.info(
        '[PlanDebug] state_update parsed but rawPlan empty, update keys:',
        update ? Object.keys(update as Record<string, unknown>) : 'N/A',
      )
    }
  }

  // 降级:从 node_start / node_end 配对派生(兼容旧事件)
  const map = new Map<string, PlanStep>()
  for (const evt of events) {
    if (evt.type === 'node_start') {
      const nodeId = evt.nodeId ?? `node-${evt.timestamp}`
      map.set(nodeId, {
        id: nodeId,
        step: nodeId,
        status: 'in_progress',
        startedAt: evt.timestamp,
      })
    } else if (evt.type === 'node_end') {
      const nodeId = evt.nodeId ?? ''
      const existing = nodeId ? map.get(nodeId) : undefined
      if (existing) {
        existing.status = 'completed'
        existing.endedAt = evt.timestamp
        const startMs = Date.parse(existing.startedAt ?? '')
        const endMs = Date.parse(evt.timestamp)
        if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
          existing.durationMs = Math.max(0, endMs - startMs)
        }
      }
    }
  }
  const steps = Array.from(map.values())
  // 硬规则:最多一个 in_progress
  const inProgressCount = steps.filter((s) => s.status === 'in_progress').length
  if (inProgressCount > 1) {
    let foundFirst = false
    for (const s of steps) {
      if (s.status === 'in_progress') {
        if (foundFirst) s.status = 'pending'
        foundFirst = true
      }
    }
  }
  return steps
}

/** 从 SSE 事件提取 Subagent(支持 subagent_spawn / subagent_end / subagent_status)
 *  v10 Phase 5:同时从 tool_call/tool_result 事件中按 data.subagentId 关联工具调用
 */
function extractSubagentsFromEvents(events: SSEEvent[]): Subagent[] {
  const map = new Map<string, Subagent>()
  let nicknameIndex = 0
  for (const evt of events) {
    if ((evt.type as string) === 'subagent_spawn') {
      const data = evt.data as
        | {
            threadId?: string
            id?: string
            role?: string
            task?: string
            nickname?: string
            pendingApproval?: boolean
          }
        | undefined
      const id = data?.id ?? data?.threadId ?? `sub-${evt.timestamp}`
      const threadId = data?.threadId ?? id
      const nickname = data?.nickname ?? deriveNickname(threadId, nicknameIndex)
      const color = COLOR_POOL[nicknameIndex % COLOR_POOL.length] ?? 'cyan'
      nicknameIndex++
      map.set(id, {
        id,
        threadId,
        nickname,
        handle: `@${nickname}`,
        color,
        status: 'running',
        role: data?.role,
        spawnedAt: evt.timestamp,
        currentTask: data?.task,
        pendingApproval: data?.pendingApproval,
        tools: [],
      })
    } else if ((evt.type as string) === 'subagent_end') {
      const data = evt.data as
        | {
            id?: string
            threadId?: string
            status?: 'done' | 'failed'
            error?: string
            failureReason?: string
            tokenUsage?: number
            toolCalls?: number
          }
        | undefined
      const id = data?.id ?? data?.threadId ?? ''
      const existing = id ? map.get(id) : undefined
      if (existing) {
        existing.status = data?.status ?? 'done'
        existing.endedAt = evt.timestamp
        const startMs = Date.parse(existing.spawnedAt)
        const endMs = Date.parse(evt.timestamp)
        if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
          existing.durationMs = Math.max(0, endMs - startMs)
        }
        // Codex:提取死亡原因 + 最终 token/工具调用统计
        const reason = data?.failureReason ?? data?.error
        if (reason) existing.failureReason = reason
        if (data?.tokenUsage !== undefined) existing.tokenUsage = data.tokenUsage
        if (data?.toolCalls !== undefined) existing.toolCalls = data.toolCalls
      }
    } else if ((evt.type as string) === 'subagent_status') {
      const data = evt.data as
        | {
            id?: string
            threadId?: string
            status?: SubagentStatus
            task?: string
            pendingApproval?: boolean
            tokenUsage?: number
            toolCalls?: number
            error?: string
            failureReason?: string
          }
        | undefined
      const id = data?.id ?? data?.threadId ?? ''
      const existing = id ? map.get(id) : undefined
      if (existing) {
        if (data?.status) existing.status = data.status
        if (data?.task !== undefined) existing.currentTask = data.task
        if (data?.pendingApproval !== undefined) existing.pendingApproval = data.pendingApproval
        // Codex:实时 token / tool 调用累计 + 死亡原因
        if (data?.tokenUsage !== undefined) existing.tokenUsage = data.tokenUsage
        if (data?.toolCalls !== undefined) existing.toolCalls = data.toolCalls
        const reason = data?.failureReason ?? data?.error
        if (reason) existing.failureReason = reason
      }
    }
  }

  // v10 Phase 5:从 tool_call/tool_result 事件中按 data.subagentId 关联工具调用
  const toolMap = new Map<string, AgentToolCall>()
  for (const evt of events) {
    if (evt.type !== 'tool_call' && evt.type !== 'tool_result') continue
    const data = evt.data as { subagentId?: string; id?: string } | undefined
    const subagentId = data?.subagentId
    if (!subagentId) continue
    const existing = map.get(subagentId)
    if (!existing) continue
    // 初始化 tools 数组
    if (!existing.tools) existing.tools = []

    if (evt.type === 'tool_call') {
      const toolData = parseToolData(evt.data)
      const id = toolData.id ?? `tool-${evt.timestamp}`
      const toolName = toolData.name ?? toolData.toolName ?? 'unknown'
      const args = toolData.args ?? toolData.arguments ?? {}
      const tool: AgentToolCall = {
        id,
        toolName,
        args,
        status: 'running',
        startedAt: evt.timestamp,
        iteration: toolData.iteration,
      }
      toolMap.set(id, tool)
      existing.tools.push(tool)
    } else if (evt.type === 'tool_result') {
      const toolData = parseToolData(evt.data)
      const id = toolData.id ?? ''
      const tool = id ? toolMap.get(id) : undefined
      if (tool) {
        tool.status = toolData.error ? 'error' : 'success'
        tool.result = toolData.result
        tool.error = toolData.error
        tool.endedAt = evt.timestamp
        const startMs = Date.parse(tool.startedAt)
        const endMs = Date.parse(evt.timestamp)
        if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
          tool.durationMs = Math.max(0, endMs - startMs)
        }
      }
    }
  }

  return Array.from(map.values())
}

/** 从 SSE 事件提取 TerminalTask(支持 terminal_start / terminal_end) */
function extractTerminalsFromEvents(events: SSEEvent[]): TerminalTask[] {
  const map = new Map<string, TerminalTask>()
  for (const evt of events) {
    if ((evt.type as string) === 'terminal_start') {
      const data = evt.data as { id?: string; command?: string } | undefined
      const id = data?.id ?? `term-${evt.timestamp}`
      map.set(id, {
        id,
        command: data?.command ?? '',
        status: 'running',
        startedAt: evt.timestamp,
      })
    } else if ((evt.type as string) === 'terminal_end') {
      const data = evt.data as
        { id?: string; status?: TerminalStatus; output?: string; exitCode?: number } | undefined
      const id = data?.id ?? ''
      const existing = id ? map.get(id) : undefined
      if (existing) {
        existing.status = data?.status ?? 'completed'
        existing.output = data?.output
        existing.endedAt = evt.timestamp
        const startMs = Date.parse(existing.startedAt)
        const endMs = Date.parse(evt.timestamp)
        if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
          existing.durationMs = Math.max(0, endMs - startMs)
        }
        // Codex:提取退出码(若未提供,根据 status 推导:completed=0 / failed=1)
        if (data?.exitCode !== undefined) {
          existing.exitCode = data.exitCode
        } else if (existing.status === 'completed') {
          existing.exitCode = 0
        } else if (existing.status === 'failed') {
          existing.exitCode = 1
        }
      }
    }
  }
  return Array.from(map.values())
}

/**
 * 主 hook:传入 threadId,返回聚合后的三栏数据
 */
export function useAgentProgress(threadId: string | null): UseAgentProgressReturn {
  const effectiveThreadId = threadId ?? ''
  const stream = useAgentStream({
    threadId: effectiveThreadId,
    onDone: () => {},
    onError: () => {},
    autoReconnect: true,
  })

  const {
    events,
    isStreaming,
    currentNode,
    content,
    lastPlan,
    error,
    interruptEvent,
    reconnectAttempt,
  } = stream

  // 聚合 planSteps(Codex 三状态 + explanation + 最多一个 in_progress 硬规则)
  const planSteps = React.useMemo<PlanStep[]>(() => extractPlanFromEvents(events), [events])

  // 聚合 subagents(Codex 昵称 + @handle + dead agents 可见)
  const subagents = React.useMemo<Subagent[]>(() => extractSubagentsFromEvents(events), [events])

  // 聚合 terminals
  const terminals = React.useMemo<TerminalTask[]>(
    () => extractTerminalsFromEvents(events),
    [events],
  )

  // 聚合 tools(保留原有,用于 changes 派生)
  const tools = React.useMemo<AgentToolCall[]>(() => {
    const map = new Map<string, AgentToolCall>()
    for (const evt of events) {
      if (evt.type === 'tool_call') {
        const data = parseToolData(evt.data)
        const id = data.id ?? `tool-${evt.timestamp}`
        const toolName = data.name ?? data.toolName ?? 'unknown'
        const args = data.args ?? data.arguments ?? {}
        map.set(id, {
          id,
          toolName,
          args,
          status: 'running',
          startedAt: evt.timestamp,
          iteration: data.iteration,
        })
      } else if (evt.type === 'tool_result') {
        const data = parseToolData(evt.data)
        const id = data.id ?? ''
        const existing = id ? map.get(id) : undefined
        if (existing) {
          existing.status = data.error ? 'error' : 'success'
          existing.result = data.result
          existing.error = data.error
          existing.endedAt = evt.timestamp
          const startMs = Date.parse(existing.startedAt)
          const endMs = Date.parse(evt.timestamp)
          if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
            existing.durationMs = Math.max(0, endMs - startMs)
          }
        }
      }
    }
    return Array.from(map.values())
  }, [events])

  // 聚合 changes
  const changes = React.useMemo<AgentChange[]>(() => {
    const result: AgentChange[] = []
    for (const tool of tools) {
      if (!CHANGE_TOOL_NAMES.has(tool.toolName)) continue
      const diffInfo = deriveDiffInfoFromArgs(tool.toolName, tool.args)
      if (!diffInfo) continue
      result.push({
        id: tool.id,
        filePath: diffInfo.file_path,
        toolName: tool.toolName,
        diffInfo,
        timestamp: tool.endedAt ?? tool.startedAt,
      })
    }
    return result
  }, [tools])

  // 聚合 overview:综合 stream 状态 + 计数
  const overview = React.useMemo<AgentOverview>(() => {
    let status: AgentOverview['status'] = 'idle'
    if (isStreaming) status = 'running'
    else if (error) status = 'failed'
    else if (interruptEvent) status = 'interrupted'
    else if (events.some((e) => e.type === 'done')) status = 'completed'

    const sessionEvent = events.find((e) => e.type === 'session')
    const completedSteps = planSteps.filter((s) => s.status === 'completed').length
    const inProgressSteps = planSteps.filter((s) => s.status === 'in_progress').length
    const pendingSteps = planSteps.filter((s) => s.status === 'pending').length
    const activeSubagents = subagents.filter(
      (s) => s.status === 'running' || s.status === 'spawned',
    ).length
    const deadSubagents = subagents.filter(
      (s) => s.status === 'done' || s.status === 'failed' || s.status === 'dead',
    ).length
    const runningTerminals = terminals.filter((t) => t.status === 'running').length

    // 历史耗时样本(已完成的 plan steps duration,用于 bracket 分位数)
    const historicalDurations = planSteps
      .filter((s) => s.status === 'completed' && s.durationMs !== undefined)
      .map((s) => s.durationMs as number)

    return {
      status,
      currentNode,
      plan: lastPlan,
      content,
      error,
      interruptEvent,
      sessionStart: sessionEvent?.timestamp ?? null,
      totalSteps: planSteps.length,
      completedSteps,
      inProgressSteps,
      pendingSteps,
      totalSubagents: subagents.length,
      activeSubagents,
      deadSubagents,
      totalTerminals: terminals.length,
      runningTerminals,
      totalChanges: changes.length,
      historicalDurations,
      reconnectAttempt,
    }
  }, [
    events,
    isStreaming,
    error,
    interruptEvent,
    currentNode,
    lastPlan,
    content,
    planSteps,
    subagents,
    terminals,
    changes,
    reconnectAttempt,
  ])

  // 聚合 currentTask(2026-08-02 新增,TaskListPopover 实时显示用)
  // 优先级:进行中的工具调用 > 进行中的子代理 > 进行中的终端 > in_progress 的 plan step(规划)
  const currentTask = React.useMemo<CurrentTask>(() => {
    if (!isStreaming) return { kind: 'idle', label: '' }
    // 1) 优先:取最后一个仍为 running 的 tool_call(最新的活动)
    const runningTool = tools.find((t) => t.status === 'running')
    if (runningTool) {
      const toolName = runningTool.toolName
      // 识别 MCP/插件命名约定:通常以 mcp_/plugin_ 前缀或包含 mcp/plugin 关键字
      if (toolName.startsWith('mcp_') || toolName.includes('mcp__')) {
        const mcpName = toolName.replace(/^mcp_+|mcp__+/g, '').split('__')[0] || toolName
        return { kind: 'tool', label: `调用 ${mcpName} MCP`, toolName, mcpName }
      }
      if (toolName.startsWith('plugin_') || toolName.startsWith('dispatch_')) {
        const pluginName = toolName.replace(/^(plugin_|dispatch_)/, '').split('_')[0] || toolName
        return { kind: 'tool', label: `调用 ${pluginName} 插件`, toolName, pluginName }
      }
      // 通用工具调用
      return { kind: 'tool', label: `调用 ${toolName}`, toolName }
    }
    // 2) 子代理进行中
    const runningSub = subagents.find((s) => s.status === 'running' || s.status === 'spawned')
    if (runningSub) {
      const task = runningSub.currentTask ?? runningSub.handle
      return { kind: 'subagent', label: `子代理 ${task}` }
    }
    // 3) 终端进行中
    const runningTerm = terminals.find((t) => t.status === 'running')
    if (runningTerm) {
      return { kind: 'terminal', label: '执行终端命令' }
    }
    // 4) plan step 处于 in_progress → 规划进度
    const planningStep = planSteps.find((s) => s.status === 'in_progress')
    if (planningStep) {
      return { kind: 'planning', label: '规划进度' }
    }
    // 5) 流式但无活动 → 通用"执行中"
    return { kind: 'idle', label: '执行中' }
  }, [isStreaming, tools, subagents, terminals, planSteps])

  return {
    overview,
    planSteps,
    subagents,
    terminals,
    tools,
    changes,
    currentTask,
    events,
    isStreaming,
    start: stream.start,
    stop: stream.stop,
    clear: stream.clear,
  }
}
