/**
 * 响应式增强工具
 * 提供响应式布局相关的配置和工具函数
 */

/**
 * 断点配置
 */
export interface BreakpointConfig {
  xs: number // 超小屏幕
  sm: number // 小屏幕
  md: number // 中等屏幕
  lg: number // 大屏幕
  xl: number // 超大屏幕
  xxl: number // 超超大屏幕
}

/**
 * 默认断点配置
 */
export const defaultBreakpoints: BreakpointConfig = {
  xs: 480,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1600,
}

/**
 * 响应式配置
 */
export interface ResponsiveConfig {
  breakpoints: BreakpointConfig
  debounceMs: number
  throttleMs: number
}

/**
 * 默认响应式配置
 */
export const defaultResponsiveConfig: ResponsiveConfig = {
  breakpoints: defaultBreakpoints,
  debounceMs: 100,
  throttleMs: 16,
}

/**
 * 获取当前视口宽度
 */
export function getViewportWidth(): number {
  if (typeof window === 'undefined') return 0
  return window.innerWidth
}

/**
 * 获取当前视口高度
 */
export function getViewportHeight(): number {
  if (typeof window === 'undefined') return 0
  return window.innerHeight
}

/**
 * 检查是否匹配断点
 */
export function matchesBreakpoint(
  breakpoint: keyof BreakpointConfig,
  config: BreakpointConfig = defaultBreakpoints
): boolean {
  if (typeof window === 'undefined') return false
  const width = window.innerWidth
  const breakpointValue = config[breakpoint]

  return width >= breakpointValue
}

/**
 * 检查是否为移动端
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < defaultBreakpoints.md
}

/**
 * 检查是否为平板
 */
export function isTablet(): boolean {
  if (typeof window === 'undefined') return false
  const width = window.innerWidth
  return width >= defaultBreakpoints.md && width < defaultBreakpoints.lg
}

/**
 * 检查是否为桌面端
 */
export function isDesktop(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth >= defaultBreakpoints.lg
}

/**
 * 监听窗口大小变化
 */
export function onResize(
  callback: () => void,
  options: { debounce?: number; immediate?: boolean } = {}
): () => void {
  if (typeof window === 'undefined') return () => {}

  const { debounce = 100, immediate = false } = options

  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const handler = () => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(callback, debounce)
  }

  window.addEventListener('resize', handler)

  if (immediate) {
    callback()
  }

  // 返回取消监听函数
  return () => {
    window.removeEventListener('resize', handler)
    if (timeoutId) clearTimeout(timeoutId)
  }
}

/**
 * 获取设备像素比
 */
export function getDevicePixelRatio(): number {
  if (typeof window === 'undefined') return 1
  return window.devicePixelRatio || 1
}

/**
 * 检查是否支持触摸
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

/**
 * 获取方向
 */
export function getOrientation(): 'portrait' | 'landscape' {
  if (typeof window === 'undefined') return 'portrait'
  return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
}
