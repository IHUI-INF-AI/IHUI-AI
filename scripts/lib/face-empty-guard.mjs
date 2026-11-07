#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * face-empty-guard.mjs —— 「空输入即未判定」的唯一判定 helper(2026-11-07)
 *
 * 病根:`枚举结果 = 0` / `读取结果全 null` 被当成"确实没有",于是门在**没读到任何东西**时
 * 判绿或判死。2026-11-07 的真实事故:
 *   · check-guarded-write-affected.mjs `::path` ⇒ 1411 个文件全取不到,门跑了但从未判过;
 *   · check-generator-resource-release.mjs:702 staged 面 12 个路径正文全取不到 ⇒ exit 2;
 *   · check-live-doc-duplicates.mjs --staged 把被审文档枚举成 0 份 ⇒ 判死;
 *   · check-rn-compat-coverage.mjs C10 逐文件读取失败被当成"文件不存在" ⇒ 闭包缩水。
 *
 * 口径(可复用,新门一律走这里,别再各写一份):
 *   · `count === 0` 且 `emptyIsReal !== true` ⇒ 抛 `FaceInputUnavailable`("取数面不可用");
 *   · `requested > 0` 且可读 `readable === 0` ⇒ 同上;
 *   · 只有调用方**显式声明**"这个面上确实可以没有"(如首次新增文件在 HEAD 面确实不存在)
 *     才允许 `emptyIsReal: true`,并把理由写进 `reason`(供报告原文打印,禁止口头豁免)。
 *
 * 注意:本 helper **不判"哪些缺失是合法的"** —— 那是语义判断(见防线文档 §4);
 * 它只拒绝"0 当成结论"这一种静默失败。
 */

import { maskCommentsKeepLayout } from './face-spec-scan.mjs'

export class FaceInputUnavailable extends Error {
  constructor(message, info = {}) {
    super(message)
    this.name = 'FaceInputUnavailable'
    this.code = 'FACE_INPUT_UNAVAILABLE'
    this.face = info.face ?? null
    this.stage = info.stage ?? null
    this.count = info.count ?? null
  }
}

function label(info) {
  return `${info.face ?? '未知面'}${info.stage ? `/${info.stage}` : ''}`
}

/**
 * 枚举面保护:0 条且未显式声明"确实没有" ⇒ 抛错。
 * @param {{face:string, stage?:string, count:number, emptyIsReal?:boolean, reason?:string}} arg
 */
export function assertFaceEnumeration({ face, stage = '', count, emptyIsReal = false, reason = '' }) {
  if (!Number.isInteger(count) || count < 0) {
    throw new FaceInputUnavailable(`取数面不可用:${label({ face, stage })} 枚举计数非法(${String(count)})`, { face, stage, count })
  }
  if (count === 0) {
    if (emptyIsReal !== true) {
      throw new FaceInputUnavailable(
        `取数面不可用:${label({ face, stage })} 枚举到 0 条,且未声明"确实没有"(禁止把空输入当成空结论)`,
        { face, stage, count },
      )
    }
    if (!reason) {
      throw new FaceInputUnavailable(
        `未判定:${label({ face, stage })} 声明 emptyIsReal 但未给 reason(口头豁免不算证据)`,
        { face, stage, count },
      )
    }
    return { ok: true, empty: true, reason }
  }
  return { ok: true, empty: false, reason: '' }
}

/**
 * 读取面保护:要求读了 requested 条,实际可读 0 条 ⇒ 抛错(逐条 null 的合法缺失不在此列)。
 * @param {{face:string, stage?:string, requested:number, readable:number, emptyIsReal?:boolean, reason?:string}} arg
 */
export function assertFaceRead({ face, stage = '', requested, readable, emptyIsReal = false, reason = '' }) {
  if (!Number.isInteger(requested) || requested < 0 || !Number.isInteger(readable) || readable < 0) {
    throw new FaceInputUnavailable(`取数面不可用:${label({ face, stage })} 读取计数非法`, { face, stage })
  }
  if (requested === 0) return assertFaceEnumeration({ face, stage, count: 0, emptyIsReal, reason })
  if (readable === 0) {
    throw new FaceInputUnavailable(
      `取数面不可用:${label({ face, stage })} 请求 ${requested} 个路径,正文全部取不到(不得当成"文件不存在")`,
      { face, stage, count: requested },
    )
  }
  return { ok: true, empty: false, reason: '' }
}

