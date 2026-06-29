export function isUniApp(): boolean {
  return typeof uni !== 'undefined' && typeof plus !== 'undefined'
}

export function isWeb(): boolean {
  return !isUniApp() && typeof window !== 'undefined'
}

export function isMpWeixin(): boolean {
  // #ifdef MP-WEIXIN
  return true
  // #endif
  // eslint-disable-next-line no-unreachable
  return false
}

export function getStorage(key: string): unknown {
  try {
    if (isUniApp()) {
      return uni.getStorageSync(key)
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key)
    }
  } catch {
    return null
  }
  return null
}

export function setStorage(key: string, value: unknown): void {
  try {
    if (isUniApp()) {
      uni.setStorageSync(key, value)
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, String(value))
    }
  } catch {
    // silently ignore storage errors
  }
}

export function removeStorage(key: string): void {
  try {
    if (isUniApp()) {
      uni.removeStorageSync(key)
    } else if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key)
    }
  } catch {
    // silently ignore
  }
}

export function formatTime(timestamp: number, fmt: string = 'YYYY-MM-DD HH:mm:ss'): string {
  const date = new Date(timestamp)
  const map: Record<string, number> = {
    YYYY: date.getFullYear(),
    MM: date.getMonth() + 1,
    DD: date.getDate(),
    HH: date.getHours(),
    mm: date.getMinutes(),
    ss: date.getSeconds(),
  }
  let result = fmt
  for (const [key, val] of Object.entries(map)) {
    result = result.replace(key, String(val).padStart(2, '0'))
  }
  return result
}

export function formatPrice(price: number, decimals: number = 2): string {
  return `¥${(price / 100).toFixed(decimals)}`
}

export function formatNumber(num: number): string {
  if (num >= 100000000) {
    return (num / 100000000).toFixed(1) + '亿'
  }
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万'
  }
  return String(num)
}

export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number = 300): T {
  let timer: ReturnType<typeof setTimeout> | null = null
  return ((...args: unknown[]) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => (fn as (...args: unknown[]) => unknown)(...args), delay)
  }) as T
}

export function throttle<T extends (...args: unknown[]) => unknown>(fn: T, interval: number = 300): T {
  let lastTime = 0
  return ((...args: unknown[]) => {
    const now = Date.now()
    if (now - lastTime >= interval) {
      lastTime = now
      ;(fn as (...args: unknown[]) => unknown)(...args)
    }
  }) as T
}
