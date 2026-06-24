<template>
  <div class="phone-form-container">
    <el-form
      id="phone-login-form"
      :model="formData"
      :rules="formRules"
      ref="formRef"
      class="login-form"
      autocomplete="on"
      @submit.prevent="handleSubmit"
    >
      <el-form-item prop="phoneNumber">
        <div class="phone-input-wrapper">
          <el-select
            id="country-code"
            v-model="formData.countryCode"
            class="country-code-select"
            :disabled="loading"
          >
            <el-option
              v-for="country in countryOptions"
              :key="country.code"
              :label="country.label"
              :value="country.code"
            >
              <span class="country-option">
                <span class="country-flag">{{ country.flag }}</span>
                <span class="country-name">{{ country.name }}</span>
                <span class="country-dial">{{ country.code }}</span>
              </span>
            </el-option>
          </el-select>
          <el-input
            id="phone-number"
            name="phone-number"
            v-model="formData.phoneNumber"
            :placeholder="phonePlaceholder"
            maxlength="15"
            clearable
            autocomplete="tel"
            @input="handlePhoneInput"
          >
            <template #prefix>
              <el-icon class="input-icon">
                <Phone />
              </el-icon>
            </template>
          </el-input>
        </div>
      </el-form-item>

      <el-form-item prop="verificationCode">
        <div class="verification-code-wrapper">
          <el-input
            id="verification-code"
            name="verification-code"
            v-model="formData.verificationCode"
            :placeholder="codePlaceholder"
            maxlength="6"
            clearable
            autocomplete="one-time-code"
            @keyup.enter="handleSubmit"
          >
            <template #prefix>
              <el-icon class="input-icon">
                <KeyRound />
              </el-icon>
            </template>
          </el-input>
          <el-button
            id="send-code-btn"
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

      <el-row class="form-actions-row">
        <el-col :span="12">
          <label class="custom-checkbox">
            <input id="phone-remember-me" name="phone-remember-me" type="checkbox" v-model="formData.rememberMe" />
            <span class="checkmark"></span>
            <span class="remember-me-text">{{ t('auth.autoLogin') }}</span>
          </label>
        </el-col>
        <el-col :span="12" class="text-right phone-form-actions">
          <span class="switch-to-account-link" @click="emit('switch-tab', 'account')">
            {{ t('auth.accountLogin') }}
          </span>
        </el-col>
      </el-row>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'
import { Phone, KeyRound } from '@/lib/lucide-fallback'
import { sendVerificationCode } from '@/api/user'
import { ElMessage } from 'element-plus'
import { logger } from '@/utils/logger'
import { useCleanup } from '@/composables/useCleanup'

interface PhoneFormProps {
  loading?: boolean
  phonePlaceholder?: string
  codePlaceholder?: string
}

interface PhoneFormEmits {
  submit: [data: { phoneNumber: string; countryCode: string; verificationCode: string; rememberMe: boolean }]
  'switch-tab': [tab: 'account' | 'phone']
}

const props = withDefaults(defineProps<PhoneFormProps>(), {
  loading: false,
  phonePlaceholder: '',
  codePlaceholder: '',
})

const emit = defineEmits<PhoneFormEmits>()

const { t } = useI18n()

const formRef = ref<FormInstance | undefined>(undefined)
const countdown = ref(0)
const sendingCode = ref(false)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const cleanup = useCleanup()

const formData = reactive({
  phoneNumber: '',
  countryCode: '+86',
  verificationCode: '',
  rememberMe: false,
})

const countryOptions = [
  { code: '+86', name: '中国', flag: '🇨🇳', label: '+86' },
  { code: '+852', name: '香港', flag: '🇭🇰', label: '+852' },
  { code: '+853', name: '澳门', flag: '🇲🇴', label: '+853' },
  { code: '+886', name: '台湾', flag: '🇹🇼', label: '+886' },
  { code: '+1', name: '美国', flag: '🇺🇸', label: '+1' },
  { code: '+81', name: '日本', flag: '🇯🇵', label: '+81' },
  { code: '+82', name: '韩国', flag: '🇰🇷', label: '+82' },
  { code: '+65', name: '新加坡', flag: '🇸🇬', label: '+65' },
]

const canSendCode = computed(() => {
  const phone = formData.phoneNumber.trim()
  if (!phone) return false
  if (formData.countryCode === '+86') {
    return /^1[3-9]\d{9}$/.test(phone)
  }
  return phone.length >= 6 && phone.length <= 15
})

const sendCodeText = computed(() => t('auth.sendCode'))
const phonePlaceholder = computed(() => props.phonePlaceholder || t('auth.phonePlaceholder'))
const codePlaceholder = computed(() => props.codePlaceholder || t('auth.codePlaceholder'))

const formRules = computed((): FormRules => ({
  phoneNumber: [
    { required: true, message: t('auth.phonePlaceholder'), trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void): void => {
        if (!value) {
          callback()
          return
        }
        const phone = value.trim()
        if (formData.countryCode === '+86') {
          if (!/^1[3-9]\d{9}$/.test(phone)) {
            callback(new Error(t('auth.phoneFormatError')))
            return
          }
        } else {
          if (phone.length < 6 || phone.length > 15) {
            callback(new Error(t('auth.phoneFormatError')))
            return
          }
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  verificationCode: [
    { required: true, message: t('auth.codePlaceholder'), trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void): void => {
        if (!value) {
          callback()
          return
        }
        const code = value.trim()
        if (!/^\d{4,6}$/.test(code)) {
          callback(new Error(t('auth.codeFormatError')))
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
    formData.phoneNumber = sanitized
  }
}

const handleSendCode = async (): Promise<void> => {
  if (!canSendCode.value || countdown.value > 0) return

  try {
    await formRef.value?.validateField('phoneNumber')
  } catch {
    return
  }

  sendingCode.value = true

  try {
    const fullPhoneNumber = getFullPhoneNumber()
    await sendVerificationCode({
      type: 'phone',
      target: fullPhoneNumber,
    })

    ElMessage.success(t('auth.codeSentSuccess'))
    startCountdown()
  } catch (error: any) {
    logger.error('[PhoneLoginForm] Failed to send verification code', error)
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

const getFullPhoneNumber = (): string => {
  return `${formData.countryCode}${formData.phoneNumber.trim()}`
}

const handleSubmit = async (): Promise<void> => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    emit('submit', {
      phoneNumber: formData.phoneNumber.trim(),
      countryCode: formData.countryCode,
      verificationCode: formData.verificationCode.trim(),
      rememberMe: formData.rememberMe,
    })
  } catch {
    logger.warn('[PhoneLoginForm] Form validation failed')
  }
}

defineExpose({
  formRef,
  formData,
  getFullPhoneNumber,
  validate: () => formRef.value?.validate(),
  resetFields: () => formRef.value?.resetFields(),
})
</script>

<style scoped lang="scss">
.phone-form-container {
  width: 100%;
}

.login-form {
  .el-form-item {
    margin-bottom: 0;
  }
}

.phone-input-wrapper {
  display: flex;
  gap: 8px;
  width: 100%;
}

.country-code-select {
  width: 100px;
  flex-shrink: 0;
}

.country-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.country-flag {
  font-size: 16px;
}

.country-name {
  flex: 1;
}

.country-dial {
  color: var(--el-text-color-secondary);
}

.verification-code-wrapper {
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

.phone-form-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.switch-to-account-link {
  color: var(--el-text-color-placeholder);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s;

  &:hover {
    color: var(--el-text-color-secondary);
  }
}

.text-right {
  text-align: right;
}
</style>
