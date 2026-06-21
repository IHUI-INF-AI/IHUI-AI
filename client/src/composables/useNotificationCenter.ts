import { t } from '@/utils/i18n'

/**
 * 统一通知中心
 * 
 * 功能：
 * 1. 统一管理所有AI模块的通知
 * 2. 支持进度显示、操作按钮、分组通知
 * 3. 支持浏览器通知
 * 4. 通知持久化和历史记录
 * 
 * @module composables/useNotificationCenter
 * @version 1.0.0
 */

import { ref, computed, type Ref } from 'vue'
import { ElNotification, ElMessageBox } from 'element-plus'
import { logger } from '@/utils/logger'
import type {
  Notification,
  NotificationAction,
  NotificationType,
  NotificationConfig,
  UUID,
} from '@/types/ai-platform.types'

// ============================================================================
// 配置
// ============================================================================

const DEFAULT_CONFIG: NotificationConfig = {
  defaultDuration: 4500,
  maxNotifications: 10,
  enableSound: true,
  enableBrowserNotifications: true,
  groupSimilar: true,
}

// ============================================================================
// 状态
// ============================================================================

/** 通知列表 */
const notifications: Ref<Notification[]> = ref([])

/** 通知历史 */
const history: Ref<Notification[]> = ref([])

/** 配置 */
const config: Ref<NotificationConfig> = ref({ ...DEFAULT_CONFIG })

/** 进度通知映射 */
const progressNotifications: Map<string, { close: () => void }> = new Map()

/** 未读计数 */
const unreadCount = computed(() => 
  notifications.value.filter(n => !n.readAt).length
)

// ============================================================================
// 工具函数
// ============================================================================

/** 生成UUID */
const generateId = (): UUID => {
  return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/** 请求浏览器通知权限 */
const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    return false
  }
  
  if (Notification.permission === 'granted') {
    return true
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }
  
  return false
}

/** 发送浏览器通知 */
const sendBrowserNotification = async (
  title: string,
  body: string,
  options?: NotificationOptions
): Promise<void> => {
  if (!config.value.enableBrowserNotifications) return
  
  const hasPermission = await requestNotificationPermission()
  if (!hasPermission) return
  
  try {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: options?.tag,
      ...options,
    })
    
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
    
    // 自动关闭
    setTimeout(() => notification.close(), config.value.defaultDuration)
  } catch (error) {
    logger.warn('Browser notification failed:', error)
  }
}

/** 播放通知音效 */
const playNotificationSound = (_type: NotificationType): void => {
  if (!config.value.enableSound) return
  
  // 可以根据类型播放不同音效
  // 这里暂时不实现，可以后续添加
}

// ============================================================================
// 核心方法
// ============================================================================

/**
 * 显示通知
 */
const showNotification = (options: {
  type: NotificationType
  title: string
  message: string
  duration?: number
  dismissible?: boolean
  persistent?: boolean
  actions?: NotificationAction[]
  browserNotify?: boolean
}): string => {
  const {
    type,
    title,
    message,
    duration = config.value.defaultDuration,
    dismissible = true,
    persistent = false,
    actions,
    browserNotify = false,
  } = options
  
  const id = generateId()
  
  const notification: Notification = {
    id,
    type,
    title,
    message,
    duration: persistent ? 0 : duration,
    dismissible,
    persistent,
    actions,
    createdAt: new Date().toISOString(),
  }
  
  // 添加到通知列表
  notifications.value.unshift(notification)
  
  // 限制最大通知数
  if (notifications.value.length > config.value.maxNotifications) {
    const removed = notifications.value.pop()
    if (removed) {
      history.value.unshift(removed)
    }
  }
  
  // 使用Element Plus通知
  const elNotificationOptions: { title: string; message: string; type: string; duration: number; showClose: boolean; customClass: string } = {
    title,
    message,
    type: type === 'progress' ? 'info' : type,
    duration: persistent ? 0 : duration,
    showClose: dismissible,
    customClass: `ai-notification ai-notification-${type}`,
  }
  
  if (actions && actions.length > 0) {
    // 如果有操作按钮，使用自定义模板
    // 这里简化处理，实际可以使用h函数渲染自定义内容
  }
  
  ElNotification(elNotificationOptions)
  
  // 播放音效
  playNotificationSound(type)
  
  // 发送浏览器通知
  if (browserNotify && (type === 'success' || type === 'error')) {
    void sendBrowserNotification(title, message, { tag: id })
  }
  
  return id
}

