import { fetchApi, fetchText } from '../client.js'

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

/** 归档对话 */
export function archiveConversation(id: string) {
  return fetchApi<ConversationDetail>(`/api/chat/conversations/${encodeURIComponent(id)}/archive`, {
    method: 'POST',
  })
}

/** 取消归档对话 */
export function unarchiveConversation(id: string) {
  return fetchApi<ConversationDetail>(`/api/chat/conversations/${encodeURIComponent(id)}/archive`, {
    method: 'DELETE',
  })
}

/** 导出对话为纯文本（txt/md） */
export function exportConversation(id: string, format: 'txt' | 'md' = 'md'): Promise<string> {
  return fetchText(`/api/chat/conversations/${encodeURIComponent(id)}/export?format=${format}`)
}

/** 压缩对话历史至目标字符数 */
export function compressConversation(id: string, targetChars: 200000 | 1000000) {
  return fetchApi<{
    content: string
    model: string
    usage: Record<string, unknown>
    originalChars: number
    compressedChars: number
  }>(`/api/chat/conversations/${encodeURIComponent(id)}/compress`, {
    method: 'POST',
    body: JSON.stringify({ targetChars }),
  })
}
