<template>
  <div class="account-form-container">
    <el-form
      id="account-login-form"
      :model="formData"
      :rules="formRules"
      ref="formRef"
      class="login-form"
      autocomplete="on"
      @submit.prevent="handleSubmit"
    >
      <el-form-item prop="username" class="username-form-item">
        <div class="username-input-wrapper">
          <el-input
            id="account-username"
            name="account-username"
            v-model="formData.username"
            :placeholder="placeholder"
            maxlength="50"
            clearable
            autocomplete="username"
            @input="handleUsernameInput"
            @focus="handleUsernameFocus"
            @blur="handleUsernameBlur"
            @dblclick="handleUsernameDoubleClick"
          >
            <template #prefix>
              <el-icon class="input-icon">
                <User />
              </el-icon>
            </template>
          </el-input>
          <div v-if="showHistoryAccounts && filteredHistoryAccounts.length > 0" class="history-dropdown" @mousedown.prevent>
            <div v-for="account in filteredHistoryAccounts" :key="account" class="history-item" @click="selectHistoryAccount(account)">
              <el-icon class="history-icon">
                <Clock />
              </el-icon>
              <span>{{ account }}</span>
            </div>
          </div>
        </div>
      </el-form-item>

      <el-form-item prop="password">
        <el-input
          id="account-password"
          name="account-password"
          v-model="formData.password"
          :type="passwordVisible ? 'text' : 'password'"
          :placeholder="passwordPlaceholder"
          maxlength="20"
          clearable
          :autocomplete="'current-password'"
          @input="handlePasswordInput"
          @keyup.enter="handleSubmit"
        >
          <template #prefix>
            <el-icon class="input-icon">
              <Lock />
            </el-icon>
          </template>
          <template #suffix>
            <label class="password-eye-container" @click.stop>
              <input type="checkbox" :checked="passwordVisible" @change="togglePasswordVisibility" tabindex="-1" />
              <svg class="eye" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 576 512">
                <path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z" />
              </svg>
              <svg class="eye-slash" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 640 512">
                <path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zM223.1 149.5C248.6 126.2 282.7 112 320 112c79.5 0 144 64.5 144 144c0 24.9-6.3 48.3-17.4 68.7L408 294.5c8.4-19.3 10.6-41.4 4.8-63.3c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3c0 10.2-2.4 19.8-6.6 28.3l-90.3-70.8zM373 389.9c-16.4 6.5-34.3 10.1-53 10.1c-79.5 0-144-64.5-144-144c0-6.9 .5-13.6 1.4-20.2L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5L373 389.9z" />
              </svg>
            </label>
          </template>
        </el-input>
        <div v-if="passwordStrength.show" class="password-strength-indicator">
          <div class="strength-bar">
            <div class="strength-fill" :class="passwordStrength.level" :style="{ width: passwordStrength.width + '%' }"></div>
          </div>
          <span class="strength-text" :class="passwordStrength.level">{{ passwordStrength.text }}</span>
        </div>
      </el-form-item>

      <el-form-item v-if="showCaptcha" prop="captcha">
        <CaptchaInput id="account-captcha" v-model="formData.captcha" @refresh="handleCaptchaRefresh" />
      </el-form-item>

      <el-row class="form-actions-row">
        <el-col :span="12">
          <label class="custom-checkbox">
            <input id="account-remember-me" name="account-remember-me" type="checkbox" v-model="formData.rememberMe" />
            <span class="checkmark"></span>
            <span class="remember-me-text">{{ t('auth.autoLogin') }}</span>
          </label>
        </el-col>
        <el-col :span="12" class="text-right account-form-actions">
          <span class="switch-to-sso-link" @click="handleSSOClick">
            {{ ssoLinkText }}
          </span>
          <span v-if="showPhoneLoginLink" class="switch-to-phone-link" @click="emit('switch-tab', 'phone')">
            {{ t('auth.phoneLogin') }}
          </span>
          <span class="forgot-password" @click="emit('forgot-password')">
            {{ t('auth.forgotPassword') }}
          </span>
        </el-col>
      </el-row>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'
import { User, Lock, Clock } from '@/lib/lucide-fallback'
import CaptchaInput from '../components/CaptchaInput.vue'
import { FormValidator } from '@/utils/formValidation'
import { InputValidator } from '@/utils/security'
import { StorageManager } from '@/utils/storage'
import { logger } from '@/utils/logger'

