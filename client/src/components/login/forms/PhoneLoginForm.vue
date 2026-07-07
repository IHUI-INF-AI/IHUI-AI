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
      <el-form-item prop="phoneNumber" class="phone-form-item">
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
          <div class="phone-number-wrapper" @dblclick="handlePhoneDoubleClick">
            <el-input
              id="phone-number"
              name="phone-number"
              v-model="formData.phoneNumber"
              :placeholder="phonePlaceholder"
              maxlength="15"
              clearable
              autocomplete="tel"
              @input="handlePhoneInput"
              @focus="handlePhoneFocus"
              @blur="handlePhoneBlur"
            >
              <template #prefix>
                <component :is="PhoneIcon" class="input-icon" />
              </template>
            </el-input>
            <div v-if="showHistoryPhones" class="history-dropdown" @mousedown.prevent>
              <div v-if="filteredHistoryPhones.length === 0" class="history-empty">
                <span>暂无历史记录</span>
              </div>
              <div v-for="phone in filteredHistoryPhones" :key="phone" class="history-item" @click="selectHistoryPhone(phone)">
                <component :is="ClockIcon" class="history-icon" />
                <span>{{ phone }}</span>
              </div>
            </div>
          </div>
        </div>
      </el-form-item>

      <el-form-item prop="verificationCode">
        <div class="verification-code-block">
          <label class="verification-code-sr-label" for="verification-code-0">
            {{ t('auth.captchaLabel') }}
          </label>
          <div class="verification-code-row">
            <VerificationCodeInput
              v-model="formData.verificationCode"
              :length="6"
              input-id="verification-code"
              :error-message="verificationCodeError"
              @complete="handleVerificationComplete"
              @keyup.enter="handleSubmit"
            />
            <button
              type="button"
              id="send-code-btn"
              class="send-code-btn"
              :disabled="!canSendCode || countdown > 0 || loading || sendingCode"
              :class="{ 'is-disabled': !canSendCode || countdown > 0 || loading, 'is-counting': countdown > 0, 'is-loading': sendingCode }"
              @click="handleSendCode"
            >
              <span v-if="sendingCode" class="send-code-button__spinner" aria-hidden="true"></span>
              <span class="send-code-button__text">
                {{ countdown > 0 ? `${countdown}s 后重发` : (sendingCode ? '发送中' : '获取验证码') }}
              </span>
            </button>
          </div>
        </div>
      </el-form-item>

      <el-form-item prop="agreement" class="agreement-item">
        <label class="custom-checkbox agreement-checkbox">
          <input id="phone-agreement" name="phone-agreement" type="checkbox" v-model="formData.agreement" />
          <span class="checkmark"></span>
          <span class="agreement-text">
            {{ t('auth.agreeTo') }}
            <a href="/terms" target="_blank" class="agreement-link">{{ t('auth.userAgreement') }}</a>
            {{ t('auth.and') }}
            <a href="/privacy" target="_blank" class="agreement-link">{{ t('auth.privacyPolicy') }}</a>
          </span>
        </label>
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
        </el-col>
      </el-row>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'
import { PhoneIcon, ClockIcon } from '@/components/login/icons/login-icons'
import { sendPhoneLoginCode } from '@/api/user'
import { ElMessage } from 'element-plus'
import { logger } from '@/utils/logger'
import { useCleanup } from '@/composables/useCleanup'
import VerificationCodeInput from '@/components/login/VerificationCodeInput.vue'
import { useLoginInputHistory, LOGIN_HISTORY_KEYS, getLoginHistory } from '../composables/useLoginInputHistory'
import { RememberMeService } from '@/utils/rememberMeService'

interface PhoneFormProps {
  loading?: boolean
  phonePlaceholder?: string
  codePlaceholder?: string
}

