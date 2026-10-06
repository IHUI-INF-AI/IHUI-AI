#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 子智能体 / 后台进程「状态词汇」的跨语言 + 跨端对账门(D6/G3,2026-09-27 立)。
//
// 【接线状态:已接入】注册条目已落在 scripts/guardian-runner.mjs(id 以 runner 现值为准,
// 勿照抄本行数字):blocking + skipEnv:HUSKY_SKIP_STATUS_VOCABULARY_PARITY,带 stagedTriggers。
// —— 本段原写"尚未进提交链/只有本文件 + 镜像测试/注册与点名由主会话统一落",那是立项时的
// 实况,已过期(门早已装车);立论保留,接线事实按上条现读改写。
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
//   SV4(D145①,2026-09-29 补;评审修复轮 1 同日扩 ③ 并收口遮罩)子代理广告面/persona 名
//     对注册表的可解析性 —— 三分离里**执行名 = 注册表键**这一轴的静态面:
//     ① mcp_server.py 里"可用 agent 名称"/"子智能体名称(如 X / Y)"形态出现在**字符串字面量**
//       里的每个 ASCII 名,必须能在 agent_orchestrator.py `_register_defaults` 解析到的注册表
//       名单里查到;查不到即红(旧描述硬编码 5 个幽灵名 code-reviewer/bug-fixer/… 即此型,
//       模型照说明书调用必回"Agent 不存在")。描述改为注册表现读拼接 ⇒ 字面量里没有名单 ⇒
//       本维天然绿;**"烘死一份今天全合法的名单"这一型由运行时面
//       apps/ai-service/tests/test_dispatch_subagent_advertised_names.py 钉,两维各有反向对照,
//       谁也不顶谁的结论**。
//     ② apps/cli/src/personas/contracts.ts 的 persona 键必须 ⊆ 注册表名单(persona 是执行名
//       的投影,不是第三个域)。
//     ③ **运行期展开那一格**(评审 Important:第二广告面漏修):TOOL_DEFERRAL=on 时模型只拿到
//       截断骨架,完整描述**只能**经 deferral 反查面取回,而那张注册表是 import 期从 _TOOLS 灌的
//       快照 ⇒ 清单面修好、反查面仍退化成 0 个名,① 读源码看不见这一格。判据:代码面里读取
//       deferral 注册表的那条面(以及清单面 list_tools)必须**调用**同一份广告出口 ——
//       `_dispatch_subagent_description()` 或 `_ADVERTISED_DESCRIPTION_PROVIDERS.get(`。
//       **只认调用形态,不认名字提及**:本维第一次真机变异(把展开摘掉)时函数 docstring 里
//       仍逐字写着出口的名字,按"名字在体内"判就完全绿灯 —— 提到 ≠ 接线(§"判据必须覆盖门
//       自己产出的形态";Python 三引号在 JS 词法下不成对,多行 docstring 中段抹不干净)。
//       未接即判红并点名该函数;两条面都不在面上 ⇒ note(该面不存在/搬家,不读成判过)。
//       锚点硬命名与本门 SV1 的 SYMBOLS 同一条规矩:改名必须与被审面同笔,解析不到 ⇒ 未判定。
//     **判定面一律先遮注释**(评审 Minor:① 用原文而 SV3 用遮罩,头注却自称"字符串字面量里"):
//       Python 面 = `maskPythonCommentFace`(词法仍只有一份 —— 字符串区间取自
//       lib/code-mask 的 `maskedSpans`,本门只在其上补 Python 的 `#` 到行尾),TS 面 =
//       `maskComments`;两处都**保留字符串**(广告文本就住在字符串里,整层抹字符串=失明)。
//       已知边界如实登记:JS 词法不认 Python 三引号 ⇒ 住在 docstring 里的 marker 仍会被解析,
//       那是"多算"不是"漏判",不得读成"注释都已遮"。
//     广告面/persona 输入整轮未提供 ⇒ note(不判也不装判过);提供而取不到/解析不到/枚举到 0
//     ⇒ 未判定 exit 2;--staged 档的判红同样套"该 token 在 HEAD 面已红 ⇒ 存量只报名"的棘轮
//     (与 SV3 同一条 §12e 防恒红规矩)。wire 值不归本门判(动值域属另一票)。
//
// 三态绝不并桶:输入取不到 / 声明解析不到 / 表体有解析不进的行 / 候选枚举到 0 ⇒ 未判定
// exit 2(既不冒红也绝不记绿)。定级:默认档违规只报数 exit 0,--strict 才判红 —— 与本次
// 提交无关的恒红门唯一结局是逼人 --no-verify、连带废掉全部守门(AGENTS §12e)。
// 两旗同给 exit 2;--root 只在 --worktree 档有效(换根仍按 HEAD 读 = 双根分裂,判死)。
//
// 覆盖边界(如实登记,不得读成"已确认没有"):六态族判的是**声明层**,改成运行时计算 ⇒ 未判定
// 而非跳过;SV4③ 只判"两条广告面有没有接同一份出口"(静态接线对账),**不执行**被审实现,
// 所以"接了但出口自己算错名单"仍归运行时面(pytest)那一维;六态值是落库/REST/SSE 三重对外
// 契约,**本门不改任何已在线上的字符串值**;
// apps/api 的两份 z.enum 与 web 的 TaskDetailDialog 等副本不在本票清单内 ⇒ 只报名不代裁。

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { maskComments, maskCommentsAndStrings, maskedSpans } from './lib/code-mask.mjs'
import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 本门在 runner 条目里**实际注册并被读取**的应急跳过名(现值以 scripts/guardian-runner.mjs 为准)。
 * 2026-09-29 D145 轮对齐:此处旧常量写着 HUSKY_SKIP_AGENT_STATUS_VOCAB_PARITY,而 runner 登记的
 * skipEnv 是 HUSKY_SKIP_STATUS_VOCABULARY_PARITY(AGENTS 守门速查亦同)—— 两处各叫一个名时,
 * 镜像 T7(装车成套性)自注册之日起就恒红;运行时真正生效的是 runner 那份。
 * 修法是**声明跟现实对齐**,判据本身一字未动。
 */
