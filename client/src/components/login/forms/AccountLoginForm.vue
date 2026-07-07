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
        <div class="username-input-wrapper" @dblclick="handleUsernameDoubleClick">
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
          >
            <template #prefix>
              <component :is="UserIcon" class="input-icon" />
            </template>
          </el-input>
          <div v-if="showHistoryAccounts" class="history-dropdown" @mousedown.prevent>
            <div v-if="filteredHistoryAccounts.length === 0" class="history-empty">
              <span>暂无历史记录</span>
            </div>
            <div v-for="account in filteredHistoryAccounts" :key="account" class="history-item" @click="selectHistoryAccount(account)">
              <component :is="ClockIcon" class="history-icon" />
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
            <component :is="LockIcon" class="input-icon" />
          </template>
          <template #suffix>
            <label class="password-eye-container" @click.stop>
              <input type="checkbox" :checked="passwordVisible" @change="togglePasswordVisibility" tabindex="-1" />
              <component :is="EyeIcon" class="eye" />
              <component :is="EyeOffIcon" class="eye-slash" />
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

      <el-form-item prop="agreement" class="agreement-item">
        <label class="custom-checkbox agreement-checkbox">
          <input id="account-agreement" name="account-agreement" type="checkbox" v-model="formData.agreement" />
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
            <input id="account-remember-me" name="account-remember-me" type="checkbox" v-model="formData.rememberMe" />
            <span class="checkmark"></span>
            <span class="remember-me-text">{{ t('auth.autoLogin') }}</span>
          </label>
        </el-col>
        <el-col :span="12" class="text-right account-form-actions">
          <span class="switch-to-sso-link" @click="handleSSOClick">
            {{ ssoLinkText }}
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
import { ref, reactive, computed, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules, FormItemRule } from 'element-plus'
import {
  UserIcon,
  LockIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
} from '@/components/login/icons/login-icons'
import CaptchaInput from '../components/CaptchaInput.vue'
import { FormValidator } from '@/utils/formValidation'
import { InputValidator } from '@/utils/security'
import { useLoginInputHistory, LOGIN_HISTORY_KEYS, getLoginHistory } from '../composables/useLoginInputHistory'
import { RememberMeService } from '@/utils/rememberMeService'
import { logger } from '@/utils/logger'

interface AccountFormProps {
  isDarkMode?: boolean
  showCaptcha?: boolean
  isEnterpriseMode?: boolean
  placeholder?: string
  passwordPlaceholder?: string
}

interface AccountFormEmits {
  submit: [data: { username: string; password: string; rememberMe: boolean; captcha: string; agreement: boolean }]
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
  agreement: false,
})

const passwordStrength = reactive({
  show: false,
  level: 'weak' as 'weak' | 'medium' | 'strong',
  width: 0,
  text: '',
})

// 2026-07-06: 历史账号下拉记忆功能, 数据层抽到 useLoginInputHistory composable 统一管理
// (账号/手机号/邮箱三个登录表单共用同一套读取+过滤+交互逻辑, 登录成功后由 useLoginLogic 写入)
const {
  history: historyAccounts,
  showDropdown: showHistoryAccounts,
  query: historyAccountQuery,
  filtered: filteredHistoryAccounts,
  reload: initHistoryAccounts,
} = useLoginInputHistory({ storageKey: LOGIN_HISTORY_KEYS.account })

