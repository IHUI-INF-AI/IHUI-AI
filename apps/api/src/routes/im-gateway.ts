/**
 * IM 平台 gateway 路由(P1-1 api 侧,对标 Hermes Agent 25+ 平台 gateway)。
 *
 * 接收 IM 平台 webhook 入站消息 + 发送出站消息 + 管理适配器配置 + 查询连接状态。
 * 适配器配置与消息历史持久化到 Redis,Redis 不可用时降级为进程内 Map。
 *
 * Redis key 格式:
 *  - im:adapters:<userId>                    ImAdapterConfig[] JSON
 *  - im:inbound:<userId>:<platform>          ImInboundMessage[] JSON
 *  - im:outbound:<userId>:<platform>         ImOutboundMessage[] JSON
 *
 * 端点:
 *  - POST /im-gateway/webhook/:platform      接收 IM 平台 webhook(无需登录,用 webhookSecret 验签)
 *  - POST /im-gateway/send                   发送出站消息到 IM 平台
 *  - GET  /im-gateway/adapters               列出当前用户的 IM 适配器配置
 *  - POST /im-gateway/adapters               创建/更新 IM 适配器配置(upsert by platform)
 *  - GET  /im-gateway/status                 获取所有 IM 平台连接状态(16 平台)
 *
 * P3-5 扩展(2026-07-22):平台从 8 个扩展到 16 个,新增 WhatsApp / LINE / KakaoTalk /
 * Signal / Matrix / Rocket.Chat / Mattermost / Zulip,对标 Hermes Agent 15+ 渠道。
 *
 * P1 简化:
 *  - 原 8 平台出站消息沿用通用 webhook adapter(POST 到 callbackUrl)
 *  - 新 8 平台出站消息实现平台特定 API 适配(sendToPlatform)
 *  - webhook 验签按平台读取特定 header(HMAC-SHA256,hex/base64 编码)
 *  - 入站消息通用解析 + 新平台嵌套 JSON 路径解析(parseNestedField)
 *  - webhook 路由通过 body.userId 定位 adapter 配置(P2 将改为 token 映射,避免暴露 userId)
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type {
  ImAdapterConfig,
  ImGatewayStatus,
  ImInboundMessage,
  ImOutboundMessage,
  ImPlatform,
  ImMessageType,
} from '@ihui/types'
import { checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'

// ============================================================================
// Zod schemas
// ============================================================================

const platformSchema = z.enum([
  'feishu',
  'wecom',
  'dingtalk',
  'discord',
  'telegram',
  'slack',
  'wechat',
  'webhook',
  'whatsapp',
  'line',
  'kakaotalk',
  'signal',
  'matrix',
  'rocketchat',
  'mattermost',
  'zulip',
])

/** 全部 16 个 IM 平台(用于 status 路由枚举) */
const ALL_PLATFORMS: ImPlatform[] = [
  'feishu',
  'wecom',
  'dingtalk',
  'discord',
  'telegram',
  'slack',
  'wechat',
  'webhook',
  'whatsapp',
  'line',
  'kakaotalk',
  'signal',
  'matrix',
  'rocketchat',
  'mattermost',
  'zulip',
]

// ============================================================================
// 平台元数据(P3-5:16 平台注册)
// ============================================================================

interface PlatformMeta {
  /** 展示名 */
  displayName: string
  /** 入站字段类型:flat(扁平)/ nested(嵌套 JSON) */
  inboundFieldType: 'flat' | 'nested'
  /** 验签 header 名(无签名则为 undefined) */
  signatureHeader?: string
  /** 签名编码:hex / base64 / none */
  signatureEncoding: 'hex' | 'base64' | 'none'
  /** 出站 API 模板 URL */
  outboundApiPattern?: string
}

