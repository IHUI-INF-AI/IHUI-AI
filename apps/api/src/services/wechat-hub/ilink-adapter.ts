// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * iLink（腾讯官方 ClawBot）适配器。
 *
 * 协议参考（MIT，gfydfhcf/wechat-ilink-muse-bridge）：
 *  - GET  ilink/bot/get_bot_qrcode?bot_type=3          取登录二维码
 *  - GET  ilink/bot/get_qrcode_status?qrcode=...       轮询扫码状态
 *  - POST ilink/bot/getupdates                         长轮询收消息（hold ~35s）
 *  - POST ilink/bot/sendmessage                        发文本/媒体
 *  - POST ilink/bot/getconfig / sendtyping             "正在输入"
 *  - POST ilink/bot/getuploadurl + CDN /c2c/upload      媒体加密上传
 *
 * 本实现是独立 TypeScript 版本，只复用协议事实，不复制对方源码；
 * 保留 upstream 的能力说明与出处，遵守 MIT。
 */

import { createCipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import QRCode from 'qrcode'
import type {
  WechatAccountStatus,
  WechatBackend,
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

const DEFAULT_BASE_URL = 'https://ilinkai.weixin.qq.com'
const CDN_BASE_URL = 'https://novac2c.cdn.weixin.qq.com/c2c'
const CHANNEL_VERSION = '2.4.10'
const MAX_MEDIA_BYTES = 100 * 1024 * 1024
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000
const QR_REFRESH_LIMIT = 3
const POLL_TIMEOUT_MS = 40_000
const TYPING_TICKET_TTL_MS = 9 * 60 * 1000

type JsonRecord = Record<string, unknown>
type ContactEntry = {
  contextToken?: string
  typingTicket?: string
  typingTicketAt?: number
  updatedAt?: number
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** iLink 返回的是扫码落地页 URL，不是图片；这里转成可直接 <img> 渲染的二维码。 */
async function qrImageContent(value: string): Promise<string> {
  if (value.startsWith('data:image/')) return value
  if (/^[A-Za-z0-9+/=]{200,}$/.test(value)) return `data:image/png;base64,${value}`
  return QRCode.toDataURL(value, { width: 480, margin: 2 })
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

export class IlinkAdapter implements WechatAdapter {
  readonly backend: WechatBackend = 'ilink'

  private ctx: WechatAdapterContext | null = null
  private status: WechatAccountStatus = 'disconnected'
  private token: string | null = null
  private running = false
  private polling = false
  private qr: WechatQrCodeView | null = null
  private cursor = ''
  private contacts: Record<string, ContactEntry> = {}
  private baseUrl = DEFAULT_BASE_URL

  async connect(ctx: WechatAdapterContext): Promise<void> {
    this.ctx = ctx
    this.contacts = this.readContacts()
    this.baseUrl =
      asString(ctx.account.credentials.baseUrl) ??
      asString(ctx.account.metadata.baseUrl) ??
      DEFAULT_BASE_URL
    this.token = asString(ctx.account.credentials.token)
    this.cursor = ctx.account.cursor ?? ''

    if (this.token) {
      this.setStatus('online')
      await ctx.onStatus('online')
      this.startPollLoop()
      return
    }

    // 登录轮询依赖 running；token 路径由 startPollLoop 置位，扫码路径必须在这里置位。
    this.running = true
    this.setStatus('connecting')
    await ctx.onStatus('connecting')
    await this.beginLogin()
  }

  async disconnect(): Promise<void> {
    this.running = false
    this.polling = false
    this.qr = null
    this.setStatus('disconnected')
    if (this.ctx) await this.ctx.onStatus('disconnected')
  }

  getStatus(): WechatAccountStatus {
    return this.status
  }

  getQrCode(): WechatQrCodeView | null {
    return this.qr
  }

  async sendText(
    target: string,
    text: string,
    options?: WechatSendOptions,
  ): Promise<WechatSendResult> {
    if (!this.token) return localRejected('iLink 尚未登录，请先扫码', 'ilink-not-logged-in')
    const contextToken = options?.contextToken ?? this.contacts[target]?.contextToken ?? null
    const clientId = options?.idempotencyKey ?? `ihui-${randomUUID()}`
    const body: JsonRecord = {
      msg: {
        from_user_id: '',
        to_user_id: target,
        client_id: clientId,
        message_type: 2,
        message_state: 2,
        item_list: [{ type: 1, text_item: { text } }],
        ...(contextToken ? { context_token: contextToken } : {}),
      },
      base_info: { channel_version: CHANNEL_VERSION },
    }

    return this.sendWithRetry(body)
  }

  async sendMedia(
    target: string,
    media: WechatMediaInput,
    options?: WechatSendOptions,
  ): Promise<WechatSendResult> {
    if (!this.token) return localRejected('iLink 尚未登录，请先扫码', 'ilink-not-logged-in')
    try {
      const raw = await this.downloadMedia(media.url)
      const uploaded = await this.uploadMedia(target, raw, media)
      const contextToken = options?.contextToken ?? this.contacts[target]?.contextToken ?? null
      const clientId = options?.idempotencyKey ?? `ihui-${randomUUID()}`
      const body: JsonRecord = {
        msg: {
          from_user_id: '',
          to_user_id: target,
          client_id: clientId,
          message_type: 2,
          message_state: 2,
          item_list: [uploaded.item],
          ...(contextToken ? { context_token: contextToken } : {}),
        },
        base_info: { channel_version: CHANNEL_VERSION },
      }
      return this.sendWithRetry(body)
    } catch (e) {
      return transportError(e instanceof Error ? e.message : '媒体发送失败')
    }
  }

  async typing(target: string, on: boolean): Promise<void> {
    if (!this.token) return
    try {
      const ticket = await this.getTypingTicket(target)
      if (!ticket) return
      await this.request(
        'POST',
        'ilink/bot/sendtyping',
        {
          ilink_user_id: target,
          typing_ticket: ticket,
          status: on ? 1 : 2,
          base_info: { channel_version: CHANNEL_VERSION },
        },
        this.token,
        20_000,
      )
    } catch {
      // typing 是装饰性功能，失败不影响回复链路
    }
  }

  // ===== 登录 =====

  private async beginLogin(refreshes = 0): Promise<void> {
    const data = await this.request('GET', 'ilink/bot/get_bot_qrcode?bot_type=3')
    const qrcode = asString(data.qrcode)
    if (!qrcode) {
      this.setStatus('error')
      await this.ctx?.onStatus('error', 'iLink 未返回 qrcode')
      return
    }
    const qrContent = asString(data.qrcode_img_content)
    let imageUrl: string | null = null
    if (qrContent) {
      try {
        imageUrl = await qrImageContent(qrContent)
      } catch {
        imageUrl = null
      }
    }
    this.qr = {
      accountId: this.ctx?.account.id ?? '',
      qrcode,
      imageUrl,
      expiresAt: null,
      status: 'awaiting_scan',
    }
    this.setStatus('awaiting_scan')
    await this.ctx?.onStatus('awaiting_scan')
    void this.loginLoop(qrcode, refreshes)
  }

  private async loginLoop(qrcode: string, refreshes: number): Promise<void> {
    const deadline = Date.now() + LOGIN_TIMEOUT_MS
    const current = qrcode
    while (this.running && !this.token && Date.now() < deadline) {
      await sleep(2_000)
      try {
        const data = await this.request(
          'GET',
          `ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(current)}`,
          undefined,
          null,
          35_000,
        )
        const scanStatus = asString(data.status)
        const botToken = asString(data.bot_token)
        if (scanStatus === 'confirmed' || (scanStatus === 'binded' && botToken)) {
          if (!botToken) {
            this.setStatus('error')
            await this.ctx?.onStatus('error', '扫码已确认但未返回 bot_token')
            return
          }
          this.token = botToken
          await this.ctx?.onCredentials({ token: botToken })
          this.qr = null
          this.setStatus('online')
          await this.ctx?.onStatus('online')
          this.startPollLoop()
          return
        }
        if (scanStatus === 'expired' && refreshes < QR_REFRESH_LIMIT) {
          await this.beginLogin(refreshes + 1)
          return
        }
        if (scanStatus === 'canceled') {
          this.setStatus('disconnected')
          await this.ctx?.onStatus('disconnected', '扫码已取消')
          return
        }
      } catch (e) {
        await this.ctx?.logger.warn(
          { err: e instanceof Error ? e.message : String(e) },
          '[wechat-hub/ilink] 扫码状态轮询失败',
        )
      }
    }
    if (!this.token && this.status === 'awaiting_scan') {
      this.setStatus('expired')
      await this.ctx?.onStatus('expired', '扫码超时，请重新获取二维码')
    }
  }

  // ===== 收消息 =====

  private startPollLoop(): void {
    if (this.polling) return
    this.running = true
    this.polling = true
    void this.pollLoop()
  }

  private async pollLoop(): Promise<void> {
    let failures = 0
    while (this.running && this.token) {
      try {
        const data = await this.request(
          'POST',
          'ilink/bot/getupdates',
          {
            get_updates_buf: this.cursor,
            base_info: { channel_version: CHANNEL_VERSION },
          },
          this.token,
          POLL_TIMEOUT_MS,
        )
        const code = asNumber(data.code)
        if (code === -14) {
          this.setStatus('expired')
          await this.ctx?.onStatus('expired', 'iLink token 已过期，请重新扫码')
          this.running = false
          break
        }
        failures = 0
        const nextCursor = asString(data.get_updates_buf)
        if (nextCursor && nextCursor !== this.cursor) {
          this.cursor = nextCursor
          await this.ctx?.onCursor(nextCursor)
        }
        const messages = asArray(data.msgs)
        for (const rawMessage of messages) {
          const message = asRecord(rawMessage)
          if (!message) continue
          if (asNumber(message.message_type) !== 1) continue
          const event = this.parseInbound(message)
          if (!event) continue
          try {
            await this.ctx?.onEvent(event)
          } catch (e) {
            await this.ctx?.logger.error(
              { err: e instanceof Error ? e.message : String(e) },
              '[wechat-hub/ilink] 入站消息入库失败',
            )
          }
        }
      } catch (e) {
        failures += 1
        const message = e instanceof Error ? e.message : String(e)
        this.setStatus(failures >= 3 ? 'error' : 'online')
        await this.ctx?.onStatus(this.status, message)
        await sleep(Math.min(30_000, 2_000 * failures))
      }
    }
    this.polling = false
  }

  private parseInbound(message: JsonRecord): WechatInboundEvent | null {
    const messageId = asString(message.message_id)
    const fromUserId = asString(message.from_user_id)
    if (!messageId || !fromUserId) return null
    const contextToken = asString(message.context_token)
    const itemList = asArray(message.item_list)
    let kind: WechatMessageKind = 'text'
    const textParts: string[] = []
    const itemTypes: number[] = []
    let mediaUrl: string | null = null

    for (const rawItem of itemList) {
      const item = asRecord(rawItem)
      if (!item) continue
      const type = asNumber(item.type) ?? 0
      itemTypes.push(type)
      if (type === 1) {
        const textItem = asRecord(item.text_item)
        const text = asString(textItem?.text)
        if (text) textParts.push(text)
        kind = 'text'
      } else if (type === 2) {
        kind = 'image'
        mediaUrl = mediaUrl ?? this.extractMediaUrl(item, 'image_item')
      } else if (type === 3) {
        kind = 'voice'
        const voiceItem = asRecord(item.voice_item)
        const transcribed = asString(voiceItem?.text)
        if (transcribed) textParts.push(transcribed)
        mediaUrl = mediaUrl ?? this.extractMediaUrl(item, 'voice_item')
      } else if (type === 4) {
        kind = 'file'
        const fileItem = asRecord(item.file_item)
        const fileName = asString(fileItem?.file_name)
        if (fileName) textParts.push(`[文件] ${fileName}`)
        mediaUrl = mediaUrl ?? this.extractMediaUrl(item, 'file_item')
      } else if (type === 5) {
        kind = 'video'
        mediaUrl = mediaUrl ?? this.extractMediaUrl(item, 'video_item')
      }
    }

    if (contextToken) {
      this.contacts[fromUserId] = {
        ...(this.contacts[fromUserId] ?? {}),
        contextToken,
        updatedAt: Date.now(),
      }
      void this.ctx?.onMetadata({ contacts: this.contacts })
    }

    const createTime = asNumber(message.create_time)
    return {
      platformMessageId: messageId,
      platformChatId: fromUserId,
      conversationKind: 'private',
      conversationTitle: null,
      senderId: fromUserId,
      senderName: null,
      kind,
      content: textParts.join('\n').trim(),
      mediaUrl,
      sentAt: createTime ? new Date(createTime * 1000) : new Date(),
      raw: {
        messageType: 1,
        messageId,
        fromUserId,
        itemTypes,
        hasContextToken: Boolean(contextToken),
      },
      contextToken,
    }
  }

  private extractMediaUrl(item: JsonRecord, key: string): string | null {
    const sub = asRecord(item[key])
    const media = asRecord(sub?.media)
    return asString(media?.full_url) ?? null
  }

  // ===== 发送 =====

  private async sendWithRetry(body: JsonRecord): Promise<WechatSendResult> {
    let lastError = '发送失败'
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const data = await this.request('POST', 'ilink/bot/sendmessage', body, this.token, 40_000)
        const code = asNumber(data.code)
        const ret = asNumber(data.ret)
        if (code === -14) {
          this.setStatus('expired')
          await this.ctx?.onStatus('expired', 'iLink token 已过期，请重新扫码')
          return {
            ok: false,
            status: 'business-rejected',
            platformMessageId: null,
            reason: 'token expired',
            attempts: attempt,
            rejectedBy: 'ilink-token-expired',
          }
        }
        if ((ret !== null && ret !== 0) || (code !== null && code !== 0)) {
          return {
            ok: false,
            status: 'business-rejected',
            platformMessageId: null,
            reason: asString(data.errmsg) ?? `ret=${ret ?? 'unknown'} code=${code ?? 'unknown'}`,
            attempts: attempt,
            rejectedBy: 'ilink-business',
          }
        }
        const messageId = asString(data.message_id) ?? asString(data.msg_id)
        if (!messageId) {
          return {
            ok: false,
            status: 'no-receipt',
            platformMessageId: null,
            reason: 'iLink 未回执 message_id',
            attempts: attempt,
            rejectedBy: null,
          }
        }
        return {
          ok: true,
          status: 'delivered',
          platformMessageId: messageId,
          reason: null,
          attempts: attempt,
          rejectedBy: null,
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e)
        if (attempt === 1) await sleep(5_000)
      }
    }
    return transportError(lastError, 2)
  }

  private async downloadMedia(url: string): Promise<Buffer> {
    const response = await fetch(url, { signal: AbortSignal.timeout(120_000) })
    if (!response.ok) throw new Error(`媒体下载失败 HTTP ${response.status}`)
    const length = Number(response.headers.get('content-length') ?? '0')
    if (length > MAX_MEDIA_BYTES) throw new Error('媒体超过 100MB 上限')
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > MAX_MEDIA_BYTES) throw new Error('媒体超过 100MB 上限')
    return buffer
  }

  private async uploadMedia(
    target: string,
    raw: Buffer,
    media: WechatMediaInput,
  ): Promise<{ item: JsonRecord }> {
    const key = randomBytes(16)
    const aeskeyHex = key.toString('hex')
    const filekey = randomBytes(16).toString('hex')
    const cipher = createCipheriv('aes-128-ecb', key, null)
    const ciphertext = Buffer.concat([cipher.update(raw), cipher.final()])
    const uploadType = { image: 1, video: 2, file: 3, voice: 4 }[media.kind]
    const itemType = { image: 2, video: 5, file: 4, voice: 3 }[media.kind]
    const md5 = createHash('md5').update(raw).digest('hex')
    const fileName = media.fileName ?? this.fileNameFromUrl(media.url)

    const uploadInfo = await this.request(
      'POST',
      'ilink/bot/getuploadurl',
      {
        filekey,
        media_type: uploadType,
        to_user_id: target,
        rawsize: raw.length,
        rawfilemd5: md5,
        filesize: ciphertext.length,
        aeskey: aeskeyHex,
        no_need_thumb: true,
        base_info: { channel_version: CHANNEL_VERSION },
      },
      this.token,
      20_000,
    )
    const uploadParam = asString(uploadInfo.upload_param)
    const fullUrl = asString(uploadInfo.upload_full_url)
    const url =
      fullUrl ??
      `${CDN_BASE_URL}/upload?encrypted_query_param=${encodeURIComponent(uploadParam ?? '')}&filekey=${filekey}`
    if (!uploadParam && !fullUrl) throw new Error('getuploadurl 未返回上传参数')

    const uploadResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: ciphertext,
      signal: AbortSignal.timeout(120_000),
    })
    if (!uploadResponse.ok) throw new Error(`CDN 上传失败 HTTP ${uploadResponse.status}`)
    const downloadParam = uploadResponse.headers.get('x-encrypted-param')
    if (!downloadParam) throw new Error('CDN 上传未返回 x-encrypted-param')

    const mediaRef = {
      encrypt_query_param: downloadParam,
      aes_key: Buffer.from(aeskeyHex, 'ascii').toString('base64'),
      encrypt_type: 1,
    }
    const items: Record<number, JsonRecord> = {
      2: { type: 2, image_item: { media: mediaRef, mid_size: ciphertext.length } },
      5: { type: 5, video_item: { media: mediaRef, video_size: ciphertext.length } },
      4: {
        type: 4,
        file_item: {
          media: mediaRef,
          file_name: fileName,
          md5,
          len: String(raw.length),
        },
      },
      3: {
        type: 3,
        voice_item: {
          media: mediaRef,
          encode_type: 6,
          bits_per_sample: 16,
          sample_rate: 24_000,
          playtime: 0,
        },
      },
    }
    const item = items[itemType]
    if (!item) throw new Error(`不支持的媒体类型: ${media.kind}`)
    return { item }
  }

  private fileNameFromUrl(url: string): string {
    try {
      const pathname = new URL(url).pathname
      const name = pathname.split('/').filter(Boolean).pop()
      return name && name.length > 0 ? decodeURIComponent(name) : 'file.bin'
    } catch {
      return 'file.bin'
    }
  }

  // ===== typing =====

  private async getTypingTicket(target: string): Promise<string | null> {
    const entry = this.contacts[target]
    const now = Date.now()
    if (entry?.typingTicket && now - (entry.typingTicketAt ?? 0) < TYPING_TICKET_TTL_MS) {
      return entry.typingTicket
    }
    const contextToken = entry?.contextToken
    if (!contextToken || !this.token) return null
    try {
      const data = await this.request(
        'POST',
        'ilink/bot/getconfig',
        {
          ilink_user_id: target,
          context_token: contextToken,
          base_info: { channel_version: CHANNEL_VERSION },
        },
        this.token,
        20_000,
      )
      const ticket = asString(data.typing_ticket)
      if (!ticket) return null
      this.contacts[target] = {
        ...(entry ?? {}),
        typingTicket: ticket,
        typingTicketAt: now,
      }
      void this.ctx?.onMetadata({ contacts: this.contacts })
      return ticket
    } catch {
      return null
    }
  }

  // ===== HTTP =====

  private async request(
    method: 'GET' | 'POST',
    path: string,
    body?: JsonRecord,
    token: string | null = this.token,
    timeoutMs = 40_000,
  ): Promise<JsonRecord> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      AuthorizationType: 'ilink_bot_token',
      'X-WECHAT-UIN': Buffer.from(String(Math.floor(Math.random() * 0xffffffff))).toString(
        'base64',
      ),
    }
    if (token) headers.Authorization = `Bearer ${token}`
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`iLink ${method} ${path} HTTP ${response.status}: ${text.slice(0, 200)}`)
    }
    const parsed: unknown = JSON.parse(text)
    const record = asRecord(parsed)
    if (!record) throw new Error(`iLink ${path} 返回非对象 JSON`)
    return record
  }

  private setStatus(status: WechatAccountStatus): void {
    this.status = status
  }

  private readContacts(): Record<string, ContactEntry> {
    const raw = this.ctx?.account.metadata.contacts
    const record = asRecord(raw)
    if (!record) return {}
    const result: Record<string, ContactEntry> = {}
    for (const [key, value] of Object.entries(record)) {
      const entry = asRecord(value)
      if (!entry) continue
      result[key] = {
        contextToken: asString(entry.contextToken) ?? undefined,
        typingTicket: asString(entry.typingTicket) ?? undefined,
        typingTicketAt: asNumber(entry.typingTicketAt) ?? undefined,
        updatedAt: asNumber(entry.updatedAt) ?? undefined,
      }
    }
    return result
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
