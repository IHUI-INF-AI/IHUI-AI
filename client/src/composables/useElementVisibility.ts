/**
 * 关键容器可见性兜底 Composable
 * 抽离自 App.vue 的 forceVisible / debugVisibility
 *
 * 作用:
 *  1. 强制把指定选择器的容器设为可见(opacity/visibility/display)
 *  2. 注册全局 <img> 错误兜底,失败时回退到 /images/common/empty.svg
 *  3. 防止某些环境(Cursor 内置浏览器等)把容器意外隐藏
 *
 * 该机制是 "防御性编程" 的历史包袱,后续组件优化完成后可逐步缩减。
 */

import { logger } from '@/utils/logger'

const FALLBACK_IMAGE_SRC = '/images/common/empty.svg'

export interface VisibilityGuard {
  /** 强制让指定选择器对应的元素可见 */
  forceVisible: (selector: string, display?: 'block' | 'flex') => void
  /** 安装全局 <img> 错误兜底 */
  installImageFallback: () => () => void
}

function safeForceVisible(selector: string, display: 'block' | 'flex' = 'block'): void {
  if (typeof document === 'undefined') return
  try {
    const el = document.querySelector(selector) as HTMLElement | null
    if (!el) return
    el.style.opacity = '1'
    el.style.visibility = 'visible'
    el.style.display = display
    el.style.pointerEvents = 'auto'
  } catch (e) {
    logger.debug('[useElementVisibility] forceVisible failed:', e)
  }
}

function handleImageError(ev: Event): void {
  const target = ev.target as HTMLElement | null
  if (!target || target.tagName !== 'IMG') return
  const img = target as HTMLImageElement
  if (!img.src || img.src.endsWith(FALLBACK_IMAGE_SRC) || img.dataset.__fallbackApplied) {
    return
  }
  img.dataset.__fallbackApplied = '1'
  img.src = FALLBACK_IMAGE_SRC
}

export function useElementVisibility(): VisibilityGuard {
  return {
    forceVisible: safeForceVisible,
    installImageFallback: () => {
      if (typeof window === 'undefined') return () => undefined
      window.addEventListener('error', handleImageError, true)
      return () => window.removeEventListener('error', handleImageError, true)
    },
  }
}

/**
 * 一组项目里"必须可见"的关键容器列表。
 * 集中维护,避免在 App.vue 各处散落。
 */
export const CRITICAL_VISIBILITY_TARGETS: ReadonlyArray<{
  selector: string
  display?: 'block' | 'flex'
}> = [
  { selector: '.glass-header', display: 'flex' },
  { selector: '.main-menu-items', display: 'flex' },
  { selector: '.header-actions', display: 'flex' },
  { selector: '.login-content.login-page', display: 'flex' },
  { selector: '.app-container', display: 'flex' },
  { selector: '#app', display: 'flex' },
] as const
