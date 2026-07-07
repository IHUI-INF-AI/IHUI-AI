/**
 * 手机号表单逻辑组合函数
 */

import { ref, reactive, computed } from 'vue'
import type { FormInstance, FormRules, FormItemRule } from 'element-plus'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { sendPhoneLoginCode, phoneLogin, type UserInfoData } from '@/api/user'
import { useAuthStore } from '@/stores/auth'
import { useCleanup } from '@/composables/useCleanup'
import { logger } from '@/utils/logger'
import { useI18n } from 'vue-i18n'

export interface PhoneFormData {
  phone: string
  countryCode: string
  smsCode: string
  password: string
  confirmPassword: string
  agreement: boolean
}

export function usePhoneForm(isRegisterMode: boolean) {
  const router = useRouter()
  const authStore = useAuthStore()
  const { t } = useI18n()
  const cleanup = useCleanup()

  // 表单引用
  const phoneFormRef = ref<FormInstance | undefined>(undefined)

  // 表单数据
  const formData = reactive<PhoneFormData>({
    phone: '',
    countryCode: '+86',
    smsCode: '',
    password: '',
    confirmPassword: '',
    agreement: false,
  })

  // 状态管理
  const loading = ref(false)
  const sendingSms = ref(false)
  const smsCountdown = ref(0)
  let countdownTimer: NodeJS.Timeout | null = null

  // 手机号验证规则
  const phoneValidator = (rule: FormItemRule, value: string, callback: (error?: Error) => void) => {
    if (!value) {
      callback(new Error(t('auth.pleaseEnterPhone')))
      return
    }

    if (formData.countryCode === '+86') {
      const phoneRegex = /^1[3-9]\d{9}$/
      if (!phoneRegex.test(value)) {
        callback(new Error(t('auth.pleaseEnterCorrectPhone')))
        return
      }
    }

    callback()
  }

  // 短信验证码验证规则
  const smsCodeValidator = (rule: FormItemRule, value: string, callback: (error?: Error) => void) => {
    if (!value) {
      callback(new Error(t('auth.pleaseEnterCode')))
      return
    }

    if (value.length !== 6) {
      callback(new Error(t('auth.codeMustBe6Digits')))
      return
    }

    if (!/^\d{6}$/.test(value)) {
      callback(new Error(t('auth.codeCanOnlyContainNumbers')))
      return
    }

    callback()
  }

  // 密码验证规则
  const passwordValidator = (rule: FormItemRule, value: string, callback: (error?: Error) => void) => {
    if (!isRegisterMode) {
      callback()
      return
    }

    if (!value) {
      callback(new Error(t('auth.pleaseEnterPassword')))
      return
    }

    if (value.length < 6) {
      callback(new Error(t('auth.passwordLengthMin6')))
      return
    }

    if (value.length > 20) {
      callback(new Error(t('auth.passwordLengthMax20')))
      return
    }

    const hasLetter = /[a-zA-Z]/.test(value)
    const hasNumber = /\d/.test(value)

    if (!hasLetter || !hasNumber) {
      callback(new Error(t('auth.passwordMustContainLetterAndNumber')))
      return
    }

    callback()
  }

  // 确认密码验证规则
  const confirmPasswordValidator = (rule: FormItemRule, value: string, callback: (error?: Error) => void) => {
    if (!isRegisterMode) {
      callback()
      return
    }

    if (!value) {
      callback(new Error(t('auth.pleaseConfirmPassword')))
      return
    }

    if (value !== formData.password) {
      callback(new Error(t('auth.passwordsDoNotMatch')))
      return
    }

    callback()
  }

  // 用户协议验证规则
  const agreementValidator = (rule: FormItemRule, value: boolean, callback: (error?: Error) => void) => {
    if (!isRegisterMode) {
      callback()
      return
    }

    if (!value) {
      callback(new Error(t('auth.pleaseAgreeToUserAgreement')))
      return
    }

    callback()
  }

  // 表单验证规则
  const formRules = computed((): FormRules => {
    const rules: FormRules = {
      phone: [{ validator: phoneValidator, trigger: 'blur' }],
      smsCode: [{ validator: smsCodeValidator, trigger: 'blur' }],
    }

    if (isRegisterMode) {
      rules.password = [{ validator: passwordValidator, trigger: 'blur' }]
      rules.confirmPassword = [{ validator: confirmPasswordValidator, trigger: 'blur' }]
      rules.agreement = [{ validator: agreementValidator, trigger: 'change' }]
    }

    return rules
  })

  // 计算属性
  const canSendSms = computed(() => {
    const phoneValid = /^1[3-9]\d{9}$/.test(formData.phone)
    return phoneValid && smsCountdown.value === 0 && !sendingSms.value
  })

  const smsButtonText = computed(() => {
    if (smsCountdown.value > 0) {
      return `${smsCountdown.value}秒后重试`
    }
    return '发送验证码'
  })

  const isFormValid = computed(() => {
    if (!formData.phone || !formData.smsCode) {
      return false
    }
    if (isRegisterMode) {
      return formData.password && formData.confirmPassword && formData.agreement
    }
    return true
  })

  // 手机号输入处理
  const handlePhoneInput = (value: string) => {
    // 只允许输入数字
    formData.phone = value.replace(/\D/g, '')
  }

  // 发送短信验证码
  const sendSmsCode = async () => {
    if (!canSendSms.value) return

    // 先验证手机号
    if (!phoneFormRef.value) return

    try {
      await phoneFormRef.value.validateField('phone')
    } catch (_error) {
      return
    }

    sendingSms.value = true

    try {
      logger.info('[PhoneForm] Starting to send SMS verification code', {
        phone: formData.phone,
        countryCode: formData.countryCode,
      })

      // 调用发送短信验证码的API - 使用生产环境API
      // 根据注册/登录模式传递对应的模板ID：1-登录，2-注册
      const tempId = isRegisterMode ? 2 : 1 // 注册模式=2，登录模式=1
      const response = await sendPhoneLoginCode(formData.phone, tempId)

      logger.info('[PhoneForm] SMS verification code response', {
        code: response.code,
        message: response.message,
      })

      if (response.success) {
        ElMessage.success(t('auth.smsCodeSent'))

        // 开始倒计时
        smsCountdown.value = 60
        countdownTimer = cleanup.addInterval(() => {
          smsCountdown.value--
          if (smsCountdown.value <= 0) {
            if (countdownTimer) {
              clearInterval(countdownTimer)
              countdownTimer = null
            }
          }
        }, 1000)
      } else {
        ElMessage.error(response.message || t('auth.sendSmsCodeFailed'))
      }
    } catch (error) {
      logger.error('[PhoneForm] Failed to send verification code', {
        error: error instanceof Error ? error.message : String(error),
        phone: formData.phone,
      })

      ElMessage.error(error instanceof Error ? error.message : t('auth.sendSmsCodeFailed'))
    } finally {
      sendingSms.value = false
    }
  }

  // 密码输入处理
  const handlePasswordInput = (value: string) => {
    formData.password = value
  }

  // 表单验证
  const validateForm = async (): Promise<boolean> => {
    if (!phoneFormRef.value) return false

    try {
      await phoneFormRef.value.validate()
      return true
    } catch (error) {
      logger.error('[PhoneForm] Form validation failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  // 手机号登录
  const handlePhoneLogin = async () => {
    const isValid = await validateForm()
    if (!isValid) return

    loading.value = true

    try {
      logger.info('[PhoneForm] Starting phone number login', {
        phone: formData.phone,
        countryCode: formData.countryCode,
      })

      const response = await phoneLogin({
        phone: formData.phone,
        code: formData.smsCode,
      })

      logger.info('[PhoneForm] Phone number login response', {
        code: response.code,
        message: response.message,
      })

      if (response.success) {
        const responseData = response.data

        if (typeof responseData === 'object' && responseData !== null) {
          // 2026-07-06 修复: 后端 /auth/login/sms 返回 accessToken / access_token (非 token)
          const responseDataObj = responseData as Record<string, unknown>
          const tokenValue =
            (responseDataObj.accessToken as string) ||
            (responseDataObj.access_token as string) ||
            (responseDataObj.token as string) ||
            ''
          const refreshTokenValue =
            (responseDataObj.refreshToken as string) ||
            (responseDataObj.refresh_token as string) ||
            ''
          const userInfo = (responseDataObj.user as UserInfoData) || undefined

          if (tokenValue) {
            await authStore.thirdPartyLogin({
              token: tokenValue,
              refreshToken: refreshTokenValue || undefined,
              user: userInfo || {
                id: '',
                uuid: '',
                username: formData.phone,
                email: '',
                phone: formData.phone,
                nickname: '',
                avatar: '',
                gender: 0,
                birthday: '',
                signature: '',
                status: 1,
                isVip: false,
                inviteCode: '',
                createTime: new Date().toISOString(),
                updateTime: new Date().toISOString(),
              },
              loginType: 'phone',
            })

            ElMessage.success(t('common.messages.loginSuccess'))

            void router.push('/')
          } else {
            ElMessage.error(t('auth.loginFailedNoToken'))
          }
        } else {
          ElMessage.error(t('auth.loginFailedInvalidResponse'))
        }
      } else {
        ElMessage.error(response.message || t('auth.loginFailed'))
      }
    } catch (error) {
      logger.error('[PhoneForm] Phone number login failed', {
        error: error instanceof Error ? error.message : String(error),
        phone: formData.phone,
      })

      ElMessage.error(error instanceof Error ? error.message : t('auth.loginFailed'))
    } finally {
      loading.value = false
    }
  }

  // 重置表单
  const resetForm = () => {
    if (phoneFormRef.value) {
      phoneFormRef.value.resetFields()
    }

    formData.phone = ''
    formData.countryCode = '+86'
    formData.smsCode = ''
    formData.password = ''
    formData.confirmPassword = ''
    formData.agreement = false

    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
    smsCountdown.value = 0
    sendingSms.value = false
  }

  return {
    phoneFormRef,
    formData,
    formRules,
    loading,
    sendingSms,
    smsCountdown,
    canSendSms,
    smsButtonText,
    isFormValid,
    handlePhoneInput,
    sendSmsCode,
    handlePasswordInput,
    validateForm,
    handlePhoneLogin,
    resetForm,
  }
}
