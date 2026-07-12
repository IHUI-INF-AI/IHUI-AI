import { fetchApi } from '@/lib/api'
import { createWebSocketHook } from '@/hooks/create-websocket-hook'
import type { WsChatMsg } from './types'

export function buildChatWsUrl(token: string | null): string {
  if (typeof window === 'undefined' || !token) return ''
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const path = process.env.NEXT_PUBLIC_WS_CHAT_URL || '/ws/chat'
  return `${proto}//${window.location.host}${path}?token=${encodeURIComponent(token)}`
}

export function isWsChatMsg(d: unknown): d is WsChatMsg {
  return typeof d === 'object' && d !== null && ('type' in d || 'event' in d)
}

export const useChatWs = createWebSocketHook<WsChatMsg>({
  urlBuilder: buildChatWsUrl,
  messageGuard: isWsChatMsg,
})

export const EDIT_FIELDS: { key: string; label: string; type?: 'date' | 'textarea' }[] = [
  { key: 'agentId', label: 'Agent ID' },
  { key: 'agentName', label: 'Agent名称' },
  { key: 'categoryId', label: '分类ID' },
  { key: 'startTime', label: '开始时间', type: 'date' },
  { key: 'startUser', label: '发起用户' },
  { key: 'startPhone', label: '发起电话' },
  { key: 'startName', label: '发起人' },
  { key: 'examineUser', label: '审核人' },
  { key: 'examineUserId', label: '审核人ID' },
  { key: 'examineTime', label: '审核时间', type: 'date' },
  { key: 'desc', label: '描述', type: 'textarea' },
  { key: 'follow', label: '跟进', type: 'textarea' },
  { key: 'agentAvatar', label: '头像', type: 'textarea' },
  { key: 'prologue', label: '开场白', type: 'textarea' },
]

export const SEARCH_FIELDS: { key: string; label: string }[] = [
  { key: 'agentName', label: 'Agent名称' },
  { key: 'agentCreatTime', label: '创建时间' },
  { key: 'reviewTime', label: '审核时间' },
  { key: 'saleType', label: '销售方式' },
  { key: 'agentPeople', label: '面向群体' },
  { key: 'developer', label: '开发者' },
  { key: 'reviewName', label: '审核人' },
  { key: 'reviewStatus', label: '审核状态' },
]

export const AGENT_INFO: { key: string; label: string }[] = [
  { key: 'group', label: '序号' },
  { key: 'type', label: '状态' },
  { key: 'agentName', label: 'Agent名称' },
  { key: 'agentDesc', label: '描述' },
  { key: 'agentImage', label: '图片' },
  { key: 'agentType', label: '类型' },
  { key: 'createTime', label: '创建时间' },
  { key: 'agentSaleMethod', label: '销售方式' },
  { key: 'account', label: '价格' },
  { key: 'agentFreeTimeEnd', label: '免费结束' },
  { key: 'discountMonth', label: '折扣' },
  { key: 'agentTargetGroup', label: '目标群体' },
  { key: 'createName', label: '开发者' },
]

export const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
