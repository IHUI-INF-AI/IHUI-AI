// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
    /** 通知的业务载荷(notifications.data jsonb:G2 自动化的 sessionId 等深链字段住在这里) */
    data?: unknown
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
  /** 业务载荷原样透传(data.data 为普通对象时);各端按 type 自行取用(如 G2 的 sessionId) */
  payload?: Record<string, unknown>
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
  // 业务载荷透传:只接受普通对象,数组/标量/undefined 一律不带(避免各端拿到半截形态)
  const payload =
    data.data && typeof data.data === 'object' && !Array.isArray(data.data)
      ? (data.data as Record<string, unknown>)
      : undefined
  return {
    id: str(data.id) ?? `${Date.now()}`,
    type: data.type,
    title: str(data.title) ?? (data.type === 'ai_response' ? 'AI 回复' : '新通知'),
    content: str(data.content) ?? str(data.message?.content) ?? '',
    isRead: false,
    createdAt: str(data.createdAt) ?? new Date().toISOString(),
    ...(payload ? { payload } : {}),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
