/**
 * Home 全屏分页滚动 Composable
 *
 * 提供首页各 section 的当前页、总页数及滚动到指定页方法。
 *
 * @packageDocumentation
 */

import { ref, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'

const PAGE_SECTION_IDS = ['first-page', 'second-page', 'third-page', 'fourth-page', 'fifth-page'] as const
const TOTAL_PAGES = PAGE_SECTION_IDS.length

export { PAGE_SECTION_IDS, TOTAL_PAGES }

export function useFullPageScroll() {
  const cleanup = useCleanup()
  const currentPage = ref(1)

  const totalPages = TOTAL_PAGES

  /**
   * 滚动到指定页（1-based）
   */
  const scrollToPage = (pageIndex: number) => {
    const oneBased = Math.max(1, Math.min(pageIndex, TOTAL_PAGES))
    const id = PAGE_SECTION_IDS[oneBased - 1]
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      currentPage.value = oneBased
    }
  }

  const updateCurrentPageFromScroll = () => {
    if (typeof window === 'undefined') return
    const scrollY = window.scrollY
    const viewportMid = scrollY + window.innerHeight / 2
    let page = 1
    for (let i = PAGE_SECTION_IDS.length - 1; i >= 0; i--) {
      const el = document.getElementById(PAGE_SECTION_IDS[i])
      if (el) {
        const top = el.getBoundingClientRect().top + scrollY
        if (viewportMid >= top) {
          page = i + 1
          break
        }
      }
    }
    currentPage.value = page
  }

  let ticking = false

  const onScroll = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      updateCurrentPageFromScroll()
      ticking = false
    })
  }

  onMounted(() => {
    if (typeof window === 'undefined') return
    updateCurrentPageFromScroll()
    cleanup.addEventListener(window, 'scroll', onScroll as EventListener, { passive: true })
  })

  return {
    currentPage,
    totalPages,
    scrollToPage,
  }
}
