/**
 * Token 注册表 — design-tokens 单一真相源的元数据层(P3-1.1 立,2026-08-01)。
 *
 * 作用:
 * - 枚举所有 design token 的名称 + 类型 + 默认值,供 TS 代码类型安全引用
 * - 提供 validateTokenConsistency / listMissingTokens 工具函数,供守门脚本 + CI 使用
 * - 与 tokens.css 互为校验:tokens.css 是值的真相源,本文件是名称 + 类型的真相源
 *
 * 修改 token 流程(强制):
 * 1. 改 packages/design-tokens/src/styles/tokens.css(值的真相源)
 * 2. 同步更新本文件 TOKEN_REGISTRY(名称 + 类型 + 默认值)
 * 3. 跑 pnpm check:design-tokens 验证三端一致
 *
 * Token 单一真相源 - 修改此处后跑 pnpm check:design-tokens 验证三端一致
 */

// ─── 类型定义 ──────────────────────────────────────────────────────────

/** Token 语义类别,对应 CSS 变量前缀族。 */
export type TokenType =
  | 'color'
  | 'radius'
  | 'font'
  | 'animation'
  | 'breakpoint'
  | 'z-index'
  | 'shadow'
  | 'chart'
  | 'opacity'
  | 'layout'
  | 'easing'
  | 'gradient'
  | 'vcenter'
  | 'semantic'

/** 单个 token 元数据条目。 */
export interface TokenEntry {
  /** CSS 变量名,如 '--color-primary' */
  readonly name: string
  /** token 类别 */
  readonly type: TokenType
  /** 默认值(亮色 / @theme 块中的值) */
  readonly defaultValue: string
  /** 可选说明 */
  readonly description?: string
}

/** token 一致性校验结果。 */
export interface ConsistencyResult {
  /** 是否完全一致(RN 是 CSS 的值匹配子集 + 无缺失) */
  readonly consistent: boolean
  /** RN 中存在但 CSS 真相源中缺失的 token 名(RN 超集 = 错误) */
  readonly missingInCss: ReadonlyArray<string>
  /** 双端都存在但值不一致的 token */
  readonly valueMismatches: ReadonlyArray<{
    readonly name: string
    readonly cssValue: string
    readonly rnValue: string
  }>
}

// ─── 注册表 ──────────────────────────────────────────────────────────

/** 语义色 token(亮色 shadcn/ui 色板,跨端共用)。 */
const SEMANTIC_COLOR_ENTRIES: ReadonlyArray<TokenEntry> = [
  { name: '--color-background', type: 'color', defaultValue: 'hsl(0 0% 96.1%)' },
  { name: '--color-foreground', type: 'color', defaultValue: 'hsl(0 0% 3.9%)' },
  { name: '--color-card', type: 'color', defaultValue: 'hsl(0 0% 100%)' },
  { name: '--color-card-foreground', type: 'color', defaultValue: 'hsl(0 0% 3.9%)' },
  { name: '--color-popover', type: 'color', defaultValue: 'hsl(0 0% 100%)' },
  { name: '--color-popover-foreground', type: 'color', defaultValue: 'hsl(0 0% 3.9%)' },
  { name: '--color-primary', type: 'color', defaultValue: 'hsl(0 0% 0%)', description: '亮色纯黑底' },
  { name: '--color-primary-foreground', type: 'color', defaultValue: 'hsl(0 0% 100%)' },
  { name: '--color-secondary', type: 'color', defaultValue: 'hsl(0 0% 96.1%)' },
  { name: '--color-secondary-foreground', type: 'color', defaultValue: 'hsl(0 0% 9%)' },
  { name: '--color-muted', type: 'color', defaultValue: 'hsl(0 0% 92%)' },
  { name: '--color-muted-foreground', type: 'color', defaultValue: 'hsl(0 0% 40%)' },
  { name: '--color-accent', type: 'color', defaultValue: 'hsl(0 0% 88%)' },
  { name: '--color-accent-foreground', type: 'color', defaultValue: 'hsl(0 0% 9%)' },
  { name: '--color-destructive', type: 'color', defaultValue: 'hsl(0 100% 60%)' },
  { name: '--color-destructive-foreground', type: 'color', defaultValue: 'hsl(0 0% 98%)' },
  { name: '--color-border', type: 'color', defaultValue: 'hsl(0 0% 89.8%)' },
  { name: '--color-input', type: 'color', defaultValue: 'hsl(0 0% 91%)' },
  { name: '--color-ring', type: 'color', defaultValue: 'hsl(0 0% 70%)' },
  { name: '--color-success', type: 'color', defaultValue: 'hsl(142 71% 45%)' },
  { name: '--color-success-foreground', type: 'color', defaultValue: 'hsl(0 0% 98%)' },
  { name: '--color-warning', type: 'color', defaultValue: 'hsl(38 92% 50%)' },
  { name: '--color-warning-foreground', type: 'color', defaultValue: 'hsl(0 0% 98%)' },
  { name: '--color-info', type: 'color', defaultValue: 'hsl(199 89% 48%)' },
  { name: '--color-info-foreground', type: 'color', defaultValue: 'hsl(0 0% 98%)' },
]

