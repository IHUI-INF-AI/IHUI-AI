#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 器物,需打印预演/落地结论 */
/**
 * gen-rn-shell-scaffold.mjs —— 「新共享屏 → RN 宿主薄壳」骨架生成器(默认预演,2026-11-03 立)。
 *
 * 与 `gen-rn-host-shell.mjs` 的分工:那个只造「必填腿全可注入」的零 TODO 壳;本器造
 * **带取数骨架的新屏薄壳** —— 新共享屏往往带业务数据腿,先落一枚形状正确、编译得过、
 * 但数据腿一读就报错的骨架,让「新屏无壳」从"靠人手抄"变成"预演 → 落盘 → 人工补数据源"。
 *
 * 硬口径(逐条对应交付要求):
 *   - 默认只预演(dry-run):逐条打印 `共享屏路径 → 拟生成壳路径 → 识别到的 props(必需/可选)`,
 *     `--write` 才落文件;
 *   - **不伪造端点**:取数处只留 `TODO: 接数据源`,生成物里不出现任何 `/api/...` 或取数函数名;
 *   - 生成内容只含「取数骨架 + 状态 + 端口注入 + 共享屏渲染」,不内置业务逻辑;
 *   - 幂等:已存在的壳不覆盖;`--force` 才覆盖,且覆盖前必须先备份到 `.ihui-agent/tmp/`;
 *   - 缺 props 契约(编译面取不到 / 组件签名无 props)⇒ **不生成**,点名缺哪一枚屏;
 *   - 有共享屏、没有对应 RN 壳、且 `scripts/data/rn-host-shell-manual.json` 无判决的组合才是候选;
 *     props 单源取 `lib/cross-end-screen-props.mjs`(不另写第二套解析,§0.6)。
 *
 * 生成后必须人工补数据源:骨架里的业务腿由 `pending()` 占位,一读即抛
 * `[gen-rn-shell-scaffold] TODO 接数据源: <leg>`,绝不静默返回假数据。
 *
 * 用法:
 *   node scripts/gen-rn-shell-scaffold.mjs --all
 *   node scripts/gen-rn-shell-scaffold.mjs --screen packages/app/src/features/about/AboutScreen.tsx
 *   node scripts/gen-rn-shell-scaffold.mjs --screen <spec> --write
 *   node scripts/gen-rn-shell-scaffold.mjs --screen <spec> --write --force
 *   node scripts/gen-rn-shell-scaffold.mjs --self-test
 *
 * 退出码:0 = 预演完成 / 落盘完成;1 = 有屏缺 props 契约未生成;2 = 取不到输入(未判定,§0.3)。
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
import { judgeCoverage } from './check-rn-host-shell-coverage.mjs'
import { allPropsOf, requiredPropsOf } from './lib/cross-end-screen-props.mjs'
import { RN_DIR, targetPathOf } from './lib/rn-shell-target.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const R = (...p) => join(ROOT, ...p)

export { RN_DIR }
export const MARK = '@gen-rn-shell-scaffold'
export const MANUAL_REL = 'scripts/data/rn-host-shell-manual.json'
export const REGISTRY_REL = 'scripts/data/cross-end-screen-registry.json'
export const BACKUP_ROOT = '.ihui-agent/tmp/rn-shell-scaffold-backup'

/** 平台能当场注入的腿 → 生成时写的表达式。表外腿要么走状态骨架,要么落 pending() 占位。 */
const WIRING = {
  t: 't',
  tt: 't',
  tx: 't',
  colorScheme: 'resolvedTheme',
  scheme: 'resolvedTheme',
  themeMode: 'resolvedTheme',
  resolvedTheme: 'resolvedTheme',
  onBack: '() => navigation.goBack()',
  onClose: '() => navigation.goBack()',
  onDismiss: '() => navigation.goBack()',
  onNavigate: 'onNavigate',
  onToast: 'onToast',
}

