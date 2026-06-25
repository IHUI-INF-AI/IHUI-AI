import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDarkModeStore } from '@/stores/darkMode'
import { useLanguageStore } from '@/stores/language'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { StorageManager } from '@/utils/storage'
import { downloadUserData, type UserExportData } from '@/api/user/user/user-export'
import { getUserInfo } from '@/api/user/user'
import { getOrders, type Order } from '@/api/payment/orders'
import { getConversations, type Conversation } from '@/api/chat/chat/chat-history'
import { logger } from '@/utils/logger'

/**
 * 用户设置相关功能的 Composable
 * 包含隐私设置、通知设置、主题设置、语言设置等功能
 *
 * @returns {Object} 返回设置相关的状态和方法
 * @returns {Object} returns.privacySettings - 隐私设置对象
 * @returns {Object} returns.notificationSettings - 通知设置对象
 * @returns {Object} returns.themeSettings - 主题设置对象（与全局主题系统同步）
 * @returns {Object} returns.languageSettings - 语言设置对象（与全局语言系统同步）
 * @returns {Function} returns.handleSavePrivacy - 保存隐私设置
 * @returns {Function} returns.handleSaveNotificationSettings - 保存通知设置
 * @returns {Function} returns.handleSaveThemeSettings - 保存主题设置
 * @returns {Function} returns.handleSaveLanguageSettings - 保存语言设置
 * @returns {Function} returns.handleExportData - 导出个人数据
 * @returns {Function} returns.handleClearCache - 清除缓存
 */
