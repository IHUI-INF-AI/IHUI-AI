// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * IM 平台 gateway 路由(P0,2026-07-31 重构:Postgres 持久化 + 16 平台元数据 + 消息历史)。
 *
 * 接收 IM 平台 webhook 入站消息 + 发送出站消息 + 管理适配器配置 + 查询连接状态 +
 * 查询 16 平台元数据(含配置字段 schema)+ 分页查询消息历史。
 *
 * 持久化:
 *  - 适配器配置 → Postgres `im_adapters` 表(credentialsJson JSONB 存平台特定字段)
 *  - 消息历史(入站 + 出站)→ Postgres `im_messages` 表
 *  - 入站消息同时推送 Redis `im:inbound:<userId>:<platform>` 队列,供 ai-service im_bridge.py 消费
 *
 * 端点(响应 shape 对齐 packages/api-client 契约,data 直接为数组/对象,不嵌套):
 *  - GET  /im-gateway/platforms             16 平台元数据(含 fields schema,前端动态渲染表单)
 *  - GET  /im-gateway/adapters              当前用户的 IM 适配器配置列表
 *  - POST /im-gateway/adapters              创建/更新 IM 适配器配置(upsert by platform)
 *  - GET  /im-gateway/status                16 平台连接状态
 *  - GET  /im-gateway/messages              消息历史(分页)
 *  - POST /im-gateway/send                  发送出站消息到 IM 平台
 *  - POST /im-gateway/webhook/:platform     接收 IM 平台 webhook(无需登录,用 webhookSecret 验签)
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { imAdapters, imMessages } from '@ihui/database'
import type {
  ImAdapterConfig,
  ImAdapterFieldSchema,
  ImAdapterUpsertInput,
  ImGatewayStatus,
  ImInboundMessage,
  ImMessageDirection,
  ImMessageHistoryItem,
  ImMessageType,
  ImOutboundMessage,
  ImPlatform,
  ImPlatformMeta,
} from '@ihui/types'
import { checkAuth, checkAuthOrInternalService } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { fetchWithinDeadline, withBody } from '../utils/fetch-deadline.js'
import {
  INBOUND_DEDUP_TTL_MS,
  OUTBOUND_REQUEST_TIMEOUT_MS,
  applyFoldToOutcome,
  buildInboundDedupKey,
  classifyTransportError,
  createMemoryDedupStore,
  createRedisDedupStore,
  deliverWithPolicy,
  deriveInboundMessageId,
  imOutboundCircuitBreaker,
  interpretPlatformResponse,
  localRejection,
  planOutboundMessages,
  runInboundIntake,
  OutboundCircuitBreaker,
  type ImDeliveryOutcome,
  type InboundDedupStore,
} from '../services/im-outbound-policy.js'

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

const adapterConfigSchema = z.object({
  platform: platformSchema,
  enabled: z.boolean().default(false),
  webhookSecret: z.string().optional(),
  botToken: z.string().optional(),
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  callbackUrl: z.url().optional(),
  useLarkCli: z.boolean().optional(),
})

const sendBodySchema = z.object({
  platform: platformSchema,
  chatId: z.string().min(1),
  messageType: z.enum(['text', 'image', 'file', 'audio', 'video', 'card']).default('text'),
  text: z.string().optional(),
  mediaUrl: z.url().optional(),
  card: z.unknown().optional(),
  replyToMessageId: z.string().optional(),
})