/** sidebar 色 token(web 独占,miniapp-taro / mobile-rn 不复制)。 */
const SIDEBAR_COLOR_ENTRIES: ReadonlyArray<TokenEntry> = [
  { name: '--color-sidebar', type: 'color', defaultValue: 'hsl(0 0% 96.1%)' },
  { name: '--color-sidebar-foreground', type: 'color', defaultValue: 'hsl(0 0% 9%)' },
  { name: '--color-sidebar-hover', type: 'color', defaultValue: 'hsl(218 14% 92%)' },
  { name: '--color-sidebar-active', type: 'color', defaultValue: 'hsl(222 13% 86%)' },
  { name: '--color-sidebar-active-hover', type: 'color', defaultValue: 'hsl(217 11% 80%)' },
  { name: '--color-sidebar-item-hover-bg', type: 'color', defaultValue: 'hsl(0 0% 100%)' },
  { name: '--color-shell-panel', type: 'color', defaultValue: 'hsl(0 0% 100%)' },
]

/** brand 色阶 token(web 独占)。 */
const BRAND_COLOR_ENTRIES: ReadonlyArray<TokenEntry> = [
  { name: '--color-brand-50', type: 'color', defaultValue: 'hsl(240 5% 96%)' },
  { name: '--color-brand-100', type: 'color', defaultValue: 'hsl(240 6% 90%)' },
  { name: '--color-brand-200', type: 'color', defaultValue: 'hsl(240 5% 84%)' },
  { name: '--color-brand-300', type: 'color', defaultValue: 'hsl(240 5% 65%)' },
  { name: '--color-brand-400', type: 'color', defaultValue: 'hsl(240 5% 46%)' },
  { name: '--color-brand-500', type: 'color', defaultValue: 'hsl(240 4% 36%)' },
  { name: '--color-brand-600', type: 'color', defaultValue: 'hsl(240 5% 26%)' },
  { name: '--color-brand-700', type: 'color', defaultValue: 'hsl(240 5% 21%)' },
  { name: '--color-brand-800', type: 'color', defaultValue: 'hsl(240 6% 16%)' },
  { name: '--color-brand-900', type: 'color', defaultValue: 'hsl(240 7% 11%)' },
]

/** 跨端扩展语义色(2026-07-29 上提自 miniapp-taro,8 端共享)。 */
const EXTENDED_COLOR_ENTRIES: ReadonlyArray<TokenEntry> = [
  { name: '--color-link', type: 'color', defaultValue: '#1888ee' },
  { name: '--color-link-bg', type: 'color', defaultValue: '#f0f7ff' },
  { name: '--color-wechat-green', type: 'color', defaultValue: '#4cd964' },
  { name: '--color-chat-bubble-user', type: 'color', defaultValue: '#95ec69' },
  { name: '--color-brand-orange', type: 'color', defaultValue: '#ff6b35' },
  { name: '--color-brand', type: 'color', defaultValue: '#6366f1' },
  { name: '--color-notification-bg', type: 'color', defaultValue: '#fff8e1' },
  { name: '--color-notification-text', type: 'color', defaultValue: '#7c5e1e' },
]