const PLATFORM_METADATA: Record<ImPlatform, PlatformMeta> = {
  feishu: {
    displayName: '飞书',
    inboundFieldType: 'flat',
    signatureHeader: 'x-lark-signature',
    signatureEncoding: 'hex',
  },
  wecom: {
    displayName: '企业微信',
    inboundFieldType: 'flat',
    signatureHeader: 'x-wecom-signature',
    signatureEncoding: 'hex',
  },
  dingtalk: {
    displayName: '钉钉',
    inboundFieldType: 'flat',
    signatureEncoding: 'none',
  },
  discord: {
    displayName: 'Discord',
    inboundFieldType: 'flat',
    signatureEncoding: 'none',
    outboundApiPattern: 'https://discord.com/api/v10/channels/{chatId}/messages',
  },
  telegram: {
    displayName: 'Telegram',
    inboundFieldType: 'flat',
    signatureHeader: 'x-telegram-bot-api-secret-token',
    signatureEncoding: 'hex',
    outboundApiPattern: 'https://api.telegram.org/bot{token}/sendMessage',
  },
  slack: {
    displayName: 'Slack',
    inboundFieldType: 'flat',
    signatureEncoding: 'none',
  },
  wechat: {
    displayName: '微信',
    inboundFieldType: 'flat',
    signatureEncoding: 'none',
  },
  webhook: {
    displayName: '通用 Webhook',
    inboundFieldType: 'flat',
    signatureHeader: 'x-im-signature',
    signatureEncoding: 'hex',
  },
  whatsapp: {
    displayName: 'WhatsApp Business',
    inboundFieldType: 'nested',
    signatureHeader: 'x-hub-signature-256',
    signatureEncoding: 'hex',
    outboundApiPattern: 'https://graph.facebook.com/v17.0/{phone_id}/messages',
  },
  line: {
    displayName: 'LINE',
    inboundFieldType: 'nested',
    signatureHeader: 'x-line-signature',
    signatureEncoding: 'base64',
    outboundApiPattern: 'https://api.line.me/v2/bot/message/push',
  },
  kakaotalk: {
    displayName: 'KakaoTalk',
    inboundFieldType: 'flat',
    signatureHeader: 'x-kakao-signature',
    signatureEncoding: 'hex',
    outboundApiPattern: 'https://kapi.kakao.com/v2/api/talk/memo/send',
  },
  signal: {
    displayName: 'Signal',
    inboundFieldType: 'nested',
    signatureEncoding: 'none',
    outboundApiPattern: 'http://localhost:8080/v2/send',
  },
  matrix: {
    displayName: 'Matrix',
    inboundFieldType: 'nested',
    signatureEncoding: 'none',
    outboundApiPattern:
      'https://{homeserver}/_matrix/client/r0/rooms/{roomId}/send/m.room.message/{txnId}',
  },
  rocketchat: {
    displayName: 'Rocket.Chat',
    inboundFieldType: 'flat',
    signatureEncoding: 'none',
    outboundApiPattern: 'https://{server}/api/v1/chat.postMessage',
  },
  mattermost: {
    displayName: 'Mattermost',
    inboundFieldType: 'flat',
    signatureEncoding: 'none',
    outboundApiPattern: 'https://{server}/api/v4/posts',
  },
  zulip: {
    displayName: 'Zulip',
    inboundFieldType: 'flat',
    signatureEncoding: 'none',
    outboundApiPattern: 'https://{server}/api/v1/messages',
  },
}

const adapterConfigSchema = z.object({
  platform: platformSchema,
  enabled: z.boolean().default(false),
  webhookSecret: z.string().optional(),
  botToken: z.string().optional(),
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  callbackUrl: z.string().url().optional(),
})

const sendBodySchema = z.object({
  platform: platformSchema,
  chatId: z.string().min(1),
  messageType: z
    .enum(['text', 'image', 'file', 'audio', 'video', 'card'])
    .default('text'),
  text: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  card: z.unknown().optional(),
  replyToMessageId: z.string().optional(),
})

// ============================================================================
// Redis 降级存储
// ============================================================================

