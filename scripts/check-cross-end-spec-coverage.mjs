#!/usr/bin/env node
// 跨端 spec 覆盖率守门 + 棘轮(阶段1/2 自动化执行半边)—— 扫描共享原子,报告哪些已下沉 spec 且被 web/RN 双端消费。
//
// 用法:
//   node scripts/check-cross-end-spec-coverage.mjs            # 打印覆盖率表,永不退出非 0
//   node scripts/check-cross-end-spec-coverage.mjs --strict  # 任一"spec 已存在但某端未消费"即退出 1(回归)
//   node scripts/check-cross-end-spec-coverage.mjs --ratchet # 覆盖率低于 scripts/data/cross-end-spec-baseline.json 即退出 1(退化棘轮)
//
// 判据:
//   - NO-SPEC : 共享原子还没有 *-spec.ts(可能是预存在设计选择,不计入回归)
//   - PARTIAL : spec 已存在,但 web / RN 有一端没 import 它(潜在回归 → --strict 计入)
//   - OK      : spec 存在且两端都消费
//
// 棘轮口径:基线存于 scripts/data/cross-end-spec-baseline.json({ okAtoms, totalAtoms })。
//   取数面 = 当前被审面(默认工作树;CI 跑在已提交树上,故等价于该提交 HEAD)。
//   本门**只读不写**基线 —— 覆盖率涨了不拦(那是收口),跌了才拦(退化)。
//   修改基线须显式编辑该 JSON(附 note 与 setAt),不允许门自改,杜绝"门把锚点降到当前值"的假绿(同守门 128 棘轮 §0.5)。
//   判据零复算:守门与棘轮共用 computeCoverage()(§0.6 单一真相源),本文件不抄第二份。
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHARED_UI = resolve(ROOT, 'packages/shared/src/ui')
const UI_REACT = resolve(ROOT, 'packages/ui-react/src/components')
const UI_NATIVE = resolve(ROOT, 'packages/ui-native/src')
const BASELINE_PATH = resolve(ROOT, 'scripts/data/cross-end-spec-baseline.json')

// 共享原子清单(两端都应有实现、理想情况下应下沉 spec 的组件)
const ATOMS = [
  'card',
  'input',
  'badge',
  'tabs',
  'dialog',
  'tooltip',
  'vip-badge',
  'switch',
  'collapsible',
  'sheet',
  'avatar',
]

const has = (p) => existsSync(p)
const read = (p) => readFileSync(p, 'utf8')

function consumes(atom, dir) {
  const file = resolve(dir, `${atom}.tsx`)
  if (!has(file)) return false
  return read(file).includes(`@ihui/shared/ui/${atom}-spec`)
}

/** 单一真相源扫描:返回 { rows, ok, partials, total }。守门与棘轮共用,§0.6 零复算。 */
export function computeCoverage() {
  const rows = []
  let partials = 0
  for (const atom of ATOMS) {
    const hasSpec = has(resolve(SHARED_UI, `${atom}-spec.ts`))
    const react = consumes(atom, UI_REACT)
    const native = consumes(atom, UI_NATIVE)
    let status = 'OK'
    if (!hasSpec) status = 'NO-SPEC'
    else if (!react || !native) {
      status = 'PARTIAL'
      partials++
    }
    rows.push({ atom, spec: hasSpec, react, native, status })
  }
  const ok = rows.filter((r) => r.status === 'OK').length
  return { rows, ok, partials, total: ATOMS.length }
}

function loadBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  } catch {
    return null
  }
}

const pad = (s, n) => String(s).padEnd(n)
function printCoverage(cov) {
  console.log(pad('atom', 14) + pad('spec', 6) + pad('web', 6) + pad('RN', 6) + 'status')
  console.log('-'.repeat(44))
  for (const r of cov.rows) {
    console.log(
      pad(r.atom, 14) +
        pad(r.spec ? '✓' : '✗', 6) +
        pad(r.react ? '✓' : '✗', 6) +
        pad(r.native ? '✓' : '✗', 6) +
        r.status,
    )
  }
  console.log('-'.repeat(44))
  console.log(`覆盖率 ${cov.ok}/${cov.total} OK · PARTIAL=${cov.partials}`)
}

const STRICT = process.argv.includes('--strict')
const RATCHET = process.argv.includes('--ratchet')

function run() {
  const cov = computeCoverage()
  printCoverage(cov)

  if (STRICT && cov.partials > 0) {
    const bad = cov.rows.filter((r) => r.status === 'PARTIAL').map((r) => r.atom)
    console.error(`[strict] 以下原子 spec 已存在但消费不全: ${bad.join(', ')}`)
    process.exit(1)
  }

  if (RATCHET) {
    const base = loadBaseline()
    if (!base || typeof base.okAtoms !== 'number') {
      console.error('[ratchet] 取不到基线 scripts/data/cross-end-spec-baseline.json,未判定(§0.3)')
      process.exit(2)
    }
    if (cov.ok < base.okAtoms) {
      const dropped = cov.rows.filter((r) => r.status !== 'OK').map((r) => r.atom)
      console.error(
        `[ratchet] 覆盖率 ${cov.ok}/${cov.total} 低于基线 ${base.okAtoms}/${base.totalAtoms};未达标原子: ${dropped.join(', ')}`,
      )
      process.exit(1)
    }
    console.log(`[ratchet] 覆盖率 ${cov.ok}/${cov.total} ≥ 基线 ${base.okAtoms}/${base.totalAtoms} ✓ 无退化`)
  }

  process.exit(0)
}

export const __test__ = { computeCoverage, ATOMS, consumes, loadBaseline, BASELINE_PATH }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) run()
