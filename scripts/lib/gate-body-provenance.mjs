// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gate-body-provenance.mjs — 门体同代自检(2026-11-08 立)。
 *
 * 为什么要有这一层:同一根因已经出过三次 —— **门用自己那份判据代码,去判一棵并不持有这份
 * 代码(或持有的是另一代代码)的树,然后给出 0/1 的结论**:
 *   1. [IG] immutable-guard 在落后 origin/main 数百枚的树上跑,本地 `scripts/lib/immutable-guard.mjs`
 *      的 PROTECTED_KINDS 还是旧闭集 ⇒ 把 `autonomy-executor` / `autonomy-cost` 判成 bad-kind;
 *      换 origin/main 的同一份 lib 复算 = entries=26, problems=[]。
 *   2. 门 193 / 307p:门体点名的脚本在被判树里根本不存在;307p 用旧生成器算出的滞后结论,
 *      在 main 的生成器上是「无变化」。
 *   3. 门 173 判 index 面而写回工具 `sync-readme-numbers.mjs` 走 worktree 面 ⇒ 判面错位。
 *
 * 这三次的处置都是「查清出处 + 改那一道门 + 补一条证据」,于是第三次如期而至。本层是框架级
 * 收敛:门在判定**之前**先回答一个问题 —— 「正在执行的这份门体,是不是被判修订里那一份?」
 * 不是 ⇒ exit 2(未判定),它没有资格回答 0 或 1。**绝不**在本层放行 exit 0/1。
 *
 * 口径:
 *   - 门体 = 门脚本 + 它相对 import 的 `scripts/**.mjs` 传递闭包(不追 `scripts/data/*.json`
 *     这类**数据**;数据换代由写口/生成器的 `--face` 疗程管,门体换代由本层管)。
 *   - 判面(jurisdiction face)必须显式声明,来源优先级:`IHUI_GATE_FACE` env > CLI 旗
 *     (`--face=` / `--head` / `--staged` / `--worktree` / `--revision=`) > 声明表
 *     `scripts/data/gate-face-declarations.json` 的缺省面。三者都没有 ⇒ exit 2。
 *   - 盘上内容与 blob 比对按 LF 归一(本机 `core.autocrlf=true` + `.gitattributes eol=lf`,
 *     不归一会让每道门都误判 2)。
 *   - 唯一逃生口 `IHUI_GATE_BODY_SOURCE=worktree`:明示「我知道门体与被判树不同代,按工作树
 *     门体判」,本层如实打一行留痕后放行 —— 这是**显式判面声明**,不是环境变量式跳过/降级。
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { resolveGitBin } from './gitdir.mjs'

/** 判面声明 env(派发器/用户显式给)。 */
export const GATE_FACE_ENV = 'IHUI_GATE_FACE'
/** 门体来源逃生口 env(唯一允许的显式声明,值为 `worktree`)。 */
export const GATE_BODY_SOURCE_ENV = 'IHUI_GATE_BODY_SOURCE'
/** preflight 开关 env(由派发器注入,缺省不激活 —— 直跑单门不因此被全局拦住)。 */
export const GATE_PRELOAD_ENV = 'IHUI_GATE_BODY_PREFLIGHT'
/** 本次被派发的门体(仓库相对路径,正斜杠)。只有它与 argv[1] 一致时才自检。 */
export const GATE_ENTRY_ENV = 'IHUI_GATE_BODY_ENTRY'

/** 声明表(仓库相对路径键,缺省判面)。 */
export const DECLARATIONS_REL = 'scripts/data/gate-face-declarations.json'

/** 未判定统一退出码(与 guardian-executor / gate-failure-kind 的 §0.3 口径一致)。 */
export const UNDETERMINED_EXIT_CODE = 2

export const VALID_FACES = ['head', 'staged', 'worktree']

const BODY_EXTENSIONS = ['.mjs', '.js', '.cjs', '.mts', '.cts']
const MAX_BODY_FILES = 64
const MAX_BODY_DEPTH = 10
const GIT_TIMEOUT_MS = 15_000

