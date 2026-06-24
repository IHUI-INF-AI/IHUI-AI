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
            <el-icon class="input-icon">
              <User />
            </el-icon>
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
              <el-icon class="input-icon">
                <Phone />
              </el-icon>
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
        <el-input
          id="register-code"
          name="register-code"
          v-model="formData.code"
          :placeholder="codePlaceholder"
          maxlength="6"
          clearable
          autocomplete="one-time-code"
        >
          <template #prefix>
            <el-icon class="input-icon">
              <KeyRound />
            </el-icon>
          </template>
        </el-input>
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
            <el-icon class="input-icon">
              <Lock />
            </el-icon>
          </template>
          <template #suffix>
            <label class="password-eye-container" :aria-label="passwordVisible ? t('login.password.hide') : t('login.password.show')" @click.stop>
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
            <el-icon class="input-icon">
              <Lock />
            </el-icon>
          </template>
          <template #suffix>
            <label class="password-eye-container" @click.stop>
              <input type="checkbox" :checked="confirmPasswordVisible" @change="toggleConfirmPasswordVisibility" tabindex="-1" />
              <svg class="eye" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 576 512">
                <path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z" />
              </svg>
              <svg class="eye-slash" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 640 512">
                <path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zM223.1 149.5C248.6 126.2 282.7 112 320 112c79.5 0 144 64.5 144 144c0 24.9-6.3 48.3-17.4 68.7L408 294.5c8.4-19.3 10.6-41.4 4.8-63.3c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3c0 10.2-2.4 19.8-6.6 28.3l-90.3-70.8zM373 389.9c-16.4 6.5-34.3 10.1-53 10.1c-79.5 0-144-64.5-144-144c0-6.9 .5-13.6 1.4-20.2L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5L373 389.9z" />
              </svg>
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
import { User, Phone, Lock, KeyRound } from '@/lib/lucide-fallback'
import { InputValidator } from '@/utils/security'
import { sendVerificationCode } from '@/api/user'
import { ElMessage } from 'element-plus'
import { logger } from '@/utils/logger'
import { useCleanup } from '@/composables/useCleanup'

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
      validator: (_rule: any, value: string, callback: (error?: Error) => void): void => {
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
      validator: (_rule: any, value: string, callback: (error?: Error) => void): void => {
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
      validator: (_rule: any, value: boolean, callback: (error?: Error) => void): void => {
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
  } catch (error: any) {
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

defineExpose({
  formRef,
  formData,
  validate: () => formRef.value?.validate(),
  resetFields: () => formRef.value?.resetFields(),
})
</script>

<style scoped lang="scss">
.register-form-container {
  width: 100%;
}

.register-form {
  .el-form-item {
    margin-bottom: 0;
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
  min-width: 100px;
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

.agreement-item {
  margin-top: 12px;
}

.agreement-checkbox {
  display: flex;
  align-items: flex-start;
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
    margin-right: 8px;
    margin-top: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;
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

.agreement-text {
  font-size: 14px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.agreement-link {
  color: var(--el-color-primary);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}
</style>
