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

/** AI 主动提问选项(与 @ihui/types QuestionOptionPayload 结构一致) */
export interface QuestionOption {
  id: string
  label: string
}

/** AI 主动提问载荷(持久化到 chat_messages.metadata.pendingQuestion) */
export interface PendingQuestionPayload {
  questionId: string
  prompt: string
  options: QuestionOption[]
  allowCustom: boolean
  allowMultiple: boolean
  /** 关联的 assistant 消息 ID(DB id),用于持久化 metadata 到该消息 */
  assistantMessageId?: string
}

/** chat_messages.metadata 的结构化类型(P2 多端同步持久化用)
 *  - pendingQuestion: 非空表示该 assistant 消息触发了提问且未回答
 *  - answeredQuestionId: 标记该提问已被回答(与 pendingQuestion: null 同时设置)
 *  - questionId + isAnswer: user 消息标记,表示这是对某提问的回答
 *  - 其他 key(model/usage/stub 等)由 ai-callback-worker 写入,保持向后兼容 */
export interface ChatMessageMetadata {
  pendingQuestion?: PendingQuestionPayload | null
  answeredQuestionId?: string
  questionId?: string
  isAnswer?: boolean
  [key: string]: unknown
}

export interface ConversationMessage {
  id: string
  conversationId: string
  role: ChatRole
  content: string
  tokens: number | null
  metadata: ChatMessageMetadata | null
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

/** 获取对话消息列表(时间正序,单页最多 100 条) */
export function getMessages(id: string) {
  return fetchApi<{ messages: ConversationMessage[]; total: number }>(
    `/api/chat/conversations/${encodeURIComponent(id)}/messages?pageSize=100`,
  )
}

/** 持久化一条消息
 *  P2 多端同步:metadata 参数用于标记 questionId/isAnswer(用户回答)或其他业务元数据 */
export function sendMessage(
  id: string,
  content: string,
  role: ChatRole = 'user',
  metadata?: ChatMessageMetadata,
) {
  return fetchApi<{ message: ConversationMessage }>(
    `/api/chat/conversations/${encodeURIComponent(id)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify(metadata ? { content, role, metadata } : { content, role }),
    },
  )
}

/** 持久化 AI 主动提问挂起状态 + WS 广播到多端
 *  前端收到 SSE question 事件时调用,把 pendingQuestion 写入 chat_conversations.metadata
 *  其他端通过 WS ai_question 事件收到后弹窗,实现多端同步
 *
 *  设计说明:不传 assistantMessageId,因为前端 onQuestion 时 assistantMessageId 是前端 UUID(占位),
 *  DB id 要等 ai-callback 完成后才落地。用 conversation.metadata(对话级挂起状态)更合适。 */
export function persistQuestion(input: {
  conversationId: string
  questionId: string
  prompt: string
  options: QuestionOption[]
  allowCustom: boolean
  allowMultiple: boolean
}) {
  return fetchApi<{ ok: boolean; persisted: boolean }>('/api/ai/chat/questions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
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
