<!--
  UniversalLogin - 通用登录/注册组件（弹窗内嵌版本）
  被 LoginDialog.vue 包裹在 el-dialog 中使用。
  支持账号登录、手机号登录、注册模式切换、第三方登录、项目选择。
  暴露 reset() 方法供 LoginDialog 在关闭时清空表单。
-->
<template>
  <div
    class="login-content universal-login"
    :class="{ 'dark-mode': isDarkMode, 'register-mode': isRegisterMode }"
  >
    <!-- 关闭按钮 -->
    <button class="close-btn" type="button" :aria-label="closeLabel" @click="handleClose">
      <el-icon :size="18"><Close /></el-icon>
    </button>

    <!-- 品牌标识 -->
    <LoginBrandUniversal :is-register-mode="isRegisterMode" />

    <!-- 项目选择横幅 -->
    <ProjectSelectorBanner
      v-if="showProjectBanner"
      :available-projects="projectBannerProps.availableProjects"
      :selected-project="projectBannerProps.selectedProject"
      :select-text="projectBannerProps.selectText"
      @select="onProjectSelect"
    />

    <!-- 表单区域 -->
    <div class="form-area">
      <!-- 标签切换（登录/注册 + 账号/手机号） -->
      <TabSwitcher
        :active-tab="activeTab"
        :is-register-mode="isRegisterMode"
        @update:active-tab="handleActiveTabChange"
        @update:register-mode="updateRegisterMode"
      />

      <!-- 账号登录表单 -->
      <AccountLoginForm
        v-if="!isRegisterMode && activeTab === 'account'"
        ref="accountLoginFormRef"
        :is-dark-mode="isDarkMode"
        :show-captcha="showCaptcha"
        @submit="onAccountLoginSubmit"
        @update:active-tab="handleActiveTabChange"
        @forgot-password="onForgotPassword"
        @sso-click="onSSOClick"
      />

      <!-- 手机号登录表单 -->
      <PhoneLoginForm
        v-else-if="!isRegisterMode && activeTab === 'phone'"
        ref="phoneLoginFormRef"
        :loading="loginLoading"
        @submit="onPhoneLoginSubmit"
        @update:active-tab="handleActiveTabChange"
      />

      <!-- 邮箱登录表单 -->
      <EmailLoginForm
        v-else-if="!isRegisterMode && activeTab === 'email'"
        ref="emailLoginFormRef"
        :loading="loginLoading"
        @submit="onEmailLoginSubmit"
      />

      <!-- 注册表单 -->
      <RegisterForm
        v-else-if="isRegisterMode"
        ref="registerFormRef"
        :loading="registerLoading"
        @submit="onRegisterSubmit"
      />

      <!-- 提交按钮 -->
      <el-button
        v-if="!isRegisterMode && activeTab === 'account'"
        type="primary"
        size="large"
        class="submit-btn"
        :loading="loginLoading"
        @click="submitAccountLogin"
      >
        {{ loginBtnLabel }}
      </el-button>
      <el-button
        v-else-if="!isRegisterMode && activeTab === 'phone'"
        type="primary"
        size="large"
        class="submit-btn"
        :loading="loginLoading"
        @click="submitPhoneLogin"
      >
        {{ loginBtnLabel }}
      </el-button>
      <el-button
        v-else-if="!isRegisterMode && activeTab === 'email'"
        type="primary"
        size="large"
        class="submit-btn"
        :loading="loginLoading"
        @click="submitEmailLogin"
      >
        {{ loginBtnLabel }}
      </el-button>
      <el-button
        v-else-if="isRegisterMode"
        type="primary"
        size="large"
        class="submit-btn"
        :loading="registerLoading"
        @click="submitRegister"
      >
        {{ registerBtnLabel }}
      </el-button>

      <!-- 第三方登录（仅登录模式） -->
      <ThirdPartyLoginUniversal
        v-if="!isRegisterMode"
        @method-success="onThirdPartySuccess"
      />
    </div>

    <!-- 协议确认弹窗（append-to-body，需要 global 样式覆盖） -->
    <el-dialog
      v-model="showAgreementDialog"
      class="agreement-confirm-dialog-wrapper"
      :show-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :append-to-body="true"
      :align-center="true"
      width="400px"
      role="dialog"
      aria-modal="true"
    >
      <div class="agreement-confirm-dialog-container">
        <div class="agreement-confirm-icon-badge">
          <el-icon :size="24"><DocumentChecked /></el-icon>
        </div>
        <p class="agreement-confirm-text">{{ agreementText }}</p>
        <div class="agreement-confirm-links">
          <a class="agreement-link-item" href="#" @click.prevent="openTerms">{{ termsLabel }}</a>
          <span class="agreement-confirm-separator">&amp;</span>
          <a class="agreement-link-item" href="#" @click.prevent="openPrivacy">{{ privacyLabel }}</a>
        </div>
      </div>
      <template #footer>
        <div class="agreement-confirm-footer">
          <el-button class="agreement-cancel-button" @click="cancelAgreement">{{ cancelLabel }}</el-button>
          <el-button class="agreement-agree-button" type="primary" @click="confirmAgreement">{{ agreeLabel }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, type FormInstance } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import { DocumentChecked } from '@/lib/lucide-fallback'
