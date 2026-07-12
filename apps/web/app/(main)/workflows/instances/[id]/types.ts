export type InstStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface Instance {
  id: string
  status: InstStatus
  workflowId?: string
  workflowName?: string
  startedAt?: string
  completedAt?: string
  input?: unknown
  output?: unknown
}

export interface Task {
  id: string
  step: number
  name: string
  type: string
  status: InstStatus
  input?: unknown
  output?: unknown
}

export interface Log {
  id: string
  timestamp: string
  level: LogLevel
  message: string
}