/** 取数状态骨架:同名 prop 存在才生成对应本地状态(缺省不生成,免得留下无用变量)。 */
const STATE_DEFAULTS = {
  loading: 'false',
  refreshing: 'false',
  loadingMore: 'false',
  error: "''",
}

/** 腿序取仓内手写壳的书写习惯:取词→主题→返回→端口→状态→待接数据。 */
const LEG_ORDER = [
  't',
  'colorScheme',
  'onBack',
  'onClose',
  'onDismiss',
  'onNavigate',
  'onToast',
]
const sortLegs = (legs) =>
  [...legs].sort((a, b) => {
    const ia = LEG_ORDER.indexOf(a)
    const ib = LEG_ORDER.indexOf(b)
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    return a.localeCompare(b)
  })

const has = (argv, name) => argv.some((a) => a === `--${name}` || a.startsWith(`--${name}=`))
const val = (argv, name, fallback = null) => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const i = argv.indexOf(`--${name}`)
  if (i >= 0 && i + 1 < argv.length && !argv[i + 1].startsWith('--')) return argv[i + 1]
  return fallback
}

/** 共享屏相对路径 → { component, alias };basename 即导出名(与仓内 272 屏一致)。 */
export function symbolOf(specRel) {
  const component = basename(specRel).replace(/\.tsx$/, '')
  return { component, alias: `Shared${component}` }
}

function describeProps({ required, optional }) {
  const req = required.length ? required.join(', ') : '(无)'
  const opt = optional.length ? optional.join(', ') : '(无)'
  return { req, opt }
}

/**
 * 生成骨架源码。纯函数(自测直接喂 props 契约,不读盘、不碰 TS 编译面)。
 *
 * @param {string} specRel 共享屏相对路径
 * @param {{required:string[], optional:string[]}} contract
 */
