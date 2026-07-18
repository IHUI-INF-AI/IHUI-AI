/**
 * 通知渠道类型定义(短信/邮件/站内/推送/钉钉/飞书/企业微信)
 *
 * 各端(api/web/desktop)统一从 @ihui/types 导入,禁止本地重复定义。
 */

/** 通知渠道类型 */
export type NotificationChannel =
  | 'sms' // 短信
  | 'email' // 邮件
  | 'notification' // 站内通知
  | 'push' // 移动推送
  | 'dingtalk' // 钉钉机器人
  | 'feishu' // 飞书机器人
  | 'wechat' // 企业微信机器人

/** 渠道配置 */
export interface ChannelConfig {
  channel: NotificationChannel
  /** dingtalk/feishu/wechat 的 webhook */
  webhookUrl?: string
  /** 飞书 access_token */
  accessToken?: string
  /** 钉钉加签密钥 */
  secret?: string
  /** 微信 appId */
  appId?: string
  /** 微信 appSecret */
  appSecret?: string
}

/** 钉钉机器人消息体 */
export interface DingtalkMessage {
  msgtype: 'text' | 'markdown' | 'actionCard'
  text?: { content: string }
  markdown?: { title: string; text: string }
}

/** 飞书机器人消息体 */
export interface FeishuMessage {
  msg_type: 'text' | 'post' | 'interactive'
  content: {
    text?: string
    post?: Record<string, unknown>
  }
}

/** 企业微信机器人消息体 */
export interface WechatWorkMessage {
  msgtype: 'text' | 'markdown' | 'news'
  text?: { content: string }
  markdown?: { content: string }
}
