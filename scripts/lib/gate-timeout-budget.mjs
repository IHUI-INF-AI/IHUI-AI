// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门按「门号 + script」取在册超时(2026-11-07 立)。
 *
 * 病灶:scripts/data/land-gate-budgets.json 里门 30a 早已登记 timeoutMs=900000,
 * 而 guardian 只读一枚全局 GUARDIAN_GATE_TIMEOUT_MS(缺省 300s)——台账里的
 * 「在册」从未被消费,30a 每轮都在 300s 被掐成"未判定"。这就是"在册是假的"。
 *
 * 取值顺序(fail-closed,不设无上限):
 *   ① 门在册(gateId 与 script **双键**逐字相等)⇒ 用条目里的 timeoutMs;
 *   ② 不在册 ⇒ 表里的 defaultTimeoutMs(缺省 300000);
 *   ③ 表不可读 / 非 JSON / gates 非数组 / 条目字段残缺 ⇒ 回落缺省值 + 告警,
 *      **绝不抛异常**(抛出去会把"一格超时"升级成"整批门没跑")。
 *
 * 为什么必须双键:同一个脚本可被多门注册(门号不同),只按 script 匹配会让 30a 的
 * 900s 串到另一道同脚本门上;反过来只按门号匹配也一样会串。
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const DEFAULT_GATE_TIMEOUT_MS = 300_000
// 排队/等锁的独立上限(2026-11-07 立):它**不是**执行时间,超了只判可重试的未判定。
export const DEFAULT_WAIT_TIMEOUT_MS = 600_000
export const BUDGET_TABLE_REL = 'scripts/data/land-gate-budgets.json'

