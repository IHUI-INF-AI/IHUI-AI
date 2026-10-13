#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本是 CLI 工具,需 console 输出诊断信息 */
/**
 * 未知枚举兜底档守门(G-815963)。
 *
 * 题面:未知枚举的兜底档必须是"不再产生副作用"那一档 —— 兜到初始态等于把已终态的账
 * 放回可写集合(上游反例 session-inputs.ts:369-391:未知 status→'admitted',已终态行
 * 重新进入可 settle 集合,与状态前置 CAS 相互拆台)。
 *
 * 判据(结构/语义特征点名,不扫注释词面):
 *   候选 = 闭集状态集合的成员判定 `SET.includes(v)` / `SET.has(v)` —— SET 标识符须 ① 含
 *          status/state 语义 ② 是集合形(SCREAMING_SNAKE 常量 / statuses / states /
 *          *Statuses / *States);另一候选是唯一出口 `coerceKnownOr(v, known, safe)` 的
 *          safe 实参(enum-coerce.ts 的纪律:safe 档必须逐枚举显式声明为终态档)。
 *   取档 = 未命中分支的落点:
 *          · 三元 `TEST ? ok : F` 的 else 档 F;
 *          · `if (!TEST) return|throw|continue|break …`;
 *          · `if (!TEST) { … return F … }`、`if (TEST) {…} else { … return F … }`。
 *   归类 = 档位词表:初始态/可写档(pending/running/admitted/open/draft/…)⇒ 红;
 *          终态/无副作用档(closed/completed/failed/cancelled/unknown/…)或
 *          null/undefined/throw/continue/break(显式拒绝、不产值)⇒ 绿;
 *          两表皆不中(如 'manual'/'action' 这类非状态语义)、标识符不可解析、表达式落点
 *          ⇒ 中性不判 —— 这就是反向锁,防止"语义不同形"被词面误伤。
 *
 * 族外形态(故意不判,判了就是没有处置对象的假红):
 *   ① 缺键默认 `MAP[status] ?? 'pending'` / `get('status','pending')` —— 缺键 ≠ 未知枚举;
 *   ② 字符串/路径 `.includes`、非状态语义的枚举集合(TRIGGER_TYPES / TASK_TYPES 之类);
 *   ③ 测试文件与 `.d.ts`(测试断言的是机制行为,不是生产兜底站点)。
 *   模板字符串整体按字面量遮蔽,`${}` 内不扫(已知边界,实际无此形态)。
 *
 * 取材面:全量档判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 只作人工逃生舱
 *   (与守门 70/77/83/98 同口径,经 `scripts/lib/face-reader.mjs` 取材 —— 不再按磁盘判)。
 *   2026-10-13 移植:本门原先是"默认扫工作树"的按磁盘判门,注册进 guardian-runner 会在提交链
 *   (runner 对所有门统一追加 --staged)直接 exit 2,且落进 check-gate-face-discipline 的
 *   loose-fs 红集。显式给路径则只判给定文件/目录(相对仓库根)。
 * 退出码:0 无红 / 1 有红 / 2 用法错或无法判定(路径在该面不存在、判据取不到输入)。
 * 用法:node scripts/check-enum-fallback-terminal.mjs [--self-test] [--staged|--worktree] [路径…]
 * 登记:scripts/guardian-runner.mjs id 205(2026-10-13 主会话接线,见文末)。
 */
import { readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  FACE_LABEL,
  FACE_NOTE,
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** 本门在守门注册表里的身份(assertRepoRoot 的报错标签 / 文档指路)。 */
const SELF = 'scripts/check-enum-fallback-terminal.mjs'

/** 初始态/可写档:未知值兜到这里 = 把已终态的账放回可写集合(判红)。 */
export const INITIAL_TIERS = new Set([
  'pending',
  'pending_payment',
  'created',
  'new',
  'open',
  'opened',
  'draft',
  'queued',
  'waiting',
  'ready',
  'admitted',
  'registered',
  'active',
  'activated',
  'running',
  'in_progress',
  'in-progress',
  'started',
  'initiated',
  'todo',
  'idle',
  'initialized',
  'unread',
  'processing',
])

/** 终态/无副作用档:未知值兜到这里不再产生副作用(判绿)。 */
export const TERMINAL_TIERS = new Set([
  'completed',
  'complete',
  'finished',
  'done',
  'success',
  'succeeded',
  'failed',
  'failure',
  'error',
  'errored',
  'cancelled',
  'canceled',
  'closed',
  'timeout',
  'timed_out',
  'timedout',
  'expired',
  'rejected',
  'denied',
  'disabled',
  'archived',
  'terminated',
  'stopped',
  'aborted',
  'settled',
  'resolved',
  'unknown',
  'skipped',
  'inactive',
  'removed',
  'deleted',
  'consumed',
  'exhausted',
])

/** 字面量 → 档位:'initial' | 'terminal' | null(中性,不判)。 */
export function classifyTier(value) {
  const v = String(value ?? '')
    .trim()
    .toLowerCase()
  if (INITIAL_TIERS.has(v)) return 'initial'
  if (TERMINAL_TIERS.has(v)) return 'terminal'
  return null
}

// ---------- 源码遮蔽(注释清空、字符串内容置 \x00,保持偏移与行号不变) ----------

function maskString(src, out, i) {
  const q = src[i]
  let j = i + 1
  while (j < src.length) {
    if (src[j] === '\\') {
      if (out) {
        out[j] = '\x00'
        if (j + 1 < src.length) out[j + 1] = '\x00'
      }
      j += 2
      continue
    }
    if (src[j] === q) return j + 1
    if (src[j] === '\n' && q !== '`') return j // 未闭合字符串,止于行尾
    if (out) out[j] = '\x00'
    j++
  }
  return j
}

function skipString(src, i) {
  return maskString(src, null, i)
}

/** 注释→空格、字符串内容→\x00(引号保留),其余原样;与 src 等长。 */
export function maskSource(src) {
  const out = Array.from(src)
  const n = src.length
  let i = 0
  while (i < n) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') {
        out[i] = ' '
        i++
      }
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      out[i] = ' '
      out[i + 1] = ' '
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] !== '\n') out[i] = ' '
        i++
      }
      if (i < n) {
        out[i] = ' '
        out[i + 1] = ' '
        i += 2
      }
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      i = maskString(src, out, i)
      continue
    }
    i++
  }
  return out.join('')
}

function skipWs(s, i) {
  while (i < s.length && (s[i] === ' ' || s[i] === '\t' || s[i] === '\n' || s[i] === '\r')) i++
  return i
}

function skipWsBack(s, i) {
  while (i > 0 && (s[i - 1] === ' ' || s[i - 1] === '\t' || s[i - 1] === '\n' || s[i - 1] === '\r')) i--
  return i
}

function readIdent(s, i) {
  let j = i
  if (j < s.length && /[A-Za-z_$]/.test(s[j])) {
    j++
    while (j < s.length && /[\w$]/.test(s[j])) j++
    return { name: s.slice(i, j), end: j }
  }
  return { name: '', end: i }
}

function readStringLiteral(src, i) {
  const q = src[i]
  let j = i + 1
  let v = ''
  while (j < src.length) {
    const ch = src[j]
    if (ch === '\\') {
      v += src[j + 1] ?? ''
      j += 2
      continue
    }
    if (ch === q) return { value: v, end: j + 1 }
    if (ch === '\n' && q !== '`') return { value: v, end: j }
    v += ch
    j++
  }
  return { value: v, end: j }
}

/** 从 `open` 处的定界符起做嵌套配对(含混型括号),返回配对闭合下标,失败 -1。 */
function matchDelim(code, src, open) {
  const pairs = { '(': ')', '[': ']', '{': '}' }
  const stack = [pairs[code[open]]]
  let i = open + 1
  while (i < code.length) {
    const ch = code[i]
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipString(src, i)
      continue
    }
    if (pairs[ch]) stack.push(pairs[ch])
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (stack[stack.length - 1] === ch) {
        stack.pop()
        if (stack.length === 0) return i
      }
    }
    i++
  }
  return -1
}

