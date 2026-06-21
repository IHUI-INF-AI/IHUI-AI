/**
 * Settings 隐私设置管理 Composable
 *
 * 负责隐私设置的加载和更新
 *
 * @packageDocumentation
 */

import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { updatePrivacySettings } from '@/api/settings'
import type { UserSettings } from '@/shared/api'

/**
 * 隐私设置接口
 */
export type PrivacySettings = NonNullable<UserSettings['privacy']>

/**
 * useSettingsPrivacy 配置选项
 */
export interface UseSettingsPrivacyOptions {
  /** 隐私设置更新成功后回调 */
  onUpdateSuccess?: () => void
}

/**
 * Settings 隐私设置管理 Composable
 *
 * @param options - 配置选项
 * @returns 返回隐私设置状态和方法
 */
export function useSettingsPrivacy(options: UseSettingsPrivacyOptions = {}) {
  const { onUpdateSuccess } = options
  const { t } = useI18n()
  const { handleResult } = useOperationFeedback()

  // 隐私设置
  const privacySettings = reactive<PrivacySettings>({
    profileVisible: true,
    activityVisible: true,
  })

  /**
   * 加载隐私设置
   */
  const loadPrivacySettings = (data: Partial<PrivacySettings> | undefined): void => {
    if (data && typeof data.profileVisible === 'boolean') {
      privacySettings.profileVisible = data.profileVisible
    }
    if (data && typeof data.activityVisible === 'boolean') {
      privacySettings.activityVisible = data.activityVisible
    }
  }

  /**
   * 更新隐私设置
   */
  const updatePrivacySettingsData = async (): Promise<void> => {
    await handleResult(updatePrivacySettings(privacySettings), {
      successMessage: t('user.messages.settings.privacyUpdateSuccess'),
      errorMessage: t('user.messages.settings.privacyUpdateFailed'),
      onSuccess: () => {
        if (onUpdateSuccess) {
          onUpdateSuccess()
        }
      },
    })
  }

  return {
    // 状态
    privacySettings,

    // 方法
    loadPrivacySettings,
    updatePrivacySettingsData,
  }
}
