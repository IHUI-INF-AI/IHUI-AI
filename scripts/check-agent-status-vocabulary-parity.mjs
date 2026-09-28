#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。
// 子智能体 / 后台进程「状态词汇」的跨语言 + 跨端对账门(D6/G3,2026-09-27 立)。
//
// 【接线状态:尚未进提交链】只有本文件 + 镜像测试;注册与点名由主会话统一落(注册表是
// 多会话共写面,并行改必互相覆盖注册块)。头注刻意不声称已挂钩子、不自称"第 N 项"。
//
// 病(逐条 file:line 取证见 docs/d6-convergence-audit-2026-09-27.md §2.3):Kanban 六态在
// 全仓有四份各自实现(@ihui/types 联合 + dag_scheduler.py 的 Literal + KanbanBoard.tsx 的列
// 序 + agent-tasks-panel.tsx 的 STATUS_CLASS),而**没有一道门看这一族成员集合** ——
// bg-task-type-parity 只管 executor 接线、agent-event-parity 只管 SSE 事件名。改一处忘改
// 另一处表现为"Web 按六态渲染、Python 按另一套跑状态机",typecheck 与单测全都不会红。
//
// 判据(输入按被审面现读,不 import、不执行被审实现):
//   SV1 跨语言逐字等值:TS AGENT_TASK_STATUSES ≡ TS 联合(字面量形态才比,`typeof X)[number]
//     派生形态记 derived)≡ Python KANBAN_TASK_STATUSES ≡ Python Literal[...]。多/少/改拼写
//     都红。Python import 不到 TS,**显式对齐表是被允许的形态,但必须有门判等值** —— 没有门
//     看守的登记表必然腐烂(§4 对 RN_ONLY_BRAND_KEYS 的教训)。
//   SV2 真相源内部自洽:ALLOWED_TRANSITIONS 键集 ≡ STATUS_VARIANTS 键集 ≡ 成员集合;
//     LEGACY_STATUS_MAP 的值必须落在成员集合内;第二域 WORKSPACE_AGENT_TASK_STATUSES 非空
//     且与成员集合**交集为空**(两域相交后端内两份 STATUS_CLASS 各自猜它是哪个域)。
//   SV3 端内第二份成员清单:某文件代码面(注释不计)出现 ≥COPY_THRESHOLD 个不同成员字面量
//     且不含任一 canonical 标识符 ⇒ 违规。棘轮锚点 = 该文件 HEAD 面的同一判定结果 ⇒ 只有
//     新增才判红;被审面即锚点面的那一档(全量)拿不到"新",只报名并把原因印出来。
//
// 三态绝不并桶:输入取不到 / 声明解析不到 / 表体有解析不进的行 / 候选枚举到 0 ⇒ 未判定
// exit 2(既不冒红也绝不记绿)。定级:默认档违规只报数 exit 0,--strict 才判红 —— 与本次
// 提交无关的恒红门唯一结局是逼人 --no-verify、连带废掉全部守门(AGENTS §12e)。
// 两旗同给 exit 2;--root 只在 --worktree 档有效(换根仍按 HEAD 读 = 双根分裂,判死)。
//
// 覆盖边界(如实登记,不得读成"已确认没有"):判的是**声明层**,改成运行时计算 ⇒ 未判定
// 而非跳过;六态值是落库/REST/SSE 三重对外契约,**本门不改任何已在线上的字符串值**;
// apps/api 的两份 z.enum 与 web 的 TaskDetailDialog 等副本不在本票清单内 ⇒ 只报名不代裁。

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { maskCommentsAndStrings } from './lib/code-mask.mjs'
import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 注册进提交链时 runner 条目应使用的应急跳过名(由主会话落,本门不自行接线) */
export const SELF_SKIP = 'HUSKY_SKIP_AGENT_STATUS_VOCAB_PARITY'

export const FILES = {
  tsTypes: 'packages/types/src/agent-runtime.ts',
  pyScheduler: 'apps/ai-service/app/services/dag_scheduler.py',
}

/** 判据引用的 canonical 符号名(改名要两侧同笔改,否则本门判"解析不到声明") */
export const SYMBOLS = {
  tsArray: 'AGENT_TASK_STATUSES',
  tsUnion: 'AgentTaskStatus',
  transitions: 'ALLOWED_TRANSITIONS',
  variants: 'STATUS_VARIANTS',
  legacyMap: 'LEGACY_STATUS_MAP',
  pyTable: 'KANBAN_TASK_STATUSES',
  pyLiteral: 'AgentTaskStatus',
  wsArray: 'WORKSPACE_AGENT_TASK_STATUSES',
}

/** SV3 的引用豁免:代码面出现其中任一标识符 ⇒ 该文件算"引用同一份"而不是凭空自立一份 */
export const CANONICAL_REFS = [SYMBOLS.tsArray, SYMBOLS.pyTable, SYMBOLS.tsUnion]

/** 一个文件出现 ≥N 个不同成员字面量才算"整表抄了一份"(低于该阈值会把单点判断全数成百地报出来) */
export const COPY_THRESHOLD = 4

