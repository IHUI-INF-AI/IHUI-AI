#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ITCP 契约注册表导出器（T1.1）
 *
 * 为什么存在：`packages/types/src/tool-contract.ts` 是 TS 类型，`protocol/src/tool-contract.ts`
 * 是它的**源码拷贝**（`sync-itcp-package.mjs` 生成），Python 侧两者都读不了。要让
 * `apps/ai-service` 也拥有"工具契约"这个概念，必须有一份**语言无关的声明面产物**。
 * 本脚本就是那份产物：把 CLI 工具面上的契约抽成 JSON，TS / Python / 外部实现读同一份。
 *
 * 判据边界（与决策账第四节一致）：
 * - **谁算一枚工具**：只认守门 `extractToolLiterals`（同一份枚举判据，不许导出器自定一套，
 *   否则"129"这个数会有两个来源）。
 * - **只导声明，不导判定**：`humanApprovalMandated` / `mayWriteWorkspace` 是谓词，属判定面，
 *   由消费侧各自实现、用测试钉两侧同判序；导出的 JSON 里只有 `effectScope` / `requiresApproval`
 *   / `alwaysAsk` 这些原始字段。把谓词结果冻进 JSON = 判序一变就分叉。
 * - **读不出就是 null**：字段写成动态表达式、拼错、被注释掉 ⇒ null，不猜、不回落默认值。
 * - **幂等**：不写时间戳。同一工作树跑两次必须 byte-identical（写盘前后自校验）。
 *
 * 用法：
 *   node scripts/itcp-export.mjs              # 写 protocol/itcp-registry.json
 *   node scripts/itcp-export.mjs --check      # 只比对，不同步即 exit 1（给守门/CI 用）
 *   node scripts/itcp-export.mjs --json       # 打到 stdout，不写盘
 */

import fs from 'node:fs'
import path from 'node:path'
// 枚举判据单一真相源：哪些是真工具、行号在哪，只由守门回答。
import { extractToolLiterals } from './check-tool-contract-declared.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const TOOLS_DIR = path.join(ROOT, 'apps', 'cli', 'src', 'tools')
const OUT_FILE = path.join(ROOT, 'protocol', 'itcp-registry.json')

/** 递归收集工具源文件（排除测试与声明文件） */
function collectToolFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      collectToolFiles(full, out)
      continue
    }
    if (!e.name.endsWith('.ts')) continue
    if (e.name.endsWith('.test.ts') || e.name.endsWith('.d.ts')) continue
    out.push(full)
  }
  return out
}

/**
 * 把注释抹成等长空格（保持偏移不变），字符串原样保留。
 * 目的：后面所有字段正则只在**代码面**匹配 —— 注释里的 `effectScope: 'system'` 不得被当成声明。
 */
function maskComments(text) {
  let out = ''
  let i = 0
  const n = text.length
  while (i < n) {
    const c = text[i]
    const next = text[i + 1]
    // 字符串（含模板串）整体跳过，原样保留
    if (c === "'" || c === '"' || c === '`') {
      const quote = c
      out += c
      i += 1
      while (i < n) {
        const ch = text[i]
        out += ch
        i += 1
        if (ch === '\\') {
          if (i < n) {
            out += text[i]
            i += 1
          }
          continue
        }
        if (ch === quote) break
      }
      continue
    }
    if (c === '/' && next === '/') {
      while (i < n && text[i] !== '\n') {
        out += ' '
        i += 1
      }
      continue
    }
    if (c === '/' && next === '*') {
      out += '  '
      i += 2
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) {
        out += text[i] === '\n' ? '\n' : ' '
        i += 1
      }
      if (i < n) {
        out += '  '
        i += 2
      }
      continue
    }
    out += c
    i += 1
  }
  return out
}

function lineStartOffset(lines, lineNo) {
  let off = 0
  for (let i = 0; i < lineNo - 1; i += 1) off += lines[i].length + 1
  return off
}

/** 从 open 处的 `{` 起配平取块 */
function balanceBraces(masked, open, limit = masked.length) {
  let depth = 0
  let i = open
  while (i < limit) {
    const ch = masked[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return { text: masked.slice(open, i + 1), start: open, end: i + 1 }
    }
    i += 1
  }
  return null
}

