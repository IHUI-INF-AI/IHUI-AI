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
    // 简化实现:未对接各渠道 API
    // TODO: 需对接各渠道 API(wechat/dingtalk/feishu/slack/telegram 等)
    logger.warn({ channelId, userId, contentLength: content.length }, '[Channels] 简化实现:未对接真实渠道 API,仅记录日志')
    this.emit('sent', { channelId, content, userId })
    return true
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