/** 未判定出口:统一文案,返回 exit code 2(调用方 `process.exit(undeterminedExit(e))`)。 */
export function undeterminedExit(err, log = console.error) {
  log(`未判定:${err?.message ?? err}`)
  return 2
}

/**
 * 只读静态分类(供 `check-face-empty-guard-coverage.mjs` 与测试共用):
 * 判断一个门源码是否"有三面旗 / 有枚举 / 有零值判定 / 零值旁边有 exit 2 或未判定出口"。
 * 这是**启发式盘点**,不是语义证明 —— 结论必须按 `verdict` 原文展示,不得当成绿灯依据。
 */
/**
 * 升级(2026-11-07 用户裁定):分类必须可审计,不许靠缩小/扩大行窗口消掉条目。
 *  - `structure-balance`:零值变量是括号/层级配平(`depth`/`d`/`norm` 计数),或 `buf[i] === 0` 字节哨兵;
 *  - `selftest-assertion`:零值是 self-test 断言助手(ok/check/t/expect/assert/req/add)的参数;
 *  - `guarded`:零值判定与未判定出口在**同一函数作用域**内(顶层脚本按顶层执行路径);
 *  - `real-hole`:零值作用在已知输入集合上,作用域内找不到未判定出口;
 *  - `manual-review`:结果计数/内部中间量/解析不出左值 —— 判不准,交人工。
 * `verdict` 保持旧值(guarded/missing-guard/...),`classification` 才是新口径。
 */
const STRUCTURAL_VARS = new Set(['depth', 'd', 'nesting', 'parenDepth', 'braceDepth', 'stackDepth'])
const INPUT_VARS =
  /^(?:files?|paths?|relPaths|rels?|texts?|contents?|candidates?|list|lists|rows?|readable|scanned|checked|enumerated|entries|specs?|specCount|targets?|sources?|corpus|bundles?|docs?|endpoints?|callbacks?|pyChanges|facePaths|imageOnly|domestic|plaintextPaths|treeRows|staged|seeds?|handlerFiles|handlers|links|assets|packages|units)$/
const SELFTEST_FN_RE = /self-?test|selftest/i
const SELFTEST_HELPER_RE = /^\s*(ok|check|t|expect|assert|req|add)\s*\(/
const SELFTEST_SIGNAL_RE = /--self-test|function\s+selfTest|selfTest\s*\(|self-?test\s*\(/i
const GUARD_RE =
  /exit\s*\(\s*2\s*\)|return\s+2\b|exit\s*=\s*2\b|code\s*:\s*2\b|rc\s*:\s*2\b|status\s*=\s*2\b|undeterminedExit|FaceInputUnavailable|state\s*:\s*['"]undetermined['"]|Unjudged|EXIT_UNKNOWN|EXIT_UNDETERMINED|未判定|取数面/
const ZERO_RE = /===\s*0\b/

function zeroLeft(line) {
  const m = line.match(
    /([A-Za-z_$][\w$]*(?:(?:\.(?:length|size))|(?:\[[^\]]*\])|(?:\.[A-Za-z_$][\w$]*))*)\s*===\s*0\b/,
  )
  if (!m) return null
  const raw = m[1]
  return {
    raw,
    root: raw.replace(/\.(?:length|size)$/, '').split(/[.[]/)[0],
    subscript: /\[[^\]]*\]/.test(raw),
  }
}

/**
 * 按行求花括号累计深度:跳过字符串/模板/正则/注释,避免 `${C.bold}`、`/['"]/` 这类
 * 内容把配平算歪(实测会把一个 13 行的函数算到文件末尾,进而把任意 exit 2 认成它的保护)。
 * 返回 `depths[i]` = 第 i 行结束时的深度。
 */
function braceDepths(lines) {
  const depths = []
  let depth = 0
  let quote = null
  let blockComment = false
  let regex = false
  let regexClass = false
  let escaped = false
  let prev = ''
  for (const line of lines) {
    let lineComment = false
    for (let j = 0; j < line.length; j += 1) {
      const ch = line[j]
      if (lineComment) break
      if (blockComment) {
        if (ch === '*' && line[j + 1] === '/') {
          blockComment = false
          j += 1
        }
        continue
      }
      if (quote) {
        if (escaped) {
          escaped = false
          continue
        }
        if (ch === '\\') {
          escaped = true
          continue
        }
        if (ch === quote) {
          quote = null
          prev = ch
        }
        continue
      }
      if (regex) {
        if (escaped) {
          escaped = false
          continue
        }
        if (ch === '\\') {
          escaped = true
          continue
        }
        if (ch === '[') {
          regexClass = true
          continue
        }
        if (ch === ']') {
          regexClass = false
          continue
        }
        if (ch === '/' && !regexClass) {
          regex = false
          prev = ch
        }
        continue
      }
      if (ch === '/' && line[j + 1] === '/') {
        lineComment = true
        break
      }
      if (ch === '/' && line[j + 1] === '*') {
        blockComment = true
        j += 1
        continue
      }
      if (ch === ' ' || ch === '\t') continue
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch
        continue
      }
      if (ch === '/' && '([{,;:=!&|?+*-%^~<>'.includes(prev)) {
        regex = true
        regexClass = false
        continue
      }
      if (ch === '{') depth += 1
      else if (ch === '}') depth -= 1
      prev = ch
    }
    depths.push(depth)
    // 未闭合的引号/正则跨行时容错复位:宁可少算一层,不可把整份文件算成一个大函数。
    if (quote || regex) {
      quote = null
      regex = false
      regexClass = false
      escaped = false
    }
  }
  return depths
}

function functionRanges(lines) {
  const ranges = []
  const depths = braceDepths(lines)
  const startRe =
    /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\s*)?\([^)]*\)\s*=>/
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(startRe)
    if (!m) continue
    const base = i > 0 ? depths[i - 1] : 0
    let k = i
    while (k < lines.length && depths[k] <= base) k += 1
    if (k === lines.length) {
      ranges.push({ name: m[1] || m[2] || '(anonymous)', start: i, end: lines.length - 1 })
      continue
    }
    while (k < lines.length && depths[k] > base) k += 1
    ranges.push({ name: m[1] || m[2] || '(anonymous)', start: i, end: Math.min(k, lines.length - 1) })
  }
  return ranges
}

