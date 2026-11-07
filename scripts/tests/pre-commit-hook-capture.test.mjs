// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'

/**
 * 「守门批输出过大不许假红」的自检(2026-11-05 立)。
 *
 * 病灶:pre-commit 钩子的 runCapturing 用 execSync 默认 maxBuffer(1MB);宽暂存集
 * (合并/大批量)输出超 1MB ⇒ 抛 ENOBUFS ⇒ 钩子把它当「门失败」阻断提交(假红)。
 * 这正是 §0.3 的反面:未判定/装不下 ≠ 门失败。
 *
 * 三格:
 *   T1 阳性对照 —— 不带 maxBuffer 的同参数 execSync 跑 2MB 输出必须 ENOBUFS(尺子有牙);
 *   T2 生产实现 —— runCapturing 同条件必须 ok:true 且完整拿到 2MB;
 *   T3 环境变量 —— 显式设小(maxBuffer=1024)仍必须 ok:false(证明刻度真接线,不是空参)。
 */

const require = createRequire(import.meta.url)
const { runCapturing, captureMaxBuffer, DEFAULT_MAX_BUFFER } = require('../lib/hook-capture.js')

/** 静音本进程 stdout 执行,避免把 2MB 夹具灌进测试日志(不影响被测函数的捕获)。 */
function quiet(fn) {
  const orig = process.stdout.write
  process.stdout.write = () => true
  try {
    return fn()
  } finally {
    process.stdout.write = orig
  }
}

const BIG_BYTES = 2 * 1024 * 1024
const BIG_CMD = `"${process.execPath}" -e "process.stdout.write('x'.repeat(${BIG_BYTES}))"`
const EXEC_OPTS = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }

test('T1 阳性对照:默认 1MB maxBuffer 跑 2MB 输出必抛 ENOBUFS', () => {
  try {
    execSync(BIG_CMD, EXEC_OPTS)
    assert.fail('默认 maxBuffer 未被触发 ⇒ 本测试无牙(输出规模不够或环境异常)')
  } catch (e) {
    assert.equal(e.code, 'ENOBUFS', `期望 ENOBUFS,实得 code=${e.code};message=${e.message}`)
  }
})

test('T2 runCapturing 捕获 2MB 输出不假红', () => {
  const r = quiet(() => runCapturing('自检:2MB 输出', BIG_CMD, 60_000))
  assert.equal(r.ok, true, '大输出被误判成门失败(假红)')
  assert.equal(r.output.length, BIG_BYTES, `输出被截断:实得 ${r.output.length} 字节`)
})

test('T3 HUSKY_GATE_MAX_BUFFER_BYTES 真接线:调到 1024 时同命令必须 ok:false', () => {
  const prev = process.env.HUSKY_GATE_MAX_BUFFER_BYTES
  process.env.HUSKY_GATE_MAX_BUFFER_BYTES = '1024'
  try {
    assert.equal(captureMaxBuffer(), 1024)
    const r = quiet(() => runCapturing('自检:过小上限', BIG_CMD, 60_000))
    assert.equal(r.ok, false, '上限调到 1024 仍成功 ⇒ 参数没接线')
  } finally {
    if (prev === undefined) delete process.env.HUSKY_GATE_MAX_BUFFER_BYTES
    else process.env.HUSKY_GATE_MAX_BUFFER_BYTES = prev
  }
})

test('T4 默认上限落在 face-reader 同量级(64MB),非法环境值回落默认', () => {
  assert.equal(DEFAULT_MAX_BUFFER, 64 << 20)
  const prev = process.env.HUSKY_GATE_MAX_BUFFER_BYTES
  process.env.HUSKY_GATE_MAX_BUFFER_BYTES = 'not-a-number'
  try {
    assert.equal(captureMaxBuffer(), DEFAULT_MAX_BUFFER)
  } finally {
    if (prev === undefined) delete process.env.HUSKY_GATE_MAX_BUFFER_BYTES
    else process.env.HUSKY_GATE_MAX_BUFFER_BYTES = prev
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
