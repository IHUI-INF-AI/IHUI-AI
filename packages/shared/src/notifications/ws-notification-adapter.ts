/**
 * WS 通知消息转换器(纯逻辑,零平台依赖)
 *
 * 各端 notification store 调用此函数把 WS 消息转为统一 entry,
 * 然后用自己的状态管理方式(zustand / React Context)添加到 store。
 */

/** WS 通知消息的松散类型(兼容 web 的 WSNotification 和 RN 的 WSNotification) */
export interface WsNotificationLike {
  type: string
  data?: {
    id?: unknown
    type: string
    title?: unknown
    content?: unknown
    createdAt?: unknown
    message?: { content?: string }
  } | null
}

/** 转换后的通知条目(各端可 alias 为 NotificationItem / NotificationEntry) */
export interface BaseNotificationEntry {
  id: string
  type: string
  title: string
  content: string
  isRead: boolean
  createdAt: string
}

/**
 * 把 WS 通知消息转为统一 entry。
 * 若 msg 不是通知类型(type !== 'notification' 或无 data),返回 null。
 */
export function transformWsNotification(
  msg: WsNotificationLike | null,
): BaseNotificationEntry | null {
  if (!msg || msg.type !== 'notification' || !msg.data) return null
  const data = msg.data
  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
  return {
    id: str(data.id) ?? `${Date.now()}`,
    type: data.type,
    title: str(data.title) ?? (data.type === 'ai_response' ? 'AI 回复' : '新通知'),
    content: str(data.content) ?? str(data.message?.content) ?? '',
    isRead: false,
    createdAt: str(data.createdAt) ?? new Date().toISOString(),
  }
}
