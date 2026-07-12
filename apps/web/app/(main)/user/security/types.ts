export interface Device {
  id: string
  name: string
  ip: string
  lastActive: string
  current: boolean
}

export type FormMsg = { type: 'ok' | 'err'; text: string } | null
