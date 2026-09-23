// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 *   （强调天蓝统一用 brandAccent.DEFAULT,详见下方「全项目统一强调色」;已删除 warning.deep）
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
}

export type RnDangerTokens = {
  light: string
  DEFAULT: string
  bright: string
}

/** VIP 会员金色(对齐 miniapp-taro --color-vip-gold-start/end #ffd700/#ffaa00,明暗同值)。 */
export type RnVipTokens = {
  gold: string
  goldEnd: string
}

/** RN 端基础 tokens(向后兼容 RootNavigator Tab Bar)
 *  2026-09-04 全量对齐 web 端 tokens.css(单一来源):中性色从 Tailwind 蓝灰阶
 *  (gray/slate)切换为 shadcn 中性灰;status DEFAULT 对齐 web 语义色。
 *  brand.DEFAULT = #000000 对齐 web 亮色 --color-primary(2026-07-24 用户要求消除绿色)。 */
export const rnTokens = {
  brand: {
    DEFAULT: '#000000',
    /** 品牌底(brand.DEFAULT)之上的前景色。深色下 brand.DEFAULT 翻成白,前景必须翻黑,
     *  不得用 surface.light 代替(它在两态都是 #FFFFFF → 白底白字)。 */
    foreground: '#FFFFFF',
    /** 主 CTA 填充档(2026-09-23 立)。与 brand.DEFAULT 同源但**不随主题翻成纯白**:
     *  浅色=品牌黑(与 brand.DEFAULT 同值,浅色态零变化),深色=灰蓝(纯白压深底实测 17.4:1,刺眼)。
     *  主按钮/选中胶囊一律走本档 + ctaText 成对使用,不得逐处硬写颜色。 */
    ctaFill: '#000000',
    /** ctaFill 之上的文字(必须与 ctaFill 成对,单独换底不换字会打穿对比度) */
    ctaText: '#FFFFFF',
    dark: '#34D399',
  },
  surface: {
    light: '#FFFFFF',
    muted: '#EBEBEB',
    card: '#FFFFFF',
    dark: '#262626',
    /** 输入框背景:2026-09-04 对齐 web 中性灰(原 #f0f7ff 对齐 miniapp,已切换)。 */
    inputBg: '#F5F5F5',
  },
  text: {
    primary: '#0A0A0A',
    secondary: '#666666',
    tertiary: '#A3A3A3',
    medium: '#404040',
  },
  border: {
    light: '#E5E5E5',
    medium: '#D4D4D4',
  },
  error: {
    bg: '#FFE5E5',
    text: '#FF3333',
  },
  overlay: {
    modal: 'rgba(0,0,0,0.4)',
    /** 全屏 loading 遮罩:浅色下白纱,深色下黑纱(白纱压在深底上会整屏刺眼且让 secondary 文字不可读) */
    loading: 'rgba(255,255,255,0.8)',
  },
  /** 全项目统一强调色(高级灰蓝,2026-09-14 用户定稿),对齐 web --color-brand-accent。
   * DEFAULT=按钮/填充底色(浅灰蓝),foreground=其上的文字色(深蓝灰,浅底白字不可读),
   * deep=白/深底上的"文字/图标"变体(对比度足够)。 */
  brandAccent: {
    light: '#eaf2f7',
    DEFAULT: '#8fb8cc',
    deep: '#4a7a96',
    foreground: '#1e3a47',
    gradFrom: '#b8d4e3',
    gradTo: '#8fb8cc',
  },
  warning: {
    light: '#fffbeb',
    amberLight: '#fef3c7',
    orangeLight: '#fff7ed',
    amber: '#f59e0b',
    DEFAULT: '#f59e0b',
    amberText: '#92400e',
  } satisfies RnWarningTokens,
  success: {
    lightest: '#f0fdf4',
    lighter: '#d1fae5',
    light: '#ecfdf5',
    DEFAULT: '#22c55e',
    deep: '#16a34a',
    deepText: '#065F46',
  } satisfies RnSuccessTokens,
  danger: {
    light: '#fef2f2',
    DEFAULT: '#ff3333',
    bright: '#ff5c5c',
  } satisfies RnDangerTokens,
  vip: {
    gold: '#FFD700',
    goldEnd: '#FFAA00',
  } satisfies RnVipTokens,
  gray: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    black: '#000',
  },
} as const

export type RnTokens = typeof rnTokens

/** 已解析主题(无 'system') */
export type RnThemeMode = 'light' | 'dark'

