// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  FUTURE_TOLERANCE_MS,
  STALE_AFTER_MS,
  judgeServiceClaim,
} from '../lib/service-claim.mjs'

const NOW = 1_700_000_000_000

function record(overrides = {}) {
  return {
    id: 'api',
    port: 8810,
    pid: 4242,
    timestamp: NOW,
    ...overrides,
  }
}

test('窗口常量', () => {
  assert.equal(STALE_AFTER_MS, 30000)
  assert.equal(FUTURE_TOLERANCE_MS, 5000)
})

test('缺 port 是记录未量到，不当成陈旧', () => {
  const claim = record()
  delete claim.port
  assert.deepEqual(judgeServiceClaim({ record: claim, nowMs: NOW, alive: true }), {
    disposition: 'unjudged',
    reason: 'record-unmeasured',
  })
})

test('时刻超前超过 5 秒是时间倒挂', () => {
  assert.deepEqual(
    judgeServiceClaim({
      record: record({ timestamp: NOW + 5000 + 1 }),
      nowMs: NOW,
      alive: true,
    }),
    { disposition: 'unjudged', reason: 'time-inverted' },
  )
})

test('超过 30 秒即使存活动词为真也是心跳陈旧', () => {
  assert.deepEqual(
    judgeServiceClaim({
      record: record({ timestamp: NOW - 30000 - 1 }),
      nowMs: NOW,
      alive: true,
    }),
    { disposition: 'stale', reason: 'heartbeat-stale' },
  )
})

test('时刻新鲜但存活动词为 null 是未量到', () => {
  assert.deepEqual(judgeServiceClaim({ record: record(), nowMs: NOW, alive: null }), {
    disposition: 'unjudged',
    reason: 'liveness-unmeasured',
  })
})

test('时刻新鲜且存活动词为真是在册', () => {
  assert.deepEqual(judgeServiceClaim({ record: record(), nowMs: NOW, alive: true }), {
    disposition: 'live',
    reason: 'heartbeat-fresh',
  })
})

test('恰好超前 5 秒且存活动词为真仍是在册', () => {
  assert.deepEqual(
    judgeServiceClaim({
      record: record({ timestamp: NOW + FUTURE_TOLERANCE_MS }),
      nowMs: NOW,
      alive: true,
    }),
    { disposition: 'live', reason: 'heartbeat-fresh' },
  )
})

test('恰好落后 30 秒且存活动词为真仍是在册', () => {
  assert.deepEqual(
    judgeServiceClaim({
      record: record({ timestamp: NOW - STALE_AFTER_MS }),
      nowMs: NOW,
      alive: true,
    }),
    { disposition: 'live', reason: 'heartbeat-fresh' },
  )
})

test('时刻新鲜且存活动词为假是进程已死', () => {
  assert.deepEqual(judgeServiceClaim({ record: record(), nowMs: NOW, alive: false }), {
    disposition: 'dead',
    reason: 'process-dead',
  })
})

test('当前时刻不是有限数字', () => {
  assert.deepEqual(judgeServiceClaim({ record: record(), nowMs: Number.NaN, alive: true }), {
    disposition: 'unjudged',
    reason: 'time-unmeasured',
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