interface AccountFormProps {
  isDarkMode?: boolean
  showCaptcha?: boolean
  isEnterpriseMode?: boolean
  placeholder?: string
  passwordPlaceholder?: string
}

interface AccountFormEmits {
  submit: [data: { username: string; password: string; rememberMe: boolean; captcha: string }]
  'switch-tab': [tab: 'account' | 'phone']
  'forgot-password': []
  'sso-click': []
}

const props = withDefaults(defineProps<AccountFormProps>(), {
  isDarkMode: false,
  showCaptcha: false,
  isEnterpriseMode: false,
  placeholder: '',
  passwordPlaceholder: '',
})

const emit = defineEmits<AccountFormEmits>()

const { t } = useI18n()

const formRef = ref<FormInstance | undefined>(undefined)
const passwordVisible = ref(false)

const formData = reactive({
  username: '',
  password: '',
  rememberMe: false,
  captcha: '',
})

const passwordStrength = reactive({
  show: false,
  level: 'weak' as 'weak' | 'medium' | 'strong',
  width: 0,
  text: '',
})

const HISTORY_ACCOUNT_KEY = 'login_history_accounts'
const historyAccounts = ref<string[]>([])
const showHistoryAccounts = ref(false)
const historyAccountQuery = ref('')

const getHistoryAccounts = (): string[] => {
  try {
    const history = StorageManager.getItem<string[]>(HISTORY_ACCOUNT_KEY)
    return Array.isArray(history) ? history : []
  } catch {
    return []
  }
}

const initHistoryAccounts = (): void => {
  historyAccounts.value = getHistoryAccounts()
}

const filteredHistoryAccounts = computed(() => {
  if (!historyAccountQuery.value) {
    return historyAccounts.value
  }
  return historyAccounts.value.filter((account: string) =>
    account.toLowerCase().includes(historyAccountQuery.value.toLowerCase())
  )
})

const selectHistoryAccount = (account: string): void => {
  formData.username = account
  showHistoryAccounts.value = false
  historyAccountQuery.value = ''
  formRef.value?.focus?.()
}

const handleUsernameInput = (val: string): void => {
  historyAccountQuery.value = val || ''
  showHistoryAccounts.value = historyAccounts.value.length > 0 && (val === '' || filteredHistoryAccounts.value.length > 0)
}

const handleUsernameFocus = (): void => {
  initHistoryAccounts()
  showHistoryAccounts.value = historyAccounts.value.length > 0
  historyAccountQuery.value = formData.username || ''
}

const handleUsernameBlur = (_evt?: FocusEvent): void => {
  window.setTimeout(() => {
    const relatedTarget = _evt?.relatedTarget as HTMLElement | null
    if (relatedTarget && relatedTarget.closest('.history-dropdown')) {
      return
    }
    showHistoryAccounts.value = false
  }, 200)
}

const handleUsernameDoubleClick = (): void => {
  initHistoryAccounts()
  if (historyAccounts.value.length > 0) {
    showHistoryAccounts.value = true
    historyAccountQuery.value = ''
    nextTick(() => {
      const inputElement = document.getElementById('account-username')
      if (inputElement) {
        inputElement.focus()
      }
    })
  } else {
    showHistoryAccounts.value = false
  }
}

