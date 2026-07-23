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
 * 所有响应统一 `{ code, message, data }` 格式,本文件仅返回 data 字段。
 */

interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

async function callApi<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiResponse<T>
  if (!res.ok || json.code !== 0) {
    throw new Error(json.message || `请求失败 (${res.status})`)
  }
  return json.data
}

/** 触发节点暂停,等待人工介入 */
export async function triggerInterrupt(
  threadId: string,
  nodeId: string,
  reason: string,
  payload?: unknown,
): Promise<InterruptEvent> {
  const res = await fetch(`/api/agent-langgraph/${threadId}/interrupt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodeId, reason, payload }),
  })
  return callApi<InterruptEvent>(res)
}

/** 恢复执行 / 回滚 / 取消 */
export async function resumeExecution(
  threadId: string,
  interruptId: string,
  resumeValue: unknown,
  action: ResumeCommand['action'] = 'resume',
): Promise<{ ok: true }> {
  const res = await fetch(`/api/agent-langgraph/${threadId}/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interruptId, resumeValue, action }),
  })
  return callApi<{ ok: true }>(res)
}

/** 查询当前 thread checkpoint 状态 */
export async function getThreadState(
  threadId: string,
): Promise<LangGraphCheckpoint | null> {
  const res = await fetch(`/api/agent-langgraph/${threadId}/state`)
  if (res.status === 404) return null
  return callApi<LangGraphCheckpoint | null>(res)
}

/** 查询历史 checkpoint 列表(Time Travel 入口) */
export async function getThreadHistory(
  threadId: string,
  limit = 100,
): Promise<HistoryEntry[]> {
  const res = await fetch(
    `/api/agent-langgraph/${threadId}/history?limit=${limit}`,
  )
  return callApi<HistoryEntry[]>(res)
}
