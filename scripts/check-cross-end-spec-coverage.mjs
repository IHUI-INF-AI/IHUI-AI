#!/usr/bin/env node
// 跨端 spec 覆盖率守门(阶段1 自动化执行半边)—— 扫描共享原子,报告哪些已下沉 spec 且被 web/RN 双端消费。
//
// 用法:
//   node scripts/check-cross-end-spec-coverage.mjs            # 打印覆盖率表,永不退出非 0
//   node scripts/check-cross-end-spec-coverage.mjs --strict  # 任一"spec 已存在但某端未消费"即退出 1(回归)
//
// 判据:
//   - NO-SPEC : 共享原子还没有 *-spec.ts(可能是预存在设计选择,不计入回归)
//   - PARTIAL : spec 已存在,但 web / RN 有一端没 import 它(潜在回归 → --strict 计入)
//   - OK      : spec 存在且两端都消费
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHARED_UI = resolve(ROOT, 'packages/shared/src/ui')
const UI_REACT = resolve(ROOT, 'packages/ui-react/src/components')
const UI_NATIVE = resolve(ROOT, 'packages/ui-native/src')

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

const STRICT = process.argv.includes('--strict')

const has = (p) => existsSync(p)
const read = (p) => readFileSync(p, 'utf8')

function consumes(atom, dir) {
  const file = resolve(dir, `${atom}.tsx`)
  if (!has(file)) return false
  return read(file).includes(`@ihui/shared/ui/${atom}-spec`)
}

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
  rows.push({ atom, spec: hasSpec ? '✓' : '✗', react: react ? '✓' : '✗', native: native ? '✓' : '✗', status })
}

const pad = (s, n) => String(s).padEnd(n)
console.log(pad('atom', 14) + pad('spec', 6) + pad('web', 6) + pad('RN', 6) + 'status')
console.log('-'.repeat(44))
for (const r of rows) {
  console.log(pad(r.atom, 14) + pad(r.spec, 6) + pad(r.react, 6) + pad(r.native, 6) + r.status)
}
console.log('-'.repeat(44))
const ok = rows.filter((r) => r.status === 'OK').length
console.log(`覆盖率 ${ok}/${ATOMS.length} OK · PARTIAL=${partials}`)

if (STRICT && partials > 0) {
  const bad = rows.filter((r) => r.status === 'PARTIAL').map((r) => r.atom)
  console.error(`[strict] 以下原子 spec 已存在但消费不全: ${bad.join(', ')}`)
  process.exit(1)
}
