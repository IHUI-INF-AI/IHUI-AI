// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码)───
const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-absorption-read-naming.mjs')
const MATRIX_PATH = join(__dirname, '..', 'zcode-absorption-matrix.mjs')
const { evaluate } = (await import(pathToFileURL(SCRIPT_PATH).href)).__test__

const ROWS = [
  { path: 'a', read: 10, verifiedRead: 6 },
  { path: 'b', read: 9, verifiedRead: 9 },
]
// 构造射程与构造 rows 对齐,把 AN4(射程判死)排除在外 —— 本组只钉 AN3/透传这两颗牙。
const SIX = ['a', 'b']

// ═══════════════════════════════════════════════════════════
// AN3 —— 全量具名声明的等值维:判据在 matrix 的 M13,本器只问它在不在位
// ═══════════════════════════════════════════════════════════

test('AN3 有牙:有全量具名声明而 M13 尺子不在位 ⇒ 落未判定(不冒红也不记绿)', () => {
  const r = evaluate({ rows: ROWS, matrixErrors: [], stringFormSlices: 2, m13Present: false, sixRegions: SIX })
  assert.equal(r.undetermined.length, 1)
  assert.match(r.undetermined[0], /^AN3/)
  assert.match(r.undetermined[0], /未判定/)
  assert.equal(r.violations.length, 0, '未判定不得冒充红')
})

test('AN3 收窄:M13 尺子在位 ⇒ 同一面不再落未判定(等值由 matrix 判,本器透传)', () => {
  const r = evaluate({ rows: ROWS, matrixErrors: [], stringFormSlices: 2, m13Present: true, sixRegions: SIX })
  assert.equal(r.undetermined.length, 0)
  assert.equal(r.violations.length, 0)
})

test('AN3 不虚构:没有全量具名声明时不落未判定(向后兼容)', () => {
  const r = evaluate({ rows: ROWS, matrixErrors: [], stringFormSlices: 0, m13Present: false, sixRegions: SIX })
  assert.equal(r.undetermined.length, 0)
})

// ═══════════════════════════════════════════════════════════
// 透传 —— matrix 的 M13 红按 "M13 " 前缀原样透传成检查器的红(本器不重算)
// ═══════════════════════════════════════════════════════════

test('透传有牙:matrix 的 M13 错必须进本器 violations,不得静默丢弃', () => {
  const m13err = 'M13 切片 a 的 read=10 ≠ readFiles 去重后的 2 个(具名清单是唯一计数来源,数字必须由清单算出)'
  const r = evaluate({ rows: ROWS, matrixErrors: [m13err], stringFormSlices: 1, m13Present: true, sixRegions: SIX })
  assert.deepEqual(r.delegatedRed, [m13err])
  assert.ok(r.violations.some((v) => v.startsWith('透传') && v.includes('M13')))
})

// ═══════════════════════════════════════════════════════════
// 源码契约与脚本自检
// ═══════════════════════════════════════════════════════════

test('源码契约:matrix 面上 M13 + namedReadOf 同时在位 ⇒ 粗筛必须答"在位"', () => {
  const matrixSrc = readFileSync(MATRIX_PATH, 'utf8')
  const checkerSrc = readFileSync(SCRIPT_PATH, 'utf8')
  // 粗筛的实现口径:M13 字样 + namedReadOf 函数名,两样同时在位才算"在位"
  assert.match(checkerSrc, /namedReadOf/)
  assert.ok(/\bM13\b/.test(matrixSrc) && matrixSrc.includes('namedReadOf'), '判据本体必须在 matrix 面上,否则 AN3 的未判定收不窄')
})

test('检查器 --self-test 全绿(rc=0)', () => {
  const r = spawnSync(process.execPath, [SCRIPT_PATH, '--self-test'], {
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `自检应全绿:\n${r.stdout}`)
  assert.match(r.stdout, /自检 12\/12 通过/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
