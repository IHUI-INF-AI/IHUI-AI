// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 Taro API(getDeviceInfo/getWindowInfo/getAppBaseInfo),不适合共享
import Taro from '@tarojs/taro'

/**
 * 兼容 `Taro.getSystemInfoSync()` 的合并信息。
 *
 * 背景:wx.getSystemInfoSync 已废弃(微信 IDE 控制台报 deprecated 警告),
 * 新 API 拆分为 getDeviceInfo(设备)/getWindowInfo(窗口)/getAppBaseInfo(应用)。
 * 本封装合并三者为旧字段形状,调用方零感知迁移;失败时返回默认值兜底。
 */
export interface CompatSystemInfo {
  brand: string
  platform: string
  model: string
  screenWidth: number
  screenHeight: number
  pixelRatio: number
  windowWidth: number
  windowHeight: number
  statusBarHeight: number
  language: string
}

const DEFAULT_INFO: CompatSystemInfo = {
  brand: '',
  platform: '',
  model: '',
  screenWidth: 0,
  screenHeight: 0,
  pixelRatio: 1,
  windowWidth: 0,
  windowHeight: 0,
  statusBarHeight: 0,
  language: '',
}

// 全端唯一兜底点:胶囊矩形 API 不可用时由状态栏高度推算的量(px),页面不得再自写顶距字面量
const FALLBACK_STATUS_BAR_HEIGHT = 20
const CAPSULE_GAP = 4
const CAPSULE_HEIGHT = 32

/**
 * 状态栏高度 + 右上角胶囊按钮矩形(px)。
 *
 * 背景:胶囊 API 在 H5 / 非微信宿主下取不到,此前各页面逐字复制内联兜底,与 pages/index 的
 * `statusBarHeight || 20` 并存成三套机制、三个兜底值。取值一律经本出口。
 */
export function getTopBarMetrics(): {
  menuButton: { top: number; height: number }
  statusBarHeight: number
} {
  const statusBarHeight = getSystemInfoCompat().statusBarHeight || FALLBACK_STATUS_BAR_HEIGHT
  try {
    const rect = Taro.getMenuButtonBoundingClientRect?.()
    if (rect && rect.top > 0 && rect.height > 0) {
      return { menuButton: { top: rect.top, height: rect.height }, statusBarHeight }
    }
  } catch {
    // 非微信环境该 API 可能直接抛错,落到下方推算
  }
  return {
    menuButton: { top: statusBarHeight + CAPSULE_GAP, height: CAPSULE_HEIGHT },
    statusBarHeight,
  }
}

export function getSystemInfoCompat(): CompatSystemInfo {
  try {
    const dev = Taro.getDeviceInfo()
    const win = Taro.getWindowInfo()
    const app = Taro.getAppBaseInfo()
    return {
      brand: dev.brand || '',
      platform: dev.platform || '',
      model: dev.model || '',
      screenWidth: win.screenWidth || 0,
      screenHeight: win.screenHeight || 0,
      pixelRatio: win.pixelRatio || 1,
      windowWidth: win.windowWidth || 0,
      windowHeight: win.windowHeight || 0,
      statusBarHeight: win.statusBarHeight || 0,
      language: app.language || '',
    }
  } catch {
    return { ...DEFAULT_INFO }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
