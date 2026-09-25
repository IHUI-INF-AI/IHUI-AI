#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门:packages/shared 的非 Node 宿主可达面纯度(共享包不得把 Node 内建模块带进小程序/RN/浏览器构建链)
//
// 在修什么(2026-09-26 立,第九轮 A9A-4):
//   `packages/shared` 被 web / miniapp-taro / mobile-rn / packages/app / extension 这些**非 Node 宿主**
//   共同消费,而包内存在 Node 内建模块依赖(实测 `packages/shared/src/utils/ssrf-guard.ts` import
//   `node:dns/promises`)。今天它没打死小程序构建,**只是因为 barrel 没导出那个文件** ——
//   这是巧合安全,不是判据:任何一次"顺手 `export * from './utils/ssrf-guard.js'`"、或端内直接
//   `import '@ihui/shared/utils/ssrf-guard'`,都会让 v4/v3 打包链里出现 Node 内建模块,失败形态是
//   构建期 resolve 报错或运行时 `undefined`,而 `pnpm typecheck` **结构上看不见**(TS 走 tsconfig
//   paths,不看打包器)。
//
// 判据是**可达性**而不是"文件里有没有 node:"(整包一刀切就是假严,可达性判据失效就是假绿):
//   R1 从公开入口面(`packages/shared/src/index.ts` + package.json 显式 exports 目标)做值边传递闭包,
//      闭包内任何文件有 Node 内建**值**导入 ⇒ 判红并给出链路。
//   R2 非 Node 宿主目录里出现**直接 import shared 内含 Node 依赖的文件**(含子路径
//      `@ihui/shared/utils/xxx`、以及相对路径摸进 packages/shared)⇒ 判红(这正是绕过 barrel 的那条路)。
//   R3 两类只报数不判红,绝不静默成绿:「shared 内有 Node 依赖但入口闭包不可达」(当前真实现状)、
//      「动态拼接 / 解析不到的 specifier」。
//   `import type` 一律豁免(类型期导入不进产物,tsc-only)。
//
// 口径同 70/77/83/98/101/103/118:全量判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅作
//   人工逃生舱且两个面旗同给直接 exit 2;取不到 ⇒ **exit 2「无法判定」**,既不冒红也不记绿;
//   候选集枚举到 0 ⇒ 判死(空扫不通过)。
//   `--staged` **不**按暂存文件收窄判据面:一枚只改 `index.ts` 一行的提交能改变整张可达图,
//   按"改动了哪些文件"收范围恰好放过本门立项那一型(与守门 78「恒全量判定」同理)。
//
// 手动:
//   node scripts/check-shared-nonde-node-purity.mjs            # 全量(HEAD 面)
//   node scripts/check-shared-nonde-node-purity.mjs --staged   # 提交链(索引面)
//   node scripts/check-shared-nonde-node-purity.mjs --json     # 机读结论
//   node scripts/check-shared-nonde-node-purity.mjs --self-test
// 紧急跳过:HUSKY_SKIP_SHARED_NONDE_PURITY=1(注册由主会话统一接线,本文件不自注册)

import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, assertRepoRoot, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,不得写死盘符) */
const ROOT = resolvePath(HERE, '..')

export const SELF_SKIP = 'HUSKY_SKIP_SHARED_NONDE_PURITY'
export const SHARED_ROOT = 'packages/shared'
export const SHARED_SRC = 'packages/shared/src'
export const SHARED_ENTRY = 'packages/shared/src/index.ts'
export const SHARED_MANIFEST = 'packages/shared/package.json'
/**
 * 非 Node 宿主清单(R2 的射程)。**这条清单就是判据本身** —— 把它写空就等于关掉 R2,
 * 所以 `--self-test` 里有一条断言钉住"清单非空且五个宿主逐个在位"(门 120 的教训:
 * 名单可以是张死表,而名单被清空必须是红的)。
 */
export const HOST_DIRS = [
  'apps/miniapp-taro/src',
  'apps/mobile-rn/src',
  'packages/app/src',
  'apps/web',
  'apps/extension',
]
/** 裸内建模块名(规格点名的那一组);带 `/` 的子路径按首段判 */
export const BARE_BUILTINS = [
  'fs',
  'path',
  'os',
  'dns',
  'crypto',
  'child_process',
  'net',
  'tls',
  'http',
  'https',
  'zlib',
  'util',
  'events',
  'stream',
  'url',
]
const SHARED_PKG_NAMES = ['@ihui/shared', '@ihui/shared/']
const SOURCE_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/
const RESOLVE_CANDIDATES = (base) => [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]
/** 预筛:宿主侧至少要提到这两个前缀之一才可能构成 R2(全量 git grep,再逐文件精判) */
export const HOST_PREFILTER_PATTERNS = ['@ihui/shared', 'packages/shared/']
const GIT_TIMEOUT = 180000
const GIT_MAX_BUFFER = 1 << 29

// ---------------------------------------------------------------- 文本遮噪