/**
 * 显示进度通知
 */
const showProgress = (
  id: string,
  options: {
    title: string
    message?: string
    progress: number
    max?: number
  }
): void => {
  const { title, message = '', progress, max = 100 } = options
  
  const notification: Notification = {
    id,
    type: 'progress',
    title,
    message,
    progress,
    progressMax: max,
    duration: 0,
    dismissible: false,
    persistent: true,
    createdAt: new Date().toISOString(),
  }
  
  // 更新或添加
  const existingIndex = notifications.value.findIndex(n => n.id === id)
  if (existingIndex >= 0) {
    notifications.value[existingIndex] = notification
  } else {
    notifications.value.unshift(notification)
  }
  
  // 使用Element Plus的进度通知（简化）
  const elNotif = progressNotifications.get(id)
  if (elNotif) {
    // 更新已有通知
    // Element Plus不支持直接更新，所以这里只更新内部状态
  } else {
    // 创建新通知
    const newNotif = ElNotification({
      title: `${title} (${Math.round(progress / max * 100)}%)`,
      message,
      type: 'info',
      duration: 0,
      showClose: false,
      customClass: 'ai-notification ai-notification-progress',
    })
    progressNotifications.set(id, newNotif)
  }
}

/**
 * 更新进度
 */
const updateProgress = (id: string, progress: number, message?: string): void => {
  const notification = notifications.value.find(n => n.id === id)
  if (!notification) return
  
  notification.progress = progress
  if (message) {
    notification.message = message
  }
  
  // 如果进度完成，自动关闭
  if (progress >= (notification.progressMax || 100)) {
    setTimeout(() => {
      dismissNotification(id)
    }, 1000)
  }
}

/**
 * 关闭通知
 */
const dismissNotification = (id: string): void => {
  const index = notifications.value.findIndex(n => n.id === id)
  if (index >= 0) {
    const notification = notifications.value[index]
    history.value.unshift(notification)
    notifications.value.splice(index, 1)
  }
  
  // 关闭Element Plus通知
  const elNotif = progressNotifications.get(id)
  if (elNotif) {
    elNotif.close()
    progressNotifications.delete(id)
  }
}

/**
 * 清空所有通知
 */
const clearAll = (): void => {
  history.value.unshift(...notifications.value)
  notifications.value = []
  
  // 关闭所有Element Plus通知
  progressNotifications.forEach((notif, _id) => {
    notif.close()
  })
  progressNotifications.clear()
}

/**
 * 标记为已读
 */
const markAsRead = (id: string): void => {
  const notification = notifications.value.find(n => n.id === id)
  if (notification && !notification.readAt) {
    notification.readAt = new Date().toISOString()
  }
}

/**
 * 标记全部已读
 */
const markAllAsRead = (): void => {
  const now = new Date().toISOString()
  notifications.value.forEach(n => {
    if (!n.readAt) {
      n.readAt = now
    }
  })
}

// ============================================================================
// 便捷方法
// ============================================================================

/** 显示成功通知 */
const showSuccess = (message: string, title = '成功'): string => {
  return showNotification({
    type: 'success',
    title,
    message,
    browserNotify: false,
  })
}

/** 显示错误通知 */
const showError = (message: string, title = '错误', options?: {
  persistent?: boolean
  actions?: NotificationAction[]
}): string => {
  return showNotification({
    type: 'error',
    title,
    message,
    persistent: options?.persistent,
    actions: options?.actions,
    browserNotify: true,
  })
}

