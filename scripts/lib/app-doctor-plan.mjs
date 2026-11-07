// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * app-doctor-plan.mjs —— 装机自诊的问题分级与复扫合并（纯函数，零 IO）
 *
 * 扫描产出问题集，按种类分组后批量处置，再扫一遍，按 id 合并新旧问题。
 * 闭集里的每一类必须恰好有一条出路：repair（自动动作名）或 muteReason（静默理由）。
 * 两条都没有、或两条都有，都不算有出路。
 * 任一侧扫描为 null 表示这次没量到，禁止当成空数组把旧问题全部标成已关闭。
 */

/** 装机问题种类闭集。表外的 kind 一律不自动处置。 */
export const INSTALL_ISSUE_KINDS = Object.freeze([
  'unknown',
  'dir-inaccessible',
  'package-unpacked',
  'disk-space',
  'network',
])

/** 默认出路表。每种恰好一个字段：unknown 静默，其余四类是短动作名。 */
const INSTALL_ISSUE_ACTIONS = Object.freeze({
  unknown: Object.freeze({ muteReason: '种类未识别，不自动改盘' }),
  'dir-inaccessible': Object.freeze({ repair: 'restore-acl' }),
  'package-unpacked': Object.freeze({ repair: 'repack' }),
  'disk-space': Object.freeze({ repair: 'free-cache' }),
  network: Object.freeze({ repair: 'recheck-route' }),
})

function filledString(value) {
  return typeof value === 'string' && value.length > 0
}

/**
 * 在给定表上决定 kind 的出路。测试传入缺字段的表时走这里，不改默认表。
 * @param {string} kind
 * @param {Record<string, {repair?: string, muteReason?: string}>} table
 * @returns {{ok:true, kind:string, repair?:string, muteReason?:string} | {ok:false, reason:'kind-unknown'|'action-absent'|'action-both'}}
 */
export function actionFor(kind, table) {
  if (typeof kind !== 'string' || table === null || typeof table !== 'object') {
    return { ok: false, reason: 'kind-unknown' }
  }
  if (!Object.hasOwn(table, kind)) return { ok: false, reason: 'kind-unknown' }
  const row = table[kind]
  if (row === null || typeof row !== 'object') return { ok: false, reason: 'action-absent' }
  const hasRepair = filledString(row.repair)
  const hasMute = filledString(row.muteReason)
  if (hasRepair && hasMute) return { ok: false, reason: 'action-both' }
  if (!hasRepair && !hasMute) return { ok: false, reason: 'action-absent' }
  if (hasRepair) return { ok: true, kind, repair: row.repair }
  return { ok: true, kind, muteReason: row.muteReason }
}

/**
 * 用默认表决定 kind 的出路。
 * @param {string} kind
 */
export function planIssueAction(kind) {
  return actionFor(kind, INSTALL_ISSUE_ACTIONS)
}

function indexIssues(rows) {
  if (!Array.isArray(rows)) return null
  const map = new Map()
  for (const row of rows) {
    if (row === null || typeof row !== 'object') return null
    if (typeof row.id !== 'string' || row.id.length === 0) return null
    if (map.has(row.id)) return null
    if (!planIssueAction(row.kind).ok) return null
    map.set(row.id, row.kind)
  }
  return map
}

/**
 * 合并前后两次扫描。null 是没量到，不是「没有问题」。
 * @param {Array<{id:string, kind:string}> | null} previous
 * @param {Array<{id:string, kind:string}> | null} next
 */
export function mergeRescan(previous, next) {
  if (previous === null || next === null) {
    return { ok: false, reason: 'scan-unmeasured', issues: null }
  }
  const prev = indexIssues(previous)
  const nxt = indexIssues(next)
  if (!prev || !nxt) return { ok: false, reason: 'row-invalid' }
  const ids = [...prev.keys(), ...nxt.keys()]
    .filter((id, index, all) => all.indexOf(id) === index)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const issues = ids.map((id) => {
    const inPrev = prev.has(id)
    const inNext = nxt.has(id)
    if (inPrev && inNext) return { id, kind: nxt.get(id), status: 'still-open' }
    if (inPrev) return { id, kind: prev.get(id), status: 'closed' }
    return { id, kind: nxt.get(id), status: 'opened' }
  })
  return { ok: true, issues }
}

const defaultKeys = Object.keys(INSTALL_ISSUE_ACTIONS)
if (defaultKeys.length !== INSTALL_ISSUE_KINDS.length || new Set(INSTALL_ISSUE_KINDS).size !== INSTALL_ISSUE_KINDS.length) {
  throw new Error('INSTALL_ISSUE_KINDS 与默认出路表没有一一对应')
}
for (const kind of INSTALL_ISSUE_KINDS) {
  if (!Object.hasOwn(INSTALL_ISSUE_ACTIONS, kind) || !planIssueAction(kind).ok) {
    throw new Error(`默认出路表缺少可用的 ${kind}`)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
