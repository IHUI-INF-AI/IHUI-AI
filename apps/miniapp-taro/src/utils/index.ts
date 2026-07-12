import Taro from '@tarojs/taro'

export * from './request'
export * from './auth'
export * from './websocket'
export * from './voice-recorder'
export * from './upload-image'
export * from './file-utils'
export * from './share'
export * from './keyboard-height'
export * from './save-album'
export * from './push'
export * from './time'
export * from './streaming-recognizer'
export * from './doubao-voice-api'

export { default as websocketManager } from './websocket'
export { default as voiceRecorder } from './voice-recorder'
export { default as streamingRecognizer } from './streaming-recognizer'

export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait = 500,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function throttle<T extends (...args: unknown[]) => void>(
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

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (typeof structuredClone === 'function') return structuredClone(obj)
  const clone = (Array.isArray(obj) ? [] : {}) as T
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      ;(clone as Record<string, unknown>)[key] = deepClone((obj as Record<string, unknown>)[key])
    }
  }
  return clone
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  if (typeof value === 'object' && Object.keys(value as object).length === 0) return true
  return false
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getStorageSync(key: string): unknown {
  return Taro.getStorageSync(key)
}

export function setStorageSync(key: string, data: unknown): void {
  Taro.setStorageSync(key, data)
}

export function removeStorageSync(key: string): void {
  Taro.removeStorageSync(key)
}
