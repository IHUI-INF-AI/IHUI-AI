<template>
  <el-dialog
    v-model="visible"
    :title="t('auth.resetPassword.title')"
    width="460px"
    :close-on-click-modal="false"
    :append-to-body="true"
    :modal="true"
    :lock-scroll="true"
    :center="false"
    class="password-reset-dialog"
    @close="handleClose"
  >
    <div class="steps-wrapper">
      <el-steps :active="currentStep" align-center>
        <el-step :title="t('auth.resetPassword.step1')" />
        <el-step :title="t('auth.resetPassword.step2')" />
        <el-step :title="t('auth.resetPassword.step3')" />
      </el-steps>
    </div>

    <div v-if="currentStep === 0" class="step-content">
      <el-form
        ref="verifyFormRef"
        :model="verifyForm"
        :rules="verifyRules"
        label-position="top"
        class="reset-form"
      >
        <el-form-item :label="t('auth.resetPassword.verifyMethod')">
          <el-radio-group v-model="verifyMethod" class="verify-method-group">
            <el-radio value="phone">
              <el-icon class="radio-icon"><Phone /></el-icon>
              {{ t('auth.resetPassword.phoneVerify') }}
            </el-radio>
            <el-radio value="email">
              <el-icon class="radio-icon"><MessageSquare /></el-icon>
              {{ t('auth.resetPassword.emailVerify') }}
            </el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item
          :label="verifyMethod === 'email' ? t('auth.emailLabel') : t('auth.phoneLabel')"
          :prop="verifyMethod === 'email' ? 'email' : 'phone'"
        >
          <el-input
            v-if="verifyMethod === 'email'"
            v-model="verifyForm.email"
            :placeholder="t('auth.emailPlaceholder')"
            maxlength="50"
            size="large"
          />
          <el-input
            v-else
            v-model="verifyForm.phone"
            :placeholder="t('auth.phonePlaceholder')"
            maxlength="11"
            size="large"
          />
        </el-form-item>

        <el-form-item :label="t('auth.captchaLabel')" prop="code">
          <div class="code-input-group">
            <el-input
              v-model="verifyForm.code"
              :placeholder="t('auth.captchaPlaceholder')"
              maxlength="6"
              size="large"
              @keyup.enter="handleSendCode"
            />
            <el-button
              size="large"
              :disabled="codeSending || countdown > 0"
              :loading="codeSending"
              @click="handleSendCode"
            >
              {{ countdown > 0 ? `${countdown}s` : t('auth.getVerificationCode') }}
            </el-button>
          </div>
        </el-form-item>
      </el-form>
    </div>

    <div v-if="currentStep === 1" class="step-content">
      <el-form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordRules"
        label-position="top"
        class="reset-form"
      >
        <el-form-item :label="t('auth.resetPassword.newPassword')" prop="newPassword">
          <el-input
            v-model="passwordForm.newPassword"
            type="password"
            show-password
            :placeholder="t('auth.resetPassword.newPasswordPlaceholder')"
            maxlength="128"
            size="large"
          />
          <div v-if="passwordStrength.show" class="password-strength">
            <div class="strength-bar">
              <div
                class="strength-fill"
                :class="passwordStrength.level"
                :style="{ width: passwordStrength.width + '%' }"
              ></div>
            </div>
            <span class="strength-text" :class="passwordStrength.level">
              {{ passwordStrength.text }}
            </span>
          </div>
        </el-form-item>

        <el-form-item :label="t('auth.resetPassword.confirmPassword')" prop="confirmPassword">
          <el-input
            v-model="passwordForm.confirmPassword"
            type="password"
            show-password
            :placeholder="t('auth.resetPassword.confirmPasswordPlaceholder')"
            maxlength="128"
            size="large"
            @keyup.enter="handleResetPassword"
          />
        </el-form-item>
      </el-form>
    </div>

    <div v-if="currentStep === 2" class="step-content success-content">
      <div class="success-icon">
        <el-icon :size="48" color="var(--el-color-success)"><CircleCheck /></el-icon>
      </div>
      <h4 class="success-title">{{ t('auth.resetPassword.successTitle') }}</h4>
      <p class="success-desc">{{ t('auth.resetPassword.successSubtitle') }}</p>
      <el-button type="primary" size="large" class="success-btn" @click="handleClose">
        {{ t('common.close') }}
      </el-button>
    </div>

    <template #footer>
      <div v-if="currentStep < 2" class="dialog-footer">
        <el-button size="large" @click="handleClose">{{ t('common.cancel') }}</el-button>
        <el-button
          v-if="currentStep === 0"
          type="primary"
          size="large"
          :loading="verifying"
          @click="handleVerifyCode"
        >
          {{ t('common.next') }}
        </el-button>
        <el-button
          v-if="currentStep === 1"
          type="primary"
          size="large"
          :loading="resetting"
          @click="handleResetPassword"
        >
          {{ t('auth.resetPassword.confirmReset') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useCleanup } from '@/composables/useCleanup'
import { MessageSquare, Phone, CircleCheck } from '@/lib/lucide-fallback'
import { useI18n } from 'vue-i18n'
import { resetPassword, sendVerificationCode, verifyCode } from '@/api/user'
import { InputValidator } from '@/utils/security'
import { FormValidator } from '@/utils/formValidation'

// 初始化 i18n
const { t } = useI18n()
const { showSuccess, showError } = useOperationFeedback()
const cleanup = useCleanup()

interface Props {
  modelValue: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const visible = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val),
})

