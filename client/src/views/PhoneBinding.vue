<template>
  <div class="phone-binding-page">
    <div class="phone-binding-container">
      <div class="phone-binding-card">
        <div class="card-header">
          <h1 class="page-title">{{ t('auth.bindPhone') }}</h1>
        </div>

        <div class="pb-form-content">
          <!-- 手机号 - 与登录页相同结构；区号用包裹层让 select 与文案同尺寸，下拉才能定位到文案下方 -->
          <div class="phone-background-bar">
            <div class="country-code-trigger-wrap">
              <span
                ref="countryCodeTextRef"
                class="country-code-text"
                :key="`country-text-${currentLanguage}`"
                style="cursor: pointer"
                @click="handleCountryCodeTextClick"
              >
                {{ isChineseLanguage ? selectedCountryCode.name : selectedCountryCode.nameEn }}
                {{ selectedCountryCode.dialCode }}
              </span>
              <el-select
                ref="countryCodeSelectRef"
                v-model="selectedCountryCode"
                value-key="dialCode"
                class="country-code-select-inline country-code-select-overlay"
                filterable
                :filter-method="filterCountryCodes"
                popper-class="phone-binding-country-code-popper"
                :teleported="true"
                :default-first-option="false"
                :suffix-icon="ArrowDown"
                :placeholder="t('auth.selectCountryCode')"
                :popper-options="{
                  placement: 'bottom-start',
                  strategy: 'fixed',
                  modifiers: [
                    { name: 'offset', options: { offset: [0, 8] } },
                  ],
                }"
                @change="handleCountryCodeChange"
              >
                <el-option
                  v-for="option in countryCodeOptions"
                  :key="`${option.dialCode || option.value}-${currentLanguage}`"
                  :label="option.label"
                  :value="option.country"
                >
                  <span class="country-option">
                    <span class="country-name">
                      {{ isChineseLanguage ? option.country.name : option.country.nameEn }}
                    </span>
                    <span class="country-dial">{{ option.dialCode || option.value }}</span>
                  </span>
                </el-option>
                <template #empty>
                  <span></span>
                </template>
              </el-select>
            </div>

            <div class="phone-input-wrapper">
              <el-input
                v-model="phoneNumber"
                maxlength="15"
                class="phone-input-with-code-btn"
                :placeholder="t('auth.phonePlaceholder')"
              >
                <template #suffix>
                  <button
                    type="button"
                    :disabled="sendingCode || countdown > 0 || !canSendCode"
                    class="code-button-inline"
                    :class="{ 'is-loading': sendingCode }"
                    @click="onSendCode"
                  >
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

          <!-- 验证码 - 与登录页相同样式 -->
          <div class="verification-code-background-bar">
            <div class="verification-code-inputs">
              <input
                v-for="(digit, index) in verificationCodeInputs"
                :id="`verification-code-${index}`"
                :key="index"
                :ref="(el: HTMLInputElement | null) => {
                  if (el) verificationCodeInputRefs[index] = el
                }"
                v-model="verificationCodeInputs[index]"
                inputmode="numeric"
                maxlength="1"
                class="verification-code-digit unified-input-base"
                @input="handleVerificationCodeInput(index, $event)"
                @keydown="handleVerificationCodeKeydown(index, $event)"
                @paste="handleVerificationCodePaste($event)"
                @focus="handleVerificationCodeFocus(index)"
              />
            </div>
          </div>

          <div v-if="errorMessage" class="pb-error-message">
            {{ errorMessage }}
          </div>

          <div class="pb-actions">
            <el-button type="primary" :loading="submitting" :disabled="!canSubmit || submitting" class="submit-btn" @click="onSubmit">
              {{ t('auth.bind') }}
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { ArrowDown } from '@element-plus/icons-vue'
import {
  countryCodes,
  getDefaultCountryCode,
  type CountryCode,
} from '@/utils/countryCodes'
import { sendPhoneLoginCode, verifyPhoneCode, completePhoneLogin } from '@/api/user'
import { useAuthStore } from '@/stores/auth'
import { AuthFlowService } from '@/services/auth-flow.service'
import { ElMessage } from 'element-plus'

const { t, locale } = useI18n()
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const cleanup = useCleanup()