const adaptersFallback = new Map<string, ImAdapterConfig[]>()
const inboundFallback = new Map<string, ImInboundMessage[]>()
const outboundFallback = new Map<string, ImOutboundMessage[]>()

function adaptersKey(userId: string): string {
  return `im:adapters:${userId}`
}

function inboundKey(userId: string, platform: string): string {
  return `im:inbound:${userId}:${platform}`
}

function outboundKey(userId: string, platform: string): string {
  return `im:outbound:${userId}:${platform}`
}

async function readJson<T>(
  redis: { get: (k: string) => Promise<string | null> },
  fallback: Map<string, T[]>,
  key: string,
): Promise<T[]> {
  try {
    const raw = await redis.get(key)
    if (!raw) return []
    return JSON.parse(raw) as T[]
  } catch {
    return fallback.get(key) ?? []
  }
}

async function writeJson<T>(
  redis: { set: (k: string, v: string) => Promise<unknown> },
  fallback: Map<string, T[]>,
  key: string,
  value: T[],
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value))
  } catch {
    fallback.set(key, value)
  }
}

async function readAdapters(
  redis: { get: (k: string) => Promise<string | null> },
  userId: string,
): Promise<ImAdapterConfig[]> {
  try {
    const raw = await redis.get(adaptersKey(userId))
    if (!raw) return []
    return JSON.parse(raw) as ImAdapterConfig[]
  } catch {
    return adaptersFallback.get(adaptersKey(userId)) ?? []
  }
}

async function writeAdapters(
  redis: { set: (k: string, v: string) => Promise<unknown> },
  userId: string,
  adapters: ImAdapterConfig[],
): Promise<void> {
  try {
    await redis.set(adaptersKey(userId), JSON.stringify(adapters))
  } catch {
    adaptersFallback.set(adaptersKey(userId), adapters)
  }
}

// ============================================================================
// 辅助:webhook 验签(HMAC-SHA256,hex 编码)
// ============================================================================

function verifyHmac(secret: string, rawBody: string, signature: string): boolean {
  try {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
    const sigBuf = Buffer.from(signature)
    const expBuf = Buffer.from(expected)
    if (sigBuf.length !== expBuf.length) return false
    return timingSafeEqual(sigBuf, expBuf)
  } catch {
    return false
  }
}

/** LINE 专用:HMAC-SHA256 base64 编码验签 */
function verifyHmacBase64(secret: string, rawBody: string, signature: string): boolean {
  try {
    const expected = createHmac('sha256', secret).update(rawBody).digest('base64')
    const sigBuf = Buffer.from(signature)
    const expBuf = Buffer.from(expected)
    if (sigBuf.length !== expBuf.length) return false
    return timingSafeEqual(sigBuf, expBuf)
  } catch {
    return false
  }
}

// ============================================================================
// 辅助:从平台 webhook payload 通用提取消息字段
// ============================================================================

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return undefined
}

/** 按点分路径解析嵌套 JSON(支持数组索引,如 "entry.0.changes.0.value.messages.0.text.body") */
function parseNestedField(obj: unknown, path: string): unknown {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined
    if (Array.isArray(cur)) {
      const idx = Number(part)
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) return undefined
      cur = cur[idx]
    } else if (typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return cur
}

