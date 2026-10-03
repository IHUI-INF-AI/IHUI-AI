#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‍‍‌‌‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‍‌‌‌‌‍‍‌‌‌‌‌‍‍‍‌‌‍‍‍‌‌‌‌‌‍‍‍‌‍‍‌‌‍‌‍‍‍‌‌‍‍‍‌‍‍‌‌‍‍‌‌‌‌‍‍‍‍‍‌‍‍‍‌‌‍‍‌‌‍‍‌‌‌‌‍‍‍‍‌‍‌‌‌‍‌‌‌‌‌‍‍️‍‍‌‌‌‌‍‌‍‍‍‌‌‍‍‍‌��‍‍‌‌‍‌‌‌⁠

// 守门:loadState 四档投影的**防漂移**对账(G-759 补票,2026-10-03 立)
//
// ── 为什么需要这道门(缺口是查实的,不是假想) ──────────────────────────────
// G-759 四步(`8f8d013fdb` / `1bf72d1eaf` / `395b57266a` / `51d7f82831`)给四个学习/画像模块
// 补了 `loadState` 的四档对外投影。落地当日现读的三条事实:
//   ① `git grep -ln "loadState|load_state|get_status" HEAD -- scripts` = **0 命中**
//      ⇒ 提交链里**零覆盖**,"四族又漂移"这件事没有任何机器会红。
//   ② 守门 151(`check-agent-status-vocabulary-parity.mjs`)的 Python 侧锚点只有
//      `dag_scheduler.py` / `mcp_server.py` / `agent_orchestrator.py` —— **不含
//      `_load_lifecycle.py`,更不含这四族**;它的判据是"状态词汇的跨语言等值",
//      不是"投影出口的键形状",两件事不互相覆盖。
//   ③ 姊妹票 G-748 已警告过同一缺口(原文大意:G-748 只在 pytest 里加了断言,
//      **不在提交链** ⇒ 新模块再写一遍 `finally: loaded=True` 不会红)。
// ⇒ 现状是"四族已经按统一形状落地,但下一次漂移无人拦"。本门就是那道拦。
//
// ── 判据(输入按被审面现读,不 import、不执行被审实现) ────────────────────────
//   **LV1 四档词汇零散落**:字面量 `"never_tried"` / `"retry_backoff"` / `"gave_up"`
//     只允许住在 `_load_lifecycle.py` **一个文件**里(那才是四档的唯一实现)。
//     其余 services 面下任何 .py 逐字写出这三档 ⇒ 红,并点名该文件。
//     为什么必须只这一维:**两处算同一件事必漂移**是本仓记过最多次的失效型
//     (见 `_load_lifecycle.py` 头注:数值常量与状态词汇"只有本模块一份")。
//     散落一份 = 那个文件的下一次改动只改一处 ⇒ 四档语义分叉而两端都自洽。
//   **LV2 五族投影对称性**:五个模块的对外状态出口 `get_status()` 必须
//     ① 含 `loadState` 键;② 该键的值**必须来自共享出口**
//     (`state_label(...)` 或 `LoadRecord.state_label()` 的**调用形态**,允许经
//     局部变量传递 —— 范本 `ab_test_tracker` 就是 `load_state = _load_state_label(...)`
//     再 `"loadState": load_state`),**不得硬编码四档字面量**。
//     键集按族分档(这是本门最容易写歪的一条,故写进代码常量而不是散文):
//       - 单例族(`ab_test_tracker` / `meta_learner` / `federated_learner`):
//         `loaded` / `loadFailures` / `loadState` 三键。
//       - per-key 族(`memory_decay` / `user_profile`):`loadState` / `allKeysLoaded`
//         / `maxLoadFailures` / `loadStateByUser` / `gaveUpKeys` / `trackedKeys`
//         / `loadedKeys`。
//     ⚠️ **per-key 族刻意没沿用 `loaded` / `loadFailures` 键名**(同名不同义是最坏的
//     下游陷阱:单例族的 `loaded` 是"**我这一次**读到没有",per-key 族的
//     `allKeysLoaded` 是"**所有 user_id** 都读到没有",两者在"该值随哪个主体变化"上
//     根本不同)。所以本门**不许**要求 per-key 族有 `loaded` 键 —— 反向对照④
//     (`check-load-state-projection-parity.test.mjs`)就是钉这一条:判据自身写歪
//     成"要求 per-key 族有 loaded"时,那一格必须仍然是绿的。
//
// ── 三态不并桶 ────────────────────────────────────────────────────────────
// 输入取不到 / `get_status` 解析不到 / 投影字典里连 `return {...}` 都配平不到
// ⇒ **未判定 exit 2**(既不冒红也绝不记绿)。"看不见"绝不能记成通过 ——
// 一台永远喊未判定的门和一台瞎掉的门在账面上是一样的。
//
// ── 遮罩(判据必须先遮自己的散文) ─────────────────────────────────────────
// LV1 的判定面遮 **Python 三引号 docstring + `#` 行注释**。为什么连 docstring 一起遮:
// `memory_decay` / `user_profile` 的 `get_status` docstring 里**逐字写着**
// `never_tried < loaded < retry_backoff < gave_up` 这条 severity 序 —— 那是说明文字,
// 不是第二份实现。门若开始咬自己的散文,后人的唯一出路是把说明删掉(守门 131/70 同型)。
// 反向也钉死:**真代码里的字面量一律判红**,docstring 遮罩不是把尺子遮瞎。
// 等长是硬约束(命中要能落回原文行号);已知边界如实登记:未闭合的三引号按"遮到文件尾"处理
// (多算方向,不是漏判)。
//
// ── 定级:**warn 起步,不是 blocking** ──────────────────────────────────────
// 理由照抄守门 156(`check-selftest-registrant-evaluates.mjs`)头注那段教训:
// "当场把它们全判红就是一台与任何提交都无关的恒红门,唯一结局是各会话 `--no-verify`
// 连带废掉链上全部守门(AGENTS §12f/§12e 同型)"。本门今天在 HEAD 面是**绿的**
// (LV1 命中文件恰为 `_load_lifecycle.py` 一个;LV2 五族全部合规),但"绿的存量"
// 与"未来某次改动的红"是两回事:接成 blocking 的那一刻,每一个**与本票无关**的提交
// 都要额外跑一遍本门,而本门的输入面是 `services/**/*.py` 全域(311 个 .py / 7.9MB),
// 慢门 + 恒红风险 = 逼人跳门。**先 warn 起步、跑满一个周期拿到读数,再由人裁是否升 blocking。**
// 升 blocking 的条件写在下面 `--strict` 说明里,不由本门自行决定(见报告第 ⑧ 项)。
//
// ── 取材面(与本仓其它守门同口径) ─────────────────────────────────────────
// 缺省判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 只作人工逃生舱;
// 取材走 `lib/face-reader`(绝对路径 git / 显式 stdio / 字节分箱),与守门 70/77/83/98
// 同一份实现,**不读工作树的半编辑态**(并发会话在飞时那不是判定面)。
// ⚠️ 本门**不实现** `--staged` 的差值棘轮:LV1 的"散落"与 LV2 的"缺键"都是
// **存量即红**的性质(不像"新增副本"可以只拦新增),而 warn 档本就不阻塞,
// 棘轮在此只会多一处会腐烂的分支。存量与新增在报告里同列,不靠棘轮遮盖。

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 本门在 runner 条目里注册的应急跳过名(现值以 scripts/guardian-runner.mjs 为准)。 */
export const SELF_SKIP = 'HUSKY_SKIP_LOAD_STATE_PROJECTION_PARITY'

