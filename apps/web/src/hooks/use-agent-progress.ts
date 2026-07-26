'use client'

import * as React from 'react'
import type { SSEEvent } from '@ihui/types'
import { useAgentStream } from './use-agent-stream'
import type { InlineDiffInfo } from '@/components/ai/types'

/**
 * use-agent-progress — Codex 风格 Agent 进度聚合 hook(2026-07-27 立)
 *
 * 职责:把 useAgentStream 收到的原始 SSEEvent 流聚合为 4 个 tab 的派生数据:
 * - overview:任务总览(状态 / 当前节点 / 计划 / 输出 / 错误 / 计数)
 * - steps:节点执行序列(node_start → node_end 配对)
 * - tools:工具调用序列(tool_call → tool_result 配对)
 * - changes:文件变更序列(edit_file / write_file 的 diff 信息)
 *
 * 数据流:
 *   useAgentStream(threadId) → events[]
 *     → useMemo 聚合 → { overview, steps, tools, changes }
 *
 * 不在 store 中缓存派生数据:Drawer 关闭时 hook 卸载,数据自然释放;
 * 重新打开 Drawer 时 useAgentStream 会保留 events(内部 state),
 * 聚合 useMemo 重新计算,无性能问题(events ≤ MAX_EVENTS=200)。
 */

/** 节点步骤(对应 LangGraph node) */
export interface AgentStep {
  id: string
  nodeId: string
  status: 'running' | 'done' | 'error'
  startedAt: string
  endedAt?: string
  durationMs?: number
}

/** 工具调用(tool_call + tool_result 配对) */
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

/** 文件变更(edit_file / write_file 工具产生的 diff) */
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
  totalTools: number
  completedTools: number
  totalChanges: number
}

export interface UseAgentProgressReturn {
  overview: AgentOverview
  steps: AgentStep[]
  tools: AgentToolCall[]
  changes: AgentChange[]
  isStreaming: boolean
  start: (input?: Record<string, unknown>) => void
  stop: () => void
  clear: () => void
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

/** 从 tool args 推导 InlineDiffInfo(复用 tool-call-card.tsx 的同名逻辑,但解耦) */
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

  const filePath =
    pickStr(['path', 'file_path', 'filePath', 'filename']) || '(未知文件)'

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

/** 工具名是否属于文件变更类(用于 changes tab) */
const CHANGE_TOOL_NAMES = new Set(['edit_file', 'write_file'])

/**
 * 主 hook:传入 threadId,返回聚合后的 4 tab 数据
 *
 * 用法:
 *   const progress = useAgentProgress(threadId)
 *   progress.start({ message: '帮我看下这个仓库' })
 */
export function useAgentProgress(threadId: string | null): UseAgentProgressReturn {
  // useAgentStream 要求 threadId 为 string,空值传 '' 内部 start 会直接 return
  const effectiveThreadId = threadId ?? ''
  const stream = useAgentStream({
    threadId: effectiveThreadId,
    onDone: () => {},
    onError: () => {},
  })

  const { events, isStreaming, currentNode, content, lastPlan, error, interruptEvent } = stream

  // 聚合 steps:遍历 events,把 node_start / node_end 配对
  const steps = React.useMemo<AgentStep[]>(() => {
    const map = new Map<string, AgentStep>()
    for (const evt of events) {
      if (evt.type === 'node_start') {
        const nodeId = evt.nodeId ?? `node-${evt.timestamp}`
        map.set(nodeId, {
          id: nodeId,
          nodeId,
          status: 'running',
          startedAt: evt.timestamp,
        })
      } else if (evt.type === 'node_end') {
        const nodeId = evt.nodeId ?? ''
        const existing = nodeId ? map.get(nodeId) : undefined
        if (existing) {
          existing.status = 'done'
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

  // 聚合 tools:tool_call / tool_result 配对
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

  // 聚合 changes:从已完成的 tools 中提取 edit_file/write_file
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
    const completedSteps = steps.filter((s) => s.status === 'done').length
    const completedTools = tools.filter((t) => t.status === 'success').length

    return {
      status,
      currentNode,
      plan: lastPlan,
      content,
      error,
      interruptEvent,
      sessionStart: sessionEvent?.timestamp ?? null,
      totalSteps: steps.length,
      completedSteps,
      totalTools: tools.length,
      completedTools,
      totalChanges: changes.length,
    }
  }, [events, isStreaming, error, interruptEvent, currentNode, lastPlan, content, steps, tools, changes])

  return {
    overview,
    steps,
    tools,
    changes,
    isStreaming,
    start: stream.start,
    stop: stream.stop,
    clear: stream.clear,
  }
}
