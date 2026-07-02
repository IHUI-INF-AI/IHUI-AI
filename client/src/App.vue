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
      <div v-if="isAdminRoute" class="admin-route-container">
        <RouterView />
      </div>

      <div v-else class="app-container">
        <a href="#main-content" class="skip-link">{{ t('app.skipToMain') }}</a>
        <!-- 左侧边栏 + 右侧工作区布局（所有非管理端页面均挂载 Sidebar，贯穿整个项目） -->
        <div class="app-layout">
          <Sidebar
            @language-change="handleLanguageChange"
            @show-login-popup="handleShowLoginPopup"
            @feedback-click="handleFeedbackClick"
          />

          <!-- 左侧 AI 对话面板（桌面端，Trae Work 风格：紧贴 Sidebar 右侧） -->
          <aside
            v-if="showGlobalChat && !isAdminRoute"
            class="ai-side-panel"
            :class="{ 'is-resizing': isResizing, 'is-open': aiPanelIsOpen, 'is-empty': !hasEnteredWorkspace }"
            :style="{ '--ai-panel-width': aiPanelWidth + 'px' }"
            :aria-hidden="!aiPanelIsOpen"
          >
            <!-- 空文件夹形态：未进入工作区时，整个面板只显示空态 + 关闭按钮 -->
            <div v-if="!hasEnteredWorkspace" class="ai-side-panel-empty">
              <button
                class="ai-side-panel-close ai-side-panel-close--floating"
                @click="aiPanelClose"
                :aria-label="t('common.close')"
                :title="t('common.close')"
                type="button"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
              <div class="ai-side-panel-empty-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                  <path d="M8 10h8" />
                  <path d="M8 14h5" />
                </svg>
              </div>
              <h3 class="ai-side-panel-empty-title">{{ t('floatingChat.emptyWorkspace.title') }}</h3>
              <p class="ai-side-panel-empty-desc">{{ t('floatingChat.emptyWorkspace.description') }}</p>
              <div class="ai-side-panel-empty-actions el-button-stack">
                <el-button type="primary" @click="handleEnterWorkspace('model')">
                  {{ t('floatingChat.emptyWorkspace.selectModel') }}
                </el-button>
                <el-button @click="handleEnterWorkspace('agent')">
                  {{ t('floatingChat.emptyWorkspace.selectAgent') }}
                </el-button>
              </div>
            </div>
            <!-- 工作区已进入：AIChat embedded 模式内置 dialog-header（含 AI智能助手 前缀 + 模型标签 + 搜索/更多/关闭），
                 避免与外层标题栏重复堆叠 -->
            <template v-else>
              <!-- 面板主体：AIChat embedded 容器（dialog-header 充任面板标题栏） -->
              <div class="ai-side-panel-body">
                <AIChat
                  v-if="aiPanelLoaded"
                  ref="embeddedChatRef"
                  mode="embedded"
                  :show-toggle="false"
                  :show-minimize="false"
                  :show-close="true"
                  :draggable="false"
                  :resizable="false"
                  :enable-voice="true"
                  :enable-file-upload="true"
                  :enable-search="true"
                  :show-model-selector="true"
                  :show-header="true"
                  :panel-title="aiPanelTitle"
                  :dialog-title="aiPanelTitle"
                  @close="aiPanelClose"
                  @message-sent="onGlobalMessageSent"
                  @message-received="onGlobalMessageSent"
                />
              </div>
            </template>
            <!-- 右侧拖拽手柄（调整面板宽度） -->
            <div
              class="ai-side-panel-resize-handle"
              @mousedown.prevent="startResize"
              role="separator"
              aria-orientation="vertical"
              :aria-valuenow="aiPanelWidth"
              :aria-valuemin="aiPanelMinWidth"
              :aria-valuemax="aiPanelMaxWidth"
              tabindex="0"
            />
          </aside>

          <div class="workspace">
            <WorkspaceHeader
              @open-mobile-sidebar="openMobile"
            />
            <div
              class="workspace-content"
              :class="{
                'route-home': isHomeRoute,
                'open-platform-route': isOpenPlatformRoute,
              }"
              id="main-content"
            >
              <RouterView v-slot="{ Component, route: rv }">
                <Transition :name="(rv.meta?.transition as string) || 'fade'" mode="out-in">
                  <KeepAlive :include="keepAliveRoutes">
                    <component :is="Component" :key="rv.path" />
                  </KeepAlive>
                </Transition>
              </RouterView>
            </div>
            <Footer v-if="route.meta?.showFooter === true" />
          </div>
        </div>

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

        <!-- 新设备登录 / 可疑登录通知 -->
        <NewDeviceNotification
          :visible="newDeviceNotificationVisible"
          :is-warning="newDeviceIsWarning"
          :device-info="newDeviceInfo"
          @dismiss="dismissNewDeviceNotification"
          @secure-account="dismissNewDeviceNotification"
        />

        <!-- 全局加载 -->
        <GlobalLoading
          :visible="globalLoading"
          :text="globalLoadingText"
          :fullscreen="true"
          :lock="true"
        />

        <!-- AI 对话：桌面端已迁移至左侧 .ai-side-panel（embedded 模式，紧贴 Sidebar 右侧）；
             此处仅保留移动端浮窗（floating 模式）和 Legacy 兼容模式 -->
        <AIChat
          v-if="aiPanelIsMobile && showGlobalChat && !useLegacyChat && !isAdminRoute"
          :key="'mobile-chat-' + route.fullPath"
          ref="floatingChatRef"
          v-model:visible="mobileChatVisible"
          :show-toggle="true"
          :enable-voice="true"
          :enable-file-upload="true"
          :enable-search="true"
          :show-model-selector="true"
          :dialog-title="aiPanelTitle"
          @message-sent="onGlobalMessageSent"
          @message-received="onGlobalMessageSent"
        />
        <AIChatLegacy
          v-if="aiPanelIsMobile && useLegacyChat && !isAdminRoute"
          :key="'mobile-legacy-' + route.fullPath"
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

        <!-- 主题切换 loading -->
        <ThemeLoadingIndicator
          :is-visible="darkModeStore.isLoading"
          :is-dark="darkModeStore.isDarkMode"
        />

        <!-- 全局登录/注册弹窗（贯穿所有非管理端页面） -->
        <LoginDialog />
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
import { useSidebar } from '@/composables/useSidebar'
import { useAiPanel } from '@/composables/useAiPanel'
import { useCleanup } from '@/composables/useCleanup'
import { useLoginDialog } from '@/composables/useLoginDialog'