/** 业务品牌色 token。 */
const BUSINESS_COLOR_ENTRIES: ReadonlyArray<TokenEntry> = [
  { name: '--color-vip-gold-start', type: 'color', defaultValue: '#ffd700' },
  { name: '--color-vip-gold-end', type: 'color', defaultValue: '#ffaa00' },
  { name: '--color-rank-gold', type: 'color', defaultValue: '#ffd700' },
  { name: '--color-rank-silver', type: 'color', defaultValue: '#c0c0c0' },
  { name: '--color-rank-bronze', type: 'color', defaultValue: '#cd7f32' },
  { name: '--color-miniapp-green', type: 'gradient', defaultValue: 'linear-gradient(135deg, #07c160, #06ad56)' },
  { name: '--color-miniapp-green-dark', type: 'color', defaultValue: '#06ad56' },
  { name: '--color-miniapp-green-darker', type: 'color', defaultValue: '#059a4c' },
  { name: '--color-miniapp-green-darkest', type: 'color', defaultValue: '#048040' },
  { name: '--color-rank-avatar-start', type: 'color', defaultValue: '#6366f1' },
  { name: '--color-rank-avatar-end', type: 'color', defaultValue: '#8b5cf6' },
  { name: '--color-rank-top1-bg', type: 'color', defaultValue: 'rgba(245, 158, 11, 0.04)' },
  { name: '--color-payment-purple-start', type: 'color', defaultValue: '#667eea' },
  { name: '--color-payment-purple-end', type: 'color', defaultValue: '#764ba2' },
]

/** 圆角 token(5 档,跨端共享,AGENTS.md §4 禁止 rounded-full)。 */
const RADIUS_ENTRIES: ReadonlyArray<TokenEntry> = [
  { name: '--radius', type: 'radius', defaultValue: '0.5rem' },
  { name: '--radius-sm', type: 'radius', defaultValue: '0.25rem' },
  { name: '--radius-md', type: 'radius', defaultValue: '0.375rem' },
  { name: '--radius-lg', type: 'radius', defaultValue: '0.5rem' },
  { name: '--radius-xl', type: 'radius', defaultValue: '0.75rem' },
  { name: '--radius-2xl', type: 'radius', defaultValue: '1rem' },
]

/** 字体 token(web 独占,miniapp-taro / mobile-rn 用系统字体)。 */
const FONT_ENTRIES: ReadonlyArray<TokenEntry> = [
  { name: '--font-sans', type: 'font', defaultValue: "'HarmonyOS Sans SC', ui-sans-serif, system-ui, sans-serif" },
  { name: '--font-sans-sc', type: 'font', defaultValue: "'HarmonyOS Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif" },
]

/** 动画 token(web 独占)。 */
const ANIMATION_ENTRIES: ReadonlyArray<TokenEntry> = [
  { name: '--animate-ripple', type: 'animation', defaultValue: 'ripple 0.6s ease-out' },
  { name: '--animate-success-bounce', type: 'animation', defaultValue: 'success-bounce 0.4s ease' },
  { name: '--animate-error-shake', type: 'animation', defaultValue: 'error-shake 0.4s ease' },
  { name: '--animate-fade-in', type: 'animation', defaultValue: 'fade-in 0.3s ease' },
  { name: '--animate-slide-up', type: 'animation', defaultValue: 'slide-up 0.3s ease' },
  { name: '--animate-scale-in', type: 'animation', defaultValue: 'scale-in 0.2s ease' },
]

/** 响应式断点 token(web 独占,10 档)。 */
const BREAKPOINT_ENTRIES: ReadonlyArray<TokenEntry> = [
  { name: '--breakpoint-xs', type: 'breakpoint', defaultValue: '320px' },
  { name: '--breakpoint-sm', type: 'breakpoint', defaultValue: '375px' },
  { name: '--breakpoint-md', type: 'breakpoint', defaultValue: '428px' },
  { name: '--breakpoint-lg', type: 'breakpoint', defaultValue: '576px' },
  { name: '--breakpoint-tablet', type: 'breakpoint', defaultValue: '768px' },
  { name: '--breakpoint-tablet-lg', type: 'breakpoint', defaultValue: '1024px' },
  { name: '--breakpoint-laptop', type: 'breakpoint', defaultValue: '1280px' },
  { name: '--breakpoint-desktop', type: 'breakpoint', defaultValue: '1440px' },
  { name: '--breakpoint-xl', type: 'breakpoint', defaultValue: '1920px' },
  { name: '--breakpoint-2xl', type: 'breakpoint', defaultValue: '2560px' },
]

