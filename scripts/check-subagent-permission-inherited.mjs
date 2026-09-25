#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门:子代理派生点的权限档继承对账
//
// 在修什么(2026-09-26 立):
//   子代理(dispatch_subagent / spawn_parallel / worker 子进程)在构造自己的工具上下文时,
//   必须把**父会话的权限档与权限规则**显式下传。本仓实测的真实形态**不是**"默认绕过权限闸"
//   (全仓 `apps/cli/src` 内 `bypassPermissions` 作为默认值/写死档位出现 **0 处**),
//   而是反方向的另一格:派生点**整个不传** permissionMode / permissions ⇒ 子代理落到运行期
//   兜底档 'default',而父会话用 `--disallowed-tools` 立的显式 deny 规则在子代理里结构性失效
//   (`checkPermission(name, undefined, 'default', 'write') === 'ask'`,再被 `--allow-dangerous`
//   的 flag 路放行 ⇒ 用户明令禁止的工具,子代理仍能用)。
//   两条判据各守一头:P1 钉"不得写死 bypassPermissions 当默认档",P2 钉"必须真的下传",
//   P3 钉"半个继承"(字段声明了却没喂进构造调用)—— 第三格比不传更危险,它看起来像已经修好。
//
// 三条判据:
//   P1(零容忍,**不吃豁免**)派生面文件里 `permissionMode` 的默认位出现字面量 'bypassPermissions'
//      (`= '…'` / `?? '…'` / `|| '…'` / `permissionMode: '…'`)。免批档只能由显式授权得到
//      (调用参数 + 可指认原因),那属运行期语义,不得由源码里的字面量落地。
//   P2(棘轮:锚点 = 该文件 **HEAD 自身**的违规数)构造子代理上下文的调用
//      (`setupAgentTools(` / `runAgent(`)其参数对象必须同时提到 `permissionMode` 与 `permissions`,
//      缺一个记一处。立项实测存量 7 处 / 4 文件,全量面只报数、`--staged` 面只咬"加回来的那几处"
//      —— 与改动无关的 blocking 红只会逼人 `--no-verify`,连带废掉全部守门(§12e 同型)。
//   P3(零容忍)某个必传键在**构造调用之外**被读到或声明,却没有任何构造调用把它喂进去 ⇒ 判红
//      (按"文件 × 键"逐条记,与 P2 的"调用 × 缺键"不同形,故不会对同一格重复计债)。
//      这正是"声明但零消费者"那一型(本仓最高频失效型)的正面判据。
//
// 派生面(spawn face)怎么认:路径含 `subagent`(src/subagent、src/subagents、src/tools/subagent.ts、
//   src/commands/subagent-*.ts)∪ **剥注释后**的代码里出现 `createSubagentTool` / `subagentParent`
//   (后两个键把"注册子代理工具的主机"也算进来 —— 父档只能从那里出发)。
//   已知覆盖面限制(如实登记,不当已收口):
//     ① 未纳 `packages/**` 与 ai-service 侧的同族派生;
//     ② "父档没塞进 subagentParent"这一格(实测在 commands/agent.ts:276)由 P2 的子侧兜住一半 ——
//        该文件因 forwarded 自己的 setupAgentTools 而不判 P3,清理接线票须同时补 P4 或扩 P2 口径。
//
// 取材口径(同 70/77/83/98/101/103):全量判 **HEAD blob**、`--staged` 判**索引 blob**、
//   `--worktree` 仅人工逃生舱;两个面旗同给 ⇒ exit 2;候选内容取不到 ⇒ **exit 2「无法判定」**,
//   既不冒红也绝不记绿;全量面枚举到 0 个候选 ⇒ 判死(空扫不是绿)。
//
// 行内豁免:P2 / P3 认 `subagent-permission-exempt: <原因>`(命中行或紧邻上一行,**必须带原因**;
//   裸标记不放行 —— 原因不得由注释闭合符冒充,§22c 同族洞)。P1 一律不放行。
//
// 手动:
//   node scripts/check-subagent-permission-inherited.mjs              # 全量(HEAD)
//   node scripts/check-subagent-permission-inherited.mjs --staged     # 提交链(索引)
//   node scripts/check-subagent-permission-inherited.mjs --self-test  # 判据自检(纯函数,零副作用)
// 紧急跳过:HUSKY_SKIP_SUBAGENT_PERMISSION_INHERITED=1

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Undetermined, assertRepoRoot, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,不得写死盘符) */
const ROOT = resolve(HERE, '..')

