#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 契约单一源扫描门（F0 / P0-03 / P0-04 / V2-08）。
 *
 * 判据：
 *   CS1 权威定义只有一份：`packages/shared/src/agent-registry/contracts.ts` 的 7 族枚举
 *       （AgentRole / OrchestrationMode / RunStatus / DefinitionStatus / ApprovalStatus / Scope / ErrorCode）
 *       值集与文档基线逐项相等（数量断言见 EXPECTED_SIZE），多/少/改拼写即红。
 *   CS2 契约包内零重复：默认扫描 `packages/shared/src` + `packages/types/src`，
 *       除 contracts.ts 外只允许两类声明 ——
 *       a) `packages/types/src/agent-registry.ts` 的镜像，必须与权威值集**逐字相等**；
 *       b) 标了 `@deprecated` 的**真子集**旧别名（如 subagents 的 5 值 SubagentRole）。
 *       其余同名/同值集声明一律红。
 *   CS3 扩张扫描（`--all`）：把 apps/api、apps/web、apps/cli、apps/ai-service、packages/api-client
 *       纳入，只报告「legacy pending」，按路径归属到 R1/W1/C1/R2/R3；`--strict-legacy` 时也判红。
 *
 * 取材口径（守门 118）：
 *   不 readFileSync 拼 ROOT、不用 process.cwd() 定根；内容一律经 `scripts/lib/face-reader.mjs`：
 *   枚举用 gitRaw/listFaceFiles，读取用 readWorktreeFile/catBatch；取不到面 ⇒ exit 2（未判定）。
 *   默认面 = worktree（含未跟踪新文件，F0 建新文件时也自洽）；`--staged` / `--head` 给提交链/问责用。
 *
 * 用法：
 *   node scripts/check-agent-contract-single-source.mjs            # 默认：CS1+CS2（worktree）
 *   node scripts/check-agent-contract-single-source.mjs --all      # +CS3 全仓盘点
 *   node scripts/check-agent-contract-single-source.mjs --staged   # 提交链面（索引）
 *   node scripts/check-agent-contract-single-source.mjs --json
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  catBatch,
  gitRaw,
  listFaceFiles,
  readWorktreeFile,
  selectFace,
  Undetermined,
} from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const CONTRACTS_REL = 'packages/shared/src/agent-registry/contracts.ts'
const MIRROR_REL = 'packages/types/src/agent-registry.ts'

const CONTRACT_ARRAYS = {
  AgentRole: 'AGENT_ROLE_VALUES',
  OrchestrationMode: 'ORCHESTRATION_MODES',
  RunStatus: 'RUN_STATUSES',
  DefinitionStatus: 'DEFINITION_STATUSES',
  ApprovalStatus: 'APPROVAL_STATUSES',
  Scope: 'SCOPES',
  ErrorCode: 'ERROR_CODES',
}

/** 文档基线数量（00 §6 / 01 §3 / 01 §4.4）。改这里等于改契约，必须走 ADR。 */
const EXPECTED_SIZE = {
  AgentRole: 11, // 10 内置 + custom
  OrchestrationMode: 9,
  RunStatus: 8,
  DefinitionStatus: 3,
  ApprovalStatus: 6,
  Scope: 3,
  ErrorCode: 40,
}

const TYPE_ALIASES = {
  AgentRole: 'AgentRole',
  SubagentRole: 'AgentRole',
  OrchestrationMode: 'OrchestrationMode',
  RunStatus: 'RunStatus',
  DefinitionStatus: 'DefinitionStatus',
  ApprovalStatus: 'ApprovalStatus',
  Scope: 'Scope',
  ErrorCode: 'ErrorCode',
  agentRole: 'AgentRole',
  orchestration: 'OrchestrationMode',
  orchestrationMode: 'OrchestrationMode',
}

/** 只有智能体域的类型名允许后缀匹配（AgentRunStatus / SwarmAgentRole…）；Scope/ErrorCode 太泛，只认全名。 */
const SUFFIX_TYPES = new Set([
  'AgentRole',
  'OrchestrationMode',
  'RunStatus',
  'DefinitionStatus',
  'ApprovalStatus',
])

