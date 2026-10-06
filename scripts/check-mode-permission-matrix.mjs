#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 模式 × 权限档笛卡尔矩阵跨语言对账(V3 #53,2026-09-27 立)。
//
// 【接线状态:已接入】注册条目已落在 scripts/guardian-runner.mjs(id 以 runner 现值为准,
// 勿照抄本行数字):blocking + skipEnv:HUSKY_SKIP_MODE_PERMISSION_MATRIX,带 stagedTriggers。
// —— 本段原写"尚未进提交链/只有本文件与镜像测试/由主会话统一落",并说明"刻意不声称已挂进
// 提交链是为守门 89 的 R1 不判红";该顾虑已消解(五处权威点里的 runner 现值确凿命中),
// 立论保留,接线事实按上条现读改写。
//
// 它钉的是什么病:
// 「计划模式只读」此前只写在提示词里,模型不听就没有任何机制拦它(V3 #53 票面)。
// HEAD 里已长出第一版硬收窄,但**判据散落且无跨语言尺子**:
//   · llm.py 自带一张 ChatMode→工具档表;
//   · packages/types 的 chat-mode-policy.ts 抄了同一张表(带 description);
//   · 两文件头注都写着"由 apps/ai-service/tests/test_chat_mode_tool_gate.py 对账" ——
//     而那个测试文件**在 HEAD 与磁盘上都不存在**。
//   ⇒ 这是一句可核验指针指向空处:任一侧改一格,不会有任何东西响。
//   · 而 mode × permission_mode 的**相交处**(选了 plan 之后 permission=bypassPermissions
//     还算不算只读)两处表都没写,散在各调用点的 if 里各猜方向。
//
// 五条判据(全部按被审面现读,不读工作树):
//   M1 三轴 ↔ 25 格:Python 与 TS 各自声明的矩阵,必须等于本门**独立按规矩推导**的结果
//      (规矩:tools = 两轴取更严 none<readonly<all;approval = 权限轴档位,仅 ask 折成 none)。
//      为什么本门要自己推一遍而不是调 Python 的 check_matrix_consistency():
//      那个自检同时读"表"和"推导函数",有人改推导规矩时它会跟着一起改口 —— 判据不能与被审实现同源。
//   M2 跨语言逐格等值:Python 矩阵 ≡ TS 矩阵(工具档 + 审批档各 25 格),三轴同样逐字同。
//   M3 ChatMode 契约表 ≡ 轴:chat-mode-policy.ts 的 CHAT_MODE_TOOL_POLICY[*].allow
//      必须与 CHAT_MODE_TOOL_AXIS 逐档同值(它是带 description 的那份对外契约)。
//   M4 交集实现处唯一:plan_mode.READONLY_TOOLS 这一集合在**代码面**只允许被
//      core/permission_mode.py 读取(声明处除外)。第二处 `in READONLY_TOOLS` 即红 ——
//      两份真相各写一半是本仓最高频失效型。谓词 is_readonly_tool( 的调用点只报数不判红
//      (它服务的是 acceptEdits 的免审批分支,不是可用性判定,不是同一格)。
//   M5 表必须有消费者(防"造好没人用"的装饰品):resolve_mode_policy 必须在
//      llm.py 与 agent_loop_v2.py 的代码面被调用。缺 ⇒ 红。
//
// 三态口径同 70/77/83/98/101/103:全量判 HEAD blob、--staged 判索引 blob、
// --worktree 仅人工、两面旗同给 exit 2;任一面取不到 ⇒ exit 2「无法判定」,
// 既不冒红也不记绿;枚举到 0 个候选文件判死。

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const FILES = {
  pyRegistry: 'apps/ai-service/app/core/permission_mode.py',
  pyPlanMode: 'apps/ai-service/app/services/plan_mode.py',
  pyLlm: 'apps/ai-service/app/routers/llm.py',
  pyAgentLoop: 'apps/ai-service/app/services/agent_loop_v2.py',
  tsRegistry: 'packages/types/src/permission-mode.ts',
  tsChatPolicy: 'packages/types/src/chat-mode-policy.ts',
}

export const CHAT_MODES = ['ask', 'build', 'plan', 'review', 'spec']
export const PERM_MODES = ['default', 'acceptEdits', 'bypassPermissions', 'plan', 'manual']
/** 工具档由严到宽的序:取更严 = 序小者。 */
export const TOOL_SEVERITY = { none: 0, readonly: 1, all: 2 }
export const TOOL_CLASSES = new Set(['all', 'readonly', 'none'])
export const APPROVAL_CLASSES = new Set(['all', 'safe', 'none'])

