// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * b75-1#1 cron builder 双表示 + 无损回环校验。
 *
 * 上游出处 zcode packages/ui/src/settings/automationFormat.ts:1-458、
 * automationTemplateCatalog.ts:114-120。
 *
 * 机制:结构化 builder ↔ cron 表达式双向转换,回环
 *   buildCronExpr(parseCronToBuilder(expr)) === expr
 * 一致才允许进可视化编辑器 / 收录 cron 模板;否则 fallback "自定义" 保留原文,
 * 防静默改写。识别不了的表达式不硬猜(`M H DOM MON *` 不区分单次/年度)。
 *
 * 此处为纯函数层,唯一真相源;CronEditor 组件直接复用,不另起 builder。
 * 我方 cron 为 5 段(minute hour day month weekday),与 node-cron 6 段(含秒)
 * 在调度执行层另做适配,可视化编辑器只面向 5 段。
 */

export type Mode = 'every' | 'step' | 'range' | 'specific'
export type FieldKey = 'minute' | 'hour' | 'day' | 'month' | 'weekday'

export interface FieldConfig {
  key: FieldKey
  min: number
  max: number
}

export interface FieldState {
  mode: Mode
  step: number
  rangeStart: number
  rangeEnd: number
  specific: number[]
}

export const CRON_FIELDS: readonly FieldConfig[] = [
  { key: 'minute', min: 0, max: 59 },
  { key: 'hour', min: 0, max: 23 },
  { key: 'day', min: 1, max: 31 },
  { key: 'month', min: 1, max: 12 },
  { key: 'weekday', min: 0, max: 6 },
]

export function defaultFieldState(cfg: FieldConfig): FieldState {
  return { mode: 'every', step: 2, rangeStart: cfg.min, rangeEnd: cfg.max, specific: [cfg.min] }
}

/** cron 单字段 → builder 状态。不可识别片段按 every 兜底,不抛错。 */
export function parseFieldState(raw: string, cfg: FieldConfig): FieldState {
  const base = defaultFieldState(cfg)
  if (!raw || raw === '*') return { ...base, mode: 'every' }
  const slashIdx = raw.indexOf('/')
  if (slashIdx >= 0) {
    const basePart = raw.slice(0, slashIdx)
    const n = parseInt(raw.slice(slashIdx + 1), 10)
    if (basePart === '*') return { ...base, mode: 'step', step: Number.isNaN(n) ? 2 : n }
    if (basePart.includes('-')) {
      const segs = basePart.split('-')
      const a = parseInt(segs[0] ?? '', 10)
      const b = parseInt(segs[1] ?? '', 10)
      return {
        ...base,
        mode: 'range',
        rangeStart: Number.isNaN(a) ? cfg.min : a,
        rangeEnd: Number.isNaN(b) ? cfg.max : b,
      }
    }
  }
  if (raw.includes('-')) {
    const segs = raw.split('-')
    const a = parseInt(segs[0] ?? '', 10)
    const b = parseInt(segs[1] ?? '', 10)
    return {
      ...base,
      mode: 'range',
      rangeStart: Number.isNaN(a) ? cfg.min : a,
      rangeEnd: Number.isNaN(b) ? cfg.max : b,
    }
  }
  if (raw.includes(',')) {
    const arr = raw
      .split(',')
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => !Number.isNaN(n))
    return { ...base, mode: 'specific', specific: arr.length ? arr : [cfg.min] }
  }
  const n = parseInt(raw, 10)
  return { ...base, mode: 'specific', specific: Number.isNaN(n) ? [cfg.min] : [n] }
}

/** cron 表达式(5 段)→ builder 全字段。段数不足时缺失段按 '*' 兜底。 */
export function parseCronToBuilder(expr: string): Record<FieldKey, FieldState> {
  const parts = expr.trim().split(/\s+/)
  const out = {} as Record<FieldKey, FieldState>
  CRON_FIELDS.forEach((f, i) => {
    out[f.key] = parseFieldState(parts[i] ?? '*', f)
  })
  return out
}

/** builder 单字段 → cron 片段。 */
export function fieldToCron(f: FieldState): string {
  if (f.mode === 'every') return '*'
  if (f.mode === 'step') return `*/${f.step || 1}`
  if (f.mode === 'range') return `${f.rangeStart}-${f.rangeEnd}`
  return f.specific.length ? [...f.specific].sort((a, b) => a - b).join(',') : '*'
}

/** builder → cron 表达式。 */
export function buildCronExpr(builder: Record<FieldKey, FieldState>): string {
  return CRON_FIELDS.map((f) => fieldToCron(builder[f.key])).join(' ')
}

/**
 * 回环校验:buildCronExpr(parseCronToBuilder(expr)) === expr 才允许可视化编辑。
 * 不一致说明该表达式无法由 builder 无损表达。例如 minute 段同时含步长与离散值
 * (step+specific 混合)时,parse 会选一种 mode 丢失另一部分,回环不一致。
 *
 * 不回环时调用方应 fallback 到"自定义"原文模式,禁止静默改写。
 */
export function canVisualizeCron(expr: string): boolean {
  const trimmed = expr.trim()
  if (!trimmed) return false
  try {
    return buildCronExpr(parseCronToBuilder(trimmed)) === trimmed
  } catch {
    return false
  }
}

/**
 * 把外部 value 归一化为可视化可编辑表达式。
 * - 可可视化:返回原文(交给 builder)
 * - 不可可视化:返回 null,调用方应显示"自定义"原文输入框,提交值逐字保留
 */
export function resolveCronForVisualEditor(expr: string): string | null {
  if (canVisualizeCron(expr)) return expr.trim()
  return null
}