/** 飞书/第三方登录回调参数（从路由 ?body= 或 query 解析），提交时传给 completePhoneLogin */
const bindingCallbackParams = ref<{
  unionId?: string
  openId?: string
  platformType?: string
}>({})

const phoneNumber = ref('')
const verificationCodeInputs = ref<string[]>(Array(6).fill(''))
const verificationCodeInputRefs = ref<(HTMLInputElement | null)[]>([])
const sendingCode = ref(false)
const countdown = ref(0)
let timer: ReturnType<typeof setInterval> | null = null
const errorMessage = ref('')
const countryCodeTextRef = ref<HTMLElement | null>(null)
const countryCodeSelectRef = ref<{
  focus?: () => void
  blur?: () => void
  toggleMenu?: () => void
} | null>(null)

const selectedCountryCode = ref<CountryCode>(getDefaultCountryCode())
const filteredCountryCodes = ref<CountryCode[]>(countryCodes)

const currentLanguage = computed(() => locale.value || 'zh-CN')
const isChineseLanguage = computed(
  () =>
    currentLanguage.value === 'zh-CN' ||
    currentLanguage.value === 'zh-TW' ||
    currentLanguage.value.startsWith('zh')
)

const countryCodeOptions = computed(() =>
  filteredCountryCodes.value.map((country: CountryCode) => ({
    value: country.dialCode,
    label: `${isChineseLanguage.value ? country.name : country.nameEn} ${country.dialCode}`,
    country,
    dialCode: country.dialCode,
  }))
)

const filterCountryCodes = (query: string) => {
  if (!query) {
    filteredCountryCodes.value = countryCodes
    return
  }
  const lowerQuery = query.toLowerCase()
  filteredCountryCodes.value = countryCodes.filter(
    (country) =>
      country.name.toLowerCase().includes(lowerQuery) ||
      country.nameEn.toLowerCase().includes(lowerQuery) ||
      country.dialCode.includes(query) ||
      country.code.toLowerCase().includes(lowerQuery)
  )
}

const handleCountryCodeChange = (value: CountryCode | string) => {
  if (typeof value === 'string') {
    const country = countryCodes.find((c) => c.dialCode === value)
    if (country) selectedCountryCode.value = country
  } else if (value && typeof value === 'object' && 'dialCode' in value) {
    selectedCountryCode.value = value as CountryCode
  }
  nextTick(() => {
    countryCodeSelectRef.value?.blur?.()
  })
}

// 从路由中解析回调参数（飞书等第三方登录绑定手机号会带 ?body= 或其它 query）
function parseBindingParamsFromRoute() {
  const query = route.query
  if (!query || typeof query !== 'object') return

  // 优先解析 body：URL 编码的 JSON，如飞书回调 body={"code":"40101","data":{"unionId":"...","platform-type":"web_fieshu","openId":"..."},...}
  const bodyRaw = query.body
  if (bodyRaw && typeof bodyRaw === 'string') {
    try {
      const decoded = decodeURIComponent(bodyRaw)
      const parsed = JSON.parse(decoded) as {
        code?: string
        data?: {
          unionId?: string
          openId?: string
          'platform-type'?: string
          platformType?: string
        }
        msg?: string
        [key: string]: any
      }
      const data = parsed?.data
      if (data && typeof data === 'object') {
        bindingCallbackParams.value = {
          unionId: data.unionId ?? bindingCallbackParams.value.unionId,
          openId: data.openId ?? bindingCallbackParams.value.openId,
          platformType:
            data['platform-type'] ?? data.platformType ?? bindingCallbackParams.value.platformType,
        }
      }
    } catch {
      // 忽略 body 解析失败
    }
  }

  // 若 query 上直接带了 unionId / openId / platform-type，也一并带上（覆盖 body 中同名字段）
  if (query.unionId && typeof query.unionId === 'string') {
    bindingCallbackParams.value.unionId = query.unionId
  }
  if (query.openId && typeof query.openId === 'string') {
    bindingCallbackParams.value.openId = query.openId
  }
  const pt = query['platform-type'] ?? query.platformType
  if (pt && typeof pt === 'string') {
    bindingCallbackParams.value.platformType = pt
  }
}

