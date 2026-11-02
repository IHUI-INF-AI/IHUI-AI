#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出对账报告 */
/**
 * check-rn-host-shell-coverage.mjs — 共享屏「至少被一个 RN 壳直接 import」只读判据(P0-1)
 *
 * 立因(2026-11-03):`scripts/sync-cross-end-cascade.mjs` 第 9 段名叫 `shell-pages`,实跑的是
 * `gen-rn-shell-types.mjs --all --write`,只产 `.d.ts`;真正造 RN 薄壳的 `gen-rn-host-shell.mjs`
 * 根本不在派生链上。于是「共享屏有多少被 RN 壳真正 import」没有任何一条判据在量 ——
 * 判据缺失时,「派生链跑过了」会被读成「壳也造过了」。
 *
 * 本尺只做一件事:对 `packages/app/src/features/** /XxxScreen.tsx` 的每一枚共享屏,
 * 判断有没有至少一个 `apps/mobile-rn/src/screens/XxxScreen.tsx` 在**值导入**里直接取用该符号:
 *   - 只认 `import { XxxScreen } from '@ihui/rn-app'`(含 `import { XxxScreen as SharedX }`);
 *   - `import type { … }` / 行内 `type XxxScreen` 不算(**类型导入不渲染**);
 *   - 裸名字出现、注释里的镜像标记、间接 re-export 都不算(「直接 import」是字面要求)。
 *
 * 分母与 RN 壳清单**不重算**(§0.6):共享屏取 `check-cross-end-screen-coverage.mjs` 的
 * `collectShared`,RN 屏取同文件的 `collectRn`(与门 237 同一把 `RN_SCREEN_RE` 尺);
 * 「缺壳能不能自动造」取 `gen-rn-host-shell.mjs` 的 `classify`(seedable / needs-manual / undetermined)。
 *
 * 三桶与退出码:
 *   covered            至少一枚 RN 壳直接 import ⇒ 绿
 *   needsManual        未覆盖,且已在 `scripts/data/rn-host-shell-manual.json` 登记(owner + expires)
 *                      ⇒ 在期即「挂账」不判红;缺 owner/expires 或已到期 ⇒ exit 1
 *   seedableMissing    未覆盖、未登记、`classify` 判 seedable ⇒ 列入自动造壳队列,**exit 1**
 *   未覆盖且 classify 判 needs-manual/undetermined 而未登记 ⇒ 记 needsManual(owner=null)并 exit 1
 *
 * 账本只认 `shared`(屏名或相对路径)+ `owner` + `expires`(YYYY-MM-DD,当天仍算在期)+ `reason`。
 * 不为消红伪造登记:本脚本不写账本,`needsManual` 的 owner 必须由人认领。
 *
 * 用法:node scripts/check-rn-host-shell-coverage.mjs [--json] [--gate] [--staged|--worktree]
 * 退出码:0 全覆盖/挂账在期 · 1 有缺口或挂账失效 · 2 取不到输入(未判定,§0.3)
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
import { __test__ as gen } from './gen-rn-host-shell.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')
const MANUAL_REL = 'scripts/data/rn-host-shell-manual.json'
const MANUAL_PATH = join(ROOT, MANUAL_REL)

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const gateMode = argv.includes('--gate')

/** 本仓日期口径与既有脚本一致:ISO(UTC) 的 YYYY-MM-DD;到期日当天仍算在期。 */
function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * 从 RN 壳正文里抽「值导入自 @ihui/rn-app」的绑定名。
 * 返回 { names:Set<string>, namespaces:string[] };默认导入与 `import type` 一律不收。
 */