export const SELF_SKIP = 'HUSKY_SKIP_SUBAGENT_PERMISSION_INHERITED'
/** 被审的源码根:子代理派生点全部住在 cli 端 */
export const SCAN_ROOT = 'apps/cli/src'
/** 构造子代理运行上下文的两个出口(只算调用,`function X(` 的定义不算) */
export const SPAWN_CONSTRUCTORS = ['setupAgentTools', 'runAgent']
/** 派生面的路径特征 */
export const FACE_PATH_RE = /subagent/i
/** 派生面的代码特征(注册子代理工具 / 承载父档的键) */
export const FACE_CODE_RES = ['createSubagentTool', 'subagentParent']
/** 必须继承下去的两个键 */
export const REQUIRED_KEYS = ['permissionMode', 'permissions']
/** 行内豁免标记(判据字面量必是其严格超集,预筛不会漏) */
export const EXEMPT_MARK = 'subagent-permission-exempt:'
const GIT_TIMEOUT = 120000
const FACE_NAME = { staged: '索引', head: 'HEAD', worktree: '工作树' }

/** 本门自己的两份文件必然含判据字面量 ⇒ 自豁免(否则门在自己的源码上恒红) */
const SELF_FILE_NAMES = new Set([
  'scripts/check-subagent-permission-inherited.mjs',
  'scripts/tests/check-subagent-permission-inherited.test.mjs',
])

// ───────────────────────── 预处理原语 ─────────────────────────

/** 跳过一段引号/模板串,返回闭合引号之后的下标(未闭合则到串尾) */
function skipQuoted(text, i) {
  const q = text[i]
  let j = i + 1
  while (j < text.length) {
    if (text[j] === '\\') {
      j += 2
      continue
    }
    if (text[j] === q) return j + 1
    // 裸换行只允许出现在模板串里;单/双引号串跨行说明这不是串
    if (text[j] === '\n' && q !== '`') return j
    j++
  }
  return text.length
}

/**
 * 只遮**注释**,保留字符串内容 —— P1 要找的正是字符串字面量 `'bypassPermissions'`。
 * 被遮字符以空格替换(保长度、保换行),使按偏移反查行号仍然成立。
 */
export function maskComments(text) {
  const out = text.split('')
  const blank = (a, b) => {
    for (let i = Math.max(0, a); i < b && i < out.length; i++) if (out[i] !== '\n') out[i] = ' '
  }
  let i = 0
  while (i < text.length) {
    const c = text[i]
    const d = text[i + 1]
    if (c === '/' && d === '/') {
      let j = i
      while (j < text.length && text[j] !== '\n') j++
      blank(i, j)
      i = j
      continue
    }
    if (c === '/' && d === '*') {
      let j = i + 2
      while (j < text.length && !(text[j] === '*' && text[j + 1] === '/')) j++
      const close = j < text.length ? j + 2 : text.length
      blank(i, close)
      i = close
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      i = skipQuoted(text, i)
      continue
    }
    i++
  }
  return out.join('')
}

/**
 * 额外把**字符串与模板串的内容**抹成空格(保留定界符位置与换行)⇒ 得到"纯代码面"。
 * P3 的"这个键在本文件里被读到过"必须只看代码面:实测 `import type { PermissionMode } from '../tools/permissions.js'`
 * 里的模块说明符含子串 `permissions`,按代码+串混合面判会给一台**与本次改动无关的假红**(真仓 HEAD 实测命中这一格)。
 * 反之 P1/P2 必须看得见串(P1 找的就是串里的档位字面量),故两把尺子分开而不是共用一份遮蔽。
 */
export function maskStrings(text) {
  const out = text.split('')
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      while (j < text.length) {
        if (text[j] === '\\') {
          out[j] = ' '
          if (j + 1 < text.length) out[j + 1] = text[j + 1] === '\n' ? '\n' : ' '
          j += 2
          continue
        }
        if (text[j] === c) break
        if (text[j] === '\n' && c !== '`') break
        out[j] = ' '
        j++
      }
      i = Math.min(j + 1, text.length)
      continue
    }
    i++
  }
  return out.join('')
}

/** 只遮注释的面(P1/P2 用:必须看得见字符串里的档位字面量) */
export function codeFace(text) {
  return maskComments(text)
}

