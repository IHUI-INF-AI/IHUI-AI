// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ledger-retirement.mjs —— 台账「授权退休」标记的唯一实现(2026-11-05,G-814414 补格)。
 *
 * 要解的体系缺陷:**台账里裁决完的条目被合法摘除**,与**文件内容被意外丢失**,过去在
 * `object-space-land` 的 .jsonl 键路径档里长得一模一样 —— 摘 3 行合法条目会报
 * 「G-814414 内容消失」并拒落。本层只定义"退休"这一形态与身份口径,判据在
 * scripts/object-space-land.mjs(`jsonRetirementAudit`),消费面(门 299)在
 * scripts/lib/miniapp-shell-form.mjs。
 *
 * 退休行 = 原条目**保留下来** + 五个标记:
 *   retiredAt        ISO-8601 时刻
 *   retiredReason    定向理由(trim 后 ≥ RETIRE_REASON_MIN_CHARS 码点)
 *   retiredBy        归属(谁授权的)
 *   retiredFrom      原条目原文的规范 JSON(canonical,键序不敏感)
 *   retiredFromSha   retiredFrom 的 sha256(64 位小写十六进制)
 * 「删行」不再合法;「标记退休」才合法,且每一条被摘条目都必须有且只有一条退休行。
 */

export const RETIRE_MARKER_KEYS = ['retiredAt', 'retiredReason', 'retiredBy', 'retiredFrom', 'retiredFromSha']
export const RETIRE_REASON_MIN_CHARS = 10
export const RETIRED_AT_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/
export const RETIRED_FROM_SHA_RE = /^[0-9a-f]{64}$/

/** 哪些路径启用退休通道。这次只覆盖 scripts/data 下的 JSONL 台账族与数组型 web-rn 台账。 */
export function retirementChannelFor(path) {
  const p = String(path ?? '').replace(/\\/g, '/')
  if (/^scripts\/data\/[^/]+\.jsonl$/.test(p)) return 'jsonl-ledger'
  if (p === 'scripts/data/web-rn-copy-diffs.json') return 'json-array-ledger'
  return null
}

/** 是否退休行(五个标记都在)。 */
export function isRetiredRecord(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  return RETIRE_MARKER_KEYS.every((k) => Object.prototype.hasOwnProperty.call(v, k))
}

/** 剥掉退休标记后的原条目。 */
export function stripRetireMarkers(v) {
  const o = {}
  for (const [k, val] of Object.entries(v)) if (!RETIRE_MARKER_KEYS.includes(k)) o[k] = val
  return o
}

/**
 * 条目身份:值编辑不算摘除(身份仍在),身份消失才算摘除。
 * 组按"最具体 → 最泛"排序,命中第一组全字段即用;都没有才退到整条规范形。
 */
const IDENTITY_GROUPS = [
  ['route', 'file'],
  ['page', 'key'],
  ['end', 'prefix'],
  ['end', 'file', 'expr'],
  ['file', 'rule'],
  ['file', 'expr'],
  ['shared', 'domain'],
  // web-rn 配对台账的复合主键(全仓唯一同时带 web 与 rn 两个键的 jsonl)。缺这一组时该文件的行
  // 只能退到 `canon:` 整条规范形当身份 ⇒ 任何一次逐条附证据的改判(改 status/note/domainAudit)
  // 都被读成「摘一条 + 新增一条」并索要 retired 标记 —— 而那条目并没有退休。
  ['web', 'rn'],
  ['bucket', 'side', 'kind', 'prop'],
  ['key'],
  ['id'],
  ['path'],
  ['file'],
]

export function retireIdentityOf(rec) {
  if (rec && typeof rec === 'object' && !Array.isArray(rec)) {
    for (const group of IDENTITY_GROUPS) {
      if (group.every((k) => rec[k] !== undefined && rec[k] !== null)) {
        return `${group.join('+')}:${group.map((k) => String(rec[k])).join('\u0000')}`
      }
    }
  }
  return `canon:${canonicalOf(rec)}`
}

/** 规范形:对象键序不敏感,数组保序。退休标记与判据共用这一把尺。 */
export function canonicalOf(v) {
  if (Array.isArray(v)) return JSON.stringify(v.map((x) => JSON.parse(canonicalOf(x))))
  if (v && typeof v === 'object') {
    const o = {}
    for (const k of Object.keys(v).sort()) o[k] = JSON.parse(canonicalOf(v[k]))
    return JSON.stringify(o)
  }
  return JSON.stringify(v)
}

export const __test__ = {
  RETIRE_MARKER_KEYS,
  RETIRE_REASON_MIN_CHARS,
  RETIRED_AT_RE,
  RETIRED_FROM_SHA_RE,
  retirementChannelFor,
  isRetiredRecord,
  stripRetireMarkers,
  retireIdentityOf,
  canonicalOf,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
