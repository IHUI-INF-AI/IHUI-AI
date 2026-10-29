#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 字面量阶梯 / 布尔政策束的「同值两份」对账(G-816013)。
 *
 * 拦的是本仓与上游同型的那一格:**同一个事实的字面量在第二个文件被重述一遍**。
 * 它没有编译期症状 —— 两份 `[800, 2_000, 4_000]` 各自合法、typecheck / lint / 单测全绿,
 * 直到有人只改其中一份(改退避节奏的人不会想到另一个文件也写着同一条策略),
 * 两条链路从此分叉而账面什么都看不出来。上游实测正是这个形状:
 * `[250, 1_000, 3_000] as const` 逐字两份,而第二份的注释还写着「按 XX 的既定模式」
 * —— **用散文代替引用,是这一型最稳的藏身处**。
 *
 * 三条判据(口径同 70/77/83/98/101/103/118):
 *  - **DL** 数值字面量阶梯(3..8 个整数字面量)归一后的**值序列**出现在 ≥2 个文件 ⇒ 红。
 *         同名不同值**刻意不判红**(那是两种业务档,合并等于把一条策略推给另一条链路),
 *         只进 `sameNameDiffValue` 计数并逐条报名 —— 这条反向锁防的是「门逼人把不同策略并成一个」。
 *  - **DB** 连续 ≥2 对 `key: true|false` 的**布尔政策束**,归一(排序,书写次序无关)后同串出现在
 *         ≥2 个文件,**且束中每个键都在被审面以布尔属性声明过**(= 本仓自有词汇)⇒ 红。
 *         为什么要这一维:`fs.rm({recursive,force})`、ioredis `{enableReadyCheck,lazyConnect}`、
 *         `spawn({shell,windowsHide})` 这类**第三方 API 的调用选项**在仓内出现 N 次是常态,
 *         把它们算成债会让门一上线就红几百处 —— 与改动无关的恒红门只会逼人 `--no-verify`,
 *         连带废掉链上全部守门(§12e)。判据因此只认「这个事实是我们自己声明过的」:
 *         键集在被审面有布尔属性声明 ⇒ 它有唯一归属,该收成一份;没有 ⇒ 未判定并点名,不判红。
 *  - **修复出口只有一条**:把字面量提到**一处**具名声明,其余处引用它。
 *         本门**不设行内豁免、不建基线清单**(登记表必然腐烂,§4 对 `RN_ONLY_BRAND_KEYS` 记过同型),
 *         存量走「该组在 HEAD 面已涉及的文件数」差值棘轮,所以存量不会变成人人跳门。
 *
 * 三态绝不并桶: 内容取不到 / 面旗矛盾 / 枚举到 0 个候选 ⇒ **exit 2 未判定**,不冒红也不记绿;
 * `--strict` 下有未判定即 exit 2(拒绝出具合格证)。
 *
 * 手动: `node scripts/check-duplicate-policy-literals.mjs [--staged|--worktree|--json|--strict|--self-test]`
 * **尚未接线**(不在 `scripts/guardian-runner.mjs`,也不在 pre-commit 链)—— 接线与定级由主会话单写者裁。
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { maskCommentsStringsAndRegex } from './lib/code-mask.mjs'
import {
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
  Undetermined,
  FACE_LABEL,
} from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,不得写死盘符) */
const ROOT = resolve(HERE, '..')

export const SELF_SKIP = 'HUSKY_SKIP_DUPLICATE_POLICY_LITERALS'
const GIT_TIMEOUT = 120000
const SCAN_DIRS = ['apps', 'packages', 'sdks']
const SRC_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|mts)$/
/** 叙述面与生成物不计:测试 / 夹具 / E2E / 声明文件 / 生成产物 / 构建产物 */
const EXCLUDE =
  /(\.test\.|\.spec\.|__tests__|[/\\]tests[/\\]|[/\\]e2e[/\\]|node_modules|[/\\]dist[/\\]|[/\\]build[/\\]|\.gen\.|\.d\.ts|[/\\]\.next[/\\])/

/** 阶梯的量纲:至少 3 个整数字面量(上游五张表全是 3..4 档;两档太容易撞上巧合同值)。 */
const LADDER_MIN = 3
const LADDER_MAX = 8

/** 等差序号表不进判红集合但仍须报名:归一函数用它打前缀,调用方按前缀分流。 */
/** 形状不属阶梯(等差序号表 / 非单调)的桶标记:报名不判红。 */
const NOT_LADDER_MARK = 'shape:'

/**
 * 阶梯的**形状**:必须是严格递增且**非等差**。
 * 为什么不判另外两类:
 *  - **等差**(`[0,1,2]`、`[1,2,3,4]`、`[0..6]`)在本仓是序号表 / 星期表 / 步骤索引,
 *    两个文件各写一份是巧合而不是"同一事实的第二份真相";判红等于指挥人去合并无关代码
 *    (AGENTS:假阳比漏报更贵)。退避/阈值阶梯的定义性形状是**倍数推进**(250/1000/3000、5/10/20/40)。
 *  - **非单调**(`[250,1000,300]`)是一条队列或映射表,不是"档表"。
 * 代价如实登记:真·等差阈值表(如 `[1000, 2000, 3000]`)会被摘出判红集合,
 * 所以必须**逐组报名**(`nonLadderShapes` / `nonLadderGroups`),不得读成"已确认没有"。
 */