/** 三元真分支之后配对的 else 冒号下标(处理嵌套三元与括号),失败 -1。 */
function findElseColon(code, src, start) {
  let tern = 1
  let depth = 0
  let i = start
  while (i < code.length) {
    const ch = code[i]
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipString(src, i)
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    else if (depth === 0 && ch === '?') tern++
    else if (depth === 0 && ch === ':') {
      tern--
      if (tern === 0) return i
    }
    i++
  }
  return -1
}

// ---------- 档位落点解析 ----------

/**
 * 读落点 token:字符串字面量 → 归类;null/undefined → 显式拒绝;标识符 → 查本文件
 * `const NAME = 'lit'` 解析后归类,解析不出 ⇒ null(中性,反向锁);其余 ⇒ null。
 */
function tokenAt(code, src, i, constMap, form) {
  if (i >= src.length) return null
  const ch = src[i]
  if (ch === "'" || ch === '"' || ch === '`') {
    const lit = readStringLiteral(src, i)
    return { tier: classifyTier(lit.value), value: lit.value, form }
  }
  if (ch === '(') {
    const inner = skipWs(code, i + 1)
    const c2 = src[inner]
    if (c2 === "'" || c2 === '"' || c2 === '`') {
      const lit = readStringLiteral(src, inner)
      return { tier: classifyTier(lit.value), value: lit.value, form }
    }
    return null
  }
  const id = readIdent(code, i)
  if (id.name === 'null' || id.name === 'undefined') return { tier: 'reject', value: id.name, form }
  if (id.name) {
    const resolved = constMap.get(id.name)
    if (resolved !== undefined) return { tier: classifyTier(resolved), value: resolved, form, via: id.name }
    return null
  }
  return null
}

/** 在 [from,to) 内找第一个 `return`/`throw`/`continue`/`break` 并取其落点(块内形态)。 */
function firstExitInBlock(code, src, from, to, constMap) {
  const re = /\b(return|throw|continue|break)\b/g
  re.lastIndex = from
  let m
  while ((m = re.exec(code)) && m.index < to) {
    const kw = m[1]
    if (kw === 'continue' || kw === 'break') return { tier: 'reject', value: `${kw}(不产值)`, form: 'guard-block' }
    if (kw === 'throw') return { tier: 'reject', value: 'throw', form: 'guard-block' }
    const k = skipWs(code, m.index + kw.length)
    return tokenAt(code, src, k, constMap, 'guard-block')
  }
  return null
}

/** 成员判定之后的未命中落点:null = 结构不判(中性)。 */
function fallbackOf(ctx) {
  const { code, src, testEnd, negated, constMap } = ctx
  const i = skipWs(code, testEnd)
  if (code[i] === '?') {
    const colon = findElseColon(code, src, i + 1)
    if (colon < 0) return null
    return tokenAt(code, src, skipWs(code, colon + 1), constMap, 'ternary')
  }
  if (code[i] !== ')') return null
  // `if (…TEST…) …` 形态
  const j = skipWs(code, i + 1)
  const kw = readIdent(code, j).name
  if (kw === 'return' || kw === 'throw' || kw === 'continue' || kw === 'break') {
    if (!negated) return null // 正向守卫:非成员走穿透,没有兜底值
    if (kw === 'continue' || kw === 'break') return { tier: 'reject', value: `${kw}(不产值)`, form: 'guard-return' }
    if (kw === 'throw') return { tier: 'reject', value: 'throw', form: 'guard-return' }
    return tokenAt(code, src, skipWs(code, j + kw.length), constMap, 'guard-return')
  }
  if (code[j] === '{') {
    const close = matchDelim(code, src, j)
    if (close < 0) return null
    if (negated) return firstExitInBlock(code, src, j + 1, close, constMap)
    let k = skipWs(code, close + 1)
    if (readIdent(code, k).name !== 'else') return null // 无 else ⇒ 非成员走穿透
    k = skipWs(code, k + 4)
    if (code[k] === '{') {
      const close2 = matchDelim(code, src, k)
      if (close2 < 0) return null
      return firstExitInBlock(code, src, k + 1, close2, constMap)
    }
    const kw2 = readIdent(code, k).name
    if (kw2 === 'return') return tokenAt(code, src, skipWs(code, k + 6), constMap, 'guard-else')
    if (kw2 === 'throw') return { tier: 'reject', value: 'throw', form: 'guard-else' }
    return null
  }
  return null
}

