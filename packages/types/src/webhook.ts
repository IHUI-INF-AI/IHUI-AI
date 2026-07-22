/** Webhook 唤醒机制跨端契约(Wave 3 W3-3 简化唤醒 Bearer token) */

/** webhook 唤醒请求入参(Bearer token 鉴权) */
export interface WebhookWakeInput {
  /** 唤醒令牌(对应唤醒端点的 Bearer token) */
  token: string
  /** 唤醒事件名,缺省时由服务端默认事件处理 */
  event?: string
  /** 自定义负载,原样透传给被唤醒的 agent */
  payload?: Record<string, unknown>
}

/** webhook 唤醒请求结果 */
export interface WebhookWakeResult {
  success: boolean
  message: string
  /** 产生的事件 ID,用于后续查询执行状态 */
  eventId?: string
}

/** 一次唤醒产生的事件记录 */
export interface WakeEvent {
  id: string
  event: string
  payload: Record<string, unknown>
  /** 毫秒时间戳 */
  timestamp: number
  /** 唤醒来源标识(webhook / scheduler / manual 等) */
  source: string
}
