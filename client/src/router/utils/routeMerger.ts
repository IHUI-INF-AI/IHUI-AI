import type { RouteRecordRaw } from 'vue-router'

// 定义支持的平台类型
export type PlatformType = 'web' | 'h5' | 'alipay' | 'electron'

/**
 * 平台检测函数
 * 自动检测当前运行的平台
 */
export const getCurrentPlatform = (): PlatformType => {
  // 如果是 Electron 环境
  if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
    return 'electron'
  }

  // 浏览器环境检测
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    const userAgent = navigator.userAgent.toLowerCase()

    // 支付宝小程序环境检测
    const win = window as Window & { my?: { alert?: () => void } }
    if (typeof win.my === 'object' && typeof win.my.alert === 'function') {
      return 'alipay'
    }

    // H5 环境检测（移动设备）
    if (/mobile|android|ios|iphone|ipad|ipod/.test(userAgent)) {
      return 'h5'
    }

    // 默认 Web 环境
    return 'web'
  }

  // 默认返回 Web 环境
  return 'web'
}

// 平台特定路由映射
const platformRouteMap: Record<PlatformType, Array<RouteRecordRaw>> = {
  web: [],
  h5: [],
  alipay: [],
  electron: [],
}

/**
 * 注册平台特定路由
 * @param platform 平台类型
 * @param routes 路由配置
 */
export const registerPlatformRoutes = (
  platform: PlatformType,
  routes: Array<RouteRecordRaw>
): void => {
  platformRouteMap[platform] = routes
}

/**
 * 路由合并函数
 * @param baseRoutes 基础路由
 * @param targetPlatform 目标平台（可选，默认自动检测）
 * @returns 合并后的路由配置
 */
export const mergeRoutes = (
  baseRoutes: Array<RouteRecordRaw>,
  targetPlatform?: PlatformType
): Array<RouteRecordRaw> => {
  const platform = targetPlatform || getCurrentPlatform()
  const platformRoutes = platformRouteMap[platform] || []

  // 合并基础路由和平台特定路由
  const allRoutes = [...baseRoutes, ...platformRoutes]

  // 过滤掉不匹配当前平台的路由
  return allRoutes.filter(route => {
    // 如果没有 meta.platform 配置，默认所有平台都可见
    const meta = route.meta as { platform?: PlatformType | PlatformType[] } | undefined
    if (!meta || !meta.platform) {
      return true
    }

    // 如果 meta.platform 是数组，检查当前平台是否在其中
    if (Array.isArray(meta.platform)) {
      return meta.platform.includes(platform)
    }

    // 如果 meta.platform 是字符串，检查是否匹配当前平台
    if (typeof meta.platform === 'string') {
      return meta.platform === platform
    }

    // 默认显示
    return true
  })
}

/**
 * 获取平台特定的路由
 * @param platform 平台类型
 * @returns 平台特定的路由配置
 */
export const getPlatformRoutes = (platform: PlatformType): Array<RouteRecordRaw> => {
  return platformRouteMap[platform] || []
}