export function buildScaffold(specRel, { required = [], optional = [] } = {}) {
  const { component, alias } = symbolOf(specRel)
  const source = specRel.split('/features/')[1] ?? specRel

  const injectLegs = []
  const stateLegs = []
  const pendingLegs = []
  for (const leg of required) {
    if (WIRING[leg]) injectLegs.push(leg)
    else if (STATE_DEFAULTS[leg]) stateLegs.push(leg)
    else pendingLegs.push(leg)
  }
  // 可选能力:只注入平台能当场给的腿(主题/取词/端口);其余缺省不传 ⇒ 共享屏按能力关渲染。
  for (const leg of optional) {
    if (WIRING[leg] && !injectLegs.includes(leg)) injectLegs.push(leg)
  }

  const orderedInject = sortLegs(injectLegs)
  const orderedState = [...stateLegs].sort()
  const orderedPending = [...pendingLegs].sort()
  const needsNav = orderedInject.some((l) => WIRING[l].includes('navigation.goBack'))
  const needsI18n = orderedInject.includes('t') || orderedInject.includes('tt') || orderedInject.includes('tx')
  const needsTheme = orderedInject.some((l) => WIRING[l] === 'resolvedTheme')
  const needsPorts = orderedInject.some((l) => ['onNavigate', 'onToast'].includes(l))
  const needsState = orderedState.length > 0
  const needsPending = orderedPending.length > 0

  const imports = []
  if (needsState) imports.push("import { useState } from 'react'")
  if (needsNav) {
    imports.push("import { useNavigation } from '@react-navigation/native'")
    imports.push("import type { NativeStackNavigationProp } from '@react-navigation/native-stack'")
  }
  imports.push(`import { ${component} as ${alias} } from '@ihui/rn-app'`)
  if (needsI18n) imports.push("import { useI18n } from '../i18n'")
  if (needsTheme) imports.push("import { useTheme } from '../context/ThemeContext'")
  if (needsPorts) imports.push("import { useHostPorts } from '../host/use-host-ports'")
  if (needsNav) imports.push("import type { RootStackParamList } from '../navigation/RootNavigator'")

  const hooks = []
  if (needsI18n) hooks.push('  const { t } = useI18n()')
  if (needsTheme) hooks.push('  const { resolvedTheme } = useTheme()')
  if (needsNav) {
    hooks.push('  const navigation = useNavigation<NavigationProp>()')
  }
  if (needsPorts) {
    const names = []
    if (orderedInject.includes('onNavigate')) names.push('onNavigate')
    if (orderedInject.includes('onToast')) names.push('onToast')
    hooks.push(`  const { ${names.join(', ')} } = useHostPorts()`)
  }
  if (needsState) {
    hooks.push('')
    hooks.push('  // TODO: 接数据源 —— 以下状态是空骨架,接上取数后补 setter')
    for (const leg of orderedState) hooks.push(`  const [${leg}] = useState(${STATE_DEFAULTS[leg]})`)
  }

  const jsxLegs = []
  for (const leg of orderedInject) jsxLegs.push(`      ${leg}={${WIRING[leg]}}`)
  for (const leg of orderedState) jsxLegs.push(`      ${leg}={${leg}}`)
  for (const leg of orderedPending) jsxLegs.push(`      ${leg}={pending('${leg}')}`)

  const dataLegs = [...orderedState, ...orderedPending]
  const todoLine = dataLegs.length
    ? `
 *
 * TODO: 接数据源 —— 本屏业务腿:${dataLegs.join(', ')}。
 * 只走本端既有取数出口,禁止在本文件编造接口路径;可选能力缺省不渲染。`
    : ''

  const typeBlock = []
  if (needsNav) typeBlock.push('type NavigationProp = NativeStackNavigationProp<RootStackParamList>')
  if (needsPending) typeBlock.push(`type SharedProps = Parameters<typeof ${alias}>[0]`)

  const pendingFn = needsPending
    ? `

/** TODO: 接数据源 —— 未接的腿一读就报错,绝不静默返回假数据。 */
function pending<K extends keyof SharedProps>(name: K): SharedProps[K] {
  throw new Error(\`[gen-rn-shell-scaffold] TODO 接数据源: \${String(name)}\`)
}`
    : ''

  return `// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// ${MARK} —— 本文件只是骨架,不是完成品:① 取数必须接本端既有出口,禁止在壳里编造 /api 路径;
//   ② 生成后人工补数据源(见下方 TODO),补完删掉本标记;③ 共享屏 props 变更后重跑:
//   node scripts/gen-rn-shell-scaffold.mjs --screen ${specRel} --write --force

${imports.join('\n')}
${typeBlock.length ? `\n${typeBlock.join('\n')}\n` : ''}
/**
 * RN 宿主薄壳 —— 真相源 ${source}。
 * 端内不写布局、不写样式:视觉与结构全在共享屏,本屏只做取数/状态/端口注入。${todoLine}
 */
export function ${component}() {
${hooks.join('\n')}

  return (
    <${alias}
${jsxLegs.join('\n')}
    />
  )
}${pendingFn}
`
}

/** 读台账:只取 entries,坏 JSON 视为取不到输入(不静默当空账本)。 */
export function loadManualEntries(path = R(MANUAL_REL)) {
  if (!existsSync(path)) return { ok: true, entries: [], problem: null }
  try {
    const doc = JSON.parse(readFileSync(path, 'utf8'))
    if (!Array.isArray(doc?.entries)) return { ok: false, entries: [], problem: `${MANUAL_REL} 缺 entries 数组` }
    return { ok: true, entries: doc.entries, problem: null }
  } catch (e) {
    return { ok: false, entries: [], problem: `${MANUAL_REL} 不是合法 JSON:${e.message}` }
  }
}

function loadRegistryRows(path = R(REGISTRY_REL)) {
  try {
    const doc = JSON.parse(readFileSync(path, 'utf8'))
    const rows = Array.isArray(doc) ? doc : doc?.entries || doc?.rows || []
    return rows.filter((r) => r && typeof r.shared === 'string')
  } catch {
    // 登记表读不到 ⇒ 目标路径退回 basename 约定;不影响"无壳无判决"的判定(§0.3 已由台账兜底)。
    return []
  }
}

