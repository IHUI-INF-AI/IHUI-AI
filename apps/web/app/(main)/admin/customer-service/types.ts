import { fetchApi } from '@/lib/api'
import type { CsMessage } from '@/components/customer-service/MessageBubble'

export type TicketStatus = 'pending' | 'open' | 'resolved' | 'closed' | 'rejected'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
export type AgentStatus = 'online' | 'busy' | 'away' | 'offline'

export interface Category {
  id: string
  name: string
  slug: string
  description?: string | null
  sortOrder: number
}

export interface Ticket {
  id: string
  ticketNo: string
  userId: string
  categoryId: string | null
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  assigneeId: string | null
  source: string
  attachments: unknown[]
  resolvedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Comment {
  id: string
  ticketId: string
  userId: string
  content: string
  isAdmin: boolean
  attachments: unknown[]
  createdAt: string
}

export interface Agent {
  id: string
  userId: string
  nickname: string
  avatar: string | null
  status: AgentStatus
  maxConcurrent: number
  currentLoad: number
  skills: string[]
  createdAt: string
}

export interface CsSession {
  id: string
  userId: string
  userName: string
  userAvatar: string | null
  lastMessage: string
  lastTime: string
  unread: number
  messages: CsMessage[]
}

export interface CsStats {
  onlineAgents: number
  waiting: number
  todayProcessed: number
}

export type SessionsData = { list: CsSession[] } | CsSession[]

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const STATUS_LABEL: Record<TicketStatus, string> = {
  pending: '待处理',
  open: '处理中',
  resolved: '已解决',
  closed: '已关闭',
  rejected: '已驳回',
}

export const STATUS_BADGE: Record<TicketStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  open: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  resolved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  closed: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
}

export const PRIORITY_BADGE: Record<TicketPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  urgent: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

export const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  online: '在线',
  busy: '忙碌',
  away: '离开',
  offline: '离线',
}

export const AGENT_STATUS_BADGE: Record<AgentStatus, string> = {
  online: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  busy: 'bg-red-500/10 text-red-600 dark:text-red-400',
  away: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  offline: 'bg-muted text-muted-foreground',
}

export const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  pending: ['open', 'rejected', 'closed'],
  open: ['resolved', 'closed', 'rejected'],
  resolved: ['closed', 'open'],
  rejected: ['open', 'closed'],
  closed: ['open'],
}

export const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
