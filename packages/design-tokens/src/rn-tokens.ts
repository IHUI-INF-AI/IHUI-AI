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

/**
 * 通用玻璃底档(2026-10-16 立,底部菜单 TabBar 悬浮胶囊液态玻璃背景:半透明 + backdrop blur,
 * 下方内容若隐若现;明暗两档)。键名按 `scripts/sync-rn-tokens.mjs` 同名推导对位 tokens.css
 * `glass.bg` → `--color-glass-bg`。改值只能改 tokens.css。
 */
export type RnGlassTokens = {
  bg: string
}

/**
 * 模型广场类型徽章三色(明暗同值)。
 * 键名按 `scripts/sync-rn-tokens.mjs` 的同名推导规则对位 tokens.css,不加第二张映射表:
 * `modelType.textBg` → `--color-model-type-text-bg`。改色值只能改 tokens.css 再跑派生器。
 */
export type RnAgentNameTokens = {
  DEFAULT: string
}

export type RnModelTypeTokens = {
  text: string
  textBg: string
  image: string
  imageBg: string
  av: string
  avBg: string
}

/** RN 端基础 tokens(向后兼容 RootNavigator Tab Bar)
 *  2026-09-04 全量对齐 web 端 tokens.css(单一来源):中性色从 Tailwind 蓝灰阶
 *  (gray/slate)切换为 shadcn 中性灰;status DEFAULT 对齐 web 语义色。
 *  brand.DEFAULT = #000000 对齐 web 亮色 --color-primary(2026-07-24 用户要求消除绿色)。 */