/** 台账里是否有该屏的判决(屏名或相对路径任一命中即算,与覆盖门同口径)。 */
export function hasVerdict(specRel, name, manualEntries = []) {
  return manualEntries.find((e) => e && (e.shared === name || e.shared === specRel)) ?? null
}

/**
 * 纯判据:给出「有共享屏、无对应壳、台账无判决」的候选行。
 * @param {object} p
 * @param {Array<{name:string,spec:string}>} p.shared
 * @param {Array<object>} p.manualEntries
 * @param {Array<object>} p.registryRows
 * @param {(spec:string)=>({required:string[],optional:string[]})|{state:string,reason?:string}} p.contractOf
 * @param {(target:string)=>string|null} p.readTarget 目标壳正文(不存在返回 null)
 * @param {(spec:string)=>string[]} p.importersOf 直接 import 该共享屏的既有 RN 壳(复用即视为有壳)
 */
export function planRows({
  shared = [],
  manualEntries = [],
  registryRows = [],
  contractOf = () => ({ state: 'undetermined', reason: '未注入 contractOf' }),
  readTarget = () => null,
  importersOf = () => [],
} = {}) {
  const rows = []
  for (const s of shared) {
    const target = targetPathOf(s.spec, registryRows)
    const existing = readTarget(target)
    const entry = hasVerdict(s.spec, s.name, manualEntries)
    const importers = importersOf(s.spec)

    if (existing !== null && !existing.includes(MARK)) {
      rows.push({ status: 'skip-shell', spec: s.spec, name: s.name, target, reason: '已存在手写壳,拒绝覆盖' })
      continue
    }
    if (existing === null && importers.length > 0) {
      rows.push({
        status: 'skip-shell',
        spec: s.spec,
        name: s.name,
        target,
        reason: `已被 ${importers.map((f) => basename(f)).join(', ')} 直接复用,无需独立壳`,
      })
      continue
    }
    if (entry) {
      rows.push({
        status: 'skip-verdict',
        spec: s.spec,
        name: s.name,
        target,
        reason: `台账已判决(${entry.owner ?? '未指派'})`,
      })
      continue
    }

    let contract
    try {
      contract = contractOf(s.spec)
    } catch (e) {
      contract = { state: 'undetermined', reason: `props 解析抛错:${e?.message ?? e}` }
    }
    if (contract?.state === 'undetermined') {
      rows.push({
        status: 'refuse',
        spec: s.spec,
        name: s.name,
        target,
        reason: `缺 props 契约:${contract.reason ?? '未判定'}`,
      })
      continue
    }
    rows.push({
      status: 'generate',
      spec: s.spec,
      name: s.name,
      target,
      existingScaffold: existing !== null,
      required: contract.required ?? [],
      optional: contract.optional ?? [],
    })
  }
  return rows
}

function stampOf(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-')
}

/**
 * 落盘:只为 status=generate 的行写文件。已存在且非 --force ⇒ 跳过;--force 先备份再覆盖。
 * @returns {{written:string[], skippedExisting:string[], refused:object[], backups:Array<{target:string,backup:string}>}}
 */
export function applyRows(rows, {
  write = false,
  force = false,
  root = ROOT,
  backupRoot = R(BACKUP_ROOT),
  stamp = stampOf(),
} = {}) {
  const out = { written: [], skippedExisting: [], refused: [], backups: [] }
  for (const row of rows) {
    if (row.status === 'refuse') {
      out.refused.push(row)
      continue
    }
    if (row.status !== 'generate') continue
    const abs = join(root, row.target)
    if (!write) continue
    if (existsSync(abs)) {
      if (!force) {
        out.skippedExisting.push(row.target)
        continue
      }
      const backup = join(backupRoot, stamp, row.target)
      mkdirSync(dirname(backup), { recursive: true })
      copyFileSync(abs, backup)
      out.backups.push({ target: row.target, backup: relative(root, backup).replace(/\\/g, '/') })
    }
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, buildScaffold(row.spec, { required: row.required, optional: row.optional }))
    out.written.push(row.target)
  }
  return out
}

