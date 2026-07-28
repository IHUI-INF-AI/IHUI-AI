/**
 * RN 专用设计令牌(mobile-rn / packages/app 共享)。
 *
 * 与 web 端 HSL shadcn 色板(packages/design-tokens/src/styles/tokens.css)并存,理由:
 * - RN NativeWind 4.x 仅支持 Tailwind v3,不兼容 v4 @theme HSL 语法
 * - RN 端用 HEX 表达,与 React Native StyleSheet 数字化颜色约定一致
 * - 单一源头:此文件为 RN tokens 唯一定义处,packages/app/theme/tokens.ts 仅 re-export
 *
 * 跨端颜色对齐策略(2026-07-28 更新,对齐 web tokens.css 2026-07-24 消除绿色改纯黑):
 * - brand.DEFAULT = #000000(rnLight/base)↔ web 亮色 --color-primary = hsl(0 0% 0%)(纯黑)
 * - brand.DEFAULT = #FFFFFF(rnDark)↔ web 暗色 --color-primary = hsl(0 0% 100%)(纯白)
 * - surface.dark = #1F2937 ↔ web darkColors.card = hsl(0 0% 10%)(同深灰,保留 RN 端 Tab Bar 历史色)
 * 值漂移即 bug,修改时必须双向校对。
 */

/**
 * 扩展语义色:用于 mobile-rn 端状态徽章 / 卡片背景的细分层级。
 * - success.lighter / lightest:更浅的成功绿背景(d1fae5 / f0fdf4)
 * - success.deepText:深绿色文字(065F46,用于 success 卡片标签)
 * - warning.amber / amberLight / amberText / orangeLight:amber 警告色变体
 * - danger.bright:亮红色(ef4444,职位薪资等强调红)
 */
export type RnSuccessTokens = {
  lightest: string
  lighter: string
  light: string
  DEFAULT: string
  deep: string
  deepText: string
}

export type RnWarningTokens = {
  light: string
  amberLight: string
  orangeLight: string
  amber: string
  DEFAULT: string
  amberText: string
  deep: string
}

export type RnDangerTokens = {
  light: string
  DEFAULT: string
  bright: string
}

/** RN 端基础 tokens(向后兼容 RootNavigator Tab Bar)
 *  brand.DEFAULT = #000000 对齐 web 亮色 --color-primary(2026-07-24 用户要求消除绿色)。 */
