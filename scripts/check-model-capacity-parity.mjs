#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 模型容量 / 推理档位的 TS↔Python 跨语言对账门(2026-09-27 立)。
//
// 【接线状态:尚未进提交链】本门目前只有本文件与它的镜像测试。
// 注册进 scripts/guardian-runner.mjs 与 AGENTS/README 点名由主会话统一落
// (注册表是多会话共写面,并行改必然互相覆盖注册块)。
// 本头注刻意不声称本门已挂进任何钩子链、也不自称"第 N 项":守门 89 的 R1 判的正是
// "声称已接线而五处权威点零命中",这里没接线也没声称,两侧都不撒谎。
//
// 它钉的是什么病(立项时逐条实测,不是假想):
//   · apps/ai-service/app/core/model_context_window.py 的头注原文写着"暂无自动对账门",
//     其 LOW_WINDOW_OVERRIDES 是 packages/api-client/src/model-context-capacity.ts 里
//     EXACT_CAPACITY(< 兜底值子集)的一份**手抄**。改一处忘改另一处,表现为"某些模型在
//     Web 按大窗口拼提示、在 Python 按小窗口截断"(或反之),没有任何类型错误或测试会红。
//   · 推理档位表同样两语言各写一份:
//     apps/ai-service/app/core/reasoning_effort_pin.py 的 known_efforts 与
//     apps/cli/src/subagents/precedence.ts 的 REASONING_EFFORTS。
//     precedence.ts 把数组成员 `as ReasoningEffort` 强转 —— 运行时数组与 apps/cli/src/
//     subagents/types.ts 的联合类型并不同源,**typecheck 结构上看不见这一格**
//     (数组加一档、联合漏一档,照样编译绿)。
//   · 立门前复核(两条都实跑过):`grep -rln "EXACT_CAPACITY|DEFAULT_CONTEXT_CAPACITY|
//     LOW_WINDOW_OVERRIDES" scripts/` = 0 命中;`grep -rn "known_efforts|REASONING_EFFORT"
//     scripts/*.mjs` = 0 命中 ⇒ 此前全仓无人对账。
//
// 判据(全部按被审面现读,不 import、不执行被审实现 —— 判据不得与被审实现同源):
//   C1 兜底同值:TS DEFAULT_CONTEXT_CAPACITY ≡ Python DEFAULT_CONTEXT_WINDOW。
//   C2 Python 侧逐条对上:LOW_WINDOW_OVERRIDES 每个 (模型,值) 必须在 TS EXACT_CAPACITY
//      有同名条目且同值;找不到来源 / 值不等都是漂移(手抄表与母表分叉)。
//   C3 TS 低窗口条目必须在 Python 侧:EXACT_CAPACITY 中值 < 兜底值的每一行都必须出现在
//      LOW_WINDOW_OVERRIDES(py 侧头注自述的表契约)。缺行 ⇒ Python 按兜底值撑大窗口,
//      直到上游 400 才炸 —— 正是"该截断没截断"的病灶方向。
//   C4 表域契约:两侧同值的行若值 ≥ 兜底值,Python 侧此行超出"只列低于兜底值例外"的契约。
//   C5 推理档位跨语言等值:known_efforts ≡ REASONING_EFFORTS,差集逐名点名。
//   C6 推理档位同事实多落点等值(**四处**,D130 起):cli 运行时数组 ≡ cli 编译期联合 ≡
//      契约层 packages/types/src/reasoning-effort.ts 的封闭联合。任一配对漂开各点名一次 ——
//      第四落点是 api-client / apps/api / miniapp 唯一 import 的那一份,它漂开时 cli 侧
//      既不会红也不会跑到(它不 import 契约层),所以必须显式并进来对账。
//
// 三态(命中 / 漂移 / 判不出)分开:判不出的逐条点名;任一面取不到、任何表声明解析不到、
// 表体出现无法解析的行、或任何判据输入枚举到 0 条 ⇒ "无法判定" exit 2,既不记绿也不冒红。
// 定级:默认档漂移**只报数**(待偿清单逐条打印但 exit 0)—— 若两侧现读就有漂移,存量当场
// 判红是一台恒红门(唯一结局是逼人 --no-verify 连带废掉全部守门,§12e 同型);--strict 才
// 判红(问责档:`node scripts/check-model-capacity-parity.mjs --strict`)。
// --staged 与 --worktree 同给 ⇒ exit 2。--root <dir> 是镜像测试/审计通道。
//
// 已知覆盖边界(如实登记,不得读成"已确认没有"):
//   · TS 的 PATTERN_CAPACITY 模糊层在 Python 侧**按设计**没有对应实现(未知模型按兜底值
//     fail-visible),本门只报该层条数,不对其做数值判据;
//   · 比对的是两侧**声明的字面量表**;若有人把表改成运行时计算(如 `_load_from_env()`),
//     本门判"解析不到声明" ⇒ 未判定,而不是悄悄跳过。

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 注册进提交链时(由主会话落)runner 条目应使用的应急跳过名 */
export const SELF_SKIP = 'HUSKY_SKIP_MODEL_CAPACITY_PARITY'

