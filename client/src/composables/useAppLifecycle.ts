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

import { onMounted, onUnmounted, nextTick, ref, h } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElButton, ElNotification } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useDarkModeStore } from '@/stores/darkMode'
import { useLoginDialog } from '@/composables/useLoginDialog'
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
  const authStore = useAuthStore()
  const darkModeStore = useDarkModeStore()

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
        darkModeStore.toggleDarkMode()
        const mode = darkModeStore.isDarkMode ? 'dark' : 'light'
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
    // 设计意图: 用 ElNotification 顶部下滑通知 + 内嵌按钮, 而非 ElMessageBox 居中模态。
    //   - 顶部下滑是非阻塞通知, 不强制打断用户当前操作 (避免误触模态导致数据丢失)
    //   - "重新登录"按钮: 用户主动点才弹模态登录框, 减少误触率
    //   - "取消"按钮: 让用户保留控制权, 通知消失前可继续浏览 (适合查看后再决定登录)
    //   - duration: 0 = 必须用户主动操作, 防止错过会话过期事件
    //   - 选用 ElNotification 而非 ErrorNotification 横幅: 后者只能显示纯文本, 无法嵌按钮
    handleSessionExpired = (event: Event) => {
      const detail = (event as CustomEvent).detail
      authStore.logout()
      // 跳首页, 不再自动弹模态登录框
      void router.push('/').catch(() => {})
      const reason = detail?.reason || t('auth.sessionExpiredMessage')
      // 直接调 ElNotification 弹顶部下滑通知, 嵌"重新登录"按钮
      const notification = ElNotification({
        title: t('auth.sessionExpiredTitle') || '会话已过期',
        message: h('div', { class: 'session-expired-notify' }, [
          h('p', { class: 'session-expired-msg' }, reason),
          h('div', { class: 'session-expired-actions' }, [
            h(
              ElButton,
              {
                type: 'primary',
                size: 'small',
                onClick: () => {
                  useLoginDialog().open('login')
                  notification.close()
                },
              },
              t('auth.relogin') || '重新登录'
            ),
            h(
              ElButton,
              {
                size: 'small',
                onClick: () => notification.close(),
              },
              t('common.cancel') || '取消'
            ),
          ]),
        ]),
        type: 'warning',
        position: 'top-right',
        duration: 0, // 不自动关闭, 必须用户主动操作
        showClose: true,
        customClass: 'session-expired-notification',
        // 点击通知本体(非按钮区域)也弹出登录框, 提升可达性
        // 排除: 内嵌按钮(.el-button) 与 关闭按钮(.el-notification__closeBtn) - 它们有自己的处理逻辑
        onClick: (e?: MouseEvent) => {
          if (e?.target) {
            const target = e.target as HTMLElement
            if (
              target.closest('.el-button') ||
              target.closest('.el-notification__closeBtn')
            ) {
              return
            }
          }
          useLoginDialog().open('login')
          notification.close()
        },
      })
    }
    window.addEventListener('session-expired', handleSessionExpired)
    disposers.push(() => handleSessionExpired && window.removeEventListener('session-expired', handleSessionExpired))

    // 3) open-ai-chat 事件
    handleOpenAiChat = ((event: Event) => {
      const detail = (event as CustomEvent).detail
      const w = window as unknown as { openGlobalChat?: (opts: { mode?: string }) => void }
      if (w.openGlobalChat) {
        w.openGlobalChat({ mode: detail?.mode })
      }
    }) as EventListener
    window.addEventListener('open-ai-chat', handleOpenAiChat)
    disposers.push(() => handleOpenAiChat && window.removeEventListener('open-ai-chat', handleOpenAiChat))

    // 4) select-agent 事件
    handleSelectAgent = ((event: Event) => {
      const detail = (event as CustomEvent<{ agent: unknown }>).detail
      const w = window as unknown as { selectAgent?: (agent: unknown) => void }
      if (detail?.agent && w.selectAgent) {
        w.selectAgent(detail.agent)
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
