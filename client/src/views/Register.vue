<template>
  <div class="register-container page-container" :class="{ 'mouse-active': isMouseInViewport }">
    <!-- 深度背景系统 -->
    <div class="register-bg-system">
      <div class="bg-glow-orb orb-1"></div>
      <div class="bg-glow-orb orb-2"></div>
      <div class="mouse-glow-effect"></div>
    </div>

    <div class="register-main fade-in-up">
      <!-- 注册侧边栏 -->
      <div class="register-sidebar glass-panel">
        <div class="sidebar-content">
          <div class="logo fade-in-left" style="

--delay: 0.1s">
            <!-- 使用内联SVG代替外部图片引用 -->
            <div class="logo-svg">
              <svg
                width="60"
                height="60"
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="10" y="10" width="80" height="80" rx="12" fill="white" />
                <path
                  d="M30 40L50 60L70 40"
                  stroke="var(--el-text-color-primary)"
                  stroke-width="6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M30 60L50 40L70 60"
                  stroke="var(--el-text-color-primary)"
                  stroke-width="6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <h1 class="logo-text">{{ t('register.brand') }}</h1>
          </div>
          <div class="sidebar-title fade-in-left" style="

--delay: 0.2s">
            <h2>{{ t('register.sidebar.title') }}</h2>
            <p>{{ t('register.sidebar.subtitle') }}</p>
          </div>
          <div class="sidebar-features">
            <div class="feature-item fade-in-left" style="

--delay: 0.3s">
              <div class="feature-icon">
                <el-icon><User /></el-icon>
              </div>
              <span>{{ t('register.sidebar.features.community') }}</span>
            </div>
            <div class="feature-item fade-in-left" style="

--delay: 0.4s">
              <div class="feature-icon">
                <el-icon><Star /></el-icon>
              </div>
              <span>{{ t('register.sidebar.features.experience') }}</span>
            </div>
            <div class="feature-item fade-in-left" style="

