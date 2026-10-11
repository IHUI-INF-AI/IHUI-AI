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
const SCRIPT_PATH = join(__dirname, '..', 'zcode-absorption-matrix.mjs')
const { decide } = await import(pathToFileURL(SCRIPT_PATH).href)

// ─── 构造面:与 matrix 自检的 M12/M13 那组同构,判据边界由构造面自己给出 ───
const FACE = {
  files: ['packages/a/src/x.ts', 'packages/a/src/y.ts'],
  lineCounts: { 'packages/a/src/x.ts': 10, 'packages/a/src/y.ts': 20 },
}
const mk = (readFiles, read, status = 'deep') =>
  decide({
    ...FACE,
    registry: {
      slices: [
        { path: 'packages/a/src', status, read, evidence: ['packages/a/src/x.ts:1-3'], verified: 'self', readFiles },
      ],
    },
  })

// ═══════════════════════════════════════════════════════════
// M13 / namedReadOf —— 全量具名声明(readFiles 全字符串)的等值维
// ═══════════════════════════════════════════════════════════

test('M13 正向:read 等于全字符串清单去重长度 ⇒ 不红且 namedRead=2、三态读数命中 0', () => {
  const r = mk(['packages/a/src/x.ts', 'packages/a/src/y.ts'], 2)
  assert.equal(r.ok, true)
  assert.equal(r.rows[0].namedRead, 2)
  assert.deepEqual(r.m13, { scope: 1, red: 0, pass: 1 })
})

test('M13 有牙:read≠清单去重长度必须红并点名(具名清单是唯一计数来源)', () => {
  const r = mk(['packages/a/src/x.ts', 'packages/a/src/y.ts'], 3)
  assert.equal(r.ok, false)
  assert.equal(r.m13.red, 1, '三态读数的命中档必须记 1,不得折 0')
  const m13 = r.errors.find((e) => e.startsWith('M13'))
  assert.ok(m13, '必须有一条 M13 前缀的错(检查器按 "M13 " 前缀透传)')
  assert.match(m13, /去重后的 2 个/)
  assert.match(m13, /数字必须由清单算出/)
})

test('M13 自报数高于清单的差额必须显形,不得吞成已证', () => {
  const r = mk(['packages/a/src/x.ts', 'packages/a/src/y.ts'], 9)
  assert.equal(r.rows[0].read, 9)
  assert.equal(r.rows[0].namedRead, 2)
  assert.equal(r.m13.red, 1)
})

test('M13 去重长度按 Set 计:重复路径折掉,重复本身归 M12 红(两把尺子不混)', () => {
  const r = mk(['packages/a/src/x.ts', 'packages/a/src/x.ts'], 1)
  assert.equal(r.rows[0].namedRead, 1)
  assert.equal(r.m13.red, 0, 'read=1=去重长度 ⇒ M13 不红')
  assert.ok(r.errors.some((e) => e.includes('重复计入')), '重复计入由 M12 钉')
})

test('M13 射程:对象形态清单不在射程(scope=0),兑现性归 M12,不冒 M13 红', () => {
  const r = mk([{ p: 'packages/a/src/x.ts', lines: 10 }, { p: 'packages/a/src/y.ts', lines: 20 }], 1, 'windowed')
  assert.equal(r.ok, true)
  assert.equal(r.rows[0].namedRead, null)
  assert.equal(r.m13.scope, 0)
  assert.ok(!r.errors.some((e) => e.startsWith('M13')))
})

test('M13 射程:无清单的 legacy 自报不在射程,不虚构等值判定', () => {
  const r = mk(undefined, 2)
  assert.equal(r.ok, true)
  assert.equal(r.rows[0].namedRead, null)
  assert.deepEqual(r.m13, { scope: 0, red: 0, pass: 0 })
})

test('M13 三态读数必须量得出:命中/放过/未判定三档在结果里可问', () => {
  const hit = mk(['packages/a/src/x.ts', 'packages/a/src/y.ts'], 5)
  assert.equal(hit.m13.red, 1, '命中 1')
  const pass = mk(['packages/a/src/x.ts', 'packages/a/src/y.ts'], 2)
  assert.equal(pass.m13.pass, 1, '放过 1')
  // 未判定恒为 0:射程内 M13 是全函数;判不出的情形(取材失败/M13 不在位)
  // 由 check-absorption-read-naming 的 AN3 负责,这里不越权代管(口径见两器分工头注)。
  assert.equal(pass.m13.scope, pass.m13.red + pass.m13.pass)
})

// ═══════════════════════════════════════════════════════════
// 脚本自检与源码契约
// ═══════════════════════════════════════════════════════════

test('matrix --self-test 全绿(rc=0)', () => {
  const r = spawnSync(process.execPath, [SCRIPT_PATH, '--self-test'], {
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
    // 返回值被消费 ⇒ stdout 仍须 pipe,只把 stdin 切掉(否则本机报 spawnSync EBUSY)
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `自检应全绿:\n${r.stdout}`)
  assert.match(r.stdout, /自检 \d+\/\d+ 通过/)
})

test('源码契约:判据本体在位(M13 字样 + namedReadOf 函数),检查器粗筛才有射程', () => {
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  assert.match(src, /\bM13\b/)
  assert.ok(src.includes('namedReadOf'), 'namedReadOf 判据函数必须在 matrix 面上')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