export function isLadderShape(nums) {
  if (nums.length < LADDER_MIN || nums.length > LADDER_MAX) return false
  if (!nums.every((n) => Number.isInteger(n) && n >= 0)) return false
  for (let i = 1; i < nums.length; i++) if (nums[i] <= nums[i - 1]) return false
  const deltas = nums.slice(1).map((v, i) => v - nums[i])
  return deltas.some((d) => d !== deltas[0])
}

/**
 * 数值阶梯:`NAME = [ 1_000, 2, 3 ]`(带 `as const` / `readonly number[]` 标注都吃)。
 * 判据面已遮注释与字符串,所以注释里举例的同串不会被读成字面量(反向锁 LD-6)。
 */
const LADDER_RE =
  /(?:const|let|var)\s*([A-Za-z0-9_]+)\s*(?::[^=\n]{0,60})?=\s*\[\s*([0-9_][0-9_,\s]*)\]/g

/** 布尔政策束:连续的 `key: true|false`(≥2 对);跨行空白与换行都吃。 */
const BUNDLE_RE =
  /([A-Za-z0-9_]+)\s*:\s*(true|false)(?:\s*,\s*[A-Za-z0-9_]+\s*:\s*(?:true|false))+/g

/**
 * 「请求选项束」的语境判据(票面要的是**选项**,不是任何一份布尔字面量):
 * 束必须 (a) 是某个调用的实参,且被调名含 opt/option/config/init/request/defaults/create/update… ;或
 * (b) 是某个具名声明的右值,且名字含 OPT/OPTION/CONFIG/DEFAULT/POLICY/SETTINGS/INIT/REQUEST/PARAM ;或
 * (c) 出现在名字含 Default/Option/Config/Setting/Init/Request 的函数体的 `return { … }` 里。
 * 三条都不成立 ⇒ 那是**响应形状 / React 状态初值**(`return { ok: true, dispatched: false }`、
 * `useState({ failed: false, submitting: false })`),它属守门 134/135 那一族,本门只报数不判红。
 * 为什么不干脆全判:全判会在 HEAD 面红几十处与"选项束"无关的形状,存量红只会逼人 `--no-verify`,
 * 连带废掉链上全部守门(§12e);而假阳的代价是"指使人去改没坏的东西"(AGENTS 记过多次)。
 */