const currentStep = ref(0)
const verifyMethod = ref<'email' | 'phone'>('phone')
const codeSending = ref(false)
const verifying = ref(false)
const resetting = ref(false)
const countdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null
const codeId = ref('')

const verifyFormRef = ref<{ validate?: () => Promise<void>; validateField?: (props: string | string[], callback?: (error?: string) => void) => void } | undefined>(undefined)
const passwordFormRef = ref<{ validate?: () => Promise<void> } | undefined>(undefined)

const verifyForm = reactive({
  email: '',
  phone: '',
  code: '',
})

const passwordForm = reactive({
  newPassword: '',
  confirmPassword: '',
})

const passwordStrength = computed(() => {
  if (!passwordForm.newPassword) {
    return { show: false, level: '', width: 0, text: '' }
  }

  const result = InputValidator.validatePasswordStrength(passwordForm.newPassword)

  const levelMap: Record<
    'weak' | 'medium' | 'strong',
    { class: string; text: string; width: number }
  > = {
    weak: { class: 'weak', text: t('auth.passwordStrength.weak'), width: 33 },
    medium: { class: 'medium', text: t('auth.passwordStrength.medium'), width: 66 },
    strong: { class: 'strong', text: t('auth.passwordStrength.strong'), width: 100 },
  }

  const level = levelMap[result.strength] || levelMap.weak

  return {
    show: true,
    level: level.class,
    width: level.width,
    text: level.text,
  }
})

const verifyRules = computed(() => {
  const rules: Record<
    string,
    Array<{
      required?: boolean
      message: string
      trigger?: string
      validator?: (rule: unknown, value: string, callback: (error?: Error) => void) => void
    }>
  > = {
    code: [
      { required: true, message: t('auth.captchaPlaceholder'), trigger: 'blur' },
      {
        message: t('auth.captchaFormatError'),
        validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
          if (!/^\d{4,6}$/.test(value)) {
            callback(new Error(t('auth.captchaFormatError')))
          } else {
            callback()
          }
        },
        trigger: 'blur',
      },
    ],
  }

  if (verifyMethod.value === 'email') {
    rules.email = [
      { required: true, message: t('auth.emailPlaceholder'), trigger: 'blur' },
      {
        message: t('auth.emailFormatError'),
        validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
          if (!InputValidator.isValidEmail(value)) {
            callback(new Error(t('auth.emailFormatError')))
          } else {
            callback()
          }
        },
        trigger: 'blur',
      },
    ]
  } else {
    rules.phone = [
      { required: true, message: t('auth.phonePlaceholder'), trigger: 'blur' },
      {
        message: t('auth.phoneFormatError'),
        validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
          if (!InputValidator.isValidPhone(value)) {
            callback(new Error(t('auth.phoneFormatError')))
          } else {
            callback()
          }
        },
        trigger: 'blur',
      },
    ]
  }

  return rules
})

