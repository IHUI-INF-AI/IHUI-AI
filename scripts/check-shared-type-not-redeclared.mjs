#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 共享类型端内重声明对账
 *
 * 拦的是这一型:同一份对外契约(REST 请求/响应、实体形状)在 `packages/types` 已有一份定义,
 * 端内又手抄一份 `interface`。它没有编译期症状 —— 两边各自成立,`tsc` 全绿;漂移的表现是
 * 「同一接口在手机上少一个筛选参数」这类端间行为差异,而本仓最高频的失效形态是安静。
 *
 * 立项凭据(2026-10-16 实测,不是假想):`GET/POST/DELETE /api/memory` 的四个契约在
 * `apps/web/src/lib/memory-api.ts`、`apps/mobile-rn/src/screens/MemoryScreen.tsx`、
 * `apps/cli/src/commands/memory.ts` 各写一份,其中 `MemoryCreateInput.source` 两份可选一份必填,
 * 而后端 `apps/api/src/routes/memory.ts` 的 `createEntrySchema` 对它 `.default('api')`;
 * 同时 `packages/types` 早就导出了 `MemoryEntry/MemoryScope/MemoryEntryType`。三端三抄零判据 ⇒ 本门。
 *
 * 判据(H1)与放过通道:
 *  - **命中**:端内文件在**顶层**声明 `interface X` / `type X =`,而 `X` 在被审面的共享导出名集合里。
 *  - **放过 A(别名收回单源)**:`type X = Y` 且 `Y` 是本文件 import 进来的标识符 —— 那是把抄本改回
 *    单源时保留旧名的正当写法,不是第二份真相。
 *  - **放过 C(不在共享集合)**:端内私有类型完全不在射程(同名才算,宁漏不误报)。
 *
 * 定级:提交链走**该文件 HEAD 自身命中数**的差值棘轮 —— 现读存量非零,当场 blocking 就是一台与任何
 * 提交都无关的恒红门(AGENTS §12e),唯一结局是各会话 `--no-verify` 连带废掉链上全部对账。
 * **无行内豁免通道**:这一型只有"改 import 共享出口"一条正解,不存在合理动作被误伤的形态。
 *
 * 取材面(AGENTS §0.4 / 守门 118):全量档判 **HEAD blob**,`--staged` 判**索引 blob** 且端内射面
 * 跟着本次变更走,`--worktree` 仅人工逃生舱;两面旗同给 ⇒ exit 2。共享名集合**恒取整面**
 * (按变更收窄共享面会让"少一个共享名"伪装成合规,而端内命中数恰好依赖这份名单);
 * 共享面枚举到 0 个 `.ts` 或解析出 0 个对外名 ⇒ 判死不记绿。
 *
 * 用法:`node scripts/check-shared-type-not-redeclared.mjs [--staged|--worktree|--json|--strict|--self-test]`
 * 退出码:0 通过(含"只有存量") / 1 本次带进来的命中 / 2 无法判定。
 *
 * 接线状态(如实登记,不撒谎):**已接进提交链 = 守门 id 219**(2026-10-16 用
 * `scripts/gate-registry-insert.mjs` 以 HEAD 为底取号插入并同枚落地,注册条目现读
 * `mode: 'blocking'` / `skipEnv: 'HUSKY_SKIP_SHARED_TYPE_REDECLARED'` /
 * `stagedTriggers: ['apps/','packages/']`)。之所以敢 blocking 而不是 warn:拦的只有"本次把重声明
 * 加回来"的那一条(锚点 = 该文件 HEAD 自身命中数),现读存量 247 处对任何一次提交都不构成红 ——
 * 与 §12e 禁的恒红门不同型。落地当天 AGENTS.md「门名点名索引」同批改名(守门 89 R4 的义务),
 * 否则这道门自己就是"接线在位而文档隐形"的那一类。镜像测试 T1 钉的就是"头注声称与 runner 注册
 * 同真同假",这条注释一旦与注册表脱节即红。
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SHARED_SRC = 'packages/types/src'
/** 端内面:会重声明共享契约的地方(共享 types 包自身与工具层不在射程)。 */
const CONSUMER_DIRS = ['apps', 'packages/app/src', 'packages/shared/src', 'packages/ui-native/src']
const SELF_EXEMPT = ['check-shared-type-not-redeclared']
const TS_RE = /\.(ts|tsx)$/
const SKIP_FILE_RE = /(\.test\.|\.spec\.|\.d\.ts$)/
const TEST_PATH_RE = /(^|\/)(?:tests?|__tests__|__mocks__|e2e)\//
/** 顶层声明:行首可选 `export` / `declare`。缩进行一律不判(嵌套型与散文都不算端内对外契约)。 */
const TOP_DECL_RE = /^(?:export\s+)?(?:declare\s+)?(interface|type)\s+([A-Za-z_$][\w$]*)\b(.*)$/
const IMPORT_RE = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g

const specOf = (face, rel) => (face === 'staged' ? `:${rel}` : `HEAD:${rel}`)
const keep = (rel) => TS_RE.test(rel) && !SKIP_FILE_RE.test(rel) && !TEST_PATH_RE.test(rel)

function gitZ(args) {
  return String(gitRaw(args, ROOT))
    .split('\0')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * 共享面整棵枚举 —— 名单必须全,所以不按变更收窄。
 * `--staged` 档仍枚举 HEAD 树上的共享文件再按索引取正文:索引里没人改的共享文件与 HEAD 同形,
 * 而 `:` 前缀取的就是索引那份,两侧同面同轮。
 */
export function listSharedPaths(face) {
  const args =
    face === 'worktree'
      ? ['ls-files', '-z', '--', SHARED_SRC]
      : ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', SHARED_SRC]
  return gitZ(args).filter(keep)
}

/** 端内面:`--staged` 只咬本次变更(同守门 34/134 口径),其余档扫全树。 */
export function listConsumerPaths(face) {
  const args =
    face === 'staged'
      ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z', '--', ...CONSUMER_DIRS]
      : face === 'worktree'
        ? ['ls-files', '-z', '--', ...CONSUMER_DIRS]
        : ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ...CONSUMER_DIRS]
  return gitZ(args).filter(keep)
}

