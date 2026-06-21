import { logger } from './logger'

export interface NotificationOptions {
  title: string
  body: string
  icon?: string
  tag?: string
  requireInteraction?: boolean
}

class NotificationService {
  private permission: NotificationPermission = 'default'

  async init(): Promise<void> {
    if (!this.isSupported()) {
      logger.warn('Notifications are not supported')
      return
    }

    this.permission = Notification.permission

    if (this.permission === 'default') {
      await this.requestPermission()
    }
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied'
    }

    try {
      this.permission = await Notification.requestPermission()
      return this.permission
    } catch {
      return 'denied'
    }
  }

  getPermission(): NotificationPermission {
    return this.permission
  }

  canNotify(): boolean {
    return this.permission === 'granted'
  }

  async show(options: NotificationOptions): Promise<Notification | null> {
    if (!this.canNotify()) {
      return null
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon,
        tag: options.tag,
        requireInteraction: options.requireInteraction || false
      })

      notification.onclick = () => {
        window.focus()
        notification.close()
      }

      return notification
    } catch (error) {
      logger.error('Failed to show notification:', error)
      return null
    }
  }

  async showSyncSuccess(themeMode: string): Promise<Notification | null> {
    return this.show({
      title: '主题同步成功',
      body: `主题已成功同步为${themeMode === 'dark' ? '深色' : '浅色'}模式`,
      tag: 'theme-sync-success',
      icon: '/favicon.ico'
    })
  }

  async showSyncFailed(errorMessage?: string): Promise<Notification | null> {
    return this.show({
      title: '主题同步失败',
      body: errorMessage || '同步过程中发生错误，请稍后重试',
      tag: 'theme-sync-failed',
      icon: '/favicon.ico'
    })
  }

  async showOfflineMode(): Promise<Notification | null> {
    return this.show({
      title: '离线模式',
      body: '当前处于离线状态，同步任务将在网络恢复后自动执行',
      tag: 'theme-offline',
      icon: '/favicon.ico'
    })
  }

  async showConflictDetected(): Promise<Notification | null> {
    return this.show({
      title: '同步冲突',
      body: '检测到本地与云端数据冲突，请在设置中选择解决方式',
      tag: 'theme-conflict',
      requireInteraction: true,
      icon: '/favicon.ico'
    })
  }
}

export const notificationService = new NotificationService()
