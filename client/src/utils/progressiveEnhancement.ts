/**
 * 渐进增强工具
 * 提供功能检测和降级策略
 */

import { ref, onMounted } from 'vue'
import { logger } from './logger'

/**
 * 功能支持类型
 */
interface FeatureSupport {
  webp: boolean
  avif: boolean
  intersectionObserver: boolean
  resizeObserver: boolean
  mutationObserver: boolean
  webWorker: boolean
  serviceWorker: boolean
  webAssembly: boolean
  localStorage: boolean
  sessionStorage: boolean
  requestIdleCallback: boolean
  [key: string]: boolean
}

/**
 * 检查浏览器支持
 */
export function checkBrowserSupport(): FeatureSupport {
  return {
    webp: document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0,
    avif: false,
    intersectionObserver: 'IntersectionObserver' in window,
    resizeObserver: 'ResizeObserver' in window,
    mutationObserver: 'MutationObserver' in window,
    webWorker: 'Worker' in window,
    serviceWorker: 'serviceWorker' in navigator,
    webAssembly: 'WebAssembly' in window,
    localStorage: (() => {
      try {
        return 'localStorage' in window && window.localStorage !== null
      } catch {
        return false
      }
    })(),
    sessionStorage: (() => {
      try {
        return 'sessionStorage' in window && window.sessionStorage !== null
      } catch {
        return false
      }
    })(),
    requestIdleCallback: 'requestIdleCallback' in window,
  }
}

/**
 * 初始化渐进增强
 */
export function initProgressiveEnhancement(): void {
  const support = checkBrowserSupport()
  logger.info('Browser support:', support)
}

/**
 * 功能检测包装器
 */
export function withFeatureDetection<T>(
  feature: string,
  fn: () => T,
  fallback: () => T
): T {
  const features: Record<string, boolean> = {
    intersectionObserver: 'IntersectionObserver' in window,
    resizeObserver: 'ResizeObserver' in window,
    mutationObserver: 'MutationObserver' in window,
  }

  if (features[feature]) {
    return fn()
  }
  return fallback()
}

/**
 * 检查功能支持
 * @param features 可选的功能名称数组，如果提供则只检查这些功能
 */
export function checkFeatures(features?: string[]): Record<string, boolean> {
  const allFeatures: FeatureSupport = {
    webp: document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0,
    avif: false,
    intersectionObserver: 'IntersectionObserver' in window,
    resizeObserver: 'ResizeObserver' in window,
    mutationObserver: 'MutationObserver' in window,
    webWorker: 'Worker' in window,
    serviceWorker: 'serviceWorker' in navigator,
    webAssembly: 'WebAssembly' in window,
    localStorage: (() => {
      try {
        return 'localStorage' in window && window.localStorage !== null
      } catch {
        return false
      }
    })(),
    sessionStorage: (() => {
      try {
        return 'sessionStorage' in window && window.sessionStorage !== null
      } catch {
        return false
      }
    })(),
    requestIdleCallback: 'requestIdleCallback' in window,
  }

  if (features && features.length > 0) {
    const result: Record<string, boolean> = {}
    for (const feature of features) {
      if (feature in allFeatures) {
        result[feature] = allFeatures[feature as keyof FeatureSupport]
      }
    }
    return result
  }

  return allFeatures
}

/**
 * 根据网络状况调整
 */
export function adaptToNetwork(): void {
  const connection = (navigator as unknown as { connection?: { effectiveType?: string } }).connection
  if (connection?.effectiveType) {
    logger.info('Network type:', connection.effectiveType)
    if (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g') {
      document.body.classList.add('slow-network')
    }
  }
}

/**
 * 使用渐进增强
 */
export function useProgressiveEnhancement() {
  const support = ref(checkBrowserSupport())

  onMounted(() => {
    support.value = checkBrowserSupport()
    adaptToNetwork()
  })

  return {
    support,
    checkBrowserSupport,
    withFeatureDetection,
    checkFeatures,
    adaptToNetwork,
  }
}
