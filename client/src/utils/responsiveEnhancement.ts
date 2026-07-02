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