const messagesQuerySchema = z.object({
  platform: platformSchema.optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

// ============================================================================
// 16 平台元数据(含配置字段 schema,供前端动态渲染表单)
// ============================================================================

interface InternalPlatformMeta {
  displayName: string
  inboundFieldType: 'flat' | 'nested'
  signatureHeader?: string
  signatureEncoding: 'hex' | 'base64' | 'none'
  outboundApiPattern?: string
  supportsLarkCli?: boolean
  icon?: string
  fields: ImAdapterFieldSchema[]
}

const PLATFORMS_META: Record<ImPlatform, InternalPlatformMeta> = {
  feishu: {
    displayName: '飞书',
    icon: '🐦',
    inboundFieldType: 'flat',
    signatureHeader: 'x-lark-signature',
    signatureEncoding: 'hex',
    supportsLarkCli: true,
    fields: [
      {
        name: 'appId',
        label: 'App ID',
        type: 'text',
        required: true,
        placeholder: 'cli_xxx',
        helpText: '飞书应用 App ID',
      },
      {
        name: 'appSecret',
        label: 'App Secret',
        type: 'password',
        required: true,
        helpText: '飞书应用 App Secret',
      },
      {
        name: 'webhookSecret',
        label: 'Webhook Secret',
        type: 'password',
        required: false,
        helpText: '事件订阅验签字段',
      },
      {
        name: 'useLarkCli',
        label: '使用 Lark CLI 长连接',
        type: 'switch',
        required: false,
        helpText: '启用后走 lark-cli SDK 替代 webhook',
      },
    ],
  },
  wecom: {
    displayName: '企业微信',
    icon: '💬',
    inboundFieldType: 'flat',
    signatureHeader: 'x-wecom-signature',
    signatureEncoding: 'hex',
    fields: [
      {
        name: 'appId',
        label: 'Corp ID',
        type: 'text',
        required: true,
        helpText: '企业 ID(CorpID)',
      },
      {
        name: 'appSecret',
        label: 'Secret',
        type: 'password',
        required: true,
        helpText: '应用 Secret',
      },
      {
        name: 'webhookSecret',
        label: 'Token',
        type: 'password',
        required: false,
        helpText: '回调 Token(验签)',
      },
      {
        name: 'callbackUrl',
        label: '回调 URL',
        type: 'url',
        required: false,
        helpText: '出站消息回调地址',
      },
    ],
  },
  dingtalk: {
    displayName: '钉钉',
    icon: '📌',
    inboundFieldType: 'flat',
    signatureEncoding: 'none',
    fields: [
      {
        name: 'appId',
        label: 'App Key',
        type: 'text',
        required: true,
        helpText: '钉钉应用 AppKey',
      },
      {
        name: 'appSecret',
        label: 'App Secret',
        type: 'password',
        required: true,
        helpText: '钉钉应用 AppSecret',
      },
      {
        name: 'callbackUrl',
        label: '回调 URL',
        type: 'url',
        required: false,
        helpText: '出站消息回调地址',
      },
    ],
  },
  discord: {
    displayName: 'Discord',
    icon: '🎮',
    inboundFieldType: 'flat',
    signatureEncoding: 'none',
    outboundApiPattern: 'https://discord.com/api/v10/channels/{chatId}/messages',
    fields: [
      {
        name: 'botToken',
        label: 'Bot Token',
        type: 'password',
        required: true,
        helpText: 'Discord Bot Token',
      },
      {
        name: 'callbackUrl',
        label: '回调 URL',
        type: 'url',
        required: false,
        helpText: '出站消息回调地址',
      },
    ],
  },
  telegram: {
    displayName: 'Telegram',
    icon: '✈️',
    inboundFieldType: 'flat',
    signatureHeader: 'x-telegram-bot-api-secret-token',
    signatureEncoding: 'hex',
    outboundApiPattern: 'https://api.telegram.org/bot{token}/sendMessage',
    fields: [
      {
        name: 'botToken',
        label: 'Bot Token',
        type: 'password',
        required: true,
        helpText: 'Telegram Bot Token(从 @BotFather 获取)',
      },
      {
        name: 'webhookSecret',
        label: 'Secret Token',
        type: 'password',
        required: false,
        helpText: 'Webhook Secret Token',
      },
    ],
  },
  slack: {
    displayName: 'Slack',
    icon: '💼',
    inboundFieldType: 'flat',
    signatureEncoding: 'none',
    fields: [
      {
        name: 'botToken',
        label: 'Bot Token',
        type: 'password',
        required: true,
        helpText: 'Slack Bot Token(xoxb-xxx)',
      },
      {
        name: 'webhookSecret',
        label: 'Signing Secret',
        type: 'password',
        required: false,
        helpText: 'Slack Signing Secret',
      },
      {
        name: 'callbackUrl',
        label: '回调 URL',
        type: 'url',
        required: false,
        helpText: '出站消息回调地址',
      },
    ],
  },
  wechat: {
    displayName: '微信',
    icon: 'wechat',
    inboundFieldType: 'flat',
    signatureEncoding: 'none',
    fields: [
      {
        name: 'appId',
        label: 'App ID',
        type: 'text',
        required: true,
        helpText: '微信公众号/小程序 AppID',
      },
      {
        name: 'appSecret',
        label: 'App Secret',
        type: 'password',
        required: true,
        helpText: '微信公众号/小程序 AppSecret',
      },
      {
        name: 'callbackUrl',
        label: '回调 URL',
        type: 'url',
        required: false,
        helpText: '出站消息回调地址',
      },
    ],
  },
  webhook: {
    displayName: '通用 Webhook',
    icon: '🔗',
    inboundFieldType: 'flat',
    signatureHeader: 'x-im-signature',
    signatureEncoding: 'hex',
    fields: [
      {
        name: 'webhookSecret',
        label: 'Webhook Secret',
        type: 'password',
        required: false,
        helpText: 'HMAC-SHA256 验签密钥',
      },
      {
        name: 'callbackUrl',
        label: '回调 URL',
        type: 'url',
        required: true,
        helpText: '出站消息回调地址',
      },
    ],
  },
  whatsapp: {
    displayName: 'WhatsApp Business',
    icon: '📱',
    inboundFieldType: 'nested',
    signatureHeader: 'x-hub-signature-256',
    signatureEncoding: 'hex',
    outboundApiPattern: 'https://graph.facebook.com/v17.0/{phone_id}/messages',
    fields: [
      {
        name: 'botToken',
        label: 'Access Token',
        type: 'password',
        required: true,
        helpText: 'WhatsApp Business API 访问令牌',
      },
      {
        name: 'appId',
        label: 'Phone Number ID',
        type: 'text',
        required: true,
        helpText: '电话号码 ID',
      },
      {
        name: 'webhookSecret',
        label: 'App Secret',
        type: 'password',
        required: false,
        helpText: 'Meta App Secret(验签)',
      },
    ],
  },
  line: {
    displayName: 'LINE',
    icon: '🟢',
    inboundFieldType: 'nested',
    signatureHeader: 'x-line-signature',
    signatureEncoding: 'base64',
    outboundApiPattern: 'https://api.line.me/v2/bot/message/push',
    fields: [
      {
        name: 'botToken',
        label: 'Channel Access Token',
        type: 'password',
        required: true,
        helpText: 'LINE Channel Access Token',
      },
      {
        name: 'webhookSecret',
        label: 'Channel Secret',
        type: 'password',
        required: true,
        helpText: 'LINE Channel Secret(验签)',
      },
    ],
  },
  kakaotalk: {
    displayName: 'KakaoTalk',
    icon: '🟡',
    inboundFieldType: 'flat',
    signatureHeader: 'x-kakao-signature',
    signatureEncoding: 'hex',
    outboundApiPattern: 'https://kapi.kakao.com/v2/api/talk/memo/send',
    fields: [
      {
        name: 'botToken',
        label: 'Access Token',
        type: 'password',
        required: true,
        helpText: 'KakaoTalk 用户访问令牌',
      },
      {
        name: 'webhookSecret',
        label: 'Admin Key',
        type: 'password',
        required: false,
        helpText: 'Kakao Admin Key(验签)',
      },
    ],
  },
  signal: {
    displayName: 'Signal',
    icon: '🔴',
    inboundFieldType: 'nested',
    signatureEncoding: 'none',
    outboundApiPattern: 'http://localhost:8808/v2/send',
    fields: [
      {
        name: 'callbackUrl',
        label: 'signal-cli-rest-api 地址',
        type: 'url',
        required: true,
        placeholder: 'http://localhost:8808',
        helpText: '本地 signal-cli-rest-api 服务地址',
      },
    ],
  },
  matrix: {
    displayName: 'Matrix',
    icon: '🟣',
    inboundFieldType: 'nested',
    signatureEncoding: 'none',
    outboundApiPattern:
      'https://{homeserver}/_matrix/client/r0/rooms/{roomId}/send/m.room.message/{txnId}',
    fields: [
      {
        name: 'botToken',
        label: 'Access Token',
        type: 'password',
        required: true,
        helpText: 'Matrix 访问令牌',
      },
      {
        name: 'callbackUrl',
        label: 'Homeserver',
        type: 'url',
        required: true,
        placeholder: 'https://matrix.org',
        helpText: 'Matrix homeserver 地址',
      },
    ],
  },
  rocketchat: {
    displayName: 'Rocket.Chat',
    icon: '🚀',
    inboundFieldType: 'flat',
    signatureEncoding: 'none',
    outboundApiPattern: 'https://{server}/api/v1/chat.postMessage',
    fields: [
      {
        name: 'botToken',
        label: 'X-Auth-Token',
        type: 'password',
        required: true,
        helpText: 'Rocket.Chat 访问令牌',
      },
      {
        name: 'appId',
        label: 'X-User-Id',
        type: 'text',
        required: true,
        helpText: 'Rocket.Chat 用户 ID',
      },
      {
        name: 'callbackUrl',
        label: 'Server URL',
        type: 'url',
        required: true,
        placeholder: 'https://open.rocket.chat',
        helpText: 'Rocket.Chat 服务器地址',
      },
    ],
  },
  mattermost: {
    displayName: 'Mattermost',
    icon: '🔵',
    inboundFieldType: 'flat',
    signatureEncoding: 'none',
    outboundApiPattern: 'https://{server}/api/v4/posts',
    fields: [
      {
        name: 'botToken',
        label: 'Bearer Token',
        type: 'password',
        required: true,
        helpText: 'Mattermost 个人访问令牌',
      },
      {
        name: 'callbackUrl',
        label: 'Server URL',
        type: 'url',
        required: true,
        placeholder: 'https://mattermost.example.com',
        helpText: 'Mattermost 服务器地址',
      },
    ],
  },
  zulip: {
    displayName: 'Zulip',
    icon: '🟠',
    inboundFieldType: 'flat',
    signatureEncoding: 'none',
    outboundApiPattern: 'https://{server}/api/v1/messages',
    fields: [
      {
        name: 'botToken',
        label: 'API Key',
        type: 'password',
        required: true,
        helpText: 'Zulip Bot API Key',
      },
      {
        name: 'appId',
        label: 'Bot Email',
        type: 'text',
        required: true,
        placeholder: 'bot@example.com',
        helpText: 'Zulip Bot 邮箱',
      },
      {
        name: 'callbackUrl',
        label: 'Server URL',
        type: 'url',
        required: true,
        placeholder: 'https://example.zulipchat.com',
        helpText: 'Zulip 服务器地址',
      },
    ],
  },
}

// ============================================================================
// 辅助:ImAdapterConfig ↔ DB row 转换
// ============================================================================

/** DB row → ImAdapterConfig(credentialsJson 拆解为扁平字段) */
function dbRowToAdapter(row: typeof imAdapters.$inferSelect): ImAdapterConfig {
  const cred = (row.credentialsJson ?? {}) as Record<string, unknown>
  return {
    platform: row.platform as ImPlatform,
    enabled: row.enabled,
    webhookSecret: typeof cred.webhookSecret === 'string' ? cred.webhookSecret : undefined,
    botToken: typeof cred.botToken === 'string' ? cred.botToken : undefined,
    appId: typeof cred.appId === 'string' ? cred.appId : undefined,
    appSecret: typeof cred.appSecret === 'string' ? cred.appSecret : undefined,
    callbackUrl: typeof cred.callbackUrl === 'string' ? cred.callbackUrl : undefined,
    useLarkCli: typeof cred.useLarkCli === 'boolean' ? cred.useLarkCli : undefined,
  }
}

/**
 * G-815418 ①/② 的唯一判定出口(纯函数:不碰 DB、不碰 fastify,便于逐条配对用例钉死)。
 *
 * 为什么必须是"候选集 + 签名匹配",而不是"按 body.userId 取那一行":
 *  旧写法把"用哪个 adapter 的密钥验签"交给请求方自报 ⇒ 任何人指一个别人的 userId,
 *  就用自己的签名走别人的链路;而 404/403 还发生在验签**之前**,等于一个存在性 oracle
 *  (AGENTS §5"两条同形的拒绝口径")。现在同平台的启用行都是候选,**谁家的密钥验过
 *  就是谁家的消息**,归属由服务端算出,请求方说什么都不能替它决定。
 *
 * ② HMAC 的输入是 `rawBody`(原始字节串)。它由调用方负责取到真字节 —— 本函数只看入参,
 *  这样"对再序列化结果算签名"这一型坏法能被构造面直接钉住(见测试的 key-order 对照)。
 *
 * 失败只有一种形状:`{ kind: 'unauthorized' }`。候选缺失 / 全部未启用 / 缺 header /
 *  签名不符 / 无密钥又有多候选 —— 一律同一个结论,由路由回同一个状态码同一句话。
 */
export type WebhookCandidate = { userId: string; enabled: boolean; webhookSecret?: string }
export type WebhookAuthzInput<T extends WebhookCandidate> = {
  rows: T[]
  signatureHeader?: string | null
  signatureEncoding?: string | null
  headers: Record<string, unknown>
  rawBody: string
}
export type WebhookAuthzOutcome<T extends WebhookCandidate> =
  { kind: 'resolved'; adapter: T } | { kind: 'unauthorized' }

/** 兜底 header 清单与旧路由逐字同形(改这里必须同步路由注释,不得两处各写一遍) */
export const WEBHOOK_SIGNATURE_FALLBACK_HEADERS = [
  'x-im-signature',
  'x-lark-signature',
  'x-wecom-signature',
  'x-telegram-bot-api-secret-token',
  'x-hub-signature-256',
  'x-line-signature',
  'x-kakao-signature',
] as const

/**
 * G-815418 ② 的**承载位**:原始字节串由 content-type parser 挂在 fastify 的 request 对象上,
 * 由 webhook handler 取出来喂给 HMAC。
 *
 * 为什么单独成两个函数而不是就地写 `(req as unknown as {rawBody?:string}).rawBody = text`:
 * 落地那一版把值写在 **parser 的第一参数**上,而 handler 读的是 `request.raw` ——
 * fastify v5 的 `lib/content-type-parser.js:219/305` 实参是 `parser.fn(request, body, done)`,
 * 也就是**第一个参数是 FastifyRequest,不是 IncomingMessage**。两个承载对象不同 ⇒
 * 读侧恒 `undefined` ⇒ HMAC 每一次都在算**再序列化结果**(带 warn 但方向是"拒绝合法签名"),
 * 而它自己的源锁用例只钉字符串形状,所以那一条一直是绿的(AGENTS:「判据失效的表现永远是安静」)。
 * 现在写侧与读侧只能经由这两个函数,配对由测试的运行时用例钉住,不再靠人眼对齐属性名。
 */
interface RawBodyCarrier {
  rawBody?: string
}

export function attachWebhookRawBody(carrier: object, text: string): void {
  ;(carrier as RawBodyCarrier).rawBody = text
}

export function readWebhookRawBody(carrier: unknown): string | undefined {
  const value = (carrier as RawBodyCarrier | undefined)?.rawBody
  return typeof value === 'string' ? value : undefined
}

export function resolveWebhookAdapter<T extends WebhookCandidate>(
  input: WebhookAuthzInput<T>,
): WebhookAuthzOutcome<T> {
  const readHeader = (name: string): string | undefined => {
    const v = input.headers[name]
    return typeof v === 'string' ? v : undefined
  }
  const sig =
    (input.signatureHeader ? readHeader(input.signatureHeader) : undefined) ??
    WEBHOOK_SIGNATURE_FALLBACK_HEADERS.map(readHeader).find((s) => s !== undefined)

  const usable = input.rows.filter((r) => r.enabled)
  const withSecret = usable.filter((r) => typeof r.webhookSecret === 'string' && r.webhookSecret)
  if (withSecret.length > 0) {
    if (!sig) return { kind: 'unauthorized' }
    const normalized = sig.startsWith('sha256=') ? sig.slice(7) : sig
    for (const r of withSecret) {
      const ok =
        input.signatureEncoding === 'base64'
          ? verifyHmacBase64(r.webhookSecret as string, input.rawBody, sig)
          : verifyHmac(r.webhookSecret as string, input.rawBody, normalized)
      if (ok) return { kind: 'resolved', adapter: r }
    }
    return { kind: 'unauthorized' }
  }
  // 该平台一个密钥都没配 ⇒ 没有任何可验证的归属凭据。此时只许"恰好一个启用候选"这一种
  // 无歧义形态通过(单机开发部署);多于一个就必须拒,否则又回到"由请求方挑归属"。
  if (usable.length === 1) return { kind: 'resolved', adapter: usable[0] as T }
  return { kind: 'unauthorized' }
}

/** ImAdapterConfig → DB insert(凭证合并到 credentialsJson) */
function adapterToDbRow(userId: string, config: ImAdapterUpsertInput) {
  const credentialsJson: Record<string, unknown> = {}
  if (config.webhookSecret !== undefined) credentialsJson.webhookSecret = config.webhookSecret
  if (config.botToken !== undefined) credentialsJson.botToken = config.botToken
  if (config.appId !== undefined) credentialsJson.appId = config.appId
  if (config.appSecret !== undefined) credentialsJson.appSecret = config.appSecret
  if (config.callbackUrl !== undefined) credentialsJson.callbackUrl = config.callbackUrl
  if (config.useLarkCli !== undefined) credentialsJson.useLarkCli = config.useLarkCli
  return {
    userId,
    platform: config.platform,
    enabled: config.enabled,
    credentialsJson,
    updatedAt: new Date(),
  }
}

// ============================================================================
// 辅助:webhook 验签(HMAC-SHA256,hex/base64 编码)
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
  let platformMessageId = pickString(body, ['message_id', 'messageId', 'msg_id', 'msgId', 'id'])

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
  const mediaUrl = pickString(body, [
    'media_url',
    'mediaUrl',
    'file_url',
    'fileUrl',
    'image',
    'pic_url',
  ])
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
    ? ((pickString(body, [
        'message_type',
        'messageType',
        'msg_type',
        'msgType',
      ]) as ImMessageType) ?? 'image')
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
// 辅助:推入站消息到 Redis 队列(供 ai-service im_bridge.py 消费)
// ============================================================================

async function enqueueInboundForAiService(
  redis:
    | {
        get: (k: string) => Promise<string | null>
        set: (k: string, v: string) => Promise<unknown>
      }
    | null
    | undefined,
  userId: string,
  platform: ImPlatform,
  inbound: ImInboundMessage,
): Promise<{ queued: boolean; reason?: string }> {
  if (!redis) return { queued: false, reason: 'Redis 未就绪' }
  try {
    const key = `im:inbound:${userId}:${platform}`
    const raw = await redis.get(key)
    const list: unknown[] = raw ? (JSON.parse(raw) as unknown[]) : []
    list.push(inbound)
    // 保留最近 100 条,防止无限增长
    if (list.length > 100) list.splice(0, list.length - 100)
    await redis.set(key, JSON.stringify(list))
    return { queued: true }
  } catch (e) {
    // Redis 不可用:消息已持久化到 Postgres,ai-service 降级不消费 —— 如实回 queued=false,
    // 由调用方写进响应(G-815416 的"账面绿而没人知道那一步发生了什么"就坏在旧写法静默 return)。
    return { queued: false, reason: (e as Error).message || 'Redis 写入失败' }
  }
}

// ============================================================================
// 辅助:通用 fetch(G-815413 — deadline 罩到响应体消费结束;失败返回可分辨结论,不抛异常)
// ============================================================================

/**
 * 旧写法三处同时坏:
 *  ① `clearTimeout` 紧跟 `await fetch(...)` ⇒ 罩子在**响应头到达**时就撤了,而 `fetch` 正是
 *     在 headers 到达时 resolve 的(providerRequest.ts:29-40 写的就是这个);
 *  ② 从不消费响应体 ⇒ 平台"发完 headers 之后停滞"时这条请求既不超时也不报错,
 *     永久占住调用方;
 *  ③ 只回 `resp.ok` ⇒ 2xx 里的业务拒绝与"没回 message_id"全被记成投递成功。
 * 现在超时出口复用 `utils/fetch-deadline.ts`(**不得造第二份超时出口**),
 * 并在同一个罩子里把响应体读完,再交给 `interpretPlatformResponse`。
 */
export async function doFetch(
  url: string,
  init: RequestInit,
  label: string,
): Promise<ImDeliveryOutcome> {
  let resp: Response
  try {
    resp = await fetchWithinDeadline(url, init, {
      timeoutMs: OUTBOUND_REQUEST_TIMEOUT_MS,
      label,
    })
  } catch (e) {
    return classifyTransportError(e)
  }
  let bodyText = ''
  try {
    // withBody:消费 settle(成功或抛错)之后才 clearTimeout —— 这一行就是本票的落点。
    bodyText = await withBody(resp, (r) => r.text())
  } catch (e) {
    return classifyTransportError(e)
  }
  return interpretPlatformResponse(resp.status, bodyText)
}

// ============================================================================
// 辅助:出站消息发送 — 原 8 平台沿用通用 webhook adapter
// ============================================================================

async function deliverOutbound(
  adapter: ImAdapterConfig,
  message: ImOutboundMessage,
): Promise<ImDeliveryOutcome> {
  if (!adapter.callbackUrl) {
    return localRejection('callbackUrl 未配置')
  }
  return doFetch(
    adapter.callbackUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    },
    `im-gateway→${message.platform} callbackUrl`,
  )
}

// ============================================================================
// 辅助:出站消息发送 — 新 8 平台 API 适配
// ============================================================================

async function sendWhatsApp(
  message: ImOutboundMessage,
  adapter: ImAdapterConfig,
): Promise<ImDeliveryOutcome> {
  if (!adapter.botToken || !adapter.appId) {
    return localRejection('WhatsApp 需要 botToken(访问令牌)和 appId(电话号码 ID)')
  }
  const url = `https://graph.facebook.com/v17.0/${adapter.appId}/messages`
  return doFetch(
    url,
    {
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
    },
    'im-gateway→whatsapp messages',
  )
}

async function sendLine(
  message: ImOutboundMessage,
  adapter: ImAdapterConfig,
): Promise<ImDeliveryOutcome> {
  if (!adapter.botToken) {
    return localRejection('LINE 需要 botToken(Channel Access Token)')
  }
  return doFetch(
    'https://api.line.me/v2/bot/message/push',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adapter.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: message.chatId,
        messages: [{ type: 'text', text: message.text ?? '' }],
      }),
    },
    'im-gateway→line push',
  )
}

