// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 工具契约声明面守门(A13 第一阶段,2026-09-25 立)。
//
// 判一条:**注册进工具面但没有契约声明**(含"挂了契约但缺需要它的字段")。
//
// 为什么要这一道:一等工具面 apps/cli/src/tools/index.ts 的 `Tool` 只有一个可选 `dangerLevel`,
// 注释自述缺省按只读处理 ⇒ "未声明即放行"。共享层的两个谓词已按"未声明即不可信"写
// (packages/types/src/tool-contract.ts),但翻缺省是行为变更、属第二阶段;在那之前,
// "新增工具不带契约"这件事必须有一道门拦着,否则第二阶段永远在追存量。
//
// ⚠️ 接线:guardian-runner id 111(blocking,skipEnv HUSKY_SKIP_TOOL_CONTRACT_DECLARED,
// stagedTriggers=apps/cli/src/tools/)。**注册表由主会话统一维护**,本文件不碰它。
//
// 口径(与 77 / 83 / 98 一致):
//   - 全量档判 **HEAD blob**,`--staged` 判**索引 blob**;`--worktree` 仅人工逃生舱。
//   - **锚点由两部分组成**(2026-09-26 换锚,治 G-207 的"摘除全盲"):
//       ① **计数棘轮**(原样保留)= 该文件 HEAD 自身的违规数,拦"这次把绕档加回来了";
//       ② **声明身份台账**(新增)= HEAD 上**哪些工具已经写了 contract**,按 `文件#工具名`
//          的**身份多重集**从 HEAD 现算(照 `scripts/check-task-claims.mjs` 的 CL3 写法:
//          不留手工 JSON 清单,所以它只会自己收紧)。已声明者在判定面上不再带 contract
//          ⇒ **TC3 判红并点名**。
//     为什么光有 ① 不够:摘掉一份**字段不全**的契约时,违规从 1 处 TC2 换成 1 处 TC1,
//     **计数持平** ⇒ ① 全绿(2026-09-26 临时仓实测 exit 0,取证见镜像测试 T19)。
//     计数只看得见"变多",看不见"换人" —— 而本门为"防摘除"而生。
//   - 存量 104 枚工具**全部无契约**(HEAD 实测 declared 身份 0 枚)⇒ ② 今天恒 0 红,
//     它不是恒红门,只在有人补上契约的那一刻起才有牙齿。把存量 104 处一次判红 = 每次提交
//     被逼 `--no-verify` = 约 158 道守门同时作废(§12e 那型),故 ② 零基线、① 原样保留。
//   - 取不到输入 ⇒ **exit 2「无法判定」**,既不冒红也不记绿。
//
// **暂存触及"本就不注册工具"的文件不得判红(2026-09-26 修,同一票的第二格)**:
// stagedTriggers 覆盖 `apps/cli/src/tools/` 整目录,而该目录 58 个 .ts 里实测 **34 个注册
// 0 枚工具**(helper / barrel / 策略表 / 平台适配)。旧 `enumerationBlind` 只看"这一面抽到
// 0 枚工具"就判 exit 2,于是改一个 `command-policy/tokenizer.ts` 的提交被本门硬拦(临时仓
// 实测复现,镜像测试 T19 的正例一侧)。现要求 **HEAD 侧确实注册过工具**才算抽取器失明;
// 两侧都是 0 ⇒ 契约判据对该文件**不适用**,如实打"不适用"计数并 exit 0 —— 既不冒红,
// 也不得把它写成"已核"。`anchorTools` 不传给 ⇒ 保守判失明(失效方向只能是"多要一次说明")。

//
// **TRD(Touch Requires Declaration)判据(2026-09-25 换锚点)**:上面那句棘轮在 `--staged`
// 档的锚点是"该文件 HEAD 自身违规数",实测后果是**任何人改任何一个存量工具文件,改完仍然
// "无契约",永远不红**(全量档读数:注册工具 104 / 无契约 104 / 棘轮余量 0;生产面
// `grep -rn "contract: {" apps/cli/src --include=*.ts | grep -v test` = **0 命中**)。
// 这台门原本只能拦"新写文件不带契约",而那恰好是最少发生的一种情况 —— 锚点选得太宽。
// 现 TRD 判据:**本次暂存触及某工具文件 ⇒ 该文件里每个注册进工具面的工具都必须有契约声明**,
// 不再享受"该文件 HEAD 存量违规数"这个锚点。全量档**逐字保持现状**(存量 104 仍只报数)。
//   - 直接上线 = "谁碰 builtins.ts 谁被拦"(那文件存量工具最多)⇒ 恒红门等于没有门
//     (§12e / 守门 77/83/108 反复记过),故带**有期限的宽限**:见 GRANDFATHER_UNTIL。
//   - 宽限内:只报数不判红;到期日之后转真拦。当前档位与剩余天数**每次运行都打在输出里**。
//
// 手动:node scripts/check-tool-contract-declared.mjs
//   [--staged|--worktree|--self-test|--flip-audit|--verbose|--real-smoke]
//   [--touch-requires-declaration | --no-touch-requires-declaration] [--today YYYY-MM-DD]
//   --flip-audit  第二阶段输入:按"未声明即不可信"的新缺省会被拦的工具数与清单(只报不改退出码)
//   --today       仅供取证构造"宽限内 / 已过期"两档,不依赖系统时钟;非 ISO 日期 ⇒ exit 2

// **TC5 确认凭据判据(2026-09-29 立,上游 zcode 取证票)**:契约里风险档落在
// `write` / `dangerous`(取 `contract.permission.riskLevel`,该值读不出时回退工具面
// `dangerLevel` 同域字面量)而 `contract.permission.confirmation` **缺席** ⇒ 判红。
// 上游证据(只读源,参数层确认而非执行层):
//   `apps/zcode-cli/packages/cli/src/command-center/handlers/plugins.ts:82-103`(缺 `--force`
//   直接回 usage 且**不执行**);`handlers/goal.ts:65-86`(覆盖既有 goal 需 `replace` 前缀
//   或一次显式确认);`command-center/types.ts:61-62`(幂等 no-op 用 `removed: … | null`
//   编码而非回 `true`)。
// 确认形状是**封闭三档**(与 `packages/types/src/tool-contract.ts` 的 `ToolConfirmationPolicy`
// 同形,那边是唯一类型源,本门只做静态结构解析,不得另立词表第二份含义):
//   `{ mode:'explicit-flag', flag:<非空参数名> }` / `{ mode:'interactive' }` /
//   `{ mode:'none', reason:<非空理由> }` —— "没有确认"必须是**显式决定+理由**,缺席不算决定。
// 存量(立门前现读):HEAD 面注册工具 105 / 带契约 0 ⇒ TC5 存量恒 0,判红只可能来自新增;
// 仍与 TC1/TC2 同走"该文件 HEAD 自身存量"棘轮,并发会话此刻若已补了写档契约,本判据
// 不会把别人欠的账算在本次提交头上(§12e 那型)。
// 行内出口(本门**第一份**豁免机制,沿用本仓统一的 `<族>-exempt: <原因>` 写法,
// 只开一条道、不另建 JSON 台账 —— 清单必然腐烂):工具行或其紧邻上一行写
// `contract-confirm-exempt: <原因>`;裸标记 / 标记后只剩注释闭合符 ⇒ 不生效。
// 注意:未登记进守门 108 的存活期表(该文件不在本票清单内),届时由 108 的"未登记族"
// 报数点名后补档 —— 这一点如实登记,不装作已被管住。

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readdirSync, statSync } from 'node:fs'

import {
  Undetermined,
  catBatch,
  gitRaw,
  selectFace,
  readWorktreeFile,
  FACE_LABEL,
  FACE_NOTE,
  assertRepoRoot,
} from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 扫描面:一等工具面的注册处(不含 tests/ —— 那里的 mock Tool 不是注册工具)。 */
const SCAN_DIRS = ['apps/cli/src/tools']
const FILE_EXT = '.ts'

/** 契约必须齐的三组(本阶段只落这三类语义;超时/取消/追踪本轮不装,不得在此要求)。 */
const CONTRACT_GROUPS = ['shape', 'permission', 'resultBudget']
const REQUIRED_IN_GROUP = { permission: ['effectScope'], shape: ['input', 'visibleToProvider'] }

/**
 * TC5 输入源(与 packages/types/src/tool-contract.ts 的 TOOL_CONFIRMATION_MODES /
 * TOOL_RISK_LEVELS 逐字同值;那边是唯一类型源,这里只是静态解析的词表投影,
 * 两侧不一致由 `--self-test` ST36 与 packages/types 的确认档测试各钉一半)。
 */
const TOOL_CONFIRMATION_MODES = new Set(['explicit-flag', 'interactive', 'none'])
/** 需要确认凭据的风险档(与 `ToolRiskLevel` 值域同源:read 之外两档)。 */
const CONFIRMATION_REQUIRED_RISK_LEVELS = new Set(['write', 'dangerous'])
/** 行内豁免标记(本门第一份、也是唯一一份豁免机制;必须带原因,只救 TC5 不救 TC1/TC2)。 */
const CONFIRM_EXEMPT_MARKER = 'contract-confirm-exempt:'

/**
 * TRD 宽限截止日 = **立票日 2026-09-25 + 14 天**(两周,给"碰存量工具前先补契约"留出窗口)。
 *
 * 依据:本判据默认开,而生产面 `contract: {` 实测 **0 命中**(注册工具 104 / 无契约 104)。
 * 当场判红会让每一次触碰 `apps/cli/src/tools/**` 的提交必被拦 ⇒ 各会话合法 `--no-verify`
 * ⇒ 约 130 道守门对全队同时失效(§12e 那型,本仓记过至少三次)。到期**只判红、绝不自动延长**:
 * 改这个日期消红等于把红推给下一个人,与守门 108 的 E3"过期未销账自己变红"同口径。
 */
const GRANDFATHER_UNTIL = '2026-10-09'
const TRD_FLAG = '--touch-requires-declaration'
const TRD_OFF_FLAG = '--no-touch-requires-declaration'
const DAY_MS = 86400000

// ==================== 源码切分:遮掉注释与字符串 ====================

const REGEX_ALLOWED_AFTER = new Set([
  '(',
  ',',
  '=',
  ':',
  '[',
  '!',
  '&',
  '|',
  '?',
  '{',
  '}',
  ';',
  '',
])

/**
 * 把注释与字符串/模板串内容遮成空格(长度不变、换行保留),使后面的花括号配平不被文案骗到。
 *
 * 正则字面量按"前一个有效字符"启发式识别 —— 判错的代价是遮多/遮少一段文本,
 * 而锚点与判定同用一份遮法,所以同文件内两侧一致(宁漏不误报)。
 */
export function maskNonCode(text) {
  const out = text.split('')
  const n = text.length
  let prev = ''
  let i = 0
  const blank = (from, to) => {
    for (let k = from; k < to && k < n; k += 1) if (text[k] !== '\n') out[k] = ' '
  }
  while (i < n) {
    const c = text[i]
    const two = text.slice(i, i + 2)
    if (c === '/' && two === '/*') {
      const end = text.indexOf('*/', i + 2)
      const stop = end < 0 ? n : end + 2
      blank(i, stop)
      i = stop
      continue
    }
    if (c === '/' && two === '//') {
      let end = i
      while (end < n && text[end] !== '\n') end += 1
      blank(i, end)
      i = end
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      let end = i + 1
      while (end < n) {
        if (text[end] === '\\') {
          end += 2
          continue
        }
        if (text[end] === c) break
        end += 1
      }
      blank(i + 1, Math.min(end, n))
      i = Math.min(end + 1, n)
      prev = c
      continue
    }
    if (c === '/' && REGEX_ALLOWED_AFTER.has(prev)) {
      let end = i + 1
      let inClass = false
      while (end < n) {
        if (text[end] === '\\') {
          end += 2
          continue
        }
        if (text[end] === '[') inClass = true
        else if (text[end] === ']') inClass = false
        else if (text[end] === '/' && !inClass) break
        else if (text[end] === '\n') break
        end += 1
      }
      if (end < n && text[end] === '/') {
        blank(i + 1, end)
        i = end + 1
        prev = '/'
        continue
      }
    }
    if (!/\s/.test(c)) prev = c
    i += 1
  }
  return out.join('')
}