/** 显示警告通知 */
const showWarning = (message: string, title = '警告'): string => {
  return showNotification({
    type: 'warning',
    title,
    message,
  })
}

/** 显示信息通知 */
const showInfo = (message: string, title = '提示'): string => {
  return showNotification({
    type: 'info',
    title,
    message,
  })
}

/** 显示生成完成通知 */
const showGenerationComplete = (
  type: 'image' | 'video' | '3d',
  options: {
    url?: string
    thumbnailUrl?: string
    sequence?: number
    duration?: number
  }
): string => {
  const typeLabels = {
    image: '图片',
    video: '视频',
    '3d': '3D模型',
  }
  
  const title = `${typeLabels[type]}生成完成`
  let message = ''
  
  if (options.sequence !== undefined) {
    message += `第${options.sequence}段`
  }
  if (options.duration !== undefined) {
    message += ` (${options.duration.toFixed(1)}秒)`
  }
  
  // 发送浏览器通知
  void sendBrowserNotification(title, message || '已完成', {
    tag: `generation-${type}`,
  })
  
  return showNotification({
    type: 'success',
    title,
    message: message || '已完成',
    browserNotify: false, // 已经单独发送了
  })
}

/** 显示错误通知（带重试） */
const showErrorWithRetry = (
  message: string,
  retryAction: () => void | Promise<void>,
  title = '操作失败'
): string => {
  return showNotification({
    type: 'error',
    title,
    message,
    persistent: true,
    actions: [
      {
        id: 'retry',
        label: t('text.use_notification_center.重试'),
        type: 'primary',
        handler: retryAction,
      },
      {
        id: 'dismiss',
        label: t('text.use_notification_center.忽略1'),
        type: 'default',
        handler: () => {},
      },
    ],
  })
}

/** 显示确认对话框 */
const showConfirm = async (
  message: string,
  title = '确认',
  options?: {
    confirmText?: string
    cancelText?: string
    type?: 'warning' | 'info'
  }
): Promise<boolean> => {
  try {
    await ElMessageBox.confirm(message, title, {
      confirmButtonText: options?.confirmText || '确定',
      cancelButtonText: options?.cancelText || '取消',
      type: options?.type || 'warning',
    })
    return true
  } catch {
    return false
  }
}

// ============================================================================
// 配置方法
// ============================================================================

/** 更新配置 */
const updateConfig = (newConfig: Partial<NotificationConfig>): void => {
  config.value = { ...config.value, ...newConfig }
  
  // 保存到localStorage
  try {
    localStorage.setItem('ai-notification-config', JSON.stringify(config.value))
  } catch (error) {
    logger.warn('Failed to save notification configuration:', error)
  }
}

/** 加载配置 */
const loadConfig = (): void => {
  try {
    const saved = localStorage.getItem('ai-notification-config')
    if (saved) {
      config.value = { ...DEFAULT_CONFIG, ...JSON.parse(saved) }
    }
  } catch (error) {
    logger.warn('Failed to load notification configuration:', error)
  }
}

// 初始化时加载配置
loadConfig()

// ============================================================================
// Composable 导出
// ============================================================================

/**
 * 使用通知中心
 */
export function useNotificationCenter() {
  return {
    // 状态
    notifications,
    history,
    config,
    unreadCount,
    
    // 核心方法
    showNotification,
    showProgress,
    updateProgress,
    dismissNotification,
    clearAll,
    markAsRead,
    markAllAsRead,
    
    // 便捷方法
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showGenerationComplete,
    showErrorWithRetry,
    showConfirm,
    
    // 配置
    updateConfig,
    loadConfig,
    
    // 浏览器通知
    requestNotificationPermission,
    sendBrowserNotification,
  }
}

// 默认导出
export default useNotificationCenter