/** LV2 的被审模块清单:五族 + 各自的族形(键集判据按族分档,不是按模块逐个写死)。 */
export const FAMILIES = [
  {
    module: 'ab_test_tracker',
    kind: 'singleton',
    required: ['loaded', 'loadFailures', 'loadState'],
    note: '范本(G-702 起就有 loaded/loadFailures,G-759 补第三键 loadState)',
  },
  { module: 'meta_learner', kind: 'singleton', required: ['loaded', 'loadFailures', 'loadState'] },
  { module: 'federated_learner', kind: 'singleton', required: ['loaded', 'loadFailures', 'loadState'] },
  {
    module: 'memory_decay',
    kind: 'per-key',
    required: [
      'loadState',
      'allKeysLoaded',
      'maxLoadFailures',
      'loadStateByUser',
      'gaveUpKeys',
      'trackedKeys',
      'loadedKeys',
    ],
    note: '刻意不含 loaded/loadFailures(同名不同义是最坏的下游陷阱)',
  },
  {
    module: 'user_profile',
    kind: 'per-key',
    required: [
      'loadState',
      'allKeysLoaded',
      'maxLoadFailures',
      'loadStateByUser',
      'gaveUpKeys',
      'trackedKeys',
      'loadedKeys',
    ],
  },
]

/** LV1 的唯一允许文件 + 扫描面(与服务目录同形;见头注「覆盖边界」)。 */
export const LIFECYCLE_FILE = 'apps/ai-service/app/services/_load_lifecycle.py'
export const SCAN_PREFIX = 'apps/ai-service/app/services'
export const SCAN_EXT = '.py'

/** 四档字面量(判据引用的是**字面量形态**,不是标识符 —— `llm_retry_backoff` 那类参数名不是档位)。 */
export const TIER_LITERALS = ['never_tried', 'retry_backoff', 'gave_up']

/** LV2 的共享出口锚点(改名必须与被审面同笔,否则判"解析不到" ⇒ 未判定,不猜)。 */
export const SHARED_EXITS = ['state_label', '_load_state_label']

/**
 * 共享出口的**调用形态**正则。只认 `state_label(` / `_load_state_label(` / `.state_label(`,
 * 不认"名字出现在体内" —— 守门 151 SV4③ 已经吃过这一课:docstring 里逐字写着出口名字
 * 而体内并不接,按"提到"判就完全绿灯。这里进一步只认**括号紧邻**的调用形态。
 */
export const SHARED_EXIT_CALL_RE = /(?:\bstate_label|_load_state_label|\.\s*state_label)[ \t]*\(/

// ── 遮罩层(Python 语义;等长、保留换行,命中可回映射原文行号) ──────────────

/**
 * 遮 Python 的 `#` 行注释 + 三引号 docstring/续写字符串,**保留普通字符串字面量**。
 *
 * 为什么不用 `maskPythonCommentFace`(守门 151 的那一档):它按 JS 词法走,不认识 Python
 * 三引号 ⇒ 住在 docstring 里的 marker 仍会被解析。那对守门 151 是"多算不是漏判"的可接受
 * 边界(它判的是广告面),而**本门判的是"四档字面量散落"** —— `memory_decay` 与
 * `user_profile` 的 `get_status` docstring 里逐字写着 `never_tried < loaded <
 * retry_backoff < gave_up`。不遮 docstring,本门第一天就咬自己的散文。
 * 为什么不用 `maskCommentsAndStrings`:它连普通字符串一起抹掉,而 LV1 要判的**就是**
 * 字符串字面量 ⇒ 整层抹掉等于没收这把尺子。
 * 词法仍走仓内那台分词器(`maskedSpans`)做普通字符串/注释的区间识别,本函数只补
 * Python 三引号这一档 —— 分词器不许出现第二台。
 */
export function maskPyNarrative(src) {
  if (typeof src !== 'string') return ''
  const s = src.replace(/\r\n/g, '\n')
  const out = s.split('')
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k++) if (out[k] !== '\n') out[k] = ' '
  }
  let i = 0
  while (i < s.length) {
    const c = s[i]
    const triple = s.slice(i, i + 3)
    if (triple === '"""' || triple === "'''") {
      // 未闭合 ⇒ 遮到文件尾(多算方向:不漏判)
      const close = s.indexOf(triple, i + 3)
      const end = close < 0 ? s.length : close + 3
      blank(i, end)
      i = end
      continue
    }
    if (c === '#') {
      let j = i
      while (j < s.length && s[j] !== '\n') j += 1
      blank(i, j)
      i = j
      continue
    }
    if (c === '"' || c === "'") {
      // 普通字符串:整段跳过(不遮内容 —— LV1 判的就是它),但**不吞**三引号起点
      let j = i + 1
      while (j < s.length) {
        if (s[j] === '\\') {
          j += 2
          continue
        }
        if (s[j] === c) break
        if (s[j] === '\n') break // 未闭合的单行串:不越行
        j += 1
      }
      i = Math.min(j + 1, s.length)
      continue
    }
    i += 1
  }
  return out.join('')
}

