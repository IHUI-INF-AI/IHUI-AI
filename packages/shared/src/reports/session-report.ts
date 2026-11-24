// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话报告的数据契约：KPI 相对预算下结论，阶段轨标 hit / miss，同一份报告接受新载荷后重算。
 *
 * 量不到单列 unjudged。预算或用量缺测不得记成未超预算；阶段 hit 不是布尔不得记成 miss。
 * 新载荷解析失败时保留上一份报告，不擦成空报告。
 */

export interface SessionReportKpi {
  name: string
  used: number | null
  budget: number | null
}

export interface SessionReportStage {
  id: string
  hit: boolean | null
}

export interface SessionReport {
  kpis: SessionReportKpi[]
  stages: SessionReportStage[]
}

export interface KpiJudgement {
  disposition: 'within' | 'over' | 'unjudged'
  reason: string
  ratio: number | null
}

export interface StageJudgement {
  disposition: 'hit' | 'miss' | 'unjudged'
  reason: string
}

export interface ReportApplication {
  disposition: 'rendered' | 'unjudged'
  reason: string
  report: SessionReport | null
}

/** 有限且 > 0 才是量到的预算。布尔、0、负数、NaN、Infinity、null 都不是。 */
function isPositiveBudget(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/** 有限且 >= 0 才是量到的用量。布尔不算数（typeof 不是 number，禁止被折成 1）。 */
function isNonNegativeUse(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export function judgeKpi(used: number | null, budget: number | null): KpiJudgement {
  if (!isPositiveBudget(budget)) {
    return { disposition: 'unjudged', reason: 'budget-unmeasured', ratio: null }
  }
  if (!isNonNegativeUse(used)) {
    return { disposition: 'unjudged', reason: 'used-unmeasured', ratio: null }
  }
  const ratio = used / budget
  if (used <= budget) {
    return { disposition: 'within', reason: 'within-budget', ratio }
  }
  return { disposition: 'over', reason: 'over-budget', ratio }
}

export function judgeStage(hit: boolean | null): StageJudgement {
  if (typeof hit !== 'boolean') {
    return { disposition: 'unjudged', reason: 'hit-unmeasured' }
  }
  if (hit) return { disposition: 'hit', reason: 'hit' }
  return { disposition: 'miss', reason: 'miss' }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readLabel(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  return value
}

/** null = 字段在、值没量到；undefined = 字段形态不合法。 */
function readNumberOrNull(value: unknown): number | null | undefined {
  if (value === null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return undefined
}

function readBooleanOrNull(value: unknown): boolean | null | undefined {
  if (value === null) return null
  if (typeof value === 'boolean') return value
  return undefined
}

function readKpi(value: unknown): SessionReportKpi | null {
  if (!isRecord(value) || !('used' in value) || !('budget' in value)) return null
  const name = readLabel(value.name)
  const used = readNumberOrNull(value.used)
  const budget = readNumberOrNull(value.budget)
  if (name === null || used === undefined || budget === undefined) return null
  return { name, used, budget }
}

function readStage(value: unknown): SessionReportStage | null {
  if (!isRecord(value) || !('hit' in value)) return null
  const id = readLabel(value.id)
  const hit = readBooleanOrNull(value.hit)
  if (id === null || hit === undefined) return null
  return { id, hit }
}

function readKpis(value: unknown): SessionReportKpi[] | null {
  if (!Array.isArray(value)) return null
  const kpis: SessionReportKpi[] = []
  for (const item of value) {
    const kpi = readKpi(item)
    if (kpi === null) return null
    kpis.push(kpi)
  }
  return kpis
}

function readStages(value: unknown): SessionReportStage[] | null {
  if (!Array.isArray(value)) return null
  const stages: SessionReportStage[] = []
  for (const item of value) {
    const stage = readStage(item)
    if (stage === null) return null
    stages.push(stage)
  }
  return stages
}

function parseJson(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text)
    return value
  } catch {
    return undefined
  }
}

function kept(current: SessionReport | null, reason: string): ReportApplication {
  return { disposition: 'unjudged', reason, report: current }
}

export function applyReportPayload(
  current: SessionReport | null,
  nextText: string | null,
): ReportApplication {
  if (nextText === null) return kept(current, 'payload-absent')
  const parsed = parseJson(nextText)
  if (parsed === undefined || !isRecord(parsed)) return kept(current, 'payload-invalid')
  const kpis = readKpis(parsed.kpis)
  const stages = readStages(parsed.stages)
  if (kpis === null || stages === null) return kept(current, 'payload-invalid')
  return { disposition: 'rendered', reason: 'applied', report: { kpis, stages } }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
