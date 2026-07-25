/**
 * Clawdbot Channels - 渠道管理
 *
 * 多平台接入、消息分发。
 */
import { EventEmitter } from 'node:events'
import { logger } from './logger.js'
import { generateCompactId } from '../../utils/crypto-random.js'

export type ChannelType =
  'web' | 'wechat' | 'dingtalk' | 'feishu' | 'slack' | 'telegram' | 'api' | 'custom'

export interface ChannelConfig {
  id: string
  type: ChannelType
  name: string
  enabled: boolean
  config: Record<string, unknown>
}

export interface ChannelMessage {
  id: string
  channelId: string
  channelType: ChannelType
  userId: string
  content: string
  attachments?: Array<{ type: string; url: string; name?: string }>
  replyTo?: string
  timestamp: number
  metadata?: Record<string, unknown>
}

export class ChannelManager extends EventEmitter {
  /** 内存渠道注册表 — 需后续建表持久化(无对应 DB 表,userPreferences 需 userId 不适用系统级配置) */
  private channels = new Map<string, ChannelConfig>()

  register(config: ChannelConfig): void {
    this.channels.set(config.id, config)
    logger.info({ channel: config.id, type: config.type }, '[Channels] Registered')
    this.emit('registered', config)
  }

  unregister(id: string): boolean {
    const removed = this.channels.delete(id)
    if (removed) this.emit('unregistered', id)
    return removed
  }

  get(id: string): ChannelConfig | undefined {
    return this.channels.get(id)
  }

  list(): ChannelConfig[] {
    return Array.from(this.channels.values())
  }

  listEnabled(): ChannelConfig[] {
    return this.list().filter((c) => c.enabled)
  }

  receiveMessage(message: Omit<ChannelMessage, 'id' | 'timestamp'>): ChannelMessage {
    const fullMessage: ChannelMessage = {
      ...message,
      // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成消息 ID
      id: generateCompactId('msg'),
      timestamp: Date.now(),
    }
    logger.debug(
      { channelId: message.channelId, userId: message.userId },
      '[Channels] Message received',
    )
    this.emit('message', fullMessage)
    return fullMessage
  }

  async sendMessage(channelId: string, content: string, userId?: string): Promise<boolean> {
    const channel = this.channels.get(channelId)
    if (!channel || !channel.enabled) {
      logger.warn({ channelId }, '[Channels] Channel not found or disabled')
      return false
    }
    try {
      await this.dispatchToChannel(channel, content, userId)
      this.emit('sent', { channelId, content, userId })
      return true
    } catch (err) {
      logger.error({ channelId, err: err as Error }, '[Channels] 渠道发送失败')
      this.emit('sendFailed', { channelId, err })
      return false
    }
  }

  private async dispatchToChannel(
    channel: ChannelConfig,
    content: string,
    userId?: string,
  ): Promise<void> {
    switch (channel.type) {
      case 'feishu':
        return sendFeishu(channel, content, userId)
      case 'wechat':
        return sendWechat(channel, content, userId)
      case 'dingtalk':
        return sendDingtalk(channel, content, userId)
      case 'slack':
        return sendSlack(channel, content, userId)
      case 'telegram':
        return sendTelegram(channel, content, userId)
      case 'web':
      case 'api':
      case 'custom':
      default:
        // web/api/custom 为系统内部或用户自定义渠道,无外部 API 对接,仅记录日志
        logger.info(
          { channelId: channel.id, type: channel.type, userId, contentLength: content.length },
          '[Channels] 内部/自定义渠道,仅记录日志',
        )
        return
    }
  }

  async broadcast(content: string, filter?: (c: ChannelConfig) => boolean): Promise<number> {
    let sent = 0
    for (const channel of this.listEnabled()) {
      if (filter && !filter(channel)) continue
      if (await this.sendMessage(channel.id, content)) sent++
    }
    return sent
  }

  getStats() {
    const channels = this.list()
    return {
      total: channels.length,
      enabled: channels.filter((c) => c.enabled).length,
      byType: channels.reduce(
        (acc, c) => {
          acc[c.type] = (acc[c.type] ?? 0) + 1
          return acc
        },
        {} as Record<string, number>,
      ),
    }
  }
}

