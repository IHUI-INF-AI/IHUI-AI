import { fetchApi } from '@/lib/api'
import type {
  HistoryEntry,
  InterruptEvent,
  LangGraphCheckpoint,
  ResumeCommand,
} from '@ihui/types'

/**
 * LangGraph Agent HTTP API 客户端(2026-07-23 立,Q1 HITL web 端)
 *
 * 端点契约(由 apps/api 的 agent-langgraph 路由注册):
 *  - POST /api/agent-langgraph/:threadId/interrupt  触发暂停
 *  - POST /api/agent-langgraph/:threadId/resume     恢复执行
 *  - GET  /api/agent-langgraph/:threadId/state       查询当前 checkpoint
 *  - GET  /api/agent-langgraph/:threadId/history     查询历史(Time Travel)
 *  - GET  /api/agent-langgraph/:threadId/stream      SSE 流式输出(由 use-agent-stream 消费)
 *
 * 所有响应统一 `{ code, message, data }` 格式,fetchApi 自动解包并返回 data 字段。
 */

/** 触发节点暂停,等待人工介入 */
export async function triggerInterrupt(
  threadId: string,
  nodeId: string,
  reason: string,
  payload?: unknown,
): Promise<InterruptEvent> {
  const r = await fetchApi<InterruptEvent>(
    `/api/agent-langgraph/${threadId}/interrupt`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId, reason, payload }),
    },
  )
  if (!r.success) throw new Error(r.error)
  return r.data
}

/** 恢复执行 / 回滚 / 取消 */
export async function resumeExecution(
  threadId: string,
  interruptId: string,
  resumeValue: unknown,
  action: ResumeCommand['action'] = 'resume',
): Promise<{ ok: true }> {
  const r = await fetchApi<{ ok: true }>(
    `/api/agent-langgraph/${threadId}/resume`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interruptId, resumeValue, action }),
    },
  )
  if (!r.success) throw new Error(r.error)
  return r.data
}

/** 查询当前 thread checkpoint 状态 */
export async function getThreadState(
  threadId: string,
): Promise<LangGraphCheckpoint | null> {
  const r = await fetchApi<LangGraphCheckpoint | null>(
    `/api/agent-langgraph/${threadId}/state`,
  )
  if (!r.success) {
    // 404 表示 thread 不存在,返回 null(与历史行为一致)
    if (r.status === 404) return null
    throw new Error(r.error)
  }
  return r.data
}

/** 查询历史 checkpoint 列表(Time Travel 入口) */
export async function getThreadHistory(
  threadId: string,
  limit = 100,
): Promise<HistoryEntry[]> {
  const r = await fetchApi<HistoryEntry[]>(
    `/api/agent-langgraph/${threadId}/history?limit=${limit}`,
  )
  if (!r.success) throw new Error(r.error)
  return r.data
}
