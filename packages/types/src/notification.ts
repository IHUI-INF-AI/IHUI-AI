// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 通知与 WebSocket 消息类型(跨端共享唯一类型源)
 *
 * 涵盖:
 * - WebSocket 实时通知消息格式(WSNotification / AIResponseNotification)
 * - 通知业务类型(NotificationItem / MessageItem / UnreadCount)
 * - 客服会话(CustomerServiceSession / CustomerServiceMessage)
 *
 * 各端(api/web/desktop/extension/mobile-rn/miniapp-taro)统一从 @ihui/types 导入,
 * 禁止本地重复定义。
 */

// ===================== WebSocket 消息类型 =====================

/** WebSocket 通知推送消息(后端 /ws/notifications 推送格式) */
export interface WSNotification {
  type: 'notification'
  data: {
    /** 通知子类型:ai_response / chat_message / notification 等 */
    type: string
    [key: string]: unknown
  }
}

/** AI 回复推送载荷(ai_callback_worker → pushNotification → WS) */
export interface AIResponseNotification {
  type: 'ai_response'
  conversationId: string
  clientMessageId?: string
  message: {
    id: string
    role: string
    content: string
    createdAt?: string
  }
}

/** 类型守卫:WSNotification 是否为 AI 回复 */
export function isAIResponse(
  n: WSNotification | null,
): n is WSNotification & { data: AIResponseNotification } {
  return !!n && n.data?.type === 'ai_response' && !!n.data?.message
}

/** AI 主动提问选项(跨端共享,与 web store 的 QuestionOption 结构一致) */
export interface QuestionOptionPayload {
  id: string
  label: string
}

/** AI 主动提问载荷(跨端共享,与 web store 的 PendingQuestion 结构一致)
 *  - 由 api /chat/questions 端点写入 chat_messages.metadata.pendingQuestion
 *  - 通过 WS ai_question 事件广播到多端
 *  - 前端收到后 setPendingQuestion 弹窗阻塞输入
 *  - 用户回答后通过 /chat/answer 续流,WS 广播 chat_question_answered 通知多端关闭弹窗 */
export interface PendingQuestionPayload {
  questionId: string
  prompt: string
  options: QuestionOptionPayload[]
  allowCustom: boolean
  allowMultiple: boolean
  /** 关联的 assistant 消息 ID(DB id),用于持久化 metadata 到该消息 */
  assistantMessageId?: string
}

/** AI 主动提问推送载荷(api /chat/questions → pushNotification → WS) */
export interface AIQuestionNotification {
  type: 'ai_question'
  conversationId: string
  question: PendingQuestionPayload
}

/** 类型守卫:WSNotification 是否为 AI 主动提问 */
export function isAIQuestion(
  n: WSNotification | null,
): n is WSNotification & { data: AIQuestionNotification } {
  return !!n && n.data?.type === 'ai_question' && !!n.data?.question
}

/** AI 提问已回答推送载荷(用户提交答案后 → WS 广播 → 多端关闭弹窗) */
export interface AIQuestionAnsweredNotification {
  type: 'chat_question_answered'
  conversationId: string
  questionId: string
}

/** 类型守卫:WSNotification 是否为 AI 提问已回答 */
export function isAIQuestionAnswered(
  n: WSNotification | null,
): n is WSNotification & { data: AIQuestionAnsweredNotification } {
  return !!n && n.data?.type === 'chat_question_answered' && !!n.data?.questionId
}

/** 聊天消息多端同步推送载荷(V2 #23 多端同步)
 *  - 由 api POST /conversations/:id/messages(chat.ts)与 ai-chat-stream 回答保存点推送
 *  - 通过 server.pushNotification(WS chat_message 事件)广播到该用户全部连接/端
 *  - web 端收到后:若为当前会话且非本端已渲染的消息,追加/校正到 ChatStore */
export interface ChatMessageNotification {
  type: 'chat_message'
  conversationId: string
  message: {
    id: string
    role: string
    content: string
    reasoning?: string | null
    tokens?: number | null
    metadata?: unknown
    createdAt?: string
  }
}

/** 类型守卫:WSNotification 是否为聊天消息同步 */
export function isChatMessage(
  n: WSNotification | null,
): n is WSNotification & { data: ChatMessageNotification } {
  if (!n || n.data?.type !== 'chat_message') return false
  const msg = (n.data as { message?: { id?: unknown } }).message
  return typeof msg?.id === 'string' && msg.id.length > 0
}

// ===================== 通知业务类型 =====================

/** D195 通知的两个分区:active = 动态流(未归档),archived = 已归档(可逐条恢复)。跨端唯一声明。 */
export type NotificationPartition = 'active' | 'archived'

/**
 * 通知列表查询过滤(前后端唯一真相源):键名 `unread` 与后端 listNotificationsQuery 的
 * zod 字段一致 —— 此前 api-client 用 `isRead`,后端只解析 `unread`,导致"只看未读"失效(BUG-80)。
 */
export interface NotificationListFilters {
  type?: string
  unread?: boolean
  partition?: NotificationPartition
}

/** 通知列表项 */
export interface NotificationItem {
  id: string
  type: string
  title: string
  /** content 可选:后端返回时必填,前端从 WS 推送构造时可能为 undefined */
  content?: string
  isRead: boolean
  /** D195 归档时刻:ISO 串 = 已归档,null/缺失 = 在动态流(active 分区) */
  archivedAt?: string | null
  createdAt: string
  link?: string
  extra?: Record<string, unknown>
  [key: string]: unknown
}

/** 消息列表项 */
export interface MessageItem {
  id: string
  fromUserId: string
  fromNickname: string
  fromAvatar?: string | null
  content: string
  isRead: boolean
  createdAt: string
  [key: string]: unknown
}

/**
 * 未读统计 —— 后端 `/notifications/unread-count` 与 `/badge` 的响应形状,跨端唯一真相源。
 * `count` 与 `notification` 同值:保留前者以兼容 /badge 历史语义与 web 角标消费点,
 * 后者与 message/customerService/total 一起供 use-global-notification / extension 读取。
 * 索引签名刻意移除:契约必须精确,不得让消费方误信还有其它未声明字段。
 */
export interface UnreadCount {
  count: number
  message: number
  notification: number
  customerService: number
  total: number
}

// ===================== 客服类型 =====================

/**
 * 客服工单/会话状态枚举(唯一真相源):与后端工单 z.enum 及 DB 状态转换表一致。
 * `active` 后端永不产出(用 `open`),`open/resolved/rejected` 此前在消费侧失去类型保障(BUG-81)。
 * 后端应从本数组派生 z.enum,不得再抄字面量。
 */
export const CUSTOMER_SERVICE_STATUSES = [
  'pending',
  'open',
  'resolved',
  'closed',
  'rejected',
] as const

export type CustomerServiceStatus = (typeof CUSTOMER_SERVICE_STATUSES)[number]

/** 客服会话 */
export interface CustomerServiceSession {
  id: string
  userId: string
  userNickname?: string
  userAvatar?: string
  agentId?: string
  agentName?: string
  status: CustomerServiceStatus
  lastMessage?: string
  lastMessageAt?: string
  createdAt: string
  [key: string]: unknown
}

/** 客服消息 */
export interface CustomerServiceMessage {
  id: string
  sessionId: string
  fromId: string
  fromType: 'user' | 'agent' | 'bot'
  content: string
  type?: 'text' | 'image' | 'file' | 'system'
  isRead: boolean
  createdAt: string
  [key: string]: unknown
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
