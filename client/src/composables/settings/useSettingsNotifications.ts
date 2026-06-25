/**
 * Settings 通知设置管理 Composable
 *
 * 负责通知设置的加载和更新
 *
 * @packageDocumentation
 */

import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { updateNotificationSettings } from '@/api/system/settings'
import type { UserSettings } from '@/shared/api'

/**
 * 通知设置接口
 */
export type NotificationSettings = NonNullable<UserSettings['notifications']>

/**
 * useSettingsNotifications 配置选项
 */
export interface UseSettingsNotificationsOptions {
  /** 通知设置更新成功后回调 */
  onUpdateSuccess?: () => void
}

/**
 * Settings 通知设置管理 Composable
 *
 * @param options - 配置选项
 * @returns 返回通知设置状态和方法
 */
export function useSettingsNotifications(options: UseSettingsNotificationsOptions = {}) {
  const { onUpdateSuccess } = options
  const { t } = useI18n()
  const { handleResult } = useOperationFeedback()

  // 通知设置
  const notificationSettings = reactive<NotificationSettings>({
    email: true,
    sms: true,
    push: true,
  })

  /**
   * 加载通知设置
   */
  const loadNotificationSettings = (data: Partial<NotificationSettings> | undefined): void => {
    if (data && typeof data.email === 'boolean') notificationSettings.email = data.email
    if (data && typeof data.sms === 'boolean') notificationSettings.sms = data.sms
    if (data && typeof data.push === 'boolean') notificationSettings.push = data.push
  }

  /**
   * 更新通知设置
   */
  const updateNotificationSettingsData = async (): Promise<void> => {
    await handleResult(updateNotificationSettings(notificationSettings), {
      successMessage: t('user.messages.settings.notificationUpdateSuccess'),
      errorMessage: t('user.messages.settings.notificationUpdateFailed'),
      onSuccess: () => {
        if (onUpdateSuccess) {
          onUpdateSuccess()
        }
      },
    })
  }

  return {
    // 状态
    notificationSettings,

    // 方法
    loadNotificationSettings,
    updateNotificationSettingsData,
  }
}
