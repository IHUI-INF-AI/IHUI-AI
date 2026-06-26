<template>
  <div class="login-content login-page" :class="{ 'dark-mode': isDarkMode }">
    <!-- 左侧品牌跑马灯 -->
    <div class="brand-marquee">
      <div class="marquee-track">
        <div class="marquee-item" v-for="i in 10" :key="i">
          <img src="/images/logo.svg" :alt="'Brand ' + i" class="marquee-image">
        </div>
        <!-- 复制一份用于无缝滚动 -->
        <div class="marquee-item" v-for="i in 10" :key="`copy-${i}`">
          <img src="/images/logo.svg" :alt="'Brand ' + i" class="marquee-image">
        </div>
      </div>
    </div>
    
    <!-- 品牌标识 -->
    <LoginBrand :project-selector-props="projectSelectorProps" :is-register-mode="isRegisterMode" />

    <!-- 安全提示 -->
    <SecurityAlert v-if="showSecurityAlert" :message="securityAlertMessage" />

    <!-- 表单区域 -->
    <div class="form-area">
      <!-- 标签切换 -->
      <TabSwitcher
        v-model:active-tab="activeTab"
        :is-register-mode="isRegisterMode"
        @update:register-mode="updateRegisterMode"
      />

      <!-- 账号登录/注册表单 -->
      <AccountForm
        v-if="activeTab === 'account'"
        :is-register-mode="isRegisterMode"
        @login="handleAccountLogin"
        @register="handleAccountRegister"
      />

      <!-- 手机号登录/注册表单 -->
      <PhoneForm
        v-if="activeTab === 'phone'"
        :is-register-mode="isRegisterMode"
        @login="handlePhoneLogin"
        @register="handlePhoneRegister"
      />


      <!-- 第三方登录 -->
      <ThirdPartyLogin v-if="!isRegisterMode" />

      <!-- 登录页脚 -->
      <LoginFooter :is-register-mode="isRegisterMode" @toggle-mode="toggleRegisterMode" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import LoginBrand from './LoginBrandUniversal.vue'
import SecurityAlert from './components/SecurityAlert.vue'
import TabSwitcher from './components/TabSwitcher.vue'
import AccountForm from './forms/AccountForm.vue'
import PhoneForm from './forms/PhoneForm.vue'
import ThirdPartyLogin from './components/ThirdPartyLogin.vue'
import LoginFooter from './components/LoginFooter.vue'

const { t } = useI18n()

// Props
interface LoginContainerProps {
  projectSelectorProps?: {
    isMobile: boolean
    currentSource: string | null
    selectProjectText: string
    availableProjects: Array<{ key: string; name: string }>
    selectedProject: string
    selectProject: (key: string) => void
  }
}

const _props = defineProps<LoginContainerProps>()

// 路由和状态
const _router = useRouter()
const route = useRoute()

// 响应式状态
const activeTab = ref<'account' | 'phone'>('account')
const isRegisterMode = ref(false)
const showSecurityAlert = ref(false)
const securityAlertMessage = ref('')

// 计算属性
const isDarkMode = computed(() => {
  // 检查 HTML 元素是否有 dark 类
  return document.documentElement.classList.contains('dark')
})

// 方法
const updateRegisterMode = (value: boolean) => {
  isRegisterMode.value = value
}

const toggleRegisterMode = () => {
  isRegisterMode.value = !isRegisterMode.value
}

// 初始化
onMounted(() => {
  // 根据路由参数初始化状态
  const routeWithName = route as { name?: string | symbol | null; path: string }
  if (
    (routeWithName.name as string | undefined) === 'register' ||
    route.path === '/register' ||
    route.path.includes('/register')
  ) {
    isRegisterMode.value = true
  }

  // 检查是否需要显示安全提示
  checkSecurityAlert()
})

const checkSecurityAlert = () => {
  // 安全提示逻辑
  const isHttps = window.location.protocol === 'https:'
  if (!isHttps && window.location.hostname !== 'localhost') {
    showSecurityAlert.value = true
    securityAlertMessage.value = t('login.error.insecureConnection')
  }
}



