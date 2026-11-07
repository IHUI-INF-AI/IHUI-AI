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

/**
 * 读取预算表,返回 `{ [gateId]: entry }`;只保留 derivedMs 为正有限数的条目。
 * @param {string} [file]
 * @returns {Record<string, { derivedMs: number }>}
 */
export function loadGateTimeoutBudget(file = BUDGET_FILE) {
  let raw
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
  const gates = raw?.gates
  if (!gates || typeof gates !== 'object') return {}
  const out = {}
  for (const [id, entry] of Object.entries(gates)) {
    const ms = entry?.derivedMs
    if (!Number.isFinite(ms) || ms <= 0) continue
    // 棘轮校验:derived 必须等于 base+margin。写错(例如只涨数字)的条目不予采信,
    // 否则「预算与工作量绑定」这层约束会被一次手滑绕过。
    const base = entry?.baseMs
    const margin = entry?.marginMs
    if (!Number.isFinite(base) || !Number.isFinite(margin) || base + margin !== ms) continue
    out[id] = entry
  }
  return out
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