/** SV3 扫描面(目录前缀 + 扩展名,二者必须同时是判据的超集 —— 守门 77/102 的"预筛漏形态=门全盲"同型) */
const SCAN_PREFIXES = ['apps/', 'packages/', 'scripts/']
const SCAN_EXTS = ['.ts', '.tsx', '.py']
const SKIP_RE = /(^|\/)(node_modules|dist|\.next|\.venv|__tests__|tests?|e2e)\//

/**
 * 本门自身与夹具必然逐字写出六态成员(夹具不写就没法证明判据有牙),按路径前缀自豁免 ——
 * 与守门 79(冲突标记门)/ 102 同一护栏形态。不自豁免的话,门会把自己判成"第二份抄本",
 * 而落地那枚提交恰好是**新增**,棘轮救不了它。
 */
export const SELF_EXEMPT_RE = /check-agent-status-vocabulary-parity/

// 取材与遮罩:遮罩实现只有一份(code-mask),本门**不得**留第二份

/** 等长遮罩 ⇒ 可按字符下标回映射到原始行;注释与字符串被抹,标点与标识符保留。 */
function mask(src) {
  return maskCommentsAndStrings(src.replace(/\r\n/g, '\n'))
}

/** 逐行"是否为代码行"(遮罩后仍有非空白字符即为代码行)。 */
function codeFlags(src) {
  const m = mask(src)
  return m.split('\n').map((l) => l.trim() !== '')
}

/**
 * 从 openIdx(指向开括号)起按括号配平找闭括号,**只用遮罩面计数** ——
 * 注释/字符串里的括号不再干扰配平(本仓实测:说明性文字也会带执行性字符)。
 */
function balanceRange(masked, openIdx) {
  let depth = 0
  let line = 0
  const starts = []
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] === '\n') line++
    if (i < openIdx) continue
    const c = masked[i]
    if (c === '[' || c === '(' || c === '{') {
      depth++
      starts.push(line)
    } else if (c === ']' || c === ')' || c === '}') {
      depth--
      if (depth === 0) return { startLine: starts[0], endLine: line }
      if (depth < 0) return null
    }
  }
  return null
}

/** 声明定位:行锚定 + 要求 `=`(表名在 docstring/注释里被反复提及,裸 indexOf 会先撞上散文)。 */
function declIndex(src, name, kindRe, label) {
  const s = src.replace(/\r\n/g, '\n')
  // `const` 是可选段:TS 侧一律 `export const X = ...`,Python 侧是裸 `X = ...`。
  // 中段可选段(`(?:[^\n[({]*)`)吃掉 `= Literal[...]` / `= tuple[str, ...] = (` 这类
  // **等号与开括号之间的类型名/注解** —— 少了它,Python 侧两个声明整类解析不到,
  // 而"解析不到"表现为未判定:一台永远喊未判定的门和一台瞎掉的门在账面上是一样的。
  const re = new RegExp(
    `^[ \\t]*(?:export[ \\t]+)?(?:const[ \\t]+)?${name}\\b[^\\n]*=[ \\t]*(?:[^\\n[({]*)${kindRe}`,
    'm',
  )
  const m = re.exec(s)
  if (!m) throw new Undetermined(`解析不到声明:${label}(该侧成员表被改名/改形态,不猜)`)
  const openIdx = m.index + m[0].length - 1
  return { src: s, openIdx }
}

/**
 * 从一个括号体内收集**代码行**上的字符串字面量(注释行不计,字符串内容取自原文)。
 * residual 只统计**体内行** —— 首行是声明(`X: tuple[...] = (`)、末行是闭合(`) as const`),
 * 把它们算成"解析不进的行"会让每一个合法声明都判未判定(本门第一版就栽在这里)。
 */
function literalsInBody(src, startLine, endLine) {
  const rawLines = src.split('\n')
  const flags = codeFlags(src)
  const items = []
  let residual = 0
  for (let i = startLine; i <= endLine && i < rawLines.length; i++) {
    if (!flags[i]) continue // 遮罩后整行为空 ⇒ 纯注释行(说明文字不计条目)
    const line = rawLines[i]
    let hit = 0
    for (const mm of line.matchAll(/'([^'\n]*)'|"([^"\n]*)"/g)) {
      items.push(mm[1] !== undefined ? mm[1] : mm[2])
      hit++
    }
    if (hit > 0 || i === startLine || i === endLine) continue
    const rest = line.replace(/'[^'\n]*'|"[^"\n]*"/g, '')
    if (/[\w[{(]/.test(rest)) residual += 1
  }
  return { items, residual }
}

/**
 * 括号体内逐行取对象项(代码行)。want='key' 取键(`key:` / `'key':` 两形态),
 * want='value' 取 `key: 'value'` 的值档。两形态此前各写一遍 —— 一处漂移另一处照绿,
 * 正是本门要防的形状,所以合成一份实现。
 */
function objectEntries(src, startLine, endLine, want) {
  const rawLines = src.split('\n')
  const flags = codeFlags(src)
  const out = []
  let residual = 0
  const re =
    want === 'key'
      ? /^[ \t]*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))[ \t]*:/
      : /^[ \t]*(?:'[^']+'|"[^"]+"|[A-Za-z_$][\w$]*)[ \t]*:[ \t]*(?:'([^']+)'|"([^"]+)")/
  for (let i = startLine + 1; i <= endLine && i < rawLines.length; i++) {
    if (!flags[i]) continue
    const line = rawLines[i]
    const m = re.exec(line)
    if (m) {
      out.push(want === 'key' ? (m[1] ?? m[2] ?? m[3]) : (m[1] ?? m[2]))
      continue
    }
    if (/^[ \t]*\}[;,]?$/.test(line)) continue
    residual += 1
  }
  return want === 'key' ? { keys: out, residual } : { values: out, residual }
}