export const SELF_SKIP = 'HUSKY_SKIP_STATUS_VOCABULARY_PARITY'

export const FILES = {
  tsTypes: 'packages/types/src/agent-runtime.ts',
  pyScheduler: 'apps/ai-service/app/services/dag_scheduler.py',
}

/**
 * SV4 的输入面(D145①):广告面 / 注册表(执行名单一真相源)/ CLI persona 投影。
 * 这些是**判据输入**,不参与 SV3 的"canonical 排除"(SV3 候选语义保持一字不动)。
 */
export const SV4_FILES = {
  pyMcp: 'apps/ai-service/app/services/mcp_server.py',
  pyOrchestrator: 'apps/ai-service/app/services/agent_orchestrator.py',
  tsPersonas: 'apps/cli/src/personas/contracts.ts',
}

/**
 * SV4③ 锚点(评审修复轮 1①:"运行期展开那一格"的静态接线对账)。
 * 硬命名与本门 SV1 的 SYMBOLS 同一条规矩:改名必须与被审面**同笔**,否则判"解析不到"(未判定),
 * 而不是静默读成"这一维没分叉"。
 *  - exitFn / exitMap  = 广告名单的唯一出口(函数)与它的登记表(两条面都经它);
 *  - registryVar        = deferral 注册表(import 期从 _TOOLS 灌的那一份快照);
 *  - surfaces           = 已知的两条模型可见描述产出面(缺一条即本维立项那一型:只修一面)。
 */
export const SV4_EXPANSION = {
  exitFn: '_dispatch_subagent_description',
  exitMap: '_ADVERTISED_DESCRIPTION_PROVIDERS',
  registryVar: '_DEFERRED_TOOL_SCHEMAS',
  surfaces: [
    { fn: 'list_tools', label: '清单面 list_tools' },
    { fn: 'get_full_tool_schema', label: 'deferral 反查面 get_full_tool_schema' },
  ],
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

// ---- SV4(D145①)判据输入解析层:全部纯函数,输入三份源码文本 ----
// 语法与 apps/ai-service/tests/test_dispatch_subagent_advertised_names.py 的运行时提取式
// **同形**(、 分档 + 每档头部 ASCII 名串);两处各判各的面,漂移由两条反向对照互相兜住。

/**
 * Python 面的"遮注释、留字符串"判定面(评审修复轮 1②:SV4 的判定面此前用**原文**,
 * 于是"解释这条判据的注释"里写出 marker + 名单就会被判成广告面 —— 守门 131/70 记过同型:
 * 判据开始咬自己的散文,后人只能把说明删掉)。
 *
 * 词法只有一份:字符串区间取自 `lib/code-mask` 的 `maskedSpans`(= 那台 scanSpans 的投影),
 * 本函数只在其上补 Python 自己的注释语法(`#` 起、到行尾止;**串内的 `#` 不是注释**)。
 * 为什么不用现成的整层遮罩:JS 词法不认 `#`,而 SV4 判的广告文本恰恰**住在字符串里** ——
 * 抹掉字符串等于没收这把尺子(所以 mask()/maskCommentsAndStrings 只服务 SV3)。
 * 等长是硬约束(命中要能落回原文行号)。
 * 已知边界(登记,不谎称已遮):JS 词法不认 Python 三引号 ⇒ docstring 里的 marker 仍会被解析,
 * 那是"多算"方向(可能多要一次说明),不是"漏判"。
 */
export function maskPythonCommentFace(src) {
  if (typeof src !== 'string') return ''
  const s = src.replace(/\r\n/g, '\n')
  const inString = new Uint8Array(s.length)
  for (const sp of maskedSpans(s)) {
    if (sp.kind !== 'string') continue
    for (let k = sp.start; k < sp.end && k < s.length; k++) inString[k] = 1
  }
  const out = s.split('')
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '#' || inString[i]) continue
    let j = i
    while (j < s.length && s[j] !== '\n') {
      out[j] = ' '
      j += 1
    }
    i = j - 1
  }
  return out.join('')
}

/**
 * 取某个 Python 函数的**函数体**(评审修复轮 1①:SV4③ 要问的是"这条产出面有没有引用同一份
 * 出口",按体判而不是按整文件判 —— 全文匹配会让"另一条面引用了"替这条面顶掉结论)。
 * 返回 null = 解析不到该函数(改名/搬家 ⇒ 调用方按未判定处理,不猜)。
 */
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
  return body.join('\n')
}

/**
 * SV4③ 判定(纯函数):两条模型可见描述产出面必须引用**同一份**广告出口。
 * 三态分流:面上根本没有 deferral 注册表的读取 ⇒ note(该面不存在/搬家,不读成判过);
 * 有读取但函数体解析不到 ⇒ 未判定(不猜它引用了谁);引用了出口 ⇒ 该面合规。
 */
