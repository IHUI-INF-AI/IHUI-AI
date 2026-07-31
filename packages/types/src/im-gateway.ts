/**
 * IM 多平台远程连接控制跨端契约(2026-07-31 立,P0)。
 *
 * 整合原 agent-runtime.ts 中散落的 Im* 类型 + 新增完整机器人高级能力类型
 * (互动卡片 / 文件 / 音视频 / 审批)+ 平台元数据 + 适配器配置字段 schema
 * (供前端动态渲染 16 平台配置表单)。
 *
 * 覆盖 16 平台:飞书 / 企业微信 / 钉钉 / Discord / Telegram / Slack / 微信 /
 * Webhook / WhatsApp / LINE / KakaoTalk / Signal / Matrix / Rocket.Chat /
 * Mattermost / Zulip。
 */

// ============================================================================
// 平台枚举
// ============================================================================

/** IM 平台类型(16 平台,对标 Hermes Agent 15+ 渠道) */
export type ImPlatform =
  | 'feishu' // 飞书
  | 'wecom' // 企业微信
  | 'dingtalk' // 钉钉
  | 'discord' // Discord
  | 'telegram' // Telegram
  | 'slack' // Slack
  | 'wechat' // 微信公众号/小程序
  | 'webhook' // 通用 webhook
  | 'whatsapp' // WhatsApp Business
  | 'line' // LINE
  | 'kakaotalk' // KakaoTalk
  | 'signal' // Signal
  | 'matrix' // Matrix
  | 'rocketchat' // Rocket.Chat
  | 'mattermost' // Mattermost
  | 'zulip' // Zulip

/** IM 消息方向 */
export type ImMessageDirection = 'inbound' | 'outbound'

/** IM 消息类型(基础 + 高级) */
export type ImMessageType = 'text' | 'image' | 'file' | 'audio' | 'video' | 'card' | 'approval'

// ============================================================================
// 基础消息类型
// ============================================================================

/** IM 入站消息(从 IM 平台到 IHUI-AI) */
export interface ImInboundMessage {
  platform: ImPlatform
  /** 平台原始消息 ID */
  platformMessageId: string
  /** 发送者 ID(平台侧) */
  fromUserId: string
  /** 发送者昵称 */
  fromUserName?: string
  /** 会话/群 ID */
  chatId: string
  messageType: ImMessageType
  text?: string
  /** 媒体 URL(图片/文件/音视频) */
  mediaUrl?: string
  isGroup: boolean
  /** @机器人 标记 */
  mentionedBot: boolean
  /** 平台原始 payload(完整 webhook 数据) */
  rawPayload: unknown
  /** 接收时间(ISO) */
  receivedAt: string
}

/** IM 出站消息(从 IHUI-AI 到 IM 平台) */
export interface ImOutboundMessage {
  platform: ImPlatform
  chatId: string
  messageType: ImMessageType
  text?: string
  mediaUrl?: string
  /** 卡片结构(飞书互动卡片 / 其他平台富消息) */
  card?: ImRichCard | unknown
  /** 回复的消息 ID(可选) */
  replyToMessageId?: string
}

// ============================================================================
// 高级能力类型(完整机器人:卡片 / 文件 / 音视频 / 审批)
// ============================================================================

/** 飞书互动卡片(及其他平台富消息卡片) */
export interface ImRichCard {
  /** 卡片标题 */
  header?: {
    title: string
    template?:
      | 'blue'
      | 'wathet'
      | 'turquoise'
      | 'green'
      | 'yellow'
      | 'orange'
      | 'red'
      | 'carmine'
      | 'violet'
      | 'purple'
      | 'indigo'
      | 'grey'
  }
  /** 卡片元素(文本/分割线/图片/按钮/表单等) */
  elements: ImCardElement[]
  /** 卡片配置(可选) */
  config?: {
    wide_screen_mode?: boolean
    enable_forward?: boolean
    update_multi?: boolean
  }
}

/** 卡片元素联合类型 */
export type ImCardElement =
  | {
      tag: 'div'
      text?: { content: string; tag: 'lark_md' | 'plain_text' }
      fields?: Array<{
        is_short: boolean
        text: { content: string; tag: 'lark_md' | 'plain_text' }
      }>
    }
  | { tag: 'hr' }
  | { tag: 'img'; img_key: string; alt?: { content: string; tag: 'plain_text' } }
  | { tag: 'action'; actions: ImCardAction[] }
  | { tag: 'note'; elements: Array<{ content: string; tag: 'plain_text' }> }

/** 卡片按钮动作(支持回调交互) */
export interface ImCardAction {
  tag: 'button'
  text: { content: string; tag: 'plain_text' }
  type?: 'default' | 'primary' | 'danger' | 'secondary'
  value: Record<string, unknown>
  confirm?: {
    title: { content: string; tag: 'plain_text' }
    text: { content: string; tag: 'plain_text' }
  }
}

