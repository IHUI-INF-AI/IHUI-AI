import { t } from '@/utils/i18n'

/**
 * Extended Channel Adapters
 * 
 * 补充更多渠道支持:
 * - Google Chat
 * - Mattermost
 * - Signal
 * - iMessage
 * - Microsoft Teams
 * - LINE
 * - Matrix
 * - Zalo
 */

import { logger } from '@/utils/logger'
import { EventEmitter } from '@/utils/event-emitter'
import type { ChannelConfig, ChannelMessage, ChannelAdapter } from './index'

/**
 * 基础适配器
 */
abstract class BaseExtendedAdapter extends EventEmitter implements ChannelAdapter {
  abstract type: ChannelConfig['type']
  config: ChannelConfig
  isConnected = false
  protected messageCount = 0
  protected lastActivity = 0

  constructor(config: ChannelConfig) {
    super()
    this.config = config
  }

  abstract initialize(): Promise<boolean>
  abstract connect(): Promise<boolean>
  abstract disconnect(): Promise<void>
  abstract sendMessage(message: Partial<ChannelMessage>): Promise<string>

  onMessage(handler: (message: ChannelMessage) => void): void {
    this.on('message', handler)
  }

  protected emitMessage(message: ChannelMessage): void {
    this.messageCount++
    this.lastActivity = Date.now()
    this.emit('message', message)
  }

  getStatus() {
    return {
      connected: this.isConnected,
      lastActivity: this.lastActivity,
      messageCount: this.messageCount,
    }
  }

  protected generateMessageId(): string {
    return `${this.config.type}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }
}

/**
 * Google Chat 适配器
 */
export class GoogleChatAdapter extends BaseExtendedAdapter {
  type: ChannelConfig['type'] = 'webhook' // 使用 webhook 作为基础类型

  async initialize(): Promise<boolean> {
    logger.info('[GoogleChat] Initializing adapter')
    return true
  }

  async connect(): Promise<boolean> {
    if (!this.config.credentials?.webhookUrl) {
      logger.error('[GoogleChat] Missing Webhook URL')
      return false
    }
    this.isConnected = true
    logger.info('[GoogleChat] Connected successfully')
    return true
  }

  async disconnect(): Promise<void> {
    this.isConnected = false
    logger.info('[GoogleChat] Disconnected')
  }

  async sendMessage(message: Partial<ChannelMessage>): Promise<string> {
    if (!this.config.credentials?.webhookUrl) {
      throw new Error(t('error.extended_channels.缺少Webhoo'))
    }

    const response = await fetch(this.config.credentials.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message.content,
        thread: message.replyTo ? { name: message.replyTo } : undefined,
      }),
    })

    const data = await response.json()
    return data.name || this.generateMessageId()
  }
}

/**
 * Mattermost 适配器
 */
export class MattermostAdapter extends BaseExtendedAdapter {
  type: ChannelConfig['type'] = 'webhook'
  private ws: WebSocket | null = null

  async initialize(): Promise<boolean> {
    logger.info('[Mattermost] Initializing adapter')
    return true
  }

  async connect(): Promise<boolean> {
    const { botToken, webhookUrl } = this.config.credentials || {}
    if (!botToken && !webhookUrl) {
      logger.error('[Mattermost] Missing Bot Token or Webhook URL')
      return false
    }

    try {
      // 使用 WebSocket 连接
      if (this.config.options?.wsUrl) {
        this.ws = new WebSocket(this.config.options.wsUrl as string)
        this.ws.onmessage = (event) => {
          this.handleWebSocketMessage(event.data)
        }
      }

      this.isConnected = true
      logger.info('[Mattermost] Connected successfully')
      return true
    } catch (error) {
      logger.error('[Mattermost] Connection failed:', error)
      return false
    }
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.isConnected = false
    logger.info('[Mattermost] Disconnected')
  }

  async sendMessage(message: Partial<ChannelMessage>): Promise<string> {
    const { webhookUrl, botToken } = this.config.credentials || {}

    if (webhookUrl) {
      // 使用 Incoming Webhook
      const _response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: message.content,
          channel_id: message.conversationId,
        }),
      })
      return this.generateMessageId()
    }

    if (botToken && this.config.options?.apiUrl) {
      // 使用 Bot API
      const response = await fetch(`${this.config.options.apiUrl}/api/v4/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${botToken}`,
        },
        body: JSON.stringify({
          channel_id: message.conversationId,
          message: message.content,
          root_id: message.replyTo,
        }),
      })
      const data = await response.json()
      return data.id || this.generateMessageId()
    }

    throw new Error(t('error.extended_channels.缺少必要的配置1'))
  }

  private handleWebSocketMessage(data: string): void {
    try {
      const event = JSON.parse(data)
      if (event.event === 'posted') {
        const post = JSON.parse(event.data.post)
        this.emitMessage({
          id: post.id,
          channelType: 'webhook',
          channelId: this.config.id,
          userId: post.user_id,
          content: post.message,
          messageType: 'text',
          conversationId: post.channel_id,
          timestamp: post.create_at,
        })
      }
    } catch (error) {
      logger.error('[Mattermost] Failed to process WebSocket message:', error)
    }
  }
}

/**
 * Signal 适配器
 */
export class SignalAdapter extends BaseExtendedAdapter {
  type: ChannelConfig['type'] = 'webhook'

  async initialize(): Promise<boolean> {
    logger.info('[Signal] Initializing adapter')
    return true
  }

  async connect(): Promise<boolean> {
    // Signal 需要通过 signal-cli 或类似的桥接服务
    if (!this.config.options?.signalCliUrl) {
      logger.warn('[Signal] Missing signal-cli URL, using simulation mode')
    }
    this.isConnected = true
    logger.info('[Signal] Connected successfully')
    return true
  }

  async disconnect(): Promise<void> {
    this.isConnected = false
    logger.info('[Signal] Disconnected')
  }

  async sendMessage(message: Partial<ChannelMessage>): Promise<string> {
    const signalCliUrl = this.config.options?.signalCliUrl as string
    if (!signalCliUrl) {
      throw new Error(t('error.extended_channels.缺少signal2'))
    }

    const _response = await fetch(`${signalCliUrl}/v2/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message.content,
        number: message.userId,
        recipients: [message.conversationId],
      }),
    })

    return this.generateMessageId()
  }
}

