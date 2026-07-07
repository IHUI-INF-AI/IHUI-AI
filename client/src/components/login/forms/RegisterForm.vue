<template>
  <div class="register-form-container">
    <el-form
      id="register-form"
      :model="formData"
      :rules="formRules"
      ref="formRef"
      class="register-form"
      autocomplete="off"
      @submit.prevent="handleSubmit"
    >
      <el-form-item prop="username">
        <el-input
          id="register-username"
          name="register-username"
          v-model="formData.username"
          :placeholder="usernamePlaceholder"
          maxlength="50"
          clearable
          autocomplete="off"
          @input="handleUsernameInput"
        >
          <template #prefix>
            <UserIcon class="input-icon" />
          </template>
        </el-input>
      </el-form-item>

      <el-form-item prop="phone">
        <div class="phone-input-wrapper">
          <el-input
            id="register-phone"
            name="register-phone"
            v-model="formData.phone"
            :placeholder="phonePlaceholder"
            maxlength="11"
            clearable
            autocomplete="off"
            @input="handlePhoneInput"
          >
            <template #prefix>
              <PhoneIcon class="input-icon" />
            </template>
          </el-input>
          <el-button
            id="send-register-code-btn"
            :type="canSendCode ? 'primary' : 'default'"
            :disabled="!canSendCode || countdown > 0 || loading"
            :loading="sendingCode"
            class="send-code-btn"
            @click="handleSendCode"
          >
            {{ countdown > 0 ? `${countdown}s` : sendCodeText }}
          </el-button>
        </div>
      </el-form-item>

      <el-form-item prop="code">
        <div class="verification-code-block">
          <label class="verification-code-sr-label" for="register-code-0">
            {{ t('auth.captchaLabel') }}
          </label>
          <VerificationCodeInput
            v-model="formData.code"
            :length="6"
            input-id="register-code"
            :error-message="codeError"
            @complete="handleCodeComplete"
            @keyup.enter="handleSubmit"
          />
        </div>
      </el-form-item>

      <el-form-item prop="password">
        <el-input
          id="register-password"
          name="register-password"
          v-model="formData.password"
          :type="passwordVisible ? 'text' : 'password'"
          :placeholder="passwordPlaceholder"
          maxlength="20"
          clearable
          autocomplete="new-password"
          @input="handlePasswordInput"
        >
          <template #prefix>
            <LockIcon class="input-icon" />
          </template>
          <template #suffix>
            <label class="password-eye-container" :aria-label="passwordVisible ? t('login.password.hide') : t('login.password.show')" @click.stop>
              <input type="checkbox" :checked="passwordVisible" @change="togglePasswordVisibility" tabindex="-1" />
              <EyeIcon class="eye" />
              <EyeOffIcon class="eye-slash" />
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

      <el-form-item prop="confirmPassword">
        <el-input
          id="register-confirm-password"
          name="register-confirm-password"
          v-model="formData.confirmPassword"
          :type="confirmPasswordVisible ? 'text' : 'password'"
          :placeholder="confirmPasswordPlaceholder"
          maxlength="20"
          clearable
          autocomplete="new-password"
        >
          <template #prefix>
            <LockIcon class="input-icon" />
          </template>
          <template #suffix>
            <label class="password-eye-container" @click.stop>
              <input type="checkbox" :checked="confirmPasswordVisible" @change="toggleConfirmPasswordVisibility" tabindex="-1" />
              <EyeIcon class="eye" />
              <EyeOffIcon class="eye-slash" />
            </label>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item prop="agreement" class="agreement-item">
        <label class="custom-checkbox agreement-checkbox">
          <input id="register-agreement" name="register-agreement" type="checkbox" v-model="formData.agreement" />
          <span class="checkmark"></span>
          <span class="agreement-text">
            {{ t('auth.agreeTo') }}
            <a href="/terms" target="_blank" class="agreement-link">{{ t('auth.userAgreement') }}</a>
            {{ t('auth.and') }}
            <a href="/privacy" target="_blank" class="agreement-link">{{ t('auth.privacyPolicy') }}</a>
          </span>
        </label>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'
import {
  UserIcon,
  PhoneIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
} from '@/components/login/icons/login-icons'
import { InputValidator } from '@/utils/security'
import { sendVerificationCode } from '@/api/user'
import { ElMessage } from 'element-plus'
import { logger } from '@/utils/logger'
import { useCleanup } from '@/composables/useCleanup'
import VerificationCodeInput from '@/components/login/VerificationCodeInput.vue'