/** 文件消息(支持收发) */
export interface ImFileMessage {
  platform: ImPlatform
  chatId: string
  /** 文件类型(file/image/audio/video) */
  fileType: 'file' | 'image' | 'audio' | 'video'
  /** 文件名(可选) */
  fileName?: string
  /** 文件 URL(出站:外部可访问 URL;入站:平台提供的下载 URL) */
  fileUrl?: string
  /** 文件 key(飞书平台用 file_key,其他平台用 url) */
  fileKey?: string
  /** 文件大小(字节,可选) */
  fileSize?: number
  /** MIME 类型(可选) */
  mimeType?: string
}

/** 音视频消息(支持收发) */
export interface ImAudioVideoMessage {
  platform: ImPlatform
  chatId: string
  /** 媒体类型 */
  mediaType: 'audio' | 'video'
  /** 媒体 URL */
  mediaUrl?: string
  /** 媒体 key(飞书平台用 file_key) */
  mediaKey?: string
  /** 时长(秒,可选) */
  duration?: number
}

/** 审批消息(飞书审批流 / 其他平台审批通知) */
export interface ImApprovalMessage {
  platform: ImPlatform
  chatId: string
  /** 审批类型(请假/报销/采购/通用) */
  approvalType: string
  /** 审审批次号 */
  approvalCode?: string
  /** 申请人 */
  applicant: {
    userId: string
    userName?: string
  }
  /** 审批内容摘要 */
  summary: string
  /** 审批动作 */
  action: 'submit' | 'approve' | 'reject' | 'cancel' | 'forward'
  /** 审批节点 URL(用户点击跳转) */
  approvalUrl?: string
  /** 审批表单字段(可选) */
  formFields?: Array<{ name: string; value: string }>
}

// ============================================================================
// 适配器配置 + 状态
// ============================================================================

/** IM gateway 适配器配置 */
export interface ImAdapterConfig {
  platform: ImPlatform
  enabled: boolean
  /** webhook secret(验签) */
  webhookSecret?: string
  /** bot token */
  botToken?: string
  /** app id(飞书/企业微信/Rocket.Chat X-User-Id) */
  appId?: string
  /** app secret */
  appSecret?: string
  /** 回调 URL(出站消息 API / homeserver / server) */
  callbackUrl?: string
  /** 飞书 lark-cli 长连接模式开关(默认 false,启用后走 lark-cli SDK 替代 webhook) */
  useLarkCli?: boolean
}

/** IM gateway 状态 */
export interface ImGatewayStatus {
  platform: ImPlatform
  enabled: boolean
  connected: boolean
  lastMessageAt?: string
  messageCount: number
  error?: string
}

/** 入站消息历史条目(供前端消息历史面板使用) */
export interface ImMessageHistoryItem {
  id: string
  userId: string
  platform: ImPlatform
  direction: ImMessageDirection
  /** 消息内容(文本或 JSON 序列化的富消息) */
  content: string
  /** 平台原始 payload(完整 webhook 数据) */
  rawPayload: unknown
  /** 接收/发送时间(ISO) */
  createdAt: string
}

/** 适配器 upsert 输入(POST /im-gateway/adapters 请求体) */
export interface ImAdapterUpsertInput {
  platform: ImPlatform
  enabled: boolean
  webhookSecret?: string
  botToken?: string
  appId?: string
  appSecret?: string
  callbackUrl?: string
  useLarkCli?: boolean
}

// ============================================================================
// 平台元数据 + 适配器字段 schema(供前端动态渲染配置表单)
// ============================================================================

/** 适配器配置字段 schema(前端按 schema 动态生成表单项) */
export interface ImAdapterFieldSchema {
  /** 字段名(对应 ImAdapterConfig 的 key) */
  name: 'webhookSecret' | 'botToken' | 'appId' | 'appSecret' | 'callbackUrl' | 'useLarkCli'
  /** 显示标签 */
  label: string
  /** 字段类型 */
  type: 'text' | 'password' | 'url' | 'switch'
  /** 是否必填 */
  required: boolean
  /** 占位提示 */
  placeholder?: string
  /** 帮助文案 */
  helpText?: string
}

/** 平台元数据(显示名 + 入站字段类型 + 验签 + 出站 API + 配置字段 schema) */
export interface ImPlatformMeta {
  /** 平台标识 */
  platform: ImPlatform
  /** 展示名 */
  displayName: string
  /** 图标 emoji 或 URL(前端渲染用) */
  icon?: string
  /** 入站字段类型:flat(扁平)/ nested(嵌套 JSON) */
  inboundFieldType: 'flat' | 'nested'
  /** 验签 header 名(无签名则为 undefined) */
  signatureHeader?: string
  /** 签名编码:hex / base64 / none */
  signatureEncoding: 'hex' | 'base64' | 'none'
  /** 出站 API 模板 URL */
  outboundApiPattern?: string
  /** 是否支持飞书 lark-cli 深度集成(仅飞书) */
  supportsLarkCli?: boolean
  /** 适配器配置字段 schema(前端按此动态渲染表单) */
  fields: ImAdapterFieldSchema[]
}
