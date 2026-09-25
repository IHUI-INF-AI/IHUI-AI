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
// ⚠️ 本门**尚未接线**(guardian-runner / CI 由主会话统一登记)。因此本文件头注不写
// "已接 pre-commit 第 N 项" —— 守门 89 的 R1 正是拦"声称已接线而权威点零命中"。
//
// 口径(与 77 / 83 / 98 一致):
//   - 全量档判 **HEAD blob**,`--staged` 判**索引 blob**;`--worktree` 仅人工逃生舱。
//   - **棘轮锚点 = 该文件 HEAD 自身违规数**。存量 92 个工具字面量全部无契约(实测),
//     一次不许改红:全量档恒 exit 0 并如实报数,牙齿在 `--staged`(本次改动把绕档加回来才红)。
//     把锚点写成 0 会让本仓整片报红 ⇒ 逼人 `--no-verify` ⇒ 全部守门作废。
//   - 取不到输入 ⇒ **exit 2「无法判定」**,既不冒红也不记绿。
//
// 手动:node scripts/check-tool-contract-declared.mjs [--staged|--worktree|--self-test|--flip-audit|--verbose]
//   --flip-audit  第二阶段输入:按"未声明即不可信"的新缺省会被拦的工具数与清单(只报不改退出码)

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
    const groups = contractMember
      ? contractGroupsOf(masked, ranges, contractMember.valueStart)
      : null
    tools.push({
      toolName,
      line: lineOf(masked, nameMember.keyIndex),
      hasContract: Boolean(contractMember),
      groups,
      hasDangerLevel: Boolean(dangerMember),
      dangerLevel: dangerMember ? readStringValue(text, dangerMember.valueStart) : null,
    })
  }
  tools.sort((a, b) => a.line - b.line)
  return tools
}

/** 契约对象本身直接成员 + 其 permission / shape 子对象的直接成员。 */
function contractGroupsOf(masked, ranges, valueStart) {
  const end = ranges.get(valueStart)
  if (end === undefined) return { contractMembers: [], note: 'contract 值不是对象字面量' }
  const contractMembers = collectMembers(masked, valueStart, end)
  const nested = {}
  for (const member of contractMembers) {
    const childEnd = ranges.get(member.valueStart)
    if (childEnd === undefined) continue
    nested[member.name] = collectMembers(masked, member.valueStart, childEnd).map((m) => m.name)
  }
  return {
    contractMembers: contractMembers.map((m) => m.name),
    nested,
  }
}

// ==================== 违规判定 ====================

/**
 * 两类红:
 *  - **TC1** 工具字面量完全没有 `contract`。
 *  - **TC2** 挂了 `contract` 但缺需要它的字段(三组之一缺席,或组内必填字段缺席)——
 *    这正是"契约字段缺省但落在需要它的档位":字段在但没值,与没挂契约同罪。
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
  }
  return out
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
  const reds = []
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

    const headText = anchorTexts.get(rel)
    const anchor =
      headText === null || headText === undefined
        ? 0
        : violationsOf(extractToolLiterals(headText)).length
    headroom += Math.max(0, anchor - violations.length)
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

  if (reds.length > 0) {
    console.error(`❌ 工具契约声明面违规(超出该文件 HEAD 自身基线):`)
    for (const r of reds) {
      console.error(`  ${r.rel}: ${r.current} 处(HEAD 锚点 ${r.anchor})`)
      for (const v of r.violations) console.error(`    - L${v.line} ${v.toolName}: ${v.kind}`)
    }
    console.error(`  修法:给该工具字面量补 contract = { shape, permission, resultBudget }`)
    console.error(
      `  (packages/types/src/tool-contract.ts);紧急跳过 HUSKY_SKIP_TOOL_CONTRACT_DECLARED=1`,
    )
    console.log(
      `注册工具数 ${totalTools} / 无契约数 ${totalNoContract} / 棘轮余量 ${headroom} —— 判定面 ${FACE_LABEL[face]}`,
    )
    return 1
  }

  console.log(
    `✅ 无新增绕档:本次判定的 ${judged.length} 个文件均未超出各自 HEAD 锚点(存量违规合计 ${totalViolations} 处,由各文件自身锚点承担;判定面 ${FACE_LABEL[face]};${FACE_NOTE[face]})`,
  )
  if (flipAudit) {
    console.log(`--flip-audit(第二阶段输入)按"未声明即不可信"会被拦的工具:${flip.length} 个`)
    for (const f of flip) console.log(`  - ${f.file}:${f.line} ${f.toolName}`)
  }
  console.log(
    `注册工具数 ${totalTools} / 无契约数 ${totalNoContract} / 棘轮余量 ${headroom} / flip-audit ${flip.length}`,
  )
  return 0
}

// ==================== 自检(纯函数,不碰真仓) ====================

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
  const noScope = full.replace(/effectScope: 'none', /, '')

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

export const __test__ = {
  maskNonCode,
  findObjectRanges,
  collectMembers,
  extractToolLiterals,
  violationsOf,
  flipAuditOf,
  exceedsAnchor,
  CONTRACT_GROUPS,
  SCAN_DIRS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
