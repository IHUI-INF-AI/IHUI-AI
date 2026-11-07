// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门级「有账豁免」台账（2026-11-07 裁定）
 *
 * 用途：让**存量红**（基线上就红、且不在本线改动面内）在提交链上走"有账放行"，
 * 而不是用运行期 `HUSKY_SKIP_*` 开关（开关不留痕、事后不可审）。
 *
 * 与 `immutable-exempt:` 的差别：那套是**按文件路径**豁免 [IG]；本台账是**按门号**，
 * 语义不同，不能复用（硬套会把门号当路径，永远不命中）。
 *
 * 硬规则（缺一条该行使失效，不是"降级放行"）：
 *   1. 字段齐全：gate / object / owner / baseline / expires / touched；
 *   2. touched 必须是「否」—— 本线动过的门不许拿存量豁免渡过；
 *   3. expires 为 ISO 日期且未过期（过期即回红，不自动续期）；
 *   4. **同一道门第二次上账 ⇒ 自动失效**：台账里同一 gate 出现两行（含历史行）时，
 *      该门全部豁免作废，必须修或由机主单独批。否则豁免账三个月后会变成永久白名单。
 *   5. 台账形状坏（JSON 行不可解）⇒ 整份不生效（宁可回红，也不让坏行变成放行条）。
 *
 * 豁免**不产生通过**：executor 只把它记成独立一档 exempted（不计 passed / 不计 failed），
 * 汇总单列并逐道点名。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const GATE_EXEMPTION_LEDGER_REL = 'scripts/data/gate-exemptions.jsonl'

const REQUIRED_KEYS = ['gate', 'object', 'owner', 'baseline', 'expires', 'touched']

/** 只认 YYYY-MM-DD；别让 `new Date('2026-2-30')` 这类宽松解析混进来。 */
function isIsoDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/**
 * 纯函数：解析台账正文。today 用 `YYYY-MM-DD`（由调用方注入，便于测试）。
 * @returns {{ rows: Array, problems: string[], disabled: boolean, match: (gate: string) => object|null }}
 */
export function parseGateExemptions(text, today) {
  const problems = []
  const rows = []
  if (typeof text !== 'string' || text.trim() === '') {
    return { rows, problems, disabled: false, match: () => null }
  }
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim()
    if (raw === '' || raw.startsWith('#') || raw.startsWith('//')) continue
    let row
    try {
      row = JSON.parse(raw)
    } catch {
      problems.push(`第 ${i + 1} 行不是合法 JSON`)
      continue
    }
    const miss = REQUIRED_KEYS.filter((k) => typeof row[k] !== 'string' || row[k].trim() === '')
    if (miss.length > 0) {
      problems.push(`第 ${i + 1} 行缺字段:${miss.join(',')}`)
      continue
    }
    rows.push({ ...row, line: i + 1 })
  }
  // 形状坏 ⇒ 整份不生效（宁可回红）
  if (problems.length > 0) {
    return { rows, problems, disabled: true, match: () => null }
  }
  const counts = new Map()
  for (const r of rows) counts.set(r.gate, (counts.get(r.gate) ?? 0) + 1)

  const active = rows.filter((r) => {
    if (counts.get(r.gate) > 1) {
      problems.push(`门 ${r.gate} 第二次上豁免账 ⇒ 自动失效(第 ${r.line} 行)`)
      return false
    }
    if (r.touched !== '否') {
      problems.push(`门 ${r.gate} 标了本线触碰(touched=${r.touched}) ⇒ 不适用存量豁免(第 ${r.line} 行)`)
      return false
    }
    if (!isIsoDate(r.expires)) {
      problems.push(`门 ${r.gate} 到期日不可解(${r.expires}) ⇒ 不豁免(第 ${r.line} 行)`)
      return false
    }
    if (r.expires < today) {
      problems.push(`门 ${r.gate} 豁免已过期(${r.expires}) ⇒ 回红(第 ${r.line} 行)`)
      return false
    }
    return true
  })
  const byGate = new Map(active.map((r) => [r.gate, r]))
  return { rows, problems, disabled: false, match: (gate) => byGate.get(String(gate)) ?? null }
}

/** 读台账并解析。取不到文件 ⇒ 没有任何豁免（不是"坏"）。 */
export function loadGateExemptions(root, now = new Date()) {
  const today = now.toISOString().slice(0, 10)
  let text = null
  try {
    text = readFileSync(join(root, GATE_EXEMPTION_LEDGER_REL), 'utf8')
  } catch {
    return { rows: [], problems: [], disabled: false, match: () => null }
  }
  return parseGateExemptions(text, today)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