/** z-index 层级 token(跨端共享,防 TRAE 注入覆盖)。 */
const Z_INDEX_ENTRIES: ReadonlyArray<TokenEntry> = [
  { name: '--z-base', type: 'z-index', defaultValue: '1' },
  { name: '--z-0', type: 'z-index', defaultValue: '0' },
  { name: '--z-header', type: 'z-index', defaultValue: '100' },
  { name: '--z-sticky', type: 'z-index', defaultValue: '990' },
  { name: '--z-dropdown', type: 'z-index', defaultValue: '1000' },
  { name: '--z-overlay', type: 'z-index', defaultValue: '1000' },
  { name: '--z-modal', type: 'z-index', defaultValue: '2000' },
  { name: '--z-popover', type: 'z-index', defaultValue: '2001' },
  { name: '--z-notification', type: 'z-index', defaultValue: '9999' },
  { name: '--z-loading', type: 'z-index', defaultValue: '10000' },
  { name: '--z-max', type: 'z-index', defaultValue: '10003' },
]

/** 全局投影 token(跨端共享)。 */
const SHADOW_ENTRIES: ReadonlyArray<TokenEntry> = [
  { name: '--global-box-shadow', type: 'shadow', defaultValue: '0 2px 8px var(--color-black-6)' },
  { name: '--shadow-premium-sm', type: 'shadow', defaultValue: '0 2px 8px var(--color-black-6)' },
  { name: '--shadow-premium', type: 'shadow', defaultValue: '0 2px 8px var(--color-black-6)' },
  { name: '--shadow-premium-lg', type: 'shadow', defaultValue: '0 2px 8px var(--color-black-6)' },
  { name: '--shadow-premium-xl', type: 'shadow', defaultValue: '0 2px 8px var(--color-black-6)' },
  { name: '--shadow-premium-hover', type: 'shadow', defaultValue: '0 2px 8px var(--color-black-6)' },
]

/** 图表色板 token(8 主色 + 文字/轴线/成功色,跨端共享)。 */
const CHART_ENTRIES: ReadonlyArray<TokenEntry> = [
  { name: '--chart-1', type: 'chart', defaultValue: '#3b82f6' },
  { name: '--chart-2', type: 'chart', defaultValue: '#10b981' },
  { name: '--chart-3', type: 'chart', defaultValue: '#f59e0b' },
  { name: '--chart-4', type: 'chart', defaultValue: '#ef4444' },
  { name: '--chart-5', type: 'chart', defaultValue: '#8b5cf6' },
  { name: '--chart-6', type: 'chart', defaultValue: '#ec4899' },
  { name: '--chart-7', type: 'chart', defaultValue: '#06b6d4' },
  { name: '--chart-8', type: 'chart', defaultValue: '#84cc16' },
  { name: '--chart-text', type: 'chart', defaultValue: '#94a3b8' },
  { name: '--chart-axis', type: 'chart', defaultValue: '#e5e7eb' },
  { name: '--chart-success', type: 'chart', defaultValue: '#16a34a' },
]

/** 中文字体垂直对齐偏移 token(AGENTS.md §4 硬约束)。 */
const VCENTER_ENTRIES: ReadonlyArray<TokenEntry> = [
  { name: '--text-vcenter-offset', type: 'vcenter', defaultValue: '0.3px', description: '14px 字号 icon+中文同行偏移' },
]

/** 布局 token(web 独占,sidebar / header / 全局尺寸)。 */
const LAYOUT_ENTRIES: ReadonlyArray<TokenEntry> = [
  { name: '--global-border-radius', type: 'layout', defaultValue: '8px' },
  { name: '--global-header-height', type: 'layout', defaultValue: '60px' },
  { name: '--sidebar-width', type: 'layout', defaultValue: '130px' },
  { name: '--sidebar-collapsed-width', type: 'layout', defaultValue: '54px' },
  { name: '--sidebar-menu-height', type: 'layout', defaultValue: '24px' },
  { name: '--sidebar-indent-1', type: 'layout', defaultValue: '20px' },
  { name: '--sidebar-indent-2', type: 'layout', defaultValue: '40px' },
  { name: '--sidebar-dark-bg', type: 'layout', defaultValue: '#2a2a2a' },
  { name: '--sidebar-light-bg', type: 'layout', defaultValue: '#ffffff' },
]