export const FILES = {
  tsCapacity: 'packages/api-client/src/model-context-capacity.ts',
  pyWindow: 'apps/ai-service/app/core/model_context_window.py',
  pyEffort: 'apps/ai-service/app/core/reasoning_effort_pin.py',
  tsEffort: 'apps/cli/src/subagents/precedence.ts',
  tsEffortType: 'apps/cli/src/subagents/types.ts',
  // D130(2026-09-30):契约层第四落点 —— 跨端 wire 值域(api-client / apps/api / miniapp 都从这里取)。
  // 新增该落点与把它扩进本门判据必须同枚提交:加了类型不加门,新落点天然脱离尺子。
  tsEffortContract: 'packages/types/src/reasoning-effort.ts',
}

// ---------------------------------------------------------------------------
// 解析原语(两侧读成同构数据)
// ---------------------------------------------------------------------------

/**
 * 表名在 docstring / 注释里被反复提及(实测本仓正是如此:py 模块 docstring 在真声明**之前**
 * 写了 LOW_WINDOW_OVERRIDES / EXACT_CAPACITY 字样),所以定位声明一律**行锚定 + 要求 `=`**。
 * 裸 `indexOf(name)` 会先撞上散文 —— 那不是报错,是拿散文去配平括号,产出静默错位的尺子。
 */
function declAt(src, re, label) {
  const m = re.exec(src)
  if (!m) throw new Undetermined(`未找到声明: ${label}(被改名/挪走/换了形态 ⇒ 判不出,不猜)`)
  return m
}

/** 从 openIdx 处的 `{`/`[` 起做括号配平,返回**不含外层括号**的正文。 */
export function sliceBalanced(src, openIdx, label) {
  const openCh = src[openIdx]
  const closeCh = openCh === '{' ? '}' : openCh === '[' ? ']' : null
  if (!closeCh) throw new Undetermined(`${label}: 第 ${openIdx} 位不是 { 或 [`)
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i]
    if (c === openCh) depth++
    else if (c === closeCh) {
      depth--
      if (depth === 0) return src.slice(openIdx + 1, i)
    }
  }
  throw new Undetermined(`${label} 括号不配平`)
}

/**
 * 抹掉表体里的注释(js: `//` 与 `/* *\/`;py: `#`),**保留字符串内容**。
 * 刻意只作用于"括号配平切出来的表体":全文件遮罩会把键字符串一起抹掉(键就是字符串),
 * 而 code-mask 那一份是"注释与字符串都抹"的另一种操作 —— 两处算的不是同一件事。
 * 表体里 `// === Google ===` 这类分节注释若混进键值正则,会造出两侧都不存在的幽灵条目;
 * 抹不掉的部分由残留检测兜住(残留 ⇒ 判不出)。
 */
export function stripBodyComments(body, lang) {
  const py = lang === 'py'
  let out = ''
  let i = 0
  let q = null
  while (i < body.length) {
    const c = body[i]
    const n = body[i + 1]
    if (q) {
      if (c === '\\') {
        out += c + (n ?? '')
        i += 2
        continue
      }
      if (c === q) q = null
      out += c
      i++
      continue
    }
    if (!py && c === '/' && n === '/') {
      while (i < body.length && body[i] !== '\n') i++
      continue
    }
    if (!py && c === '/' && n === '*') {
      const e = body.indexOf('*/', i + 2)
      i = e < 0 ? body.length : e + 2
      continue
    }
    if (py && c === '#') {
      while (i < body.length && body[i] !== '\n') i++
      continue
    }
    if (c === '"' || c === "'" || (!py && c === '`')) q = c
    out += c
    i++
  }
  return out
}

export function toNumberLit(raw) {
  const s = String(raw).replace(/_/g, '')
  return /^\d+$/.test(s) ? Number(s) : null
}

const ENTRY_KEY_VAL_RE = /(?:'([^']*)'|"([^"]*)"|([A-Za-z_$][\w$]*))\s*:\s*(-?\d[\d_]*)/g
const STRING_TOKEN_RE = /'([^']*)'|"([^"]*)"/g

/** 解析 `{ "key": number, bare_key: number, ... }` 形态的表体。 */
export function parseNumberTable(bodySrc, lang) {
  const stripped = stripBodyComments(bodySrc, lang)
  const entries = new Map()
  const dups = []
  for (const m of stripped.matchAll(ENTRY_KEY_VAL_RE)) {
    const key = m[1] ?? m[2] ?? m[3]
    const num = toNumberLit(m[4])
    if (num === null || key === undefined) continue
    if (entries.has(key)) dups.push(key)
    // last-wins:与 JS 对象字面量 / Python dict 字面量的运行时语义一致,两侧同规,
    // 所以重复键不产生跨语言分歧,只进 notes 报数(判红会把语义问题当漂移问题修)。
    entries.set(key, num)
  }
  const residual = stripped.replace(ENTRY_KEY_VAL_RE, ' ').replace(/[\s,;]+/g, '')
  return { entries, dups, residual }
}

