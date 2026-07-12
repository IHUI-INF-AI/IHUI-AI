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