/** 共享包导出的对外类型名。纯函数,构造面可证。 */
export function sharedTypeNames(text) {
  const names = new Set()
  for (const src of Object.values(text)) {
    if (typeof src !== 'string') continue
    for (const line of src.split(/\r?\n/)) {
      const m = TOP_DECL_RE.exec(line)
      if (!m) continue
      if (!/^\s*export\b/.test(line)) continue // 非导出 = 包内私有,不是对外契约
      names.add(m[2])
    }
  }
  return names
}

export function importedNames(src) {
  const out = new Set()
  for (const m of src.matchAll(IMPORT_RE)) {
    for (const piece of m[1].split(',')) {
      const t = piece.trim().replace(/^type\s+/, '')
      if (!t) continue
      const as = t.split(/\s+as\s+/)
      out.add((as[1] || as[0]).trim())
      out.add(as[0].trim())
    }
  }
  return out
}

/** 顶层声明清单(带别名右值,判放过 A 用)。 */
export function declarations(src) {
  const out = []
  for (const line of src.split(/\r?\n/)) {
    const m = TOP_DECL_RE.exec(line)
    if (!m) continue
    const [, kind, name, rest] = m
    const alias =
      kind === 'type' ? /^\s*=\s*([A-Za-z_$][\w$]*)(?:\.[\w$]+)?\s*;?\s*$/.exec(rest ?? '') : null
    out.push({ kind, name, alias: alias ? alias[1] : null })
  }
  return out
}

/**
 * 形态提取 —— 回答"同名到底是不是同物"的唯一尺子。
 * 失效方向刻意是「判不出」：解析不了的形态一律 unknown，让清账方看见"这条得人工读"，
 * 而不是让门替它猜一个"等/不等"再被当成结论派单。
 */
const stripComments = (text) => {
  let out = ''
  let i = 0
  let str = null
  while (i < text.length) {
    const c = text[i]
    const n = text[i + 1]
    if (str) {
      out += c
      if (c === '\\') {
        out += n ?? ''
        i += 2
        continue
      }
      if (c === str) str = null
      i += 1
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      str = c
      out += c
      i += 1
      continue
    }
    if (c === '/' && n === '/') {
      while (i < text.length && text[i] !== '\n') i += 1
      continue
    }
    if (c === '/' && n === '*') {
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1
      i += 2
      continue
    }
    out += c
    i += 1
  }
  return out
}

/** 从声明头行起，取到这一条声明结束(外层括号配平 / 顶层分号 / 下一条顶层声明)。 */
function declText(lines, at, head) {
  const body = stripComments(lines.slice(at, at + 400).join('\n'))
  const open = body.indexOf('{')
  const eq = body.indexOf('=')
  if (head[1] === 'interface') {
    if (open < 0) return { form: 'unknown', why: 'interface 没有对象体' }
    let depth = 0
    for (let i = open; i < body.length; i++) {
      if (body[i] === '{') depth += 1
      else if (body[i] === '}') {
        depth -= 1
        if (depth === 0) return { form: 'object', text: body.slice(open + 1, i) }
      }
    }
    return { form: 'unknown', why: 'interface 的花括号未配平(截断或解析失败)' }
  }
  if (eq < 0) return { form: 'unknown', why: 'type 没有右值' }
  const rhsStart = body.slice(eq + 1)
  if (rhsStart.trimStart().startsWith('{')) {
    const open2 = rhsStart.indexOf('{')
    let depth = 0
    for (let i = open2; i < rhsStart.length; i++) {
      if (rhsStart[i] === '{') depth += 1
      else if (rhsStart[i] === '}') {
        depth -= 1
        if (depth === 0) return { form: 'object', text: rhsStart.slice(open2 + 1, i) }
      }
    }
    return { form: 'unknown', why: 'type 对象体的花括号未配平' }
  }
  const stop = rhsStart.search(/[;\r\n](?=\s*(?:export|interface|type|const|enum|\/\*|$))/)
  const rhs = (stop >= 0 ? rhsStart.slice(0, stop) : rhsStart).trim().replace(/;$/, '')
  return { form: 'rhs', text: rhs }
}