interface PhoneFormEmits {
  submit: [data: { phoneNumber: string; countryCode: string; verificationCode: string; rememberMe: boolean; agreement: boolean }]
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
const verificationCodeError = ref('')
let countdownTimer: ReturnType<typeof setInterval> | null = null

const cleanup = useCleanup()

const formData = reactive({
  phoneNumber: '',
  countryCode: '+86',
  verificationCode: '',
  rememberMe: false,
  agreement: false,
})

// 2026-07-06: 历史手机号下拉记忆功能 (与账号/邮箱表单共用 useLoginInputHistory composable)
// 登录成功后由 useLoginLogic.handlePhoneLogin 写入 localStorage, 此处负责读取 + 下拉交互
const {
  history: historyPhones,
  showDropdown: showHistoryPhones,
  query: historyPhoneQuery,
  filtered: filteredHistoryPhones,
  reload: initHistoryPhones,
} = useLoginInputHistory({ storageKey: LOGIN_HISTORY_KEYS.phone })

// 2026-07-06: 记住密码功能 - 如果用户之前勾选了记住密码, 自动回填上次登录的手机号
onMounted(() => {
  if (RememberMeService.isRememberMeEnabled()) {
    formData.rememberMe = true
    const history = getLoginHistory(LOGIN_HISTORY_KEYS.phone)
    if (history.length > 0 && !formData.phoneNumber) {
      formData.phoneNumber = history[0]
    }
  }
})

const selectHistoryPhone = (phone: string): void => {
  formData.phoneNumber = phone
  showHistoryPhones.value = false
  historyPhoneQuery.value = ''
  formRef.value?.focus?.()
}

const handlePhoneFocus = (): void => {
  initHistoryPhones()
  // focus 也无条件弹出 (双击或点击都能看到下拉窗)
  showHistoryPhones.value = true
  historyPhoneQuery.value = formData.phoneNumber || ''
}

const handlePhoneBlur = (_evt?: FocusEvent): void => {
  window.setTimeout(() => {
    const relatedTarget = _evt?.relatedTarget as HTMLElement | null
    if (relatedTarget && relatedTarget.closest('.history-dropdown')) {
      return
    }
    showHistoryPhones.value = false
  }, 200)
}

const handlePhoneDoubleClick = (): void => {
  initHistoryPhones()
  // 双击无条件弹出 (无历史记录时显示"暂无历史记录"提示, 方便测试下拉窗样式)
  showHistoryPhones.value = true
  historyPhoneQuery.value = ''
  nextTick(() => {
    const inputElement = document.getElementById('phone-number')
    if (inputElement) {
      inputElement.focus()
    }
  })
}

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
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void): void => {
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
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void): void => {
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

const handlePhoneInput = (value: string): void => {
  const sanitized = value.replace(/[^\d]/g, '')
  if (sanitized !== value) {
    formData.phoneNumber = sanitized
  }
  // 2026-07-06: 输入时实时过滤历史手机号下拉
  historyPhoneQuery.value = sanitized || ''
  showHistoryPhones.value = historyPhones.value.length > 0 && (sanitized === '' || filteredHistoryPhones.value.length > 0)
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
    // 2026-07-06 修复: 调用后端 /api/v1/auth/sms/code 发送验证码 (原 sendVerificationCode 调用 /user/send-code 需要认证)
    await sendPhoneLoginCode(fullPhoneNumber)

    ElMessage.success(t('auth.codeSentSuccess'))
    startCountdown()
  } catch (error: unknown) {
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
      agreement: formData.agreement,
    })
  } catch {
    logger.warn('[PhoneLoginForm] Form validation failed')
  }
}

