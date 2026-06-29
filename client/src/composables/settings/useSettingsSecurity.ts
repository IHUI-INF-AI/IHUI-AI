/**
 * Settings 安全设置管理 Composable
 *
 * 负责安全设置的加载、更新和密码修改
 *
 * @packageDocumentation
 */

import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { changePassword } from '@/api/user'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import {
  LOGIN_DURATION_OPTIONS,
  type LoginDuration,
} from '@/utils/login-duration'

/**
 * 安全设置接口
 */
export interface SecuritySettings {
  loginNotification: boolean
}

/**
 * 密码表单接口
 */
export interface PasswordForm {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

/**
 * useSettingsSecurity 配置选项
 */
export interface UseSettingsSecurityOptions {
  /** 安全设置更新成功后回调 */
  onUpdateSuccess?: () => void
}

/**
 * Settings 安全设置管理 Composable
 *
 * @param options - 配置选项
 * @returns 返回安全设置状态和方法
 */
export function useSettingsSecurity(options: UseSettingsSecurityOptions = {}) {
  const { onUpdateSuccess } = options
  const { t } = useI18n()
  const { handleResult } = useOperationFeedback()

  // 安全设置
  const securitySettings = reactive<SecuritySettings>({
    loginNotification: true,
  })

  // 登录持续时间设置
  const loginDuration = ref<LoginDuration>(
    StorageManager.getItem<LoginDuration>(STORAGE_KEYS.LOGIN_DURATION) || LOGIN_DURATION_OPTIONS[1]
  )

  // 密码对话框状态
  const showPasswordDialog = ref(false)

  // 密码表单
  const passwordForm = reactive<PasswordForm>({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  /**
   * 加载安全设置
   */
  const loadSecuritySettings = (data: Partial<SecuritySettings>): void => {
    if (typeof data.loginNotification === 'boolean') {
      securitySettings.loginNotification = data.loginNotification
    }
  }

  /**
   * 更新安全设置（登录通知等本地设置）
   */
  const updateSecuritySettingsData = (): void => {
    // 登录通知等设置作为本地设置保存
    if (onUpdateSuccess) {
      onUpdateSuccess()
    }
  }

  /**
   * 更新登录持续时间
   */
  const updateLoginDuration = (): void => {
    StorageManager.setItem(STORAGE_KEYS.LOGIN_DURATION, loginDuration.value)
  }

  /**
   * 处理修改密码
   */
  const handleChangePassword = async (): Promise<void> => {
    if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      void handleResult(Promise.reject(new Error(t('user.messages.settings.passwordRequired'))), {
        errorMessage: t('user.messages.settings.passwordRequired'),
      })
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      void handleResult(Promise.reject(new Error(t('user.messages.settings.passwordMismatch'))), {
        errorMessage: t('user.messages.settings.passwordMismatch'),
      })
      return
    }

    if (passwordForm.newPassword.length < 6) {
      void handleResult(Promise.reject(new Error(t('user.messages.settings.passwordTooShort'))), {
        errorMessage: t('user.messages.settings.passwordTooShort'),
      })
      return
    }

    await handleResult(
      changePassword({
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword,
      }),
      {
        successMessage: t('user.messages.settings.passwordChangeSuccess'),
        errorMessage: t('user.messages.settings.passwordChangeFailed'),
        onSuccess: () => {
          showPasswordDialog.value = false
          passwordForm.oldPassword = ''
          passwordForm.newPassword = ''
          passwordForm.confirmPassword = ''
        },
      }
    )
  }

  /**
   * 打开密码对话框
   */
  const openPasswordDialog = (): void => {
    showPasswordDialog.value = true
  }

  /**
   * 关闭密码对话框
   */
  const closePasswordDialog = (): void => {
    showPasswordDialog.value = false
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  }

  return {
    // 状态
    securitySettings,
    loginDuration,
    showPasswordDialog,
    passwordForm,
    LOGIN_DURATION_OPTIONS,

    // 方法
    loadSecuritySettings,
    updateSecuritySettingsData,
    updateLoginDuration,
    handleChangePassword,
    openPasswordDialog,
    closePasswordDialog,
  }
}