function pickStringFromPath(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** 各新平台入站消息嵌套字段路径映射 */
const PLATFORM_FIELD_PATHS: Partial<
  Record<
    ImPlatform,
    {
      text?: string
      fromUserId?: string
      chatId?: string
      platformMessageId?: string
    }
  >
> = {
  whatsapp: {
    text: 'entry.0.changes.0.value.messages.0.text.body',
    fromUserId: 'entry.0.changes.0.value.contacts.0.wa_id',
    platformMessageId: 'entry.0.changes.0.value.messages.0.id',
  },
  line: {
    text: 'events.0.message.text',
    fromUserId: 'events.0.source.userId',
    chatId: 'events.0.source.groupId',
    platformMessageId: 'events.0.message.id',
  },
  signal: {
    text: 'envelope.dataMessage.message',
    fromUserId: 'envelope.source',
  },
  matrix: {
    text: 'events.0.content.body',
    fromUserId: 'events.0.sender',
    chatId: 'events.0.room_id',
    platformMessageId: 'events.0.event_id',
  },
  rocketchat: {
    text: 'message.msg',
    fromUserId: 'message.u._id',
    chatId: 'message.rid',
    platformMessageId: 'message._id',
  },
  mattermost: {
    text: 'event.text',
    fromUserId: 'event.user_id',
    chatId: 'event.channel_id',
  },
  zulip: {
    text: 'message.content',
    fromUserId: 'message.sender_id',
    chatId: 'message.stream_id',
    platformMessageId: 'message.id',
  },
}

function parseInboundPayload(
  body: Record<string, unknown>,
  platform?: ImPlatform,
): {
  text?: string
  chatId?: string
  fromUserId?: string
  fromUserName?: string
  messageType: ImMessageType
  mediaUrl?: string
  isGroup: boolean
  mentionedBot: boolean
  platformMessageId?: string
} {
  // 优先用扁平字段提取(原 8 平台 + KakaoTalk)
  let text =
    pickString(body, ['text', 'content', 'message', 'msg']) ??
    (typeof body.event === 'object' && body.event !== null
      ? pickString(body.event as Record<string, unknown>, ['text', 'content', 'message'])
      : undefined)
  let chatId = pickString(body, [
    'chat_id',
    'chatId',
    'group_id',
    'groupId',
    'conversation_id',
    'conversationId',
    'room_id',
    'roomId',
  ])
  let fromUserId = pickString(body, [
    'from',
    'fromUserId',
    'from_user_id',
    'sender_id',
    'senderId',
    'user_id',
    'userId',
    'uid',
  ])
  let platformMessageId = pickString(body, [
    'message_id',
    'messageId',
    'msg_id',
    'msgId',
    'id',
  ])

  // 新平台嵌套 JSON 路径补充提取(flat 字段未命中时)
  const paths = platform ? PLATFORM_FIELD_PATHS[platform] : undefined
  if (paths) {
    if (!text && paths.text) {
      text = pickStringFromPath(parseNestedField(body, paths.text))
    }
    if (!chatId && paths.chatId) {
      chatId = pickStringFromPath(parseNestedField(body, paths.chatId))
    }
    if (!fromUserId && paths.fromUserId) {
      fromUserId = pickStringFromPath(parseNestedField(body, paths.fromUserId))
    }
    if (!platformMessageId && paths.platformMessageId) {
      platformMessageId = pickStringFromPath(parseNestedField(body, paths.platformMessageId))
    }
  }

  const fromUserName = pickString(body, [
    'from_name',
    'fromName',
    'sender_name',
    'senderName',
    'user_name',
    'userName',
    'nickname',
  ])
  const mediaUrl = pickString(body, ['media_url', 'mediaUrl', 'file_url', 'fileUrl', 'image', 'pic_url'])
  const isGroup =
    body.is_group === true ||
    body.isGroup === true ||
    body.chat_type === 'group' ||
    body.message_type === 'group'
  const mentionedBot =
    body.mentioned === true ||
    body.mentionedBot === true ||
    body.mention === true ||
    body.is_at_bot === true
  const messageType: ImMessageType = mediaUrl
    ? (pickString(body, ['message_type', 'messageType', 'msg_type', 'msgType']) as ImMessageType) ??
      'image'
    : 'text'
  return {
    text,
    chatId,
    fromUserId,
    fromUserName,
    messageType,
    mediaUrl,
    isGroup,
    mentionedBot,
    platformMessageId,
  }
}

// ============================================================================
// 辅助:触发 ai-service(可选,失败降级)
// ============================================================================

async function triggerAiService(payload: {
  userId: string
  platform: ImPlatform
  text?: string
  chatId?: string
  fromUserId?: string
}): Promise<void> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    await fetch('http://127.0.0.1:8000/api/agents/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timer)
  } catch {
    // 降级:只存消息,不触发 Agent(ai-service 可能未启动)
  }
}

