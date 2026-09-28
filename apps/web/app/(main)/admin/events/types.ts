// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export type EventType = 'startup' | 'shutdown' | 'error' | 'warning' | 'maintenance' | 'deploy'
export type Level = 'info' | 'warn' | 'error'

export interface SystemEvent {
  id: string
  type: EventType
  level: Level
  message: string
  data?: Record<string, unknown> | null
  createdAt: string
}

export interface EventForm {
  type: EventType
  level: Level
  message: string
  data: string
}
