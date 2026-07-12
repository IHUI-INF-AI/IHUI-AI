import type * as React from 'react'
import { Server, Database, Cpu, Brain } from 'lucide-react'

export interface ServiceItem {
  name: string
  status: 'healthy' | 'unhealthy'
  latency: number
}

export interface PerfItem {
  cpu: number
  memory: number
  qps: number
  avgResponse: number
}

export interface AlertItem {
  id: string
  level: 'critical' | 'warning' | 'info'
  message: string
  time: string
}

export interface LogSummary {
  total: number
  errors: number
  warnings: number
  recent: { id: string; level: string; message: string; time: string }[]
}

export const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  API: Server,
  DB: Database,
  Redis: Cpu,
  'AI-Service': Brain,
}

export const ALERT_STYLE: Record<AlertItem['level'], { bg: string; text: string }> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-600' },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-600' },
  info: { bg: 'bg-primary/10', text: 'text-primary' },
}