import LoginBrandUniversal from './LoginBrandUniversal.vue'
import TabSwitcher from './components/TabSwitcher.vue'
import AccountLoginForm from './forms/AccountLoginForm.vue'
import PhoneLoginForm from './forms/PhoneLoginForm.vue'
import EmailLoginForm from './forms/EmailLoginForm.vue'
import RegisterForm from './forms/RegisterForm.vue'
import ThirdPartyLoginUniversal from './ThirdPartyLoginUniversal.vue'
import ProjectSelectorBanner from './ProjectSelectorBanner.vue'
import { useLoginLogic } from './composables/useLoginLogic'
import { useRegisterLogic } from './composables/useRegisterLogic'
import { useAuthStore } from '@/stores/auth'
import { logger } from '@/utils/logger'

// ------------------------------------------------------------------
// Props / Emits
// ------------------------------------------------------------------

interface ProjectSelectorProps {
  isMobile: boolean
  currentSource: string | null
  selectProjectText: string
  availableProjects: Array<{ key: string; name: string }>
  selectedProject: string
  selectProject: (key: string) => void
}

interface UniversalLoginProps {
  mode?: 'login' | 'register'
  projectSelectorProps?: ProjectSelectorProps
}

const props = withDefaults(defineProps<UniversalLoginProps>(), {
  mode: 'login',
  projectSelectorProps: () => ({}) as ProjectSelectorProps,
})

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const authStore = useAuthStore()

// ------------------------------------------------------------------
// Composables
// ------------------------------------------------------------------

const showCaptcha = ref(false)
const captchaKey = ref('')

const {
  loading: loginLoading,
  handleAccountLogin,
  handlePhoneLogin,
  handleEmailLogin,
} = useLoginLogic({ showCaptcha, captchaKey })

const {
  loading: registerLoading,
  formData: registerFormData,
  handleAccountRegister,
  resetForm: resetRegisterForm,
} = useRegisterLogic({ captchaKey })

// ------------------------------------------------------------------
// State
// ------------------------------------------------------------------

const activeTab = ref<'account' | 'phone' | 'email'>('account')
const isRegisterMode = ref(props.mode === 'register')
const showAgreementDialog = ref(false)
const agreementText = ref('')
const pendingAction = ref<(() => void) | null>(null)

// 表单实例引用
const accountLoginFormRef = ref<FormInstance | null>(null)
const phoneLoginFormRef = ref<FormInstance | null>(null)
const emailLoginFormRef = ref<FormInstance | null>(null)
const registerFormRef = ref<FormInstance | null>(null)

// ------------------------------------------------------------------
// Computed
// ------------------------------------------------------------------

const isDarkMode = computed(() => document.documentElement.classList.contains('dark'))

const closeLabel = computed(() => t('common.close'))
const termsLabel = computed(() => t('login.thirdParty.termsOfService'))
const privacyLabel = computed(() => t('login.thirdParty.privacyPolicy'))
const cancelLabel = computed(() => t('common.cancel'))
const agreeLabel = computed(() => t('auth.agree'))
const loginBtnLabel = computed(() => t('login.buttons.login'))
const registerBtnLabel = computed(() => t('login.buttons.register'))

const showProjectBanner = computed(() => {
  const psp = props.projectSelectorProps
  if (!psp) return false
  const projects = psp.availableProjects
  return Array.isArray(projects) && projects.length > 0 && !isRegisterMode.value
})

