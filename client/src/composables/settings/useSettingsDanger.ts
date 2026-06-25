/**
 * Settings 危险操作管理 Composable
 *
 * 负责清除数据和注销账户等危险操作
 *
 * @packageDocumentation
 */

import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useCleanup } from '@/composables/useCleanup'
import { clearAllData, deleteAccount } from '@/api/system/settings'

/**
 * useSettingsDanger 配置选项
 */
export interface UseSettingsDangerOptions {
  /** 清除数据成功后回调 */
  onClearSuccess?: () => void
  /** 注销账户成功后回调 */
  onDeleteSuccess?: () => void
}

/**
 * Settings 危险操作管理 Composable
 *
 * @param options - 配置选项
 * @returns 返回危险操作状态和方法
 */
export function useSettingsDanger(options: UseSettingsDangerOptions = {}) {
  const { onClearSuccess, onDeleteSuccess } = options
  const { t } = useI18n()
  const { handleResult } = useOperationFeedback()
  const cleanup = useCleanup()

  // 对话框状态
  const showClearDataDialog = ref(false)
  const showDeleteAccountDialog = ref(false)

  // 注销账户密码
  const deleteAccountPassword = ref('')

  /**
   * 清除所有数据
   */
  const clearAllUserData = async (): Promise<void> => {
    await handleResult(clearAllData(), {
      successMessage: t('user.messages.settings.dataClearSuccess'),
      errorMessage: t('user.messages.settings.dataClearFailed'),
      onSuccess: () => {
        showClearDataDialog.value = false
        // 延迟刷新页面，让用户看到成功消息
        cleanup.addTimer(() => {
          window.location.reload()
        }, 1500)

        if (onClearSuccess) {
          onClearSuccess()
        }
      },
      onError: (error: any) => {
        // 类型断言处理错误对象
        const errorObj = error as { response?: { status?: number } }
        if (errorObj.response?.status === 403) {
          void handleResult(
            Promise.reject(new Error(t('user.messages.settings.insufficientPermissionClearData'))),
            {
              errorMessage: t('user.messages.settings.insufficientPermissionClearData'),
            }
          )
        }
      },
    })
  }

  /**
   * 注销账户
   */
  const deleteUserAccount = async (): Promise<void> => {
    if (!deleteAccountPassword.value) {
      await handleResult(
        Promise.reject(new Error(t('user.messages.settings.passwordConfirmRequired'))),
        {
          errorMessage: t('user.messages.settings.passwordConfirmRequired'),
        }
      )
      return
    }

    await handleResult(deleteAccount(deleteAccountPassword.value), {
      successMessage: t('user.messages.settings.accountDeletionSuccess'),
      errorMessage: t('user.messages.settings.accountDeletionFailed'),
      onSuccess: () => {
        // 延迟跳转，让用户看到成功消息
        cleanup.addTimer(() => {
          window.location.href = '/login'
        }, 2000)

        if (onDeleteSuccess) {
          onDeleteSuccess()
        }
      },
      onError: (error: any) => {
        // 类型断言处理错误对象
        const errorObj = error as { response?: { status?: number } }
        if (errorObj.response?.status === 400) {
          void handleResult(Promise.reject(new Error(t('user.messages.settings.passwordError'))), {
            errorMessage: t('user.messages.settings.passwordError'),
          })
        } else if (errorObj.response?.status === 403) {
          void handleResult(
            Promise.reject(
              new Error(t('user.messages.settings.insufficientPermissionDeleteAccount'))
            ),
            {
              errorMessage: t('user.messages.settings.insufficientPermissionDeleteAccount'),
            }
          )
        }
      },
    })
  }

  /**
   * 打开清除数据对话框
   */
  const openClearDataDialog = (): void => {
    showClearDataDialog.value = true
  }

  /**
   * 关闭清除数据对话框
   */
  const closeClearDataDialog = (): void => {
    showClearDataDialog.value = false
  }

  /**
   * 打开注销账户对话框
   */
  const openDeleteAccountDialog = (): void => {
    showDeleteAccountDialog.value = true
  }

  /**
   * 关闭注销账户对话框
   */
  const closeDeleteAccountDialog = (): void => {
    showDeleteAccountDialog.value = false
    deleteAccountPassword.value = ''
  }

  return {
    // 状态
    showClearDataDialog,
    showDeleteAccountDialog,
    deleteAccountPassword,

    // 方法
    clearAllUserData,
    deleteUserAccount,
    openClearDataDialog,
    closeClearDataDialog,
    openDeleteAccountDialog,
    closeDeleteAccountDialog,
  }
}
