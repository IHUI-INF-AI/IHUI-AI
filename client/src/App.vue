<!--
  根组件 / App.vue
  原 1590 行,重构后 <300 行。
  拆出逻辑(全部抽到 composables/):
    - 字体加载        → useFontLoader
    - SSO 回调       → useAuthBootstrap.handleSsoCallback
    - 认证状态恢复   → useAuthBootstrap.restoreAuthState
    - 滚动渐变       → useAppLifecycle (onScrollFade)
    - 暗色模式快捷键 → useAppLifecycle
    - 全局通知       → useGlobalNotification
    - 全局 AI 对话   → useGlobalChat
    - 会话过期事件   → useAppLifecycle
    - 图片错误兜底   → useElementVisibility.installImageFallback
    - 关键容器可见性 → useElementVisibility.forceVisible + CRITICAL_VISIBILITY_TARGETS
  全局兜底样式已抽到 styles/_app-shell.scss。
-->
<template>
  <el-config-provider :locale="epLocale">
    <Error>
      <Teleport to="body">
        <Header v-if="!isAdminRoute" @select="handleSelect" />
      </Teleport>

      <div v-if="isAdminRoute" class="admin-route-container">
        <RouterView />
      </div>

      <div v-else class="app-container">
        <a href="#main-content" class="skip-link">{{ t('app.skipToMain') }}</a>
        <main
          class="main-content"
          :class="{
            'login-route': isLoginRoute || isRegisterRoute,
            'route-home': isHomeRoute,
            'open-platform-route': isOpenPlatformRoute,
          }"
          id="main-content"
        >
          <RouterView v-slot="{ Component, route }">
            <!-- 登录/注册/开放平台直接渲染,避免白屏 -->
            <component
              v-if="isBareRoute(route)"
              :is="Component"
              :key="route.path"
            />
            <!-- 其他路由用 Transition + KeepAlive -->
            <Transition v-else :name="(route.meta?.transition as string) || 'fade'" mode="out-in">
              <KeepAlive :include="keepAliveRoutes">
                <component :is="Component" :key="route.path" />
              </KeepAlive>
            </Transition>
          </RouterView>
        </main>
        <Footer v-if="route.meta?.showFooter === true" />

        <!-- 网络离线提示 -->
        <Transition name="slide-down">
          <div v-if="!isOnline" class="network-offline-banner" role="status" aria-live="polite">
            <el-icon><AlertTriangle /></el-icon>
            <span>{{ t('app.offlineWarning') }}</span>
          </div>
        </Transition>

        <!-- 全局通知 -->
        <ErrorNotification
          v-if="globalNotification"
          :error="globalNotification"
          @close="globalNotification = null"
        />

        <!-- 全局加载 -->
        <GlobalLoading
          v-if="!isLoginRoute && !isRegisterRoute"
          :visible="globalLoading"
          :text="globalLoadingText"
          :fullscreen="true"
          :lock="true"
        />

        <!-- AI 对话(管理端不显示) -->
        <AIChat
          v-if="showAIChat && showGlobalChat && !useLegacyChat && !isAdminRoute"
          :key="route.fullPath"
          ref="floatingChatRef"
          v-model:visible="showAIChat"
          :show-toggle="true"
          :enable-voice="true"
          :enable-file-upload="true"
          :enable-search="true"
          :show-model-selector="true"
          :dialog-title="t('hardcoded.app.AI智能助手')"
          @message-sent="onGlobalMessageSent"
          @message-received="onGlobalMessageSent"
        />
        <AIChatLegacy
          v-if="showAIChat && useLegacyChat && !isAdminRoute"
          :key="route.fullPath"
          ref="globalChatRef"
          :mode="chatMode"
          :show-toggle="true"
          :default-collapsed="defaultCollapsed"
          @message-sent="onGlobalMessageSent"
        />

        <!-- 全局指令面板 Cmd+K(管理端不显示) -->
        <GlobalCommandPalette v-if="!isAdminRoute" v-model="showCommandPalette" />

        <!-- PWA 安装提示 -->
        <PWAInstallPrompt v-model:visible="showPWAInstallPrompt" />

        <!-- PWA 更新提示 -->
        <PWAUpdatePrompt />

        <!-- 移动端底部导航 -->
        <MobileBottomNav v-if="!isAdminRoute" />

        <!-- 主题切换 loading -->
        <ThemeLoadingIndicator
          :is-visible="darkModeStore.isLoading"
          :is-dark="darkModeStore.isDarkMode"
        />
      </div>
    </Error>
  </el-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { logger } from '@/utils/logger'