let instance: ChannelManager | null = null

export function getChannelManager(): ChannelManager {
  if (!instance) instance = new ChannelManager()
  return instance
}

// ===== 渠道 API 对接 =====
// 凭证从 ChannelConfig.config 读取(不硬编码),失败抛出异常由 sendMessage 上层捕获
// 各渠道实现 fetch 调用官方 OpenAPI,不引入新 SDK 依赖

interface FeishuChannelConfig {
  appId?: string
  appSecret?: string
  receiveId?: string
  chatId?: string
  receiveIdType?: 'open_id' | 'user_id' | 'union_id' | 'email' | 'chat_id'
}

async function sendFeishu(channel: ChannelConfig, content: string, userId?: string): Promise<void> {
  const cfg = channel.config as FeishuChannelConfig
  const appId = cfg.appId ?? process.env.FEISHU_APP_ID
  const appSecret = cfg.appSecret ?? process.env.FEISHU_APP_SECRET
  const receiveId = cfg.receiveId ?? cfg.chatId
  if (!appId || !appSecret || !receiveId) {
    throw new Error('feishu 渠道缺少 appId/appSecret/receiveId 配置')
  }
  // 1. 获取 tenant_access_token
  const tokenResp = await fetch(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    },
  )
  if (!tokenResp.ok) throw new Error(`feishu token 请求失败: ${tokenResp.status}`)
  const tokenData = (await tokenResp.json()) as { tenant_access_token?: string; msg?: string }
  if (!tokenData.tenant_access_token) {
    throw new Error(`feishu token 获取失败: ${tokenData.msg ?? 'unknown'}`)
  }
  // 2. 发送消息(默认发到 chat_id,可通过 receiveIdType 切换为 open_id/user_id 等私信)
  const receiveIdType = cfg.receiveIdType ?? 'chat_id'
  const msgResp = await fetch(
    `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenData.tenant_access_token}`,
      },
      body: JSON.stringify({
        receive_id: receiveId,
        msg_type: 'text',
        content: JSON.stringify({ text: content }),
      }),
    },
  )
  if (!msgResp.ok) {
    const errText = await msgResp.text().catch(() => 'unknown')
    throw new Error(`feishu 发送失败: ${msgResp.status} ${errText}`)
  }
  logger.debug({ channelId: channel.id, userId, receiveIdType }, '[Channels] feishu 发送成功')
}

interface WechatChannelConfig {
  corpId?: string
  agentId?: number
  secret?: string
  touser?: string
  toparty?: string
  totag?: string
}