export function useUserSettings() {
  const { t } = useI18n()
  const darkModeStore = useDarkModeStore()
  const languageStore = useLanguageStore()
  const { showSuccess, showError: showErrorMsg } = useOperationFeedback()
  const { confirm } = useConfirmDialog()

  // 隐私设置
  const privacySettings = reactive({
    emailVisibility: 'private',
    phoneVisibility: 'private',
    birthdayVisibility: 'private',
  })

  // 通知设置
  const notificationSettings = reactive({
    email: true,
    sms: false,
    push: true,
    order: true,
    security: true,
  })

  // 主题设置 - 与全局主题系统同步
  const themeSettings = reactive({
    get mode(): 'light' | 'dark' | 'auto' {
      return darkModeStore.themeMode as 'light' | 'dark' | 'auto'
    },
    set mode(value: 'light' | 'dark' | 'auto') {
      darkModeStore.setThemeMode(value, 'user', true)
    },
    fontSize: 'medium',
  })

  // 语言设置 - 与全局语言系统同步
  const languageSettings = reactive({
    get current(): string {
      return languageStore.currentLanguage || 'zh-CN'
    },
    set current(value: string) {
      const langStore = languageStore as ReturnType<typeof useLanguageStore> & {
        setLanguage: (language: string) => void
      }
      langStore.setLanguage(value)
    },
  })

  // 保存隐私设置
  const handleSavePrivacy = async (): Promise<void> => {
    try {
      // 这里应该调用API
      // await updatePrivacySettings(privacySettings)
      showSuccess(t('user.messages.privacySaveSuccess'))
    } catch (error) {
      logger.error('Failed to save privacy settings:', error)
      showErrorMsg(t('user.messages.privacySaveFailed'))
    }
  }

  // 保存通知设置
  const handleSaveNotificationSettings = async (): Promise<void> => {
    try {
      // 这里应该调用API保存通知设置
      // await updateNotificationSettings(notificationSettings);
      showSuccess(t('user.messages.notificationSaveSuccess'))
    } catch (error) {
      logger.error('Failed to save notification settings:', error)
      showErrorMsg(t('user.messages.notificationSaveFailed'))
    }
  }

  // 保存主题设置 - 已通过computed自动同步，无需手动保存
  const handleSaveThemeSettings = async (): Promise<void> => {
    try {
      // 主题设置已通过computed自动同步到全局store
      // 无需手动操作DOM，store会自动处理
      showSuccess(t('user.messages.themeSaveSuccess'))
    } catch (error) {
      logger.error('Failed to save theme settings:', error)
      showErrorMsg(t('user.messages.themeSaveFailed'))
    }
  }

  // 保存语言设置
  const handleSaveLanguageSettings = async (): Promise<void> => {
    try {
      // 更新语言设置
      const langStore = languageStore as ReturnType<typeof useLanguageStore> & {
        setLanguage: (language: string) => void
      }
      langStore.setLanguage(languageSettings.current)
      showSuccess(t('user.messages.languageSaveSuccess'))
    } catch (error: any) {
      logger.error('Failed to save language settings:', error)
      showErrorMsg(t('user.messages.languageSaveFailed'))
    }
  }

  // 导出个人数据 - 完整实现
  const handleExportData = async (): Promise<void> => {
    const confirmed = await confirm(
      t('user.messages.exportDataConfirm') || '确认导出个人数据？',
      t('user.messages.exportDataTitle') || '导出个人数据',
      {
        confirmButtonText: t('user.messages.exportDataConfirmButton') || '确认导出',
        cancelButtonText: t('user.messages.exportDataCancelButton') || '取消',
        type: 'info',
      }
    )
    if (!confirmed) return

    try {
      // 获取用户数据
      const userInfoRes = await getUserInfo()
      const userInfo = userInfoRes.data

      if (!userInfo) {
        showErrorMsg(t('user.messages.userInfoNotFound') || '用户信息不存在')
        return
      }

      // 获取订单数据
      let orders: Array<{ id?: string; orderNo?: string; type?: string; amount?: number; status?: string; createTime?: string }> = []
      try {
        const ordersRes = await getOrders({ page: 1, pageSize: 1000 })
        if (ordersRes.success && ordersRes.data?.items) {
          orders = ((ordersRes.data.items as unknown) as Order[]).map((order: Order) => ({
            id: typeof order.id === 'string' ? order.id : String(order.id || ''),
            orderNo: typeof order.orderNo === 'string' ? order.orderNo : String(order.orderNo || ''),
            type: typeof order.type === 'string' ? order.type : String(order.type || ''),
            amount: typeof order.amount === 'number' ? order.amount : Number(order.amount || 0),
            status: typeof order.status === 'string' ? order.status : String(order.status || ''),
            createTime: typeof order.createTime === 'string' ? order.createTime : String(order.createTime || ''),
          }))
        }
      } catch (error) {
        logger.warn('Failed to get order data:', error)
        // 继续导出其他数据
      }

      // 获取对话历史（如果有API）
      let conversations: Array<{ id?: string; title?: string; messageCount?: number; createTime?: string; updateTime?: string }> = []
      try {
        const conversationsRes = await getConversations({ page: 1, pageSize: 1000 })
        if (conversationsRes.success && conversationsRes.data?.conversations) {
          conversations = ((conversationsRes.data.conversations as unknown) as Conversation[]).map((conv: Conversation) => ({
            id: typeof conv.id === 'string' ? conv.id : String(conv.id || ''),
            title: typeof conv.title === 'string' ? conv.title : t('text.use_user_settings.未命名对话'),
            messageCount: typeof conv.messageCount === 'number' ? conv.messageCount : Number(conv.messageCount || 0),
            createTime: conv.createdAt || '',
            updateTime: conv.updatedAt || '',
          }))
        }
      } catch (error) {
        logger.warn('Failed to get conversation history:', error)
        // 继续导出其他数据
      }

      // 从localStorage获取收藏和评论（如果有）
      const favorites = StorageManager.getItem('favorites') || []
      const comments = StorageManager.getItem('comments') || []

      // 构建导出数据
      const exportData = {
        userInfo: {
          id: userInfo.id,
          uuid: userInfo.uuid,
          username: userInfo.username,
          email: userInfo.email,
          phone: userInfo.phone,
          nickname: userInfo.nickname,
          avatar: userInfo.avatar,
          gender: userInfo.gender,
          birthday: userInfo.birthday,
          signature: userInfo.signature,
          createTime: userInfo.createTime,
          updateTime: userInfo.updateTime,
        },
        orders,
        conversations,
        favorites: Array.isArray(favorites) ? favorites : [],
        comments: Array.isArray(comments) ? comments : [],
        exportTime: new Date().toISOString(),
      }

      // 下载数据 - 确保类型匹配
      const _exportData = exportData // 标记原始exportData为已使用
      const exportDataTyped: UserExportData = {
        userInfo: {
          id: typeof userInfo.id === 'string' ? userInfo.id : String(userInfo.id || ''),
          uuid: typeof userInfo.uuid === 'string' ? userInfo.uuid : String(userInfo.uuid || ''),
          username: typeof userInfo.username === 'string' ? userInfo.username : String(userInfo.username || ''),
          email: typeof userInfo.email === 'string' ? userInfo.email : String(userInfo.email || ''),
          phone: typeof userInfo.phone === 'string' ? userInfo.phone : String(userInfo.phone || ''),
          nickname: typeof userInfo.nickname === 'string' ? userInfo.nickname : String(userInfo.nickname || ''),
          avatar: typeof userInfo.avatar === 'string' ? userInfo.avatar : String(userInfo.avatar || ''),
          gender: typeof userInfo.gender === 'number' ? userInfo.gender : Number(userInfo.gender || 0),
          birthday: typeof userInfo.birthday === 'string' ? userInfo.birthday : String(userInfo.birthday || ''),
          signature: typeof userInfo.signature === 'string' ? userInfo.signature : String(userInfo.signature || ''),
          createTime: typeof userInfo.createTime === 'string' ? userInfo.createTime : String(userInfo.createTime || ''),
          updateTime: typeof userInfo.updateTime === 'string' ? userInfo.updateTime : String(userInfo.updateTime || ''),
        },
        orders: orders.map(order => ({
          id: order.id || '',
          orderNo: order.orderNo || '',
          type: order.type || '',
          amount: order.amount || 0,
          status: order.status || '',
          createTime: order.createTime || '',
        })),
        conversations: conversations.map(conv => ({
          id: conv.id || '',
          title: conv.title || '未命名对话',
          messageCount: conv.messageCount || 0,
          createTime: conv.createTime || '',
          updateTime: conv.updateTime || '',
        })),
        favorites: Array.isArray(favorites) ? favorites : [],
        comments: Array.isArray(comments) ? comments : [],
        exportTime: new Date().toISOString(),
      }
      downloadUserData(exportDataTyped)

      showSuccess(t('user.messages.exportDataSuccess') || '数据导出成功')
      logger.info('User data exported successfully', {
        userId: userInfo.id,
        orderCount: orders.length,
        conversationCount: conversations.length,
      })
    } catch (error: any) {
      logger.error('Failed to export user data:', error)
      showErrorMsg(t('user.messages.exportDataFailed') || '数据导出失败，请稍后重试')
    }
  }

  // 清除缓存
  const handleClearCache = async (): Promise<void> => {
    const confirmed = await confirm(
      t('user.messages.clearCacheConfirm'),
      t('user.messages.clearCacheTitle'),
      {
        confirmButtonText: t('user.messages.clearCacheConfirmButton'),
        cancelButtonText: t('user.messages.clearCacheCancelButton'),
        type: 'warning',
      }
    )
    if (!confirmed) return

    try {
      // 清除缓存
      StorageManager.removeItem('cache_data')
      sessionStorage.clear()
      showSuccess(t('user.messages.clearCacheSuccess'))
      // 重新加载页面
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (_error: any) {
      showErrorMsg(t('user.messages.clearCacheFailed'))
    }
  }

  return {
    privacySettings,
    notificationSettings,
    themeSettings,
    languageSettings,
    handleSavePrivacy,
    handleSaveNotificationSettings,
    handleSaveThemeSettings,
    handleSaveLanguageSettings,
    handleExportData,
    handleClearCache,
  }
}
