export type {
  CrewAgentRole,
  CrewSessionConfig,
  CrewSessionDetail,
  CrewTaskItem,
  CrewMessageItem,
  CrewArtifactItem,
  CrewStreamEvent,
} from '@ihui/api-client/endpoints/crew'

/** 创建会话表单 */
export interface CreateSessionForm {
  userId: string
  title: string
  inputMessage: string
  collectionName: string
  modelId: string
  maxRetries: number
}

/** 健康状态 */
export interface HealthState {
  status: string
  service?: string
  ok: boolean
}

/**
 * 流式日志条目。
 * `type` 字段使用 string 联合（与 CrewStreamEvent['type'] 一致），
 * 避免通过 re-export 链跨包传递类型时出现的解析问题。
 */
export type StreamEventType =
  | 'start'
  | 'planning'
  | 'plan'
  | 'task_start'
  | 'task_complete'
  | 'task_error'
  | 'complete'
  | 'error'

export interface StreamLogEntry {
  type: StreamEventType
  text: string
  ts: number
}

/** 解析 SSE 流的辅助:从 chunk 文本中分割出 event/data 行 */
export interface ParsedSseEvent {
  event: string
  data: string
}