// ---------------------------------------------------------------------------
// 解析器(两侧读成同构数据)
// ---------------------------------------------------------------------------

/** Python:NAME: Final[...] = { ... } 的一层/两层字符串字典字面量。 */
export function parsePyDict(src, name) {
  // 不用 `Final\[[^\]]*\]` 之类的正则:类型里带嵌套方括号(dict[str, ToolClass]),
  // 也不靠 ".*?\n}" 收尾 —— 内层 row 的 } 会被当成交界,表被截成第一行。
  // 一律"定位声明 → 第一个 { → 括号配平",与 TS 侧同一套取法。
  const re = new RegExp(`\\b${name}\\s*:?[^=\\n]*=\\s*\\{`)
  const m = re.exec(src)
  if (!m) throw new Error(`未找到 Python 表声明: ${name}`)
  const open = m.index + m[0].length - 1
  const body = sliceBalancedBraces(src, open, name)
  // 内层 dict 与外层 dict 混在一坨文本里:先按 "key": { ... } 抓嵌套
  const nested = [...body.matchAll(/"([^"]+)"\s*:\s*\{([\s\S]*?)\}/g)]
  if (nested.length > 0) {
    const out = {}
    for (const [, key, inner] of nested) {
      out[key] = {}
      for (const m2 of inner.matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)) out[key][m2[1]] = m2[2]
    }
    return out
  }
  const flat = {}
  for (const m2 of body.matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)) flat[m2[1]] = m2[2]
  return flat
}

/** 从 openIdx 的 '{' 起做括号配平,返回不含外层花括号的正文。 */
export function sliceBalancedBraces(src, openIdx, label) {
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) return src.slice(openIdx + 1, i)
    }
  }
  throw new Error(`${label} 花括号不配平`)
}

/** Python:READONLY_TOOLS: frozenset[str] = frozenset({ ... }) → 字符串集合。 */
export function parsePyFrozenset(src, name) {
  const at = src.indexOf(name)
  if (at < 0) throw new Error(`未找到 Python 集合声明: ${name}`)
  const open = src.indexOf('{', at)
  if (open < 0) throw new Error(`${name} 的集合字面量解析不到左花括号`)
  const body = sliceBalancedBraces(src, open, name)
  return new Set([...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]))
}

