import { ref, reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElForm } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useApiError } from '@/composables/useApiError'
import { InputValidator } from '@/utils/security'
import { updatePassword, type UserInfoData } from '@/api/user/user'
import {
  getLoginDevices,
  removeLoginDevice,
  getLoginHistory,
  type LoginDevice,
  type LoginHistory,
} from '@/api/system/security'

/**
 * 用户安全相关功能的 Composable
 * 包含密码修改、登录设备、登录历史等功能
 */
export function useUserSecurity() {
  const { t } = useI18n()
  const authStore = useAuthStore()
  const { handleResult } = useOperationFeedback()
  const { confirm } = useConfirmDialog()
  const { handleError } = useApiError()

  // ==================== 密码修改 ====================
  const passwordFormRef = ref<InstanceType<typeof ElForm> | null>(null)
  const passwordForm = reactive({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const showPasswordDialog = ref(false)
  const passwordChanging = ref(false)
  const passwordStrengthType = ref<'success' | 'warning' | 'danger'>('success')
  const passwordStrengthText = ref(t('user.strength.strong'))
  const lastPasswordChange = ref((authStore.user as UserInfoData | null)?.lastPasswordChange || '')

  // 密码验证规则
  const passwordRules = computed(() => ({
    oldPassword: [{ required: true, message: t('user.validation.oldPassword'), trigger: 'blur' }],
    newPassword: [
      { required: true, message: t('user.validation.newPassword'), trigger: 'blur' },
      {
        validator: (_rule: any, value: string, callback: (error?: Error) => void): void => {
          if (!value) {
            callback()
            return
          }
          const strengthResult = InputValidator.validatePasswordStrength(value)
          if (!strengthResult.valid) {
            callback(new Error(t('user.validation.passwordStrength')))
            return
          }
          callback()
        },
        trigger: 'blur',
      },
    ],
    confirmPassword: [
      { required: true, message: t('user.validation.confirmPassword'), trigger: 'blur' },
      {
        validator: (_rule: any, value: string, callback: (error?: Error) => void): void => {
          if (value !== passwordForm.newPassword) {
            callback(new Error(t('user.validation.passwordMatch')))
          } else {
            callback()
          }
        },
        trigger: 'blur',
      },
    ],
  }))

  // 监听新密码变化，更新密码强度
  watch(
    () => passwordForm.newPassword,
    (newPassword: string) => {
      if (!newPassword) {
        passwordStrengthType.value = 'success'
        passwordStrengthText.value = t('user.strength.strong')
        return
      }
      const strengthResult = InputValidator.validatePasswordStrength(newPassword)
      if (strengthResult.valid) {
        passwordStrengthType.value = strengthResult.strength === 'strong' ? 'success' : 'warning'
        passwordStrengthText.value =
          strengthResult.strength === 'strong'
            ? t('user.strength.strong')
            : t('user.strength.medium')
      } else {
        passwordStrengthType.value = 'danger'
        passwordStrengthText.value = t('user.strength.weak')
      }
    }
  )

  // 修改密码
  const handleChangePassword = async (): Promise<void> => {
    if (!passwordFormRef.value) return

    try {
      await passwordFormRef.value.validate(undefined)
      passwordChanging.value = true

      await handleResult(
        updatePassword({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword,
        }),
        {
          successMessage: t('user.messages.passwordChanged'),
          onSuccess: () => {
            showPasswordDialog.value = false
            passwordForm.oldPassword = ''
            passwordForm.newPassword = ''
            passwordForm.confirmPassword = ''
            lastPasswordChange.value = new Date().toLocaleString()
          },
        }
      )
    } catch (error: any) {
      handleError(error, { customMessage: t('user.messages.passwordChangeFailedRetry') })
    } finally {
      passwordChanging.value = false
    }
  }

  // ==================== 登录设备 ====================
  const loginDevices = ref<LoginDevice[]>([])
  const loginDevicesLoading = ref(false)

  // 加载登录设备
  const loadLoginDevices = async (): Promise<void> => {
    try {
      loginDevicesLoading.value = true
      const response = await getLoginDevices()
      if (response.code === 200 || response.success) {
        loginDevices.value = response.data || []
      }
    } catch (_error) {
      // 静默失败
    } finally {
      loginDevicesLoading.value = false
    }
  }

  // 移除设备
  const handleRemoveDevice = async (deviceId: string): Promise<void> => {
    const confirmed = await confirm(
      t('user.dialogs.removeDevice.confirm'),
      t('user.common.prompt'),
      { type: 'warning' }
    )
    if (!confirmed) return

    await handleResult(removeLoginDevice(deviceId), {
      successMessage: t('user.messages.deviceRemoved'),
      onSuccess: () => {
        void loadLoginDevices()
      },
    })
  }

  // ==================== 登录历史 ====================
  const loginHistory = ref<LoginHistory[]>([])
  const loginHistoryLoading = ref(false)
  const loginHistoryPagination = reactive({
    page: 1,
    pageSize: 20,
    total: 0,
  })

  // 加载登录历史
  const loadLoginHistory = async (): Promise<void> => {
    try {
      loginHistoryLoading.value = true
      const response = await getLoginHistory({
        page: loginHistoryPagination.page,
        pageSize: loginHistoryPagination.pageSize,
      })
      if (response.code === 200 || response.success) {
        loginHistory.value = response.data?.list || []
        loginHistoryPagination.total = response.data?.total || 0
      }
    } catch (_error) {
      // 静默失败
    } finally {
      loginHistoryLoading.value = false
    }
  }

  return {
    // 密码修改
    passwordFormRef,
    passwordForm,
    passwordRules,
    showPasswordDialog,
    passwordChanging,
    passwordStrengthType,
    passwordStrengthText,
    lastPasswordChange,
    handleChangePassword,

    // 登录设备
    loginDevices,
    loginDevicesLoading,
    loadLoginDevices,
    handleRemoveDevice,

    // 登录历史
    loginHistory,
    loginHistoryLoading,
    loginHistoryPagination,
    loadLoginHistory,
  }
}
