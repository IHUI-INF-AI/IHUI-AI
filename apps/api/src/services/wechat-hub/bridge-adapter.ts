// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 通用 HTTP 桥适配器。
 *
 * 不绑定某一个上游实现，只约定最小契约，因而同一份代码可接：
 *  - WeChatFerry 的 HTTP SDK（本地 hook）
 *  - wxauto / pywechat 的 REST 封装（Windows 微信 RPA）
 *  - chatlog / wechat-decrypt 的本地 HTTP API（只读数据源）
 *  - 自建 relay（把任意后端转成 HTTP）
 *
 * 约定（可由 credentials 覆盖）：
 *  - GET  {baseUrl}{statusPath}    探活，返回 2xx 即视为在线
 *  - GET  {baseUrl}{messagesPath}?since=<cursor>&limit=100  拉增量
 *        返回 { messages: [...] } / { data: [...] } / 裸数组
 *  - POST {baseUrl}{sendPath}      { target, type, text?, url?, fileName?, token? }
 *        返回 { ok: true, messageId } 或 { code: 0, data: { messageId } }
 *  - POST {baseUrl}/typing        { target, on }（可选，失败忽略）
 *
 * 桥自身回执/错误语义由 HTTP 状态 + JSON 字段表达，适配器不替桥猜。
 */

import type {
  WechatAccountStatus,
  WechatActionResult,
  WechatBackend,
  WechatBridgeAction,
  WechatMessageKind,
  WechatQrCodeView,
  WechatSendResult,
} from '@ihui/types'
import type {
  WechatAdapter,
  WechatAdapterContext,
  WechatInboundEvent,
  WechatMediaInput,
  WechatSendOptions,
} from './types.js'
import { localRejected, transportError } from './types.js'

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function firstString(record: JsonRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(record[key])
    if (value) return value
  }
  return null
}

function firstNumber(record: JsonRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = asNumber(record[key])
    if (value !== null) return value
  }
  return null
}

const KIND_ALIASES: Record<string, WechatMessageKind> = {
  text: 'text',
  txt: 'text',
  image: 'image',
  img: 'image',
  picture: 'image',
  voice: 'voice',
  audio: 'voice',
  video: 'video',
  file: 'file',
  link: 'link',
  card: 'card',
  system: 'system',
}

function normalizeKind(value: string | null): WechatMessageKind {
  if (!value) return 'text'
  return KIND_ALIASES[value.toLowerCase()] ?? 'other'
}

function parseSentAt(record: JsonRecord): Date {
  const numeric = firstNumber(record, ['timestamp', 'createTime', 'create_time', 'time', 'sentAt'])
  if (numeric !== null) {
    // 微信桥常见 10 位秒 / 13 位毫秒
    return new Date(numeric > 1_000_000_000_000 ? numeric : numeric * 1000)
  }
  const iso = firstString(record, ['timestamp', 'createTime', 'sentAt'])
  if (iso) {
    const parsed = new Date(iso)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date()
}

function parseGroupMembers(
  root: JsonRecord,
  record: JsonRecord,
): WechatInboundEvent['groupMembers'] {
  const raw = [...asArray(root.members), ...asArray(root.groupMembers), ...asArray(record.members)]
  const members: NonNullable<WechatInboundEvent['groupMembers']> = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item === 'string' && item.length > 0) {
      if (!seen.has(item)) {
        seen.add(item)
        members.push({ memberId: item, nickname: '', role: 'member' })
      }
      continue
    }
    const member = asRecord(item)
    if (!member) continue
    const memberId = firstString(member, ['memberId', 'member_id', 'wxid', 'id', 'userId'])
    if (!memberId || seen.has(memberId)) continue
    seen.add(memberId)
    const roleValue = firstString(member, ['role', 'memberRole'])?.toLowerCase()
    members.push({
      memberId,
      nickname: firstString(member, ['nickname', 'name', 'displayName', 'remark']) ?? '',
      role: roleValue === 'owner' || roleValue === 'admin' ? roleValue : 'member',
    })
  }
  return members.length > 0 ? members : undefined
}

