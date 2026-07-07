<!--
  EmailLoginForm - 邮箱验证码登录表单
  参考 PhoneLoginForm 实现, 调用后端 /api/v1/auth/email/code 发送验证码 + /api/v1/auth/login/email 验证登录.
  2026-07-04 立, 用户规则: 接入已有后端邮箱登录接口, Tab 三选一 (账号/手机/邮箱).
-->
<template>
  <div class="email-form-container">
    <el-form
      id="email-login-form"
      :model="formData"
      :rules="formRules"
      ref="formRef"
      class="login-form"
      autocomplete="on"
      @submit.prevent="handleSubmit"
    >
      <el-form-item prop="email" class="email-form-item">
        <div class="email-input-wrapper" @dblclick="handleEmailDoubleClick">
          <el-input
            id="email-address"
            name="email-address"
            v-model="formData.email"
            :placeholder="emailPlaceholder"
            maxlength="100"
            clearable
            autocomplete="email"
            @input="handleEmailInput"
            @focus="handleEmailFocus"
            @blur="handleEmailBlur"
            @keyup.enter="focusCodeInput"
          >
            <template #prefix>
              <component :is="MailIcon" class="input-icon" />
            </template>
          </el-input>
          <div v-if="showHistoryEmails" class="history-dropdown" @mousedown.prevent>
            <div v-if="filteredHistoryEmails.length === 0" class="history-empty">
              <span>暂无历史记录</span>
            </div>
            <div v-for="email in filteredHistoryEmails" :key="email" class="history-item" @click="selectHistoryEmail(email)">
              <component :is="ClockIcon" class="history-icon" />
              <span>{{ email }}</span>
            </div>
          </div>
        </div>
      </el-form-item>

      <el-form-item prop="verificationCode">
        <div class="verification-code-block">
          <label class="verification-code-sr-label" for="email-verification-code-0">
            {{ t('auth.captchaLabel') }}
          </label>
          <div class="verification-code-row">
            <VerificationCodeInput
              ref="verificationCodeInputRef"
              v-model="formData.verificationCode"
              :length="6"
              input-id="email-verification-code"
              :error-message="verificationCodeError"
              @complete="handleVerificationComplete"
              @keyup.enter="handleSubmit"
            />
            <button
              type="button"
              id="send-email-code-btn"
              class="send-code-btn"
              :disabled="!canSendCode || countdown > 0 || loading || sendingCode"
              :class="{
                'is-disabled': !canSendCode || countdown > 0 || loading,
                'is-counting': countdown > 0,
                'is-loading': sendingCode
              }"
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
          <input id="email-agreement" name="email-agreement" type="checkbox" v-model="formData.agreement" />
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
            <input id="email-remember-me" name="email-remember-me" type="checkbox" v-model="formData.rememberMe" />
            <span class="checkmark"></span>
            <span class="remember-me-text">{{ t('auth.autoLogin') }}</span>
          </label>
        </el-col>
        <el-col :span="12" class="text-right email-form-actions">
        </el-col>
      </el-row>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'
import { MailIcon, ClockIcon } from '@/components/login/icons/login-icons'
import { sendEmailLoginCode } from '@/api/user'
import { ElMessage } from 'element-plus'
import { logger } from '@/utils/logger'
import { useCleanup } from '@/composables/useCleanup'
import VerificationCodeInput from '@/components/login/VerificationCodeInput.vue'
import request from '@/utils/request'
import { LOGIN_PWD_PATHS } from '@/config/backend-paths'
import { useLoginInputHistory, LOGIN_HISTORY_KEYS, getLoginHistory } from '../composables/useLoginInputHistory'
import { RememberMeService } from '@/utils/rememberMeService'

interface EmailFormProps {
  loading?: boolean
  emailPlaceholder?: string
  codePlaceholder?: string
}

interface EmailFormEmits {
  submit: [data: { email: string; verificationCode: string; rememberMe: boolean; agreement: boolean }]
}

const props = withDefaults(defineProps<EmailFormProps>(), {
  loading: false,
  emailPlaceholder: '',
  codePlaceholder: '',
})

const emit = defineEmits<EmailFormEmits>()

const { t } = useI18n()

const formRef = ref<FormInstance | undefined>(undefined)
const verificationCodeInputRef = ref<{ focus?: () => void; clear?: () => void } | null>(null)
const countdown = ref(0)
const sendingCode = ref(false)
const verificationCodeError = ref('')
let countdownTimer: ReturnType<typeof setInterval> | null = null

const cleanup = useCleanup()

const formData = reactive({
  email: '',
  verificationCode: '',
  rememberMe: false,
  agreement: false,
})

