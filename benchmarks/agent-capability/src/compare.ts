// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 基线比较：把"退化 / 提升 / 无变化"变成机械判定，不依赖人眼。
 *
 * 判定顺序（任一更高优先级的结论覆盖低优先级）：
 *   1. 用例消失 / 通过→失败 / 某指标变差  ⇒ `regressed`
 *   2. 指标口径内"变了"（exact 指标取值变化、证据指纹变化、新增用例）⇒ `changed`（需刷新基线）
 *   3. 只有通过→通过且某指标变好 ⇒ `improved`
 *   4. 全部逐字段相等 ⇒ `unchanged`
 *
 * 关键纪律：`exact` 指标（布尔结论 / stopReason）的取值变化不允许被当成"无变化"，
 * 也不允许被当成"提升"；它只能触发 `changed`，要求人明确复核并刷新基线 ——
 * 否则任何人只要让 stopReason 从 `error` 变成别的值，就能把一次真实行为变化
 * 记成"没变"。
 */
import { metricDirection } from './metrics.js'
import type { CaseDiff, CaseResult, Comparison, EvalSnapshot } from './types.js'
import { hashEvidence } from './snapshot.js'

type MetricVerdict = { kind: 'same' } | { kind: 'better' | 'worse' | 'changed'; detail: string }

function compareMetric(
  name: string,
  baseline: CaseResult['metrics'][string],
  current: CaseResult['metrics'][string],
): MetricVerdict {
  if (baseline === current) return { kind: 'same' }
  const direction = metricDirection(name)
  if (direction === 'exact') {
    return {
      kind: 'changed',
      detail: `${name}: ${String(baseline)} → ${String(current)}（exact 指标，需复核并刷新基线）`,
    }
  }
  if (typeof baseline !== 'number' || typeof current !== 'number') {
    throw new Error(
      `指标 ${name} 声明为 ${direction} 但不是数值: ${String(baseline)} / ${String(current)}`,
    )
  }
  const better = direction === 'higher-better' ? current > baseline : current < baseline
  return {
    kind: better ? 'better' : 'worse',
    detail: `${name}: ${baseline} → ${current}（${direction}）`,
  }
}

function diffCase(baseline: CaseResult, current: CaseResult): CaseDiff {
  const details: string[] = []
  let regressed = false
  let improved = false
  let changed = false

  if (baseline.passed && !current.passed) {
    regressed = true
    details.push(`用例由通过变为失败: ${current.failures.join(' | ') || '(无失败明细)'}`)
  } else if (!baseline.passed && current.passed) {
    improved = true
    details.push('用例由失败变为通过')
  }

  for (const name of Object.keys(baseline.metrics).sort()) {
    if (!Object.hasOwn(current.metrics, name)) {
      regressed = true
      details.push(`指标 ${name} 在当前结果中缺失`)
      continue
    }
    const verdict = compareMetric(name, baseline.metrics[name]!, current.metrics[name]!)
    if (verdict.kind === 'worse') regressed = true
    if (verdict.kind === 'better') improved = true
    if (verdict.kind === 'changed') changed = true
    if (verdict.kind !== 'same') details.push(verdict.detail)
  }
  for (const name of Object.keys(current.metrics).sort()) {
    if (!Object.hasOwn(baseline.metrics, name)) {
      changed = true
      details.push(`新增指标 ${name}（需刷新基线）`)
    }
  }

  if (hashEvidence(baseline.evidence) !== hashEvidence(current.evidence)) {
    changed = true
    details.push('证据指纹变化（工具序列/文件快照/消息形态发生变化）')
  }

  let status: CaseDiff['status'] = 'unchanged'
  if (regressed) status = 'regressed'
  else if (changed) status = 'changed'
  else if (improved) status = 'improved'
  return { id: current.id, status, details }
}

export function compareSnapshots(baseline: EvalSnapshot, current: EvalSnapshot): Comparison {
  const cases: CaseDiff[] = []
  const currentById = new Map(current.cases.map((c) => [c.id, c]))

  for (const base of baseline.cases) {
    const cur = currentById.get(base.id)
    if (!cur) {
      cases.push({
        id: base.id,
        status: 'removed',
        details: ['固定任务集用例在当前结果中消失（覆盖退化）'],
      })
      continue
    }
    if (base.capability !== cur.capability) {
      cases.push({
        id: base.id,
        status: 'changed',
        details: [`能力分类变化: ${base.capability} → ${cur.capability}`],
      })
      continue
    }
    cases.push(diffCase(base, cur))
    currentById.delete(base.id)
  }
  for (const cur of [...currentById.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    cases.push({ id: cur.id, status: 'added', details: ['新增用例（需刷新基线）'] })
  }

  let status: Comparison['status'] = 'unchanged'
  if (cases.some((c) => c.status === 'regressed' || c.status === 'removed')) status = 'regressed'
  else if (cases.some((c) => c.status === 'changed' || c.status === 'added')) status = 'changed'
  else if (cases.some((c) => c.status === 'improved')) status = 'improved'
  return { status, cases }
}

export function formatComparison(comparison: Comparison, fixtureHashChanged: boolean): string {
  const lines: string[] = []
  lines.push(`基线对比结论: ${comparison.status}`)
  if (fixtureHashChanged) {
    lines.push('注意: 夹具内容哈希与基线不一致 —— 本次比较的用例输入已改变，请确认后刷新基线')
  }
  for (const item of comparison.cases) {
    if (item.status === 'unchanged') continue
    lines.push(`- [${item.status}] ${item.id}`)
    for (const detail of item.details) lines.push(`    ${detail}`)
  }
  return lines.join('\n')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
