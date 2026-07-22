/** 多通道消息总线跨端契约(Wave 3 W3-2 对标 OpenClaw 多通道消息) */

/** 消息总线支持的外部 IM 渠道 */
export type MessageChannel =
  | 'feishu'
  | 'dingtalk'
  | 'telegram'
  | 'slack'
  | 'discord'
  | 'wechat'

/** 已配置的消息总线渠道(一条渠道 = 一个 IM 机器人接入) */
export interface MessageBusChannel {
  id: string
  channel: MessageChannel
  name: string
  /** 该渠道接收 webhook 的 URL(flash/gateway 用) */
  webhookUrl?: string
  enabled: boolean
}

/** 发送消息入参 */
export interface MessageBusSendInput {
  channel: MessageChannel
  content: string
  /** @mention 的用户标识列表(各渠道原样透传) */
  mentions?: string[]
}

/** 发送消息结果 */
export interface MessageBusSendResult {
  success: boolean
  /** 渠道返回的消息 ID(用于追踪) */
  messageId?: string
  /** 失败时的错误信息 */
  error?: string
}

/** 消息总线接收到的 webhook payload 结构 */
export interface MessageBusWebhookPayload {
  channel: MessageChannel
  event: string
  data: Record<string, unknown>
  /** 毫秒时间戳 */
  timestamp: number
}