// ============================================================================
// 辅助:通用 fetch(超时 10s,失败返回错误描述,不抛异常)
// ============================================================================

async function doFetch(
  url: string,
  init: RequestInit,
): Promise<{ sent: boolean; error?: string }> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const resp = await fetch(url, { ...init, signal: controller.signal })
    clearTimeout(timer)
    return { sent: resp.ok, error: resp.ok ? undefined : `HTTP ${resp.status}` }
  } catch (e) {
    return { sent: false, error: (e as Error).message || '投递失败' }
  }
}

// ============================================================================
// 辅助:出站消息发送 — 原 8 平台沿用通用 webhook adapter
// ============================================================================

async function deliverOutbound(
  adapter: ImAdapterConfig,
  message: ImOutboundMessage,
): Promise<{ sent: boolean; error?: string }> {
  if (!adapter.callbackUrl) {
    return { sent: false, error: 'callbackUrl 未配置' }
  }
  return doFetch(adapter.callbackUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  })
}

// ============================================================================
// 辅助:出站消息发送 — 新 8 平台 API 适配(P3-5)
// ============================================================================

/** WhatsApp Business Cloud API:POST graph.facebook.com/v17.0/{phone_id}/messages */
async function sendWhatsApp(
  message: ImOutboundMessage,
  adapter: ImAdapterConfig,
): Promise<{ sent: boolean; error?: string }> {
  if (!adapter.botToken || !adapter.appId) {
    return { sent: false, error: 'WhatsApp 需要 botToken(访问令牌)和 appId(电话号码 ID)' }
  }
  const url = `https://graph.facebook.com/v17.0/${adapter.appId}/messages`
  return doFetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adapter.botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: message.chatId,
      type: 'text',
      text: { body: message.text ?? '' },
    }),
  })
}

/** LINE Messaging API:POST api.line.me/v2/bot/message/push */
async function sendLine(
  message: ImOutboundMessage,
  adapter: ImAdapterConfig,
): Promise<{ sent: boolean; error?: string }> {
  if (!adapter.botToken) {
    return { sent: false, error: 'LINE 需要 botToken(Channel Access Token)' }
  }
  return doFetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adapter.botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: message.chatId,
      messages: [{ type: 'text', text: message.text ?? '' }],
    }),
  })
}

/** KakaoTalk:POST kapi.kakao.com/v2/api/talk/memo/send(用户给自己发 memo) */
async function sendKakaoTalk(
  message: ImOutboundMessage,
  adapter: ImAdapterConfig,
): Promise<{ sent: boolean; error?: string }> {
  if (!adapter.botToken) {
    return { sent: false, error: 'KakaoTalk 需要 botToken(用户访问令牌)' }
  }
  const template = {
    object_type: 'text',
    text: message.text ?? '',
    link: { web_url: 'https://example.com' },
  }
  return doFetch('https://kapi.kakao.com/v2/api/talk/memo/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adapter.botToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `template_object=${encodeURIComponent(JSON.stringify(template))}`,
  })
}