/** 动态主题 token 集。相比 base tokens 增加 surface.bg(主背景),其余字段对齐。 */
export type RnThemeTokens = {
  brand: { DEFAULT: string; foreground: string; ctaFill: string; ctaText: string; dark: string }
  surface: { bg: string; light: string; muted: string; card: string; dark: string; inputBg: string }
  text: { primary: string; secondary: string; tertiary: string; medium: string }
  border: { light: string; medium: string }
  error: { bg: string; text: string }
  overlay: { modal: string; loading: string }
  /* brandAccent:高级灰蓝(2026-09-14 定稿)。DEFAULT=底色,foreground=其上文字,
   * deep=表面文字/图标变体,gradFrom/gradTo=CTA 局部渐变点缀。 */
  brandAccent: {
    light: string
    DEFAULT: string
    deep: string
    foreground: string
    gradFrom: string
    gradTo: string
  }
  warning: RnWarningTokens
  success: RnSuccessTokens
  danger: RnDangerTokens
  vip: RnVipTokens
  gray: {
    50: string
    100: string
    200: string
    300: string
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
 * 浅色 token 集。2026-09-04 全量对齐 web tokens.css 亮色:
 * - surface.bg = #F5F5F5(web --color-background hsl 0 0% 96.1%):页面浅灰底 + 白卡片分层,
 *   与 web 分层体系一致(此前 RN 是白页面 + 灰卡片,层级倒置)。
 * - surface.card = #FFFFFF(web --color-card)。
 * - surface.light 保持 #FFFFFF:该字段在共享组件中用作「品牌色上的对比白字」
 *   (头像文字 / 主按钮文字),非主背景,明暗模式均保持白色。
 * - brand.DEFAULT = #000000 对齐 web 亮色 --color-primary(2026-07-24 消除绿色)。
 */
export const rnLightTokens: RnThemeTokens = {
  brand: {
    DEFAULT: '#000000',
    foreground: '#FFFFFF',
    ctaFill: '#000000',
    ctaText: '#FFFFFF',
    dark: '#34D399',
  },
  surface: {
    bg: '#F5F5F5',
    light: '#FFFFFF',
    muted: '#EBEBEB',
    card: '#FFFFFF',
    dark: '#262626',
    inputBg: '#F5F5F5',
  },
  text: { primary: '#0A0A0A', secondary: '#666666', tertiary: '#A3A3A3', medium: '#404040' },
  border: { light: '#E5E5E5', medium: '#D4D4D4' },
  error: { bg: '#FFE5E5', text: '#FF3333' },
  overlay: { modal: 'rgba(0,0,0,0.4)', loading: 'rgba(255,255,255,0.8)' },
  brandAccent: {
    light: '#eaf2f7',
    DEFAULT: '#8fb8cc',
    deep: '#4a7a96',
    foreground: '#1e3a47',
    gradFrom: '#b8d4e3',
    gradTo: '#8fb8cc',
  },
  warning: {
    light: '#fffbeb',
    amberLight: '#fef3c7',
    orangeLight: '#fff7ed',
    amber: '#f59e0b',
    DEFAULT: '#f59e0b',
    amberText: '#92400e',
  },
  success: {
    lightest: '#f0fdf4',
    lighter: '#d1fae5',
    light: '#ecfdf5',
    DEFAULT: '#22c55e',
    deep: '#16a34a',
    deepText: '#065F46',
  },
  danger: { light: '#fee2e2', DEFAULT: '#dc2626', bright: '#f87171' },
  vip: { gold: '#FFD700', goldEnd: '#FFAA00' },
  gray: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    black: '#000',
  },
}

/**
 * 深色 token 集。2026-09-04 全量对齐 web tokens.css .dark:
 * - brand.DEFAULT = #FFFFFF 对齐 web 暗色 --color-primary(2026-07-24 消除绿色,暗色用纯白底)。
 * - surface.bg = #242424(web --color-background hsl 0 0% 14%),替换原蓝灰 #1F2937。
 * - surface.card = #1A1A1A(web --color-card hsl 0 0% 10%),替换原 #374151 中灰(登录页"灰突突"根因)。
 * - surface.light 深色改为 #262626(= surface.muted):原值 #FFFFFF 在深色模式下无论做容器背景
 *   还是做品牌色上的文字色都会导致白底白字(全项目 790 处误用)。改为深灰后,做背景时融入主题,
 *   做品牌色(brand.DEFAULT 深色=白)上的文字色时深灰字在白底上可见。真正需要"品牌色上的白字"
 *   的场景应使用 brand.foreground(浅色=白,深色=黑)或直接用 #FFFFFF 常量。
 * - surface.muted = #262626(web --color-muted hsl 0 0% 14.9%),卡片/输入框微亮层级。
 * - text/border/error/status DEFAULT 对齐 web 暗色语义色。
 * - brand.ctaFill = #a3c4d6(= 深色 brandAccent.DEFAULT):主 CTA 不随主题翻成纯白,
 *   纯白底压 #1A1A1A 卡面实测 17.4:1 即用户报的"刺眼";浅色 ctaFill 仍是品牌黑,浅色态零变化。
 */
export const rnDarkTokens: RnThemeTokens = {
  brand: {
    DEFAULT: '#FFFFFF',
    foreground: '#000000',
    ctaFill: '#a3c4d6',
    ctaText: '#16262e',
    dark: '#34D399',
  },
  surface: {
    bg: '#242424',
    light: '#262626',
    muted: '#262626',
    card: '#1A1A1A',
    dark: '#171717',
    inputBg: '#262626',
  },
  text: { primary: '#FAFAFA', secondary: '#A3A3A3', tertiary: '#737373', medium: '#D4D4D4' },
  border: { light: '#383838', medium: '#525252' },
  error: { bg: '#7F1D1D', text: '#FF3333' },
  overlay: { modal: 'rgba(0,0,0,0.6)', loading: 'rgba(0,0,0,0.6)' },
  brandAccent: {
    light: '#1e2e36',
    DEFAULT: '#a3c4d6',
    deep: '#a3c4d6',
    foreground: '#16262e',
    gradFrom: '#b8d4e3',
    gradTo: '#a3c4d6',
  },
  warning: {
    light: '#451a03',
    amberLight: '#78350f',
    orangeLight: '#431407',
    amber: '#fbbf24',
    DEFAULT: '#f59e0b',
    amberText: '#fbbf24',
  },
  success: {
    lightest: '#052e16',
    lighter: '#064e3b',
    light: '#052e16',
    DEFAULT: '#2dd269',
    deep: '#16a34a',
    deepText: '#86efac',
  },
  danger: { light: '#7f1d1d', DEFAULT: '#ef4444', bright: '#fca5a5' },
  vip: { gold: '#FFD700', goldEnd: '#FFAA00' },
  gray: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    black: '#000',
  },
}

/** 按已解析主题返回对应 token 集 */
export function getRnTokens(theme: RnThemeMode): RnThemeTokens {
  return theme === 'dark' ? rnDarkTokens : rnLightTokens
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