function rnAppValueImports(text) {
  const names = new Set()
  const namespaces = []
  if (typeof text !== 'string') return { names, namespaces }
  // 具名值导入:import { A, B as C } from '@ihui/rn-app'(允许跨行)
  for (const m of text.matchAll(/import\s+(?!type\s)\{([^}]*)\}\s+from\s+['"]@ihui\/rn-app['"]/g)) {
    for (const part of m[1].split(',')) {
      const s = part.trim().replace(/^type\s+/, '')
      if (!s) continue
      const local = s.split(/\s+as\s+/)[0].trim()
      if (local) names.add(local)
    }
  }
  // 命名空间导入:import * as Shared from '@ihui/rn-app' ⇒ 正文里 Shared.XxxScreen
  for (const m of text.matchAll(/import\s+\*\s+as\s+(\w+)\s+from\s+['"]@ihui\/rn-app['"]/g)) {
    namespaces.push(m[1])
  }
  return { names, namespaces }
}

/** 该 RN 壳是否在值导入里直接取用了 sharedName(命名空间成员取用也算直接取用)。 */
function directlyImports(imports, sharedName) {
  if (imports.names.has(sharedName)) return true
  return imports.namespaces.some((ns) => new RegExp(`\\b${ns}\\.${sharedName}\\b`).test(imports.namespacesText ?? ''))
}

/**
 * 纯判据(测试直接喂夹具,不读盘)。
 * @param {object} p
 * @param {Array<{name:string, spec:string}>} p.shared
 * @param {Array<{file:string, name:string, text:string}>} p.rnShells
 * @param {Array<object>} p.manualEntries
 * @param {(spec:string)=>object} p.classify
 * @param {string} p.today
 */
export function judgeCoverage({
  shared = [],
  rnShells = [],
  manualEntries = [],
  classify = () => ({ kind: 'undetermined', reason: '未注入 classify' }),
  today = isoToday(),
} = {}) {
  const failures = []
  const manual = new Map()
  for (const [index, e] of manualEntries.entries()) {
    const key = typeof e?.shared === 'string' ? e.shared : null
    if (!key) {
      failures.push({ type: 'manual-shape', index, detail: '缺 shared(屏名或相对路径)' })
      continue
    }
    if (manual.has(key)) failures.push({ type: 'manual-duplicate', shared: key, index })
    else manual.set(key, e)
  }

  const importsByShell = new Map()
  for (const sh of rnShells) {
    const parsed = rnAppValueImports(sh.text)
    parsed.namespacesText = typeof sh.text === 'string' ? sh.text : ''
    importsByShell.set(sh.file, parsed)
  }

  const coveredRows = []
  const needsManual = []
  const seedableMissing = []
  const manualExpired = []
  const usedManualKeys = new Set()

  for (const s of shared) {
    const importers = rnShells
      .filter((sh) => directlyImports(importsByShell.get(sh.file), s.name))
      .map((sh) => sh.file)
    if (importers.length > 0) {
      coveredRows.push({ shared: s.name, spec: s.spec, importers })
      continue
    }

    const entry = manual.get(s.name) ?? manual.get(s.spec)
    const entryKey = manual.has(s.name) ? s.name : manual.has(s.spec) ? s.spec : null
    if (entryKey) usedManualKeys.add(entryKey)
    if (entry) {
      const issues = []
      const owner = typeof entry.owner === 'string' ? entry.owner.trim() : ''
      const expires = typeof entry.expires === 'string' ? entry.expires : ''
      if (!owner) issues.push('缺 owner')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expires)) issues.push('expires 缺失或非 YYYY-MM-DD')
      else if (expires < today) {
        issues.push(`已到期(${expires})`)
        manualExpired.push({ shared: s.name, expires })
      }
      if (issues.length > 0) {
        failures.push({ type: 'manual-invalid', shared: s.name, spec: s.spec, owner: owner || null, expires: expires || null, issues })
      }
      needsManual.push({
        shared: s.name,
        spec: s.spec,
        owner: owner || null,
        expires: expires || null,
        reason: typeof entry.reason === 'string' ? entry.reason : null,
        issues,
      })
      continue
    }

    let cls
    try {
      cls = classify(s.spec)
    } catch (e) {
      cls = { kind: 'undetermined', reason: `classify 抛错:${e?.message ?? e}` }
    }
    const kind = cls?.kind ?? 'undetermined'
    if (kind === 'seedable') {
      seedableMissing.push({ shared: s.name, spec: s.spec, legs: cls.legs ?? [] })
      failures.push({ type: 'missing-uncovered', shared: s.name, spec: s.spec, route: 'seedable' })
    } else {
      needsManual.push({
        shared: s.name,
        spec: s.spec,
        owner: null,
        expires: null,
        reason: `未登记(${kind}${cls.hard?.length ? ':' + cls.hard.join(',') : ''})`,
        issues: ['未登记到 manual 账本'],
      })
      failures.push({
        type: 'manual-unregistered',
        shared: s.name,
        spec: s.spec,
        classify: kind,
        hard: cls.hard ?? [],
        reason: cls.reason ?? null,
      })
    }
  }

  // 账本腐烂:登记了但被审面已无此屏 / 已被覆盖却不摘牌 —— 与仓库既有「登记了而没命中」同型,判红。
  const sharedKeys = new Set(shared.flatMap((s) => [s.name, s.spec]))
  const staleManual = []
  for (const [key, e] of manual.entries()) {
    if (!sharedKeys.has(key)) staleManual.push({ shared: key, why: '共享屏已不存在' })
    else if (!usedManualKeys.has(key)) staleManual.push({ shared: key, why: '已被 RN 壳覆盖,登记未摘牌' })
  }
  for (const s of staleManual) failures.push({ type: 'manual-stale', shared: s.shared, why: s.why })

  return {
    total: shared.length,
    covered: coveredRows.length,
    needsManual,
    manualExpired: manualExpired.length,
    seedableMissing,
    staleManual,
    failures,
    coveredRows,
    manualExpiredRows: manualExpired,
  }
}

function loadManual(path = MANUAL_PATH) {
  if (!existsSync(path)) return { entries: [], problem: null }
  try {
    const doc = JSON.parse(readFileSync(path, 'utf8'))
    if (!Array.isArray(doc?.entries)) return { entries: [], problem: `${MANUAL_REL} 缺 entries 数组` }
    return { entries: doc.entries, problem: null }
  } catch (e) {
    return { entries: [], problem: `${MANUAL_REL} 不是合法 JSON:${e.message}` }
  }
}

function collect() {
  const shared = cov.collectShared()
  const rnShells = cov.collectRn()
  if (shared.length === 0) throw new Error(`${cov.SHARED_DIR} 枚举到 0 枚共享屏 ⇒ 判死,不记绿(§0.3)`)
  if (rnShells.length === 0) throw new Error('RN 壳枚举到 0 枚 ⇒ 判死,不记绿(§0.3)')
  const unreadable = rnShells.filter((s) => typeof s.text !== 'string')
  if (unreadable.length > 0)
    throw new Error(`RN 壳正文取不到 ${unreadable.length} 枚(${unreadable.slice(0, 5).map((s) => s.file).join(', ')}…)⇒ 未判定(§0.3)`)
  const manual = loadManual()
  if (manual.problem) throw new Error(manual.problem)
  return { shared, rnShells, manualEntries: manual.entries }
}

function report(face, r) {
  console.log('\n🧱 RN 薄壳直接 import 覆盖(只读;分母/RN 清单与门 237 同尺)')
  console.log('─'.repeat(72))
  console.log(`判定面        : ${face}`)
  console.log(`共享屏        : ${r.total} 枚`)
  console.log(`已直接 import : ${r.covered} 枚`)
  console.log(`挂账 needsManual: ${r.needsManual.length} 枚(到期 ${r.manualExpired} 枚)`)
  console.log(`待自动造壳    : ${r.seedableMissing.length} 枚`)
  if (r.needsManual.length > 0) {
    console.log('\n【needsManual】')
    for (const x of r.needsManual)
      console.log(`  ${x.owner ? '·' : '✗'} ${x.shared}  owner=${x.owner ?? '(未指派)'} expires=${x.expires ?? '(缺)'}  ${x.reason ?? ''}`)
  }
  if (r.seedableMissing.length > 0) {
    console.log('\n【seedableMissing(自动造壳队列)】')
    for (const x of r.seedableMissing.slice(0, 40))
      console.log(`  · ${x.shared}  ${x.spec}${x.legs?.length ? `  legs=${x.legs.join(',')}` : ''}`)
    if (r.seedableMissing.length > 40) console.log(`  … 另有 ${r.seedableMissing.length - 40} 枚`)
  }
  if (r.staleManual.length > 0) {
    console.log('\n【账本腐烂】')
    for (const x of r.staleManual) console.log(`  ✗ ${x.shared}: ${x.why}`)
  }
  if (r.failures.length > 0) {
    console.log(`\n❌ 共 ${r.failures.length} 条判红:每个共享屏至少要被一个 RN 壳直接 import,或由 owner/expires 挂账`)
  } else {
    console.log('\n✅ 全部共享屏已直接 import,或挂账在期')
  }
}

function main() {
  const face = cov.FACE
  const { shared, rnShells, manualEntries } = collect()
  const r = judgeCoverage({ shared, rnShells, manualEntries, classify: gen.classify })
  const out = {
    face,
    total: r.total,
    covered: r.covered,
    needsManual: r.needsManual,
    manualExpired: r.manualExpired,
    seedableMissing: r.seedableMissing,
    staleManual: r.staleManual,
    failures: r.failures,
  }
  if (jsonMode) console.log(JSON.stringify(out, null, 2))
  else if (gateMode)
    console.log(
      `HOST-SHELL-COVERAGE total=${r.total} covered=${r.covered} needsManual=${r.needsManual.length} manualExpired=${r.manualExpired} seedableMissing=${r.seedableMissing.length} -> ${r.failures.length ? '红' : '绿'}`,
    )
  else report(face, r)
  return r.failures.length > 0 ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ 未判定: ${e?.message ?? e}(取不到输入不记绿也不冒红,§0.3)`)
    process.exit(2)
  }
}

export const __test__ = {
  rnAppValueImports,
  directlyImports,
  judgeCoverage,
  loadManual,
  MANUAL_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