/** 本文件内 `const|let NAME [: T] = 'lit'` 解析表(供标识符落点回溯)。 */
function buildConstMap(src, code) {
  const map = new Map()
  const re = /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*?)?=\s*(['"])/g
  let m
  while ((m = re.exec(code))) {
    const lit = readStringLiteral(src, m.index + m[0].length - 1)
    if (!map.has(m[1])) map.set(m[1], lit.value)
  }
  return map
}

/** 集合标识符:含 status/state 语义 + 集合形(SCREAMING_SNAKE / statuses|states / *Statuses|*States)。 */
export function isStatusSetName(name) {
  if (!/status|state/i.test(name)) return false
  if (/^[A-Z][A-Z0-9_$]*$/.test(name)) return true
  if (/^(statuses|states)$/.test(name)) return true
  if (/[A-Za-z](Statuses|States)$/.test(name)) return true
  return false
}

function lineColOf(src, idx) {
  const before = src.slice(0, idx)
  const line = before.split('\n').length
  return { line, col: idx - before.lastIndexOf('\n') }
}

function pushFinding(out, src, idx, receiver, fb, tierKind) {
  const { line, col } = lineColOf(src, idx)
  out.push({
    line,
    col,
    receiver,
    form: fb.form,
    tier: tierKind,
    value: fb.value,
    via: fb.via,
    raw: `'${fb.value}'`,
  })
}

/** 扫单个源文件:返回 { findings(红+绿), reds, greens, candidates, neutral }。 */
export function scanSource(rel, src) {
  const code = maskSource(src)
  const constMap = buildConstMap(src, code)
  const findings = []
  let candidates = 0
  let neutral = 0

  // ① 成员判定形态:SET.includes(v) / SET.has(v)(含 `(SET as readonly string[])` 加 cast 形)
  const patterns = [
    /\(\s*([A-Za-z_$][\w$]*)\s+as\s+readonly\s+string\[\]\s*\)\s*\.\s*(includes|has)\s*\(/g,
    /([A-Za-z_$][\w$.]*)\s*\.\s*(includes|has)\s*\(/g,
  ]
  const seen = new Set()
  for (const re of patterns) {
    let m
    while ((m = re.exec(code))) {
      const receiver = m[1].split('.').pop() || m[1]
      const open = re.lastIndex - 1 // includes/has 实参表的 `(`
      if (!isStatusSetName(receiver)) continue
      if (seen.has(open)) continue
      seen.add(open)
      const close = matchDelim(code, src, open)
      if (close < 0) continue
      candidates++
      const p = skipWsBack(code, m.index)
      const negated = code[p - 1] === '!'
      const fb = fallbackOf({ code, src, testEnd: close + 1, negated, constMap })
      if (!fb || !fb.tier || fb.tier === 'neutral') {
        neutral++
        continue
      }
      if (fb.tier === 'initial') pushFinding(findings, src, m.index, receiver, fb, 'initial')
      else pushFinding(findings, src, m.index, receiver, fb, fb.tier)
    }
  }

  // ② 唯一出口形态:coerceKnownOr(v, known, safe) —— safe 实参须终态档
  const coerceRe = /\bcoerceKnownOr\s*\(/g
  let cm
  while ((cm = coerceRe.exec(code))) {
    const open = cm.index + cm[0].length - 1
    const args = splitTopArgs(code, src, open)
    if (!args || args.length < 3) continue
    candidates++
    const fb = tokenAt(code, src, skipWs(code, args[2].start), constMap, 'coerceKnownOr(safe)')
    if (!fb || !fb.tier) {
      neutral++
      continue
    }
    if (fb.tier === 'initial') pushFinding(findings, src, cm.index, 'coerceKnownOr', fb, 'initial')
    else pushFinding(findings, src, cm.index, 'coerceKnownOr', fb, fb.tier)
  }

  const reds = findings.filter((f) => f.tier === 'initial')
  const greens = findings.filter((f) => f.tier !== 'initial')
  return { rel, findings, reds, greens, candidates, neutral }
}

function splitTopArgs(code, src, open) {
  const spans = []
  let depth = 0
  let start = open + 1
  let i = open
  while (i < code.length) {
    const ch = code[i]
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipString(src, i)
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth--
      if (depth === 0) {
        spans.push({ start, end: i })
        return spans
      }
    } else if (depth === 1 && ch === ',') {
      spans.push({ start, end: i })
      start = i + 1
    }
    i++
  }
  return null
}

// ---------- 取材面 ----------

const EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/
const SKIP_FILE_RE =
  /(\.min\.(js|mjs|cjs)|\.d\.(ts|tsx)|\.test\.(ts|tsx|js|jsx|mjs|cjs)|\.spec\.(ts|tsx|js|jsx|mjs|cjs))$/
const TEST_PATH_RE = /(^|[\\/])(tests?|__tests__|__mocks__)([\\/]|$)/
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  'vendor',
  '__pycache__',
  '.pnpm-store',
])

function walk(dir, out) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue
    const abs = join(dir, e.name)
    if (e.isDirectory()) walk(abs, out)
    else if (e.isFile()) {
      if (!EXT_RE.test(e.name) || SKIP_FILE_RE.test(e.name)) continue
      const rel = relative(ROOT, abs).split('\\').join('/')
      if (TEST_PATH_RE.test(rel)) continue
      out.push(abs)
    }
  }
}