export function sv4ExpansionJudge(mcpFace) {
  const A = SV4_EXPANSION
  const violations = []
  const badTokens = []
  const undetermined = []
  const notes = []
  const checked = []
  // **接线要认调用形态,不认名字提及**(评审修复轮 1 的变异实测):把反查面的展开摘掉之后,
  // 函数体里的 docstring 仍逐字写着 `_ADVERTISED_DESCRIPTION_PROVIDERS` —— 按"名字出现在体内"
  // 判,门对这次变异完全绿灯(我自己摘掉它才验出来)。Python 三引号在 JS 词法下不成对,
  // 多行 docstring 的中段抹不干净,所以这里唯一可靠的形态是**调用/取用**:`X()` 或 `X.get(`。
  const exitCall = new RegExp(`(?:${A.exitFn}|${A.exitMap})\\s*(?:\\.\\s*get\\s*\\(|[(])`)
  const returnsSnapshot = new RegExp(`return[^(\\n]*${A.registryVar}\\s*(?:\\.|\\[)`)
  const registryRead = new RegExp(`${A.registryVar}\\s*\\.\\s*get\\s*\\(`)
  const writesSnapshot = mcpFace.includes(`${A.registryVar}[`) || registryRead.test(mcpFace)
  if (!writesSnapshot) {
    notes.push(
      `SV4③ 本轮面内读不到 deferral 注册表(${A.registryVar})⇒ 反查面不存在/搬家,该维不判(不读成判过)`,
    )
  }
  for (const s of A.surfaces) {
    const isReader = s.fn === 'get_full_tool_schema'
    if (isReader && !mcpFace.includes(A.registryVar)) continue
    const body = pythonFunctionBody(mcpFace, s.fn)
    if (body === null) {
      undetermined.push(
        `SV4③ 解析不到产出面函数 def ${s.fn}(改名/搬家 ⇒ 展开对账失明,不记绿):判据锚点见 SV4_EXPANSION`,
      )
      continue
    }
    checked.push(s.fn)
    if (exitCall.test(body) && !returnsSnapshot.test(body)) continue
    badTokens.push(s.fn)
    violations.push(
      `SV4③ 产出面未接同一份广告出口:${s.fn}(${s.label} 体内没有 ${A.exitFn}()/${A.exitMap}.get( 的**调用形态**` +
        (returnsSnapshot.test(body)
          ? `;而且直接把 ${A.registryVar} 的 import 期快照 return 给模型`
          : '') +
        ':' +
        (isReader
          ? 'TOOL_DEFERRAL=on 时第二条广告名清单退化成 0 个名'
          : '该产出面把描述烘成第二份真相,名单不随注册表演进') +
        ')',
    )
  }
  return { violations, badTokens, undetermined, notes, checked }
}

const ASCII_HEAD_RE = /^[a-z][a-z0-9-]*/

/** 从分档文本取头部名:先剥掉档位开头的标点/中文引导(":code-reviewer(代码审查)" → code-reviewer)。 */
function chunkHeadName(chunk) {
  const m = ASCII_HEAD_RE.exec(chunk.replace(/^[^a-z0-9]*/, '').trim())
  return m ? m[0] : null
}

/**
 * marker 之后**字符串字面量内**的广告段,含 Python 隐式相邻拼接(闭合引号 + 纯空白 + 同种开引号
 * 继续)。取字面量正文而不越界进代码 —— "、".join(names) 这类动态拼接的代码文本绝不能被
 * 当成名单解析(否则 join/names 会伪装成"广告名",对正确实现产假阳)。
 */
function advertisedSegments(src, marker) {
  const out = []
  let from = 0
  for (;;) {
    const idx = src.indexOf(marker, from)
    if (idx < 0) break
    from = idx + marker.length
    let i = from
    let seg = ''
    let guard = 0
    while (i < src.length && guard++ < 4000) {
      const c = src[i]
      if (c === '"' || c === "'") {
        let j = i + 1
        while (j < src.length && /[ \t\r\n]/.test(src[j])) j++
        if (src[j] === c) {
          i = j + 1
          continue
        }
        break
      }
      if (c !== '\n' && c !== '\r') seg += c
      i++
    }
    out.push(seg)
  }
  return out
}

/** mcp 面:两条广告语法 —— "可用 agent 名称"清单段,与"子智能体名称(如 X / Y)"括注。 */
export function advertisedNamesInMcp(src) {
  const names = []
  for (const seg of advertisedSegments(src, '可用 agent 名称')) {
    for (const c of seg.split('、')) {
      const n = chunkHeadName(c)
      if (n) names.push(n)
    }
  }
  for (const m of src.matchAll(/子智能体名称[(（]([^)\n）]{1,200})[)）]/g)) {
    const body = m[1].replace(/^\s*如\s*/, '')
    for (const piece of body.split(/\s*\/\s*|、/)) {
      const n = chunkHeadName(piece)
      if (n) names.push(n)
    }
  }
  return [...new Set(names)]
}

/** 注册表(执行名单一真相源):_register_defaults 体内的 name="..." 逐条。 */
export function registryDefaultNames(src) {
  const s = src.replace(/\r\n/g, '\n')
  const key = 'def _register_defaults'
  const i = s.indexOf(key)
  if (i < 0)
    return {
      names: [],
      error: '解析不到 _register_defaults(注册表默认档改名/搬家 ⇒ SV4 失明,不记绿)',
    }
  const rest = s.slice(i + key.length)
  const e = rest.search(/\n[ \t]+def /)
  const body = e < 0 ? rest : rest.slice(0, e)
  const names = [...body.matchAll(/\bname="([a-z0-9][a-z0-9_-]*)"/g)].map((m) => m[1])
  if (names.length === 0)
    return { names: [], error: '_register_defaults 体内解析到 0 个 name="…"(形态变了 ⇒ 不猜)' }
  return { names }
}