/**
 * 只遮注释、**保留字符串字面量**(模块说明符本身就是字符串,抹掉它判据就瞎了)。
 * 与守门 118 的 `maskComments` 同一职责,但那里没导出可复用的入口,本门自带一份实现,
 * 行为差异都由 `--self-test` 的成对例钉住。
 */
export function maskComments(src) {
  const out = []
  let i = 0
  let inBlock = false
  while (i < src.length) {
    if (inBlock) {
      if (src.startsWith('*/', i)) {
        inBlock = false
        i += 2
        out.push('  ')
      } else {
        out.push(src[i] === '\n' ? '\n' : ' ')
        i += 1
      }
      continue
    }
    if (src.startsWith('//', i)) {
      while (i < src.length && src[i] !== '\n') i += 1
      continue
    }
    if (src.startsWith('/*', i)) {
      inBlock = true
      i += 2
      out.push('  ')
      continue
    }
    const q = src[i]
    if (q === "'" || q === '"' || q === '`') {
      out.push(q)
      i += 1
      while (i < src.length) {
        if (src[i] === '\\') {
          out.push(src[i], src[i + 1] ?? '')
          i += 2
          continue
        }
        if (src[i] === q) {
          out.push(q)
          i += 1
          break
        }
        out.push(src[i])
        i += 1
      }
      continue
    }
    out.push(q)
    i += 1
  }
  return out.join('')
}

// ---------------------------------------------------------------- 边提取

