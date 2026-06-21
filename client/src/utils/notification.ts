import { t } from '@/utils/i18n'

import { getCurrentPlatform, PlatformType } from '../router/utils/routeMerger'
import { logger } from './logger'
import { ElMessage, ElNotification } from 'element-plus'

/**
 * 通知参数接口
 */
export interface NotificationParams {
  title?: string
  message: string
  type?: 'success' | 'warning' | 'info' | 'error'
  duration?: number
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  onClick?: () => void
}

/**
 * 通知结果接口
 */
export interface NotificationResult {
  success: boolean
  platform: PlatformType
  message?: string
  notificationId?: string
}

/**
 * 通知适配器接口
 */
export interface NotificationAdapter {
  show(params: NotificationParams): Promise<NotificationResult>
  hide?(notificationId: string): Promise<boolean>
  requestPermission?(): Promise<boolean>
}

/**
 * Web/H5平台通知适配器
 */
export class WebNotificationAdapter implements NotificationAdapter {
  async show(params: NotificationParams): Promise<NotificationResult> {
    const platform = getCurrentPlatform()

    // 检查是否在浏览器环境
    if (typeof window === 'undefined') {
      return {
        success: false,
        platform,
        message: t('api.notification.浏览器环境不可用'),
      }
    }

    // 如果支持原生Notification API且在非页面聚焦状态，使用原生通知
    if (typeof Notification !== 'undefined' && !document.hasFocus()) {
      try {
        const permission = await Notification.requestPermission()
        if (permission === 'granted') {
          const notification = new Notification(params.title || '通知', {
            body: params.message,
            icon: import.meta.env.VITE_APP_LOGO || '/favicon.ico',
          })

          if (params.onClick) {
            notification.onclick = () => {
              window.focus()
              params.onClick?.()
              notification.close()
            }
          }

          if (params.duration) {
            setTimeout(() => notification.close(), params.duration)
          }

          return {
            success: true,
            platform,
            message: t('api.notification.通知显示成功1'),
            notificationId: notification.tag || Date.now().toString(),
          }
        }
      } catch (error) {
        logger.warn('Native Notification API failed, falling back to Element Plus notification:', error)
        // 降级到Element Plus通知
        return this.showElementPlusNotification(params)
      }
    }

    // 直接使用Element Plus通知
    return this.showElementPlusNotification(params)
  }

  private showElementPlusNotification(params: NotificationParams): NotificationResult {
    const platform = getCurrentPlatform()

    if (params.type === 'success' || params.type === 'warning' || params.type === 'error') {
      ElMessage({
        message: params.message,
        type: params.type as 'success' | 'warning' | 'error',
        duration: params.duration || 3000,
        onClose: () => {
          // 可以在这里处理通知关闭事件
        },
      })
    } else {
      ElNotification({
        title: params.title,
        message: params.message,
        type: params.type || 'info',
        duration: params.duration || 3000,
        position: params.position || 'top-right',
        onClick: () => {
          params.onClick?.()
        },
      })
    }

    return {
      success: true,
      platform,
      message: t('api.notification.通知显示成功2'),
    }
  }

  async requestPermission(): Promise<boolean> {
    if (typeof Notification !== 'undefined') {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }
    return false
  }
}


/**
 * 支付宝小程序平台通知适配器
 */
// 支付宝小程序 my 对象类型
interface AlipayMy {
  showToast: (options: {
    content: string
    type: 'success' | 'fail'
    duration: number
    success: () => void
    fail: (error: any) => void
  }) => void
  showModal: (options: {
    title: string
    content: string
    showCancel: boolean
    confirmText: string
    success: () => void
    fail: (error: any) => void
  }) => void
}

export class AlipayNotificationAdapter implements NotificationAdapter {
  async show(params: NotificationParams): Promise<NotificationResult> {
    const platform = 'alipay'
    const my = (window as unknown as Record<string, unknown>).my as AlipayMy | undefined

    if (!my) {
      return {
        success: false,
        platform,
        message: t('api.notification.支付宝SDK未初3'),
      }
    }

    // 支付宝小程序内使用showToast或showModal
    if (params.type === 'success' || params.type === 'error' || params.type === 'warning') {
      return new Promise(resolve => {
        my.showToast({
          content: params.message,
          type: params.type === 'success' ? 'success' : 'fail',
          duration: params.duration || 3000,
          success: () => {
            resolve({
              success: true,
              platform,
              message: t('api.notification.通知显示成功4'),
            })
          },
          fail: (error: any) => {
            logger.error('Alipay notification display failed:', error)
            resolve({
              success: false,
              platform,
              message: error instanceof Error ? error.message : t('api.notification.通知显示失败5'),
            })
          },
        })
      })
    } else {
      // 使用showModal显示更多信息
      return new Promise(resolve => {
        my.showModal({
          title: params.title || '通知',
          content: params.message,
          showCancel: false,
          confirmText: '确定',
          success: () => {
            if (params.onClick) {
              params.onClick()
            }
            resolve({
              success: true,
              platform,
              message: t('api.notification.通知显示成功6'),
            })
          },
          fail: (error: any) => {
            logger.error('Alipay modal display failed:', error)
            resolve({
              success: false,
              platform,
              message: error instanceof Error ? error.message : t('api.notification.通知显示失败7'),
            })
          },
        })
      })
    }
  }