/**
 * LV1 单文件判定(纯函数):面内出现任一四档**字面量** ⇒ 该文件持有第二份词汇。
 * @returns {{hits: Array<{tier:string,line:number}>}}
 */
export function judgeTierLiterals(rawSrc) {
  const s = rawSrc.replace(/\r\n/g, '\n')
  const face = maskPyNarrative(s)
  const hits = []
  for (const tier of TIER_LITERALS) {
    // 引号包裹才算字面量:`"never_tried"` / `'never_tried'`。裸词(注释/docstring/
    // `llm_retry_backoff` 这类参数名)不计 —— 那是说明或另一个域的量,不是四档的第二份。
    const re = new RegExp(`(['"])${tier}\\1`, 'g')
    for (const m of face.matchAll(re)) {
      hits.push({ tier, line: s.slice(0, m.index).split('\n').length })
    }
  }
  return { hits: hits.sort((a, b) => a.line - b.line) }
}

/**
 * LV1 聚合(纯函数):持有字面量的文件集必须**恰为** `{_load_lifecycle.py}`。
 * 零命中与多命中都不记绿:零命中说明四档被改名/搬走(本门失明),多命中即散落。
 */
export function judgeTierScatter(candidates) {
  const violations = []
  const holders = []
  for (const c of candidates) {
    const { hits } = judgeTierLiterals(c.src)
    if (hits.length === 0) continue
    holders.push({ path: c.path, hits })
    if (c.path === LIFECYCLE_FILE) continue
    violations.push(
      `LV1 四档字面量散落:${c.path}(第 ${hits.map((h) => `${h.line}:${h.tier}`).join(' / ')} 行逐字写出 ` +
        `"${hits[0].tier}" —— 四档的唯一实现是 ${LIFECYCLE_FILE};这里再写一份,下一次改动只改一处 ⇒ 四档语义分叉而两端都自洽)`,
    )
  }
  if (holders.length === 0) {
    violations.push(
      `LV1 四档字面量在 ${SCAN_PREFIX} 下一处都扫不到(唯一实现 ${LIFECYCLE_FILE} 也读不到字面量)⇒ ` +
        `本门失明(档位被改名/搬走/改成常量派生),不记绿`,
    )
  } else if (!holders.some((h) => h.path === LIFECYCLE_FILE)) {
    violations.push(
      `LV1 唯一实现 ${LIFECYCLE_FILE} 体内扫不到四档字面量(改用常量派生或搬走了)⇒ 本门失明,不记绿`,
    )
  }
  return { violations, holders }
}

// ── LV2:投影键集与共享出口对账 ───────────────────────────────────────────

/** 取某个 Python 函数的函数体(按缩进);解析不到返回 null(改名/搬家 ⇒ 上层判未判定)。 */
export function pythonFunctionBody(src, fnName) {
  const s = src.replace(/\r\n/g, '\n')
  const lines = s.split('\n')
  const head = new RegExp(`^[ \\t]*(?:async[ \\t]+)?def[ \\t]+${fnName}[ \\t]*[(]`)
  const at = lines.findIndex((l) => head.test(l))
  if (at < 0) return null
  const indent = /^[ \t]*/.exec(lines[at])[0].length
  const body = []
  for (let i = at + 1; i < lines.length; i++) {
    const l = lines[i]
    if (l.trim() === '') continue
    if (/^[ \t]*/.exec(l)[0].length <= indent) break
    body.push(l)
  }
  if (body.length === 0) return null
  return body.join('\n')
}

/** 括号配平用的结构面:遮罩后再把字符串体清空(保留定界符),免得串里的 `{}` 干扰配平。 */
function structureFace(src) {
  const face = maskPyNarrative(src)
  const out = face.split('')
  let i = 0
  while (i < face.length) {
    const c = face[i]
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < face.length && face[j] !== c && face[j] !== '\n') j += 1
      for (let k = i + 1; k < Math.min(j, face.length); k++) if (out[k] !== '\n') out[k] = ' '
      i = j + 1
      continue
    }
    i += 1
  }
  return out.join('')
}

/** `return {...}` 那一段字典的原文;配平不到 ⇒ null(上层判未判定)。 */
export function returnedDictLiteral(bodySrc) {
  const face = structureFace(bodySrc)
  const m = /\breturn[ \t\r\n]*\{/.exec(face)
  if (!m) return null
  const open = face.indexOf('{', m.index)
  let depth = 0
  for (let i = open; i < face.length; i++) {
    const c = face[i]
    if (c === '{') depth += 1
    else if (c === '}') {
      depth -= 1
      if (depth === 0) return bodySrc.slice(open, i + 1)
    }
  }
  return null
}

/**
 * 字典字面量的顶层键(只看 depth 0 的那一层;嵌套字典的键不并入)。
 *
 * 判定面**必须先遮注释与 docstring**,而**保留字符串内容** —— 本函数要的正是键名,
 * 那是字符串。少了遮罩这一步会在真仓上当场翻车(实测):`meta_learner.get_status`
 * 的投影字典里有一行注释 `# …loaded=False ∧ loadFailures>0 是"读不到"(瞬时故障…)`,
 * 注释里那对引号会被当成键的定界符,状态机就此错位,后面**每一个真键都被吞掉**
 * (`loaded` / `allKeysLoaded` 相继消失,而门把"少键"读成"未判定")——
 * 一道门因为读了散文而对自己要判的东西半盲,比不遮更坏。
 */
export function dictTopKeys(dictSrc) {
  const face = maskPyNarrative(dictSrc)
  const keys = []
  let depth = 0
  let i = 0
  let expectKey = true
  while (i < face.length) {
    const c = face[i]
    if (c === '{' || c === '[' || c === '(') {
      depth += 1
      i += 1
      expectKey = depth === 1
      continue
    }
    if (c === '}' || c === ']' || c === ')') {
      depth -= 1
      i += 1
      expectKey = false
      continue
    }
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < face.length && face[j] !== c && face[j] !== '\n') j += 1
      const body = dictSrc.slice(i + 1, j)
      if (depth === 1 && expectKey) {
        const after = face.slice(j + 1)
        if (/^[ \t]*:/.test(after)) keys.push(body)
      }
      i = j + 1
      continue
    }
    if (c === ',') {
      expectKey = depth === 1
      i += 1
      continue
    }
    if (c === ':') {
      expectKey = false
      i += 1
      continue
    }
    i += 1
  }
  return keys
}

