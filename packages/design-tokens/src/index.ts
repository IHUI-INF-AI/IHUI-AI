// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export { cn } from './cn'

// Token 注册表(P3-1.1 立,2026-08-01)— 名称 + 类型 + 默认值的单一真相源元数据层。
// 与 styles/tokens.css 互为校验:tokens.css 是值的真相源,本模块是名称 + 类型的真相源。
export {
  TOKEN_REGISTRY,
  TOKEN_NAMES,
  TOKEN_COUNT,
  validateTokenConsistency,
  listMissingTokens,
  extractCssVars,
  type TokenType,
  type TokenEntry,
  type ConsistencyResult,
} from './token-registry'

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

// JS 侧图表/品牌色唯一真相源(web ECharts / api Swagger 消费,与 tokens.css --chart-N 互镜像)。
export {
  CHART_PALETTE,
  CHART_BLUE,
  CHART_GREEN,
  CHART_AMBER,
  CHART_RED,
  CHART_VIOLET,
  CHART_PINK,
  CHART_CYAN,
  CHART_LIME,
  CHART_TEXT_LIGHT,
  CHART_TEXT_DARK,
  CHART_AXIS_LIGHT,
  CHART_AXIS_DARK,
  CHART_SUCCESS_LIGHT,
  CHART_SUCCESS_DARK,
  CHART_INDIGO_RAMP,
  CHART_INDIGO,
  CHART_PURPLE,
  CHART_ORANGE,
  CHART_TEAL,
  CHART_ROSE,
  CHART_BG_DARK,
  CHART_BG_LIGHT,
  BRAND_PRIMARY,
  BRAND_PRIMARY_DARK,
  BRAND_BG,
  SWARM_ROLE_FILL,
  SWARM_ROLE_STROKE,
  SWARM_ROLE_TEXT,
  DESIGN_OVERLAY_BG_LIGHT,
  DESIGN_OVERLAY_BG_DARK,
  DESIGN_OVERLAY_FG_LIGHT,
  DESIGN_OVERLAY_FG_DARK,
  SHELL_BG_DARK,
  COLOR_BLACK,
  withAlpha,
  chartText,
  chartAxis,
  chartBg,
} from './chart-colors'

// D46(2026-09-23):受控图表模板注册表(白名单唯一真源,色值同源 chart-colors)。
export {
  CHART_TEMPLATES,
  isChartTemplateId,
  chartTemplateMeta,
  parseChartTemplatePayload,
  parseChartTemplateJson,
} from './chart-templates'
export type {
  ChartTemplateId,
  ChartTemplateScene,
  ChartTemplateMeta,
  ChartTemplatePayload,
} from './chart-templates'

// 第三方 OAuth 平台品牌色唯一真相源(mobile-rn 登录页第三方按钮消费,明暗恒定)。
export { OAUTH_BRAND_COLORS } from './oauth-colors'

// 关闭按钮统一样式 token(2026-09-16 立)— 弹窗/抽屉/浮层关闭按钮单一真相源,
// ui-react CloseButton 组件 + 各端散装 Radix Close 全部引用,禁止手写散装样式。
export {
  CLOSE_BUTTON_POSITION,
  CLOSE_BUTTON_SIZE,
  CLOSE_BUTTON_ICON,
  CLOSE_BUTTON_BASE,
  CLOSE_BUTTON_ON_DARK,
} from './close-button'

// 图标按钮统一样式 token — 全项目图标按钮尺寸单一真相源,
// 唯一尺寸(32×32),ui-react IconButton 组件 + 标题栏/工具栏散装图标按钮全部引用。
export {
  ICON_BUTTON_SIZE,
  ICON_BUTTON_ICON_SIZE,
  ICON_BUTTON_BASE_CLASS,
  iconButtonClasses,
  iconButtonIconClasses,
} from './icon-button'

// 生成的文档(PDF/Email/落地页)配色唯一真相源。
export {
  DOC_BG,
  DOC_PAGE_BG,
  DOC_BG_CARD,
  DOC_BG_HOVER,
  DOC_TEXT_STRONG,
  DOC_TEXT_BODY,
  DOC_TEXT_MUTED,
  DOC_BORDER,
  DOC_BORDER_HARD,
  DOC_BRAND,
  DOC_BRAND_SOFT,
  DOC_BRAND_LIGHT,
  DOC_BRAND_HOVER,
  DOC_BG_DARK,
  DOC_BG_CARD_DARK,
  DOC_BG_HOVER_DARK,
  DOC_TEXT_DARK,
  DOC_BORDER_DARK,
  DOC_DANGER,
  DOC_ACCENT,
} from './doc-colors'

// 跨端组件 props 接口统一层(ui-react + ui-native 共享)
export {
  type VipBadgeBaseProps,
  type BadgeVariant,
  type BadgeBaseProps,
  type ButtonBaseVariant,
  type ButtonBaseSize,
  type ButtonBaseProps,
} from './component-props'

// 圆角档位唯一真相源(全端共用):Tailwind v3 preset 取 RADIUS_REM,JS 数值场景取 rnRadius。
// CSS 端(tokens.css / app.css)写 var(--radius-*),其值由 check-radius-single-source.mjs 与本表对账。
export {
  RADIUS_STEPS,
  RADIUS_REM,
  RADIUS_CSS_PX,
  RADIUS_CSS_VAR,
  RADIUS_SCALE_PX,
  rnRadius,
  rpxToStep,
  pxToStep,
  type RadiusStep,
} from './radius.js'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
