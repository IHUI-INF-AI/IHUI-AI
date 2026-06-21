/**
 * Promise工具函数
 */

/**
 * 重试Promise
 */
export function retryPromise<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  return fn().catch((error) => {
    if (retries > 0) {
      return retryPromise(fn, retries - 1)
    }
    throw error
  })
}

/**
 * 带超时的Promise
 */
export function withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), timeout)
    })
  ])
}