/** 门体换代 ⇒ 本门没有资格回答。调用方据此 exit 2。 */
export class GateBodyProvenanceError extends Error {
  constructor(message, { code = 'GATE_BODY_PROVENANCE', details = null } = {}) {
    // §0.3 的未判定检测要求 stderr 里**门自己显式说了**「未判定」;本层所有出口都带这三个字,
    // 否则 exit 2 会被当成"刻意用 exit 2 顶红"而落进判红名单。
    super(String(message).includes('未判定') ? String(message) : `未判定:${message}`)
    this.name = 'GateBodyProvenanceError'
    this.code = code
    this.exitCode = UNDETERMINED_EXIT_CODE
    this.details = details
  }
}

/** 判面未声明/冲突 ⇒ 同样是未判定,不是违规。 */
export class GateFaceDeclarationError extends GateBodyProvenanceError {
  constructor(message, details = null) {
    super(message, { code: 'GATE_FACE_UNDECLARED', details })
    this.name = 'GateFaceDeclarationError'
  }
}

/* ─────────────────────────────── 基础工具 ─────────────────────────────── */

function git(root, args, { allowFail = false } = {}) {
  try {
    return execFileSync(resolveGitBin() || 'git', ['-C', root, ...args], {
      encoding: 'utf8',
      timeout: GIT_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
  } catch (e) {
    if (allowFail) return null
    throw new GateBodyProvenanceError(
      `门体自检取不到 git 读数(${args.join(' ')}): ${e?.stderr?.toString?.() ?? e?.message ?? e}`,
      { code: 'GATE_BODY_GIT_UNREADABLE' },
    )
  }
}

/** LF 归一(只解决行尾,不做任何内容改写)。 */
export function normalizeEol(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/** 按 git blob 口径算 sha1;打印用(内容已归一)。 */
export function blobShaOfText(text) {
  const body = normalizeEol(text)
  const hash = createHash('sha1')
  hash.update(`blob ${Buffer.byteLength(body, 'utf8')}\0`)
  hash.update(body, 'utf8')
  return hash.digest('hex')
}

export function shortSha(sha) {
  return sha ? String(sha).slice(0, 7) : ''
}

/** 从文件位置向上找仓库根(worktree 的 `.git` 是文件,也算)。 */
export function findRepoRoot(absPath) {
  let cur = dirname(resolve(absPath))
  for (let i = 0; i < 40; i += 1) {
    if (existsSync(join(cur, '.git'))) return cur
    const up = dirname(cur)
    if (up === cur) break
    cur = up
  }
  return null
}

export function repoRelative(root, absPath) {
  return relative(root, absPath).replace(/\\/g, '/')
}

/* ─────────────────────────────── 判面声明 ─────────────────────────────── */

function normalizeFaceValue(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return null
  const lower = value.toLowerCase()
  if (lower === 'index') return 'staged'
  if (lower === 'disk') return 'worktree'
  if (VALID_FACES.includes(lower)) return lower
  if (lower.startsWith('rev:')) {
    const rev = value.slice(4).trim()
    if (!rev || /\s/.test(rev)) throw new GateFaceDeclarationError(`判面声明不合法:${value}`)
    return `rev:${rev}`
  }
  throw new GateFaceDeclarationError(
    `判面声明不合法:${value}(只接受 head / staged / worktree / rev:<sha>)`,
  )
}

/** 从 argv 读显式判面旗。两面旗同给 ⇒ 冲突(与既有门 exit 2 的口径一致)。 */
export function parseFaceFromArgv(argv = []) {
  const found = []
  const takeNext = (i) => argv[i + 1] && !String(argv[i + 1]).startsWith('-') ? argv[i + 1] : null
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i])
    if (arg === '--head') found.push({ face: 'head', source: '--head' })
    else if (arg === '--staged') found.push({ face: 'staged', source: '--staged' })
    else if (arg === '--worktree') found.push({ face: 'worktree', source: '--worktree' })
    else if (arg.startsWith('--face=')) found.push({ face: normalizeFaceValue(arg.slice(7)), source: '--face' })
    else if (arg === '--face') {
      const v = takeNext(i)
      if (v) {
        found.push({ face: normalizeFaceValue(v), source: '--face' })
        i += 1
      }
    } else if (arg.startsWith('--revision=')) {
      found.push({ face: normalizeFaceValue(`rev:${arg.slice(11)}`), source: '--revision' })
    } else if (arg === '--revision') {
      const v = takeNext(i)
      if (v) {
        found.push({ face: normalizeFaceValue(`rev:${v}`), source: '--revision' })
        i += 1
      }
    }
  }
  const distinct = [...new Set(found.map((f) => f.face))]
  if (distinct.length > 1) {
    throw new GateFaceDeclarationError(
      `判面声明冲突:${found.map((f) => `${f.source}=${f.face}`).join(' / ')}(同一枚门只允许一个判面)`,
    )
  }
  return found[0] ?? null
}

