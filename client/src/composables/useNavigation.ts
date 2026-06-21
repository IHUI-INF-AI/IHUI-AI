import { ref, type Ref } from 'vue'

export interface NavigationOptions {
  /** 是否显示 loading */
  showLoading?: boolean
  /** loading 文本 */
  loadingText?: string
}

export interface UseNavigationReturn {
  /** 当前页面路径 */
  currentPath: Ref<string>
  /** 导航到指定页面 */
  navigateTo: (url: string, options?: NavigationOptions) => Promise<void>
  /** 返回上一页 */
  navigateBack: (delta?: number) => Promise<void>
  /** 重定向到指定页面 */
  redirectTo: (url: string, options?: NavigationOptions) => Promise<void>
  /** 关闭所有页面并打开新页面 */
  reLaunch: (url: string, options?: NavigationOptions) => Promise<void>
  /** 切换 Tab */
  switchTab: (url: string) => Promise<void>
  /** 获取页面参数 */
  getParams: () => Record<string, unknown>
}

function isUniApp(): boolean {
  return typeof uni !== 'undefined'
}

// 校验 URL 是否安全：允许相对路径（以 / 开头但不能以 // 开头）或 http/https 协议
function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  if (url.startsWith('/') && !url.startsWith('//')) return true
  return /^https?:\/\//i.test(url)
}

export function useNavigation(): UseNavigationReturn {
  const currentPath = ref('')

  const getCurrentPath = (): string => {
    if (isUniApp()) {
      const pages = getCurrentPages()
      if (pages.length > 0) {
        return pages[pages.length - 1].route || ''
      }
    }
    if (typeof window !== 'undefined') {
      return window.location.pathname
    }
    return ''
  }

  currentPath.value = getCurrentPath()

  const navigateTo = async (url: string, options: NavigationOptions = {}): Promise<void> => {
    const { showLoading = false, loadingText = '加载中...' } = options

    if (showLoading) {
      uni.showLoading({ title: loadingText })
    }

    try {
      if (isUniApp()) {
        await new Promise<void>((resolve, reject) => {
          uni.navigateTo({
            url,
            success: () => resolve(),
            fail: (err) => reject(err),
          })
        })
      } else if (typeof window !== 'undefined') {
        if (!isSafeUrl(url)) return
        window.location.href = url
      }
    } finally {
      if (showLoading) {
        uni.hideLoading()
      }
    }
  }

  const navigateBack = async (delta = 1): Promise<void> => {
    if (isUniApp()) {
      await new Promise<void>((resolve, reject) => {
        uni.navigateBack({
          delta,
          success: () => resolve(),
          fail: (err) => reject(err),
        })
      })
    } else if (typeof window !== 'undefined') {
      window.history.go(-delta)
    }
  }

  const redirectTo = async (url: string, options: NavigationOptions = {}): Promise<void> => {
    const { showLoading = false, loadingText = '加载中...' } = options

    if (showLoading) {
      uni.showLoading({ title: loadingText })
    }

    try {
      if (isUniApp()) {
        await new Promise<void>((resolve, reject) => {
          uni.redirectTo({
            url,
            success: () => resolve(),
            fail: (err) => reject(err),
          })
        })
      } else if (typeof window !== 'undefined') {
        if (!isSafeUrl(url)) return
        window.location.replace(url)
      }
    } finally {
      if (showLoading) {
        uni.hideLoading()
      }
    }
  }

  const reLaunch = async (url: string, options: NavigationOptions = {}): Promise<void> => {
    const { showLoading = false, loadingText = '加载中...' } = options

    if (showLoading) {
      uni.showLoading({ title: loadingText })
    }

    try {
      if (isUniApp()) {
        await new Promise<void>((resolve, reject) => {
          uni.reLaunch({
            url,
            success: () => resolve(),
            fail: (err) => reject(err),
          })
        })
      } else if (typeof window !== 'undefined') {
        if (!isSafeUrl(url)) return
        window.location.href = url
      }
    } finally {
      if (showLoading) {
        uni.hideLoading()
      }
    }
  }

  const switchTab = async (url: string): Promise<void> => {
    if (isUniApp()) {
      await new Promise<void>((resolve, reject) => {
        uni.switchTab({
          url,
          success: () => resolve(),
          fail: (err) => reject(err),
        })
      })
    } else if (typeof window !== 'undefined') {
      if (!isSafeUrl(url)) return
      window.location.href = url
    }
  }

  const getParams = (): Record<string, unknown> => {
    if (isUniApp()) {
      const pages = getCurrentPages()
      if (pages.length > 0) {
        const currentPage = pages[pages.length - 1]
        const options = (currentPage as { options?: Record<string, unknown> }).options
        return options || {}
      }
    }
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const result: Record<string, string> = {}
      params.forEach((value, key) => {
        result[key] = value
      })
      return result
    }
    return {}
  }

  return {
    currentPath,
    navigateTo,
    navigateBack,
    redirectTo,
    reLaunch,
    switchTab,
    getParams,
  }
}