function enclosingFunction(ranges, line) {
  let best = null
  for (const r of ranges) {
    if (r.start <= line && line <= r.end && (!best || r.start > best.start)) best = r
  }
  return best
}

function findIncrementLine(lines, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const inc = new RegExp(`\\b${esc}\\b\\s*(?:\\+\\+|--|\\+=\\s*1|-=\\s*1)`)
  const init = new RegExp(`\\b${esc}\\b\\s*=\\s*0\\b`)
  for (let i = 0; i < lines.length; i += 1) if (inc.test(lines[i])) return i + 1
  for (let i = 0; i < lines.length; i += 1) if (init.test(lines[i])) return i + 1
  return null
}

/**
 * 每行开头所处的 `{` 块栈(元素是块的起始行号)。用于判断零值判定与 exit 2 是否在
 * **同一条执行路径**上:同一 `if/else` 的两个兄弟分支不算同一条路径(实测 rounded-full:
 * 索引分支的 0 值被全量分支的 exit 2 误当成保护)。
 */
function openStacks(lines) {
  const stacks = []
  const stack = []
  let quote = null
  let blockComment = false
  let regex = false
  let regexClass = false
  let escaped = false
  let prev = ''
  for (let i = 0; i < lines.length; i += 1) {
    stacks.push([...stack])
    let lineComment = false
    for (let j = 0; j < lines[i].length; j += 1) {
      const ch = lines[i][j]
      if (lineComment) break
      if (blockComment) {
        if (ch === '*' && lines[i][j + 1] === '/') {
          blockComment = false
          j += 1
        }
        continue
      }
      if (quote) {
        if (escaped) {
          escaped = false
          continue
        }
        if (ch === '\\') {
          escaped = true
          continue
        }
        if (ch === quote) {
          quote = null
          prev = ch
        }
        continue
      }
      if (regex) {
        if (escaped) {
          escaped = false
          continue
        }
        if (ch === '\\') {
          escaped = true
          continue
        }
        if (ch === '[') {
          regexClass = true
          continue
        }
        if (ch === ']') {
          regexClass = false
          continue
        }
        if (ch === '/' && !regexClass) {
          regex = false
          prev = ch
        }
        continue
      }
      if (ch === '/' && lines[i][j + 1] === '/') {
        lineComment = true
        break
      }
      if (ch === '/' && lines[i][j + 1] === '*') {
        blockComment = true
        j += 1
        continue
      }
      if (ch === ' ' || ch === '\t') continue
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch
        continue
      }
      if (ch === '/' && '([{,;:=!&|?+*-%^~<>'.includes(prev)) {
        regex = true
        regexClass = false
        continue
      }
      if (ch === '{') stack.push(i)
      else if (ch === '}') stack.pop()
      prev = ch
    }
    if (quote || regex) {
      quote = null
      regex = false
      regexClass = false
      escaped = false
    }
  }
  return stacks
}

