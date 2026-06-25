<template>
  <div class="third-party-login-universal">
    <div v-if="showTitle" class="login-divider">
      <span class="divider-line"></span>
      <span class="divider-text">{{ title }}</span>
      <span class="divider-line"></span>
    </div>

    <div class="third-party-icons" :class="{ 'grid-layout': useGridLayout }" :key="enabledMethods.length">
      <div
        v-for="method in enabledMethods"
        :key="method.key"
        class="third-party-icon"
        :class="{ 'is-loading': loadingStates[method.key] }"
        :data-tooltip="getTooltipText(method.key)"
        @click="handleMethodClick(method)"
      >
        <div class="icon-wrapper">
          <img
            v-if="method.iconUrl && !iconErrors[method.key]"
            :src="getIconUrl(method)"
            :alt="method.name"
            class="platform-icon"
            @load="handleIconLoad(method.key)"
            @error="handleIconError(method.key)"
            loading="lazy"
          />
          <div v-else class="icon-fallback">
            {{ method.name.charAt(0) }}
          </div>

          <div v-if="loadingStates[method.key]" class="loading-overlay">
            <div class="loading-spinner"></div>
          </div>
        </div>

        <span v-if="showNames" class="platform-name">{{ method.name }}</span>
      </div>
    </div>

    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
// import { useThemeStore } from '@/stores/theme' // Theme store not available

interface ThirdPartyMethod {
  key: string
  name: string
  enabled: boolean
  iconUrl?: string
  darkIconUrl?: string
  component?: any
}

interface Props {
  methods?: ThirdPartyMethod[]
  title?: string
  showTitle?: boolean
  showNames?: boolean
  useGridLayout?: boolean
  maxColumns?: number
  disabled?: boolean
}

interface Emits {
  (e: 'method-click', method: ThirdPartyMethod): void
  (e: 'method-success', method: ThirdPartyMethod, result: any): void
  (e: 'method-error', method: ThirdPartyMethod, error: Error): void
}

const props = withDefaults(defineProps<Props>(), {
  methods: () => [],
  title: '',
  showTitle: true,
  showNames: true,
  useGridLayout: false,
  maxColumns: 4,
  disabled: false,
})

const emit = defineEmits<Emits>()

const { t } = useI18n()

// 响应式数据
const loadingStates = reactive<Record<string, boolean>>({})
const iconErrors = reactive<Record<string, boolean>>({})
const errorMessage = ref('')

// 默认第三方登录方法
const defaultMethods: ThirdPartyMethod[] = [

  {
    key: 'alipay',
    name: t('data.third_party_login_universal.支付宝'),
    enabled: true,
    iconUrl: '/images/loginSANFANG/支付宝支付.svg',
  },
  {
    key: 'google',
    name: 'Google',
    enabled: true,
    iconUrl: '/images/loginSANFANG/谷歌.svg',
  },
  {
    key: 'apple',
    name: 'Apple',
    enabled: true,
    iconUrl: '/images/loginSANFANG/apple.svg',
  },
]

// 计算属性
const enabledMethods = computed(() => {
  const methods = props.methods.length > 0 ? props.methods : defaultMethods
  return methods.filter((method: ThirdPartyMethod) => method.enabled)
})

const _computedTitle = computed(() => {
  return props.title || t('auth.quickLogin')
})

const isDarkMode = computed(() => {
  // 检查 HTML 元素是否有 dark 类
  return document.documentElement.classList.contains('dark')
})

const getTooltipText = (key: string): string => {
  return t(`login.thirdParty.tooltip.${key}`)
}

// 获取图标URL（支持暗色模式）
const getIconUrl = (method: ThirdPartyMethod): string => {
  if (isDarkMode.value && method.darkIconUrl) {
    return method.darkIconUrl
  }
  return method.iconUrl || ''
}

// 处理方法点击
const handleMethodClick = async (method: ThirdPartyMethod) => {
  if (props.disabled || loadingStates[method.key]) {
    return
  }

  try {
    // 清除之前的错误信息
    errorMessage.value = ''

    // 设置加载状态
    loadingStates[method.key] = true

    // 发出点击事件
    emit('method-click', method)

    // 这里可以添加具体的第三方登录逻辑
    // 例如：调用对应的登录API或跳转到第三方授权页面
    await handleThirdPartyLogin(method)
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error))
    errorMessage.value = errorObj.message || t('auth.thirdPartyLoginFailed')
    emit('method-error', method, errorObj)
  } finally {
    // 清除加载状态
    loadingStates[method.key] = false
  }
}

// 处理第三方登录逻辑
const handleThirdPartyLogin = async (method: ThirdPartyMethod) => {
  await new Promise(resolve => setTimeout(resolve, 1000))

  switch (method.key) {
    case 'alipay':
      break
    case 'google':
      break
    case 'apple':
      break
    default:
      throw new Error(t('auth.unsupportedLoginMethod', { method: method.name }))
  }

  emit('method-success', method, { success: true })
}

