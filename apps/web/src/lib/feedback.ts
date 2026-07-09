import type { ComponentType } from 'react'
import { Bug, Lightbulb, Wrench, HelpCircle } from 'lucide-react'

import { fetchApi } from '@/lib/api'

export type FeedbackType = 'bug' | 'feature' | 'improvement' | 'other'
export type FeedbackStatus = 'pending' | 'reviewing' | 'resolved' | 'closed'
export type Priority = 'low' | 'medium' | 'high'

export interface FeedbackItem {
  id: string
  title: string
  content: string
  type: FeedbackType
  status: FeedbackStatus
  priority: Priority
  contact?: string
  user?: string
  adminReply?: string
  createdAt: string
  updatedAt?: string
}

export type IconType = ComponentType<{ className?: string }>

export const TYPE_ICON: Record<FeedbackType, IconType> = {
  bug: Bug,
  feature: Lightbulb,
  improvement: Wrench,
  other: HelpCircle,
}

export const TYPE_BADGE: Record<FeedbackType, string> = {
  bug: 'bg-red-500/10 text-red-600 dark:text-red-400',
  feature: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  improvement: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  other: 'bg-muted text-muted-foreground',
}

export const STATUS_BADGE: Record<FeedbackStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  reviewing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  resolved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  closed: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
}

export const PRIORITY_BADGE: Record<Priority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  high: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