/**
 * 把桥的任意 payload 归一化成入站事件。
 * 支持三种常见形状：单条消息、{ messages: [] }、{ data: [] }。
 */
export function normalizeBridgePayload(payload: unknown): WechatInboundEvent[] {
  // 裸数组也是合法形状(桥常直接回消息列表)：包一层 data，后面统一按数组处理。
  const root = asRecord(payload) ?? (Array.isArray(payload) ? { data: payload } : null)
  if (!root) return []
  const candidates: JsonRecord[] = []
  const single = asRecord(root.message)
  if (single) candidates.push(single)
  const dataRecord = asRecord(root.data)
  if (dataRecord && !Array.isArray(root.data)) candidates.push(dataRecord)
  for (const item of asArray(root.messages)) {
    const record = asRecord(item)
    if (record) candidates.push(record)
  }
  for (const item of asArray(root.data)) {
    const record = asRecord(item)
    if (record) candidates.push(record)
  }
  for (const item of asArray(root.items)) {
    const record = asRecord(item)
    if (record) candidates.push(record)
  }
  if (candidates.length === 0) candidates.push(root)

  const events: WechatInboundEvent[] = []
  for (const record of candidates) {
    const id =
      firstString(record, ['id', 'messageId', 'message_id', 'msgId', 'msg_id']) ??
      `bridge-${Date.now()}-${events.length}`
    const chatId =
      firstString(record, ['chatId', 'chat_id', 'roomId', 'room_id', 'conversationId']) ??
      firstString(record, ['sender', 'from', 'senderId']) ??
      'unknown'
    const senderId = firstString(record, ['sender', 'from', 'senderId', 'sender_id', 'wxid'])
    const senderName = firstString(record, ['senderName', 'sender_name', 'fromName', 'nickname'])
    const kindValue = firstString(record, ['type', 'msgType', 'msg_type', 'kind'])
    const kind = normalizeKind(kindValue)
    const content =
      firstString(record, ['content', 'text', 'message', 'body']) ??
      (kind === 'image' ? '[图片]' : kind === 'voice' ? '[语音]' : kind === 'video' ? '[视频]' : '')
    const mediaUrl = firstString(record, ['mediaUrl', 'media_url', 'url', 'fileUrl', 'file_url'])
    const isGroup =
      firstString(record, ['roomId', 'room_id']) !== null ||
      firstString(record, ['chatType', 'chat_type', 'conversationType']) === 'group' ||
      chatId.endsWith('@chatroom') ||
      kindValue === 'group'
    events.push({
      platformMessageId: id,
      platformChatId: chatId,
      conversationKind: isGroup ? 'group' : 'private',
      conversationTitle:
        firstString(record, ['roomName', 'room_name', 'chatName', 'chat_name']) ?? null,
      senderId,
      senderName,
      kind,
      content,
      mediaUrl,
      sentAt: parseSentAt(record),
      groupMembers: isGroup ? parseGroupMembers(root, record) : undefined,
      raw: {
        source: 'bridge',
        type: kindValue ?? 'text',
        chatId,
        hasMedia: Boolean(mediaUrl),
      },
      contextToken: firstString(record, ['contextToken', 'context_token']),
    })
  }
  return events
}

export class BridgeAdapter implements WechatAdapter {
  readonly backend: WechatBackend = 'bridge'

  private ctx: WechatAdapterContext | null = null
  private status: WechatAccountStatus = 'disconnected'
  private running = false
  private cursor = ''
  private baseUrl = ''
  private token = ''
  private statusPath = '/status'
  private messagesPath = '/messages'
  private sendPath = '/send'
  private actionPath = '/action'
  private pollIntervalMs = 2_000