/** 读声明表的缺省判面;`auto` = 按运行模式(--staged ⇒ 索引面,否则 HEAD 面)。 */
export function declaredFaceFromRegistry(root, entryRel) {
  const abs = join(root, DECLARATIONS_REL)
  if (!existsSync(abs)) return null
  let table
  try {
    table = JSON.parse(readFileSync(abs, 'utf8'))
  } catch (e) {
    throw new GateFaceDeclarationError(`${DECLARATIONS_REL} 读不动:${e?.message ?? e}`)
  }
  const entries = table?.entries ?? {}
  const hit = entries[entryRel] ?? entries[entryRel.replace(/^scripts\//, '')] ?? null
  if (!hit) return null
  const face = String(hit.face ?? '').trim()
  if (!face) return null
  if (face === 'auto') return 'auto'
  return normalizeFaceValue(face)
}

/**
 * 判面声明解析(单一入口)。
 * 优先级:`IHUI_GATE_FACE` env > argv 显式旗 > 声明表缺省面。
 * env 与 argv 同时给出且不一致 ⇒ exit 2(那是派发器把两代口径混在一枚门上)。
 */
export function resolveGateFace({ root, entryRel, argv = [], env = process.env } = {}) {
  const envRaw = env[GATE_FACE_ENV]
  const envFace = envRaw ? normalizeFaceValue(envRaw) : null
  const argvHit = parseFaceFromArgv(argv)
  if (envFace && argvHit && envFace !== argvHit.face) {
    throw new GateFaceDeclarationError(
      `判面声明冲突:${GATE_FACE_ENV}=${envFace} 与 ${argvHit.source}=${argvHit.face} 不一致` +
        `(门 ${entryRel ?? argv[1] ?? '<未知>'})`,
    )
  }
  if (envFace) return { face: envFace, source: GATE_FACE_ENV }
  if (argvHit) return { face: argvHit.face, source: argvHit.source }

  const declared = root && entryRel ? declaredFaceFromRegistry(root, entryRel) : null
  if (declared === 'auto') return { face: 'head', source: `${DECLARATIONS_REL}:auto(head)` }
  if (declared) return { face: declared, source: DECLARATIONS_REL }

  throw new GateFaceDeclarationError(
    `未声明判面:门 ${entryRel ?? argv[1] ?? '<未知>'} 既没有 ${GATE_FACE_ENV} / --face/--head/--staged/--worktree/--revision,` +
      `也没有在 ${DECLARATIONS_REL} 登记缺省面 ⇒ 本门没有资格回答(不 exit 0/1)`,
  )
}

export function faceLabel(face) {
  if (face === 'head') return 'HEAD'
  if (face === 'staged') return '索引(index)'
  if (face === 'worktree') return '工作树'
  if (String(face).startsWith('rev:')) return `修订 ${String(face).slice(4)}`
  return String(face)
}

/* ─────────────────────────────── 门体闭包 ─────────────────────────────── */

const IMPORT_PATTERNS = [
  /\bfrom\s+['"](\.{1,2}\/[^'"]+)['"]/g,
  // 副作用 import(`import './lib/x.mjs'`)同样属于门体,不追会漏掉事故①里的 lib 换代。
  /\bimport\s+['"](\.{1,2}\/[^'"]+)['"]/g,
  /\bimport\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g,
]

function importSpecsOf(text) {
  const out = []
  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0
    let m
    while ((m = pattern.exec(text)) !== null) out.push(m[1])
  }
  return out
}

function resolveLocalImport(fromAbs, spec) {
  const base = resolve(dirname(fromAbs), spec)
  const candidates = [base]
  if (!BODY_EXTENSIONS.includes(String(base).slice(String(base).lastIndexOf('.')))) {
    for (const ext of BODY_EXTENSIONS) candidates.push(`${base}${ext}`)
    for (const ext of BODY_EXTENSIONS) candidates.push(join(base, `index${ext}`))
  }
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

/**
 * 门体闭包:门脚本 + 相对 import 的本地模块(只认 `scripts/` 下的 .mjs/.js 等)。
 * 越出仓库根、指到 `scripts/data/` 的 import、node_modules 一律不追。
 */
export function gateBodyClosure(root, entryRel) {
  const entryAbs = resolve(root, entryRel)
  if (!existsSync(entryAbs)) {
    throw new GateBodyProvenanceError(`门体不存在:${entryRel}(盘上找不到正在执行的门脚本)`)
  }
  const seen = new Map()
  const queue = [{ abs: entryAbs, depth: 0 }]
  while (queue.length > 0) {
    const { abs, depth } = queue.shift()
    const rel = repoRelative(root, abs)
    if (seen.has(rel)) continue
    if (!rel.startsWith('scripts/')) continue
    const text = readFileSync(abs, 'utf8')
    seen.set(rel, text)
    if (depth >= MAX_BODY_DEPTH) continue
    for (const spec of importSpecsOf(text)) {
      const target = resolveLocalImport(abs, spec)
      if (!target) continue
      const targetRel = repoRelative(root, target)
      if (targetRel.startsWith('..') || isAbsolute(targetRel)) continue
      if (!targetRel.startsWith('scripts/')) continue
      if (seen.has(targetRel)) continue
      queue.push({ abs: target, depth: depth + 1 })
    }
    if (seen.size > MAX_BODY_FILES) {
      throw new GateBodyProvenanceError(
        `门体闭包超过 ${MAX_BODY_FILES} 件(${entryRel})—— 疑似 import 环或误把数据目录当门体`,
      )
    }
  }
  return [...seen.keys()].sort()
}

/* ─────────────────────────────── 判面取 blob ─────────────────────────────── */

/** `cat-file --batch` 一次读完一批(避免逐文件派生 git —— §5b 的 fork 风暴同型)。 */
function catFileBatch(root, specs) {
  if (specs.length === 0) return new Map()
  const res = spawnSync(resolveGitBin() || 'git', ['-C', root, 'cat-file', '--batch'], {
    input: `${specs.join('\n')}\n`,
    // 必须按字节读:判据文件里有中文,size 是字节数,用 utf8 字符串切片会把游标切歪。
    maxBuffer: 32 * 1024 * 1024,
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  if (res.error || res.status === null || res.status !== 0) {
    throw new GateBodyProvenanceError(
      `门体自检取不到 git 读数(cat-file --batch): ${res.error?.message ?? (res.stderr || '').toString().trim()}`,
      { code: 'GATE_BODY_GIT_UNREADABLE' },
    )
  }
  const buf = res.stdout
  const out = new Map()
  let cursor = 0
  for (const spec of specs) {
    const headerEnd = buf.indexOf(0x0a, cursor)
    if (headerEnd < 0) throw new GateBodyProvenanceError(`门体自检解析失败(缺头部):${spec}`, { code: 'GATE_BODY_GIT_UNREADABLE' })
    const header = buf.subarray(cursor, headerEnd).toString('utf8').trim()
    const parts = header.split(' ')
    if (parts[parts.length - 1] === 'missing') {
      out.set(spec, { exists: false, oid: null, text: null })
      cursor = headerEnd + 1
      continue
    }
    const oid = parts[0]
    const size = Number(parts[2])
    if (!Number.isFinite(size)) {
      throw new GateBodyProvenanceError(`门体自检解析失败(大小未知):${spec}`, { code: 'GATE_BODY_GIT_UNREADABLE' })
    }
    const start = headerEnd + 1
    const text = buf.subarray(start, start + size).toString('utf8')
    cursor = start + size + 1
    out.set(spec, { exists: true, oid, text })
  }
  return out
}

function faceSpec(face, rel) {
  if (face === 'staged') return `:${rel}`
  if (face === 'head') return `HEAD:${rel}`
  return `${face.slice(4)}:${rel}`
}

/** 在判面批量取 blob;不存在 ⇒ exists:false。 */
export function blobsAtFace(root, face, rels) {
  if (face === 'worktree') {
    const out = new Map()
    for (const rel of rels) {
      const abs = join(root, rel)
      out.set(rel, existsSync(abs)
        ? { exists: true, oid: null, text: readFileSync(abs, 'utf8') }
        : { exists: false, oid: null, text: null })
    }
    return out
  }
  const specs = rels.map((rel) => faceSpec(face, rel))
  const batch = catFileBatch(root, specs)
  const out = new Map()
  rels.forEach((rel, i) => out.set(rel, batch.get(specs[i])))
  return out
}

/** 单文件便捷入口(测试与调用方用)。 */
export function blobAtFace(root, face, rel) {
  return blobsAtFace(root, face, [rel]).get(rel)
}

/** 盘上正在执行的门体;不存在 ⇒ exists:false。 */
export function worktreeBody(root, rel) {
  const abs = join(root, rel)
  if (!existsSync(abs)) return { exists: false, text: null, oid: null }
  const text = readFileSync(abs, 'utf8')
  return { exists: true, text, oid: blobShaOfText(text) }
}

/* ─────────────────────────────── 自检主入口 ─────────────────────────────── */

function formatReport({ entryRel, face, source, violations, note }) {
  const lines = [
    `[UNDETERMINED] 未判定:门体与被判修订不同代 —— 本门没有资格回答 0 或 1`,
    `  门体: ${entryRel}`,
    `  判面: ${faceLabel(face)}(声明来源: ${source})`,
  ]
  for (const v of violations) {
    lines.push(`  门体路径: ${v.rel}`)
    lines.push(`  本地正在执行的门体 blob: ${v.local ? shortSha(v.local) : '不存在'}`)
    lines.push(
      `  被判修订中该路径 blob: ${v.judged ? shortSha(v.judged) : '不存在'}`,
    )
    lines.push(
      v.judged
        ? `  人话: 本门正在用「本地这一代」判据,去判「${faceLabel(face)}」那一代树;两代不一致 ⇒ 先对齐再跑。`
        : `  人话: 不要拿一棵根本不持有这份门体的树来作答(门体在那个修订里不存在)。`,
    )
  }
  if (note) lines.push(`  留痕: ${note}`)
  lines.push(
    `  出路: ① 把门体与被判面同步(提交或撤下本地改动);` +
      `② 确知要按工作树门体判,显式设 ${GATE_BODY_SOURCE_ENV}=worktree(会如实落痕)。` +
      `本层不允许 exit 0/1,也不允许环境变量式跳过。`,
  )
  return lines.join('\n')
}

/**
 * 断言「正在执行的这代门体」== 「被判修订里的那代门体」。
 * 通过 ⇒ 返回 {ok:true, face, source, escaped?};不通过/未声明 ⇒ 抛 GateBodyProvenanceError。
 */
export function assertGateBodyProvenance({
  root,
  entryRel,
  argv = process.argv.slice(2),
  env = process.env,
} = {}) {
  if (!root || !entryRel) {
    throw new GateFaceDeclarationError('门体自检缺参数(root / entryRel)⇒ 未判定')
  }
  const { face, source } = resolveGateFace({ root, entryRel, argv, env })
  const escape = env[GATE_BODY_SOURCE_ENV]
  if (escape === 'worktree') {
    return {
      ok: true,
      face,
      source,
      escaped: true,
      note:
        `${GATE_BODY_SOURCE_ENV}=worktree ⇒ 按工作树门体判(显式声明,非静默放行);` +
        `被判面仍为 ${faceLabel(face)},判据本身照旧按该面取材`,
    }
  }
  if (escape) {
    throw new GateFaceDeclarationError(
      `${GATE_BODY_SOURCE_ENV}=${escape} 不合法:唯一允许的逃生值是 worktree`,
    )
  }
  if (face === 'worktree') {
    return { ok: true, face, source, escaped: false, note: '判面 = worktree ⇒ 门体与被判树同代' }
  }
  const closure = gateBodyClosure(root, entryRel)
  const judgedAll = blobsAtFace(root, face, closure)
  const violations = []
  for (const rel of closure) {
    const judged = judgedAll.get(rel) ?? { exists: false, oid: null, text: null }
    const local = worktreeBody(root, rel)
    if (!judged.exists) {
      violations.push({ rel, judged: null, local: local.oid })
      continue
    }
    if (!local.exists) {
      violations.push({ rel, judged: judged.oid, local: null })
      continue
    }
    if (normalizeEol(judged.text) !== normalizeEol(local.text)) {
      violations.push({ rel, judged: judged.oid, local: local.oid })
    }
  }
  if (violations.length > 0) {
    throw new GateBodyProvenanceError(
      formatReport({ entryRel, face, source, violations }),
      { details: { entryRel, face, source, violations } },
    )
  }
  return { ok: true, face, source, escaped: false, note: `门体与 ${faceLabel(face)} 同代` }
}

/* ─────────────────────────────── 派发器接线 ─────────────────────────────── */

/**
 * 派发器统一入口:给出「跑一道门」的 argv 与 env。
 * 所有 spawn 点都必须走本函数 —— 这样"门体自检"不会因某个派发点各写一套而漏掉。
 */
export function gateSpawnPlan({ root, script, args = [], env = process.env } = {}) {
  if (!root || !script) throw new GateFaceDeclarationError('gateSpawnPlan 缺 root / script')
  const rel = String(script).replace(/\\/g, '/').replace(/^\.?\//, '')
  const entryRel = rel.startsWith('scripts/') ? rel : `scripts/${rel}`
  const abs = join(root, entryRel)
  if (!existsSync(abs)) {
    throw new GateBodyProvenanceError(`派发点要跑的门体不存在:${entryRel}`)
  }
  // 未声明 ⇒ 当场 exit 2(派发器自己也不许猜)。声明表缺失同理。
  resolveGateFace({ root, entryRel, argv: args, env: {} })
  const preloadUrl = pathToFileURL(join(root, 'scripts/lib/gate-body-provenance.mjs')).href
  return {
    argv: ['--import', preloadUrl, entryRel, ...args],
    env: {
      ...env,
      [GATE_PRELOAD_ENV]: '1',
      [GATE_ENTRY_ENV]: entryRel,
    },
  }
}

/** 物化树预校验:门体 blob 必须等于被判树里的同一路径(不依赖物化树有 .git)。 */
export function assertMaterializedGateBody({ repo, treeSha, script }) {
  const rel = String(script).replace(/\\/g, '/').replace(/^\.?\//, '')
  const entryRel = rel.startsWith('scripts/') ? rel : `scripts/${rel}`
  const judged = git(repo, ['rev-parse', '--verify', `${treeSha}:${entryRel}`], { allowFail: true })
  if (!judged) {
    throw new GateBodyProvenanceError(
      formatReport({
        entryRel,
        face: `rev:${treeSha}`,
        source: 'gate-worker 物化预校验',
        violations: [{ rel: entryRel, judged: null, local: null }],
      }),
    )
  }
  return { ok: true, entryRel, oid: judged.trim() }
}

/* ─────────────────────────────── preflight 装载 ─────────────────────────────── */

function isSameFile(a, b) {
  if (!a || !b) return false
  const norm = (p) => resolve(p).toLowerCase()
  return norm(a) === norm(b)
}

/**
 * `node --import` 装载入口。只有派发器同时给了 `IHUI_GATE_BODY_PREFLIGHT=1` 与
 * `IHUI_GATE_BODY_ENTRY`,且 argv[1] 正是那枚门体时才自检;否则静默 no-op
 * (NODE_OPTIONS 会被子进程继承,不能误伤门内部派生出来的子 node)。
 */
export function runGateBodyPreflight({ argv = process.argv, env = process.env } = {}) {
  if (env[GATE_PRELOAD_ENV] !== '1') return null
  const entryRel = env[GATE_ENTRY_ENV]
  if (!entryRel) {
    fail(`[UNDETERMINED] 派发器声明了门体自检却没给 ${GATE_ENTRY_ENV} ⇒ 未判定(不是违规,也不是通过)`)
    return null
  }
  const entryAbs = resolve(process.cwd(), entryRel)
  const argvEntry = argv[1] ? resolve(argv[1]) : null
  if (!isSameFile(entryAbs, argvEntry)) return null
  const root = findRepoRoot(entryAbs)
  if (!root) return null
  try {
    const result = assertGateBodyProvenance({
      root,
      entryRel: repoRelative(root, entryAbs),
      argv: argv.slice(2),
      env,
    })
    if (result.escaped && result.note) {
      process.stderr.write(`[gate-body] ${result.note}\n`)
    }
    return result
  } catch (error) {
    if (error instanceof GateBodyProvenanceError) {
      process.stderr.write(`${error.message}\n`)
    } else {
      process.stderr.write(`[UNDETERMINED] 门体自检自身出错:${error?.stack ?? error}\n`)
    }
    process.exit(UNDETERMINED_EXIT_CODE)
  }
  return null
}

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(UNDETERMINED_EXIT_CODE)
}

// preflight 装载(仅在派发器注入开关时生效)。
if (process.env[GATE_PRELOAD_ENV] === '1') {
  runGateBodyPreflight()
}
