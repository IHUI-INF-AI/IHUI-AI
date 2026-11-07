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
 * 职责边界(2026-11-07 二次收紧):
 *  - `loadGateTimeoutBudget` 只服务 guardians 启动前的**看门狗**取阈值,对畸形条目
 *    不采信;它不决定任何门的判定,外层 300s 只是兜底等待上限。
 *  - 判定权在门内:`validateGateTimeoutBudget` 对三种畸形(evidence 空 / 末条不覆盖
 *    当前 margin / derived≠base+margin)返回 `ok:false`,由 `scripts/check-typecheck.mjs`
 *    在任何可 exit 0 的分支之前 **exit 非 0 并点名**,禁止回落默认值。
 *    此前「不采信 ⇒ 回落 300s」等于「预算数据坏了 = 门不存在」,是同一族 fail-open。
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
 *  3. 跨版本比对见 `checkMarginRatchetHistory`:margin 变了但 evidence 没增 ⇒ 拒收。
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
 * 严格校验预算文件:三种畸形一律报错,**禁止回落默认值**(2026-11-07 机主令)。
 *
 * 曾经的写法是「条目不合格就不采信、回落 300s」——那等于「预算数据坏了 ⇒ 专属阈值消失」,
 * 与这两天清扫的 fail-open 同族。此处改为硬失败,由 T1 门在跑数之前 exit 非 0 并点名缺什么。
 *
 * 三种畸形:① `derivedMs ≠ baseMs + marginMs`;② `evidence[]` 为空;
 * ③ evidence 末条 `marginMs ≠ 当前 marginMs`(改余量没留证据)。
 * @param {string} [file]
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateGateTimeoutBudget(file = BUDGET_FILE) {
  const raw = readBudgetRaw(file)
  if (!raw) return { ok: false, errors: [`预算文件不可读或坏 JSON: ${file}`] }
  const gates = raw.gates
  if (!gates || typeof gates !== 'object' || Object.keys(gates).length === 0) {
    return { ok: false, errors: ['gates 缺失或为空(没有任何门在册)'] }
  }
  const errors = []
  for (const [id, e] of Object.entries(gates)) {
    const derived = e?.derivedMs
    const base = e?.baseMs
    const margin = e?.marginMs
    if (!Number.isFinite(base) || !Number.isFinite(margin) || !Number.isFinite(derived)) {
      errors.push(`${id}: baseMs/marginMs/derivedMs 必须是有限数字`)
      continue
    }
    if (base + margin !== derived) {
      errors.push(`${id}: derivedMs(${derived}) ≠ baseMs(${base}) + marginMs(${margin})`)
    }
    const evidence = e?.evidence
    if (!Array.isArray(evidence) || evidence.length === 0) {
      errors.push(`${id}: evidence[] 为空 —— 定/改余量必须留「凭什么」的证据`)
      continue
    }
    const last = evidence[evidence.length - 1]
    if (!Number.isFinite(last?.marginMs) || last.marginMs !== margin) {
      errors.push(
        `${id}: evidence 末条 marginMs(${last?.marginMs}) ≠ 当前 marginMs(${margin}) —— 改了余量却没追加证据`,
      )
    }
  }
  return { ok: errors.length === 0, errors }
}

/**
 * 跨多版本棘轮(2026-11-07 机主令,补「只看 HEAD/HEAD^」的洞)。
 *
 * 一步比对看不见「中间删 evidence 再加回」与「revert 后再改」;本函数吃**文件提交史**里的
 * 各版本条目(新→旧),按两条规则判:
 *  A. 当前 marginMs 与**最近一个 marginMs 不同的旧版本**比,evidence 条数必须增长;
 *  B. evidence 条数沿时间轴**只许增不许减**(任何一版比它更旧的版本条数还少 ⇒ 证据被删过)。
 *
 * 已知边界:调用方只取文件最近的 N 个提交(`HISTORY_LIMIT`),更早的历史不参与判定。
 * 这是成本取舍,不是全覆盖 —— 在此写明,避免被读成「全史都查了」。
 * @param {string} id
 * @param {any} curEntry
 * @param {Array<any>} historyEntries 新→旧,每项含 marginMs / evidence / 可选 __sha
 * @returns {string[]}
 */
export function checkMarginRatchetHistory(id, curEntry, historyEntries) {
  if (!curEntry || !Array.isArray(historyEntries) || historyEntries.length === 0) return []
  const curMargin = curEntry.marginMs
  if (!Number.isFinite(curMargin)) return []
  const curCount = Array.isArray(curEntry.evidence) ? curEntry.evidence.length : 0
  const errors = []
  const older = historyEntries.filter((x) => Number.isFinite(x?.marginMs))
  // A. 最近一个 marginMs 不同的旧版本 = 余量真正发生变化的起点
  const pivot = older.find((x) => x.marginMs !== curMargin)
  if (pivot && curCount <= (Array.isArray(pivot.evidence) ? pivot.evidence.length : 0)) {
    errors.push(
      `${id}: marginMs ${pivot.marginMs} → ${curMargin},但证据未增长(${Array.isArray(pivot.evidence) ? pivot.evidence.length : 0} → ${curCount})${pivot.__sha ? ` [自 ${pivot.__sha} 起]` : ''}`,
    )
  }
  // B. 证据条数单调不减(新→旧遍历,相邻两版:较新者不得少于较旧者)
  for (let i = 0; i + 1 < older.length; i++) {
    const newer = Array.isArray(older[i].evidence) ? older[i].evidence.length : 0
    const prior = Array.isArray(older[i + 1].evidence) ? older[i + 1].evidence.length : 0
    if (newer < prior) {
      errors.push(
        `${id}: evidence 被删除过(${older[i].__sha ?? 'HEAD'} 比 ${older[i + 1].__sha ?? 'HEAD^'} 少 ${prior} → ${newer} 条)`,
      )
    }
  }
  return errors
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
