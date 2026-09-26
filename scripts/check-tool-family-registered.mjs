// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门「工具族注册对账」(2026-09-26 立,根治"造好没装车"最高频那一型)
//
// 判一条:`apps/cli/src/tools/**` 里**定义并 export 出来的工具族**,必须能在生产面找到把它挂进
// 注册表的调用点(import 且落在 register/install…Tools(...) 的参数位,或经父族组合/一跳委托到达)。
// 找不到 ⇒ 点名。
//
// 立因(实测,不是假想):`apps/cli/src/tools/debug.ts:940` 定义并导出 `DEBUG_TOOLS`
// (debug_launch / debug_attach / … / debug_list_sessions 共 10 枚 DAP 工具),而全树 `git grep`
// 只命中它自己的定义与两个测试文件 —— `commands/agent.ts:297-308` 注册的是
// BUILTIN/GIT/FETCH/WEB_SEARCH/TEST/DIAGNOSTIC/CODEGRAPH/CLIPBOARD/file-edit/subagent/mcp,
// `tools/index.ts:421` 只有 `registerBrowserTools()` 一个族级注册点,**没有 debug 的对应物**。
// 后果:那句"30 分钟自动清理"与整族能力对模型**不可达**,而 `pnpm typecheck` / lint /
// 现有一百多道守门一路报绿。
//
// 与近邻门的分工(不重叠):
//   · 守门「运行时注册表投影对账」判的是"运行时注册表快照 ↔ 源码投影一致" —— 它的输入已经是
//     **注册之后**的集合,所以"整族从未注册"在它眼里根本不存在(没注册 ⇒ 两侧都没有 ⇒ 一致)。
//     本门补的正是那一格。
//   · 守门 115(check-tool-arg-validation-wired)判"某个函数有没有生产调用方"(单点);
//     本门判"一族工具有没有被挂进注册表"(集合 + 注册语义)。
//
// **三态是这门的全部价值**(与守门 127 同取向):命中 / 未注册(违规) / **未判定**。
//   动态拼接的注册参数、`export *` barrel、命名空间转发、别处的同名本地符号、说明符解析不到
//   —— 一律承认看不见,**既不记绿也不判红**。把"看不见"洗成"确信没有"是这台门最贵的失效方式。
//
// 定级 **warn 是设计前提,不是偷懒**:debug 族现在就处于未注册状态,当场 blocking 就是一台与
//   任何提交都无关的恒红门,唯一结局是逼人 `--no-verify` 连带废掉全部守门(§12e 同型)。
//   同时提供**存量棘轮**:锚点 = 该族在 HEAD 自身的状态,只拦"新出现的零注册族"与"本次把注册点
//   摘掉"两种形态 ⇒ 以后再加一族不注册就会红,而存量债不替人背。问责入口 `--strict`
//   (`pnpm check:tool-family`)。**升 blocking 的前置条件 = 未注册存量归零**,不得为消红削判据。
//
// 取材口径(同 70/77/83/98/101/103/115/118):全量判 **HEAD blob**、`--staged` 判**索引 blob**、
//   `--worktree` 只作人工逃生舱;两面旗同给 ⇒ exit 2;取不到 ⇒ **exit 2「无法判定」且不回落**
//   另一个面;枚举到 0 个 tools 文件或解析到 0 个族声明 ⇒ 判死(扫描面判空 = 判据失效)。
//   清单与内容**同面同轮**,且必须走 scripts/lib/face-reader.mjs(守门 118 的"半接线"那一型:
//   引了层却仍自己 `git show` / 读磁盘 = 没有收口)。ROOT 由脚本自身位置推导,**不靠 cwd**
//   (守门 70 的镜像测试 13/14 恒红那一型)。
//
// 用法:
//   node scripts/check-tool-family-registered.mjs              # 全量(HEAD 面),存量只报数
//   node scripts/check-tool-family-registered.mjs --staged     # 索引面 + HEAD 棘轮(改坏才红)
//   node scripts/check-tool-family-registered.mjs --strict     # 存量也问责(CI / 巡检)
//   node scripts/check-tool-family-registered.mjs --json       # 机器可读结论
//   node scripts/check-tool-family-registered.mjs --self-test  # 临时独立仓正反成对自检
//   --root <dir>   显式仓库根(测试通道;生产不带)   --worktree  磁盘面(仅人工)
// 退出码:0 通过 / 1 判据违规 / 2 无法判定或脚本自身异常
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
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
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 族声明面:CLI 工具族的定义处(含子目录 hub/ sandbox/ command-policy/ …)。 */
export const TOOLS_DIR = 'apps/cli/src/tools'
const ARRAY_FAMILY_RE = /^[A-Z][A-Z0-9_]*_TOOLS$/
const ENTRY_FAMILY_RE = /^(?:register|install)[A-Z][A-Za-z0-9]*Tools$/
const REGISTER_CALLEE_RE = /^(?:register|install)[A-Za-z0-9_]*Tools?$/
/** 本门自己的判据串会逐字含族名(镜像测试/夹具),不参与对账。 */
const SELF_EXEMPT_BASENAMES = ['check-tool-family-registered.mjs']

export const SKIP_ENV_NAME = 'HUSKY_SKIP_TOOL_FAMILY_REGISTERED'
/** 本票申报的编号(撞号即红 —— 仓里记过至少四次同日撞号)。 */
export const GUARDIAN_ID_EXPECTED = '131'

// ==================== 词法:遮噪 + 括号配平 ====================

/**
 * 把注释与字符串/模板**内容**抹成空格(保留行结构与引号本身,便于解析说明符时另取原文)。
 *
 * 为什么必须抹:注册点判据认的是**标识符**,而本仓注释里大量逐字写着被解释的族名
 * (`tools/index.ts:952` 就有一句"…GITHUB_PR_TOOLS 在此 re-export 供按需导入")。
 * 不抹注释 ⇒ 一行解释文字就能给自己发合格证(§22c「判据失效的表现永远是安静」同型)。
 */