const passwordRules = computed(() => ({
  newPassword: [
    { required: true, message: t('auth.resetPassword.newPasswordPlaceholder'), trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        if (!value) {
          callback()
          return
        }
        const strengthResult = InputValidator.validatePasswordStrength(value)
        if (!strengthResult.valid) {
          callback(new Error(t('auth.passwordStrengthInsufficient')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  confirmPassword: [
    {
      required: true,
      message: t('auth.resetPassword.confirmPasswordPlaceholder'),
      trigger: 'blur',
    },
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error(t('auth.passwordMismatch')))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
}))

// 发送验证码
const handleSendCode = async () => {
  if (!verifyFormRef.value) return

  try {
    await verifyFormRef.value.validateField?.(
      verifyMethod.value === 'email' ? 'email' : 'phone',
      undefined
    )

    codeSending.value = true

    const target =
      verifyMethod.value === 'email'
        ? FormValidator.sanitizeInput(verifyForm.email)
        : FormValidator.sanitizeInput(verifyForm.phone)

    const response = await sendVerificationCode({
      type: verifyMethod.value,
      target,
    })

    if (response.code === 200 || response.success) {
      codeId.value = response.data?.codeId || ''
      showSuccess(t('auth.codeSentSuccess'))

      // 开始倒计时
      countdown.value = 60
      if (countdownTimer) {
        clearInterval(countdownTimer)
      }
      countdownTimer = cleanup.addInterval(() => {
        if (countdown.value > 0) {
          countdown.value--
        } else {
          if (countdownTimer) {
            clearInterval(countdownTimer)
            countdownTimer = null
          }
        }
      }, 1000)
    } else {
      showError(response.message || t('auth.codeSendFailed'))
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : t('auth.codeSendFailedRetry')
    showError(errorMessage)
  } finally {
    codeSending.value = false
  }
}

// 验证验证码
const handleVerifyCode = async () => {
  if (!verifyFormRef.value) return

  try {
    await verifyFormRef.value.validate?.()
    verifying.value = true

    const response = await verifyCode({
      codeId: codeId.value,
      code: verifyForm.code,
    })

    if (response.code === 200 || response.success) {
      currentStep.value = 1
      showSuccess(t('auth.verifySuccess'))
    } else {
      showError(response.message || t('auth.codeError'))
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : t('auth.verifyFailed')
    showError(errorMessage)
  } finally {
    verifying.value = false
  }
}

// 重置密码
const handleResetPassword = async () => {
  if (!passwordFormRef.value) return

  try {
    await passwordFormRef.value.validate?.()
    resetting.value = true

    const resetData: {
      email?: string
      phone?: string
      code: string
      newPassword: string
    } = {
      newPassword: passwordForm.newPassword,
      code: verifyForm.code,
    }

    if (verifyMethod.value === 'email') {
      resetData.email = verifyForm.email
    } else {
      resetData.phone = verifyForm.phone
    }

    const response = await resetPassword(resetData)

    if (response.code === 200 || response.success) {
      currentStep.value = 2
      emit('success')
    } else {
      showError(response.message || t('auth.resetPasswordFailed'))
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : t('auth.resetPasswordFailedRetry')
    showError(errorMessage)
  } finally {
    resetting.value = false
  }
}

// 关闭对话框
const handleClose = () => {
  visible.value = false
  currentStep.value = 0
  verifyMethod.value = 'phone' // 重置为默认的手机验证
  verifyForm.email = ''
  verifyForm.phone = ''
  verifyForm.code = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  codeId.value = ''
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  countdown.value = 0
}

// 监听密码变化
watch(
  () => passwordForm.newPassword,
  () => {
    // 触发密码强度检查
  }
)
</script>

<style scoped lang="scss">
.password-reset-dialog {
  :deep(.el-dialog__header) {
    padding: 20px 24px 0;
    text-align: center;
  }

  :deep(.el-dialog__title) {
    font-size: 18px;
    font-weight: 600;
  }

  :deep(.el-dialog__body) {
    padding: 16px 24px;
  }

  :deep(.el-dialog__footer) {
    padding: 0 24px 24px;
  }
}

.steps-wrapper {
  padding: 0 20px;
  margin-bottom: 8px;
}

.step-content {
  padding: 16px 0;
}

.reset-form {
  :deep(.el-form-item__label) {
    font-weight: 500;
    padding-bottom: 6px;
  }
}

.verify-method-group {
  display: flex;
  gap: 32px;

  :deep(.el-radio) {
    display: flex;
    align-items: center;
    gap: 6px;
    height: auto;
  }

  .radio-icon {
    font-size: 16px;
    opacity: 0.7;
  }
}

.code-input-group {
  display: flex;
  gap: 12px;

  .el-input {
    flex: 1;
  }

  .el-button {
    min-width: 110px;
  }
}

:where(.password-strength) {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 12px;

  :where(.strength-bar) {
    flex: 1;
    height: 4px;
    background: var(--el-fill-color-light);
    border-radius: var(--global-border-radius);
    overflow: hidden;

    :where(.strength-fill) {
      height: 100%;
      transition: all 0.3s;

      &.weak {
        background: var(--el-color-danger);
      }

      &.medium {
        background: var(--el-color-warning);
      }

      &.strong {
        background: var(--el-color-success);
      }
    }
  }

  .strength-text {
    font-size: 12px;
    white-space: nowrap;

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
}

.success-content {
  text-align: center;
  padding: 24px 0 16px;

  .success-icon {
    margin-bottom: 16px;
  }

  .success-title {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .success-desc {
    margin: 0 0 24px;
    font-size: 14px;
    color: var(--el-text-color-secondary);
    line-height: 1.6;
  }

  .success-btn {
    min-width: 120px;
  }
}

.dialog-footer {
  display: flex;
  justify-content: center;
  gap: 16px;

  .el-button {
    min-width: 100px;
  }
}

:deep(.el-steps) {
  .el-step__head {
    padding-right: 8px;
  }

  .el-step__title {
    font-size: 13px;
    font-weight: 500;
  }

  .el-step__icon {
    width: 28px;
    height: 28px;
    font-size: 13px;
  }

  .el-step__icon.is-text {
    border: 2px solid;
  }

  :where(.el-step.is-process) .el-step__icon {
    background: var(--el-color-primary);
    border: var(--el-border-width-primary) solid var(--el-color-primary);
  }
}
</style>