async function sendWechat(channel: ChannelConfig, content: string, userId?: string): Promise<void> {
  const cfg = channel.config as WechatChannelConfig
  const corpId = cfg.corpId ?? process.env.WECHAT_CORP_ID
  const secret = cfg.secret ?? process.env.WECHAT_CORP_SECRET
  const agentId = cfg.agentId ?? Number(process.env.WECHAT_AGENT_ID)
  if (!corpId || !secret || !agentId) {
    throw new Error('wechat 渠道缺少 corpId/secret/agentId 配置')
  }
  // 1. 获取 access_token
  const tokenResp = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(corpId)}&corpsecret=${encodeURIComponent(secret)}`,
  )
  if (!tokenResp.ok) throw new Error(`wechat token 请求失败: ${tokenResp.status}`)
  const tokenData = (await tokenResp.json()) as {
    access_token?: string
    errmsg?: string
    errcode?: number
  }
  if (!tokenData.access_token) {
    throw new Error(`wechat token 获取失败: ${tokenData.errmsg ?? tokenData.errcode ?? 'unknown'}`)
  }
  // 2. 发送应用消息
  const msgResp = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${tokenData.access_token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        touser: cfg.touser ?? '@all',
        toparty: cfg.toparty,
        totag: cfg.totag,
        msgtype: 'text',
        agentid: agentId,
        text: { content },
      }),
    },
  )
  if (!msgResp.ok) {
    const errText = await msgResp.text().catch(() => 'unknown')
    throw new Error(`wechat 发送失败: ${msgResp.status} ${errText}`)
  }
  const msgData = (await msgResp.json()) as { errcode?: number; errmsg?: string }
  if (msgData.errcode && msgData.errcode !== 0) {
    throw new Error(`wechat 发送失败: ${msgData.errcode} ${msgData.errmsg ?? 'unknown'}`)
  }
  logger.debug({ channelId: channel.id, userId }, '[Channels] wechat 发送成功')
}

interface DingtalkChannelConfig {
  webhook?: string
  accessToken?: string
  secret?: string
}

async function sendDingtalk(
  channel: ChannelConfig,
  content: string,
  userId?: string,
): Promise<void> {
  const cfg = channel.config as DingtalkChannelConfig
  const webhook = cfg.webhook ?? process.env.DINGTALK_WEBHOOK
  const accessToken = cfg.accessToken ?? process.env.DINGTALK_ACCESS_TOKEN
  if (!webhook && !accessToken) {
    throw new Error('dingtalk 渠道缺少 webhook/accessToken 配置')
  }
  // NOTE: 钉钉机器人加签流程(secret 字段)后续接入,当前仅支持明文 webhook/accessToken 模式
  const url = webhook ?? `https://oapi.dingtalk.com/robot/send?access_token=${accessToken}`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msgtype: 'text', text: { content } }),
  })
  if (!resp.ok) {
    const errText = await resp.text().catch(() => 'unknown')
    throw new Error(`dingtalk 发送失败: ${resp.status} ${errText}`)
  }
  const data = (await resp.json()) as { errcode?: number; errmsg?: string }
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`dingtalk 发送失败: ${data.errcode} ${data.errmsg ?? 'unknown'}`)
  }
  logger.debug({ channelId: channel.id, userId }, '[Channels] dingtalk 发送成功')
}

interface SlackChannelConfig {
  webhook?: string
  channel?: string
  token?: string
}

async function sendSlack(channel: ChannelConfig, content: string, userId?: string): Promise<void> {
  const cfg = channel.config as SlackChannelConfig
  const webhook = cfg.webhook ?? process.env.SLACK_WEBHOOK
  const token = cfg.token ?? process.env.SLACK_TOKEN
  if (!webhook && !token) {
    throw new Error('slack 渠道缺少 webhook/token 配置')
  }
  if (webhook) {
    // Incoming Webhook(最简,无需 OAuth)
    const resp = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: content }),
    })
    if (!resp.ok) {
      const errText = await resp.text().catch(() => 'unknown')
      throw new Error(`slack webhook 发送失败: ${resp.status} ${errText}`)
    }
  } else {
    // NOTE: Slack Web API 完整 OAuth 流程(chat:write scope)后续接入
    if (!cfg.channel) throw new Error('slack Web API 缺少 channel 配置')
    const resp = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel: cfg.channel, text: content }),
    })
    if (!resp.ok) {
      const errText = await resp.text().catch(() => 'unknown')
      throw new Error(`slack Web API 发送失败: ${resp.status} ${errText}`)
    }
    const data = (await resp.json()) as { ok?: boolean; error?: string }
    if (!data.ok) throw new Error(`slack 发送失败: ${data.error ?? 'unknown'}`)
  }
  logger.debug({ channelId: channel.id, userId }, '[Channels] slack 发送成功')
}

interface TelegramChannelConfig {
  botToken?: string
  chatId?: string
}

async function sendTelegram(
  channel: ChannelConfig,
  content: string,
  userId?: string,
): Promise<void> {
  const cfg = channel.config as TelegramChannelConfig
  const botToken = cfg.botToken ?? process.env.TELEGRAM_BOT_TOKEN
  const chatId = cfg.chatId ?? process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId) {
    throw new Error('telegram 渠道缺少 botToken/chatId 配置')
  }
  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: content, parse_mode: 'HTML' }),
  })
  if (!resp.ok) {
    const errText = await resp.text().catch(() => 'unknown')
    throw new Error(`telegram 发送失败: ${resp.status} ${errText}`)
  }
  const data = (await resp.json()) as { ok?: boolean; description?: string }
  if (!data.ok) throw new Error(`telegram 发送失败: ${data.description ?? 'unknown'}`)
  logger.debug({ channelId: channel.id, userId }, '[Channels] telegram 发送成功')
}