// ==================== 对象字面量与直接成员 ====================

/** 花括号配平:返回 Map<起始下标, 结束下标(闭合 `}` 的位置)>。 */
export function findObjectRanges(masked) {
  const stack = []
  const ranges = new Map()
  for (let i = 0; i < masked.length; i += 1) {
    const c = masked[i]
    if (c === '{') stack.push(i)
    else if (c === '}') {
      const start = stack.pop()
      if (start !== undefined) ranges.set(start, i)
    }
  }
  return ranges
}

/** 一个对象字面量的**直接**成员名(深度 1),带值起点。方法简写(`execute(`)也算成员。 */
export function collectMembers(masked, start, end) {
  const members = []
  let depth = 0
  let i = start + 1
  while (i < end) {
    const c = masked[i]
    if (c === '{' || c === '[' || c === '(') depth += 1
    else if (c === '}' || c === ']' || c === ')') {
      if (depth === 0) break
      depth -= 1
    }
    if (depth === 0) {
      const m = /^([A-Za-z_$][\w$]*)\s*[:({]/.exec(masked.slice(i, i + 80))
      if (m) {
        const sep = m[0].trim().slice(-1)
        const after = i + m[0].length
        let v = after
        while (v < end && /\s/.test(masked[v])) v += 1
        members.push({ name: m[1], keyIndex: i, valueStart: v, sep })
        if (sep === '(' || sep === '{') depth += 1 // 这两个分隔符已被吃掉,配平要补记
        i = v
        continue
      }
    }
    i += 1
  }
  return members
}

/** 从原文里取一个字符串字面量的值(遮法已保证 valueStart 落在引号上才调用)。 */
function readStringValue(text, at) {
  const q = text[at]
  if (q !== '"' && q !== "'" && q !== '`') return null
  let i = at + 1
  let val = ''
  while (i < text.length) {
    if (text[i] === '\\') {
      val += text[i + 1] ?? ''
      i += 2
      continue
    }
    if (text[i] === q) return val
    val += text[i]
    i += 1
  }
  return null
}

function lineOf(masked, index) {
  let line = 1
  for (let i = 0; i < index && i < masked.length; i += 1) if (masked[i] === '\n') line += 1
  return line
}

/**
 * `execute` 的值是否像可执行体:排除标量字面量与对象/数组字面量。
 *
 * 为什么要这一道:光看"同层有 name + execute"会把 `nested: { name: 'x', execute: 1 }` 这类
 * 普通对象当工具(自检的假工具对照)。识别不出箭头函数/被引用的函数,但那种写法本仓现状没有,
 * 判据宁窄不误报 —— 漏一个真工具只是少计一条,多计一个假工具会把无关提交钉红。
 */
function looksLikeExecutableValue(masked, valueStart) {
  const c = masked[valueStart]
  if (c === undefined) return false
  return !['"', "'", '`', '{', '['].includes(c) && !/[0-9]/.test(c)
}

/**
 * 抽出一个源文件里的工具字面量。
 *
 * 判据:一个对象字面量的直接成员**同时**含 `name` 与函数形态的 `execute` ⇒ 它是 Tool 字面量。
 * 这样既不吃 tests/ 的 mock(扫描面已排除),也不把"只有 name 的普通对象"或
 * "execute 嵌在更深一层的对象"当工具。
 */
export function extractToolLiterals(text) {
  const masked = maskNonCode(text)
  const ranges = findObjectRanges(masked)
  const rawLines = String(text).split('\n')
  const tools = []
  for (const [start, end] of ranges) {
    const members = collectMembers(masked, start, end)
    const nameMember = members.find((m) => m.name === 'name')
    const executeMember = members.find(
      (m) =>
        m.name === 'execute' && (m.sep === '(' || looksLikeExecutableValue(masked, m.valueStart)),
    )
    if (!nameMember || !executeMember) continue
    const toolName = readStringValue(text, nameMember.valueStart) ?? '(non-literal)'
    const contractMember = members.find((m) => m.name === 'contract')
    const dangerMember = members.find((m) => m.name === 'dangerLevel')
    const line = lineOf(masked, nameMember.keyIndex)
    const groups = contractMember
      ? contractGroupsOf(text, masked, ranges, contractMember.valueStart)
      : null
    tools.push({
      toolName,
      line,
      hasContract: Boolean(contractMember),
      groups,
      axisMandate: Boolean(groups?.axisMandate),
      hasDangerLevel: Boolean(dangerMember),
      dangerLevel: dangerMember ? readStringValue(text, dangerMember.valueStart) : null,
      // TC5 输入:契约 permission 里的风险档字面量与确认凭据形状(解析细节见 contractGroupsOf)
      riskLevel: groups?.riskLevel ?? null,
      confirmation: groups?.confirmation ?? null,
      confirmExemptReason: findConfirmationExemptReason(rawLines, line),
    })
  }
  tools.sort((a, b) => a.line - b.line)
  return tools
}

/**
 * TC5 行内豁免的唯一识别出口(本门第一份、也是唯一一份豁免机制;不建 JSON 台账 —— 清单必然腐烂)。
 *
 * 只认**注释里**的标记(标记须落在本行首个 `//` 或 `/*` 之后)—— 字符串里的同名子串
 * 不得发放豁免,否则一句 description 就能关掉判据。生效落点:工具行本身或其紧邻上一行
 * (与守门 102 GA4 同一教训:"人按直觉写在块上却只认同行"= 恒红)。
 * 原因不得由注释闭合符冒充(裸标记、或标记后只剩块注释闭合符 / `-->` ⇒ 不生效;守门 102 同一条锁。
 * 注:此处刻意不写出那个两字符闭合序列 —— 说明性文字里带上它会把承载它的注释自己截断,
 * 本仓 stripJsonc 一课同型)。
 */
export function findConfirmationExemptReason(lines, lineNo) {
  for (const idx of [lineNo - 1, lineNo - 2]) {
    const line = lines && lines[idx]
    if (typeof line !== 'string') continue
    const markerAt = line.indexOf(CONFIRM_EXEMPT_MARKER)
    if (markerAt < 0) continue
    const slashes = line.indexOf('//')
    const block = line.indexOf('/*')
    const commentAt = Math.min(
      slashes < 0 ? Number.POSITIVE_INFINITY : slashes,
      block < 0 ? Number.POSITIVE_INFINITY : block,
    )
    if (!Number.isFinite(commentAt) || markerAt < commentAt) continue
    const reason = line
      .slice(markerAt + CONFIRM_EXEMPT_MARKER.length)
      .replace(/(\*\/|-->)\s*$/, '')
      .trim()
    if (reason.length > 0) return reason
  }
  return null
}

/**
 * 契约对象直接成员 + permission / shape 子对象直接成员,并解出 TC4 的 axisMandate 与
 * TC5 的两项输入(riskLevel 字面量、confirmation 形状)。
 */
function contractGroupsOf(text, masked, ranges, valueStart) {
  const end = ranges.get(valueStart)
  if (end === undefined) return { contractMembers: [], note: 'contract 值不是对象字面量' }
  const contractMembers = collectMembers(masked, valueStart, end)
  const nested = {}
  // TC4 输入(D142 权限轴):permission 子对象里**任一**"必须由人批准"的承诺被写成字面量 true。
  // 读的是遮罩面 ⇒ 注释里的 `alwaysAsk: true` 与字符串里的同名词都不算声明。
  let axisMandate = false
  // 权限轴声明不到("挂了契约但 permission 不是可解析的对象字面量")既不得算"声明了",
  // 也不得静默算"没声明"—— 单列一格由 TC4 如实报名(把没看清写成没问题是本仓最高频失效型)。
  let axisUndetermined = false
  // TC5 输入(与 TC4 同一次 permission 遍历取,禁止第二遍各扫各的 ⇒ 两处必漂移):
  // riskLevel 字面量 + confirmation 的形状(mode/flag/reason 各取字符串值,读不出 = null)。
  let riskLevel = null
  let confirmation = null
  for (const member of contractMembers) {
    const childEnd = ranges.get(member.valueStart)
    if (childEnd === undefined) {
      if (member.name === 'permission') axisUndetermined = true
      continue
    }
    const kids = collectMembers(masked, member.valueStart, childEnd)
    nested[member.name] = kids.map((m) => m.name)
    if (member.name === 'permission') {
      axisMandate = kids.some(
        (k) =>
          (k.name === 'alwaysAsk' || k.name === 'requiresApproval') &&
          /^\s*true\s*(?:,|$)/.test(masked.slice(k.valueStart, Math.min(childEnd, k.valueStart + 40))),
      )
      const readStr = (name) => {
        const k = kids.find((x) => x.name === name)
        return k ? readStringValue(text, k.valueStart) : null
      }
      riskLevel = readStr('riskLevel')
      const cm = kids.find((x) => x.name === 'confirmation')
      if (!cm) {
        confirmation = { present: false, parseable: false, mode: null, flag: null, reason: null }
      } else {
        const cEnd = ranges.get(cm.valueStart)
        if (cEnd === undefined) {
          // confirmation 的值不是可配平的对象字面量 ⇒ "看不清",不得洗成"没有"也不得洗成"有"
          confirmation = { present: true, parseable: false, mode: null, flag: null, reason: null }
        } else {
          const inner = collectMembers(masked, cm.valueStart, cEnd)
          const readIn = (name) => {
            const k = inner.find((x) => x.name === name)
            return k ? readStringValue(text, k.valueStart) : null
          }
          confirmation = {
            present: true,
            parseable: true,
            mode: readIn('mode'),
            flag: readIn('flag'),
            reason: readIn('reason'),
          }
        }
      }
    }
  }
  return {
    contractMembers: contractMembers.map((m) => m.name),
    nested,
    axisMandate,
    axisUndetermined,
    riskLevel,
    confirmation,
  }
}

// ==================== 违规判定 ====================

/**
 * 三类红:
 *  - **TC1** 工具字面量完全没有 `contract`。
 *  - **TC2** 挂了 `contract` 但缺需要它的字段(三组之一缺席,或组内必填字段缺席)——
 *    这正是"契约字段缺省但落在需要它的档位":字段在但没值,与没挂契约同罪。
 *  - **TC5** 契约风险档落在写/危险(`write` / `dangerous`)而确认凭据缺席或形状不实 ——
 *    "没有确认"必须是**显式决定 + 理由**(`{ mode:'none', reason }`),不是字段没写。
 */
export function violationsOf(tools) {
  const out = []
  for (const tool of tools) {
    if (!tool.hasContract) {
      out.push({ toolName: tool.toolName, line: tool.line, kind: 'TC1-missing-contract' })
      continue
    }
    const groups = tool.groups
    if (!groups || !Array.isArray(groups.contractMembers)) {
      out.push({ toolName: tool.toolName, line: tool.line, kind: 'TC2-unparseable-contract' })
      continue
    }
    for (const group of CONTRACT_GROUPS) {
      if (!groups.contractMembers.includes(group)) {
        out.push({
          toolName: tool.toolName,
          line: tool.line,
          kind: `TC2-missing-group:${group}`,
        })
        continue
      }
      for (const field of REQUIRED_IN_GROUP[group] ?? []) {
        if (!(groups.nested?.[group] ?? []).includes(field)) {
          out.push({
            toolName: tool.toolName,
            line: tool.line,
            kind: `TC2-missing-field:${group}.${field}`,
          })
        }
      }
    }
    // ---- TC5:写/危险档必须有确认凭据(豁免只开在这条上,不救 TC1/TC2)----
    if (confirmationObligationOf(tool) === 'required' && !tool.confirmExemptReason) {
      const c = tool.confirmation
      if (!c || !c.present) {
        out.push({ toolName: tool.toolName, line: tool.line, kind: 'TC5-confirmation-missing' })
      } else if (!c.parseable) {
        out.push({ toolName: tool.toolName, line: tool.line, kind: 'TC5-confirmation-unparseable' })
      } else if (typeof c.mode !== 'string' || !TOOL_CONFIRMATION_MODES.has(c.mode)) {
        out.push({
          toolName: tool.toolName,
          line: tool.line,
          kind: `TC5-confirmation-unknown-mode:${c.mode === null ? '(absent)' : c.mode}`,
        })
      } else if (c.mode === 'explicit-flag' && !(typeof c.flag === 'string' && c.flag.trim())) {
        out.push({ toolName: tool.toolName, line: tool.line, kind: 'TC5-confirmation-flag-missing' })
      } else if (c.mode === 'none' && !(typeof c.reason === 'string' && c.reason.trim())) {
        out.push({
          toolName: tool.toolName,
          line: tool.line,
          kind: 'TC5-confirmation-none-without-reason',
        })
      }
    }
  }
  return out
}

/**
 * TC5 的义务判定(纯函数,三态 + 不适用;自检与报告共用一份,不得两处各写各的):
 *  - 没有契约 / 契约解析不到 ⇒ `'n/a'`(TC1/TC2 已在管,不在此重复计债)
 *  - 风险档读得出且落在写/危险 ⇒ `'required'`;读得出而非危险档 ⇒ `'not-required'`
 *  - permission.riskLevel 与工具面 dangerLevel **都**读不出字面量 ⇒ `'undetermined'`
 *    (如实报数,既不冒红也不记绿 —— 把"没看清"写成"没问题"是本仓最高频失效型)
 *
 * riskLevel 优先(契约是唯一类型源);只有它缺席/非字面量时才回退工具面 dangerLevel,
 * 且回退只认同一值域(read/write/dangerous)—— 别的字样是"判不出",不猜。
 */
export function confirmationObligationOf(tool) {
  if (!tool.hasContract || !tool.groups || !Array.isArray(tool.groups.contractMembers)) return 'n/a'
  const readLevels = [tool.riskLevel, tool.dangerLevel].filter(
    (v) => typeof v === 'string' && v.length > 0,
  )
  if (tool.riskLevel !== null && tool.riskLevel !== undefined && tool.riskLevel !== '') {
    return CONFIRMATION_REQUIRED_RISK_LEVELS.has(String(tool.riskLevel))
      ? 'required'
      : 'not-required'
  }
  if (readLevels.length === 0) return 'undetermined'
  const fallback = String(readLevels[0])
  if (!CONFIRMATION_REQUIRED_RISK_LEVELS.has(fallback) && fallback !== 'read') return 'undetermined'
  return CONFIRMATION_REQUIRED_RISK_LEVELS.has(fallback) ? 'required' : 'not-required'
}

/** 第二阶段输入:按"未声明即不可信"的新缺省会被拦的工具(既没契约也没显式 dangerLevel)。 */
export function flipAuditOf(tools) {
  return tools.filter((t) => !t.hasContract && !t.hasDangerLevel)
}

/**
 * 棘轮锚点判序:**只拦"这次改动把绕档加回来了"**。
 *
 * 锚点 = 该文件 HEAD 自身违规数;新文件(HEAD 里没有)锚点为 0 ⇒ 任何违规即红。
 * 把锚点写成 0 会让存量 102 个无契约工具整片报红 ⇒ 逼人 `--no-verify` ⇒ 全部守门作废。
 */
export function exceedsAnchor(current, anchor) {
  return current > anchor
}

// ==================== 声明身份台账(TC3,2026-09-26 换锚) ====================

/**
 * 工具的稳定标识 = `文件#工具名`。
 *
 * 为什么必须是**身份多重集**而不是计数:照 `scripts/check-task-claims.mjs` 的 CL3 ——
 * 那里的实测教训是"按前 N 条切存量"会让新塞进来的一颗顶掉一颗旧残留的名额,两者都得绿。
 * 本门同型错误长成"摘掉一份旧契约、冒出另一份新契约",计数看不见,只有身份看得见。
 * 为什么是多重集而不是名字集合:同名两枚(例如两枚都取不到字面量名 ⇒ 同为 `(non-literal)`)
 * 摘掉其中一颗,名字集合仍是那一颗 —— 名额会互相冒充,所以同名要各记一票。
 */
export function toolKey(fileRel, toolName) {
  return `${fileRel}#${toolName}`
}

/**
 * 一份文件的声明台账:`Map<身份, {total, declared}>`。
 * `total` 用来区分"契约被摘掉"与"整枚工具被删掉" —— 后者不属本判据(删除面是守门 99 的地盘)。
 */
export function declarationLedgerOf(fileRel, tools) {
  const ledger = new Map()
  for (const t of tools || []) {
    const key = toolKey(fileRel, t.toolName)
    const cur = ledger.get(key) ?? { total: 0, declared: 0 }
    cur.total += 1
    if (t.hasContract) cur.declared += 1
    ledger.set(key, cur)
  }
  return ledger
}

/**
 * TC3 判据本体(纯函数):HEAD 上已声明契约的工具,在判定面上**仍然存在却不再声明** ⇒ 红。
 *
 * 三条判序都必要:
 *  - `allowed = min(head.declared, current.total)`:工具整枚不见(current 无此身份)⇒ 放过,
 *    本门不越权判删除(AGENTS §16 越权那条)。
 *  - 台账**恒由 HEAD 现算**,不落地成手工 JSON:手工清单必然腐烂,而"某工具已有契约却未登记"
 *    必须自己收紧(§4 对 RN_ONLY_BRAND_KEYS 的同一条教训)。
 *  - 该文件不在 HEAD 上(新文件)⇒ 无声明可摘,调用方传空 Map 即可。
 * @param {Map<string,{total:number,declared:number}>} head  HEAD 面台账(null ⇒ 取不到,由调用方判"未判定")
 * @param {Map<string,{total:number,declared:number}>} current 判定面台账
 * @returns {{removed: Array<{key:string,headDeclared:number,currentDeclared:number,total:number,missing:number}>, declaredIdentities: number}}
 */
export function findDeclarationRemovals({ head, current } = {}) {
  const removed = []
  let declaredIdentities = 0
  const cur = current || new Map()
  for (const [key, h] of head || new Map()) {
    if (!h || h.declared <= 0) continue
    declaredIdentities += 1
    const c = cur.get(key)
    if (!c) continue // 整枚工具被删:不是"摘除契约"
    const allowed = Math.min(h.declared, c.total)
    if (c.declared < allowed)
      removed.push({
        key,
        headDeclared: h.declared,
        currentDeclared: c.declared,
        total: c.total,
        missing: allowed - c.declared,
      })
  }
  return { removed, declaredIdentities }
}

// ==================== TRD:触碰即须声明(2026-09-25 换锚点) ====================

/** 默认**开** —— 关掉的那台门等于没有门;只有显式 `--no-touch-requires-declaration` 才关。 */
export function trdEnabled(argv) {
  const a = argv || []
  if (a.includes(TRD_OFF_FLAG)) return false
  return true
}

function isoDay(value) {
  const s = String(value || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ''
  return Number.isNaN(Date.parse(`${s}T00:00:00Z`)) ? '' : s
}

/** 系统当日(仅供默认档使用;取证一律走 `--today` 注入,不得依赖它)。 */
function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * 宽限状态(纯函数,`today` 可注入 ⇒ 取证能同时构造"宽限内"与"已过期"两档)。
 *
 * 到期日**当天不算过期**(与守门 108 R03 一致);日期解不出来 ⇒ `known:false` +
 * `enforce:true` —— 半个日期比没有日期更危险,它看起来像被管过,所以宁可判红也不静默放行。
 */
export function trdState({ today, until = GRANDFATHER_UNTIL } = {}) {
  const t = isoDay(today)
  const u = isoDay(until)
  if (!t || !u) return { known: false, enforce: true, daysLeft: null, today: t, until: u }
  const daysLeft = Math.round(
    (Date.parse(`${u}T00:00:00Z`) - Date.parse(`${t}T00:00:00Z`)) / DAY_MS,
  )
  return { known: true, enforce: daysLeft < 0, daysLeft, today: t, until: u }
}

/**
 * TRD 判据本体(纯函数):输入"本次被暂存触及的每个工具文件 + 其违规清单 + 宽限状态"。
 *
 * 与棘轮的区别就是本票的全部要点:棘轮问"比该文件 HEAD 更糟吗",TRD 问"**碰了却没补齐吗**"。
 * 只在 `face === 'staged'` 生效 —— 全量档保持逐字不变,否则今天起没人能提交。
 */
export function trdAssess({ files, face, enabled = true, state } = {}) {
  const out = { applied: false, enforced: false, reds: [], notices: [], violations: 0, files: 0 }
  if (!enabled || face !== 'staged') return out
  out.applied = true
  out.enforced = Boolean(state && state.enforce)
  for (const f of files || []) {
    const n = (f.violations || []).length
    if (n === 0) continue
    out.files += 1
    out.violations += n
    ;(out.enforced ? out.reds : out.notices).push(f)
  }
  return out
}

/**
 * 「枚举到 0 个注册工具 ⇒ 判死」的判据(纯函数,便于取证不依赖真仓状态)。
 *
 * 只在暂存档生效:抽取器在"这次确实碰了工具面文件"却一枚工具都没抽到时,唯一诚实的结论是
 * **判据失明**,不得记为通过(全量档维持既有"枚举 0 个 .ts 文件才判死"的口径不变)。
 *
 * ⚠️ 但"这一面抽到 0 枚"**本身不构成失明证据** —— 本门 stagedTriggers 覆盖
 * `apps/cli/src/tools/` 整目录,实测 58 个 .ts 里 **34 个注册 0 枚工具**(helper / barrel /
 * 策略表 / 平台适配)。旧判据不看 HEAD 侧就判 exit 2,于是任何只碰那些文件的提交都被硬拦
 * (2026-09-26 临时仓实测;一次误拦的代价不是"多等一轮",是全队 `--no-verify` 连带废掉
 * 约 158 道门,§12e 同型)。现按 `anchorTools`(同一批文件在 HEAD 上注册了几枚)分流:
 *   - `> 0` 而本面 0 枚 ⇒ 抽取器失明或有人把整文件的工具清空 ⇒ **判死**;
 *   - `= 0` ⇒ 该文件本就不注册工具 ⇒ **契约判据不适用**,由调用方如实报数后 exit 0;
 *   - **未传**(undefined)⇒ 不知道基准 ⇒ 保守判死。失效方向只能是"多要一次定向说明",
 *     绝不能是"多放一次绿灯"(与本仓 findingLines / 归因铰链那几条教训同一条禁令)。
 */
export function enumerationBlind({
  face,
  enabled = true,
  judgedCount = 0,
  totalTools = 0,
  anchorTools,
} = {}) {
  if (!enabled || face !== 'staged') return false
  if (judgedCount === 0 || totalTools > 0) return false
  if (anchorTools === undefined) return true
  return anchorTools > 0
}

// ==================== TC4 权限轴字段级消费对账(D142,2026-09-29 立)====================

/** 权限轴投影的唯一出口所在文件(被审判的面与它同源,不在别处再抄一份档名清单)。 */
const AXIS_PROJECTION_REL = 'packages/types/src/tool-contract.ts'
/** 唯一出口的名字:摘掉 export(或整块删掉)⇒ 本档判"没有出路",而不是"无事可判"。 */
const AXIS_PROJECTION_EXPORT = /export function humanApprovalMandated\s*\(/

/**
 * TC4 判据本体(**纯函数**,自检与镜像都用构造面,不吃仓库瞬时状态)。
 *
 * 它在修什么:`ToolPermissionContract` 的字段(`effectScope` / `riskLevel` /
 * `requiresApproval` / `alwaysAsk`)此前有类型、有声明位,而**执行路径一条都不读**
 * —— TC1/TC2 判"有没有声明"、TC3 判"声明有没有被摘",三道都不问"字段值有没有参与决策"。
 * 本档钉的就是那一格:承诺"这次必须由人批准"的投影必须真的被决策宿主调用。
 *
 * 三条判序(与 AGENTS §5「认证不等于授权」、守门 115「校验器写了但零调用方」同族):
 *  1. 投影文件在本面**取不到** ⇒ `undetermined`(把"没读到"写成"没问题"是本仓最高频失效型);
 *  2. 投影不在位(export 被删/改名)⇒ `red: TC4-projection-missing` —— 没有出口时
 *     "宿主没调用"是同一件事的两种说法,先喊没出口,因为它才是根因;
 *  3. 投影在位而**生产宿主零调用** ⇒ `red: TC4-axis-unconsumed`。这一条**不看 axisDeclared**:
 *     现读注册面 `contract: {` 为 0 枚,若"没人声明就免判",本档恰好在权限轴完全未被使用的
 *     状态下绿灯 ⇒ 摘线零成本(与 115 的 `validateToolArguments(` 判据同取向)。
 *
 * `axisDeclared`(声明了承诺的工具枚数)只进报告行,不改退出码 —— 它是"这一型今天存不存在"
 * 的证据,不是判据输入。`axisUndetermined`(挂了契约但 permission 值解析不到)逐条报名:
 * 静默归零就等于把"看不清"写成"没声明"。
 *
 * @param {{projectionText: string|null, hostTexts: Iterable<[string, string|null]>,
 *          axisUndetermined?: number}} input
 * @returns {{status: 'ok'|'red'|'undetermined', reason?: string, consumers: string[],
 *            consumersMissing: string[]}}
 */
export function tc4AxisConsumption({
  projectionText,
  projectionHeadText = null,
  hostTexts,
  axisUndetermined = 0,
}) {
  if (projectionText === null || projectionText === undefined) {
    const headHas =
      projectionHeadText !== null &&
      projectionHeadText !== undefined &&
      AXIS_PROJECTION_EXPORT.test(maskNonCode(projectionHeadText))
    if (headHas) {
      // HEAD 上有这一份文件而判定面上读不到 ⇒ 文件被摘(与"摘掉 export"同一型),判红。
      return {
        status: 'red',
        reason: 'TC4-projection-removed',
        consumers: [],
        consumersMissing: [],
        axisUndetermined,
      }
    }
    // 两面都没有 = 这套接线尚未落地(或这是一座临时夹具仓)⇒ **未判定**:
    // 既不判红、也**不得 veto 整道门**。后者是本档落地当天由镜像 T19 抓到的自伤:
    // 一道附属输入的"取不到"把与本档无关的 helper 提交顶成 exit 2,就是把恒红写进了别人头上。
    return {
      status: 'unwired',
      reason: '本面与 HEAD 均无该投影 ⇒ 未判定(不判红,也不得因此否决整道门)',
      consumers: [],
      consumersMissing: [],
      axisUndetermined,
    }
  }
  if (!AXIS_PROJECTION_EXPORT.test(maskNonCode(projectionText))) {
    // 分两种,绝不并桶(把"还没落地"与"被摘掉"读成同一件事,要么造恒红门、要么放过摘线):
    //  - HEAD 上有而本面没有 ⇒ **真摘线**,判红(TC3 的身份台账同一形状:只比"曾经有过");
    //  - HEAD 上也没有 ⇒ 这套接线尚未落地(本票正是要落它),判"未判定",既不冒红也不记绿。
    //    否则在落地之前的每一次无关提交(含 --staged 档读索引里的旧包根)都会被一道
    //    与本次改动无关的红门钉住 ⇒ 各会话合法 --no-verify ⇒ 全部守门作废(§12e 那型)。
    return {
      status:
        projectionHeadText !== null &&
        projectionHeadText !== undefined &&
        AXIS_PROJECTION_EXPORT.test(maskNonCode(projectionHeadText))
          ? 'red'
          : 'unwired',
      reason: 'TC4-projection-removed',
      consumers: [],
      consumersMissing: [],
      axisUndetermined,
    }
  }
  const consumers = []
  const consumersMissing = []
  for (const [rel, text] of hostTexts) {
    if (rel === AXIS_PROJECTION_REL) continue
    if (text === null || text === undefined) {
      consumersMissing.push(rel)
      continue
    }
    // 只认**调用**(带左括号)且发生在代码面:注释里的提法不算装车(本仓"看起来有、其实没装"那一型)。
    if (/\bhumanApprovalMandated\s*\(/.test(maskNonCode(text))) consumers.push(rel)
  }
  if (consumers.length === 0) {
    return {
      status: 'red',
      reason: 'TC4-axis-unconsumed',
      consumers,
      consumersMissing,
      axisUndetermined,
    }
  }
  return { status: 'ok', consumers, consumersMissing, axisUndetermined }
}

// ==================== 取材 ====================

function listTrackedFiles(root, face) {
  const args =
    face === 'head'
      ? ['ls-tree', '-r', '--name-only', 'HEAD', '--', ...SCAN_DIRS]
      : ['ls-files', '--', ...SCAN_DIRS]
  const out = gitRaw(args, root, { timeout: 60000 })
  return String(out)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.endsWith(FILE_EXT))
}

function listWorktreeFiles(root) {
  const files = []
  for (const dir of SCAN_DIRS) {
    const abs = path.join(root, dir)
    let st
    try {
      st = statSync(abs)
    } catch {
      continue
    }
    if (!st.isDirectory()) continue
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isFile()) continue
      const rel = `${dir}/${entry.name}`
      if (rel.endsWith(FILE_EXT)) files.push(rel)
    }
  }
  return files.sort()
}

function stagedFilesInScope(root) {
  const out = gitRaw(
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '--', ...SCAN_DIRS],
    root,
    { timeout: 60000 },
  )
  return String(out)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.endsWith(FILE_EXT))
}

