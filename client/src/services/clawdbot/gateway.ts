/**
 * Clawdbot Gateway - 核心网关系统
 * 
 * WebSocket 网关，负责:
 * - 消息路由和分发
 * - 多渠道消息聚合
 * - 实时事件处理
 * - 连接管理
 */

import { ref, reactive } from 'vue'
import { logger } from '@/utils/logger'
import { EventEmitter } from '@/utils/event-emitter'

/**
 * 网关配置
 */
export interface GatewayConfig {
  /** WebSocket 服务器地址 */
  wsUrl?: string
  /** 重连配置 */
  reconnect?: {
    enabled: boolean
    maxRetries: number
    retryDelay: number
    backoffMultiplier: number
  }
  /** 心跳配置 */
  heartbeat?: {
    enabled: boolean
    interval: number
    timeout: number
  }
  /** 消息队列配置 */
  messageQueue?: {
    maxSize: number
    flushInterval: number
  }
}

/**
 * 网关消息
 */
export interface GatewayMessage {
  id: string
  type: 'chat' | 'command' | 'event' | 'system' | 'tool_call' | 'tool_result'
  channel: string
  channelType: string
  userId: string
  content: string
  metadata?: Record<string, unknown>
  attachments?: Array<{
    type: 'image' | 'file' | 'audio' | 'video'
    url: string
    name?: string
    size?: number
    mimeType?: string
  }>
  replyTo?: string
  timestamp: number
}

/**
 * 网关事件
 */
export interface GatewayEvent {
  type: 'connected' | 'disconnected' | 'message' | 'error' | 'channel_joined' | 'channel_left' | 'typing' | 'presence'
  data: unknown
  timestamp: number
}

/**
 * 连接状态
 */
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

/**
 * 默认配置
 */
const DEFAULT_CONFIG: GatewayConfig = {
  reconnect: {
    enabled: true,
    maxRetries: 5,
    retryDelay: 1000,
    backoffMultiplier: 2,
  },
  heartbeat: {
    enabled: true,
    interval: 30000,
    timeout: 10000,
  },
  messageQueue: {
    maxSize: 1000,
    flushInterval: 100,
  },
}

/**
 * Clawdbot 核心网关
 */
export class ClawdbotGateway extends EventEmitter {
  private config: GatewayConfig
  private ws: WebSocket | null = null
  private connectionState = ref<ConnectionState>('disconnected')
  private retryCount = 0
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private messageQueue: GatewayMessage[] = []
  private pendingMessages = reactive<Map<string, GatewayMessage>>(new Map())
  private channels = reactive<Set<string>>(new Set())
  private lastPongTime = 0