/** 遮注释 + 字符串的面(P3 的"读到了这个键"用:模块说明符与文案不得充当读取证据) */
export function identifiersOnly(text) {
  return maskStrings(maskComments(text))
}

function buildLineOffsets(text) {
  const offs = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') offs.push(i + 1)
  return offs
}

/** 偏移 → 1 基行号(二分,不二次全文扫描) */
function lineOf(offsets, pos) {
  let lo = 0
  let hi = offsets.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (offsets[mid] <= pos) lo = mid
    else hi = mid - 1
  }
  return lo + 1
}

/**
 * 从指向 `(` 的下标取配对右括号之间的参数文本。
 * 必须跳引号 —— 串里的 `(` / `)` 会把配对点算偏,把上一个调用的参数当成这一个的。
 */
export function matchParen(text, openIdx) {
  if (text[openIdx] !== '(') return null
  let depth = 0
  let i = openIdx
  while (i < text.length) {
    const c = text[i]
    if (c === '"' || c === "'" || c === '`') {
      i = skipQuoted(text, i)
      continue
    }
    if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) return { inner: text.slice(openIdx + 1, i), end: i }
    }
    i++
  }
  return null
}

/** 找构造调用 → [{ name, openIdx, innerStart, innerEnd, inner|null }]。inner 为 null ⇒ 括号配不上(由调用方记未判定)。 */
export function findSpawnCalls(masked) {
  const calls = []
  for (const name of SPAWN_CONSTRUCTORS) {
    const re = new RegExp(`(?:^|[^\\w$.])${name}\\s*\\(`, 'g')
    let m
    while ((m = re.exec(masked)) !== null) {
      const nameAt = masked.indexOf(name, m.index)
      const openIdx = masked.indexOf('(', nameAt)
      if (openIdx < 0) continue
      // 定义形态(`function runAgent(` / `async function setupAgentTools(`)不是派生点
      if (/\bfunction\s+$/.test(masked.slice(Math.max(0, nameAt - 24), nameAt))) continue
      const got = matchParen(masked, openIdx)
      calls.push({
        name,
        openIdx,
        innerStart: openIdx + 1,
        innerEnd: got ? got.end : openIdx + 1,
        inner: got ? got.inner : null,
      })
    }
  }
  return calls
}

/** 把所有构造调用的**参数区**抹成空格,只留"调用之外"的代码面 —— P3 用它判"字段在别处被读了却没进调用" */
export function blankCallArgs(masked, calls) {
  const out = masked.split('')
  for (const c of calls) {
    for (let i = Math.max(0, c.innerStart); i < Math.min(c.innerEnd, out.length); i++) if (out[i] !== '\n') out[i] = ' '
  }
  return out.join('')
}

/** 命中行或紧邻上一行有 `EXEMPT_MARK` 且**带非空原因** ⇒ 放行 */
export function exempted(lines, lineNo) {
  for (const idx of [lineNo, lineNo - 1]) {
    const src = lines[idx - 1]
    if (!src) continue
    const at = src.indexOf(EXEMPT_MARK)
    if (at < 0) continue
    const reason = src.slice(at + EXEMPT_MARK.length).replace(/\*\/\s*$/, '').trim()
    if (reason.length > 0) return true
  }
  return false
}

// ───────────────────────── 判据 ─────────────────────────

/** 该文件是否属派生面(路径特征 ∪ 剥注释后的代码特征) */
export function inSpawnFace(rel, masked) {
  if (FACE_PATH_RE.test(rel)) return true
  return FACE_CODE_RES.some((k) => new RegExp(`\\b${k}\\b`).test(masked))
}

