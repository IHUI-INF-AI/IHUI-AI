import { fetchApi } from '../client.js'

export type ChatRole = 'user' | 'assistant' | 'system'

export interface ConversationDetail {
  id: string
  userId: string
  title: string
  model: string
  systemPrompt: string | null
  metadata: unknown
  lastMessageAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ConversationMessage {
  id: string
  conversationId: string
  role: ChatRole
  content: string
  tokens: number | null
  metadata: unknown
  createdAt: string
}

/** 创建对话 */
export function createConversation(input: { title?: string; model?: string } = {}) {
  return fetchApi<{ conversation: ConversationDetail }>('/api/chat/conversations', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 获取对话详情 */
export function getConversation(id: string) {
  return fetchApi<{ conversation: ConversationDetail }>(
    `/api/chat/conversations/${encodeURIComponent(id)}`,
  )
}

/** 获取对话消息列表（时间正序，单页最�?100 条） */
export function getMessages(id: string) {
  return fetchApi<{ messages: ConversationMessage[]; total: number }>(
    `/api/chat/conversations/${encodeURIComponent(id)}/messages?pageSize=100`,
  )
}

/** 持久化一条消�?*/
export function sendMessage(id: string, content: string, role: ChatRole = 'user') {
  return fetchApi<{ message: ConversationMessage }>(
    `/api/chat/conversations/${encodeURIComponent(id)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ content, role }),
    },
  )
}

/** 删除对话（级联删除消息） */
export function deleteConversation(id: string) {
  return fetchApi<{ deleted: boolean }>(`/api/chat/conversations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/** 清空对话消息（保留对话本身） */
export function clearMessages(id: string) {
  return fetchApi<{ cleared: boolean }>(`/api/chat/conversations/${encodeURIComponent(id)}/clear`, {
    method: 'POST',
  })
}
