/**
 * WebSocket Composables
 * 基于全栈开发规划，提供统一的 WebSocket 连接管理
 */

import { ref, onMounted, onUnmounted } from 'vue'
import { logger } from '../utils/logger'
import { STORAGE_KEYS } from '@/utils/storage'

// 定义 WebSocketMessage 类型（本地定义，移除对外部模块的依赖）
export interface WebSocketMessage {
  type: string
  data?: any
  timestamp?: number
  id?: string
}

// 定义 WebSocketMessageType 枚举
enum WebSocketMessageType {
  MESSAGE = 'message',
  TYPING = 'typing',
  READ = 'read',
  ERROR = 'error',
  CHAT_MESSAGE = 'chat_message',
  CHAT_STREAM = 'chat_stream',
  CHAT_COMPLETE = 'chat_complete',
  PING = 'ping',
  PONG = 'pong',
}

/**
 * WebSocket 连接配置
 */
export interface WebSocketConfig {
  url: string
  protocols?: string[]
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
  onMessage?: (message: WebSocketMessage) => void
  onError?: (error: Event) => void
  onOpen?: () => void
  onClose?: () => void
}

/**
 * WebSocket 连接状态
 */
export enum WebSocketStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

/**
 * 使用 WebSocket
 */
export function useWebSocket(config: WebSocketConfig) {
  const status = ref<WebSocketStatus>(WebSocketStatus.DISCONNECTED)
  const ws = ref<WebSocket | null>(null)
  const reconnectAttempts = ref(0)
  const messageQueue = ref<WebSocketMessage[]>([])

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  // 主动断开标志：disconnect() 置 true，onclose 据此跳过自动重连，避免卸载后重连泄漏
  let manualClose = false

  /**
   * 连接 WebSocket
   */
  const connect = () => {
    if (ws.value?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      // 新连接重置主动断开标志
      manualClose = false
      status.value = WebSocketStatus.CONNECTING
      // 统一从 localStorage 取 token 拼到 URL (后端 @ws_require_auth 要求 ?token=)
      const token = localStorage.getItem(STORAGE_KEYS.USER_TOKEN) || ''
      const sep = config.url.includes('?') ? '&' : '?'
      const finalUrl = token ? `${config.url}${sep}token=${encodeURIComponent(token)}` : config.url
      ws.value = new WebSocket(finalUrl, config.protocols)

      ws.value.onopen = () => {
        status.value = WebSocketStatus.CONNECTED
        reconnectAttempts.value = 0

        // 发送队列中的消息
        while (messageQueue.value.length > 0) {
          const message = messageQueue.value.shift()
          if (message) {
            send(message)
          }
        }

        // 启动心跳
        if (config.heartbeatInterval) {
          startHeartbeat()
        }

        config.onOpen?.()
      }

      ws.value.onmessage = (event: MessageEvent) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)

          // 处理心跳响应
          if (message.type === WebSocketMessageType.PONG) {
            return
          }

          config.onMessage?.(message)
        } catch (error) {
          logger.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.value.onerror = (error: Event) => {
        status.value = WebSocketStatus.ERROR
        config.onError?.(error)
      }

      ws.value.onclose = () => {
        status.value = WebSocketStatus.DISCONNECTED
        stopHeartbeat()
        config.onClose?.()

        // 主动断开时不自动重连，避免组件卸载后仍后台重连导致回调操作已卸载组件
        if (manualClose) {
          return
        }

        // 自动重连
        if (reconnectAttempts.value < (config.maxReconnectAttempts || 5)) {
          reconnect()
        }
      }
    } catch (error) {
      logger.error('WebSocket connection failed:', error)
      status.value = WebSocketStatus.ERROR
    }
  }

  /**
   * 断开连接
   */
  const disconnect = () => {
    // 标记为主动断开，阻止 onclose 触发自动重连
    manualClose = true
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    stopHeartbeat()

    if (ws.value) {
      // 先清除回调引用，避免 close() 异步触发 onclose 时仍执行业务回调
      ws.value.onopen = null
      ws.value.onmessage = null
      ws.value.onerror = null
      ws.value.onclose = null
      ws.value.close()
      ws.value = null
    }

    status.value = WebSocketStatus.DISCONNECTED
  }

  /**
   * 重连
   */
  const reconnect = () => {
    if (status.value === WebSocketStatus.RECONNECTING) {
      return
    }

    status.value = WebSocketStatus.RECONNECTING
    reconnectAttempts.value++

    const interval = config.reconnectInterval || 3000
    reconnectTimer = setTimeout(() => {
      connect()
    }, interval)
  }

  /**
   * 发送消息
   */
  const send = (message: WebSocketMessage): boolean => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      // 如果未连接，加入队列
      messageQueue.value.push(message)
      return false
    }

    try {
      ws.value.send(
        JSON.stringify({
          ...message,
          timestamp: Date.now(),
        })
      )
      return true
    } catch (error) {
      logger.error('Failed to send WebSocket message:', error)
      messageQueue.value.push(message)
      return false
    }
  }

  /**
   * 启动心跳
   */
  const startHeartbeat = () => {
    if (heartbeatTimer) {
      return
    }

    const interval = config.heartbeatInterval || 30000
    heartbeatTimer = setInterval(() => {
      if (ws.value?.readyState === WebSocket.OPEN) {
        send({
          type: WebSocketMessageType.PING,
        })
      }
    }, interval)
  }

  /**
   * 停止心跳
   */
  const stopHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  /**
   * 发送特定类型的消息
   */
  const sendMessage = (
    type: WebSocketMessageType | string,
    data?: any,
    id?: string
  ): boolean => {
    return send({
      type,
      data,
      id: id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    })
  }

  onMounted(() => {
    connect()
  })

  onUnmounted(() => {
    disconnect()
  })

  return {
    status,
    ws,
    connect,
    disconnect,
    send,
    sendMessage,
    reconnect,
    reconnectAttempts,
    messageQueue,
  }
}
