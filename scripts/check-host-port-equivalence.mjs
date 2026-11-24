#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-host-port-equivalence.mjs — 小程序端口等价层只读门禁。
 *
 * 校验 `scripts/data/host-port-equivalence.json`：
 * 1. 每条 entry 的键集合恰为 {port, rnImpl, miniappImpl, semantics, evidence}；
 * 2. `port` 能映射回 packages/types/src/app-host-ports.ts 里真实声明的端口类型
 *    （onNavigate→OnNavigate / onToast→OnToast / onAudio→AudioPort …）；
 * 3. 两端实现文件真实存在（相对仓库根）；
 * 4. semantics / evidence 非空；
 * 5. 必覆盖 onNavigate / onToast / onAudio；types 里若新增未登记的 Port 类型也判红。
 *
 * 只读：不写盘、不改树。缺项 exit 1。
 *
 * 用法：
 *   node scripts/check-host-port-equivalence.mjs
 *   node scripts/check-host-port-equivalence.mjs --json
 *   node scripts/check-host-port-equivalence.mjs --gate
 *   node scripts/check-host-port-equivalence.mjs --table <path> --root <dir>
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO = resolve(HERE, '..')
export const DEFAULT_TABLE = join(REPO, 'scripts', 'data', 'host-port-equivalence.json')
const TYPES_FILE = join(REPO, 'packages', 'types', 'src', 'app-host-ports.ts')

const ENTRY_KEYS = ['port', 'rnImpl', 'miniappImpl', 'semantics', 'evidence']

/** port 运行时键 → types 包里的端口类型声明名 */
export const PORT_TYPE_DECLARATIONS = {
  onNavigate: 'OnNavigate',
  onToast: 'OnToast',
  onAudio: 'AudioPort',
  onSession: 'SessionPort',
  onKv: 'KvPort',
  onMedia: 'MediaPort',
  onUi: 'UiPort',
  onList: 'ListPort',
}

/** 本表至少覆盖的端口面（任务硬要求）。 */
export const REQUIRED_PORTS = ['onNavigate', 'onToast', 'onAudio']

function issue(code, detail) {
  return { code, detail }
}

function readTypesSource(typesPath = TYPES_FILE) {
  if (!existsSync(typesPath)) return null
  return readFileSync(typesPath, 'utf8')
}

function declaredPortTypes(typesSource) {
  if (!typesSource) return new Set()
  const names = new Set()
  const pattern = /export\s+(?:interface|type)\s+([A-Za-z0-9_$]+)/g
  let match
  while ((match = pattern.exec(typesSource))) {
    const name = match[1]
    if (/^On[A-Z]/.test(name) || /Port$/.test(name)) names.add(name)
  }
  return names
}

function entryKeySetOk(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false
  const keys = Object.keys(entry).sort()
  if (keys.length !== ENTRY_KEYS.length) return false
  return keys.every((key, index) => key === [...ENTRY_KEYS].sort()[index])
}

/**
 * @param {{ tablePath?: string, root?: string, typesPath?: string }} [options]
 */