/**
 * 取某键的值表达式原文(按括号配平切到该层的 `,` 或闭括号);取不到 ⇒ null。
 *
 * 定位用 `maskPyNarrative`(遮注释/docstring、**留字符串**),不用 `structureFace` ——
 * 后者按设计把字符串体清空,而本函数要找的键名**就是**字符串,在清空面上匹配等于
 * 找一把被自己抹掉的尺子(实测:真仓五族一律返回 null,五族全落"未判定")。
 * 配平也走同一个遮罩面(串里的 `(` / `,` 不参与计数),取值从**原文**切,内容逐字保留。
 */
export function dictValueExpr(dictSrc, key) {
  const face = maskPyNarrative(dictSrc)
  const km = new RegExp(`(['"])${key}\\1[ \t]*:`).exec(face)
  if (!km) return null
  const from = km.index + km[0].length
  let depth = 0
  for (let i = from; i < face.length; i++) {
    const c = face[i]
    if (c === '{' || c === '[' || c === '(') depth += 1
    else if (c === '}' || c === ']' || c === ')') {
      if (depth === 0) return dictSrc.slice(from, i).trim()
      depth -= 1
    } else if (c === ',' && depth === 0) return dictSrc.slice(from, i).trim()
  }
  return dictSrc.slice(from).trim()
}

/** 函数体里的 `name = <rhs>` 赋值表(注释已遮;多行 rhs 只取首行 —— 共享出口调用必在首行)。 */
function localAssignments(bodySrc) {
  const face = maskPyNarrative(bodySrc)
  const table = new Map()
  for (const line of face.split('\n')) {
    const m = /^[ \t]*([A-Za-z_][A-Za-z0-9_]*)[ \t]*(?::[^=\n]+)?=[ \t]*(\S.*)$/.exec(line)
    if (!m) continue
    if (!table.has(m[1])) table.set(m[1], [])
    table.get(m[1]).push(m[2].trim())
  }
  return table
}

const IDENT_RE = /[A-Za-z_][A-Za-z0-9_]*/g

/**
 * LV2 共享出口解析(纯函数):`loadState` 的值表达式是否**最终**来自共享出口的调用形态。
 * 允许经局部变量传递(范本 `ab_test_tracker`:`load_state = _load_state_label(...)` ⇒
 * `"loadState": load_state`),所以按赋值表做有界传递闭包。
 * 三态由返回的 `why` 区分:`call` 合规 / `literal` 硬编码字面量(红) /
 * `unresolved` 追不到底(未判定,不记绿也不冒红)。
 */
export function resolveSharedExit(bodySrc, expr, opts = {}) {
  const table = opts.assignments ?? localAssignments(bodySrc)
  const depth = opts.depth ?? 6
  const seen = opts.seen ?? new Set()
  const e = String(expr ?? '').trim()
  if (e === '') return { ok: false, why: 'unresolved', chain: [], detail: '值表达式为空' }
  if (SHARED_EXIT_CALL_RE.test(e)) return { ok: true, why: 'call', chain: [e.replace(/\s+/g, ' ')] }
  // 硬编码四档字面量(任何一种引号、单独或参与表达式)⇒ 明确违规,不再往下追
  const asLiteral = new RegExp(`(['"])(?:${TIER_LITERALS.join('|')}|loaded)\\1`).test(e)
  if (asLiteral) return { ok: false, why: 'literal', chain: [e.replace(/\s+/g, ' ')] }
  if (depth <= 0 || seen.has(e)) return { ok: false, why: 'unresolved', chain: [e], detail: '传递闭包超界' }
  const names = [...new Set(e.match(IDENT_RE) ?? [])].filter((n) => table.has(n))
  for (const n of names) {
    if (seen.has(n)) continue
    seen.add(n)
    for (const rhs of table.get(n)) {
      const r = resolveSharedExit(bodySrc, rhs, { assignments: table, depth: depth - 1, seen })
      if (r.ok) return { ok: true, why: 'call', chain: [e, `${n} = ${rhs}`.replace(/\s+/g, ' '), ...r.chain] }
      // ⚠️ `literal` 必须**向上传播**,不能只让 `ok` 传播(本门第一版栽在这里):
      // 只传 ok 的话,`load_state = "loaded"` 这一格会走完循环落到 `unresolved`,
      // 于是"藏在局部变量里的硬编码"被读成"追不到出口"(未判定)而不是红 ——
      // 而"没判"被读成"判过了"正是本仓最高频的失效型。字面量是**定论**不是线索:
      // 链上任何一环写死四档,这一格就一定违规,不必等别的分支出结果。
      if (r.why === 'literal')
        return { ok: false, why: 'literal', chain: [e, `${n} = ${rhs}`.replace(/\s+/g, ' '), ...r.chain] }
    }
  }
  return { ok: false, why: 'unresolved', chain: [e.replace(/\s+/g, ' ')], detail: '追不到共享出口调用' }
}

/**
 * LV2 单模块判定(纯函数)。
 * @param {{module:string,kind:string,required:string[]}} fam
 * @param {string} src 被审面原文
 */