function readFace(root, face, files) {
  if (face === 'worktree') {
    const map = new Map()
    for (const rel of files) map.set(rel, readWorktreeFile(root, rel))
    return map
  }
  // catBatch 的键是**规格串**而不是相对路径 —— 回填成 rel 键,否则调用方 .get(rel) 恒 undefined,
  // 表现是"每个文件都取不到"被下游读成"没有违规"(一道假绿门)。
  const specs = files.map((f) => `${face === 'staged' ? ':' : 'HEAD:'}${f}`)
  const bySpec = catBatch(root, specs, { maxBuffer: 128 << 20 })
  const map = new Map()
  files.forEach((rel, i) => map.set(rel, bySpec.get(specs[i]) ?? null))
  return map
}

// ==================== 主流程 ====================

function main(argv) {
  const has = (flag) => argv.includes(flag)
  const verbose = has('--verbose')
  const flipAudit = has('--flip-audit')
  const trdOn = trdEnabled(argv)
  const todayFlagIdx = argv.indexOf('--today')
  const todayFlag = todayFlagIdx >= 0 ? argv[todayFlagIdx + 1] : ''
  if (todayFlagIdx >= 0 && !isoDay(todayFlag)) {
    console.error(
      `❌ 无法判定:--today 需要一个 ISO 日期(YYYY-MM-DD),收到「${todayFlag || '(空)'}」`,
    )
    return 2
  }
  const state = trdState({ today: todayFlag || isoToday() })
  const faceSel = selectFace({ staged: has('--staged'), worktree: has('--worktree') })
  if (faceSel.error) {
    console.error(`❌ ${faceSel.error}`)
    return 2
  }
  const face = faceSel.face
  let root
  try {
    assertRepoRoot(ROOT, '本门')
    root = ROOT
  } catch (e) {
    console.error(`❌ 无法判定:${e.message}`)
    return 2
  }

  let judged
  let anchorFiles
  try {
    const all = face === 'worktree' ? listWorktreeFiles(root) : listTrackedFiles(root, face)
    judged = face === 'staged' ? stagedFilesInScope(root) : all
    anchorFiles = face === 'head' ? all : listTrackedFiles(root, 'head')
    if (all.length === 0)
      throw new Undetermined(
        `${FACE_LABEL[face]} 在 ${SCAN_DIRS.join(', ')} 枚举到 0 个 ${FILE_EXT} 文件`,
      )
    if (face === 'staged' && judged.length === 0) {
      console.log('索引内无工具面文件,本门无需判定(非"已核")。')
      return 0
    }
  } catch (e) {
    console.error(`❌ 无法判定:${e.message}`)
    return 2
  }

  const anchorTexts = new Map()
  try {
    for (const [k, v] of readFace(root, 'head', anchorFiles)) anchorTexts.set(k, v)
  } catch (e) {
    console.error(`❌ 无法判定(锚点面):${e.message}`)
    return 2
  }
  const judgedTexts = new Map()
  try {
    for (const [k, v] of readFace(root, face, judged)) judgedTexts.set(k, v)
  } catch (e) {
    console.error(`❌ 无法判定(判定面):${e.message}`)
    return 2
  }

  let totalTools = 0
  let totalNoContract = 0
  let totalViolations = 0
  let headroom = 0
  let anchorTools = 0
  let declaredIdentities = 0
  let notApplicableFiles = 0
  // TC5 三桶(判红随棘轮走;豁免与判不出**只报数**,不并桶 —— "没看清"不得写成"没问题")
  let tc5RedsTotal = 0
  let tc5ExemptTotal = 0
  let tc5UndeterminedTotal = 0
  const reds = []
  const removals = []
  const perFile = []
  const flip = []
  let undeterminedFiles = 0

  for (const rel of judged) {
    const text = judgedTexts.get(rel)
    if (text === null || text === undefined) {
      undeterminedFiles += 1
      console.error(`⚠️ ${rel}:${FACE_LABEL[face]} 取不到内容,该文件未判定(不计通过)`)
      continue
    }
    const tools = extractToolLiterals(text)
    const violations = violationsOf(tools)
    for (const t of flipAuditOf(tools)) flip.push({ file: rel, ...t })
    totalTools += tools.length
    totalNoContract += tools.filter((t) => !t.hasContract).length
    totalViolations += violations.length
    tc5RedsTotal += violations.filter((v) => v.kind.startsWith('TC5-')).length
    for (const t of tools) {
      const obligation = confirmationObligationOf(t)
      if (obligation === 'undetermined') tc5UndeterminedTotal += 1
      else if (obligation === 'required' && t.confirmExemptReason) tc5ExemptTotal += 1
    }
    perFile.push({ rel, toolCount: tools.length, violations })

    // 锚点面:HEAD 里没有该文件 ⇒ 新文件,台账为空(无声明可摘);这与"整面取不到"
    // (上面 readFace 抛 ⇒ 已 exit 2)是两件事,不得混成同一个 null。
    const headText = anchorTexts.get(rel)
    const headTools =
      headText === null || headText === undefined ? [] : extractToolLiterals(headText)
    anchorTools += headTools.length
    if (tools.length === 0 && headTools.length === 0) notApplicableFiles += 1
    const anchor = violationsOf(headTools).length
    headroom += Math.max(0, anchor - violations.length)

    // TC3:声明身份台账对账(与计数棘轮**并行**,不替换它 —— 计数仍在管"新增绕档")
    const rem = findDeclarationRemovals({
      head: declarationLedgerOf(rel, headTools),
      current: declarationLedgerOf(rel, tools),
    })
    declaredIdentities += rem.declaredIdentities
    if (rem.removed.length > 0) removals.push({ rel, removed: rem.removed })

    if (exceedsAnchor(violations.length, anchor)) {
      reds.push({ rel, violations, anchor, current: violations.length })
    } else if (verbose) {
      console.log(`  ${rel}: 工具 ${tools.length} / 违规 ${violations.length}(HEAD 锚点 ${anchor})`)
    }
  }

  if (undeterminedFiles > 0) {
    console.error(
      `❌ 无法判定:${undeterminedFiles} 个文件在 ${FACE_LABEL[face]} 取不到 —— 不冒红也不记绿。`,
    )
    return 2
  }

  // TRD:暂存触及的工具文件里**每一枚**注册工具都必须带契约声明(不吃 HEAD 存量锚点)。
  const trd = trdAssess({ files: perFile, face, enabled: trdOn, state })
  if (
    enumerationBlind({
      face,
      enabled: trdOn,
      judgedCount: judged.length,
      totalTools,
      anchorTools,
    })
  ) {
    console.error(
      `❌ 无法判定:暂存触及 ${judged.length} 个 ${SCAN_DIRS.join('/ 或 ')} 下的文件,` +
        `本面枚举到 0 个注册工具而同一批文件在 HEAD 上注册 ${anchorTools} 个 —— ` +
        `抽取器在这一面上失明(或有人清空了整文件的工具),不得记为通过。`,
    )
    return 2
  }
  if (notApplicableFiles > 0) {
    // 这一格必须**喊出来**:它不是"判过了、没问题",而是"这些文件本就不注册工具,
    // 契约判据对它们没有话说"。静默算通过就是把"没判"写成"判过了"(守门 94 同型)。
    console.log(
      `ℹ️ 不适用:${notApplicableFiles} 个被判定的文件在 HEAD 与本面均注册 0 枚工具` +
        `(helper / barrel / 策略表这类)—— 契约判据对它们不适用,本门结论只覆盖其余文件。`,
    )
  }
  // ---- TC4 权限轴字段级消费对账(D142,2026-09-29)----
  // 宿主清单恒取**本面全量** SCAN_DIRS,不随 --staged 收窄:消费点在不在位与"本次暂存了
  // 哪些文件"结构上无关,按 staged 收范围等于在一枚只改工具 A 的提交上把"没接线"这一型
  // 判成绿灯(而摘线从来不需要碰被暂存的文件,它只需要碰 permissions.ts)。
  let tc4
  try {
    const axisHosts = face === 'worktree' ? listWorktreeFiles(root) : listTrackedFiles(root, face)
    const axisTexts = readFace(root, face, [...new Set([...axisHosts, AXIS_PROJECTION_REL])])
    // HEAD 侧只需要**那一份**投影文件:它判的是"这套接线在历史上存不存在"(区分摘线 vs 未落地)。
    const headProjection = readFace(root, 'head', [AXIS_PROJECTION_REL]).get(AXIS_PROJECTION_REL)
    const hostTexts = axisHosts.map((f) => [f, axisTexts.get(f) ?? null])
    let axisDeclared = 0
    let axisUndetermined = 0
    // 宿主 rel 在本循环不参与判定(报名由 tc4AxisConsumption 自己带),解构留空位以免 no-unused-vars
    for (const [, text] of hostTexts) {
      if (!text) continue
      for (const t of extractToolLiterals(text)) {
        if (t.axisMandate) axisDeclared += 1
        else if (t.groups && t.groups.axisUndetermined) axisUndetermined += 1
      }
    }
    tc4 = {
      ...tc4AxisConsumption({
        projectionText: axisTexts.get(AXIS_PROJECTION_REL) ?? null,
        projectionHeadText: headProjection ?? null,
        hostTexts,
        axisUndetermined,
      }),
      axisDeclared,
    }
  } catch (e) {
    console.error(`❌ 无法判定(TC4 取材):${e.message}`)
    return 2
  }
  if (tc4.status === 'undetermined') {
    console.error(`❌ 无法判定:${tc4.reason} —— 不冒红也不记绿。`)
    return 2
  }
  if (tc4.status === 'unwired') {
    console.log(
      `TC4 权限轴消费对账: 未判定 —— 本面与 HEAD 上都没有 ${AXIS_PROJECTION_REL} 的 humanApprovalMandated,` +
        `即这套接线**尚未落地**(不是被摘线;被摘线那一型由 TC4-projection-removed 判红)。` +
        `本行不得读成"已核过字段级消费",也不得因此判红:与本次改动无关的恒红门只会逼人 --no-verify(§12e)。`,
    )
  } else {
    console.log(
      `TC4 权限轴消费对账: 声明 ${tc4.axisDeclared} / 被读 ${tc4.consumers.length}` +
        `(唯一出口 ${AXIS_PROJECTION_REL} 的 humanApprovalMandated;宿主调用点: ${
          tc4.consumers.join(', ') || '(无)'
        })` +
        (tc4.axisUndetermined > 0
          ? `;另有 ${tc4.axisUndetermined} 枚挂了契约而 permission 值解析不到 ⇒ 报名不计声明`
          : '') +
        (tc4.axisDeclared === 0
          ? ' —— 现读注册面 0 枚工具声明"必须由人批准",故"声明了却没被读"这一型今日在面上不存在;' +
            '本行结论覆盖的是**出口在位且有生产消费者**(摘线即红),不得读成"字段级消费已逐枚核过"'
          : ''),
    )
  }
  if (tc4.consumersMissing.length > 0) {
    console.log(
      `ℹ️ TC4 宿主取材 ${tc4.consumersMissing.length} 个文件在本面取不到(不计消费者、也不计"确认没调用"): ` +
        tc4.consumersMissing.slice(0, 8).join(', '),
    )
  }

  const dayWord = state.daysLeft === null ? '?' : Math.abs(state.daysLeft)
  const trdMode = !trdOn
    ? '关(显式 --no-touch-requires-declaration;关掉后本判据不存在)'
    : face !== 'staged'
      ? `开但**只作用于 --staged 档**(当前 ${FACE_LABEL[face]}:棘轮锚点不变,存量只报数)`
      : state.enforce
        ? `开 · **已过期 ⇒ 真拦**(宽限截止 ${state.until || '(不可解析)'},已过 ${dayWord} 天)`
        : `开 · **宽限期内 ⇒ 只报数不判红**(宽限截止 ${state.until},剩 ${dayWord} 天,今天 ${state.today})`
  console.log(`TRD(触碰即须声明)当前档位:${trdMode}`)
  const removedTotal = removals.reduce((n, r) => n + r.removed.length, 0)
  console.log(
    `声明身份台账(TC3):HEAD 上已声明契约的工具身份 ${declaredIdentities} 枚 / 判定面上被摘除 ${removedTotal} 枚` +
      (declaredIdentities === 0
        ? ' —— 面上无一份声明可摘,TC3 今日无事可判(不得读成"已核过摘除这一型")'
        : ''),
  )
  console.log(
    `TC5 确认凭据对账: 写/危险档而无 confirmation 判红 ${tc5RedsTotal} 处` +
      `(与 TC1/TC2 同走该文件 HEAD 自身存量棘轮;面上带契约的身份共 ${declaredIdentities} 枚 —— ` +
      `立票现读为 0,故本行任何红都来自新增而非存量欠账)` +
      ` / 带原因豁免 ${tc5ExemptTotal} 处(只报数,到期账未登记,见头注)` +
      ` / 风险档读不出而义务判不出 ${tc5UndeterminedTotal} 枚(报数不判红,不得读成"已核")`,
  )
  if (trd.files > 0) {
    const verb = trd.enforced ? '❌ 判红' : '⚠️ 报数(宽限内不判红)'
    console.log(
      `${verb}:本次暂存触及 ${trd.files} 个工具文件、共 ${trd.violations} 处无契约/契约不全 —— ` +
        `按 TRD 这些**必须**补齐,不再享受"该文件 HEAD 存量违规数"锚点`,
    )
    for (const f of [...trd.reds, ...trd.notices]) {
      for (const v of f.violations) console.log(`  - ${f.rel}:L${v.line} ${v.toolName}: ${v.kind}`)
    }
  }

  // 前两项的相邻写法由镜像 T20 作形状锁(证明 TC1/TC3 真挂在 main 的退出码上),不得拆行。
  const contractReds = reds.length > 0 || removals.length > 0
  if (contractReds || tc4.status === 'red' || (trd.enforced && trd.reds.length > 0)) {
    if (reds.length > 0) {
      console.error(`❌ 工具契约声明面违规(超出该文件 HEAD 自身基线):`)
      for (const r of reds) {
        console.error(`  ${r.rel}: ${r.current} 处(HEAD 锚点 ${r.anchor})`)
        for (const v of r.violations) console.error(`    - L${v.line} ${v.toolName}: ${v.kind}`)
      }
    }
    if (removals.length > 0) {
      console.error(
        `❌ TC3 契约声明被摘除(HEAD 上已声明、工具仍在、这一面却不声明了)——` +
          `计数棘轮对这一型全盲,身份台账才看得见:`,
      )
      for (const r of removals) {
        for (const v of r.removed)
          console.error(
            `  ${v.key}: HEAD 已声明 ${v.headDeclared} 枚 / 现在 ${v.currentDeclared} 枚` +
              `(该身份现存 ${v.total} 枚,少 ${v.missing} 枚声明)`,
          )
      }
      console.error(
        `  修法:把 contract 声明**加回去**;确要撤下这份契约请连工具字面量一起删(整枚删除` +
          `属守门 99 的删除面对账,本判据不拦)。`,
      )
    }
    if (tc4.status === 'red') {
      console.error(
        `❌ TC4 权限轴没装车(${tc4.reason})—— ` +
          (tc4.reason === 'TC4-projection-removed'
            ? `唯一出口 humanApprovalMandated 在 ${AXIS_PROJECTION_REL} 的本面版本里不存在了。` +
              `契约上"这次必须由人批准"的承诺重新变成一句空话:声明照写、运行时照不读,而 TC1/TC2/TC3 全都看不出来。`
            : `出口在位,但 ${SCAN_DIRS.join('/ 或 ')} 下**没有一个生产文件调用它**(注释里的提法不算装车)。` +
              `这就是守门 115 那一型:判据写了、没人调,账面一路绿灯。`) +
          `\n  修法:在决策宿主(cli 的 tools/permissions.ts 的 decideWithMode、tools/danger-gate.ts 的 flag 闸)` +
          `调用该投影;判序只许"把 allow 升成 ask / 不许自动放行档替人回答",不得在宿主里另抄一份档名清单。` +
          `\n  (第二阶段的"未声明即不可信"属另一票,前置是 --flip-audit 清单逐条补档,不得顺手翻。`,
      )
    }
    if (trd.enforced && trd.reds.length > 0) {
      console.error(
        `❌ TRD(触碰即须声明)判红:宽限期 ${state.until} 已过,被暂存触及的文件必须全员带契约`,
      )
    }
    if (reds.length > 0)
      console.error(`  修法:给该工具字面量补 contract = { shape, permission, resultBudget }`)
    if (tc5RedsTotal > 0)
      console.error(
        `  TC5 修法:给 contract.permission 补 confirmation(封闭三档:explicit-flag+flag / interactive / none+reason);` +
          `确由上游完成批准的,行内写 contract-confirm-exempt: <原因>(裸标记不生效)`,
      )
    console.error(
      `  (packages/types/src/tool-contract.ts);紧急跳过 HUSKY_SKIP_TOOL_CONTRACT_DECLARED=1`,
    )
    console.log(
      `注册工具数 ${totalTools} / 无契约数 ${totalNoContract} / 棘轮余量 ${headroom} / 契约摘除 ${removedTotal} —— 判定面 ${FACE_LABEL[face]}`,
    )
    return 1
  }

  console.log(
    `✅ 无新增绕档:本次判定的 ${judged.length} 个文件均未超出各自 HEAD 计数锚点,且无契约声明被摘除` +
      `(存量违规合计 ${totalViolations} 处,由各文件自身锚点承担;判定面 ${FACE_LABEL[face]};${FACE_NOTE[face]})` +
      `;TC3 摘除 ${removedTotal} 处(HEAD 已声明身份 ${declaredIdentities} 枚` +
      (notApplicableFiles > 0
        ? `;另有 ${notApplicableFiles} 个文件不注册工具 ⇒ 契约判据不适用,见上`
        : '') +
      `)` +
      (face === 'staged' && trd.applied
        ? `;TRD ${trd.enforced ? '已生效' : '宽限内只报数'}:触及文件内无契约合计 ${trd.violations} 处`
        : ''),
  )
  if (flipAudit) {
    console.log(`--flip-audit(第二阶段输入)按"未声明即不可信"会被拦的工具:${flip.length} 个`)
    for (const f of flip) console.log(`  - ${f.file}:${f.line} ${f.toolName}`)
  }
  console.log(
    `注册工具数 ${totalTools} / 无契约数 ${totalNoContract} / 棘轮余量 ${headroom} / 契约摘除 ${removedTotal} / flip-audit ${flip.length}`,
  )
  return 0
}

