#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门:agent 失败词表(结局三档 + 停摆位置十一档)的**跨语言等值 + 现场真实性 + 取词接线**对账
// (2026-11-01 立。本门收的是 `1670a522be` 自己登记的第一格欠账:词表立起来那天,
//  TS 表 ≡ Python 表这件事只住在 `packages/types/tests/agent-failure-vocabulary.test.ts` 一份里,
//  提交链上**没有任何一道门**会在两张表漂开时喊 —— §0.9「判据在、工具在、没人调度」的同型。)
//
// 为什么不挤进既有门(照 2026-10-07 机主"不扩守门 151 射程"那条纪律另计一票):
//   守门 151(`check-agent-status-vocabulary-parity.mjs`)判的是**子代理/后台进程六态**与**回合终态**
//   两域;本门判的是**失败结局**与**停摆位置**两域。域不同、成员互不引用(见词表头注的边界声明),
//   并置进同一张域表会让"新增一档"同时点亮两域的判据,归因即失效。
//   ⇒ 本门**复用 151 的解析器与副本判据**(`parseArraySet` / `parseTsUnion` / `judgeCopy` /
//     `maskPythonCommentFace`),不新造第二套成员表解析(§0.6 单一真相源);
//     只有"嵌套现场表(`{file, anchor}` 对)"这一形状 151 没有,故在本门实现一次并在头注点名。
//
// ── 判据(输入按被审面现读,不 import、不执行被审实现)────────────────────────────
//   FV1 跨语言成员等值(五张表,逐字同序):
//        TS `AGENT_FAILURE_OUTCOMES` ≡ TS `type AgentFailureOutcome`(必须**派生**自那张表,
//        写成第二份字面量联合即红)≡ Py `AgentFailureOutcome(StrEnum)` ≡ Py `*_VALUES`;
//        同型覆盖 stages / retryable families / terminal families。
//   FV2 现场表等值:TS `AGENT_STALL_STAGE_SITES` ≡ Py `STALL_STAGE_SITES` —— 键集 + 每档
//        `(file, anchor)` 两枚字面量逐字;`undetermined` 必须**不在**任一表内(它是"指不出环节"
//        的显式第三态,借任一真实环节冒充即失真,§0.3)。
//   FV3 现场真实性:每档登记的 `file` 在被审面**存在**且体内含 `anchor`(凭空造词/搬家未改表 ⇒ 红)。
//   FV4 取词单源(web 腿,2026-11-01 补第二格欠账):
//        ① types 面声明的消息根 `AGENT_FAILURE_WEB_MESSAGE_ROOT` 必须解析得到(缺席 ⇒ note,不判);
//        ② 五语言 web 词包里该根下的 `outcome` / `stage` 两个子对象键集**恰好等于**成员集合,
//           且每条译文非空、不等于键名(回显键名 = 翻译没落地);少一档 = 新增档位忘补词条 ⇒ 红;
//        ③ 出口件 `packages/shared/src/chat/agent-failure-display.ts` 与渲染件
//           `apps/web/src/components/chat/agent-failure-badge.tsx` 必须存在,渲染件必须 **import 出口件**
//           (§0.9:判据与词包都在但没有渲染位 = 造好没装车);
//        ④ 宿主消费面(web 侧)必须经出口取词:出现 `agentFailureDisplayKeys` 之外的自拼
//           词条键形态(`'outcome.' +` / `'stage.' +` 一类)⇒ 红。
//   FV5 端内禁第二份成员清单(复用 151 的 `judgeCopy`,含其 COPY_THRESHOLD=4 阈值):
//        候选按**标识符**预筛(`failure_outcome`/`failureOutcome`/`stall_stage`/`stallStage`),
//        不按成员词全仓扫(成员词 `timeout`/`cancelled` 全是常见英文词,151 的 SV5 已记过这一课);
//        候选文件代码面 ≥4 个不同成员字面量且不含任一 canonical 标识符 ⇒ 红。
//
// ── 三态绝不并桶 ────────────────────────────────────────────────────────────────
// 词表任一面取不到 / 声明改名或改形态解析不到 / 词包 JSON 解不进 / 现场表枚举到 0 个候选
// ⇒ **未判定 exit 2**(既不冒红也绝不记绿,§0.3;一台永远喊未判定的门和一台瞎掉的门账面一样)。
// 只有"被审面上本域声明整段缺席"(web 腿尚未落地)走 note —— 那是"这一维还不存在",不是"判过了"。
//
// ── 定级 ────────────────────────────────────────────────────────────────────────
// 违规即 exit 1(注册为 blocking,`stagedTriggers` 收到本域六枚被审文件 ⇒ 与本票无关的提交不跑本门,
// 不构成 §12e 恒红门)。装车前实测 HEAD 面逐维为绿(读数见交付报告);任何一格转红必须先清存量。
// 应急跳过:`HUSKY_SKIP_AGENT_FAILURE_VOCAB_PARITY=1`(以 scripts/guardian-runner.mjs 现值为准)。
//
// ── 取材面(与本仓其它守门同口径,§0.4)──────────────────────────────────────────
// 缺省判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 只作人工逃生舱;两旗同给 exit 2;
// `--root` 只在 `--worktree` 档有效。取材走 `lib/face-reader`(绝对路径 git / 显式 stdio / 字节分箱)。

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  judgeCopy,
  maskPythonCommentFace,
  parseArraySet,
  parseTsUnion,
} from './check-agent-status-vocabulary-parity.mjs'
import { maskComments } from './lib/code-mask.mjs'
import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { requireFlagValue } from './lib/flag-value.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 本门在 runner 条目里注册的应急跳过名(现值以 scripts/guardian-runner.mjs 为准)。 */
export const SELF_SKIP = 'HUSKY_SKIP_AGENT_FAILURE_VOCAB_PARITY'

/** 被审文件清单(六枚声明/消费面 + 三枚 web 取词面)。 */
export const FILES = {
  ts: 'packages/types/src/agent-failure-vocabulary.ts',
  py: 'apps/ai-service/app/core/agent_failure_vocabulary.py',
  loop: 'apps/ai-service/app/services/agent_loop_v2.py',
  router: 'apps/ai-service/app/routers/agents.py',
  cli: 'apps/cli/src/commands/agent.ts',
  /** web 取词出口(唯一出口,渲染件只认它) */
  display: 'packages/shared/src/chat/agent-failure-display.ts',
  /** web 渲染件(§0.9 的渲染位) */
  badge: 'apps/web/src/components/chat/agent-failure-badge.tsx',
  /** web 宿主消费面 */
  host: 'apps/web/src/components/ide/agent-pane/AgentPane.tsx',
}

