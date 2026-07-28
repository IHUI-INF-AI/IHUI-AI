export { cn } from './cn'

// RN 专用 tokens(mobile-rn / packages/app 共享,HEX 表达,与 web HSL 并存)
// 注:web HSL token 集曾由 ./tokens.ts 提供,因 0 引用且与 tokens.css 严重漂移
// (colors.primary=绿色 vs --color-primary=黑色)已于 2026-07-28 删除。
// web 端 token 单一来源 = ./styles/tokens.css(@theme + .dark 覆盖)。
export {
  rnTokens,
  rnLightTokens,
  rnDarkTokens,
  getRnTokens,
  type RnTokens,
  type RnThemeMode,
  type RnThemeTokens,
} from './rn-tokens'

// 跨端组件 props 接口统一层(ui-react + ui-native 共享)
export {
  type VipBadgeBaseProps,
  type BadgeVariant,
  type BadgeBaseProps,
  type ButtonBaseVariant,
  type ButtonBaseSize,
  type ButtonBaseProps,
} from './component-props'