// 2026-07-06: 历史邮箱下拉记忆功能 (与账号/手机表单共用 useLoginInputHistory composable)
// 登录成功后由 useLoginLogic.handleEmailLogin 写入 localStorage, 此处负责读取 + 下拉交互
const {
  history: historyEmails,
  showDropdown: showHistoryEmails,
  query: historyEmailQuery,
  filtered: filteredHistoryEmails,
  reload: initHistoryEmails,
} = useLoginInputHistory({ storageKey: LOGIN_HISTORY_KEYS.email })

// 2026-07-06: 记住密码功能 - 如果用户之前勾选了记住密码, 自动回填上次登录的邮箱
onMounted(() => {
  if (RememberMeService.isRememberMeEnabled()) {
    formData.rememberMe = true
    const history = getLoginHistory(LOGIN_HISTORY_KEYS.email)
    if (history.length > 0 && !formData.email) {
      formData.email = history[0]
    }
  }
})

const selectHistoryEmail = (email: string): void => {
  formData.email = email
  showHistoryEmails.value = false
  historyEmailQuery.value = ''
  formRef.value?.focus?.()
}

const handleEmailInput = (val: string): void => {
  historyEmailQuery.value = val || ''
  showHistoryEmails.value = historyEmails.value.length > 0 && (val === '' || filteredHistoryEmails.value.length > 0)
}

const handleEmailFocus = (): void => {
  initHistoryEmails()
  // focus 也无条件弹出 (双击或点击都能看到下拉窗)
  showHistoryEmails.value = true
  historyEmailQuery.value = formData.email || ''
}

const handleEmailBlur = (_evt?: FocusEvent): void => {
  window.setTimeout(() => {
    const relatedTarget = _evt?.relatedTarget as HTMLElement | null
    if (relatedTarget && relatedTarget.closest('.history-dropdown')) {
      return
    }
    showHistoryEmails.value = false
  }, 200)
}