// 处理图标加载成功
const handleIconLoad = (key: string) => {
  iconErrors[key] = false
}

// 处理图标加载失败
const handleIconError = (key: string) => {
  iconErrors[key] = true
}

// 清除错误信息
const clearError = () => {
  errorMessage.value = ''
}

// 重置所有状态
const reset = () => {
  Object.keys(loadingStates).forEach(key => {
    loadingStates[key] = false
  })
  Object.keys(iconErrors).forEach(key => {
    iconErrors[key] = false
  })
  errorMessage.value = ''
}

// 组件挂载时初始化加载状态
onMounted(() => {
  enabledMethods.value.forEach((method: ThirdPartyMethod) => {
    loadingStates[method.key] = false
    iconErrors[method.key] = false
  })
})

// 暴露方法给父组件
defineExpose({
  clearError,
  reset,
  setLoading: (key: string, loading: boolean) => {
    loadingStates[key] = loading
  },
})
</script>

<style scoped>
.third-party-login {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.login-divider {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 12px;
}

.divider-line {
  flex: 1;
  height: 1px;
  background-color: var(--el-border-color-light);
}

.divider-text {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  padding: 0 4px;
}

.third-party-icons {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
}

.third-party-icons.grid-layout {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 12px;
  max-width: 320px;
}

.third-party-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 8px;
  border-radius: var(--global-border-radius);
  transition: all 0.2s ease;
  position: relative;
  max-width: 36px;
  min-width: 36px;
  width: 36px;
  height: 36px;
  box-sizing: border-box;
  overflow: visible;
}

/* 自定义提示窗口样式 - 使用 ::after 伪元素 */
.third-party-icon::after {
  content: attr(data-tooltip);
  
  /* 定位 */
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-10px);
  z-index: var(--z-dropdown);
  
  /* 尺寸 */
  min-width: 120px;
  max-width: 180px;
  width: max-content;
  padding: 10px 16px;
  white-space: nowrap;
  
  /* 视觉样式 - 明亮模式 */
  background: var(--color-black-85);
  color: var(--el-bg-color);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  text-align: center;
  letter-spacing: 0.2px;
  
  /* 圆角和阴影 */
  border-radius: var(--global-border-radius);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  
  /* 初始状态 - 隐藏 */
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  
  /* 动画过渡 - HMR */
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Hover 状态 - 显示提示窗口 */
.third-party-icon:hover::after {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(-14px);
}

/* Hover 状态 - 按钮背景效果 */
.third-party-icon:hover {
  background-color: var(--el-bg-color-hover);
  transform: translateY(-2px);
}

.third-party-icon.is-loading {
  cursor: not-allowed;
  opacity: 0.7;
}

.icon-wrapper {
  position: relative;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.platform-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
  border-radius: var(--global-border-radius);
  transition: transform 0.2s ease;
}

.third-party-icon:hover .platform-icon {
  transform: scale(1.1);
}

.icon-fallback {
  width: 32px;
  height: 32px;
  border-radius: var(--global-border-radius);
  background-color: var(--el-color-primary);
  color: var(--color-on-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background-color: var(--color-white-80);
  border-radius: var(--global-border-radius);
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--el-color-primary-light-8);
  border-top: var(--el-border-width-primary) solid var(--el-color-primary);
  border-radius: var(--global-border-radius);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.platform-name {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
  line-height: 1.2;
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.error-message {
  color: var(--el-color-danger);
  font-size: 12px;
  text-align: center;
  padding: 8px 12px;
  background-color: var(--el-color-danger-light-9);
  border-radius: var(--global-border-radius);
  width: 100%;
  box-sizing: border-box;
}

/* 响应式设计 */
@media (width <= 480px) {
  .third-party-icons {
    gap: 8px;
  }

  .third-party-icon {
    min-width: 50px;
    padding: 6px;
  }

  .icon-wrapper {
    width: 36px;
    height: 36px;
  }

  .platform-icon {
    width: 28px;
    height: 28px;
  }

  .icon-fallback {
    width: 28px;
    height: 28px;
    font-size: 14px;
  }

  .platform-name {
    font-size: 12px;
    max-width: 60px;
  }
}

/* 暗色模式适配 */
:where(html.dark) .divider-line {
  background-color: var(--el-border-color);
}

:where(html.dark) .divider-text {
  color: var(--el-text-color-secondary);
}

html.dark .third-party-icon:hover {
  background-color: var(--el-bg-color-overlay);
}

/* 暗色模式 - 提示窗口 */
html.dark .third-party-icon::after {
  background: var(--color-white-92);
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  letter-spacing: 0.2px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

html.dark .loading-overlay {
  background-color: var(--color-black-80);
}

:where(html.dark) .platform-name {
  color: var(--el-text-color-secondary);
}

:where(html.dark) .error-message {
  background-color: var(--el-color-danger-dark-2);
  color: var(--el-color-danger-light-3);
}
</style>
