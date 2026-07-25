/**
 * 小程序样式统一常量(集中管理)
 * - light:对齐 apps/web/app/globals.css 亮色主题
 * - dark :对齐 apps/miniapp-taro/src/app.css 赛博朋克深色主题(D7 Ai-WXMiniVue uni.scss 迁移)
 * 圆角梯度严格遵守 AGENTS.md §4(禁止 rounded-full / 9999px / 50%)。
 */

/** 语义色板(light/dark 双主题) */
export const COLORS = {
  primary: { light: '#22C55E', dark: '#00F2FF' },
  secondary: { light: '#F5F5F5', dark: '#1A1A23' },
  accent: { light: '#0EA5E9', dark: '#3B82F6' },
  success: { light: '#22C55E', dark: '#22C55E' },
  warning: { light: '#F59E0B', dark: '#F59E0B' },
  danger: { light: '#FF3333', dark: '#FF3B3B' },
  info: { light: '#0EA5E9', dark: '#3B82F6' },
  textPrimary: { light: '#0A0A0A', dark: '#FFFFFF' },
  textSecondary: { light: '#525252', dark: '#A3A3A3' },
  textTertiary: { light: '#A3A3A3', dark: '#737373' },
  bgPrimary: { light: '#FFFFFF', dark: '#121217' },
  bgSecondary: { light: '#F5F5F5', dark: '#1F1F28' },
  bgTertiary: { light: '#EBEBEB', dark: '#1A1A23' },
  border: { light: '#E5E5E5', dark: '#00F2FF26' },
  divider: { light: '#E5E5E5', dark: '#2A2A35' },
} as const

/** 间距(px) */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const

/** 字号(px) */
export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

/** 字重 */
export const FONT_WEIGHTS = {
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const

/** 圆角(px,AGENTS.md §4 守门:禁止 rounded-full) */
export const RADII = {
  sm: 2,
  md: 4,
  lg: 6,
  xl: 8,
  xxl: 12,
  xxxl: 16,
} as const

/** 阴影 */
export const SHADOWS = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
} as const

/** 动画时长(ms) */
export const DURATIONS = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const

/** z-index 层级 */
export const Z_INDEX = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modal: 1040,
  popover: 1050,
  tooltip: 1060,
  toast: 1070,
} as const
