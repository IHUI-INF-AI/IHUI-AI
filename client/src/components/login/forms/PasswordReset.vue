<template>
  <div class="password-reset-container">
    <el-form
      id="password-reset-form"
      :model="formData"
      :rules="formRules"
      ref="formRef"
      class="reset-form"
      autocomplete="off"
      @submit.prevent="handleSubmit"
    >
      <div v-if="step === 1" class="step-content">
        <el-form-item prop="phone">
          <div class="phone-input-wrapper">
            <el-input
              id="reset-phone"
              name="reset-phone"
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
              id="send-reset-code-btn"
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
            id="reset-code"
            name="reset-code"
            v-model="formData.code"
            :placeholder="codePlaceholder"
            maxlength="6"
            clearable
            autocomplete="one-time-code"
          >
            <template #prefix>
              <KeyRoundIcon class="input-icon" />
            </template>
          </el-input>
        </el-form-item>
      </div>

      <div v-if="step === 2" class="step-content">
        <el-form-item prop="newPassword">
          <el-input
            id="reset-new-password"
            name="reset-new-password"
            v-model="formData.newPassword"
            :type="passwordVisible ? 'text' : 'password'"
            :placeholder="newPasswordPlaceholder"
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
            id="reset-confirm-password"
            name="reset-confirm-password"
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
      </div>

      <div class="form-actions">
        <el-button type="default" class="back-btn" @click="handleBack">
          {{ backText }}
        </el-button>
        <el-button
          type="primary"
          class="submit-btn"
          :loading="loading"
          @click="handleSubmit"
        >
          {{ submitText }}
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules, FormItemRule } from 'element-plus'
import { PhoneIcon, LockIcon, KeyRoundIcon, EyeIcon, EyeOffIcon } from '@/components/login/icons/login-icons'
import { InputValidator } from '@/utils/security'
import { sendVerificationCode } from '@/api/user'
import { ElMessage } from 'element-plus'
import { logger } from '@/utils/logger'
import { useCleanup } from '@/composables/useCleanup'

interface PasswordResetProps {
  loading?: boolean
}

interface PasswordResetEmits {
  submit: [data: { phone: string; code: string; newPassword: string }]
  back: []
}

withDefaults(defineProps<PasswordResetProps>(), {
  loading: false,
})

const emit = defineEmits<PasswordResetEmits>()

const { t } = useI18n()
const cleanup = useCleanup()

const formRef = ref<FormInstance | undefined>(undefined)
const step = ref(1)
const passwordVisible = ref(false)
const confirmPasswordVisible = ref(false)
const countdown = ref(0)
const sendingCode = ref(false)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const formData = reactive({
  phone: '',
  code: '',
  newPassword: '',
  confirmPassword: '',
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
const phonePlaceholder = computed(() => t('auth.phonePlaceholder'))
const codePlaceholder = computed(() => t('auth.codePlaceholder'))
const newPasswordPlaceholder = computed(() => t('auth.newPasswordPlaceholder'))
const confirmPasswordPlaceholder = computed(() => t('auth.confirmPasswordPlaceholder'))
const backText = computed(() => step.value === 1 ? t('auth.backToLogin') : t('auth.previousStep'))
const submitText = computed(() => step.value === 1 ? t('auth.nextStep') : t('auth.resetPasswordSubmit'))

const formRules = computed((): FormRules => ({
  phone: [
    { required: true, message: t('auth.phonePlaceholder'), trigger: 'blur' },
    {
      validator: (_rule: FormItemRule, value: string, callback: (error?: Error) => void): void => {
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
  newPassword: [
    { required: true, message: t('auth.newPasswordPlaceholder'), trigger: 'blur' },
    { min: 8, max: 20, message: t('auth.validation.passwordMinLength'), trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: t('auth.confirmPasswordPlaceholder'), trigger: 'blur' },
    {
      validator: (_rule: FormItemRule, value: string, callback: (error?: Error) => void): void => {
        if (value && value !== formData.newPassword) {
          callback(new Error(t('auth.passwordMismatch')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
}))

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
    logger.error('[PasswordReset] Failed to send verification code', error)
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
    if (step.value === 1) {
      await formRef.value.validateField(['phone', 'code'])
      step.value = 2
    } else {
      await formRef.value.validateField(['newPassword', 'confirmPassword'])
      emit('submit', {
        phone: formData.phone.trim(),
        code: formData.code.trim(),
        newPassword: formData.newPassword,
      })
    }
  } catch {
    logger.warn('[PasswordReset] Form validation failed')
  }
}

const handleBack = (): void => {
  if (step.value === 1) {
    emit('back')
  } else {
    formData.newPassword = ''
    formData.confirmPassword = ''
    passwordStrength.show = false
    passwordStrength.width = 0
    passwordStrength.text = ''
    formRef.value?.clearValidate(['newPassword', 'confirmPassword'])
    step.value = 1
  }
}

defineExpose({
  formRef,
  formData,
  validate: () => formRef.value?.validate(),
  resetFields: () => {
    formRef.value?.resetFields()
    step.value = 1
  },
})
</script>

<style scoped lang="scss">
.password-reset-container {
  width: 100%;
}

.reset-form {
  .el-form-item {
    margin-bottom: 0;
  }
}

.step-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
      color: var(--el-color-primary);
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

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.back-btn {
  flex: 1;
}

.submit-btn {
  flex: 2;
}
</style>
