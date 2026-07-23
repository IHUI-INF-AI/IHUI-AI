/**
 * 三端联动任务调度跨端共享类型(2026-07-23 立)。
 * mobile-rn 下发 → api WebSocket → desktop 接收执行 → 结果回推。
 */

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface TaskDispatch {
  id: string
  userId: number
  fromDevice: string
  toDevice: string
  command: string
  status: TaskStatus
  createdAt: string
  updatedAt: string
  result?: TaskResult
}

export interface TaskResult {
  taskId: string
  status: TaskStatus
  output?: string
  error?: string
  finishedAt: string
}

export interface TaskDispatchRequest {
  toDevice: string
  command: string
}

export interface TaskDispatchResponse {
  task: TaskDispatch
}

export interface TaskResultRequest {
  taskId: string
  status: TaskStatus
  output?: string
  error?: string
}

export interface TaskWsMessage {
  type: 'task-dispatch' | 'task-result' | 'task-progress'
  taskId: string
  payload: TaskDispatch | TaskResult
}
