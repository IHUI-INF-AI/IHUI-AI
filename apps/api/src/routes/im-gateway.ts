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
 *  - GET  /im-gateway/status                 获取所有 IM 平台连接状态
 *
 * P1 简化:
 *  - 出站消息仅实现 webhook 通用 adapter(POST 到 callbackUrl),不实现飞书/企业微信 SDK
 *  - webhook 验签用通用 HMAC-SHA256 比对,不区分平台 header 名(读取 X-Im-Signature)
 *  - 入站消息通用解析(从常见字段提取 text/chatId/fromUserId),不区分平台 payload 结构
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
])

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
// 辅助:webhook 验签(HMAC-SHA256)
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

function parseInboundPayload(
  body: Record<string, unknown>,
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
  const text =
    pickString(body, ['text', 'content', 'message', 'msg']) ??
    (typeof body.event === 'object' && body.event !== null
      ? pickString(body.event as Record<string, unknown>, ['text', 'content', 'message'])
      : undefined)
  const chatId = pickString(body, [
    'chat_id',
    'chatId',
    'group_id',
    'groupId',
    'conversation_id',
    'conversationId',
    'room_id',
    'roomId',
  ])
  const fromUserId = pickString(body, [
    'from',
    'fromUserId',
    'from_user_id',
    'sender_id',
    'senderId',
    'user_id',
    'userId',
    'uid',
  ])
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
  const platformMessageId = pickString(body, [
    'message_id',
    'messageId',
    'msg_id',
    'msgId',
    'id',
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
// 辅助:出站消息发送(本轮仅 webhook 通用 adapter)
// ============================================================================

async function deliverOutbound(
  adapter: ImAdapterConfig,
  message: ImOutboundMessage,
): Promise<{ sent: boolean; error?: string }> {
  if (!adapter.callbackUrl) {
    return { sent: false, error: 'callbackUrl 未配置' }
  }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const resp = await fetch(adapter.callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
      signal: controller.signal,
    })
    clearTimeout(timer)
    return { sent: resp.ok, error: resp.ok ? undefined : `HTTP ${resp.status}` }
  } catch (e) {
    return { sent: false, error: (e as Error).message || '投递失败' }
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
      const platform = parsedPlatform.data

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

      // 验签(若有 webhookSecret)
      if (adapter.webhookSecret) {
        const signature =
          (request.headers['x-im-signature'] as string | undefined) ??
          (request.headers['x-lark-signature'] as string | undefined) ??
          (request.headers['x-wecom-signature'] as string | undefined) ??
          (request.headers['x-telegram-bot-api-secret-token'] as string | undefined)
        if (!signature) {
          return reply.status(401).send(error(401, '缺少签名 header'))
        }
        const rawBody = JSON.stringify(body)
        if (!verifyHmac(adapter.webhookSecret, rawBody, signature)) {
          return reply.status(401).send(error(401, '签名校验失败'))
        }
      }

      // 解析入站消息
      const extracted = parseInboundPayload(body)
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

    // 发送(本轮仅 webhook 通用 adapter)
    const result = await deliverOutbound(adapter, outbound)

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

  // 5. GET /im-gateway/status — 获取所有 IM 平台连接状态
  server.get('/im-gateway/status', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const adapters = await readAdapters(server.redis, userId)
    const statuses: ImGatewayStatus[] = []

    for (const adapter of adapters) {
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
        connected: adapter.enabled && !!adapter.callbackUrl,
        lastMessageAt: lastInbound?.receivedAt,
        messageCount: inList.length + outList.length,
      })
    }

    return reply.send(success({ statuses, total: statuses.length }))
  })
}