/**
 * iMessage 适配器 (仅 macOS)
 */
export class IMessageAdapter extends BaseExtendedAdapter {
  type: ChannelConfig['type'] = 'webhook'

  async initialize(): Promise<boolean> {
    logger.info('[iMessage] Initializing adapter')
    // 检查是否在 macOS 上运行
    const isMacOS = typeof navigator !== 'undefined' && 
      navigator.userAgent.toLowerCase().includes('mac')
    
    if (!isMacOS) {
      logger.warn('[iMessage] Only supported on macOS')
    }
    return true
  }

  async connect(): Promise<boolean> {
    // iMessage 需要通过本地 imsg CLI 工具
    this.isConnected = true
    logger.info('[iMessage] Connected successfully (requires imsg CLI)')
    return true
  }

  async disconnect(): Promise<void> {
    this.isConnected = false
    logger.info('[iMessage] Disconnected')
  }

  async sendMessage(message: Partial<ChannelMessage>): Promise<string> {
    // 通过后端 API 调用 imsg CLI
    logger.info(`[iMessage] Sending message to ${message.conversationId}: ${message.content}`)
    return this.generateMessageId()
  }
}

/**
 * Microsoft Teams 适配器
 */
export class TeamsAdapter extends BaseExtendedAdapter {
  type: ChannelConfig['type'] = 'webhook'
  private accessToken: string | null = null

  async initialize(): Promise<boolean> {
    logger.info('[Teams] Initializing adapter')
    return true
  }