const handleVerificationComplete = (value: string): void => {
  verificationCodeError.value = ''
  if (value.length === 6 && /^\d{6}$/.test(value)) {
    void handleSubmit()
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
@use '../_login-tokens.scss' as lt;
@use '@/styles/_form-controls.scss' as fc;

.phone-form-container {
  width: 100%;
}

.login-form {
  /* 2026-07-06 修复 v2: 之前 el-form-item { margin-bottom: 0 } 让手机号/验证码输入框紧贴 (距离 0px).
     改为 20px 间距让两个输入框有喘息空间.
     与 AccountLoginForm.vue / EmailLoginForm.vue / RegisterForm.vue 同步. */
  .el-form-item {
    margin-bottom: 20px;
  }

  /* 2026-07-06 v2: agreement-item 不是 form 的 last-child (后面还有 .form-actions-row el-row),
     :last-child 不命中. 必须显式覆盖, 否则下方会多 20px 空白.
     同特异度 (.login-form .agreement-item = .login-form .el-form-item = 0,2,0) 后定义胜出. */
  .agreement-item {
    margin-top: 4px;
    margin-bottom: 0;
  }
}

/* 2026-07-07 修复 v5 (margin-bottom 18px):
   v2/v3/v4 全部失败的真正根因:
     .form-actions-row 是 <el-row> 组件根元素, scoped CSS 选择器
     ".form-actions-row[data-v-xxx]" 在 EP 子组件根元素上**会**命中
     (实测 fa.dataset={} 但 fa.outerHTML 含 data-v-7a7c8a89, dataset 不暴露 data-v-),
     .form-actions-row { margin-top: 8px } 实际是生效的 (getComputedStyle.marginTop = "8px").
     错误文字 .el-form-item__error 是 absolute 定位浮在 .agreement-item 底部.

   真实间距公式 (实测):
     el-form-item 默认 position: relative, 创建 BFC, 阻止 margin collapse
     → fa-top = item-bottom + margin-bottom (item.is-error) + margin-top (form-actions-row)
     = item-bottom + mb + 8px
     err-bottom = item-bottom + 19px (error height)
     gapErrToFa = mb + 8 - 19 = mb - 11

     mb=24 → gap=13 (用户反馈"空余间距"过大)
     mb=18 → gap=7 (当前选择: 紧凑且清晰分离)
     mb=14 → gap=3 (太贴)

   v5 修复: margin-bottom: 18px → 视觉间距 7px.

   不报错时 .agreement-item 仍 margin-bottom: 0 (.login-form 块内覆盖), 紧凑布局不变.
   必须在 .login-form 块**外**定义, 同特异度后定义胜出 (v2 实测: 嵌套会让 Vite 跳过此条规则).
   与 AccountLoginForm.vue / EmailLoginForm.vue 同步. */
.agreement-item.is-error {
  margin-bottom: 18px;
}

.phone-input-wrapper {
  display: flex;
  gap: 8px;
  width: 100%;
}

// 2026-07-07 修复: 解决 .history-dropdown 被下一行 el-form-item 的 el-input__wrapper 遮挡
// 根因链:
//   1) el-form-item 自身默认无 position/transform/opacity, 普通块级元素不创建 stacking context.
//      此时即便声明 z-index 也不会参与层叠比较 (z-index 仅对 positioned 元素有效).
//   2) .el-input__wrapper 主题强制 `transform: translate(0,0)` → 内部 stacking context (z-auto=0).
//   3) 下一行 el-form-item 内的 el-input__wrapper 仍按 DOM 顺序画在 .phone-form-item 之后,
//      直接把下拉窗盖住.
// 修复: 必须 .phone-form-item 加 `position: relative; z-index: var(--z-base)`,
//   显式创建 stacking context 并浮在下一行 form-item (z-auto=0) 之上.
//   .phone-number-wrapper 同理 (wrapper 内部: el-input__wrapper 的 transform
//   不会压住 .history-dropdown, 因为 dropdown 的 z=2001 在 wrapper 的 stacking context 内胜出).
// 取值: --z-base (1) 即可超过下一行 form-item (z-auto=0), 不需要更大的值.
.phone-form-item {
  position: relative;
  z-index: var(--z-base);
}

.phone-number-wrapper {
  position: relative;
  z-index: var(--z-base);
  flex: 1;
  min-width: 0;
}

// 2026-07-06: 历史手机号下拉窗 (样式与 AccountLoginForm / EmailLoginForm 一致, 全部用项目 token, 不引入新色值)
// 2026-07-07 修复: 背景改用 --el-bg-color (弹窗同色) + 强 box-shadow, 杜绝"下拉窗透弹窗底色"视觉错觉.
//   之前用 --el-fill-color 跟弹窗 --el-bg-color 颜色太接近, 边缘几乎看不出.
.history-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.16);
  z-index: var(--z-popover);
  max-height: 200px;
  overflow-y: auto;
  opacity: 1;
  backdrop-filter: none;
}

.history-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
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
    width: 16px;
    height: 16px;
  }
}