const splitTop = (text, seps) => {
  const parts = []
  let depth = 0
  let cur = ''
  let str = null
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (str) {
      cur += c
      if (c === '\\') {
        cur += text[i + 1] ?? ''
        i += 1
        continue
      }
      if (c === str) str = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      str = c
      cur += c
      continue
    }
    if ('([{<'.includes(c)) depth += 1
    else if (')]}>'.includes(c)) depth -= 1
    if (depth === 0 && seps.includes(c)) {
      parts.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  parts.push(cur)
  return parts.map((s) => s.trim()).filter(Boolean)
}

const normType = (t) =>
  t
    .replace(/\s+/g, ' ')
    .replace(/,+\s*$/, '')
    .trim()

/**
 * 一条声明 → 可比对的形态。object 取"成员名 + 是否可选 + 类型文本"，
 * union 取字面量集合；其余一律 unknown(继承、交叉、工具类型、引用别的命名类型、数组/元组、函数体)。
 */
export function shapeOf(src, name) {
  const lines = src.split(/\r?\n/)
  let at = -1
  let head = null
  for (let i = 0; i < lines.length; i++) {
    const m = TOP_DECL_RE.exec(lines[i])
    if (m && m[2] === name) {
      at = i
      head = m
      break
    }
  }
  if (!head) return { kind: 'unknown', why: `正文里定位不到 ${name} 的顶层声明` }
  const rest = head[3] ?? ''
  if (/\bextends\b/.test(rest)) return { kind: 'unknown', why: '带 extends ⇒ 字段集不等于全部契约' }
  if (/<[A-Za-z_$][\w$]*(\s+extends|>)/.test(rest))
    return { kind: 'unknown', why: '带泛型参数 ⇒ 不比' }
  const d = declText(lines, at, head)
  if (d.form === 'unknown') return { kind: 'unknown', why: d.why }
  if (d.form === 'object') {
    const fields = new Map()
    for (const piece of splitTop(d.text, ',;\n')) {
      const m = /^(?:readonly\s+)?(\[[^\]]*\]|[A-Za-z_$][\w$]*)(\?)?\s*:\s*([\s\S]+)$/.exec(
        piece.replace(/\n\s*/g, ' '),
      )
      // 解析不出"名: 类型"的就是索引签名/方法签名/条件类型 —— 一律回判不出，不猜成字段
      if (!m)
        return { kind: 'unknown', why: `成员行解析不出"名: 类型"(片段起头 ${piece.slice(0, 24)})` }
      if (m[1].startsWith('[')) return { kind: 'unknown', why: '含索引签名 ⇒ 字段集不完整' }
      fields.set(m[1], { optional: !!m[2], type: normType(m[3]) })
    }
    if (!fields.size) return { kind: 'unknown', why: '对象体里没有可解析成员' }
    return { kind: 'object', fields }
  }
  const parts = splitTop(d.text, '|')
  if (
    parts.length > 1 &&
    parts.every((p) =>
      /^(?:'[^']*'|"[^"]*"|`[^`]*`|-?\d+(?:\.\d+)?|true|false|null|undefined)$/.test(p.trim()),
    )
  )
    return { kind: 'union', literals: new Set(parts.map((p) => p.trim())) }
  if (/&/.test(d.text)) return { kind: 'unknown', why: '交叉类型 ⇒ 不比' }
  if (/^[A-Z]/.test(d.text) || /[A-Za-z_$][\w$]*\s*[<[]/.test(d.text))
    return {
      kind: 'unknown',
      why: `右值是引用/工具类型/数组形态(${normType(d.text).slice(0, 30)})`,
    }
  return { kind: 'unknown', why: '右值形状不在这把尺子的射程内' }
}

/** 两个形态比出三态；unknown 永远优先于"不等"(判不出 ≠ 不同物)。 */
export function compareShapes(a, b) {
  if (!a || a.kind === 'unknown')
    return { sameShape: 'undetermined', why: a ? a.why : '端内形态未取得' }
  if (!b || b.kind === 'unknown')
    return { sameShape: 'undetermined', why: b ? b.why : '共享形态未取得' }
  if (a.kind !== b.kind) return { sameShape: 'no', why: `形态类别不同(${a.kind} vs ${b.kind})` }
  if (a.kind === 'union') {
    const diff = [...new Set([...a.literals, ...b.literals])].filter(
      (v) => !(a.literals.has(v) && b.literals.has(v)),
    )
    return diff.length
      ? { sameShape: 'no', why: `字面量值域不同(差 ${diff.length} 个)` }
      : { sameShape: 'yes', why: `字面量集合逐相等(${a.literals.size} 个)` }
  }
  const keys = new Set([...a.fields.keys(), ...b.fields.keys()])
  const diff = []
  for (const k of keys) {
    const x = a.fields.get(k)
    const y = b.fields.get(k)
    if (!x || !y) {
      diff.push(`${k}(只在一侧)`)
      continue
    }
    if (x.optional !== y.optional || x.type !== y.type) diff.push(`${k}: ${x.type} ↔ ${y.type}`)
  }
  return diff.length
    ? { sameShape: 'no', why: `字段不同(${diff.length} 处)`, diff: diff.slice(0, 6) }
    : { sameShape: 'yes', why: `字段名与类型文本逐相等(${a.fields.size} 个成员)` }
}

/** 命中条目上的三态判定；调用方没给共享形态表 ⇒ 这一维显式判不出，不默认成"等"。 */
export function shapeVerdict(src, name, sharedShapes) {
  if (!sharedShapes) return { sameShape: 'undetermined', why: '调用方未提供共享形态表 ⇒ 该维没判' }
  const sharedShape = sharedShapes.get(name)
  if (!sharedShape) return { sameShape: 'undetermined', why: '共享侧形态未取得' }
  return compareShapes(shapeOf(src, name), sharedShape)
}

/** 共享包 name → 形态；同名在两处声明而形态不同 ⇒ 标 unknown(让清账方去读，不让门猜)。 */
export function buildSharedShapes(sharedTexts, sharedNameSet) {
  const map = new Map()
  const seen = new Map()
  for (const [path, src] of Object.entries(sharedTexts)) {
    if (typeof src !== 'string') continue
    for (const d of declarations(src)) {
      if (!sharedNameSet.has(d.name)) continue
      const s = shapeOf(src, d.name)
      const prev = seen.get(d.name)
      if (prev && prev.kind !== s.kind)
        map.set(d.name, { kind: 'unknown', why: '共享侧两处声明不同形' })
      else if (!map.has(d.name)) map.set(d.name, s)
      seen.set(d.name, s)
    }
  }
  return map
}

/**
 * 可达性：一个共享名只有**从包的对外出口够得到**，"改 import 共享出口"这条清账动作才可执行。
 * 门的射程按名字算(任何 src 文件里的 export 都算共享名)，而 `@ihui/types` 的公共面 =
 * src/index.ts 的出口图 + package.json exports 里声明的子路径文件。住在没进桶的文件里的名字
 * (实测 ProgressOverview 所在的 app-learning.ts 就是这一型)在源码树里"看着像契约"，消费端却 import 不到。
 * 这一维不删命中、只把动作分型：reachable=false 的动作 = 先把出口补进桶(或承认它不是对外契约)。
 */
const REEXPORT_STAR_RE = /^export\s+\*\s+(?:as\s+[A-Za-z_$][\w$]*\s+)?from\s*['"](\.[^'"]+)['"]/
const REEXPORT_NAMED_RE = /^export\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/

const resolveSpec = (fromPath, spec) => {
  const rel = spec.replace(/^\.\//, '').replace(/\.js$/, '')
  const base = fromPath.split('/').slice(0, -1)
  for (const p of rel.split('/')) {
    if (p === '.') continue
    else if (p === '..') base.pop()
    else base.push(p)
  }
  return `${base.join('/')}.ts`
}

/** 一个文件里"对外可见"的声明名(顶层 export 的 interface/type，以及 export {A, B} 具名清单)。 */
const exportedNamesOf = (src) => {
  const out = new Set()
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line.startsWith('export')) continue
    const decl = TOP_DECL_RE.exec(line.replace(/^export\s+/, ''))
    if (decl) out.add(decl[2])
    const braces = /^export\s+(?:type\s+)?\{([^}]*)\}/.exec(line)
    if (braces && !/\bfrom\b/.test(line)) {
      for (const piece of braces[1].split(',')) {
        const t = piece.trim().replace(/^type\s+/, '')
        if (t)
          out.add(
            t
              .split(/\s+as\s+/)
              .pop()
              .trim(),
          )
      }
    }
  }
  return out
}

