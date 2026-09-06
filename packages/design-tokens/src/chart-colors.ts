// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​​‌​‌‌​‌‍​‍​​‍​​​‍​‌​‌‌​​​‌​‌​​​​‍​​​​‍​​​‌‌​‌‌​‌‍​‌​‌‌​​‌​​​‍‌​‌​​‌‌​‌​​​‌‌​‍​​‍​‍‌​‌‌​‌‌​‌​‍​​​‌‌‌‍​​‌‌​‌​‌​​​‍‌‌​‌‌‌​‌‌​​‌​‌‌‍​‌​​‌‌​​‌‌​​‍​‌‌‌‌​​‍​‌​‌‌​‌​‌​‌‌​​‌‍​‌​​​​‌‌‍​‌​​‌​​​‍​‌​‌‌‌‌‍​‌​‌​‌‌‍​‌​‍​‌‌​‌‍‌​‌​‌‌‌​‌‍​‌‌​​‍​‌​‌​‌‍‌​‌‌​​‌​‌​​‌‍​‌​​‌​‌‌​‍​​‌​‌‌‌‌‍​‌‌​‍‌‌​‍​‌​​​‌‌‌​‌‍​‍​‌​‍​‌‍‌​‌‌‌​‌​‌​‌​​‍​​‌​‌‌​‌‍​‌​​‌​​‌​‍​‌​‍​​‌‌​‌​​‌‍​‌​​‌‌‌‌‍​​​‌​‌​​‍​‌​​​​​‌‍​‌​‌​​​‌‍​‌​‌‌​​‍​​‌​​‌​‌‍‌​‌‌​​​‌​‌​‌‌‌​​​‌‌‌​‌‌​​‌‍‌​‌​​‌‌​‌‌​​‍‌​‌‌​​​‌‌​​​‌​‌‌‌‍​​‌‌‌‌​​‍​‌​‌​‌‌‌‌​​‌‍​‌​‍‌‌​‌‍​​‌‌​‍‌​​‌​​‌‌‍‌​‌‌​‌​​​​‌‍‌​‌​​‌‌‍‌‌​‌​‍​‌​‌‌​‌‌​​‌‌‍‌​‌‌​​​‌‍​​‌‌​​‌‌​‌‌​​‌‍​‌​​‌​​​‌‌‌​‌‍​‌​‌‌​​​‌‌​‌‌​‌‌​​‌‌‌​‌‍​​‌‌​​‌​​​‌​‌‌​​​‌‌​​‌​‌‌‍‌‌​‌​‌‌​‍​​​‍​​​‌‌​​‌​‌​‌‌​⁠

/**
 * JS 侧图表 / 品牌色唯一真相源(2026-09-06 立,统一全项目硬编码图表色)。
 *
 * ⚠️ 与 packages/design-tokens/src/styles/tokens.css 的 --chart-1..8 / --chart-text /
 *    --chart-axis / --chart-success 互为镜像:本文件是 JS 消费端(ECharts / swagger)
 *    读取色值的唯一来源(JS 无法解析 CSS var()),tokens.css 是 CSS 消费端来源。
 *    改一处必须同步另一处,由 scripts/check-design-tokens-sync.mjs --target registry
 *    校验 name 集一致性守护。
 *
 * BRAND_PRIMARY / BRAND_PRIMARY_DARK / BRAND_BG 为 Swagger 后台文档主题品牌色,
 * BRAND_PRIMARY = 全项目统一强调橙 #ff6b35(对齐 --color-brand-orange),遵循"相近色统一为一个 token"。
 */
export const CHART_PALETTE: readonly string[] = [
  '#3b82f6', // --chart-1 blue
  '#10b981', // --chart-2 emerald
  '#f59e0b', // --chart-3 amber
  '#ef4444', // --chart-4 red
  '#8b5cf6', // --chart-5 violet
  '#ec4899', // --chart-6 pink
  '#06b6d4', // --chart-7 cyan
  '#84cc16', // --chart-8 lime
] as const

/** --chart-1 · 数据蓝(同 Swagger 品牌主蓝) */
export const CHART_BLUE = '#3b82f6'
/** --chart-2 · 数据绿 */
export const CHART_GREEN = '#10b981'
/** --chart-3 · 数据琥珀 */
export const CHART_AMBER = '#f59e0b'
/** --chart-4 · 数据红 */
export const CHART_RED = '#ef4444'
/** --chart-5 · 数据紫 */
export const CHART_VIOLET = '#8b5cf6'
/** --chart-6 · 数据粉 */
export const CHART_PINK = '#ec4899'
/** --chart-7 · 数据青 */
export const CHART_CYAN = '#06b6d4'
/** --chart-8 · 数据黄绿 */
export const CHART_LIME = '#84cc16'

