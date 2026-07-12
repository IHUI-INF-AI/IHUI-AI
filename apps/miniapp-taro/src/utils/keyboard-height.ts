import Taro from '@tarojs/taro'

export type KeyboardHeightCallback = (height: number) => void

export function onKeyboardHeightChange(callback: KeyboardHeightCallback): KeyboardHeightCallback {
  const wrapped: KeyboardHeightCallback = (height) => callback(height)
  Taro.onKeyboardHeightChange((res) => wrapped(res.height))
  return wrapped
}

export function offKeyboardHeightChange(): void {
  Taro.offKeyboardHeightChange()
}

export function getDeviceInfo() {
  try {
    const info = Taro.getSystemInfoSync()
    return {
      model: info.model || '',
      brand: info.brand || '',
      screenHeight: info.screenHeight || 0,
      screenWidth: info.screenWidth || 0,
      platform: info.platform || '',
    }
  } catch {
    return { model: '', brand: '', screenHeight: 0, screenWidth: 0, platform: '' }
  }
}

export function estimateKeyboardHeightByScreen(screenHeight: number): number {
  if (!screenHeight) return 300
  if (screenHeight < 700) return 253
  if (screenHeight < 800) return 291
  if (screenHeight < 900) return 303
  return 336
}

export function getCurrentKeyboardHeight(): number {
  const info = getDeviceInfo()
  return estimateKeyboardHeightByScreen(info.screenHeight)
}