/** 从入口图求可达名集；取不到入口文件 ⇒ 返回 null(该维显式判不出，不默认成"全都可达")。 */
export function buildSharedReach(sharedTexts, entryPath, subpathFiles) {
  const entry = sharedTexts[entryPath]
  if (typeof entry !== 'string') return null
  const reachable = new Set()
  const queued = new Set()
  const queue = [entryPath, ...(subpathFiles ?? [])].filter(
    (p) => typeof sharedTexts[p] === 'string',
  )
  for (const p of queue) queued.add(p)
  while (queue.length) {
    const path = queue.shift()
    const src = sharedTexts[path]
    if (typeof src !== 'string') continue
    for (const n of exportedNamesOf(src)) reachable.add(n)
    for (const raw of src.split(/\r?\n/)) {
      const line = raw.trim()
      const star = REEXPORT_STAR_RE.exec(line)
      if (star) {
        const target = resolveSpec(path, star[1])
        if (!queued.has(target) && typeof sharedTexts[target] === 'string') {
          queued.add(target)
          queue.push(target)
        }
        continue
      }
      const named = REEXPORT_NAMED_RE.exec(line)
      if (!named) continue
      const target = resolveSpec(path, named[2])
      if (typeof sharedTexts[target] !== 'string') continue
      for (const piece of named[1].split(',')) {
        const t = piece.trim().replace(/^type\s+/, '')
        if (!t) continue
        reachable.add(
          t
            .split(/\s+as\s+/)
            .pop()
            .trim(),
        )
      }
    }
  }
  return reachable
}

/** package.json 的 exports 子路径 → src 文件清单(`"./user": {types:"./dist/user.d.ts"}` ⇒ src/user.ts)。 */
export function subpathsToFiles(pkgJsonText, srcDir) {
  let pkg
  try {
    pkg = JSON.parse(pkgJsonText)
  } catch {
    return [] // 解析不出 ⇒ 交调用方按"未判定"出，不猜
  }
  const out = new Set()
  const walk = (node) => {
    if (typeof node === 'string') {
      const m = /^\.\/dist\/([A-Za-z0-9._-]+?)\.(?:d\.ts|js)$/.exec(node)
      if (m && m[1] !== 'index') out.add(`${srcDir}/${m[1]}.ts`)
      return
    }
    if (Array.isArray(node)) for (const v of node) walk(v)
    else if (node && typeof node === 'object') for (const v of Object.values(node)) walk(v)
  }
  walk(pkg?.exports ?? {})
  return [...out]
}

/**
 * 形态指纹 —— 把 shapeOf 的结果压成一个可分组的字符串。unknown 一律无指纹(不参与分组)。
 * 刻意**不含名字**:这一维要回答的正是"名字不同而契约相同"。
 */
export function shapeKey(shape) {
  if (!shape || shape.kind === 'unknown') return null
  if (shape.kind === 'union')
    return 'union:' + [...shape.literals].sort().join('|')
  return 'obj:' + [...shape.fields.entries()].sort().map(([k, v]) => `${k}${v.optional ? '?' : ''}:${v.type}`).join(',')
}

const END_OF_PATH = (p) => (p.startsWith('apps/') ? p.split('/')[1] : p.split('/')[0])

/**
 * 跨名同契约(只开队列，永不判红)：
 *  - `vsShared` 端内声明与某个**共享**类型逐字段同形而名字不同 ⇒ 动作 = 直接 import 那个共享名；
 *  - `crossEnd` 两个**不同端**的本地声明互相同形(共享侧没有) ⇒ 动作 = 提到共享层单源。
 * 为什么不判红：按名字并档已被证明会把跨层同名不同物并错(实测 no 150 处)，反过来"按形状并档"
 * 同样会撞车(两条 `{id:string,name:string}` 可以是两件东西)—— 所以这一维只交清单，不替人做决定。
 * 噪音护栏：成员 <2 的形状不报(空壳/单字段 everywhere)，同指纹组 >8 份不报(那是通用形状，不是同一件事)。
 */
export function crossNameQueue(files, sharedShapes, sharedNames) {
  const sharedByKey = new Map()
  for (const [name, shape] of sharedShapes ?? []) {
    const k = shapeKey(shape)
    if (!k) continue
    if (!sharedByKey.has(k)) sharedByKey.set(k, [])
    sharedByKey.get(k).push(name)
  }
  const byKey = new Map()
  for (const [path, src] of Object.entries(files)) {
    if (typeof src !== 'string') continue
    const imports = importedNames(src)
    for (const d of declarations(src)) {
      if (sharedNames.has(d.name)) continue // 同名的走 hits，不在此重复计
      if (d.alias && imports.has(d.alias)) continue
      const k = shapeKey(shapeOf(src, d.name))
      if (!k) continue
      if (!byKey.has(k)) byKey.set(k, [])
      byKey.get(k).push({ path, name: d.name })
    }
  }
  const vsShared = []
  const crossEnd = []
  for (const [k, list] of byKey) {
    // 单字段形状不报：`{ id: string }` 这种在仓里能命中上百件不同的东西，报出来只会淹掉清单
    if (k.startsWith('obj:') && !k.slice(4).includes(',')) continue
    const sharedHits = sharedByKey.get(k)
    if (sharedHits?.length) {
      for (const item of list) vsShared.push({ ...item, sharedNames: sharedHits.slice(0, 4) })
      continue
    }
    if (list.length > 8) continue // 通用形状，不是同一件事
    const ends = new Set(list.map((x) => END_OF_PATH(x.path)))
    if (list.length >= 2 && ends.size >= 2) {
      const names = new Set(list.map((x) => x.name))
      // 分两档，因为"同形"的证据强度差一个数量级：
      //  sameName = 两端各自写了一个**同名**的本地声明(共享侧缺)⇒ 可直接提共享层单源，高信度；
      //  diffName = 只是形状撞了(MessageCursor ↔ NotifItem 这种)⇒ 只排队，绝不替人判定。
      crossEnd.push({
        tier: names.size === 1 ? 'sameName' : 'diffName',
        key: k,
        members: list.slice(0, 8),
        ends: [...ends].sort(),
      })
    }
  }
  return { vsShared, crossEnd }
}