--delay: 0.5s">
              <div class="feature-icon">
                <el-icon><Key /></el-icon>
              </div>
              <span>{{ t('register.sidebar.features.secure') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 注册表单区域 -->
      <div class="register-form-container">
        <div class="form-wrapper glass-card fade-in-right" style="

--delay: 0.2s">
          <!-- 卡片顶部装饰 -->
          <div class="card-glow"></div>
          <div class="card-top-accent"></div>

          <!-- 注册选项卡 -->
          <div class="register-tabs">
            <div
              class="tab-item"
              :class="{ active: currentTab === 'account' }"
              @click="currentTab = 'account'"
            >
              <span class="tab-text">{{ t('register.tabs.account') }}</span>
              <span class="tab-indicator"></span>
            </div>
            <div
              class="tab-item"
              :class="{ active: currentTab === 'phone' }"
              @click="currentTab = 'phone'"
            >
              <span class="tab-text">{{ t('register.tabs.phone') }}</span>
              <span class="tab-indicator"></span>
            </div>
          </div>

          <!-- 账号密码注册表单 -->
          <transition name="form-slide" mode="out-in">
            <div v-if="currentTab === 'account'" key="account" class="form-content">
              <h3 class="form-title">{{ t('register.tabs.account') }}</h3>
              <el-form
                ref="accountFormRef"
                :model="accountForm"
                :rules="accountRules"
                label-width="100px"
                class="premium-form"
              >
                <el-form-item :label="t('register.fields.username')" prop="username">
                  <el-input
                    v-model="accountForm.username"
                    :placeholder="t('register.placeholders.username')"
                    :prefix-icon="User"
                    class="premium-input"
                  />
                </el-form-item>
                <el-form-item :label="t('register.fields.phone')" prop="phone">
                  <el-input
                    v-model="accountForm.phone"
                    :placeholder="t('register.placeholders.phone')"
                    :prefix-icon="Phone"
                    class="premium-input"
                  />
                </el-form-item>
                <el-form-item :label="t('register.fields.code')" prop="code">
                  <div class="code-input-group">
                    <el-input
                      v-model="accountForm.code"
                      :placeholder="t('register.placeholders.code')"
                      :prefix-icon="MessageSquare"
                      class="premium-input"
                    />
                    <button
                      type="button"
                      @click="sendPhoneCode"
                      :disabled="phoneCountdown > 0"
                      class="code-button ripple-btn"
                      @mousedown="createRipple"
                    >
                      {{
                        phoneCountdown > 0
                          ? t('register.code.countdown', { seconds: phoneCountdown })
                          : t('register.code.send')
                      }}
                    </button>
                  </div>
                </el-form-item>
                <el-form-item :label="t('register.fields.password')" prop="password">
                  <el-input
                    v-model="accountForm.password"
                    type="password"
                    :placeholder="t('register.placeholders.password')"
                    :prefix-icon="Lock"
                    :show-password="showPassword"
                    class="premium-input"
                    @click="showPassword = !showPassword"
                  />
                  <div class="password-strength" v-if="passwordStrength > 0">
                    <div class="strength-bar">
                      <div
                        class="strength-fill"
                        :style="{
                          width: passwordStrength * 33.33 + '%',
                        }"
                        :class="getStrengthClass()"
                      ></div>
                    </div>
                    <div class="strength-text" :class="getStrengthClass()">{{ getStrengthText() }}</div>
                  </div>
                </el-form-item>
                <el-form-item :label="t('register.fields.confirmPassword')" prop="confirmPassword">
                  <el-input
                    v-model="accountForm.confirmPassword"
                    type="password"
                    :placeholder="t('register.placeholders.confirmPassword')"
                    :prefix-icon="Lock"
                    class="premium-input"
                  />
                </el-form-item>
                <el-form-item class="agreement-item">
                  <CustomCheckbox v-model="accountAgreement">
                    {{ t('register.agreement.prefix') }}
                    <a href="#" class="agreement-link">{{ t('routes.termsOfService') }}</a>
                    {{ t('register.agreement.and') }}
                    <a href="#" class="agreement-link">{{ t('routes.privacyPolicy') }}</a>
                  </CustomCheckbox>
                </el-form-item>
                <el-form-item>
                  <button
                    type="button"
                    @click="handleAccountRegister"
                    :disabled="accountRegisterLoading"
                    class="register-button ripple-btn"
                    @mousedown="createRipple"
                  >
                    <span v-if="accountRegisterLoading" class="loading-spinner"></span>
                    <span class="btn-text">{{ t('register.submit') }}</span>
                    <span class="btn-glow"></span>
                  </button>
                </el-form-item>
                <div class="login-link">
                  <span>{{ t('register.haveAccount') }}</span>
                  <el-link @click="goToLogin">{{ t('register.loginNow') }}</el-link>
                </div>
              </el-form>
            </div>

            <!-- 手机验证码注册表单 -->
            <div v-else-if="currentTab === 'phone'" key="phone" class="form-content">
              <h3 class="form-title">{{ t('register.tabs.phone') }}</h3>
              <el-form ref="phoneFormRef" :model="phoneForm" :rules="phoneRules" label-width="100px" class="premium-form">
                <el-form-item :label="t('register.fields.phone')" prop="phone">
                  <el-input
                    v-model="phoneForm.phone"
                    :placeholder="t('register.placeholders.phone')"
                    :prefix-icon="Phone"
                    class="premium-input"
                  />
                </el-form-item>
                <el-form-item :label="t('register.fields.code')" prop="code">
                  <div class="code-input-group">
                    <el-input
                      v-model="phoneForm.code"
                      :placeholder="t('register.placeholders.code')"
                      :prefix-icon="MessageSquare"
                      class="premium-input"
                    />
                    <button
                      type="button"
                      @click="sendPhoneCode"
                      :disabled="phoneCountdown > 0"
                      class="code-button ripple-btn"
                      @mousedown="createRipple"
                    >
                      {{
                        phoneCountdown > 0
                          ? t('register.code.countdown', { seconds: phoneCountdown })
                          : t('register.code.send')
                      }}
                    </button>
                  </div>
                </el-form-item>
                <el-form-item :label="t('register.fields.password')" prop="password">
                  <el-input
                    v-model="phoneForm.password"
                    type="password"
                    :placeholder="t('register.placeholders.password')"
                    :prefix-icon="Lock"
                    :show-password="showPhonePassword"
                    class="premium-input"
                    @click="showPhonePassword = !showPhonePassword"
                  />
                  <div class="password-strength" v-if="phonePasswordStrength > 0">
                    <div class="strength-bar">
                      <div
                        class="strength-fill"
                        :style="{
                          width: phonePasswordStrength * 33.33 + '%',
                        }"
                        :class="getPhoneStrengthClass()"
                      ></div>
                    </div>
                    <div class="strength-text" :class="getPhoneStrengthClass()">{{ getPhoneStrengthText() }}</div>
                  </div>
                </el-form-item>
                <el-form-item class="agreement-item">
                  <CustomCheckbox v-model="phoneAgreement">
                    {{ t('register.agreement.prefix') }}
                    <a href="#" class="agreement-link">{{ t('routes.termsOfService') }}</a>
                    {{ t('register.agreement.and') }}
                    <a href="#" class="agreement-link">{{ t('routes.privacyPolicy') }}</a>
                  </CustomCheckbox>
                </el-form-item>
                <el-form-item>
                  <button
                    type="button"
                    @click="handlePhoneRegister"
                    :disabled="phoneRegisterLoading"
                    class="register-button ripple-btn"
                    @mousedown="createRipple"
                  >
                    <span v-if="phoneRegisterLoading" class="loading-spinner"></span>
                    <span class="btn-text">{{ t('register.submit') }}</span>
                    <span class="btn-glow"></span>
                  </button>
                </el-form-item>
                <div class="login-link">
                  <span>{{ t('register.haveAccount') }}</span>
                  <el-link type="primary" @click="goToLogin">{{ t('register.loginNow') }}</el-link>
                </div>
              </el-form>
            </div>
          </transition>

          <!-- 第三方账号绑定提示 -->
          <div class="third-party-tips">
            <div class="divider">
              <span class="divider-line"></span>
              <span class="divider-text">{{ t('register.thirdParty.or') }}</span>
              <span class="divider-line"></span>
            </div>
            <div class="third-party-options">
              <button
                type="button"
                @click="handleThirdPartyRegister('wechat')"
                class="third-party-btn ripple-btn"
                @mousedown="createRipple"
              >
                <span class="third-icon">💬</span>
                {{ t('register.thirdParty.wechat') }}
              </button>
              <button
                type="button"
                @click="handleThirdPartyRegister('alipay')"
                class="third-party-btn ripple-btn"
                @mousedown="createRipple"
              >
                <span class="third-icon">💰</span>
                {{ t('register.thirdParty.alipay') }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="mouse-glow-effect"></div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref, reactive, watch, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { logger } from '../utils/logger'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { type FormInstance as ElForm } from 'element-plus'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import CustomCheckbox from '@/components/ui/CustomCheckbox.vue'
import { User, Star, Key, Phone, MessageSquare, Lock } from '@/lib/lucide-fallback'
import { useAuthStore } from '@/stores/auth'
import { useMouseGlow } from '@/composables/useMouseGlow'
import { useRegisterAnalytics } from '@/composables/useAnalytics'

// ============ 高级动效系统 ============
const { isMouseInViewport } = useMouseGlow()
const { trackRegisterPageView, trackRegisterClick, trackRegisterSuccess, trackRegisterFail } = useRegisterAnalytics()

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()

// 涟漪点击效果
const createRipple = (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement
  if (!target) return

  const rect = target.getBoundingClientRect()
  const ripple = document.createElement('span')
  const size = Math.max(rect.width, rect.height)

  ripple.style.width = ripple.style.height = `${size}px`
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`
  ripple.classList.add('ripple-effect')

  target.appendChild(ripple)

  setTimeout(() => ripple.remove(), 600)
}

const router = useRouter()
const authStore = useAuthStore() as ReturnType<typeof useAuthStore> & {
  register: (data: {
    username: string
    phone: string
    code: string
    password: string
    email?: string
    type: string
  }) => Promise<unknown>
}
const { showSuccess, showError: showErrorMsg, showInfo } = useOperationFeedback()
const { t } = useI18n()

// 注册选项卡状态
const currentTab = ref<'account' | 'phone'>('account')

// 账号密码注册表单
const accountFormRef = ref<ElForm>(undefined)
const accountForm = reactive({
  username: '',
  phone: '',
  code: '',
  password: '',
  confirmPassword: '',
  email: '',
})
const accountRegisterLoading = ref(false)
const accountAgreement = ref(false)
const showPassword = ref(false)
const passwordStrength = ref(0)

// 账号密码注册验证规则
const accountRules = {
  username: [
    { required: true, message: t('register.validation.usernameRequired'), trigger: 'blur' },
    { min: 5, max: 20, message: t('register.validation.usernameLength'), trigger: 'blur' },
    {
      pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/,
      message: t('register.validation.usernamePattern'),
      trigger: 'blur',
    },
  ],
  phone: [
    { required: true, message: t('auth.phonePlaceholder'), trigger: 'blur' },
    {
      pattern: /^1[3-9]\d{9}$/,
      message: t('auth.phoneFormatError'),
      trigger: 'blur',
    },
  ],
  code: [
    { required: true, message: t('auth.captchaPlaceholder'), trigger: 'blur' },
    { min: 4, max: 6, message: t('auth.captchaLengthError'), trigger: 'blur' },
  ],
  password: [
    { required: true, message: t('register.validation.passwordRequired'), trigger: 'blur' },
    { min: 6, max: 20, message: t('register.validation.passwordLength'), trigger: 'blur' },
    {
      pattern: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,20}$/,
      message: t('register.validation.passwordPattern'),
      trigger: 'blur',
    },
  ],
  confirmPassword: [
    { required: true, message: t('auth.confirmPasswordPlaceholder'), trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void) => {
        if (value !== accountForm.password) {
          callback(new Error(t('auth.passwordMismatch')))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
}

// 手机验证码注册表单
const phoneFormRef = ref<ElForm>(undefined)
const phoneForm = reactive({
  phone: '',
  code: '',
  password: '',
})
const phoneRegisterLoading = ref(false)
const phoneAgreement = ref(false)
const showPhonePassword = ref(false)
const phonePasswordStrength = ref(0)

// 手机验证码注册验证规则
const phoneRules = {
  phone: [
    { required: true, message: t('auth.phonePlaceholder'), trigger: 'blur' },
    {
      pattern: /^1[3-9]\d{9}$/,
      message: t('auth.phoneFormatError'),
      trigger: 'blur',
    },
  ],
  code: [
    { required: true, message: t('auth.captchaPlaceholder'), trigger: 'blur' },
    { min: 4, max: 6, message: t('auth.captchaLengthError'), trigger: 'blur' },
  ],
  password: [
    { required: true, message: t('register.validation.passwordRequired'), trigger: 'blur' },
    { min: 6, max: 20, message: t('register.validation.passwordLength'), trigger: 'blur' },
    {
      pattern: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,20}$/,
      message: t('register.validation.passwordPattern'),
      trigger: 'blur',
    },
  ],
}

// 验证码倒计时
const phoneCountdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

// 监听密码变化，计算密码强度（将在onUnmounted前定义）

// 计算密码强度
const calculatePasswordStrength = (password: string): number => {
  if (!password) return 0

  let strength = 0

  // 长度检查
  if (password.length >= 8) strength++

  // 包含数字
  if (/\d/.test(password)) strength++

  // 包含字母
  if (/[a-zA-Z]/.test(password)) strength++

  // 包含特殊字符
  if (/[^a-zA-Z0-9]/.test(password)) strength++

  // 最多返回3级
  return Math.min(strength, 3)
}

// 获取密码强度样式类
const getStrengthClass = (): string => {
  switch (passwordStrength.value) {
    case 1:
      return 'strength-weak'
    case 2:
      return 'strength-medium'
    case 3:
      return 'strength-strong'
    default:
      return ''
  }
}

// 获取密码强度文本
const getStrengthText = (): string => {
  switch (passwordStrength.value) {
    case 1:
      return t('register.strength.weak')
    case 2:
      return t('register.strength.medium')
    case 3:
      return t('register.strength.strong')
    default:
      return ''
  }
}

// 获取手机注册密码强度样式类
const getPhoneStrengthClass = (): string => {
  switch (phonePasswordStrength.value) {
    case 1:
      return 'strength-weak'
    case 2:
      return 'strength-medium'
    case 3:
      return 'strength-strong'
    default:
      return ''
  }
}

// 获取手机注册密码强度文本
const getPhoneStrengthText = (): string => {
  switch (phonePasswordStrength.value) {
    case 1:
      return t('register.strength.weak')
    case 2:
      return t('register.strength.medium')
    case 3:
      return t('register.strength.strong')
    default:
      return ''
  }
}

// 发送验证码 - 完全对接后端API
const sendPhoneCode = async () => {
  // 获取当前使用的手机号
  let phone = ''
  if (currentTab.value === 'account') {
    phone = accountForm.phone
  } else {
    phone = phoneForm.phone
  }

  try {
    // 验证手机号格式
    const validPhone = /^1[3-9]\d{9}$/.test(phone)
    if (!validPhone) {
      showErrorMsg(t('register.messages.phoneInvalid'))
      return
    }

    // 调用发送验证码API - 匹配后端参数
    const { sendVerificationCode } = await import('@/api/user/user')
    const response = await sendVerificationCode({
      type: 'phone',
      target: phone,
    })

    if (response.code === 200 || response.success) {
      startCountdown()
      showSuccess(t('register.messages.codeSent'))
    } else {
      showErrorMsg(response.message || t('register.messages.codeSendFailed'))
    }
  } catch (error: any) {
    showErrorMsg(
      (error instanceof Error ? error.message : String(error)) ||
        t('register.messages.codeSendFailedRetry')
    )
  }
}

// 开始倒计时
const startCountdown = () => {
  phoneCountdown.value = 60

  if (countdownTimer) {
    clearInterval(countdownTimer)
  }

  countdownTimer = setInterval(() => {
    phoneCountdown.value--
    if (phoneCountdown.value <= 0) {
      if (countdownTimer) {
        clearInterval(countdownTimer)
        countdownTimer = null
      }
    }
  }, 1000)
}

// 账号密码注册
const handleAccountRegister = async () => {
  if (!accountFormRef.value) return
  if (accountRegisterLoading.value) return

  try {
    await accountFormRef.value.validate(undefined)

    if (!accountAgreement.value) {
      showErrorMsg(t('register.messages.agreementRequired'))
      return
    }

    accountRegisterLoading.value = true
    trackRegisterClick('account')

    const result = await authStore.register({
      username: accountForm.username,
      phone: accountForm.phone,
      code: accountForm.code,
      password: accountForm.password,
      email: accountForm.email || `${accountForm.username}@example.com`,
      type: 'account',
    })

    if (result) {
      trackRegisterSuccess('account')
      showSuccess(t('register.messages.registerSuccess'))
      router.push('/login')
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : t('register.messages.registerFailed')
    trackRegisterFail('account', errorMsg)
    showErrorMsg(errorMsg)
  } finally {
    accountRegisterLoading.value = false
  }
}

// 手机验证码注册
const handlePhoneRegister = async () => {
  if (!phoneFormRef.value) return
  if (phoneRegisterLoading.value) return

  try {
    await phoneFormRef.value.validate(undefined)

    if (!phoneAgreement.value) {
      showErrorMsg(t('register.messages.agreementRequired'))
      return
    }

    phoneRegisterLoading.value = true
    trackRegisterClick('phone')

    const result = await authStore.register({
      phone: phoneForm.phone,
      code: phoneForm.code,
      password: phoneForm.password,
      username: phoneForm.phone,
      email: `${phoneForm.phone}@example.com`,
      type: 'phone',
    })

    if (result) {
      trackRegisterSuccess('phone')
      showSuccess(t('register.messages.registerSuccess'))
      router.push('/login')
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : t('register.messages.registerFailed')
    trackRegisterFail('phone', errorMsg)
    showErrorMsg(errorMsg)
  } finally {
    phoneRegisterLoading.value = false
  }
}

// 第三方注册
const handleThirdPartyRegister = async (type: string) => {
  try {
    // 验证用户协议
    if (currentTab.value === 'account' && !accountAgreement.value) {
      showErrorMsg(t('register.agreementRequired'))
      return
    }

    if (currentTab.value === 'phone' && !phoneAgreement.value) {
      showErrorMsg(t('register.agreementRequired'))
      return
    }

    // 调用第三方注册接口
    logger.info('Using third-party account to register:', type)

    // 这里应该跳转到第三方授权页面
    // 模拟跳转
    showInfo(t('register.messages.oauthRedirect', { provider: getThirdPartyName(type) }))

    // 实际项目中应该是：
    // window.location.href = `${API_URL}/oauth/${type}?redirect_uri=${encodeURIComponent(window.location.origin + '/oauth/callback')}`;
  } catch (_error) {
    showErrorMsg(t('register.messages.oauthFailed'))
  }
}

// 获取第三方平台名称
const getThirdPartyName = (type: string): string => {
  const nameMap: Record<string, string> = {
    wechat: t('register.thirdParty.wechat'),
    alipay: t('register.thirdParty.alipay'),
    google: 'Google',
  }

  return nameMap[type] || type
}

// 跳转到登录页
const goToLogin = () => {
  router.push('/login')
}

// 存储watch的停止函数
let stopPasswordStrengthWatch: (() => void) | null = null
let stopPhonePasswordStrengthWatch: (() => void) | null = null

// 监听密码变化，计算密码强度
stopPasswordStrengthWatch = watch(
  () => accountForm.password,
  (newPassword: string) => {
    passwordStrength.value = calculatePasswordStrength(newPassword)
  }
)

stopPhonePasswordStrengthWatch = watch(
  () => phoneForm.password,
  (newPassword: string) => {
    phonePasswordStrength.value = calculatePasswordStrength(newPassword)
  }
)

// 组件挂载时初始化动效系统
onMounted(() => {
  trackRegisterPageView()
})

// 组件卸载时清理资源
cleanup.add(() => {
  // 清理定时器
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  // 停止watch监听
  if (stopPasswordStrengthWatch) {
    stopPasswordStrengthWatch()
    stopPasswordStrengthWatch = null
  }
  if (stopPhonePasswordStrengthWatch) {
    stopPhonePasswordStrengthWatch()
    stopPhonePasswordStrengthWatch = null
  }
  // 清理动效系统事件监听
})
</script>

<style lang="scss" scoped>
@use '@/styles/breakpoints' as bp;

// ============ 设计令牌 ============
$brand-primary: var(--el-text-color-primary);
$brand-secondary: var(--el-text-color-regular);
$text-main: var(--el-text-color-primary);
$text-sec: var(--el-text-color-secondary);
$border-light: var(--el-border-color-lighter);
$bg-page: var(--el-bg-color-page);

// ============ 页面容器 ============
.register-container {
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
  padding: clamp(80px, 12vh, 120px) clamp(16px, 4vw, 40px) clamp(40px, 8vh, 60px);
  box-sizing: border-box;

  &.mouse-active .mouse-glow-effect {
    opacity: 0;
  }
}

// ============ 深度背景系统 ============
.register-bg-system {
  position: fixed;
  inset: 0;
  z-index: var(--z-0);
  pointer-events: none;
  background: var(--el-bg-color);

  .mouse-glow-effect {
    position: absolute;
    left: 0;
    top: 0;
    width: 700px;
    height: 700px;
    border-radius: var(--global-border-radius);
    background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
    opacity: 0;
    pointer-events: none;
  }

  // 发光球体
  .bg-glow-orb {
    position: absolute;
    border-radius: var(--global-border-radius);
    filter: blur(100px);
    opacity: 0.25;
    animation: floatOrb 18s ease-in-out infinite;

    &.orb-1 {
      width: 500px;
      height: 500px;
      top: -10%;
      right: -5%;
      background: var(--color-cyan-glow);
      animation-delay: 0s;
    }

    &.orb-2 {
      width: 400px;
      height: 400px;
      bottom: -15%;
      left: -10%;
      background: var(--color-white-5);
      animation-delay: -9s;
    }
  }

}

// ============ 主内容区 ============
.register-main {
  width: 100%;
  max-width: 1100px;
  min-height: 580px;
  display: flex;
  position: relative;
  z-index: var(--z-base);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  border: var(--unified-border);
  box-shadow: var(--global-box-shadow);
}

// ============ 侧边栏 ============
.register-sidebar {
  width: 42%;
  padding: 48px 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--el-bg-color);
    z-index: -1;
  }
}

.glass-panel {
  background: var(--el-bg-color);
  backdrop-filter: blur(40px);
  border: var(--unified-border);
}

.sidebar-content {
  width: 100%;
  color: var(--el-color-white);
}

.logo {
  display: flex;
  align-items: center;
  margin-bottom: 48px;

  .logo-svg {
    margin-right: 16px;
    filter: none;
  }

  .logo-text {
    font-size: 26px;
    font-weight: 700;
    margin: 0;
    letter-spacing: -0.02em;
  }
}

.sidebar-title {
  margin-bottom: 48px;

  h2 {
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 12px;
    letter-spacing: -0.02em;
    line-height: 1.3;
  }

  p {
    font-size: 15px;
    opacity: 0.7;
    margin: 0;
    line-height: 1.6;
  }
}

.sidebar-features {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.feature-item {
  display: flex;
  align-items: center;
  font-size: 15px;
  font-weight: 500;
  padding: 14px 18px;
  background: var(--color-white-4);
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: var(--color-white-8);
    border-color: var(--border-unified-color-hover);
    transform: translateX(6px);
  }

  .feature-icon {
    width: 40px;
    height: 40px;
    margin-right: 14px;
    background: var(--color-white-8);
    border-radius: var(--global-border-radius);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
  }
}

// ============ 表单容器 ============
.register-form-container {
  width: 58%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px;
  background: var(--el-bg-color);
}

.form-wrapper {
  width: 100%;
  max-width: 480px;
  padding: 44px 40px;
  position: relative;
  overflow: hidden;
}

.glass-card {
  background: rgb(var(--el-bg-color-rgb), 0.92);
  backdrop-filter: blur(30px);
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  box-shadow: var(--global-box-shadow);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    border-color: var(--border-unified-color-hover);
  }
}

// 暗色模式
html.dark .glass-card,
body.dark .glass-card {
  background: var(--color-dark-1c1c1c-92);
  border: var(--unified-border);
  box-shadow: var(--global-box-shadow);
}

// 卡片顶部装饰
.card-top-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--el-color-primary);
  opacity: 0;
  transition: opacity 0.3s;
}

.glass-card:hover .card-top-accent {
  opacity: 1;
}

// ============ 选项卡 ============
.register-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 32px;
  padding: 6px;
  background: rgb(var(--el-fill-color-rgb), 0.4);
  border-radius: var(--global-border-radius);
  position: relative;
  z-index: var(--z-base);
}

.tab-item {
  flex: 1;
  padding: 14px 20px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  color: $text-sec;
  position: relative;
  border-radius: var(--global-border-radius);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: center;

  .tab-text {
    position: relative;
    z-index: calc(var(--z-base) + 1);
  }

  .tab-indicator {
    position: absolute;
    inset: 0;
    background: var(--el-bg-color);
    border-radius: var(--global-border-radius);
    opacity: 0;
    box-shadow: var(--global-box-shadow);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: var(--z-base);
  }

  &:hover:not(.active) {
    color: $text-main;
  }

  &.active {
    color: $text-main;

    .tab-indicator {
      opacity: 1;
    }
  }
}

// ============ 表单样式 ============
.form-content {
  width: 100%;
  position: relative;
  z-index: var(--z-base);
}

.form-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 28px;
  color: $text-main;
  text-align: center;
  letter-spacing: -0.02em;
}

.premium-form {
  :deep(.el-form-item) {
    margin-bottom: 22px;
  }

  :deep(.el-form-item__label) {
    font-weight: 600;
    color: $text-main;
  }
}

// 输入框高级样式
.premium-input :deep(.el-input__wrapper) {
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  background: rgb(var(--el-fill-color-rgb), 0.3);
  padding: 4px 16px;
  height: 48px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: none;

  &:hover {
    border-color: $brand-secondary;
    background: rgb(var(--el-fill-color-rgb), 0.5);
  }

  &.is-focus {
    border-color: var(--el-color-primary);
    box-shadow: var(--global-box-shadow);
    background: var(--el-bg-color);
  }
}

// 验证码输入组
.code-input-group {
  display: flex;
  gap: 12px;

  .el-input {
    flex: 1;
  }
}

.code-button {
  min-width: 130px;
  height: 48px;
  padding: 0 20px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  background: rgb(var(--el-fill-color-rgb), 0.3);
  color: $text-main;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover:not(:disabled) {
    border-color: $brand-secondary;
    background: color-mix(in srgb, var(--el-text-color-primary) 5%, transparent);
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// ============ 密码强度指示器 ============
.password-strength {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.strength-bar {
  flex: 1;
  height: 4px;
  background: rgb(var(--el-fill-color-rgb), 0.5);
  border-radius: var(--global-border-radius);
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  border-radius: var(--global-border-radius);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &.strength-weak {
    background: var(--el-color-danger);
  }

  &.strength-medium {
    background: var(--el-color-warning);
  }

  &.strength-strong {
    background: var(--el-color-success);
  }
}

.strength-text {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  &.strength-weak {
    color: var(--el-color-danger);
  }

  &.strength-medium {
    color: var(--el-color-warning);
  }

  &.strength-strong {
    color: var(--el-color-success);
  }
}

// ============ 主按钮 ============
.register-button {
  width: 100%;
  height: 54px;
  border: none;
  border-radius: var(--global-border-radius);
  background: var(--el-color-primary);
  color: var(--color-on-primary);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;

  .btn-text {
    position: relative;
    z-index: calc(var(--z-base) + 1);
  }

  // 扫光效果已移至全局样式 (styles/index.scss)

  &:hover:not(:disabled) {
    transform: translateY(-3px);
    border-color: var(--el-color-primary);
  }

  &:active:not(:disabled) {
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  // 光束扫过效果
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 50%;
    height: 100%;
    background: var(--color-white-12);
    transition: left 0.5s;
    z-index: var(--z-base);
  }

  &:hover::before {
    left: 200%;
  }
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-unified-color);
  border-top-color: var(--border-unified-color);
  border-radius: var(--global-border-radius);
  animation: spin 0.8s linear infinite;
}

// ============ 协议复选框 ============
.agreement-item {
  margin-bottom: 24px;

  :deep(.el-form-item__content) {
    line-height: 1.6;
  }
}

.agreement-link {
  color: $brand-primary;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.2s;

  &:hover {
    text-decoration: underline;
  }
}

// ============ 登录链接 ============
.login-link {
  margin-top: 24px;
  text-align: center;
  font-size: 14px;
  color: $text-sec;

  :deep(.el-link) {
    font-weight: 600;
    margin-left: 6px;
  }
}

// ============ 第三方登录 ============
.third-party-tips {
  margin-top: 36px;
  position: relative;
  z-index: var(--z-base);
}

.divider {
  display: flex;
  align-items: center;
  margin-bottom: 24px;

  .divider-line {
    flex: 1;
    height: 1px;
    background: $border-light;
  }

  .divider-text {
    padding: 0 16px;
    color: $text-sec;
    font-size: 13px;
    font-weight: 500;
  }
}

.third-party-options {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.third-party-btn {
  flex: 1;
  max-width: 160px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  background: rgb(var(--el-fill-color-rgb), 0.3);
  color: $text-main;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  .third-icon {
    font-size: 18px;
  }

  &:hover {
    border-color: var(--el-color-primary);
    background: color-mix(in srgb, var(--el-text-color-primary) 5%, transparent);
    transform: translateY(-3px);
  }
}

// ============ 涟漪效果 ============
.ripple-btn {
  position: relative;
  overflow: hidden;
}

// ============ 表单验证错误 ============
:where(.register-container) :deep(.el-form-item.is-error .el-input__wrapper) {
  border-color: var(--el-color-danger);
  box-shadow: var(--global-box-shadow);
}

:deep(.el-form-item__error) {
  font-size: 12px;
  font-weight: 500;
  margin-top: 6px;
  color: var(--el-color-danger);
  animation: fadeIn 0.3s ease;
}

// ============ 入场动画 ============
.fade-in-up {
  animation: fadeInUp 0.7s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.fade-in-left {
  opacity: 0;
  animation: fadeInLeft 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  animation-delay: var(--delay);
}

.fade-in-right {
  opacity: 0;
  animation: fadeInRight 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  animation-delay: var(--delay);
}

// 表单切换动画
.form-slide-enter-active,
.form-slide-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.form-slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.form-slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

// ============ 关键帧动画 ============
@keyframes gridMove {
  0% { transform: translate(0, 0); }
  100% { transform: translate(50px, 50px); }
}

@keyframes floatOrb {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(40px, -30px) scale(1.05); }
  50% { transform: translate(-30px, 40px) scale(0.95); }
  75% { transform: translate(-40px, -20px) scale(1.02); }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInLeft {
  from {
    opacity: 0;
    transform: translateX(-30px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes fadeInRight {
  from {
    opacity: 0;
    transform: translateX(30px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes rippleExpand {
  0% {
    transform: scale(0);
    opacity: 0.6;
  }

  100% {
    transform: scale(4);
    opacity: 0;
  }
}

@keyframes borderGlow {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

// ============ 响应式设计 ============
@include bp.tablet-down {
  .register-container {
    padding: clamp(80px, 12vh, 100px) 16px clamp(32px, 6vh, 48px);
  }

  .register-main {
    flex-direction: column;
    max-width: 500px;
    min-height: auto;
  }

  .register-sidebar {
    display: none;
  }

  .register-form-container {
    width: 100%;
    padding: 24px;
    border-radius: var(--global-border-radius);
  }

  .form-wrapper {
    max-width: 100%;
    padding: 32px 24px;
  }
}

@include bp.mobile-only {
  .register-container {
    padding: clamp(72px, 10vh, 90px) 12px clamp(24px, 5vh, 40px);
  }

  .register-form-container {
    padding: 16px;
    border-radius: var(--global-border-radius);
  }

  .form-wrapper {
    padding: 28px 20px;
    border-radius: var(--global-border-radius);
  }

  .register-tabs {
    padding: 4px;
  }

  .tab-item {
    padding: 12px 16px;
    font-size: 14px;
  }

  .form-title {
    font-size: 20px;
    margin-bottom: 24px;
  }

  .code-input-group {
    flex-direction: column;
    gap: 10px;
  }

  .code-button {
    width: 100%;
    min-width: auto;
  }

  .third-party-options {
    flex-direction: column;
    gap: 12px;
  }

  .third-party-btn {
    max-width: 100%;
    width: 100%;
  }

  .register-button {
    height: 50px;
  }
}
</style>
