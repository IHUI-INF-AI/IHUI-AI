// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ensure-silent-tasks.mjs ④ worktree 回收链路审计的构造面证明。
// 回收器静默失效 = 没有回收器:任务缺失、台账缺失、台账超时三态都必须在 --check 里响亮报红,
// 且不得把「取不到读数」当健康。纯函数喂夹具,不跑真 schtasks。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { judgeWorktreeReapHealth } from '../ensure-silent-tasks.mjs'

const NOW = 1_700_000_000_000
const TASK = 'IHUI-Worktree-Reap'

test('任务在册 + 台账新鲜 ⇒ 健康', () => {
  const r = judgeWorktreeReapHealth({
    taskNames: [`\\${TASK}`],
    logMtimeMs: NOW - 5 * 60_000,
    now: NOW,
  })
  assert.equal(r.ok, true)
  assert.equal(r.present, true)
  assert.equal(r.reason, '')
  assert.equal(r.ageMs, 5 * 60_000)
})

test('任务缺失 ⇒ 判红并点名任务', () => {
  const r = judgeWorktreeReapHealth({ taskNames: ['\\IHUI-DevStack'], logMtimeMs: NOW, now: NOW })
  assert.equal(r.ok, false)
  assert.equal(r.present, false)
  assert.match(r.reason, new RegExp(TASK))
  assert.match(r.reason, /不存在/)
})

test('任务在册但台账缺失 ⇒ 判红(不冒充健康)', () => {
  const r = judgeWorktreeReapHealth({ taskNames: [TASK], logMtimeMs: null, now: NOW })
  assert.equal(r.ok, false)
  assert.equal(r.present, true)
  assert.equal(r.ageMs, null)
  assert.match(r.reason, /缺失/)
})

test('台账超过 30 分钟未更新 ⇒ 判红并报实际分钟数', () => {
  const r = judgeWorktreeReapHealth({ taskNames: [TASK], logMtimeMs: NOW - 95 * 60_000, now: NOW })
  assert.equal(r.ok, false)
  assert.equal(r.ageMs, 95 * 60_000)
  assert.match(r.reason, /95 分钟/)
  assert.match(r.reason, /卡死/)
})

test('台账时间戳取不到(0/NaN)按缺失算,绝不当新鲜', () => {
  for (const bad of [0, NaN, undefined]) {
    const r = judgeWorktreeReapHealth({ taskNames: [TASK], logMtimeMs: bad, now: NOW })
    assert.equal(r.ok, false, `logMtimeMs=${String(bad)} 不得判健康`)
    assert.equal(r.ageMs, null)
  }
})

test('TaskPath 带前缀时按叶子名判在册', () => {
  const r = judgeWorktreeReapHealth({
    taskNames: ['\\IHUI\\IHUI-Worktree-Reap'],
    logMtimeMs: NOW - 60_000,
    now: NOW,
  })
  assert.equal(r.present, true)
  assert.equal(r.ok, true)
})

test('maxAgeMs 可显式收紧(边界:恰好等于阈值仍算健康)', () => {
  const r = judgeWorktreeReapHealth({ taskNames: [TASK], logMtimeMs: NOW - 60_000, now: NOW, maxAgeMs: 60_000 })
  assert.equal(r.ok, true)
  const over = judgeWorktreeReapHealth({ taskNames: [TASK], logMtimeMs: NOW - 60_001, now: NOW, maxAgeMs: 60_000 })
  assert.equal(over.ok, false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
