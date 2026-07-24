/**
 * Design tokens — 从 apps/web/app/globals.css (@theme) + src/styles/design-tokens.css 提取。
 * 亮色为默认值,darkColors 持有暗色模式覆盖。
 */

/** 亮色模式色板 */
export const colors = {
  background: 'hsl(0 0% 96.1%)',
  foreground: 'hsl(0 0% 3.9%)',
  card: 'hsl(0 0% 100%)',
  cardForeground: 'hsl(0 0% 3.9%)',
  popover: 'hsl(0 0% 100%)',
  popoverForeground: 'hsl(0 0% 3.9%)',
  primary: 'hsl(142 71% 45%)',
  primaryForeground: 'hsl(0 0% 100%)',
  secondary: 'hsl(0 0% 96.1%)',
  secondaryForeground: 'hsl(0 0% 9%)',
  muted: 'hsl(0 0% 92%)',
  mutedForeground: 'hsl(0 0% 40%)',
  accent: 'hsl(0 0% 88%)',
  accentForeground: 'hsl(0 0% 9%)',
  destructive: 'hsl(0 100% 60%)',
  destructiveForeground: 'hsl(0 0% 98%)',
  border: 'hsl(0 0% 89.8%)',
  input: 'hsl(0 0% 89.8%)',
  ring: 'hsl(0 0% 70%)',
  success: 'hsl(142 71% 45%)',
  successForeground: 'hsl(0 0% 98%)',
  warning: 'hsl(38 92% 50%)',
  warningForeground: 'hsl(0 0% 98%)',
  info: 'hsl(199 89% 48%)',
  infoForeground: 'hsl(0 0% 98%)',
} as const

/** 暗色模式色板覆盖 */
export const darkColors = {
  background: 'hsl(0 0% 14%)',
  foreground: 'hsl(0 0% 98%)',
  card: 'hsl(0 0% 10%)',
  cardForeground: 'hsl(0 0% 98%)',
  popover: 'hsl(0 0% 11%)',
  popoverForeground: 'hsl(0 0% 98%)',
  primary: 'hsl(142 65% 50%)',
  primaryForeground: 'hsl(0 0% 100%)',
  secondary: 'hsl(0 0% 14.9%)',
  secondaryForeground: 'hsl(0 0% 98%)',
  muted: 'hsl(0 0% 14.9%)',
  mutedForeground: 'hsl(0 0% 63.9%)',
  accent: 'hsl(0 0% 17%)',
  accentForeground: 'hsl(0 0% 98%)',
  destructive: 'hsl(0 100% 60%)',
  destructiveForeground: 'hsl(0 0% 98%)',
  border: 'hsl(0 0% 22%)',
  input: 'hsl(0 0% 22%)',
  ring: 'hsl(0 0% 35%)',
  success: 'hsl(142 65% 50%)',
  successForeground: 'hsl(0 0% 98%)',
  warning: 'hsl(38 85% 55%)',
  warningForeground: 'hsl(0 0% 98%)',
  info: 'hsl(199 80% 55%)',
  infoForeground: 'hsl(0 0% 98%)',
} as const

/** 品牌中性色阶梯 (brand-50 ~ brand-900) */
export const brandColors = {
  50: 'hsl(240 5% 96%)',
  100: 'hsl(240 6% 90%)',
  200: 'hsl(240 5% 84%)',
  300: 'hsl(240 5% 65%)',
  400: 'hsl(240 5% 46%)',
  500: 'hsl(240 4% 36%)',
  600: 'hsl(240 5% 26%)',
  700: 'hsl(240 5% 21%)',
  800: 'hsl(240 6% 16%)',
  900: 'hsl(240 7% 11%)',
} as const

/** 圆角档位 (sm 2px / default 4px / md 6px / lg 8px / xl 12px / 2xl 16px) */
export const radius = {
  sm: '0.125rem',
  DEFAULT: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  '2xl': '1rem',
} as const

/** 间距档位 */
export const spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  2.5: '0.625rem',
  3: '0.75rem',
  3.5: '0.875rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
} as const

/** 字号档位 */
export const fontSize = {
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
  '4xl': '2.25rem',
} as const

/** 阴影 (来源 design-tokens.css --global-box-shadow / --shadow-premium-*) */
export const shadows = {
  sm: '0 1px 2px rgba(0,0,0,0.05)',
  DEFAULT: '0 2px 8px rgba(0,0,0,0.06)',
  lg: '0 10px 15px -3px rgba(0,0,0,0.1)',
  premium: '0 2px 8px rgba(0,0,0,0.06)',
} as const

/** z-index 层级 (来源 design-tokens.css --z-*) */
export const zIndex = {
  base: 1,
  0: 0,
  header: 100,
  sticky: 990,
  dropdown: 1000,
  overlay: 1000,
  modal: 2000,
  popover: 2001,
  notification: 9999,
  loading: 10000,
  max: 10003,
} as const

/** 响应式断点 (来源 globals.css @theme --breakpoint-*) */
export const breakpoints = {
  xs: '320px',
  sm: '375px',
  md: '428px',
  lg: '576px',
  tablet: '768px',
  tabletLg: '1024px',
  laptop: '1280px',
  desktop: '1440px',
  xl: '1920px',
  '2xl': '2560px',
} as const

export type Colors = typeof colors
export type DarkColors = typeof darkColors
export type BrandColors = typeof brandColors
export type Radius = typeof radius
export type Spacing = typeof spacing
export type FontSize = typeof fontSize
export type Shadows = typeof shadows
export type ZIndex = typeof zIndex
export type Breakpoints = typeof breakpoints