interface RegisterFormProps {
  loading?: boolean
}

interface RegisterFormEmits {
  submit: [data: { username: string; phone: string; code: string; password: string; confirmPassword: string; agreement: boolean }]
}

withDefaults(defineProps<RegisterFormProps>(), {
  loading: false,
})

const emit = defineEmits<RegisterFormEmits>()

const { t } = useI18n()
const cleanup = useCleanup()

const formRef = ref<FormInstance | undefined>(undefined)
const passwordVisible = ref(false)
const confirmPasswordVisible = ref(false)
const countdown = ref(0)
const sendingCode = ref(false)
const codeError = ref('')
let countdownTimer: ReturnType<typeof setInterval> | null = null

const formData = reactive({
  username: '',
  phone: '',
  code: '',
  password: '',
  confirmPassword: '',
  agreement: false,
})

const passwordStrength = reactive({
  show: false,
  level: 'weak' as 'weak' | 'medium' | 'strong',
  width: 0,
  text: '',
})

const canSendCode = computed(() => {
  const phone = formData.phone.trim()
  if (!phone) return false
  return /^1[3-9]\d{9}$/.test(phone)
})

const sendCodeText = computed(() => t('auth.sendCode'))
const usernamePlaceholder = computed(() => t('auth.usernamePlaceholder'))
const phonePlaceholder = computed(() => t('auth.phonePlaceholder'))
const codePlaceholder = computed(() => t('auth.codePlaceholder'))
const passwordPlaceholder = computed(() => t('auth.passwordHint'))
const confirmPasswordPlaceholder = computed(() => t('auth.confirmPasswordPlaceholder'))