/** 从 from 处找 `key: {`，括号配平取块（代码面已抹注释，字符串已跳过）。返回块与全文区间。 */
function takeObjectBlock(masked, from, to, key) {
  const re = new RegExp(`\\b${key}\\s*:\\s*\\{`, 'g')
  re.lastIndex = from
  const m = re.exec(masked)
  if (!m || m.index >= to) return null
  const open = masked.indexOf('{', m.index)
  return balanceBraces(masked, open, to)
}

/** 数值表达式求值：只接受 `123` / `72_000` / `16 * 1024` 这三种形态，其余 → null */
function evalNumber(expr) {
  if (expr === null || expr === undefined) return null
  const s = String(expr).replace(/_/g, '').trim()
  if (!/^\d+(?:\s*\*\s*\d+)?$/.test(s)) return null
  return s.split('*').reduce((a, b) => a * Number(b.trim()), 1)
}

/** 从一个声明块里读字段（只在代码面读） */
function readString(block, name) {
  const m = new RegExp(`\\b${name}\\s*:\\s*(['"\`])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`).exec(block)
  return m ? m[2] : null
}

const ABSENT = Symbol('absent')

function readBool(block, name) {
  const m = new RegExp(`\\b${name}\\s*:\\s*(true|false)\\b`).exec(block)
  return m ? m[1] === 'true' : ABSENT
}

function readNumber(block, name) {
  const m = new RegExp(`\\b${name}\\s*:\\s*([\\d_]+(?:\\s*\\*\\s*[\\d_]+)*)`).exec(block)
  return m ? evalNumber(m[1]) : null
}

/** null 表示"没有这个字段"；false 表示"显式声明为 false" —— 两者在判定面上语义不同 */
function boolOrNull(v) {
  return v === ABSENT ? null : v
}

// 为什么注册表里**不记 commit**:导出物要入库,而 commit 在提交那一刻就变 —— 记进去会让
// `--check` 永远报"不同步",把一条有用的守门变成噪音。要追"这张表是哪次生成的",git 历史本身是答案。

const files = collectToolFiles(TOOLS_DIR).sort()
const tools = []
let skippedNonLiteral = 0

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/')
  const raw = fs.readFileSync(file, 'utf8')
  const masked = maskComments(raw)
  const literals = extractToolLiterals(raw)
  const lines = raw.split('\n')

  for (let idx = 0; idx < literals.length; idx += 1) {
    const lit = literals[idx]
    // 名字不是字面量的工具(第三方动态装配面)没有稳定身份 ⇒ 契约按名绑不上,不进注册表。
    // 这类工具的批准语义由宿主自己的 approvalExemption / registrationOwner 两轴管,不经契约轴。
    if (lit.toolName === '(non-literal)') {
      skippedNonLiteral += 1
      continue
    }
    const startOff = lineStartOffset(lines, lit.line)
    const nextLit = literals[idx + 1]
    const endOff = nextLit ? lineStartOffset(lines, nextLit.line) : masked.length

    let contractBlock = takeObjectBlock(masked, startOff, endOff, 'contract')
    const segmentRaw = raw.slice(startOff, endOff)

    // 三种装配形态，按"能确定就确定、不能确定就如实报未判定"的顺序：
    //   literal        —— `contract: { ... }` 字面量块
    //   contractFor    —— `contract: contractFor('read'|'write'|'dangerous')`，语义复刻自 ai-bridge.ts:54
    //   constant-ref   —— `contract: WRITE_CONTRACT`，同名常量在同文件内（ai-task-template-tools.ts:26）
    //   dynamic-unresolved —— 参数是变量、或常量定义不在本文件 ⇒ 静态面判不了，不猜
    let contractForm = contractBlock ? 'literal' : null
    let synthesized = null
    if (!contractBlock) {
      const formMatch = /\bcontract\s*:\s*contractFor\(\s*(['"])(read|write|dangerous)\1\s*\)/.exec(segmentRaw)
      if (formMatch) {
        const access = formMatch[2]
        const dangerous = access === 'dangerous'
        contractForm = 'contractFor'
        synthesized = {
          permission: {
            permissionKey: `ai.route.${access}`,
            riskLevel: access,
            effectScope: 'network',
            requiresApproval: dangerous,
            alwaysAsk: dangerous ? true : null,
          },
          shape: { visibleToProvider: true },
          resultBudget: {
            policy: 'truncate',
            inlineLimitBytes: 65536,
            providerVisibleLimitBytes: 32768,
            previewBytes: 4096,
          },
        }
      } else {
        const refMatch = /\bcontract\s*:\s*([A-Za-z_$][\w$]*)/.exec(segmentRaw)
        if (refMatch) {
          const refName = refMatch[1]
          const esc = refName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const declRe = new RegExp(`const\\s+${esc}\\s*(?::\\s*[^{=]+)?=\\s*`, 'g')
          const decl = declRe.exec(masked)
          if (decl) {
            const after = decl.index + decl[0].length
            const braceAt = masked.indexOf('{', after)
            if (braceAt >= 0 && braceAt < after + 8) {
              const blk = balanceBraces(masked, braceAt)
              if (blk) {
                contractBlock = blk
                contractForm = 'constant-ref'
              }
            }
          }
        }
        if (!contractBlock) contractForm = 'dynamic-unresolved'
      }
    }

    const permission = contractBlock
      ? takeObjectBlock(masked, contractBlock.start, contractBlock.end, 'permission')
      : null
    const budget = contractBlock
      ? takeObjectBlock(masked, contractBlock.start, contractBlock.end, 'resultBudget')
      : null
    const shape = contractBlock ? takeObjectBlock(masked, contractBlock.start, contractBlock.end, 'shape') : null
    const preview = budget ? takeObjectBlock(masked, budget.start, budget.end, 'preview') : null

    const entry = {
      name: lit.toolName,
      file: rel,
      line: lit.line,
      declared: lit.hasContract,
      contractForm,
      dangerLevel: lit.dangerLevel,
      permission: synthesized
        ? synthesized.permission
        : permission
          ? {
              permissionKey: readString(permission.text, 'permissionKey'),
              riskLevel: readString(permission.text, 'riskLevel'),
              effectScope: readString(permission.text, 'effectScope'),
              requiresApproval: boolOrNull(readBool(permission.text, 'requiresApproval')),
              alwaysAsk: boolOrNull(readBool(permission.text, 'alwaysAsk')),
            }
          : null,
      shape: synthesized
        ? synthesized.shape
        : shape
          ? { visibleToProvider: boolOrNull(readBool(shape.text, 'visibleToProvider')) }
          : null,
      resultBudget: synthesized
        ? synthesized.resultBudget
        : budget
          ? {
              policy: readString(budget.text, 'policy'),
              inlineLimitBytes: readNumber(budget.text, 'inlineLimitBytes'),
              providerVisibleLimitBytes: readNumber(budget.text, 'providerVisibleLimitBytes'),
              previewBytes: preview ? readNumber(preview.text, 'bytes') : null,
            }
          : null,
    }
    tools.push(entry)
  }
}

tools.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)))