export function collectFiles(paths) {
  const files = []
  for (const p of paths) {
    const abs = resolve(p)
    if (EXT_RE.test(abs)) files.push(abs)
    else walk(abs, files)
  }
  return [...new Set(files)]
}

/**
 * 路径级过滤(git 面共用):与 walk 同一套规则 —— 隐藏段 / 构建目录 / 测试面 / `.d.ts` 都不进射程。
 * 抽成纯函数是为了让三面扫**同一批文件**:面换了,判据不许跟着换(换面只换"读哪一份内容")。
 */
export function keepPath(rel) {
  for (const seg of rel.split('/')) {
    if (seg.startsWith('.') || SKIP_DIRS.has(seg)) return false
  }
  return EXT_RE.test(rel) && !SKIP_FILE_RE.test(rel) && !TEST_PATH_RE.test(rel)
}

/**
 * git 面的候选清单。两个面问的不是同一件事,所以**不能共用一条枚举**:
 *  · `--staged` —— 只枚举**本次暂存的变更**(`diff --cached --diff-filter=ACMR`)。索引里躺着
 *    整棵树(实测 14,718 条),按 `ls-files` 枚举等于每次提交重读五千多个 blob,而其中绝大多数
 *    与这次提交无关;更糟的是判据会因此与"这次改了什么"脱钩(守门 34 的教训:射面必须跟着变更走)。
 *  · 全量档 —— 枚举 HEAD 整棵树(全量审计的题中之义)。
 * 枚举类 git 调用不产生 blob 正文,正文一律由 catBatch 统一取(见 face-reader 的分工)。
 */