const projectBannerProps = computed(() => {
  const psp = props.projectSelectorProps
  return {
    availableProjects: psp?.availableProjects ?? [],
    selectedProject: psp?.selectedProject ?? '',
    selectText: psp?.selectProjectText ?? '',
  }
})

// ------------------------------------------------------------------
// Watchers
// ------------------------------------------------------------------

watch(
  () => props.mode,
  (val) => {
    isRegisterMode.value = val === 'register'
  },
)

// ------------------------------------------------------------------
// Mode switching
// ------------------------------------------------------------------

const updateRegisterMode = (value: boolean): void => {
  isRegisterMode.value = value
}

const handleActiveTabChange = (tab: 'account' | 'phone' | 'email'): void => {
  activeTab.value = tab
}

const handleClose = (): void => {
  emit('close')
}

// ------------------------------------------------------------------
// Agreement confirmation
// ------------------------------------------------------------------

const AGREEMENT_KEY = 'universal-login-agreement-accepted'

const isAgreementAccepted = (): boolean => {
  try {
    return localStorage.getItem(AGREEMENT_KEY) === 'true'
  } catch {
    return false
  }
}

const setAgreementAccepted = (): void => {
  try {
    localStorage.setItem(AGREEMENT_KEY, 'true')
  } catch {
    /* ignore storage errors */
  }
}

/**
 * 在执行登录操作前检查协议确认状态。
 * 如果用户尚未确认协议，弹出确认框，确认后再执行挂起的操作。
 */
const requireAgreement = (action: () => void): void => {
  if (isAgreementAccepted()) {
    action()
    return
  }
  agreementText.value = t('auth.agreementDialogText')
  pendingAction.value = action
  showAgreementDialog.value = true
}

// ------------------------------------------------------------------
// Core login / register handlers
// ------------------------------------------------------------------

/** 账号登录核心逻辑（useLoginLogic 内部更新 authStore） */
const performAccountLogin = async (data: {
  username: string
  password: string
  rememberMe: boolean
  captcha: string
}): Promise<void> => {
  const result = await handleAccountLogin(data)
  if (result?.needsRegister) {
    updateRegisterMode(true)
  }
}

/** 手机号登录核心逻辑（useLoginLogic 内部更新 authStore） */
const performPhoneLogin = async (data: {
  phoneNumber: string
  countryCode: string
  verificationCode: string
  rememberMe: boolean
}): Promise<void> => {
  const getFullPhoneNumber = (): string => {
    const fromForm = phoneLoginFormRef.value?.getFullPhoneNumber?.()
    if (fromForm) return fromForm
    return `${data.countryCode}${data.phoneNumber}`
  }
  await handlePhoneLogin(
    {
      phoneNumber: data.phoneNumber,
      verificationCode: data.verificationCode,
      rememberMe: data.rememberMe,
    },
    getFullPhoneNumber,
  )
}

/** 邮箱验证码登录核心逻辑（useLoginLogic 内部更新 authStore） */
const performEmailLogin = async (data: {
  email: string
  verificationCode: string
  rememberMe: boolean
  agreement: boolean
}): Promise<void> => {
  await handleEmailLogin(data)
}

/** 注册核心逻辑（useRegisterLogic 返回 token，由本组件更新 authStore） */
const performRegister = async (data: {
  username: string
  phone: string
  code: string
  password: string
  confirmPassword: string
  agreement: boolean
}): Promise<void> => {
  // 将表单数据同步到 useRegisterLogic 的内部 formData
  registerFormData.username = data.username
  registerFormData.phone = data.phone
  registerFormData.code = data.code
  registerFormData.password = data.password
  registerFormData.confirmPassword = data.confirmPassword
  registerFormData.agreement = data.agreement

  const result = await handleAccountRegister()
  if (result?.success && result.token) {
    await authStore.thirdPartyLogin({
      token: result.token,
      refreshToken: result.refreshToken || '',
      user: result.userInfo || { username: data.username },
      loginType: 'register',
    })
    ElMessage.success(t('auth.registerSuccess'))
  }
}

// ------------------------------------------------------------------
// Form @submit handlers（Enter 键触发）
// ------------------------------------------------------------------

const onAccountLoginSubmit = (data: {
  username: string
  password: string
  rememberMe: boolean
  captcha: string
}): void => {
  requireAgreement(() => {
    void performAccountLogin(data)
  })
}