/**
 * 同名但不同域的历史枚举：登记后不计入重复（值集也必须对得上，避免被当成挡箭牌）。
 * - super-agent/roles.ts 的 AgentRole 是宿主席位（router/worker），不是注册表角色。
 * - constants/error-codes.ts 的 ErrorCode 是数字业务码（40101/499…），不是字符串错误码。
 */
const OTHER_DOMAIN = [
  {
    file: 'packages/shared/src/super-agent/roles.ts',
    name: 'AgentRole',
    values: ['router', 'worker'],
    reason: '超级智能体宿主席位，不是注册表 AgentRole',
  },
  {
    file: 'packages/shared/src/constants/error-codes.ts',
    name: 'ErrorCode',
    values: null, // 数字联合，见 isOtherDomain 的 numeric 分支
    reason: '旧数字业务错误码，不是注册表字符串错误码',
  },
]

const DEFAULT_ROOTS = ['packages/shared/src', 'packages/types/src']
const ALL_ROOTS = [
  ...DEFAULT_ROOTS,
  'packages/api-client/src',
  'apps/api/src',
  'apps/web',
  'apps/cli/src',
  'apps/ai-service/app',
]

const EXT_RE = /\.(ts|tsx|mts|cts)$/

function extractStringLiterals(text) {
  const out = []
  const re = /(['"])([^'"\\\n]+)\1/g
  let m
  while ((m = re.exec(text)) !== null) out.push(m[2])
  return out
}

function parseContractsArray(source, constName) {
  const re = new RegExp(
    `(?:export\\s+)?const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s+const`,
  )
  const m = source.match(re)
  if (!m) return null
  return extractStringLiterals(m[1])
}

/** 按判定面枚举文件；worktree 面要带上未跟踪新文件（git ls-files --others）。 */
function listFiles(face, roots) {
  let paths
  if (face === 'worktree') {
    const out = gitRaw(
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...roots],
      ROOT,
      { timeout: 120_000 },
    )
    paths = String(out)
      .split('\u0000')
      .filter((p) => p.length > 0)
  } else {
    paths = listFaceFiles(ROOT, face, { paths: roots })
  }
  return paths.filter((p) => EXT_RE.test(p) && !p.endsWith('.d.ts'))
}

/** 按判定面读内容；取不到任何一份 ⇒ Undetermined（不记绿）。 */
function readContents(face, paths) {
  const map = new Map()
  const missing = []
  if (face === 'worktree') {
    for (const rel of paths) {
      const text = readWorktreeFile(ROOT, rel)
      if (typeof text !== 'string') missing.push(rel)
      else map.set(rel, text)
    }
  } else {
    // 面口径：head=`HEAD:<path>`；index=`:<path>`（git cat-file 的暂存面写法，不能省冒号）
    const specs = paths.map((rel) => (face === 'head' ? `HEAD:${rel}` : `:${rel}`))
    const got = catBatch(ROOT, specs, { timeout: 120_000 })
    for (let i = 0; i < paths.length; i += 1) {
      const text = got.get(specs[i])
      if (typeof text !== 'string') missing.push(paths[i])
      else map.set(paths[i], text)
    }
  }
  if (missing.length > 0) {
    throw new Undetermined(`内容取不到 ${missing.length} 个文件，首个：${missing[0]}`)
  }
  if (map.size === 0) throw new Undetermined(`枚举到 0 个源码文件（${paths.length}）—— 空扫不记绿`)
  return map
}

/** 收集 `type X = ...` 与 `z.enum([...])` 两类别名声明。 */
function collectDeclarations(source) {
  const lines = source.split(/\r?\n/)
  const declarations = []

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const match = line.match(/^\s*(?:export\s+)?type\s+([A-Za-z0-9_]+)\s*=\s*(.*)$/)
    if (!match) continue
    let text = match[2]
    let end = i
    while (end + 1 < lines.length) {
      const next = lines[end + 1]
      const continues =
        /^\s*\|/.test(next) ||
        text.trim() === '' ||
        (/^\s*['"]/.test(next) && !/^\s*(?:export|type|interface|const|function)/.test(next))
      if (!continues) break
      end += 1
      text += `\n${next}`
    }
    declarations.push({
      kind: 'type',
      name: match[1],
      line: i + 1,
      text,
      context: lines.slice(Math.max(0, i - 8), i).join('\n'),
      values: extractStringLiterals(text),
    })
    i = end
  }

  const zodRe = /([A-Za-z_$][\w$]*)\s*:\s*z\s*\.\s*enum\s*\(\s*\[([\s\S]*?)\]\s*\)/g
  let zm
  while ((zm = zodRe.exec(source)) !== null) {
    const line = source.slice(0, zm.index).split(/\r?\n/).length
    declarations.push({
      kind: 'zod',
      name: zm[1],
      line,
      text: zm[2],
      context: '',
      values: extractStringLiterals(zm[2]),
    })
  }

  return declarations
}

function classify(name) {
  if (TYPE_ALIASES[name]) return TYPE_ALIASES[name]
  for (const type of SUFFIX_TYPES) {
    if (name.endsWith(type) && name !== type) return type
  }
  return null
}

function isOtherDomain(fileRel, name, values, type) {
  const rule = OTHER_DOMAIN.find((item) => item.file === fileRel && item.name === name)
  if (!rule) return false
  if (rule.values === null) {
    return type === 'ErrorCode' && values.length > 0 && values.every((v) => /^\d+$/.test(v))
  }
  return values.length === rule.values.length && values.every((v) => rule.values.includes(v))
}

function ownerFor(relPath) {
  if (relPath.startsWith('packages/api-client/')) return 'R1'
  if (relPath.startsWith('apps/api/')) return 'R1'
  if (relPath.startsWith('apps/web/')) return 'W1'
  if (relPath.startsWith('apps/cli/')) return 'C1'
  if (relPath.startsWith('apps/ai-service/')) return 'R2/R3'
  return 'owner-unknown'
}

function analyse({ face, scanAll }) {
  const roots = scanAll ? ALL_ROOTS : DEFAULT_ROOTS
  const files = listFiles(face, roots)
  const contents = readContents(face, files)

  const contractsSource = contents.get(CONTRACTS_REL)
  if (typeof contractsSource !== 'string') {
    throw new Undetermined(`缺少权威契约：${CONTRACTS_REL}（面=${face}）`)
  }

  const canonicalSets = {}
  const canonicalValues = {}
  const problems = []

  for (const [type, constName] of Object.entries(CONTRACT_ARRAYS)) {
    const values = parseContractsArray(contractsSource, constName)
    if (!values) {
      problems.push(`${CONTRACTS_REL}: 找不到 ${constName} 的 as const 数组`)
      continue
    }
    canonicalValues[type] = values
    canonicalSets[type] = new Set(values)
    if (new Set(values).size !== values.length) {
      problems.push(`${CONTRACTS_REL}: ${constName} 有重复值`)
    }
    if (values.length !== EXPECTED_SIZE[type]) {
      problems.push(
        `${CONTRACTS_REL}: ${constName} 数量 ${values.length} ≠ 基线 ${EXPECTED_SIZE[type]}（改契约需走 ADR）`,
      )
    }
  }

  const duplicates = []
  const mirrors = []
  const deprecatedSubsets = []
  const otherDomain = []
  const legacy = []

  for (const [fileRel, source] of contents) {
    if (fileRel === CONTRACTS_REL) continue
    for (const decl of collectDeclarations(source)) {
      const type = classify(decl.name)
      if (!type) continue
      if (decl.values.length === 0) continue
      if (isOtherDomain(fileRel, decl.name, decl.values, type)) {
        otherDomain.push({ file: fileRel, line: decl.line, name: decl.name, type })
        continue
      }
      const canonical = canonicalSets[type]
      if (!canonical) continue
      const exactEqual =
        decl.values.length === canonical.size && decl.values.every((v) => canonical.has(v))
      const item = { file: fileRel, line: decl.line, name: decl.name, type, values: decl.values }

      if (fileRel === MIRROR_REL) {
        mirrors.push({ ...item, exactEqual })
        if (!exactEqual) {
          duplicates.push({ ...item, reason: '镜像值集与 contracts.ts 不一致' })
        }
        continue
      }

      if (exactEqual) {
        duplicates.push({ ...item, reason: '与 contracts.ts 值集完全重复' })
        continue
      }

      const isSubset =
        decl.values.length > 0 &&
        decl.values.length < canonical.size &&
        decl.values.every((v) => canonical.has(v))
      if (isSubset && decl.context.includes('@deprecated')) {
        deprecatedSubsets.push(item)
        continue
      }

      if (scanAll && (fileRel.startsWith('apps/') || fileRel.startsWith('packages/api-client/'))) {
        legacy.push({ ...item, owner: ownerFor(fileRel) })
        continue
      }

      duplicates.push({ ...item, reason: '值集与契约族重合但非合法镜像/旧别名' })
    }
  }

  return {
    face,
    roots,
    scannedFiles: files.length,
    sizes: Object.fromEntries(Object.entries(canonicalValues).map(([k, v]) => [k, v.length])),
    duplicates,
    mirrors,
    deprecatedSubsets,
    otherDomain,
    legacy,
    problems,
  }
}

function main(argv = process.argv.slice(2)) {
  const picked = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: argv.includes('--head') ? 'head' : 'worktree',
  })
  if (picked.error) {
    console.error(`[agent-contract-single-source] ${picked.error}`)
    return 2
  }
  const face = picked.face
  const scanAll = argv.includes('--all')
  const json = argv.includes('--json')
  const strictLegacy = argv.includes('--strict-legacy')

  let result
  try {
    result = analyse({ face, scanAll })
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`[agent-contract-single-source] 未判定：${e.message}`)
      return 2
    }
    throw e
  }

  const fail =
    result.problems.length > 0 || result.duplicates.length > 0 || (strictLegacy && result.legacy.length > 0)
  const exitCode = fail ? 1 : 0

  if (json) {
    console.log(
      JSON.stringify(
        {
          ok: !fail,
          face: result.face,
          contracts: CONTRACTS_REL,
          sizes: result.sizes,
          scannedFiles: result.scannedFiles,
          duplicates: result.duplicates,
          mirrors: result.mirrors,
          deprecatedSubsets: result.deprecatedSubsets,
          otherDomain: result.otherDomain,
          legacy: result.legacy,
          problems: result.problems,
        },
        null,
        2,
      ),
    )
    return exitCode
  }

  console.log('[agent-contract-single-source] 契约单一源扫描')
  console.log(`  contracts: ${CONTRACTS_REL}`)
  console.log(
    `  values: ${Object.entries(result.sizes)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')}`,
  )
  console.log(`  face: ${result.face}`)
  console.log(`  roots: ${result.roots.join(', ')}`)
  console.log(`  scanned: ${result.scannedFiles} files`)

  for (const p of result.problems) console.log(`  [contract] ${p}`)
  for (const m of result.mirrors) {
    console.log(`  [mirror] ${m.file}:${m.line} ${m.type} ${m.exactEqual ? '=' : '≠'} contracts.ts`)
  }
  for (const d of result.deprecatedSubsets) {
    console.log(`  [deprecated-subset] ${d.file}:${d.line} ${d.name}(${d.values.length}) ⊂ ${d.type}`)
  }
  for (const d of result.otherDomain) {
    console.log(`  [other-domain] ${d.file}:${d.line} ${d.name}（同名不同域，已登记）`)
  }
  for (const d of result.duplicates) {
    console.log(`  [duplicate] ${d.file}:${d.line} ${d.name} → ${d.type}（${d.reason}）`)
  }
  for (const l of result.legacy) {
    console.log(`  [legacy pending] ${l.file}:${l.line} ${l.name} → ${l.type}（owner ${l.owner}）`)
  }

  console.log(
    `  重复枚举: ${result.duplicates.length}；契约基线问题: ${result.problems.length}；` +
      `合法镜像: ${result.mirrors.length}；@deprecated 子集: ${result.deprecatedSubsets.length}；` +
      `同名不同域: ${result.otherDomain.length}；legacy pending: ${result.legacy.length}`,
  )
  console.log(fail ? 'FAIL' : 'OK')
  return exitCode
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  parseContractsArray,
  collectDeclarations,
  classify,
  isOtherDomain,
  analyse,
  listFiles,
  main,
  CONTRACT_ARRAYS,
  EXPECTED_SIZE,
  TYPE_ALIASES,
  SUFFIX_TYPES,
  OTHER_DOMAIN,
  CONTRACTS_REL,
  MIRROR_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