import { useResilience } from './utils/resilience'
import { useProgressiveEnhancement } from './utils/progressiveEnhancement'
import { useOptimization } from './utils/optimization'
import { initCspReport } from './utils/cspReport'
import { sessionManager } from './utils/sessionManager'
import { AlertTriangle } from '@/lib/lucide-fallback'
import { getElementPlusLocale } from '@/locales'

import { useLanguageStore } from '@/stores/language'
import { useFontStore } from '@/stores/font'
import { useDarkModeStore } from '@/stores/darkMode'
import { useChatModeStore } from '@/stores/chatMode'
import { useLoadingStore } from '@/stores/loading'

import { handleSsoCallback, restoreAuthState } from '@/composables/useAuthBootstrap'
import { useFontLoader } from '@/composables/useFontLoader'
import {
  useElementVisibility,
  CRITICAL_VISIBILITY_TARGETS,
} from '@/composables/useElementVisibility'
import { useAppLifecycle } from '@/composables/useAppLifecycle'
import { useGlobalNotification } from '@/composables/useGlobalNotification'
import { useGlobalChat } from '@/composables/useGlobalChat'

import Header from './components/Header.vue'
import Footer from './components/Footer.vue'
import Error from './components/Error.vue'

// 异步组件按需加载(减小首屏 JS 体积)
const ErrorNotification = defineAsyncComponent(() => import('./components/ErrorNotification.vue'))
const GlobalCommandPalette = defineAsyncComponent(
  () => import('@/components/common/GlobalCommandPalette.vue'),
)
const GlobalLoading = defineAsyncComponent(
  () => import('@/components/common/GlobalLoading.vue'),
)
const PWAInstallPrompt = defineAsyncComponent(
  () => import('@/components/common/PWAInstallPrompt.vue'),
)
const PWAUpdatePrompt = defineAsyncComponent(
  () => import('@/components/common/PWAUpdatePrompt.vue'),
)
const MobileBottomNav = defineAsyncComponent(
  () => import('@/components/mobile/MobileBottomNav.vue'),
)
const ThemeLoadingIndicator = defineAsyncComponent(
  () => import('@/components/ThemeLoadingIndicator.vue'),
)
const AIChat = defineAsyncComponent(() => import('@/components/ai/AIChat.vue'))
const AIChatLegacy = defineAsyncComponent(() => import('@/components/ai/AIChatLegacy.vue'))

logger.info('[App] App.vue 开始初始化...')

// ═══ 路由 / 国际化 ═══
const route = useRoute()
const { t, locale } = useI18n()
const epLocale = computed(() => getElementPlusLocale(locale.value))

// ═══ 状态管理初始化 ═══
const languageStore = useLanguageStore()
const fontStore = useFontStore()
const loadingStore = useLoadingStore()
const darkModeStore = useDarkModeStore()
const chatModeStore = useChatModeStore()
darkModeStore.initDarkMode?.()

// ═══ 路由判断 ═══
const isLoginRoute = computed(() => route.name === 'login' || route.path === '/login')
const isRegisterRoute = computed(() => route.name === 'register' || route.path === '/register')
const isHomeRoute = computed(() => route.name === 'home' || route.path === '/')
const isOpenPlatformRoute = computed(() => route.name === 'openPlatform' || route.path === '/open')
const isAdminRoute = computed(
  () => route.path.startsWith('/admin-classic') || route.path.startsWith('/m/admin'),
)

const isBareRoute = (r: { name?: string | symbol; path: string }) =>
  r.name === 'login' ||
  r.name === 'register' ||
  r.name === 'openPlatform' ||
  r.path === '/open'

// ═══ 异步 composable 装配 ═══
const { isOnline } = useResilience()
const { checkFeatures, adaptToNetwork } = useProgressiveEnhancement()
const { monitorTasks } = useOptimization()

const { forceVisible, installImageFallback } = useElementVisibility()
useFontLoader()
const { notification: globalNotification, install: installNotification } =
  useGlobalNotification()
installNotification()

