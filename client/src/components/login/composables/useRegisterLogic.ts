/**
 * 注册逻辑组合函数
 * 提取自 UniversalLogin.vue，负责账号密码注册的核心逻辑
 */

import { ref, reactive, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { register } from '@/api/auth'
import { unifiedRegister, isValidSource, type LoginSource } from '@/api/unified-auth'
import { FormValidator } from '@/utils/formValidation'
import { InputValidator } from '@/utils/security'
import { logger } from '@/utils/logger'
import { useCleanup } from '@/composables/useCleanup'
import { useLoginDialog } from '@/composables/useLoginDialog'

export interface RegisterFormData {
  username: string
  password: string
  confirmPassword: string
  email: string
  phone: string
  code: string
  captcha: string
  agreement: boolean
}

export interface RegisterLogicOptions {
  captchaKey: Ref<string>
}

export function useRegisterLogic(options: RegisterLogicOptions) {
  const { captchaKey } = options
  const route = useRoute()
  const { t } = useI18n()
  const cleanup = useCleanup()

  const loading = ref(false)
  const registerCodeCountdown = ref(0)
  let registerCodeCountdownTimer: ReturnType<typeof setInterval> | null = null

  const formData = reactive<RegisterFormData>({
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
    phone: '',
    code: '',
    captcha: '',
    agreement: false,
  })

  const passwordStrength = reactive({
    show: false,
    level: 'weak' as 'weak' | 'medium' | 'strong',
    width: 0,
    text: '',
  })

  const handlePasswordInput = (value: string): void => {
    if (!value) {
      passwordStrength.show = false
      return
    }

    passwordStrength.show = true
    const strengthResult = InputValidator.validatePasswordStrength(value)
    passwordStrength.level = strengthResult.strength

    switch (strengthResult.strength) {
      case 'weak':
        passwordStrength.width = 33
        passwordStrength.text = t('auth.passwordStrengthWeakText')
        break
      case 'medium':
        passwordStrength.width = 66
        passwordStrength.text = t('auth.passwordStrengthMediumText')
        break
      case 'strong':
        passwordStrength.width = 100
        passwordStrength.text = t('auth.passwordStrengthStrongText')
        break
    }
  }

  const sendRegisterCode = async (): Promise<boolean> => {
    if (!formData.phone) {
      ElMessage.warning(t('auth.phonePlaceholder'))
      return false
    }

    if (!InputValidator.isValidPhone(formData.phone)) {
      ElMessage.warning(t('auth.phoneFormatError'))
      return false
    }

    try {
      const { sendVerificationCode } = await import('@/api/user')
      await sendVerificationCode({
        type: 'phone',
        target: formData.phone,
      })
      ElMessage.success(t('auth.codeSentSuccess'))

      registerCodeCountdown.value = 60
      if (registerCodeCountdownTimer) {
        clearInterval(registerCodeCountdownTimer)
      }
      registerCodeCountdownTimer = cleanup.addInterval(() => {
        registerCodeCountdown.value--
        if (registerCodeCountdown.value <= 0) {
          if (registerCodeCountdownTimer) {
            clearInterval(registerCodeCountdownTimer)
            registerCodeCountdownTimer = null
          }
        }
      }, 1000)
      return true
    } catch (error: unknown) {
      ElMessage.error((error instanceof Error ? error.message : String(error)) || t('auth.codeSendFailed'))
      return false
    }
  }

  const handleAccountRegister = async (
    projectSource?: string
  ): Promise<{ success: boolean; token?: string; refreshToken?: string; userInfo?: Record<string, unknown> }> => {
    if (!formData.username || !formData.password) {
      ElMessage.warning(t('auth.pleaseCompleteAllFields'))
      return { success: false }
    }

    if (!formData.agreement) {
      ElMessage.warning(t('auth.confirmAgreement'))
      return { success: false }
    }

    if (formData.password !== formData.confirmPassword) {
      ElMessage.error(t('auth.passwordMismatch'))
      return { success: false }
    }

    loading.value = true

    try {
      const username = FormValidator.sanitizeInput(formData.username)
      const password = formData.password
      const email = formData.email || `${username}@example.com`

      const selectedSource = projectSource
      const urlSource = route.query.source as string
      const currentRegisterSource: LoginSource = isValidSource(selectedSource || '')
        ? (selectedSource as LoginSource)
        : isValidSource(urlSource || '')
          ? (urlSource as LoginSource)
          : 'main'

      if (import.meta.env.DEV) {
        logger.info('[handleAccountRegister] Registration source:', currentRegisterSource)
      }

      const response = await unifiedRegister(currentRegisterSource, {
        username,
        password,
        email,
        phone: formData.phone,
        code: formData.code,
        captcha: formData.captcha,
        uuid: captchaKey.value,
        inviteCode: undefined,
      })

      if (!response.success) {
        throw new Error(response.message || t('auth.registerFailed'))
      }

      if (response.code === 200 || response.success) {
        const registerData = response.data

        let token: string = ''
        let refreshTokenValue: string = ''
        let userInfo: Record<string, unknown> | null | undefined = null

        if (registerData && typeof registerData === 'object') {
          const registerDataObj = registerData as {
            token?: string
            accessToken?: string
            access_token?: string
            refreshToken?: string
            refresh_token?: string
            user?: Record<string, unknown>
            userInfo?: Record<string, unknown>
          }
          token = registerDataObj.token || registerDataObj.accessToken || registerDataObj.access_token || ''
          refreshTokenValue = registerDataObj.refreshToken || registerDataObj.refresh_token || ''
          userInfo = registerDataObj.user || registerDataObj.userInfo
        }

        if (token) {
          return { success: true, token, refreshToken: refreshTokenValue, userInfo: userInfo ?? undefined }
        }

        ElMessage.success(t('auth.registerSuccess'))
        // 注册成功但无 token：切换到登录模式（弹窗内切换，不跳路由）
        useLoginDialog().switchToLogin()
        return { success: true }
      }

      return { success: false }
    } catch (error: unknown) {
      logger.error(
        t('auth.registerFailed'),
        error instanceof Error ? error : new Error(String(error))
      )
      ElMessage.error(error instanceof Error ? error.message : t('auth.registerFailedRetry'))
      return { success: false }
    } finally {
      loading.value = false
    }
  }

  const handleSetEmailPasswordRegister = async (
    account: string,
    email: string,
    password: string,
    confirmPassword: string
  ): Promise<{ success: boolean; token?: string; refreshToken?: string; userInfo?: Record<string, unknown> }> => {
    if (!account) {
      ElMessage.error(t('auth.usernameOrPhoneOrEmail'))
      return { success: false }
    }

    loading.value = true
    try {
      const registerResponse = await register({
        username: account,
        email: email.trim(),
        password,
        confirmPassword,
      })
      const raw = registerResponse as unknown as Record<string, unknown> // 双重断言必要: AuthResponse 类型声明缺少 code/data/msg/token 等运行时字段
      const code = (raw?.code as number | string) ?? 0
      const data = raw?.data as Record<string, unknown> | undefined
      const isSuccess = (code === 200 || code === '200' || raw?.success === true) && (data || raw?.token)
      if (!isSuccess) {
        const msg = (raw?.message ?? raw?.msg ?? t('auth.registerFailed')) as string
        ElMessage.error(msg)
        return { success: false }
      }

      let token = ''
      let refreshTokenValue = ''
      let userInfo: Record<string, unknown> | undefined

      if (data && typeof data === 'object') {
        const thirdPartyAccounts = data.thirdPartyAccounts as Record<string, unknown> | undefined
        token =
          (thirdPartyAccounts?.accessToken as string) ||
          (data.accessToken as string) ||
          (data.token as string) ||
          ''
        refreshTokenValue = (thirdPartyAccounts?.refreshToken as string) || (data.refreshToken as string) || ''
        userInfo = (data.user as Record<string, unknown>) || data as Record<string, unknown>
      } else {
        token = (raw.token as string) || (raw.accessToken as string) || ''
        refreshTokenValue = (raw.refreshToken as string) || ''
        userInfo = (raw.user as Record<string, unknown>) || undefined
      }

      if (!token) {
        ElMessage.error(t('auth.registerResponseMissingToken'))
        return { success: false }
      }

      return { success: true, token, refreshToken: refreshTokenValue, userInfo }
    } catch (err) {
      logger.error('[handleSetEmailPasswordRegister] Registration failed', err)
      ElMessage.error(err instanceof Error ? err.message : t('auth.registerFailed'))
      return { success: false }
    } finally {
      loading.value = false
    }
  }

  const resetForm = (): void => {
    formData.username = ''
    formData.password = ''
    formData.confirmPassword = ''
    formData.email = ''
    formData.phone = ''
    formData.code = ''
    formData.captcha = ''
    formData.agreement = false
    passwordStrength.show = false
    passwordStrength.level = 'weak'
    passwordStrength.width = 0
    passwordStrength.text = ''
  }

  return {
    formData,
    loading,
    passwordStrength,
    registerCodeCountdown,
    handlePasswordInput,
    sendRegisterCode,
    handleAccountRegister,
    handleSetEmailPasswordRegister,
    resetForm,
  }
}
