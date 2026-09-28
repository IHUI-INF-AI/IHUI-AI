// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
  error?: string
}

export interface Task {
  id: string
  step: number
  name: string
  type: string
  status: InstStatus
  input?: unknown
  output?: unknown
  error?: string
}

export interface Log {
  id: string
  timestamp: string
  level: LogLevel
  message: string
}