import Footer from './components/Footer.vue'
import Error from './components/Error.vue'
import Sidebar from './components/Sidebar.vue'
import WorkspaceHeader from './components/WorkspaceHeader.vue'
import LoginDialog from './components/login/LoginDialog.vue'
import NewDeviceNotification from '@/components/common/NewDeviceNotification.vue'

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
const isHomeRoute = computed(() => route.name === 'home' || route.path === '/')
const isOpenPlatformRoute = computed(() => route.name === 'openPlatform' || route.path === '/open')
const isAdminRoute = computed(
  () => route.path.startsWith('/admin-classic') || route.path.startsWith('/m/admin'),
)

// 注：原 isBarePage 已废弃，所有非管理端页面均挂载 Sidebar（含登录/注册/开放平台）
// 登录/注册改为弹窗形式（LoginDialog），由 useLoginDialog 单例 composable 全局控制

// ═══ 异步 composable 装配 ═══
const { isOnline } = useResilience()
const { checkFeatures, adaptToNetwork } = useProgressiveEnhancement()
const { monitorTasks } = useOptimization()

const { forceVisible, installImageFallback } = useElementVisibility()
useFontLoader()
const { notification: globalNotification, install: installNotification } =
  useGlobalNotification()
installNotification()

// ═══ 新设备登录通知 (登录安全检测) ═══
interface NewDeviceNotificationData {
  deviceName?: string
  location?: string
  time?: number
  ip?: string
}
const newDeviceNotificationVisible = ref(false)
const newDeviceIsWarning = ref(false)
const newDeviceInfo = ref<NewDeviceNotificationData | undefined>(undefined)

const dismissNewDeviceNotification = () => {
  newDeviceNotificationVisible.value = false
}

const globalChat = useGlobalChat()
globalChat.install()

// 清理 composable（统一管理全局事件监听器，避免内存泄漏）
const cleanup = useCleanup()

// ═══ 左侧 AI 面板状态（Trae Work 风格，桌面端默认开启） ═══
const aiPanel = useAiPanel()
const aiPanelIsOpen = aiPanel.isOpen
const aiPanelIsMobile = aiPanel.isMobile
const aiPanelWidth = aiPanel.width
const aiPanelMinWidth = aiPanel.minWidth
const aiPanelMaxWidth = aiPanel.maxWidth
const aiPanelClose = aiPanel.close
const aiPanelToggle = aiPanel.toggle
const hasEnteredWorkspace = aiPanel.hasEnteredWorkspace
const enterWorkspace = aiPanel.enterWorkspace

// 面板标题（i18n）
const aiPanelTitle = computed(() => t('hardcoded.app.AI智能助手'))

// 懒加载 AIChat 组件：首次打开面板时才挂载，避免 405KB 拖累首屏
const aiPanelLoaded = ref(false)
watch(
  aiPanelIsOpen,
  open => {
    if (open && !aiPanelLoaded.value) {
      aiPanelLoaded.value = true
    }
  },
  { immediate: true },
)

