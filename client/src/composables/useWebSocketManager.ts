/**
 * WebSocket 连接管理器
 * 提供统一的 WebSocket 连接管理、状态监控和UI提示
 */

import { computed, onUnmounted } from 'vue'
import { t } from '@/utils/i18n'
import { useWebSocket, WebSocketStatus, type WebSocketConfig } from './useWebSocket'
import { useOperationFeedback } from './useOperationFeedback'
import { logger } from '@/utils/logger'
export type ConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'reconnecting'
  | 'error'

export interface WebSocketManagerOptions extends WebSocketConfig {
  /** 是否显示连接状态提示 */
  showStatusNotification?: boolean
  /** 是否自动重连 */
  autoReconnect?: boolean
  /** 重连延迟（毫秒） */
  reconnectDelay?: number
  /** 最大重连次数 */
  maxReconnectAttempts?: number
}

/**
 * WebSocket 连接管理器 Composable
 */
export function useWebSocketManager(options: WebSocketManagerOptions) {
  const {
    showStatusNotification = true,
    autoReconnect = true,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
    ...wsConfig
  } = options

  const { showSuccess, showWarning, showError, showInfo } = useOperationFeedback()

  // 使用基础 WebSocket Composable
  const {
    status: wsStatus,
    connect,
    disconnect,
    send,
    sendMessage,
    reconnect,
    reconnectAttempts,
    messageQueue,
  } = useWebSocket({
    ...wsConfig,
    maxReconnectAttempts,
    reconnectInterval: reconnectDelay,
    onOpen: () => {
      if (showStatusNotification) {
        showSuccess('WebSocket连接已建立')
      }
      wsConfig.onOpen?.()
    },
    onClose: () => {
      if (showStatusNotification) {
        showWarning('WebSocket连接已断开')
      }
      wsConfig.onClose?.()
    },
    onError: error => {
      if (showStatusNotification) {
        showError('WebSocket连接错误')
      }
      logger.error('WebSocket error:', error)
      wsConfig.onError?.(error)
    },
    onMessage: message => {
      wsConfig.onMessage?.(message)
    },
  })

  // 连接状态（转换为UI友好的状态）
  const connectionStatus = computed<ConnectionStatus>(() => {
    switch (wsStatus.value) {
      case WebSocketStatus.CONNECTED:
        return 'connected'
      case WebSocketStatus.CONNECTING:
        return 'connecting'
      case WebSocketStatus.RECONNECTING:
        return 'reconnecting'
      case WebSocketStatus.ERROR:
        return 'error'
      default:
        return 'disconnected'
    }
  })

  // 连接状态消息
  const statusMessage = computed(() => {
    switch (wsStatus.value) {
      case WebSocketStatus.CONNECTING:
        return t('text.use_web_socket_manager.正在建立连接')
      case WebSocketStatus.RECONNECTING:
        return `正在重连... (${reconnectAttempts.value}/${maxReconnectAttempts})`
      case WebSocketStatus.ERROR:
        return t('text.use_web_socket_manager.连接错误请检查网1')
      case WebSocketStatus.DISCONNECTED:
        return t('text.use_web_socket_manager.连接已断开2')
      default:
        return ''
    }
  })

  // 是否已连接
  const isConnected = computed(() => wsStatus.value === WebSocketStatus.CONNECTED)

  // 是否有待发送的消息
  const hasPendingMessages = computed(() => messageQueue.value.length > 0)

  // 手动重连
  const manualReconnect = () => {
    if (wsStatus.value === WebSocketStatus.CONNECTED) {
      showInfo('连接已建立，无需重连')
      return
    }

    disconnect()
    setTimeout(() => {
      connect()
      if (showStatusNotification) {
        showInfo('正在重新连接...')
      }
    }, 500)
  }

  // 清理资源
  onUnmounted(() => {
    disconnect()
  })

  return {
    // 状态
    status: connectionStatus,
    wsStatus,
    isConnected,
    hasPendingMessages,
    statusMessage,
    reconnectAttempts,
    messageQueue,

    // 方法
    connect,
    disconnect,
    send,
    sendMessage,
    reconnect: autoReconnect ? reconnect : manualReconnect,
    manualReconnect,
  }
}