/** 三态计数唯一出口(json 档与人读档共用一份,避免两个口径互相打脸)。 */
export function countShapes(hits) {
  const c = { yes: 0, no: 0, undetermined: 0 }
  for (const h of hits) {
    // 认不出的取值一律归 undetermined(而不是加出一个 NaN 桶把计数砸穿)
    const key = h.sameShape === 'yes' || h.sameShape === 'no' ? h.sameShape : 'undetermined'
    c[key] += 1
  }
  return c
}

/** 判据本体:端内文件 × 共享名集合 → 命中 / 放过 / 未判定。三态绝不并桶。 */
export function judge(files, shared, sharedShapes, sharedReach) {
  const hits = []
  const passed = []
  const undetermined = []
  for (const [path, src] of Object.entries(files)) {
    if (typeof src !== 'string') {
      undetermined.push({ path, why: '正文取不到 ⇒ 这一份没判(不记通过也不记违规)' })
      continue
    }
    const imports = importedNames(src)
    for (const d of declarations(src)) {
      if (!shared.has(d.name)) continue
      if (d.alias && imports.has(d.alias)) {
        passed.push({ path, name: d.name, why: `别名指向共享出口 ${d.alias}` })
        continue
      }
      hits.push({
        path,
        name: d.name,
        kind: d.kind,
        // null = 调用方没给可达性表 ⇒ 这一维没判(不默认成 true，也不默认成 false)
        reachable: sharedReach ? sharedReach.has(d.name) : null,
        ...shapeVerdict(src, d.name, sharedShapes),
      })
    }
  }
  return { hits, passed, undetermined }
}

function readFace(face, paths) {
  const out = {}
  if (!paths.length) return out
  if (face === 'worktree') {
    for (const p of paths) {
      const t = readWorktreeFile(ROOT, p)
      if (typeof t === 'string') out[p] = t
    }
    return out
  }
  const map = catBatch(
    ROOT,
    paths.map((rel) => specOf(face, rel)),
  )
  for (const p of paths) {
    const v = map.get(specOf(face, p))
    if (typeof v === 'string') out[p] = v
  }
  return out
}