/** web 词包五语言(与 §19 的五语言口径一致)。 */
export const WEB_LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']
export const WEB_MESSAGE_REL = (locale) => `packages/i18n/messages/web/${locale}.json`

/** 判据引用的 canonical 符号名(改名必须两侧与被审面同笔,否则判"解析不到"= 未判定)。 */
export const SYMBOLS = {
  tsOutcomes: 'AGENT_FAILURE_OUTCOMES',
  tsOutcomeUnion: 'AgentFailureOutcome',
  tsStages: 'AGENT_STALL_STAGES',
  tsStageUnion: 'AgentStallStage',
  tsRetryable: 'AGENT_RETRYABLE_ERROR_FAMILIES',
  tsTerminal: 'AGENT_TERMINAL_ERROR_FAMILIES',
  tsSites: 'AGENT_STALL_STAGE_SITES',
  tsMessageRoot: 'AGENT_FAILURE_WEB_MESSAGE_ROOT',
  pyOutcomeValues: 'AGENT_FAILURE_OUTCOME_VALUES',
  pyStageValues: 'AGENT_STALL_STAGE_VALUES',
  pyRetryable: 'AGENT_RETRYABLE_ERROR_FAMILIES',
  pyTerminal: 'AGENT_TERMINAL_ERROR_FAMILIES',
  pySites: 'STALL_STAGE_SITES',
  pyOutcomeEnum: 'AgentFailureOutcome',
  pyStageEnum: 'AgentStallStage',
  undetermined: 'undetermined',
}

/** FV5 的引用豁免:代码面出现其中任一标识符 ⇒ 该文件算"引用同一份"而不是自立一份。 */
export const CANONICAL_REFS = [
  SYMBOLS.tsOutcomes,
  SYMBOLS.tsStages,
  SYMBOLS.pySites,
  'agentFailureOutcomeOf',
  'agent_failure_outcome_of',
  'normalizeAgentFailureOutcome',
  'normalizeAgentStallStage',
  'ensure_agent_stall_stage',
  'failure_signal',
  'RETRYABLE_ERROR_FAMILY_SET',
  'agentFailureDisplayKeys',
  'resolveAgentFailure',
]

/** FV5 的候选预筛标识符(域锚点,不是成员词 —— 理由见头注)。 */
export const FV5_ANCHORS = ['failure_outcome', 'failureOutcome', 'stall_stage', 'stallStage']
const FV5_SCAN_PREFIXES = ['apps/', 'packages/']
const SKIP_RE = /(^|\/)(node_modules|dist|\.next|\.venv|__tests__|tests?|e2e)\//

/** 本门自身与夹具必然逐字写出成员(夹具不写就没法证明判据有牙)⇒ 按路径前缀自豁免。 */
export const SELF_EXEMPT_RE = /check-agent-failure-vocabulary-parity/

// ---------------------------------------------------------------------------
// 解析层
// ---------------------------------------------------------------------------

/** 逐字同序比较;只报"差在哪几档",顺序漂移单独点名(顺序是本仓词表的登记序契约)。 */
function eqOrdered(label, a, b, violations, sideA = 'TS', sideB = 'Python') {
  const A = [...a].map(String)
  const B = [...b].map(String)
  if (A.length === 0 || B.length === 0) {
    throw new Undetermined(`${label} 一侧枚举到 0 个成员 ⇒ 判死(不用 0 冒充"没有")`)
  }
  if (JSON.stringify(A) === JSON.stringify(B)) return
  const onlyA = A.filter((x) => !B.includes(x))
  const onlyB = B.filter((x) => !A.includes(x))
  if (onlyA.length === 0 && onlyB.length === 0) {
    violations.push(`FV1 ${label} 成员**顺序**漂开 ${sideA}=[${A.join(',')}] ${sideB}=[${B.join(',')}]`)
    return
  }
  violations.push(
    `FV1 ${label} 成员集合不等 仅${sideA}=[${onlyA.join(',')}] 仅${sideB}=[${onlyB.join(',')}]` +
      ' —— 改任何一侧必须同笔改另一侧(两侧各一份必然漂移,§0.6)',
  )
}

/** parseArraySet 的 items + residual:体内有解析不进的行 ⇒ 未判定(§0.3,不猜)。 */
function tableItems(src, name, label) {
  const got = parseArraySet(src, name, label)
  if (got.residual > 0) {
    throw new Undetermined(
      `${label} 表体里有 ${got.residual} 行既不是字符串条目也不是注释 ⇒ 形态解析不进,不猜`,
    )
  }
  return got.items
}

/** Python StrEnum 成员值(按登记序),并返回成员**名**(现场表用 `NAME.value` 当键,须由名反查值)。 */
export function parsePyStrEnum(src, className, label) {
  const s = src.replace(/\r\n/g, '\n')
  const head = new RegExp(`^[ \\t]*class ${className}\\(StrEnum\\):[ \\t]*$`, 'm').exec(s)
  if (!head) throw new Undetermined(`解析不到声明:${label}(Python 枚举改名/改基类即失锚,不猜)`)
  const body = s.slice(head.index + head[0].length).split('\n')
  const values = []
  const names = []
  for (const line of body) {
    if (line.trim() === '') continue
    if (!/^[ \t]/.test(line)) break // 缩进结束 ⇒ 出类体
    const m = maskPythonCommentFace(line).match(/^[ \t]+([A-Z][A-Z0-9_]*)[ \t]*=[ \t]*"([^"]+)"[ \t]*$/)
    if (!m) continue // docstring / 说明行不计条目
    names.push(m[1])
    values.push(m[2])
  }
  if (values.length === 0) throw new Undetermined(`${label} 枚到 0 个枚举成员 ⇒ 判死`)
  return { values, names }
}

/**
 * 声明定位 → 表体开括号下标。
 *
 * 为什么不用 151 的 `declIndex`:它把声明钉在**同一行**(`[^\n]*=` 后紧跟开括号),而本仓 TS 侧
 * 现场表的类型注解是跨行写的(`Readonly<\n  Partial<...>\n> = {`)—— 照抄会让门在真面上"解析不到",
 * 而"解析不到"的账面表现是未判定:一台永远喊未判定的门和一台瞎掉的门是一样的(§0.3)。
 * 形态:NAME 必须在行首(可选 export/const),其后**第一个真等号**(排除 `==`/`=>`/`!=`)之后的
 * 第一个开括号;开括号离等号超过 400 字符 ⇒ 判"解析不进"(未判定),不猜。
 */