function positive(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * @param {{gateId?: string|number, script?: string, root?: string, tablePath?: string}} opts
 * @returns {{ms: number, source: string, entry: object|null, warning: string|null, waitMs: number}}
 */
export function resolveGateTimeout({ gateId, script, root = process.cwd(), tablePath } = {}) {
  const idText = gateId === undefined || gateId === null ? '' : String(gateId).trim()
  const scriptText = typeof script === 'string' ? script.trim() : ''
  const path = tablePath || join(root, BUDGET_TABLE_REL)
  const label = `${idText || '?'}+${scriptText || '?'}`

  let table
  try {
    table = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    return {
      ms: DEFAULT_GATE_TIMEOUT_MS,
      source: `缺省 ${DEFAULT_GATE_TIMEOUT_MS}ms(预算表不可读)`,
      entry: null,
      warning: `预算表不可读或不是合法 JSON(${path}):${e.message} ⇒ 回落 ${DEFAULT_GATE_TIMEOUT_MS}ms`,
      waitMs: DEFAULT_WAIT_TIMEOUT_MS,
    }
  }

  const def = positive(table?.defaultTimeoutMs)
  const defMs = def ?? DEFAULT_GATE_TIMEOUT_MS
  // 排队/等锁上限同表可配(defaultWaitTimeoutMs);没配就取 DEFAULT_WAIT_TIMEOUT_MS。
  const defWaitMs = positive(table?.defaultWaitTimeoutMs) ?? DEFAULT_WAIT_TIMEOUT_MS
  const defWarning =
    def === null ? `预算表 defaultTimeoutMs 缺失或非正数(${JSON.stringify(table?.defaultTimeoutMs)}) ⇒ 回落 ${DEFAULT_GATE_TIMEOUT_MS}ms` : null

  if (!Array.isArray(table?.gates)) {
    return {
      ms: defMs,
      source: `${BUDGET_TABLE_REL} / 缺省 / ${defMs}ms(gates 不是数组)`,
      entry: null,
      warning: `预算表 gates 不是数组 ⇒ 回落 ${defMs}ms`,
      waitMs: defWaitMs,
    }
  }

  if (!idText || !scriptText) {
    return {
      ms: defMs,
      source: `${BUDGET_TABLE_REL} / 缺省 / ${defMs}ms(调用方未给双键)`,
      entry: null,
      warning: `取超时缺双键(gateId=${JSON.stringify(gateId)}, script=${JSON.stringify(script)}) ⇒ 回落 ${defMs}ms`,
      waitMs: defWaitMs,
    }
  }

  const entry = table.gates.find(
    (g) => String(g?.gateId ?? '').trim() === idText && String(g?.script ?? '').trim() === scriptText,
  )

  if (!entry) {
    const nearScript = table.gates.some((g) => String(g?.script ?? '').trim() === scriptText)
    const nearId = table.gates.some((g) => String(g?.gateId ?? '').trim() === idText)
    return {
      ms: defMs,
      source: `${BUDGET_TABLE_REL} / 缺省 / ${defMs}ms(未在册:${label})`,
      entry: null,
      warning:
        nearScript || nearId
          ? `双键错配:${label} 只命中${nearId ? '门号' : '脚本'}一侧 ⇒ 不串号,回落 ${defMs}ms`
          : defWarning,
      waitMs: defWaitMs,
    }
  }

  const ms = positive(entry.timeoutMs)
  if (ms === null) {
    return {
      ms: defMs,
      source: `${BUDGET_TABLE_REL} / ${label} / 字段残缺 ⇒ ${defMs}ms`,
      entry,
      warning: `在册条目 ${label} 的 timeoutMs 缺失或非正数 ⇒ 回落 ${defMs}ms(不设无上限)`,
      waitMs: defWaitMs,
    }
  }

  return {
    ms,
    source: `${BUDGET_TABLE_REL} / ${label} / ${ms}ms`,
    entry,
    warning: defWarning,
    waitMs: positive(entry.waitTimeoutMs) ?? defWaitMs,
  }
}

/**
 * 跨版本棘轮:余量(marginMs)变了,证据必须跟着长(与 integrate/release-20261106 的
 * `checkMarginRatchetHistory` 同语义、同签名;那边读 `gate-timeout-budget.json`,这边读本表)。
 *
 * 三条不变量:
 *  A. 与「最近一个 marginMs 不同的旧版本」相比,evidence 条数不得持平/减少;
 *  B. evidence 条数在历史上单调不减(被删过就报);
 *  C. 没有历史(首次登记)⇒ 放行(没有可比基线,不是"没跑")。
 *
 * @param {string} id 门号
 * @param {{marginMs?: number, evidence?: unknown[]}} curEntry 当前条目
 * @param {Array<{marginMs?: number, evidence?: unknown[], __sha?: string}>} historyEntries
 *        由新到旧的旧版本列表(含 marginMs/evidence;可选 __sha 用于点名)
 * @returns {string[]} 拒收原因;空数组 = 放行
 */
export function checkMarginRatchetHistory(id, curEntry, historyEntries) {
  if (!curEntry || !Array.isArray(historyEntries) || historyEntries.length === 0) return []
  const curMargin = curEntry.marginMs
  if (!Number.isFinite(curMargin)) return []
  const curCount = Array.isArray(curEntry.evidence) ? curEntry.evidence.length : 0
  const errors = []
  const older = historyEntries.filter((x) => Number.isFinite(x?.marginMs))
  const pivot = older.find((x) => x.marginMs !== curMargin)
  if (pivot && curCount <= (Array.isArray(pivot.evidence) ? pivot.evidence.length : 0)) {
    errors.push(
      `${id}: marginMs ${pivot.marginMs} → ${curMargin},但证据未增长(` +
        `${Array.isArray(pivot.evidence) ? pivot.evidence.length : 0} → ${curCount})` +
        `${pivot.__sha ? ` [自 ${pivot.__sha} 起]` : ''}`,
    )
  }
  for (let i = 0; i + 1 < older.length; i++) {
    const newer = Array.isArray(older[i].evidence) ? older[i].evidence.length : 0
    const prior = Array.isArray(older[i + 1].evidence) ? older[i + 1].evidence.length : 0
    if (newer < prior) {
      errors.push(
        `${id}: evidence 被删除过(${older[i].__sha ?? 'HEAD'} 比 ${older[i + 1].__sha ?? 'HEAD^'} ` +
          `少 ${prior} → ${newer} 条)`,
      )
    }
  }
  return errors
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