  async connect(ctx: WechatAdapterContext): Promise<void> {
    this.ctx = ctx
    this.baseUrl = (asString(ctx.account.credentials.baseUrl) ?? '').replace(/\/$/, '')
    this.token = asString(ctx.account.credentials.token) ?? ''
    this.statusPath = asString(ctx.account.credentials.statusPath) ?? '/status'
    this.messagesPath = asString(ctx.account.credentials.messagesPath) ?? '/messages'
    this.sendPath = asString(ctx.account.credentials.sendPath) ?? '/send'
    this.actionPath = asString(ctx.account.credentials.actionPath) ?? '/action'
    this.cursor = ctx.account.cursor ?? ''
    this.pollIntervalMs =
      asNumber(ctx.account.metadata.pollIntervalMs) !== null
        ? Math.max(500, asNumber(ctx.account.metadata.pollIntervalMs) ?? 2_000)
        : 2_000

    if (!this.baseUrl) {
      this.setStatus('error')
      await ctx.onStatus('error', 'bridge 缺少 baseUrl')
      return
    }

    this.setStatus('connecting')
    await ctx.onStatus('connecting')
    const probeOk = await this.probe()
    if (!probeOk) {
      this.setStatus('error')
      await ctx.onStatus('error', `桥探活失败: ${this.baseUrl}${this.statusPath}`)
      return
    }

    this.setStatus('online')
    await ctx.onStatus('online')
    if (ctx.account.metadata.mode !== 'webhook') {
      this.startPollLoop()
    }
  }

  async disconnect(): Promise<void> {
    this.running = false
    this.setStatus('disconnected')
    if (this.ctx) await this.ctx.onStatus('disconnected')
  }

  getStatus(): WechatAccountStatus {
    return this.status
  }

  getQrCode(): WechatQrCodeView | null {
    return null
  }

  async sendText(
    target: string,
    text: string,
    options?: WechatSendOptions,
  ): Promise<WechatSendResult> {
    return this.postSend({
      target,
      type: 'text',
      text,
      ...(options?.mentions?.length ? { mentions: options.mentions } : {}),
    })
  }

  async sendMedia(
    target: string,
    media: WechatMediaInput,
    options?: WechatSendOptions,
  ): Promise<WechatSendResult> {
    return this.postSend({
      target,
      type: media.kind,
      url: media.url,
      fileName: media.fileName ?? null,
      ...(options?.mentions?.length ? { mentions: options.mentions } : {}),
    })
  }