export function maskNoise(text) {
  const out = []
  let state = 'code'
  let i = 0
  while (i < text.length) {
    const c = text[i]
    const n2 = text[i + 1]
    if (state === 'code') {
      if (c === '/' && n2 === '/') {
        state = 'line'
        out.push(' ', ' ')
        i += 2
        continue
      }
      if (c === '/' && n2 === '*') {
        state = 'block'
        out.push(' ', ' ')
        i += 2
        continue
      }
      if (c === "'") state = 'sq'
      else if (c === '"') state = 'dq'
      else if (c === '`') state = 'tpl'
      out.push(c)
      i += 1
      continue
    }
    if (state === 'line') {
      if (c === '\n') {
        state = 'code'
        out.push(c)
      } else out.push(' ')
      i += 1
      continue
    }
    if (state === 'block') {
      if (c === '*' && n2 === '/') {
        state = 'code'
        out.push(' ', ' ')
        i += 2
        continue
      }
      out.push(c === '\n' ? c : ' ')
      i += 1
      continue
    }
    const quote = state === 'sq' ? "'" : state === 'dq' ? '"' : '`'
    if (c === '\\') {
      out.push(' ', text[i + 1] === '\n' ? '\n' : ' ')
      i += 2
      continue
    }
    if (c === quote) {
      state = 'code'
      out.push(c)
      i += 1
      continue
    }
    if ((state === 'sq' || state === 'dq') && c === '\n') {
      // 裸引号串里出现换行 = 词法已不可信 ⇒ 退回 code。宁可多看见一行,也不许"抹多了"把红洗成绿。
      state = 'code'
      out.push(c)
      i += 1
      continue
    }
    out.push(' ')
    i += 1
  }
  return out.join('')
}

/** 从 openIdx(指向开括号)取配平整段(含括号);配不平 ⇒ null(交调用方判未判定)。 */
export function balanced(text, openIdx, open = '(', close = ')') {
  if (openIdx < 0 || text[openIdx] !== open) return null
  let depth = 0
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === open) depth += 1
    else if (text[i] === close) {
      depth -= 1
      if (depth === 0) return text.slice(openIdx, i + 1)
    }
  }
  return null
}

/** 命中位置处的花括号深度(0 = 模块顶层)。 */
export function braceDepthAt(masked, idx) {
  let d = 0
  for (let i = 0; i < idx; i++) {
    if (masked[i] === '{') d += 1
    else if (masked[i] === '}') d -= 1
  }
  return Math.max(0, d)
}

// ==================== 判据纯函数 ====================

export function isTestSurface(rel) {
  return (
    /(^|\/)(tests?|__tests__|e2e|fixtures)\//.test(rel) || /\.(test|spec)\.[cm]?[jt]sx?$/i.test(rel)
  )
}

export function classifyPath(rel) {
  const base = rel.split('/').pop() ?? rel
  if (SELF_EXEMPT_BASENAMES.includes(base)) return 'self'
  if (/\.(md|mdx|txt|json|ya?ml|css|scss|svg|png)$/i.test(rel)) return 'doc'
  if (isTestSurface(rel)) return 'test'
  if (!/\.[cm]?[jt]sx?$/i.test(rel)) return 'other'
  return 'prod'
}