onMounted(() => {
  document.body.style.overflow = 'hidden'
  cleanup.add(() => { document.body.style.overflow = '' })
  cleanup.add(() => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  })
  parseBindingParamsFromRoute()
  // 解析完成后清空路由上的参数，避免地址栏暴露敏感信息且防止刷新重复解析
  if (Object.keys(route.query).length > 0) {
    router.replace({ path: route.path, query: {} })
  }
})

const handleCountryCodeTextClick = () => {
  const selectInstance = countryCodeSelectRef.value
  if (!selectInstance) return
  if (typeof selectInstance.toggleMenu === 'function') {
    selectInstance.toggleMenu()
    return
  }
  if (typeof selectInstance.focus === 'function') {
    selectInstance.focus()
    nextTick(() => {
      const inst = selectInstance as unknown as { $el?: HTMLElement }
      const root = inst?.$el ?? (selectInstance as HTMLElement)
      const wrapper = root?.querySelector?.('.el-select__wrapper') as HTMLElement | null
      wrapper?.click()
    })
  }
}

watch(
  () => locale.value,
  (newLocale, oldLocale) => {
    if (newLocale !== oldLocale && newLocale) {
      nextTick(() => {
        const currentDialCode = selectedCountryCode.value.dialCode
        const country = countryCodes.find((c) => c.dialCode === currentDialCode)
        if (country) selectedCountryCode.value = { ...country }
        filteredCountryCodes.value = [...filteredCountryCodes.value]
      })
    }
  },
  { immediate: true }
)

const canSendCode = computed(
  () => phoneNumber.value.length >= 7 && /^\d+$/.test(phoneNumber.value)
)

const canSubmit = computed(
  () =>
    phoneNumber.value.length >= 7 &&
    verificationCodeInputs.value.every((d) => d !== '') &&
    verificationCodeInputs.value.join('').length === 6
)

// 获取完整手机号（与登录页一致：国家区号 + 手机号）
const getFullPhoneNumber = (): string => {
  if (!phoneNumber.value?.trim()) return ''
  const dial = selectedCountryCode.value.dialCode.replace(/^\+/, '')
  return `${dial}${phoneNumber.value.trim()}`
}

// 发送验证码（与登录页手机号验证码登录使用相同接口）
const onSendCode = async () => {
  if (!canSendCode.value || sendingCode.value || countdown.value > 0) return
  const fullPhone = getFullPhoneNumber()
  if (!fullPhone || fullPhone.length < 8) {
    errorMessage.value = t('auth.phoneFormatError')
    return
  }
  sendingCode.value = true
  errorMessage.value = ''
  try {
    // tempId=1 表示登录/验证码，与登录页一致
    const response = await sendPhoneLoginCode(fullPhone, 1)
    const isSuccess =
      response.code === 200 || response.code === 0 || response.msg === 'success'
    if (isSuccess) {
      ElMessage.success(t('auth.codeSentSuccess'))
      countdown.value = 60
      timer = setInterval(() => {
        countdown.value--
        if (countdown.value <= 0) {
          if (timer) {
            clearInterval(timer)
            timer = null
          }
        }
      }, 1000)
    } else {
      errorMessage.value =
        (response as { message?: string }).message || t('auth.sendSmsCodeFailed')
    }
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : t('auth.sendSmsCodeFailed')
  } finally {
    sendingCode.value = false
  }
}

const handleVerificationCodeInput = (index: number, event: Event) => {
  const input = event.target as HTMLInputElement
  const value = input.value.replace(/\D/g, '')
  verificationCodeInputs.value[index] = value
  if (value && index < 5) {
    nextTick(() => {
      verificationCodeInputRefs.value[index + 1]?.focus()
    })
  }
}

const handleVerificationCodeKeydown = (index: number, event: KeyboardEvent) => {
  if (event.key === 'Backspace' && !verificationCodeInputs.value[index] && index > 0) {
    event.preventDefault()
    verificationCodeInputRefs.value[index - 1]?.focus()
  }
  if (event.key === 'ArrowLeft' && index > 0) {
    event.preventDefault()
    verificationCodeInputRefs.value[index - 1]?.focus()
  }
  if (event.key === 'ArrowRight' && index < 5) {
    event.preventDefault()
    verificationCodeInputRefs.value[index + 1]?.focus()
  }
  if (event.key === 'Enter' && canSubmit.value) {
    onSubmit()
  }
}

const handleVerificationCodePaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const pastedData = event.clipboardData?.getData('text') || ''
  const digits = pastedData.replace(/\D/g, '').slice(0, 6)
  for (let i = 0; i < 6; i++) {
    verificationCodeInputs.value[i] = digits[i] || ''
  }
  const lastFilledIndex = digits.length - 1
  const focusIndex = lastFilledIndex < 5 ? lastFilledIndex + 1 : 5
  nextTick(() => {
    verificationCodeInputRefs.value[focusIndex]?.focus()
  })
}

const handleVerificationCodeFocus = (index: number) => {
  nextTick(() => {
    verificationCodeInputRefs.value[index]?.select()
  })
}

// 提交绑定（与登录页手机号验证码登录相同：验证验证码 → 完成登录/绑定）
const submitting = ref(false)
const onSubmit = async () => {
  if (!canSubmit.value || submitting.value) return
  errorMessage.value = ''
  submitting.value = true
  try {
    const fullPhone = getFullPhoneNumber()
    const code = verificationCodeInputs.value.join('')

    // 第一步：验证验证码，获取临时密钥（与登录页一致）
    const verifyResponse = await verifyPhoneCode({ phone: fullPhone, code })
    if (!verifyResponse.success || !verifyResponse.data) {
      errorMessage.value =
        verifyResponse.message || t('auth.verifyCodeFailed')
      return
    }
    const tempKey = verifyResponse.data as string
    if (!tempKey?.trim()) {
      errorMessage.value = t('auth.verifyCodeFailed')
      return
    }

    // 第二步：使用临时密钥完成登录/绑定，传入路由中解析的飞书/第三方回调参数
    const response = await completePhoneLogin({
      phone: fullPhone,
      tempKey,
      unionId: bindingCallbackParams.value.unionId,
      openId: bindingCallbackParams.value.openId,
      platformType: bindingCallbackParams.value.platformType,
    })
    const codeNum =
      typeof response.code === 'string' ? parseInt(response.code, 10) : response.code
    const isSuccess = (codeNum === 200 || response.success === true) && response.data

    if (!isSuccess) {
      errorMessage.value =
        (response as { message?: string }).message || t('auth.bindPhoneFailed')
      return
    }

    const loginData = response.data as Record<string, unknown> | undefined
    let token = ''
    let refreshTokenValue = ''
    let userInfo: Record<string, unknown> | undefined
    if (loginData && typeof loginData === 'object') {
      if (loginData.thirdPartyAccounts && typeof loginData.thirdPartyAccounts === 'object') {
        const acc = loginData.thirdPartyAccounts as Record<string, unknown>
        token = (acc.accessToken as string) || ''
        refreshTokenValue = (acc.refreshToken as string) || ''
      } else {
        token = (loginData.token as string) || (loginData.accessToken as string) || ''
        refreshTokenValue = (loginData.refreshToken as string) || ''
      }
      userInfo = (loginData.userInfo || loginData.user) as Record<string, unknown> | undefined
    }
    if (!token) {
      errorMessage.value = t('auth.loginFailedNoToken')
      return
    }

    await AuthFlowService.processLoginResponse(token, refreshTokenValue, userInfo)
    if (!authStore.isLoggedIn || !authStore.token) {
      errorMessage.value = t('auth.loginStatusUpdateFailed')
      return
    }

    ElMessage.success(t('auth.bindPhoneSuccess'))
    await nextTick()
    AuthFlowService.redirectAfterLogin()
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : t('auth.bindPhoneFailed')
  } finally {
    submitting.value = false
  }
}

const _handleBack = () => {
  if (window.history.length > 1) {
    window.history.back()
  } else {
    router.push('/')
  }
}
</script>

<style scoped lang="scss">
// 白色背景 + 卡片样式，输入框与登录页一致；固定视口，禁止上下滚动；卡片在页面正中间（固定铺满视口以保证垂直居中）
.phone-binding-page {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--el-bg-color-page);
  display: grid;
  grid-template-rows: 1fr;
  grid-template-columns: 1fr;
  place-items: center;
  padding: 24px;
  box-sizing: border-box;
}

