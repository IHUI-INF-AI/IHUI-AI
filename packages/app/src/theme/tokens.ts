/**
 * packages/app 共享设计令牌。
 * 跨端共享组件统一引用此文件,根治颜色漂移 + 为暗色模式铺路。
 * mobile-rn 端可 re-export 或同步引用,确保品牌色一致。
 */
export const tokens = {
  brand: {
    DEFAULT: '#10B981',
    dark: '#34D399',
  },
  surface: {
    light: '#FFFFFF',
    muted: '#F9FAFB',
    card: '#F3F4F6',
    dark: '#1F2937',
  },
  text: {
    primary: '#111827',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    medium: '#374151',
  },
  border: {
    light: '#E5E7EB',
    medium: '#D1D5DB',
  },
  error: {
    bg: '#FEE2E2',
    text: '#B91C1C',
  },
  overlay: {
    modal: 'rgba(0,0,0,0.4)',
  },
} as const

export type AppTokens = typeof tokens

/** 已解析主题(无 'system') */
export type AppThemeMode = 'light' | 'dark'

/** 动态主题 token 集。相比 base tokens 增加 surface.bg(主背景),其余字段对齐。 */
export type AppThemeTokens = {
  brand: { DEFAULT: string; dark: string }
  surface: { bg: string; light: string; muted: string; card: string; dark: string }
  text: { primary: string; secondary: string; tertiary: string; medium: string }
  border: { light: string; medium: string }
  error: { bg: string; text: string }
  overlay: { modal: string }
}

/**
 * 浅色 token 集。各字段值与 base tokens 等价,额外补 surface.bg = 主背景白。
 * web 端(solito-demo)不传 colorScheme → 默认 light → 渲染值与历史完全一致。
 */
export const lightTokens: AppThemeTokens = {
  brand: { DEFAULT: '#10B981', dark: '#34D399' },
  surface: { bg: '#FFFFFF', light: '#FFFFFF', muted: '#F9FAFB', card: '#F3F4F6', dark: '#1F2937' },
  text: { primary: '#111827', secondary: '#6B7280', tertiary: '#9CA3AF', medium: '#374151' },
  border: { light: '#E5E7EB', medium: '#D1D5DB' },
  error: { bg: '#FEE2E2', text: '#B91C1C' },
  overlay: { modal: 'rgba(0,0,0,0.4)' },
}

/**
 * 深色 token 集。
 * - surface.bg = #1F2937,与 RN RootNavigator Tab Bar 的 tokens.surface.dark 一致。
 * - surface.light 仍为 #FFFFFF:该字段在共享组件中用作「品牌色上的对比白字」
 *   (头像文字 / 主按钮文字),非主背景,故明暗模式均保持白色。
 * - surface.muted=#111827 / surface.card=#374151 形成卡片层级 elevation。
 */
export const darkTokens: AppThemeTokens = {
  brand: { DEFAULT: '#10B981', dark: '#34D399' },
  surface: { bg: '#1F2937', light: '#FFFFFF', muted: '#111827', card: '#374151', dark: '#0F172A' },
  text: { primary: '#F9FAFB', secondary: '#9CA3AF', tertiary: '#6B7280', medium: '#D1D5DB' },
  border: { light: '#374151', medium: '#4B5563' },
  error: { bg: '#7F1D1D', text: '#FCA5A5' },
  overlay: { modal: 'rgba(0,0,0,0.6)' },
}

/** 按已解析主题返回对应 token 集 */
export function getTokens(theme: AppThemeMode): AppThemeTokens {
  return theme === 'dark' ? darkTokens : lightTokens
}