/** Signal:POST localhost:8080/v2/send(signal-cli-rest-api,本地服务) */
async function sendSignal(
  message: ImOutboundMessage,
  adapter: ImAdapterConfig,
): Promise<{ sent: boolean; error?: string }> {
  const baseUrl = adapter.callbackUrl ?? 'http://localhost:8080'
  return doFetch(`${baseUrl}/v2/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: message.text ?? '',
      number: message.chatId,
    }),
  })
}

/** Matrix:PUT {homeserver}/_matrix/client/r0/rooms/{roomId}/send/m.room.message/{txnId} */
async function sendMatrix(
  message: ImOutboundMessage,
  adapter: ImAdapterConfig,
): Promise<{ sent: boolean; error?: string }> {
  if (!adapter.botToken || !adapter.callbackUrl) {
    return { sent: false, error: 'Matrix 需要 botToken(访问令牌)和 callbackUrl(homeserver)' }
  }
  const txnId = randomUUID()
  const url = `${adapter.callbackUrl}/_matrix/client/r0/rooms/${encodeURIComponent(message.chatId)}/send/m.room.message/${txnId}`
  return doFetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${adapter.botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      msgtype: 'm.text',
      body: message.text ?? '',
    }),
  })
}

/** Rocket.Chat:POST {server}/api/v1/chat.postMessage(X-Auth-Token + X-User-Id) */
async function sendRocketChat(
  message: ImOutboundMessage,
  adapter: ImAdapterConfig,
): Promise<{ sent: boolean; error?: string }> {
  if (!adapter.botToken || !adapter.appId || !adapter.callbackUrl) {
    return {
      sent: false,
      error: 'Rocket.Chat 需要 botToken(X-Auth-Token)、appId(X-User-Id)、callbackUrl(server)',
    }
  }
  return doFetch(`${adapter.callbackUrl}/api/v1/chat.postMessage`, {
    method: 'POST',
    headers: {
      'X-Auth-Token': adapter.botToken,
      'X-User-Id': adapter.appId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: message.chatId,
      msg: message.text ?? '',
    }),
  })
}

/** Mattermost:POST {server}/api/v4/posts(Bearer token) */
async function sendMattermost(
  message: ImOutboundMessage,
  adapter: ImAdapterConfig,
): Promise<{ sent: boolean; error?: string }> {
  if (!adapter.botToken || !adapter.callbackUrl) {
    return { sent: false, error: 'Mattermost 需要 botToken(Bearer)和 callbackUrl(server)' }
  }
  return doFetch(`${adapter.callbackUrl}/api/v4/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adapter.botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel_id: message.chatId,
      message: message.text ?? '',
    }),
  })
}

