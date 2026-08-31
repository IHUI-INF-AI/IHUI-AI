// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useChatStore, type ToolCall } from '@/stores/chat'
import { useWorkPanelStore } from '@/stores/work-panel'
import type { ToolSummaryEvent } from '@ihui/api-client'
import { BROWSER_TOOL_NAMES, extractToolUrl } from './tool-config'

export function createToolCallHandler(assistantMessageId: string) {
  return (event: {
    type: 'tool-call-start' | 'tool-result'
    toolCallId: string
    toolName: string
    args?: Record<string, unknown>
    result?: unknown
    isError?: boolean
    iteration?: number
    repeated?: boolean
    // 2026-07-31 立,AI 对话可视化:工具来源标识(从 SSE 透传到 ToolCallCard 徽章)
    serverSource?: 'builtin' | 'plugin' | 'mcp'
    serverId?: string
    serverName?: string
  }) => {
    if (event.type === 'tool-call-start') {
      useChatStore.getState().addToolCall(assistantMessageId, {
        id: event.toolCallId,
        toolName: event.toolName,
        args: event.args ?? {},
        status: 'running',
        iteration: event.iteration,
        serverSource: event.serverSource,
        serverId: event.serverId,
        serverName: event.serverName,
      })
      // browser_navigate 类工具:args 含 url 时立即打开 WorkPanel(无需等 result)
      if (BROWSER_TOOL_NAMES.has(event.toolName) && event.args) {
        const url = extractToolUrl(event.args)
        if (url) {
          useWorkPanelStore.getState().openPanel({ url, source: 'ai-tool' })
        }
      }
    } else {
      // tool-result
      const updates: Partial<ToolCall> = {
        status: event.isError ? 'error' : 'success',
        result: event.result,
        serverSource: event.serverSource,
        serverId: event.serverId,
        serverName: event.serverName,
      }
      if (event.args) updates.args = event.args
      if (event.iteration !== undefined) updates.iteration = event.iteration
      // 后端 repeated: true 标记(同 tool_name + 同 args 已执行过,跳过实际调用)
      if (event.repeated === true) updates.repeated = true
      useChatStore.getState().updateToolCall(assistantMessageId, event.toolCallId, updates)

      // tool-result 含 URL:延迟打开(仅当之前 args 没 url 时,result 含 url 的场景)
      if (!BROWSER_TOOL_NAMES.has(event.toolName)) return
      const url = extractToolUrl(event.args, event.result)
      if (url) {
        useWorkPanelStore.getState().openPanel({ url, source: 'ai-tool' })
      }
    }
  }
}

/**
 * onToolSummary 工厂(2026-07-31 立,AI 对话可视化深度接入):
 * 绑定 assistantMessageId,把 SSE tool-summary 事件聚合结果写入 message.toolCallSummary,
 * 让 ToolCallSummary 组件在 AI 回复末尾展示"搜索文件 N 个/网页 N 个/改了 N 个文件/N 行代码"。
 */
export function createToolSummaryHandler(assistantMessageId: string) {
  return (summary: ToolSummaryEvent) => {
    useChatStore.getState().setMessageToolSummary(assistantMessageId, summary)
  }
}

/**
 * #9 流式 token 节流(2026-07-25 立):
 * 用 requestAnimationFrame 每帧合并一次 token,避免每个 token 触发 store 更新 + React 重渲染。
 * - batch(delta):累加 delta,标记 dirty,下帧 flush
 * - flush():立即把累积 delta 一次性 append(用于错误/中止前最后冲刺)
 * - cancel():取消 raf,清空累积(用于 finally)
 */
export function createDeltaBatcher(appendFn: (delta: string) => void) {
  let pending = ''
  let rafId: number | null = null
  const flush = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (pending) {
      const d = pending
      pending = ''
      appendFn(d)
    }
  }
  const batch = (delta: string) => {
    pending += delta
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (pending) {
          const d = pending
          pending = ''
          appendFn(d)
        }
      })
    }
  }
  const cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    pending = ''
  }
  return { batch, flush, cancel }
}

/**
 * #9 多 agent stream 节流(2026-07-25 立):
 * 单一 manager 管理多个 agentId 各自的 batcher,flushAll/cancelAll 统一清理。
 */
export function createAgentDeltaBatcher() {
  const map = new Map<string, ReturnType<typeof createDeltaBatcher>>()
  const batch = (agentId: string, delta: string) => {
    let b = map.get(agentId)
    if (!b) {
      b = createDeltaBatcher((d) => useChatStore.getState().appendToAgentStream(agentId, d))
      map.set(agentId, b)
    }
    b.batch(delta)
  }
  const flushAll = () => {
    for (const b of map.values()) b.flush()
  }
  const cancelAll = () => {
    for (const b of map.values()) b.cancel()
    map.clear()
  }
  return { batch, flushAll, cancelAll }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