/** 真实 props 契约:required 与 optional 各问一次权威解析器;任一未判定 ⇒ 整体未判定。 */
function contractFromTs(specRel) {
  const req = requiredPropsOf(specRel)
  if (req.state === 'undetermined') return { state: 'undetermined', reason: req.reason }
  const all = allPropsOf(specRel)
  if (all.state === 'undetermined') return { state: 'undetermined', reason: all.reason }
  const required = [...(req.required ?? [])].sort()
  const optional = all.props.filter((p) => p.optional).map((p) => p.name).sort()
  return { state: 'ok', required, optional }
}

function printRows(rows) {
  let candidates = 0
  for (const row of rows) {
    if (row.status === 'generate') {
      candidates++
      const { req, opt } = describeProps({
        required: row.required ?? [],
        optional: row.optional ?? [],
      })
      console.log(`  [待生成] ${row.spec}`)
      console.log(`        → ${row.target}${row.existingScaffold ? '(已有生成物,--force 备份后覆盖)' : ''}`)
      console.log(`        必需: ${req}`)
      console.log(`        可选: ${opt}`)
    } else if (row.status === 'refuse') {
      console.log(`  [拒绝] ${row.name} (${row.spec}) ← ${row.reason}`)
    }
  }
  const skipShell = rows.filter((r) => r.status === 'skip-shell').length
  const skipVerdict = rows.filter((r) => r.status === 'skip-verdict').length
  console.log(
    `  跳过: 已有壳 ${skipShell} 枚 / 台账已判决 ${skipVerdict} 枚;候选 ${candidates} 枚 / 拒绝 ${rows.filter((r) => r.status === 'refuse').length} 枚`,
  )
}

function realRun(argv) {
  const write = has(argv, 'write')
  const force = has(argv, 'force')
  const all = has(argv, 'all')
  const screenArg = val(argv, 'screen')
  if (!all && !screenArg) {
    console.error('用法: --all | --screen <feature-path> [--write] [--force] | --self-test')
    return 2
  }

  const manual = loadManualEntries()
  if (!manual.ok) {
    console.error(`❌ 未判定: ${manual.problem}`)
    return 2
  }
  const registryRows = loadRegistryRows()

  let shared
  if (screenArg) {
    const given = screenArg.replace(/\\/g, '/')
    const spec = existsSync(R(given))
      ? given
      : existsSync(R(`packages/app/src/features/${given.replace(/^\/+/, '')}`))
        ? `packages/app/src/features/${given.replace(/^\/+/, '')}`
        : null
    if (!spec) {
      console.error(`❌ 未判定: 共享屏不存在 ${screenArg}`)
      return 2
    }
    shared = [{ name: basename(spec).replace(/\.tsx$/, ''), spec, domain: '' }]
  } else {
    try {
      shared = cov.collectShared('worktree')
    } catch (e) {
      console.error(`❌ 未判定: ${e?.message ?? e}`)
      return 2
    }
  }
  if (shared.length === 0) {
    console.error('❌ 未判定: 枚举到 0 枚共享屏,不记绿(§0.3)')
    return 2
  }

  const readTarget = (target) => {
    const abs = R(target)
    return existsSync(abs) ? readFileSync(abs, 'utf8') : null
  }
  // 「有壳」的权威口径复用覆盖门:被任一 RN 壳直接 import 即算已覆盖,不按 basename 猜。
  let rnShells
  try {
    rnShells = cov.collectRn('worktree')
  } catch (e) {
    console.error(`❌ 未判定: RN 屏枚举失败:${e?.message ?? e}`)
    return 2
  }
  const { coveredRows } = judgeCoverage({
    shared,
    rnShells,
    manualEntries: manual.entries,
    classify: () => ({ kind: 'undetermined' }),
  })
  const importersBySpec = new Map(coveredRows.map((r) => [r.spec, r.importers]))

  const rows = planRows({
    shared,
    manualEntries: manual.entries,
    registryRows,
    contractOf: contractFromTs,
    readTarget,
    importersOf: (spec) => importersBySpec.get(spec) ?? [],
  })

  console.log(`\n🧩 RN 薄壳骨架候选(${write ? '落盘' : '预演,不落盘'};判定面=worktree)`)
  console.log('─'.repeat(72))
  printRows(rows)

  const out = applyRows(rows, { write, force })
  for (const b of out.backups) console.log(`  备份 ${b.target} → ${b.backup}`)
  for (const p of out.written) console.log(`  written ${p}`)
  for (const p of out.skippedExisting) console.log(`  skipped ${p} (已存在;--force 才备份覆盖)`)
  console.log(
    `GEN-RN-SHELL-SCAFFOLD state=${write ? 'applied' : 'preview'} 候选=${rows.filter((r) => r.status === 'generate').length} 写出=${out.written.length} 跳过已存在=${out.skippedExisting.length} 拒绝=${out.refused.length}`,
  )
  return out.refused.length > 0 ? 1 : 0
}

