// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D46(2026-09-23 立,G-57):对话内受控图表模板注册表 —— 模板白名单唯一真源。
 *
 * 对标 Trae `dynamic-ui` 模板化思路:AI 产出的图表不再只有"自由 HTML + iframe 沙箱"一条路,
 * 结构化数据(chart JSON)命中本注册表时走**受控模板渲染**(design-tokens 驱动、明暗同源、
 * 圆角/字体规范内建),自由 HTML 保持既有 iframe 降级路径不变。
 *
 * 色值一律取自 ./chart-colors.ts(与 tokens.css --chart-1..8 互为镜像的同源调色板),
 * 本文件不定义任何新颜色 —— 8 端 token 同源判据由这一点保证。
 */

/** 模板 id 白名单(8 种,与台账 D46 列举一一对应) */
export type ChartTemplateId =
  | 'gantt'
  | 'sankey'
  | 'radar'
  | 'heatmap'
  | 'funnel'
  | 'timeseries'
  | 'treeflow'
  | 'comparison'

/** 场景分类(scenes):消费方可按对话场景推荐/过滤模板 */
export type ChartTemplateScene =
  | 'planning' // 计划/排期
  | 'flow' // 流量/转化流向
  | 'distribution' // 分布/密度
  | 'hierarchy' // 层级/树
  | 'comparison' // 对比
  | 'trend' // 趋势

export interface ChartTemplateMeta {
  id: ChartTemplateId
  /** 模板中文名(界面展示用) */
  label: string
  /** 适用场景(可多选) */
  scenes: readonly ChartTemplateScene[]
  /** 每行数据的必填字段(渲染前校验用,字段名与解析契约一致) */
  requiredFields: readonly string[]
}

export const CHART_TEMPLATES: readonly ChartTemplateMeta[] = [
  { id: 'gantt', label: '甘特图', scenes: ['planning'], requiredFields: ['label', 'start', 'end'] },
  { id: 'sankey', label: '桑基图', scenes: ['flow'], requiredFields: ['source', 'target', 'value'] },
  { id: 'radar', label: '雷达图', scenes: ['comparison', 'distribution'], requiredFields: ['label', 'value'] },
  { id: 'heatmap', label: '热力图', scenes: ['distribution'], requiredFields: ['row', 'col', 'value'] },
  { id: 'funnel', label: '漏斗图', scenes: ['flow', 'comparison'], requiredFields: ['label', 'value'] },
  { id: 'timeseries', label: '时序图', scenes: ['trend'], requiredFields: ['t', 'v'] },
  { id: 'treeflow', label: '树流图', scenes: ['hierarchy'], requiredFields: ['label'] },
  { id: 'comparison', label: '对比卡', scenes: ['comparison'], requiredFields: ['label', 'a', 'b'] },
] as const

/** id 白名单守卫 */
export function isChartTemplateId(v: unknown): v is ChartTemplateId {
  return typeof v === 'string' && CHART_TEMPLATES.some((t) => t.id === v)
}

/** 模板 id → 元数据(认不出返回 null,调用方显式降级,不静默兜底;入参 unknown 防御式) */
export function chartTemplateMeta(id: unknown): ChartTemplateMeta | null {
  if (!isChartTemplateId(id)) return null
  return CHART_TEMPLATES.find((t) => t.id === id) ?? null
}

/** 解析后的受控图表载荷(渲染器输入契约) */
export interface ChartTemplatePayload {
  template: ChartTemplateId
  /** 可选标题(缺省由消费方展示文件名) */
  title?: string
  /** 行数据(各 kind 的字段契约见 CHART_TEMPLATES.requiredFields) */
  data: readonly Record<string, unknown>[]
}

/**
 * 解析 chart JSON 载荷(严格守卫,认不出返回 null → 消费方走既有自由 HTML 降级)。
 * 接受形态:{"template": "<白名单 id>", "data": [行...], "title"?: string}
 * - data 必须是非空数组,且**每行**都含该模板的 requiredFields(任一行缺字段即整体拒绝,
 *   避免渲染出一半真一半假的图 —— 图表一半错比全错更危险);
 * - 行内多余字段允许(渲染器只取所需);
 * - 字段值类型由渲染器按需校验(数字缺失的行跳过渲染而非拒绝整体)。
 */
export function parseChartTemplatePayload(raw: unknown): ChartTemplatePayload | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  if (!isChartTemplateId(obj['template'])) return null
  const meta = chartTemplateMeta(obj['template'])
  if (meta === null) return null
  if (!Array.isArray(obj['data']) || obj['data'].length === 0) return null
  const rows = obj['data']
  for (const row of rows) {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) return null
    const rec = row as Record<string, unknown>
    for (const field of meta.requiredFields) {
      if (!(field in rec)) return null
    }
  }
  const title = typeof obj['title'] === 'string' && obj['title'].trim() !== '' ? obj['title'] : undefined
  return {
    template: obj['template'],
    ...(title !== undefined ? { title } : {}),
    data: rows as readonly Record<string, unknown>[],
  }
}

/** 便捷入口:JSON 字符串 → 载荷(非 JSON / 解析失败一律 null,不抛) */
export function parseChartTemplateJson(text: string): ChartTemplatePayload | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    return parseChartTemplatePayload(JSON.parse(trimmed) as unknown)
  } catch {
    return null
  }
}