/** --chart-text 亮色(浅色主题文字/坐标轴文字灰) */
export const CHART_TEXT_LIGHT = '#94a3b8'
/** --chart-text 暗色(.dark 覆盖 #64748b) */
export const CHART_TEXT_DARK = '#64748b'
/** --chart-axis 亮色(浅色主题轴线) */
export const CHART_AXIS_LIGHT = '#e5e7eb'
/** --chart-axis 暗色(.dark 覆盖 #1e293b) */
export const CHART_AXIS_DARK = '#1e293b'
/** --chart-success 正向指标色(明暗一致) */
export const CHART_SUCCESS_LIGHT = '#16a34a'
/** --chart-success 正向指标色(.dark 未覆盖,cascade 回退) */
export const CHART_SUCCESS_DARK = '#16a34a'

/** 图表容器背景色(dark-mode: 深底 / light: 白,用于 pie 扇区分隔描边等)。 */
export const CHART_BG_DARK = '#0f172a'
export const CHART_BG_LIGHT = '#ffffff'

/** Swagger 后台文档品牌主蓝 = --chart-1 / CHART_BLUE */
export const BRAND_PRIMARY = '#3b82f6'
/** Swagger 渐变第二档(仅 swagger 渐变端点) */
export const BRAND_PRIMARY_DARK = '#2563eb'
/** Swagger 后台信息条底色 */
export const BRAND_BG = '#f8fafc'

/** --chart-N 色板之外补充的 JS 数据区分色(仅在 JS 消费,无对应 CSS token) */

/** 数据靛蓝:用于与 --chart-1(蓝)相近但需独立区分的场景(对话历史 / 拓扑连线) */
export const CHART_INDIGO = '#6366f1'
/** 数据紫:用于蓝紫递减带最高档 */
export const CHART_PURPLE = '#a855f7'

/** funnel 图表专用的蓝-紫递减色带(收编自 ConversionFunnelChart,非 8 色板)。 */
export const CHART_INDIGO_RAMP: readonly string[] = [
  CHART_BLUE,
  CHART_INDIGO,
  CHART_VIOLET,
  CHART_PURPLE,
] as const
/** 数据橙:用于 relay 排队/紧张、成绩趋势、价格预警等警示色 */
export const CHART_ORANGE = '#f97316'
/** 数据青绿:用于下载渠道等场景(与 --chart-7 青区分) */
export const CHART_TEAL = '#14b8a6'
/** 数据玫红:用于失败/调试等危险态(与 --chart-4 红区分) */
export const CHART_ROSE = '#f43f5e'

/** 中性纯黑(用于半透明阴影 wash 的 RGB 基色)。 */
export const COLOR_BLACK = '#000000'

/**
 * 将 #rrggbb 或 #rgb hex 转为 rgba() 字符串,用于需半透明的场景
 * (如 swagger/topbar 的底纹 wash)。遵循"由 token 派生、不在组件里写死 hex/rgba"。
 */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Swarm 拓扑 agentRole 配色(功能数据区分,非 themeable 语义色)。
 * 与 ROLE_FILL/STROKE/TEXT 一一对应,成为统一唯一源,组件只 import。
 */
export const SWARM_ROLE_FILL: Readonly<Record<string, string>> = {
  researcher: '#e0e7ff',
  coder: '#d1fae5',
  reviewer: '#fef3c7',
  architect: '#ede9fe',
  debugger: '#ffe4e6',
}
export const SWARM_ROLE_STROKE: Readonly<Record<string, string>> = {
  researcher: CHART_INDIGO,
  coder: CHART_GREEN,
  reviewer: CHART_AMBER,
  architect: CHART_VIOLET,
  debugger: CHART_ROSE,
}
export const SWARM_ROLE_TEXT: Readonly<Record<string, string>> = {
  researcher: '#3730a3',
  coder: '#065f46',
  reviewer: '#92400e',
  architect: '#5b21b6',
  debugger: '#9f1239',
}

/** 设计工具(Inspector)覆盖层明暗底/前景色。 */
export const DESIGN_OVERLAY_BG_LIGHT = '#ffffff'
export const DESIGN_OVERLAY_BG_DARK = '#0a0a0a'
export const DESIGN_OVERLAY_FG_LIGHT = '#111111'
export const DESIGN_OVERLAY_FG_DARK = '#f5f5f5'

/** 图表文字色:dark-mode 感知(ECharts canvas 无法读 CSS var)。 */
export function chartText(isDark: boolean): string {
  return isDark ? CHART_TEXT_DARK : CHART_TEXT_LIGHT
}

/** 图表轴线色:dark-mode 感知。 */
export function chartAxis(isDark: boolean): string {
  return isDark ? CHART_AXIS_DARK : CHART_AXIS_LIGHT
}

/** 图表容器背景色:dark-mode 感知。 */
export function chartBg(isDark: boolean): string {
  return isDark ? CHART_BG_DARK : CHART_BG_LIGHT
}