/** TS:export const NAME ... = { ... } 的一层/两层字面量(键可无引号)。 */
export function parseTsDict(src, name) {
  const at = src.indexOf(`export const ${name}`)
  if (at < 0) throw new Error(`未找到 TS 表声明: ${name}`)
  const open = src.indexOf('{', at)
  if (open < 0) throw new Error(`${name} 找不到左花括号`)
  // 手写括号配平:正则的 .*? 会在第一个 \n} 处截断嵌套(内层 rows 就是这么被吃掉的)
  let depth = 0
  let end = -1
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end < 0) throw new Error(`${name} 花括号不配平`)
  const body = src.slice(open + 1, end)
  const rows = [...body.matchAll(/(?:'([^']+)'|([A-Za-z_][\w]*))\s*:\s*\{([\s\S]*?)\}/g)]
  if (rows.length > 0) {
    const out = {}
    for (const [, qk, bk, inner] of rows) {
      out[qk ?? bk] = {}
      for (const m2 of inner.matchAll(/(?:'([^']+)'|([A-Za-z_][\w]*))\s*:\s*'([^']+)'/g)) {
        out[qk ?? bk][m2[1] ?? m2[2]] = m2[3]
      }
    }
    return out
  }
  const flat = {}
  for (const m2 of body.matchAll(/(?:'([^']+)'|([A-Za-z_][\w]*))\s*:\s*'([^']+)'/g)) {
    flat[m2[1] ?? m2[2]] = m2[3]
  }
  return flat
}

/** TS:export const NAME: readonly string[] = [ ... ] → 字符串集合。 */
export function parseTsArray(src, name) {
  const at = src.indexOf(`export const ${name}`)
  if (at < 0) throw new Error(`未找到 TS 数组声明: ${name}`)
  // 必须从 `=` 之后起找左括号:类型注解 `readonly string[]` 里那个 `[]` 在前面,
  // 从声明名起扫会把**类型**当成数组本体,读出空集合(实测第一版就是这样,
  // 于是 M3 把"TS 少了整张白名单"报成跨语言漂移 —— 假阳,而且会淹掉真漂移)。
  const eq = src.indexOf('=', at)
  const open = src.indexOf('[', eq)
  const close = src.indexOf(']', open)
  if (eq < 0 || open < 0 || close < 0) throw new Error(`${name} 数组字面量解析不到结尾`)
  return new Set([...src.slice(open, close).matchAll(/'([^']+)'/g)].map((m) => m[1]))
}

/** chat-mode-policy.ts 的 CHAT_MODE_TOOL_POLICY: { ask: { allow: 'none', ... }, ... } */
export function parseTsChatPolicyAllows(src) {
  const table = parseTsDict(src, 'CHAT_MODE_TOOL_POLICY')
  const out = {}
  for (const [mode, cell] of Object.entries(table)) {
    if (typeof cell !== 'object') throw new Error(`CHAT_MODE_TOOL_POLICY[${mode}] 不是对象字面量`)
    if (!cell.allow) throw new Error(`CHAT_MODE_TOOL_POLICY[${mode}] 缺 allow 字段`)
    out[mode] = cell.allow
  }
  return out
}

// ---------------------------------------------------------------------------
// 独立推导(本门的尺子,不 import 被审实现)
// ---------------------------------------------------------------------------

/** 规矩:两轴取更严(none < readonly < all)。 */
export function deriveTools(toolsAxis, permToolsAxis) {
  const out = {}
  for (const chat of CHAT_MODES) {
    out[chat] = {}
    for (const perm of PERM_MODES) {
      const a = toolsAxis[chat]
      const b = permToolsAxis[perm]
      if (a === undefined || b === undefined) throw new Error(`轴缺档: ${chat}/${perm}`)
      out[chat][perm] = TOOL_SEVERITY[a] <= TOOL_SEVERITY[b] ? a : b
    }
  }
  return out
}

/** 规矩:审批档跟权限轴走,只有"根本没有工具可执行"(tools=='none')才折成 none。 */
export function deriveApproval(toolsMatrix, permApprovalAxis) {
  const out = {}
  for (const chat of CHAT_MODES) {
    out[chat] = {}
    for (const perm of PERM_MODES) {
      const t = toolsMatrix[chat][perm]
      out[chat][perm] = t === 'none' ? 'none' : permApprovalAxis[perm]
    }
  }
  return out
}

function cmpMatrix(label, a, b, problems) {
  for (const chat of CHAT_MODES) {
    for (const perm of PERM_MODES) {
      const va = a?.[chat]?.[perm]
      const vb = b?.[chat]?.[perm]
      if (va === undefined) problems.push(`${label}[${chat}][${perm}] 缺失`)
      else if (vb === undefined) problems.push(`${label}[${chat}][${perm}] 对侧缺失`)
      else if (va !== vb) problems.push(`${label}[${chat}][${perm}] 不一致: ${va} vs ${vb}`)
    }
  }
}

function cmpFlat(label, a, b, keys, problems) {
  for (const k of keys) {
    if (a[k] === undefined) problems.push(`${label}[${k}] 缺失`)
    else if (b[k] === undefined) problems.push(`${label}[${k}] 对侧缺失`)
    else if (a[k] !== b[k]) problems.push(`${label}[${k}] 不一致: ${a[k]} vs ${b[k]}`)
  }
}

/**
 * 剥注释(保留字符串),按语言给规则。
 *
 * 为什么必须参数化而不是"一套规则通吃":
 *  · Python 的 `//` 是**整除运算符**,按 JS 规则当注释会把真代码抹到行尾;
 *  · Python 的 `"""docstring"""` 若按单引号状态机走,第二个 `"` 会被当成闭引号,
 *    docstring 里的散文于是混进判据面 —— 实测本门第一版正是这样把 llm.py 函数 docstring
 *    里那句「plan_mode.READONLY_TOOLS」报成"第二处交集实现"(假阳)。
 *  · JS/TS 的 `#` 不是注释,按 Python 规则抹会把私有字段判没了。
 * 两层遮噪方向不同(认标识符要留字符串、认注释要抹),别混用 —— 见 AGENTS 门 118 同一条。
 */
export function stripCommentsKeepStrings(src, lang = 'js') {
  const py = lang === 'py'
  let out = ''
  let i = 0
  let inLine = null // 单引号串内
  while (i < src.length) {
    const c = src[i]
    const n = src[i + 1]
    if (!inLine) {
      const three = src.slice(i, i + 3)
      if (py && (three === '"""' || three === "'''")) {
        const close = src.indexOf(three, i + 3)
        i = close < 0 ? src.length : close + 3
        continue
      }
      if (py && c === '#') {
        while (i < src.length && src[i] !== '\n') i++
        continue
      }
      if (!py && c === '/' && n === '/') {
        while (i < src.length && src[i] !== '\n') i++
        continue
      }
      if (c === '/' && n === '*') {
        const e = src.indexOf('*/', i + 2)
        i = e < 0 ? src.length : e + 2
        continue
      }
      if (c === '"' || c === "'" || c === '`') inLine = c
      out += c
      i++
      continue
    }
    if (c === '\\') {
      out += c + (n ?? '')
      i += 2
      continue
    }
    if (c === inLine) inLine = null
    out += c
    i++
  }
  return out
}

function codeRefsTo(name, code) {
  const re = new RegExp(`\\b${name}\\b`, 'g')
  return [...code.matchAll(re)].length
}

/**
 * 数**调用**(不是名字出现)。`_?` 是必需的:agent_loop_v2 用
 * `resolve_mode_policy as _resolve_mode_policy` 的别名导入,裸 `\bNAME\b` 在
 * `_resolve_mode_policy(` 里因 `_` 属词字符而**匹配不到** —— 那会让"有没有消费者"
 * 这一维在别名的写法下失明(本仓反复记过的"判据失效表现为安静"同型)。
 */
function countCalls(name, code) {
  const re = new RegExp(`_?${name}\\s*\\(`, 'g')
  return [...code.matchAll(re)].length
}

// ---------------------------------------------------------------------------
// 判据聚合
// ---------------------------------------------------------------------------

/**
 * @param {{[k:string]: string|null}} files  六份被审面内容(null = 该面取不到)
 * @param {boolean} strictUndetermined      取不到是否计红(默认计"无法判定",由调用方折 exit 2)
 */
export function decide(contents) {
  const problems = []
  const notes = []
  // 按**期望键集**判缺失,而不是"contents 里恰好有什么":空对象 / 少一份输入都必须算
  // 未判定。旧写法 `Object.entries(contents).filter(...)` 在 c9(零候选)那种输入上
  // 得到空 missing ⇒ 直接往下解析 undefined —— 判据崩溃冒充"通过"是本仓最贵的一型。
  const expected = Object.values(FILES)
  const missing = expected.filter((k) => {
    const v = contents[k]
    return typeof v !== 'string' || v.length === 0
  })
  if (missing.length > 0) return { problems, notes, undetermined: missing }

  const py = contents[FILES.pyRegistry]
  const ts = contents[FILES.tsRegistry]
  const chat = contents[FILES.tsChatPolicy]
  const plan = contents[FILES.pyPlanMode]
  const llm = contents[FILES.pyLlm]
  const loop = contents[FILES.pyAgentLoop]

  const pyToolsAxis = parsePyDict(py, 'CHAT_MODE_TOOL_AXIS')
  const pyPermToolsAxis = parsePyDict(py, 'PERMISSION_MODE_TOOL_AXIS')
  const pyPermApprovalAxis = parsePyDict(py, 'PERMISSION_MODE_APPROVAL_AXIS')
  const pyToolsMatrix = parsePyDict(py, 'CHAT_PERMISSION_TOOL_MATRIX')
  const pyApprovalMatrix = parsePyDict(py, 'CHAT_PERMISSION_APPROVAL_MATRIX')
  const tsToolsAxis = parseTsDict(ts, 'CHAT_MODE_TOOL_AXIS')
  const tsPermToolsAxis = parseTsDict(ts, 'PERMISSION_MODE_TOOL_AXIS')
  const tsPermApprovalAxis = parseTsDict(ts, 'PERMISSION_MODE_APPROVAL_AXIS')
  const tsToolsMatrix = parseTsDict(ts, 'CHAT_PERMISSION_TOOL_MATRIX')
  const tsApprovalMatrix = parseTsDict(ts, 'CHAT_PERMISSION_APPROVAL_MATRIX')

  // ---- M1 表 ≡ 本门独立推导(两侧各核一次)----
  const wantTools = deriveTools(pyToolsAxis, pyPermToolsAxis)
  const wantApproval = deriveApproval(wantTools, pyPermApprovalAxis)
  cmpMatrix('M1 Python CHAT_PERMISSION_TOOL_MATRIX vs 轴推导', wantTools, pyToolsMatrix, problems)
  cmpMatrix(
    'M1 Python CHAT_PERMISSION_APPROVAL_MATRIX vs 轴推导',
    wantApproval,
    pyApprovalMatrix,
    problems,
  )
  cmpMatrix('M1 TS CHAT_PERMISSION_TOOL_MATRIX vs 轴推导', wantTools, tsToolsMatrix, problems)
  cmpMatrix('M1 TS CHAT_PERMISSION_APPROVAL_MATRIX vs 轴推导', wantApproval, tsApprovalMatrix, problems)

  // ---- M2 跨语言逐格等值 + 三轴同值 ----
  cmpFlat('M2 轴 CHAT_MODE_TOOL_AXIS(TS vs Python)', tsToolsAxis, pyToolsAxis, CHAT_MODES, problems)
  cmpFlat(
    'M2 轴 PERMISSION_MODE_TOOL_AXIS(TS vs Python)',
    tsPermToolsAxis,
    pyPermToolsAxis,
    PERM_MODES,
    problems,
  )
  cmpFlat(
    'M2 轴 PERMISSION_MODE_APPROVAL_AXIS(TS vs Python)',
    tsPermApprovalAxis,
    pyPermApprovalAxis,
    PERM_MODES,
    problems,
  )
  for (const chat of CHAT_MODES) {
    for (const perm of PERM_MODES) {
      const p = pyToolsMatrix[chat]?.[perm]
      const t = tsToolsMatrix[chat]?.[perm]
      if (p !== t) problems.push(`M2 工具格 [${chat}][${perm}] TS=${t} Python=${p}`)
      const pa = pyApprovalMatrix[chat]?.[perm]
      const ta = tsApprovalMatrix[chat]?.[perm]
      if (pa !== ta) problems.push(`M2 审批格 [${chat}][${perm}] TS=${ta} Python=${pa}`)
    }
  }
  // 值域闭合:任何一格必须是合法档,否则上面全等也照样能通过(两侧一起写错)
  for (const chat of CHAT_MODES) {
    for (const perm of PERM_MODES) {
      const v = pyToolsMatrix[chat]?.[perm]
      const a = pyApprovalMatrix[chat]?.[perm]
      if (v !== undefined && !TOOL_CLASSES.has(v)) problems.push(`M2 工具档取值非法 [${chat}][${perm}]=${v}`)
      if (a !== undefined && !APPROVAL_CLASSES.has(a))
        problems.push(`M2 审批档取值非法 [${chat}][${perm}]=${a}`)
    }
  }

  // ---- M3 对外契约表 ≡ 轴 ----
  const tsChatAllows = parseTsChatPolicyAllows(chat)
  cmpFlat('M3 chat-mode-policy CHAT_MODE_TOOL_POLICY.allow vs CHAT_MODE_TOOL_AXIS', tsChatAllows, pyToolsAxis, CHAT_MODES, problems)
  const pyReadonly = parsePyFrozenset(plan, 'READONLY_TOOLS')
  const tsReadonly = parseTsArray(chat, 'CHAT_MODE_READONLY_TOOLS')
  const onlyPy = [...pyReadonly].filter((n) => !tsReadonly.has(n))
  const onlyTs = [...tsReadonly].filter((n) => !pyReadonly.has(n))
  if (onlyPy.length > 0 || onlyTs.length > 0) {
    problems.push(
      `M3 只读白名单跨语言漂移 仅Python=[${onlyPy.join(',')}] 仅TS=[${onlyTs.join(',')}]`,
    )
  }

  // ---- M4 交集实现处唯一(判**成员/交集语法**,不判裸名字)----
  // 为什么不用"代码面出现 READONLY_TOOLS 即红":注释与 docstring 里"描述这份白名单"是
  // 正常写作(实测本仓第一版据此把 llm.py 的函数 docstring 报成违规),
  // 而真正的病灶形状只有一个 —— 在 core/permission_mode 之外做 `x in READONLY_TOOLS`
  // 或 `A & READONLY_TOOLS`。窄判据漏报的可能性由下面的"名字报数"兜住:
  // 名字在新面上冒头一定看得见,只是不据此判红。
  const MEMBERSHIP_RE =
    /(?:\bin|\b&)\s*READONLY_TOOLS\b|READONLY_TOOLS\s*(?:&|\.intersection)/g
  const codeSurfaces = {
    [FILES.pyRegistry]: stripCommentsKeepStrings(py, 'py'),
    [FILES.pyPlanMode]: stripCommentsKeepStrings(plan, 'py'),
    [FILES.pyLlm]: stripCommentsKeepStrings(llm, 'py'),
    [FILES.pyAgentLoop]: stripCommentsKeepStrings(loop, 'py'),
  }
  // 允许做成员判定的两处:矩阵出口本身 + 白名单**声明处**(plan_mode.is_readonly_tool 是
  // 那份集合的固有谓词,不在别处再抄一份才算唯一)。除这两处之外的成员判定即第二实现处。
  const INTERSECTION_HOME = new Set([FILES.pyRegistry, FILES.pyPlanMode])
  const intersections = []
  for (const [file, code] of Object.entries(codeSurfaces)) {
    const hits = [...code.matchAll(MEMBERSHIP_RE)].length
    if (hits === 0) continue
    if (INTERSECTION_HOME.has(file)) continue
    intersections.push(`${file}(${hits} 处)`)
  }
  if (intersections.length > 0) {
    problems.push(
      `M4 交集第二实现处:${intersections.join(', ')} —— 可用性判定必须走 ` +
        'core/permission_mode.allowed_tool_names / tool_allowed_by_policy;' +
        '两份真相各写一半是本仓最高频失效型',
    )
  }
  const nameCounts = Object.entries(codeSurfaces)
    .map(([f, c]) => [f.split('/').pop(), codeRefsTo('READONLY_TOOLS', c)])
    .filter(([, n]) => n > 0)
  if (nameCounts.length > 0) {
    notes.push(
      `READONLY_TOOLS 代码面出现次数(只报数): ${nameCounts.map(([f, n]) => `${f}=${n}`).join(', ')}`,
    )
  }
  // 谓词调用点只报数:它服务 acceptEdits 免审批分支,与可用性判定不是同一格
  const predicateHits = Object.entries(codeSurfaces)
    .map(([f, c]) => [f, codeRefsTo('is_readonly_tool', c)])
    .filter(([, n]) => n > 0)
  if (predicateHits.length > 0) {
    notes.push(
      `is_readonly_tool 谓词调用点(只报数,不判红): ${predicateHits.map(([f, n]) => `${f}=${n}`).join(', ')}`,
    )
  }

  // ---- M5 表必须有消费者 ----
  const consumers = {
    resolve_mode_policy: [FILES.pyLlm, FILES.pyAgentLoop],
    allowed_tool_names: [FILES.pyLlm, FILES.pyAgentLoop],
    tool_allowed_by_policy: [FILES.pyLlm, FILES.pyAgentLoop],
    blocked_tool_message: [FILES.pyLlm, FILES.pyAgentLoop],
  }
  const pyCallSites = {
    [FILES.pyLlm]: codeSurfaces[FILES.pyLlm],
    [FILES.pyAgentLoop]: codeSurfaces[FILES.pyAgentLoop],
  }
  for (const [fn, want] of Object.entries(consumers)) {
    const found = want.filter((f) => countCalls(fn, pyCallSites[f] || '') > 0)
    if (found.length === 0) {
      problems.push(
        `M5 矩阵出口 ${fn}() 无生产调用点(期望面: ${want.join(' / ')})—— ` +
          '一张没人读的表就是装饰品,与 O81"建表必须同枚提交就有消费方"同一条禁令',
      )
    }
  }

  return { problems, notes, undetermined: [] }
}

function readContents(root, face) {
  const rels = Object.values(FILES)
  if (face === 'worktree') {
    const out = {}
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
  const got = catBatch(root, specs, { maxBuffer: 1 << 28 })
  const out = {}
  rels.forEach((rel, i) => {
    out[rel] = got.get(specs[i]) ?? null
  })
  return out
}

export function runAudit({ root = ROOT, face } = {}) {
  const usedFace = face || selectFace({ staged: false, worktree: false, def: 'head' })
  const contents = readContents(root, usedFace)
  try {
    const res = decide(contents)
    return { face: usedFace, ...res, fileCount: Object.keys(contents).length }
  } catch (e) {
    // 解析器读不到表 ⇒ **无法判定**,不是一枚带栈回溯的崩溃,也不是"没问题"。
    // 现实场景:本门比被审代码先到某个检出(注册早已装车,矩阵由另一枚提交带),
    // 或有人在矩阵上做了语法性破坏。两种都必须喊"看不见",绝不能静默算通过。
    const msg = e instanceof Error ? e.message : String(e)
    return {
      face: usedFace,
      problems: [],
      notes: [],
      undetermined: [`解析失败:${msg}`],
      fileCount: Object.keys(contents).length,
    }
  }
}

function selfTest() {
  const cases = []
  const t = (name, ok) => cases.push({ name, ok })
  const src = runAudit({ root: ROOT, face: 'worktree' })
  // 先取一份真实语料,再逐条注入变异(变异必须走 decide() 这个生产入口,不得各写一份判据)
  const base = readContents(ROOT, 'worktree')
  const clone = () => JSON.parse(JSON.stringify(base))
  const py = base[FILES.pyRegistry]

  t('真仓工作树面解析成功(6 份输入都在)', Object.values(base).every((v) => typeof v === 'string'))
  t('M2 两侧逐格全等时零问题', decide(base).problems.length === 0)

  // 变异一律"先证明文本真的被改,再断言判据红" —— 否则 replace 打空、
  // 用例会因为"什么都没变所以没问题"而假绿(写这三条时第一版就踩了两次)。
  const flipCell = (src, rowKey, want, to) => {
    const at = src.indexOf(rowKey)
    if (at < 0) return null
    const from = src.indexOf(want, at)
    if (from < 0 || from - at > 400) return null
    return src.slice(0, from) + to + src.slice(from + want.length)
  }

  const c1 = clone()
  const flipped = flipCell(py, 'CHAT_PERMISSION_TOOL_MATRIX: Final', '"default": "all"', '"default": "x"')
  c1[FILES.pyRegistry] = flipped ?? py
  const p1 = flipped === null ? [] : decide(c1).problems
  t(
    'M1/M2 有牙:Python 工具矩阵一格被改脏(build×default all→x)必点名',
    flipped !== null &&
      p1.some((s) => s.startsWith('M1') && s.includes('[build][default]')) &&
      p1.some((s) => s.startsWith('M2') && s.includes('[build][default]')),
  )

  const c2 = clone()
  c2[FILES.tsRegistry] = base[FILES.tsRegistry].replace(
    "bypassPermissions: 'none',\n    plan: 'all',",
    "bypassPermissions: 'all',\n    plan: 'all',",
  )
  t(
    'M1 有牙:TS 审批格 build×bypass 改成 all 必判红(ask 之外不该有人能免批)',
    c2[FILES.tsRegistry] !== base[FILES.tsRegistry] &&
      decide(c2).problems.some((s) => s.startsWith('M1')),
  )

  const c3 = clone()
  // 改**轴**忘了改表:权限轴 plan 放宽成 all,25 格仍是 readonly。
  // 锚点必须落在**声明行**上 —— 文件头注释里也提到这个变量名,按名字 indexOf 会先撞注释,
  // 于是 cellAt 落在 400 字符窗口之外,变异静默不生效而用例照样"通过判据"(写本条时踩实)。
  const axisDecl = 'PERMISSION_MODE_TOOL_AXIS: Final'
  const axisAt = py.indexOf(axisDecl)
  const cellAt = axisAt < 0 ? -1 : py.indexOf('"plan": "readonly"', axisAt)
  const cellOffset = cellAt - axisAt
  c3[FILES.pyRegistry] =
    axisAt >= 0 && cellAt >= 0 && cellOffset < 400
      ? py.slice(0, cellAt) + '"plan": "all"' + py.slice(cellAt + '"plan": "readonly"'.length)
      : py
  const p3 = decide(c3).problems
  t(
    'M1 咬住"改了轴忘了改表":权限轴 plan 放宽 → 点名表与轴不符',
    axisAt >= 0 &&
      cellAt >= 0 &&
      cellOffset < 400 &&
      c3[FILES.pyRegistry] !== py &&
      p3.some((s) => s.startsWith('M1')),
  )

  const c4 = clone()
  c4[FILES.tsChatPolicy] = base[FILES.tsChatPolicy].replace(
    "review: { allow: 'readonly'",
    "review: { allow: 'all'",
  )
  t(
    'M3 咬住对外契约表与轴分叉(review 放宽为 all)',
    decide(c4).problems.some((s) => s.startsWith('M3')),
  )

  const c5 = clone()
  c5[FILES.tsChatPolicy] = base[FILES.tsChatPolicy].replace("  'read_file',\n", '')
  t(
    'M3 咬住只读白名单跨语言漂移(TS 少一个 read_file)',
    decide(c5).problems.some((s) => s.startsWith('M3') && s.includes('白名单')),
  )

  const c6 = clone()
  c6[FILES.pyLlm] =
    base[FILES.pyLlm] + '\nEXTRA = [n for n in agent_tools if n in READONLY_TOOLS]\n'
  t(
    'M4 咬住第二处交集实现(llm.py 再写一句 in READONLY_TOOLS)',
    decide(c6).problems.some((s) => s.startsWith('M4')),
  )

  const c7 = clone()
  // 出口整体断线:两个消费者文件都不再调用 resolve_mode_policy(只改 llm.py 不够 ——
  // import 语句里的裸名字仍会被数到,那正是"看起来有、其实没装车"要防的形状)。
  const before7 = base[FILES.pyLlm] + base[FILES.pyAgentLoop]
  c7[FILES.pyLlm] = base[FILES.pyLlm].replace(/_resolve_mode_policy\(|resolve_mode_policy\(/g, 'legacy_mode_check(')
  c7[FILES.pyAgentLoop] = base[FILES.pyAgentLoop].replace(/_resolve_mode_policy\(/g, 'legacy_mode_check(')
  const p7 = decide(c7).problems
  t(
    'M5 咬住"表建好没人读":两侧同时去掉 resolve_mode_policy 调用即红',
    before7.includes('resolve_mode_policy(') &&
      !c7[FILES.pyLlm].includes('resolve_mode_policy(') &&
      p7.some((s) => s.startsWith('M5') && s.includes('resolve_mode_policy')),
  )

  const c8 = clone()
  c8[FILES.pyAgentLoop] = null
  t('一份输入取不到 ⇒ 计未判定而非记绿', decide(c8).undetermined.length === 1)

  const c9 = {}
  t('零候选(全空面)不得被算作通过', decide(c9).undetermined.length > 0)

  // 解析器自身的形状锁:TS 括号配平不许被嵌套结构带偏
  const nested = parseTsDict(base[FILES.tsRegistry], 'CHAT_PERMISSION_TOOL_MATRIX')
  t(
    'TS 嵌套表解析出 5 行 × 5 档(括号配平不截断)',
    Object.keys(nested).length === 5 &&
      CHAT_MODES.every((c) => Object.keys(nested[c] || {}).length === 5),
  )
  t(
    '注释里的表名不得被 M4 当成代码引用(剥注释后 READONLY_TOOLS 只在 2 个文件命中)',
    Object.entries({
      [FILES.pyRegistry]: 1,
      [FILES.pyPlanMode]: 1,
    }).every(([f]) => codeRefsTo('READONLY_TOOLS', stripCommentsKeepStrings(base[f], 'py')) > 0) &&
      codeRefsTo('READONLY_TOOLS', stripCommentsKeepStrings(base[FILES.pyLlm], 'py')) === 0,
  )

  let pass = 0
  for (const c of cases) {
    console.log(`${c.ok ? '✅' : '❌'} ${c.name}`)
    if (c.ok) pass++
  }
  console.log(
    `--self-test:${pass}/${cases.length} 通过(真仓 ${src.face} 面问题数 ${src.problems.length})`,
  )
  return pass === cases.length ? 0 : 1
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(selfTest())
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  if (staged && worktree) {
    console.error('❌ --staged 与 --worktree 不能同时给(取材面必须唯一)')
    process.exit(2)
  }
  const face = staged ? 'staged' : worktree ? 'worktree' : 'head'
  let res
  try {
    res = runAudit({ root: ROOT, face })
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`⚠️ 无法判定(git 面取不到):${e.message}`)
      process.exit(2)
    }
    throw e
  }
  if (res.undetermined.length > 0) {
    console.error(
      `⚠️ 无法判定:${res.undetermined.length} 份输入在 ${face} 面取不到 —— ` +
        res.undetermined.join(', '),
    )
    process.exit(2)
  }
  for (const n of res.notes) console.log(`   · ${n}`)
  if (res.problems.length === 0) {
    console.log(
      `✅ 模式×权限档矩阵对账通过:${CHAT_MODES.length}×${PERM_MODES.length} 格两侧逐格等值、` +
        `与三轴推导一致,契约表/只读白名单同值,交集实现处唯一,出口有生产调用点(面=${face})`,
    )
    process.exit(0)
  }
  console.error(`❌ 模式×权限档矩阵对账发现 ${res.problems.length} 处问题(面=${face}):`)
  for (const p of res.problems) console.error(`   · ${p}`)
  console.error(
    '改法:唯一真源 = apps/ai-service/app/core/permission_mode.py 的三轴 + 25 格;\n' +
      '     先改真源,再镜像 packages/types/src/permission-mode.ts,两处同笔提交。\n' +
      '     不得为消红单独改一侧、不得放宽值域、不得删调用点。',
  )
  process.exit(1)
}

export const __test__ = {
  FILES,
  CHAT_MODES,
  PERM_MODES,
  parsePyDict,
  parsePyFrozenset,
  parseTsDict,
  parseTsArray,
  parseTsChatPolicyAllows,
  countCalls,
  deriveTools,
  deriveApproval,
  decide,
  stripCommentsKeepStrings,
  readContents,
  runAudit,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