// ==================== 自检(纯函数,不碰真仓) ====================

/** §22c 共用配方:把"已声明契约"改成"挂了契约但缺字段"的这一手,门体自检与镜像测试各写一份
 *  就是两份真相(守门 191 的 F1「同名同料 · PARTIAL」判的正是这一型)。
 *  ⚠️ 必须声明在 selfTest **之前**:`export const __test__` 按 §22d 落在 isDirectRun 守卫**之后**,
 *  放在它旁边会让直跑路径读到 TDZ(Cannot access before initialization),而账面只表现为自检崩溃。 */
const toPartialContract = (src) => src.replace(/ effectScope: 'none',/, '')
/** 同一条理由的第二手:摘掉 effectScope 及其后分隔符,造"无作用域声明"夹具(门体 1257 行与镜像测试
 *  的 WITHOUT_SCOPE 是同一件事,两处各写一份正则就是两份真相 —— 两个配方**取值不同**(一处吃前导空格、
 *  一处吃后随空格),不得合并成一个,否则夹具语义会变。 */
const toScopelessContract = (src) => src.replace(/effectScope: 'none', /, '')

function selfTest() {
  const results = []
  const ok = (name, cond) => results.push([cond ? 'PASS' : 'FAIL', name])

  const bare = `export const demo: Tool = {
  name: 'demo',
  description: '演示',
  parameters: { path: { type: 'string', description: 'p' } },
  required: ['path'],
  dangerLevel: 'read',
  async execute(args) { return { success: true, output: '{}' } },
};`
  const full = `export const demo2: Tool = {
  name: 'demo2',
  contract: {
    shape: { visibleToProvider: true, input: { type: 'object' } },
    permission: { permissionKey: 'demo2', reason: 'r', riskLevel: 'read', effectScope: 'none', requiresApproval: false },
    resultBudget: { inlineLimitBytes: 1, providerVisibleLimitBytes: 1, policy: 'inline', preview: { bytes: 1, lines: 1, from: 'head' } },
  },
  async execute() { return { success: true, output: 'ok' } },
};`
  const noBudget = full.replace(/resultBudget: \{[^}]*\{[^}]*\}[^}]*\},?/, 'x: 1,')
  const noScope = toScopelessContract(full)

  const t1 = extractToolLiterals(bare)
  ok('ST1 无契约字面量被识别为工具', t1.length === 1 && t1[0].toolName === 'demo')
  ok(
    'ST2 无契约 ⇒ TC1 计违规',
    violationsOf(t1).length === 1 && violationsOf(t1)[0].kind === 'TC1-missing-contract',
  )
  ok('ST3 有 dangerLevel ⇒ 不计入 flip-audit', flipAuditOf(t1).length === 0)

  const t2 = extractToolLiterals(full)
  ok('ST4 契约齐三组 ⇒ 零违规', violationsOf(t2).length === 0)

  const t3 = extractToolLiterals(noBudget)
  ok(
    'ST5 缺 resultBudget ⇒ TC2 点名该组',
    violationsOf(t3).some((v) => v.kind === 'TC2-missing-group:resultBudget'),
  )

  const t4 = extractToolLiterals(noScope)
  ok(
    'ST6 permission 缺 effectScope ⇒ TC2 点名字段(缺省即不可信)',
    violationsOf(t4).some((v) => v.kind === 'TC2-missing-field:permission.effectScope'),
  )

  const noDanger = bare.replace(/  dangerLevel: 'read',\n/, '')
  ok(
    'ST7 无 dangerLevel 且无契约 ⇒ flip-audit 计 1(第二阶段会被拦)',
    flipAuditOf(extractToolLiterals(noDanger)).length === 1,
  )

  const tricky = `export const tricky: Tool = {
  name: 'tricky',
  // 注释里的假工具:name: 'fake', execute(){}
  description: '带大括号与引号的描述 "a{b}c" \\' 里还有字符串\\'',
  parameters: { re: { type: 'string', description: '斜杠 /["\\']/ 测试' } },
  required: [],
  nested: { deep: { name: 'not-a-tool', execute: 1 } },
  async execute() { return { success: true, output: 'ok' } },
};`
  const t5 = extractToolLiterals(tricky)
  ok('ST8 注释/字符串/嵌套对象不造假工具', t5.length === 1 && t5[0].toolName === 'tricky')
  ok('ST9 遮法不吃花括号:整块仍被配平', t5[0].hasContract === false)

  const masked = maskNonCode(`const s = '}}{'; /* { */ const t = /["']/; const o = { x: 1 }`)
  ok(
    'ST10 字符串/注释/正则里的花括号不参与配平(只剩最后一个真对象)',
    findObjectRanges(masked).size === 1,
  )

  // 反向对照:判据不能恒红 —— 空文件必须 0 工具 0 违规
  ok(
    'ST11 空源文件 ⇒ 0 工具 0 违规(判据非恒真)',
    extractToolLiterals('').length === 0 && violationsOf([]).length === 0,
  )

  // ---------- TRD(触碰即须声明)—— 2026-09-25 换锚点,取证必须两档日期都可构造 ----------
  const GF = '2026-10-09'
  const bareSrcViolations = violationsOf(extractToolLiterals(bare))
  const fullSrcViolations = violationsOf(extractToolLiterals(full))
  ok(
    'ST12 TRD 默认开 / 显式 --no-touch-requires-declaration 才关',
    trdEnabled([]) === true &&
      trdEnabled([TRD_FLAG]) === true &&
      trdEnabled([TRD_OFF_FLAG]) === false,
  )
  ok(
    'ST13 宽限期三态:期内不判红 / 到期当天仍不判红 / 次日判红(today 注入,不看系统时钟)',
    trdState({ today: '2026-09-25', until: GF }).enforce === false &&
      trdState({ today: GF, until: GF }).enforce === false &&
      trdState({ today: '2026-10-10', until: GF }).enforce === true,
  )
  ok(
    'ST13b 日期不可解析 ⇒ known:false 且 enforce:true(半个租约比没有租约更危险,不得静默放行)',
    trdState({ today: 'not-a-date', until: GF }).enforce === true &&
      trdState({ today: '2026-09-25', until: GF }).known === true,
  )
  // ① 暂存触及且全部工具已声明 ⇒ 绿(既无红也无报数)
  const allDeclared = trdAssess({
    files: [{ rel: 'apps/cli/src/tools/a.ts', toolCount: 1, violations: fullSrcViolations }],
    face: 'staged',
    state: trdState({ today: '2026-10-10', until: GF }),
  })
  ok(
    'ST14 ① 触及文件全员已声明 ⇒ TRD 零红零报数',
    allDeclared.reds.length === 0 && allDeclared.notices.length === 0,
  )
  // ② 暂存触及且一枚未声明:宽限期内只报数、过期后判红 —— 两档日期各构造一次
  const touchOne = [
    { rel: 'apps/cli/src/tools/builtins.ts', toolCount: 1, violations: bareSrcViolations },
  ]
  const grace = trdAssess({
    files: touchOne,
    face: 'staged',
    state: trdState({ today: '2026-09-25', until: GF }),
  })
  const expired = trdAssess({
    files: touchOne,
    face: 'staged',
    state: trdState({ today: '2026-10-10', until: GF }),
  })
  ok(
    'ST15 ②a 宽限期内:同一输入只报数不判红(violations 仍如实计数)',
    grace.reds.length === 0 && grace.notices.length === 1 && grace.violations === 1,
  )
  ok(
    'ST16 ②b 过期后:同一输入转真拦(判红并点名文件)',
    expired.reds.length === 1 && expired.notices.length === 0 && expired.enforced === true,
  )
  // ③ 全量档行为逐字不变:同一批存量输入在 head 面根本不适用 TRD
  const headFace = trdAssess({
    files: touchOne,
    face: 'head',
    state: trdState({ today: '2026-10-10', until: GF }),
  })
  ok(
    'ST17 ③ 全量档(head 面)TRD 整条不适用 ⇒ 存量 104 处不会被本判据搞红',
    headFace.applied === false && headFace.reds.length === 0 && headFace.notices.length === 0,
  )
  const trdOff = trdAssess({
    files: touchOne,
    face: 'staged',
    enabled: trdEnabled([TRD_OFF_FLAG]),
    state: trdState({ today: '2026-10-10', until: GF }),
  })
  ok('ST17b 显式关档 ⇒ 连报数都不计(输出行必须明写"关")', trdOff.applied === false)
  // 换锚点的实质:同一文件 HEAD 已欠 2 处、暂存仍 2 处 —— 旧棘轮判绿,TRD 判红
  ok(
    'ST18 锚点对照:旧棘轮(2 vs HEAD 2)放绿,TRD(碰了就必须补)计 2 处 ⇒ 换的确实是锚点',
    exceedsAnchor(2, 2) === false &&
      trdAssess({
        files: [
          { rel: 'x.ts', toolCount: 2, violations: bareSrcViolations.concat(bareSrcViolations) },
        ],
        face: 'staged',
        state: trdState({ today: '2026-10-10', until: GF }),
      }).violations === 2,
  )
  // ④ 枚举到 0 个注册 ⇒ 判死,但**必须先看 HEAD 侧**
  ok(
    'ST19 ④ 本面 0 枚注册:HEAD 有工具才判死;HEAD 也 0(不注册工具的 helper)⇒ 不判死',
    // 未传 anchorTools ⇒ 不知道基准 ⇒ 保守判死(失效方向只能是"多要一次说明")
    enumerationBlind({ face: 'staged', judgedCount: 3, totalTools: 0 }) === true &&
      enumerationBlind({ face: 'staged', judgedCount: 3, totalTools: 0, anchorTools: 7 }) ===
        true &&
      // 这一支就是被修掉的那一型:58 个文件里 34 个注册 0 枚,只碰它们不得拦提交
      enumerationBlind({ face: 'staged', judgedCount: 3, totalTools: 0, anchorTools: 0 }) ===
        false &&
      enumerationBlind({ face: 'staged', judgedCount: 3, totalTools: 4 }) === false &&
      enumerationBlind({ face: 'head', judgedCount: 54, totalTools: 0 }) === false &&
      enumerationBlind({ face: 'staged', enabled: false, judgedCount: 3, totalTools: 0 }) === false,
  )
  ok(
    'ST19b anchorTools 为 0 与"未传"必须是两个不同结论(半个判据比没有更危险)',
    enumerationBlind({ face: 'staged', judgedCount: 1, totalTools: 0, anchorTools: 0 }) === false &&
      enumerationBlind({
        face: 'staged',
        judgedCount: 1,
        totalTools: 0,
        anchorTools: undefined,
      }) === true,
  )

  // ---------- TC3:声明身份台账(2026-09-26 换锚,本票的存在理由) ----------
  const F = 'apps/cli/src/tools/demo.ts'
  // ⚠️ TC3 比的是**身份**,所以上/下两态必须是**同一枚工具** —— 上面那批夹具里 `full` 叫
  // demo2 而 `bare` 叫 demo,直接拿来配对就是"改了名的两枚工具",门判不出摘除属于**定义如此**
  // 而不是缺陷。这里把 declared 夹具改成与 bare 同名,才真正在测"同一枚工具的声明没了"。
  const declaredDemo = full.replace(/demo2/g, 'demo')
  const PARTIAL = toPartialContract(declaredDemo) // 挂了契约但缺字段 ⇒ 1 处 TC2
  const ledger = (src) => declarationLedgerOf(F, extractToolLiterals(src))
  const completeLedger = ledger(declaredDemo)
  const bareLedger = ledger(bare)
  const partialLedger = ledger(PARTIAL)

  ok(
    'ST20a 夹具前提:两份夹具必须是**同一枚工具**的身份(否则整组 TC3 用例在测两件不同的事)',
    completeLedger.size === 1 &&
      bareLedger.size === 1 &&
      [...completeLedger.keys()][0] === [...bareLedger.keys()][0] &&
      [...completeLedger.keys()][0] === `${F}#demo`,
  )
  ok(
    'ST20 ① 摘掉既有工具的契约 ⇒ TC3 必红并点名身份(计数锚点在这一型上全盲)',
    completeLedger.get(`${F}#demo`).declared === 1 &&
      bareLedger.get(`${F}#demo`).declared === 0 &&
      findDeclarationRemovals({ head: completeLedger, current: bareLedger }).removed.length === 1 &&
      findDeclarationRemovals({ head: completeLedger, current: bareLedger }).removed[0].key ===
        `${F}#demo`,
  )

  ok(
    'ST20b 摘掉"字段不全"的契约也算摘除:计数从 1 处 TC2 换成 1 处 TC1 持平,身份台账仍判红',
    violationsOf(extractToolLiterals(PARTIAL)).length === 1 &&
      violationsOf(extractToolLiterals(bare)).length === 1 &&
      exceedsAnchor(1, 1) === false &&
      findDeclarationRemovals({ head: partialLedger, current: bareLedger }).removed.length === 1,
  )
  ok(
    'ST21 ② 台账没记而面上出现新的已声明工具 ⇒ 不红(判据不得把自己产出的形态判红)',
    findDeclarationRemovals({ head: bareLedger, current: completeLedger }).removed.length === 0 &&
      findDeclarationRemovals({ head: new Map(), current: completeLedger }).removed.length === 0 &&
      findDeclarationRemovals({ head: completeLedger, current: completeLedger }).removed.length ===
        0,
  )
  ok(
    'ST22 ③ 存量全部无契约 ⇒ TC3 恒 0 红(否则今天起没人能提交;这是一台零基线门的前提)',
    ledger(bare).get(toolKey(F, 'demo')).declared === 0 &&
      findDeclarationRemovals({ head: ledger(bare), current: ledger(bare) }).removed.length === 0 &&
      findDeclarationRemovals({ head: ledger(bare), current: new Map() }).removed.length === 0 &&
      findDeclarationRemovals({ head: ledger(bare), current: completeLedger })
        .declaredIdentities === 0,
  )
  ok(
    'ST23 整枚工具被删 ⇒ 不判摘除(那是守门 99 的删除面,本门不越权;head/current 都空亦不红)',
    findDeclarationRemovals({ head: completeLedger, current: new Map() }).removed.length === 0 &&
      findDeclarationRemovals({ head: new Map(), current: new Map() }).removed.length === 0,
  )
  ok(
    'ST24 同名两枚摘掉其中一颗必须还能红(身份多重集,不是名字集合 —— 名额不得互相冒充)',
    declarationLedgerOf(F, [
      { toolName: 'dup', hasContract: true },
      { toolName: 'dup', hasContract: true },
    ]).get(`${F}#dup`).declared === 2 &&
      findDeclarationRemovals({
        head: declarationLedgerOf(F, [
          { toolName: 'dup', hasContract: true },
          { toolName: 'dup', hasContract: true },
        ]),
        current: declarationLedgerOf(F, [
          { toolName: 'dup', hasContract: true },
          { toolName: 'dup', hasContract: false },
        ]),
      }).removed[0].missing === 1 &&
      findDeclarationRemovals({
        head: declarationLedgerOf(F, [{ toolName: 'dup', hasContract: true }]),
        current: declarationLedgerOf(F, [
          { toolName: 'dup', hasContract: true },
          { toolName: 'dup', hasContract: false },
        ]),
      }).removed.length === 0,
  )
  ok(
    'ST25 两面同源 ⇒ 零摘除,但"已声明身份数"仍要照实报出(为 0 时结论行必须喊"无事可判")',
    findDeclarationRemovals({ head: completeLedger, current: completeLedger }).removed.length ===
      0 &&
      findDeclarationRemovals({ head: completeLedger, current: completeLedger })
        .declaredIdentities === 1 &&
      findDeclarationRemovals({ head: bareLedger, current: bareLedger }).declaredIdentities === 0,
  )

  // ---------- TC4:权限轴字段级消费对账(D142,构造面 ⇒ 不吃仓库瞬时状态)----------
  const PROJ =
    'export function humanApprovalMandated(carrier) { return false }\nexport const TOOL_EFFECT_SCOPES = []\n'
  const HOST_CALL =
    "import { humanApprovalMandated } from '@ihui/types'\nif (humanApprovalMandated(tool)) return 'ask'\n"
  const HOST_COMMENT_ONLY =
    "// 未来由 humanApprovalMandated(tool) 判定\nconst x = 1\nconsole.log('humanApprovalMandated')\n"
  const PROJ_NO_EXPORT = 'function humanApprovalMandatedImpl(carrier) { return false }\n'
  const axisDeclaredFixture = extractToolLiterals(
    `const t = { name: 'axis_demo', execute: async () => ({ success: true }), contract: { shape: { visibleToProvider: true, input: { type: 'object' } }, permission: { permissionKey: 'k', reason: 'r', riskLevel: 'write', effectScope: 'system', requiresApproval: true, confirmation: { mode: 'interactive' } }, resultBudget: { inlineLimitBytes: 1, providerVisibleLimitBytes: 1, policy: 'inline', preview: { bytes: 1, lines: 1, from: 'head' } } } }`,
  )
  const axisSilentFixture = extractToolLiterals(
    `const t = { name: 'axis_silent', execute: async () => ({ success: true }), contract: { shape: { visibleToProvider: true, input: { type: 'object' } }, permission: { permissionKey: 'k', reason: 'r', riskLevel: 'write', effectScope: 'system', requiresApproval: false, confirmation: { mode: 'explicit-flag', flag: 'force' } }, resultBudget: { inlineLimitBytes: 1, providerVisibleLimitBytes: 1, policy: 'inline', preview: { bytes: 1, lines: 1, from: 'head' } } } }`,
  )
  const tc4Wired = tc4AxisConsumption({
    projectionText: PROJ,
    hostTexts: [
      ['apps/cli/src/tools/permissions.ts', HOST_CALL],
      ['apps/cli/src/tools/other.ts', HOST_COMMENT_ONLY],
    ],
  })
  ok(
    'ST25b TC4 ①:出口在位 + 生产宿主**调用** ⇒ 绿,并把宿主报名(报告行的"被读 M"就是它)',
    tc4Wired.status === 'ok' && tc4Wired.consumers.join() === 'apps/cli/src/tools/permissions.ts',
  )
  ok(
    'ST26 TC4 反向锁:注释/字符串里的提法**不算装车**(否则"看起来有、其实没装"那一型一路绿灯)',
    tc4AxisConsumption({
      projectionText: PROJ,
      hostTexts: [['apps/cli/src/tools/other.ts', HOST_COMMENT_ONLY]],
    }).reason === 'TC4-axis-unconsumed',
  )
  ok(
    'ST27 TC4 摘线:零生产消费者 ⇒ 红,**不看有没有人声明权限轴**(现读声明 0 枚,若"没人声明就免判"本档等于给摘线放行)',
    tc4AxisConsumption({ projectionText: PROJ, hostTexts: [] }).status === 'red',
  )
  ok(
    'ST28 TC4 摘线(HEAD 有、本面没有):export 被删/改名 ⇒ 红且点名 projection-removed',
    tc4AxisConsumption({
      projectionText: PROJ_NO_EXPORT,
      projectionHeadText: PROJ,
      hostTexts: [['apps/cli/src/tools/permissions.ts', HOST_CALL]],
    }).reason === 'TC4-projection-removed',
  )
  ok(
    'ST28b TC4 未落地 ≠ 摘线:两面都没有该投影 ⇒ 判"未判定"(unwired)不判红 —— 否则落地前每一次无关提交都被一道与本次改动无关的红门钉住(§12e)',
    tc4AxisConsumption({
      projectionText: PROJ_NO_EXPORT,
      projectionHeadText: PROJ_NO_EXPORT,
      hostTexts: [],
    }).status === 'unwired',
  )
  ok(
    'ST29 TC4 两面都取不到投影 ⇒ "未判定"且不 veto(镜像 T19 抓到过:附属输入的缺席把无关提交顶成 exit 2 = 恒红)',
    tc4AxisConsumption({ projectionText: null, hostTexts: [['x.ts', HOST_CALL]] }).status ===
      'unwired',
  )
  ok(
    'ST29b TC4 HEAD 有而本面读不到 ⇒ 判红(文件被摘),不得与"还没落地"同桶',
    tc4AxisConsumption({
      projectionText: null,
      projectionHeadText: PROJ,
      hostTexts: [['x.ts', HOST_CALL]],
    }).reason === 'TC4-projection-removed',
  )
  ok(
    'ST30 声明轴配对:requiresApproval:true 被抽出器认成 axisMandate;false 不认(不得把没承诺当承诺)',
    axisDeclaredFixture.length === 1 &&
      axisDeclaredFixture[0].axisMandate === true &&
      axisSilentFixture.length === 1 &&
      axisSilentFixture[0].axisMandate === false,
  )
  ok(
    'ST31 声明写在注释里不得算数(遮罩面判,与 ST30 同一判据的另一半)',
    extractToolLiterals(
      `const t = { name: 'axis_note', execute: async () => ({ success: true }) // contract: { permission: { requiresApproval: true } }\n }`,
    )[0].axisMandate === false,
  )
  ok(
    'ST32 TC4 没声明 ⇒ 走兜底不判红(与 ST27 成对:红来自"没人调用",不来自"没人声明";本票禁止翻缺省语义)',
    axisSilentFixture[0].axisMandate === false &&
      axisDeclaredFixture[0].axisMandate === true &&
      // 两份夹具都必须是"一枚完整契约" —— 否则 ST30/ST32 在比两件不同的事
      axisSilentFixture[0].hasContract === true &&
      axisDeclaredFixture[0].hasContract === true &&
      // 消费者在位 + 面上 0 枚声明 ⇒ 绿(本票不因"没人声明"判红,那等于把缺省翻了)
      tc4AxisConsumption({
        projectionText: PROJ,
        hostTexts: [['apps/cli/src/tools/permissions.ts', HOST_CALL]],
      }).status === 'ok',
  )

  // ---------- TC5:写/危险档必须有确认凭据(2026-09-29 立,上游 zcode 参数层确认取证票)----------
  const CONF_BASE = `export const demo: Tool = {
  name: 'demo',
  contract: {
    shape: { visibleToProvider: true, input: { type: 'object' } },
    permission: { permissionKey: 'k', reason: 'r', riskLevel: 'write', effectScope: 'workspace', requiresApproval: true, confirmation: { mode: 'interactive' } },
    resultBudget: { inlineLimitBytes: 1, providerVisibleLimitBytes: 1, policy: 'inline', preview: { bytes: 1, lines: 1, from: 'head' } },
  },
  async execute() { return { success: true, output: 'ok' } },
};`
  const confKinds = (src) =>
    violationsOf(extractToolLiterals(src))
      .map((v) => v.kind)
      .filter((k) => k.startsWith('TC5-'))

  ok(
    'ST33 TC5 阳性对照:write 档而 confirmation 缺席 ⇒ 判红 TC5-confirmation-missing(构造面,不吃仓库瞬时状态)',
    confKinds(CONF_BASE.replace(/, confirmation: \{[^}]*\}/, '')).join() ===
      'TC5-confirmation-missing',
  )
  ok(
    'ST34 TC5 阴性对照成对:write+interactive ⇒ 零 TC5;把 riskLevel 换成 read 且无 confirmation ⇒ 也零 TC5(判据不得恒红)',
    confKinds(CONF_BASE).length === 0 &&
      confKinds(CONF_BASE.replace(/, confirmation: \{[^}]*\}/, '').replace(/riskLevel: 'write'/, "riskLevel: 'read'"))
        .length === 0,
  )
  ok(
    'ST35 封闭三档各自有牙:none 无 reason ⇒ 红;none 带 reason ⇒ 绿;unknown mode ⇒ 红;confirmation 不是对象字面量 ⇒ 红;explicit-flag 缺/空 flag ⇒ 红',
    confKinds(
      CONF_BASE.replace(/confirmation: \{[^}]*\}/, "confirmation: { mode: 'none' }"),
    ).join() === 'TC5-confirmation-none-without-reason' &&
      confKinds(
        CONF_BASE.replace(
          /confirmation: \{[^}]*\}/,
          "confirmation: { mode: 'none', reason: '批准已在上游 danger-gate 完成' }",
        ),
      ).length === 0 &&
      confKinds(
        CONF_BASE.replace(/confirmation: \{[^}]*\}/, "confirmation: { mode: 'maybe' }"),
      ).join() === 'TC5-confirmation-unknown-mode:maybe' &&
      confKinds(CONF_BASE.replace(/confirmation: \{[^}]*\}/, "confirmation: 'yes'")).join() ===
        'TC5-confirmation-unparseable' &&
      confKinds(
        CONF_BASE.replace(
          /confirmation: \{[^}]*\}/,
          "confirmation: { mode: 'explicit-flag', flag: '  ' }",
        ),
      ).join() === 'TC5-confirmation-flag-missing' &&
      confKinds(
        CONF_BASE.replace(/confirmation: \{[^}]*\}/, "confirmation: { mode: 'explicit-flag' }"),
      ).join() === 'TC5-confirmation-flag-missing',
  )
  ok(
    'ST36 词表同值锁:本模块的确认档/风险档集合与 packages/types 唯一类型源逐字同值(镜像测试另按源码原文复量,两处任一漂开即红)',
    [...TOOL_CONFIRMATION_MODES].join() === 'explicit-flag,interactive,none' &&
      [...CONFIRMATION_REQUIRED_RISK_LEVELS].join() === 'write,dangerous',
  )
  // 豁免四态成对:上一行带原因 ⇒ 放行;裸标记 ⇒ 仍红;写在字符串里 ⇒ 仍红;豁免不得救 TC1
  const exemptPrevLine = CONF_BASE.replace(/, confirmation: \{[^}]*\}/, '').replace(
    "  name: 'demo',",
    "  // contract-confirm-exempt: 批准由宿主 danger-gate 统一发起，本处只补契约声明\n  name: 'demo',",
  )
  const exemptBare = exemptPrevLine.replace(' 批准由宿主 danger-gate 统一发起，本处只补契约声明', '')
  const exemptInString = CONF_BASE.replace(/, confirmation: \{[^}]*\}/, '').replace(
    "  name: 'demo',",
    "  name: 'contract-confirm-exempt: 不该由字符串发放豁免',",
  )
  const exemptSameLine = CONF_BASE.replace(/, confirmation: \{[^}]*\}/, '').replace(
    "  name: 'demo',",
    "  name: 'demo', // contract-confirm-exempt: 同行带原因同样生效(GA4 同一条教训)",
  )
  ok(
    'ST37 豁免生效面:紧邻上一行/同行带原因 ⇒ 免 TC5;裸标记与字符串内标记 ⇒ 不放行(注释闭合符不得冒充原因)',
    confKinds(exemptPrevLine).length === 0 &&
      confKinds(exemptSameLine).length === 0 &&
      confKinds(exemptBare).join() === 'TC5-confirmation-missing' &&
      confKinds(exemptInString).join() === 'TC5-confirmation-missing',
  )
  ok(
    'ST38 豁免只开在 TC5 上:无契约的 bare 工具写满豁免标记,违规仍然且只是 TC1(出口救"确认凭据"这一型,不救契约本身)',
    violationsOf(
      extractToolLiterals(
        bare.replace(
          "  name: 'demo',",
          "  // contract-confirm-exempt: 豁免不该在这里起作用\n  name: 'demo',",
        ),
      ),
    )
      .map((v) => v.kind)
      .join() === 'TC1-missing-contract',
  )
  // dangerLevel 回退三态:riskLevel 读不出时才看工具面;两边都读不出 ⇒ undetermined(不冒红也不记绿)
  const noRiskField = CONF_BASE.replace(/riskLevel: 'write', /, '')
  const dangerFallback = noRiskField.replace(
    'export const demo: Tool = {\n  name:',
    "export const demo: Tool = {\n  dangerLevel: 'dangerous',\n  name:",
  )
  const dangerRead = dangerFallback.replace("'dangerous'", "'read'")
  ok(
    'ST39 义务三态:契约 riskLevel 优先;读不出回退工具面 dangerLevel(dangerous⇒required / read⇒not-required);两者都无 ⇒ undetermined 报数不判红',
    confirmationObligationOf(extractToolLiterals(CONF_BASE)[0]) === 'required' &&
      confirmationObligationOf(extractToolLiterals(dangerFallback)[0]) === 'required' &&
      confirmationObligationOf(extractToolLiterals(dangerRead)[0]) === 'not-required' &&
      confirmationObligationOf(extractToolLiterals(noRiskField)[0]) === 'undetermined' &&
      confKinds(noRiskField).length === 0,
  )

  let pass = 0
  let fail = 0
  for (const [verdict, name] of results) {
    if (verdict === 'PASS') pass += 1
    else fail += 1
    console.log(`  ${verdict === 'PASS' ? '✅' : '❌'} ${name}`)
  }

  console.log(`--self-test:${pass} 通过 / ${fail} 失败(共 ${results.length} 条)`)
  return fail === 0 ? 0 : 1
}

