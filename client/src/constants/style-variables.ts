/**
 * 样式变量常量
 * 适配 Web 环境
 */

import { logger } from '@/utils/logger'

// 安全获取系统信息
const getSafeSystemInfo = () => {
  try {
    // Web 环境下获取系统信息
    return {
      statusBarHeight: 0, // Web 环境没有状态栏
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1,
      system: navigator.platform,
      platform: 'web',
    }
  } catch (_e) {
    return {
      statusBarHeight: 0,
      windowWidth: 375,
      windowHeight: 667,
      pixelRatio: 1,
      system: '',
      platform: 'web',
    }
  }
}

const systemInfo = getSafeSystemInfo()
const statusBarHeight = systemInfo.statusBarHeight || 0

// 导航栏高度（Web 环境）
const navBarHeight = 44 // Web 环境固定为 44px

// 定义样式变量
export const styleVariables: Record<string, string> = {
  '--app-status-bar-height': `${statusBarHeight}px`,
  '--app-nav-bar-height': `${navBarHeight}px`, // 导航栏高度
  '--app-nav-bar-width': '87px', // Web 环境固定为 87px
  '--app-top-bar-height': `${statusBarHeight + navBarHeight}px`, // 整体高度
  '--app-brand-color-primary': 'var(--el-color-primary)',
  '--app-brand-color-secondary': 'var(--el-text-color-primary)',
  '--app-price-color-primary': 'var(--el-text-color-primary)',
  '--app-price-color-secondary': 'var(--el-text-color-primary)80',
}

// 开发环境调试输出
if (import.meta.env.MODE === 'development') {
  logger.debug('Style variables:', styleVariables)
}

// 导出工具函数
export { getSafeSystemInfo, statusBarHeight, navBarHeight }