function listGitPaths(face) {
  const args =
    face === 'staged'
      ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']
      : ['ls-tree', '-r', '--name-only', '-z', 'HEAD']
  return String(gitRaw(args, ROOT))
    .split('\0')
    .map((s) => s.trim())
    .filter((s) => s && keepPath(s))
}

/** 判据取材规格:全量档 HEAD blob、`--staged` 索引 blob —— 与 70/77/83/98 同口径。 */
const specOf = (face, rel) => (face === 'staged' ? `:${rel}` : `HEAD:${rel}`)

/** 显式路径命中(相对仓库根):整文件相等,或目录前缀。 */
const hitPath = (rel, paths) =>
  !paths.length ||
  paths.some((p) => rel === p || rel.startsWith(`${p}/`))

// ---------- 自检(三条成对判据) ----------

const SELF_TEST_CASES = [
  {
    name: '① 兜初始态 ⇒ 红(三元)',
    src: [
      "const TASK_STATUSES = ['pending', 'running', 'completed', 'failed'] as const",
      'function asTaskStatus(v) {',
      "  return TASK_STATUSES.includes(v) ? v : 'pending'",
      '}',
      '',
    ].join('\n'),
    expect: { red: 1, value: 'pending' },
  },
  {
    name: '① 兜初始态 ⇒ 红(guard-return + 本文件 const 解析)',
    src: [
      "const KNOWN = ['pending', 'running']",
      'function pick(v) {',
      '  if (!RUN_STATUSES.includes(v)) return FALLBACK',
      '}',
      "const FALLBACK = 'running'",
      '',
    ].join('\n'),
    expect: { red: 1, value: 'running' },
  },
  {
    name: '① 兜初始态 ⇒ 红(coerceKnownOr 的 safe 实参)',
    src: [
      'function keep(x) {',
      "  return coerceKnownOr(x, ['active', 'closed'], 'active')",
      '}',
      '',
    ].join('\n'),
    expect: { red: 1, value: 'active' },
  },
  {
    name: '② 兜终态 ⇒ 绿(三元)',
    src: [
      "const INSTANCE_STATUSES = ['pending', 'closed'] as const",
      "const norm = (v) => (INSTANCE_STATUSES.includes(v) ? v : 'closed')",
      '',
    ].join('\n'),
    expect: { red: 0, green: 1, value: 'closed' },
  },
  {
    name: '② 显式拒绝 ⇒ 绿(guard-return null)',
    src: ['function parse(v) {', '  if (!VALID_STATUSES.has(v)) return null', '}', ''].join('\n'),
    expect: { red: 0, green: 1, value: 'null' },
  },
  {
    name: '② 兜终态 ⇒ 绿(coerceKnownOr safe=closed)',
    src: [
      'const s = coerceKnownOr(row.status, [',
      "  'active',",
      "  'paused',",
      "  'closed',",
      "], 'closed')",
      '',
    ].join('\n'),
    expect: { red: 0, green: 1, value: 'closed' },
  },
  {
    name: '③ 反向锁:非状态语义集合(TRIGGER_TYPES)',
    src: [
      "const TRIGGER_TYPES = ['manual', 'schedule'] as const",
      "const norm = (v) => (TRIGGER_TYPES.includes(v) ? v : 'manual')",
      '',
    ].join('\n'),
    expect: { red: 0, green: 0 },
  },
  {
    name: '③ 反向锁:缺键默认(族外形态,MAP[x] ?? pending)',
    src: ["const s = STATUS_MAP[row.status] ?? 'pending'", ''].join('\n'),
    expect: { red: 0, green: 0 },
  },
  {
    name: '③ 反向锁:字符串 includes(路径)',
    src: ["const type = path.includes('/') ? 'AAAA' : 'A'", ''].join('\n'),
    expect: { red: 0, green: 0 },
  },
  {
    name: '③ 反向锁:状态集合但档位两表皆不中(paused)',
    src: [
      "const SESSION_STATES = ['active', 'closed']",
      "const norm = (v) => (SESSION_STATES.includes(v) ? v : 'paused')",
      '',
    ].join('\n'),
    expect: { red: 0, green: 0 },
  },
  {
    name: '③ 反向锁:正向守卫无 else(非成员走穿透,无兜底值)',
    src: [
      'function f(v) {',
      '  if (TERMINAL_STATUSES.includes(v)) handle(v)',
      '}',
      '',
    ].join('\n'),
    expect: { red: 0, green: 0 },
  },
]