const onPhoneLoginSubmit = (data: {
  phoneNumber: string
  countryCode: string
  verificationCode: string
  rememberMe: boolean
}): void => {
  requireAgreement(() => {
    void performPhoneLogin(data)
  })
}

const onEmailLoginSubmit = (data: {
  email: string
  verificationCode: string
  rememberMe: boolean
  agreement: boolean
}): void => {
  requireAgreement(() => {
    void performEmailLogin(data)
  })
}

const onRegisterSubmit = (data: {
  username: string
  phone: string
  code: string
  password: string
  confirmPassword: string
  agreement: boolean
}): void => {
  void performRegister(data)
}

// ------------------------------------------------------------------
// Submit button handlers（按钮点击触发：先校验再提交）
// ------------------------------------------------------------------

const submitAccountLogin = async (): Promise<void> => {
  const inst = accountLoginFormRef.value
  if (!inst) return
  try {
    await inst.validate?.()
  } catch {
    return
  }
  const fd = inst.formData
  if (!fd) return
  requireAgreement(() => {
    void performAccountLogin({
      username: fd.username,
      password: fd.password,
      rememberMe: fd.rememberMe,
      captcha: fd.captcha,
    })
  })
}

const submitPhoneLogin = async (): Promise<void> => {
  const inst = phoneLoginFormRef.value
  if (!inst) return
  try {
    await inst.validate?.()
  } catch {
    return
  }
  const fd = inst.formData
  if (!fd) return
  requireAgreement(() => {
    void performPhoneLogin({
      phoneNumber: fd.phoneNumber,
      countryCode: fd.countryCode,
      verificationCode: fd.verificationCode,
      rememberMe: fd.rememberMe,
    })
  })
}

const submitEmailLogin = async (): Promise<void> => {
  const inst = emailLoginFormRef.value
  if (!inst) return
  try {
    await inst.validate?.()
  } catch {
    return
  }
  const fd = inst.formData
  if (!fd) return
  requireAgreement(() => {
    void performEmailLogin({
      email: fd.email,
      verificationCode: fd.verificationCode,
      rememberMe: fd.rememberMe,
      agreement: true,
    })
  })
}

const submitRegister = async (): Promise<void> => {
  const inst = registerFormRef.value
  if (!inst) return
  try {
    await inst.validate?.()
  } catch {
    return
  }
  const fd = inst.formData
  if (!fd) return
  void performRegister({ ...fd })
}

// ------------------------------------------------------------------
// Other event handlers
// ------------------------------------------------------------------

const onProjectSelect = (key: string): void => {
  props.projectSelectorProps?.selectProject?.(key)
}

const onForgotPassword = (): void => {
  logger.debug('[UniversalLogin] forgot password clicked')
}

const onSSOClick = (): void => {
  logger.debug('[UniversalLogin] SSO clicked')
}

const onThirdPartySuccess = (_method: unknown, _result: unknown): void => {
  logger.debug('[UniversalLogin] third-party login success')
}

// ------------------------------------------------------------------
// Agreement dialog handlers
// ------------------------------------------------------------------

const openTerms = (): void => {
  window.open('/terms', '_blank')
}

const openPrivacy = (): void => {
  window.open('/privacy', '_blank')
}

const cancelAgreement = (): void => {
  showAgreementDialog.value = false
  pendingAction.value = null
}

const confirmAgreement = (): void => {
  showAgreementDialog.value = false
  setAgreementAccepted()
  if (pendingAction.value) {
    pendingAction.value()
    pendingAction.value = null
  }
}

// ------------------------------------------------------------------
// Exposed methods
// ------------------------------------------------------------------

/** 重置组件状态（供 LoginDialog 在关闭弹窗时调用） */
const reset = (): void => {
  activeTab.value = 'account'
  isRegisterMode.value = props.mode === 'register'
  showAgreementDialog.value = false
  pendingAction.value = null
  accountLoginFormRef.value?.resetFields?.()
  phoneLoginFormRef.value?.resetFields?.()
  emailLoginFormRef.value?.resetFields?.()
  registerFormRef.value?.resetFields?.()
  resetRegisterForm()
}

defineExpose({ reset })
</script>

<style scoped lang="scss">
@use './_login-tokens.scss' as lt;
@import './_agreement-scoped.css';