/** Zulip:POST {server}/api/v1/messages(Basic auth: bot_email:api_key) */
async function sendZulip(
  message: ImOutboundMessage,
  adapter: ImAdapterConfig,
): Promise<{ sent: boolean; error?: string }> {
  if (!adapter.botToken || !adapter.appId || !adapter.callbackUrl) {
    return {
      sent: false,
      error: 'Zulip 需要 botToken(api_key)、appId(bot_email)、callbackUrl(server)',
    }
  }
  const basicAuth = Buffer.from(`${adapter.appId}:${adapter.botToken}`).toString('base64')
  return doFetch(`${adapter.callbackUrl}/api/v1/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      type: 'stream',
      to: message.chatId,
      content: message.text ?? '',
      subject: 'message',
    }).toString(),
  })
}

/** 出站消息统一分发:新 8 平台走平台 API,原 8 平台走通用 callbackUrl */
async function sendToPlatform(
  platform: ImPlatform,
  message: ImOutboundMessage,
  adapter: ImAdapterConfig,
): Promise<{ sent: boolean; error?: string }> {
  switch (platform) {
    case 'whatsapp':
      return sendWhatsApp(message, adapter)
    case 'line':
      return sendLine(message, adapter)
    case 'kakaotalk':
      return sendKakaoTalk(message, adapter)
    case 'signal':
      return sendSignal(message, adapter)
    case 'matrix':
      return sendMatrix(message, adapter)
    case 'rocketchat':
      return sendRocketChat(message, adapter)
    case 'mattermost':
      return sendMattermost(message, adapter)
    case 'zulip':
      return sendZulip(message, adapter)
    default:
      // 原 8 平台(feishu/wecom/dingtalk/discord/telegram/slack/wechat/webhook)沿用通用 webhook
      return deliverOutbound(adapter, message)
  }
}

// ============================================================================
// 路由
// ============================================================================

export const imGatewayRoutes: FastifyPluginAsync = async (server) => {
  // 1. POST /im-gateway/webhook/:platform — 接收 IM 平台 webhook(无需登录)
  server.post<{ Params: { platform: string } }>(
    '/im-gateway/webhook/:platform',
    async (request: FastifyRequest<{ Params: { platform: string } }>, reply: FastifyReply) => {
      const parsedPlatform = platformSchema.safeParse(request.params.platform)
      if (!parsedPlatform.success) {
        return reply
          .status(400)
          .send(error(400, parsedPlatform.error.issues[0]?.message ?? '无效平台'))
      }
      const platform = parsedPlatform.data as ImPlatform

      const body = (request.body ?? {}) as Record<string, unknown> & { userId?: string }
      // P1 简化:body.userId 定位 adapter(P2 将改为 token 映射)
      const userId = body.userId
      if (!userId || typeof userId !== 'string') {
        return reply.status(400).send(error(400, 'body.userId 必填(用于定位 adapter 配置)'))
      }

      // 查找对应 adapter
      const adapters = await readAdapters(server.redis, userId)
      const adapter = adapters.find((a) => a.platform === platform)
      if (!adapter) {
        return reply.status(404).send(error(404, `未配置 ${platform} 适配器`))
      }
      if (!adapter.enabled) {
        return reply.status(403).send(error(403, `${platform} 适配器未启用`))
      }

      // 验签(若有 webhookSecret)— 按平台读取特定 header
      if (adapter.webhookSecret) {
        const meta = PLATFORM_METADATA[platform]
        // 优先用平台元数据声明的 header,fallback 到通用 header
        const sig =
          (meta.signatureHeader
            ? (request.headers[meta.signatureHeader] as string | undefined)
            : undefined) ??
          (request.headers['x-im-signature'] as string | undefined) ??
          (request.headers['x-lark-signature'] as string | undefined) ??
          (request.headers['x-wecom-signature'] as string | undefined) ??
          (request.headers['x-telegram-bot-api-secret-token'] as string | undefined) ??
          (request.headers['x-hub-signature-256'] as string | undefined) ??
          (request.headers['x-line-signature'] as string | undefined) ??
          (request.headers['x-kakao-signature'] as string | undefined)
        if (!sig) {
          return reply.status(401).send(error(401, '缺少签名 header'))
        }
        const rawBody = JSON.stringify(body)
        // WhatsApp X-Hub-Signature-256 格式 "sha256=<hex>",去掉前缀
        let normalizedSig = sig
        if (sig.startsWith('sha256=')) {
          normalizedSig = sig.slice(7)
        }
        // LINE 用 base64 编码,其余用 hex
        const ok =
          meta.signatureEncoding === 'base64'
            ? verifyHmacBase64(adapter.webhookSecret, rawBody, sig)
            : verifyHmac(adapter.webhookSecret, rawBody, normalizedSig)
        if (!ok) {
          return reply.status(401).send(error(401, '签名校验失败'))
        }
      }

      // 解析入站消息(传入 platform 以支持新平台嵌套 JSON 提取)
      const extracted = parseInboundPayload(body, platform)
      const now = new Date().toISOString()
      const inbound: ImInboundMessage = {
        platform,
        platformMessageId: extracted.platformMessageId ?? randomUUID(),
        fromUserId: extracted.fromUserId ?? 'unknown',
        fromUserName: extracted.fromUserName,
        chatId: extracted.chatId ?? 'default',
        messageType: extracted.messageType,
        text: extracted.text,
        mediaUrl: extracted.mediaUrl,
        isGroup: extracted.isGroup,
        mentionedBot: extracted.mentionedBot,
        rawPayload: body,
        receivedAt: now,
      }

      // 存入 Redis(保留最近 100 条,防止无限增长)
      const key = inboundKey(userId, platform)
      const list = await readJson<ImInboundMessage>(server.redis, inboundFallback, key)
      list.push(inbound)
      if (list.length > 100) list.splice(0, list.length - 100)
      await writeJson(server.redis, inboundFallback, key, list)

      // 触发 ai-service(可选,失败降级)
      if (inbound.text) {
        void triggerAiService({
          userId,
          platform,
          text: inbound.text,
          chatId: inbound.chatId,
          fromUserId: inbound.fromUserId,
        })
      }

      return reply.send(success({ received: true, platform, messageId: inbound.platformMessageId }))
    },
  )

  // 2. POST /im-gateway/send — 发送出站消息到 IM 平台
  server.post('/im-gateway/send', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = sendBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const { platform, chatId, messageType, text, mediaUrl, card, replyToMessageId } = parsed.data
    const adapters = await readAdapters(server.redis, userId)
    const adapter = adapters.find((a) => a.platform === platform)
    if (!adapter) {
      return reply.status(404).send(error(404, `未配置 ${platform} 适配器`))
    }
    if (!adapter.enabled) {
      return reply.status(403).send(error(403, `${platform} 适配器未启用`))
    }

    const outbound: ImOutboundMessage = {
      platform,
      chatId,
      messageType,
      text,
      mediaUrl,
      card,
      replyToMessageId,
    }

    // 发送:新 8 平台走平台 API,原 8 平台走通用 webhook
    const result = await sendToPlatform(platform, outbound, adapter)

    // 存入 Redis 出站历史(无论成功失败都记录,便于审计)
    const key = outboundKey(userId, platform)
    const list = await readJson<ImOutboundMessage>(server.redis, outboundFallback, key)
    list.push(outbound)
    if (list.length > 100) list.splice(0, list.length - 100)
    await writeJson(server.redis, outboundFallback, key, list)

    return reply.send(
      success({
        sent: result.sent,
        platform,
        chatId,
        ...(result.error ? { error: result.error } : {}),
      }),
    )
  })

  // 3. GET /im-gateway/adapters — 列出当前用户的 IM 适配器配置
  server.get('/im-gateway/adapters', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const adapters = await readAdapters(server.redis, userId)
    return reply.send(success({ adapters, total: adapters.length }))
  })

  // 4. POST /im-gateway/adapters — 创建/更新 IM 适配器配置(upsert by platform)
  server.post(
    '/im-gateway/adapters',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!(await checkAuth(request, reply))) return
      const userId = request.userId!

      const parsed = adapterConfigSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const newAdapter: ImAdapterConfig = parsed.data
      const adapters = await readAdapters(server.redis, userId)
      const idx = adapters.findIndex((a) => a.platform === newAdapter.platform)
      if (idx >= 0) {
        adapters[idx] = newAdapter
      } else {
        adapters.push(newAdapter)
      }
      await writeAdapters(server.redis, userId, adapters)

      return reply.status(201).send(success({ adapter: newAdapter, upserted: true }))
    },
  )

  // 5. GET /im-gateway/status — 获取所有 16 个 IM 平台连接状态
  server.get('/im-gateway/status', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const adapters = await readAdapters(server.redis, userId)
    const statuses: ImGatewayStatus[] = []

    // 枚举全部 16 平台:已配置的显示真实状态,未配置的显示 disabled
    for (const platform of ALL_PLATFORMS) {
      const adapter = adapters.find((a) => a.platform === platform)
      if (!adapter) {
        statuses.push({
          platform,
          enabled: false,
          connected: false,
          messageCount: 0,
        })
        continue
      }
      const inList = await readJson<ImInboundMessage>(
        server.redis,
        inboundFallback,
        inboundKey(userId, adapter.platform),
      )
      const outList = await readJson<ImOutboundMessage>(
        server.redis,
        outboundFallback,
        outboundKey(userId, adapter.platform),
      )
      const lastInbound = inList[inList.length - 1]
      statuses.push({
        platform: adapter.platform,
        enabled: adapter.enabled,
        connected: adapter.enabled && (!!adapter.callbackUrl || !!adapter.botToken),
        lastMessageAt: lastInbound?.receivedAt,
        messageCount: inList.length + outList.length,
      })
    }

    return reply.send(success({ statuses, total: statuses.length }))
  })
}