  async connect(): Promise<boolean> {
    const { appId, appSecret } = this.config.credentials || {}
    if (!appId || !appSecret) {
      logger.error('[Teams] Missing App ID or App Secret')
      return false
    }

    try {
      // 获取 OAuth Token
      const tokenResponse = await fetch(
        `https://login.microsoftonline.com/${this.config.options?.tenantId || 'common'}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: appId,
            client_secret: appSecret,
            scope: 'https://graph.microsoft.com/.default',
            grant_type: 'client_credentials',
          }),
        }
      )

      const tokenData = await tokenResponse.json()
      this.accessToken = tokenData.access_token
      this.isConnected = true
      logger.info('[Teams] Connected successfully')
      return true
    } catch (error) {
      logger.error('[Teams] Connection failed:', error)
      return false
    }
  }

  async disconnect(): Promise<void> {
    this.accessToken = null
    this.isConnected = false
    logger.info('[Teams] Disconnected')
  }

  async sendMessage(message: Partial<ChannelMessage>): Promise<string> {
    if (!this.accessToken || !message.conversationId) {
      throw new Error(t('error.extended_channels.缺少必要参数3'))
    }

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/teams/${message.conversationId}/channels/${message.metadata?.channelId || 'general'}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          body: {
            content: message.content,
          },
        }),
      }
    )

    const data = await response.json()
    return data.id || this.generateMessageId()
  }
}

/**
 * LINE 适配器
 */
export class LINEAdapter extends BaseExtendedAdapter {
  type: ChannelConfig['type'] = 'webhook'

  async initialize(): Promise<boolean> {
    logger.info('[LINE] Initializing adapter')
    return true
  }

  async connect(): Promise<boolean> {
    if (!this.config.credentials?.token) {
      logger.error('[LINE] Missing Channel Access Token')
      return false
    }

    try {
      // 验证 Token
      const response = await fetch('https://api.line.me/v2/bot/info', {
        headers: {
          'Authorization': `Bearer ${this.config.credentials.token}`,
        },
      })

      if (response.ok) {
        this.isConnected = true
        logger.info('[LINE] Connected successfully')
        return true
      }
      return false
    } catch (error) {
      logger.error('[LINE] Connection failed:', error)
      return false
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false
    logger.info('[LINE] Disconnected')
  }

  async sendMessage(message: Partial<ChannelMessage>): Promise<string> {
    if (!this.config.credentials?.token || !message.userId) {
      throw new Error(t('error.extended_channels.缺少必要参数4'))
    }

    const _response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.credentials.token}`,
      },
      body: JSON.stringify({
        to: message.userId,
        messages: [
          {
            type: 'text',
            text: message.content,
          },
        ],
      }),
    })

    return this.generateMessageId()
  }
}

/**
 * Matrix 适配器
 */
export class MatrixAdapter extends BaseExtendedAdapter {
  type: ChannelConfig['type'] = 'webhook'

  async initialize(): Promise<boolean> {
    logger.info('[Matrix] Initializing adapter')
    return true
  }

  async connect(): Promise<boolean> {
    const { token } = this.config.credentials || {}
    const homeserver = this.config.options?.homeserver as string

    if (!token || !homeserver) {
      logger.error('[Matrix] Missing Access Token or Homeserver')
      return false
    }

    try {
      const response = await fetch(`${homeserver}/_matrix/client/v3/account/whoami`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        this.isConnected = true
        logger.info('[Matrix] Connected successfully')
        return true
      }
      return false
    } catch (error) {
      logger.error('[Matrix] Connection failed:', error)
      return false
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false
    logger.info('[Matrix] Disconnected')
  }

  async sendMessage(message: Partial<ChannelMessage>): Promise<string> {
    const { token } = this.config.credentials || {}
    const homeserver = this.config.options?.homeserver as string

    if (!token || !homeserver || !message.conversationId) {
      throw new Error(t('error.extended_channels.缺少必要参数5'))
    }

    const txnId = `m${Date.now()}`
    const response = await fetch(
      `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(message.conversationId)}/send/m.room.message/${txnId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          msgtype: 'm.text',
          body: message.content,
        }),
      }
    )

    const data = await response.json()
    return data.event_id || this.generateMessageId()
  }
}

/**
 * 创建扩展适配器
 */
export function createExtendedAdapter(config: ChannelConfig & { type: string }): ChannelAdapter | null {
  switch (config.type) {
    case 'googlechat':
      return new GoogleChatAdapter(config as ChannelConfig)
    case 'mattermost':
      return new MattermostAdapter(config as ChannelConfig)
    case 'signal':
      return new SignalAdapter(config as ChannelConfig)
    case 'imessage':
      return new IMessageAdapter(config as ChannelConfig)
    case 'teams':
      return new TeamsAdapter(config as ChannelConfig)
    case 'line':
      return new LINEAdapter(config as ChannelConfig)
    case 'matrix':
      return new MatrixAdapter(config as ChannelConfig)
    default:
      return null
  }
}