.phone-binding-container {
  width: 100%;
  max-width: 440px;
  margin: auto;
}

.phone-binding-card {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  box-shadow: var(--global-box-shadow);
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 24px 20px;
  border-bottom: var(--unified-border-bottom);
}

.pb-back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    background: var(--el-fill-color);
    color: var(--el-color-primary);
  }

  .el-icon {
    font-size: 18px;
  }
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.pb-form-content {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 手机号输入条 - 与登录页相同样式 */
.phone-background-bar {
  width: 100%;
  border: var(--unified-border);
  border-radius: var(--el-input-border-radius);
  background-color: var(--unified-input-bg-color);
  background: var(--unified-input-bg-color);
  transition: all 0.2s ease;
  padding: 0 10px;
  padding-right: 4px;
  height: clamp(48px, 4.5vw, 52px);
  min-height: 48px;
  max-height: 52px;
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: center;
  column-gap: 8px;
  box-sizing: border-box;

  &:hover {
    border-color: var(--unified-input-hover-border-color);
    background-color: var(--unified-input-hover-bg-color);
    background: var(--unified-input-hover-bg-color);
  }

  &:focus-within {
    border-color: var(--unified-input-focus-border-color);
    background-color: var(--unified-input-focus-bg-color);
    background: var(--unified-input-focus-bg-color);
    outline: 2px solid var(--el-color-primary-light-9);
    outline-offset: 2px;
  }
}

/* 区号触发器：包裹层与文案同尺寸，select 叠在文案上，下拉才能定位到文案正下方 */
.country-code-trigger-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  min-width: 0;
}

.country-code-trigger-wrap .country-code-text {
  padding: 0 8px;
  color: var(--el-text-color-regular);
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  pointer-events: auto;
}

.country-code-trigger-wrap .country-code-select-overlay.country-code-select-inline {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  pointer-events: none;
}

.country-code-trigger-wrap .country-code-select-overlay.country-code-select-inline :deep(.el-select__wrapper) {
  min-height: 100%;
  height: 100%;
  padding: 0 8px;
}

.phone-background-bar > .phone-input-wrapper {
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

  &.is-loading {
    cursor: wait;
  }
}

/* 验证码 - 与登录页相同样式 */
.verification-code-background-bar {
  width: 100%;
  padding: 0;
}

.verification-code-inputs {
  display: flex;
  gap: clamp(12px, 2vw, 20px);
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.verification-code-digit.unified-input-base {
  flex: 0 0 auto;
  width: 43px;
  height: 57px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background-color: var(--unified-input-bg-color);
  background: var(--unified-input-bg-color);
  text-align: center;
  font-size: 21px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  outline: none;
  transition: all 0.2s ease;
  padding: 0;
  box-sizing: border-box;

  &:hover {
    border-color: var(--unified-input-hover-border-color);
    background-color: var(--unified-input-hover-bg-color);
    background: var(--unified-input-hover-bg-color);
  }

  &:focus {
    border-color: var(--unified-input-focus-border-color);
    background-color: var(--unified-input-focus-bg-color);
    background: var(--unified-input-focus-bg-color);
    outline: 2px solid var(--el-color-primary-light-9);
    outline-offset: 2px;
  }
}

.pb-error-message {
  min-height: 20px;
  font-size: 12px;
  color: var(--el-color-error);
  text-align: center;
}

.pb-actions {
  margin-top: 4px;
}

.submit-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
}

/* 国家区号下拉（teleported 到 body，需全局样式） */
:global(.phone-binding-country-code-popper) {
  max-height: 300px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  box-shadow: var(--global-box-shadow);
  z-index: var(--z-notification);
}

/* 暗色模式 */
:global(.dark) .phone-binding-page {
  background: var(--el-bg-color-page);
}

:global(.dark) .phone-binding-card {
  background: var(--el-bg-color);
  border-color: var(--el-border-color);
}

:global(.dark) .pb-back-btn {
  background: var(--el-fill-color-dark);
  color: var(--el-text-color-regular);

  &:hover {
    background: var(--el-fill-color);
    color: var(--el-color-primary);
  }
}
</style>
