/**
 * 性能优化工具
 * 提供各种性能优化功能
 */

import { ref, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { logger } from './logger'
import { debounce as _debounce, throttle as _throttle } from './format'

export const debounce = _debounce
export const throttle = _throttle

export interface MonitorTasksOptions {
  threshold?: number
  delay?: number
}

/**
 * 懒加载图片
 */
let lazyImageObserver: IntersectionObserver | null = null

export function lazyLoadImages(): void {
  if ('IntersectionObserver' in window) {
    // 清理旧的 observer 避免重复创建
    if (lazyImageObserver) {
      lazyImageObserver.disconnect()
      lazyImageObserver = null
    }
    lazyImageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement
          img.src = img.dataset.src || img.src
          img.classList.remove('lazy')
          lazyImageObserver?.unobserve(img)
        }
      })

      // 所有图片加载完成后断开观察器，避免内存泄漏
      const lazyImages = document.querySelectorAll('img.lazy')
      if (lazyImages.length === 0) {
        observer.disconnect()
        lazyImageObserver = null
      }
    })

    document.querySelectorAll('img.lazy').forEach((img) => {
      lazyImageObserver?.observe(img)
    })
  }
}

// 清理懒加载 observer（供 useOptimization 的 onUnmounted 调用）
export function stopLazyLoadImages(): void {
  if (lazyImageObserver) {
    lazyImageObserver.disconnect()
    lazyImageObserver = null
  }
}

/**
 * 预加载关键资源
 */
export function preloadCriticalResources(resources: string[]): void {
  resources.forEach((src) => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = src
    link.as = src.endsWith('.css') ? 'style' : 'script'
    document.head.appendChild(link)
  })
}

/**
 * 空闲回调
 */
export function useIdle(callback: () => void, timeout = 1000): void {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, { timeout })
  } else {
    setTimeout(callback, timeout)
  }
}

/**
 * 监控任务
 * @param callback 可选的回调函数，当检测到长任务时调用
 * @param options 配置选项
 */
export function monitorTasks(
  callback?: (duration: number) => void,
  options: MonitorTasksOptions = {}
): void {
  const { threshold = 50, delay = 0 } = options

  const startMonitoring = () => {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > threshold) {
              if (callback) {
                callback(entry.duration)
              } else {
                logger.warn('Long task detected:', entry.duration, 'ms')
              }
            }
          }
        })
        observer.observe({ entryTypes: ['longtask'] })
      } catch {
        // PerformanceObserver 可能不支持 longtask 类型
      }
    }
  }

  if (delay > 0) {
    setTimeout(startMonitoring, delay)
  } else {
    startMonitoring()
  }
}

/**
 * 使用性能优化
 */
export function useOptimization() {
  const cleanup = useCleanup()
  const isVisible = ref(true)

  const handleVisibilityChange = () => {
    isVisible.value = document.visibilityState === 'visible'
  }

  onMounted(() => {
    cleanup.addEventListener(document, 'visibilitychange', handleVisibilityChange as EventListener)
    lazyLoadImages()
    cleanup.add(stopLazyLoadImages)
  })

  return {
    isVisible,
    debounce,
    throttle,
    lazyLoadImages,
    preloadCriticalResources,
    useIdle,
    monitorTasks,
  }
}

/**
 * 初始化性能优化
 */
export function initOptimization(): void {
  lazyLoadImages()
  logger.info('Optimization initialized')
}

/**
 * 请求去重器
 * 防止相同的请求在短时间内重复发送
 */
export function requestDeduplicator<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  const pendingRequests = new Map<string, Promise<ReturnType<T>>>()

  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args)

    if (pendingRequests.has(key)) {
      return pendingRequests.get(key)!
    }

    const promise = fn(...args).finally(() => {
      pendingRequests.delete(key)
    }) as Promise<ReturnType<T>>

    pendingRequests.set(key, promise)
    return promise
  }
}
