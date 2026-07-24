/** 防抖:延迟执行,中途再次调用会重置计时器 */
export function debounce<T extends (...args: never[]) => void>(
  func: T,
  wait = 500,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/** 节流:固定间隔内最多执行一次 */
export function throttle<T extends (...args: never[]) => void>(
  func: T,
  wait = 500,
): (...args: Parameters<T>) => void {
  let previous = 0
  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - previous > wait) {
      func(...args)
      previous = now
    }
  }
}

/** Promise 延时 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