export function parseArraySet(src, name, label) {
  const { src: s, openIdx } = declIndex(src, name, '[[(]', label)
  const r = balanceRange(mask(s), openIdx)
  if (!r) throw new Undetermined(`${label} 括号配平不到闭括号(不猜)`)
  const { items, residual } = literalsInBody(s, r.startLine, r.endLine)
  return { items, residual }
}

/** TS 联合:字面量形态与 `(typeof X)[number]` 派生形态都认,后者标 derived。 */
export function parseTsUnion(src, typeName, label) {
  const s = src.replace(/\r\n/g, '\n')
  const re = new RegExp(`^[ \\t]*export[ \\t]+type[ \\t]+${typeName}[ \\t]*=[ \\t]*([^\\n]*)`, 'm')
  const m = re.exec(s)
  if (!m) throw new Undetermined(`解析不到声明:${label}`)
  const rhs = m[1].replace(/;[ \t]*$/, '')
  const derived = /^\(typeof[ \t]+([A-Za-z_$][\w$]*)\)\[number\]$/.exec(rhs.trim())
  if (derived) return { items: [], residual: 0, derivedFrom: derived[1] }
  if (rhs.trim() === '') throw new Undetermined(`${label} 的 ` + '`=`' + ' 后取不到内容(不猜)')
  const set = { items: [], residual: 0 }
  const rest = (rhs + ' ').split(/\|/)
  for (const piece of rest) {
    const t = piece.trim().replace(/;$/, '').trim()
    if (t === '') continue
    const q = /^'([^']+)'$/.exec(t) ?? /^"([^"]+)"$/.exec(t)
    if (q) set.items.push(q[1])
    else {
      set.residual += 1
    }
  }
  return { items: set.items, residual: set.residual, derivedFrom: null }
}

/** 对象字面量表:按 want 取顶层键或值档(以及判不出的行)。 */
function parseRecordBody(src, name, label, want) {
  const { src: s, openIdx } = declIndex(src, name, '[{]', label)
  const r = balanceRange(mask(s), openIdx)
  if (!r) throw new Undetermined(`${label} 括号配平不到闭括号(不猜)`)
  return objectEntries(s, r.startLine, r.endLine, want)
}

export const parseRecordKeys = (src, name, label) => parseRecordBody(src, name, label, 'key')
export const parseRecordStringValues = (src, name, label) =>
  parseRecordBody(src, name, label, 'value')

// 判据聚合(纯函数:构造面即可证明三态分流,不必真机改名 —— 守门 103 T12 那一课)

function dedupe(items) {
  const seen = new Set()
  const dups = []
  for (const it of items) {
    if (seen.has(it)) dups.push(it)
    else seen.add(it)
  }
  return { set: seen, dups }
}

function diffSets(a, b) {
  return {
    onlyA: [...a].filter((x) => !b.has(x)).sort(),
    onlyB: [...b].filter((x) => !a.has(x)).sort(),
  }
}

function eqSets(name, a, b, labelA, labelB, violations) {
  const d = diffSets(a, b)
  if (d.onlyA.length + d.onlyB.length === 0) return
  violations.push(
    `${name} 成员集合不等:仅${labelA}=[${d.onlyA.join(',')}] 仅${labelB}=[${d.onlyB.join(',')}]`,
  )
}

/**
 * SV3 单文件判定(纯函数):代码面上 ≥阈值 个不同成员字面量 ⇒ 候选第二份;不含任一
 * canonical 标识符 ⇒ 违规。已知边界:只按**类型**引用 canonical、运行时另抄一份数组的形态
 * (apps/api 的 `z.enum([...])`)被算作合规 —— 那一格没有判据,不得读成"抄本都已对账"。
 */