// 拖拽调整面板宽度
const isResizing = ref(false)
const startResize = (e: MouseEvent): void => {
  // 移动端不允许拖拽（面板隐藏）
  if (aiPanelIsMobile.value) return
  e.preventDefault()
  isResizing.value = true
  const startX = e.clientX
  const startWidth = aiPanelWidth.value
  // 拖拽过程禁止文本选中
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'

  const onMove = (ev: MouseEvent): void => {
    // 向右拖 → delta 正 → 宽度增加（手柄位于面板右侧）
    const delta = ev.clientX - startX
    aiPanel.setWidth(startWidth + delta)
  }
  const onUp = (): void => {
    isResizing.value = false
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// Ctrl/Cmd+I 快捷键：切换 AI 面板（与 VS Code 风格一致）
// 规则：
//   1. 仅桌面端生效（移动端由浮窗接管，无面板概念）
//   2. 排除输入框聚焦场景，避免与编辑器快捷键冲突
//   3. 阻止默认行为（部分浏览器 Cmd+I 有"斜体"等绑定）
const handleAiToggleShortcut = (e: KeyboardEvent): void => {
  if (aiPanelIsMobile.value) return
  if (!(e.ctrlKey || e.metaKey)) return
  const key = e.key.toLowerCase()
  if (key !== 'i') return
  const target = e.target as HTMLElement | null
  if (target) {
    const tag = target.tagName
    if (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target.isContentEditable
    ) {
      return
    }
  }
  e.preventDefault()
  aiPanelToggle()
}

// AI 对话开关与 ref 注入
const useLegacyChat = ref(false)
const showCommandPalette = ref(false)
const showPWAInstallPrompt = ref(false)

// 移动端浮窗 visible 状态
const mobileChatVisible = ref(false)

// 桌面端 embedded 模式 AIChat ref
const embeddedChatRef = ref<{
  openDialog?: () => void
  focusInput?: () => void
  setInitialText?: (text: string) => void
  setInitialAgentTag?: (name: string, avatar?: string) => void
  switchMode?: (mode: string) => void
  selectAgent?: (agent: unknown) => void
  selectModel?: (model: unknown) => void
  openCapabilityPanel?: (mode?: 'model' | 'agent' | 'mcp') => void
} | null>(null)

// 进入工作区后的待切换模式（'model' | 'agent'），由空文件夹 CTA 按钮设置，AIChat 挂载后消费
const pendingMode = ref<'model' | 'agent' | null>(null)
const handleEnterWorkspace = (mode: 'model' | 'agent'): void => {
  pendingMode.value = mode
  enterWorkspace()
}
watch(
  () => embeddedChatRef.value,
  inst => {
    const mode = pendingMode.value
    if (inst && mode) {
      // AIChat 挂载后打开对应能力选择器（模型/智能体），让用户直接选择
      nextTick(() => {
        inst.openCapabilityPanel?.(mode)
        pendingMode.value = null
      })
    }
  },
)
// 移动端 floating 模式 AIChat ref
const floatingChatRef = ref<{
  openDialog?: () => void
  focusInput?: () => void
  setInitialText?: (text: string) => void
  setInitialAgentTag?: (name: string, avatar?: string) => void
  switchMode?: (mode: string) => void
  selectAgent?: (agent: unknown) => void
  selectModel?: (model: unknown) => void
} | null>(null)
const globalChatRef = ref<{
  scrollToMessages?: () => void
  currentSessionId?: { value: string | null }
  loadSessionMessages?: () => Promise<void>
} | null>(null)

// 根据屏幕尺寸动态注入对应 ref 到 globalChat
// 桌面端用 embeddedChatRef，移动端用 floatingChatRef
const activeChatRef = computed(() =>
  aiPanelIsMobile.value ? floatingChatRef.value : embeddedChatRef.value,
)
watch(activeChatRef, r => globalChat.setFloatingChatRef(r), { immediate: true })

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

// 侧边栏状态（来自单例 composable，与 Sidebar/WorkspaceHeader 共享）
const { openMobile } = useSidebar()

// 登录弹窗状态（来自单例 composable，与 LoginDialog/Sidebar 共享）
const loginDialog = useLoginDialog()

const onGlobalMessageSent = (): void => { /* 全局 AI 聊天消息统计钩子 */ }

// WorkspaceHeader 事件处理
const handleLanguageChange = (lang: string): void => {
  languageStore.setLanguage(lang)
}
const handleShowLoginPopup = (): void => {
  // 触发全局登录弹窗（弹窗形式取代独立 /login 页面）
  loginDialog.open('login')
}
const handleFeedbackClick = (): void => { /* 触发反馈 */ }

// ═══ 启动流程 ═══
onMounted(async () => {
  // 注册 Ctrl/Cmd+I 快捷键（切换左侧 AI 面板）
  cleanup.addEventListener<KeyboardEvent>(window, 'keydown', handleAiToggleShortcut)

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
  // 注: main.ts 在路由守卫前已调用 authStore.initAuth(), 此处不再重复调用
  // 重复调用会导致 store 状态在启动初期被重置两次, 引发依赖 authStore 的 watch 抖动
  // 仅在 SSO 回调成功后才需要重新初始化 (SSO 写入了新 token, 需刷新 store 状态)
  if (ssoResult.hadSsoParams && ssoResult.success) {
    await restoreAuthState()
  }

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
