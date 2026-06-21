/**
 * 性能监控工具
 * 提供性能监控和分析功能
 */

import { ref, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { logger } from './logger'

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  fcp?: number // First Contentful Paint
  lcp?: number // Largest Contentful Paint
  fid?: number // First Input Delay
  cls?: number // Cumulative Layout Shift
  ttfb?: number // Time to First Byte
}

/**
 * 使用性能监控
 */
export function usePerformanceMonitor() {
  const cleanup = useCleanup()
  const metrics = ref<PerformanceMetrics>({})
  let observer: PerformanceObserver | null = null

  onMounted(() => {
    // 监听性能指标
    if ('PerformanceObserver' in window) {
      try {
        observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            switch (entry.entryType) {
              case 'web-vitals':
                // 处理 Web Vitals 指标
                break
              case 'measure':
                logger.info(`[Performance] ${entry.name}: ${entry.duration}ms`)
                break
            }
          }
        })
        observer.observe({ entryTypes: ['measure', 'navigation'] })
        cleanup.add(() => {
          observer?.disconnect()
          observer = null
        })
      } catch (_e) {
        logger.warn('PerformanceObserver not supported')
      }
    }
  })

  return {
    metrics,
  }
}

/**
 * 测量函数执行时间
 */
export function measure<T>(name: string, fn: () => T): T {
  const start = performance.now()
  const result = fn()
  const end = performance.now()
  logger.info(`[Performance] ${name}: ${end - start}ms`)
  return result
}

/**
 * 异步测量函数执行时间
 */
export async function measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now()
  const result = await fn()
  const end = performance.now()
  logger.info(`[Performance] ${name}: ${end - start}ms`)
  return result
}

/**
 * 记录性能标记
 */
export function mark(name: string): void {
  performance.mark(name)
}

/**
 * 记录性能测量
 */
export function measureMark(name: string, startMark: string, endMark?: string): void {
  performance.measure(name, startMark, endMark)
}

/**
 * 获取性能条目
 */
export function getEntriesByName(name: string, type?: string): PerformanceEntry[] {
  return performance.getEntriesByName(name, type as `mark` | `measure` | `navigation` | `resource` | `longtask` | `paint` | `layout-shift` | `event` | `first-input` | `largest-contentful-paint` | `element` | `visibility-state`)
}

/**
 * 清除性能条目
 */
export function clearEntries(name?: string): void {
  if (name) {
    performance.clearMarks(name)
    performance.clearMeasures(name)
  } else {
    performance.clearMarks()
    performance.clearMeasures()
  }
}

/**
 * 使用智能滚动
 */
export function useSmartScroll() {
  const cleanup = useCleanup()
  const scrollTop = ref(0)
  const isScrolling = ref(false)
  let scrollTimeout: ReturnType<typeof setTimeout>
  let scrollRafId: number | null = null

  const handleScroll = () => {
    if (scrollRafId !== null) return
    scrollRafId = requestAnimationFrame(() => {
      scrollRafId = null
      scrollTop.value = window.scrollY
      isScrolling.value = true
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        isScrolling.value = false
      }, 150)
    })
  }

  onMounted(() => {
    cleanup.addEventListener(window, 'scroll', handleScroll as EventListener, { passive: true })
    cleanup.add(() => {
      if (scrollRafId !== null) {
        cancelAnimationFrame(scrollRafId)
        scrollRafId = null
      }
    })
  })

  return {
    scrollTop,
    isScrolling,
  }
}

/**
 * 防抖滚动
 */
export function debounceScroll(callback: () => void, delay = 100): () => void {
  let timeout: ReturnType<typeof setTimeout>
  return () => {
    clearTimeout(timeout)
    timeout = setTimeout(callback, delay)
  }
}

/**
 * 获取性能监控器实例
 */
export function getPerformanceMonitor() {
  return {
    metrics: {},
    record: (name: string, value: number) => {
      logger.info(`[Performance] ${name}: ${value}ms`)
    },
    destroy: () => {
      // 清理资源
    },
  }
}