// 账号登录和注册处理方法（占位，实际由AccountForm组件处理）
const handleAccountLogin = () => {
  // AccountForm组件内部处理
}

const handleAccountRegister = () => {
  // AccountForm组件内部处理
}

const handlePhoneLogin = () => {
  // PhoneForm组件内部处理
}

const handlePhoneRegister = () => {
  // PhoneForm组件内部处理
}
</script>

<style scoped lang="scss">
// ============================================
// LoginContainer CSS 变量定义
// 使用 --lc- 前缀避免冲突
// ============================================
.login-content {
  // 组件级 CSS 变量
  --lc-input-radius: 12px;
  --lc-input-border: var(--unified-border);
  --lc-input-bg: var(--el-bg-color);
  --lc-input-transition: border-color 0.3s ease, border-width 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease;
  --lc-input-hover-shadow: var(--global-box-shadow);
  --lc-input-focus-shadow: var(--global-box-shadow);
  --lc-input-animated-shadow: var(--global-box-shadow);
  --lc-input-error-shadow: var(--global-box-shadow);
  --lc-btn-radius: 12px;
  --lc-btn-padding: 12px 24px;
  --lc-btn-font-weight: 600;
  --lc-btn-transition: background-color 0.3s ease, border-color 0.3s ease, transform 0.3s ease;
  --lc-icon-size: 44px;
  --lc-icon-img-size: 28px;
  --lc-icon-radius: 50%;
  --lc-marquee-item-width: 160px;
  --lc-marquee-item-height: 80px;
  --lc-marquee-item-padding: 12px 16px;

  // 移动端变量
  --lc-mobile-btn-padding: 14px 24px;
  --lc-mobile-btn-font-size: 16px;
  --lc-mobile-icon-size: 40px;
  --lc-mobile-icon-img-size: 24px;

  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: transparent;
  position: relative;

  &.dark-mode {
    background: transparent;
  }
}

.form-area {
  width: 100%;
  max-width: 100%;
  background: var(--color-white-95);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: var(--global-border-radius);
  padding: 40px;
  margin-top: 32px;
  transition: background-color 0.3s ease;

  .dark-mode & {
    background: var(--color-dark-1e1e1e-95);
  }
}

// 优化输入框样式 - 使用 CSS 变量替代 
.login-content :deep(.el-input__wrapper) {
  border-radius: var(--lc-input-radius);
  border: var(--lc-input-border);
  background-color: var(--lc-input-bg);
  transition: var(--lc-input-transition);

  &:hover {
    border: var(--el-border-width-primary) solid var(--el-color-primary);
    box-shadow: var(--lc-input-hover-shadow);
  }

  &.is-focus {
    border: var(--el-border-width-primary) solid var(--el-color-primary);
    box-shadow: var(--lc-input-focus-shadow);
  }

  &.input-focus-animated {
    box-shadow: var(--lc-input-animated-shadow);
    
  }
}

// 优化按钮样式 - 使用 CSS 变量替代 
.login-content :deep(.el-button--primary) {
  border-radius: var(--lc-btn-radius);
  padding: var(--lc-btn-padding);
  font-weight: var(--lc-btn-font-weight);
  background-color: var(--el-color-primary);
  border: var(--el-border-width-primary) solid var(--el-color-primary);
  transition: var(--lc-btn-transition);

  &:hover {
    background-color: var(--el-color-primary-dark-2);
    border-color: var(--el-color-primary-dark-2);
    
    }

  &:active {
    transform: translateY(0);
  }
}

// 优化第三方登录图标样式 - 使用 CSS 变量替代 
.login-content :deep(.third-party-icon) {
  width: var(--lc-icon-size);
  height: var(--lc-icon-size);
  border-radius: var(--lc-icon-radius);
  background-color: var(--el-bg-color);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--lc-btn-transition);

  &:hover {
    transform: translateY(-3px) scale(1.05);
    }

  img {
    width: var(--lc-icon-img-size);
    height: var(--lc-icon-img-size);
    object-fit: contain;
  }
}

