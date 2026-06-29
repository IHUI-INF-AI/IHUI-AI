/**
 * WebSocket 服务
 * 用于实时通信
 */

import { logger } from './logger'
import { getUserToken } from './request'

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface WebSocketMessage {
  type: string
  data: unknown
  timestamp?: number
}

/**
 * WebSocket 服务类
 */
class WebSocketService {
  private ws: WebSocket | null = null
  private url: string = ''
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 3000
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private messageHandlers: Map<string, Array<(data: unknown) => void>> = new Map()
  private statusHandlers: Array<(status: WebSocketStatus) => void> = []

  /**
   * 获取当前状态
   */
  get status(): WebSocketStatus {
    if (!this.ws) return 'disconnected'
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting'
      case WebSocket.OPEN:
        return 'connected'
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return 'disconnected'
      default:
        return 'error'
    }
  }

  /**
   * 连接 WebSocket
   */
  async connect(url: string, token?: string): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      logger.warn('[WebSocket] Already connected')
      return
    }

    this.url = url
    this.reconnectAttempts = 0

    return this.doConnect(url, token)
  }

  /**
   * 执行连接
   */
  private doConnect(url: string, token?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 如果有 token，添加到 URL
        const fullUrl = token ? `${url}?token=${token}` : url

        this.ws = new WebSocket(fullUrl)
        this.notifyStatusChange('connecting')

        this.ws.onopen = () => {
          logger.info('[WebSocket] Connected')
          this.reconnectAttempts = 0
          this.notifyStatusChange('connected')
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.ws.onclose = () => {
          logger.info('[WebSocket] Connection closed')
          this.notifyStatusChange('disconnected')
          this.attemptReconnect()
        }

        this.ws.onerror = (error) => {
          logger.error('[WebSocket] Connection error:', error)
          this.notifyStatusChange('error')
          reject(error)
        }
      } catch (error) {
        logger.error('[WebSocket] Connection failed:', error)
        this.notifyStatusChange('error')
        reject(error)
      }
    })
  }

  /**
   * 尝试重连
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn('[WebSocket] Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    logger.info(`[WebSocket] Attempting reconnection`)

    this.reconnectTimer = setTimeout(() => {
      if (this.url) {
        this.doConnect(this.url).catch(() => {
          // 重连失败，继续尝试
        })
      }
    }, this.reconnectDelay)
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.reconnectAttempts = 0
    logger.info('[WebSocket] Disconnected')
  }

  /**
   * 发送消息
   */
  send(type: string, data: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      logger.warn('[WebSocket] Not connected, cannot send message')
      return
    }

    const message: WebSocketMessage = {
      type,
      data,
      timestamp: Date.now(),
    }

    this.ws.send(JSON.stringify(message))
  }

  /**
   * 处理收到的消息
   */
  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data)
      const handlers = this.messageHandlers.get(message.type)

      if (handlers) {
        handlers.forEach((handler) => handler(message.data))
      }
    } catch (error) {
      logger.error('[WebSocket] Message parsing failed:', error)
    }
  }

  /**
   * 订阅消息
   */
  on(type: string, handler: (data: unknown) => void): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, [])
    }

    this.messageHandlers.get(type)!.push(handler)

    // 返回取消订阅函数
    return () => {
      const handlers = this.messageHandlers.get(type)
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index > -1) {
          handlers.splice(index, 1)
        }
      }
    }
  }

  /**
   * 监听状态变化
   */
  onStatusChange(handler: (status: WebSocketStatus) => void): () => void {
    this.statusHandlers.push(handler)

    // 返回取消监听函数
    return () => {
      const index = this.statusHandlers.indexOf(handler)
      if (index > -1) {
        this.statusHandlers.splice(index, 1)
      }
    }
  }

  /**
   * 通知状态变化
   */
  private notifyStatusChange(status: WebSocketStatus): void {
    this.statusHandlers.forEach((handler) => handler(status))
  }
}

// 导出单例实例
export const websocketService = new WebSocketService()

/**
 * 创建带 JWT token 的 WebSocket 连接 (统一入口).
 *
 * 自动从 getUserToken() 获取 token 并附加到 URL query.
 * 用于直接 new WebSocket(url) 的场景, 确保 token 不遗漏.
 *
 * 用法: const ws = createAuthWebSocket(wsUrl)
 */
export function createAuthWebSocket(url: string): WebSocket {
  const token = getUserToken() || ''
  const fullUrl = token ? `${url}${url.includes('?') ? '&' : '?'}token=${token}` : url
  return new WebSocket(fullUrl)
}

export default websocketService
