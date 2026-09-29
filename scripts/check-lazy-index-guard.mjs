// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-lazy-index-guard.mjs —— 懒索引护栏的两型回归守卫(PROJECT_PLAN V3 #75 后半)。
 *
 * 拦的是两类"改完又会自己长回来"的形状,不是某个具体数字:
 *
 *  L1 **阈值不得回到无证据的字面量**
 *     `_LAZY_INDEX_MAX_FILES = 2000` 那行活了 20 天,没有任何人能量出它是根据什么定的
 *     —— 因为根本没有依据。本判据要求:每个 `_LAZY_INDEX_*: Final[...] = <数字>` 的
 *     上方相邻注释必须带**证据标记**(`实测 YYYY-MM-DD` 或 `policy`/`策略`),
 *     且**不允许**再出现 `_LAZY_INDEX_MAX_FILES = <整数>` 这种"把阈值本身写成字面量"的
 *     形态(阈值必须是 `lazy_index_file_limits()` 从成本常量导出的结果)。
 *     区分"实测"与"策略档"是刻意的:把策略档伪装成测量结果,下一次没人敢动它。
 *
 *  L2 **超限不得静默返回空**
 *     旧实现的四条 `return []` 让"没建索引""在冷却""路径不是目录""建索引炸了"
 *     在响应面上与"这个仓库确实没有答案"完全同形。本判据要求护栏函数体里
 *     不得有裸 `return []`,每个拒绝分支的返回构造必须带 `reason=`,
 *     且"没建"与"建了但没命中"这两种状态名必须同时存在(合并成一格就等于又静默了)。
 *
 *  L3 **分母不得是饱和值**
 *     旧实现判的是 `len(_collect_code_files(root))`,而那个列表被 `MAX_FILES_PER_INDEX`
 *     截断 ⇒ 真仓恒等于 5000(实测 31,672 / 另一次检出 244,765 都读成同一个数)。
 *     本判据要求护栏走**有界探测**(`probe_code_file_count`),并且不得再对
 *     `_collect_code_files(` 的结果取 `len(`。
 *
 * 为什么它自己值得存在(而不是只靠 code review):这三型全都是"改对过一次、
 * 被并发会话拿旧基线整文件写回"的高危面(AGENTS §12 那一串)。没有尺子,回潮无声音。
 *
 * ── 取材口径(与守门 70/77/83/98/101/103/118 同形)────────────────────────
 *   缺省:判 **HEAD blob**;`--staged`:判**索引 blob**;`--worktree`:仅人工排查;
 *   两面旗同给 ⇒ exit 2;该面取不到 ⇒ exit 2「无法判定」,**不回落**到另一个面;
 *   候选集枚举到 0 个文件 ⇒ 判死(不记绿)。
 *   `--staged` 走**每文件 HEAD 自身存量棘轮**:只拦"这次改动把违规加回来 / 新增违规",
 *   不拦仓库既有债 —— 与改动无关的恒红门只会逼人 `--no-verify`,连带废掉全部守门。
 *   `--strict`:零容忍(存量也判红),供归零后问责与 CI。
 *
 * ── 注册状态(如实登记)──────────────────────────────────────────────
 *   本门**未**接进 `scripts/guardian-runner.mjs`,也**未**写进 package.json / AGENTS.md /
 *   README.md。依据是任务书明文:"不要自己去 scripts/guardian-runner.mjs 注册(主会话
 *   单写),留一份 §22c 形态镜像测试即可"。因此这里不出现任何"已接 pre-commit /
 *   第 N 项"的字样(守门 89 的 R1 正是拿这种声称对账五处权威点)。
 *   注册时需要的条目形状见 `scripts/tests/check-lazy-index-guard.test.mjs` 的 T1。
 *
 * 用法:
 *   node scripts/check-lazy-index-guard.mjs              # 全量,判 HEAD
 *   node scripts/check-lazy-index-guard.mjs --staged     # 提交链口径(棘轮)
 *   node scripts/check-lazy-index-guard.mjs --strict     # 零容忍问责档
 *   node scripts/check-lazy-index-guard.mjs --self-test  # 构造面正反成对自检
 */