/** persona 投影:contracts.ts 顶层两空格缩进的键。 */
export function personaKeys(src) {
  if (!/PERSONAS_CONTRACTS/.test(src))
    return { keys: [], error: '解析不到 PERSONAS_CONTRACTS 导出面(改名/搬家 ⇒ 不记绿)' }
  const keys = [...src.matchAll(/^ {2}([a-z_]+): \{/gm)].map((m) => m[1])
  if (keys.length === 0)
    return { keys: [], error: 'persona 清单解析到 0 个键(该文件形态变了 ⇒ SV4②失明,不记绿)' }
  return { keys }
}

/**
 * SV4 聚合判定(纯函数):三份文本进,违规/未判定/坏 token 名单出。
 * bad 名单同时给 --staged 棘轮当"HEAD 已红 token"的对账集用(违规文本可被下一个人改文案,
 * token 集合不行 —— 锚点粒度落在 token,不落在行文本,守门 134「换个写法净零逃逸」同课)。
 * **判定面先遮注释**(评审修复轮 1②):广告文本住在字符串里,所以遮的是 Python 的 `#` 行注释;
 * TS persona 面同理走 maskComments(只遮 JS 注释,代码与字面量逐字保留)。
 */
export function sv4Judge({ mcp, orchestrator, personas }) {
  const violations = []
  const undetermined = []
  const notes = []
  const mcpFace = maskPythonCommentFace(mcp)
  const personaFace = maskComments(personas)
  const reg = registryDefaultNames(orchestrator)
  if (reg.error) undetermined.push(`SV4 ${reg.error}`)
  const pers = personaKeys(personaFace)
  if (pers.error) undetermined.push(`SV4 ${pers.error}`)
  if (!mcpFace.includes('"dispatch_subagent"') && !mcpFace.includes("'dispatch_subagent'"))
    undetermined.push(
      `SV4 广告面找不到 dispatch_subagent(工具改名/搬家 ⇒ 本维失明,不记绿):${SV4_FILES.pyMcp}`,
    )
  const advertisedBad = []
  const personaBad = []
  const exp = sv4ExpansionJudge(mcpFace)
  const advertised = advertisedNamesInMcp(mcpFace)
  if (undetermined.length === 0) {
    const R = new Set(reg.names)
    for (const n of advertised) if (!R.has(n)) advertisedBad.push(n)
    for (const k of pers.keys) if (!R.has(k)) personaBad.push(k)
  }
  for (const n of advertisedBad)
    violations.push(
      `SV4 广告名在注册表解析不到:${n}(说明书指了一条不存在的门 —— 模型照调必回"Agent 不存在")`,
    )
  for (const k of personaBad)
    violations.push(
      `SV4 persona 名不属于注册表:${k}(persona 是执行名的投影,不是第三个域;要么注册该 persona 对应的 agent,要么改名归一)`,
    )
  // SV4③ 的展开对账独立于"注册表读不读得出":它判的是接线,不是名单,
  // 所以注册表解析失败时仍照判(不得让一维失明把另一维也洗成绿)。
  for (const v of exp.violations) violations.push(v)
  for (const u of exp.undetermined) undetermined.push(u)
  for (const n of exp.notes) notes.push(n)
  return {
    violations,
    undetermined,
    notes,
    bad: {
      advertised: advertisedBad,
      persona: personaBad,
      // 棘轮 token:产出面函数名(与违规行 `:` 后的同一个),锚点粒度落在面上不落在文案上
      expansion: exp.badTokens,
    },
    expansion: { checked: exp.checked, violations: exp.violations.length },
    registryCount: reg.names.length,
    personaCount: pers.keys.length,
    advertisedLiteralCount: advertised.length,
  }
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

  // ---- SV4 子代理广告面 / persona 名对注册表的可解析性(D145①) ----
  // 输入三选一分流:**整轮未提供** = note(调用方只取状态词汇,不代表广告面已核);
  // **提供而取不到/解析不到** = 未判定;三态不并桶(与本门"把没判写成判过是最高频失效型"同禁令)。
  const sv4Pick = (p, a) =>
    inputs[p] !== undefined || inputs[a] !== undefined ? (inputs[p] ?? inputs[a]) : undefined
  const rawMcp = sv4Pick(SV4_FILES.pyMcp, 'pyMcp')
  const rawOrch = sv4Pick(SV4_FILES.pyOrchestrator, 'pyOrchestrator')
  const rawPers = sv4Pick(SV4_FILES.tsPersonas, 'tsPersonas')
  let sv4 = null
  if (rawMcp === undefined && rawOrch === undefined && rawPers === undefined) {
    notes.push('SV4 本轮未提供广告面/persona 输入(不代表广告面无硬编码名单;问责需全量/--staged 档)')
  } else {
    const miss = []
    if (typeof rawMcp !== 'string' || rawMcp.length === 0) miss.push(`广告面 ${SV4_FILES.pyMcp}`)
    if (typeof rawOrch !== 'string' || rawOrch.length === 0)
      miss.push(`注册表 ${SV4_FILES.pyOrchestrator}`)
    if (typeof rawPers !== 'string' || rawPers.length === 0)
      miss.push(`persona ${SV4_FILES.tsPersonas}`)
    if (miss.length > 0) {
      undetermined.push(`SV4 被审面取不到:${miss.join(' / ')}(不记绿也不冒红)`)
    } else {
      sv4 = sv4Judge({ mcp: rawMcp, orchestrator: rawOrch, personas: rawPers })
      for (const u of sv4.undetermined) undetermined.push(u)
      for (const n of sv4.notes) notes.push(n)
      if (sv4.undetermined.length === 0) for (const v of sv4.violations) violations.push(v)
    }
  }

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
    sv4: sv4
      ? {
          advertisedBad: sv4.bad.advertised,
          personaBad: sv4.bad.persona,
          expansionBad: sv4.bad.expansion,
          expansionChecked: sv4.expansion.checked,
          registryCount: sv4.registryCount,
          personaCount: sv4.personaCount,
          advertisedLiteralCount: sv4.advertisedLiteralCount,
        }
      : null,
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
  const sv4Contents = readContents(root, sel.face, Object.values(SV4_FILES))
  // 预读轮**不给 candidates**(空数组是"枚举跑了而一个都没有"= 判死,不是"这一轮不判该维")
  const pre = decide({ ...canonical, ...sv4Contents })
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
  // SV4 的 HEAD 锚点:--staged 档把"HEAD 面上本来就解析不到的名字"当存量只报名 ——
  // 否则修复未入库的窗口里,每台每次提交都被这台与内容无关的红逼成 --no-verify(§12e)。
  // 锚点落在 **token**(名字本身)而不是行文本:换文案不清账,加新幽灵名必红
  // (守门 134「锚点粒度不够细 ⇒ 换个写法净零逃逸」同课)。
  let sv4HeadBad = null
  let sv4AnchorUnusable = null
  if (sel.face === 'staged') {
    const hc = readContents(root, 'head', Object.values(SV4_FILES))
    const a = hc[SV4_FILES.pyMcp]
    const b = hc[SV4_FILES.pyOrchestrator]
    const c = hc[SV4_FILES.tsPersonas]
    if (typeof a !== 'string' || typeof b !== 'string' || typeof c !== 'string') {
      sv4AnchorUnusable = 'HEAD 面 SV4 输入取不到'
    } else {
      const j4 = sv4Judge({ mcp: a, orchestrator: b, personas: c })
      if (j4.undetermined.length > 0)
        sv4AnchorUnusable = `HEAD 面 SV4 解析不到(${j4.undetermined[0]})`
      else
        sv4HeadBad = new Set([...j4.bad.advertised, ...j4.bad.persona, ...j4.bad.expansion])
    }
  }
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
  const res = decide({ ...canonical, ...sv4Contents, candidates })
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
  // SV4 棘轮(token 粒度):被审面里"注册表解析不到"的名字,若 HEAD 面同一个名字已红 ⇒ 存量报名;
  // 新名字必红。锚点取不到/解析不到 ⇒ **不豁免**(失效方向是多要一次说明,不是多放一次跳门)。
  // SV4 棘轮(token 粒度):被审面里"注册表解析不到"的名字、以及"没接同一份出口"的产出面函数名,
  // 若 HEAD 面同一个 token 已红 ⇒ 存量报名;新 token 必红。锚点取不到/解析不到 ⇒ **不豁免**
  // (失效方向是多要一次说明,不是多放一次跳门)。token 类必须含 `_`(SV4③ 的 token 是函数名,
  // 只写 [a-z0-9-] 会让该维的存量豁免静默失灵 —— 与 134 那条"换个写法净零逃逸"同一课)。
  let sv4Inherited = []
  if (res.tables && res.tables.sv4 && sel.face === 'staged') {
    const badNow = [
      ...res.tables.sv4.advertisedBad,
      ...res.tables.sv4.personaBad,
      ...res.tables.sv4.expansionBad,
    ]
    if (sv4HeadBad) {
      const keep = new Set(badNow.filter((n) => !sv4HeadBad.has(n)))
      sv4Inherited = badNow.filter((n) => sv4HeadBad.has(n))
      ratcheted = ratcheted.filter((v) => {
        const m =
          /^SV4 (?:广告名在注册表解析不到|persona 名不属于注册表):([a-z0-9-]+)|^SV4③ 产出面未接同一份广告出口:([a-z0-9_]+)/.exec(
            v,
          )
        return !m || keep.has(m[1] ?? m[2])
      })
    } else {
      res.notes.push(
        `SV4 棘轮本轮未生效(${sv4AnchorUnusable || '锚点不可用'})⇒ 存量不豁免:方向是"多要一次定向说明",不是"多放一次跳门"`,
      )
    }
  }
  if (res.tables && sel.face !== 'staged')
    res.notes.push(
      `SV3/SV4 本档不判"新增"的原因:被审面(${sel.face})就是锚点面 ⇒ 拿不到"新引入"这一维(锚点与结论同面)。要问责新增副本/新增幽灵名,跑 --staged。`,
    )
  return {
    face: sel.face,
    ...res,
    violations: ratcheted,
    sv3Inherited: inherited,
    sv4Inherited,
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

// ---- SV4 夹具(D145①;档位名全是合成词,与真仓六态/真 agent 名无交集) ----
const FIXTURE_ORCH = `
class AgentRegistry:
    def _register_defaults(self) -> None:
        defaults = [
            AgentDefinition(
                name="ra",
                description="甲",
            ),
            AgentDefinition(
                name="rb-old",
                description="乙",
            ),
        ]

    def register(self, agent): pass
`
// 合规形(评审修复轮 1 的目标形态):两条产出面都引用**同一份**出口。
// 注释里刻意写出 marker + 一份名单 —— 它不得被解析成广告面(遮罩的反向对照,SV4 的牙之一)。
const FIXTURE_MCP_DYNAMIC = `
# 早期这里写过静态名单"可用 agent 名称:ghost-in-comment、ghost-in-comment2",
# 已改为注册表现读;注释不是广告面,不得被本门判红。
class MCPServer:
    def list_tools(self):
        tools = list(_TOOLS)
        for i, t in enumerate(tools):
            provider = _ADVERTISED_DESCRIPTION_PROVIDERS.get(t.name)
            if provider is None:
                continue
            tools[i] = MCPTool(
                name=t.name,
                description=provider(),
                input_schema=t.input_schema,
            )
        return tools


def _dispatch_subagent_description():
    return (
        _DISPATCH_SUBAGENT_DESC_CORE
        + "可用 agent 名称(注册表现读):"
        + "、".join(names)
        + "。未知名回包带 availableAgents 供自纠。"
    )


_ADVERTISED_DESCRIPTION_PROVIDERS = {"dispatch_subagent": _dispatch_subagent_description}


def get_full_tool_schema(name):
    entry = _DEFERRED_TOOL_SCHEMAS.get(name)
    if entry is None:
        return None
    provider = _ADVERTISED_DESCRIPTION_PROVIDERS.get(name)
    if provider is None:
        return entry
    return {**entry, "description": provider()}
`
// 评审 Important 那一型:清单面修好了,而 deferral 反查面把 import 期快照原样交给模型
// ⇒ 第二条广告名清单退化成 0 个名。本夹具必须被 SV4③ 点名(构造面,不依赖仓库瞬时状态)。
const FIXTURE_MCP_DEFER_SNAPSHOT = `
class MCPServer:
    def list_tools(self):
        tools = list(_TOOLS)
        for i, t in enumerate(tools):
            provider = _ADVERTISED_DESCRIPTION_PROVIDERS.get(t.name)
            if provider is None:
                continue
            tools[i] = MCPTool(name=t.name, description=provider(), input_schema=t.input_schema)
        return tools


def _dispatch_subagent_description():
    return _DISPATCH_SUBAGENT_DESC_CORE + "可用 agent 名称(注册表现读):" + "、".join(names)


_ADVERTISED_DESCRIPTION_PROVIDERS = {"dispatch_subagent": _dispatch_subagent_description}


def get_full_tool_schema(name):
    return _DEFERRED_TOOL_SCHEMAS.get(name)
`
// 同一型的**第二种写法**,也是本维第一次变异真机抓到的那一种:展开被摘掉,但 docstring 里
// 逐字写着出口的名字 ⇒ 按"名字出现在体内"判就完全绿灯。判据因此只认**调用形态**。
const FIXTURE_MCP_DEFER_DOCSTRING_ONLY = `
class MCPServer:
    def list_tools(self):
        tools = list(_TOOLS)
        for i, t in enumerate(tools):
            provider = _ADVERTISED_DESCRIPTION_PROVIDERS.get(t.name)
            if provider is None:
                continue
            tools[i] = MCPTool(name=t.name, description=provider(), input_schema=t.input_schema)
        return tools


def _dispatch_subagent_description():
    return _DISPATCH_SUBAGENT_DESC_CORE + "可用 agent 名称(注册表现读):" + "、".join(names)


_ADVERTISED_DESCRIPTION_PROVIDERS = {"dispatch_subagent": _dispatch_subagent_description}


def get_full_tool_schema(name):
    \"\"\"返回完整 schema。带 provider 的工具必须在返回时现读同一份
    _ADVERTISED_DESCRIPTION_PROVIDERS —— 这句话只是说明,不是接线。
    \"\"\"
    entry = _DEFERRED_TOOL_SCHEMAS.get(name)
    if entry is None:
        return None
    return entry
`
const FIXTURE_MCP_GHOST = `
class MCPServer:
    def list_tools(self):
        return [
            MCPTool(
                name="dispatch_subagent",
                description=(
                    "派发子智能体执行独立任务。"
                    "可用 agent 名称:ghost-one(幽灵甲)、ghost-two(Bug 修复)、ra(合法甲)。"
                    "调用后独立执行。"
                ),
                input_schema={
                    "properties": {
                        "name": {
                            "description": "单 agent 模式:要派发的子智能体名称(如 ghost-three / ra)",
                        },
                    },
                },
            ),
        ]
`
// 与 FIXTURE_MCP_GHOST 同一份名单,**逐字**只写在 `#` 注释里 ⇒ 一个名字都不许点(遮罩的牙)。
const FIXTURE_MCP_GHOST_IN_COMMENT = `
# 历史形态(仅供读者对照,不是广告面):
#   可用 agent 名称:ghost-four(幽灵丁)、ghost-five(幽灵戊)。
#   子智能体名称(如 ghost-six / ra)
class MCPServer:
    def list_tools(self):
        tools = list(_TOOLS)
        for i, t in enumerate(tools):
            provider = _ADVERTISED_DESCRIPTION_PROVIDERS.get(t.name)
            if provider is None:
                continue
            tools[i] = MCPTool(name=t.name, description=provider(), input_schema=t.input_schema)
        return tools


def _dispatch_subagent_description():
    return _DISPATCH_SUBAGENT_DESC_CORE + "可用 agent 名称(注册表现读):" + "、".join(names)


_ADVERTISED_DESCRIPTION_PROVIDERS = {"dispatch_subagent": _dispatch_subagent_description}


def get_full_tool_schema(name):
    entry = _DEFERRED_TOOL_SCHEMAS.get(name)
    return {**entry, "description": _dispatch_subagent_description()} if entry else None
`
const FIXTURE_PERSONAS_OK = `
export const PERSONAS_CONTRACTS = Object.freeze({
  ra: {
    input_schema: {},
  },

  "rb-old": {
    input_schema: {},
  },
})
`
// persona 键的引号形态夹具:regex 只认两空格裸键 —— 带引号的 rb-old 因此**不被枚举**,
// 该形态登记为 SV4② 的已知盲区(contracts.ts 现行形态没有带引号键;新增即由 0 键失明判死兜住)。
const FIXTURE_PERSONAS_BAD = `
export const PERSONAS_CONTRACTS = Object.freeze({
  ra: {
    input_schema: {},
  },

  ghostpersona: {
    input_schema: {},
  },
})
`
// 与 BAD 同一份幽灵键,只写在注释里 ⇒ 不得被枚举(评审修复轮 1②:TS 面同样遮注释)。
const FIXTURE_PERSONAS_COMMENTED = `
// 曾考虑过这样一档:
//   ghostpersona: {
//     input_schema: {},
//   },
export const PERSONAS_CONTRACTS = Object.freeze({
  ra: {
    input_schema: {},
  },
})
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

  // ---- SV4(D145①)构造面正反成对 ----
  const d4 = (over = {}) =>
    D({
      [SV4_FILES.pyMcp]: FIXTURE_MCP_DYNAMIC,
      [SV4_FILES.pyOrchestrator]: FIXTURE_ORCH,
      [SV4_FILES.tsPersonas]: FIXTURE_PERSONAS_OK,
      ...over,
    })
  const ok4 = d4()
  t(
    'A16 SV4 绿形:注册表现读动态拼接 ⇒ 广告面不产生字面名,不红',
    ok4.violations.filter((v) => v.startsWith('SV4')).length === 0 &&
      !!ok4.tables.sv4 &&
      ok4.tables.sv4.advertisedBad.length === 0 &&
      ok4.tables.sv4.personaBad.length === 0,
  )
  const gh = d4({ [SV4_FILES.pyMcp]: FIXTURE_MCP_GHOST })
  t(
    'A17 SV4 有牙(反向对照):把现读拼接改回硬编码幽灵清单 ⇒ 必红并逐名点名',
    ['ghost-one', 'ghost-two', 'ghost-three'].every((x) =>
      gh.violations.some((v) => v.startsWith('SV4') && v.includes(x)),
    ),
  )
  t(
    'A17b 两条广告语法各自都要判(清单段 + "名称(如 X / Y)"括注,缺一即半盲)',
    gh.violations.filter((v) => v.startsWith('SV4 广告名')).length === 3,
  )
  const pb = d4({ [SV4_FILES.tsPersonas]: FIXTURE_PERSONAS_BAD })
  t(
    'A18 SV4 persona ∉ 注册表必红',
    pb.violations.some((v) => v.startsWith('SV4 persona') && v.includes('ghostpersona')),
  )
  const noreg = d4({ [SV4_FILES.pyOrchestrator]: 'class X:\n    def other(self):\n        pass\n' })
  t(
    'A19 注册表解析不到 ⇒ SV4 未判定,不记绿也不冒红',
    noreg.undetermined.some((u) => u.includes('SV4')) &&
      !noreg.violations.some((v) => v.startsWith('SV4')),
  )
  const notool = d4({ [SV4_FILES.pyMcp]: 'TOOLS = []' })
  t(
    'A20 广告面找不到 dispatch_subagent ⇒ 未判定(失明不记绿)',
    notool.undetermined.some((u) => u.includes('dispatch_subagent')),
  )
  const miss4 = D({})
  t(
    'A21 SV4 整轮未提供输入 ⇒ note(不判也不装判过),且不产 SV4 红',
    miss4.tables.sv4 === null &&
      miss4.notes.some((n) => n.includes('SV4 本轮未提供')) &&
      !miss4.violations.some((v) => v.startsWith('SV4')),
  )
  const legalHard = d4({
    [SV4_FILES.pyMcp]:
      'MCPTool(name="dispatch_subagent", description="可用 agent 名称:ra、rb-old。")',
  })
  t(
    'A22 边界如实:今天全部合法的硬编码名单在 SV4①(名字可解析性)这一维放过 —— 名单漂移由 pytest 运行时面钉',
    legalHard.tables.sv4.advertisedBad.length === 0,
  )

  // ---- SV4③(评审修复轮 1①:运行期展开那一格)构造面正反成对 ----
  const snap = d4({ [SV4_FILES.pyMcp]: FIXTURE_MCP_DEFER_SNAPSHOT })
  t(
    'A23 SV4③ 有牙:清单面修好而 deferral 反查面仍交回 import 期快照 ⇒ 必红并点名该函数',
    snap.violations.some((v) => v.startsWith('SV4③') && v.includes('get_full_tool_schema')) &&
      snap.tables.sv4.expansionBad.includes('get_full_tool_schema'),
  )
  t(
    'A24 SV4③ 反向(判据不得过宽):两条面都引用同一份出口 ⇒ 一条都不红',
    ok4.violations.filter((v) => v.startsWith('SV4③')).length === 0 &&
      ok4.tables.sv4.expansionBad.length === 0 &&
      ok4.tables.sv4.expansionChecked.length === 2,
  )
  t(
    'A25 面内没有 deferral 注册表 ⇒ note 不判(不得读成"已判过"),且不产 SV4③ 红',
    N(gh, 'SV4③ 本轮面内读不到 deferral 注册表') &&
      gh.violations.filter((v) => v.startsWith('SV4③') && v.includes('get_full_tool_schema'))
        .length === 0,
  )

  // ---- 遮罩(评审修复轮 1②)双向成对:注释里的 marker 不判红,同一形态写在串里必判红 ----
  const gcom = d4({ [SV4_FILES.pyMcp]: FIXTURE_MCP_GHOST_IN_COMMENT })
  t(
    'A26 注释里写 marker ⇒ 不得判红(门不得判自己的散文)',
    ['ghost-in-comment', 'ghost-in-comment2', 'ghost-four', 'ghost-five', 'ghost-six'].every(
      (x) => !gcom.violations.some((v) => v.startsWith('SV4 广告名') && v.includes(x)),
    ) && gcom.tables.sv4.advertisedLiteralCount === 0,
  )
  t(
    'A27 同一份幽灵名单逐字写在字符串字面量里 ⇒ 必红(证明 A26 的绿来自遮注释,不是把判据遮瞎)',
    ['ghost-one', 'ghost-two', 'ghost-three'].every((x) =>
      gh.violations.some((v) => v.startsWith('SV4 广告名') && v.includes(x)),
    ),
  )
  const pcom = d4({ [SV4_FILES.tsPersonas]: FIXTURE_PERSONAS_COMMENTED })
  t(
    'A28 persona 键写在注释里 ⇒ 不被枚举(TS 面同一条遮罩纪律),而代码里的键照旧算',
    pcom.tables.sv4.personaBad.length === 0 &&
      pcom.tables.sv4.personaCount === 1 &&
      pb.tables.sv4.personaBad.includes('ghostpersona'),
  )
  const mutGcom = mu(FIXTURE_MCP_GHOST_IN_COMMENT, '#   可用 agent 名称:ghost-four', '"可用 agent 名称:ghost-four')
  t(
    'A29 遮罩开关的牙:把同一行从注释挪进字符串 ⇒ 必须翻红(否则 A26 只是"门瞎了")',
    mutGcom.c &&
      d4({ [SV4_FILES.pyMcp]: mutGcom.s }).violations.some((v) => v.includes('ghost-four')),
  )
  // 本维第一次真机变异(把 mcp_server 的展开摘掉)抓到的形态:docstring 里逐字写着出口名字
  // ⇒ 按"名字被提到"判就全绿。判据只认调用形态,这一条把它钉成必红。
  const dononly = d4({ [SV4_FILES.pyMcp]: FIXTURE_MCP_DEFER_DOCSTRING_ONLY })
  t(
    'A30 SV4③ 只认调用形态:docstring 里写足出口名字而体内不接 ⇒ 必红(提到≠接线)',
    dononly.tables.sv4.expansionBad.includes('get_full_tool_schema') &&
      dononly.violations.some((v) => v.startsWith('SV4③') && v.includes('get_full_tool_schema')),
  )
  const mutSnap = mu(
    FIXTURE_MCP_DYNAMIC,
    '    provider = _ADVERTISED_DESCRIPTION_PROVIDERS.get(name)\n    if provider is None:\n        return entry\n    return {**entry, "description": provider()}',
    '    return _DEFERRED_TOOL_SCHEMAS.get(name)',
  )
  t(
    'A31 变异自证:把合规夹具的反查面改成交回快照 ⇒ 同一条判据当场翻红(不是恒红,是这条改动红)',
    mutSnap.c &&
      d4({ [SV4_FILES.pyMcp]: mutSnap.s }).tables.sv4.expansionBad.includes('get_full_tool_schema'),
  )

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
      if (tb.sv4)
        console.log(
          `   SV4:注册表现读 ${tb.sv4.registryCount} 档 | persona ${tb.sv4.personaCount} 个 | 广告面字面名 ${tb.sv4.advertisedLiteralCount} 个 | SV4③ 已核产出面 [${tb.sv4.expansionChecked.join(',')}] | 解析不到 广告=[${tb.sv4.advertisedBad.join(',')}] persona=[${tb.sv4.personaBad.join(',')}] 未接出口=[${tb.sv4.expansionBad.join(',')}]`,
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
    if (res.sv4Inherited && res.sv4Inherited.length > 0)
      console.log(
        `   SV4 存量(HEAD 面已解析不到的名字,按棘轮只报名;修复未入库窗口内不得逼跳门 §12e):${res.sv4Inherited.join(', ')}`,
      )
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
  SV4_FILES,
  SV4_EXPANSION,
  SELF_SKIP,
  decide,
  judgeCopy,
  sv4Judge,
  sv4ExpansionJudge,
  maskPythonCommentFace,
  pythonFunctionBody,
  FIXTURE_TS,
  FIXTURE_PY,
  FIXTURE_COPY_OK,
  FIXTURE_COPY_BAD,
  FIXTURE_COPY_COMMENT,
  FIXTURE_ORCH,
  FIXTURE_MCP_DYNAMIC,
  FIXTURE_MCP_DEFER_SNAPSHOT,
  FIXTURE_MCP_DEFER_DOCSTRING_ONLY,
  FIXTURE_MCP_GHOST,
  FIXTURE_MCP_GHOST_IN_COMMENT,
  FIXTURE_PERSONAS_OK,
  FIXTURE_PERSONAS_BAD,
  FIXTURE_PERSONAS_COMMENTED,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