function declBraceIndex(src, name, openChar, label) {
  const dm = new RegExp(`^[ \\t]*(?:export[ \\t]+)?(?:const[ \\t]+)?${name}\\b`, 'm').exec(src)
  if (!dm) throw new Undetermined(`解析不到声明:${label}(改名/改形态即失锚,不猜)`)
  let i = dm.index + dm[0].length
  let eq = -1
  while (i < src.length) {
    if (src[i] === '=') {
      const prev = src[i - 1] ?? ''
      const next = src[i + 1] ?? ''
      if (prev !== '=' && prev !== '!' && prev !== '<' && prev !== '>' && next !== '=' && next !== '>') {
        eq = i
        break
      }
    }
    if (i - dm.index > 400) break
    i += 1
  }
  if (eq < 0) throw new Undetermined(`${label} 的声明里 400 字符内找不到 ` + '=' + '(不猜)')
  const open = src.indexOf(openChar, eq)
  if (open < 0 || open - eq > 400) {
    throw new Undetermined(`${label} 等号后 400 字符内没有 ${openChar}(表体形态解析不进,不猜)`)
  }
  return open
}

/**
 * 现场表(TS 形状):`NAME = { stage: { file: '…', anchor: '…' }, … }`(同行/跨行都认)。
 * 判定面遮注释(maskComments 语义由 code-mask 唯一实现提供,本门不另写词法器)。
 * 为什么 151 的 parseRecordStringValues 不够用:它只取 `key: 'value'`,本域值是嵌套对象 ——
 * 硬套会把合法声明判成"解析不进的行"(= 未判定),而"解析不进的行"绝不能记绿(§0.3)。
 */
export function parseTsSitePairs(src, name, label) {
  const s = maskCommentFace(src)
  const open = declBraceIndex(s, name, '{', label)
  const lines = s.slice(open).split('\n').slice(1)
  const out = []
  let cur = null
  // 条目键的缩进 = 表内第一个键的缩进;更深缩进的 `file:` / `anchor:` 是**属性行**,不得当成新条目
  let entryIndent = null
  for (const line of lines) {
    if (/^[ \t]*\}[ \t]*(?:as[ \t]+const)?[ \t]*;?[ \t]*$/.test(line)) break
    const ind = /^([ \t]*)/.exec(line)[1].length
    const key = /^[ \t]*([A-Za-z_$][\w$]*)[ \t]*:/.exec(line)
    if (key && (entryIndent === null || ind === entryIndent)) {
      if (entryIndent === null) entryIndent = ind
      cur = { key: key[1], values: [] }
      out.push(cur)
    }
    if (!cur) continue
    for (const m of line.matchAll(/'([^'\n]*)'|"([^"\n]*)"/g)) {
      if (m[1] !== undefined) cur.values.push(m[1])
      else if (m[2] !== undefined) cur.values.push(m[2])
    }
    if (line.includes('}') && cur.values.length > 0) cur = null
  }
  if (out.length === 0) throw new Undetermined(`${label} 枚到 0 个条目 ⇒ 判死`)
  for (const e of out) {
    if (e.values.length !== 2) {
      throw new Undetermined(
        `${label}.${e.key} 取到 ${e.values.length} 枚字面量(期望 file + anchor 两枚)⇒ 表体形态解析不进,不猜`,
      )
    }
  }
  return out.map((e) => ({ key: e.key, file: e.values[0], anchor: e.values[1] }))
}

/** 现场表(Python 形状):`NAME = { AgentStallStage.LLM_REQUEST.value: ("file", "anchor"), … }`。 */
export function parsePySitePairs(src, name, enumNames, enumValues, label) {
  const s = maskPythonCommentFace(src.replace(/\r\n/g, '\n'))
  const open = declBraceIndex(s, name, '{', label)
  const lines = s.slice(open).split('\n').slice(1)
  const out = []
  let cur = null
  let entryIndent = null
  for (const line of lines) {
    if (/^[ \t]*\}[ \t]*$/.test(line)) break
    const ind = /^([ \t]*)/.exec(line)[1].length
    const key =
      /^[ \t]*(?:[A-Za-z_][\w]*\.([A-Z][A-Z0-9_]*)\.value|['"]([a-z][\w]*)[''])[ \t]*:/.exec(line)
    if (key && (entryIndent === null || ind === entryIndent)) {
      if (entryIndent === null) entryIndent = ind
      const wire = key[1] ? pyWireValue(key[1], enumNames, enumValues, label) : key[2]
      cur = { key: wire, values: [] }
      out.push(cur)
    }
    if (!cur) continue
    for (const m of line.matchAll(/'([^'\n]*)'|"([^"\n]*)"/g)) {
      if (m[1] !== undefined) cur.values.push(m[1])
      else if (m[2] !== undefined) cur.values.push(m[2])
    }
    if (line.includes(')') && cur.values.length > 0) cur = null
  }
  if (out.length === 0) throw new Undetermined(`${label} 枚到 0 个条目 ⇒ 判死`)
  for (const e of out) {
    if (e.values.length !== 2) {
      throw new Undetermined(`${label}.${e.key} 取到 ${e.values.length} 枚字面量(期望两枚)⇒ 不猜`)
    }
  }
  return out.map((e) => ({ key: e.key, file: e.values[0], anchor: e.values[1] }))
}

/** 成员**名** → wire 值(现场表的键由枚举成员名拼出,不能靠 `.lower()` 猜)。 */
function pyWireValue(memberName, enumNames, enumValues, label) {
  const i = enumNames.indexOf(memberName)
  if (i < 0) {
    throw new Undetermined(
      `${label} 的键 ${memberName}.value 不在 ${SYMBOLS.pyStageEnum} 成员名清单里 ⇒ 名值对应判不出,不猜`,
    )
  }
  return enumValues[i]
}

/** 遮注释、留字符串的 TS 判定面(词法只有一份:code-mask)。 */
function maskCommentFace(src) {
  // 复用 code-mask 的唯一实现:maskComments 抹 `//` 与块注释,字符串原样保留(现场路径就住在字符串里)
  return maskComments(src.replace(/\r\n/g, '\n'))
}

// ---------------------------------------------------------------------------
// 判定聚合(纯函数:构造面即可证明三态分流,不必真机改名)
// ---------------------------------------------------------------------------

/**
 * @param {{ts:string, py:string, siteFiles:Record<string,string|null>,
 *          display?:string|null, badge?:string|null, host?:string|null,
 *          webMessages?:Record<string,string|null>, candidates?:{path:string, src:string}[]}} faces
 * @returns {{violations:string[], notes:string[], checked:string[]}}
 */
