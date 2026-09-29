#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-slash-command-wired.mjs —— 斜杠命令「注册表 ↔ 分派 switch」到达性对账 + 名字去重
 * (guardian id 以 scripts/guardian-runner.mjs 现值为准,勿照本文派单;blocking;
 *  紧急跳过 HUSKY_SKIP_SLASH_COMMAND_WIRED=1;对应 PROJECT_PLAN G-814404)
 *
 * 四条判据(输入全部由被审面自身推导,**零手工清单**、零基线文件):
 *   W1 注册了却没有活分支 ⇒ 判红(零容忍)。注册表是 /help 与"未知命令建议"的唯一来源,
 *      一条只登记不接线的命令对用户就是"看得见、按下去没反应"那一型,而它 typecheck/lint
 *      全绿 —— 本仓最高频的"造好没装车"(同守门 64/70/81/115/138/131 的"注册到达性")。
 *   W2 注册名多重集有重复 ⇒ 判红(零容忍)。两张同名条目在 /help 里各列一遍,而
 *      findByName 只回第一条 ⇒ 第二条形同虚设;上游同一位置**零防护**,这就是票面"名字去重"那一维。
 *   W3 分支接了却没注册 ⇒ **默认档只报数**,--strict 才判红(名字漂移)。立门前置实测:
 *      HEAD 面现读就有 2 条(repl 的 sessions / plugin 活着、注册表查无此名)。存量未清就
 *      blocking 是一台与任何提交都无关的恒红门,唯一结局是逼人 --no-verify 连带废掉全部
 *      守门(§12e 同型)。票面"现测应为 0 红"说的是 W1+W2,现读确实 0,所以那两维直接零容忍。
 *   W4 分派块没有 default 兜底 ⇒ 判红(零容忍)。未知命令被静默吞掉比报错更糟;票面记
 *      "我方优于上游"的那一格正是这条兜底文案,HEAD 面在位 ⇒ 零容忍不新增恒红面。
 *
 * 遮噪方向(与守门 134/131 同一课,别搞反):判"分支/注册名在不在"只看**代码面**,而这里
 * 的代码面 = **剥注释、保留字符串** —— 名字就住在字符串里(`case 'commit':` 与 `name: 'commit'`
 * 都是字符串字面量)。连字符串一起抹,门对这一族**整型失明**:一个名字都读不到,却会一路报绿。
 * 所以取源用 lib/code-mask 的 `maskComments` 那一档。反过来,**定位键名与算括号配平**的那一遍
 * 必须把字符串体清空(`blankStrings`):`usage: '/tasks [list|add <id>]'` 里的方括号会把数组
 * 配平算歪,描述文本里的 `name:` 会凭空多出一枚注册名。两个方向各判一件事,但**分词只有一台**
 * (都走 lib/code-mask 的 scanSpans),镜像测试反向钉死不得在门里留第二份遮罩实现。
 * 注释里的形态一律不计,且两个方向都要有夹具:真分支只写在注释里**不得**被读成"已接线"
 * (否则一句注释就能骗过 W1);散文里出现的 `case 'x':` 形态也**不得**被判成违规(否则门开始
 * 判自己的解释文字 —— 守门 131 第一次自跑就栽在这里)。两条由自检 S3a/S3b 成对钉住。
 *
 * 口径同 70/77/83/98/101/103/118:全量判 **HEAD blob**、--staged 判**索引 blob**、
 * --worktree 仅人工逃生舱、两面旗同给 exit 2、任一面取不到 ⇒ **exit 2 无法判定**(不冒红也不
 * 记绿,绝不回落到另一个面);枚举到 0 个注册名 / 0 个命中注册名的分派块 ⇒ 判死,不记绿。
 * 两个被审路径都是跟踪文件、每次提交都在索引里,所以本门不需要守门 135 那条"本次无射程内
 * 文件 ⇒ 回退 HEAD 全量"的档位(那一条是为文档类提交结构上不带 .ts 而设的,套到这里就是猜)。
 *
 * 用法:node scripts/check-slash-command-wired.mjs [--staged|--worktree|--strict|--json
 *      |--self-test|--root <dir>]
 * (--root 是镜像/换仓的测试通道,只换根不换判据;生产调用不带。)
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, assertRepoRoot, catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { blankStrings, maskComments, scanSpans } from './lib/code-mask.mjs'

let ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 120000
export const GATE_LABEL = 'check-slash-command-wired.mjs'
export const SKIP_ENV = 'HUSKY_SKIP_SLASH_COMMAND_WIRED'
export const REGISTRY_REL = 'apps/cli/src/commands/slash-registry.ts'
export const REPL_REL = 'apps/cli/src/commands/repl.ts'
/** 被审结构的入口名(不是豁免清单):改名 ⇒ 判"找不到"并 exit 2,绝不猜成"没有命令"。 */
const REGISTRY_EXPORT = 'SLASH_COMMANDS'

const FACE_LABEL = {
  head: 'HEAD blob(全量档)',
  staged: '索引 blob(--staged,提交链)',
  worktree: '工作树(人工逃生舱,提交链不走这档)',
}

// ────────────────────────────────────────────────────────────────────────
// 取材:两面同面同轮,一次 cat-file --batch 读满
// ────────────────────────────────────────────────────────────────────────

/** @returns {{registry:string,repl:string,face:string}} 取不到一律抛 Undetermined(调用方折成 exit 2) */
export function readFaceInputs(repoRoot, face) {
  const rels = [REGISTRY_REL, REPL_REL]
  if (face === 'worktree') {
    const out = {}
    for (const rel of rels) {
      const t = readWorktreeFile(repoRoot, rel)
      if (t === null || t === undefined) throw new Undetermined(`${FACE_LABEL[face]}取不到 ${rel}`)
      out[rel] = t
    }
    return { registry: out[REGISTRY_REL], repl: out[REPL_REL], face }
  }
  // 索引档是 `:path` —— 前导冒号不能漏(守门 117 记过"漏冒号 ⇒ --staged 恒取不到")
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = rels.map((rel) => prefix + rel)
  const got = catBatch(repoRoot, specs, { maxBuffer: 1 << 28, timeout: GIT_TIMEOUT })
  const out = {}
  for (let i = 0; i < rels.length; i++) {
    const t = got.get(specs[i])
    if (t === null || t === undefined)
      throw new Undetermined(`${face === 'staged' ? '索引' : 'HEAD'} 取不到 ${rels[i]}`)
    out[rels[i]] = t
  }
  return { registry: out[REGISTRY_REL], repl: out[REPL_REL], face }
}

// ────────────────────────────────────────────────────────────────────────
// 位置小工具(masked 与 struct 等长 ⇒ 下标可互换、行号可直接算)
// ────────────────────────────────────────────────────────────────────────

function lineOf(text, index) {
  let n = 1
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === '\n') n += 1
  return n
}

function skipWs(text, i) {
  while (i < text.length && /\s/.test(text[i])) i += 1
  return i
}

/** 一遍词法,两份投影:masked 面上字符串 span 的索引 + struct 面的花括号深度表。 */
function prepare(text) {
  const masked = maskComments(text)
  const struct = blankStrings(masked)
  const strings = []
  const byStart = new Map()
  for (const s of scanSpans(masked))
    if (s.kind === 'string') {
      strings.push(s)
      byStart.set(s.start, s)
    }
  const depth = new Int32Array(struct.length + 1)
  let d = 0
  for (let i = 0; i < struct.length; i++) {
    depth[i] = d
    if (struct[i] === '{') d += 1
    else if (struct[i] === '}') d -= 1
  }
  depth[struct.length] = d
  return { masked, struct, strings, byStart, depth }
}

/** 从 i 起跳过空白;落在某个字符串的起始定界符上则取值,否则 null(不猜)。 */
function readStringAfter(p, i) {
  const q = skipWs(p.masked, i)
  const s = p.byStart.get(q)
  if (!s || s.closed === false) return null
  return { value: p.masked.slice(s.bodyStart, s.bodyEnd), at: q, end: s.end }
}