export function judgeCopy(codeMaskedSrc, rawSrc, memberSet) {
  void codeMaskedSrc
  const rawLines = rawSrc.split('\n')
  const flags = codeFlags(rawSrc)
  const found = new Set()
  const codeOnly = new Set()
  for (let i = 0; i < rawLines.length; i++) {
    for (const lit of [...rawLines[i].matchAll(/'([^'\n]+)'|"([^"\n]+)"/g)]) {
      const v = lit[1] !== undefined ? lit[1] : lit[2]
      if (!memberSet.has(v)) continue
      found.add(v)
      // 遮罩后仍非空 ⇒ 该行有代码(注释行/整行说明文字被抹成空白)
      if (flags[i]) codeOnly.add(v)
    }
  }
  const members = [...codeOnly].sort()
  if (members.length < COPY_THRESHOLD) {
    const commentOnly = codeOnly.size === 0 && found.size > 0 ? [...found].sort() : undefined
    return { candidate: false, violation: false, members, commentOnly }
  }
  const codeFace = rawLines.filter((_, i) => flags[i]).join('\n')
  const hasRef = CANONICAL_REFS.some((r) => codeFace.includes(r))
  return { candidate: true, violation: !hasRef, members }
}

/**
 * @param {{tsTypes?:string|null, pyScheduler?:string|null, candidates?:Array<{path:string,src:string|null}>}} inputs
 */
export function decide(inputs) {
  const undetermined = []
  const ts = inputs[FILES.tsTypes] ?? inputs.tsTypes ?? null
  const py = inputs[FILES.pyScheduler] ?? inputs.pyScheduler ?? null
  if (typeof ts !== 'string' || ts.length === 0)
    undetermined.push(`被审面取不到 TS 单一真相源:${FILES.tsTypes}`)
  if (typeof py !== 'string' || py.length === 0)
    undetermined.push(`被审面取不到 Python 对齐表:${FILES.pyScheduler}`)
  if (undetermined.length > 0)
    return { violations: [], notes: [], undetermined, tables: null, candidates: [] }

  let tsArray, tsUnion, trans, variants, legacy, pyTable, pyLiteral, wsArray
  try {
    tsArray = parseArraySet(ts, SYMBOLS.tsArray, `TS ${SYMBOLS.tsArray}`)
    tsUnion = parseTsUnion(ts, SYMBOLS.tsUnion, `TS type ${SYMBOLS.tsUnion}`)
    trans = parseRecordKeys(ts, SYMBOLS.transitions, `TS ${SYMBOLS.transitions}`)
    variants = parseRecordKeys(ts, SYMBOLS.variants, `TS ${SYMBOLS.variants}`)
    legacy = parseRecordStringValues(ts, SYMBOLS.legacyMap, `TS ${SYMBOLS.legacyMap}`)
    pyTable = parseArraySet(py, SYMBOLS.pyTable, `Python ${SYMBOLS.pyTable}`)
    pyLiteral = parseArraySet(py, SYMBOLS.pyLiteral, 'Python AgentTaskStatus = Literal[...]')
    wsArray = parseArraySet(ts, SYMBOLS.wsArray, `TS ${SYMBOLS.wsArray}`)
  } catch (e) {
    if (e instanceof Undetermined)
      return { violations: [], notes: [], undetermined: [e.message], tables: null, candidates: [] }
    throw e
  }

  const L_TS = `TS ${SYMBOLS.tsArray}`
  const L_PT = `Py ${SYMBOLS.pyTable}`
  const L_PL = `Py Literal ${SYMBOLS.pyLiteral}`
  const L_T = `TS ${SYMBOLS.transitions}`
  const L_V = `TS ${SYMBOLS.variants}`
  const L_W = `TS ${SYMBOLS.wsArray}`
  const L_LEGACY = `TS ${SYMBOLS.legacyMap}`
  const A = dedupe(tsArray.items)
  const U = dedupe(tsUnion.items)
  const T = dedupe(trans.keys)
  const V = dedupe(variants.keys)
  const PT = dedupe(pyTable.items)
  const PL = dedupe(pyLiteral.items)
  const W = dedupe(wsArray.items)

  // "扫到 0"必须先怀疑尺子,再相信世界;表体有解析不进的行同样按判不出处理 ——
  // 带着半张表去比对会产出自洽却错位的尺子,而"看不见"绝不能记成通过。
  const READS = [
    [L_TS, tsArray, A],
    [L_PT, pyTable, PT],
    [L_PL, pyLiteral, PL],
    [L_W, wsArray, W],
    [L_T, trans, T],
    [L_V, variants, V],
    [L_LEGACY, legacy, null],
  ]
  for (const [lbl, r, d] of READS) {
    if (d && d.set.size === 0) undetermined.push(`${lbl} 枚举到 0 ⇒ 判死(不带着半张表比对)`)
    if (r.residual > 0) undetermined.push(`${lbl} 体内 ${r.residual} 行解析不进判据(不猜)`)
  }
  if (tsUnion.derivedFrom && tsUnion.derivedFrom !== SYMBOLS.tsArray)
    undetermined.push(
      `TS 联合派生自 ${tsUnion.derivedFrom} 而非 ${SYMBOLS.tsArray} —— 第二份真相的形态,本门不认(不猜它等不等于清单)`,
    )
  if (undetermined.length > 0)
    return { violations: [], notes: [], undetermined, tables: null, candidates: [] }

  const violations = []
  const notes = []
  const SV1 = 'SV1'
  const SV2 = 'SV2'

  // ---- SV1 跨语言 / 跨形态成员集合等值 ----
  if (!tsUnion.derivedFrom) eqSets(SV1, A.set, U.set, L_TS, `type ${SYMBOLS.tsUnion}`, violations)
  eqSets(SV1, A.set, PT.set, L_TS, L_PT, violations)
  eqSets(SV1, A.set, PL.set, L_TS, L_PL, violations)

  // ---- SV2 单一真相源内部自洽 ----
  eqSets(SV2, A.set, T.set, L_TS, SYMBOLS.transitions, violations)
  eqSets(SV2, A.set, V.set, L_TS, SYMBOLS.variants, violations)
  const legacyOut = [...new Set(legacy.values)].filter((v) => !A.set.has(v)).sort()
  if (legacyOut.length > 0)
    violations.push(`SV2 ${SYMBOLS.legacyMap} 的值落在成员集合之外:[${legacyOut.join(',')}]`)
  const cross = [...W.set].filter((x) => A.set.has(x)).sort()
  if (cross.length > 0)
    violations.push(
      `SV2 两域相交:[${cross.join(',')}] 同时出现在 Kanban 成员集与 ${SYMBOLS.wsArray} —— 端内两份 STATUS_CLASS 会各自猜它是哪个域`,
    )

  const dups = [...A.dups, ...PT.dups, ...PL.dups, ...W.dups]
  if (dups.length > 0) notes.push(`表内重复成员(last-wins,只报数):[${dups.join(',')}]`)

  const candidates = []
  const buildTables = () => ({
    members: [...A.set].sort(),
    count: A.set.size,
    tsUnionDerived: tsUnion.derivedFrom ?? null,
    pyTableCount: PT.set.size,
    pyLiteralCount: PL.set.size,
    transitionsCount: T.set.size,
    variantsCount: V.set.size,
    wsMembers: [...W.set].sort(),
    candidateFiles: candidates.length,
  })

  // ---- SV3 端内第二份成员清单 ----
  // candidates **缺席**(未提供)= 调用方只取成员集合的预读轮,不判该维、也不算判死;
  // candidates **空数组** = 枚举跑完真的一个候选都没有 ⇒ 判死(扫描面/预筛漂了)。
  // 两者必须分开,否则 runAudit 的预读轮会把自己判成"无法判定"而永远出不来成员集合。
  if (!Array.isArray(inputs.candidates)) {
    notes.push('SV3 本轮未提供候选清单(仅取 canonical 成员集合,不代表全仓无副本)')
    return { violations, notes, undetermined, candidates, tables: buildTables() }
  }
  const candList = inputs.candidates
  if (candList.length === 0) {
    undetermined.push('SV3 候选枚举到 0 个文件 ⇒ 判死(扫描面/预筛漂了,不得当成"没有副本")')
    return { violations, notes, undetermined, tables: null, candidates }
  }
  for (const c of candList) {
    if (typeof c.src !== 'string' || c.src.length === 0) {
      undetermined.push(`SV3 候选取不到内容:${c.path}`)
      continue
    }
    const j = judgeCopy(mask(c.src), c.src, A.set)
    if (j.commentOnly && j.commentOnly.length > 0)
      notes.push(`仅注释提到成员字面量(不计第二份):${c.path} [${j.commentOnly.join(',')}]`)
    if (!j.candidate) continue
    candidates.push({ path: c.path, members: j.members, violation: j.violation })
    if (j.violation)
      violations.push(
        `SV3 端内第二份成员清单:${c.path}(${j.members.length} 个成员字面量,未引用 canonical)`,
      )
  }

  return {
    violations,
    notes,
    undetermined,
    candidates,
    tables: buildTables(),
  }
}