  async typing(target: string, on: boolean): Promise<void> {
    if (!this.baseUrl) return
    try {
      await fetch(`${this.baseUrl}/typing`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ target, on }),
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      // 装饰性功能
    }
  }

  async performAction(
    action: WechatBridgeAction,
    payload: Record<string, unknown>,
  ): Promise<WechatActionResult> {
    if (!this.baseUrl) {
      return { ok: false, status: 'failed', data: {}, reason: 'bridge 缺少 baseUrl' }
    }
    try {
      const response = await fetch(`${this.baseUrl}${this.actionPath}`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ action, ...payload, token: this.token || undefined }),
        signal: AbortSignal.timeout(60_000),
      })
      const text = await response.text()
      if (!response.ok) {
        return {
          ok: false,
          status: 'failed',
          data: {},
          reason: `HTTP ${response.status}: ${text.slice(0, 200)}`,
        }
      }
      const parsed: unknown = JSON.parse(text)
      const root = asRecord(parsed)
      if (!root) {
        return { ok: false, status: 'failed', data: {}, reason: '桥返回非对象 JSON' }
      }
      const data = asRecord(root.data) ?? root
      const ok = root.ok === true || asNumber(root.code) === 0
      if (!ok) {
        return {
          ok: false,
          status: 'failed',
          data,
          reason: asString(root.error) ?? asString(root.message) ?? '桥拒绝动作',
        }
      }
      return { ok: true, status: 'accepted', data, reason: null }
    } catch (e) {
      return {
        ok: false,
        status: 'failed',
        data: {},
        reason: e instanceof Error ? e.message : '桥动作失败',
      }
    }
  }

  handleWebhook(payload: unknown): WechatInboundEvent[] {
    return normalizeBridgePayload(payload)
  }

  private async probe(): Promise<boolean> {
    const candidates = [this.statusPath, '/health', '/']
    for (const path of candidates) {
      try {
        const response = await fetch(`${this.baseUrl}${path}`, {
          headers: this.headers(),
          signal: AbortSignal.timeout(10_000),
        })
        if (response.ok) return true
      } catch {
        // 试下一个
      }
    }
    return false
  }

  private startPollLoop(): void {
    if (this.running) return
    this.running = true
    void this.pollLoop()
  }

  private async pollLoop(): Promise<void> {
    let failures = 0
    while (this.running) {
      try {
        const url = `${this.baseUrl}${this.messagesPath}?since=${encodeURIComponent(this.cursor)}&limit=100`
        const response = await fetch(url, {
          headers: this.headers(),
          signal: AbortSignal.timeout(20_000),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload: unknown = await response.json()
        const events = normalizeBridgePayload(payload)
        const root = asRecord(payload)
        const nextCursor =
          asString(root?.nextCursor) ??
          asString(root?.next_cursor) ??
          events.at(-1)?.platformMessageId ??
          this.cursor
        if (nextCursor && nextCursor !== this.cursor) {
          this.cursor = nextCursor
          await this.ctx?.onCursor(nextCursor)
        }
        for (const event of events) {
          try {
            await this.ctx?.onEvent(event)
          } catch (e) {
            await this.ctx?.logger.error(
              { err: e instanceof Error ? e.message : String(e) },
              '[wechat-hub/bridge] 入站消息入库失败',
            )
          }
        }
        failures = 0
      } catch (e) {
        failures += 1
        await this.ctx?.logger.warn(
          { err: e instanceof Error ? e.message : String(e), failures },
          '[wechat-hub/bridge] 拉取增量失败',
        )
        if (failures >= 5) {
          this.setStatus('error')
          await this.ctx?.onStatus('error', e instanceof Error ? e.message : '桥轮询失败')
        }
        await sleep(Math.min(30_000, 1_000 * failures))
      }
      await sleep(this.pollIntervalMs)
    }
  }

  private async postSend(body: JsonRecord): Promise<WechatSendResult> {
    if (!this.baseUrl) return localRejected('bridge 缺少 baseUrl', 'bridge-no-base-url')
    try {
      const response = await fetch(`${this.baseUrl}${this.sendPath}`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ ...body, token: this.token || undefined }),
        signal: AbortSignal.timeout(30_000),
      })
      const text = await response.text()
      if (!response.ok) {
        return {
          ok: false,
          status: 'http-error',
          platformMessageId: null,
          reason: `HTTP ${response.status}: ${text.slice(0, 200)}`,
          attempts: 1,
          rejectedBy: null,
        }
      }
      const parsed: unknown = JSON.parse(text)
      const root = asRecord(parsed)
      const data = asRecord(root?.data)
      const ok = root?.ok === true || asNumber(root?.code) === 0
      const messageId =
        asString(root?.messageId) ??
        asString(root?.message_id) ??
        asString(data?.messageId) ??
        asString(data?.message_id)
      if (!ok && root?.ok !== false && asNumber(root?.code) === null) {
        return {
          ok: false,
          status: 'business-rejected',
          platformMessageId: null,
          reason: '桥返回无法识别的响应',
          attempts: 1,
          rejectedBy: 'bridge-unrecognized',
        }
      }
      if (root?.ok === false) {
        return {
          ok: false,
          status: 'business-rejected',
          platformMessageId: null,
          reason: asString(root?.error) ?? asString(root?.message) ?? '桥拒绝发送',
          attempts: 1,
          rejectedBy: 'bridge-business',
        }
      }
      return {
        ok: true,
        status: messageId ? 'delivered' : 'no-receipt',
        platformMessageId: messageId,
        reason: messageId ? null : '桥未返回 messageId',
        attempts: 1,
        rejectedBy: null,
      }
    } catch (e) {
      return transportError(e instanceof Error ? e.message : '桥发送失败')
    }
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.token) headers.Authorization = `Bearer ${this.token}`
    return headers
  }

  private setStatus(status: WechatAccountStatus): void {
    this.status = status
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