export const rnTokens = {
  /* rn-tokens:managed —— 本表凡能由 tokens.css 推出的档,值由 scripts/sync-rn-tokens.mjs 原位写回(勿手改这些值);推不到的档属 RN 专属或源里无同名变量,仍是手抄 */
  brand: {
    DEFAULT: '#000000',
    /** 品牌底(brand.DEFAULT)之上的前景色。深色下 brand.DEFAULT 翻成白,前景必须翻黑,
     *  不得用 surface.light 代替(它在两态都是 #FFFFFF → 白底白字)。 */
    foreground: '#FFFFFF',
    dark: '#34D399',
    cta: '#000000',
    ctaForeground: '#FFFFFF',
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
  /* 通用玻璃底(TabBar 悬浮胶囊液态玻璃背景,半透明 + backdrop blur;明暗两档)——
     值由 scripts/sync-rn-tokens.mjs 从 tokens.css 派生(--color-glass-bg),勿手改 */
  glass: {
    bg: 'rgba(255,255,255,0.6)',
  } satisfies RnGlassTokens,
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
    light: '#fee2e2',
    DEFAULT: '#dc2626',
    bright: '#f87171',
  } satisfies RnDangerTokens,
  vip: {
    gold: '#FFD700',
    goldEnd: '#FFAA00',
  } satisfies RnVipTokens,
  /* 模型广场类型徽章(明暗同值)—— 值由 scripts/sync-rn-tokens.mjs 从 tokens.css 派生,勿手改 */
  modelType: {
    text: '#1888ee',
    textBg: '#e8f4fd',
    image: '#c41e7a',
    imageBg: '#fde8f5',
    av: '#2e7d32',
    avBg: '#e8f5e9',
  } satisfies RnModelTypeTokens,
  /* 智能体卡片名称链接色(对齐 --color-agent-name,明暗同值)—— 同上,派生态。
     必须是「命名空间 + DEFAULT」而不是顶层标量:mobile-rn 的 theme/active-tokens.ts 按命名空间
     浅拷与就地覆写(clonePalette / apply),顶层字符串会被摊成字符对象 ⇒ 运行时是不合法颜色。 */
  agentName: { DEFAULT: '#517bff' } satisfies RnAgentNameTokens,
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
  brand: {
    DEFAULT: string
    foreground: string
    dark: string
    /* CTA 实底档(2026-09-26 用户定稿,回翻):亮=纯黑底/纯白字,暗=纯白底/纯黑字,
     * 与 brand.DEFAULT 同一明暗行为(tokens.css 同步覆盖,.dark 显式翻面)。
     * 2026-09-24 的"明暗同值 #4A7A96"设计已废。
     * 对应 tokens.css @theme/.dark --color-cta / --color-cta-foreground(守门 93 已登记映射)。 */
    cta: string
    ctaForeground: string
  }
  /* 选中态档(2026-09-30 用户定稿,登录页分段控件三端收口):DEFAULT=被选中胶囊的底色,
   * foreground=其上的文字。亮=纯白底/近黑字,暗=纯黑底/近白字 —— 对应 tokens.css
   * @theme/.dark 的 --color-selection / --color-selection-foreground(值由
   * scripts/sync-rn-tokens.mjs 派生,勿手改)。
   * 必须是「命名空间 + DEFAULT/foreground」而不是两个顶层标量:mobile-rn 的
   * theme/active-tokens.ts 用 clonePalette 逐命名空间浅拷(`{ ...src[ns] }`),
   * 顶层字符串会被摊成字符对象 ⇒ 运行时是不合法颜色(与 agentName 同一条理由)。 */
  selection: { DEFAULT: string; foreground: string }
  surface: {
    bg: string
    light: string
    muted: string
    card: string
    dark: string
    inputBg: string
    chrome: string
  }
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
  /* 通用玻璃底(--color-glass-bg;明暗两档,派生自 tokens.css;TabBar 悬浮胶囊液态玻璃背景) */
  glass: RnGlassTokens
  warning: RnWarningTokens
  success: RnSuccessTokens
  danger: RnDangerTokens
  vip: RnVipTokens
  /* 模型广场类型徽章三色(--color-model-type-*;明暗同值,派生自 tokens.css) */
  modelType: RnModelTypeTokens
  /* 智能体卡片名称链接色(--color-agent-name;明暗同值,派生自 tokens.css)。
     形状取 { DEFAULT } 而非裸字符串,原因见 rnTokens 内同档注释(active-tokens 逐命名空间覆写)。 */
  agentName: RnAgentNameTokens
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
  /* rn-tokens:managed —— 本表凡能由 tokens.css 推出的档,值由 scripts/sync-rn-tokens.mjs 原位写回(勿手改这些值);推不到的档属 RN 专属或源里无同名变量,仍是手抄 */
  brand: {
    DEFAULT: '#000000',
    foreground: '#FFFFFF',
    dark: '#34D399',
    cta: '#000000',
    ctaForeground: '#FFFFFF',
  },
  /* 选中态档(亮):纯白底 + 近黑字。值派生自 tokens.css @theme --color-selection(-foreground)。 */
  selection: { DEFAULT: '#FFFFFF', foreground: '#0A0A0A' },
  surface: {
    bg: '#F5F5F5',
    light: '#FFFFFF',
    muted: '#EBEBEB',
    card: '#FFFFFF',
    dark: '#262626',
    inputBg: '#F5F5F5',
    chrome: '#FFFFFF',
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
  /* 值由 scripts/sync-rn-tokens.mjs 从 tokens.css 派生(--color-glass-bg),勿手改 */
  glass: {
    bg: 'rgba(255,255,255,0.6)',
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
  /* 值由 scripts/sync-rn-tokens.mjs 从 tokens.css 派生(--color-model-type-* / --color-agent-name),勿手改 */
  modelType: {
    text: '#1888ee',
    textBg: '#e8f4fd',
    image: '#c41e7a',
    imageBg: '#fde8f5',
    av: '#2e7d32',
    avBg: '#e8f5e9',
  },
  agentName: { DEFAULT: '#517bff' },
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
 */
/* CTA 独立档(2026-09-26 回翻):主按钮/选中胶囊一律 brand.cta + brand.ctaForeground 成对,
 * 即 web 的 --color-cta + --color-cta-foreground —— 暗色纯白底/黑字,与 brand.DEFAULT 同一明暗行为;
 * 要调观感就改 tokens.css 的 .dark --color-cta 一处,三端一起动。 */
export const rnDarkTokens: RnThemeTokens = {
  /* rn-tokens:managed —— 本表凡能由 tokens.css 推出的档,值由 scripts/sync-rn-tokens.mjs 原位写回(勿手改这些值);推不到的档属 RN 专属或源里无同名变量,仍是手抄 */
  brand: {
    DEFAULT: '#FFFFFF',
    foreground: '#000000',
    dark: '#34D399',
    cta: '#ffffff',
    ctaForeground: '#000000',
  },
  /* 选中态档(暗):纯黑底 + 近白字(2026-09-30 用户定稿,登录页分段控件三端收口)。
     值派生自 tokens.css .dark --color-selection(-foreground),不得在此另取一档。 */
  selection: { DEFAULT: '#000000', foreground: '#FAFAFA' },
  surface: {
    bg: '#242424',
    light: '#262626',
    muted: '#262626',
    card: '#1A1A1A',
    dark: '#171717',
    inputBg: '#262626',
    chrome: '#262626',
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
  /* 暗档值同样由 scripts/sync-rn-tokens.mjs 派生(tokens.css .dark 里成对声明) */
  glass: {
    bg: 'rgba(26,26,26,0.6)',
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
  /* 明暗同值档:暗档值同样由 scripts/sync-rn-tokens.mjs 派生(tokens.css .dark 里成对声明) */
  modelType: {
    text: '#1888ee',
    textBg: '#e8f4fd',
    image: '#c41e7a',
    imageBg: '#fde8f5',
    av: '#2e7d32',
    avBg: '#e8f5e9',
  },
  agentName: { DEFAULT: '#517bff' },
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

/* rn-tokens:derived-palette:begin —— 由 scripts/sync-rn-tokens.mjs 从 tokens.css 全量派生(勿手改;源改一处这里自动跟上) */

/** 源侧全量色档·亮档(RN 表里没有同名档的那些;键 = `--color-x-y` 去前缀后 camel 化) */
export const rnCssLight: Record<string, string> = {
  background: 'hsl(0 0% 96.1%)',
  foreground: 'hsl(0 0% 3.9%)',
  card: 'hsl(0 0% 100%)',
  cardForeground: 'hsl(0 0% 3.9%)',
  popover: 'hsl(0 0% 100%)',
  popoverForeground: 'hsl(0 0% 3.9%)',
  selectionForeground: 'hsl(0 0% 3.9%)',
  primary: 'hsl(0 0% 0%)',
  primaryForeground: 'hsl(0 0% 100%)',
  cta: 'hsl(0 0% 0%)',
  ctaForeground: 'hsl(0 0% 100%)',
  secondary: 'hsl(0 0% 96.1%)',
  secondaryForeground: 'hsl(0 0% 9%)',
  muted: 'hsl(0 0% 92%)',
  mutedForeground: 'hsl(0 0% 40%)',
  accent: 'hsl(0 0% 88%)',
  accentForeground: 'hsl(0 0% 9%)',
  destructive: 'hsl(0 100% 60%)',
  destructiveForeground: 'hsl(0 0% 98%)',
  input: 'hsl(0 0% 91%)',
  ring: 'hsl(0 0% 70%)',
  successForeground: 'hsl(0 0% 98%)',
  warningForeground: 'hsl(0 0% 98%)',
  info: 'hsl(199 89% 48%)',
  infoForeground: 'hsl(0 0% 98%)',
  brand50: 'hsl(240 5% 96%)',
  brand100: 'hsl(240 6% 90%)',
  brand200: 'hsl(240 5% 84%)',
  brand300: 'hsl(240 5% 65%)',
  brand400: 'hsl(240 5% 46%)',
  brand500: 'hsl(240 4% 36%)',
  brand600: 'hsl(240 5% 26%)',
  brand700: 'hsl(240 5% 21%)',
  brand800: 'hsl(240 6% 16%)',
  brand900: 'hsl(240 7% 11%)',
  sidebar: 'hsl(0 0% 96.1%)',
  sidebarForeground: 'hsl(0 0% 9%)',
  sidebarHover: 'hsl(218 14% 92%)',
  sidebarActive: 'hsl(222 13% 86%)',
  sidebarActiveHover: 'hsl(217 11% 80%)',
  sidebarItemHoverBg: 'hsl(0 0% 100%)',
  shellPanel: 'hsl(0 0% 100%)',
  tagInactiveBg: 'hsl(0 0% 88%)',
  pinnedTagBg: 'hsl(0 0% 88%)',
  streamedContainerBg: 'hsl(0 0% 92%)',
  streamedContainerBgHover: 'hsl(0 0% 88%)',
  floatIndicatorBg: 'hsl(0 0% 100%)',
  vipGoldStart: '#ffd700',
  vipGoldEnd: '#ffaa00',
  rankGold: '#ffd700',
  rankSilver: '#c0c0c0',
  rankBronze: '#cd7f32',
  link: '#4a7a96',
  linkBg: 'rgba(143, 184, 204, 0.15)',
  wechatGreen: '#4cd964',
  chatBubbleUser: '#95ec69',
  brandAccentForeground: '#1e3a47',
  brandAccentDeep: '#4a7a96',
  brandAccentGradFrom: '#b8d4e3',
  brandAccentGradTo: '#8fb8cc',
  notificationBg: '#fff8e1',
  notificationText: '#7c5e1e',
  gold: '#d4af6a',
  goldMuted: 'rgba(212, 175, 106, 0.12)',
  alipayBlue: '#1677ff',
  successTagBg: '#e8f5e9',
  scrim: 'rgba(0, 0, 0, 0.6)',
  scrimForeground: 'rgba(255, 255, 255, 0.85)',
  dangerForeground: '#ffffff',
  successTint: 'rgba(22, 163, 74, 0.08)',
  successTintStrong: 'rgba(22, 163, 74, 0.25)',
  warningTint: 'rgba(245, 158, 11, 0.1)',
  warningTintStrong: 'rgba(245, 158, 11, 0.25)',
  dangerTint: 'rgba(220, 38, 38, 0.08)',
  dangerTintStrong: 'rgba(220, 38, 38, 0.25)',
  infoTint: 'rgba(14, 165, 233, 0.08)',
  infoTintStrong: 'rgba(14, 165, 233, 0.25)',
  pinkTint: 'rgba(236, 72, 153, 0.3)',
  goldTint: 'rgba(255, 215, 0, 0.3)',
  vipGoldTint: 'rgba(255, 215, 0, 0.18)',
  brandAccentTint: 'rgba(143, 184, 204, 0.18)',
  brandAccentTintStrong: 'rgba(143, 184, 204, 0.4)',
  warmBg: '#fff4e6',
  textTertiary: '#a3a3a3',
  textMedium: '#404040',
  borderMedium: '#d4d4d4',
  brandAccentLight: '#eaf2f7',
  surfaceDark: '#262626',
  vipCard: '#262626',
  successDeepText: '#065f46',
  successLight: '#ecfdf5',
  warningAmberLight: '#fef3c7',
  warningAmberText: '#92400e',
  warningLight: '#fffbeb',
  dangerLight: '#fee2e2',
  dangerBright: '#f87171',
  successDeep: '#16a34a',
  successLighter: '#d1fae5',
  infoText: 'hsl(199 89% 33%)',
  successText: 'hsl(142 71% 28%)',
  warningText: 'hsl(38 92% 30%)',
  dangerText: '#b91c1c',
  black: '#000000',
  screenCanvas: '#171717',
  surfaceLight: '#ffffff',
  chrome: '#ffffff',
  warningAmber: '#f59e0b',
  trackActiveBg: 'rgba(248, 249, 252, 0.65)',
  modelTypeText: '#1888ee',
  modelTypeTextBg: '#e8f4fd',
  modelTypeImage: '#c41e7a',
  modelTypeImageBg: '#fde8f5',
  modelTypeAv: '#2e7d32',
  modelTypeAvBg: '#e8f5e9',
  glassBg: 'rgba(255, 255, 255, 0.6)',
  white2: 'rgba(255, 255, 255, 0.02)',
  white3: 'rgba(255, 255, 255, 0.03)',
  white4: 'rgba(255, 255, 255, 0.04)',
  white5: 'rgba(255, 255, 255, 0.05)',
  white6: 'rgba(255, 255, 255, 0.06)',
  white8: 'rgba(255, 255, 255, 0.08)',
  white10: 'rgba(255, 255, 255, 0.1)',
  white12: 'rgba(255, 255, 255, 0.12)',
  white14: 'rgba(255, 255, 255, 0.14)',
  white15: 'rgba(255, 255, 255, 0.15)',
  white18: 'rgba(255, 255, 255, 0.18)',
  white20: 'rgba(255, 255, 255, 0.2)',
  white30: 'rgba(255, 255, 255, 0.3)',
  white35: 'rgba(255, 255, 255, 0.35)',
  white40: 'rgba(255, 255, 255, 0.4)',
  white45: 'rgba(255, 255, 255, 0.45)',
  white50: 'rgba(255, 255, 255, 0.5)',
  white60: 'rgba(255, 255, 255, 0.6)',
  white70: 'rgba(255, 255, 255, 0.7)',
  white72: 'rgba(255, 255, 255, 0.72)',
  white75: 'rgba(255, 255, 255, 0.75)',
  white80: 'rgba(255, 255, 255, 0.8)',
  white85: 'rgba(255, 255, 255, 0.85)',
  white90: 'rgba(255, 255, 255, 0.9)',
  white95: 'rgba(255, 255, 255, 0.95)',
  white98: 'rgba(255, 255, 255, 0.98)',
  black2: 'rgba(0, 0, 0, 0.02)',
  black3: 'rgba(0, 0, 0, 0.03)',
  black4: 'rgba(0, 0, 0, 0.04)',
  black5: 'rgba(0, 0, 0, 0.05)',
  black6: 'rgba(0, 0, 0, 0.06)',
  black8: 'rgba(0, 0, 0, 0.08)',
  black10: 'rgba(0, 0, 0, 0.1)',
  black12: 'rgba(0, 0, 0, 0.12)',
  black15: 'rgba(0, 0, 0, 0.15)',
  black20: 'rgba(0, 0, 0, 0.2)',
  black25: 'rgba(0, 0, 0, 0.25)',
  black30: 'rgba(0, 0, 0, 0.3)',
  black35: 'rgba(0, 0, 0, 0.35)',
  black40: 'rgba(0, 0, 0, 0.4)',
  black45: 'rgba(0, 0, 0, 0.45)',
  black50: 'rgba(0, 0, 0, 0.5)',
  black60: 'rgba(0, 0, 0, 0.6)',
  black70: 'rgba(0, 0, 0, 0.7)',
  black75: 'rgba(0, 0, 0, 0.75)',
  black80: 'rgba(0, 0, 0, 0.8)',
  black85: 'rgba(0, 0, 0, 0.85)',
  black87: 'rgba(0, 0, 0, 0.87)',
  black90: 'rgba(0, 0, 0, 0.9)',
  black95: 'rgba(0, 0, 0, 0.95)',
  miniappGreenDark: '#06ad56',
  miniappGreenDarker: '#059a4c',
  miniappGreenDarkest: '#048040',
  miniappGreenForeground: '#ffffff',
  rankAvatarStart: '#6366f1',
  rankAvatarEnd: '#8b5cf6',
  rankTop1Bg: 'rgba(245, 158, 11, 0.04)',
  paymentPurpleStart: '#667eea',
  paymentPurpleEnd: '#764ba2',
}

/** 源侧全量色档·暗档(.dark 未覆盖的档按 cascade 落回亮值,与守门 93 同一口径) */
export const rnCssDark: Record<string, string> = {
  background: 'hsl(0 0% 14%)',
  foreground: 'hsl(0 0% 98%)',
  card: 'hsl(0 0% 10%)',
  cardForeground: 'hsl(0 0% 98%)',
  popover: 'hsl(0 0% 11%)',
  popoverForeground: 'hsl(0 0% 98%)',
  selectionForeground: 'hsl(0 0% 98%)',
  primary: 'hsl(0 0% 100%)',
  primaryForeground: 'hsl(0 0% 0%)',
  cta: 'hsl(0 0% 100%)',
  ctaForeground: 'hsl(0 0% 0%)',
  secondary: 'hsl(0 0% 14.9%)',
  secondaryForeground: 'hsl(0 0% 98%)',
  muted: 'hsl(0 0% 14.9%)',
  mutedForeground: 'hsl(0 0% 63.9%)',
  accent: 'hsl(0 0% 24%)',
  accentForeground: 'hsl(0 0% 98%)',
  destructive: 'hsl(0 100% 60%)',
  destructiveForeground: 'hsl(0 0% 98%)',
  input: 'hsl(0 0% 26%)',
  ring: 'hsl(0 0% 35%)',
  successForeground: 'hsl(0 0% 98%)',
  warningForeground: 'hsl(0 0% 98%)',
  info: 'hsl(199 80% 55%)',
  infoForeground: 'hsl(0 0% 98%)',
  brand50: 'hsl(240 5% 96%)',
  brand100: 'hsl(240 6% 90%)',
  brand200: 'hsl(240 5% 84%)',
  brand300: 'hsl(240 5% 65%)',
  brand400: 'hsl(240 5% 46%)',
  brand500: 'hsl(240 4% 36%)',
  brand600: 'hsl(240 5% 26%)',
  brand700: 'hsl(240 5% 21%)',
  brand800: 'hsl(240 6% 16%)',
  brand900: 'hsl(240 7% 11%)',
  sidebar: 'hsl(226 13% 19%)',
  sidebarForeground: 'hsl(0 0% 98%)',
  sidebarHover: 'hsl(222 14% 14%)',
  sidebarActive: 'hsl(228 21% 8%)',
  sidebarActiveHover: 'hsl(0 0% 0%)',
  sidebarItemHoverBg: 'hsl(0 0% 0%)',
  shellPanel: 'hsl(220 12% 5%)',
  tagInactiveBg: 'hsl(0 0% 24%)',
  pinnedTagBg: 'hsl(0 0% 24%)',
  streamedContainerBg: 'hsl(0 0% 18%)',
  streamedContainerBgHover: 'hsl(0 0% 22%)',
  floatIndicatorBg: 'hsl(0 0% 11%)',
  vipGoldStart: '#ffd700',
  vipGoldEnd: '#ffaa00',
  rankGold: '#ffd700',
  rankSilver: '#c0c0c0',
  rankBronze: '#cd7f32',
  link: '#a3c4d6',
  linkBg: 'rgba(163, 196, 214, 0.14)',
  wechatGreen: '#4cd964',
  chatBubbleUser: '#4cd964',
  brandAccentForeground: '#16262e',
  brandAccentDeep: '#a3c4d6',
  brandAccentGradFrom: '#b8d4e3',
  brandAccentGradTo: '#a3c4d6',
  notificationBg: 'rgba(245, 158, 11, 0.15)',
  notificationText: 'hsl(38 85% 70%)',
  gold: '#e6c986',
  goldMuted: 'rgba(230, 201, 134, 0.14)',
  alipayBlue: '#1677ff',
  successTagBg: 'rgba(22, 163, 74, 0.16)',
  scrim: 'rgba(0, 0, 0, 0.6)',
  scrimForeground: 'rgba(255, 255, 255, 0.85)',
  dangerForeground: '#ffffff',
  successTint: 'rgba(74, 222, 128, 0.14)',
  successTintStrong: 'rgba(74, 222, 128, 0.3)',
  warningTint: 'rgba(250, 204, 21, 0.14)',
  warningTintStrong: 'rgba(250, 204, 21, 0.3)',
  dangerTint: 'rgba(248, 113, 113, 0.14)',
  dangerTintStrong: 'rgba(248, 113, 113, 0.3)',
  infoTint: 'rgba(96, 165, 250, 0.14)',
  infoTintStrong: 'rgba(96, 165, 250, 0.3)',
  pinkTint: 'rgba(244, 114, 182, 0.34)',
  goldTint: 'rgba(230, 201, 134, 0.3)',
  vipGoldTint: 'rgba(255, 215, 0, 0.18)',
  brandAccentTint: 'rgba(163, 196, 214, 0.16)',
  brandAccentTintStrong: 'rgba(163, 196, 214, 0.32)',
  warmBg: 'rgba(250, 204, 21, 0.14)',
  textTertiary: '#737373',
  textMedium: '#d4d4d4',
  borderMedium: '#525252',
  brandAccentLight: '#1e2e36',
  surfaceDark: '#171717',
  vipCard: '#262626',
  successDeepText: '#86efac',
  successLight: '#052e16',
  warningAmberLight: '#78350f',
  warningAmberText: '#fbbf24',
  warningLight: '#451a03',
  dangerLight: '#7f1d1d',
  dangerBright: '#ef4444',
  successDeep: '#16a34a',
  successLighter: '#064e3b',
  infoText: 'hsl(199 80% 55%)',
  successText: 'hsl(142 65% 50%)',
  warningText: 'hsl(38 85% 55%)',
  dangerText: '#f87171',
  black: '#000000',
  screenCanvas: '#171717',
  surfaceLight: '#ffffff',
  chrome: '#262626',
  warningAmber: '#fbbf24',
  trackActiveBg: 'rgba(248, 249, 252, 0.65)',
  modelTypeText: '#1888ee',
  modelTypeTextBg: '#e8f4fd',
  modelTypeImage: '#c41e7a',
  modelTypeImageBg: '#fde8f5',
  modelTypeAv: '#2e7d32',
  modelTypeAvBg: '#e8f5e9',
  glassBg: 'rgba(26, 26, 26, 0.6)',
  white2: 'rgba(255, 255, 255, 0.02)',
  white3: 'rgba(255, 255, 255, 0.03)',
  white4: 'rgba(255, 255, 255, 0.04)',
  white5: 'rgba(255, 255, 255, 0.05)',
  white6: 'rgba(255, 255, 255, 0.06)',
  white8: 'rgba(255, 255, 255, 0.08)',
  white10: 'rgba(255, 255, 255, 0.1)',
  white12: 'rgba(255, 255, 255, 0.12)',
  white14: 'rgba(255, 255, 255, 0.14)',
  white15: 'rgba(255, 255, 255, 0.15)',
  white18: 'rgba(255, 255, 255, 0.18)',
  white20: 'rgba(255, 255, 255, 0.2)',
  white30: 'rgba(255, 255, 255, 0.3)',
  white35: 'rgba(255, 255, 255, 0.35)',
  white40: 'rgba(255, 255, 255, 0.4)',
  white45: 'rgba(255, 255, 255, 0.45)',
  white50: 'rgba(255, 255, 255, 0.5)',
  white60: 'rgba(255, 255, 255, 0.6)',
  white70: 'rgba(255, 255, 255, 0.7)',
  white72: 'rgba(255, 255, 255, 0.72)',
  white75: 'rgba(255, 255, 255, 0.75)',
  white80: 'rgba(255, 255, 255, 0.8)',
  white85: 'rgba(255, 255, 255, 0.85)',
  white90: 'rgba(255, 255, 255, 0.9)',
  white95: 'rgba(255, 255, 255, 0.95)',
  white98: 'rgba(255, 255, 255, 0.98)',
  black2: 'rgba(0, 0, 0, 0.02)',
  black3: 'rgba(0, 0, 0, 0.03)',
  black4: 'rgba(0, 0, 0, 0.04)',
  black5: 'rgba(0, 0, 0, 0.05)',
  black6: 'rgba(0, 0, 0, 0.06)',
  black8: 'rgba(0, 0, 0, 0.08)',
  black10: 'rgba(0, 0, 0, 0.1)',
  black12: 'rgba(0, 0, 0, 0.12)',
  black15: 'rgba(0, 0, 0, 0.15)',
  black20: 'rgba(0, 0, 0, 0.2)',
  black25: 'rgba(0, 0, 0, 0.25)',
  black30: 'rgba(0, 0, 0, 0.3)',
  black35: 'rgba(0, 0, 0, 0.35)',
  black40: 'rgba(0, 0, 0, 0.4)',
  black45: 'rgba(0, 0, 0, 0.45)',
  black50: 'rgba(0, 0, 0, 0.5)',
  black60: 'rgba(0, 0, 0, 0.6)',
  black70: 'rgba(0, 0, 0, 0.7)',
  black75: 'rgba(0, 0, 0, 0.75)',
  black80: 'rgba(0, 0, 0, 0.8)',
  black85: 'rgba(0, 0, 0, 0.85)',
  black87: 'rgba(0, 0, 0, 0.87)',
  black90: 'rgba(0, 0, 0, 0.9)',
  black95: 'rgba(0, 0, 0, 0.95)',
  miniappGreenDark: '#06ad56',
  miniappGreenDarker: '#059a4c',
  miniappGreenDarkest: '#048040',
  miniappGreenForeground: '#ffffff',
  rankAvatarStart: '#6366f1',
  rankAvatarEnd: '#8b5cf6',
  rankTop1Bg: 'rgba(245, 158, 11, 0.04)',
  paymentPurpleStart: '#667eea',
  paymentPurpleEnd: '#764ba2',
}

/**
 * 按主题取源档。屏内取色的正确写法是 `rnCssColor(themeMode, 'black50')`,不是 `'rgba(0,0,0,0.5)'` ——
 * 后者在 tokens.css 改值后**不会**跟着变,而前者会(且明暗自动翻面)。
 */
export function rnCssColor(theme: RnThemeMode, key: string): string {
  const table = theme === 'dark' ? rnCssDark : rnCssLight
  const value = table[key]
  if (value === undefined)
    throw new Error(`rnCssColor:源里没有 ${key} 档(派生块落后?跑 sync-rn-tokens)`)
  return value
}

/* rn-tokens:derived-palette:end */

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
