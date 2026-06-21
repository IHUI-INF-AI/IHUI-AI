import { ref, onMounted } from 'vue'
import { useCleanup } from './useCleanup'

// 页面滑动切换管理器
export function usePageSlider() {
  const cleanup = useCleanup()
  const currentPage = ref(0)
  const isSliding = ref(false)
  const totalPages = ref(5) // 默认5个页面
  const touchStartY = ref(0)
  const touchEndY = ref(0)
  const pageHeight = ref(0)

  // 初始化页面高度
  const initPageHeight = () => {
    if (typeof window !== 'undefined') {
      pageHeight.value = window.innerHeight
    }
  }

  // 处理触摸开始事件
  const handleTouchStart = (e: TouchEvent) => {
    touchStartY.value = e.touches[0].clientY
  }

  // 处理触摸结束事件
  const handleTouchEnd = (e: TouchEvent) => {
    touchEndY.value = e.changedTouches[0].clientY
    handleSwipe()
  }

  // 处理滑动判断
  const handleSwipe = () => {
    const diff = touchEndY.value - touchStartY.value

    // 向下滑动（显示上一页）
    if (diff > 100 && currentPage.value > 0 && !isSliding.value) {
      goToPage(currentPage.value - 1)
    }
    // 向上滑动（显示下一页）
    else if (diff < -100 && currentPage.value < totalPages.value - 1 && !isSliding.value) {
      goToPage(currentPage.value + 1)
    }
  }

  // 跳转到指定页面
  const goToPage = (pageIndex: number) => {
    if (pageIndex < 0 || pageIndex >= totalPages.value || isSliding.value) {
      return
    }

    isSliding.value = true

    // 先设置滑动状态，再加一点延迟后更新当前页面，避免闪屏
    cleanup.addTimer(() => {
      currentPage.value = pageIndex
    }, 50)

    // 触发滚动到对应页面
    if (typeof window !== 'undefined') {
      const container = document.querySelector('.page-slider-container')
      if (container) {
        container.scrollTo({
          top: pageIndex * pageHeight.value,
          behavior: 'smooth',
        })
      }
    }

    // 设置滑动状态结束延时
    cleanup.addTimer(() => {
      isSliding.value = false
    }, 500) // 与CSS过渡时间匹配
  }

  // 滚动到指定页面（用于外部调用）
  const scrollToPage = (pageIndex: number) => {
    goToPage(pageIndex)
  }

  // 监听窗口大小变化
  let resizeRafId: number | null = null
  let scrollRafId: number | null = null
  const handleResize = () => {
    if (resizeRafId !== null) return
    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = null
      initPageHeight()
      // 重新定位到当前页面
      if (typeof window !== 'undefined') {
        const container = document.querySelector('.page-slider-container')
        if (container) {
          container.scrollTop = currentPage.value * pageHeight.value
        }
      }
    })
    cleanup.add(() => { if (resizeRafId !== null) { cancelAnimationFrame(resizeRafId); resizeRafId = null } })
  }

  // 监听滚动事件以同步当前页面
  const handleScroll = () => {
    if (typeof window !== 'undefined' && !isSliding.value) {
      const container = document.querySelector('.page-slider-container')
      if (container) {
        const scrollPosition = container.scrollTop
        const newPage = Math.round(scrollPosition / pageHeight.value)
        if (newPage !== currentPage.value && newPage >= 0 && newPage < totalPages.value) {
          // 避免滚动时的频繁更新
          if (scrollRafId !== null) cancelAnimationFrame(scrollRafId)
          scrollRafId = requestAnimationFrame(() => {
            scrollRafId = null
            currentPage.value = newPage
          })
          cleanup.add(() => { if (scrollRafId !== null) { cancelAnimationFrame(scrollRafId); scrollRafId = null } })
        }
      }
    }
  }

  onMounted(() => {
    initPageHeight()

    // 绑定事件监听器
    if (typeof window !== 'undefined') {
      const container = document.querySelector('.page-slider-container') as HTMLElement
      if (container) {
        cleanup.addEventListener(container, 'touchstart', handleTouchStart as EventListener)
        cleanup.addEventListener(container, 'touchend', handleTouchEnd as EventListener)
        // 使用passive: true提高滚动性能
        cleanup.addEventListener(container, 'scroll', handleScroll as EventListener, { passive: true })
      }
      cleanup.addEventListener(window, 'resize', handleResize as EventListener)
    }
  })

  return {
    currentPage,
    isSliding,
    totalPages,
    goToPage,
    scrollToPage,
  }
}