/** 从 openIdx 起配平;配不平返回 -1(调用方判"未判定",不硬算)。 */
function matchBalanced(text, openIdx, openCh, closeCh) {
  let depth = 0
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i]
    if (c === openCh) depth += 1
    else if (c === closeCh) {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

/** 在 [from,to) 的 struct 面上找 `(^|非词字符)<key>` 的键位,返回键尾下标(冒号之后)。 */
function keyTails(p, key, from, to) {
  const re = new RegExp(`(^|[^\\w$])${key}\\s*:`, 'g')
  const out = []
  const slice = p.struct.slice(from, to)
  for (let m; (m = re.exec(slice)); ) out.push(from + m.index + m[0].length)
  return out
}

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ────────────────────────────────────────────────────────────────────────
// W1/W2 的输入:注册表 token(名字 + 别名),从数组字面量里现读
// ────────────────────────────────────────────────────────────────────────

/**
 * @returns {{names:{name,line}[],aliases:{name,line}[],error:string|null}}
 *   error 非空 ⇒ 调用方判"未判定"。**不得**把空集合读成"一条命令都没注册" —— 那正是
 *   守门 131 的 cssInterop 正则恒空那一型:门对整族失明而一路报绿。
 */
export function extractRegistryTokens(text) {
  if (typeof text !== 'string' || text.length === 0)
    return { names: [], aliases: [], error: '注册表内容为空或取不到' }
  const p = prepare(text)
  const decl = new RegExp(`\\bconst\\s+${REGISTRY_EXPORT}\\b[^=]*=`).exec(p.struct)
  if (!decl) return { names: [], aliases: [], error: `找不到 ${REGISTRY_EXPORT} 声明` }
  const open = p.struct.indexOf('[', decl.index + decl[0].length)
  if (open < 0) return { names: [], aliases: [], error: `${REGISTRY_EXPORT} 声明后找不到数组起始 [` }
  const close = matchBalanced(p.struct, open, '[', ']')
  if (close < 0) return { names: [], aliases: [], error: `${REGISTRY_EXPORT} 数组配平不到 ](写法超出解析面)` }

  const names = []
  for (const tail of keyTails(p, 'name', open, close)) {
    const got = readStringAfter(p, tail)
    if (got) names.push({ name: got.value, line: lineOf(p.masked, got.at) })
  }
  const aliases = []
  const aliasRe = /(^|[^\w$])aliases\s*:\s*\[/g
  const asSlice = p.struct.slice(open, close + 1)
  for (let m; (m = aliasRe.exec(asSlice)); ) {
    const bracketOpen = open + m.index + m[0].length - 1
    const bracketClose = matchBalanced(p.struct, bracketOpen, '[', ']')
    if (bracketClose < 0) continue
    for (const s of p.strings)
      if (s.start > bracketOpen && s.end <= bracketClose)
        aliases.push({ name: p.masked.slice(s.bodyStart, s.bodyEnd), line: lineOf(p.masked, s.start) })
  }
  if (names.length === 0)
    return { names, aliases, error: `${REGISTRY_EXPORT} 数组里一个 name 字面量都没解析到(判据失明,不是"没有命令")` }
  return { names, aliases, error: null }
}

// ────────────────────────────────────────────────────────────────────────
// 分派分支:switch 的 case + 等价 if 比较;嵌套 switch 与对象键 `default:` 不得混进来
// ────────────────────────────────────────────────────────────────────────

/** struct 面上所有 switch:主题表达式 + 块区间(配平不到的整块跳过,不硬猜)。 */
function findSwitches(p) {
  const list = []
  const re = /\bswitch\b/g
  for (let m; (m = re.exec(p.struct)); ) {
    const switchAt = m.index
    let q = skipWs(p.struct, switchAt + m[0].length)
    if (p.struct[q] !== '(') continue
    const parenClose = matchBalanced(p.struct, q, '(', ')')
    if (parenClose < 0) continue
    const subject = p.masked.slice(q + 1, parenClose).trim()
    q = skipWs(p.struct, parenClose + 1)
    if (p.struct[q] !== '{') continue
    const blockClose = matchBalanced(p.struct, q, '{', '}')
    if (blockClose < 0) continue
    list.push({ switchAt, subject, blockOpen: q, blockClose })
  }
  return list
}

/**
 * 取某个 switch 块**顶层**的 case 与 default。
 * 顶层 = 花括号深度等于块起始处 ⇒ 自动排除嵌套 switch 的 case(它必在更深一层,或在另一个
 * `{}` 里)与 `{ default: false }` 这类**对象键**冒充兜底(本仓"名字承诺与实现兑现"同型)。
 */
function collectSwitchBody(p, sw) {
  const cases = []
  let defaults = 0
  const base = p.depth[sw.blockOpen]
  const re = /(^|[^\w$])case\b/g
  for (let m; (m = re.exec(p.struct.slice(sw.blockOpen + 1, sw.blockClose))); ) {
    const at = sw.blockOpen + 1 + m.index + m[0].length
    if (p.depth[at] !== base + 1) continue
    const got = readStringAfter(p, at)
    if (!got) continue
    if (p.struct[skipWs(p.struct, got.end)] !== ':') continue
    cases.push({ name: got.value, line: lineOf(p.masked, got.at) })
  }
  const dr = /(^|[^\w$])default\s*:/g
  for (let m; (m = dr.exec(p.struct.slice(sw.blockOpen + 1, sw.blockClose))); ) {
    const at = sw.blockOpen + 1 + m.index + m[0].length
    if (p.depth[at] !== base + 1) continue
    defaults += 1
  }
  return { cases, defaults }
}

/** 包含 idx 的最外层 function 声明区间(把"等价 if 比较"限定在分派函数体内,不猜)。 */
function enclosingFunctionSpan(p, idx) {
  const re = /^(?:export\s+)?(?:async\s+)?function\s+[\w$]+[^\n]*\{/gm
  for (let m; (m = re.exec(p.struct)); ) {
    const braceAt = m.index + m[0].length - 1
    if (braceAt > idx) return null
    const end = matchBalanced(p.struct, braceAt, '{', '}')
    if (end < 0) continue
    if (idx >= braceAt && idx <= end) return { start: braceAt, end }
  }
  return null
}

/** 等价 if 比较:`cmd === 'x'` 与 `'x' === cmd`(主题必须是简单标识符,否则不收)。 */
function collectIfBranches(p, subject, span) {
  if (!/^[A-Za-z_$][\w$]*$/.test(subject)) return []
  const out = []
  const esc = reEsc(subject)
  const re = new RegExp(`(^|[^\\w$])${esc}\\s*={2,3}\\s*`, 'g')
  for (let m; (m = re.exec(p.struct.slice(span.start, span.end))); ) {
    const got = readStringAfter(p, span.start + m.index + m[0].length)
    if (got) out.push({ name: got.value, line: lineOf(p.masked, got.at) })
  }
  const tail = new RegExp(`^={2,3}\\s*${esc}([^\\w$]|$)`)
  for (const s of p.strings) {
    if (s.start < span.start || s.end > span.end) continue
    // 闭引号与 `===` 之间隔着空白,不先跳掉就是"有比较却匹配不上"(S15 的夹具钉这一格)
    if (tail.test(p.struct.slice(skipWs(p.struct, s.end))))
      out.push({ name: p.masked.slice(s.bodyStart, s.bodyEnd), line: lineOf(p.masked, s.start) })
  }
  return out
}

/**
 * @param {Set<string>} knownTokens 注册表全部 token(名字 ∪ 别名)
 * @returns {{branches:{name,line,kind}[],defaultCount:number,subjects:string[],
 *            nestedSwitches:number,error:string|null}}
 */
export function extractDispatchBranches(text, knownTokens) {
  const empty = { branches: [], defaultCount: 0, subjects: [], nestedSwitches: 0, error: null }
  if (typeof text !== 'string' || text.length === 0)
    return { ...empty, error: '分派文件内容为空或取不到' }
  const p = prepare(text)
  const switches = findSwitches(p)
  if (switches.length === 0) return { ...empty, error: '一个 switch 都没找到' }
  const branches = []
  const subjects = []
  let defaultCount = 0
  let nestedSwitches = 0
  let qualified = 0
  for (const sw of switches) {
    nestedSwitches += switches.filter((n) => n !== sw && n.switchAt > sw.blockOpen && n.switchAt < sw.blockClose).length
    const body = collectSwitchBody(p, sw)
    if (!body.cases.some((c) => knownTokens.has(c.name))) continue // 不是斜杠命令的分派块(状态词表等)
    qualified += 1
    subjects.push(sw.subject)
    branches.push(...body.cases.map((c) => ({ ...c, kind: 'switch-case' })))
    defaultCount += body.defaults
    const span = enclosingFunctionSpan(p, sw.switchAt)
    if (span)
      branches.push(...collectIfBranches(p, sw.subject, span).map((c) => ({ ...c, kind: 'if-compare' })))
  }
  if (qualified === 0)
    return {
      branches,
      defaultCount,
      subjects,
      nestedSwitches,
      error: '没有任何 switch 的 case 命中注册名(判据失明,不是"没有分支")',
    }
  if (branches.length === 0) return { branches, defaultCount, subjects, nestedSwitches, error: '分派集合为空(命中了注册名却取不到 case)' }
  return { branches, defaultCount, subjects, nestedSwitches, error: null }
}

// ────────────────────────────────────────────────────────────────────────
// 判据(纯函数:red / notice / undetermined 三态绝不并桶)
// ────────────────────────────────────────────────────────────────────────

export const VERDICT_CODES = ['W1', 'W2', 'W3', 'W4']

/** @param {{strict?:boolean}} opts strict=true 把 W3 从"只报数"升为判红 */
export function judge({ registry, dispatch, strict = false }) {
  const red = []
  const notice = []
  const undetermined = []
  const counts = {
    names: registry.names.length,
    aliases: registry.aliases.length,
    branches: dispatch.branches.length,
    distinctBranchNames: new Set(dispatch.branches.map((b) => b.name)).size,
    defaultCount: dispatch.defaultCount,
    nestedSwitches: dispatch.nestedSwitches,
    red: 0,
    notice: 0,
    undetermined: 0,
  }
  if (registry.error) undetermined.push({ code: 'U1', reason: `注册表:${registry.error}` })
  if (dispatch.error) undetermined.push({ code: 'U2', reason: `分派:${dispatch.error}` })
  if (undetermined.length) {
    counts.undetermined = undetermined.length
    return { red, notice, undetermined, counts }
  }

  const registered = [...registry.names, ...registry.aliases]
  const registeredSet = new Set(registered.map((t) => t.name))
  const branchSet = new Set(dispatch.branches.map((b) => b.name))

  for (const t of registered)
    if (!branchSet.has(t.name))
      red.push({ code: 'W1', name: t.name, line: t.line, where: REGISTRY_REL, why: '注册表登记了该名字,repl 的分派里没有活的 case/if 分支' })

  const seen = new Map()
  for (const t of registered) {
    const prev = seen.get(t.name)
    if (prev)
      red.push({ code: 'W2', name: t.name, line: t.line, firstLine: prev, where: REGISTRY_REL, why: '注册名重复(/help 列两遍、findByName 只回第一条 ⇒ 第二条形同虚设)' })
    else seen.set(t.name, t.line)
  }

  for (const b of dispatch.branches) {
    if (registeredSet.has(b.name)) continue
    const item = { code: 'W3', name: b.name, line: b.line, where: REPL_REL, kind: b.kind, why: '分派里有该分支,注册表查无此名(名字漂移:用户 /help 看不见它)' }
    if (strict) red.push(item)
    else notice.push(item)
  }

  if (dispatch.defaultCount === 0)
    red.push({ code: 'W4', name: '(default)', line: 0, where: REPL_REL, why: '分派 switch 顶层没有 default ⇒ 未知命令被静默吞掉' })

  counts.red = red.length
  counts.notice = notice.length
  return { red, notice, undetermined, counts }
}

// ────────────────────────────────────────────────────────────────────────
// 门面
// ────────────────────────────────────────────────────────────────────────

export function analyze(repoRoot, face, strict = false) {
  let input
  try {
    input = readFaceInputs(repoRoot, face)
  } catch (e) {
    const why = e instanceof Undetermined ? e.message : `取材失败:${e.message}`
    return { face, exit: 2, red: [], notice: [], undetermined: [{ code: 'U0', reason: why }], counts: {} }
  }
  const registry = extractRegistryTokens(input.registry)
  const known = new Set([...registry.names, ...registry.aliases].map((t) => t.name))
  const dispatch = extractDispatchBranches(input.repl, known)
  const v = judge({ registry, dispatch, strict })
  let exit = 0
  if (v.undetermined.length) exit = 2
  else if (v.red.length) exit = 1
  return { ...v, face, exit }
}

function print(r, strict) {
  const c = r.counts
  console.log(`[${GATE_LABEL}] 面:${FACE_LABEL[r.face] || r.face}${strict ? ' · --strict(W3 判红)' : ' · W3 只报数'}`)
  if (r.exit === 2) {
    console.log('❌ 无法判定(不冒红也不记绿):')
    for (const u of r.undetermined) console.log(`   ${u.code} ${u.reason}`)
    console.log('   ⇒ 判据看不见被审结构时**拒绝出具合格证**;请核对两个路径与书写形态')
    return
  }
  console.log(
    `   注册名 ${c.names} · 别名 ${c.aliases} · 分派分支 ${c.branches} 处(去重后 ${c.distinctBranchNames}) · default ${c.defaultCount} · 块内嵌套 switch ${c.nestedSwitches}`,
  )
  if (r.red.length) {
    console.log(`❌ 判红 ${r.red.length} 条:`)
    for (const f of r.red) console.log(`   ${f.code} ${f.name} @ ${f.where}:${f.line} —— ${f.why}`)
    console.log(`   紧急跳过:${SKIP_ENV}=1 git commit …(该提交对本门整体失效,勿当默认路径)`)
  } else
    console.log(`✅ W1/W2/W4 零红:${c.names + c.aliases} 个注册名全部有活分支、注册名多重集无重复、兜底在位`)
  if (r.notice.length) {
    console.log(`ℹ️ W3 只报数 ${r.notice.length} 条(分派有、注册表无;--strict 才判红):`)
    for (const n of r.notice) console.log(`   ${n.name} @ ${n.where}:${n.line}(${n.kind})`)
    console.log('   解阻前置:逐条补注册或删分支后把 W3 升为判红 —— 存量未清就 blocking 就是恒红门(§12e)')
  }
}

function selfTest() {
  const results = []
  const ok = (name, cond, extra = '') => results.push(`${cond ? '✅' : '❌'} ${name}${extra ? ` → ${extra}` : ''}`)

  const body = (rows) => (Array.isArray(rows) ? rows.join('\n') : rows)
  const REG = (rows) => `export const SLASH_COMMANDS: readonly SlashCommandMeta[] = [\n${body(rows)}\n];\n`
  const ENTRY = (n) => `  { name: '${n}', description: 'd', usage: '/${n}', category: 'basic' },`
  const DISPATCH = (names) =>
    `async function handleSlashCommand(input: string) {\n  const cmd = input.slice(1);\n  switch (cmd) {\n${names
      .map((n) => `    case '${n}':\n      run();\n      break;`)
      .join('\n')}\n    default:\n      console.info('未知命令');\n  }\n}\n`
  const build = (names, branches) => {
    const registry = extractRegistryTokens(REG(names.map(ENTRY)))
    const dispatch = extractDispatchBranches(DISPATCH(branches), new Set(names))
    return { registry, dispatch }
  }

  const s1 = build(['help', 'exit'], ['help', 'exit'])
  const v1 = judge(s1)
  ok('S1 两个注册名各有 case ⇒ 零红零报数', v1.red.length === 0 && v1.notice.length === 0, JSON.stringify(v1.counts))

  const v2 = judge(build(['help', 'exit'], ['help']))
  ok(
    'S2 删一个真 case ⇒ W1 翻红并点名 exit',
    v2.red.filter((f) => f.code === 'W1').length === 1 && v2.red[0].name === 'exit',
    JSON.stringify(v2.red.map((f) => `${f.code}:${f.name}`)),
  )

  // S3a 被删的 case 只写在注释里 ⇒ 不得被读成"已接线"(S2 的红必须还在)
  const commented = DISPATCH(['help']).replace('    default:', "    // case 'exit': 先注释着\n    default:")
  const v3a = judge({ registry: extractRegistryTokens(REG([ENTRY('help'), ENTRY('exit')].join('\n'))), dispatch: extractDispatchBranches(commented, new Set(['help', 'exit'])) })
  ok('S3a case 只写进注释 ⇒ 仍判红(注释不是活分支)', v3a.red.some((f) => f.code === 'W1' && f.name === 'exit'))

  // S3b 散文里的 case 形态 ⇒ 不得翻红(门不判自己的解释文字)
  const prose = DISPATCH(['help', 'exit']).replace('    default:', "    // case 'ghost':\n    default:")
  const v3b = judge({ registry: extractRegistryTokens(REG([ENTRY('help'), ENTRY('exit')].join('\n'))), dispatch: extractDispatchBranches(prose, new Set(['help', 'exit'])) })
  ok('S3b 注释里的 ghost 分支 ⇒ 既不计分支也不判红', !v3b.red.some((f) => f.name === 'ghost') && !v3b.notice.some((f) => f.name === 'ghost'))

  const v4 = judge({ registry: extractRegistryTokens(REG([ENTRY('help'), ENTRY('help')].join('\n'))), dispatch: extractDispatchBranches(DISPATCH(['help']), new Set(['help'])) })
  ok('S4 同一 name 登记两遍 ⇒ W2 红', v4.red.some((f) => f.code === 'W2'))

  const collideReg = extractRegistryTokens(REG([ENTRY('help'), `  { name: 'x', aliases: ['help'], description: 'd', usage: '/x', category: 'basic' },`].join('\n')))
  ok('S5 名与别名相撞 ⇒ W2 红', judge({ registry: collideReg, dispatch: extractDispatchBranches(DISPATCH(['help', 'x']), new Set(['help', 'x'])) }).red.some((f) => f.code === 'W2'))

  const drift = build(['help'], ['help', 'ghost'])
  const v6 = judge(drift)
  const v6s = judge({ ...drift, strict: true })
  ok(
    'S6 未注册分支 ⇒ 默认档进 notice 不判红;--strict 才判红',
    v6.red.length === 0 && v6.notice.length === 1 && v6s.red.some((f) => f.code === 'W3' && f.name === 'ghost'),
  )

  const bad = extractRegistryTokens('export const SOMETHING_ELSE: string[] = []')
  ok('S7 注册表声明改名 ⇒ U1 未判定,不出合格证', judge({ registry: bad, dispatch: drift.dispatch }).undetermined.length === 1)

  const noSwitch = extractDispatchBranches('function a() { return 1 }', new Set(['help']))
  ok('S8 分派面无 switch ⇒ U2 未判定(空扫不记绿)', judge({ registry: drift.registry, dispatch: noSwitch }).undetermined.length === 1)

  // S9 嵌套 switch 的 case 不得算成分派名(子命令词不是斜杠命令)
  const nested = DISPATCH(['help']).replace(
    '    default:',
    "    case 'plan': {\n      switch (sub) {\n        case 'on':\n          break;\n      }\n      break;\n    }\n    default:",
  )
  const nd = extractDispatchBranches(nested, new Set(['help']))
  ok(
    'S9 嵌套 switch 的 on 不进分派集合,而 plan 进',
    !nd.branches.some((b) => b.name === 'on') && nd.branches.some((b) => b.name === 'plan'),
    JSON.stringify(nd.branches.map((b) => b.name)),
  )

  const noDefault = DISPATCH(['help']).replace(/\n {4}default:[\s\S]*?\n {2}\}\n\}/, '\n  }\n}')
  ok('S10 分派缺 default ⇒ W4 红', judge({ registry: drift.registry, dispatch: extractDispatchBranches(noDefault, new Set(['help'])) }).red.some((f) => f.code === 'W4'))
  ok('S10b 夹具确实剥掉了 default', !/default/.test(noDefault))

  // S11/S12 遮噪两向:串里的方括号不得破坏配平;串里的 name: 不得算注册名
  const s11 = extractRegistryTokens(REG([`  { name: 'tasks', description: 'd', usage: '/tasks [list|add <id>|done <id>]', category: 'basic' },`]))
  ok('S11 usage 含 [ ] 不破坏数组配平', s11.error === null && s11.names.length === 1, String(s11.error))
  const s12 = extractRegistryTokens(REG([ENTRY('help'), `  { name: 'x', description: 'the name: y thing', usage: '/x', category: 'basic' },`]))
  ok('S12 串内 name: 不算注册名', s12.names.length === 2 && !s12.names.some((n) => n.name === 'y'), JSON.stringify(s12.names.map((n) => n.name)))

  // S13 别名也是命令
  const aliasReg = extractRegistryTokens(REG([`  { name: 'exit', aliases: ['quit'], description: 'd', usage: '/exit', category: 'basic' },`]))
  ok('S13 别名缺分支 ⇒ W1 点名 quit', judge({ registry: aliasReg, dispatch: extractDispatchBranches(DISPATCH(['exit']), new Set(['exit', 'quit'])) }).red.some((f) => f.code === 'W1' && f.name === 'quit'))
  ok('S13b 别名有 case ⇒ 零红', judge({ registry: aliasReg, dispatch: extractDispatchBranches(DISPATCH(['exit', 'quit']), new Set(['exit', 'quit'])) }).red.length === 0)

  // S14/S15 等价 if 比较两向都认
  const ifForm = `async function handleSlashCommand(input: string) {
  const cmd = input.slice(1);
  switch (cmd) {
    case 'help':
      run();
      break;
    default:
      if (cmd === 'exit') run2();
      console.info('未知命令');
  }
}
`
  ok(
    "S14 cmd === 'exit' 被认作活分支(if-compare)",
    extractDispatchBranches(ifForm, new Set(['help', 'exit'])).branches.some((b) => b.name === 'exit' && b.kind === 'if-compare'),
  )
  ok("S15 'exit' === cmd 同认", extractDispatchBranches(ifForm.replace("cmd === 'exit'", "'exit' === cmd"), new Set(['help', 'exit'])).branches.some((b) => b.name === 'exit'))

  // S16 遮噪方向的前提:maskComments 之后字符串仍在
  ok("S16 剥注释保字符串 ⇒ 仍读得到 case 'help'", /case\s+'help'/.test(maskComments(DISPATCH(['help']))))

  // S17 真仓阳性对照:看不见存量不算通过 ⇒ 注册名必须现读出非零量且 W1/W2/W4 零红
  const realHead = analyze(ROOT, 'head', false)
  ok(
    'S17 真仓 HEAD 面:注册名 ≥30、W1/W2/W4 零红、RC=0',
    realHead.exit === 0 && realHead.counts.names >= 30 && realHead.red.length === 0,
    JSON.stringify({ exit: realHead.exit, names: realHead.counts.names, aliases: realHead.counts.aliases, branches: realHead.counts.branches, red: realHead.red.length, notice: realHead.notice.length }),
  )
  // S18 真仓 W3 存量(实测 2 条)必须在报数侧而不是红侧 —— 否则本门把自己立项那一型造成为恒红门
  ok('S18 真仓默认档 W3 不进 red,且逐条点名', realHead.red.every((f) => f.code !== 'W3') && realHead.notice.every((f) => f.code === 'W3' && !!f.name), JSON.stringify(realHead.notice.map((n) => n.name)))
  // S19 --strict 让同一份输入的 W3 翻进红侧(判据有牙,且只动 W3 一维)
  const realStrict = analyze(ROOT, 'head', true)
  ok('S19 真仓 --strict ⇒ W3 进红、其余维仍零红', realStrict.red.length === realHead.notice.length && realStrict.red.every((f) => f.code === 'W3'), JSON.stringify({ strict: realStrict.red.length, notice: realHead.notice.length }))
  // S20 索引档与 HEAD 档在同一条干净仓库上结论一致(两面同判据的等价对照)
  const realStaged = analyze(ROOT, 'staged', false)
  ok('S20 干净仓库上索引档与 HEAD 档读数同值', JSON.stringify(realStaged.counts) === JSON.stringify(realHead.counts), JSON.stringify({ staged: realStaged.counts.names, head: realHead.counts.names }))

  for (const r of results) console.log(r)
  const failed = results.filter((r) => r.startsWith('❌')).length
  console.log(failed ? `self-test 失败 ${failed}/${results.length} 条` : `✅ self-test 全通过(${results.length} 条)`)
  process.exit(failed ? 1 : 0)
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const ri = argv.indexOf('--root')
  if (ri >= 0 && argv[ri + 1]) {
    ROOT = resolve(argv[ri + 1])
    assertRepoRoot(ROOT, GATE_LABEL)
  }
  const picked = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    process.exitCode = 2
    return
  }
  const strict = argv.includes('--strict')
  const r = analyze(ROOT, picked.face, strict)
  if (argv.includes('--json')) console.log(JSON.stringify(r, null, 2))
  else print(r, strict)
  process.exitCode = r.exit
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
