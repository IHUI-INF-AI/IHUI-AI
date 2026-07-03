<template>
  <el-dialog v-model="visible" :title="t('auth.bindPhone')" width="500px" :close-on-click-modal="false"
    :close-on-press-escape="false" :show-close="false" append-to-body destroy-on-close class="phone-binding-dialog">
    <div class="dialog-content">
      <p class="dialog-description">
        {{ t('auth.bindPhoneDescription') }}
      </p>

      <!-- 手机号输入 -->
      <div class="phone-background-bar">
        <div class="phone-input-container">
          <span class="country-code-text" @click="handleCountryCodeTextClick">
            {{ isChineseLanguage ? selectedCountryCode.name : selectedCountryCode.nameEn }}
            {{ selectedCountryCode.dialCode }}
          </span>
          <el-select ref="countryCodeSelectRef" v-model="selectedCountryCode" value-key="dialCode"
            class="country-code-select-inline" filterable :filter-method="filterCountryCodes"
            @change="handleCountryCodeChange" popper-class="country-code-popper" :teleported="true"
            :default-first-option="false" :suffix-icon="ArrowDown" :placeholder="t('auth.selectCountryCode')"
            style="position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none;">
            <el-option v-for="option in countryCodeOptions" :key="`${option.dialCode || option.value}`"
              :label="option.label" :value="option.country">
              <span class="country-option">
                <span class="country-name">
                  {{ isChineseLanguage ? option.country.name : option.country.nameEn }}
                </span>
                <span class="country-dial">{{ option.dialCode || option.value }}</span>
              </span>
            </el-option>
          </el-select>

          <div class="phone-input-wrapper" style="position: relative; width: 100%">
            <el-input v-model="phoneNumber" maxlength="15" class="phone-input-with-code-btn"
              :placeholder="t('auth.phonePlaceholder')">
              <template #suffix>
                <button type="button" :disabled="sendingCode || countdown > 0 || !canSendCode"
                  @click="sendVerificationCode" class="code-button-inline" :class="{ 'is-loading': sendingCode }">
                  <span v-if="sendingCode">{{ t('auth.sendingCode') }}</span>
                  <span v-else-if="countdown > 0">
                    {{ t('auth.retryAfterSeconds', { seconds: countdown }) }}
                  </span>
                  <span v-else>{{ t('auth.sendCode') }}</span>
                </button>
              </template>
            </el-input>
          </div>
        </div>
      </div>

      <!-- 验证码输入 -->
      <div class="verification-code-background-bar">
        <div class="verification-code-inputs">
          <input v-for="(digit, index) in verificationCodeInputs" :key="index" :id="`verification-code-${index}`" :ref="(el: HTMLInputElement | null) => {
            if (el) verificationCodeInputRefs[index] = el as HTMLInputElement
          }
            " v-model="verificationCodeInputs[index]" inputmode="numeric" maxlength="1" class="verification-code-digit"
            @input="handleVerificationCodeInput(index, $event)" @keydown="handleVerificationCodeKeydown(index, $event)"
            @paste="handleVerificationCodePaste($event)" @focus="handleVerificationCodeFocus(index)" />
        </div>
      </div>

      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="binding" :disabled="!canSubmit" @click="handleSubmit">
          {{ t('common.confirm') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import { bindPhone } from '@/api/security'
import { sendPhoneLoginCode, verifyPhoneCode, completePhoneLogin } from '@/api/user'
import { countryCodes, type CountryCode } from '@/utils/countryCodes'
import logger from '@/utils/logger'
import { useCleanup } from '@/composables/useCleanup'

interface Props {
  modelValue: boolean
  /** 微信登录 unionId */
  unionId?: string
  /** 微信登录 openId */
  openId?: string
  /** 平台类型 */
  platformType?: string
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'bind-success', data: { phone: string; code: string; token?: string; refreshToken?: string; userInfo?: Record<string, unknown> }): void
  (e: 'bind-cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  unionId: '',
  openId: '',
  platformType: '',
})

const emit = defineEmits<Emits>()
const { t, locale } = useI18n()
const cleanup = useCleanup()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const phoneNumber = ref('')
const verificationCodeInputs = ref<string[]>(Array(6).fill(''))
const verificationCodeInputRefs = ref<(HTMLInputElement | null)[]>([])
const sendingCode = ref(false)
const countdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null
const binding = ref(false)
const errorMessage = ref('')
const countryCodeSelectRef = ref<{ focus: () => void; handleOpen: () => void } | null>(null)

// 国家代码相关
const selectedCountryCode = ref<CountryCode>(
  countryCodes.find((c) => c.dialCode === '+86') || countryCodes[0]
)
const countryCodeOptions = computed(() => {
  return countryCodes.map((country) => ({
    label: `${country.name} ${country.dialCode}`,
    value: country.dialCode,
    dialCode: country.dialCode,
    country,
  }))
})
const isChineseLanguage = computed(() => locale.value === 'zh-CN' || locale.value === 'zh')

const filterCountryCodes = (_query: string) => {
  // 过滤逻辑由 el-select 的 filterable 自动处理
}

const handleCountryCodeTextClick = () => {
  countryCodeSelectRef.value?.focus()
  countryCodeSelectRef.value?.handleOpen()
}

const handleCountryCodeChange = () => {
  // 国家代码改变时的处理
}

// 获取完整手机号
const getFullPhoneNumber = (): string => {
  const dialCode = selectedCountryCode.value.dialCode.replace('+', '')
  return `${dialCode}${phoneNumber.value}`
}

// 判断是否可以发送验证码
const canSendCode = computed(() => {
  return phoneNumber.value.length >= 7 && /^\d+$/.test(phoneNumber.value)
})

// 判断是否可以提交
const canSubmit = computed(() => {
  return (
    phoneNumber.value.length >= 7 &&
    verificationCodeInputs.value.every((digit) => digit !== '') &&
    verificationCodeInputs.value.join('').length === 6
  )
})

// 发送验证码
const sendVerificationCode = async () => {
  if (!canSendCode.value || sendingCode.value || countdown.value > 0) {
    return
  }

  try {
    sendingCode.value = true
    errorMessage.value = ''

    const fullPhoneNumber = getFullPhoneNumber()
    if (!fullPhoneNumber || fullPhoneNumber.length < 8) {
      errorMessage.value = t('auth.phoneFormatError')
      sendingCode.value = false
      return
    }

    // 使用与手机号登录相同的接口，tempId=1 表示登录验证码
    const response = await sendPhoneLoginCode(fullPhoneNumber, 1)

    // 判断是否成功：code 为 200 或 0 表示成功，或者 msg === 'success'
    if (response.code === 200 || response.code === 0 || response.msg === 'success') {
      ElMessage.success(t('auth.codeSentSuccess'))
      // 开始倒计时
      countdown.value = 60
      countdownTimer = cleanup.addInterval(() => {
        countdown.value--
        if (countdown.value <= 0) {
          if (countdownTimer) {
            clearInterval(countdownTimer)
            countdownTimer = null
          }
        }
      }, 1000)
    } else {
      errorMessage.value = response.message || t('auth.codeSendFailed')
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error('Failed to send verification code', error)
    errorMessage.value = errorMsg || t('auth.codeSendFailed')
  } finally {
    sendingCode.value = false
  }
}

// 处理验证码输入
const handleVerificationCodeInput = (index: number, event: Event) => {
  const input = event.target as HTMLInputElement
  const value = input.value.replace(/\D/g, '')
  verificationCodeInputs.value[index] = value

  // 如果输入了数字且不是最后一个输入框，自动跳转到下一个
  if (value && index < 5) {
    nextTick(() => {
      verificationCodeInputRefs.value[index + 1]?.focus()
    })
  }
}

// 处理验证码键盘事件
const handleVerificationCodeKeydown = (index: number, event: KeyboardEvent) => {
  // 处理退格键
  if (event.key === 'Backspace' && !verificationCodeInputs.value[index] && index > 0) {
    event.preventDefault()
    verificationCodeInputRefs.value[index - 1]?.focus()
  }

  // 处理左右箭头键
  if (event.key === 'ArrowLeft' && index > 0) {
    event.preventDefault()
    verificationCodeInputRefs.value[index - 1]?.focus()
  }

  if (event.key === 'ArrowRight' && index < 5) {
    event.preventDefault()
    verificationCodeInputRefs.value[index + 1]?.focus()
  }

  // 处理回车键
  if (event.key === 'Enter' && canSubmit.value) {
    handleSubmit()
  }
}

// 处理验证码粘贴
const handleVerificationCodePaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const pastedData = event.clipboardData?.getData('text') || ''
  const digits = pastedData.replace(/\D/g, '').slice(0, 6)

  // 填充输入框
  for (let i = 0; i < 6; i++) {
    verificationCodeInputs.value[i] = digits[i] || ''
  }

  // 聚焦到最后一个已填写的输入框或第一个空输入框
  const lastFilledIndex = digits.length - 1
  const focusIndex = lastFilledIndex < 5 ? lastFilledIndex + 1 : 5
  nextTick(() => {
    verificationCodeInputRefs.value[focusIndex]?.focus()
  })
}

// 处理验证码输入框聚焦
const handleVerificationCodeFocus = (index: number) => {
  // 聚焦时选中当前输入框的内容
  nextTick(() => {
    verificationCodeInputRefs.value[index]?.select()
  })
}

// 提交绑定
const handleSubmit = async () => {
  if (!canSubmit.value || binding.value) {
    return
  }

  try {
    binding.value = true
    errorMessage.value = ''

    const fullPhoneNumber = getFullPhoneNumber()
    const verificationCode = verificationCodeInputs.value.join('')

    // 判断是否是微信登录绑定手机号
    const isWechatBind = !!(props.unionId || props.openId)

    if (isWechatBind) {
      // 微信登录绑定手机号流程
      logger.info('[PhoneBindingDialog] WeChat login binding phone number', {
        phone: fullPhoneNumber,
        unionId: props.unionId,
        openId: props.openId,
        platformType: props.platformType,
      })

      // 1. 先验证验证码，获取临时密钥
      const verifyResponse = await verifyPhoneCode({
        phone: fullPhoneNumber,
        code: verificationCode,
      })

      if (verifyResponse.code !== 200 && !verifyResponse.success) {
        errorMessage.value = verifyResponse.message || t('auth.verifyCodeFailed')
        return
      }

      // verifyPhoneCode 返回的 data 直接就是 tempKey 字符串
      const tempKey = verifyResponse.data || ''
      if (!tempKey) {
        errorMessage.value = t('auth.verifyCodeFailed')
        return
      }

      // 2. 调用绑定手机号登录接口
      const loginResponse = await completePhoneLogin({
        phone: fullPhoneNumber,
        tempKey,
        unionId: props.unionId,
        openId: props.openId,
        platformType: props.platformType,
      })

      // 判断成功：code 为 200 或 "200" 或 msg === 'success'
      const responseCode = loginResponse.code
      const isSuccess = responseCode === 200 ||
        String(responseCode) === '200' ||
        (loginResponse as { msg?: string }).msg === 'success'

      if (isSuccess) {
        ElMessage.success(t('auth.bindPhoneSuccess'))
        // 从响应中提取 token - token 在 thirdPartyAccounts.accessToken 中
        const responseData = loginResponse.data as Record<string, unknown> | undefined
        const thirdPartyAccounts = responseData?.thirdPartyAccounts as Record<string, unknown> | undefined
        const token = thirdPartyAccounts?.accessToken as string | undefined
        const refreshToken = thirdPartyAccounts?.refreshToken as string | undefined

        logger.info('[PhoneBindingDialog] Binding successful, extracting user info', {
          hasToken: !!token,
          hasRefreshToken: !!refreshToken,
          hasUserInfo: !!responseData,
        })

        emit('bind-success', {
          phone: fullPhoneNumber,
          code: verificationCode,
          token,
          refreshToken,
          userInfo: responseData,
        })
        visible.value = false
      } else {
        errorMessage.value = loginResponse.message || t('auth.bindPhoneFailed')
      }
    } else {
      // 普通绑定手机号流程
      const response = await bindPhone({
        phone: fullPhoneNumber,
        code: verificationCode,
      })

      if (response.code === 200 || response.success) {
        ElMessage.success(t('auth.bindPhoneSuccess'))
        emit('bind-success', {
          phone: fullPhoneNumber,
          code: verificationCode,
        })
        visible.value = false
      } else {
        errorMessage.value = response.message || t('auth.bindPhoneFailed')
      }
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error('Failed to bind phone number', error)
    errorMessage.value = errorMsg || t('auth.bindPhoneFailed')
  } finally {
    binding.value = false
  }
}

// 取消
const handleCancel = () => {
  emit('bind-cancel')
  visible.value = false
}

// 监听弹窗关闭，重置表单
watch(visible, (newVal) => {
  if (!newVal) {
    phoneNumber.value = ''
    verificationCodeInputs.value = Array(6).fill('')
    errorMessage.value = ''
    countdown.value = 0
    sendingCode.value = false
    binding.value = false
    // 停止倒计时定时器
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }
})

</script>

<style scoped lang="scss">
.phone-binding-dialog {
  // 统一输入框变量定义（与 UniversalLogin.vue 亮色模式一致）
  // 本组件不在 .login-content.login-page 上下文内，需自行定义变量，否则 hover/focus 状态失效
  // 对齐 .checkmark：hover/focus 边框使用 --el-text-color-regular（黑色），1.3s 慢速过渡
  --unified-input-border-color: var(--border-unified-color);
  --unified-input-bg-color: var(--el-fill-color-light);
  --unified-input-transition: border-color 1.3s, background-color 1.3s;
  --unified-input-hover-border-color: var(--border-unified-color-hover);
  --unified-input-hover-bg-color: var(--el-fill-color-light);
  --unified-input-focus-border-color: var(--border-unified-color-hover);
  --unified-input-focus-bg-color: var(--el-fill-color-light);

  :deep(.el-dialog__body) {
    padding: 24px;
  }

  .dialog-content {
    padding: 0;
  }

  .dialog-description {
    margin-bottom: 24px;
    color: var(--el-text-color-regular);
    font-size: 14px;
    line-height: 1.6;
    text-align: center;
  }

  .phone-background-bar {
    width: 100%;
    border: var(--unified-border);
    border-radius: var(--el-input-border-radius);
    background-color: var(--unified-input-bg-color);
    background: var(--unified-input-bg-color);
    transition: var(--unified-input-transition, all 0.2s ease);
    box-shadow: none;
    padding: 0 clamp(8px, 1vw, 10px);
    padding-right: clamp(4px, 0.5vw, 8px);
    height: clamp(48px, 4.5vw, 52px);
    min-height: clamp(48px, 4.5vw, 52px);
    max-height: clamp(48px, 4.5vw, 52px);
    display: grid;
    grid-template-columns: max-content 1fr;
    align-items: center;
    column-gap: clamp(4px, 0.5vw, 8px);
    position: relative;
    box-sizing: border-box;
    margin-bottom: 20px;
    padding-top: 0;
    padding-bottom: 0;
    line-height: 1;

    &:hover {
      border-color: var(--unified-input-hover-border-color);
      background-color: var(--unified-input-hover-bg-color);
      background: var(--unified-input-hover-bg-color);
    }

    &:focus-within {
      border-color: var(--unified-input-focus-border-color);
      background-color: var(--unified-input-focus-bg-color);
      background: var(--unified-input-focus-bg-color);
    }
  }

  .phone-input-container {
    display: contents;
  }

  .country-code-text {
    flex-shrink: 0;
    padding: 0 12px;
    color: var(--el-text-color-regular);
    font-size: 14px;
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
  }

  .phone-input-wrapper {
    width: 100%;
    min-width: 0;
  }

  :deep(.phone-input-with-code-btn) {
    .el-input__wrapper {
      border: none;
      box-shadow: none;
      background: transparent;
      padding: 0;
    }

    .el-input__inner {
      border: none;
      background: transparent;
      padding: 0;
      height: 100%;
    }
  }

  .code-button-inline {
    padding: 4px 12px;
    font-size: 12px;
    border: none;
    background: transparent;
    color: var(--el-color-primary);
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;

    &:hover:not(:disabled) {
      color: var(--el-color-primary-light-3);
    }

    &:disabled {
      color: var(--el-text-color-disabled);
      cursor: not-allowed;
    }
  }

  .verification-code-background-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    width: 100%;
    max-width: 100%;
    height: auto;
    min-height: auto;
    background-color: transparent;
    border: none;
    border-radius: var(--global-border-radius);
    box-sizing: border-box;
    margin: 0 auto 20px;
    padding: 0 16px;
    overflow: visible;
    position: relative;
  }

  .verification-code-inputs {
    display: flex;
    gap: clamp(20px, 3vw, 28px);
    align-items: center;
    justify-content: space-between;
    box-sizing: border-box;
    margin: 0 auto;
    padding: 0;
    overflow: visible;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    flex-wrap: nowrap;
    flex-shrink: 1;
    position: relative;
  }

  .verification-code-digit {
    flex: 0 0 auto;
    width: 48px;
    height: 64px;
    font-size: 24px;
    text-align: center;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    background: var(--unified-input-bg-color);
    transition: var(--unified-input-transition);
    color: var(--el-text-color-primary);
    padding: 0;

    &:focus {
      border-color: var(--unified-input-focus-border-color);
      background-color: var(--unified-input-focus-bg-color);
    }

    &:hover {
      border-color: var(--unified-input-hover-border-color);
      background-color: var(--unified-input-hover-bg-color);
    }
  }

  .error-message {
    margin-top: 12px;
    color: var(--el-color-error);
    font-size: 12px;
    text-align: center;
    min-height: 20px;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  // 暗色模式支持
  :global(.dark) & {
    // 统一输入框变量定义（与 UniversalLogin.vue 暗色模式一致）
    // 对齐 .checkmark：暗色模式下 --el-text-color-regular 自动为浅色
    --unified-input-border-color: var(--border-unified-color);
    --unified-input-bg-color: var(--color-white-5);
    --unified-input-hover-border-color: var(--border-unified-color-hover);
    --unified-input-hover-bg-color: var(--el-fill-color-dark);
    --unified-input-focus-border-color: var(--border-unified-color-hover);
    --unified-input-focus-bg-color: var(--el-fill-color-darker);

    .phone-background-bar {
      background-color: var(--el-fill-color-dark);
      border-color: var(--el-border-color-darker);
    }

    .verification-code-digit {
      background: var(--el-fill-color-dark);
      border-color: var(--el-border-color-darker);
      color: var(--el-text-color-primary);
    }
  }
}
</style>
