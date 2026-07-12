import type { ComponentType } from 'react'
import { AlertTriangle, Bell } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import type { Alert } from './types'

export const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const LEVEL_STYLE: Record<
  Alert['level'],
  { bg: string; text: string; icon: ComponentType<{ className?: string }> }
> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-600', icon: AlertTriangle },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-600', icon: AlertTriangle },
  info: { bg: 'bg-primary/10', text: 'text-primary', icon: Bell },
}

export const STATUS_LABEL: Record<Alert['status'], string> = {
  active: '活跃',
  acknowledged: '已确认',
  resolved: '已解决',
}

export const STATUS_STYLE: Record<Alert['status'], string> = {
  active: 'bg-red-500/10 text-red-600',
  acknowledged: 'bg-amber-500/10 text-amber-600',
  resolved: 'bg-emerald-500/10 text-emerald-600',
}
