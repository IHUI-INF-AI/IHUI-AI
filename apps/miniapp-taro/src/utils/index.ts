import Taro from '@tarojs/taro'

export * from './request'
export * from './auth'
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
export * from './pay'

export { default as voiceRecorder } from './voice-recorder'
export { default as streamingRecognizer } from './streaming-recognizer'

// 纯工具函数复用 @ihui/shared/utils(单一来源)
export { debounce, throttle, sleep } from '@ihui/shared/utils/async'
export { deepClone, isEmpty } from '@ihui/shared/utils/object'

export function getStorageSync(key: string): unknown {
  return Taro.getStorageSync(key)
}

export function setStorageSync(key: string, data: unknown): void {
  Taro.setStorageSync(key, data)
}

export function removeStorageSync(key: string): void {
  Taro.removeStorageSync(key)
}
