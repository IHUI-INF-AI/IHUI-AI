import { unwrapApi as api } from '@/lib/api-helpers'
import { textareaClass } from '@/lib/form-styles'
import type { CsMessage } from '@/components/customer-service/MessageBubble'
import type {
  CsAgent,
  CsAgentStatus as AgentStatus,
  CsCategory,
  CsStats,
  CsTicket,
  CsTicketComment,
  CsTicketPriority as TicketPriority,
  CsTicketStatus as TicketStatus,
} from '@ihui/types'

export { api, textareaClass }

export type { TicketStatus, TicketPriority, AgentStatus }
export type Category = CsCategory
export type Ticket = CsTicket
export type Comment = CsTicketComment
export type Agent = CsAgent
export type { CsStats }

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

// 会话列表响应:本地化定义以使用 CsSession(messages: CsMessage[] 精确类型)
// 而非 @ihui/types 的 CsSessionBase(messages: unknown[] 占位)。
// 运行时后端返回的 messages 即为 CsMessage[],此处类型断言由调用方 fetchApi<SessionsData> 承载。
export type SessionsData = { list: CsSession[] } | CsSession[]

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