// 取材(清单与内容必须同面同轮 —— 混面取数会产出自洽却错位的尺子)

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
 * 预筛:必须是判据字面量的**严格超集**(判据要求"≥4 个不同成员",故含任一成员即候选)。
 * 成员集合由被审面解析得出 ⇒ 超集性质由构造保证,不靠人记得同步模式串。
 */
function grepCandidates(root, face, members) {
  const args = ['grep', '-l', '-I', '--no-color']
  for (const m of members) args.push('-e', m)
  if (face === 'staged') args.push('--cached')
  else args.push('HEAD')
  args.push('--', 'apps', 'packages', 'scripts')
  let out
  try {
    out = gitRaw(args, root)
  } catch (e) {
    if (e instanceof Undetermined && e.status === 1) return []
    throw new Undetermined(`SV3 预筛派生失败(${face} 面):${e.message}`)
  }
  return out
    .split('\n')
    .map((l) => l.replace(/^HEAD:/, '').trim())
    .filter(
      (p) =>
        p.length > 0 &&
        !SKIP_RE.test(p) &&
        !SELF_EXEMPT_RE.test(p) &&
        SCAN_PREFIXES.some((d) => p.startsWith(d)) &&
        // 扩展名过滤必须与判据同一条:漏了它,语言包 JSON(逐字含六态的**译文键**)
        // 会被当成"第二份抄本"整片报红 —— 那是把键名读成成员表(实测踩过)。
        SCAN_EXTS.some((e) => p.endsWith(e)),
    )
}