const formRules = computed((): FormRules => ({
  username: [
    { required: true, message: t('auth.usernamePlaceholder'), trigger: 'blur' },
    { min: 3, max: 20, message: t('auth.usernameLengthError'), trigger: 'blur' },
  ],
  phone: [
    { required: true, message: t('auth.phonePlaceholder'), trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void): void => {
        if (!value) {
          callback()
          return
        }
        if (!/^1[3-9]\d{9}$/.test(value.trim())) {
          callback(new Error(t('auth.phoneFormatError')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  code: [
    { required: true, message: t('auth.codePlaceholder'), trigger: 'blur' },
  ],
  password: [
    { required: true, message: t('auth.passwordHint'), trigger: 'blur' },
    { min: 8, max: 20, message: t('auth.validation.passwordMinLength'), trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: t('auth.confirmPasswordPlaceholder'), trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void): void => {
        if (value && value !== formData.password) {
          callback(new Error(t('auth.passwordMismatch')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  agreement: [
    {
      validator: (_rule: unknown, value: boolean, callback: (error?: Error) => void): void => {
        if (!value) {
          callback(new Error(t('auth.confirmAgreement')))
          return
        }
        callback()
      },
      trigger: 'change',
    },
  ],
}))

const handleUsernameInput = (value: string): void => {
  const sanitized = value.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_]/g, '')
  if (sanitized !== value) {
    formData.username = sanitized
  }
}

const handlePhoneInput = (value: string): void => {
  const sanitized = value.replace(/[^\d]/g, '')
  if (sanitized !== value) {
    formData.phone = sanitized
  }
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

const togglePasswordVisibility = (): void => {
  passwordVisible.value = !passwordVisible.value
}

const toggleConfirmPasswordVisibility = (): void => {
  confirmPasswordVisible.value = !confirmPasswordVisible.value
}

const handleSendCode = async (): Promise<void> => {
  if (!canSendCode.value || countdown.value > 0) return

  try {
    await formRef.value?.validateField('phone')
  } catch {
    return
  }

  sendingCode.value = true

  try {
    await sendVerificationCode({
      type: 'phone',
      target: formData.phone.trim(),
    })

    ElMessage.success(t('auth.codeSentSuccess'))
    startCountdown()
  } catch (error: unknown) {
    logger.error('[RegisterForm] Failed to send verification code', error)
    ElMessage.error(error instanceof Error ? error.message : t('auth.codeSendFailed'))
  } finally {
    sendingCode.value = false
  }
}

const startCountdown = (): void => {
  countdown.value = 60
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
  countdownTimer = cleanup.addInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      if (countdownTimer) {
        clearInterval(countdownTimer)
        countdownTimer = null
      }
    }
  }, 1000)
}

const handleSubmit = async (): Promise<void> => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    emit('submit', { ...formData })
  } catch {
    logger.warn('[RegisterForm] Form validation failed')
  }
}

const handleCodeComplete = (value: string): void => {
  codeError.value = ''
  if (value.length === 6 && /^\d{6}$/.test(value)) {
    void handleSubmit()
  }
}

defineExpose({
  formRef,
  formData,
  validate: () => formRef.value?.validate(),
  resetFields: () => formRef.value?.resetFields(),
})
</script>

<style scoped lang="scss">
@use '../_login-tokens.scss' as lt;
@use '@/styles/_form-controls.scss' as fc;

.register-form-container {
  width: 100%;
}

.register-form {
  /* 2026-07-06 修复 v2: 之前 el-form-item { margin-bottom: 0 } 让注册表单 6 个输入框全部紧贴. */
  /* 改为 20px 间距让每个输入框有喘息空间, 最后一个 (agreement) 不需要底部间距. */
  .el-form-item {
    margin-bottom: 20px;

    &:last-child {
      margin-bottom: 0;
    }
  }
}

.phone-input-wrapper {
  display: flex;
  gap: 8px;
  width: 100%;

  .el-input {
    flex: 1;
  }
}

.send-code-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 96px;
  height: 28px;
  padding: 0 12px;
  background: transparent;
  border: 1px solid var(--border-unified-color);
  border-radius: var(--global-border-radius);
  color: var(--el-text-color-regular);
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  user-select: none;
  transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
  box-sizing: border-box;

  &:hover:not(.is-disabled):not(:disabled) {
    color: var(--el-color-primary);
    border-color: var(--el-color-primary);
    background-color: var(--el-color-primary-light-9);
  }

  &:active:not(.is-disabled):not(:disabled) {
    transform: translateY(0.5px);
  }

  &:focus-visible {
    outline: 1px solid var(--el-color-primary);
    outline-offset: 1px;
  }

  &.is-disabled,
  &:disabled {
    color: var(--el-text-color-placeholder);
    border-color: var(--el-border-color-lighter);
    background-color: transparent;
    cursor: not-allowed;
  }

  &.is-counting:not(.is-disabled):not(:disabled) {
    color: var(--el-text-color-secondary);
    border-color: var(--border-unified-color);
    cursor: default;
  }

  &__spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 1.5px solid var(--el-border-color);
    border-top-color: var(--el-color-primary);
    border-radius: 50%;
    animation: send-code-btn-spin 0.8s linear infinite;
  }
}

@keyframes send-code-btn-spin {
  to {
    transform: rotate(360deg);
  }
}

:where(html.dark) .send-code-btn {
  border-color: var(--border-unified-color);
  color: var(--el-text-color-regular);

  &:hover:not(.is-disabled):not(:disabled) {
    color: var(--el-color-primary-light-3);
    border-color: var(--el-color-primary-light-3);
    background-color: var(--el-color-primary-dark-2);
  }

  &.is-disabled,
  &:disabled {
    color: var(--el-text-color-placeholder);
    border-color: var(--el-border-color);
  }
}

.verification-code-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.verification-code-sr-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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
    color: var(--el-text-color-secondary);
    stroke: currentColor;
    transition: color 0.2s;
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
      color: var(--el-text-color-primary);
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

.agreement-item {
  margin-top: 12px;
}

.agreement-checkbox {
  /* 2026-07-06 v4 统一: 改用 _form-controls.scss 统一来源 */
  /* 18x18 大小 + 4px 方形小圆角 + 1.3s 缓慢变色 + 3D 旋转, 全项目唯一来源 */
  /* agreement 复选框左上对齐 (与多行协议文字顶部对齐), 其它与 base 一致 */
  @include fc.custom-checkbox-base;
  @include fc.custom-checkbox-dark;

  /* 协议复选框需要顶部对齐 (与多行协议文字第一行 baseline 对齐) */
  align-items: flex-start;

  .checkmark {
    margin-top: 2px;
  }
}

.agreement-text {
  font-size: 14px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.agreement-link {
  color: var(--el-text-color-primary);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}
</style>