const handleEmailDoubleClick = (): void => {
  initHistoryEmails()
  // 双击无条件弹出 (无历史记录时显示"暂无历史记录"提示, 方便测试下拉窗样式)
  showHistoryEmails.value = true
  historyEmailQuery.value = ''
  nextTick(() => {
    const inputElement = document.getElementById('email-address')
    if (inputElement) {
      inputElement.focus()
    }
  })
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

const canSendCode = computed(() => {
  const email = formData.email.trim()
  return EMAIL_REGEX.test(email)
})

const sendCodeText = computed(() => t('login.buttons.sendCode'))
const emailPlaceholder = computed(() => props.emailPlaceholder || t('auth.emailPlaceholder'))
const codePlaceholder = computed(() => props.codePlaceholder || t('login.placeholders.emailCode'))

const formRules = computed((): FormRules => ({
  email: [
    { required: true, message: t('auth.pleaseEnterEmail'), trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void): void => {
        if (!value) {
          callback()
          return
        }
        if (!EMAIL_REGEX.test(value.trim())) {
          callback(new Error(t('auth.pleaseEnterCorrectEmail')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  verificationCode: [
    { required: true, message: t('login.placeholders.emailCode'), trigger: 'blur' },
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

const focusCodeInput = async (): Promise<void> => {
  await nextTick()
  verificationCodeInputRef.value?.focus?.()
}

const handleSendCode = async (): Promise<void> => {
  if (!canSendCode.value || countdown.value > 0) return

  try {
    await formRef.value?.validateField('email')
  } catch {
    return
  }

  sendingCode.value = true

  try {
    // 2026-07-06 修复: 调用后端 /api/v1/auth/email/code 发送验证码 (原 sendVerificationCode 调用 /user/send-code 需要认证)
    await sendEmailLoginCode(formData.email.trim().toLowerCase())

    ElMessage.success(t('auth.codeSentSuccess'))
    startCountdown()
    focusCodeInput()
  } catch (error: unknown) {
    logger.error('[EmailLoginForm] Failed to send email verification code', error)
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
    emit('submit', {
      email: formData.email.trim().toLowerCase(),
      verificationCode: formData.verificationCode.trim(),
      rememberMe: formData.rememberMe,
      agreement: formData.agreement,
    })
  } catch {
    logger.warn('[EmailLoginForm] Form validation failed')
  }
}

// 2026-07-06: 6 位验证码输入完成后自动提交 (与 PhoneLoginForm 行为一致)
const handleVerificationComplete = (value: string): void => {
  verificationCodeError.value = ''
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

.email-form-container {
  width: 100%;
}

// 2026-07-07 修复: 解决 .history-dropdown 被下一行 el-form-item 的 el-input__wrapper 遮挡
// 根因链:
//   1) el-form-item 自身默认无 position/transform/opacity, 普通块级元素不创建 stacking context.
//      此时即便声明 z-index 也不会参与层叠比较 (z-index 仅对 positioned 元素有效).
//   2) .el-input__wrapper 主题强制 `transform: translate(0,0)` → 内部 stacking context (z-auto=0).
//   3) 下一行 el-form-item 内的 el-input__wrapper 仍按 DOM 顺序画在 .email-form-item 之后,
//      直接把下拉窗盖住.
// 修复: 必须 .email-form-item 加 `position: relative; z-index: var(--z-base)`,
//   显式创建 stacking context 并浮在下一行 form-item (z-auto=0) 之上.
//   .email-input-wrapper 同理 (wrapper 内部: el-input__wrapper 的 transform
//   不会压住 .history-dropdown, 因为 dropdown 的 z=2001 在 wrapper 的 stacking context 内胜出).
// 取值: --z-base (1) 即可超过下一行 form-item (z-auto=0), 不需要更大的值.
.email-form-item {
  position: relative;
  z-index: var(--z-base);
}

.email-input-wrapper {
  position: relative;
  z-index: var(--z-base);
  width: 100%;
}

// 2026-07-06: 历史邮箱下拉窗 (样式与 AccountLoginForm / PhoneLoginForm 一致, 全部用项目 token, 不引入新色值)
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

.login-form {
  // 2026-07-06 修复 v2: 之前 el-form-item { margin-bottom: 0 } 让邮箱/验证码输入框紧贴 (距离 0px).
  // 改为 20px 间距让两个输入框有喘息空间.
  // 与 AccountLoginForm.vue / PhoneLoginForm.vue / RegisterForm.vue 同步.
  .el-form-item {
    margin-bottom: 20px;
  }

  // 2026-07-06 v2: agreement-item 不是 form 的 last-child (后面还有 .form-actions-row el-row),
  // :last-child 不命中. 必须显式覆盖, 否则下方会多 20px 空白.
  // 同特异度 (.login-form .agreement-item = .login-form .el-form-item = 0,2,0) 后定义胜出.
  .agreement-item {
    margin-top: 4px;
    margin-bottom: 0;
  }
}

// 2026-07-07 修复 v5 (margin-bottom 18px):
//   v2/v3/v4 全部失败的真正根因:
//     .form-actions-row 是 <el-row> 组件根元素, scoped CSS 选择器
//     ".form-actions-row[data-v-xxx]" 在 EP 子组件根元素上**会**命中
//     (实测 fa.dataset={} 但 fa.outerHTML 含 data-v-7a7c8a89, dataset 不暴露 data-v-),
//     .form-actions-row { margin-top: 8px } 实际是生效的 (getComputedStyle.marginTop = "8px").
//     错误文字 .el-form-item__error 是 absolute 定位浮在 .agreement-item 底部.
//
//   真实间距公式 (实测):
//     el-form-item 默认 position: relative, 创建 BFC, 阻止 margin collapse
//     → fa-top = item-bottom + margin-bottom (item.is-error) + margin-top (form-actions-row)
//     = item-bottom + mb + 8px
//     err-bottom = item-bottom + 19px (error height)
//     gapErrToFa = mb + 8 - 19 = mb - 11
//
//     mb=24 → gap=13 (用户反馈"空余间距"过大)
//     mb=18 → gap=7 (当前选择: 紧凑且清晰分离)
//     mb=14 → gap=3 (太贴)
//
//   v5 修复: margin-bottom: 18px → 视觉间距 7px.
//
//   不报错时 .agreement-item 仍 margin-bottom: 0 (.login-form 块内覆盖), 紧凑布局不变.
//   必须在 .login-form 块**外**定义, 同特异度后定义胜出 (v2 实测: 嵌套会让 Vite 跳过此条规则).
//   与 AccountLoginForm.vue / PhoneLoginForm.vue 同步.
.agreement-item.is-error {
  margin-bottom: 18px;
}

// 2026-07-06: 邮箱验证码改用 6 位分格输入框 (VerificationCodeInput), 布局与 PhoneLoginForm 完全一致
// 2026-07-06 v2: 把"获取验证码"按钮放到 6 个输入框右侧 (用户原话: 别单独一排 很难看啊),
//   桌面端用 38x52 + 6px gap 让 6 个输入框 + 84px 按钮横排放进 352px 内容区,
//   移动端 ≤480px 自动 wrap, 按钮换行右对齐
.verification-code-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  // 2026-07-06: 提示文字移到验证码上方后, 上方 el-form-item[email] 的 margin-bottom: 20px
  // 导致提示文字离邮箱输入框太远. 负 margin 抵消 16px, 只留 4px 让提示文字贴近输入框.
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

// 2026-07-06 v2: .agreement-item 已迁到 .login-form 作用域内 (上方), 提升特异度覆盖 .el-form-item { margin-bottom: 20px }

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

.text-right {
  text-align: right;
}
</style>
