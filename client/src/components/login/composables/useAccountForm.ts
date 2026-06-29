/**
 * 账号表单逻辑组合函数
 */

import { ref, reactive, computed } from 'vue'
import type { FormInstance, FormRules, FormItemRule } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'

export function useAccountForm(isRegisterMode: boolean) {
  const { t } = useI18n()
  // 表单数据
  const formData = reactive({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    captcha: '',
  })

  // 表单状态
  const loading = ref(false)
  const passwordVisible = ref(false)

  // 表单验证规则
  const formRules = computed((): FormRules => {
    const rules: FormRules = {
      username: [
        { required: true, message: t('auth.pleaseEnterUsername'), trigger: 'blur' },
        { min: 3, max: 20, message: t('auth.usernameLength3to20'), trigger: 'blur' },
        {
          pattern: /^[a-zA-Z0-9_]+$/,
          message: t('auth.usernameOnlyAlphanumeric'),
          trigger: 'blur',
        },
      ],
      password: [
        { required: true, message: t('auth.pleaseEnterPassword'), trigger: 'blur' },
        { min: 6, max: 20, message: t('auth.passwordLength6to20'), trigger: 'blur' },
      ],
    }

    if (isRegisterMode) {
      rules.email = [
        { required: true, message: t('auth.pleaseEnterEmail'), trigger: 'blur' },
        { type: 'email', message: t('auth.pleaseEnterCorrectEmail'), trigger: 'blur' },
      ]

      rules.confirmPassword = [
        { required: true, message: t('auth.pleaseConfirmPassword'), trigger: 'blur' },
        {
          validator: (rule: FormItemRule, value: string, callback: (err?: Error) => void) => {
            if (value !== formData.password) {
              callback(new Error(t('auth.passwordsDoNotMatch')))
            } else {
              callback()
            }
          },
          trigger: 'blur',
        },
      ]

      rules.captcha = [
        { required: true, message: t('auth.pleaseEnterCaptcha'), trigger: 'blur' },
        { len: 4, message: t('auth.captcha4Digits'), trigger: 'blur' },
      ]
    }

    return rules
  })

  // 切换密码可见性
  const togglePasswordVisibility = () => {
    passwordVisible.value = !passwordVisible.value
  }

  // 密码输入处理
  const handlePasswordInput = (value: string) => {
    formData.password = value
    // 可以在这里添加密码强度检测逻辑
  }

  // 刷新验证码
  const refreshCaptcha = () => {
    formData.captcha = ''
    // 验证码刷新逻辑
  }

  // 表单验证
  const validateForm = async (formInstance?: FormInstance): Promise<boolean> => {
    if (!formInstance) return false

    try {
      await formInstance.validate()
      return true
    } catch (error) {
      logger.error('[AccountForm] Form validation failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  // 重置表单
  const resetForm = (formInstance?: FormInstance) => {
    if (formInstance) {
      formInstance.resetFields()
    }

    Object.keys(formData).forEach(key => {
      formData[key as keyof typeof formData] = ''
    })
  }

  return {
    formData,
    formRules,
    loading,
    passwordVisible,
    togglePasswordVisibility,
    handlePasswordInput,
    refreshCaptcha,
    validateForm,
    resetForm,
  }
}