export function decide(faces) {
  const violations = []
  const notes = []
  const checked = []

  const ts = faces.ts
  const py = faces.py
  if (typeof ts !== 'string' || ts.length === 0) throw new Undetermined('TS 词表面取不到(不回落另一个面)')
  if (typeof py !== 'string' || py.length === 0) {
    throw new Undetermined('Python 词表面取不到(不回落另一个面)')
  }

  // ---- FV1 五张成员表跨语言等值 ----
  const tsOutcomes = tableItems(ts, SYMBOLS.tsOutcomes, 'TS 结局档表')
  const tsStages = tableItems(ts, SYMBOLS.tsStages, 'TS 停摆档表')
  const tsRetryable = tableItems(ts, SYMBOLS.tsRetryable, 'TS 可重试族表')
  const tsTerminal = tableItems(ts, SYMBOLS.tsTerminal, 'TS 终局族表')
  const pyOutcomeEnum = parsePyStrEnum(py, SYMBOLS.pyOutcomeEnum, 'Py AgentFailureOutcome')
  const pyStageEnum = parsePyStrEnum(py, SYMBOLS.pyStageEnum, 'Py AgentStallStage')
  const pyOutcomes = tableItems(py, SYMBOLS.pyOutcomeValues, 'Py 结局字面量总表')
  const pyStages = tableItems(py, SYMBOLS.pyStageValues, 'Py 停摆字面量总表')
  const pyRetryable = tableItems(py, SYMBOLS.pyRetryable, 'Py 可重试族表')
  const pyTerminal = tableItems(py, SYMBOLS.pyTerminal, 'Py 终局族表')

  eqOrdered('失败结局', tsOutcomes, pyOutcomes, violations)
  eqOrdered('停摆位置', tsStages, pyStages, violations)
  eqOrdered('可重试错误族', tsRetryable, pyRetryable, violations)
  eqOrdered('终局错误族', tsTerminal, pyTerminal, violations)
  // 同语言内部:StrEnum 成员 ≡ 供静态解析的字面量总表(两侧各一份的形态,pytest 也钉,但提交链只有本门)
  eqOrdered(
    'Py 结局枚举↔字面量表',
    pyOutcomeEnum.values,
    pyOutcomes,
    violations,
    'StrEnum',
    '字面量表',
  )
  eqOrdered(
    'Py 停摆枚举↔字面量表',
    pyStageEnum.values,
    pyStages,
    violations,
    'StrEnum',
    '字面量表',
  )
  checked.push('FV1 跨语言成员等值(4 张表 + 2 组枚举↔字面量)')

  // TS 派生联合必须**派生**自那张表(写成第二份字面量 = 同语言内的第二份成员清单)
  for (const [typeName, arrayName, label] of [
    [SYMBOLS.tsOutcomeUnion, SYMBOLS.tsOutcomes, 'TS 结局联合'],
    [SYMBOLS.tsStageUnion, SYMBOLS.tsStages, 'TS 停摆联合'],
  ]) {
    const u = parseTsUnion(ts, typeName, label)
    if (u.derivedFrom === null) {
      violations.push(
        `FV1 ${label} 写成字面量联合(${u.items.join(',')}),而唯一真源是 ${arrayName} —— ` +
          '必须用 `(typeof ' +
          arrayName +
          ')[number]` 派生,否则新增一档只会红一处',
      )
    } else if (u.derivedFrom !== arrayName) {
      violations.push(
        `FV1 ${label} 派生源是 ${u.derivedFrom},不是 ${arrayName} —— 联合与登记表不同源`,
      )
    }
  }
  checked.push('FV1 TS 联合派生源对账')

  // 两桶交集为空 + undetermined 不许进任何一桶(并了等于把"能不能重试"折回布尔)
  const overlap = tsRetryable.filter((f) => tsTerminal.includes(f))
  if (overlap.length > 0) {
    violations.push(`FV1 可重试族与终局族交集非空 [${overlap.join(',')}] —— 两桶并了一档等于又笼统`)
  }

  // ---- FV2 现场表跨语言等值 ----
  const tsSites = parseTsSitePairs(ts, SYMBOLS.tsSites, 'TS 停摆现场表')
  const pySites = parsePySitePairs(
    py,
    SYMBOLS.pySites,
    pyStageEnum.names,
    pyStageEnum.values,
    'Py 停摆现场表',
  )
  const tsKeys = tsSites.map((s) => s.key)
  const pyKeys = pySites.map((s) => s.key)
  const onlyTsK = tsKeys.filter((k) => !pyKeys.includes(k))
  const onlyPyK = pyKeys.filter((k) => !tsKeys.includes(k))
  if (onlyTsK.length + onlyPyK.length > 0) {
    violations.push(
      `FV2 现场表键集不等 仅TS=[${onlyTsK.join(',')}] 仅Python=[${onlyPyK.join(',')}] —— ` +
        '某一档在一侧有现场、另一侧没有,两端的"停在哪"就会各说各话',
    )
  }
  for (const s of tsSites) {
    const p = pySites.find((x) => x.key === s.key)
    if (!p) continue
    if (p.file !== s.file) {
      violations.push(`FV2 ${s.key} 现场文件不等 TS=${s.file} Python=${p.file}`)
    }
    if (p.anchor !== s.anchor) {
      violations.push(`FV2 ${s.key} 锚点不等 TS=${s.anchor} Python=${p.anchor}`)
    }
  }
  checked.push(`FV2 现场表逐字等值(${tsSites.length} 档)`)

  // `undetermined` 不许有现场:它是"指不出环节"的显式第三态,借真实环节冒充即反向失真
  for (const [side, sites] of [
    ['TS', tsSites],
    ['Python', pySites],
  ]) {
    if (sites.some((s) => s.key === SYMBOLS.undetermined)) {
      violations.push(
        `FV2 ${side} 现场表给 ${SYMBOLS.undetermined} 登记了现场 —— ` +
          '未判定档不得指任何真实环节(§0.3:没判不许读成判过)',
      )
    }
  }
  if (!(tsOutcomes.includes(SYMBOLS.undetermined) && tsStages.includes(SYMBOLS.undetermined))) {
    violations.push(
      `FV1 ${SYMBOLS.undetermined} 不在 TS 结局档/停摆档成员里 —— 第三态是本表相对"二分"的超越点,不许摘除`,
    )
  }

  // ---- FV3 现场真实性 ----
  const allStages = new Set([...tsStages, ...pyStages])
  for (const s of [...tsSites, ...pySites]) {
    if (!allStages.has(s.key)) {
      violations.push(`FV3 现场表登记了成员集合之外的档 ${s.key} —— 凭空造词`)
      continue
    }
    const content = faces.siteFiles?.[s.file]
    if (content === undefined) {
      throw new Undetermined(`FV3 现场文件 ${s.file} 未随本轮取材(同面同轮),不判`)
    }
    if (content === null) {
      violations.push(`FV3 ${s.key} 的现场文件在被审面上不存在:${s.file}(搬家须同批改表)`)
      continue
    }
    if (!content.includes(s.anchor)) {
      violations.push(`FV3 ${s.key} 的锚点 ${s.anchor} 不在 ${s.file} 里 —— 该环节已无人产出`)
    }
  }
  checked.push(`FV3 现场真实性(${[...new Set(tsSites.map((s) => s.file))].length} 个文件)`)

  // ---- FV4 web 取词单源 ----
  const rootMatch = new RegExp(
    `${SYMBOLS.tsMessageRoot}\\s*=\\s*'([^']+)'`,
    'm',
  ).exec(ts)
  if (!rootMatch) {
    notes.push(
      `FV4 跳过:TS 面未声明 ${SYMBOLS.tsMessageRoot} —— web 取词腿尚未落地,这一维**不存在**(不读成判过)`,
    )
  } else {
    const messageRoot = rootMatch[1]
    const paths = messageRoot.split('.').filter(Boolean)
    const per = []
    for (const locale of WEB_LOCALES) {
      const raw = faces.webMessages?.[locale]
      if (raw === undefined) throw new Undetermined(`FV4 ${locale} web 词包未随本轮取材`)
      if (raw === null) {
        violations.push(`FV4 web 词包在面上不存在:${WEB_MESSAGE_REL(locale)}`)
        continue
      }
      let doc
      try {
        doc = JSON.parse(raw)
      } catch (e) {
        throw new Undetermined(`FV4 ${locale} web 词包 JSON 解不进(${e.message}),不猜`)
      }
      let node = doc
      for (const seg of paths) {
        node = node && typeof node === 'object' ? node[seg] : undefined
      }
      if (!node || typeof node !== 'object') {
        violations.push(
          `FV4 ${locale}:词包里没有 ${messageRoot} 这一节 —— 新增宿主词条必须五语言同批(§19)`,
        )
        continue
      }
      for (const [sub, members, label] of [
        ['outcome', tsOutcomes, '结局档'],
        ['stage', tsStages, '停摆档'],
      ]) {
        const bag = node[sub]
        if (!bag || typeof bag !== 'object') {
          violations.push(`FV4 ${locale}:${messageRoot}.${sub} 缺失(${label}词条整节没有)`)
          continue
        }
        const keys = Object.keys(bag)
        const onlyM = members.filter((m) => !keys.includes(m))
        const onlyK = keys.filter((k) => !members.includes(k))
        if (onlyM.length + onlyK.length > 0) {
          violations.push(
            `FV4 ${locale}:${messageRoot}.${sub} 键集 ≠ ${label}成员集合 ` +
              `缺词条=[${onlyM.join(',')}] 多余=[${onlyK.join(',')}] —— ` +
              '键直接用 wire 值,新增档位忘补词条/写了没人取的键都会被这里点名',
          )
        }
        for (const k of keys) {
          const v = bag[k]
          if (typeof v !== 'string' || v.trim() === '') {
            violations.push(`FV4 ${locale}:${messageRoot}.${sub}.${k} 译文为空(空词条 = 界面上什么都没有)`)
          } else if (v === k) {
            violations.push(`FV4 ${locale}:${messageRoot}.${sub}.${k} 译文等于键名 —— 回显键名就是翻译没落地`)
          }
        }
      }
      per.push(locale)
    }
    checked.push(`FV4 web 词包取词对账(${per.join(',')})`)

    // 渲染位与出口件(§0.9:词包齐了但没人渲染 = 造好没装车)
    const display = faces.display
    const badge = faces.badge
    const host = faces.host
    if (display === undefined || badge === undefined || host === undefined) {
      throw new Undetermined('FV4 出口/渲染/宿主面未随本轮取材(同面同轮),不判')
    }
    if (display === null) {
      violations.push(`FV4 取词出口不存在:${FILES.display}`)
    } else if (!display.includes(SYMBOLS.tsMessageRoot)) {
      violations.push(
        `FV4 出口件没有 import/引用 ${SYMBOLS.tsMessageRoot} —— 消息根必须跟着词表走,不得端内自定`,
      )
    }
    if (badge === null) {
      violations.push(`FV4 web 渲染件不存在:${FILES.badge}(§0.9 的渲染位)`)
    } else if (!/from '@ihui\/shared\/chat\/agent-failure-display'/.test(badge)) {
      violations.push(
        `FV4 web 渲染件没经出口取词(缺 import @ihui/shared/chat/agent-failure-display)—— ` +
          '第二个取词出口必然漂移,禁止端内自拼词条键',
      )
    }
    if (host === null) {
      violations.push(`FV4 web 宿主消费面不存在:${FILES.host}`)
    } else if (!host.includes('AgentFailureBadge')) {
      violations.push(`FV4 宿主面没挂渲染件(缺 AgentFailureBadge)—— 词包与组件都在但屏幕上看不见`)
    }
    // 端内自拼词条键 = 第二份取词(出口是唯一出口)
    for (const c of faces.candidates ?? []) {
      if (c.path === FILES.display || c.path === FILES.badge || c.path === FILES.ts) continue
      if (/['"](?:outcome|stage)\.['"]\s*\+/.test(c.src) && !c.src.includes('agentFailureDisplayKeys')) {
        violations.push(
          `FV4 ${c.path} 自拼 ${messageRoot} 词条键(未走 agentFailureDisplayKeys 出口)—— 第二份取词`,
        )
      }
    }
  }

  // ---- FV5 端内第二份成员清单(复用 151 的 judgeCopy 与其阈值)----
  const memberSet = new Set([...tsOutcomes, ...tsStages, ...tsRetryable, ...tsTerminal])
  let fv5Candidates = 0
  for (const c of faces.candidates ?? []) {
    if (c.path === FILES.ts || c.path === FILES.py) continue
    if (!isScanEligible(c.path)) continue // 与取材层同一条修剪规则,判定面不另立一套
    if (typeof c.src !== 'string') continue
    const j = judgeCopy(null, c.src, memberSet, CANONICAL_REFS)
    if (j.violation) {
      fv5Candidates += 1
      violations.push(
        `FV5 ${c.path} 代码面逐字写了 ${j.members.length} 个本域成员(${j.members.join(',')})` +
          ' 而未引用词表任一 canonical 标识符 —— 端内第二份成员清单,下一笔只改一处必然漂开',
      )
    }
  }
  checked.push(`FV5 端内第二份清单扫描(命中 ${fv5Candidates} 处)`)

  return { violations, notes, checked }
}

// ---------------------------------------------------------------------------
// 取材
// ---------------------------------------------------------------------------

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

/** 候选修剪(取材层与判定层共用同一条规则,不得两处各写一遍 —— 151 的 pruneScan 同型)。 */
export function isScanEligible(p) {
  return (
    p.length > 0 &&
    FV5_SCAN_PREFIXES.some((pre) => p.startsWith(pre)) &&
    /\.(ts|tsx|py)$/.test(p) &&
    !SKIP_RE.test(p) &&
    !SELF_EXEMPT_RE.test(p)
  )
}

/** FV5 预筛:按域锚点标识符找候选(成员词全仓扫不可运营,151 的 SV5 已记过这一课)。 */
function grepCandidates(root, face) {
  const args = ['grep', '-l', '-I', '--no-color']
  for (const a of FV5_ANCHORS) args.push('-e', a)
  if (face === 'staged') args.push('--cached')
  else args.push('HEAD')
  args.push('--', 'apps', 'packages')
  let out
  try {
    out = gitRaw(args, root)
  } catch (e) {
    // git grep 无命中 = 退出码 1,是正常结论(不是取材失败)
    if (e instanceof Undetermined && e.status === 1) return []
    throw new Undetermined(`FV5 预筛派生失败(${face} 面):${e.message}`)
  }
  return out
    .split('\n')
    .map((l) => l.replace(/^(HEAD|:):/, '').trim())
    .filter(isScanEligible)
}

export function runAudit({ root = ROOT, face } = {}) {
  const sel = face
    ? { face, error: null }
    : selectFace({ staged: false, worktree: false, def: 'head' })
  if (sel.error) throw new Undetermined(sel.error)

  const fixed = [
    FILES.ts,
    FILES.py,
    FILES.display,
    FILES.badge,
    FILES.host,
    ...WEB_LOCALES.map(WEB_MESSAGE_REL),
  ]
  const candPaths = grepCandidates(root, sel.face)
  const contents = readContents(root, sel.face, [...fixed, ...candPaths])

  const siteFiles = {}
  {
    // 先解一遍现场表拿文件清单,再同面取那些文件的内容(FV3 与被审面同轮)
    const probe = parseTsSitePairs(contents[FILES.ts], SYMBOLS.tsSites, 'TS 停摆现场表')
    const rels = [...new Set(probe.map((s) => s.file))]
    const got = readContents(root, sel.face, rels)
    for (const rel of rels) siteFiles[rel] = got[rel] ?? null
  }

  const webMessages = {}
  for (const locale of WEB_LOCALES) webMessages[locale] = contents[WEB_MESSAGE_REL(locale)]
  const candidates = candPaths.map((p) => ({ path: p, src: contents[p] }))

  const verdict = decide({
    ts: contents[FILES.ts],
    py: contents[FILES.py],
    display: contents[FILES.display],
    badge: contents[FILES.badge],
    host: contents[FILES.host],
    siteFiles,
    webMessages,
    candidates,
  })
  return { face: sel.face, candidates: candPaths.length, ...verdict }
}

// ---------------------------------------------------------------------------
// --self-test:夹具证明每格判据**有牙**(不读脚本自己的注释)
// ---------------------------------------------------------------------------

const FIXTURE_TS = `
export const AGENT_FAILURE_OUTCOMES = ['retryable', 'terminal', 'undetermined'] as const
export type AgentFailureOutcome = (typeof AGENT_FAILURE_OUTCOMES)[number]
export const AGENT_STALL_STAGES = ['llm_request', 'tool_execution', 'undetermined'] as const
export type AgentStallStage = (typeof AGENT_STALL_STAGES)[number]
export const AGENT_RETRYABLE_ERROR_FAMILIES = ['timeout'] as const
export const AGENT_TERMINAL_ERROR_FAMILIES = ['cancelled'] as const
export const AGENT_FAILURE_WEB_MESSAGE_ROOT = 'ai.pane.turnFailure'
export const AGENT_STALL_STAGE_SITES: Readonly<Partial<Record<AgentStallStage, AgentStallStageSite>>> = {
  llm_request: {
    file: 'apps/ai-service/app/core/responses_retry.py',
    anchor: 'decide_stream_retry',
  },
  tool_execution: { file: 'apps/ai-service/app/services/agent_loop_v2.py', anchor: '_report_tool_error' },
}
`

const FIXTURE_PY = `
class AgentFailureOutcome(StrEnum):
    """失败结局三档。"""

    RETRYABLE = "retryable"
    TERMINAL = "terminal"
    #: 显式第三态
    UNDETERMINED = "undetermined"


class AgentStallStage(StrEnum):
    LLM_REQUEST = "llm_request"
    TOOL_EXECUTION = "tool_execution"
    UNDETERMINED = "undetermined"


AGENT_FAILURE_OUTCOME_VALUES: Final[tuple[str, ...]] = ("retryable", "terminal", "undetermined")
AGENT_STALL_STAGE_VALUES: Final[tuple[str, ...]] = ("llm_request", "tool_execution", "undetermined")
AGENT_RETRYABLE_ERROR_FAMILIES: Final[tuple[str, ...]] = ("timeout",)
AGENT_TERMINAL_ERROR_FAMILIES: Final[tuple[str, ...]] = ("cancelled",)
STALL_STAGE_SITES: Final[dict[str, tuple[str, str]]] = {
    AgentStallStage.LLM_REQUEST.value: (
        "apps/ai-service/app/core/responses_retry.py",
        "decide_stream_retry",
    ),
    AgentStallStage.TOOL_EXECUTION.value: (
        "apps/ai-service/app/services/agent_loop_v2.py",
        "_report_tool_error",
    ),
}
`

const FIXTURE_SITE_FILES = {
  'apps/ai-service/app/core/responses_retry.py': 'def decide_stream_retry():\n    pass\n',
  'apps/ai-service/app/services/agent_loop_v2.py': 'def _report_tool_error():\n    pass\n',
}

function webBundle(overrides = {}) {
  const doc = {
    ai: {
      pane: {
        turnFailure: {
          title: '失败结局',
          outcome: { retryable: '可重试', terminal: '终局', undetermined: '未判定' },
          stage: { llm_request: '模型请求', tool_execution: '工具执行', undetermined: '未判定' },
        },
      },
    },
  }
  for (const flag of Object.keys(overrides)) {
    if (!overrides[flag]) continue
    if (flag === 'drop-outcome-key') delete doc.ai.pane.turnFailure.outcome.terminal
    if (flag === 'drop-stage-node') delete doc.ai.pane.turnFailure.stage
    if (flag === 'empty-value') doc.ai.pane.turnFailure.outcome.retryable = '   '
    if (flag === 'echo-key') doc.ai.pane.turnFailure.outcome.terminal = 'terminal'
    if (flag === 'no-root') delete doc.ai.pane.turnFailure
  }
  return JSON.stringify(doc)
}

/** 只换某一语言的那份词包,其余四语言保持基线(证明判据按语言逐份判,不是整段跳过)。 */
function webOverride(locale, text) {
  return Object.fromEntries(WEB_LOCALES.map((l) => [l, l === locale ? text : webBundle()]))
}

function baseFaces(overrides = {}) {
  return {
    ts: FIXTURE_TS,
    py: FIXTURE_PY,
    siteFiles: FIXTURE_SITE_FILES,
    display: `import { AGENT_FAILURE_WEB_MESSAGE_ROOT } from '@ihui/types'\nexport const x = AGENT_FAILURE_WEB_MESSAGE_ROOT\n`,
    badge: `import { agentFailureDisplayKeys } from '@ihui/shared/chat/agent-failure-display'\n`,
    host: `import { AgentFailureBadge } from '@/components/chat/agent-failure-badge'\n`,
    webMessages: Object.fromEntries(WEB_LOCALES.map((l) => [l, webBundle(overrides.web || {})])),
    candidates: [],
    ...overrides,
  }
}

/** 取到违规列表(未判定统一转成 `{undetermined:message}` 便于反向对照断言)。 */
function judgeFaces(faces) {
  try {
    return decide(faces)
  } catch (e) {
    if (e instanceof Undetermined) return { violations: [], notes: [], checked: [], undetermined: e.message }
    throw e
  }
}

function selfTest() {
  const cases = []
  const ok = (name, cond, detail = '') => cases.push({ name, pass: Boolean(cond), detail })

  const clean = judgeFaces(baseFaces())
  ok(
    'T1 夹具基线全绿(且不得是"未判定"冒充绿)',
    clean.violations.length === 0 && !clean.undetermined && clean.notes.length === 0,
    `${clean.violations.join(' | ')}${clean.undetermined ? ` / 未判定:${clean.undetermined}` : ''}`,
  )

  const drift = judgeFaces(baseFaces({ py: FIXTURE_PY.replace('UNDETERMINED = "undetermined"', 'UNDETERMINED = "unknown"') }))
  ok('T2 Python 枚举值漂开 ⇒ FV1 红', drift.violations.some((v) => v.startsWith('FV1')), drift.violations.join(' | '))

  const missing = judgeFaces(
    baseFaces({ ts: FIXTURE_TS.replace(`', 'undetermined']`, `']`) }),
  )
  ok('T3 TS 少一档 ⇒ FV1 点名缺的那档', missing.violations.some((v) => v.includes('undetermined')), missing.violations.join(' | '))

  const literalUnion = judgeFaces(
    baseFaces({
      ts: FIXTURE_TS.replace(
        'export type AgentFailureOutcome = (typeof AGENT_FAILURE_OUTCOMES)[number]',
        "export type AgentFailureOutcome = 'retryable' | 'terminal' | 'undetermined'",
      ),
    }),
  )
  ok('T4 联合写成第二份字面量 ⇒ FV1 红', literalUnion.violations.some((v) => v.includes('派生')), literalUnion.violations.join(' | '))

  const siteDrift = judgeFaces(
    baseFaces({
      py: FIXTURE_PY.replace('_report_tool_error', '_report_tool_error_v9'),
    }),
  )
  ok('T5 现场锚点漂开 ⇒ FV2 点名该档', siteDrift.violations.some((v) => v.startsWith('FV2') && v.includes('锚点')), siteDrift.violations.join(' | '))

  const siteMoved = judgeFaces(
    baseFaces({ siteFiles: { ...FIXTURE_SITE_FILES, 'apps/ai-service/app/core/responses_retry.py': 'def other():\n    pass\n' } }),
  )
  ok('T6 现场文件在但锚点没了 ⇒ FV3 红', siteMoved.violations.some((v) => v.startsWith('FV3')), siteMoved.violations.join(' | '))

  const siteGone = judgeFaces(baseFaces({ siteFiles: { 'apps/ai-service/app/services/agent_loop_v2.py': null, 'apps/ai-service/app/core/responses_retry.py': FIXTURE_SITE_FILES['apps/ai-service/app/core/responses_retry.py'] } }))
  ok('T7 现场文件不存在 ⇒ FV3 点名文件', siteGone.violations.some((v) => v.includes('不存在')), siteGone.violations.join(' | '))

  const undSite = judgeFaces(
    baseFaces({
      ts: FIXTURE_TS.replace(
        '  tool_execution: { file:',
        "  undetermined: { file: 'x.py', anchor: 'y' },\n  tool_execution: { file:",
      ),
      siteFiles: { ...FIXTURE_SITE_FILES, 'x.py': 'y' },
    }),
  )
  ok('T8 给 undetermined 造现场 ⇒ FV2 红', undSite.violations.some((v) => v.includes('undetermined') && v.startsWith('FV2')), undSite.violations.join(' | '))

  const webGap = judgeFaces(baseFaces({ webMessages: webOverride('zh-CN', webBundle({ 'drop-outcome-key': true })) }))
  ok('T9 web 词包缺一档 ⇒ FV4 点名缺的键', webGap.violations.some((v) => v.startsWith('FV4') && v.includes('terminal')), webGap.violations.join(' | '))

  const webEcho = judgeFaces(baseFaces({ webMessages: webOverride('ja', webBundle({ 'echo-key': true })) }))
  ok('T10 web 译文回显键名 ⇒ FV4 红', webEcho.violations.some((v) => v.includes('回显键名')), webEcho.violations.join(' | '))

  const noBadge = judgeFaces(baseFaces({ badge: `import { AlertCircle } from 'lucide-react'\n` }))
  ok('T11 渲染件没经出口 ⇒ FV4 红', noBadge.violations.some((v) => v.startsWith('FV4') && v.includes('出口')), noBadge.violations.join(' | '))

  const noHost = judgeFaces(baseFaces({ host: `export const x = 1\n` }))
  ok('T12 宿主没挂渲染件 ⇒ FV4 红(§0.9)', noHost.violations.some((v) => v.includes('AgentFailureBadge')), noHost.violations.join(' | '))

  const copyBad = judgeFaces(
    baseFaces({
      candidates: [
        {
          path: 'apps/web/src/lib/self-made.ts',
          src: "const a = ['retryable', 'terminal', 'undetermined', 'llm_request']\nexport const b = a\n",
        },
      ],
    }),
  )
  ok('T13 端内第二份成员清单 ⇒ FV5 红', copyBad.violations.some((v) => v.startsWith('FV5')), copyBad.violations.join(' | '))

  const copyOk = judgeFaces(
    baseFaces({
      candidates: [
        {
          path: 'apps/web/src/lib/ok.ts',
          src: "import { AGENT_STALL_STAGES } from '@ihui/types'\nconst a = ['retryable', 'terminal', 'undetermined', 'llm_request']\nexport const b = [...AGENT_STALL_STAGES, ...a]\n",
        },
      ],
    }),
  )
  ok('T14 同文件引了 canonical ⇒ FV5 放行(反向对照)', copyOk.violations.length === 0, copyOk.violations.join(' | '))

  const noRoot = judgeFaces(baseFaces({ ts: FIXTURE_TS.replace(`export const AGENT_FAILURE_WEB_MESSAGE_ROOT = 'ai.pane.turnFailure'\n`, '') }))
  ok('T15 词表未声明 web 消息根 ⇒ 只 note 不判(FV4 缺席出口)', noRoot.violations.length === 0 && noRoot.notes.some((n) => n.startsWith('FV4')), `${noRoot.violations.join(' | ')} / ${noRoot.notes.join(' | ')}`)

  const unparser = judgeFaces(baseFaces({ py: 'x = 1\n' }))
  ok('T16 Python 枚举解析不到 ⇒ 未判定(不记绿也不冒红)', Boolean(unparser.undetermined) && unparser.violations.length === 0, unparser.undetermined || unparser.violations.join(' | '))

  const emptySitesTs = FIXTURE_TS.replace(
    /export const AGENT_STALL_STAGE_SITES[\s\S]*?\n\}/,
    'export const AGENT_STALL_STAGE_SITES: Readonly<Partial<Record<AgentStallStage, AgentStallStageSite>>> = {\n}',
  )
  const emptySites = judgeFaces(baseFaces({ ts: emptySitesTs }))
  ok('T17 现场表枚到 0 条 ⇒ 未判定(枚举 0 判死)', Boolean(emptySites.undetermined), emptySites.undetermined || '未触发')

  const badJson = judgeFaces(baseFaces({ webMessages: webOverride('ko', '{') }))
  ok('T18 web 词包 JSON 坏 ⇒ 未判定', Boolean(badJson.undetermined), badJson.undetermined || '未触发')

  const selfExempt = judgeFaces(baseFaces({ candidates: [{ path: 'packages/shared/src/chat/__tests__/agent-failure.test.ts', src: "const a = ['retryable','terminal','undetermined','llm_request']\n" }] }))
  ok('T19 tests 目录夹具不被 FV5 咬(修剪规则只此一份,判定面同引它)', selfExempt.violations.length === 0, selfExempt.violations.join(' | '))

  const outOfScope = judgeFaces(baseFaces({ candidates: [{ path: 'docs/notes.md', src: "const a = ['retryable','terminal','undetermined','llm_request']\n" }] }))
  ok('T20 扫描面之外的路径(.md)不进 FV5 射程', outOfScope.violations.length === 0, outOfScope.violations.join(' | '))

  let fail = 0
  for (const c of cases) {
    if (!c.pass) fail += 1
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}${c.pass ? '' : ` —— ${c.detail}`}`)
  }
  console.log(`\n--self-test:${cases.length - fail}/${cases.length} 通过`)
  return fail === 0 ? 0 : 1
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usage() {
  console.log(
    '用法: node scripts/check-agent-failure-vocabulary-parity.mjs [--staged|--worktree] [--root <dir>] [--json] [--self-test]\n' +
      '缺省判 HEAD blob;--staged 判索引 blob;--worktree 仅人工逃生舱(--root 只在该档有效);两旗同给 exit 2。\n' +
      '判据 FV1–FV5 见文件头注;违规 exit 1,未判定 exit 2,全绿 exit 0。',
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
  const json = argv.includes('--json')
  const sel = selectFace({ staged, worktree, def: 'head' })
  if (sel.error) {
    console.error(`❌ ${sel.error}`)
    process.exit(2)
  }
  let root = ROOT
  const rootFlag = requireFlagValue(argv, '--root', { noun: '目录参数' })
  if (rootFlag.error) {
    console.error(`❌ ${rootFlag.error}`)
    process.exit(2)
  }
  if (rootFlag.present) {
    if (!worktree) {
      console.error('❌ --root 只在 --worktree 档有效(换根仍按 HEAD 读 = 双根分裂,判死)')
      process.exit(2)
    }
    root = path.resolve(rootFlag.value)
  }

  let result
  try {
    result = runAudit({ root, face: sel.face })
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`⚪ 未判定(FV 门不猜):${e.message}`)
      process.exit(2)
    }
    console.error(`❌ 脚本自身异常:${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }

  if (json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    for (const c of result.checked) console.log(`  · ${c}`)
    console.log(`  · FV5 候选文件 ${result.candidates} 枚(按域锚点预筛)`)
    for (const n of result.notes) console.log(`  ⚠ ${n}`)
  }
  if (result.violations.length > 0) {
    if (!json) {
      for (const v of result.violations) console.error(`❌ ${v}`)
      console.error(
        `\n💡 词表两侧(或词包)漂开了。改任何一侧必须同笔改另一侧:\n` +
          `   TS  ${FILES.ts}\n   Py  ${FILES.py}\n` +
          `   web 词包 packages/i18n/messages/web/<五语言>.json 的 ai.pane.turnFailure\n` +
          `   自检: node scripts/check-agent-failure-vocabulary-parity.mjs --self-test\n` +
          `   紧急跳过(不推荐):${SELF_SKIP}=1 git commit ...\n`,
      )
    }
    process.exit(1)
  }
  console.log(`✅ agent 失败词表跨语言等值 / 现场真实性 / 取词接线全绿(${FACE_LABEL_TEXT(sel.face)})`)
  process.exit(0)
}

function FACE_LABEL_TEXT(face) {
  return face === 'staged' ? '索引 blob' : face === 'worktree' ? '工作树(人工档)' : 'HEAD blob'
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

export const __test__ = {
  FILES,
  SYMBOLS,
  SELF_SKIP,
  CANONICAL_REFS,
  WEB_LOCALES,
  WEB_MESSAGE_REL,
  decide,
  parsePyStrEnum,
  parseTsSitePairs,
  parsePySitePairs,
  FIXTURE_TS,
  FIXTURE_PY,
  FIXTURE_SITE_FILES,
  webBundle,
  baseFaces,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