/** 自检:≥5 例,全部在 scratch 夹具里跑,绝不写仓内文件。 */
function selfTest() {
  const scratch = mkScratch('rn-shell-scaffold-')
  const results = []
  const check = (name, fn) => {
    try {
      fn()
      results.push({ name, ok: true })
    } catch (e) {
      results.push({ name, ok: false, why: e?.message ?? String(e) })
    }
  }
  const SPEC = 'packages/app/src/features/demo/DemoNewScreen.tsx'
  const TARGET = `${RN_DIR}/DemoNewScreen.tsx`
  const contract = {
    state: 'ok',
    required: ['t', 'onBack', 'onNavigate', 'items', 'onRefresh'],
    optional: ['colorScheme', 'onPress', 'onToast'],
  }
  const rowsWith = (extra = {}) =>
    planRows({
      shared: [{ name: 'DemoNewScreen', spec: SPEC }],
      manualEntries: [],
      registryRows: [],
      contractOf: () => contract,
      readTarget: (p) => (existsSync(join(scratch, p)) ? readFileSync(join(scratch, p), 'utf8') : null),
      ...extra,
    })

  check('① dry-run 不落盘:预演有候选但磁盘无文件', () => {
    const rows = rowsWith()
    assertEq(rows.length, 1)
    assertEq(rows[0].status, 'generate')
    const out = applyRows(rows, { write: false, root: scratch, backupRoot: join(scratch, 'bak') })
    assertEq(out.written.length, 0)
    assertEq(existsSync(join(scratch, TARGET)), false)
  })

  check('② --write 落盘形状正确:标记/导入/导出/TODO 齐,且不伪造端点', () => {
    const rows = rowsWith()
    const out = applyRows(rows, { write: true, root: scratch, backupRoot: join(scratch, 'bak') })
    assertEq(out.written.length, 1)
    const text = readFileSync(join(scratch, TARGET), 'utf8')
    for (const must of [
      MARK,
      "import { DemoNewScreen as SharedDemoNewScreen } from '@ihui/rn-app'",
      'export function DemoNewScreen()',
      'useHostPorts',
      'TODO: 接数据源',
      'onBack={() => navigation.goBack()}',
      "items={pending('items')}",
    ]) {
      if (!text.includes(must)) throw new Error(`缺形状标记: ${must}`)
    }
    for (const banned of ['/api/', 'fetchApi(', 'getDemo']) {
      if (text.includes(banned)) throw new Error(`不得伪造端点/取数: ${banned}`)
    }
  })

  check('③ 已存在不覆盖:无 --force 时目标正文逐字节不变', () => {
    const abs = join(scratch, TARGET)
    const before = readFileSync(abs, 'utf8')
    const rows = rowsWith()
    const out = applyRows(rows, { write: true, root: scratch, backupRoot: join(scratch, 'bak') })
    assertEq(out.written.length, 0)
    assertEq(out.skippedExisting.length, 1)
    assertEq(readFileSync(abs, 'utf8'), before)
  })

  check('④ --force 先备份再覆盖:备份保住旧正文,目标换成新骨架', () => {
    const abs = join(scratch, TARGET)
    const before = readFileSync(abs, 'utf8')
    const sentinel = `// ${MARK} sentinel-old-scaffold\n`
    writeFileSync(abs, sentinel)
    const rows = rowsWith()
    const out = applyRows(rows, {
      write: true,
      force: true,
      root: scratch,
      backupRoot: join(scratch, 'bak'),
      stamp: 'selftest',
    })
    assertEq(out.written.length, 1)
    assertEq(out.backups.length, 1)
    const backupAbs = join(scratch, out.backups[0].backup)
    assertEq(readFileSync(backupAbs, 'utf8'), sentinel)
    assertEq(readFileSync(abs, 'utf8'), before)
  })

  check('⑤ 缺 props 契约不生成:拒绝行点名屏名与原因,磁盘无新文件', () => {
    const rows = planRows({
      shared: [{ name: 'NoContractScreen', spec: 'packages/app/src/features/no-contract/NoContractScreen.tsx' }],
      manualEntries: [],
      registryRows: [],
      contractOf: () => ({ state: 'undetermined', reason: '编译面取不到:不在 RN 编译面里' }),
      readTarget: () => null,
    })
    assertEq(rows.length, 1)
    assertEq(rows[0].status, 'refuse')
    if (!rows[0].reason.includes('NoContractScreen') && !rows[0].spec.includes('NoContractScreen'))
      throw new Error('拒绝行必须点名缺契约的那枚屏')
    if (!rows[0].reason.includes('缺 props 契约')) throw new Error('拒绝原因必须写明缺 props 契约')
    const out = applyRows(rows, { write: true, root: scratch, backupRoot: join(scratch, 'bak') })
    assertEq(out.written.length, 0)
    assertEq(existsSync(join(scratch, RN_DIR, 'NoContractScreen.tsx')), false)
  })

  check('⑥ 台账有判决不生成:候选面直接跳过,不覆盖既不造新壳', () => {
    const rows = planRows({
      shared: [{ name: 'VerdictedScreen', spec: 'packages/app/src/features/verdicted/VerdictedScreen.tsx' }],
      manualEntries: [{ shared: 'VerdictedScreen', owner: 'someone', expires: '2027-03-31', evidence: 'x' }],
      registryRows: [],
      contractOf: () => contract,
      readTarget: () => null,
    })
    assertEq(rows[0].status, 'skip-verdict')
  })

  rmScratch(scratch, { bestEffort: true })
  const pass = results.filter((r) => r.ok).length
  for (const r of results) console.log(`  ${r.ok ? '✅' : '❌'} ${r.name}${r.ok ? '' : ` ← ${r.why}`}`)
  console.log(`SELF-TEST pass=${pass} fail=${results.length - pass}`)
  return pass === results.length ? 0 : 1
}

function assertEq(actual, expected) {
  if (actual !== expected)
    throw new Error(`断言失败:期望 ${JSON.stringify(expected)},实际 ${JSON.stringify(actual)}`)
}

const argv = process.argv.slice(2)
const isDirectRun =
  process.argv[1] && relative(ROOT, process.argv[1]).replace(/\\/g, '/') === 'scripts/gen-rn-shell-scaffold.mjs'

if (isDirectRun) {
  let code
  try {
    code = has(argv, 'self-test') ? selfTest() : realRun(argv)
  } catch (e) {
    console.error(`❌ 未判定: ${e?.message ?? e}(取不到输入不记绿,§0.3)`)
    code = 2
  }
  process.exit(code)
}

export const __test__ = {
  buildScaffold,
  symbolOf,
  targetPathOf,
  planRows,
  applyRows,
  loadManualEntries,
  hasVerdict,
  contractFromTs,
  MARK,
  RN_DIR,
  WIRED: WIRING,
  STATE_DEFAULTS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