export function validateHostPortEquivalence(options = {}) {
  const root = options.root ?? REPO
  const tablePath = options.tablePath ?? DEFAULT_TABLE
  const typesPath = options.typesPath ?? join(root, 'packages', 'types', 'src', 'app-host-ports.ts')
  const issues = []

  if (!existsSync(tablePath)) {
    return {
      ok: false,
      entries: 0,
      issues: [issue('table-missing', `等价表不存在：${tablePath}`)],
      portKeys: [],
      declaredTypes: [],
    }
  }

  let table
  try {
    table = JSON.parse(readFileSync(tablePath, 'utf8'))
  } catch (error) {
    return {
      ok: false,
      entries: 0,
      issues: [issue('table-invalid-json', `${tablePath}: ${String(error.message ?? error)}`)],
      portKeys: [],
      declaredTypes: [],
    }
  }

  if (!table || typeof table !== 'object' || !Array.isArray(table.ports)) {
    return {
      ok: false,
      entries: 0,
      issues: [issue('table-shape', '顶层必须是对象且包含 ports 数组')],
      portKeys: [],
      declaredTypes: [],
    }
  }

  const typesSource = readTypesSource(typesPath)
  const declared = declaredPortTypes(typesSource)
  const declaredForReport = [...declared].sort()
  const mappedTypes = new Set(Object.values(PORT_TYPE_DECLARATIONS))

  if (!typesSource) {
    issues.push(issue('types-missing', `端口类型源不存在：${typesPath}`))
  } else {
    for (const typeName of declared) {
      if (!mappedTypes.has(typeName)) {
        issues.push(
          issue(
            'unmapped-port-type',
            `types 声明了 ${typeName}，但 check-host-port-equivalence 未登记其运行时键（键集合已漂移）`,
          ),
        )
      }
    }
    for (const typeName of mappedTypes) {
      if (!declared.has(typeName)) {
        issues.push(
          issue('port-type-missing', `映射里的 ${typeName} 在 app-host-ports.ts 中未声明`),
        )
      }
    }
  }

  const entries = table.ports
  const portKeys = new Set()

  entries.forEach((entry, index) => {
    const label = `ports[${index}]`
    if (!entryKeySetOk(entry)) {
      issues.push(
        issue(
          'entry-shape',
          `${label} 键集合必须恰为 ${ENTRY_KEYS.join(' / ')}（实际：${entry && typeof entry === 'object' ? Object.keys(entry).join(' / ') : String(entry)}）`,
        ),
      )
      return
    }

    const { port, rnImpl, miniappImpl, semantics, evidence } = entry
    portKeys.add(port)

    const typeName = PORT_TYPE_DECLARATIONS[port]
    if (!typeName) {
      issues.push(issue('unknown-port', `${label}.port=${port} 不是 app-host-ports.ts 的端口键`))
    } else if (!declared.has(typeName)) {
      issues.push(
        issue('port-type-missing', `${label}.port=${port} 映射到 ${typeName}，但该类型未声明`),
      )
    }

    if (typeof semantics !== 'string' || !semantics.trim()) {
      issues.push(issue('empty-semantics', `${label}.semantics 不能为空`))
    }
    if (typeof evidence !== 'string' || !evidence.trim()) {
      issues.push(issue('empty-evidence', `${label}.evidence 不能为空`))
    }

    for (const [field, rel] of [
      ['rnImpl', rnImpl],
      ['miniappImpl', miniappImpl],
    ]) {
      if (typeof rel !== 'string' || !rel.trim()) {
        issues.push(issue('missing-impl', `${label}.${field} 不能为空`))
        continue
      }
      if (!existsSync(join(root, rel))) {
        issues.push(issue('missing-impl', `${label}.${field} 文件不存在：${rel}`))
      }
    }
  })

  for (const port of REQUIRED_PORTS) {
    if (!portKeys.has(port)) {
      issues.push(issue('missing-port-coverage', `等价表缺少必覆盖端口：${port}`))
    }
  }

  return {
    ok: issues.length === 0,
    entries: entries.length,
    issues,
    portKeys: [...portKeys].sort(),
    declaredTypes: declaredForReport,
  }
}

export function formatReport(result) {
  const lines = []
  if (result.ok) {
    lines.push(
      `[host-port-equivalence] ✅ entries=${result.entries} ports=${result.portKeys.join(',')}`,
    )
    return lines.join('\n')
  }
  lines.push(
    `[host-port-equivalence] ❌ entries=${result.entries} issues=${result.issues.length} ports=${result.portKeys.join(',') || '(none)'}`,
  )
  for (const item of result.issues) {
    lines.push(`  - ${item.code}: ${item.detail}`)
  }
  return lines.join('\n')
}

export const SUMMARY = { REQUIRED_PORTS, ENTRY_KEYS }

export const __test__ = {
  validateHostPortEquivalence,
  SUMMARY,
}

function parseArgs(argv) {
  const options = { json: false, gate: false, tablePath: undefined, root: undefined }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--json') options.json = true
    else if (arg === '--gate') options.gate = true
    else if (arg === '--table') options.tablePath = argv[++i]
    else if (arg === '--root') options.root = argv[++i]
  }
  return options
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (isMain) {
  const options = parseArgs(process.argv.slice(2))
  const result = validateHostPortEquivalence({
    tablePath: options.tablePath ? resolve(options.tablePath) : DEFAULT_TABLE,
    root: options.root ? resolve(options.root) : REPO,
  })

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else if (options.gate) {
    process.stdout.write(
      result.ok
        ? `[host-port-equivalence] ✅ entries=${result.entries} issues=0\n`
        : `[host-port-equivalence] ❌ entries=${result.entries} issues=${result.issues.length}\n`,
    )
    if (!result.ok) {
      for (const item of result.issues) process.stderr.write(`  - ${item.code}: ${item.detail}\n`)
    }
  } else {
    process.stdout.write(`${formatReport(result)}\n`)
  }

  process.exit(result.ok ? 0 : 1)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
