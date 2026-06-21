/**
 * 图片懒加载 Composable
 * 用于优化图片加载性能
 */

import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue'

export interface LazyImageOptions {
  /** 根元素（用于 Intersection Observer） */
  root?: Element | null
  /** 根边距 */
  rootMargin?: string
  /** 阈值 */
  threshold?: number | number[]
  /** 占位图URL */
  placeholder?: string
  /** 错误占位图URL */
  errorPlaceholder?: string
}

/**
 * 图片懒加载 Composable
 */
export function useLazyImage(imageRef: Ref<HTMLElement | null>, src: () => string, options: LazyImageOptions = {}) {
  const {
    root = null,
    rootMargin = '50px',
    threshold = 0.1,
    placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y1ZjVmNSIvPjwvc3ZnPg==',
    errorPlaceholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2RkZCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+5Zu+54mH5pyq5Yqg6L295LitPC90ZXh0Pjwvc3ZnPg==',
  } = options

  const _imageSrc = ref(src())
  const isLoading = ref(false)
  const isError = ref(false)
  const currentSrc = ref(placeholder)

  let observer: IntersectionObserver | null = null

  // 加载图片
  const loadImage = () => {
    if (isLoading.value || isError.value) return

    const srcValue = src()
    if (!srcValue) return

    isLoading.value = true
    const img = new Image()

    img.onload = () => {
      currentSrc.value = srcValue
      isLoading.value = false
      isError.value = false
    }

    img.onerror = () => {
      currentSrc.value = errorPlaceholder
      isLoading.value = false
      isError.value = true
    }

    img.src = srcValue
  }

  // 设置 Intersection Observer
  const setupObserver = () => {
    if (!imageRef.value) return

    // 如果浏览器不支持 Intersection Observer，直接加载
    if (!('IntersectionObserver' in window)) {
      loadImage()
      return
    }

    observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            loadImage()
            if (observer && imageRef.value) {
              observer.unobserve(imageRef.value)
            }
          }
        })
      },
      {
        root,
        rootMargin,
        threshold,
      }
    )

    observer.observe(imageRef.value)
  }

  // 清理
  const cleanup = () => {
    if (observer && imageRef.value) {
      observer.unobserve(imageRef.value)
      observer.disconnect()
      observer = null
    }
  }

  onMounted(() => {
    setupObserver()
  })

  onUnmounted(() => {
    cleanup()
  })

  // 监听 src 变化
  watch(src, () => {
    cleanup()
    currentSrc.value = placeholder
    isLoading.value = false
    isError.value = false
    setupObserver()
  })

  return {
    currentSrc,
    isLoading,
    isError,
    loadImage,
  }
}