async function sendKakaoTalk(
  message: ImOutboundMessage,
  adapter: ImAdapterConfig,
): Promise<ImDeliveryOutcome> {
  if (!adapter.botToken) {
    return localRejection('KakaoTalk 需要 botToken(用户访问令牌)')
  }
  const template = {
    object_type: 'text',
    text: message.text ?? '',
    link: { web_url: 'https://example.com' },
  }
  return doFetch(
    'https://kapi.kakao.com/v2/api/talk/memo/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adapter.botToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `template_object=${encodeURIComponent(JSON.stringify(template))}`,
    },
    'im-gateway→kakao memo',
  )
}

async function sendSignal(
  message: ImOutboundMessage,
  adapter: ImAdapterConfig,
): Promise<ImDeliveryOutcome> {
  const baseUrl = adapter.callbackUrl ?? 'http://localhost:8808'
  return doFetch(
    `${baseUrl}/v2/send`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message.text ?? '',
        number: message.chatId,
      }),
    },
    'im-gateway→signal v2/send',
  )
}

async function sendMatrix(
  message: ImOutboundMessage,
  adapter: ImAdapterConfig,
): Promise<ImDeliveryOutcome> {
  if (!adapter.botToken || !adapter.callbackUrl) {
    return localRejection('Matrix 需要 botToken(访问令牌)和 callbackUrl(homeserver)')
  }
  const txnId = randomUUID()
  const url = `${adapter.callbackUrl}/_matrix/client/r0/rooms/${encodeURIComponent(message.chatId)}/send/m.room.message/${txnId}`
  return doFetch(
    url,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adapter.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msgtype: 'm.text',
        body: message.text ?? '',
      }),
    },
    'im-gateway→matrix room send',
  )
}

