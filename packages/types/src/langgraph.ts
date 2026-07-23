/** LangGraph checkpoint 状态 */
export interface LangGraphCheckpoint {
  threadId: string
  checkpointId: string
  parentId: string | null
  nodeId: string
  state: Record<string, unknown>
  createdAt: string
}

/** LangGraph interrupt 事件(节点暂停等待人工介入) */
export interface InterruptEvent {
  threadId: string
  nodeId: string
  interruptId: string
  reason: string
  payload: unknown
  createdAt: string
}

/** LangGraph resume 命令(恢复暂停的节点) */
export interface ResumeCommand {
  threadId: string
  interruptId: string
  resumeValue: unknown
  action: 'resume' | 'rollback' | 'cancel'
}

/** LangGraph streaming 模式 */
export type StreamMode = 'updates' | 'messages' | 'events' | 'values' | 'debug'

/** LangGraph SSE 事件类型(12 类) */
export type SSEEventType =
  | 'session'
  | 'token'
  | 'node_start'
  | 'node_end'
  | 'tool_call'
  | 'tool_result'
  | 'state_update'
  | 'plan'
  | 'interrupt'
  | 'done'
  | 'error'
  | 'custom'

/** LangGraph SSE 事件 */
export interface SSEEvent {
  type: SSEEventType
  threadId: string
  nodeId?: string
  data: unknown
  timestamp: string
}

/** LangGraph 节点执行结果 */
export interface NodeExecutionResult {
  nodeId: string
  status: 'success' | 'failed' | 'interrupted' | 'skipped'
  output?: unknown
  error?: string
  durationMs: number
}

/** LangGraph 历史记录条目(Time Travel 用) */
export interface HistoryEntry {
  checkpointId: string
  nodeId: string
  state: Record<string, unknown>
  createdAt: string
  parentCheckpointId: string | null
}