const STATIC_FROM_RE = /\b(import|export)\s+(type\s+)?[\s\S]*?\bfrom\s*(['"])([^'"]+)\3/g
const SIDE_EFFECT_RE = /\bimport\s*(['"])([^'"]+)\1/g
const REQUIRE_RE = /\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g
const DYN_LITERAL_RE = /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g
/** 动态拼接 / 变量 specifier:`import(\`node:${x}\`)`、`require(mod)` —— 判不了,只能如实计数 */
const DYN_OPAQUE_RE = /\b(?:import|require)\s*\(\s*(?!['"])[^)]{0,120}\)/g
const EXEMPT_RE = /nonde-purity-exempt:\s*(\S.*)$/

/** specifier 是否为 Node 内建(`node:` 前缀,或裸名在名单内) */
export function isBuiltinSpec(spec) {
  if (typeof spec !== 'string') return false
  if (spec.startsWith('node:')) return true
  if (spec.startsWith('@') || spec.startsWith('.') || spec.startsWith('/')) return false
  return BARE_BUILTINS.includes(spec.split('/')[0])
}

/**
 * 一张文件的导入边清单(纯函数:输入是已遮注释的源码文本)。
 * @returns {{edges:Array<{spec:string,line:number,typeOnly:boolean,builtin:boolean}>, opaque:number}}
 */
export function extractEdges(code) {
  const edges = []
  const push = (spec, typeOnly, index) => {
    if (typeof spec !== 'string' || !spec) return
    edges.push({ spec, typeOnly: !!typeOnly, builtin: isBuiltinSpec(spec), line: lineOf(code, index) })
  }
  for (const m of code.matchAll(STATIC_FROM_RE)) {
    // `import type ... from 'x'` / `export type ... from 'x'` ⇒ 类型期,不进产物
    const typeOnly = !!m[2] || /^\s*(type\s|\*\s+as\s)/.test(m[0].slice(m[1].length))
    push(m[4], typeOnly, m.index)
  }
  for (const m of code.matchAll(SIDE_EFFECT_RE)) push(m[2], false, m.index)
  for (const m of code.matchAll(REQUIRE_RE)) push(m[2], false, m.index)
  for (const m of code.matchAll(DYN_LITERAL_RE)) push(m[2], false, m.index)
  let opaque = 0
  for (const m of code.matchAll(DYN_OPAQUE_RE)) {
    // `import('x')` 的字面量形态已被上一条收走;这里剩下的都是判不出的
    if (/[`'"]/.test(m[0].replace(/^\s*(?:import|require)\s*\(\s*/, ''))) continue
    opaque += 1
  }
  return { edges, opaque }
}

function lineOf(code, index) {
  let line = 1
  for (let i = 0; i < index && i < code.length; i++) if (code[i] === '\n') line += 1
  return line
}

/** 行内豁免:标记在命中行**或紧邻上一行**,且必须带原因(裸标记不算放行) */
export function hasExemption(rawLines, line) {
  for (const candidate of [line, line - 1]) {
    const text = rawLines[candidate - 1]
    if (!text) continue
    const m = EXEMPT_RE.exec(text)
    if (m && m[1].trim().length > 0 && m[1].trim() !== '*/') return true
  }
  return false
}

// ---------------------------------------------------------------- 路径解析

function posixJoin(fromDir, spec) {
  const segs = `${fromDir}/${spec}`.split('/')
  const stack = []
  for (const s of segs) {
    if (!s || s === '.') continue
    if (s === '..') stack.pop()
    else stack.push(s)
  }
  return stack.join('/')
}

/** 这个 specifier 是否**明显**想摸进 packages/shared(用于把"解析不到"算成未判定,而不是把所有相对路径都算) */
export function aimsAtShared(spec, fromRel) {
  if (typeof spec !== 'string' || !spec) return false
  if (spec === '@ihui/shared' || spec.startsWith('@ihui/shared/')) return true
  if (spec.startsWith(`${SHARED_ROOT}/`)) return true
  if (spec.startsWith('.')) return posixJoin(dirname(fromRel), spec).startsWith(SHARED_ROOT)
  return false
}

/** 把一个 specifier 归到 packages/shared 内的某个源文件(解析不到返回 null) */
export function resolveIntoShared(spec, fromRel, knownFiles) {
  const has = (p) => knownFiles.has(p)
  const tryBase = (base) => {
    for (const c of RESOLVE_CANDIDATES(base)) if (has(c)) return c
    const stripped = base.replace(SOURCE_EXT_RE, '')
    if (stripped !== base) for (const c of RESOLVE_CANDIDATES(stripped)) if (has(c)) return c
    return null
  }
  if (typeof spec !== 'string' || !spec) return null
  if (spec.startsWith('.')) {
    const abs = posixJoin(dirname(fromRel), spec)
    if (!abs.startsWith(`${SHARED_ROOT}/`)) return null
    return tryBase(abs)
  }
  if (spec === '@ihui/shared') return has(SHARED_ENTRY) ? SHARED_ENTRY : null
  if (spec.startsWith('@ihui/shared/')) {
    const rest = spec.slice('@ihui/shared/'.length)
    return tryBase(`${SHARED_SRC}/${rest}`) || tryBase(`${SHARED_ROOT}/${rest}`)
  }
  if (spec.startsWith(`${SHARED_ROOT}/`)) return tryBase(spec)
  return null
}

/** 包外 specifier(其他 @ihui 包 / npm / Node) —— 本门不追,但如实计数 */
export function isExternalSpec(spec) {
  return typeof spec === 'string' && !spec.startsWith('.') && !spec.startsWith(`${SHARED_ROOT}/`) && !spec.startsWith('@ihui/shared')
}

// ---------------------------------------------------------------- 核心判据(纯函数)

/**
 * 图的输入:`Map<relPath, 源码文本>`。全部判据在这一个纯函数里算完,
 * 于是自检/镜像能用**构造面**证明有牙,不依赖真仓瞬时状态(§103 的教训)。
 */
export function analyzeCore({ sharedFiles, hostFiles, hostDirs = HOST_DIRS }) {
  const masked = new Map()
  const rawLinesByFile = new Map()
  const edgesByFile = new Map()
  const opaqueByFile = new Map()
  const prepare = (rel, text) => {
    const code = maskComments(text)
    masked.set(rel, code)
    rawLinesByFile.set(rel, text.split(/\r?\n/))
    const { edges, opaque } = extractEdges(code)
    edgesByFile.set(rel, edges)
    opaqueByFile.set(rel, opaque)
  }
  for (const [rel, text] of sharedFiles) prepare(rel, text)
  for (const [rel, text] of hostFiles) prepare(rel, text)

  const known = new Set(sharedFiles.keys())
  /** shared 内含 Node **值**导入的文件(可达性判据的分母) */
  const nodeFiles = new Map()
  /** 解析不到但明显指向 shared 子路径的 specifier ⇒ 未判定 */
  const unresolved = []
  const externalSpecs = new Map()

  const builtinHits = (rel) => {
    const out = []
    const lines = rawLinesByFile.get(rel) || []
    for (const e of edgesByFile.get(rel) || []) {
      if (!e.builtin || e.typeOnly) continue
      if (hasExemption(lines, e.line)) continue
      out.push(e)
    }
    return out
  }
  for (const rel of sharedFiles.keys()) {
    const hits = builtinHits(rel)
    if (hits.length) nodeFiles.set(rel, hits)
    const wantsShared = (edgesByFile.get(rel) || []).filter(
      (e) => !e.typeOnly && !isBuiltinSpec(e.spec) && aimsAtShared(e.spec, rel),
    )
    for (const e of wantsShared) {
      if (!resolveIntoShared(e.spec, rel, known)) unresolved.push({ file: rel, spec: e.spec, line: e.line })
    }
  }

  /** shared 内部值边(用于闭包遍历) */
  const innerEdges = (rel) => {
    const out = []
    for (const e of edgesByFile.get(rel) || []) {
      if (e.typeOnly || isBuiltinSpec(e.spec)) continue
      if (isExternalSpec(e.spec)) {
        externalSpecs.set(rel, (externalSpecs.get(rel) || 0) + 1)
        continue
      }
      const to = resolveIntoShared(e.spec, rel, known)
      if (to && to !== rel) out.push(to)
    }
    return out
  }

  const walk = (seeds) => {
    const parent = new Map()
    const queue = []
    for (const s of seeds) if (known.has(s) && !parent.has(s)) {
      parent.set(s, null)
      queue.push(s)
    }
    for (let i = 0; i < queue.length; i++) {
      const cur = queue[i]
      for (const next of innerEdges(cur)) {
        if (parent.has(next)) continue
        parent.set(next, cur)
        queue.push(next)
      }
    }
    return parent
  }
  const chainOf = (parent, target) => {
    const chain = []
    let cur = target
    while (cur) {
      chain.unshift(cur)
      cur = parent.get(cur) ?? null
    }
    return chain
  }

  const red = []
  const notices = []

  // ---- R1:公开入口闭包
  const seeds = entrySeeds({ sharedFiles, masked })
  if (seeds.length === 0) {
    throw new Undetermined(`${SHARED_ENTRY} 及其 exports 显式目标一个都没取到 ⇒ 无法判定(判据失明不是通过)`)
  }
  const parent = walk(seeds)
  const closure = [...parent.keys()]
  for (const nodeFile of nodeFiles.keys()) {
    if (!parent.has(nodeFile)) continue
    red.push({
      rule: 'R1',
      file: nodeFile,
      chain: chainOf(parent, nodeFile),
      hits: nodeFiles.get(nodeFile).map((h) => ({ spec: h.spec, line: h.line })),
      why: 'Node 内建模块导入位于**公开入口的可达闭包**内 ⇒ 非 Node 宿主的构建链会拿到它',
    })
  }

  // ---- R2:非 Node 宿主直连含 Node 依赖的 shared 文件(绕过 barrel 的那条路)
  const closureSet = new Set(closure)
  const hostClosureParent = new Map(parent)
  for (const [hostRel, text] of hostFiles) {
    if (!hostDirs.some((d) => hostRel.startsWith(`${d}/`) || hostRel === d)) continue
    const lines = rawLinesByFile.get(hostRel) || []
    for (const e of edgesByFile.get(hostRel) || []) {
      if (e.typeOnly || isBuiltinSpec(e.spec)) continue
      const target = resolveIntoShared(e.spec, hostRel, known)
      if (!target) {
        // 只有**明显指向 shared** 的说明符解析不到才算未判定;宿主自己的相对路径与 npm 包不参与
        if (aimsAtShared(e.spec, hostRel)) unresolved.push({ file: hostRel, spec: e.spec, line: e.line })
        continue
      }
      const nodeInChain = nodeFiles.get(target)
      if (nodeInChain) {
        red.push({
          rule: 'R2',
          file: hostRel,
          chain: [hostRel, target],
          hits: nodeInChain.map((h) => ({ spec: h.spec, line: h.line })),
          why: '非 Node 宿主**直接 import 了含 Node 依赖的 shared 文件**(不经 barrel 也是同一件事)',
        })
        continue
      }
      // 宿主摸进的是一个"自身干净、但其下游闭包含 Node"的文件 ⇒ 同一条链,仍判红
      if (closureSet.has(target)) continue
      const localParent = walk([target])
      hostClosureParent.set(hostRel, localParent)
      const reached = [...localParent.keys()].find((f) => nodeFiles.has(f))
      if (reached) {
        red.push({
          rule: 'R2',
          file: hostRel,
          chain: [hostRel, ...chainOf(localParent, reached)],
          hits: nodeFiles.get(reached).map((h) => ({ spec: h.spec, line: h.line })),
          why: '宿主直连的 shared 子路径其**下游闭包**含 Node 依赖',
        })
      }
    }
    if (!masked.has(hostRel)) void text // 保持 prepare 结果可读,不参与判定
  }

  // ---- R3:只报数的两类
  const unreachableNodeFiles = [...nodeFiles.keys()].filter((f) => !closureSet.has(f))
  if (unreachableNodeFiles.length) {
    notices.push(
      `ℹ️  shared 内含 Node 依赖但**入口闭包不可达** ${unreachableNodeFiles.length} 个文件(现状,不是"shared 是纯的"):${unreachableNodeFiles.join(', ')}`,
    )
  }
  let opaqueTotal = 0
  for (const n of opaqueByFile.values()) opaqueTotal += n
  const opaqueFiles = [...opaqueByFile.entries()].filter(([, n]) => n > 0).map(([f, n]) => `${f}(${n})`)
  if (opaqueTotal || unresolved.length) {
    notices.push(
      `ℹ️  未判定如实计数:动态/不可解析 import 形态 ${opaqueTotal} 处(${opaqueFiles.slice(0, 6).join(', ') || '无'});指向 shared 但解析不到 ${unresolved.length} 处${unresolved.length ? `:${unresolved.slice(0, 8).map((u) => `${u.file}:${u.line} → ${u.spec}`).join(' | ')}` : ''}`,
    )
  }
  const exempted = countExemptions(sharedFiles, rawLinesByFile) + countExemptions(hostFiles, rawLinesByFile)

  const exit = red.length > 0 ? 1 : 0
  return {
    exit,
    red,
    notices,
    counts: {
      sharedFiles: sharedFiles.size,
      hostFiles: hostFiles.size,
      seeds: seeds.length,
      closure: closure.length,
      nodeFiles: nodeFiles.size,
      unreachableNodeFiles: unreachableNodeFiles.length,
      opaque: opaqueTotal,
      unresolved: unresolved.length,
      exempted,
      externalSpecFiles: externalSpecs.size,
      red: red.length,
    },
  }
}

/** 公开入口种子:src/index.ts + package.json 里**非通配**的 exports 目标 */
export function entrySeeds({ sharedFiles, masked }) {
  const seeds = []
  if (sharedFiles.has(SHARED_ENTRY)) seeds.push(SHARED_ENTRY)
  const manifest = sharedFiles.get(SHARED_MANIFEST)
  if (manifest) {
    try {
      const pkg = JSON.parse(manifest)
      for (const [key, value] of Object.entries(pkg.exports || {})) {
        if (key.includes('*')) continue
        const target = typeof value === 'string' ? value : value?.import
        if (typeof target !== 'string' || !target.startsWith('./')) continue
        const rel = `${SHARED_ROOT}/${target.slice(2)}`
        if (sharedFiles.has(rel) && !seeds.includes(rel)) seeds.push(rel)
      }
    } catch {
      /* 清单解析失败 ⇒ 只按 index.ts 起种子(不猜、不静默:seeds 数会体现在汇总行) */
    }
  }
  void masked
  return seeds
}

function countExemptions(files, rawLinesByFile) {
  let n = 0
  for (const rel of files.keys()) {
    for (const line of rawLinesByFile.get(rel) || []) if (EXEMPT_RE.test(line)) n += 1
  }
  return n
}

// ---------------------------------------------------------------- 取材面

/** 测试面不参与判定:测试文件不进任何宿主产物,把它们算进"含内建依赖"会把报告读成假现状 */
const TEST_PATH_RE = /(^|\/)(__(?:tests?|snapshots)__|tests?)\/|\.(test|spec)\.[cm]?[jt]sx?$/

function listSharedPaths(root, face) {
  const args =
    face === 'staged'
      ? ['ls-files', '-z', '--', SHARED_SRC, SHARED_MANIFEST]
      : ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', SHARED_SRC, SHARED_MANIFEST]
  const out = gitRaw(args, root, { timeout: GIT_TIMEOUT })
  const kept = []
  let tests = 0
  for (const p of out.split('\0').filter(Boolean)) {
    if (!SOURCE_EXT_RE.test(p) && p !== SHARED_MANIFEST) continue
    // package.json 落在 .json 上,SOURCE_EXT_RE 不认 ⇒ 必须显式放行(它是入口种子的来源)
    if (TEST_PATH_RE.test(p)) {
      tests += 1
      continue
    }
    kept.push(p)
  }
  return { paths: kept, tests }
}

/** 宿主候选:一次 git grep 预筛(全量逐文件 cat 是 5000 个 blob,预筛后 ≈400) */
function listHostPaths(root, face) {
  const args = ['grep', '-l', '-I', '-z', '--fixed-strings']
  for (const p of HOST_PREFILTER_PATTERNS) args.push('-e', p)
  if (face === 'staged') args.push('--cached')
  else args.push('HEAD')
  args.push('--', ...HOST_DIRS)
  let out
  try {
    out = gitRaw(args, root, { timeout: GIT_TIMEOUT })
  } catch (e) {
    // git grep 无命中时退 1(正常结论);其余一律原样抛 —— 把"预筛没跑成"折成"零宿主"
    // 就是一道对宿主面全盲、却报绿的尺子。
    if (e instanceof Undetermined && e.status === 1) return { paths: [], tests: 0 }
    throw e
  }
  const hits = out
    .split('\0')
    .filter(Boolean)
    .map((p) => p.replace(/^(?:HEAD|--cached):/, ''))
    .filter((p) => SOURCE_EXT_RE.test(p) && HOST_DIRS.some((d) => p.startsWith(`${d}/`)))
  const kept = hits.filter((p) => !TEST_PATH_RE.test(p))
  return { paths: kept, tests: hits.length - kept.length }
}

export function readFace(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(root, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(root, specs, { maxBuffer: GIT_MAX_BUFFER, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

export function analyze(root, face) {
  const { paths: sharedPaths, tests: sharedTests } = listSharedPaths(root, face)
  const { paths: hostPaths, tests: hostTests } = listHostPaths(root, face)
  // 候选为 0 ⇒ 判死:空扫绝不等于通过
  if (sharedPaths.length === 0) throw new Undetermined(`${SHARED_SRC} 在 ${face} 面枚举到 0 个源文件 ⇒ 判据失效,不计通过`)
  const texts = readFace(root, face, [...sharedPaths, ...hostPaths])
  const sharedFiles = new Map()
  const hostFiles = new Map()
  const unreadable = []
  for (const p of sharedPaths) {
    const t = texts.get(p)
    if (typeof t === 'string') sharedFiles.set(p, t)
    else unreadable.push(p)
  }
  // 全量面拿不到入口 blob 是判据失效;索引面允许"本次提交删了它"以外的缺失,由 R1 的种子检查兜
  if (face === 'head' && !sharedFiles.has(SHARED_ENTRY)) {
    throw new Undetermined(`HEAD 面取不到 ${SHARED_ENTRY} ⇒ 无法判定`)
  }
  for (const p of hostPaths) {
    const t = texts.get(p)
    if (typeof t === 'string') hostFiles.set(p, t)
    else unreadable.push(p)
  }
  const out = analyzeCore({ sharedFiles, hostFiles })
  out.mode = face === 'staged' ? 'staged(索引 blob)' : face === 'worktree' ? 'worktree(磁盘,仅人工)' : 'full(HEAD blob)'
  // 宿主候选为 0 只可能是预筛失效(仓里 400+ 文件提到 @ihui/shared),不得表现为"宿主面无违规"
  if (hostPaths.length === 0) {
    throw new Undetermined(`非 Node 宿主候选枚举到 0 个(预筛词 ${HOST_PREFILTER_PATTERNS.join(' / ')})⇒ 判据对宿主面失明,不计通过`)
  }
  out.counts.hostTestSkipped = hostTests
  out.counts.sharedTestSkipped = sharedTests
  out.notices.push(`ℹ️  测试面不参与判定:shared ${sharedTests} 个 / 宿主 ${hostTests} 个(它们不进任何宿主产物)`)
  if (unreadable.length) {
    out.notices.push(`ℹ️  取不到内容的候选 ${unreadable.length} 个(多为本次提交删除/重命名),未参与判定:${unreadable.slice(0, 6).join(', ')}`)
  }
  return out
}

function main(argv) {
  const root = argv.includes('--root') ? resolvePath(argv[argv.indexOf('--root') + 1] || '.') : ROOT
  // 基准必须是仓库根:root 是子目录时 ls-tree 的路径与 join(root,rel) 会错位(取材层注释里的"自洽但基准错位的假绿")
  try {
    assertRepoRoot(root, '本门')
  } catch (e) {
    console.error(`❌ 无法判定(exit 2): ${e.message}`)
    return 2
  }
  const { face, error } = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (error) {
    console.error(`❌ 无法判定(exit 2): ${error}`)
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
  if (argv.includes('--json')) {
    console.log(JSON.stringify(out, null, 2))
    return out.exit
  }
  for (const n of out.notices) console.log(n)
  if (out.red.length) {
    console.error(`❌ 检出 ${out.red.length} 处 Node 内建模块进入非 Node 宿主的可达面:`)
    for (const r of out.red) {
      console.error(`   [${r.rule}] ${r.file} —— ${r.why}`)
      console.error(`          链路: ${r.chain.join(' → ')}`)
      for (const h of r.hits) console.error(`          内建导入: ${h.spec}(第 ${h.line} 行)`)
    }
    console.error('   出路:把该能力挪到 Node 专属包(或加平台 adapter 注入),**不得**放宽判据;')
    console.error('         确属误判再写行内豁免 `nonde-purity-exempt: <原因>`(须带原因)。')
  }
  const c = out.counts
  console.log(
    `${out.exit === 0 ? '✅' : '❌ 判红'} ${out.mode}:候选 shared ${c.sharedFiles} / 宿主 ${c.hostFiles} / 入口种子 ${c.seeds} / 闭包 ${c.closure} / 含内建文件 ${c.nodeFiles}(不可达 ${c.unreachableNodeFiles})/ 未判定(动态 ${c.opaque} + 解析不到 ${c.unresolved})/ 豁免 ${c.exempted} / 红 ${c.red}`,
  )
  return out.exit
}

// ---------------------------------------------------------------- 自检(纯构造面,零副作用)

function selfTest() {
  let ran = 0
  let fail = 0
  const eq = (label, got, want) => {
    ran += 1
    const g = JSON.stringify(got)
    const w = JSON.stringify(want)
    if (g !== w) {
      fail += 1
      console.log(`  ❌ ${label}\n      got  ${g}\n      want ${w}`)
    } else console.log(`  ✅ ${label}`)
  }
  const IDX = 'packages/shared/src/index.ts'
  const NODEFILE = 'packages/shared/src/utils/nodey.ts'
  const CLEAN = 'packages/shared/src/utils/clean.ts'
  const entry = (extra = '') => new Map([[IDX, `export * from './utils/clean'\n${extra}`]])
  const files = (extra) => {
    const m = new Map(entry())
    m.set(CLEAN, "import { z } from 'zod'\nexport const a = z\n")
    m.set(NODEFILE, "import { lookup } from 'node:dns/promises'\nexport const b = lookup\n")
    for (const [k, v] of extra || []) m.set(k, v)
    return m
  }
  const run = (shared, hosts = new Map(), hostDirs = HOST_DIRS) =>
    analyzeCore({ sharedFiles: shared, hostFiles: hosts, hostDirs })

  const REACH = [IDX, "export * from './utils/clean'\nexport * from './utils/nodey'\n"]
  eq(
    'S1 入口闭包内含 node: 值导入 ⇒ R1 判红并点名链路',
    run(files(new Map([REACH]))).red.map((r) => `${r.rule}:${r.file}`).sort(),
    [`R1:${NODEFILE}`],
  )
  eq('S2 同一内建导入挪到无人可达的文件 ⇒ 不判红,但必须进"不可达"报数', (() => {
    const r = run(files(new Map([[IDX, "export * from './utils/clean'\n"]])))
    return [r.red.length, r.counts.unreachableNodeFiles]
  })(), [0, 1])
  eq('S3 注入对照:barrel 加一行 export ⇒ 同一夹具从 0 红变 1 红(可达性判据有牙)', (() => {
    const bare = run(files(new Map([[IDX, "export * from './utils/clean'\n"]])))
    const inj = run(files(new Map([[IDX, "export * from './utils/clean'\nexport * from './utils/nodey'\n"]])))
    return [bare.red.length, inj.red.length, inj.red[0]?.chain?.join('>')]
  })(), [0, 1, `${IDX}>${NODEFILE}`])
  eq('S4 子路径 re-export 也算闭包边(经 utils/index.ts 一跳)', (() => {
    const m = files(new Map([[IDX, "export * from './utils'\n"], ['packages/shared/src/utils/index.ts', "export * from './nodey'\n"]]))
    return run(m).red[0]?.chain?.length
  })(), 3)
  eq('S5 `import type` 豁免:类型期内建导入不判红', run(new Map([[IDX, "import type { X } from 'node:dns'\nexport type { X }\n"]])).red.length, 0)
  eq('S6 裸内建名同样算(名单逐条正向证明,不只 node: 前缀)', BARE_BUILTINS.map((n) => isBuiltinSpec(n)).filter(Boolean).length, BARE_BUILTINS.length)
  eq('S7 node: 前缀与 npm 包区分', [isBuiltinSpec('node:fs'), isBuiltinSpec('fs'), isBuiltinSpec('fs-extra'), isBuiltinSpec('zod'), isBuiltinSpec('@nodeutils/path')], [true, true, false, false, false])
  eq(
    'S8 R2:宿主直连含内建依赖的 shared 子路径 ⇒ 判红(绕过 barrel 那条路)',
    run(files(new Map([REACH])), new Map([['apps/miniapp-taro/src/pages/a.tsx', "import { b } from '@ihui/shared/utils/nodey'\nexport const p = b\n"]])).red.map((r) => r.rule),
    ['R1', 'R2'],
  )
  eq('S9 R2 反向:宿主直连自身干净的文件 ⇒ 不判红(判据不是"宿主 import 了 shared")', (() => {
    const hosts = new Map([['apps/miniapp-taro/src/pages/a.tsx', "import { a } from '@ihui/shared/utils/clean'\nexport const p = a\n"]])
    const r = run(files(new Map([[IDX, "export * from './utils/clean'\n"]])), hosts)
    return r.red.length
  })(), 0)
  eq('S10 R2 经下游闭包(宿主 → 干净文件 → 含内建文件)也判红', (() => {
    // clean 不经 barrel 导出 ⇒ R1 不会红,只有 R2 抓得到"宿主摸进一条含内建依赖的链"
    const shared = new Map([
      [IDX, 'export const nothing = 1\n'],
      [CLEAN, "import { b } from './nodey'\nexport const a = b\n"],
      [NODEFILE, "import { lookup } from 'node:dns/promises'\nexport const b = lookup\n"],
    ])
    const hosts = new Map([['apps/web/app/x.tsx', "import { a } from '@ihui/shared/utils/clean'\nexport const p = a\n"]])
    const r = analyzeCore({ sharedFiles: shared, hostFiles: hosts })
    return [r.red.filter((x) => x.rule === 'R1').length, r.red.filter((x) => x.rule === 'R2').length, r.counts.unreachableNodeFiles]
  })(), [0, 1, 1])
  eq('S11 相对路径摸进 packages/shared 同样算(不能只认包名说明符)', (() => {
    const hosts = new Map([['packages/app/src/features/x.ts', "import { b } from '../../../shared/src/utils/nodey'\nexport const p = b\n"]])
    return run(files(new Map([REACH])), hosts).red.filter((r) => r.rule === 'R2').length
  })(), 1)
  eq(
    'S12 宿主清单被写空 ⇒ R2 全部隐身(本条就是"反向对照"的那把尺子:清单一空红数必变)',
    (() => {
      const hosts = new Map([['apps/miniapp-taro/src/pages/a.tsx', "import { b } from '@ihui/shared/utils/nodey'\nexport const p = b\n"]])
      const withDirs = run(files(new Map([REACH])), hosts, HOST_DIRS).red.filter((r) => r.rule === 'R2').length
      const empty = run(files(new Map([REACH])), hosts, []).red.filter((r) => r.rule === 'R2').length
      return [withDirs, empty]
    })(),
    [1, 0],
  )
  eq('S13 宿主清单在位且五个宿主逐个点名(判据不得被悄悄削窄)', HOST_DIRS.length, 5)
  eq('S14 五个非 Node 宿主必须各自在位', HOST_DIRS.filter((d) => ['apps/miniapp-taro/src', 'apps/mobile-rn/src', 'packages/app/src', 'apps/web', 'apps/extension'].includes(d)).length, 5)
  eq(
    'S15 行内豁免须带原因:有原因 ⇒ 不判红且计数;裸标记 ⇒ 仍判红',
    (() => {
      const ok = files(new Map([[IDX, "export * from './utils/clean'\nexport * from './utils/nodey'\n"], [NODEFILE, "// nonde-purity-exempt: 平台注入前暂留\nimport { lookup } from 'node:dns/promises'\n"]]))
      const bad = files(new Map([[IDX, "export * from './utils/clean'\nexport * from './utils/nodey'\n"], [NODEFILE, "// nonde-purity-exempt: */\nimport { lookup } from 'node:dns/promises'\n"]]))
      return [run(ok).red.length, run(ok).counts.exempted, run(bad).red.length]
    })(),
    [0, 1, 1],
  )
  eq(
    'S16 注释里的 node: 字样不算调用(遮噪后不可见)',
    run(new Map([[IDX, "// 这里说明 node:fs 是什么\nexport const a = 1\n"]])).counts.nodeFiles,
    0,
  )
  eq('S17 动态拼接 import ⇒ 只计未判定,绝不静默成绿', (() => {
    const m = new Map([[IDX, 'const mod = "node:fs"\nconst x = require(mod)\n']])
    const r = analyzeCore({ sharedFiles: m, hostFiles: new Map() })
    return [r.counts.opaque >= 1, r.red.length]
  })(), [true, 0])
  eq('S18 解析不到的 shared 子路径 ⇒ 计入未判定并点名', (() => {
    const m = new Map([[IDX, "export * from './utils/does-not-exist'\n"]])
    const r = analyzeCore({ sharedFiles: m, hostFiles: new Map() })
    return [r.counts.unresolved, r.notices.some((n) => n.includes('解析不到'))]
  })(), [1, true])
  eq('S19 一个入口种子都取不到 ⇒ 抛 Undetermined(判据失明不是通过)', (() => {
    try {
      analyzeCore({ sharedFiles: new Map([['packages/shared/src/other.ts', 'export const a = 1\n']]), hostFiles: new Map() })
      return 'no-throw'
    } catch (e) {
      return e instanceof Undetermined ? 'undetermined' : 'other'
    }
  })(), 'undetermined')
  eq('S20 require 与 side-effect import 两种形态都算值边', (() => {
    const m = new Map([[IDX, "require('fs')\nimport 'node:net'\n"]])
    return analyzeCore({ sharedFiles: m, hostFiles: new Map() }).counts.nodeFiles
  })(), 1)
  eq('S21 多行 import 与别名不逃过提取', (() => {
    const m = new Map([[IDX, "import {\n  readFile,\n} from 'node:fs'\nexport const a = readFile\n"]])
    return analyzeCore({ sharedFiles: m, hostFiles: new Map() }).counts.nodeFiles
  })(), 1)
  eq('S22 包外 @ihui 边不追但如实计数(不得表现为"闭包里没有")', (() => {
    const m = new Map([[IDX, "import { zed } from '@ihui/types'\nexport const a = zed\n"]])
    return analyzeCore({ sharedFiles: m, hostFiles: new Map() }).counts.externalSpecFiles
  })(), 1)
  eq('S23 退出码方向:有红 1、无红 0', [run(files(new Map([REACH]))).exit, run(new Map([[IDX, 'export const a = 1\n']])).exit], [1, 0])
  console.log(fail ? `\n❌ 自检 ${fail}/${ran} 例失败` : `\n全部 ${ran} 例通过(R1 可达性 + R2 宿主直连 + R3 只报数 + 豁免三态 + 退出码方向)`)
  process.exit(fail ? 1 : 0)
}

// §22d:被 import 时不得触发 CLI 副作用(镜像测试要直接 import 判据函数)
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  if (process.argv.slice(2).includes('--self-test')) selfTest()
  else process.exit(main(process.argv.slice(2)))
}

export const __test__ = {
  analyzeCore,
  entrySeeds,
  extractEdges,
  isBuiltinSpec,
  resolveIntoShared,
  hasExemption,
  maskComments,
  HOST_DIRS,
  BARE_BUILTINS,
  SHARED_ENTRY,
  SHARED_MANIFEST,
  SELF_SKIP,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
