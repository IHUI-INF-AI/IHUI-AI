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
  // 语义色扩展(基于 mobile-rn 实际使用的硬编码色提取,2026-07-28)
  // brand 仍为绿色主色(#10B981),靛蓝/紫色作为辅助品牌色独立分组,
  // 避免覆盖已有 brand.DEFAULT 导致 AiModelCard/AigcScreen 等绿色视觉回归。
  indigo: {
    light: '#eef2ff', // #e0e7ff / #a5b4fc 变体归入此处(UserInfoCard/AiGroup/AiModelCard)
    DEFAULT: '#6366f1', // UserInfoCard 充值按钮/编辑文字
    deep: '#4f46e5', // AiGroup 群组图标文字
  },
  purple: {
    light: '#f5f3ff', // AiAssistant/AiGroup/AiCareer 浅紫底
    DEFAULT: '#7B61FF', // Ai 系列屏幕主紫(#7361FF 变体归入此处)
  },
  warning: {
    light: '#fffbeb', // AiModelCard 警告浅底
    DEFAULT: '#d97706', // UserInfoCard VIP 文字(#F59E0B 变体归入此处)
    deep: '#FF6B00', // AiCareer 深警告
  },
  success: {
    light: '#ecfdf5', // AigcCover/AiCareer 成功浅底(#d1fae5 变体归入此处)
    DEFAULT: '#10B981', // 与 brand.DEFAULT 同值,语义独立(成功状态)
    deep: '#16a34a', // WorkPanel Loading 色
  },
  danger: {
    light: '#fef2f2', // AiAssistant 危险浅底(#FEF2F2)
    DEFAULT: '#dc2626', // 多处危险主色(#DC2626/#ef4444 变体归入此处)
  },
  // 灰阶(与 text/surface 已有字段并存,提供更细粒度)
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
  warning: { light: string; DEFAULT: string; deep: string }
  success: { light: string; DEFAULT: string; deep: string }
  danger: { light: string; DEFAULT: string }
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
 * web 端(solito-demo)不传 colorScheme → 默认 light → 渲染值与历史完全一致。
 */
export const rnLightTokens: RnThemeTokens = {
  brand: { DEFAULT: '#10B981', dark: '#34D399' },
  surface: { bg: '#FFFFFF', light: '#FFFFFF', muted: '#F9FAFB', card: '#F3F4F6', dark: '#1F2937' },
  text: { primary: '#111827', secondary: '#6B7280', tertiary: '#9CA3AF', medium: '#374151' },
  border: { light: '#E5E7EB', medium: '#D1D5DB' },
  error: { bg: '#FEE2E2', text: '#B91C1C' },
  overlay: { modal: 'rgba(0,0,0,0.4)' },
  indigo: { light: '#eef2ff', DEFAULT: '#6366f1', deep: '#4f46e5' },
  purple: { light: '#f5f3ff', DEFAULT: '#7B61FF' },
  warning: { light: '#fffbeb', DEFAULT: '#d97706', deep: '#FF6B00' },
  success: { light: '#ecfdf5', DEFAULT: '#10B981', deep: '#16a34a' },
  danger: { light: '#fef2f2', DEFAULT: '#dc2626' },
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
  // 新增语义色:当前 mobile-rn 组件使用静态 tokens(base),暂不随暗色切换;
  // 此处沿用浅色值,暗色模式语义色适配留待后续统一处理。
  indigo: { light: '#eef2ff', DEFAULT: '#6366f1', deep: '#4f46e5' },
  purple: { light: '#f5f3ff', DEFAULT: '#7B61FF' },
  warning: { light: '#fffbeb', DEFAULT: '#d97706', deep: '#FF6B00' },
  success: { light: '#ecfdf5', DEFAULT: '#10B981', deep: '#16a34a' },
  danger: { light: '#fef2f2', DEFAULT: '#dc2626' },
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
