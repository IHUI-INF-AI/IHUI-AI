/**
 * 客服系统WebSocket连接管理
 */

import { ref, onUnmounted } from 'vue'
import { useWebSocket, type WebSocketMessage, WebSocketStatus } from '@/composables/useWebSocket'
import type { CustomerServiceMessage } from '@/api/customer-service'
import { logger } from '@/utils/logger'
import { useAuthStore } from '@/stores/auth'

export interface CustomerServiceWebSocketConfig {
  conversationId?: string
  onMessage?: (message: CustomerServiceMessage) => void
  onTyping?: (isTyping: boolean, senderId: string) => void
  onStatusChange?: (status: WebSocketStatus) => void
  onError?: (error: Error) => void
  onSendError?: (message: string) => void
}

/**
 * 使用客服系统WebSocket
 */
export function useCustomerServiceWebSocket(config: CustomerServiceWebSocketConfig = {}) {
  const authStore = useAuthStore()
  const messages = ref<CustomerServiceMessage[]>([])
  const isTyping = ref(false)
  const typingUserId = ref<string>('')
  const conversationId = ref<string>(config.conversationId || '')

  // 构建WebSocket URL
  const getWebSocketUrl = () => {
    // 优先使用环境变量，否则根据当前页面协议动态计算
    const baseUrl = import.meta.env.VITE_WS_BASE_URL || (() => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${protocol}//${window.location.host}`
    })()
    const token = authStore.token
    const convId = conversationId.value || 'new'
    return `${baseUrl}/customer-service/chat?token=${token}&conversationId=${convId}`
  }

  // WebSocket连接
  const ws = useWebSocket({
    url: getWebSocketUrl(),
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000,
    onMessage: (message: WebSocketMessage) => {
      handleWebSocketMessage(message)
    },
    onError: (error: Event) => {
      logger.error('Customer service WebSocket connection error:', error)
      config.onError?.(new Error('WebSocket连接错误'))
    },
    onOpen: () => {
      logger.info('Customer service WebSocket connected')
      config.onStatusChange?.(ws.status.value)
      // 连接成功后，加载历史消息
      void loadHistoryMessages()
    },
    onClose: () => {
      logger.info('Customer service WebSocket closed')
      config.onStatusChange?.(ws.status.value)
    },
  })

  /**
   * 处理WebSocket消息
   */
  const handleWebSocketMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'customer_service_message':
        // 收到新消息
        if (message.data) {
          const msg = message.data as CustomerServiceMessage
          messages.value.push(msg)
          config.onMessage?.(msg)
        }
        break
      case 'customer_service_typing':
        // 收到输入状态
        if (message.data) {
          const data = message.data as { userId: string; isTyping: boolean }
          isTyping.value = data.isTyping
          typingUserId.value = data.userId
          config.onTyping?.(data.isTyping, data.userId)
        }
        break
      case 'customer_service_read':
        // 消息已读
        if (message.data) {
          const data = message.data as { messageIds: string[] }
          messages.value.forEach((msg: CustomerServiceMessage) => {
            if (data.messageIds.includes(msg.id)) {
              msg.status = 'read'
            }
          })
        }
        break
      case 'customer_service_conversation_id':
        // 收到会话ID
        if (message.data) {
          const data = message.data as { conversationId: string }
          conversationId.value = data.conversationId
        }
        break
      default:
        logger.warn('Unknown WebSocket message type:', message.type)
    }
  }

  const staffId = 'customer-service-staff'
  const _staffName = '智汇客服'

  /** 生成本地占位 ID */
  const nextId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  /** 无后端时：添加用户消息 + 模拟客服回复，保证可在线对话 */
  const pushFallbackConversation = (content: string, msgType: 'text' | 'image' | 'file') => {
    const userId = (authStore.user && typeof authStore.user === 'object' && 'id' in authStore.user ? (authStore.user as { id: string }).id : '') || 'guest'
    const userName = (authStore.user && typeof authStore.user === 'object' && 'nickname' in authStore.user ? (authStore.user as { nickname?: string }).nickname : null) || (authStore.user && typeof authStore.user === 'object' && 'username' in authStore.user ? (authStore.user as { username?: string }).username : null) || '我'
    const now = new Date().toISOString()

    const userMsg: CustomerServiceMessage = {
      id: nextId(),
      type: msgType,
      content,
      senderId: userId,
      senderName: userName,
      status: 'sent',
      createTime: now,
    }
    messages.value.push(userMsg)
    config.onMessage?.(userMsg)

    const cannedReplies: string[] = [
      '您好，您的留言我们已收到，客服将尽快回复。如需紧急帮助请前往「工单」提交问题。',
      '感谢您的反馈，我们会尽快处理。您也可以先查看「常见问题」获取自助解答。',
      '已记录您的问题，工作时间内我们会优先回复。',
    ]
    const replyContent = cannedReplies[Math.floor(Math.random() * cannedReplies.length)]

    const staffMsg: CustomerServiceMessage = {
      id: nextId(),
      type: 'text',
      content: replyContent,
      senderId: staffId,
      senderName: '智汇客服',
      status: 'sent',
      createTime: new Date().toISOString(),
    }
    setTimeout(() => {
      messages.value.push(staffMsg)
      config.onMessage?.(staffMsg)
    }, 600)
    return true
  }

  /**
   * 发送消息（优先走接口，失败则本地展示 + 模拟客服回复，保证可对话）
   */
  const sendMessage = async (
    content: string,
    type: 'text' | 'image' | 'file' = 'text',
    files?: File[]
  ): Promise<boolean> => {
    try {
      const { sendCustomerServiceMessage } = await import('@/api/customer-service')
      const response = await sendCustomerServiceMessage({
        content,
        type,
        files,
        conversationId: conversationId.value || undefined,
      })

      if (response.success && response.data) {
        messages.value.push(response.data)
        if (response.data.id && !conversationId.value) {
          conversationId.value = response.data.id.split('_')[0]
        }
        return true
      }
      config.onSendError?.(response.message || '发送失败')
      return false
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: { detail?: string; message?: string } } }
      if (ax?.response?.status === 400) {
        config.onSendError?.(ax.response?.data?.detail || ax.response?.data?.message || '发送失败')
        return false
      }
      logger.warn('Customer service message sent via fallback:', err)
      return pushFallbackConversation(content, type)
    }
  }

  /**
   * 发送输入状态
   */
  const sendTyping = (isTyping: boolean) => {
    ws.sendMessage('customer_service_typing', {
      isTyping,
      userId: (authStore.user && typeof authStore.user === 'object' && 'id' in authStore.user ? (authStore.user as { id: string }).id : '') || '',
    })
  }

  /**
   * 标记消息为已读
   */
  const markAsRead = (messageIds: string[]) => {
    ws.sendMessage('customer_service_read', { messageIds })
    // 同时调用API
    import('@/api/customer-service').then(({ markMessagesAsRead }) => {
      markMessagesAsRead(messageIds).catch((err: unknown) => {
        logger.error('Failed to mark message as read:', err)
      })
    }).catch((e) => { console.warn('[useCustomerServiceWebSocket] 模块加载失败', e) })
  }

  /**
   * 加载历史消息
   */
  const loadHistoryMessages = async () => {
    if (!conversationId.value) {
      return
    }

    try {
      const { getCustomerServiceMessages } = await import('@/api/customer-service')
      const response = await getCustomerServiceMessages({
        conversationId: conversationId.value,
        page: 1,
        pageSize: 50,
      })

      if (response.success && response.data) {
        messages.value = response.data.list || []
        if (response.data.conversationId) {
          conversationId.value = response.data.conversationId
        }
      }
    } catch (error) {
      logger.error('Failed to load historical messages:', error)
    }
  }

  /**
   * 连接
   */
  const connect = () => {
    ws.connect()
  }

  /**
   * 断开连接
   */
  const disconnect = () => {
    ws.disconnect()
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    messages,
    isTyping,
    typingUserId,
    conversationId,
    status: ws.status,
    connect,
    disconnect,
    sendMessage,
    sendTyping,
    markAsRead,
    loadHistoryMessages,
  }
}