  constructor(config: Partial<GatewayConfig> = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 获取连接状态
   */
  get state(): ConnectionState {
    return this.connectionState.value
  }

  /**
   * 是否已连接
   */
  get isConnected(): boolean {
    return this.connectionState.value === 'connected'
  }

  /**
   * 获取活跃的频道
   */
  get activeChannels(): string[] {
    return Array.from(this.channels)
  }

  /**
   * 连接到网关
   */
  async connect(wsUrl?: string): Promise<boolean> {
    const url = wsUrl || this.config.wsUrl

    if (!url) {
      // 如果没有 WebSocket URL，使用本地模式
      logger.info('[Gateway] Using local mode (no WebSocket connection)）')
      this.connectionState.value = 'connected'
      this.emit('connected', { mode: 'local' })
      return true
    }

    if (this.connectionState.value === 'connected') {
      logger.warn('[Gateway] Already connected')
      return true
    }

    this.connectionState.value = 'connecting'

    try {
      return await this.createConnection(url)
    } catch (error) {
      logger.error('[Gateway] Connection failed:', error)
      this.connectionState.value = 'disconnected'
      return false
    }
  }

  /**
   * 创建 WebSocket 连接
   */
  private createConnection(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(url)

        this.ws.onopen = () => {
          logger.info('[Gateway] WebSocket connection successful')
          this.connectionState.value = 'connected'
          this.retryCount = 0
          this.startHeartbeat()
          this.flushMessageQueue()
          this.emit('connected', { url })
          resolve(true)
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.ws.onclose = (event) => {
          logger.info('[Gateway] WebSocket connection closed:', event.code, event.reason)
          this.handleDisconnect()
          resolve(false)
        }

        this.ws.onerror = (error) => {
          logger.error('[Gateway] WebSocket error:', error)
          this.emit('error', { error })
        }
      } catch (error) {
        logger.error('[Gateway] WebSocket creation failed:', error)
        resolve(false)
      }
    })
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopHeartbeat()
    this.stopReconnect()

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.connectionState.value = 'disconnected'
    this.emit('disconnected', {})
  }

  /**
   * 发送消息
   */
  async send(message: Omit<GatewayMessage, 'id' | 'timestamp'>): Promise<string> {
    const fullMessage: GatewayMessage = {
      ...message,
      id: this.generateMessageId(),
      timestamp: Date.now(),
    }

    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify(fullMessage))
    } else {
      // 加入消息队列，等待连接恢复后发送
      this.queueMessage(fullMessage)
    }

    this.pendingMessages.set(fullMessage.id, fullMessage)
    return fullMessage.id
  }

  /**
   * 发送到指定频道
   */
  async sendToChannel(channel: string, content: string, metadata?: Record<string, unknown>): Promise<string> {
    return this.send({
      type: 'chat',
      channel,
      channelType: 'direct',
      userId: 'system',
      content,
      metadata,
    })
  }

  /**
   * 广播消息到所有频道
   */
  async broadcast(content: string, excludeChannels: string[] = []): Promise<string[]> {
    const messageIds: string[] = []

    for (const channel of this.channels) {
      if (!excludeChannels.includes(channel)) {
        const id = await this.sendToChannel(channel, content)
        messageIds.push(id)
      }
    }

    return messageIds
  }

  /**
   * 加入频道
   */
  joinChannel(channelId: string): void {
    this.channels.add(channelId)
    this.emit('channel_joined', { channelId })
    logger.info(`[Gateway] Joining channel: ${channelId}`)
  }

  /**
   * 离开频道
   */
  leaveChannel(channelId: string): void {
    this.channels.delete(channelId)
    this.emit('channel_left', { channelId })
    logger.info(`[Gateway] Leaving channel: ${channelId}`)
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data)

      // 处理心跳响应
      if (message.type === 'pong') {
        this.lastPongTime = Date.now()
        return
      }

      // 处理确认消息
      if (message.type === 'ack' && message.messageId) {
        this.pendingMessages.delete(message.messageId)
        return
      }

      // 发出消息事件
      this.emit('message', message)
    } catch (error) {
      logger.error('[Gateway] Message parsing failed:', error)
    }
  }

  /**
   * 处理断开连接
   */
  private handleDisconnect(): void {
    this.stopHeartbeat()
    this.connectionState.value = 'disconnected'
    this.emit('disconnected', {})

    // 尝试重连
    if (this.config.reconnect?.enabled && this.retryCount < (this.config.reconnect?.maxRetries || 5)) {
      this.scheduleReconnect()
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return
    }

    const delay = this.calculateReconnectDelay()
    this.connectionState.value = 'reconnecting'

    logger.info(`[Gateway] Attempting to reconnect (${this.retryCount + 1}/${this.config.reconnect?.maxRetries})`)

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      this.retryCount++
      await this.connect()
    }, delay)
  }

  /**
   * 计算重连延迟
   */
  private calculateReconnectDelay(): number {
    const baseDelay = this.config.reconnect?.retryDelay || 1000
    const multiplier = this.config.reconnect?.backoffMultiplier || 2
    return baseDelay * Math.pow(multiplier, this.retryCount)
  }

  /**
   * 停止重连
   */
  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    if (!this.config.heartbeat?.enabled) {
      return
    }

    this.stopHeartbeat()
    this.lastPongTime = Date.now()

    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return
      }

      // 检查心跳超时
      const timeout = this.config.heartbeat?.timeout || 10000
      if (Date.now() - this.lastPongTime > timeout) {
        logger.warn('[Gateway] Heartbeat timeout, disconnecting')
        this.ws.close()
        return
      }

      // 发送心跳
      this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
    }, this.config.heartbeat?.interval || 30000)
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * 加入消息队列
   */
  private queueMessage(message: GatewayMessage): void {
    const maxSize = this.config.messageQueue?.maxSize || 1000

    if (this.messageQueue.length >= maxSize) {
      // 移除最旧的消息
      this.messageQueue.shift()
    }

    this.messageQueue.push(message)
  }

  /**
   * 清空消息队列
   */
  private flushMessageQueue(): void {
    if (!this.ws || this.messageQueue.length === 0) {
      return
    }

    logger.info(`[Gateway] Flushing queued messages`)

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      if (message) {
        this.ws.send(JSON.stringify(message))
      }
    }
  }

  /**
   * 生成消息 ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * 获取待处理消息
   */
  getPendingMessages(): GatewayMessage[] {
    return Array.from(this.pendingMessages.values())
  }

  /**
   * 清空待处理消息
   */
  clearPendingMessages(): void {
    this.pendingMessages.clear()
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    connectionState: ConnectionState
    activeChannels: number
    pendingMessages: number
    queuedMessages: number
    retryCount: number
  } {
    return {
      connectionState: this.connectionState.value,
      activeChannels: this.channels.size,
      pendingMessages: this.pendingMessages.size,
      queuedMessages: this.messageQueue.length,
      retryCount: this.retryCount,
    }
  }
}

// 单例实例
let gatewayInstance: ClawdbotGateway | null = null

/**
 * 获取网关实例
 */
export function getClawdbotGateway(): ClawdbotGateway {
  if (!gatewayInstance) {
    gatewayInstance = new ClawdbotGateway()
  }
  return gatewayInstance
}
