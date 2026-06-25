/**
 * App 全局生命周期 Composable
 * 抽离自 App.vue 的:
 *  - 滚动渐变(updateChatFade)
 *  - 暗色模式快捷键(Alt+T)
 *  - open-ai-chat / select-agent 事件监听
 *  - 会话过期事件
 *  - 网络检测(useResilience 已存在,这里只导出接口)
 *
 * 内部使用 try/catch 兜底,失败不影响页面。
 */

import { onMounted, onUnmounted, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useDarkModeStore } from '@/stores/darkMode'
import { logger } from '@/utils/logger'

export interface AppLifecycleOptions {
  /** 滚动渐变回调(可选,默认更新 CSS 变量) */
  onScrollFade?: (progress: number) => void
}

export interface AppLifecycle {
  /** 是否在首页 */
  isHome: import('vue').Ref<boolean>
  /** 安装/卸载所有全局事件 */
  install: () => void
  /** 主动清理(组件 onUnmounted 自动调用) */
  dispose: () => void
}

export function useAppLifecycle(options: AppLifecycleOptions = {}): AppLifecycle {
  const router = useRouter()
  const { t } = useI18n()

  // 2026-06-24 修复: 不在 useAppLifecycle 顶层直接调用 useAuthStore/useDarkModeStore,
  // 因为 App.vue setup 执行时机可能早于 main.ts 中某些动态 import 完成后的 Pinia
  // 状态完全就绪, 触发 'getActivePinia() was called but there was no active Pinia' 错误.
  // 改为: 1) 顶层先用 try/catch 兜底, 失败时 store 引用为 null, 事件触发时再懒加载.
  //      2) 在 install()/onMounted 中重新尝试拿一次, 避免生命周期内重复尝试.
  let authStore: ReturnType<typeof useAuthStore> | null = null
  let darkModeStore: ReturnType<typeof useDarkModeStore> | null = null
  try {
    authStore = useAuthStore()
  } catch (e) {
    logger.debug('[useAppLifecycle] authStore unavailable on init, will lazy load:', e)
  }
  try {
    darkModeStore = useDarkModeStore()
  } catch (e) {
    logger.debug('[useAppLifecycle] darkModeStore unavailable on init, will lazy load:', e)
  }

  const getAuthStore = (): ReturnType<typeof useAuthStore> | null => {
    if (authStore) return authStore
    try {
      authStore = useAuthStore()
      return authStore
    } catch {
      return null
    }
  }

  const getDarkModeStore = (): ReturnType<typeof useDarkModeStore> | null => {
    if (darkModeStore) return darkModeStore
    try {
      darkModeStore = useDarkModeStore()
      return darkModeStore
    } catch {
      return null
    }
  }

  const isHome = ref(false)

  let handleThemeShortcut: ((e: KeyboardEvent) => void) | null = null
  let handleSessionExpired: ((e: Event) => void) | null = null
  let handleOpenAiChat: EventListener | null = null
  let handleSelectAgent: EventListener | null = null
  let handleScroll: (() => void) | null = null
  let scrollRafId: number | null = null
  const disposers: Array<() => void> = []

  const updateScrollFade = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    try {
      const progress = computeScrollFadeProgress(isHome.value)
      options.onScrollFade?.(progress)
    } catch (e) {
      logger.debug('[useAppLifecycle] Scroll gradient update failed:', e)
    }
  }

  const attachGlobalEvents = () => {
    if (typeof window === 'undefined') return

    // 1) 暗色模式快捷键 Alt+T
    handleThemeShortcut = (event: KeyboardEvent) => {
      if (event.altKey && (event.key === 't' || event.key === 'T')) {
        event.preventDefault()
        const dm = getDarkModeStore()
        if (!dm) return
        dm.toggleDarkMode()
        const mode = dm.isDarkMode ? 'dark' : 'light'
        import('element-plus').then(({ ElMessage }) => {
          ElMessage.success({
            message: `已切换至${mode === 'dark' ? '深色' : '浅色'}模式`,
            duration: 1500,
          })
        }).catch(() => { /* ignore */ })
      }
    }
    window.addEventListener('keydown', handleThemeShortcut)
    disposers.push(() => handleThemeShortcut && window.removeEventListener('keydown', handleThemeShortcut))

    // 2) 会话过期事件
    handleSessionExpired = (event: Event) => {
      const detail = (event as CustomEvent).detail
      const auth = getAuthStore()
      if (auth) auth.logout()
      void router.push('/login')
      const reason = detail?.reason || t('auth.sessionExpiredMessage')
      if (typeof window !== 'undefined' && (window as any).showGlobalNotification) {
        ;(window as any).showGlobalNotification(reason, 'warning')
      }
    }
    window.addEventListener('session-expired', handleSessionExpired)
    disposers.push(() => handleSessionExpired && window.removeEventListener('session-expired', handleSessionExpired))

    // 3) open-ai-chat 事件
    handleOpenAiChat = ((event: Event) => {
      const detail = (event as CustomEvent).detail
      if ((window as any).openGlobalChat) {
        ;(window as any).openGlobalChat({ mode: detail?.mode })
      }
    }) as EventListener
    window.addEventListener('open-ai-chat', handleOpenAiChat)
    disposers.push(() => handleOpenAiChat && window.removeEventListener('open-ai-chat', handleOpenAiChat))

    // 4) select-agent 事件
    handleSelectAgent = ((event: Event) => {
      const detail = (event as CustomEvent<{ agent: any }>).detail
      if (detail?.agent && (window as any).selectAgent) {
        ;(window as any).selectAgent(detail.agent)
      }
    }) as EventListener
    window.addEventListener('select-agent', handleSelectAgent)
    disposers.push(() => handleSelectAgent && window.removeEventListener('select-agent', handleSelectAgent))

    // 5) 滚动渐变
    handleScroll = () => {
      if (scrollRafId !== null) return
      scrollRafId = requestAnimationFrame(() => {
        scrollRafId = null
        try {
          updateScrollFade()
        } catch {
          // ignore
        }
      })
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    disposers.push(() => {
      if (scrollRafId !== null) {
        cancelAnimationFrame(scrollRafId)
        scrollRafId = null
      }
      if (handleScroll) window.removeEventListener('scroll', handleScroll)
    })
  }

  const install = () => {
    attachGlobalEvents()
  }

  const dispose = () => {
    while (disposers.length) {
      try {
        disposers.pop()?.()
      } catch {
        // ignore
      }
    }
  }

  onMounted(() => {
    install()
    void nextTick(() => {
      isHome.value = window.location.pathname === '/' || window.location.pathname === '/home'
      updateScrollFade()
    })
  })

  onUnmounted(() => {
    dispose()
  })

  return { isHome, install, dispose }
}

function computeScrollFadeProgress(isHomePage: boolean): number {
  if (typeof document === 'undefined') return 0
  if (isHomePage) return 0
  const doc = document.documentElement
  const scrollTop = window.scrollY || doc.scrollTop || 0
  const vh = window.innerHeight || 0
  const sh = doc.scrollHeight || 0
  const distanceToBottom = Math.max(0, sh - (scrollTop + vh))
  const threshold = 400
  if (distanceToBottom > threshold) return 0
  return Math.min(1, Math.max(0, (threshold - distanceToBottom) / threshold))
}