/* eslint-disable no-console -- 守门脚本是 CLI 工具,诊断信息必须直接打给用户 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  FACE_LABEL,
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const SELF_PATH = fileURLToPath(import.meta.url)
const DEFAULT_ROOT = path.resolve(path.dirname(SELF_PATH), '..')

/**
 * 候选文件的**内容签名**:护栏住在哪个文件,不由文件名说了算。
 * 写死 `mcp_server.py` 会在下一次搬模块时静默变成"扫到 0 个候选",
 * 而 0 候选如果被判成通过,门就成了一台恒绿的空转尺子。
 */
const CANDIDATE_SIGNATURE = /_LAZY_INDEX[A-Z0-9_]*/
/** 只有 .py 才可能承载这段护栏;其余扩展名不参与(减少噪声,不扩大判据)。 */
const SCAN_EXT = /\.py$/

/** 证据标记:实测(带日期)或明确标注的策略档。二者缺一即"无证据字面量"。 */
const EVIDENCE_MARK = /(实测\s*20\d\d-\d\d-\d\d|policy|策略档|策略选择)/
/** 旧形态:把"阈值本身"写成裸整数字面量(而不是从成本常量导出)。冒号可有可无。 */
const BARE_THRESHOLD_LITERAL = /^\s*_LAZY_INDEX_MAX_FILES\s*:?\s*=\s*[0-9_]+\s*(?:#.*)?$/m
/** 成本常量:`_LAZY_INDEX_FOO: Final[float] = 0.541`。 */
const COST_CONST = /^\s*_LAZY_INDEX_[A-Z0-9_]+\s*:\s*Final\[(?:float|int)\]\s*=\s*[0-9][0-9_.eE+-]*\s*(?:#.*)?$/gm
/** 饱和分母:对截断后的列表取长度。 */
const SATURATED_DENOMINATOR = /len\s*\(\s*[A-Za-z_][\w.]*\._collect_code_files\s*\(/
/** 有界探测出口(必须有,否则 L3 只是"没犯旧错"而不是"用了新出口")。 */
const PROBE_CALL = /probe_code_file_count\s*\(/
/** 静默空表。 */
const BARE_EMPTY_RETURN = /^\s*return\s+\[\]\s*(?:#.*)?$/gm
/** 护栏函数名(只在它的函数体内判 L2,避免把全文件当射程而误报)。 */
const GUARD_FN = /(?:async\s+)?def\s+(_lazy_index_and_research|evaluate_lazy_index_guard)\s*\(/
/** "没建"与"建了但没命中"两种状态必须同时存在。 */
const STATUS_NOT_INDEXED = /skipped-over-limit/
const STATUS_INDEXED_BUT_EMPTY = /empty-after-index/
/** 拒绝构造必须带 reason=;这一格找的是 `return LazyIndexOutcome(` 的整段调用。 */
const OUTCOME_CONSTRUCTION = /return\s+LazyIndexOutcome\s*\(/g

const RULES = /** @type {const} */ ({
  L1_NO_EVIDENCE: '无证据的阈值字面量(成本常量缺"实测 日期"或"策略档"标记)',
  L1_BARE_THRESHOLD: '把阈值本身写成裸整数字面量(应为 lazy_index_file_limits() 的派生值)',
  L2_SILENT_EMPTY: '护栏函数体内出现裸 `return []`(超限/失败必须带状态与 reason)',
  L2_MISSING_REASON: '拒绝分支的返回构造没有 reason=(静默拒绝 = 旧契约换皮)',
  L2_STATUS_MERGED: '"没建索引"与"建了但无语义命中"两种状态被合并或缺一(又变回静默)',
  L3_SATURATED_DENOM: '护栏读的是被 MAX_FILES_PER_INDEX 截断的列表长度(饱和分母)',
  L3_NO_PROBE: '护栏未走有界探测出口 probe_code_file_count()',
})

// ────────────────────────────── 纯函数层 ──────────────────────────────

/**
 * 取一个 Cost 常量行的"证据上下文":自身行尾注释 + 向上最多 6 行连续注释。
 * 只在连续注释里找,不越界到上一条代码 —— 否则一段无关的旧注释就能替新字面量背书。
 */
export function evidenceContext(lines, idx) {
  const own = lines[idx] ?? ''
  const tail = own.includes('#') ? own.slice(own.indexOf('#')) : ''
  const picked = [tail]
  for (let k = idx - 1; k >= 0 && picked.length <= 6; k -= 1) {
    const t = lines[k].trim()
    if (t === '') continue // 空行不打断注释块(常量前常有空行分隔)
    if (!t.startsWith('#')) break
    picked.unshift(lines[k])
  }
  return picked.join('\n')
}

/** 抠出 `def _lazy_index_and_research(...)` / `def evaluate_lazy_index_guard(...)` 的函数体。 */
export function guardFunctionBodies(text) {
  const lines = text.split(/\r?\n/)
  /** @type {{name: string, start: number, body: string[], raw: string[]}[]} */
  const found = []
  for (let i = 0; i < lines.length; i += 1) {
    const m = GUARD_FN.exec(lines[i])
    if (!m) continue
    const indent = lines[i].match(/^\s*/)[0].length
    if (indent !== 0) continue // 只认模块顶层定义,嵌套同名不算
    let end = i + 1
    while (end < lines.length) {
      const l = lines[end]
      if (l.trim() !== '' && (l.match(/^\s*/)[0].length ?? 0) <= indent && !l.trim().startsWith('@')) break
      end += 1
    }
    found.push({ name: m[1], start: i, body: lines.slice(i, end), raw: lines.slice(i, end) })
    i = end - 1
  }
  return found
}

/**
 * 对一个文件的内容跑全部判据。纯函数:不读盘、不碰 git。
 * @returns {{violations: {rule: keyof typeof RULES, line: number, text: string}[], undetermined: string[]}}
 */
export function auditText(rel, text) {
  /** @type {{rule: keyof typeof RULES, line: number, text: string}[]} */
  const violations = []
  /** @type {string[]} */
  const undetermined = []
  const lines = text.split(/\r?\n/)
  const lineNo = (pos) => text.slice(0, pos).split('\n').length

  // ── L1 ──
  const bare = text.match(BARE_THRESHOLD_LITERAL)
  if (bare) {
    violations.push({ rule: 'L1_BARE_THRESHOLD', line: lineNo(text.indexOf(bare[0])), text: bare[0].trim() })
  }
  for (const m of text.matchAll(COST_CONST)) {
    const idx = lineNo(m.index ?? 0) - 1
    if (!EVIDENCE_MARK.test(evidenceContext(lines, idx))) {
      violations.push({ rule: 'L1_NO_EVIDENCE', line: idx + 1, text: m[0].trim() })
    }
  }

  // ── L3 ──
  for (const [i, l] of lines.entries()) {
    const t = stripPyComment(l)
    if (SATURATED_DENOMINATOR.test(t)) {
      violations.push({ rule: 'L3_SATURATED_DENOM', line: i + 1, text: t.trim() })
    }
  }
  // L3 的"必须有探测出口"只对该模块**定义了护栏函数**时要求(否则一个只是引用了
  // _LAZY_INDEX_* 常量的文件会被判成"没接探测",那是误报而不是判据)。
  if (GUARD_FN.test(text) && !PROBE_CALL.test(text)) {
    violations.push({ rule: 'L3_NO_PROBE', line: 1, text: rel })
  }

  // ── L2 ──
  const bodies = guardFunctionBodies(text)
  if (bodies.length === 0) {
    // 候选是靠 `_LAZY_INDEX_*` 签名进来的,但没有护栏函数体 ⇒ L2 判不了,
    // 如实登记未判定,不静默算通过。
    undetermined.push(`${rel}: 命中 _LAZY_INDEX 签名但找不到护栏函数定义 ⇒ L2 未判定`)
  }
  for (const fn of bodies) {
    for (const [j, l] of fn.body.entries()) {
      const t = stripPyComment(l)
      if (BARE_EMPTY_RETURN.test(t)) {
        violations.push({ rule: 'L2_SILENT_EMPTY', line: fn.start + j + 1, text: t.trim() })
      }
    }
    const src = fn.body.join('\n')
    for (const m of src.matchAll(OUTCOME_CONSTRUCTION)) {
      const callStart = m.index ?? 0
      const slice = balancedCall(src, callStart)
      const isAllowLiteral = /status\s*=\s*["']searched["']/.test(slice)
      if (!/reason\s*=/.test(slice) && !isAllowLiteral) {
        violations.push({
          rule: 'L2_MISSING_REASON',
          line: fn.start + src.slice(0, callStart).split('\n').length,
          text: slice.split('\n')[0].trim(),
        })
      }
    }
  }
  if (bodies.length > 0) {
    const all = bodies.map((b) => b.body.join('\n')).join('\n')
    const hasSkip = STATUS_NOT_INDEXED.test(all) || STATUS_NOT_INDEXED.test(text)
    const hasEmpty = STATUS_INDEXED_BUT_EMPTY.test(text)
    if (hasSkip !== hasEmpty) {
      violations.push({
        rule: 'L2_STATUS_MERGED',
        line: 1,
        text: `skipped-over-limit=${hasSkip} / empty-after-index=${hasEmpty}`,
      })
    }
  }
  return { violations, undetermined }
}

/** Python 行尾注释剥离(字符串感知由判据本身保证:这里只处理 `#` 在引号外的常见形态)。 */
export function stripPyComment(line) {
  let inS = false
  let quote = ''
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]
    if (inS) {
      if (c === '\\') i += 1
      else if (c === quote) inS = false
      continue
    }
    if (c === '"' || c === "'") {
      inS = true
      quote = c
      continue
    }
    if (c === '#') return line.slice(0, i)
  }
  return line
}

/** 从 `(` 处配平抠出一整个调用文本(抠不出就返回剩余部分,不静默截断)。 */
export function balancedCall(src, start) {
  const open = src.indexOf('(', start)
  if (open < 0) return src.slice(start)
  let depth = 0
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '(') depth += 1
    else if (src[i] === ')') {
      depth -= 1
      if (depth === 0) return src.slice(start, i + 1)
    }
  }
  return src.slice(start)
}

/**
 * 棘轮:staged 档只拦"比该文件 HEAD 自身更多的违规"。
 * 按 (文件, 判据) 分桶 —— 只到文件级的锚点会让人"换个判据名"就逃过去。
 */
export function applyRatchet(perFace, headCounts) {
  /** @type {{rule: string, file: string, line: number, text: string}[]} */
  const blocking = []
  /** @type {{rule: string, file: string, allowed: number, now: number}[]} */
  const ratcheted = []
  const byKey = new Map()
  for (const [file, list] of perFace) {
    for (const v of list) {
      const k = `${file}\u0000${v.rule}`
      byKey.set(k, (byKey.get(k) ?? 0) + 1)
    }
  }
  for (const [k, now] of byKey) {
    const [file, rule] = k.split('\u0000')
    const allowed = headCounts.get(k) ?? 0
    const list = (perFace.get(file) ?? []).filter((v) => v.rule === rule)
    if (now > allowed) blocking.push(...list.map((v) => ({ ...v, file })))
    else if (now > 0) ratcheted.push({ rule, file, allowed, now })
  }
  return { blocking, ratcheted }
}

// ────────────────────────────── 取材层 ──────────────────────────────

/** 枚举被审面的 Python 路径(清单与内容**同面同轮**,不混面)。 */
function listPyPaths(root, face) {
  // worktree / staged 都看索引与磁盘的交集形态:staged 用 `ls-files`(索引),
  // head 用 `ls-tree HEAD`(提交树)—— 拿 HEAD 的清单去配索引内容就是一把错位的尺子。
  const args =
    face === 'head'
      ? ['ls-tree', '-r', '--name-only', '-z', 'HEAD']
      : face === 'staged'
        ? ['ls-files', '-z', '--cached']
        : ['ls-files', '-z']
  const out = gitRaw(args, root)
  if (out.status !== 0) throw new Undetermined(`git ${args[0]} 失败:${out.text.slice(0, 200)}`)
  return new Set(out.text.split('\0').filter((p) => p && SCAN_EXT.test(p)))
}

function readBatch(root, face, paths) {
  const list = [...paths]
  if (face === 'worktree') {
    const m = new Map()
    for (const rel of list) m.set(rel, readWorktreeFile(root, rel))
    return m
  }
  const specs = list.map((rel) => (face === 'head' ? `HEAD:${rel}` : `:${rel}`))
  const batch = catBatch(root, specs)
  const m = new Map()
  list.forEach((rel, k) => m.set(rel, batch.get(specs[k]) ?? null))
  return m
}

/**
 * 跑一轮审计。
 * @returns {{exit: number, lines: string[], blocking: unknown[], ratcheted: unknown[], undetermined: string[], candidates: number}}
 */
export function runCheck(root, face, { strict = false } = {}) {
  /** @type {string[]} */
  const lines = []
  let paths
  try {
    paths = listPyPaths(root, face)
  } catch (e) {
    return { exit: 2, lines: [`❌ 无法判定(exit 2):路径清单取不到 —— ${String(e.message ?? e)}`], blocking: [], ratcheted: [], undetermined: [], candidates: 0 }
  }
  if (paths.size === 0) {
    return { exit: 2, lines: [`❌ 无法判定(exit 2):${FACE_LABEL[face]} 枚举到 0 个 .py 路径 ⇒ 判死(空扫不是通过)`], blocking: [], ratcheted: [], undetermined: [], candidates: 0 }
  }
  let blobs
  try {
    blobs = readBatch(root, face, paths)
  } catch (e) {
    return { exit: 2, lines: [`❌ 无法判定(exit 2):blob 取不到 —— ${String(e.message ?? e)}`], blocking: [], ratcheted: [], undetermined: [], candidates: 0 }
  }
  /** @type {Map<string, {rule: keyof typeof RULES, line: number, text: string}[]>} */
  const perFace = new Map()
  /** @type {string[]} */
  const undetermined = []
  let candidates = 0
  for (const [rel, text] of blobs) {
    if (text === null) continue // 该面里没有这个路径(被删/未跟踪)
    if (!CANDIDATE_SIGNATURE.test(text)) continue
    candidates += 1
    const r = auditText(rel, text)
    if (r.violations.length) perFace.set(rel, r.violations)
    undetermined.push(...r.undetermined)
  }
  if (candidates === 0) {
    return {
      exit: 2,
      lines: [`❌ 无法判定(exit 2):面上没有任何文件含 _LAZY_INDEX 签名 ⇒ 护栏不存在或被搬走而本门看不见,不记绿`],
      blocking: [],
      ratcheted: [],
      undetermined,
      candidates: 0,
    }
  }

  /** @type {Map<string, number>} */
  let headCounts = new Map()
  if (face === 'staged' && !strict) {
    try {
      headCounts = countViolationsAtHead(root, perFace.keys())
    } catch (e) {
      return { exit: 2, lines: [`❌ 无法判定(exit 2):HEAD 棘轮锚点取不到 —— ${String(e.message ?? e)}`], blocking: [], ratcheted: [], undetermined, candidates }
    }
  }
  const { blocking, ratcheted } =
    face === 'staged' && !strict
      ? applyRatchet(perFace, headCounts)
      : { blocking: [...flatten(perFace)], ratcheted: [] }
  // **全量档(HEAD)默认只报数**:本票的交付物就是"清掉 HEAD 上那批旧形态",
  // 而一旦有人只注册门、没带上修复,与任何提交都无关的恒红门只会逼人 --no-verify,
  // 连带废掉全部守门(§12e 同型)。所以:HEAD 档判红必须显式 --strict;
  // 提交链上的真拦截走 --staged 棘轮(只拦"这次把违规加回来/新增")。
  const headReportOnly = face === 'head' && !strict
  for (const v of blocking) {
    lines.push(
      `${headReportOnly ? '⚠️ 存量(HEAD 档只报数,问责请加 --strict)' : '❌'} ${v.file}:${v.line} [${v.rule}] ${RULES[v.rule]} — ${v.text}`,
    )
  }
  for (const r of ratcheted) {
    lines.push(`⚠️ 存量不判红(HEAD 棘轮放过):${r.file} [${r.rule}] HEAD=${r.allowed} 本次=${r.now}`)
  }
  for (const u of undetermined) lines.push(`ℹ️ 未判定:${u}`)
  lines.push(
    `候选文件 ${candidates};判据 ${Object.keys(RULES).length} 条;取材面 ${FACE_LABEL[face]};` +
      `判红 ${headReportOnly ? 0 : blocking.length} / 报数 ${headReportOnly ? blocking.length : 0} / ` +
      `棘轮放过 ${ratcheted.length} / 未判定 ${undetermined.length}`,
  )
  const effective = headReportOnly ? [] : blocking
  return {
    exit: effective.length > 0 ? 1 : 0,
    lines,
    blocking: effective,
    reported: headReportOnly ? blocking : [],
    ratcheted,
    undetermined,
    candidates,
  }
}

function flatten(map) {
  /** @type {{rule: string, file: string, line: number, text: string}[]} */
  const out = []
  for (const [file, list] of map) for (const v of list) out.push({ ...v, file })
  return out
}

/** 同一把尺子量 HEAD:棘轮锚点必须是"该文件 HEAD 自身违规数",不是手工清单。 */
function countViolationsAtHead(root, files) {
  const list = [...files]
  const specs = list.map((rel) => `HEAD:${rel}`)
  const batch = catBatch(root, specs)
  /** @type {Map<string, number>} */
  const counts = new Map()
  for (const rel of list) {
    const text = batch.get(`HEAD:${rel}`)
    if (text === undefined || text === null) continue // HEAD 里没有该文件 ⇒ 锚点 0(新增文件没有存量)
    for (const v of auditText(rel, text).violations) {
      const k = `${rel}\u0000${v.rule}`
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
  }
  return counts
}

// ────────────────────────────── 自检(构造面) ──────────────────────────────

const GOOD = `
_LAZY_INDEX_LOCAL_MS_PER_FILE: Final[float] = 0.541  # 实测 2026-09-27,真仓 1,200 文件样本
_LAZY_INDEX_EMBED_BATCH_BUDGET: Final[int] = 300
# policy:一次懒索引最多 300 批上游调用

async def _lazy_index_and_research(indexer: object, path: str) -> LazyIndexOutcome:
    probe = probe_code_file_count(root, limit=limits.by_index_hard_cap + 1)
    if not root.is_dir():
        return LazyIndexOutcome(results=[], status="skipped-not-a-dir", reason="路径不是目录")
    if not guard.allow:
        return LazyIndexOutcome(results=[], status=guard.status, reason=guard.reason, guard=guard)
    return LazyIndexOutcome(results=r, status="searched", reason=None)
`

const BAD_LITERAL = GOOD + '\n_LAZY_INDEX_MAX_FILES = 2000\n'
const BAD_NO_EVIDENCE = GOOD.replace('  # 实测 2026-09-27,真仓 1,200 文件样本', '')
const BAD_SILENT = GOOD.replace(
  'return LazyIndexOutcome(results=[], status="skipped-not-a-dir", reason="路径不是目录")',
  'return []',
)
const BAD_MISSING_REASON = GOOD.replace(
  'return LazyIndexOutcome(results=[], status=guard.status, reason=guard.reason, guard=guard)',
  'return LazyIndexOutcome(results=[], status=guard.status, guard=guard)',
)
const BAD_SATURATED = GOOD + '\ndef other(indexer, root):\n    return len(indexer._collect_code_files(root))\n'
const BAD_NO_PROBE = GOOD.replace('probe = probe_code_file_count(root, limit=limits.by_index_hard_cap + 1)', 'pass')
const BAD_STATUS_MERGED = GOOD.replace('status="skipped-not-a-dir"', 'status="no-result"')

/** @type {[string, string, (keyof typeof RULES)[]][]} 名字 / 文本 / 期望命中的判据 */
const CASES = [
  ['good: 现行交付形态必须 0 违规', GOOD, []],
  ['bad: 裸阈值字面量回来了', BAD_LITERAL, ['L1_BARE_THRESHOLD']],
  ['bad: 成本常量没有实测/策略标记', BAD_NO_EVIDENCE, ['L1_NO_EVIDENCE']],
  ['bad: 超限静默 return []', BAD_SILENT, ['L2_SILENT_EMPTY']],
  ['bad: 拒绝不带 reason', BAD_MISSING_REASON, ['L2_MISSING_REASON']],
  ['bad: 又去读饱和分母', BAD_SATURATED, ['L3_SATURATED_DENOM']],
  ['bad: 没接有界探测出口', BAD_NO_PROBE, ['L3_NO_PROBE']],
  ['bad: 两种空状态被合并', BAD_STATUS_MERGED, ['L2_STATUS_MERGED']],
]

export function selfTest() {
  let pass = 0
  let fail = 0
  for (const [name, text, expect] of CASES) {
    const { violations } = auditText('app/services/probe_sample.py', text)
    const got = new Set(violations.map((v) => v.rule))
    const missing = expect.filter((r) => !got.has(r))
    const extra = [...got].filter((r) => !expect.includes(r))
    if (missing.length === 0 && extra.length === 0) {
      pass += 1
      console.log(`  ✅ ${name}`)
    } else {
      fail += 1
      console.log(`  ❌ ${name} 缺=[${missing}] 多=[${extra}] 实得=[${[...got]}]`)
    }
  }
  // 反向对照:候选文件里没有 _LAZY_INDEX 签名 ⇒ 不得进射程(不误报)
  const noSig = auditText('app/other.py', 'def f():\n    return 1\n')
  if (noSig.violations.length === 0 && noSig.undetermined.length === 0) {
    pass += 1
    console.log('  ✅ 反例:无签名的普通文件不进射程')
  } else {
    fail += 1
    console.log(`  ❌ 反例失败:${JSON.stringify(noSig)}`)
  }
  // 棘轮:HEAD 已有 1 条、本次仍是 1 条 ⇒ 不判红;变 2 条 ⇒ 判红
  const perFace = new Map([['a.py', [{ rule: 'L1_BARE_THRESHOLD', line: 3, text: 'x' }]]])
  const sameAsHead = applyRatchet(perFace, new Map([['a.py\u0000L1_BARE_THRESHOLD', 1]]))
  const grew = applyRatchet(
    new Map([['a.py', [{ rule: 'L1_BARE_THRESHOLD', line: 3, text: 'x' }, { rule: 'L1_BARE_THRESHOLD', line: 9, text: 'y' }]]]),
    new Map([['a.py\u0000L1_BARE_THRESHOLD', 1]]),
  )
  const swapped = applyRatchet(
    new Map([['a.py', [{ rule: 'L2_SILENT_EMPTY', line: 3, text: 'x' }]]]),
    new Map([['a.py\u0000L1_BARE_THRESHOLD', 1]]),
  )
  if (sameAsHead.blocking.length === 0 && grew.blocking.length === 2 && swapped.blocking.length === 1) {
    pass += 2
    console.log('  ✅ 棘轮:存量等量放过 / 变多必拦 / 换判据不抵扣额度')
  } else {
    fail += 2
    console.log(
      `  ❌ 棘轮判据不等值:sameAsHead=${sameAsHead.blocking.length} grew=${grew.blocking.length} swapped=${swapped.blocking.length}`,
    )
  }
  // 判据输入必须来自注册表本身(§22c/守门 120 那一型:名单是死表而自检全用自己造的串)
  for (const r of Object.keys(RULES)) {
    if (!CASES.some(([, , exp]) => exp.includes(r))) {
      fail += 1
      console.log(`  ❌ 判据 ${r} 没有任何一条用例的期望值取自它 ⇒ 名单腐烂无人喊`)
    } else {
      pass += 1
    }
  }
  console.log(`\nself-test: ${pass} 通过 / ${fail} 失败`)
  return fail === 0 ? 0 : 1
}

// ────────────────────────────── 端到端自测(临时 git 仓) ──────────────────────────────

async function selfTestE2E() {
  const scratch = mkScratch('lazy-guard-e2e')
  let fail = 0
  try {
    const { execFileSync } = await import('node:child_process')
    const git = (args) => execFileSync('git', ['-c', 'safe.directory=*', ...args], { cwd: scratch, windowsHide: true })
    git(['init', '-q'])
    git(['config', 'user.email', 't@example.invalid'])
    git(['config', 'user.name', 't'])
    const rel = 'app/services/mcp_server.py'
    const { mkdirSync, writeFileSync } = await import('node:fs')
    mkdirSync(path.join(scratch, 'app/services'), { recursive: true })
    writeFileSync(path.join(scratch, rel), GOOD, 'utf8')
    git(['add', '--', rel])
    git(['commit', '-q', '-m', 'init'])
    // 三面同形:HEAD 干净 ⇒ 全量绿
    const headRun = runCheck(scratch, 'head')
    if (headRun.exit !== 0) {
      fail += 1
      console.log(`  ❌ E2E-a:HEAD 干净却判红 — ${headRun.lines.join(' | ')}`)
    } else console.log('  ✅ E2E-a:HEAD 干净 ⇒ 全量档绿')
    // 索引里塞进坏形态 ⇒ staged 档必红(棘轮锚点 HEAD=0)
    writeFileSync(path.join(scratch, rel), BAD_LITERAL, 'utf8')
    git(['add', '--', rel])
    const stagedRun = runCheck(scratch, 'staged')
    if (stagedRun.exit !== 1) {
      fail += 1
      console.log(`  ❌ E2E-b:索引里塞进裸字面量却没判红 — ${stagedRun.lines.join(' | ')}`)
    } else console.log('  ✅ E2E-b:索引里的回潮形态必判红')
    // 反向对照:盘上更坏但**没 git add** ⇒ staged 档不得被磁盘牵着判红
    writeFileSync(path.join(scratch, rel), BAD_SILENT, 'utf8')
    const stagedAgain = runCheck(scratch, 'staged')
    if (stagedAgain.blocking.some((b) => b.rule === 'L2_SILENT_EMPTY')) {
      fail += 1
      console.log('  ❌ E2E-c:未暂存的磁盘内容被算进了索引档')
    } else console.log('  ✅ E2E-c:磁盘在途改动不影响索引档')
    // 无提交 ⇒ 判死而不是记绿
    const scratch2 = mkScratch('lazy-guard-empty')
    const { spawnSync } = await import('node:child_process')
    spawnSync('git', ['-c', 'safe.directory=*', 'init', '-q'], { cwd: scratch2 })
    const noCommit = runCheck(scratch2, 'head')
    rmScratch(scratch2)
    if (noCommit.exit !== 2) {
      fail += 1
      console.log(`  ❌ E2E-d:没有提交却没判死(exit=${noCommit.exit})`)
    } else console.log('  ✅ E2E-d:取不到被审面 ⇒ exit 2 无法判定')
  } finally {
    rmScratch(scratch)
  }
  console.log(fail === 0 ? '\nE2E self-test: 全部通过' : `\nE2E self-test: ${fail} 条失败`)
  return fail === 0 ? 0 : 1
}

// ────────────────────────────── CLI ──────────────────────────────

async function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  if (argv.includes('--self-test-e2e')) return selfTestE2E()
  const ri = argv.indexOf('--root')
  const root = ri >= 0 && argv[ri + 1] ? path.resolve(argv[ri + 1]) : DEFAULT_ROOT
  if (ri >= 0 && !argv[ri + 1]) {
    console.error('❌ --root 需要一个目录参数')
    return 2
  }
  const { face, error } = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree') })
  if (error) {
    console.error(`❌ 无法判定(exit 2):${error}`)
    return 2
  }
  try {
    assertRepoRoot(root, 'check-lazy-index-guard')
  } catch (e) {
    console.error(`❌ 无法判定(exit 2):${String(e.message ?? e)}`)
    return 2
  }
  const res = runCheck(root, face, { strict: argv.includes('--strict') })
  for (const l of res.lines) console.log(l)
  if (res.exit === 0) console.log(`✅ 懒索引护栏对账通过(${Object.keys(RULES).length} 条判据,候选 ${res.candidates} 个文件)`)
  if (res.exit === 1)
    console.log('提示:出路是**改代码** —— 恢复派生阈值 / 给拒绝分支补 reason / 改走有界探测。不得为消红放宽判据。')
  return res.exit
}

export const __test__ = {
  RULES,
  auditText,
  applyRatchet,
  balancedCall,
  evidenceContext,
  guardFunctionBodies,
  stripPyLayout: null,
  stripPyComment,
  runCheck,
  samples: { GOOD, BAD_LITERAL, BAD_NO_EVIDENCE, BAD_SILENT, BAD_MISSING_REASON, BAD_SATURATED, BAD_NO_PROBE, BAD_STATUS_MERGED },
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exit(code)
    })
    .catch((e) => {
      console.error(`❌ 脚本自身异常(exit 2):${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