const formRules = computed((): FormRules => ({
  username: [
    { required: true, message: t('auth.usernameOrPhoneOrEmail'), trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void): void => {
        if (!value) {
          callback()
          return
        }
        if (FormValidator.containsXSS(value)) {
          callback(new Error(t('auth.validation.unsafeChars')))
          return
        }
        const sanitized = FormValidator.sanitizeInput(value)
        if (sanitized !== value) {
          formData.username = sanitized
        }
        const isUsername = /^[a-zA-Z0-9_\u4e00-\u9fa5]{3,20}$/.test(value)
        const isPhone = InputValidator.isValidPhone(value)
        const isEmail = InputValidator.isValidEmail(value)
        if (!isUsername && !isPhone && !isEmail) {
          callback(new Error(t('auth.validation.invalidUsernameOrPhoneOrEmail')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  password: [
    { required: true, message: t('auth.validation.passwordRequired'), trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void): void => {
        if (!value) {
          callback()
          return
        }
        if (FormValidator.containsXSS(value)) {
          callback(new Error(t('auth.validation.passwordUnsafeChars')))
          return
        }
        if (value.length < 8) {
          callback(new Error(t('auth.validation.passwordMinLength')))
          return
        }
        if (value.length > 20) {
          callback(new Error(t('auth.validation.passwordMaxLength')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  captcha: [
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void): void => {
        if (!props.showCaptcha) {
          callback()
          return
        }
        const v = (value ?? '').trim()
        if (!v) {
          callback(new Error(t('auth.captchaPlaceholder')))
          return
        }
        if (!/^[a-zA-Z0-9]{1,6}$/.test(v)) {
          callback(new Error(t('auth.imageCaptchaFormatError')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
}))

const togglePasswordVisibility = (): void => {
  passwordVisible.value = !passwordVisible.value
}

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

const handleCaptchaRefresh = (uuid: string): void => {
  logger.debug('[AccountLoginForm] Captcha refresh', { uuid })
}

const handleSubmit = async (): Promise<void> => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    emit('submit', { ...formData })
  } catch {
    logger.warn('[AccountLoginForm] Form validation failed')
  }
}

const handleSSOClick = (): void => {
  emit('sso-click')
}

const ssoLinkText = computed(() => {
  return props.isEnterpriseMode ? t('auth.userLogin') : t('auth.ssoLogin')
})

const showPhoneLoginLink = computed(() => !props.isEnterpriseMode)

const placeholder = computed(() => props.placeholder || t('auth.usernameOrPhoneOrEmail'))
const passwordPlaceholder = computed(() => props.passwordPlaceholder || t('auth.passwordHint'))

defineExpose({
  formRef,
  formData,
  validate: () => formRef.value?.validate(),
  resetFields: () => formRef.value?.resetFields(),
})
</script>

<style scoped lang="scss">
.account-form-container {
  width: 100%;
}

.login-form {
  .el-form-item {
    margin-bottom: 0;
  }
}

.username-input-wrapper {
  position: relative;
  width: 100%;
}

.history-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  z-index: var(--z-header);
  max-height: 200px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--el-fill-color-light);
  }

  .history-icon {
    color: var(--el-text-color-secondary);
  }
}

.password-eye-container {
  cursor: pointer;
  display: flex;
  align-items: center;

  input {
    display: none;
  }

  .eye,
  .eye-slash {
    width: 20px;
    height: 20px;
    fill: var(--el-text-color-secondary);
    transition: fill 0.2s;
  }

  input:checked ~ .eye {
    display: none;
  }

  input:not(:checked) ~ .eye-slash {
    display: none;
  }

  &:hover {
    .eye,
    .eye-slash {
      fill: var(--el-color-primary);
    }
  }
}

.password-strength-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.strength-bar {
  flex: 1;
  height: 4px;
  background-color: var(--el-fill-color);
  border-radius: var(--global-border-radius);
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  transition: width 0.3s ease;

  &.weak {
    background-color: var(--el-color-danger);
  }

  &.medium {
    background-color: var(--el-color-warning);
  }

  &.strong {
    background-color: var(--el-color-success);
  }
}

.strength-text {
  font-size: 12px;

  &.weak {
    color: var(--el-color-danger);
  }

  &.medium {
    color: var(--el-color-warning);
  }

  &.strong {
    color: var(--el-color-success);
  }
}

.form-actions-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}

.custom-checkbox {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;

  input {
    display: none;
  }

  .checkmark {
    width: 18px;
    height: 18px;
    border: 2px solid var(--el-border-color);
    border-radius: var(--global-border-radius);
    margin-right: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  input:checked + .checkmark {
    background-color: var(--el-color-primary);
    border: var(--el-border-width-primary) solid var(--el-color-primary);
  }

  input:checked + .checkmark::after {
    content: "\2713";
    color: var(--el-bg-color);
    font-size: 12px;
  }
}

.remember-me-text {
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.account-form-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

.switch-to-sso-link,
.switch-to-phone-link,
.forgot-password {
  color: var(--el-text-color-placeholder);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.2s;

  &:hover {
    color: var(--el-text-color-secondary);
  }
}

.text-right {
  text-align: right;
}
</style>
