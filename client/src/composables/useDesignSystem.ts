/**
 * 设计系统 Composables
 * 基于 Google Agentic AI IDE 理念，提供设计系统相关的工具函数
 */

import { computed } from 'vue'
import { useDarkModeStore } from '@/stores/darkMode'

/**
 * 设计系统颜色配置
 */
export interface DesignSystemColors {
  primary: string
  secondary: string
  text: {
    primary: string
    secondary: string
    placeholder: string
  }
  background: {
    primary: string
    secondary: string
    tertiary: string
    hover: string
  }
  border: {
    light: string
    gray1: string
    gray2: string
    gray3: string
  }
}

/**
 * 设计系统间距配置
 */
export interface DesignSystemSpacing {
  xs: string
  sm: string
  md: string
  lg: string
  xl: string
  '2xl': string
}

/**
 * 设计系统圆角配置
 */
export interface DesignSystemRadius {
  '2': string
  '3': string
  '4': string
  '6': string
  '8': string
  '15': string
  '30': string
  '60': string
  '120': string
}

/**
 * 设计系统字体配置
 */
export interface DesignSystemTypography {
  sizes: {
    xs: string
    sm: string
    base: string
    lg: string
    xl: string
    '2xl': string
    '3xl': string
    '4xl': string
  }
  weights: {
    normal: number
    medium: number
    semibold: number
    bold: number
  }
}

/**
 * 设计系统过渡配置
 */
export interface DesignSystemTransitions {
  fast: string
  base: string
  slow: string
}

/**
 * 完整设计系统配置
 */
export interface DesignSystemConfig {
  colors: DesignSystemColors
  spacing: DesignSystemSpacing
  radius: DesignSystemRadius
  typography: DesignSystemTypography
  transitions: DesignSystemTransitions
}

// 亮色主题配置
const lightThemeColors: DesignSystemColors = {
  primary: 'var(--el-text-color-primary)',
  secondary: 'var(--color-gray-333)',
  text: {
    primary: 'var(--el-text-color-primary)',
    secondary: 'var(--el-text-color-primary)',
    placeholder: 'var(--color-gray-999)',
  },
  background: {
    primary: 'var(--color-neutral-100)',
    secondary: 'var(--color-neutral-100)',
    tertiary: 'var(--color-neutral-100)',
    hover: 'var(--el-bg-color)',
  },
  border: {
    light: 'var(--el-text-color-primary)',
    gray1: 'var(--color-gray-e5e7eb)',
    gray2: 'var(--color-gray-e8e8e8)',
    gray3: 'var(--ai-gray-1)',
  },
}

// 暗色主题配置
const darkThemeColors: DesignSystemColors = {
  primary: 'var(--el-bg-color)',
  secondary: 'var(--color-gray-ccc)',
  text: {
    primary: 'var(--color-text-muted)',
    secondary: 'var(--color-gray-ccc)',
    placeholder: 'var(--color-gray-999)',
  },
  background: {
    primary: 'var(--color-dark-bg-3)',
    secondary: 'var(--color-dark-bg-3)',
    tertiary: 'var(--color-dark-bg-3)',
    hover: 'var(--color-dark-bg-6)',
  },
  border: {
    light: 'var(--el-bg-color)',
    gray1: 'var(--color-gray-333)',
    gray2: 'var(--color-gray-333)',
    gray3: 'var(--color-gray-333)',
  },
}

// 间距配置
const spacing: DesignSystemSpacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
}

// 圆角配置
const radius: DesignSystemRadius = {
  '2': '2px',
  '3': '3px',
  '4': '4px',
  '6': '6px',
  '8': '8px',
  '15': '15px',
  '30': '30px',
  '60': '60px',
  '120': '120px',
}

// 字体配置
const typography: DesignSystemTypography = {
  sizes: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
  },
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
}

// 过渡配置
const transitions: DesignSystemTransitions = {
  fast: '0.15s ease',
  base: '0.3s ease',
  slow: '0.5s ease',
}

/**
 * 使用设计系统
 * 提供设计系统相关的响应式配置和工具函数
 */
export function useDesignSystem() {
  const darkModeStore = useDarkModeStore()

  // 根据主题返回颜色配置
  const colors = computed<DesignSystemColors>(() => {
    const isDark = darkModeStore.isDarkMode.value ?? darkModeStore.themeMode === 'dark'
    return isDark ? darkThemeColors : lightThemeColors
  })

  // 获取间距值
  const getSpacing = (size: keyof DesignSystemSpacing): string => {
    return spacing[size]
  }

  // 获取圆角值
  const getRadius = (size: keyof DesignSystemRadius): string => {
    return radius[size]
  }

  // 获取字体大小
  const getFontSize = (size: keyof DesignSystemTypography['sizes']): string => {
    return typography.sizes[size]
  }

  // 获取字体粗细
  const getFontWeight = (weight: keyof DesignSystemTypography['weights']): number => {
    return typography.weights[weight]
  }

  // 获取过渡时间
  const getTransition = (speed: keyof DesignSystemTransitions): string => {
    return transitions[speed]
  }

  // 生成 CSS 变量字符串
  const getCSSVariable = (name: string, value: string): string => {
    return `--${name}: ${value};`
  }

  // 应用设计系统样式对象
  const applyDesignSystem = (
    config: Partial<{
      padding?: keyof DesignSystemSpacing
      margin?: keyof DesignSystemSpacing
      borderRadius?: keyof DesignSystemRadius
      fontSize?: keyof DesignSystemTypography['sizes']
      fontWeight?: keyof DesignSystemTypography['weights']
      transition?: keyof DesignSystemTransitions
      color?: 'primary' | 'secondary' | 'text-primary' | 'text-secondary'
      backgroundColor?: 'primary' | 'secondary' | 'tertiary' | 'hover'
    }>
  ): Record<string, string> => {
    const styles: Record<string, string> = {}

    if (config.padding) {
      styles.padding = getSpacing(config.padding)
    }
    if (config.margin) {
      styles.margin = getSpacing(config.margin)
    }
    if (config.borderRadius) {
      styles.borderRadius = getRadius(config.borderRadius)
    }
    if (config.fontSize) {
      styles.fontSize = getFontSize(config.fontSize)
    }
    if (config.fontWeight) {
      styles.fontWeight = String(getFontWeight(config.fontWeight))
    }
    if (config.transition) {
      styles.transition = getTransition(config.transition)
    }
    if (config.color) {
      if (config.color === 'primary') {
        styles.color = colors.value.primary
      } else if (config.color === 'secondary') {
        styles.color = colors.value.secondary
      } else if (config.color === 'text-primary') {
        styles.color = colors.value.text.primary
      } else if (config.color === 'text-secondary') {
        styles.color = colors.value.text.secondary
      }
    }
    if (config.backgroundColor) {
      styles.backgroundColor = colors.value.background[config.backgroundColor]
    }

    return styles
  }

  return {
    colors,
    spacing,
    radius,
    typography,
    transitions,
    getSpacing,
    getRadius,
    getFontSize,
    getFontWeight,
    getTransition,
    getCSSVariable,
    applyDesignSystem,
    isDarkMode: computed(() => {
      return darkModeStore.isDarkMode.value ?? darkModeStore.themeMode === 'dark'
    }),
  }
}

/**
 * 设计系统配置导出
 */
export const designSystemConfig: DesignSystemConfig = {
  colors: lightThemeColors, // 默认使用亮色主题
  spacing,
  radius,
  typography,
  transitions,
}