  async requestPermission(): Promise<boolean> {
    // 支付宝小程序不需要单独请求通知权限
    return true
  }
}

/**
 * Electron平台通知适配器
 */
export class ElectronNotificationAdapter implements NotificationAdapter {
  private electron: { Notification: { new (options: { title: string; body: string; icon?: string }): { show: () => void; close: () => void; on: (event: string, callback: () => void) => void; id?: number } } } | null = null

  constructor() {
    try {
      if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        this.electron = require('electron')
      }
    } catch (error) {
      logger.error('[ElectronNotificationAdapter] Initialization failed:', error)
    }
  }

  async show(params: NotificationParams): Promise<NotificationResult> {
    const platform = 'electron'

    if (!this.electron) {
      // 降级到Web通知
      return new WebNotificationAdapter().show(params)
    }

    try {
      const { Notification } = this.electron
      const notification = new Notification({
        title: params.title || '通知',
        body: params.message,
        icon: import.meta.env.VITE_APP_LOGO || undefined,
      })

      if (params.onClick) {
        notification.on('click', () => {
          params.onClick?.()
          notification.close()
        })
      }

      if (params.duration) {
        setTimeout(() => notification.close(), params.duration)
      }

      return {
        success: true,
        platform,
        message: t('api.notification.通知显示成功8'),
        notificationId: notification.id?.toString() || Date.now().toString(),
      }
    } catch (error) {
      logger.error('[ElectronNotificationAdapter] Notification display failed:', error)
      // 降级到Web通知
      return new WebNotificationAdapter().show(params)
    }
  }

  async hide(_notificationId: string): Promise<boolean> {
    // Electron通知自动关闭，不需要手动隐藏
    return true
  }

  async requestPermission(): Promise<boolean> {
    // Electron不需要单独请求通知权限
    return true
  }
}

/**
 * 跨平台通知管理器
 */
export class NotificationManager {
  private static instance: NotificationManager
  private adapter: NotificationAdapter

  private constructor() {
    this.adapter = this.createAdapter()
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager()
    }
    return NotificationManager.instance
  }

  /**
   * 创建平台特定的通知适配器
   */
  private createAdapter(): NotificationAdapter {
    const platform = getCurrentPlatform()

    switch (platform) {
      case 'alipay':
        return new AlipayNotificationAdapter()
      case 'electron':
        return new ElectronNotificationAdapter()
      case 'web':
      case 'h5':
      default:
        return new WebNotificationAdapter()
    }
  }

  /**
   * 显示通知
   */
  async show(params: NotificationParams): Promise<NotificationResult> {
    return this.adapter.show(params)
  }

  /**
   * 隐藏通知
   */
  async hide(notificationId: string): Promise<boolean> {
    if (this.adapter.hide) {
      return this.adapter.hide(notificationId)
    }
    return true
  }

  /**
   * 请求通知权限
   */
  async requestPermission(): Promise<boolean> {
    if (this.adapter.requestPermission) {
      return this.adapter.requestPermission()
    }
    return true
  }
}

// 导出单例实例
export const notificationManager = NotificationManager.getInstance()

// 导出简化的通知函数
export const showNotification = notificationManager.show.bind(notificationManager)
export const hideNotification = notificationManager.hide.bind(notificationManager)
export const requestNotificationPermission =
  notificationManager.requestPermission.bind(notificationManager)

// 导出便捷的通知函数
export const notify = {
  success: (message: string, title?: string) => {
    return showNotification({ title, message, type: 'success' })
  },
  warning: (message: string, title?: string) => {
    return showNotification({ title, message, type: 'warning' })
  },
  error: (message: string, title?: string) => {
    return showNotification({ title, message, type: 'error' })
  },
  info: (message: string, title?: string) => {
    return showNotification({ title, message, type: 'info' })
  },
}
