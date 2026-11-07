// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 单门超时预算的唯一读取实现(机器可读文件 scripts/data/gate-timeout-budget.json)。
 *
 * 立因(2026-11-07 机主令):一个全局常数不该衡量所有门。T1(全量 typecheck)实测
 * 309s 串行,默认 300s 只有 0.97x 余量 ⇒ 正确的门永远「未判定」⇒ 所有人手工
 * `GUARDIAN_GATE_TIMEOUT_MS=900000` 绕过 ⇒ 一个所有人都要绕过的阈值等于没有阈值。
 *
 * 口径(不得放宽):阈值 = 实测基线 baseMs + 固定余量 marginMs,derivedMs 必须是
 * 两者之和;任何一次上调都要在 data 文件的 ledger 里写明「新增了什么工作」。
 * 本模块只做读取与挑选,**不写任何魔法数**(默认 300s 仍住 guardian-executor)。
 *
 * 失效方向:文件缺失 / 坏 JSON / 条目缺 derivedMs ⇒ 返回空表,调用方回落到全局默认。
 * 即「预算文件坏了」不会把门静默放开,也不会把门判红。
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
export const BUDGET_FILE = join(ROOT, 'scripts', 'data', 'gate-timeout-budget.json')

/** 原样读预算 JSON(门内做棘轮比对用);坏文件/缺失 ⇒ null。 */
export function readBudgetRaw(file = BUDGET_FILE) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/**
 * 读取预算表,返回 `{ [gateId]: entry }`;只保留结构自洽的条目。
 *
 * 三条硬约束(2026-11-07 机主令,棘轮不是橡皮筋):
 *  1. `derivedMs === baseMs + marginMs` —— 只涨 derived 而基线/余量不匹配 ⇒ 拒收;
 *  2. `evidence[]` 非空,且**最后一条**的 `marginMs` 必须等于当前 `marginMs`
 *     —— 改余量必须留下「凭什么改」的证据,算术一致不算证据;
 *  3. 跨版本比对见 `checkMarginRatchet`:margin 变了但 evidence 没增 ⇒ 拒收。
 * @param {string} [file]
 * @returns {Record<string, { derivedMs: number, marginMs: number, evidence: unknown[] }>}
 */
export function loadGateTimeoutBudget(file = BUDGET_FILE) {
  const raw = readBudgetRaw(file)
  const gates = raw?.gates
  if (!gates || typeof gates !== 'object') return {}
  const out = {}
  for (const [id, entry] of Object.entries(gates)) {
    const ms = entry?.derivedMs
    if (!Number.isFinite(ms) || ms <= 0) continue
    const base = entry?.baseMs
    const margin = entry?.marginMs
    if (!Number.isFinite(base) || !Number.isFinite(margin) || base + margin !== ms) continue
    const evidence = entry?.evidence
    if (!Array.isArray(evidence) || evidence.length === 0) continue
    const last = evidence[evidence.length - 1]
    if (!Number.isFinite(last?.marginMs) || last.marginMs !== margin) continue
    out[id] = entry
  }
  return out
}

/**
 * 跨版本棘轮:把当前预算与上一版(HEAD^ / origin/main)比,`marginMs` 变了却**没有**
 * 追加一条 evidence ⇒ 拒收。返回错误描述数组(空 = 通过)。
 *
 * 只改数字不加证据的形态举例:margin 150000 → 300000,derived 也同步加 150000,
 * 算术仍成立;本函数要求 evidence.length 增长,否则即便数字自洽也判红。
 * @param {string} id
 * @param {any} [prevEntry] 上一版该门条目(无历史 = undefined)
 * @param {any} [curEntry]
 * @returns {string[]}
 */
export function checkMarginRatchet(id, prevEntry, curEntry) {
  if (!prevEntry || !curEntry) return []
  const prevMargin = prevEntry.marginMs
  const curMargin = curEntry.marginMs
  if (!Number.isFinite(prevMargin) || !Number.isFinite(curMargin)) return []
  if (prevMargin === curMargin) return []
  const prevCount = Array.isArray(prevEntry.evidence) ? prevEntry.evidence.length : 0
  const curCount = Array.isArray(curEntry.evidence) ? curEntry.evidence.length : 0
  if (curCount > prevCount) return []
  return [
    `${id}: marginMs ${prevMargin} → ${curMargin},但 evidence 未新增(${prevCount} → ${curCount})`,
    '改余量必须同批在 evidence[] 追加一条「凭什么改」(实测读数/新增工作量/到期复核结论),只有数字增长一律拒收',
  ]
}

/**
 * 挑一道门的超时。
 * 优先级:显式环境旋钮(含 0 = 关闭) > 预算文件里的专属条目 > 全局默认。
 * @param {{ id: string | number }} check
 * @param {{ defaultMs: number, explicit: boolean, budget: Record<string, { derivedMs: number }> }} ctx
 * @returns {number}
 */
export function pickGateTimeout(check, { defaultMs, explicit, budget }) {
  if (explicit) return defaultMs
  const entry = budget[String(check.id)]
  return entry ? entry.derivedMs : defaultMs
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