function runSelfTest() {
  let pass = 0
  let fail = 0
  // cond 必须是**已求值布尔**:把箭头函数当 cond 传进来会恒真(门 150 票㛛那一课)。
  const t = (name, cond) => {
    if (cond === true) {
      pass += 1
      console.log(`  ✅ ${name}`)
    } else {
      fail += 1
      console.log(`  ❌ ${name} —— 实得:${JSON.stringify(cond)}`)
    }
  }
  const sharedSrc = {
    'packages/types/src/x.ts': [
      'export interface MemoryEntry { id: string }',
      'export type MemoryScope = "a" | "b"',
      'interface NotExported {}',
      'export declare interface Shadowed {}',
    ].join('\n'),
  }
  const shared = sharedTypeNames(sharedSrc)
  t('S1 收到导出的 interface 与 type', shared.has('MemoryEntry') && shared.has('MemoryScope'))
  t('S2 非导出的包内私有型不算对外契约', !shared.has('NotExported'))
  t('S2b declare 导出型同样收进来', shared.has('Shadowed'))

  const h = judge({ 'apps/web/src/a.ts': 'export interface MemoryEntry { id: string }\n' }, shared)
  t('S3 端内顶层重声明共享型 ⇒ 命中', h.hits.length === 1 && h.hits[0].name === 'MemoryEntry')

  const alias = judge(
    {
      'apps/cli/src/a.ts':
        "import type { MemoryListResponse as X } from '@ihui/types';\ntype MemoryEntry = X;\n",
    },
    new Set([...shared, 'MemoryListResponse']),
  )
  t(
    'S4 别名收回单源 ⇒ 放过(不得把正解判成违规)',
    alias.hits.length === 0 && alias.passed.length === 1,
  )

  const aliasLocal = judge({ 'apps/web/src/b.ts': 'type MemoryEntry = SomethingLocal;\n' }, shared)
  t('S5 右值不是 import 进来的 ⇒ 仍命中(别名通道不给本地型开后门)', aliasLocal.hits.length === 1)

  const priv = judge({ 'apps/web/src/c.ts': 'interface LocalThing { a: string }\n' }, shared)
  t('S6 名字不在共享集合 ⇒ 完全不在射程', priv.hits.length === 0 && priv.passed.length === 0)

  const und = judge({ 'apps/web/src/d.ts': undefined }, shared)
  t('S7 正文取不到 ⇒ 未判定,不得记通过', und.hits.length === 0 && und.undetermined.length === 1)

  const nested = judge({ 'apps/web/src/e.ts': '  interface MemoryEntry { a: string }\n' }, shared)
  t('S8 缩进的嵌套/散文声明不判(只认顶层)', nested.hits.length === 0)

  const useOnly = judge(
    {
      'apps/web/src/f.ts': 'const x: MemoryEntry = 1\nfunction f(v: { MemoryEntry: string }) {}\n',
    },
    shared,
  )
  t('S9 使用点(非声明)不判红', useOnly.hits.length === 0)

  t(
    'S10 路径过滤:测试面/`.d.ts` 出射程,`.tsx`/`.ts` 在射程',
    [
      ['apps/web/x.test.ts', false],
      ['apps/web/tests/x.ts', false],
      ['apps/web/x.d.ts', false],
      ['apps/web/x.tsx', true],
      ['packages/types/src/x.ts', true],
    ].every(([p, want]) => keep(p) === want),
  )

  const iface = judge(
    {
      'apps/web/src/g.ts':
        "import type { MemoryEntry as X } from '@ihui/types';\ninterface MemoryEntry { a: string }\n",
    },
    shared,
  )
  t('S11 导入了共享名但仍另写同名 interface ⇒ 命中(import 不遮丑)', iface.hits.length === 1)

  // ── sameShape 维(同名是否同物)——三态都必须有正反用例，缺一条就是这把尺子没牙 ──
  const shapeTable = new Map([
    [
      'MemoryEntry',
      { kind: 'object', fields: new Map([['a', { optional: false, type: 'string' }]]) },
    ],
  ])
  const yesCase = judge(
    { 'apps/web/src/s1.ts': 'interface MemoryEntry { a: string }\n' },
    shared,
    shapeTable,
  )
  t(
    'S12 字段名与类型文本逐相等 ⇒ yes(不是"名字撞了就算")',
    yesCase.hits.length === 1 && yesCase.hits[0].sameShape === 'yes',
  )

  const noCase = judge(
    { 'apps/web/src/s2.ts': 'interface MemoryEntry { a: number }\n' },
    shared,
    shapeTable,
  )
  t(
    'S13 同名字段类型不同 ⇒ no(把 no 记成 yes 就会自动并档,并错)',
    noCase.hits[0]?.sameShape === 'no',
  )

  const noKeyCase = judge(
    { 'apps/web/src/s3.ts': 'interface MemoryEntry { a: string; b?: string }\n' },
    shared,
    shapeTable,
  )
  t('S14 多一个字段(哪怕可选)⇒ no', noKeyCase.hits[0]?.sameShape === 'no')

  const undCase = judge(
    { 'apps/web/src/s4.ts': 'interface MemoryEntry extends Base { a: string }\n' },
    shared,
    shapeTable,
  )
  t(
    'S15 带 extends ⇒ undetermined(判不出绝不写成"不等"，也不写成"等")',
    undCase.hits[0]?.sameShape === 'undetermined',
  )

  const noTableCase = judge(
    { 'apps/web/src/s5.ts': 'interface MemoryEntry { a: string }\n' },
    shared,
  )
  t(
    'S16 调用方没给共享形态表 ⇒ 该维显式判不出(不得默认成 yes)',
    noTableCase.hits[0]?.sameShape === 'undetermined',
  )

  const unionSrc = (vals) => `export type ChatModelType = ${vals}\n`
  const uA = shapeOf(unionSrc("'a' | 'b' | 'c'"), 'ChatModelType')
  const uB = shapeOf(unionSrc("'c' | 'b' | 'a'"), 'ChatModelType')
  const uC = shapeOf(unionSrc("'a' | 'b'"), 'ChatModelType')
  t(
    'S17 字面量 union 按集合比(书写顺序无关)，值域真不同时必须 no',
    compareShapes(uA, uB).sameShape === 'yes' && compareShapes(uA, uC).sameShape === 'no',
  )
  t(
    'S18 右值是引用/工具类型/索引签名一律 undetermined(不当"不等"，也不当"等")',
    [
      'export type Foo = Bar & Baz\n',
      'export type Foo = Pick<Bar, "a">\n',
      'export type Foo = { [k: string]: string }\n',
      'export type Foo = Bar[]\n',
    ].every((src) => shapeOf(src, 'Foo').kind === 'unknown'),
  )

  // ── 可达性维:共享名只有从包出口够得到，"改 import 共享出口"才是可执行动作 ──
  const graph = {
    'packages/types/src/index.ts': "export * from './a.js'\nexport { type Only } from './c.js'\n",
    'packages/types/src/a.ts': 'export interface ReachableOne { a: string }\n',
    'packages/types/src/c.ts':
      'export interface Only { o: string }\nexport interface NotReExported { n: string }\n',
    'packages/types/src/lonely.ts': 'export interface Hidden { h: string }\n',
  }
  const reach = buildSharedReach(graph, 'packages/types/src/index.ts', [])
  t(
    'R1 入口图:export * 全量可达、具名再导出只认列出的名字、没进桶的文件里的名字不可达',
    reach.has('ReachableOne') &&
      reach.has('Only') &&
      !reach.has('NotReExported') &&
      !reach.has('Hidden'),
  )
  const reachJudge = judge(
    {
      'apps/web/x.ts': 'interface Hidden { h: string }\ninterface ReachableOne { a: string }\n',
    },
    new Set(['Hidden', 'ReachableOne']),
    undefined,
    reach,
  )
  const byName = Object.fromEntries(reachJudge.hits.map((h) => [h.name, h.reachable]))
  t(
    'R2 命中条目带可达性:桶里的 true、没进桶的 false(两者都是命中,只是动作不同)',
    byName.ReachableOne === true && byName.Hidden === false,
  )
  const reachNoTable = judge(
    { 'apps/web/y.ts': 'interface ReachableOne { a: string }\n' },
    new Set(['ReachableOne']),
  )
  t(
    'R3 没给可达性表 ⇒ reachable=null(判不出,不得默认成"全都可达")',
    reachNoTable.hits[0]?.reachable === null,
  )
  t(
    'R4 子路径出口解析:./dist/user.d.ts ⇒ src/user.ts，且非 dist 路径不误收',
    subpathsToFiles(
      '{"exports":{".":{"types":"./dist/index.d.ts"},"./user":{"types":"./dist/user.d.ts"},"./style.css":"./style.css"}}',
      'packages/types/src',
    ).join(',') === 'packages/types/src/user.ts',
  )

  // ── 跨名同契约(只开队列)：名字匹配看不见的那批 ──
  const cnShared = {
    'packages/types/src/a.ts':
      'export interface AsksRow { id: string\n title: string }\nexport interface Pair { x: string\n y: string }\n',
  }
  const cnNames = sharedTypeNames(cnShared)
  const cnShapes = buildSharedShapes(cnShared, cnNames)
  const cnFiles = {
    // 与共享 AsksRow 同形而不同名 ⇒ vsShared
    'apps/web/app/x.ts': 'interface AsksData { id: string; title: string }\n',
    // 两端各自本地声明同一契约(共享侧没有)⇒ crossEnd / tier=sameName
    'apps/mobile-rn/src/y.ts': 'interface CoursePick { a: string\n b: number }\n',
    'apps/miniapp-taro/src/z.ts': 'interface CoursePick { a: string; b: number }\n',
    // 异名同形跨端 ⇒ 同一把尺子必须分到 diffName(只是形状撞车,不得与同名同层对待)
    'apps/web/app/u.ts': 'interface OneThing { p: string; q: number }\n',
    'apps/cli/src/u2.ts': 'interface OtherThing { p: string; q: number }\n',
    // 单字段形状 ⇒ 噪音护栏，不报
    'apps/web/app/w.ts': 'interface JustId { id: string }\n',
    // 同名 ⇒ 走 hits，不进队列
    'apps/web/app/v.ts': 'interface AsksRow { id: string; title: string }\n',
  }
  const q = crossNameQueue(cnFiles, cnShapes, cnNames)
  t(
    'Q1 端内声明与共享类型同形而不同名 ⇒ 进 vsShared 并点名那个共享名',
    q.vsShared.length === 1 &&
      q.vsShared[0].name === 'AsksData' &&
      q.vsShared[0].sharedNames.includes('AsksRow'),
  )
  t(
    'Q2 两个不同端各自本地声明同一契约(共享侧缺)⇒ 进 crossEnd、tier=sameName,并列出两端',
    q.crossEnd.length === 2 &&
      q.crossEnd.filter((g) => g.tier === 'sameName').length === 1 &&
      q.crossEnd.find((g) => g.tier === 'sameName')?.ends.join(',') === 'miniapp-taro,mobile-rn' &&
      q.crossEnd.find((g) => g.tier === 'sameName')?.members.length === 2,
  )
  t(
    'Q3 单字段形状不进队列(通用形状不是同一件事)',
    ![...q.crossEnd, ...q.vsShared].some(
      (x) => x.name === 'JustId' || x.members?.some?.((m) => m.name === 'JustId'),
    ),
  )
  t(
    'Q6 异名同形跨端必须落 diffName 档(形状撞车不等于同一件事)',
    q.crossEnd.filter((g) => g.tier === 'diffName').length === 1 &&
      q.crossEnd
        .find((g) => g.tier === 'diffName')
        .members.map((m) => m.name)
        .sort()
        .join(',') === 'OneThing,OtherThing',
  )
  t(
    'Q4 与共享同名的那条走 hits，不被 crossName 重复计一次',
    judge(cnFiles, cnNames, cnShapes).hits.some((h) => h.name === 'AsksRow') &&
      !q.vsShared.some((x) => x.name === 'AsksRow') &&
      !q.crossEnd.some((g) => g.members.some((m) => m.name === 'AsksRow')),
  )
  t(
    'Q5 无指纹(unknown)的形状绝不进队列:交叉/工具类型/extends 都不报',
    crossNameQueue(
      {
        'apps/web/p.ts': 'type Left = A & B\n',
        'apps/api/q.ts': 'interface Right extends Base { id: string; title: string }\n',
      },
      cnShapes,
      cnNames,
    ).crossEnd.length === 0,
  )

  console.log(`\n${pass}/${pass + fail} 条通过`)
  return fail ? 1 : 0
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(runSelfTest())
  const asJson = argv.includes('--json')
  const strict = argv.includes('--strict')
  let face
  try {
    // ⚠️ `selectFace` 返回的是**对象**(`{face, note}`),不是面名。直接把它当字符串用会让
    // `face === 'staged'` 恒假 ⇒ `--staged` 静默改读 HEAD blob —— 本仓在
    // `check-plan-sha-resolvable.mjs` 上记过同型缺陷("三面同读 HEAD")。这里显式取 `.face`,
    // 并保留对旧签名的兜底(取不到名字就判死,绝不退化成"看起来跑过了")。
    const sel = selectFace({
      staged: argv.includes('--staged'),
      worktree: argv.includes('--worktree'),
    })
    face = typeof sel === 'string' ? sel : sel?.face
    if (!['staged', 'head', 'worktree'].includes(face)) {
      console.error(`❌ 取材面解析不出(${JSON.stringify(sel)})⇒ 无法判定,不记绿也不冒红`)
      process.exit(2)
    }
  } catch (e) {
    console.error(`❌ ${e.message}`)
    process.exit(2)
  }

  const sharedPaths = listSharedPaths(face)
  if (!sharedPaths.length) {
    console.error(`❌ 共享面(${face})枚举到 0 个 .ts ⇒ 判死,不记绿`)
    process.exit(2)
  }
  const sharedFiles = readFace(face, sharedPaths)
  if (Object.keys(sharedFiles).length === 0) {
    console.error(`❌ 共享面正文一条都取不到(${face})⇒ 无法判定,不记绿`)
    process.exit(2)
  }
  const shared = sharedTypeNames(sharedFiles)
  if (!shared.size) {
    console.error(`❌ 共享面解析出 0 个对外类型名(${face})⇒ 判死,不记绿`)
    process.exit(2)
  }
  // 共享侧形态表与命中扫描同面取(source = 同一个 readFace(face, sharedPaths) 的结果)——
  // 拿工作树源码去比 HEAD 词表会造出假分叉(本仓记过"诊断只能取同一个面")。
  const sharedShapes = buildSharedShapes(sharedFiles, shared)
  const SHARED_ENTRY = 'packages/types/src/index.ts'
  const pkgText = readFace(face, ['packages/types/package.json'])['packages/types/package.json']
  const subpathFiles =
    typeof pkgText === 'string' ? subpathsToFiles(pkgText, 'packages/types/src') : undefined
  if (typeof pkgText !== 'string' || !subpathFiles.length)
    console.error(
      'ⓘ 取不到 packages/types/package.json 或其中没有子路径出口 ⇒ 可达性按"未判定"出，不默认成全都可达',
    )
  const sharedReach = buildSharedReach(sharedFiles, SHARED_ENTRY, subpathFiles)

  const consumerPaths = listConsumerPaths(face).filter(
    (p) => !SELF_EXEMPT.some((s) => p.includes(s)),
  )
  const files = readFace(face, consumerPaths)
  const { hits, passed, undetermined } = judge(files, shared, sharedShapes, sharedReach)
  // 跨名同契约：只开队列，不参与 hits/red/退出码(按形状并档与按名字并档同样会撞车)
  const queue = crossNameQueue(files, sharedShapes, shared)

  let red = []
  let ratcheted = 0
  if (face === 'worktree') {
    red = hits
  } else {
    const byPath = {}
    for (const h of hits) (byPath[h.path] ??= []).push(h)
    const headFiles = readFace('head', Object.keys(byPath))
    for (const [path, list] of Object.entries(byPath)) {
      const src = headFiles[path]
      // 新文件不在 HEAD 上 ⇒ 锚点 0(读不到不许 exit 2,否则每次"新增一个文件"都被恒挡)
      const allowance =
        typeof src === 'string' ? judge({ [path]: src }, shared, sharedShapes).hits.length : 0
      list.forEach((h, i) => {
        if (i + 1 > allowance) red.push(h)
        else ratcheted += 1
      })
    }
  }
  if (asJson) {
    console.log(
      JSON.stringify(
        {
          face,
          sharedNames: shared.size,
          scanned: Object.keys(files).length,
          hits: hits.length,
          // detail 是逐条清单:只有计数 ⇒ 262 处存量无人能清(清账必须先知道"哪条在哪个文件"),
          // 而让清账方自己再写一份扫描 = §22c 禁的"同一判据第二份"。red 用同一批对象引用回标,
          // 不再第二遍算棘轮。
          detail: hits.map((h) => ({
            path: h.path,
            name: h.name,
            line: h.line ?? null,
            isRed: red.includes(h),
            // 三态：yes 才是可机械收敛的一条；no = 同名不同物(按名字并档就是把两件东西并成一件)；
            // undetermined 必须显式点名"为什么判不出"，不得默认成等或不等。
            sameShape: h.sameShape,
            shapeWhy: h.why ?? null,
            shapeDiff: h.diff ?? null,
            // 可达性:false = 该共享名没进包出口,"改 import 共享出口"这条动作对它不可执行
            reachable: h.reachable,
          })),
          sameShapeCounts: countShapes(hits),
          reachableCounts: {
            true: hits.filter((h) => h.reachable === true).length,
            false: hits.filter((h) => h.reachable === false).length,
            undetermined: hits.filter((h) => h.reachable !== true && h.reachable !== false).length,
          },
          convergenceReady: hits.filter((h) => h.sameShape === 'yes' && h.reachable === true)
            .length,
          // 跨名同契约(只开队列)：名字匹配看不见的那批同契约声明
          crossName: {
            vsShared: queue.vsShared.length,
            crossEnd: queue.crossEnd.length,
            crossEndSameName: queue.crossEnd.filter((g) => g.tier === 'sameName').length,
            vsSharedList: queue.vsShared.slice(0, 40),
            crossEndList: queue.crossEnd.slice(0, 20),
          },
          red,
          ratcheted,
          passed: passed.length,
          undetermined,
        },
        null,
        2,
      ),
    )
  } else {
    console.log(
      `判定面 ${face}:共享对外类型名 ${shared.size} 个 · 端内文件 ${Object.keys(files).length} 个`,
    )
    console.log(
      `端内重声明命中 ${hits.length} 处(本次新增判红 ${red.length} · 存量按该文件 HEAD 棘轮只报数 ${ratcheted})`,
    )
    for (const h of red.slice(0, 40)) console.log(`  ❌ ${h.path} :: ${h.kind} ${h.name}`)
    const c = countShapes(hits)
    const ready = hits.filter((h) => h.sameShape === 'yes' && h.reachable === true).length
    const unreachable = hits.filter((h) => h.reachable === false).length
    console.log(
      `  同名同物 yes ${c.yes} · 同名不同物 no ${c.no} · 判不出 undetermined ${c.undetermined} · 出口不可达 ${unreachable}`,
    )
    console.log(
      `  可一条命令收敛(yes 且出口可达) ${ready} 条 —— 其余各有前置:no 不许并、undetermined 要人工读、不可达要先补包出口`,
    )
    const sameNameGroups = queue.crossEnd.filter((g) => g.tier === 'sameName')
    console.log(
      `  跨名同契约(只开队列,不判红):端内同形于共享名 ${queue.vsShared.length} 条 · 跨端同契约 同名片段 ${sameNameGroups.length} 组 / 异名同形 ${(queue.crossEnd.length - sameNameGroups.length)} 组(后者只是形状撞车,不得当"同一件事")`,
    )
    for (const q of sameNameGroups.slice(0, 6))
      console.log(
        `    ⇄ 同名跨端 [${q.ends.join(' / ')}] ${q.members.map((m) => `${m.path.split('/').pop()}::${m.name}`).join(' , ')}`,
      )
    for (const h of hits.filter((x) => x.sameShape === 'yes' && x.reachable === true).slice(0, 12))
      console.log(`    → ${h.path} :: ${h.name} —— ${h.why}`)
    if (hits.length > red.length)
      console.log(
        `  ⓘ 另有 ${hits.length - red.length} 处属存量(与本次提交无关),清偿动作 = 改 import 共享出口`,
      )
    for (const u of undetermined.slice(0, 10)) console.log(`  ? 未判定:${u.path} —— ${u.why}`)
    if (undetermined.length > 10) console.log(`  ? 其余 ${undetermined.length - 10} 条未判定同上`)
    console.log(`  ✓ 放过 ${passed.length} 处(别名指向共享出口,正当写法)`)
  }
  if (strict && undetermined.length) {
    console.error(`❌ 有 ${undetermined.length} 条未判定 ⇒ 拒绝出具合格证`)
    process.exit(2)
  }
  if (red.length) {
    console.error('❌ 端内新增了共享类型重声明 ⇒ 改 import 自 @ihui/types(AGENTS §3 共享层优先)')
    process.exit(1)
  }
  // `--json` 档的 stdout 必须只有 JSON —— 尾随一行人类读语会砸碎解析(AGENTS 记过多次:
  // 「豁免标记要在原文面数 + 新打印要分档」)。判据结论由退出码 + JSON 字段承载,这句只给人在读面看。
  if (!asJson) console.log('✅ 无新增端内重声明(存量随该文件 HEAD 棘轮只报数)')
}

// §22d 入口守卫:镜像测试 import 本模块时不得触发 CLI 主流程(裸 main() 由守门 194 判红)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  sharedTypeNames,
  importedNames,
  declarations,
  judge,
  shapeOf,
  compareShapes,
  buildSharedShapes,
  buildSharedReach,
  subpathsToFiles,
  shapeVerdict,
  countShapes,
  shapeKey,
  crossNameQueue,
  keep,
  specOf,
  listSharedPaths,
  listConsumerPaths,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