// 优化标签切换样式
:deep(.tab-switcher) {
  margin-bottom: 24px;

  .tab-item {
    padding: 10px 20px;
    border-radius: var(--global-border-radius);
    transition: background-color 0.3s ease, color 0.3s ease, font-weight 0.3s ease;

    &.active {
      background-color: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
      font-weight: 600;
    }

    &:hover {
      background-color: var(--el-color-primary-light-9);
    }
  }
}

// 图片加载动画
:deep(.welcome-svg) {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.4s ease-out, transform 0.4s ease-out;

  &.loaded {
    opacity: 1;
    transform: translateY(0);
  }
}

// 表单加载遮罩
:deep(.login-loading-overlay) {
  position: fixed;
  inset: 0;
  background-color: var(--color-black-50);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: var(--z-notification);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);

  .loading-icon {
    font-size: 32px;
    color: var(--el-color-primary);
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  .loading-text {
    color: var(--color-on-primary);
    font-size: 16px;
    font-weight: 500;
  }
}

// 项目选择器按钮动画
:deep(.project-selector-banner .selector-btn) {
  transition: transform 0.3s ease;

  &:hover {
    
    }

  &:active {
    transform: translateY(0);
  }
}

// 品牌跑马灯样式
.brand-marquee {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 66.66%;
  height: auto;
  min-height: 100px;
  overflow: visible;
  pointer-events: none;
  z-index: calc(var(--z-base) + 9);
  padding: 10px 0;
}

.marquee-track {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 100%;
  animation: marquee 30s linear infinite;
}

// 品牌卡片样式 - 使用 CSS 变量替代 
.marquee-item {
  margin: 0 16px;
  min-width: var(--lc-marquee-item-width);
  min-height: var(--lc-marquee-item-height);
  padding: var(--lc-marquee-item-padding);
}

.marquee-image {
  width: var(--lc-marquee-item-width);
  height: var(--lc-marquee-item-height);
  max-width: var(--lc-marquee-item-width);
  max-height: var(--lc-marquee-item-height);
  min-width: var(--lc-marquee-item-width);
  min-height: var(--lc-marquee-item-height);
}

// 跑马灯动画
@keyframes marquee {
  0% {
    transform: translateX(0);
  }

  100% {
    transform: translateX(-50%);
  }
}

// 动画效果
@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 过渡效果
:deep(.fade-in-enter-active),
:deep(.fade-in-leave-active) {
  transition: opacity 0.3s ease;
}

:deep(.fade-in-enter-from),
:deep(.fade-in-leave-to) {
  opacity: 0;
}

:deep(.slide-up-enter-active),
:deep(.slide-up-leave-active) {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

:deep(.slide-up-enter-from),
:deep(.slide-up-leave-to) {
  opacity: 0;
  transform: translateY(20px);
}

// 表单验证反馈优化 - 使用 CSS 变量替代
:where(.login-content) :deep(.el-form-item.is-error .el-input__wrapper) {
  box-shadow: var(--lc-input-error-shadow);
}

:deep(.el-form-item__error) {
  font-size: 12px;
  margin-top: 4px;
  color: var(--el-color-danger);
  animation: fadeIn 0.3s ease;
}

// 移动端响应式 - 使用 CSS 变量替代 
@media (width <= 768px) {
  .login-content {
    // 更新移动端变量值
    --lc-btn-padding: var(--lc-mobile-btn-padding);
    --lc-icon-size: var(--lc-mobile-icon-size);
    --lc-icon-img-size: var(--lc-mobile-icon-img-size);
  }

  .brand-marquee {
    display: none;
  }
  
  .login-content {
    padding: 16px;
  }

  .form-area {
    padding: 28px;
    margin-top: 16px;
  }

  // 移动端按钮字体大小
  .login-content :deep(.el-button--primary) {
    font-size: var(--lc-mobile-btn-font-size);
  }

  // 移动端加载遮罩优化
  :deep(.login-loading-overlay) {
    background-color: var(--color-black-70);

    .loading-icon {
      font-size: 28px;
    }

    .loading-text {
      font-size: 14px;
    }
  }
}
</style>