// 2026-07-06: 记住密码功能 - 如果用户之前勾选了记住密码, 自动回填上次登录的账号
onMounted(() => {
  if (RememberMeService.isRememberMeEnabled()) {
    formData.rememberMe = true
    const history = getLoginHistory(LOGIN_HISTORY_KEYS.account)
    if (history.length > 0 && !formData.username) {
      formData.username = history[0]
    }
  }
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
  // focus 也无条件弹出 (双击或点击都能看到下拉窗)
  showHistoryAccounts.value = true
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
  // 双击无条件弹出 (无历史记录时显示"暂无历史记录"提示, 方便测试下拉窗样式)
  showHistoryAccounts.value = true
  historyAccountQuery.value = ''
  nextTick(() => {
    const inputElement = document.getElementById('account-username')
    if (inputElement) {
      inputElement.focus()
    }
  })
}

const formRules = computed((): FormRules => ({
  username: [
    { required: true, message: t('auth.usernameOrPhoneOrEmail'), trigger: 'blur' },
    {
      validator: (_rule: FormItemRule, value: string, callback: (error?: Error) => void): void => {
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
      validator: (_rule: FormItemRule, value: string, callback: (error?: Error) => void): void => {
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
      validator: (_rule: FormItemRule, value: string, callback: (error?: Error) => void): void => {
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
  agreement: [
    {
      validator: (_rule: FormItemRule, value: boolean, callback: (error?: Error) => void): void => {
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
@use '../_login-tokens.scss' as lt;
@use '@/styles/_form-controls.scss' as fc;

.account-form-container {
  width: 100%;
}

.login-form {
  // 2026-07-06 修复 v2: 之前 el-form-item margin-bottom 为 0 让账号/密码输入框紧贴 (距离 0px),
  // 用户反馈依旧还是挨着的输入框. 改为 20px 间距让两个输入框有喘息空间.
  // UniversalLogin.vue 的 form-area gap 只控制外层 (tab-switcher / form-container / submit-btn) 间距,
  // 不影响 form-container 内部的两个 el-form-item, 必须在这里加 margin-bottom.
  .el-form-item {
    margin-bottom: 20px;
  }

  // 2026-07-06 v2: agreement-item 是最后一个 el-form-item, 但 DOM 顺序上不是 form 的 last-child
  // (后面还有 .form-actions-row el-row). EP 默认 .el-form-item margin-bottom 18px +
  // 上面 20px 规则, agreement-item 必须显式覆盖为 0, 否则下方会多 20px 空白.
  // 特异度 .login-form .agreement-item 高于 .login-form .el-form-item, 同特异度后定义胜出.
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
//     mb=24 → gap=13 (用户反馈"空余间距"过大, 因为错误文字属于 agreement 组, 下方
//                  13px 视觉空白显得"空旷")
//     mb=18 → gap=7 (当前选择: 仍能让错误文字与"自动登录"行视觉分离, 不会有
//                  13px 的"空着"感, 又比 5px 多一点呼吸)
//     mb=14 → gap=3 (太贴, 容易让人觉得"文字贴在自动登录上")
//
//   v5 修复: margin-bottom: 18px → 视觉间距 7px (紧凑且清晰分离).
//
//   不报错时 .agreement-item 仍 margin-bottom: 0 (.login-form 块内覆盖), 紧凑布局不变.
//   必须在 .login-form 块**外**定义, 同特异度后定义胜出 (v2 实测: 嵌套会让 Vite 跳过此条规则).
//   与 PhoneLoginForm.vue / EmailLoginForm.vue 同步.
.agreement-item.is-error {
  margin-bottom: 18px;
}

// 2026-07-07 修复: 解决 .history-dropdown 被下一行 el-form-item 的 el-input__wrapper 遮挡
// 根因链:
//   1) el-form-item 自身默认无 position/transform/opacity, 普通块级元素不创建 stacking context.
//      此时即便声明 z-index 也不会参与层叠比较 (z-index 仅对 positioned 元素有效).
//   2) .el-input__wrapper 主题强制 `transform: translate(0,0)` → 内部 stacking context (z-auto=0).
//   3) 下一行 el-form-item 内的 el-input__wrapper 仍按 DOM 顺序画在 .username-form-item 之后,
//      直接把下拉窗盖住.
// 修复: 必须 .username-form-item 加 `position: relative; z-index: var(--z-base)`,
//   显式创建 stacking context 并浮在下一行 form-item (z-auto=0) 之上.
//   .username-input-wrapper 同理 (wrapper 内部: el-input__wrapper 的 transform
//   不会压住 .history-dropdown, 因为 dropdown 的 z=2001 在 wrapper 的 stacking context 内胜出).
// 取值: --z-base (1) 即可超过下一行 form-item (z-auto=0), 不需要更大的值.
.username-form-item {
  position: relative;
  z-index: var(--z-base);
}

.username-input-wrapper {
  position: relative;
  z-index: var(--z-base);
  width: 100%;
}

.history-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  // 2026-07-07 修复: 背景改用 --el-bg-color (弹窗同色) + 强 box-shadow, 杜绝"下拉窗透弹窗底色"视觉错觉.
  // 之前用 --el-fill-color (浅色 #f0f2f5 / 暗色 #2d2d2d), 跟弹窗 --el-bg-color (浅色 #f7f8fa / 暗色 #1a1a1a) 太接近,
  // 边缘几乎看不出, 看起来像"透明"穿透.
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

// 2026-07-06 v2: agreement 复选框与 rememberMe 复选框之间垂直距离过大 (16px → 8px, 缩小一半)
.form-actions-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

// 2026-07-06 v4 统一: .custom-checkbox 样式统一切到 _form-controls.scss
// 18x18 大小 + 4px 方形小圆角 + 1.3s 缓慢变色 + 3D 旋转, 全项目唯一来源
// (24x24 偏大问题已修复: 18x18 与 14px 文字匹配度更好)
.custom-checkbox {
  @include fc.custom-checkbox-base;
  @include fc.custom-checkbox-dark;
}

.remember-me-text {
  font-size: 14px;
  color: var(--el-text-color-regular);
}

// 2026-07-06 v2: .agreement-item 已迁到 .login-form 作用域内 (上方 line 408),
// 提升特异度覆盖 .el-form-item { margin-bottom: 20px }, 旧位置不再定义.

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

.account-form-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  justify-content: flex-end;
}

.switch-to-sso-link,
.forgot-password {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.2s;

  &:hover {
    color: var(--el-text-color-primary);
  }
}

.text-right {
  text-align: right;
}
</style>
