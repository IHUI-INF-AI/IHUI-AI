// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * content-loss-gate.mjs —— **合面前后的内容级防丢闸**(2026-11-05,独立于结构缺陷票)。
 *
 * ## 治的是"整份取对侧"这条下游病
 *
 * 行/文件面判据只能证明"路径还在",证明不了"里面的键还在"。一次 `--take-theirs-doc` /
 * `keptTheirs` 把整份对侧盖过来,路径照样在位,`scripts/data/*.json` 少 17 个键、
 * 测试文件少 3 个用例,任何"文件数一致"的闸都看不见。本层只问**内容**:
 *
 *   · `scripts/data/*.json`、`*.jsonl`、`packages/i18n/messages/**\/*.json`
 *       —— 递归键集差集:`oursKeys − mergedKeys` 与 `theirsKeys − mergedKeys` 必须为空;
 *          JSONL 按记录并集取键,任一行解不开 ⇒ 未判定即判红(不静默当空表)。
 *   · 活文档(`PROJECT_PLAN.md`、`README.md`)与 `AGENTS.md`
 *       —— 行级包含:两侧的非空行(去首尾空白比较)必须仍出现在合并结果里,多重集计数
 *          (两侧都有的同一行只要求一份)。
 *
 * 非空即判红并**点名**缺失键/行;判定失败(rev 取不到 / JSON 解不开)同样判红 ——
 * §0.3:判不出不是放行的许可证。本层不参与"要不要删文件"的判断(那是旁路删除硬门的射程)。
 */
import { gitRaw } from './face-reader.mjs'

/** `scripts/data` 下的数据件(含子目录)与五语言词包。 */
export const KEY_SET_PATH_RE = /^(?:scripts\/data\/(?:.*\/)?[^/]+\.(?:json|jsonl)|packages\/i18n\/messages\/(?:.*\/)?[^/]+\.json)$/
/** 行级包含的活文档(与 union-converge 的 LIVE_DOCS 同口径);`AGENTS.md` 单列要求,这里一并覆盖。 */
export const DEFAULT_LIVE_DOCS = ['PROJECT_PLAN.md', 'AGENTS.md', 'README.md']

export const __MAX_LISTED = 40

function readRev(root, rev, path) {
  try {
    return gitRaw(['show', `${rev}:${path}`], root, { timeout: 60_000 })
  } catch {
    return null // 该 rev 没有这份文件(新增 / 删除)
  }
}

function diffNames(root, a, b) {
  try {
    return gitRaw(['diff', '--name-only', a, b], root, { timeout: 60_000 })
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean)
  } catch {
    return null
  }
}

/** JSON 递归键集:数组按 `[]` 折叠(不给下标),对象键拼点路径。 */
export function jsonKeySet(value, prefix = '', out = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) jsonKeySet(item, `${prefix}[]`, out)
    return out
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const p = prefix ? `${prefix}.${k}` : k
      out.add(p)
      jsonKeySet(v, p, out)
    }
  }
  return out
}

/** 文本 → 键集;JSONL 逐行并集。解不开返回 `{error}`(调用方必须判红)。 */
export function textKeySet(text, path) {
  if (text === null || text === undefined) return { keys: new Set(), absent: true }
  try {
    if (/\.jsonl$/i.test(path)) {
      const keys = new Set()
      const lines = String(text).split(/\r?\n/).filter((l) => l.trim())
      for (const line of lines) jsonKeySet(JSON.parse(line), '', keys)
      return { keys }
    }
    return { keys: jsonKeySet(JSON.parse(String(text).replace(/^\uFEFF/, ''))) }
  } catch (e) {
    return { error: `${path} 的 JSON 解不开:${String(e?.message ?? e).slice(0, 120)}` }
  }
}

/** 非空行多重集(去首尾空白比较,行内空白不动)。 */
export function lineMultiset(text) {
  const m = new Map()
  if (text === null || text === undefined) return m
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    m.set(line, (m.get(line) || 0) + 1)
  }
  return m
}