// ==================== 真仓冒烟(判据在真实源码上看得见工具) ====================

function realSourceSmoke() {
  try {
    const root = ROOT
    const files = listTrackedFiles(root, 'head')
    const texts = readFace(root, 'head', files.slice(0, 12))
    let tools = 0
    for (const [, text] of texts) {
      if (!text) continue
      for (const t of extractToolLiterals(text)) {
        if (!t.toolName || !Number.isFinite(t.line)) {
          console.error('❌ 真仓冒烟:命中的工具字面量缺 name 或 line(判据退化)')
          return 1
        }
        tools += 1
      }
    }
    if (tools === 0) {
      console.error('❌ 真仓冒烟:HEAD 源码上抽到 0 个工具字面量 —— 判据失明,不得当作通过')
      return 1
    }
    console.log(`✅ 真仓冒烟:前 12 个工具面文件抽到 ${tools} 个工具字面量,每条都带 name + line`)
    return 0
  } catch (e) {
    console.error(`❌ 真仓冒烟无法判定:${e.message}`)
    return 2
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const argv = process.argv.slice(2)
  let code
  if (argv.includes('--self-test')) code = selfTest()
  else if (argv.includes('--real-smoke')) code = realSourceSmoke()
  else code = main(argv)
  process.exitCode = code
}

/** §22c 共用配方:把"已声明契约"改成"挂了契约但缺字段"的这一手,门体自检与镜像测试各写一份
 *  就是两份真相(守门 191 的 F1「同名同料 · PARTIAL」判的正是这一型)。 */
export const __test__ = {
  toPartialContract,
  toScopelessContract,
  maskNonCode,
  findObjectRanges,
  collectMembers,
  extractToolLiterals,
  violationsOf,
  flipAuditOf,
  exceedsAnchor,
  toolKey,
  declarationLedgerOf,
  findDeclarationRemovals,
  trdEnabled,
  trdState,
  trdAssess,
  enumerationBlind,
  tc4AxisConsumption,
  // TC5(2026-09-29):判据本体 + 豁免识别 + 两份词表集合(镜像测试拿它们与 packages/types 源码原文对账)
  confirmationObligationOf,
  findConfirmationExemptReason,
  TOOL_CONFIRMATION_MODES,
  CONFIRMATION_REQUIRED_RISK_LEVELS,
  isoDay,
  CONTRACT_GROUPS,
  SCAN_DIRS,
  AXIS_PROJECTION_REL,
  GRANDFATHER_UNTIL,
  TRD_FLAG,
  TRD_OFF_FLAG,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
