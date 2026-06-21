// ============================================
// useA11y - A11y 工具 composable (P7 阶段 1)
// 提供：
//   - announce: 屏幕阅读器通告（aria-live）
//   - focusFirst / focusLast: 焦点管理
//   - trapFocus: 焦点陷阱（弹窗/对话框）
//   - isReducedMotion / isHighContrast: 媒体查询响应
// ============================================

import { onMounted, ref, type Ref } from 'vue'
import { useCleanup } from './useCleanup'

export type A11yPoliteness = 'polite' | 'assertive'

export interface AnnounceOptions {
  politeness?: A11yPoliteness
  clearAfter?: number
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',')

export function useA11y() {
  // 响应式媒体查询状态
  const isReducedMotion = ref(false)
  const isHighContrast = ref(false)
  const isForcedColors = ref(false)

  // 内部 LiveRegion DOM 引用
  const politeRef = ref<HTMLDivElement | null>(null)
  const assertiveRef = ref<HTMLDivElement | null>(null)
  let politeTimer: ReturnType<typeof setTimeout> | null = null
  let assertiveTimer: ReturnType<typeof setTimeout> | null = null

  const ensureLiveRegion = (
    politeness: A11yPoliteness
  ): HTMLDivElement | null => {
    if (typeof document === 'undefined') return null
    const id = `a11y-live-${politeness}`
    let el = document.getElementById(id) as HTMLDivElement | null
    if (!el) {
      el = document.createElement('div')
      el.id = id
      el.setAttribute('aria-live', politeness)
      el.setAttribute('aria-atomic', 'true')
      el.className = 'sr-only'
      // 角色兼容：旧版 NVDA / JAWS 期望 role=status 或 role=alert
      el.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status')
      document.body.appendChild(el)
    }
    return el
  }

  const announce = (message: string, options: AnnounceOptions = {}) => {
    const politeness: A11yPoliteness = options.politeness || 'polite'
    const clearAfter = options.clearAfter ?? 4000
    const el = ensureLiveRegion(politeness)
    if (!el) return
    // 必须先清空再写入，否则部分屏幕阅读器不会重复朗读相同文本
    el.textContent = ''
    // 使用 setTimeout 0 异步写入，保证时序且便于测试
    setTimeout(() => {
      el.textContent = message
    }, 0)
    const timer = politeness === 'assertive' ? assertiveTimer : politeTimer
    if (timer) clearTimeout(timer)
    const newTimer = setTimeout(() => {
      if (el) el.textContent = ''
    }, clearAfter)
    if (politeness === 'assertive') {
      assertiveTimer = newTimer
    } else {
      politeTimer = newTimer
    }
  }

  const getFocusable = (root: HTMLElement | Ref<HTMLElement | null>): HTMLElement[] => {
    const el = 'value' in root ? root.value : root
    if (!el) return []
    return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (node) => !node.hasAttribute('disabled') && node.tabIndex !== -1
    )
  }

  const focusFirst = (root: HTMLElement | Ref<HTMLElement | null>) => {
    const list = getFocusable(root)
    if (list.length > 0) list[0].focus()
  }

  const focusLast = (root: HTMLElement | Ref<HTMLElement | null>) => {
    const list = getFocusable(root)
    if (list.length > 0) list[list.length - 1].focus()
  }

  // 焦点陷阱：弹窗打开时调用，关闭时释放
  const trapFocus = (root: Ref<HTMLElement | null>, onEscape?: () => void) => {
    const handler = (event: KeyboardEvent) => {
      const el = root.value
      if (!el) return
      if (event.key === 'Escape' && onEscape) {
        event.stopPropagation()
        onEscape()
        return
      }
      if (event.key !== 'Tab') return
      const list = getFocusable(el)
      if (list.length === 0) {
        event.preventDefault()
        return
      }
      const first = list[0]
      const last = list[list.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }

  // 媒体查询订阅（同步初始化，避免 onMounted 时机问题）
  let mqReduced: MediaQueryList | null = null
  let mqContrast: MediaQueryList | null = null
  let mqForced: MediaQueryList | null = null

  const handleReduced = (e: MediaQueryListEvent | MediaQueryList) => {
    isReducedMotion.value = e.matches
  }
  const handleContrast = (e: MediaQueryListEvent | MediaQueryList) => {
    isHighContrast.value = e.matches
  }
  const handleForced = (e: MediaQueryListEvent | MediaQueryList) => {
    isForcedColors.value = e.matches
  }

  // 同步初始化（保证测试可立即读取 ref + 注册监听）
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    mqContrast = window.matchMedia('(prefers-contrast: more)')
    mqForced = window.matchMedia('(forced-colors: active)')
    handleReduced(mqReduced)
    handleContrast(mqContrast)
    handleForced(mqForced)
    mqReduced.addEventListener('change', handleReduced)
    mqContrast.addEventListener('change', handleContrast)
    mqForced.addEventListener('change', handleForced)
  }

  onMounted(() => {
    if (typeof window === 'undefined') return
    if (!mqReduced) mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!mqContrast) mqContrast = window.matchMedia('(prefers-contrast: more)')
    if (!mqForced) mqForced = window.matchMedia('(forced-colors: active)')
    handleReduced(mqReduced)
    handleContrast(mqContrast)
    handleForced(mqForced)
    // 重复注册也无害（addEventListener 会去重）
    mqReduced.addEventListener('change', handleReduced)
    mqContrast.addEventListener('change', handleContrast)
    mqForced.addEventListener('change', handleForced)
  })

  // 统一清理：组件卸载时自动执行所有注册的清理函数
  const cleanup = useCleanup()
  cleanup.add(() => mqReduced?.removeEventListener('change', handleReduced))
  cleanup.add(() => mqContrast?.removeEventListener('change', handleContrast))
  cleanup.add(() => mqForced?.removeEventListener('change', handleForced))
  cleanup.add(() => { if (politeTimer) clearTimeout(politeTimer) })
  cleanup.add(() => { if (assertiveTimer) clearTimeout(assertiveTimer) })

  return {
    // 状态
    isReducedMotion,
    isHighContrast,
    isForcedColors,
    // 工具
    announce,
    focusFirst,
    focusLast,
    getFocusable,
    trapFocus,
    politeRef,
    assertiveRef,
  }
}