const showAIChat = ref(false) // 性能优化:默认隐藏,避免 405KB 拖累首屏
const useLegacyChat = ref(false)
const showCommandPalette = ref(false)
const showPWAInstallPrompt = ref(false)
const floatingChatRef = ref<{
  openDialog?: () => void
  focusInput?: () => void
  setInitialText?: (text: string) => void
  setInitialAgentTag?: (name: string, avatar?: string) => void
  switchMode?: (mode: string) => void
  selectAgent?: (agent: any) => void
  selectModel?: (model: any) => void
} | null>(null)
const globalChatRef = ref<{
  scrollToMessages?: () => void
  currentSessionId?: { value: string | null }
  loadSessionMessages?: () => Promise<void>
} | null>(null)
// showAIChat 需先声明,再传入 useGlobalChat 作为 onMount 回调(触发 AIChat 组件挂载)
const globalChat = useGlobalChat(() => {
  showAIChat.value = true
})
globalChat.install()
watch(floatingChatRef, r => globalChat.setFloatingChatRef(r), { immediate: true })

// 全局加载状态(从 store 获取)
const globalLoading = computed(() => loadingStore.globalLoading)
const globalLoadingText = computed(() => loadingStore.globalLoadingText)

// 全局 chat 模式(供 AIChatLegacy 使用)
const chatMode = computed<'global' | 'dialog' | 'agent'>(() => chatModeStore.mode)
const showGlobalChat = computed(
  () =>
    route.name !== 'AIManagement' &&
    route.name !== 'login' &&
    route.name !== 'register' &&
    !isAdminRoute.value,
)
const defaultCollapsed = computed(() => false)

// 滚动渐变(对应 useAppLifecycle 的 onScrollFade)
const updateChatFade = (progress: number) => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (isHomeRoute.value || progress === 0) {
    root.style.setProperty('--global-chat-opacity', '1')
    root.style.setProperty('--global-chat-translate-y', '0px')
    root.style.setProperty('--global-chat-pointer', 'auto')
    return
  }
  const opacity = String(1 - progress)
  const translateY = `${progress * 24}px`
  root.style.setProperty('--global-chat-opacity', opacity)
  root.style.setProperty('--global-chat-translate-y', translateY)
  root.style.setProperty('--global-chat-pointer', 'auto')
}
useAppLifecycle({ onScrollFade: updateChatFade })

// KeepAlive 路由列表
const keepAliveRoutes = ref<string[]>(['Home', 'Xuqiu', 'Chat'])

// 头部菜单点击
const handleSelect = (): void => { /* 由子组件 emit,父级无需处理 */ }
const onGlobalMessageSent = (): void => { /* 全局 AI 聊天消息统计钩子 */ }

// ═══ 启动流程 ═══
onMounted(async () => {
  // CSP 违规上报
  initCspReport()

  // 强制清除残留加载态(多次兜底)
  const clearLoading = () => {
    try {
      loadingStore.stopGlobalLoading()
      loadingStore.clearAllLoading()
    } catch (e) {
      logger.warn('[App] 清除加载状态失败:', e)
    }
  }
  clearLoading()
  setTimeout(clearLoading, 100)
  setTimeout(clearLoading, 500)
  setTimeout(clearLoading, 1000)

  // 1) SSO 回调(若 URL 含 token/refreshToken/userInfo)
  const ssoResult = await handleSsoCallback()
  if (ssoResult.hadSsoParams && ssoResult.success) {
    try {
      const { ElMessage } = await import('element-plus')
      ElMessage.success(t('unifiedAuth.loginSuccess'))
    } catch {
      // ignore
    }
  }

  // 2) 恢复 localStorage 中的登录态
  await restoreAuthState()

  // 3) 会话管理
  sessionManager.init()

  // 4) 关键容器可见性兜底
  for (const target of CRITICAL_VISIBILITY_TARGETS) {
    forceVisible(target.selector, target.display)
  }

  // 5) 全局图片错误兜底
  const uninstallImageFallback = installImageFallback()

  // 6) 语言 / 字体 / 暗色模式初始化
  languageStore.initLanguage()
  fontStore.initFont?.()
  darkModeStore.initDarkMode?.()

  // 7) 浏览器能力检测与网络自适应
  checkFeatures([
    'localStorage',
    'sessionStorage',
    'serviceWorker',
    'webWorker',
    'intersectionObserver',
    'requestIdleCallback',
  ])
  adaptToNetwork()

  // 8) 长任务监控(仅开发环境)
  monitorTasks(
    (duration: number) => {
      if (import.meta.env.DEV && duration > 200) {
        logger.warn('检测到长时间任务', { duration })
      }
    },
    { threshold: 200, delay: 5000 },
  )

  // 卸载时清理图片错误兜底
  return () => uninstallImageFallback()
})

// 路由切换时同步滚动渐变
watch(
  () => route.path,
  () => {
    nextTick(() => {
      if (isHomeRoute.value) updateChatFade(0)
    })
  },
)
</script>