export function runAudit({ root = ROOT, face } = {}) {
  const sel = face
    ? { face, error: null }
    : selectFace({ staged: false, worktree: false, def: 'head' })
  if (sel.error) throw new Undetermined(sel.error)
  const canonical = readContents(root, sel.face, Object.values(FILES))
  // 预读轮**不给 candidates**(空数组是"枚举跑了而一个都没有"= 判死,不是"这一轮不判该维")
  const pre = decide({ ...canonical })
  // 成员集合读不出来(含 candidates=0 那条)时先按 canonical 的 undetermined 报死,
  // 不带着"猜出来的成员表"去扫全仓。
  const members = pre.tables ? pre.tables.members : null
  if (members === null) {
    return { face: sel.face, ...pre, fileCount: Object.keys(canonical).length }
  }
  const candPaths = grepCandidates(root, sel.face, members).filter(
    (p) => !Object.values(FILES).includes(p),
  )
  const candContents = readContents(root, sel.face, candPaths)
  let headCopyState = null
  if (sel.face === 'staged') {
    const hc = readContents(root, 'head', candPaths)
    headCopyState = {}
    for (const p of candPaths) {
      const src = hc[p]
      if (typeof src !== 'string' || src.length === 0) {
        headCopyState[p] = null
        continue
      }
      headCopyState[p] = judgeCopy(mask(src), src, new Set(members)).violation
    }
  }
  const candidates = candPaths.map((p) => ({ path: p, src: candContents[p] }))
  const res = decide({ ...canonical, candidates })
  // 棘轮:只拦"本次改动新引入的第二份";HEAD 已经是第二份的,算存量、只报名。
  let ratcheted = res.violations
  let inherited = []
  if (res.tables && headCopyState) {
    const newly = res.candidates.filter((c) => headCopyState[c.path] !== true)
    inherited = res.candidates.filter((c) => headCopyState[c.path] === true).map((c) => c.path)
    const keep = new Set(newly.map((c) => c.path))
    ratcheted = res.violations.filter((v) => {
      const m = /^SV3 端内第二份成员清单:(\S+)/.exec(v)
      return !m || keep.has(m[1])
    })
  }
  if (res.tables && sel.face !== 'staged')
    res.notes.push(
      `SV3 本档不判红的原因:被审面(${sel.face})就是锚点面 ⇒ 拿不到"新引入"这一维(锚点与结论同面)。要问责新增副本,跑 --staged。`,
    )
  return {
    face: sel.face,
    ...res,
    violations: ratcheted,
    sv3Inherited: inherited,
    fileCount: Object.keys(canonical).length + candidates.length,
  }
}

// --self-test(构造面正反成对;变异一律先证明文本真被改,再断言判据红)

const FIXTURE_TS = `
export const AGENT_TASK_STATUSES = ['aa', 'bb', 'cc', 'dd'] as const
export type AgentTaskStatus = (typeof AGENT_TASK_STATUSES)[number]
export const ALLOWED_TRANSITIONS: Record<AgentTaskStatus, AgentTaskStatus[]> = {
  aa: ['bb'],
  bb: ['cc'],
  cc: ['dd'],
  dd: [],
}
export const STATUS_VARIANTS: Record<AgentTaskStatus, string[]> = {
  aa: ['aa', 'zz'],
  bb: ['bb'],
  cc: ['cc'],
  dd: ['dd', 'qq'],
}
export const LEGACY_STATUS_MAP: Record<string, AgentTaskStatus> = {
  zz: 'aa',
  qq: 'dd',
}
export const WORKSPACE_AGENT_TASK_STATUSES = ['w1', 'w2'] as const
export type WorkspaceAgentTaskStatus = (typeof WORKSPACE_AGENT_TASK_STATUSES)[number]
`
const FIXTURE_PY = `
AgentTaskStatus = Literal["aa", "bb", "cc", "dd"]
KANBAN_TASK_STATUSES: tuple[str, ...] = (
    "aa",
    "bb",
    "cc",
    "dd",
)
`
const FIXTURE_COPY_OK = `
import { AGENT_TASK_STATUSES } from '@ihui/types'
export const COLS = AGENT_TASK_STATUSES
`
const FIXTURE_COPY_BAD = `
export const COLS = ['aa', 'bb', 'cc', 'dd']
`
const FIXTURE_COPY_COMMENT = `
// 逐条列出只是说明:'aa' 'bb' 'cc' 'dd' —— 注释不是代码
const A = 1
`