/** 解析 `frozenset({...})` / `['a','b']` / 联合类型等**字符串集合**体。 */
export function parseStringSet(bodySrc, lang) {
  const stripped = stripBodyComments(bodySrc, lang)
  const items = new Set()
  for (const m of stripped.matchAll(STRING_TOKEN_RE)) items.add(m[1] ?? m[2])
  const residual = stripped.replace(STRING_TOKEN_RE, ' ').replace(/[|\s,;]+/g, '')
  return { items, residual }
}

export function parseTsCapacity(src) {
  const s = src.replace(/\r\n/g, '\n')
  const defM = declAt(
    s,
    /^[ \t]*export[ \t]+const[ \t]+DEFAULT_CONTEXT_CAPACITY[ \t]*=[ \t]*([0-9_]+)[ \t]*$/m,
    'TS DEFAULT_CONTEXT_CAPACITY',
  )
  const tableM = declAt(
    s,
    /^[ \t]*(?:export[ \t]+)?const[ \t]+EXACT_CAPACITY\b[^=\n]*=[ \t]*\{/m,
    'TS EXACT_CAPACITY',
  )
  const body = sliceBalanced(s, tableM.index + tableM[0].length - 1, 'EXACT_CAPACITY')
  const table = parseNumberTable(body, 'js')
  let patternRules = null
  const patM = /^[ \t]*(?:export[ \t]+)?const[ \t]+PATTERN_CAPACITY\b[^=\n]*=[ \t]*\[/m.exec(s)
  if (patM) {
    try {
      const pbody = sliceBalanced(s, patM.index + patM[0].length - 1, 'PATTERN_CAPACITY')
      patternRules = [...stripBodyComments(pbody, 'js').matchAll(/\bpattern\s*:/g)].length
    } catch {
      patternRules = null
    }
  }
  return {
    default: toNumberLit(defM[1]),
    entries: table.entries,
    dups: table.dups,
    residual: table.residual,
    patternRules,
  }
}

export function parsePyWindow(src) {
  const s = src.replace(/\r\n/g, '\n')
  const defM = declAt(
    s,
    /^[ \t]*DEFAULT_CONTEXT_WINDOW[ \t]*=[ \t]*([0-9_]+)[ \t]*$/m,
    'Python DEFAULT_CONTEXT_WINDOW',
  )
  const tableM = declAt(
    s,
    /^[ \t]*LOW_WINDOW_OVERRIDES[ \t]*:[^=\n]*=[ \t]*\{/m,
    'Python LOW_WINDOW_OVERRIDES',
  )
  const body = sliceBalanced(s, tableM.index + tableM[0].length - 1, 'LOW_WINDOW_OVERRIDES')
  const table = parseNumberTable(body, 'py')
  return {
    default: toNumberLit(defM[1]),
    entries: table.entries,
    dups: table.dups,
    residual: table.residual,
  }
}

export function parsePyEfforts(src) {
  const s = src.replace(/\r\n/g, '\n')
  const m = declAt(s, /^[ \t]*known_efforts[ \t]*:[ \t]*frozenset/m, 'Python known_efforts')
  // `{` 只允许出现在声明**同一行** —— 往后越行找括号,会把后面某个方法的 dict 当成档位集
  // 静默错读(不报错、给出一张自洽的错表,正是最贵的那种失明)。越行即判不出。
  const lineEnd = s.indexOf('\n', m.index)
  const line = s.slice(m.index, lineEnd < 0 ? s.length : lineEnd)
  const braceRel = line.indexOf('{')
  if (braceRel < 0)
    throw new Undetermined('known_efforts 声明行内解析不到集合字面量的 {(换行书写/非字面量 ⇒ 判不出)')
  const body = sliceBalanced(s, m.index + braceRel, 'known_efforts')
  const set = parseStringSet(body, 'py')
  return { items: set.items, residual: set.residual }
}

export function parseTsArraySet(src, name) {
  const s = src.replace(/\r\n/g, '\n')
  const m = declAt(
    s,
    new RegExp(`^[ \\t]*(?:export[ \\t]+)?const[ \\t]+${name}\\b[^=\\n]*=[ \\t]*\\[`, 'm'),
    `TS ${name}`,
  )
  const body = sliceBalanced(s, m.index + m[0].length - 1, name)
  const set = parseStringSet(body, 'js')
  return { items: set.items, residual: set.residual }
}

export function parseTsUnion(src, typeName) {
  const s = src.replace(/\r\n/g, '\n')
  const m = declAt(
    s,
    new RegExp(`^[ \\t]*export[ \\t]+type[ \\t]+${typeName}[ \\t]*=`, 'm'),
    `TS type ${typeName}`,
  )
  const after = s.slice(m.index + m[0].length)
  const lines = after.split('\n')
  let rhs
  if (lines[0].trim() !== '') {
    rhs = lines[0]
  } else {
    // 多行形态:`=` 换行后每行以 | 开头;遇到首个非续行即止
    const take = []
    for (const line of lines.slice(1)) {
      const tr = line.trim()
      if (tr === '') {
        if (take.length === 0) continue
        break
      }
      if (!tr.startsWith('|')) break
      take.push(line)
      if (/;\s*$/.test(tr)) break
    }
    rhs = take.join('\n')
  }
  const set = parseStringSet(rhs, 'js')
  return { items: set.items, residual: set.residual }
}

// ---------------------------------------------------------------------------
// 判据聚合
// ---------------------------------------------------------------------------

function diffSets(a, b) {
  const onlyA = [...a].filter((x) => !b.has(x)).sort()
  const onlyB = [...b].filter((x) => !a.has(x)).sort()
  return { onlyA, onlyB }
}

/**
 * @param {{[path:string]: string|null}} contents 被审面内容(null/'' = 该面取不到)
 * @returns {{drifts:string[], notes:string[], undetermined:string[], tables:object|null}}
 */
export function decide(contents) {
  const expected = Object.values(FILES)
  const missing = expected.filter((k) => typeof contents[k] !== 'string' || contents[k].length === 0)
  if (missing.length > 0)
    return { drifts: [], notes: [], undetermined: [`被审面取不到:${missing.join(', ')}`], tables: null }

  let tsCap, pyWin, pyEff, tsEff, tsUnion, tsContract
  try {
    tsCap = parseTsCapacity(contents[FILES.tsCapacity])
    pyWin = parsePyWindow(contents[FILES.pyWindow])
    pyEff = parsePyEfforts(contents[FILES.pyEffort])
    tsEff = parseTsArraySet(contents[FILES.tsEffort], 'REASONING_EFFORTS')
    tsUnion = parseTsUnion(contents[FILES.tsEffortType], 'ReasoningEffort')
    tsContract = parseTsUnion(contents[FILES.tsEffortContract], 'ReasoningEffort')
  } catch (e) {
    if (e instanceof Undetermined)
      return { drifts: [], notes: [], undetermined: [`解析失败:${e.message}`], tables: null }
    throw e
  }

  // "扫到 0"必须先怀疑尺子,再相信世界(本仓普查实录同型):任何一张判据输入表读出 0 条,
  // 或表体出现解析不进的行,都按**判不出**处理 —— 绝不带着半张表去比对、更不记绿。
  const undetermined = []
  if (tsCap.default === null || pyWin.default === null)
    undetermined.push('兜底常量不是数字字面量(解析得 null)')
  if (tsCap.entries.size === 0) undetermined.push('TS EXACT_CAPACITY 枚举到 0 条 ⇒ 判死')
  if (pyWin.entries.size === 0) undetermined.push('Python LOW_WINDOW_OVERRIDES 枚举到 0 条 ⇒ 判死')
  if (pyEff.items.size === 0) undetermined.push('Python known_efforts 枚举到 0 条 ⇒ 判死')
  if (tsEff.items.size === 0) undetermined.push('TS REASONING_EFFORTS 枚举到 0 条 ⇒ 判死')
  if (tsUnion.items.size === 0) undetermined.push('TS type ReasoningEffort 枚举到 0 条 ⇒ 判死')
  if (tsContract.items.size === 0) undetermined.push('契约层 type ReasoningEffort 枚举到 0 条 ⇒ 判死')
  if (tsCap.residual)
    undetermined.push(`TS EXACT_CAPACITY 表体有 ${tsCap.residual.length} 字符解析不进键值判据(不猜)`)
  if (pyWin.residual)
    undetermined.push(
      `Python LOW_WINDOW_OVERRIDES 表体有 ${pyWin.residual.length} 字符解析不进键值判据(不猜)`,
    )
  if (pyEff.residual) undetermined.push('Python known_efforts 集合体含非字符串项(未判定)')
  if (tsEff.residual) undetermined.push('TS REASONING_EFFORTS 数组含非字符串项(未判定)')
  if (tsUnion.residual) undetermined.push('TS type ReasoningEffort 联合含非字符串成员(未判定)')
  if (tsContract.residual) undetermined.push('契约层 type ReasoningEffort 联合含非字符串成员(未判定)')
  if (undetermined.length > 0) return { drifts: [], notes: [], undetermined, tables: null }

  const drifts = []
  const notes = []

  // ---- C1 兜底同值 ----
  if (tsCap.default !== pyWin.default) {
    drifts.push(
      `C1 兜底窗口漂移:TS DEFAULT_CONTEXT_CAPACITY=${tsCap.default} vs Python DEFAULT_CONTEXT_WINDOW=${pyWin.default}`,
    )
  }

  // ---- C2/C3/C4 容量表逐键对账(复合主键 = 模型名;逐条点名,不按行号不按顺序) ----
  const tsLow = [...tsCap.entries].filter(([, v]) => v < tsCap.default)
  const keys = new Set([...pyWin.entries.keys(), ...tsLow.map(([k]) => k)])
  for (const key of [...keys].sort()) {
    const tv = tsCap.entries.get(key)
    const pv = pyWin.entries.get(key)
    if (pv !== undefined && tv !== undefined) {
      if (pv !== tv)
        drifts.push(`C2 值不等:${key} TS EXACT_CAPACITY=${tv} Python LOW_WINDOW_OVERRIDES=${pv}`)
      else if (pv >= pyWin.default)
        drifts.push(
          `C4 表域违约:Python 侧 "${key}"=${pv} ≥ 兜底 ${pyWin.default}(该表契约 = 只列低于兜底值的例外)`,
        )
    } else if (pv !== undefined) {
      drifts.push(`C2 Python 孤儿条目:${key}=${pv} 在 TS EXACT_CAPACITY 中不存在(手抄与母表分叉)`)
    } else {
      drifts.push(
        `C3 TS 低窗口未抄到 Python:${key}=${tv} < 兜底 ${tsCap.default},Python 将按兜底值放行该模型`,
      )
    }
  }

  // ---- C5/C6 推理档位 ----
  const cross = diffSets(pyEff.items, tsEff.items)
  if (cross.onlyA.length + cross.onlyB.length > 0) {
    drifts.push(
      `C5 推理档位跨语言漂移:仅Python known_efforts=[${cross.onlyA.join(',')}] 仅TS REASONING_EFFORTS=[${cross.onlyB.join(',')}]`,
    )
  }
  const inner = diffSets(tsEff.items, tsUnion.items)
  if (inner.onlyA.length + inner.onlyB.length > 0) {
    drifts.push(
      `C6 TS 内部同事实两真相:仅运行时数组 REASONING_EFFORTS=[${inner.onlyA.join(',')}] 仅编译期联合 type ReasoningEffort=[${inner.onlyB.join(',')}]`,
    )
  }
  // C6 的第二组对照(D130 第四落点):契约层 packages/types 的封闭联合与 cli 的运行时数组。
  // 这一组是"跨端 wire 值域"与"cli 内部档位表"的对账 —— api-client / apps/api / miniapp
  // 只 import 契约层,所以它一旦漂开,发出去的档位就落在上游 known_efforts 之外,
  // 而两侧都不会红(cli 不 import 契约层,契约层不 import cli)。
  const cross2 = diffSets(tsEff.items, tsContract.items)
  if (cross2.onlyA.length + cross2.onlyB.length > 0) {
    drifts.push(
      `C6 契约层与 cli 档位表分叉:仅运行时数组 REASONING_EFFORTS=[${cross2.onlyA.join(',')}] 仅契约层 packages/types type ReasoningEffort=[${cross2.onlyB.join(',')}]`,
    )
  }
  const cross3 = diffSets(tsUnion.items, tsContract.items)
  if (cross3.onlyA.length + cross3.onlyB.length > 0) {
    drifts.push(
      `C6 两份编译期联合各写一半:仅 cli type ReasoningEffort=[${cross3.onlyA.join(',')}] 仅契约层 type ReasoningEffort=[${cross3.onlyB.join(',')}]`,
    )
  }

  // ---- 覆盖边界与卫生项:只报数,不判红 ----
  notes.push(
    `推理档位落点共四处(py known_efforts / cli REASONING_EFFORTS / cli type ReasoningEffort / 契约层 packages/types type ReasoningEffort)—— 改档必须四处同笔,少一处即 C5/C6 点名`,
  )
  notes.push(
    `TS PATTERN_CAPACITY 模糊层 ${tsCap.patternRules ?? '(条数未解析出,不计)'} 条在 Python 侧无对应声明(按设计走兜底 fail-visible)—— 不在本门数值判据射程`,
  )
  notes.push(
    `TS EXACT_CAPACITY 共 ${tsCap.entries.size} 条,其中 ≥兜底 的 ${tsCap.entries.size - tsLow.length} 条无需 Python 对应`,
  )
  if (tsCap.dups.length > 0)
    notes.push(`TS 表内重复键(last-wins,两侧同规,只报数):[${tsCap.dups.join(',')}]`)
  if (pyWin.dups.length > 0) notes.push(`Python 表内重复键(只报数):[${pyWin.dups.join(',')}]`)
  const upper = [...pyWin.entries.keys()].filter((k) => k !== k.toLowerCase())
  if (upper.length > 0)
    notes.push(`Python 键含大写、运行时(lower 归一查表)永不命中(本门判等值,该型另计):[${upper.join(',')}]`)

  return {
    drifts,
    notes,
    undetermined,
    tables: {
      tsDefault: tsCap.default,
      pyDefault: pyWin.default,
      tsExact: tsCap.entries.size,
      tsLowWindow: tsLow.length,
      pyLow: pyWin.entries.size,
      patternRules: tsCap.patternRules,
      efforts: {
        py: [...pyEff.items].sort(),
        tsArray: [...tsEff.items].sort(),
        tsUnion: [...tsUnion.items].sort(),
        tsContract: [...tsContract.items].sort(),
      },
    },
  }
}

// ---------------------------------------------------------------------------
// 取材(清单与内容**同面同轮**:一次 cat-file --batch 读满)
// ---------------------------------------------------------------------------

export function readContents(root, face) {
  const rels = Object.values(FILES)
  if (face === 'worktree') {
    const out = {}
    for (const rel of rels) out[rel] = readWorktreeFile(root, rel)
    return out
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = rels.map((rel) => prefix + rel)
  const got = catBatch(root, specs, { maxBuffer: 1 << 28 })
  const out = {}
  rels.forEach((rel, i) => {
    out[rel] = got.get(specs[i]) ?? null
  })
  return out
}

export function runAudit({ root = ROOT, face } = {}) {
  const sel = face ? { face, error: null } : selectFace({ staged: false, worktree: false, def: 'head' })
  if (sel.error) throw new Undetermined(sel.error)
  const contents = readContents(root, sel.face)
  const res = decide(contents)
  return { face: sel.face, ...res, fileCount: Object.keys(contents).length }
}

// ---------------------------------------------------------------------------
// --self-test(构造面正反成对;变异一律"先证明文本真被改,再断言判据红" ——
// replace 打空会让用例因"什么都没变所以没问题"假绿,写门实录里栽过两次)
// ---------------------------------------------------------------------------

function mutate(src, from, to) {
  const at = src.indexOf(from)
  if (at < 0) return { src, changed: false }
  return { src: src.slice(0, at) + to + src.slice(at + from.length), changed: true }
}

function selfTest() {
  const cases = []
  const t = (name, ok) => cases.push({ name, ok })
  const base = readContents(ROOT, 'worktree')
  const withFile = (rel, src) => ({ ...base, [rel]: src })
  const D = decide

  const ok0 = D(base)
  t(
    '真仓工作树面:六份输入全取得到且解析出非空表(门不瞎)',
    Object.keys(base).length === 6 &&
      Object.values(base).every((v) => typeof v === 'string') &&
      ok0.undetermined.length === 0 &&
      !!ok0.tables &&
      ok0.tables.tsExact > 0 &&
      ok0.tables.pyLow > 0,
  )
  t(
    '表契约方向:绿灯时 Python 表 ⊆ TS 低窗口集 ⇒ tsLow ≥ pyLow',
    ok0.undetermined.length === 0 && ok0.tables.tsLowWindow >= ok0.tables.pyLow,
  )
  t('现读两侧同形 ⇒ 零漂移(红了就按报数清单逐键修,不削判据)', ok0.drifts.length === 0)

  // —— 任务书点名的阳性对照:"把 TS 一个 128000 改成 32000 必须点名该模型" ——
  {
    const m = mutate(base[FILES.tsCapacity], "'gpt-4o': 128_000", "'gpt-4o': 32_000")
    const r = D(withFile(FILES.tsCapacity, m.src))
    t(
      'C3 有牙:TS gpt-4o 128000→32000 必点名 gpt-4o(变异确生效、无连带误报)',
      m.changed &&
        r.drifts.length === 1 &&
        r.drifts[0].startsWith('C3') &&
        r.drifts[0].includes('gpt-4o'),
    )
  }
  {
    const m = mutate(base[FILES.tsCapacity], "'deepseek-chat': 64_000", "'deepseek-chat': 65_000")
    const r = D(withFile(FILES.tsCapacity, m.src))
    t(
      'C2 有牙:同键两侧值不等必点名该键并带出两侧值',
      m.changed &&
        r.drifts.some((d) => d.startsWith('C2 值不等') && d.includes('deepseek-chat') && d.includes('65000')),
    )
    const back = D(base)
    t('反向对照:不动两侧 ⇒ 该键不红', !back.drifts.some((d) => d.includes('deepseek-chat')))
  }
  {
    const m = mutate(
      base[FILES.pyWindow],
      '"gemma-2-27b-it": 8_192,',
      '"gemma-2-27b-it": 8_192,\n    "made-up-model": 8_000,',
    )
    const r = D(withFile(FILES.pyWindow, m.src))
    t(
      'C2 有牙:Python 孤儿条目(TS 无来源)必点名',
      m.changed && r.drifts.some((d) => d.startsWith('C2 Python 孤儿条目') && d.includes('made-up-model')),
    )
  }
  {
    const m = mutate(base[FILES.pyWindow], '"moonshot-v1-8k": 8_000,\n', '')
    const r = D(withFile(FILES.pyWindow, m.src))
    t(
      'C3 有牙:Python 漏抄一行必点名 moonshot-v1-8k',
      m.changed && r.drifts.some((d) => d.startsWith('C3') && d.includes('moonshot-v1-8k')),
    )
  }
  {
    const m = mutate(
      base[FILES.pyWindow],
      'DEFAULT_CONTEXT_WINDOW = 128_000',
      'DEFAULT_CONTEXT_WINDOW = 131_072',
    )
    const r = D(withFile(FILES.pyWindow, m.src))
    t(
      'C1 有牙:两侧兜底不同值 ⇒ 只红 C1 一条(22 行同值条目不误报)',
      m.changed && r.drifts.length === 1 && r.drifts[0].startsWith('C1'),
    )
  }
  {
    const py = mutate(base[FILES.pyWindow], '"gemma-2-9b-it": 8_192,', '"gemma-2-9b-it": 200_000,')
    const ts = mutate(base[FILES.tsCapacity], "'gemma-2-9b-it': 8_192,", "'gemma-2-9b-it': 200_000,")
    const r = D({ ...base, [FILES.pyWindow]: py.src, [FILES.tsCapacity]: ts.src })
    t(
      'C4 有牙:两侧同值但该行 ≥ 兜底 ⇒ 恰红一条 C4(不是 C2)',
      py.changed &&
        ts.changed &&
        r.drifts.length === 1 &&
        r.drifts[0].startsWith('C4') &&
        r.drifts[0].includes('gemma-2-9b-it'),
    )
  }
  {
    const m = mutate(
      base[FILES.pyEffort],
      '{"minimal", "low", "medium", "high"}',
      '{"low", "medium", "high"}',
    )
    const r = D(withFile(FILES.pyEffort, m.src))
    t(
      'C5 有牙:Py 档位集少一个 minimal 必点名(仅TS 档)',
      m.changed &&
        r.drifts.length === 1 &&
        r.drifts[0].startsWith('C5') &&
        r.drifts[0].includes('仅TS REASONING_EFFORTS=[minimal]'),
    )
    const neg = mutate(
      base[FILES.pyEffort],
      '{"minimal", "low", "medium", "high"}',
      '{"high","medium","low","minimal"}',
    )
    const r2 = D(withFile(FILES.pyEffort, neg.src))
    t('C5 反向对照:集合换书写顺序 ⇒ 不红(判的是集合不是抄写次序)', neg.changed && r2.drifts.length === 0)
  }
  {
    const m = mutate(
      base[FILES.tsEffort],
      "['minimal', 'low', 'medium', 'high']",
      "['minimal', 'low', 'medium', 'high', 'xhigh']",
    )
    const r = D(withFile(FILES.tsEffort, m.src))
    t(
      'C6 有牙:运行时数组加一档而联合没加 ⇒ C5 与 C6 同点名(两侧都不许装看不见)',
      m.changed &&
        r.drifts.some((d) => d.startsWith('C6') && d.includes('xhigh')) &&
        r.drifts.some((d) => d.startsWith('C5') && d.includes('xhigh')),
    )
  }
  {
    // D130 反向对照 A(票第 6 栏点名):契约层删一档 ⇒ 门必红且**两侧都点名**
    // (不能只说"契约层少了 minimal"而说不出它与谁分叉)。
    const m = mutate(
      base[FILES.tsEffortContract],
      "export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high'",
      "export type ReasoningEffort = 'low' | 'medium' | 'high'",
    )
    const r = D(withFile(FILES.tsEffortContract, m.src))
    t(
      'C6 有牙(第四落点):契约层少一个 minimal ⇒ 同时点名 cli 运行时数组与 cli 编译期联合两侧',
      m.changed &&
        r.drifts.some(
          (d) =>
            d.startsWith('C6') &&
            d.includes('仅运行时数组 REASONING_EFFORTS=[minimal]') &&
            d.includes('契约层'),
        ) &&
        r.drifts.some(
          (d) => d.startsWith('C6') && d.includes('仅 cli type ReasoningEffort=[minimal]'),
        ),
    )
    t('C6 第四落点反向对照:漂开的是契约层 ⇒ C5(py vs cli 数组)不得连带误报', !r.drifts.some((d) => d.startsWith('C5')))
  }
  {
    const m = mutate(
      base[FILES.tsEffortContract],
      "['minimal', 'low', 'medium', 'high']",
      "['minimal', 'low', 'medium', 'high', 'xhigh']",
    )
    const r = D(withFile(FILES.tsEffortContract, m.src))
    t(
      '契约层只加运行时投影数组而联合未加 ⇒ 判据不红(本门判的是联合字面量;satisfies 由 typecheck 钉,不得读成"本门已覆盖该型")',
      m.changed && r.drifts.length === 0,
    )
  }
  {
    const m = mutate(
      base[FILES.pyEffort],
      'known_efforts: frozenset[str] = frozenset({"minimal", "low", "medium", "high"})',
      'known_efforts: frozenset[str] = _DEFAULT_EFFORTS',
    )
    const r = D(withFile(FILES.pyEffort, m.src))
    t(
      '声明被换成运行时表达式 ⇒ 判不出(不比不猜,更不把"看不见"记成通过)',
      m.changed && r.undetermined.some((u) => u.includes('known_efforts')),
    )
  }
  {
    const c = { ...base }
    c[FILES.pyWindow] = c[FILES.pyWindow].replace(
      /LOW_WINDOW_OVERRIDES: dict\[str, int\] = \{[\s\S]*?\n\}/,
      'LOW_WINDOW_OVERRIDES: dict[str, int] = {}',
    )
    t('枚举到 0 条判死:空表不记绿', D(c).undetermined.some((u) => u.includes('判死')))
  }
  {
    const at = base[FILES.tsCapacity].indexOf("'gpt-4o': 128_000,")
    const src =
      base[FILES.tsCapacity].slice(0, at) +
      '[computed]: other_value,\n' +
      base[FILES.tsCapacity].slice(at)
    const r = D(withFile(FILES.tsCapacity, src))
    t(
      '表体出现解析不进的行 ⇒ 未判定并点名(残留不静默丢弃)',
      at >= 0 && r.undetermined.some((u) => u.includes('EXACT_CAPACITY')),
    )
  }
  {
    const r = D({})
    t(
      '零输入(全空面)不得被算作通过',
      r.drifts.length === 0 && r.undetermined.length > 0 && r.tables === null,
    )
  }
  {
    const c = { ...base }
    c[FILES.tsEffortType] = null
    t('一份输入取不到 ⇒ 计未判定而非记绿', D(c).undetermined.length === 1)
  }
  {
    const m = mutate(
      base[FILES.tsCapacity],
      "'qwen-max': 32_768,",
      "'qwen-max': 32_768,\n  'qwen-max': 8_000,",
    )
    const r = D(withFile(FILES.tsCapacity, m.src))
    t(
      '表内重复键按 last-wins 参与比对:C2 以 8000 点名 qwen-max 且 notes 报数',
      m.changed &&
        r.drifts.some((d) => d.startsWith('C2 值不等') && d.includes('qwen-max') && d.includes('8000')) &&
        r.notes.some((n) => n.includes('重复键')),
    )
  }
  {
    // 两侧各自的注释语法都要防住:py 体里是 `#`,js 体里是 `//` —— 把 `//` 喂给 py 判据
    // 是错的fixture(py 的 `//` 是整除运算符,不是注释),第一版就栽在这个夹具上。
    const p = parseNumberTable('"a": 1,\n# 注释里有 "b": 2\n', 'py')
    const j = parseNumberTable("'gpt-x': 128_000,\n// 说明里写 'b': 2\n", 'js')
    t(
      '注释里的键值行不得被读成条目(两侧同一防线,各按各语言的注释语法)',
      p.entries.size === 1 &&
        p.entries.has('a') &&
        p.residual === '' &&
        j.entries.size === 1 &&
        j.entries.has('gpt-x') &&
        j.residual === '',
    )
  }

  let pass = 0
  for (const c of cases) {
    console.log(`${c.ok ? '✅' : '❌'} ${c.name}`)
    if (c.ok) pass++
  }
  console.log(
    `--self-test:${pass}/${cases.length} 通过(真仓 ${JSON.stringify({ drifts: ok0.drifts.length, undetermined: ok0.undetermined.length })})`,
  )
  return pass === cases.length ? 0 : 1
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usage() {
  console.log(
    '用法: node scripts/check-model-capacity-parity.mjs [--staged|--worktree] [--root <dir>] [--strict] [--json] [--self-test]\n' +
      '缺省判 HEAD blob;--staged 判索引 blob;--worktree 仅人工逃生舱;两旗同给 exit 2。\n' +
      '默认档漂移只报数(待偿清单逐条打印但 exit 0);--strict 才判红(问责档)。',
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
  if (json) console.log(JSON.stringify({ face: res.face, ...res }, null, 2))
  else for (const n of res.notes) console.log(`   · ${n}`)

  if (res.undetermined.length > 0) {
    console.error(
      `⚠️ 无法判定:${res.undetermined.length} 项 —— ${res.undetermined.join(' | ')}(面=${res.face};既不记绿也不冒红)`,
    )
    process.exit(2)
  }
  if (res.drifts.length === 0) {
    if (!json) {
      const tb = res.tables
      console.log(
        `✅ 模型容量/推理档位跨语言对账通过(面=${res.face}):` +
          `TS EXACT ${tb.tsExact} 条(低窗口 ${tb.tsLowWindow})≡ Python LOW ${tb.pyLow} 条、` +
          `兜底两侧同为 ${tb.tsDefault}、推理档位四处齐等 [${tb.efforts.tsArray.join(',')}] ` +
          `(落点:${Object.keys(tb.efforts).join('/')})`,
      )
    }
    process.exit(0)
  }
  if (!json) {
    console.log(
      strict
        ? `❌ 检出 ${res.drifts.length} 处跨语言漂移(面=${res.face},--strict 判红):`
        : `⚠️ 检出 ${res.drifts.length} 处跨语言漂移(面=${res.face};默认档只报数,以下即逐键待偿清单;--strict 判红):`,
    )
    for (const d of res.drifts) console.log(`   · ${d}`)
    console.log(
      '改法:两处声明是**同一批事实的两份抄本** —— 容量表以 packages/api-client 的 EXACT_CAPACITY\n' +
        '     为母表;推理档位以 packages/types/reasoning-effort.ts 联合 + cli types.ts 联合 +\n' +
        '     precedence.ts 数组 + py known_efforts 四处同笔改。\n' +
        '     不得为消红单删 Python 条目(那是把敞口藏起来),不得放宽判据、不得写豁免清单。',
    )
  }
  process.exit(strict ? 1 : 0)
}

export const __test__ = {
  FILES,
  SELF_SKIP,
  decide,
  runAudit,
  readContents,
  parseTsCapacity,
  parsePyWindow,
  parsePyEfforts,
  parseTsArraySet,
  parseTsUnion,
  stripBodyComments,
  sliceBalanced,
  parseNumberTable,
  parseStringSet,
  toNumberLit,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