const OPTION_CALLEE_RE = /(opt|option|config|init|request|defaults?|create|update|patch|put|post|fetch|call|send|build)[a-z]*\s*\($/i
const OPTION_NAME_RE = /(OPT|OPTION|CONFIG|DEFAULT|POLICY|SETTINGS|INIT|REQUEST|PARAM)/
const OPTION_FN_RE = /(Default|Option|Config|Setting|Init|Request|Polic(y|ies))/
/** 往回看的窗口:足以盖住 `export async function buildDefaultSettings(...): Settings {\n  return {` */
const CONTEXT_BACK_WINDOW = 420

/** 本仓自有词汇:某键在被审面里以布尔属性声明过(`key: boolean` / `key?: boolean`,含 `readonly`)。 */
const BOOL_DECL_RE = /^[ \t]*([A-Za-z0-9_]+)\??\s*:\s*(?:readonly\s+)?boolean\b/gm

/* ------------------------------------------------------------------ 归一化 */

/**
 * `[800, 2_000, 4_000]` → `"800,2000,4000"`;等差序号表 → `"seq:..."`(报名不判红);
 * 含非整数 / 档数不合量纲 → null(不是字面量阶梯)。
 */
export function normalizeLadder(rawNumbers) {
  const parts = rawNumbers
    .split(',')
    .map((s) => s.trim().replace(/_/g, ''))
    .filter((s) => s.length > 0)
  if (parts.length < LADDER_MIN || parts.length > LADDER_MAX) return null
  if (!parts.every((p) => /^\d+$/.test(p))) return null
  const seq = parts.join(',')
  return isLadderShape(parts.map(Number)) ? seq : NOT_LADDER_MARK + seq
}

/** 束归一:键值对**排序**后连拼 ⇒ 书写顺序不影响判等;键重复(同一对象层写两遍同键)⇒ null 交人工。 */
export function normalizeBundle(text) {
  const pairs = [...text.matchAll(/([A-Za-z0-9_]+)\s*:\s*(true|false)/g)]
    .map((m) => `${m[1]}=${m[2]}`)
    .sort()
  if (pairs.length < 2) return null
  const keys = pairs.map((p) => p.split('=')[0])
  if (new Set(keys).size !== keys.length) return null
  return pairs.join('&')
}

/** 字符偏移 → 行号(1 起)。遮罩面等长,所以直通原文件行号。 */
export function lineAt(view, idx) {
  let line = 1
  for (let i = 0; i < idx && i < view.length; i++) if (view[i] === '\n') line++
  return line
}

/* ------------------------------------------------------------------ 判据核心 */

/** 单文件 → 候选清单(阶梯 / 束)。解析不到的形状一律不出现在清单里 ⇒ 由上层按"零候选"判死。 */
/**
 * 束所在**对象字面量的开括号**位置:从束往前扫,遇到 `}` 加深、`{` 减深,
 * 找"深度回到 0 之前的那一个 `{`" —— 也就是包住这个键值对的最近一层对象。
 * 窗口内配不平(对象起点在窗口外 / 文件形状怪)⇒ null ⇒ 调用方按"看不见"处理,不猜。
 */
export function enclosingBrace(view, idx) {
  let depth = 0
  for (let i = idx - 1; i >= 0 && i >= idx - CONTEXT_BACK_WINDOW; i--) {
    const c = view[i]
    if (c === '}') depth++
    else if (c === '{') {
      if (depth === 0) return i
      depth--
    }
  }
  return null
}

/**
 * 束的语境分类(纯函数,构造面可证):`option` = 请求选项束(进判红射程);
 * `other` = 响应形状 / 状态初值(只报数);`unparsed` = 对象起点在窗口外/配不平(未判定,不冒红也不记绿)。
 * 只看**遮注释后的代码面**往回一窗,因为"这个字面量喂给谁"就写在它前面;
 * 再远的调用链属跨函数数据流,本门承认看不见。
 */
export function bundleContext(view, idx) {
  const brace = enclosingBrace(view, idx)
  if (brace === null) return 'unparsed'
  const tail = view.slice(Math.max(0, brace - CONTEXT_BACK_WINDOW), brace).replace(/[ \t]+$/,'')
  const after = view.slice(brace + 1, idx).replace(/^[^:]*:/, '')
  void after
  // (a) 调用实参:`foo({` —— 被调名含选项族词干
  if (OPTION_CALLEE_RE.test(tail + '(')) return 'option'
  // (b) 具名右值:`const NAME[: T] = {`
  const named = tail.match(/(?:const|let|var)\s*([A-Za-z0-9_]+)\s*(?::[^=]{0,60})?=\s*$/)
  if (named) return OPTION_NAME_RE.test(named[1]) ? 'option' : 'other'
  // (c) `return {` / `=> {`:取最近的函数名
  if (/(?:return|=>)$/.test(tail)) {
    const fns = tail.match(/(?:function\s*[A-Za-z0-9_]*|(?:const|let)\s+[A-Za-z0-9_]+\s*=\s*(?:async\s*)?\()/g)
    const last = fns && fns.length ? fns[fns.length - 1] : ''
    const name = (last.match(/function\s+([A-Za-z0-9_]+)/) || [])[1] || (last.match(/(?:const|let)\s+([A-Za-z0-9_]+)/) || [])[1] || ''
    return OPTION_FN_RE.test(name) ? 'option' : 'other'
  }
  return 'other'
}

export function harvest(code) {
  const face = maskCommentsStringsAndRegex(code)
  const ladders = []
  const nonLadder = []
  for (const m of face.matchAll(LADDER_RE)) {
    const seq = normalizeLadder(m[2])
    if (seq === null) continue
    const item = { name: m[1], seq: seq.replace(NOT_LADDER_MARK, ''), line: lineAt(face, m.index) }
    ;(seq.startsWith(NOT_LADDER_MARK) ? nonLadder : ladders).push(item)
  }
  const bundles = []
  for (const m of face.matchAll(BUNDLE_RE)) {
    const norm = normalizeBundle(m[0])
    if (norm === null) continue
    bundles.push({
      norm,
      keys: norm.split('&').map((p) => p.split('=')[0]),
      line: lineAt(face, m.index),
      context: bundleContext(face, m.index),
    })
  }
  return { ladders, bundles, nonLadder }
}

/**
 * 自有词汇全集:键在被审面某处以布尔属性声明过。
 * 用遮注释面 —— 注释里写的 `key: boolean` 是**叙述**,不是被代码承认的词汇;
 * 拿叙述当词汇,门就会给"只在散文里出现过"的束发合格证。
 */
export function declaredBooleanKeys(codes) {
  const keys = new Set()
  for (const code of codes) {
    if (typeof code !== 'string') continue
    for (const m of maskCommentsStringsAndRegex(code).matchAll(BOOL_DECL_RE)) keys.add(m[1])
  }
  return keys
}

/**
 * 纯判据(镜像测试主战场):给定 file→harvest 与自有词汇集,出三态结论。
 * 返回 { reds, undetermined, sameNameDiffValue, counts }。
 */
export function judge({ harvests, ownKeys }) {
  let nonOption = 0
  let unparsed = 0
  let nonLadderTotal = 0
  const byLadder = new Map()
  const byNonLadder = new Map()
  const byBundle = new Map()
  const nameToSeqs = new Map()

  for (const [file, h] of harvests) {
    for (const l of h.ladders) {
      if (!byLadder.has(l.seq)) byLadder.set(l.seq, [])
      byLadder.get(l.seq).push({ file, name: l.name, line: l.line })
      if (!nameToSeqs.has(l.name)) nameToSeqs.set(l.name, new Map())
      const per = nameToSeqs.get(l.name)
      if (!per.has(l.seq)) per.set(l.seq, [])
      per.get(l.seq).push(`${file}:${l.line}`)
    }
    // 形状不属阶梯(等差/非单调):报名不判红(与真等差阈值形状不可分,判红的代价是指使人合并无关代码)
    for (const a of h.nonLadder || []) {
      nonLadderTotal++
      if (!byNonLadder.has(a.seq)) byNonLadder.set(a.seq, [])
      byNonLadder.get(a.seq).push({ file, line: a.line })
    }
    for (const b of h.bundles) {
      if (b.context === 'unparsed') {
        unparsed++
        continue
      }
      if (b.context !== 'option') {
        nonOption++
        continue
      }
      const own = b.keys.every((k) => ownKeys.has(k))
      if (!byBundle.has(b.norm)) byBundle.set(b.norm, { sites: [], own })
      const g = byBundle.get(b.norm)
      g.sites.push({ file, line: b.line })
      g.own = g.own && own
    }
  }

  const reds = []
  const undetermined = []
  const sameNameDiffValue = []
  const counts = {
    ladderKeys: byLadder.size,
    bundleKeys: byBundle.size,
    foreignBundles: 0,
    nonOptionBundles: nonOption,
    unparsedBundles: unparsed,
    nonLadderShapes: nonLadderTotal,
  }

  for (const [seq, sites] of byLadder) {
    const files = [...new Set(sites.map((s) => s.file))]
    if (files.length >= 2) {
      reds.push({
        kind: 'DL',
        key: seq,
        files,
        sites,
        why: `数值字面量阶梯 [${seq}] 在 ${files.length} 个文件各写一份 —— 同一事实的第二份真相,改一份忘另一份即分叉;提到一处具名声明并由其余引用`,
      })
    }
  }
  // 同名不同值:反向锁的报名面。刻意不判红 —— 那会指使人去合并两条不同的业务档。
  for (const [name, seqMap] of nameToSeqs) {
    if (seqMap.size < 2) continue
    sameNameDiffValue.push(`${name} ⇒ ${[...seqMap.keys()].map((s) => `[${s}]`).join(' vs ')}`)
  }

  // 形状不属阶梯的跨文件组:必须**报名**(只给计数的话,下一个人无法证明这一格被看过)。
  const nonLadderGroups = []
  for (const [seq, sites] of byNonLadder) {
    const files = [...new Set(sites.map((s) => s.file))]
    if (files.length < 2) continue
    nonLadderGroups.push({ seq, files: files.slice(0, 6) })
  }

  for (const [norm, g] of byBundle) {
    const files = [...new Set(g.sites.map((s) => s.file))]
    if (files.length < 2) continue
    if (!g.own) {
      counts.foreignBundles++
      undetermined.push(
        `DB 未判定(束中键未在本仓声明为布尔属性 ⇒ 第三方 API 调用选项,不计红): {${norm.replace(/&/g, ', ')}} 跨 ${files.length} 文件 ⇒ ${files.slice(0, 4).join(', ')}`,
      )
      continue
    }
    reds.push({
      kind: 'DB',
      key: norm,
      files,
      sites: g.sites,
      why: `布尔政策束 {${norm.replace(/&/g, ', ')}} 在 ${files.length} 个文件各写一份,而这些键都在本仓声明过(= 自有事实)⇒ 该收成一份出口`,
    })
  }

  return { reds, undetermined, sameNameDiffValue, nonLadderGroups, counts }
}

/**
 * 差值棘轮(组级,按"该组涉及的文件数"):红只对**本次把文件数推上去**的那一组生效。
 * 判据刻意抽成纯函数,免得"是不是存量"这一问随仓库瞬时状态漂。
 */
export function isNewerThanAnchor({ stagedFileCount, anchorFileCount }) {
  return stagedFileCount > anchorFileCount
}

/* ------------------------------------------------------------------ 取材 */

export function isSourcePath(p) {
  const n = p.replace(/\\/g, '/')
  return SRC_EXT.test(n) && !EXCLUDE.test(n) && SCAN_DIRS.some((d) => n.startsWith(d + '/'))
}

/** 各面的路径清单(head=ls-tree / staged=diff --cached / worktree=ls-files)。清单与内容**同面同轮**。 */
export function listFace(root, face) {
  if (face === 'head')
    return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z', '--', ...SCAN_DIRS], root, {
      timeout: GIT_TIMEOUT,
    })
      .split('\0')
      .filter(isSourcePath)
  if (face === 'worktree')
    return gitRaw(['ls-files', '-z', '--', ...SCAN_DIRS], root, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(isSourcePath)
  return gitRaw(
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z', '--', ...SCAN_DIRS],
    root,
    { timeout: GIT_TIMEOUT },
  )
    .split('\0')
    .filter(isSourcePath)
}

/** 按面取正文:head=`HEAD:<p>` / staged=索引 blob / worktree=磁盘(仅人工)。 */
export function readFace(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(root, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

const EMPTY_NOTE =
  '枚举到 0 个候选源文件 —— 空扫不记绿:要么是判据的清单/扩展名漂了,要么这一面真的没有受审面'

export function analyze(root, face) {
  let effFace = face
  let fellBack = false
  let paths = listFace(root, face)
  if (face === 'staged' && paths.length === 0) {
    // 文档/注册表类提交结构上不带源码文件 ⇒ 判"无法判定"就是替每一次无关提交挡路(口径同 135)。
    effFace = 'head'
    paths = listFace(root, effFace)
    fellBack = true
  }
  if (paths.length === 0) throw new Undetermined(`${FACE_LABEL[effFace]}: ${EMPTY_NOTE}`)

  const sources = readFace(root, effFace, paths)
  const harvests = new Map()
  const undetermined = []
  const codes = []
  for (const [file, code] of sources) {
    if (code === null) {
      undetermined.push(`${file}(内容取不到)`)
      continue
    }
    codes.push(code)
    harvests.set(file, harvest(code))
  }
  const totalCandidates = [...harvests.values()].reduce((n, h) => n + h.ladders.length + h.bundles.length, 0)
  if (totalCandidates === 0) throw new Undetermined(`${FACE_LABEL[effFace]}: ${EMPTY_NOTE}`)

  const result = judge({ harvests, ownKeys: declaredBooleanKeys(codes) })
  result.undetermined.push(...undetermined)
  result.legacyGroups = []
  result.filesScanned = sources.size
  result.candidates = totalCandidates
  result.face = effFace
  result.fellBack = fellBack

  if (effFace === 'staged') {
    // 锚点面:同一组在 HEAD 面涉及几个文件 —— 只重读"红组涉及的那些路径",不全面重扫。
    const involved = [...new Set(result.reds.flatMap((r) => r.files))]
    const headCodes = readFace(root, 'head', involved)
    const headHarvests = new Map()
    for (const [f, code] of headCodes) {
      if (code === null) {
        result.undetermined.push(`${f}(锚点面 HEAD 取不到 —— 该组按未判定处理,不冒红)`)
        continue
      }
      headHarvests.set(f, harvest(code))
    }
    const anchor = judge({ harvests: headHarvests, ownKeys: declaredBooleanKeys([...headCodes.values()].filter((c) => typeof c === 'string')) })
    const anchorByKey = new Map()
    for (const r of anchor.reds) anchorByKey.set(`${r.kind}|${r.key}`, new Set(r.files).size)
    const kept = []
    const legacy = []
    for (const r of result.reds) {
      const n = anchorByKey.get(`${r.kind}|${r.key}`) ?? 0
      if (isNewerThanAnchor({ stagedFileCount: new Set(r.files).size, anchorFileCount: n })) kept.push(r)
      else legacy.push(r)
    }
    result.legacyGroups = legacy
    result.ratchetedOut = legacy.length
    result.reds = kept
  }
  return result
}

/**
 * 退出码(三态不并桶):
 *  - 0 通过(或全量档"有红但只报数")
 *  - 1 提交链档(--staged)有新红;或 `--strict` 下有红
 *  - 2 `--strict` 下有未判定(拒绝出具合格证)
 * 全量档判 HEAD 的存量红**不改退出码**:它与"本次提交改了什么"无关,当场判红就是一台恒红门,
 * 唯一结局是逼人 `--no-verify` 连带废掉链上全部守门(§12e);要逐格问责跑 `--strict`。
 */
export function decideExit({ reds, undetermined, strict, mode }) {
  if (strict && undetermined.length) return 2
  const judging = mode === 'staged' || strict
  if (judging && reds.length) return 1
  return 0
}

/* ------------------------------------------------------------------ 输出 */

function render(res) {
  const lines = []
  lines.push(
    `判定面=${FACE_LABEL[res.face]}${res.fellBack ? '(暂存集为空/无源码 ⇒ 回退 HEAD 全量,已如实点名)' : ''} ` +
      `扫描 ${res.filesScanned} 文件 · 候选 ${res.candidates} 处`,
  )
  lines.push(
    `  阶梯值序列 ${res.counts.ladderKeys} 组 · 政策束 ${res.counts.bundleKeys} 组 · 第三方词汇束(未判定,只报数)${res.counts.foreignBundles} · ` +
      `非选项束布尔字面量(响应形状/状态初值,不在射程)${res.counts.nonOptionBundles} · 语境配不平(未判定)${res.counts.unparsedBundles} · 形状不属阶梯${res.counts.nonLadderShapes}`,
  )
  if (res.nonLadderGroups && res.nonLadderGroups.length) {
    lines.push(`  形状不属阶梯(等差序号/非单调)跨文件(刻意不判红:与真等差阈值表形状不可分;要判需逐条人裁,另计一票):`)
    for (const g of res.nonLadderGroups) lines.push(`    · [${g.seq}] ⇒ ${g.files.join(', ')}`)
  }
  if (res.sameNameDiffValue.length) {
    lines.push(`  同名不同值(反向锁,刻意不判红)${res.sameNameDiffValue.length} 个名字:`)
    for (const s of res.sameNameDiffValue) lines.push(`    · ${s}`)
  }
  if (res.reds.length) {
    const mode = res.fellBack ? 'full' : res.face
    lines.push(
      `  ${mode === 'staged' || strict ? '❌ 判红' : '⚠️ 存量红(全量档只报数;问责跑 --strict,提交链档只拦新增)'} ${res.reds.length} 组(同值两份即红,修复出口=提到一处并由其余引用):`,
    )
    for (const r of res.reds) {
      lines.push(`    [${r.kind}] ${r.key}`)
      for (const s of r.sites) lines.push(`        ${s.file}:${s.line}`)
      lines.push(`        ${r.why}`)
    }
  }
  const legacy = res.legacyGroups || []
  if (legacy.length) {
    lines.push(`  存量组(该组在 HEAD 面已成立,只报数不判红)${legacy.length} 组:`)
    for (const r of legacy) lines.push(`    · [${r.kind}] ${r.key} ⇒ ${r.files.slice(0, 4).join(', ')}`)
  }
  if (res.ratchetedOut) lines.push(`  棘轮放过 ${res.ratchetedOut} 组(锚点=${'该组在 HEAD 面已涉及的文件数'})`)
  if (res.undetermined.length) {
    lines.push(`  ⚠️ 未判定 ${res.undetermined.length} 条(逐条点名,绝不静默成"看起来全绿"):`)
    for (const u of res.undetermined.slice(0, 40)) lines.push(`    · ${u}`)
    if (res.undetermined.length > 40) lines.push(`    · …其余 ${res.undetermined.length - 40} 条(--json 面全量)`)
  }
  if (!res.reds.length && !res.undetermined.length) lines.push('  ✅ 无同值重述(候选存在而分组唯一)')
  return lines.join('\n')
}

/* ------------------------------------------------------------------ 自检(构造面,零副作用) */

function selfTest() {
  let ran = 0
  let fail = 0
  const t = (name, cond) => {
    ran++
    // cond 必须是**已求值的布尔**;函数会当场记红(AGENTS:恒绿断言比没有断言更糟)。
    if (typeof cond === 'function') {
      fail++
      console.log(`  ❌ ${name}:cond 是函数 ⇒ 断言从未求值(应写成 (() => {...})())`)
      return
    }
    if (cond !== true) {
      fail++
      console.log(`  ❌ ${name}`)
    } else console.log(`  ✅ ${name}`)
  }

  // LD-1 同值两份 ⇒ 必点名(DL)
  const twoFiles = new Map([
    ['apps/a/x.ts', harvest('const LADDER_MS = [250, 1_000, 3_000] as const\n')],
    ['apps/b/y.ts', harvest('const RETRY_MS: readonly number[] = [250, 1000, 3000]\n')],
  ])
  const r1 = judge({ harvests: twoFiles, ownKeys: new Set() })
  t('LD-1 同值阶梯跨两文件必点名 DL', r1.reds.length === 1 && r1.reds[0].kind === 'DL' && r1.reds[0].files.length === 2)

  // LD-2 一份出口 + 其余引用 ⇒ 不判红
  const oneHome = new Map([
    ['packages/shared/src/ui/ladders.ts', harvest('export const BACKOFF_MS = [250, 1000, 3000] as const\n')],
    ['apps/a/x.ts', harvest('import { BACKOFF_MS } from "@ihui/shared"\nconst used = BACKOFF_MS\n')],
    ['apps/b/y.ts', harvest('import { BACKOFF_MS } from "@ihui/shared"\nconst used = BACKOFF_MS\n')],
  ])
  const r2 = judge({ harvests: oneHome, ownKeys: new Set() })
  t('LD-2 唯一出口 + 两处引用 ⇒ 零红(收成本身要让门闭嘴)', r2.reds.length === 0 && r2.counts.ladderKeys === 1)

  // LD-3 同名不同值 ⇒ 不判红,但必须报名(反向锁)
  const diffValue = new Map([
    ['apps/a/x.ts', harvest('const RETRY_DELAYS = [500, 1000, 2000]\n')],
    ['apps/b/y.ts', harvest('const RETRY_DELAYS = [800, 2000, 4000]\n')],
  ])
  const r3 = judge({ harvests: diffValue, ownKeys: new Set() })
  t('LD-3 同名不同值不得判红(否则门逼人合并两条业务档)', r3.reds.length === 0)
  t('LD-3b 同名不同值必须报名', r3.sameNameDiffValue.length === 1 && r3.sameNameDiffValue[0].includes('RETRY_DELAYS'))

  // LD-4 第三方词汇束(语境是选项,但键未在本仓声明)⇒ 未判定,不判红
  const foreign = new Map([
    ['apps/a/x.ts', harvest('const REDIS_OPTIONS = { enableReadyCheck: true, lazyConnect: false }\n')],
    ['apps/b/y.ts', harvest('const REDIS_OPTIONS = { enableReadyCheck: true, lazyConnect: false }\n')],
  ])
  const r4 = judge({ harvests: foreign, ownKeys: new Set(['booleanOnlyKeyNotHere']) })
  t('LD-4 第三方调用选项束跨文件 ⇒ 未判定而非判红', r4.reds.length === 0 && r4.undetermined.length === 1 && r4.counts.foreignBundles === 1)

  // LD-4b 同串的**响应形状**(语境 other)连未判定都不算,只计数
  const asResult = new Map([
    ['apps/a/x.ts', harvest('function h() {\n  return {\n    enableReadyCheck: true,\n    lazyConnect: false,\n  }\n}\n')],
    ['apps/b/y.ts', harvest('function k() {\n  return {\n    enableReadyCheck: true,\n    lazyConnect: false,\n  }\n}\n')],
  ])
  const r4b = judge({ harvests: asResult, ownKeys: new Set() })
  t('LD-4b 响应形状的同串 ⇒ 不判红也不计未判定,单独计数(三态不并桶)', r4b.reds.length === 0 && r4b.undetermined.length === 0 && r4b.counts.nonOptionBundles === 2)

  // LD-5 自有词汇束 ⇒ 红(键序不同也算同一束)
  const ownSources = new Map([
    ['apps/a/x.ts', 'const PROVIDER_OPTIONS = { allowDisabledPreferredProvider: true, requirePreferredProvider: true }\n'],
    ['apps/b/y.ts', 'const REFRESH_OPTIONS = { requirePreferredProvider: true, allowDisabledPreferredProvider: true }\n'],
    ['packages/types/src/z.ts', 'interface Q {\n  allowDisabledPreferredProvider: boolean\n  requirePreferredProvider: boolean\n}\n'],
  ])
  const r5 = judge({
    harvests: new Map([...ownSources].map(([f, src]) => [f, harvest(src)])),
    ownKeys: declaredBooleanKeys([...ownSources.values()]),
  })
  t('LD-5 自有词汇政策束(键序不同也算同一束)跨文件 ⇒ 红', r5.reds.length === 1 && r5.reds[0].kind === 'DB')
  // LD-5b 声明住在注释里 ⇒ 不算自有词汇(叙述不承认词汇,否则门给"只在散文里出现过"的束发合格证)
  const r5b = judge({
    harvests: new Map([...ownSources].map(([f, src]) => [f, harvest(f === 'packages/types/src/z.ts' ? '// allowDisabledPreferredProvider: boolean\n// requirePreferredProvider: boolean\nexport const q = 1\n' : src)])),
    ownKeys: declaredBooleanKeys(['// allowDisabledPreferredProvider: boolean\n// requirePreferredProvider: boolean\nexport const q = 1\n']),
  })
  t('LD-5b 键只在注释里出现 ⇒ 不判红,走未判定', r5b.reds.length === 0 && r5b.undetermined.length === 1)

  // LD-6 注释里的阶梯不计(判据面先遮注释);用倍数推进的形状,免得"不计"来自量纲而非遮罩
  const commented = new Map([
    ['apps/a/x.ts', harvest('const A = [10, 100, 1000]\n')],
    ['apps/b/y.ts', harvest('// 上游写的是 const B = [10, 100, 1000]\nexport const z = 1\n')],
  ])
  const r6 = judge({ harvests: commented, ownKeys: new Set() })
  t('LD-6 注释里逐字重述不得计成第二份真相', r6.reds.length === 0 && r6.counts.ladderKeys === 1)

  // LD-7 两元素数组不算阶梯(量纲)
  const r7 = normalizeLadder('5, 10')
  t('LD-7 两档不算阶梯', r7 === null)
  t('LD-7b 三档算并归一去下划线', normalizeLadder('250, 1_000, 3_000') === '250,1000,3000')
  t('LD-7c 含变量/表达式不算', normalizeLadder('250, OTHER, 3000') === null)

  // LD-8 束归一与次序无关
  t('LD-8 束归一次序无关', normalizeBundle('b: true, a: false') === normalizeBundle('a: false, b: true'))
  t('LD-8b 单对不算束', normalizeBundle('a: false') === null)
  t('LD-8c 同层重复键交人工(null ⇒ 不猜)', normalizeBundle('a: true, a: false') === null)

  // LD-9 差值棘轮只认"文件数被推上去"
  t('LD-9 存量组(锚点 2 / 现 2)不判红', isNewerThanAnchor({ stagedFileCount: 2, anchorFileCount: 2 }) === false)
  t('LD-9b 新增第三份(锚点 2 / 现 3)判红', isNewerThanAnchor({ stagedFileCount: 3, anchorFileCount: 2 }) === true)
  t('LD-9c 锚点取不到(0)按新增判,不得静默放过', isNewerThanAnchor({ stagedFileCount: 2, anchorFileCount: 0 }) === true)

  // LD-10 同文件两处同值不算跨文件重复(不判红)
  const sameFile = new Map([['apps/a/x.ts', harvest('const A1 = [7, 8, 9]\nconst A2 = [7, 8, 9]\n')]])
  const r10 = judge({ harvests: sameFile, ownKeys: new Set() })
  t('LD-10 同文件重述不计跨文件红(那一型由 lint 管,本门只治跨文件)', r10.reds.length === 0)

  // LD-11 路径筛:叙述面与生成物不进射程
  t('LD-11 测试面排除', isSourcePath('apps/a/x.test.ts') === false)
  t('LD-11b 生成物排除', isSourcePath('apps/miniapp-taro/src/i18n/generated/remote-locales.gen.ts') === false)
  t('LD-11c 声明文件排除', isSourcePath('packages/types/src/a.d.ts') === false)
  t('LD-11d 源码进射程', isSourcePath('apps/api/src/utils/a.ts') === true)
  t('LD-11e 面外目录不进射程', isSourcePath('deploy/x.mjs') === false)

  // LD-12 空清单必须判死,不得记绿
  let dead = ''
  try {
    judge({ harvests: new Map([['apps/a/x.ts', { ladders: [], bundles: [] }]]), ownKeys: new Set() })
  } catch (e) {
    dead = String(e && e.message)
  }
  t('LD-12 judge 本身不判死(判死在 analyze 层,由镜像端到端锁)', dead === '')
  t('LD-12b 判死文案存在且不含"通过"字样', EMPTY_NOTE.includes('空扫不记绿'))

  // LD-14 等差序号表与阶梯在形状上不可分 ⇒ 摘出判红但仍报名(反向锁之二)
  t('LD-14 [1,2,3,4] 等差不算阶梯', normalizeLadder('1, 2, 3, 4') === NOT_LADDER_MARK + '1,2,3,4')
  t('LD-14b [250,1000,3000] 倍数推进算阶梯', normalizeLadder('250, 1_000, 3_000') === '250,1000,3000')
  t('LD-14c 非单调([250,1000,300])不算阶梯(它是一条队列不是档表,报名不判红)', normalizeLadder('250, 1000, 300') === NOT_LADDER_MARK + '250,1000,300')
  const arith = new Map([
    ['apps/a/x.ts', harvest('const STEPS = [0, 1, 2, 3] as const\n')],
    ['apps/b/y.ts', harvest('const DAYS: readonly number[] = [0, 1, 2, 3]\n')],
  ])
  const r14 = judge({ harvests: arith, ownKeys: new Set() })
  t('LD-14d 等差跨文件 ⇒ 零红', r14.reds.length === 0)
  t('LD-14e 但必须逐组报名(只给计数就等于没人看过)', r14.nonLadderGroups.length === 1 && r14.nonLadderGroups[0].files.length === 2)

  // LD-15 语境:同一份布尔字面量,喂给"选项"才判红,喂给"响应/状态"不判
  const ctxOption = maskCommentsStringsAndRegex('export const DEFAULT_SETTINGS: S = {\n  auditEnabled: true,\n  allowDangerous: false,\n}')
  t('LD-15 具名 DEFAULT_* 右值 ⇒ option', bundleContext(ctxOption, ctxOption.indexOf('auditEnabled')) === 'option')
  const ctxState = maskCommentsStringsAndRegex('const [s] = useState({ failed: false, submitting: false })\n')
  t('LD-15b useState 初值 ⇒ other(不属本门射程)', bundleContext(ctxState, ctxState.indexOf('failed')) === 'other')
  const ctxReturn = maskCommentsStringsAndRegex('async function buildDefaultSettings(): Promise<S> {\n  return {\n    auditEnabled: true,\n    allowDangerous: false,\n  }\n}\n')
  t('LD-15c buildDefault* 的 return ⇒ option(函数名给出处)', bundleContext(ctxReturn, ctxReturn.indexOf('auditEnabled')) === 'option')
  const ctxPlainReturn = maskCommentsStringsAndRegex('function handler(): R {\n  return {\n    ok: true,\n    dispatched: false,\n  }\n}\n')
  t('LD-15d 普通 handler 的 return ⇒ other(响应形状归守门 134/135)', bundleContext(ctxPlainReturn, ctxPlainReturn.indexOf('ok:')) === 'other')
  const ctxFar = maskCommentsStringsAndRegex('x'.repeat(600) + 'const A = {\n  p: true,\n  q: false,\n}\n')
  t('LD-15e 对象起点在窗口外 ⇒ unparsed(未判定,不得静默放过)', bundleContext(ctxFar, ctxFar.length - 8) !== 'option')

  // LD-16 配不平的束计入未判定,不混进通过
  const unparsedMap = new Map([['apps/a/x.ts', { ladders: [], nonLadder: [], bundles: [{ norm: 'p=true&q=false', keys: ['p', 'q'], line: 1, context: 'unparsed' }] }]])
  const r16 = judge({ harvests: unparsedMap, ownKeys: new Set(['p', 'q']) })
  t('LD-16 语境判不出的束 ⇒ 计数且不判红', r16.reds.length === 0 && r16.counts.unparsedBundles === 1)

  // LD-13 退出码三态不并桶
  t('LD-13 无红无未判定 ⇒ 0', decideExit({ reds: [], undetermined: [], strict: false, mode: 'staged' }) === 0)
  t('LD-13b 提交链档有新增红 ⇒ 1', decideExit({ reds: [{ files: ['a', 'b'] }], undetermined: [], strict: false, mode: 'staged' }) === 1)
  t('LD-13c 全量档(HEAD)有红也只报数 ⇒ 0 —— 与本次提交无关的红就是恒红门(§12e)', decideExit({ reds: [{ files: ['a', 'b'] }], undetermined: [], strict: false, mode: 'head' }) === 0)
  t('LD-13d --strict 下有红 ⇒ 1(问责档真判红)', decideExit({ reds: [{ files: ['a', 'b'] }], undetermined: [], strict: true, mode: 'head' }) === 1)
  t('LD-13e 默认档有未判定不改变退出码,但必须打印(render 锁)', decideExit({ reds: [], undetermined: ['u'], strict: false, mode: 'staged' }) === 0)
  t('LD-13f --strict 下有未判定 ⇒ exit 2 拒绝出合格证', decideExit({ reds: [], undetermined: ['u'], strict: true, mode: 'staged' }) === 2)

  console.log(`\n自检:${ran - fail}/${ran} 通过${fail ? ` — 失败 ${fail} 条` : ''}`)
  return fail === 0 ? 0 : 1
}

/* ------------------------------------------------------------------ CLI */

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(selfTest())

  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  const strict = argv.includes('--strict')
  const json = argv.includes('--json')
  const sel = selectFace({ staged, worktree, def: 'head' })
  if (sel.error) {
    console.log(`❌ ${sel.error}`)
    process.exit(2)
  }
  let res
  try {
    res = analyze(ROOT, sel.face)
  } catch (e) {
    if (e instanceof Undetermined) {
      console.log(`❌ 无法判定:${e.message}`)
      process.exit(2)
    }
    throw e
  }
  const rc = decideExit({ reds: res.reds, undetermined: res.undetermined, strict, mode: res.fellBack ? 'full' : res.face })
  if (json) {
    process.stdout.write(JSON.stringify({ ...res, rc, skip: SELF_SKIP }, null, 2) + '\n')
  } else {
    console.log(render(res))
    if (strict && res.undetermined.length) console.log('  (--strict:有未判定 ⇒ 拒绝出具合格证,exit 2)')
  }
  process.exit(rc)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  normalizeLadder,
  normalizeBundle,
  harvest,
  judge,
  declaredBooleanKeys,
  isNewerThanAnchor,
  isSourcePath,
  listFace,
  readFace,
  analyze,
  decideExit,
  SELF_SKIP,
  SCAN_DIRS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
