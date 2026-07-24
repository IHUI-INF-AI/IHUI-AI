/**
 * RN 专用设计令牌(mobile-rn / packages/app 共享)。
 *
 * 与 web 端 HSL shadcn 色板(packages/design-tokens/src/tokens.ts)并存,理由:
 * - RN NativeWind 4.x 仅支持 Tailwind v3,不兼容 v4 @theme HSL 语法
 * - RN 端用 HEX 表达,与 React Native StyleSheet 数字化颜色约定一致
 * - 单一源头:此文件为 RN tokens 唯一定义处,packages/app/theme/tokens.ts 仅 re-export
 *
 * 跨端颜色对齐策略:
 * - brand.DEFAULT = #10B981 ↔ web colors.primary = hsl(142 71% 45%)(同绿色)
 * - surface.dark = #1F2937 ↔ web darkColors.card = hsl(0 0% 10%)(同深灰)
 * 值漂移即 bug,修改时必须双向校对。
 */

/** RN 端基础 tokens(向后兼容 RootNavigator Tab Bar) */
export const rnTokens = {
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

export type RnTokens = typeof rnTokens

/** 已解析主题(无 'system') */
export type RnThemeMode = 'light' | 'dark'

/** 动态主题 token 集。相比 base tokens 增加 surface.bg(主背景),其余字段对齐。 */
export type RnThemeTokens = {
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
export const rnLightTokens: RnThemeTokens = {
  brand: { DEFAULT: '#10B981', dark: '#34D399' },
  surface: { bg: '#FFFFFF', light: '#FFFFFF', muted: '#F9FAFB', card: '#F3F4F6', dark: '#1F2937' },
  text: { primary: '#111827', secondary: '#6B7280', tertiary: '#9CA3AF', medium: '#374151' },
  border: { light: '#E5E7EB', medium: '#D1D5DB' },
  error: { bg: '#FEE2E2', text: '#B91C1C' },
  overlay: { modal: 'rgba(0,0,0,0.4)' },
}

/**
 * 深色 token 集。
 * - surface.bg = #1F2937,与 RN RootNavigator Tab Bar 的 rnTokens.surface.dark 一致。
 * - surface.light 仍为 #FFFFFF:该字段在共享组件中用作「品牌色上的对比白字」
 *   (头像文字 / 主按钮文字),非主背景,故明暗模式均保持白色。
 * - surface.muted=#111827 / surface.card=#374151 形成卡片层级 elevation。
 */
export const rnDarkTokens: RnThemeTokens = {
  brand: { DEFAULT: '#10B981', dark: '#34D399' },
  surface: { bg: '#1F2937', light: '#FFFFFF', muted: '#111827', card: '#374151', dark: '#0F172A' },
  text: { primary: '#F9FAFB', secondary: '#9CA3AF', tertiary: '#6B7280', medium: '#D1D5DB' },
  border: { light: '#374151', medium: '#4B5563' },
  error: { bg: '#7F1D1D', text: '#FCA5A5' },
  overlay: { modal: 'rgba(0,0,0,0.6)' },
}

/** 按已解析主题返回对应 token 集 */
export function getRnTokens(theme: RnThemeMode): RnThemeTokens {
  return theme === 'dark' ? rnDarkTokens : rnLightTokens
}