export function judgeModule(fam, src) {
  const violations = []
  const undetermined = []
  const file = `${SCAN_PREFIX}/${fam.module}.py`
  if (typeof src !== 'string' || src.length === 0) {
    undetermined.push(`LV2 被审面取不到:${file}(不记绿也不冒红)`)
    return { violations, undetermined, keys: [], loadState: null }
  }
  const body = pythonFunctionBody(src, 'get_status')
  if (body === null) {
    undetermined.push(
      `LV2 解析不到对外状态出口 def get_status(...):${file}(改名/搬家 ⇒ 投影对账失明,不记绿)`,
    )
    return { violations, undetermined, keys: [], loadState: null }
  }
  const dict = returnedDictLiteral(body)
  if (dict === null) {
    undetermined.push(
      `LV2 ${file} 的 get_status 体内 return {...} 配平不到/不写成字典字面量(改成先建变量再 return 也会落到这里 ⇒ 本门失明,不记绿)`,
    )
    return { violations, undetermined, keys: [], loadState: null }
  }
  const keys = dictTopKeys(dict)
  if (keys.length === 0) {
    undetermined.push(`LV2 ${file} 的投影字典枚举到 0 个顶层键 ⇒ 判死(不带着半张表比对)`)
    return { violations, undetermined, keys: [], loadState: null }
  }
  const missing = fam.required.filter((k) => !keys.includes(k))
  if (missing.length > 0) {
    violations.push(
      `LV2 ${fam.module}(${fam.kind})的 get_status 投影缺键:[${missing.join(',')}] —— ` +
        `期望 ${fam.kind === 'per-key' ? 'per-key 族七键' : '单例族三键'}[${fam.required.join(',')}];` +
        `下游读不到 loadState 就退回读 loaded/loadFailures 单例口径,又变成"读不到被读成没有"`,
    )
  }
  // loadState 的值必须来自共享出口(逐条独立判:缺键与硬编码是两个不同的病)
  if (keys.includes('loadState')) {
    const expr = dictValueExpr(dict, 'loadState')
    if (expr === null) {
      undetermined.push(`LV2 ${file} 取不到 loadState 的值表达式(判定面解析失败,不记绿)`)
    } else {
      const r = resolveSharedExit(body, expr)
      if (r.ok) {
        // 合规
      } else if (r.why === 'literal') {
        violations.push(
          `LV2 ${fam.module} 的 loadState 硬编码四档字面量(值= ${expr.replace(/\s+/g, ' ').slice(0, 60)}) —— ` +
            `必须经共享出口 state_label(...) / LoadRecord.state_label();写死一份 = 那一档从此不随 _load_lifecycle 演进`,
        )
      } else {
        undetermined.push(
          `LV2 ${file} 的 loadState 值追不到共享出口调用(why=${r.why};表达式= ${r.chain.join(' → ')}) ⇒ 不记绿也不冒红`,
        )
      }
    }
  }
  return { violations, undetermined, keys, loadState: dictValueExpr(dict, 'loadState') }
}

/** LV2 聚合(纯函数):五族逐族判定。 */
export function judgeFamilies(familyInputs) {
  const violations = []
  const undetermined = []
  const report = []
  for (const fam of FAMILIES) {
    const src = familyInputs?.[fam.module] ?? null
    const j = judgeModule(fam, src)
    for (const v of j.violations) violations.push(v)
    for (const u of j.undetermined) undetermined.push(u)
    report.push({
      module: fam.module,
      kind: fam.kind,
      keys: j.keys,
      loadState: j.loadState,
      violations: j.violations.length,
      undetermined: j.undetermined.length,
    })
  }
  return { violations, undetermined, report }
}

// ── 取材(清单与内容必须同面同轮 —— 混面取数会产出自洽却错位的尺子) ──────────