// 2026-07-06 v4: 国码下拉框宽度收到 76px (只显示 "+86" + chevron), 高度 44px 跟手机号输入框一致
// - 样式 target: .el-select__wrapper (新版 element-plus, 旧 .el-input__wrapper 已不适用)
// - 高度锁 44px: 必须同时锁 .el-select 外层, 否则外层 44px + wrapper 44px + line-height 偏差会
//   让 el-select 容器自己撑出 4px 高度, 露出 el-select 默认 background-color (暗色下 rgb(26,26,26)
//   跟弹窗底色不同, 在 hover 时尤其明显 —— 用户反馈"hover时还有背景色在下面漏出个边")
// - :deep() 嵌套进 .el-select__wrapper 处理 .el-popper 弹层 z-index 留位
.country-code-select {
  width: 76px;
  flex-shrink: 0;

  :deep(.el-select) {
    height: 44px;
    line-height: 44px;
    background-color: transparent;
  }

  :deep(.el-select__wrapper) {
    border: 1px solid lt.$login-input-bw-border;
    border-radius: var(--global-border-radius);
    background-color: lt.$login-input-bw-bg;
    box-shadow: none;
    transition: border-color 0.2s ease;
    min-height: 44px;
    padding-left: 11px;
    padding-right: 11px;
  }

  &:hover :deep(.el-select__wrapper) {
    border-color: lt.$login-input-bw-border-hover;
  }

  &.is-focused :deep(.el-select__wrapper) {
    border-color: lt.$login-input-bw-border-focus;
  }
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

// 2026-07-06 v2: 把"获取验证码"按钮放到 6 个输入框右侧 (用户原话: 别单独一排 很难看啊),
//   桌面端用 38x52 + 6px gap 让 6 个输入框 + 84px 按钮横排放进 352px 内容区,
//   移动端 ≤480px 自动 wrap, 按钮换行右对齐
.verification-code-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  // 2026-07-06: 删掉 .verification-code-footer 辅助提示后, 验证码行直接跟在手机号输入框下方,
  // 沿用 el-form-item 的 20px margin-bottom 标准间距, 不再需要负 margin 上提.
  margin-top: 0;
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

.verification-code-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;

  // 桌面端缩小 digit 尺寸 + 缩小 gap, 让 6 个输入框 + 按钮一行排开
  // 默认 42x56 + gap 8px = 292px, + 按钮 100px = 392px 超出 352px 内容区
  // 改为 38x52 + gap 6px = 258px, + 按钮 84px + gap 8px = 350px ✓
  :deep(.verification-code-inputs) {
    gap: 6px;
  }

  :deep(.verification-code-digit) {
    width: 38px;
    flex: 0 0 38px;
    height: 52px;
    font-size: 22px;
  }

  .send-code-btn {
    // 2026-07-06 修复: 引入项目统一 send-code-button mixin (背景容器色 + 描边 + hover/active/focus/disabled 全状态)
    // 之前只写了布局属性, 从未 @include mixin, 导致按钮裸奔 (无背景无描边无 hover)
    @include fc.send-code-button-base;
    @include fc.send-code-button-dark;
    // 布局覆盖: 不跟验证码输入框等高 (52px 太高), 用 mixin 原始 40px (跟 el-input 一致), 收窄宽度适配 352px 内容区
    flex: 0 0 auto;
    min-width: 84px;
    height: 40px;
    padding: 0 12px;
  }

  // 移动端 ≤480px: 验证码自动用 40x52 + gap 6px (verification-code-mobile mixin),
  //   6 × 40 + 5 × 6 + 84 + 8 = 362px 超出移动端 328px 内容区, 按钮自动 wrap 换行右对齐
  @media (max-width: 480px) {
    flex-wrap: wrap;

    .send-code-btn {
      margin-left: auto;
    }
  }
}

// 2026-07-06 v2: agreement 复选框与 rememberMe 复选框之间垂直距离过大 (16px → 8px, 缩小一半)
.form-actions-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.custom-checkbox {
  // 2026-07-06 v4 统一: 改用 _form-controls.scss 统一来源
  // 18x18 大小 + 4px 方形小圆角 + 1.3s 缓慢变色 + 3D 旋转, 全项目唯一来源
  @include fc.custom-checkbox-base;
  @include fc.custom-checkbox-dark;
}

.remember-me-text {
  font-size: 14px;
  color: var(--el-text-color-regular);
}

/* 2026-07-06 v2: .agreement-item 已迁到 .login-form 作用域内 (上方), 提升特异度覆盖 .el-form-item { margin-bottom: 20px } */

.agreement-checkbox {
  @include fc.custom-checkbox-base;
  @include fc.custom-checkbox-dark;
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

.phone-form-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.text-right {
  text-align: right;
}
</style>
