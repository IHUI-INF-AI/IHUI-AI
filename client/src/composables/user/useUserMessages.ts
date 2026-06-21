import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { logger } from '@/utils/logger'
import {
  cancelRequest,
  createAbortController,
  getCachedData,
  setCachedData,
} from '@/utils/resource-optimizer'
import { usePagination } from './usePagination'
import {
  getMessages,
  getMessageStats,
  markMessageAsRead,
  markMessagesAsRead,
  deleteMessages,
  markAllAsRead,
  type Message as MessageType,
  MessageType as MsgType,
  MessageStatus,
  type MessageStats,
} from '@/api/message'
import { AlertCircle, MessageSquare, Bell, Info } from '@/lib/lucide-fallback'

/**
 * 用户消息相关功能的 Composable
 * 包含消息列表、消息统计、消息操作等功能
 */
export function useUserMessages() {
  const { t } = useI18n()
  const router = useRouter()
  const { handleResult } = useOperationFeedback()
  const { confirmDelete } = useConfirmDialog()
  const { showError } = useOperationFeedback()

  // ==================== 消息状态 ====================
  const activeMessageTab = ref<'all' | 'system' | 'notification' | 'push'>('all')
  const messagesLoading = ref(false)
  const messages = ref<MessageType[]>([])
  const selectedMessages = ref<string[]>([])
  const messageStats = reactive<MessageStats>({
    total: 0,
    unread: 0,
    read: 0,
    deleted: 0,
    byType: {
      [MsgType.SYSTEM]: 0,
      [MsgType.NOTIFICATION]: 0,
      [MsgType.PUSH]: 0,
      [MsgType.REMINDER]: 0,
    },
  })

  // ==================== 加载消息列表 ====================
  const loadMessageSquares = async (): Promise<void> => {
    // 取消之前的请求
    cancelRequest('messages')

    const cacheKey = `messages_${activeMessageTab.value}_${messagePagination.page}_${messagePagination.pageSize}`
    const cached = getCachedData(cacheKey)
    if (cached && typeof cached === 'object' && cached !== null) {
      const cachedData = cached as { list?: MessageType[]; total?: number }
      messages.value = cachedData.list || []
      messagePagination.total = cachedData.total || 0
      return
    }

    messagesLoading.value = true
    createAbortController('messages')
    try {
      // 构建请求参数，匹配后端API格式
      const params: {
        type?: MsgType
        status?: MessageStatus
        page?: number
        pageSize?: number
        category?: string
      } = {
        page: messagePagination.page || 1,
        pageSize: messagePagination.pageSize || 20,
      }

      // 如果选择了特定类型，添加type参数（转换为枚举值）
      if (activeMessageTab.value !== 'all') {
        const typeMap: Record<string, MsgType> = {
          system: MsgType.SYSTEM,
          notification: MsgType.NOTIFICATION,
          push: MsgType.PUSH,
        }
        if (typeMap[activeMessageTab.value]) {
          params.type = typeMap[activeMessageTab.value]
        }
      }

      const response = await getMessages(params)

      if (response.code === 200 || response.success) {
        const responseData = response.data
        if (responseData) {
          const list = responseData.list || []
          messages.value = list
          messagePagination.total = responseData.total || 0
          messagePagination.page = responseData.page || messagePagination.page
          messagePagination.pageSize = responseData.pageSize || messagePagination.pageSize
          // 性能优化：缓存数据
          setCachedData(cacheKey, { list, total: messagePagination.total })
        } else {
          messages.value = []
          messagePagination.total = 0
        }
      } else {
        showError(response.message || t('user.messages.loadMessageSquaresFailed'))
        messages.value = []
      }
    } catch (error: any) {
      // 忽略取消的请求
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      // 检查是否为网络错误
      const errorObj = error instanceof Error ? error : new Error(String(error))
      const isNetworkError =
        (error as { code?: string })?.code === 'NETWORK_ERROR' ||
        errorObj.message?.includes('Network Error') ||
        errorObj.message?.includes('fetch failed')

      if (!isNetworkError) {
        logger.error('Failed to load messages', errorObj)
        showError(errorObj.message || t('user.messages.loadMessageSquaresFailedRetry'))
      }
      messages.value = []
    } finally {
      messagesLoading.value = false
    }
  }

  // 使用公共分页 composable（在 loadMessageSquares 定义之后）
  const {
    pagination: messagePagination,
    handlePageChange,
    handlePageSizeChange,
  } = usePagination({
    onPageChange: () => loadMessageSquares(),
    onPageSizeChange: () => loadMessageSquares(),
  })

  // ==================== 加载消息统计 ====================
  const loadMessageSquareStats = async (): Promise<void> => {
    try {
      const response = await getMessageStats()
      if (response.code === 200 || response.success) {
        Object.assign(messageStats, response.data)
      }
    } catch (_error) {
      // 静默失败
    }
  }

  // ==================== 消息操作 ====================
  // 处理消息点击
  const handleMessageClick = async (message: MessageType): Promise<void> => {
    if (message.status === MessageStatus.UNREAD) {
      try {
        await markMessageAsRead(message.id)
        message.status = MessageStatus.READ
        messageStats.unread = Math.max(0, messageStats.unread - 1)
        messageStats.read++
        messageStats.byType[message.type] = Math.max(
          0,
          (messageStats.byType[message.type] || 0) - 1
        )
      } catch (error) {
        // 静默失败，不影响用户体验
        logger.error('Failed to mark message as read:', error)
      }
    }
  }

  // 标记为已读
  const handleMarkAsRead = async (): Promise<void> => {
    if (selectedMessages.value.length === 0) return
    await handleResult(markMessagesAsRead(selectedMessages.value), {
      successMessage: t('user.messages.markedRead'),
      onSuccess: () => {
        messages.value.forEach((msg: MessageType) => {
          if (selectedMessages.value.includes(msg.id)) {
            msg.status = MessageStatus.READ
          }
        })
        selectedMessages.value = []
        void loadMessageSquareStats()
      },
    })
  }

  // 全部标记为已读
  const handleMarkAllAsRead = async (): Promise<void> => {
    await handleResult(markAllAsRead(), {
      successMessage: t('user.messages.allRead'),
      onSuccess: () => {
        messages.value.forEach((msg: MessageType) => {
          msg.status = MessageStatus.READ
          msg.readTime = new Date().toISOString()
        })
        void loadMessageSquareStats()
      },
    })
  }

  // 删除消息
  const handleTrash2MessageSquares = async (): Promise<void> => {
    if (selectedMessages.value.length === 0) return
    const confirmed = await confirmDelete(t('user.messages.messages'))
    if (!confirmed) return

    await handleResult(deleteMessages(selectedMessages.value), {
      successMessage: t('user.messages.deleteSuccess'),
      onSuccess: () => {
        messages.value = messages.value.filter(
          (msg: MessageType) => !selectedMessages.value.includes(msg.id)
        )
        selectedMessages.value = []
        void loadMessageSquareStats()
      },
    })
  }

  // ==================== 消息分类和分页 ====================
  // 消息分类切换
  const handleMessageSquareTabChange = (): void => {
    messagePagination.page = 1
    void loadMessageSquares()
  }

  // 消息分页（使用公共 composable 的方法）
  const handleMessageSquarePageChange = (page: number): void => {
    void handlePageChange(page)
  }

  const handleMessageSquarePageSizeChange = (size: number): void => {
    void handlePageSizeChange(size)
  }

  // ==================== 消息操作 ====================
  // 消息操作
  const handleMessageAction = (message: MessageType): void => {
    if (message.actionUrl) {
      if (message.actionUrl.startsWith('http')) {
        window.open(message.actionUrl, '_blank')
      } else {
        void router.push(message.actionUrl)
      }
    }
  }

  // ==================== 工具函数 ====================
  const getMessageSquareIcon = (type: MsgType): typeof AlertCircle => {
    const iconMap = {
      [MsgType.SYSTEM]: AlertCircle,
      [MsgType.NOTIFICATION]: MessageSquare,
      [MsgType.PUSH]: Bell,
      [MsgType.REMINDER]: Info,
    }
    return iconMap[type] || Info
  }

  const getMessageSquareIconColor = (type: MsgType): string => {
    const colorMap = {
      [MsgType.SYSTEM]: 'var(--el-text-color-primary)',
      [MsgType.NOTIFICATION]: 'var(--el-text-color-primary)',
      [MsgType.PUSH]: 'var(--el-text-color-primary)',
      [MsgType.REMINDER]: 'var(--el-text-color-secondary)',
    }
    return colorMap[type] || 'var(--el-text-color-primary)'
  }

  const getPriorityTagType = (priority: 'low' | 'medium' | 'high' | 'urgent'): string => {
    const typeMap = {
      low: 'info',
      medium: '',
      high: 'warning',
      urgent: 'danger',
    }
    return typeMap[priority] || ''
  }

  const getPriorityText = (priority: 'low' | 'medium' | 'high' | 'urgent'): string => {
    const textMap = {
      low: t('user.priority.low'),
      medium: t('user.priority.medium'),
      high: t('user.priority.high'),
      urgent: t('user.priority.urgent'),
    }
    return textMap[priority] || t('user.priority.medium')
  }

  return {
    // 状态
    activeMessageTab,
    messagesLoading,
    messages,
    selectedMessages,
    messageStats,
    messagePagination,

    // 方法
    loadMessageSquares,
    loadMessageSquareStats,
    handleMessageClick,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleTrash2MessageSquares,
    handleMessageSquareTabChange,
    handleMessageSquarePageChange,
    handleMessageSquarePageSizeChange,
    handleMessageAction,

    // 工具函数
    getMessageSquareIcon,
    getMessageSquareIconColor,
    getPriorityTagType,
    getPriorityText,
  }
}