function selfTest() {
  const cases = []
  const t = (name, ok) => cases.push({ name, ok })
  const D = (o = {}) =>
    decide({ [FILES.tsTypes]: FIXTURE_TS, [FILES.pyScheduler]: FIXTURE_PY, ...o })
  const py = (s) => D({ [FILES.pyScheduler]: s })
  const ts = (s) => D({ [FILES.tsTypes]: s })
  const cd = (p, s) => D({ candidates: [{ path: p, src: s }] })
  const V = (r, p, m) => r.violations.some((v) => v.startsWith(p) && v.includes(m))
  const U = (r, m) => r.undetermined.some((u) => u.includes(m))
  const N = (r, m) => r.notes.some((n) => n.includes(m))
  const mu = (s, a, b) => ({ c: s.includes(a), s: s.replace(a, b) })
  const LIT = 'AgentTaskStatus = Literal["aa", "bb", "cc", "dd"]'
  const DER = 'export type AgentTaskStatus = (typeof AGENT_TASK_STATUSES)[number]'

  const ok0 = cd('x.tsx', FIXTURE_COPY_OK)
  t('A0 夹具两侧同形、门看得见表', ok0.violations.length === 0 && ok0.tables.count === 4)
  t('A1 候选枚举到 0 ⇒ 判死不记绿', U(D({ candidates: [] }), '判死'))
  t('A1b 未提供候选不算判死,但须声明未扫', !D({}).undetermined.length && N(D({}), '未提供候选'))
  t('A2 SV3 有牙:新抄一份必点名', V(cd('bad.tsx', FIXTURE_COPY_BAD), 'SV3', 'bad.tsx'))
  t('A3 SV3 反向:引用同一份不判红', !V(ok0, 'SV3', 'x.tsx'))
  const cm = cd('docs.ts', FIXTURE_COPY_COMMENT)
  t('A4 注释散文不计抄本,但须报名', !V(cm, 'SV3', 'docs.ts') && N(cm, '仅注释提到'))
  const m5 = mu(FIXTURE_PY, '"cc",', '"cc",\n    "bogus",')
  t('A5 SV1 有牙:Py 多一档点名', m5.c && V(py(m5.s), 'SV1', 'bogus'))
  const m6 = mu(FIXTURE_PY, '\n    "dd",', '')
  t('A6 SV1 有牙:Py 少一档点名', m6.c && V(py(m6.s), 'SV1', '=[dd]'))
  const m7 = mu(FIXTURE_PY, LIT, 'AgentTaskStatus = Literal["aa", "bb", "cc"]')
  t('A7 SV1 有牙:Literal 与对齐表分叉也点名', m7.c && V(py(m7.s), 'SV1', 'Literal'))
  const m8 = mu(FIXTURE_TS, '  dd: [],\n', '')
  t('A8 SV2 有牙:状态机表少键', m8.c && V(ts(m8.s), 'SV2', 'ALLOWED_TRANSITIONS'))
  const m9 = mu(FIXTURE_TS, "qq: 'dd',", "qq: 'ff',")
  t('A9 SV2 有牙:LEGACY 值落在集合外', m9.c && V(ts(m9.s), 'SV2', 'ff'))
  const m10 = mu(FIXTURE_TS, "['w1', 'w2']", "['cc', 'w2']")
  t('A10 SV2 有牙:两域相交点名', m10.c && ts(m10.s).violations.some((v) => v.includes('两域相交')))
  const m11 = mu(FIXTURE_TS, DER, "export type AgentTaskStatus = 'aa' | 'bb' | 'cc' | 'dd' | 'ee'")
  t('A11 联合改回字面量并加一档 ⇒ SV1', m11.c && V(ts(m11.s), 'SV1', 'ee'))
  const m12 = mu(FIXTURE_TS, DER, 'export type AgentTaskStatus = (typeof OTHER)[number]')
  t('A12 派生自别的名字 ⇒ 未判定', m12.c && U(ts(m12.s), 'OTHER'))
  const m13 = mu(FIXTURE_PY, LIT, 'AgentTaskStatus = _STATUS_FROM_ENV')
  t('A13 声明换成运行时式 ⇒ 判不出', m13.c && U(py(m13.s), '解析不到声明'))
  const a14 = decide({ [FILES.tsTypes]: '', [FILES.pyScheduler]: FIXTURE_PY })
  t(
    'A14 输入取不到 ⇒ 未判定零违规',
    a14.tables === null && !a14.violations.length && U(a14, '取不到'),
  )
  const m15 = mu(FIXTURE_PY, '(\n    "aa",\n    "bb",\n    "cc",\n    "dd",\n)', '()')
  t('A15 空表判死,不记两侧一致', m15.c && U(py(m15.s), '判死'))

  // 真仓对照跑工作树面:单一真相源与本门同枚提交落地,HEAD 面在落地前必然读不到
  // AGENT_TASK_STATUSES ⇒ 判未判定(A14 已钉"取不到 ⇒ 未判定、不记绿")。由此一条硬要求:
  // **本门必须与源码改动同枚提交入库**,否则干净检出上提交链里它一路喊未判定。
  let real = null
  try {
    real = runAudit({ face: 'worktree' })
  } catch (e) {
    real = { error: e instanceof Undetermined ? e.message : String(e) }
  }
  const tb = real && !real.error ? real.tables : null
  const rv = (real && real.violations) || []
  const sv12 = rv.filter((v) => !v.startsWith('SV3'))
  t('B0 真仓:两侧读得出且 SV1/SV2 零分叉', !!tb && tb.count >= 4 && sv12.length === 0)
  t('B1 真仓:SV3 候选看得见(空扫=尺子漂)', !!tb && tb.candidateFiles >= 1)
  t('B1b 真仓:译文键不得被算成抄本', !rv.some((v) => v.includes('i18n/messages')))
  t(
    'B1d 自豁免方向锁:候选里不得有本门文件',
    !(real.candidates || []).some((c) => c.path.includes('agent-status-vocabulary')),
  )
  t(
    'B2 真仓:四张表键数与成员集合一致',
    !!tb &&
      tb.pyTableCount === tb.count &&
      tb.pyLiteralCount === tb.count &&
      tb.transitionsCount === tb.count &&
      tb.variantsCount === tb.count,
  )
  const stat =
    real && !real.error
      ? JSON.stringify({
          members: tb ? tb.count : null,
          violations: rv.length,
          undetermined: real.undetermined.length,
          candidates: tb ? tb.candidateFiles : null,
        })
      : JSON.stringify({ error: real.error })
  console.log(`--self-test:${cases.filter((c) => c.ok).length}/${cases.length} 通过(真仓 ${stat})`)
  for (const c of cases) if (!c.ok) console.log(`   ✗ ${c.name}`)
  return cases.every((c) => c.ok) ? 0 : 1
}