export function runSelfTest(log = console.log) {
  let ok = true
  for (const c of SELF_TEST_CASES) {
    const r = scanSource('selftest.ts', c.src)
    const problems = []
    if (c.expect.red !== undefined && r.reds.length !== c.expect.red)
      problems.push(`红=${r.reds.length}(期望 ${c.expect.red})`)
    if (c.expect.green !== undefined && r.greens.length !== c.expect.green)
      problems.push(`绿=${r.greens.length}(期望 ${c.expect.green})`)
    if (c.expect.value !== undefined) {
      const got = [...r.reds, ...r.greens].map((f) => f.value)
      if (!got.includes(c.expect.value)) problems.push(`落点未判为 '${c.expect.value}'(实际 ${JSON.stringify(got)})`)
    }
    if (problems.length) ok = false
    log(`${problems.length ? '✗' : '✓'} ${c.name}${problems.length ? ' —— ' + problems.join(';') : ''}`)
  }
  log(ok ? `--self-test 全绿(${SELF_TEST_CASES.length}/${SELF_TEST_CASES.length})` : '--self-test 有失败')
  return ok
}

// ---------- 主流程 ----------

function report(results) {
  const reds = []
  const greens = []
  let candidates = 0
  let neutral = 0
  for (const r of results) {
    candidates += r.candidates
    neutral += r.neutral
    for (const f of r.findings) (f.tier === 'initial' ? reds : greens).push({ rel: r.rel, ...f })
  }
  for (const f of greens) {
    console.log(
      `  绿 ${f.rel}:${f.line}:${f.col}  未命中分支兜到${f.tier === 'reject' ? '显式拒绝' : '终态'}档 '${f.value}' (${f.form})`,
    )
  }
  for (const f of reds) {
    console.log(
      `  红 ${f.rel}:${f.line}:${f.col}  未命中分支兜到初始态/可写档 '${f.value}' (${f.form};受判:${f.receiver})`,
    )
  }
  console.log(
    `未知枚举兜底档守门(G-815963):候选 ${candidates} 处(结构不判 ${neutral}) / 判绿 ${greens.length} / 判红 ${reds.length}`,
  )
  if (reds.length) {
    console.log(
      '  💡 未知/未来枚举值必须落「不再产生副作用」那一档:终态字面量(closed/completed/failed/cancelled/unknown…)\n' +
        '     或显式拒绝(null / throw / continue)。兜初始态(pending/running/admitted/open…)会把已终态的账放回可写集合。',
    )
  }
  return reds.length
}