async function sendRocketChat(
  message: ImOutboundMessage,
  adapter: ImAdapterConfig,
): Promise<ImDeliveryOutcome> {
  if (!adapter.botToken || !adapter.appId || !adapter.callbackUrl) {
    return localRejection(
      'Rocket.Chat 需要 botToken(X-Auth-Token)、appId(X-User-Id)、callbackUrl(server)',
    )
  }
  return doFetch(
    `${adapter.callbackUrl}/api/v1/chat.postMessage`,
    {
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
    },
    'im-gateway→rocketchat postMessage',
  )
}

async function sendMattermost(
  message: ImOutboundMessage,
  adapter: ImAdapterConfig,
): Promise<ImDeliveryOutcome> {
  if (!adapter.botToken || !adapter.callbackUrl) {
    return localRejection('Mattermost 需要 botToken(Bearer)和 callbackUrl(server)')
  }
  return doFetch(
    `${adapter.callbackUrl}/api/v4/posts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adapter.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel_id: message.chatId,
        message: message.text ?? '',
      }),
    },
    'im-gateway→mattermost posts',
  )
}

async function sendZulip(
  message: ImOutboundMessage,
  adapter: ImAdapterConfig,
): Promise<ImDeliveryOutcome> {
  if (!adapter.botToken || !adapter.appId || !adapter.callbackUrl) {
    return localRejection('Zulip 需要 botToken(api_key)、appId(bot_email)、callbackUrl(server)')
  }
  const basicAuth = Buffer.from(`${adapter.appId}:${adapter.botToken}`).toString('base64')
  return doFetch(
    `${adapter.callbackUrl}/api/v1/messages`,
    {
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
    },
    'im-gateway→zulip messages',
  )
}

/** 出站消息统一分发:新 8 平台走平台 API,原 8 平台走通用 callbackUrl(单份载荷,不含重试) */
async function sendToPlatform(
  platform: ImPlatform,
  message: ImOutboundMessage,
  adapter: ImAdapterConfig,
): Promise<ImDeliveryOutcome> {
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
      return deliverOutbound(adapter, message)
  }
}

// ============================================================================
// 辅助:入站去重存储(G-815415)
// ============================================================================

/**
 * Redis 在位时用它(多实例共享);不可用时退到进程内存档。
 * 内存档**不跨进程**——这是降级不是等价,所以多实例部署必须让 Redis 在位。
 */
const memoryDedupStore = createMemoryDedupStore()
let redisDedupStoreCache: { redis: unknown; store: InboundDedupStore } | null = null

function dedupStoreFor(redis: unknown): InboundDedupStore {
  if (!redis) return memoryDedupStore
  if (redisDedupStoreCache && redisDedupStoreCache.redis === redis)
    return redisDedupStoreCache.store
  const store = createRedisDedupStore(redis as Parameters<typeof createRedisDedupStore>[0])
  redisDedupStoreCache = { redis, store }
  return store
}

// ============================================================================
// 路由
// ============================================================================

export const imGatewayRoutes: FastifyPluginAsync = async (server) => {
  // 1. GET /im-gateway/platforms — 16 平台元数据(含 fields schema)
  server.get('/im-gateway/platforms', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const platforms: ImPlatformMeta[] = ALL_PLATFORMS.map((platform) => {
      const meta = PLATFORMS_META[platform]
      return {
        platform,
        displayName: meta.displayName,
        icon: meta.icon,
        inboundFieldType: meta.inboundFieldType,
        signatureHeader: meta.signatureHeader,
        signatureEncoding: meta.signatureEncoding,
        outboundApiPattern: meta.outboundApiPattern,
        supportsLarkCli: meta.supportsLarkCli,
        fields: meta.fields,
      }
    })
    return reply.send(success(platforms))
  })

  // G-815418 ②:验签必须对**原始字节**做 HMAC。默认 JSON parser 会把正文变成对象,再序列化时
  // key 顺序/空白/数字格式任一差异都会让合法签名失败(失败方向是拒绝,所以它今天不响而一直坏)。
  // 这里在**本插件作用域**内按字符串收正文、把真字节挂在 request.raw 上,再 JSON.parse 交回给
  // 既有 handler —— 语义与默认 parser 一致,只是多留一份原始串。不用 fastify-plugin ⇒ 不污染全 API。
  //
  // 形参显式标注(而不是让 TS 去推断)另有一条现实理由:签名 callback 一旦带上类型标注,
  // 这一行的宽度就超过 prettier 的 100 列,展开形态成为**规范形态**;而不展开时
  // `tests/im-gateway-webhook-authz.test.ts` 那条"parser 必须保留"的源锁会因为
  // lint-staged 的 prettier 重排而红(它钉的是换行后的字面形状)。一处显式类型,同时买
  // 「类型诚实」与「格式化稳定」两件事。
  server.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req: FastifyRequest, payload: string, done: (err: Error | null, body?: unknown) => void) => {
      const text = typeof payload === 'string' ? payload : ''
      attachWebhookRawBody(req, text)
      try {
        done(null, text.length ? (JSON.parse(text) as unknown) : {})
      } catch (e) {
        done(e as Error)
      }
    },
  )

  // 2. POST /im-gateway/webhook/:platform — 接收 IM 平台 webhook(无需登录)
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

      const body = (request.body ?? {}) as Record<string, unknown>
      // G-815418 ①:归属由服务端按"谁家密钥验得过"算出,不再由客户端自报的 body.userId 挑密钥。
      // G-815418 ②:HMAC 的输入是**原始字节串**(由本插件作用域的 JSON parser 挂在 request 上);
      //   取不到真字节才退回再序列化,并把这件事喊出来 —— 静默用错档会让合法签名被误拒。
      //   承载对象必须是 `request` 本身而不是 `request.raw`:fastify 把 parser 的第一个实参
      //   就是 request(FastifyRequest),写侧与读侧不同对象 ⇒ 读侧恒 undefined(见 attachWebhookRawBody 头注)。
      const meta = PLATFORMS_META[platform]
      const adapterRows = await dbRead
        .select()
        .from(imAdapters)
        .where(eq(imAdapters.platform, platform))
      const carriedRawBody = readWebhookRawBody(request)
      const rawBody = carriedRawBody ?? JSON.stringify(body)
      if (carriedRawBody === undefined) {
        request.log.warn(
          'im-gateway webhook:未取到原始字节,本趟退回再序列化(合法签名可能被误拒,不是放行)',
        )
      }
      const decided = resolveWebhookAdapter({
        rows: adapterRows.map((r) => {
          const cred = (r.credentialsJson ?? {}) as Record<string, unknown>
          return {
            userId: r.userId,
            enabled: r.enabled,
            webhookSecret: typeof cred.webhookSecret === 'string' ? cred.webhookSecret : undefined,
          }
        }),
        signatureHeader: meta.signatureHeader,
        signatureEncoding: meta.signatureEncoding,
        headers: request.headers,
        rawBody,
      })
      if (decided.kind === 'unauthorized') {
        // 同形回包:没有候选 / 全部未启用 / 缺 header / 签名不符 —— 状态码与消息一字不差,
        // 请求方因此问不出"这个平台上有没有配过 adapter"(存在性 oracle 关闭)。
        return reply.status(401).send(error(401, '签名校验失败'))
      }
      // 落库与入队用的 userId 现在**只能来自验签结果**,不接受请求体自报值。
      // (旧代码在这里还要 dbRowToAdapter(adapterRow) 拿整份配置,但验签之后的链路只认
      //  owner 身份;需要出站配置时另有 GET /im-gateway/adapters 面,不在这一支。)
      const userId = decided.adapter.userId

      // 解析入站消息
      const extracted = parseInboundPayload(body, platform)
      const now = new Date().toISOString()

      // G-815415:去重范围 = 平台 + 归属用户(验签算出的那个)+ 会话(没有会话退到发送者),
      // 消息标识 = 平台带的 id,没带则用「发送者 + 正文哈希」的**可复现** id。
      const dedupInput = {
        platform,
        userId,
        chatId: extracted.chatId,
        fromUserId: extracted.fromUserId,
        platformMessageId: extracted.platformMessageId,
        text: extracted.text,
      }
      // 旧写法这里写的是 `extracted.platformMessageId ?? randomUUID()`:平台不带 id 时
      // 每次重投都换一个 id ⇒ 二次落库 + 二次入队 + LLM 回两遍。
      const platformMessageId = deriveInboundMessageId(dedupInput)
      const dedupKey = buildInboundDedupKey(dedupInput)
      const inbound: ImInboundMessage = {
        platform,
        platformMessageId,
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

      // 持久化到 Postgres im_messages 表
      const contentText =
        extracted.text ??
        (extracted.mediaUrl ? `[${extracted.messageType}] ${extracted.mediaUrl}` : '')

      // claim → persist → handoff 的唯一流程在策略层(runInboundIntake),失败撤回也在那一处;
      // 路由只负责把三个动作接起来并把结论写进响应。
      const intake = await runInboundIntake(
        dedupStoreFor(server.redis),
        dedupKey,
        INBOUND_DEDUP_TTL_MS,
        {
          persist: async () => {
            await db.insert(imMessages).values({
              userId,
              platform,
              direction: 'inbound' as ImMessageDirection,
              chatId: inbound.chatId,
              platformMessageId: inbound.platformMessageId,
              content: contentText,
              rawPayload: body,
              deliveryStatus: 'sent',
            })
          },
          handoff: () => enqueueInboundForAiService(server.redis, userId, platform, inbound),
        },
      )

      if (intake.disposition === 'duplicate') {
        // 重投被吞掉是**预期行为**,但必须留痕:静默返回和"收到了新消息"在账面上长得一样。
        return reply.send(
          success({ received: true, platform, messageId: platformMessageId, duplicated: true }),
        )
      }

      return reply.send(
        success({
          received: true,
          platform,
          messageId: inbound.platformMessageId,
          // claim==='unknown' ⇒ 去重判不出(Redis 命令失败)。放行优先于去重:
          // 宁可重复落库,也不静默丢消息 —— 但这件事必须写进响应而不是咽下去。
          ...(intake.dedupUndetermined ? { dedupUndetermined: true } : {}),
          ...(intake.queued ? {} : { aiQueued: false, aiQueueReason: intake.queueReason }),
        }),
      )
    },
  )

  // 3. POST /im-gateway/send — 发送出站消息到 IM 平台
  server.post('/im-gateway/send', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuthOrInternalService(request, reply))) return
    const userId = request.userId!

    const parsed = sendBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const { platform, chatId, messageType, text, mediaUrl, card, replyToMessageId } = parsed.data
    const [adapterRow] = await dbRead
      .select()
      .from(imAdapters)
      .where(and(eq(imAdapters.userId, userId), eq(imAdapters.platform, platform)))
      .limit(1)
    if (!adapterRow) {
      return reply.status(404).send(error(404, `未配置 ${platform} 适配器`))
    }
    if (!adapterRow.enabled) {
      return reply.status(403).send(error(403, `${platform} 适配器未启用`))
    }
    const adapter = dbRowToAdapter(adapterRow)

    const outbound: ImOutboundMessage = {
      platform,
      chatId,
      messageType,
      text,
      mediaUrl,
      card,
      replyToMessageId,
    }

    // G-815417:长文本按平台上限分段(优先 \n/空格边界、无边界才带标记硬切);
    // G-815416:逐段走**同一份**投递策略(有界重试 + 退避 + 熔断),路由不再自己抄循环。
    const planned = planOutboundMessages(outbound)
    const report = await deliverWithPolicy(planned.items, {
      circuit: imOutboundCircuitBreaker,
      circuitKey: OutboundCircuitBreaker.keyFor(userId, platform),
      sendItem: (item) => sendToPlatform(platform, item, adapter),
    })
    const result = applyFoldToOutcome(report.outcome, planned.rendered?.omittedSegmentCount ?? 0)
    const segmentsPlanned = planned.rendered?.messages.length

    // 持久化到 Postgres im_messages 表(无论成功失败都记录,便于审计)
    const contentText =
      text ?? (mediaUrl ? `[${messageType}] ${mediaUrl}` : card ? JSON.stringify(card) : '')
    await db.insert(imMessages).values({
      userId,
      platform,
      direction: 'outbound' as ImMessageDirection,
      chatId,
      platformMessageId: result.providerMessageId,
      content: contentText,
      rawPayload: {
        ...outbound,
        ...(result.reason ? { deliveryError: result.reason } : {}),
        deliveryStatus: result.status,
        deliveryAttempts: result.attempts,
        ...(segmentsPlanned ? { segmentsPlanned } : {}),
      },
      deliveryStatus: result.ok ? 'sent' : 'failed',
      errorMessage: result.reason,
    })

    return reply.send(
      success({
        // `sent` 保留(api-client 的 SendImMessageResult 契约),但它不再是一切的结论:
        // 结论在 status —— business-rejected / no-receipt / partial / circuit-open 都能被区分。
        sent: result.ok,
        status: result.status,
        platform,
        chatId,
        attempts: result.attempts,
        ...(result.providerMessageId ? { providerMessageId: result.providerMessageId } : {}),
        ...(planned.rendered
          ? {
              segments: planned.rendered.messages.length,
              omittedSegmentCount: planned.rendered.omittedSegmentCount,
              hardCutCount: planned.rendered.hardCutCount,
            }
          : {}),
        ...(result.reason ? { error: result.reason } : {}),
      }),
    )
  })

  // 4. GET /im-gateway/adapters — 列出当前用户的 IM 适配器配置
  server.get('/im-gateway/adapters', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const rows = await dbRead
      .select()
      .from(imAdapters)
      .where(eq(imAdapters.userId, userId))
      .orderBy(desc(imAdapters.createdAt))
    const adapters = rows.map(dbRowToAdapter)
    return reply.send(success(adapters))
  })

  // 5. POST /im-gateway/adapters — 创建/更新 IM 适配器配置(upsert by platform)
  server.post('/im-gateway/adapters', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = adapterConfigSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const input = parsed.data as ImAdapterUpsertInput
    const dbRow = adapterToDbRow(userId, input)

    // upsert:onConflictDoUpdate by (userId, platform)
    const [upserted] = await db
      .insert(imAdapters)
      .values({
        ...dbRow,
        // 新建时 schemaVersion=1;更新时不动 schemaVersion
      })
      .onConflictDoUpdate({
        target: [imAdapters.userId, imAdapters.platform],
        set: {
          enabled: dbRow.enabled,
          credentialsJson: dbRow.credentialsJson,
          updatedAt: new Date(),
        },
      })
      .returning()

    if (!upserted) {
      return reply.status(500).send(error(500, '保存适配器配置失败'))
    }

    return reply.status(201).send(success(dbRowToAdapter(upserted)))
  })

  // 6. GET /im-gateway/status — 获取 16 平台连接状态
  server.get('/im-gateway/status', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    // 一次性查所有 adapter + 消息计数
    const adapterRows = await dbRead.select().from(imAdapters).where(eq(imAdapters.userId, userId))
    const adapterMap = new Map(adapterRows.map((r) => [r.platform, r]))

    // 查每个已配置平台的消息数 + 最后消息时间(单查询聚合)
    const msgAggRows = await dbRead
      .select({
        platform: imMessages.platform,
        messageCount: sql<number>`COUNT(*)::int`,
        lastMessageAt: sql<string | null>`MAX(${imMessages.createdAt})::text`,
      })
      .from(imMessages)
      .where(eq(imMessages.userId, userId))
      .groupBy(imMessages.platform)

    const msgAggMap = new Map(msgAggRows.map((r) => [r.platform, r]))

    const statuses: ImGatewayStatus[] = ALL_PLATFORMS.map((platform) => {
      const adapterRow = adapterMap.get(platform)
      if (!adapterRow) {
        return {
          platform,
          enabled: false,
          connected: false,
          messageCount: 0,
        }
      }
      const adapter = dbRowToAdapter(adapterRow)
      const agg = msgAggMap.get(platform)
      return {
        platform,
        enabled: adapter.enabled,
        connected: adapter.enabled && (!!adapter.callbackUrl || !!adapter.botToken),
        lastMessageAt: agg?.lastMessageAt ?? undefined,
        messageCount: agg?.messageCount ?? 0,
      }
    })

    return reply.send(success(statuses))
  })

  // 7. GET /im-gateway/messages — 消息历史(分页)
  server.get('/im-gateway/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = messagesQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { platform, direction, limit, offset } = parsed.data

    const conds = [eq(imMessages.userId, userId)]
    if (platform) conds.push(eq(imMessages.platform, platform))
    if (direction) conds.push(eq(imMessages.direction, direction))
    const where = and(...conds)

    const [list, totalRows] = await Promise.all([
      dbRead
        .select({
          id: imMessages.id,
          userId: imMessages.userId,
          platform: imMessages.platform,
          direction: imMessages.direction,
          content: imMessages.content,
          rawPayload: imMessages.rawPayload,
          createdAt: imMessages.createdAt,
        })
        .from(imMessages)
        .where(where)
        .orderBy(desc(imMessages.createdAt))
        .limit(limit)
        .offset(offset),
      dbRead
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(imMessages)
        .where(where),
    ])

    const items: ImMessageHistoryItem[] = list.map((r) => ({
      id: r.id,
      userId: r.userId,
      platform: r.platform as ImPlatform,
      direction: r.direction as ImMessageDirection,
      content: r.content ?? '',
      rawPayload: r.rawPayload,
      createdAt: r.createdAt.toISOString(),
    }))

    return reply.send(
      success({
        items,
        total: totalRows[0]?.count ?? 0,
        limit,
        offset,
      }),
    )
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