/* 组件布局样式 */
.universal-login {
  position: relative;
  width: 100%;
}

.close-btn {
  position: absolute;
  top: 0;
  right: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  border-radius: var(--global-border-radius);
  transition: color 0.2s ease, background-color 0.2s ease;
  z-index: 10;

  &:hover {
    color: var(--el-text-color-primary);
    background-color: var(--el-fill-color-light);
  }
}

.form-area {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

// ============ 输入框: 去除 Element Plus 默认蓝色发光 box-shadow ============
// 硬约束: 输入框禁止蓝色发光边框, 使用边框色过渡替代
// (hover: 浅色 #a0c4ff / 暗色 #60a5fa; focus: 浅色 #3b82f6 / 暗色 #93c5fd)
// EP 默认 .is-focus 用 box-shadow 0 0 0 1px primary inset + 0 0 0 3px 发光,
// 这里覆盖为单层 1px 主题色 inset, 去外发光, 用颜色过渡.
// 覆盖所有子表单 (AccountLoginForm/PhoneLoginForm/RegisterForm) 的 el-input.
.universal-login :deep(.el-input__wrapper) {
  border-radius: var(--global-border-radius);
  box-shadow: 0 0 0 1px lt.$login-input-border inset;
  transition: box-shadow 0.28s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    box-shadow: 0 0 0 1px lt.$login-input-border-hover inset;
  }

  &.is-focus {
    box-shadow: 0 0 0 1px lt.$login-input-border-focus inset;
  }
}

// 暗色模式输入框 (用 html.dark 非 :where, 确保特异性覆盖 EP 默认)
html.dark .universal-login :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px lt.$login-dark-input-border inset;

  &:hover {
    box-shadow: 0 0 0 1px lt.$login-dark-input-border-hover inset;
  }

  &.is-focus {
    box-shadow: 0 0 0 1px lt.$login-dark-input-border-focus inset;
  }
}

.submit-btn {
  width: 100%;
  height: lt.$login-btn-height;
  margin-top: 8px;
  // 2026-07-04 修复: 圆角改用全站统一 token (硬约束 8px), 不再引用 lt.$login-btn-radius
  border-radius: var(--global-border-radius);
  font-size: lt.$login-btn-font-size;
  font-weight: lt.$login-btn-font-weight;
  letter-spacing: lt.$login-btn-letter-spacing;
  transition: lt.$login-btn-transition;

  // 浅色模式: 项目统一主色 #2563eb + 蓝色阴影 (覆盖 Element Plus 默认 #409eff)
  @include lt.login-btn-primary;

  &:hover:not(.is-disabled) {
    @include lt.login-btn-primary-hover;
  }

  &:active:not(.is-disabled) {
    @include lt.login-btn-primary-active;
  }
}

html.dark .universal-login {
  .close-btn {
    color: var(--el-text-color-secondary);

    &:hover {
      color: var(--el-text-color-primary);
      background-color: var(--el-fill-color-dark);
    }
  }

  .submit-btn {
    // 2026-07-04 v2 反相设计: 暗色模式 = 白底#ffffff + 深蓝字#2563eb (与浅色模式蓝底白字完全反相)
    // 旧设计 (07-03 蓝底#3b82f6 + 深字#1a1a1a, 非反相) 已废弃.
    // 对比度: #2563eb on #ffffff = 5.44:1 (WCAG AA 4.5 通过).
    // 守门: e2e/sidebar-dark-color-tier.spec.ts H1-H5 + scripts/check-sidebar-dark-tier.mjs.
    color: lt.$login-primary;              // #2563eb 深蓝字 (反相)
    background-color: #ffffff;             // 白底 (反相)
    border-color: #ffffff;                 // 白边 (与底色一致, 避免边框撞色)
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);

    &:hover:not(.is-disabled) {
      color: lt.$login-primary-hover;      // #1d4ed8 更深蓝, hover 反馈更强
      background-color: #ffffff;           // 白底保持
      border-color: #ffffff;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
    }

    &:active:not(.is-disabled) {
      color: lt.$login-primary-active;     // #1e40af 最深蓝, active 反馈最强
      background-color: #ffffff;
      border-color: #ffffff;
      transform: translateY(0);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    }
  }
}
</style>

<style lang="scss">
@import './_agreement-global.css';
</style>