function sameExecutionPath(stacks, zeroLine, guardLine) {
  const a = stacks[zeroLine] ?? []
  const b = stacks[guardLine] ?? []
  let p = 0
  while (p < a.length && p < b.length && a[p] === b[p]) p += 1
  return p === Math.min(a.length, b.length)
}

const EARLY_EXIT_RE = /process\s*\.\s*exit\s*\(\s*[01]\s*\)|\breturn\b|\bcontinue\b/

function zeroBlockRange(lines, depths, zeroLine) {
  const base = zeroLine > 0 ? depths[zeroLine - 1] : 0
  let k = zeroLine
  while (k < lines.length && depths[k] <= base) k += 1
  if (k === lines.length) return { start: zeroLine, end: zeroLine }
  while (k < lines.length && depths[k] > base) k += 1
  return { start: zeroLine, end: Math.min(k, lines.length - 1) }
}

function findGuardLine(lines, scope, ranges, stacks, zeroLine, depths) {
  const zeroBlock = zeroBlockRange(lines, depths, zeroLine)
  let earlyExit = null
  for (let i = zeroBlock.start; i <= zeroBlock.end; i += 1) {
    if (EARLY_EXIT_RE.test(lines[i])) {
      earlyExit = i
      break
    }
  }
  for (let i = scope.start; i <= scope.end; i += 1) {
    // 顶层作用域只认顶层执行路径:嵌在别的函数里的 exit 2 不算这一格的保护。
    if (!scope.fn && enclosingFunction(ranges, i)) continue
    if (!GUARD_RE.test(lines[i]) || !sameExecutionPath(stacks, zeroLine, i)) continue
    // 零值分支已经 exit/return 掉,后面的出口到不了这条路径 ⇒ 不算保护。
    if (earlyExit !== null && (i > zeroBlock.end || i > earlyExit)) continue
    return i + 1
  }
  return null
}

function classifyZero(lines, idx, ranges, selfTestSignal, stacks, depths) {
  const left = zeroLeft(lines[idx])
  if (!left) {
    return { cls: 'manual-review', reason: '零值左值无法解析,需人工确认', evidence: { zeroLine: idx + 1 } }
  }
  const ev = { varName: left.root, zeroLine: idx + 1 }
  if (left.subscript && ['buf', 'buffer', 'bytes'].includes(left.root)) {
    return {
      cls: 'verified-false-positive',
      sub: 'structure-balance',
      reason: `字节 NUL 哨兵 ${left.raw} === 0,不是集合为空`,
      evidence: { ...ev, readAt: idx + 1 },
    }
  }
  if (STRUCTURAL_VARS.has(left.root)) {
    const readAt = findIncrementLine(lines, left.root)
    if (readAt) {
      return {
        cls: 'verified-false-positive',
        sub: 'structure-balance',
        reason: `${left.root} 的 0 值是括号/层级配平(${readAt} 行可见增减),不是集合为空`,
        evidence: { ...ev, readAt },
      }
    }
    return { cls: 'manual-review', reason: `${left.root} 像结构计数但找不到增减行,需人工确认`, evidence: ev }
  }
  const fn = enclosingFunction(ranges, idx)
  if (fn && SELFTEST_FN_RE.test(fn.name)) {
    return {
      cls: 'verified-false-positive',
      sub: 'selftest-assertion',
      reason: `零值断言在 self-test 函数 ${fn.name}(${fn.start + 1} 行)内,0 即该夹具正确`,
      evidence: { ...ev, selftestFn: fn.name, fnStartLine: fn.start + 1 },
    }
  }
  if (selfTestSignal >= 0 && SELFTEST_HELPER_RE.test(lines[idx])) {
    const helper = lines[idx].trim().match(SELFTEST_HELPER_RE)[1]
    return {
      cls: 'verified-false-positive',
      sub: 'selftest-assertion',
      reason: `零值是 self-test 断言助手 ${helper}(...) 的参数(${selfTestSignal + 1} 行有 self-test 入口),0 即夹具正确`,
      evidence: { ...ev, selftestFn: helper, fnStartLine: idx + 1 },
    }
  }
  const scope = fn ? { start: fn.start, end: fn.end, fn } : { start: 0, end: lines.length - 1, fn: null }
  const guard = findGuardLine(lines, scope, ranges, stacks, idx, depths)
  if (guard) {
    return {
      cls: 'guarded',
      reason: `零值判定与未判定出口在同一${fn ? `函数 ${fn.name}` : '顶层执行路径'}(${guard} 行)`,
      evidence: { ...ev, scopeStart: scope.start + 1, scopeEnd: scope.end + 1, scopeGuardLine: guard },
    }
  }
  if (INPUT_VARS.test(left.root)) {
    return {
      cls: 'real-hole',
      reason: `零值作用在输入集合 ${left.raw},作用域内没有 exit 2 / 未判定出口`,
      evidence: { ...ev, scopeStart: scope.start + 1, scopeEnd: scope.end + 1, scopeGuardLine: null },
    }
  }
  return {
    cls: 'manual-review',
    reason: `零值 ${left.raw} 不是已知输入集合(疑似结果计数/中间量),需人工确认`,
    evidence: { ...ev, scopeStart: scope.start + 1, scopeEnd: scope.end + 1 },
  }
}