// CLI

function usage() {
  console.log(
    '用法: node scripts/check-agent-status-vocabulary-parity.mjs [--staged|--worktree] [--root <dir>] [--strict] [--json] [--all] [--self-test]\n' +
      '缺省判 HEAD blob;--staged 判索引 blob;--worktree 仅人工逃生舱(--root 只在该档有效);两旗同给 exit 2。\n' +
      '默认档违规只报数(逐条打印、exit 0);--strict 才判红(问责档)。SV3 的新增判定只在 --staged 档生效。',
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
    const tb = res.tables
    if (tb) {
      console.log(
        `   成员集合(${tb.count} 档):[${tb.members.join(',')}] | 联合形态:${tb.tsUnionDerived ? `派生自 ${tb.tsUnionDerived}` : '字面量联合'} | Py 对齐表 ${tb.pyTableCount} 条 / Py Literal ${tb.pyLiteralCount} 条 | 状态机表 ${tb.transitionsCount}+${tb.variantsCount} 键 | 第二域 [${tb.wsMembers.join(',')}] | SV3 候选 ${tb.candidateFiles} 文件`,
      )
    }
    for (const n of res.notes) console.log(`   · ${n}`)
    if (showAll && res.candidates.length > 0) {
      console.log('   SV3 候选第二份逐条(含已引用 canonical 的合规项):')
      for (const c of res.candidates)
        console.log(`      ${c.violation ? '✗' : '✓'} ${c.path}(${c.members.length} 档)`)
    }
    if (res.sv3Inherited && res.sv3Inherited.length > 0)
      console.log(`   SV3 存量(HEAD 面已经是第二份,按棘轮只报名):${res.sv3Inherited.join(', ')}`)
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
        `✅ 状态词汇跨语言/跨端对账通过(面=${res.face}):两侧成员集合逐字等值、状态机表与登记表自洽、无新增端内副本`,
      )
    process.exit(0)
  }
  if (!json) {
    console.log(
      strict
        ? `❌ 检出 ${res.violations.length} 处状态词汇分叉(面=${res.face},--strict 判红):`
        : `⚠️ 检出 ${res.violations.length} 处状态词汇分叉(面=${res.face};默认档只报数,--strict 判红):`,
    )
    for (const v of res.violations) console.log(`   · ${v}`)
    console.log(
      '改法:成员集合的单一真相源 = packages/types/src/agent-runtime.ts 的 AGENT_TASK_STATUSES;\n' +
        '     端内一律 import 它(或由它派生),Python 侧改 KANBAN_TASK_STATUSES + Literal 两处同笔。\n' +
        '     六态值是落库/REST/SSE 三重对外契约 —— 不得改名、不得删成员、不得为变绿放宽判据、\n' +
        '     也不得写豁免清单消账(登记表必然腐烂)。新增一档必须同枚提交补齐 agents.kanban.* 五语言(AGENTS §30)。',
    )
  }
  process.exit(strict ? 1 : 0)
}

/** 导出给 §22c 镜像测试(测试不得重写判据,见 scripts/tests/ 同名 .test.mjs) */
/** 只递镜像测试真的调用的符号(多导出的解析原语无人调用 = 会腐烂的第二份入口) */
export const __test__ = {
  FILES,
  SELF_SKIP,
  decide,
  judgeCopy,
  FIXTURE_TS,
  FIXTURE_PY,
  FIXTURE_COPY_OK,
  FIXTURE_COPY_BAD,
  FIXTURE_COPY_COMMENT,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
}
