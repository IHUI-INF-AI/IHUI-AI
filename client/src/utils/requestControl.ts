/**
 * 请求节流防抖工具
 * 提供请求级别的节流、防抖和限流功能
 */

export interface ThrottleOptions {
  interval: number
  leading?: boolean
  trailing?: boolean
}

export interface DebounceOptions {
  wait: number
  leading?: boolean
  maxWait?: number
}

export interface RateLimitOptions {
  maxRequests: number
  windowMs: number
  onLimitReached?: () => void
}

export function throttle<T extends (...args: any[]) => unknown>(
  fn: T,
  options: ThrottleOptions
): T & { cancel: () => void; flush: () => void } {
  const { interval, leading = true, trailing = true } = options

  let lastArgs: any[] | null = null
  let lastCallTime = 0
  let timerId: ReturnType<typeof setTimeout> | null = null

  const invoke = () => {
    if (lastArgs) {
      fn(...lastArgs)
      lastArgs = null
      lastCallTime = Date.now()
    }
  }

  const throttled = (...args: any[]) => {
    const now = Date.now()
    const timeSinceLastCall = now - lastCallTime

    lastArgs = args

    if (timeSinceLastCall >= interval) {
      if (leading) {
        fn(...args)
        lastArgs = null
        lastCallTime = now
      } else if (trailing) {
        if (timerId) clearTimeout(timerId)
        timerId = setTimeout(invoke, interval - timeSinceLastCall)
      }
    } else if (trailing && !timerId) {
      timerId = setTimeout(invoke, interval - timeSinceLastCall)
    }
  }

  throttled.cancel = () => {
    if (timerId) {
      clearTimeout(timerId)
      timerId = null
    }
    lastArgs = null
  }

  throttled.flush = () => {
    invoke()
    throttled.cancel()
  }

  return throttled as T & { cancel: () => void; flush: () => void }
}

export function debounce<T extends (...args: any[]) => unknown>(
  fn: T,
  options: DebounceOptions
): T & { cancel: () => void; flush: () => void } {
  const { wait, leading = false, maxWait } = options

  let lastArgs: any[] | null = null
  let timerId: ReturnType<typeof setTimeout> | null = null
  let lastInvokeTime = 0

  const invoke = () => {
    if (lastArgs) {
      fn(...lastArgs)
      lastArgs = null
      lastInvokeTime = Date.now()
    }
  }

  const shouldInvoke = () => {
    const now = Date.now()
    const timeSinceLastInvoke = now - lastInvokeTime

    return (
      lastInvokeTime === 0 ||
      timeSinceLastInvoke >= wait ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    )
  }

  const debounced = (...args: any[]) => {
    const now = Date.now()
    const isInvoking = shouldInvoke()

    lastArgs = args

    if (isInvoking) {
      if (timerId) {
        clearTimeout(timerId)
        timerId = null
      }
      lastInvokeTime = now
      if (leading) {
        fn(...args)
        lastArgs = null
      }
    }

    if (!timerId) {
      timerId = setTimeout(() => {
        timerId = null
        if (trailing && lastArgs) {
          invoke()
        }
      }, wait)
    }
  }

  const trailing = !leading

  debounced.cancel = () => {
    if (timerId) {
      clearTimeout(timerId)
      timerId = null
    }
    lastArgs = null
  }

  debounced.flush = () => {
    invoke()
    debounced.cancel()
  }

  return debounced as T & { cancel: () => void; flush: () => void }
}

export class RateLimiter {
  private requests: number[] = []
  private readonly maxRequests: number
  private readonly windowMs: number
  private readonly onLimitReached?: () => void

  constructor(options: RateLimitOptions) {
    this.maxRequests = options.maxRequests
    this.windowMs = options.windowMs
    this.onLimitReached = options.onLimitReached
  }

  private cleanup(): void {
    const now = Date.now()
    const cutoff = now - this.windowMs
    this.requests = this.requests.filter(time => time > cutoff)
  }

  tryRequest(): boolean {
    this.cleanup()

    if (this.requests.length >= this.maxRequests) {
      this.onLimitReached?.()
      return false
    }

    this.requests.push(Date.now())
    return true
  }

  getRemainingRequests(): number {
    this.cleanup()
    return Math.max(0, this.maxRequests - this.requests.length)
  }

  getResetTime(): number {
    if (this.requests.length === 0) return 0
    return this.requests[0] + this.windowMs
  }

  reset(): void {
    this.requests = []
  }
}

export class RequestQueue {
  private queue: Array<() => Promise<unknown>> = []
  private running = 0
  private readonly concurrency: number

  constructor(concurrency: number = 5) {
    this.concurrency = concurrency
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0 || this.running >= this.concurrency) {
      return
    }

    this.running++
    const task = this.queue.shift()

    if (task) {
      try {
        await task()
      } finally {
        this.running--
        void this.processNext()
      }
    }
  }

  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await task())
        } catch (error) {
          reject(error)
        }
      })
      void this.processNext()
    })
  }

  clear(): void {
    this.queue = []
  }

  size(): number {
    return this.queue.length
  }

  isRunning(): boolean {
    return this.running > 0
  }
}

export function useRequestControl() {
  return {
    throttle,
    debounce,
    RateLimiter,
    RequestQueue,
  }
}

export default {
  throttle,
  debounce,
  RateLimiter,
  RequestQueue,
}