/** 取一次判定面的全部源码。`--worktree` 是人工逃生舱(磁盘),两档 git 面走统一取材层。 */
function loadFace(face, paths) {
  if (face === 'worktree') {
    const abs = collectFiles(paths.length ? paths.map((p) => resolve(ROOT, p)) : [ROOT])
    if (paths.length && abs.length === 0) {
      throw new Undetermined(`工作树下没有可扫的 ts/tsx/js/jsx/mjs/cjs 源文件:${paths.join(' ')}`)
    }
    return abs.map((a) => {
      const rel = relative(ROOT, a).split('\\').join('/')
      const text = readWorktreeFile(ROOT, rel)
      // 读不到就判死:静默跳过一个文件 = 少扫一处而账面报绿(守门 99 那一课)
      if (typeof text !== 'string') throw new Undetermined(`工作树读不到 ${rel}(不存在或含 NUL 字节)`)
      return { rel, text }
    })
  }
  const rels = listGitPaths(face).filter((rel) => hitPath(rel, paths))
  if (paths.length && rels.length === 0) {
    throw new Undetermined(`${FACE_LABEL[face]}没有这些路径:${paths.join(' ')}`)
  }
  // "0 候选"在两个面上是两件相反的事(守门 70 那一课):
  //  · 全量档 0 候选 = HEAD 树里扫不到任何源文件 = 扫描根或过滤规则漂了 ⇒ 真·无法判定,exit 2;
  //  · --staged 0 候选 = 本次提交没动到射程内的 .ts/.js ⇒ 无从判起,但那不是"判过了没违规",
  //    也不是错误。exit 2 会把每一枚只碰 md/json/图片的提交钉死,逼人 --no-verify(§12e)。
  if (!rels.length && face === 'head' && !paths.length) {
    throw new Undetermined('HEAD 树里枚举不到任何可扫源文件 ⇒ 扫描根或过滤规则漂了,无法判定')
  }
  const blobs = catBatch(ROOT, rels.map((rel) => specOf(face, rel)))
  return rels.map((rel) => {
    const text = blobs.get(specOf(face, rel))
    if (typeof text !== 'string') {
      throw new Undetermined(`${FACE_LABEL[face]}取不到 ${rel} ⇒ 无法判定(不是"没有违规")`)
    }
    return { rel, text }
  })
}

function main(argv) {
  const flags = argv.filter((a) => a.startsWith('--'))
  const paths = argv
    .filter((a) => !a.startsWith('--'))
    .map((p) => p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, ''))
  const unknown = flags.filter((f) => f !== '--self-test' && f !== '--staged' && f !== '--worktree')
  if (unknown.length) {
    console.error(`未知开关:${unknown.join(' ')}(支持 --self-test / --staged / --worktree)`)
    return 2
  }
  if (flags.includes('--self-test')) return runSelfTest() ? 0 : 1
  // 两个面旗互斥(selectFace 判死,不静默取其一 —— 取哪一面都会让另一面变成假绿)
  const { face, error } = selectFace({
    staged: flags.includes('--staged'),
    worktree: flags.includes('--worktree'),
  })
  if (error) {
    console.error(`无法判定:${error}`)
    return 2
  }
  try {
    assertRepoRoot(ROOT, SELF)
    const items = loadFace(face, paths)
    const results = items.map(({ rel, text }) => scanSource(rel, text))
    console.log(`判定面:${FACE_LABEL[face]} —— ${FACE_NOTE[face]}`)
    if (!items.length && face === 'staged') {
      // 如实交代"这一面没什么可判",不冒充"已核无违规"(0 候选与 0 红是两件事)
      console.log('⏭ 本次暂存未触及射程内的源文件 ⇒ 不判(这不等于"已核无违规")')
      return 0
    }
    return report(results) > 0 ? 1 : 0
  } catch (err) {
    console.error(`无法判定:${err && err.message}`)
    return 2
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main(process.argv.slice(2)))
}

/* ---------- 已登记(scripts/guardian-runner.mjs id 205,2026-10-13 主会话接线) ----------
 * {
 *   label:          '🧩 未知枚举兜底档(blocking,状态集合未命中分支兜初始态⇒红)',
 *   script:         'check-enum-fallback-terminal.mjs',
 *   args:           [],
 *   mode:           'blocking',
 *   stagedTriggers: ['apps/', 'packages/', 'scripts/'],
 *   skipEnv:        'HUSKY_SKIP_ENUM_FALLBACK_TERMINAL',
 * }
 * stagedTriggers 不写则每次提交全量扫描;写上前缀可把与本维无关的提交挡在门外。
 * 接线前置(已达成):取材面移植到 face-reader —— 否则 runner 的提交链统一追加 --staged 会让
 * 本门 exit 2,而"注册即拦下每一次提交"的门只会逼人 --no-verify(§12e)。
 * 单复验:node scripts/check-enum-fallback-terminal.mjs --self-test / --staged / --worktree
 */
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