/** side 里有、merged 里不够的行(点名用)。 */
export function missingLines(sideText, mergedText) {
  const have = lineMultiset(mergedText)
  const missing = []
  for (const [line, count] of lineMultiset(sideText)) {
    const got = have.get(line) || 0
    if (got < count) missing.push(line)
  }
  return missing
}

/** `sideKeys − mergedKeys`,排序后返回。 */
export function missingKeys(sideKeys, mergedKeys) {
  return [...sideKeys].filter((k) => !mergedKeys.has(k)).sort()
}

/**
 * 判定一次合并的内容面。
 *
 * @param {{root:string, ours:string, theirs:string, merged:string, paths?:string[],
 *          liveDocs?:string[], read?: (rev:string,path:string)=>string|null}} a
 * @returns {{ok:boolean, checked:string[], violations:Array<{path:string,kind:string,
 *           missingOurs:string[], missingTheirs:string[], error?:string}>, undetermined:string[]}}
 */
export function judgeContentLoss({
  root,
  ours,
  theirs,
  merged,
  paths,
  liveDocs = DEFAULT_LIVE_DOCS,
  read = (rev, path) => readRev(root, rev, path),
}) {
  const undetermined = []
  let candidates = paths ? [...new Set(paths)] : null
  if (!candidates) {
    const a = diffNames(root, ours, merged)
    const b = diffNames(root, theirs, merged)
    if (a === null || b === null) {
      undetermined.push(`合并前后差集取不到(${ours}..${merged} / ${theirs}..${merged})`)
      candidates = []
    } else candidates = [...new Set([...a, ...b])]
  }
  const scoped = candidates.filter((p) => KEY_SET_PATH_RE.test(p) || liveDocs.includes(p))
  const violations = []
  for (const p of scoped) {
    const o = read(ours, p)
    const t = read(theirs, p)
    const m = read(merged, p)
    if (KEY_SET_PATH_RE.test(p)) {
      const mo = textKeySet(o, p)
      const mt = textKeySet(t, p)
      const mm = textKeySet(m, p)
      const bad = [mo.error, mt.error, mm.error].filter(Boolean)
      if (bad.length) {
        violations.push({ path: p, kind: 'keys', missingOurs: [], missingTheirs: [], error: bad[0] })
        continue
      }
      const missingOurs = missingKeys(mo.keys, mm.keys)
      const missingTheirs = missingKeys(mt.keys, mm.keys)
      if (missingOurs.length || missingTheirs.length)
        violations.push({ path: p, kind: 'keys', missingOurs, missingTheirs })
      continue
    }
    const missingOurs = missingLines(o, m)
    const missingTheirs = missingLines(t, m)
    if (missingOurs.length || missingTheirs.length)
      violations.push({ path: p, kind: 'lines', missingOurs, missingTheirs })
  }
  return { ok: violations.length === 0 && undetermined.length === 0, checked: scoped, violations, undetermined }
}

/** 人类档点名(CLI 与 union-converge --apply 共用同一份措辞)。 */
export function formatLossReport(result, { max = __MAX_LISTED } = {}) {
  const lines = []
  for (const u of result.undetermined) lines.push(`  ⚠️ 未判定:${u}`)
  for (const v of result.violations) {
    if (v.error) {
      lines.push(`  · ${v.path} —— ${v.error}`)
      continue
    }
    for (const [side, list] of [
      ['本侧', v.missingOurs],
      ['对侧', v.missingTheirs],
    ]) {
      if (!list.length) continue
      const shown = list.slice(0, max)
      lines.push(
        `  · ${v.path} —— ${side}缺失${v.kind === 'keys' ? '键' : '行'} ${list.length}:${shown.join(' | ')}` +
          (list.length > max ? ` …另有 ${list.length - max} 个` : ''),
      )
    }
  }
  return lines.join('\n')
}

export const __test__ = { readRev, diffNames, jsonKeySet, textKeySet, lineMultiset, missingLines, missingKeys, judgeContentLoss, formatLossReport }