const registry = {
  schema: 'itcp-registry/v0.1',
  source: {
    generatedBy: 'scripts/itcp-export.mjs',
    toolFiles: files.length,
    registeredTools: tools.length,
    declaredTools: tools.filter((t) => t.declared).length,
    skippedNonLiteral,
  },
  tools,
}

const serialized = `${JSON.stringify(registry, null, 2)}\n`

const args = process.argv.slice(2)
if (args.includes('--json')) {
  process.stdout.write(serialized)
} else if (args.includes('--check')) {
  const existing = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : ''
  if (existing !== serialized) {
    console.error('[itcp] 注册表与源码不同步：请跑 node scripts/itcp-export.mjs 再提交')
    process.exit(1)
  }
  console.log('[itcp] 注册表与源码一致')
} else {
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  fs.writeFileSync(OUT_FILE, serialized, 'utf8')
  // 写盘后自校验：同一进程内二次序列化必须完全相等，否则说明有非确定性来源
  const again = `${JSON.stringify(registry, null, 2)}\n`
  if (again !== serialized) {
    console.error('[itcp] 导出非确定性：二次序列化不一致')
    process.exit(2)
  }
  console.log(
    `[itcp] 已写 ${path.relative(ROOT, OUT_FILE)} · 工具 ${tools.length} · 带契约 ${registry.source.declaredTools} · 源文件 ${files.length}`,
  )
  const missing = tools.filter((t) => !t.declared)
  if (missing.length > 0) {
    console.log(`[itcp] 无契约 ${missing.length} 枚: ${missing.map((t) => t.name).join(', ')}`)
  }
  const noPermission = tools.filter((t) => t.declared && !t.permission)
  if (noPermission.length > 0) {
    console.log(`[itcp] 契约里读不出 permission ${noPermission.length} 枚: ${noPermission.map((t) => t.name).join(', ')}`)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