/** P1 形态:`permissionMode` 落在"默认位"且值是字面量 bypassPermissions */
const P1_RES = [
  /\bpermissionMode\s*=\s*['"]bypassPermissions['"]/g,
  /\bpermissionMode\s*(?:\?\?|\|\|)\s*['"]bypassPermissions['"]/g,
  /\bpermissionMode\s*\?\s*[^;\n]{0,40}?[:?]\s*['"]bypassPermissions['"]/g,
  /\bpermissionMode\s*:\s*['"]bypassPermissions['"]/g,
]

/**
 * 单文件判定。
 * @param {string} rel 仓库相对路径(自豁免用)
 * @param {string|null} text 被审面的内容(null ⇒ 不入面,由调用方按取不到处理)
 */
export function scanFile(rel, text) {
  const out = { inFace: false, p1: [], p2: [], p3: [], brokenParen: 0, calls: 0 }
  if (typeof text !== 'string') return out
  if (SELF_FILE_NAMES.has(rel)) return out
  const masked = maskComments(text)
  // 入面判定只看代码面(串已抹):`'../subagents/…'` 这类模块说明符不该把无关文件拖进派生面
  out.inFace = inSpawnFace(rel, maskStrings(masked))
  if (!out.inFace) return out
  const offsets = buildLineOffsets(masked)
  const lines = text.split('\n')

  const p1Seen = new Map()
  for (const re of P1_RES) {
    let m
    while ((m = re.exec(masked)) !== null) {
      // 同一处命中可被多条形态各吃一次(如 `x ?? 'bypass'` 同时命中兜底式与三元式)⇒ 按起点去重
      if (p1Seen.has(m.index)) continue
      p1Seen.set(m.index, { line: lineOf(offsets, m.index), text: m[0].trim() })
    }
  }
  out.p1 = [...p1Seen.values()]

  const calls = findSpawnCalls(masked)
  out.calls = calls.length
  const forwardedKeys = new Set()
  for (const c of calls) {
    const line = lineOf(offsets, c.openIdx)
    if (typeof c.inner !== 'string') {
      out.brokenParen++
      continue
    }
    for (const key of REQUIRED_KEYS) {
      if (new RegExp(`\\b${key}\\b\\s*:`, '').test(c.inner)) {
        forwardedKeys.add(key)
        continue
      }
      // P2 吃带原因的行内豁免;P1 不吃(字面量默认档就是本门立项要终结的那一型)
      if (exempted(lines, line)) continue
      out.p2.push({ line, key, call: c.name })
    }
  }

  // P3(按键逐条):字段在**调用之外**被读/声明,却没有任何构造调用吃到它 ⇒ 半个继承。
  // 只看调用之外、且只看**代码面**(串已抹)是为了:① 不与 P2 重复计债;② 不让 `'../tools/permissions.js'`
  // 这类模块说明符里的子串冒充"本文件读到了这个键"(真仓 HEAD 实测会踩到,产出一台与改动无关的假红)。
  if (calls.length > 0) {
    const outside = blankCallArgs(maskStrings(masked), calls)
    for (const key of REQUIRED_KEYS) {
      if (forwardedKeys.has(key)) continue
      const re = new RegExp(`\\b${key}\\b`)
      const at = outside.search(re)
      if (at < 0) continue
      const line = lineOf(offsets, at)
      if (exempted(lines, line)) continue
      out.p3.push({ line, key, calls: [...new Set(calls.map((c) => c.name))] })
    }
  }
  return out
}

// ───────────────────────── 取材 ─────────────────────────

/** 从一份路径清单里筛出候选(全量面 = 跟踪清单;--staged 面 = 暂存清单) */
export function filterCandidates(paths) {
  return paths.filter((p) => p.startsWith(`${SCAN_ROOT}/`) && p.endsWith('.ts'))
}

/**
 * 候选清单与内容**必须同面同轮**(守门 101 的教训):
 * 全量面走 `ls-tree HEAD`(而非 `ls-files` —— 后者含别人只暂存未提交的新文件,
 * 那类文件在 HEAD 面按定义不存在,拿它去 `git show HEAD:<path>` 会产出一条与本提交
 * 无关的"取不到内容",把门钉成恒红)。暂存面走 `diff --cached --diff-filter=ACMR`。
 */
function listPaths(root, face) {
  const args =
    face === 'staged'
      ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']
      : face === 'worktree'
        ? ['ls-files', '-z']
        : ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', SCAN_ROOT]
  return gitRaw(args, root, { timeout: GIT_TIMEOUT })
    .split('\0')
    .filter(Boolean)
}

/** 一次 cat-file --batch 读一批;未预取即读会由 face-reader 自己抛,不在这里补派生 */
function readTexts(root, face, paths) {
  if (paths.length === 0) return []
  if (face === 'worktree') return paths.map((p) => readWorktreeFile(root, p))
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  return paths.map((p, i) => got.get(specs[i]) ?? null)
}

function scanMany(root, face, paths) {
  const texts = readTexts(root, face, paths)
  const perFile = new Map()
  const unreadable = []
  for (let i = 0; i < paths.length; i++) {
    const rel = paths[i]
    const r = scanFile(rel, texts[i])
    if (typeof texts[i] !== 'string') unreadable.push(rel)
    if (r.inFace) perFile.set(rel, r)
  }
  return { perFile, unreadable }
}

// ───────────────────────── 聚合与决策 ─────────────────────────

/**
 * @param face        'head' | 'staged' | 'worktree'
 * @param perFile     Map<rel, scanFile 结果>(被审面)
 * @param headAnchor  Map<rel, 该文件 HEAD 自身的 P2 计数> —— 棘轮锚点;全量面传自身即等价
 */
export function decide({ face, perFile, headAnchor, scannedFiles, unreadable }) {
  const p1 = []
  const p2New = []
  const p3 = []
  const undetermined = [...(unreadable ?? []).map((p) => `${p}: ${face} 面取不到内容`)]
  let p2Existing = 0
  let brokenParen = 0
  for (const [rel, r] of perFile) {
    for (const v of r.p1) p1.push({ rel, ...v })
    for (const v of r.p3) p3.push({ rel, ...v })
    brokenParen += r.brokenParen
    if (r.brokenParen > 0) undetermined.push(`${rel}: ${r.brokenParen} 处构造调用括号配不上 ⇒ 该处无法判定`)
    const anchor = face === 'head' ? r.p2.length : headAnchor.get(rel) ?? 0
    if (r.p2.length > anchor) {
      for (const v of r.p2.slice(anchor)) p2New.push({ rel, ...v })
    }
    p2Existing += Math.min(r.p2.length, anchor)
  }
  // 配不上对 → 判据失效,不得表现为"扫过且没红"
  if (brokenParen > 0) undetermined.push(`共 ${brokenParen} 处构造调用无法判定`)
  return { red: p1.length + p2New.length + p3.length, p1, p2New, p3, undetermined, p2Existing, scannedFiles }
}

export function analyze(root, face) {
  const candidates = filterCandidates(listPaths(root, face))
  if (candidates.length === 0) {
    // 暂存面本来就可能是"这次没碰 cli"—— 那是没得判,不是判绿;全量面 0 候选 = 判据失效
    if (face === 'staged') return { face, scannedFiles: 0, emptyStaged: true, p1: [], p2New: [], p3: [], p2Existing: 0, undetermined: [] }
    throw new Undetermined(`${FACE_NAME[face]}面在 ${SCAN_ROOT} 下枚举到 0 个 .ts —— 空扫不得记绿`)
  }
  const { perFile, unreadable } = scanMany(root, face, candidates)
  const headAnchor = new Map()
  if (face === 'head') {
    for (const [rel, r] of perFile) headAnchor.set(rel, r.p2.length)
  } else {
    // 锚点面**允许**整文件缺席:新建的派生文件在 HEAD 按定义没有版本 ⇒ 锚点就是 0。
    // 把这种缺席记成"未判定"会造出一台拦死第一次正确修复的门。
    const rels = [...perFile.keys()]
    const anchor = scanMany(root, 'head', rels)
    for (const rel of rels) headAnchor.set(rel, anchor.perFile.get(rel)?.p2.length ?? 0)
  }
  return { ...decide({ face, perFile, headAnchor, scannedFiles: perFile.size, unreadable }), face, emptyStaged: false }
}

export function main(argv = process.argv.slice(2)) {
  if (argv.includes('--self-test')) return selfTest()
  const ri = argv.indexOf('--root')
  const root = ri >= 0 && argv[ri + 1] ? resolve(argv[ri + 1]) : ROOT
  assertRepoRoot(root, '本门')
  const { face, error } = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (error) {
    console.error(`❌ 无法判定: ${error}`)
    return 2
  }
  let out
  try {
    out = analyze(root, face)
  } catch (e) {
    const msg = e instanceof Undetermined ? e.message : e?.message ?? String(e)
    console.error(`❌ 无法判定(exit 2): ${msg}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }
  if (out.emptyStaged) {
    console.log(`⚠️ ${FACE_NAME[face]}面无 ${SCAN_ROOT} 下的暂存 .ts ⇒ 本轮不判(全量口径请不带 --staged 跑)`)
    return 0
  }
  const asJson = argv.includes('--json')
  if (asJson) {
    console.log(JSON.stringify({ face, scannedFiles: out.scannedFiles, p1: out.p1, p2New: out.p2New, p3: out.p3, p2Existing: out.p2Existing, undetermined: out.undetermined }))
  } else {
    console.log(`子代理权限档继承对账(取材面:${FACE_NAME[face]},派生面文件 ${out.scannedFiles} 个)`)
    for (const v of out.p1) console.log(`  ❌ P1 ${v.rel}:${v.line} 把权限档写死成 bypassPermissions:${v.text}`)
    for (const v of out.p2New) console.log(`  ❌ P2 ${v.rel}:${v.line} ${v.call}( 未下传 ${v.key}(超出该文件 HEAD 自身存量)`)
    for (const v of out.p3) console.log(`  ❌ P3 ${v.rel}:${v.line} 在调用之外读到了 ${v.key},却没喂进任何构造调用(${v.calls.join('/')})⇒ 半个继承`)
    if (out.p2Existing > 0) console.log(`  · P2 存量(按该文件 HEAD 自身计数,只报数不判红):${out.p2Existing} 处 —— 待子代理权限接线票清偿`)
  }
  for (const u of out.undetermined) console.log(`  ⚠️ 未判定:${u}`)
  const red = out.red
  if (asJson) return red > 0 ? 1 : 0
  if (out.undetermined.length > 0 && red === 0) {
    console.error(`❌ 无法判定(exit 2):有 ${out.undetermined.length} 处判据取不到输入,不得记绿`)
    return 2
  }
  if (red > 0) {
    console.error(`❌ 子代理权限档继承对账不通过:${red} 处(P1=${out.p1.length} / P2 新增=${out.p2New.length} / P3=${out.p3.length})`)
    return 1
  }
  console.log(`✅ 子代理权限档继承对账通过(P1/P3 零违规,P2 无新增;存量 ${out.p2Existing} 处只报数)`)
  return 0
}

// ───────────────────────── 自检(纯函数 + 构造面,不派生 git) ─────────────────────────

export const FIXTURES = {
  派生面未下传: `
const ctx = await setupAgentTools({ workspacePath: p, silent: true })
interface SubagentParentOptions { allowDangerous?: boolean }
`,
  派生面全下传: `
const ctx = await setupAgentTools({ workspacePath: p, permissionMode: parentOpts.permissionMode, permissions: parentOpts.permissions })
`,
  字面量默认档: `
function f(o) { const mode = o.permissionMode ?? 'bypassPermissions'; return mode }
`,
  字面量写死档位: `
setupAgentTools({ permissionMode: 'bypassPermissions', permissions: r })
`,
  半个继承: `
interface SubagentParentOptions { permissionMode?: string }
setupAgentTools({ workspacePath: p, permissions: parentOpts.permissions })
`,
  主机只透档位: `
interface Opts { permissionMode?: string }
setupAgentTools({ workspacePath: p, permissionMode: this.opts.permissionMode })
`,
  模块说明符里有键名: `
import type { PermissionMode } from '../tools/permissions.js'
interface Opts { permissionMode?: string }
setupAgentTools({ workspacePath: p, permissionMode: this.opts.permissionMode })
`,
  名字只出现在串里: `
const note = "createSubagentTool 的注册点在这里"
setupAgentTools({ workspacePath: p })
`,
  注释里提及: `
// permissionMode ?? 'bypassPermissions' 只是注释里在解释为什么禁止
setupAgentTools({ workspacePath: p, permissionMode: m, permissions: r })
`,
  带原因豁免: `
setupAgentTools({ workspacePath: p }) // subagent-permission-exempt: 纯只读夹具,无父会话可继承
`,
  裸标记豁免: `
setupAgentTools({ workspacePath: p }) // subagent-permission-exempt:
`,
}

export function selfTest() {
  const cases = []
  const scan = (rel, text) => scanFile(rel, text)
  const push = (name, ok, detail = '') => cases.push({ name, ok, detail })
  const F = FIXTURES
  const SUB = 'apps/cli/src/tools/subagent.ts'

  push('F1 路径含 subagent 即派生面', inSpawnFace('apps/cli/src/tools/subagent.ts', '') === true)
  push('F2 createSubagentTool 把注册主机算进派生面', inSpawnFace('apps/cli/src/commands/agent.ts', 'const t = createSubagentTool({})') === true)
  push('F3 subagentParent 同样算入面依据', inSpawnFace('apps/cli/src/acp/server.ts', 'subagentParent: { modelId }') === true)
  push('F4 无关文件不入面', inSpawnFace('apps/cli/src/tools/read-file.ts', 'const a = 1') === false)
  push('F5 注释里的 createSubagentTool 不得当入面依据', scan('apps/cli/src/tools/x.ts', '// createSubagentTool 只是提及').inFace === false)

  push('P1a ?? 兜底成 bypassPermissions 必判红', scan(SUB, F['字面量默认档']).p1.length === 1, JSON.stringify(scan(SUB, F['字面量默认档']).p1))
  push('P1b 参数对象里写死档位必判红', scan(SUB, F['字面量写死档位']).p1.length === 1)
  push('P1c 注释里出现同一串不得判红(变异对照)', scan(SUB, F['注释里提及']).p1.length === 0)
  push('P1d 正常继承不得判红', scan(SUB, F['派生面全下传']).p1.length === 0)
  push('P1e 本门自豁免(判据字面量必在门源码内)', scan('scripts/check-subagent-permission-inherited.mjs', F['字面量默认档']).p1.length === 0)
  push('P1f 写死档位由 P1 判红,P2 不重复计债(两条判据不互盖)', scan(SUB, F['字面量写死档位']).p2.length === 0)

  push('P2a 两项都没下传 ⇒ 两处违规', scan(SUB, F['派生面未下传']).p2.length === 2, JSON.stringify(scan(SUB, F['派生面未下传']).p2))
  push('P2b 两项都下传 ⇒ 零违规', scan(SUB, F['派生面全下传']).p2.length === 0)
  push('P2c 带原因的行内豁免放行', scan(SUB, F['带原因豁免']).p2.length === 0)
  push('P2d 裸标记(无原因)不放行(变异对照)', scan(SUB, F['裸标记豁免']).p2.length === 2)
  push('P2e 只缺 permissionMode 时恰好记一处(不与 permissions 混计)', scan(SUB, F['半个继承']).p2.filter((v) => v.key === 'permissionMode').length === 1)

  push('P3a 声明了 permissionMode 却没喂进去 ⇒ 判红', scan(SUB, F['半个继承']).p3.length === 1, JSON.stringify(scan(SUB, F['半个继承']).p3))
  push('P3b 真喂进去了 ⇒ 不判 P3', scan(SUB, F['派生面全下传']).p3.length === 0)
  push('P3c 完全没声明也不判 P3(那是 P2 的地盘,两条不重复计债)', scan(SUB, F['派生面未下传']).p3.length === 0)
  // 真仓 server/agent-core.ts 就是这一型:透了档位、没透规则。它该只记一笔 P2(走棘轮),
  // 不该被 P3 重复计债 —— 少了这条,本门会在一个"已经做对一半"的文件上报出错误的那一半。
  push('P3d 只漏 permissions 的主机形态:P2 记一处、P3 不重复计', scan(SUB, F['主机只透档位']).p2.length === 1 && scan(SUB, F['主机只透档位']).p3.length === 0,
    JSON.stringify(scan(SUB, F['主机只透档位'])))
  push('P3e 调用之外读到的键才被 P3 看见(变异对照:把键只写在参数里则不判)', scan(SUB, F['派生面全下传']).p3.length === 0)
  // 真仓 server/agent-core.ts 实测就是这一型:`import … from '../tools/permissions.js'`
  // 的模块说明符里含子串 `permissions`。按代码+串混合面判会给它记一笔与改动无关的红 ⇒ 恒红门。
  // rel 这里**必须**取派生面内的路径,否则"不入面"会让本条退化成恒真(仓里踩过这种假自证)。
  push('P3f 模块说明符里的 permissions 不得冒充"读到了这个键"', scan(SUB, F['模块说明符里有键名']).p3.length === 0 && scan(SUB, F['模块说明符里有键名']).p2.length === 1,
    JSON.stringify(scan(SUB, F['模块说明符里有键名'])))
  push('P3g 真在代码里声明了却没透出去 ⇒ 仍必须判红(反向对照,入面靠 createSubagentTool 内容特征)',
    scan('apps/cli/src/commands/agent.ts', `${F['半个继承']}\nconst t = createSubagentTool({})\n`).p3.length === 1)
  push('F6 名字只出现在串里不得把文件拖进派生面', scan('apps/cli/src/commands/other.ts', F['名字只出现在串里']).p2.length === 0 && scan('apps/cli/src/commands/other.ts', F['名字只出现在串里']).inFace === false)

  push('M1 runAgent 的定义形态不当调用', findSpawnCalls('export async function runAgent(opts) {}\nawait runAgent({ a: 1 })').length === 1)
  push('M2 参数里的嵌套括号不得打断配对', (matchParen('f({ a: g(1), b: 2 })', 1) ?? {}).inner === '{ a: g(1), b: 2 }')
  push('M3 配不上对的括号返回 null(不猜)', matchParen('f({ a: 1', 1) === null)
  push('M4 字符串里的右括号不得提前收口', (matchParen('f({ a: "x)" })', 1) ?? {}).inner === '{ a: "x)" }')
  push('M5 https:// 不得被当行注释吞掉', maskComments('const u = "https://a/b" // ok').includes('https://a/b'))
  const m6 = maskComments('a\n// b\nc')
  push('M6 遮注释保长度保换行,行号反查仍准', m6.length === 8 && m6[1] === '\n' && m6[6] === '\n' && lineOf(buildLineOffsets(m6), 7) === 3)
  push('M7 候选筛选只留 scan root 下的 .ts', filterCandidates(['apps/cli/src/a.ts', 'apps/api/src/c.ts', 'packages/x.ts']).join('|') === 'apps/cli/src/a.ts')

  const mk = (n) => ({ inFace: true, p1: [], p2: Array.from({ length: n }, (_, i) => ({ line: i + 1, key: 'permissions', call: 'setupAgentTools' })), p3: [], brokenParen: 0, calls: 1 })
  const one = (f, file, anchor) => decide({ face: f, perFile: new Map([['a.ts', file]]), headAnchor: new Map([['a.ts', anchor]]), scannedFiles: 1, unreadable: [] })
  push('D1 暂存 3 / HEAD 2 ⇒ 只咬加回来的那 1 处', one('staged', mk(3), 2).red === 1)
  push('D2 与 HEAD 持平 ⇒ 绿(存量不得钉红无关提交)', one('staged', mk(2), 2).red === 0)
  push('D3 比 HEAD 更少 ⇒ 绿且存量按少的一侧计', one('staged', mk(1), 2).red === 0 && one('staged', mk(1), 2).p2Existing === 1)
  const fullMode = one('head', mk(7), 0)
  push('D4 全量面 P2 存量只报数不判红(锚点即自身)', fullMode.red === 0 && fullMode.p2Existing === 7)
  push('D5 新文件(HEAD 无此文件 ⇒ 锚点 0)一视违规即红', decide({ face: 'staged', perFile: new Map([['new.ts', mk(2)]]), headAnchor: new Map(), scannedFiles: 1, unreadable: [] }).red === 2)
  const p1Red = decide({ face: 'head', perFile: new Map([['a.ts', { ...mk(0), p1: [{ line: 1, text: 'x' }] }]]), headAnchor: new Map(), scannedFiles: 1, unreadable: [] })
  push('D6 P1 在任何面都判红(零容忍)', p1Red.red === 1)
  const broken = decide({ face: 'head', perFile: new Map([['a.ts', { ...mk(0), brokenParen: 1 }]]), headAnchor: new Map(), scannedFiles: 1, unreadable: [] })
  push('D7 括号配不上 ⇒ 记未判定,不得静默成绿', broken.red === 0 && broken.undetermined.length === 2)
  const unread = decide({ face: 'head', perFile: new Map(), headAnchor: new Map(), scannedFiles: 0, unreadable: ['apps/cli/src/x.ts'] })
  push('D8 取不到内容 ⇒ 未判定点名文件', unread.undetermined.length === 1 && unread.undetermined[0].includes('apps/cli/src/x.ts'))

  let fail = 0
  for (const c of cases) {
    if (!c.ok) fail++
    console.log(`${c.ok ? '✅' : '❌'} ${c.name}${c.ok ? '' : ` — ${c.detail}`}`)
  }
  console.log(`${fail === 0 ? '✅' : '❌'} 自检共 ${cases.length} 条,失败 ${fail} 条`)
  return fail === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  maskComments,
  maskStrings,
  identifiersOnly,
  matchParen,
  findSpawnCalls,
  blankCallArgs,
  inSpawnFace,
  exempted,
  scanFile,
  decide,
  analyze,
  filterCandidates,
  REQUIRED_KEYS,
  SPAWN_CONSTRUCTORS,
  EXEMPT_MARK,
  SELF_SKIP,
  SCAN_ROOT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