/** 缓动函数 token(跨端共享,Premium 动画)。 */
const EASING_ENTRIES: ReadonlyArray<TokenEntry> = [
  { name: '--ease-premium', type: 'easing', defaultValue: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  { name: '--ease-premium-in', type: 'easing', defaultValue: 'cubic-bezier(0.4, 0, 1, 1)' },
  { name: '--ease-premium-out', type: 'easing', defaultValue: 'cubic-bezier(0, 0, 0.2, 1)' },
  { name: '--ease-premium-bounce', type: 'easing', defaultValue: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
]

/** 装饰性渐变 token(web 独占)。 */
const GRADIENT_ENTRIES: ReadonlyArray<TokenEntry> = [
  { name: '--color-gradient-purple-yellow', type: 'gradient', defaultValue: 'linear-gradient(112deg, rgba(205,208,255,0.7) 0%, rgba(253,255,225,0.7) 100%)' },
  { name: '--color-gradient-purple-deep', type: 'gradient', defaultValue: 'linear-gradient(269deg, rgba(217,219,254,0.8) 219%, rgba(144,125,255,0.8) 219%)' },
  { name: '--color-gradient-white-blue', type: 'gradient', defaultValue: 'linear-gradient(0deg, rgba(255,255,255,1) 1%, rgba(77,180,232,1) 77%)' },
  { name: '--color-gradient-card-left', type: 'gradient', defaultValue: 'linear-gradient(116deg, rgba(217,219,255,0.8) 3%, rgba(253,255,220,0.8) 104%)' },
  { name: '--color-gradient-card-right', type: 'gradient', defaultValue: 'linear-gradient(116deg, rgba(0,0,0,0.8) 3%, rgba(0,109,11,0.8) 104%)' },
  { name: '--color-gradient-group', type: 'gradient', defaultValue: 'linear-gradient(106deg, rgba(228,229,255,0.25) 4%, rgba(254,255,236,0.25) 104%)' },
]

/** 智能圆角 token(web 独占,统一引用 --global-border-radius)。 */
const SMART_RADIUS_ENTRIES: ReadonlyArray<TokenEntry> = [
  { name: '--smart-radius-small', type: 'radius', defaultValue: 'var(--global-border-radius)' },
  { name: '--smart-radius-medium', type: 'radius', defaultValue: 'var(--global-border-radius)' },
  { name: '--smart-radius-large', type: 'radius', defaultValue: 'var(--global-border-radius)' },
  { name: '--smart-radius-xl', type: 'radius', defaultValue: 'var(--global-border-radius)' },
]

// ─── 透明度色板(50 档,程序化生成避免手抄) ──────────────────────────

/** 白色透明度档位(26 档,忠实保留源文件间隔)。 */
const WHITE_OPACITY_STEPS: ReadonlyArray<number> = [
  2, 3, 4, 5, 6, 8, 10, 12, 14, 15, 18, 20, 30, 35, 40, 45, 50, 60, 70, 72, 75, 80, 85, 90, 95, 98,
]

/** 黑色透明度档位(24 档,忠实保留源文件间隔)。 */
const BLACK_OPACITY_STEPS: ReadonlyArray<number> = [
  2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 45, 50, 60, 70, 75, 80, 85, 87, 90, 95,
]

/** 从档位数组生成 opacity token 条目。 */
function buildOpacityEntries(
  steps: ReadonlyArray<number>,
  prefix: 'white' | 'black',
  rgb: readonly [number, number, number],
): ReadonlyArray<TokenEntry> {
  return steps.map((step) => {
    const alpha = (step / 100).toFixed(2)
    return {
      name: `--color-${prefix}-${step}`,
      type: 'opacity' as const,
      defaultValue: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`,
    }
  })
}

const WHITE_OPACITY_ENTRIES: ReadonlyArray<TokenEntry> = buildOpacityEntries(
  WHITE_OPACITY_STEPS,
  'white',
  [255, 255, 255],
)

const BLACK_OPACITY_ENTRIES: ReadonlyArray<TokenEntry> = buildOpacityEntries(
  BLACK_OPACITY_STEPS,
  'black',
  [0, 0, 0],
)

// ─── 合并注册表 ──────────────────────────────────────────────────────

/** 所有 token 类别数组,用于合并为最终注册表。 */
const ALL_TOKEN_GROUPS: ReadonlyArray<ReadonlyArray<TokenEntry>> = [
  SEMANTIC_COLOR_ENTRIES,
  SIDEBAR_COLOR_ENTRIES,
  BRAND_COLOR_ENTRIES,
  EXTENDED_COLOR_ENTRIES,
  BUSINESS_COLOR_ENTRIES,
  RADIUS_ENTRIES,
  FONT_ENTRIES,
  ANIMATION_ENTRIES,
  BREAKPOINT_ENTRIES,
  Z_INDEX_ENTRIES,
  SHADOW_ENTRIES,
  CHART_ENTRIES,
  VCENTER_ENTRIES,
  LAYOUT_ENTRIES,
  EASING_ENTRIES,
  GRADIENT_ENTRIES,
  SMART_RADIUS_ENTRIES,
  WHITE_OPACITY_ENTRIES,
  BLACK_OPACITY_ENTRIES,
]

/**
 * TOKEN_REGISTRY — design token 单一真相源注册表。
 *
 * 键 = CSS 变量名,值 = TokenEntry(类型 + 默认值)。
 * 默认值取自 tokens.css @theme 块(亮色),暗色覆盖值见 tokens.css .dark 块。
 */
export const TOKEN_REGISTRY: Readonly<Record<string, TokenEntry>> = Object.fromEntries(
  ALL_TOKEN_GROUPS.flat().map((entry) => [entry.name, entry]),
)

/** 注册表中所有 token 名称列表(按定义顺序)。 */
export const TOKEN_NAMES: ReadonlyArray<string> = ALL_TOKEN_GROUPS.flat().map((e) => e.name)

/** 注册表中 token 总数。 */
export const TOKEN_COUNT: number = TOKEN_NAMES.length

// ─── 工具函数 ──────────────────────────────────────────────────────────

/** CSS 变量声明正则(--xxx: value;)。 */
const CSS_VAR_RE = /(--[\w-]+)\s*:\s*([^;]+);/g

/**
 * 从 CSS 文本中提取所有变量声明(去注释)。
 * @param content CSS 文本
 * @returns Map<变量名, 值>
 */
export function extractCssVars(content: string): Map<string, string> {
  // 先剥离块注释,避免注释中的伪变量声明被误匹配
  const clean = content.replace(/\/\*[\s\S]*?\*\//g, '')
  const vars = new Map<string, string>()
  const re = new RegExp(CSS_VAR_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(clean)) !== null) {
    // noUncheckedIndexedAccess: m[1]/m[2] 可能为 undefined,需显式守卫
    const name = m[1]
    const value = m[2]
    if (name !== undefined && value !== undefined) {
      vars.set(name, value.trim())
    }
  }
  return vars
}

/**
 * 列出 CSS 内容中缺失的注册表 token。
 *
 * 用途:守门脚本校验目标端 CSS 是否遗漏了应定义的 token。
 * 注意:部分 token(web 独占的 breakpoint / font / animation 等)在 RN / miniapp-taro
 * 中缺失是正常的,调用方应按端过滤结果。
 *
 * @param cssContent 目标端 CSS 文本
 * @returns 缺失的 token 名称列表(按注册表顺序)
 */
export function listMissingTokens(cssContent: string): string[] {
  const defined = extractCssVars(cssContent)
  return TOKEN_NAMES.filter((name) => !defined.has(name))
}

/**
 * 校验 web CSS 真相源与 RN CSS 副本的 token 一致性。
 *
 * 校验逻辑:
 * 1. RN 中存在的 token 必须在 CSS 真相源中也存在(RN 是子集)
 * 2. 双端都存在的 token 值必须严格一致
 *
 * @param cssContent web tokens.css 内容(真相源)
 * @param rnContent mobile-rn/global.css 内容(副本)
 * @returns 一致性校验结果
 */
export function validateTokenConsistency(
  cssContent: string,
  rnContent: string,
): ConsistencyResult {
  const cssVars = extractCssVars(cssContent)
  const rnVars = extractCssVars(rnContent)

  const missingInCss: string[] = []
  const valueMismatches: Array<{ name: string; cssValue: string; rnValue: string }> = []

  for (const [name, rnValue] of rnVars) {
    const cssValue = cssVars.get(name)
    if (cssValue === undefined) {
      missingInCss.push(name)
    } else if (cssValue !== rnValue) {
      valueMismatches.push({ name, cssValue, rnValue })
    }
  }

  return {
    consistent: missingInCss.length === 0 && valueMismatches.length === 0,
    missingInCss,
    valueMismatches,
  }
}