/** `./x.js` → 该仓里可能的落地路径(不跟随真实 fs,只做形态映射;判据据 defFile 反查)。 */
export function resolveSpec(fromDir, spec) {
  const joined = join(fromDir, spec).replace(/\\/g, '/').replace(/^\.\//, '')
  const bare = joined.replace(/\.m?js$/, '')
  return [`${bare}.ts`, `${bare}.tsx`, `${bare}/index.ts`]
}

/** 说明符候选是否指向这个被审文件(barrel `./dir` → `dir/index.ts` 与 `dir/thing.ts` 不同物)。 */
export function specMatches(candidates, defFile) {
  return candidates.some((c) => defFile === c)
}

/** 族声明解析。**只**判这三种形态,其余 export 形态(工具工厂 `createXTools()`、逐枚
 *   `export const debug_launch: Tool`)一律不纳 ⇒ 那一型未注册本门看不见(已知覆盖面缺口,
 *   未实现"未建模计数"输出;扩形态时不得把已纳的三种改窄)。
 *   A `export const NAME_TOOLS … = [...]`      —— 数组族
 *   B `export function registerNAMETools(…)`   —— 自注册入口族
 *   C `export const registerNAMETools = (…)`   —— 同上(const 形态)
 */
export function findDeclarations(rel, masked) {
  const out = []
  const seen = new Set()
  const add = (name, kind, idx) => {
    if (!name || seen.has(name)) return
    seen.add(name)
    let text = ''
    if (kind === 'array') {
      text = arrayLiteralOf(masked, idx)
    }
    out.push({ name, kind, file: rel, text, at: idx })
  }
  for (const m of masked.matchAll(/^[ \t]*export[ \t]+const[ \t]+([A-Z][A-Z0-9_]*_TOOLS)\b/gm))
    add(m[1], 'array', m.index)
  for (const m of masked.matchAll(
    /^[ \t]*export[ \t]+(?:async[ \t]+)?function[ \t]+((?:register|install)[A-Z][A-Za-z0-9]*Tools)\b/gm,
  ))
    add(m[1], 'entry', m.index)
  for (const m of masked.matchAll(
    /^[ \t]*export[ \t]+const[ \t]+((?:register|install)[A-Z][A-Za-z0-9]*Tools)\b[ \t]*=/gm,
  ))
    add(m[1], 'entry', m.index)
  return out
}

/**
 * 取一个 `export const X … = […]` 的数组字面量文本(组合边的唯一来源)。
 *
 * 两处坑都由实测逼出:
 *  ① 首个 `[` 属于**类型标注**(`export const GIT_TOOLS: Tool[] = [`)—— 拿它解出的是 `[]`,
 *    组合边全丢 ⇒ 把"其实已随父族 spread 挂上"的子族误判成未注册(假阳,本仓最贵的失效方向
 *    之一是让门去指使人修没坏的东西)。所以只在 `=` 之后找。
 *  ② 初始化式不是数组时(`= PAGE_ACTIONS.map(a → MAP[a])`),继续往后找会捞到**别的语句**的
 *    `[` ⇒ 凭空造出一条边,把未注册洗成已注册(假绿)。故只在"声明所属语句窗口"内找,并且
 *    只认前一个有效字符是 `= ( , : > [` 之一的那个 `[`(数组字面量的开括号必在这些语境里)。
 */
export function arrayLiteralOf(masked, declIdx) {
  const eq = masked.indexOf('=', declIdx)
  if (eq < 0) return ''
  const ends = [masked.indexOf(';', eq), masked.indexOf('\nexport ', eq), masked.indexOf('\nconst ', eq)]
    .filter((n) => n > eq)
    .sort((a, b) => a - b)
  const stop = ends.length > 0 ? ends[0] : Math.min(masked.length, eq + 20000)
  let cursor = eq
  while (cursor < stop) {
    const lb = masked.indexOf('[', cursor + 1)
    if (lb < 0 || lb > stop) return ''
    let p = lb - 1
    while (p > eq && /[\s]/.test(masked[p])) p -= 1
    if ('=(,:>'.includes(masked[p])) {
      const lit = balanced(masked, lb, '[', ']')
      if (lit !== null) return lit
      return ''
    }
    cursor = lb
  }
  return ''
}

/** 声明体里出现的**其它**族名 ⇒ 组合边(父族被注册,被 spread 进去的子族算一并挂上)。 */
export function compositionEdges(decl) {
  if (decl.kind !== 'array' || !decl.text) return []
  const ids = new Set()
  for (const m of decl.text.matchAll(/\b([A-Z][A-Z0-9_]*_TOOLS)\b/g))
    if (m[1] !== decl.name && ARRAY_FAMILY_RE.test(m[1])) ids.add(m[1])
  return [...ids]
}

/**
 * 导出声明的区间(用于"注册点落在哪个导出函数体内"的一跳判定)。
 * entry 族取函数体/对象字面量的花括号配平段;array 族只取到下一个顶层 `export`(它不该被当 owner)。
 */
export function exportRanges(masked, decl) {
  if (decl.kind === 'entry') {
    const braceStart = masked.indexOf('{', masked.indexOf('(', decl.at))
    const body = braceStart >= 0 ? balanced(masked, braceStart, '{', '}') : null
    if (body) return { start: decl.at, end: braceStart + body.length }
  }
  const nxt = masked.indexOf('\nexport ', decl.at)
  return { start: decl.at, end: nxt < 0 ? masked.length : nxt }
}

/**
 * 单个生产文件能提供的证据:
 *   · registerSites:原名 → {pos, depth}(出现在 register/install…Tools(...) 参数位)
 *   · nsModules / starReExports:命名空间与 `export *` 转发 ⇒ 结构上看不见的那些
 *   · locally:本文件自己声明的同名符号(不得冒充别人的注册点)
 *   · imports:原名 → 说明符候选集
 *   · fnCalled:本文件调用过的函数名集合(一跳委托用)
 */
export function scanEvidence(rel, raw, masked, knownNames) {
  const imports = new Map()
  const nsModules = new Map()
  const starReExports = new Set()
  const alias = new Map()
  const locally = new Set()
  const stmtRe =
    /(?:^|\n)[ \t]*(import|export)[ \t]+(?:(\*\s*as\s+([A-Za-z_$][\w$]*)|\*\s*|([A-Za-z_$][\w$]*)|(?:\{([\s\S]*?)\}))\s*from[ \t]*)?['"]([^'"\n]+)['"]/g
  for (const m of raw.matchAll(stmtRe)) {
    const spec = m[6]
    if (!spec || !spec.startsWith('.')) continue
    const candidates = resolveSpec(dirname(rel), spec)
    if (m[3]) nsModules.set(m[3], candidates)
    if (m[2] === '*') {
      if (m[1] === 'export' && !m[3]) starReExports.add(candidates.join('|'))
      continue
    }
    for (const part of (m[5] ?? '').split(',')) {
      const seg = part.trim()
      if (!seg || /^type\b/.test(seg)) continue
      const [orig, aliasName] = seg.split(/\s+as\s+/).map((s) => s.trim())
      if (!orig) continue
      if (!imports.has(orig)) imports.set(orig, new Set())
      candidates.forEach((c) => imports.get(orig).add(c))
      if (aliasName && aliasName !== orig) alias.set(aliasName, orig)
    }
  }
  for (const m of masked.matchAll(
    /^[ \t]*(?:export[ \t]+)?(?:default[ \t]+)?(?:const|let|var|function|class)[ \t]+([A-Za-z_$][\w$]*)/gm,
  ))
    locally.add(m[1])

  const registerSites = new Map()
  let dynamic = false
  for (const m of masked.matchAll(/\b((?:register|install)[A-Za-z0-9_]*)[ \t]*\(/g)) {
    if (!REGISTER_CALLEE_RE.test(m[1])) continue
    const openIdx = m.index + m[0].length - 1
    const args = balanced(masked, openIdx)
    if (args === null) {
      dynamic = true
      continue
    }
    if (/\$\{/.test(args) || /\[\s*[^\]0-9]/.test(args)) dynamic = true
    for (const idm of args.matchAll(/[A-Za-z_$][\w$]*/g)) {
      const orig = alias.get(idm[0]) ?? idm[0]
      if (knownNames.has(orig) && !registerSites.has(orig))
        registerSites.set(orig, { pos: m.index, depth: braceDepthAt(masked, m.index) })
    }
  }
  const fnCalled = new Set()
  for (const m of masked.matchAll(/\b([A-Za-z_$][\w$]*)[ \t]*\(/g)) fnCalled.add(m[1])
  return { rel, masked, imports, nsModules, starReExports, locally, registerSites, dynamic, fnCalled }
}

/**
 * 汇总判据(纯函数,取材在它外面 —— 证明取材面只能用纯函数+构造面,守门 103 的教训)。
 * @param decls     族声明(只来自 TOOLS_DIR)
 * @param prodEvid  生产面证据文件(已 scanEvidence)
 * @param mentions  Map(族名 → [{rel, kind}]) —— 只用来给违规配上可诊断的原因
 */
export function decide(decls, prodEvid, mentions) {
  const byName = new Map(decls.map((d) => [d.name, d]))
  const ranges = new Map()
  for (const d of decls) {
    const text = prodEvid.get(d.file)?.masked
    if (text) ranges.set(d.name, exportRanges(text, d))
  }
  const status = new Map()
  const undetermined = []
  const visiting = new Set()

  /** 这个被审族的定义文件,是否被 P 经具名 import 绑定进来(说明符按形态映射后反查)。 */
  const bindsHere = (e, defFile) => {
    for (const targets of e.imports.values())
      if ([...targets].some((c) => specMatches([c], defFile))) return true
    return false
  }

  const isRegistered = (name, stackGuard) => {
    if (status.get(name)?.state === 'registered') return true
    if (stackGuard.has(name)) return false
    stackGuard.add(name)
    const decl = byName.get(name)
    if (!decl) return false
    // 自注册入口族(B/C 类):证据是"生产面任何地方调用它",不必落在注册参数位。
    if (decl.kind === 'entry') {
      const caller = [...prodEvid.values()].find(
        (e) => e.rel !== decl.file && e.fnCalled.has(name) && !e.locally.has(name),
      )
      if (caller) {
        status.set(name, { state: 'registered', why: `${name}() 被 ${caller.rel} 调用` })
        stackGuard.delete(name)
        return true
      }
      const selfRuns =
        [...prodEvid.values()].some((e) => e.rel === decl.file && e.fnCalled.has(name)) &&
        [...prodEvid.values()].some((p) => p.rel !== decl.file && bindsHere(p, decl.file))
      if (selfRuns) {
        status.set(name, { state: 'registered', why: `${decl.file} 顶层自执行,且模块被生产面导入` })
        stackGuard.delete(name)
        return true
      }
      status.set(name, {
        state: 'violation',
        why: `自注册入口 ${name}() 在生产面没有任何调用点 ⇒ 整族永不挂上注册表`,
      })
      stackGuard.delete(name)
      return false
    }
    const sites = []
    for (const e of prodEvid.values()) {
      if (!e.registerSites.has(name)) continue
      sites.push({ e, self: e.rel === decl.file })
    }
    let verdict = null
    for (const { e, self } of sites) {
      if (!self) {
        if (bindsHere(e, decl.file)) {
          verdict = { state: 'registered', why: `${e.rel} 注册(具名导入)`, site: e.rel }
          break
        }
        for (const [, cands] of e.nsModules) {
          if (cands.some((c) => decl.file === c)) {
            verdict = { state: 'undetermined', why: `${e.rel} 经命名空间导入转发 ⇒ 名字层面判不出` }
            break
          }
        }
        if (verdict) break
        if (e.locally.has(name)) {
          verdict = { state: 'undetermined', why: `${e.rel} 有自己的同名符号 ⇒ 不能算本族的注册点` }
          break
        }
        verdict = { state: 'undetermined', why: `${e.rel} 有注册点但说明符解析不到 ${decl.file}` }
        break
      }
      // 同文件:注册点在定义文件内 ⇒ 一跳委托(允许,但必须证明那条路有人走)
      const pos = e.registerSites.get(name).pos
      const owner = [...decls].find(
        (d) =>
          d.file === decl.file &&
          d.kind === 'entry' &&
          ranges.get(d.name) &&
          ranges.get(d.name).start <= pos &&
          ranges.get(d.name).end >= pos,
      )
      if (!owner) {
        const imported = [...prodEvid.values()].some(
          (p) => p.rel !== decl.file && bindsHere(p, decl.file),
        )
        verdict = imported
          ? { state: 'registered', why: `${decl.file} 模块顶层注册,且该模块被生产面导入`, site: decl.file }
          : {
              state: 'violation',
              why: `注册代码就在 ${decl.file} 顶层,但该文件在生产面无人 import ⇒ 永不执行`,
            }
        break
      }
      if (isRegistered(owner.name, stackGuard)) {
        verdict = { state: 'registered', why: `经 ${owner.name}() 一跳委托`, site: decl.file }
        break
      }
      verdict = {
        state: 'violation',
        why: `注册点在 ${decl.file} 的 ${owner.name}() 里,而这个入口在生产面没有任何调用点`,
      }
      break
    }
    if (verdict) {
      status.set(name, { ...verdict })
      if (verdict.state === 'undetermined') undetermined.push({ name, reason: verdict.why })
      stackGuard.delete(name)
      return verdict.state === 'registered'
    }
    // 没有任何直接注册点 ⇒ 组合边(父族已注册)算挂上
    for (const d of decls) {
      if (!compositionEdges(d).includes(name)) continue
      if (isRegistered(d.name, stackGuard)) {
        status.set(name, { state: 'registered', why: `随父族 ${d.name} 组合挂上(${d.file})` })
        stackGuard.delete(name)
        return true
      }
    }
    for (const e of prodEvid.values()) {
      if (e.dynamic && e.rel === decl.file) {
        status.set(name, { state: 'undetermined', why: `${decl.file} 的注册参数含动态拼接 ⇒ 判不出` })
        undetermined.push({ name, reason: '注册点参数含动态拼接' })
        stackGuard.delete(name)
        return false
      }
    }
    const ms = (mentions.get(name) ?? []).filter((m) => m.rel !== decl.file)
    const why =
      ms.length === 0
        ? '生产面 0 引用、0 注册点'
        : ms.every((m) => m.kind === 'test' || m.kind === 'doc')
          ? `${ms.length} 个提及全在测试/文档面 ⇒ "测试在跑"与"没人注册"互不矛盾(守门 115 同型)`
          : `${ms.length} 处提及都不落在 register/install…Tools(...) 的参数位`
    status.set(name, { state: 'violation', why, testOnly: ms.every((m) => m.kind === 'test') })
    stackGuard.delete(name)
    return false
  }

  for (const name of [...byName.keys()]) isRegistered(name, visiting)

  const violations = []
  const counts = {
    families: byName.size,
    registered: 0,
    violation: 0,
    undetermined: 0,
  }
  for (const [name, st] of status) {
    if (st.state === 'registered') counts.registered += 1
    else if (st.state === 'undetermined') counts.undetermined += 1
    else {
      counts.violation += 1
      violations.push({ name, file: byName.get(name).file, why: st.why, testOnly: !!st.testOnly })
    }
  }
  violations.sort((a, b) => a.name.localeCompare(b.name))
  return { status, violations, undetermined, counts }
}

/**
 * 存量棘轮:锚点 = 该族在 **HEAD 自身的状态**。
 *   broken  = HEAD 已注册、本面没了(本次把注册点摘掉)⇒ 判红
 *   fresh   = 本面新增的族且未注册                        ⇒ 判红
 *   existing= HEAD 就未注册的存量                          ⇒ 只报数(否则一上台就是恒红门)
 */
export function ratchetize(headRes, faceRes) {
  const headState = (n) => headRes.status.get(n)?.state ?? null
  const fresh = []
  const broken = []
  const existing = []
  const fixed = []
  for (const v of faceRes.violations) {
    if (headState(v.name) === 'registered') broken.push(v)
    else if (headState(v.name) === 'violation') existing.push(v)
    else fresh.push(v)
  }
  for (const [name, st] of headRes.status)
    if (st.state === 'violation' && faceRes.status.get(name)?.state === 'registered') fixed.push(name)
  return { fresh, broken, existing, fixed }
}

// ==================== 取材 ====================

function normLines(text) {
  return String(text)
    .split(/\r?\n/)
    .map((l) => l.replace(/^HEAD:/, '').trim())
    .filter(Boolean)
}

export function listToolsFiles(root, face) {
  const args =
    face === 'head'
      ? ['ls-tree', '-r', '--name-only', 'HEAD', '--', TOOLS_DIR]
      : ['ls-files', '--', TOOLS_DIR]
  return normLines(gitRaw(args, root))
    .filter((p) => /\.tsx?$/.test(p) && !isTestSurface(p))
    .sort()
}

/** 一次 git grep 把所有族名当**固定串**捞一遍(候选超集;判据自己会否证)。 */
export function listEvidenceFiles(root, face, names) {
  if (names.length === 0) return []
  const pats = names.flatMap((n) => ['-e', n])
  const args =
    face === 'head'
      ? ['grep', '-I', '-l', '-F', ...pats, 'HEAD', '--']
      : face === 'staged'
        ? ['grep', '-I', '-l', '-F', '--cached', ...pats, '--']
        : ['grep', '-I', '-l', '-F', ...pats, '--']
  let out
  try {
    out = gitRaw(args, root)
  } catch (e) {
    // git grep 无命中是 exit 1 —— 那是**git 说"没有"**,与"git 没跑成"必须分开。
    if (e instanceof Undetermined && (e.status === 1 || /^\s*$/.test(e.captured ?? ''))) return []
    throw e
  }
  return [...new Set(normLines(out))].sort()
}

function readFace(root, face, files) {
  if (face === 'worktree') {
    const map = new Map()
    for (const rel of files) map.set(rel, readWorktreeFile(root, rel))
    return map
  }
  const specs = files.map((f) => `${face === 'staged' ? ':' : 'HEAD:'}${f}`)
  const bySpec = catBatch(root, specs, { maxBuffer: 128 << 20 })
  const map = new Map()
  files.forEach((rel, i) => map.set(rel, bySpec.get(specs[i]) ?? null))
  return map
}

export function analyze(root, face) {
  assertRepoRoot(root, '工具族注册对账')
  const toolFiles = listToolsFiles(root, face)
  const toolTexts = readFace(root, face, toolFiles)
  const decls = []
  for (const rel of toolFiles) {
    const text = toolTexts.get(rel)
    if (text === null || text === undefined)
      throw new Undetermined(`${FACE_LABEL[face] ?? face} 取不到 ${rel}(清单与内容不同轮 ⇒ 不猜)`)
    for (const d of findDeclarations(rel, maskNoise(text))) decls.push(d)
  }
  const names = new Set(decls.map((d) => d.name))
  const candFiles = listEvidenceFiles(root, face, [...names])
  const candTexts = readFace(root, face, candFiles)
  const prodEvid = new Map()
  const mentions = new Map()
  let nonCode = 0
  for (const rel of candFiles) {
    const raw = candTexts.get(rel)
    if (raw === null || raw === undefined) {
      nonCode += 1
      continue
    }
    const kind = classifyPath(rel)
    const masked = maskNoise(raw)
    for (const n of names) if (new RegExp(`\\b${n}\\b`).test(masked)) {
      if (!mentions.has(n)) mentions.set(n, [])
      mentions.get(n).push({ rel, kind })
    }
    if (kind !== 'prod') continue
    prodEvid.set(rel, scanEvidence(rel, raw, masked, names))
  }
  const out = decide(decls, prodEvid, mentions)
  return {
    face,
    toolFiles: toolFiles.length,
    candidates: candFiles.length,
    unreadable: nonCode,
    declarations: decls.map((d) => `${d.name}@${d.file}`),
    ...out,
  }
}

// ==================== 输出 / CLI ====================

function printVerdict(res, root, ratchet) {
  console.log(`工具族注册对账 · 判定面:${res.face} · ROOT ${root}`)
  console.log(
    `  ${TOOLS_DIR} 下 ${res.toolFiles} 个源文件 · 族 ${res.counts.families} · 已注册 ${res.counts.registered} · 未注册 ${res.counts.violation} · 未判定 ${res.counts.undetermined}${res.unreadable ? ` · 取不到 ${res.unreadable}` : ''}`,
  )
  if (ratchet) {
    console.log(
      `  棘轮(锚点 = 该族在 HEAD 自身的状态):本次新增未注册 ${ratchet.fresh.length} · 本次被摘线 ${ratchet.broken.length} · 存量(HEAD 已如此)${ratchet.existing.length}${ratchet.fixed.length ? ` · 本次修好 ${ratchet.fixed.length}` : ''}`,
    )
    for (const v of ratchet.fresh) console.log(`  ❌ [新增未注册] ${v.name}(${v.file})— ${v.why}`)
    for (const v of ratchet.broken)
      console.log(`  ❌ [注册点被摘掉] ${v.name}(${v.file})— HEAD 面本来是已注册的`)
    if (ratchet.fixed.length) console.log(`  ✅ [本次修好] ${ratchet.fixed.join(' / ')}`)
    for (const v of ratchet.existing) console.log(`  ℹ️ 存量未注册:${v.name}(${v.file})`)
  } else {
    for (const v of res.violations) console.log(`  ❌ ${v.name}(${v.file})— ${v.why}`)
  }
  for (const u of res.undetermined) console.log(`  ⚠️ 未判定:${u.name} — ${u.reason}`)
  const hard = ratchet ? ratchet.fresh.length + ratchet.broken.length : res.violations.length
  if (hard === 0 && res.counts.violation === 0) console.log('  ✅ 每个导出的工具族都能追到注册点')
}

export function main(argv) {
  const set = new Set(argv)
  const flags = new Set(argv.filter((a) => a.startsWith('--')))
  if (set.has('--self-test')) return runSelfTest()
  const rootIdx = argv.indexOf('--root')
  const root = rootIdx >= 0 ? resolve(argv[rootIdx + 1]) : DEFAULT_ROOT
  const { face, error } = selectFace({
    staged: flags.has('--staged'),
    worktree: flags.has('--worktree'),
  })
  if (error) {
    console.error(`❌ ${error}`)
    return 2
  }
  if (flags.has('--help') || flags.has('-h')) {
    console.log(
      `用法: node scripts/check-tool-family-registered.mjs [--staged|--worktree|--strict|--json|--self-test|--root <dir>]\n判定面: 全量=HEAD blob / --staged=索引 blob(带 HEAD 棘轮)/ --worktree=磁盘(仅人工)\n紧急跳过(由 guardian-runner 读取): ${SKIP_ENV_NAME}=1\n预期 guardian id: ${GUARDIAN_ID_EXPECTED}`,
    )
    return 0
  }
  try {
    const res = analyze(root, face)
    if (res.toolFiles === 0) {
      console.error(`❌ 无法判定:${face} 面里 ${TOOLS_DIR} 枚举到 0 个源文件 —— 扫描面判空不是"没有违规"`)
      return 2
    }
    if (res.counts.families === 0) {
      console.error(
        `❌ 无法判定:${TOOLS_DIR} 有 ${res.toolFiles} 个文件却解析到 0 个族声明 —— 判据失明,不记绿`,
      )
      return 2
    }
    let ratchet = null
    if (face === 'staged') ratchet = ratchetize(analyze(root, 'head'), res)
    if (set.has('--json')) {
      console.log(
        JSON.stringify(
          {
            face: res.face,
            toolFiles: res.toolFiles,
            candidates: res.candidates,
            counts: res.counts,
            violations: res.violations,
            undetermined: res.undetermined,
            ratchet: ratchet && {
              fresh: ratchet.fresh.map((v) => v.name),
              broken: ratchet.broken.map((v) => v.name),
              existing: ratchet.existing.map((v) => v.name),
              fixed: ratchet.fixed,
            },
          },
          null,
          2,
        ),
      )
    } else {
      printVerdict(res, root, ratchet)
      console.log(`  取材口径:${FACE_LABEL[face]} —— ${FACE_NOTE[face]}`)
    }
    if (flags.has('--strict')) return res.violations.length > 0 ? 1 : 0
    if (face === 'staged') return ratchet.fresh.length + ratchet.broken.length > 0 ? 1 : 0
    return 0
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`❌ 无法判定:${e.message}`)
      return 2
    }
    console.error(`❌ 脚本自身异常:${e?.stack ?? e}`)
    return 2
  }
}

// ==================== 自检(临时独立 git 仓,正反成对) ====================

const FIXTURES = {
  green: {
    'apps/cli/src/tools/foo.ts': `export const FOO_TOOLS = [a, b];\n`,
    'apps/cli/src/commands/agent.ts': `import { FOO_TOOLS } from '../tools/foo.js';\nexport function setup() { registerTools(FOO_TOOLS); }\n`,
  },
  stripped: {
    'apps/cli/src/tools/foo.ts': `export const FOO_TOOLS = [a, b];\n`,
    'apps/cli/src/commands/agent.ts': `// 注册点被摘掉了\n`,
  },
  indirect: {
    'apps/cli/src/tools/foo.ts': `export const FOO_TOOLS = [a, b];\n`,
    'apps/cli/src/tools/barrel.ts': `export * from './foo.js';\n`,
    'apps/cli/src/commands/agent.ts': `import * as tools from '../tools/foo.js';\nexport function setup() { registerTools(tools.FOO_TOOLS); }\n`,
  },
  barrel: {
    'apps/cli/src/tools/foo.ts': `export const FOO_TOOLS = [a, b];\n`,
    'apps/cli/src/tools/barrel.ts': `export * from './foo.js';\n`,
    'apps/cli/src/commands/agent.ts': `import { FOO_TOOLS } from '../tools/barrel.js';\nexport function setup() { registerTools(FOO_TOOLS); }\n`,
  },
  testOnly: {
    'apps/cli/src/tools/foo.ts': `export const FOO_TOOLS = [a, b];\n`,
    'apps/cli/tests/foo.test.ts': `import { FOO_TOOLS } from '../src/tools/foo.js';\nexpect(FOO_TOOLS.length).toBe(2);\n`,
  },
  comment: {
    'apps/cli/src/tools/foo.ts': `export const FOO_TOOLS = [a, b];\n`,
    'apps/cli/src/commands/agent.ts': `/* registerTools(FOO_TOOLS) 只是解释 */\n// registerTools(FOO_TOOLS)\n`,
  },
  hopLive: {
    'apps/cli/src/tools/lsp.ts': `export const LSP_TOOLS = [a];\nexport function registerLspTools(): void {\n  registerTools(LSP_TOOLS);\n}\n`,
    'apps/cli/src/tools/index.ts': `import { registerLspTools } from './lsp.js';\nregisterLspTools();\n`,
  },
  hopDead: {
    'apps/cli/src/tools/lsp.ts': `export const LSP_TOOLS = [a];\nexport function registerLspTools(): void {\n  registerTools(LSP_TOOLS);\n}\n`,
  },
  topLevelNoImport: {
    'apps/cli/src/tools/orphan.ts': `export const ORPHAN_TOOLS = [a];\nregisterTools(ORPHAN_TOOLS);\n`,
    'apps/cli/src/commands/agent.ts': `export const nothing = 1;\n`,
  },
  composed: {
    'apps/cli/src/tools/child.ts': `export const CHILD_TOOLS = [c];\n`,
    'apps/cli/src/tools/parent.ts': `import { CHILD_TOOLS } from './child.js';\nexport const PARENT_TOOLS = [...CHILD_TOOLS, p];\n`,
    'apps/cli/src/commands/agent.ts': `import { PARENT_TOOLS } from '../tools/parent.js';\nexport function setup() { registerTools(PARENT_TOOLS); }\n`,
  },
  composedDead: {
    'apps/cli/src/tools/child.ts': `export const CHILD_TOOLS = [c];\n`,
    'apps/cli/src/tools/parent.ts': `import { CHILD_TOOLS } from './child.js';\nexport const PARENT_TOOLS = [...CHILD_TOOLS, p];\n`,
  },
  empty: { 'README.md': `nothing\n` },
  dynamic: {
    'apps/cli/src/tools/foo.ts': `export const FOO_TOOLS = [a];\nexport const TOOLS_MAP: Record<string, unknown[]> = {};\nregisterTools(TOOLS_MAP[\`FOO_TOOLS\`]);\n`,
    'apps/cli/src/commands/other.ts': `export const nothing = 1;\n`,
  },
  shadow: {
    'apps/cli/src/tools/foo.ts': `export const FOO_TOOLS = [a];\n`,
    'apps/cli/src/commands/other.ts': `const FOO_TOOLS = [z];\nregisterTools(FOO_TOOLS);\n`,
  },
}

const CREATED_DIRS = []

function mkFixture(tag, files) {
  const d = mkScratch(`tool-family-${tag}-`)
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(dirname(join(d, rel)), { recursive: true })
    writeFileSync(join(d, rel), content)
  }
  gitRaw(['init', '-q'], d)
  gitRaw(['add', '-A'], d)
  gitRaw(['commit', '-q', '-m', 'fixture'], d)
  CREATED_DIRS.push(d)
  return d
}

export function runSelfTest() {
  const results = []
  const ok = (name, cond, detail = '') => results.push({ name, pass: !!cond, detail })
  const F = {}
  try {
    for (const [tag, files] of Object.entries(FIXTURES)) F[tag] = mkFixture(tag, files)

    // ①②成对:有注册点 ⇒ 绿 / 把注册点摘掉 ⇒ 必红(这条是本门的存在理由,必须有牙)
    const green = analyze(F.green, 'head')
    ok('A1 族被注册 ⇒ 无违规', green.violations.length === 0, JSON.stringify(green.violations))
    ok('A1b 族被枚举到(判据没瞎)', green.counts.families === 1, JSON.stringify(green.counts))
    const red = analyze(F.stripped, 'head')
    ok(
      'A2 阳性对照:摘掉注册点 ⇒ 必判红',
      red.violations.some((v) => v.name === 'FOO_TOOLS'),
      JSON.stringify(red.violations),
    )

    // ③④反例:间接注册形态 ⇒ 只报数,绝不判红(判据分不清就不假装分得清)
    const indirect = analyze(F.indirect, 'head')
    ok('A3 命名空间转发 ⇒ 不判红', indirect.violations.length === 0, JSON.stringify(indirect.violations))
    ok('A3b 命名空间那一格记成未判定(不静默算通过)', indirect.counts.undetermined === 1, JSON.stringify(indirect.counts))
    const barrel = analyze(F.barrel, 'head')
    ok(
      'A4 `export *` 跨文件再导出 ⇒ 判据看不见解析结果 ⇒ 未判定不判红',
      barrel.violations.length === 0,
      JSON.stringify(barrel.violations),
    )

    // ⑤只有测试面引用 ⇒ 红;⑥注释里的注册点不算证据
    const testOnly = analyze(F.testOnly, 'head')
    ok('A5 只有测试文件提到 ⇒ 判红', testOnly.violations.length === 1 && testOnly.violations[0].testOnly, JSON.stringify(testOnly.violations))
    const comment = analyze(F.comment, 'head')
    ok('A6 注释里写 registerTools(…) ⇒ 仍判红', comment.violations.length === 1, JSON.stringify(comment.violations))
    ok('A6b 注释那一行没被当成注册点', comment.counts.registered === 0, JSON.stringify(comment.counts))

    // ⑦⑧⑨同文件一跳委托三态:被调用 ⇒ 绿 / 无人调用 ⇒ 红 / 顶层注册而模块无人 import ⇒ 红
    ok('A7 一跳委托(owner 被调用)⇒ 绿', analyze(F.hopLive, 'head').violations.length === 0)
    ok(
      'A7b owner 无人调用 ⇒ 两格都必红(允许一跳不等于放过)',
      analyze(F.hopDead, 'head')
        .violations.map((v) => v.name)
        .sort()
        .join(',') === 'LSP_TOOLS,registerLspTools',
    )
    ok('A7c 顶层注册但模块无人 import ⇒ 红', analyze(F.topLevelNoImport, 'head').violations.length === 1)

    // ⑩⑪组合传播:父族注册 ⇒ 子族随挂;父族也未注册 ⇒ 两族各自红(不得互相洗白)
    ok('A8 父族已注册 ⇒ 被 spread 的子族算挂上', analyze(F.composed, 'head').violations.length === 0)
    ok('A8b 父族未注册 ⇒ 子族不得被洗白', analyze(F.composedDead, 'head').violations.length === 2)

    // ⑫枚举 0 个 tools 文件 ⇒ 判死记号(扫描面判空 ≠ 没有违规)
    const empty = analyze(F.empty, 'head')
    ok('A9 枚举到 0 个族 ⇒ 判死记号', empty.toolFiles === 0 && empty.counts.families === 0)

    // ⑬动态拼接注册参数 ⇒ 未判定,不判红也不记绿
    const dyn = analyze(F.dynamic, 'head')
    ok('A10 动态注册参数 ⇒ 未判定且不计入已注册', dyn.counts.registered === 0, JSON.stringify(dyn.counts))

    // ⑭别处同名本地符号不得冒充本族注册点
    const shadow = analyze(F.shadow, 'head')
    ok(
      'A11 同名本地 const ⇒ 既不记作已注册、也不静默算通过',
      shadow.counts.registered === 0 && shadow.counts.undetermined === 1,
      JSON.stringify(shadow.counts),
    )

    // ⑮棘轮:HEAD 有、索引摘掉 ⇒ 本次判红(broken)
    const d15 = mkFixture('ratchet', FIXTURES.green)
    writeFileSync(join(d15, 'apps/cli/src/commands/agent.ts'), `// 摘线\n`)
    gitRaw(['add', '-A'], d15)
    const r15 = ratchetize(analyze(d15, 'head'), analyze(d15, 'staged'))
    ok('A12 HEAD 已注册而索引摘线 ⇒ broken 判红', r15.broken.length === 1 && main(['--staged', '--root', d15]) === 1, JSON.stringify(r15.broken))

    // ⑯存量(HEAD 就未注册)在 staged 档不得判红 —— 否则上线当天即恒红门
    const d16 = mkFixture('legacy', FIXTURES.testOnly)
    writeFileSync(join(d16, 'README.md'), `别人改了无关文件\n`)
    gitRaw(['add', '-A'], d16)
    const r16 = ratchetize(analyze(d16, 'head'), analyze(d16, 'staged'))
    ok('A13 存量未注册在 staged 档只报数不判红', r16.broken.length === 0 && r16.existing.length === 1 && main(['--staged', '--root', d16]) === 0, JSON.stringify(r16))
    ok('A13b --strict 才对存量问责', main(['--strict', '--root', d16]) === 1)

    // ⑰两面旗同给 ⇒ 判死
    ok('A14 --staged 与 --worktree 同给 ⇒ exit 2', main(['--staged', '--worktree', '--root', F.green]) === 2)
    // ⑱maskNoise 判别力:真代码留、注释/串抹
    ok(
      'A15 maskNoise 两条方向都对(不抹真调用、不放过注释)',
      /\bFOO_TOOLS\b/.test(maskNoise(FIXTURES.green['apps/cli/src/commands/agent.ts'])) &&
        !/\bFOO_TOOLS\b/.test(maskNoise(FIXTURES.comment['apps/cli/src/commands/agent.ts'])),
    )
  } finally {
    for (const d of CREATED_DIRS) {
      try {
        rmScratch(d)
      } catch {
        /* 夹具清理失败不影响结论 */
      }
    }
  }
  let failed = 0
  for (const r of results) {
    if (!r.pass) failed += 1
    console.log(`${r.pass ? '✅' : '❌'} ${r.name}${r.pass ? '' : ` → ${r.detail}`}`)
  }
  console.log(`--self-test:${results.length - failed}/${results.length} 条断言通过`)
  return failed === 0 ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)))
}

export const __test__ = {
  TOOLS_DIR,
  SKIP_ENV_NAME,
  GUARDIAN_ID_EXPECTED,
  maskNoise,
  balanced,
  classifyPath,
  isTestSurface,
  resolveSpec,
  specMatches,
  findDeclarations,
  arrayLiteralOf,
  compositionEdges,
  exportRanges,
  scanEvidence,
  decide,
  analyze,
  ratchetize,
  listToolsFiles,
  listEvidenceFiles,
  main,
  FIXTURES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