export function classifyFaceGateSource(src) {
  if (typeof src !== 'string' || src.length === 0) {
    return { verdict: 'not-face-gate', classification: 'not-face-gate', reason: '空源码' }
  }
  const code = maskCommentsKeepLayout(src)
  const faceFlag = /\B--(?:staged|worktree|head)\b/.test(code)
  if (!faceFlag) return { verdict: 'not-face-gate', classification: 'not-face-gate', reason: '无三面旗' }

  const enumerates =
    /listFaceFiles|readFaceBatch|readFaceOne|catBatch|ls-files|ls-tree|git\s+grep|gitRaw\(\[[^\]]*(?:ls-files|ls-tree|diff)|readdirSync|readdir\(/.test(
      code,
    )
  if (!enumerates) return { verdict: 'no-enumeration', classification: 'no-enumeration', reason: '有三面旗但未见批量枚举' }

  // 统一 helper 的调用点就是标准保护:0 值判定在 helper 内部,门里不会出现字面 `=== 0`。
  if (/assertFaceEnumeration|assertFaceRead/.test(code)) {
    return {
      verdict: 'guarded',
      classification: 'guarded',
      reason: '走统一 helper(assertFaceEnumeration/assertFaceRead)',
      evidence: { helper: true },
    }
  }

  const lines = code.split('\n')
  const zeroIdx = []
  lines.forEach((l, i) => {
    if (ZERO_RE.test(l)) zeroIdx.push(i)
  })
  if (zeroIdx.length === 0) return { verdict: 'no-zero-check', classification: 'no-zero-check', reason: '有枚举但未见 0 值判定' }

  const ranges = functionRanges(lines)
  const stacks = openStacks(lines)
  const depths = braceDepths(lines)
  const selfTestSignal = lines.findIndex((l) => SELFTEST_SIGNAL_RE.test(l))
  const results = zeroIdx.map((i) => classifyZero(lines, i, ranges, selfTestSignal, stacks, depths))

  // 整体优先级:只要还有真洞就报真洞;其次人工;再次已保护;全部是误报才归误报。
  const priority = ['real-hole', 'manual-review', 'guarded', 'verified-false-positive']
  const cls = priority.find((p) => results.some((r) => r.cls === p)) ?? 'manual-review'
  const primary = results.find((r) => r.cls === cls)
  const verdict = cls === 'guarded' ? 'guarded' : 'missing-guard'
  return {
    verdict,
    classification: cls,
    reason: primary.reason,
    evidence: primary.evidence,
    excused: primary.sub ?? null,
    zeros: results.map((r) => ({ cls: r.cls, sub: r.sub ?? null, reason: r.reason, evidence: r.evidence })),
  }
}

export const __test__ = { classifyFaceGateSource, assertFaceEnumeration, assertFaceRead, functionRanges, zeroLeft }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