export const rnTokens = {
  brand: {
    DEFAULT: '#000000',
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
  indigo: {
    light: '#eef2ff',
    DEFAULT: '#6366f1',
    deep: '#4f46e5',
  },
  purple: {
    light: '#f5f3ff',
    DEFAULT: '#7B61FF',
  },
  warning: {
    light: '#fffbeb',
    amberLight: '#fef3c7',
    orangeLight: '#fff7ed',
    amber: '#f59e0b',
    DEFAULT: '#d97706',
    amberText: '#92400e',
    deep: '#FF6B00',
  } satisfies RnWarningTokens,
  success: {
    lightest: '#f0fdf4',
    lighter: '#d1fae5',
    light: '#ecfdf5',
    DEFAULT: '#10B981',
    deep: '#16a34a',
    deepText: '#065F46',
  } satisfies RnSuccessTokens,
  danger: {
    light: '#fef2f2',
    DEFAULT: '#dc2626',
    bright: '#ef4444',
  } satisfies RnDangerTokens,
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    black: '#000',
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
  indigo: { light: string; DEFAULT: string; deep: string }
  purple: { light: string; DEFAULT: string }
  warning: RnWarningTokens
  success: RnSuccessTokens
  danger: RnDangerTokens
  gray: {
    50: string
    100: string
    200: string
    400: string
    500: string
    600: string
    700: string
    800: string
    900: string
    black: string
  }
}

/**
 * 浅色 token 集。各字段值与 base tokens 等价,额外补 surface.bg = 主背景白。
 * web 端(shared-demo)不传 colorScheme → 默认 light → 渲染值与历史完全一致。
 * brand.DEFAULT = #000000 对齐 web 亮色 --color-primary(2026-07-24 消除绿色)。
 */
export const rnLightTokens: RnThemeTokens = {
  brand: { DEFAULT: '#000000', dark: '#34D399' },
  surface: { bg: '#FFFFFF', light: '#FFFFFF', muted: '#F9FAFB', card: '#F3F4F6', dark: '#1F2937' },
  text: { primary: '#111827', secondary: '#6B7280', tertiary: '#9CA3AF', medium: '#374151' },
  border: { light: '#E5E7EB', medium: '#D1D5DB' },
  error: { bg: '#FEE2E2', text: '#B91C1C' },
  overlay: { modal: 'rgba(0,0,0,0.4)' },
  indigo: { light: '#eef2ff', DEFAULT: '#6366f1', deep: '#4f46e5' },
  purple: { light: '#f5f3ff', DEFAULT: '#7B61FF' },
  warning: {
    light: '#fffbeb',
    amberLight: '#fef3c7',
    orangeLight: '#fff7ed',
    amber: '#f59e0b',
    DEFAULT: '#d97706',
    amberText: '#92400e',
    deep: '#FF6B00',
  },
  success: {
    lightest: '#f0fdf4',
    lighter: '#d1fae5',
    light: '#ecfdf5',
    DEFAULT: '#10B981',
    deep: '#16a34a',
    deepText: '#065F46',
  },
  danger: { light: '#fef2f2', DEFAULT: '#dc2626', bright: '#ef4444' },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    black: '#000',
  },
}

/**
 * 深色 token 集。
 * - brand.DEFAULT = #FFFFFF 对齐 web 暗色 --color-primary(2026-07-24 消除绿色,暗色用纯白底)。
 * - surface.bg = #1F2937,与 RN RootNavigator Tab Bar 的 rnTokens.surface.dark 一致。
 * - surface.light 仍为 #FFFFFF:该字段在共享组件中用作「品牌色上的对比白字」
 *   (头像文字 / 主按钮文字),非主背景,故明暗模式均保持白色。
 * - surface.muted=#111827 / surface.card=#374151 形成卡片层级 elevation。
 */
export const rnDarkTokens: RnThemeTokens = {
  brand: { DEFAULT: '#FFFFFF', dark: '#34D399' },
  surface: { bg: '#1F2937', light: '#FFFFFF', muted: '#111827', card: '#374151', dark: '#0F172A' },
  text: { primary: '#F9FAFB', secondary: '#9CA3AF', tertiary: '#6B7280', medium: '#D1D5DB' },
  border: { light: '#374151', medium: '#4B5563' },
  error: { bg: '#7F1D1D', text: '#FCA5A5' },
  overlay: { modal: 'rgba(0,0,0,0.6)' },
  indigo: { light: '#312e81', DEFAULT: '#6366f1', deep: '#818cf8' },
  purple: { light: '#4c1d95', DEFAULT: '#7B61FF' },
  warning: {
    light: '#451a03',
    amberLight: '#78350f',
    orangeLight: '#431407',
    amber: '#fbbf24',
    DEFAULT: '#f59e0b',
    amberText: '#fbbf24',
    deep: '#FF6B00',
  },
  success: {
    lightest: '#052e16',
    lighter: '#064e3b',
    light: '#052e16',
    DEFAULT: '#10B981',
    deep: '#16a34a',
    deepText: '#86efac',
  },
  danger: { light: '#450a0a', DEFAULT: '#ef4444', bright: '#f87171' },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    black: '#000',
  },
}

/** 按已解析主题返回对应 token 集 */
export function getRnTokens(theme: RnThemeMode): RnThemeTokens {
  return theme === 'dark' ? rnDarkTokens : rnLightTokens
}