function readContents(root, face, rels) {
  const out = {}
  if (face === 'worktree') {
    for (const rel of rels) {
      try {
        out[rel] = readWorktreeFile(root, rel)
      } catch {
        out[rel] = null
      }
    }
    return out
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = rels.map((rel) => prefix + rel)
  const got = catBatch(root, specs)
  rels.forEach((rel, i) => {
    out[rel] = got.get(specs[i]) ?? null
  })
  return out
}

/**
 * LV1 预筛:候选 = 含任一四档**裸词**的文件(比判据宽一档:裸词还包括注释与 docstring,
 * 而判据只要字面量)⇒ 预筛是判据的严格超集,漏形态的可能被挡在门外。
 * 用 git grep 走仓内既有取材出口,不自己拼命令。
 */
function grepCandidates(root, face) {
  const args = ['grep', '-l', '-I', '--no-color']
  for (const t of TIER_LITERALS) args.push('-e', t)
  if (face === 'staged') args.push('--cached')
  else args.push('HEAD')
  args.push('--', SCAN_PREFIX)
  let out
  try {
    out = gitRaw(args, root)
  } catch (e) {
    // git grep 无命中 = 退出码 1,是正常结论(不是取材失败)
    if (e instanceof Undetermined && e.status === 1) return []
    throw new Undetermined(`LV1 预筛派生失败(${face} 面):${e.message}`)
  }
  return out
    .split('\n')
    .map((l) => l.replace(/^HEAD:/, '').trim())
    .filter((p) => p.length > 0 && p.startsWith(SCAN_PREFIX) && p.endsWith(SCAN_EXT))
}

export function runAudit({ root = ROOT, face } = {}) {
  const sel = face ? { face, error: null } : selectFace({ staged: false, worktree: false, def: 'head' })
  if (sel.error) throw new Undetermined(sel.error)

  // LV1:预筛 → 取内容 → 判定
  const candPaths = grepCandidates(root, sel.face)
  const candContents = readContents(root, sel.face, candPaths)
  const candidates = candPaths.map((p) => ({ path: p, src: candContents[p] }))
  const missingContent = candidates.filter((c) => typeof c.src !== 'string' || c.src.length === 0)
  const lv1 = judgeTierScatter(candidates)

  // LV2:五族固定清单(不预筛 —— 缺文件本身就是"解析不到出口",要判未判定而不是跳过)
  const famRels = FAMILIES.map((f) => `${SCAN_PREFIX}/${f.module}.py`)
  const famContents = readContents(root, sel.face, famRels)
  const familyInputs = {}
  FAMILIES.forEach((f, i) => {
    familyInputs[f.module] = famContents[famRels[i]]
  })
  const lv2 = judgeFamilies(familyInputs)

  const violations = [...lv1.violations, ...lv2.violations]
  const undetermined = [...lv2.undetermined]
  const notes = [
    `LV1 预筛(裸词含注释/docstring,判据只要字面量):候选 ${candPaths.length} 个 .py,` +
      `持有字面量的 ${lv1.holders.length} 个 [${lv1.holders.map((h) => `${h.path}(${h.hits.length})`).join(', ') || '无'}]`,
  ]
  if (sel.face !== 'head') {
    notes.push(
      `LV1 本档(${sel.face})不判"新增":LV1 的"散落"是存量即红的性质,而本门定级 warn(见头注),不靠棘轮遮盖存量。`,
    )
  }
  for (const m of missingContent) {
    notes.push(`LV1 候选取不到内容(已跳过该文件,未判):${m.path}`)
  }
  return {
    face: sel.face,
    violations,
    undetermined,
    notes,
    lv1: {
      candidates: candPaths.length,
      holders: lv1.holders,
      lifecycleHits: (lv1.holders.find((h) => h.path === LIFECYCLE_FILE)?.hits ?? []).length,
    },
    lv2: lv2.report,
  }
}

// ── --self-test(构造面正反成对;每条变异先证明文本真被改,再断言判据红) ──────

/** 夹具一律用**合成档名**,与真仓四档无交集 —— 夹具必须逐字写出判据字面量才有牙,
 *  而真仓档名一旦被写进夹具,本门就会把自己的夹具判成"第二份散落"。 */
const T = TIER_LITERALS
/**
 * 夹具里的共享出口**必须用判据锚点的真名**(`state_label` / `_load_state_label`)。
 * 本门的锚点是硬命名(与守门 151 的 SYMBOLS 同一条规矩):各模块可以用任意别名
 * (`from ... import state_label as _label` 也合法),但那是**被审面的自由**;
 * 夹具若也用别名,测的就不是判据而是"我猜的别名",而真仓用别名时门会判未判定 ——
 * 夹具必须与真仓对齐,否则这道自测证明不了任何事(真仓五族逐字用的是 `_load_state_label`)。
 */
const FIX_SINGLETON_OK = `
from ._load_lifecycle import state_label as _load_state_label


class Svc:
    def __init__(self):
        self._loaded = False
        self._load_failures = 0

    def get_status(self) -> dict:
        """返回状态摘要。说明文字里逐字写到 ${T[0]} 与 ${T[2]} —— docstring 不是第二份实现。"""
        load_state = _load_state_label(loaded=self._loaded, failures=self._load_failures)
        return {
            "total": 1,
            "loaded": self._loaded,
            "loadFailures": self._load_failures,
            "loadState": load_state,
        }
`
/** 反向对照①:缺 loadState 键(单例族少第三键)。 */
const FIX_SINGLETON_NO_LOADSTATE = `
class Svc:
    def get_status(self) -> dict:
        return {
            "loaded": False,
            "loadFailures": 0,
        }
`
/** 反向对照③:loadState 写成常量(硬编码"loaded",不经共享出口)。 */
const FIX_SINGLETON_HARDCODED = `
class Svc:
    def get_status(self) -> dict:
        return {
            "loaded": False,
            "loadFailures": 0,
            "loadState": "loaded",
        }
`
const FIX_PERKEY_OK = `
from ._load_lifecycle import LoadRecord, STATE_NEVER_TRIED, state_label as _load_state_label


class Pk:
    def get_status(self) -> dict:
        """per-key 聚合投影;docstring 里写 ${T[0]} < loaded < ${T[1]} < ${T[2]} 只是说明。"""
        by_user = {uid: rec.state_label() for uid, rec in self._load_records.items()}
        if not by_user:
            worst = _load_state_label(loaded=False, failures=0)
        else:
            worst = max(by_user.values(), key=lambda x: 0)
        return {
            "loadState": worst,
            "allKeysLoaded": True,
            "maxLoadFailures": 0,
            "loadStateByUser": dict(by_user),
            "gaveUpKeys": [],
            "trackedKeys": len(by_user),
            "loadedKeys": 0,
        }
`
/** 反向对照④的**正向**一侧:per-key 族刻意没有 loaded/loadFailures —— 判据不得因此判红。 */
const FIX_PERKEY_NO_SINGLETON_KEYS = FIX_PERKEY_OK

/** 反向对照②的**正向**一侧:只有唯一实现文件持有字面量。 */
const FIX_LIFECYCLE = `
STATE_NEVER_TRIED = "${T[0]}"
STATE_RETRY_BACKOFF = "${T[1]}"
STATE_GAVE_UP = "${T[2]}"
`
/** 反向对照②:另一个服务文件逐字写出四档字面量 ⇒ LV1 必红。 */
const FIX_SCATTER = `
class Other:
    def get_status(self):
        # 这里曾经逐字写过 "${T[0]}" —— 已改为经共享出口取,注释不是第二份实现。
        return {"loadState": _label(loaded=False, failures=0)}

STATE_FALLBACK = "${T[2]}"
`

function selfTest() {
  const cases = []
  const t = (name, ok) => cases.push({ name, ok: !!ok })
  const singletonFam = FAMILIES[0]
  const perKeyFam = FAMILIES.find((f) => f.kind === 'per-key')

  // A · LV2 构造面正反成对
  const ok1 = judgeModule(singletonFam, FIX_SINGLETON_OK)
  t('A1 LV2 绿形:单例族三键 + loadState 经局部变量转发共享出口', ok1.violations.length === 0 && !ok1.undetermined.length)
  const miss = judgeModule(singletonFam, FIX_SINGLETON_NO_LOADSTATE)
  t('A2 LV2 有牙:缺 loadState 键 ⇒ 点名', miss.violations.some((v) => v.includes('缺键') && v.includes('loadState')))
  const hard = judgeModule(singletonFam, FIX_SINGLETON_HARDCODED)
  t(
    'A3 LV2 有牙:loadState 硬编码 "loaded" ⇒ 点名(不经共享出口)',
    hard.violations.some((v) => v.includes('硬编码四档字面量')),
  )
  const ok2 = judgeModule(perKeyFam, FIX_PERKEY_OK)
  t('A4 LV2 绿形:per-key 族七键 + 经 LoadRecord.state_label() 取最坏档', ok2.violations.length === 0 && !ok2.undetermined.length)
  t(
    'A5 反向对照④:per-key 族没有 loaded/loadFailures 键,判据**不得**因此判红(同名不同义是刻意设计)',
    ok2.violations.length === 0 && !ok2.keys.includes('loaded') && !ok2.keys.includes('loadFailures'),
  )
  t(
    'A5b 判据自身不许要求 per-key 族有 loaded 键(常量层锁死,防止后人"顺手对齐"写歪)',
    !perKeyFam.required.includes('loaded') && !perKeyFam.required.includes('loadFailures'),
  )
  t('A6 缺 get_status ⇒ 未判定(失明不记绿)', judgeModule(singletonFam, 'class X:\n    pass\n').undetermined.length === 1)
  t(
    'A7 get_status 无字典字面量 ⇒ 未判定(解析不到不猜)',
    judgeModule(singletonFam, 'class X:\n    def get_status(self):\n        return self._d\n').undetermined.length === 1,
  )
  t('A8 取不到面 ⇒ 未判定零违规', judgeModule(singletonFam, '').undetermined.length === 1)

  // B · LV1 构造面正反成对
  const scatterOk = judgeTierScatter([
    { path: LIFECYCLE_FILE, src: FIX_LIFECYCLE },
    { path: `${SCAN_PREFIX}/memory_decay.py`, src: FIX_PERKEY_OK },
  ])
  t('B1 LV1 绿形:字面量只在唯一实现文件里', scatterOk.violations.length === 0)
  const scattered = judgeTierScatter([
    { path: LIFECYCLE_FILE, src: FIX_LIFECYCLE },
    { path: `${SCAN_PREFIX}/other_svc.py`, src: FIX_SCATTER },
  ])
  t(
    'B2 LV1 有牙:第二个文件逐字写出四档字面量 ⇒ 点名该文件(注释里那份不算)',
    scattered.violations.length === 1 &&
      scattered.violations[0].includes('other_svc.py') &&
      scattered.violations[0].includes(T[2]),
  )
  t(
    'B3 LV1 有牙:注释/docstring 里逐字写档位**不**判红(门不得咬自己的散文)',
    judgeTierScatter([{ path: LIFECYCLE_FILE, src: FIX_LIFECYCLE }, { path: `${SCAN_PREFIX}/d.py`, src: FIX_SINGLETON_OK }])
      .violations.length === 0,
  )
  t(
    'B4 LV1 失明方向:唯一实现里读不到字面量 ⇒ 判红(不记绿)',
    judgeTierScatter([{ path: LIFECYCLE_FILE, src: 'X = 1\n' }]).violations.some((v) => v.includes('失明')),
  )
  t(
    'B5 LV1 全面失明(候选为 0)⇒ 判红(扫不到 = 尺子漂了,不是"没有副本")',
    judgeTierScatter([]).violations.some((v) => v.includes('失明')),
  )
  const t1 = judgeTierLiterals(FIX_SCATTER)
  t('B6 遮罩方向锁:真代码字面量 1 处、注释里 0 处', t1.hits.length === 1 && t1.hits[0].tier === T[2])
  t(
    'B7 遮罩等长(命中能落回原文行号)',
    maskPyNarrative(FIX_SCATTER).length === FIX_SCATTER.length,
  )
  t(
    'B8 裸词不算字面量(llm_retry_backoff 这类参数名不是四档散落)',
    judgeTierLiterals('def f(llm_retry_backoff: float = 1.5):\n    return llm_retry_backoff\n').hits.length === 0,
  )

  // C · 五族聚合
  const all = {}
  all.ab_test_tracker = FIX_SINGLETON_OK
  all.meta_learner = FIX_SINGLETON_OK
  all.federated_learner = FIX_SINGLETON_OK
  all.memory_decay = FIX_PERKEY_NO_SINGLETON_KEYS
  all.user_profile = FIX_PERKEY_NO_SINGLETON_KEYS
  const agg = judgeFamilies(all)
  t('C1 五族聚合绿形', agg.violations.length === 0 && !agg.undetermined.length && agg.report.length === 5)
  all.meta_learner = FIX_SINGLETON_NO_LOADSTATE
  t('C2 五族里一族坏掉 ⇒ 点名那一族', judgeFamilies(all).violations.some((v) => v.includes('meta_learner')))
  all.meta_learner = null
  t('C3 一族取不到 ⇒ 未判定(不记绿也不冒红)', judgeFamilies(all).undetermined.some((u) => u.includes('meta_learner')))

  // D · 真仓对照(HEAD 面):五族基线必须绿,否则本门在自己仓里就是红的
  let real = null
  try {
    real = runAudit({ face: 'head' })
  } catch (e) {
    real = { error: e instanceof Undetermined ? e.message : String(e) }
  }
  const bad = real && !real.error ? real.violations : []
  t('D0 真仓 HEAD 面:LV1+LV2 零违规', !!real && !real.error && bad.length === 0)
  t(
    'D1 真仓:LV1 唯一实现持有四档字面量(≥3 档,证明尺子看得见)',
    !!real && !real.error && real.lv1.lifecycleHits >= 3,
  )
  t(
    'D2 真仓:五族都读得出投影键(无未判定)',
    !!real && !real.error && real.undetermined.length === 0 && real.lv2.length === 5,
  )
  t(
    'D3 真仓:五族 loadState 全部经共享出口(判据对真形态有牙的前提)',
    !!real && !real.error && real.lv2.every((r) => typeof r.loadState === 'string' && r.loadState.length > 0),
  )
  const stat =
    real && !real.error
      ? JSON.stringify({
          face: real.face,
          lv1Candidates: real.lv1.candidates,
          lv1Holders: real.lv1.holders.length,
          lifecycleHits: real.lv1.lifecycleHits,
          violations: real.violations.length,
          undetermined: real.undetermined.length,
        })
      : JSON.stringify({ error: real.error })
  console.log(`--self-test:${cases.filter((c) => c.ok).length}/${cases.length} 通过(真仓 ${stat})`)
  for (const c of cases) if (!c.ok) console.log(`   ✗ ${c.name}`)
  return cases.every((c) => c.ok) ? 0 : 1
}

// ── CLI ──────────────────────────────────────────────────────────────────

function usage() {
  console.log(
    '用法: node scripts/check-load-state-projection-parity.mjs [--staged|--worktree] [--root <dir>] [--strict] [--json] [--all] [--self-test]\n' +
      '缺省判 HEAD blob;--staged 判索引 blob;--worktree 仅人工逃生舱(--root 只在该档有效);两旗同给 exit 2。\n' +
      '默认档违规只报数(逐条打印、exit 0);--strict 才判红(问责档)。\n' +
      'LV1 = 四档字面量只许住在 _load_lifecycle.py;LV2 = 五族 get_status 的 loadState 键 + 共享出口来源。\n' +
      '定级 warn 起步(理由见文件头注:接 blocking 会让每台每次提交被逼跳门,AGENTS §12e/§12f)。',
  )
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    usage()
    process.exit(0)
  }
  if (argv.includes('--self-test')) process.exit(selfTest())
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  const strict = argv.includes('--strict')
  const json = argv.includes('--json')
  const showAll = argv.includes('--all')
  const sel = selectFace({ staged, worktree, def: 'head' })
  if (sel.error) {
    console.error(`❌ ${sel.error}`)
    process.exit(2)
  }
  let root = ROOT
  const ri = argv.indexOf('--root')
  if (ri >= 0) {
    const val = argv[ri + 1]
    if (!val || val.startsWith('--')) {
      console.error('❌ --root 需要一个目录参数')
      process.exit(2)
    }
    if (sel.face !== 'worktree') {
      console.error('❌ --root 只在 --worktree 档有效(换根却按 HEAD/索引读 = 双根分裂)')
      process.exit(2)
    }
    root = path.resolve(val)
  }
  let res
  try {
    res = runAudit({ root, face: sel.face })
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`⚠️ 无法判定(取材层/面旗冲突):${e.message}`)
      process.exit(2)
    }
    throw e
  }
  if (json) {
    console.log(JSON.stringify({ face: res.face, ...res }, null, 2))
  } else {
    console.log(
      `   LV1:候选 ${res.lv1.candidates} 个 .py | 持有四档字面量的文件 ${res.lv1.holders.length} 个` +
        `[${res.lv1.holders.map((h) => `${h.path}(${h.hits.length} 处)`).join(', ')}]`,
    )
    for (const r of res.lv2) {
      console.log(
        `   LV2 ${r.module}(${r.kind}):${r.undetermined > 0 ? '⚠️未判定' : r.violations > 0 ? '❌违规' : '✅'} ` +
          `键 ${r.keys.length} 个 [${r.keys.join(',')}] | loadState = ${String(r.loadState).replace(/\s+/g, ' ').slice(0, 60)}`,
      )
    }
    for (const n of res.notes) console.log(`   · ${n}`)
    if (showAll && res.lv1.holders.length > 0) {
      console.log('   LV1 持有字面量的文件逐条:')
      for (const h of res.lv1.holders)
        console.log(`      ${h.path === LIFECYCLE_FILE ? '✓' : '✗'} ${h.path}:${h.hits.map((x) => `${x.line}:${x.tier}`).join(' ')}`)
    }
  }
  if (res.undetermined.length > 0) {
    console.error(
      `⚠️ 无法判定:${res.undetermined.length} 项 —— ${res.undetermined.join(' | ')}(面=${res.face};既不记绿也不冒红)`,
    )
    process.exit(2)
  }
  if (res.violations.length === 0) {
    if (!json)
      console.log(
        `✅ loadState 投影对账通过(面=${res.face}):四档字面量只住在 ${LIFECYCLE_FILE}、五族 get_status 的 loadState 键齐全且全部经共享出口`,
      )
    process.exit(0)
  }
  if (!json) {
    console.log(
      strict
        ? `❌ 检出 ${res.violations.length} 处 loadState 投影漂移(面=${res.face},--strict 判红):`
        : `⚠️ 检出 ${res.violations.length} 处 loadState 投影漂移(面=${res.face};默认档只报数,--strict 判红):`,
    )
    for (const v of res.violations) console.log(`   · ${v}`)
    console.log(
      '改法:四档字面量只许住在 ' +
        LIFECYCLE_FILE +
        ';\n' +
        '     各族 get_status 的 loadState 必须经共享出口 state_label(...) / LoadRecord.state_label() 取值。\n' +
        '     投影缺键会让下游退回读单例口径的 loaded/loadFailures,又变成"读不到被读成没有数据"。\n' +
        '     ⚠️ per-key 族(memory_decay / user_profile)**刻意不用** loaded / loadFailures 键名 —— 同名不同义\n' +
        '     是最坏的下游陷阱,**不得**为了"看起来一致"给它们补上这两个键(那要另开一票改下游)。\n' +
        '     不得为变绿放宽判据、不得写豁免清单消账。应急跳过 ' +
        SELF_SKIP +
        '=1。',
    )
  }
  process.exit(strict ? 1 : 0)
}

/** 导出给 §22c 镜像测试(测试不得重写判据,见 scripts/tests/ 同名 .test.mjs) */
export const __test__ = {
  SELF_SKIP,
  FAMILIES,
  LIFECYCLE_FILE,
  TIER_LITERALS,
  SHARED_EXITS,
  SHARED_EXIT_CALL_RE,
  maskPyNarrative,
  judgeTierLiterals,
  judgeTierScatter,
  pythonFunctionBody,
  returnedDictLiteral,
  dictTopKeys,
  dictValueExpr,
  resolveSharedExit,
  judgeModule,
  judgeFamilies,
  FIX_SINGLETON_OK,
  FIX_SINGLETON_NO_LOADSTATE,
  FIX_SINGLETON_HARDCODED,
  FIX_PERKEY_OK,
  FIX_PERKEY_NO_SINGLETON_KEYS,
  FIX_LIFECYCLE,
  FIX_SCATTER,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
}
