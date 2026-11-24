// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { judgeFailover } from '../lib/failover-circuit.mjs'

/** 调用方现给的窗口和阈值，库内不带默认数字。 */
function input(over) {
  return {
    schemaVersion: 1,
    origin: 'https://origin.example',
    trustedOrigins: ['https://origin.example'],
    nowMs: 5_000_000,
    failureWindowMs: 1_000,
    infraFailureThreshold: 2,
    openDurationMs: 500,
    failedProbeBackoffMs: [0, 1_000, 2_000],
    failures: [],
    lastOpenedAt: null,
    ...over,
  }
}

test('失败次数没量到不得判闭合', () => {
  const missing = input()
  delete missing.failures
  const samples = [null, undefined, 'none', [Number.NaN], [Number.POSITIVE_INFINITY]]
  for (const failures of samples) {
    const verdict = judgeFailover(input({ failures }))
    assert.equal(verdict.disposition, 'unjudged')
    assert.equal(verdict.reason, 'failures-unmeasured')
    assert.notEqual(verdict.disposition, 'closed')
  }
  const omitted = judgeFailover(missing)
  assert.equal(omitted.disposition, 'unjudged')
  assert.equal(omitted.reason, 'failures-unmeasured')
})

test('窗口内达到阈值则打开', () => {
  const nowMs = 5_000_000
  const failureWindowMs = 1_000
  const infraFailureThreshold = 2
  const onEdge = nowMs - failureWindowMs
  assert.deepEqual(
    judgeFailover(
      input({
        nowMs,
        failureWindowMs,
        infraFailureThreshold,
        failures: [onEdge, nowMs],
        lastOpenedAt: null,
      }),
    ),
    { disposition: 'open', reason: 'failure-threshold' },
  )
  // 过窗的一次和未来的一次都不计入，界内只剩一次，低于调用方阈值。
  assert.deepEqual(
    judgeFailover(
      input({
        nowMs,
        failureWindowMs,
        infraFailureThreshold,
        failures: [onEdge, nowMs - failureWindowMs - 1, nowMs + 1],
        lastOpenedAt: null,
      }),
    ),
    { disposition: 'closed', reason: 'within-bounds' },
  )
})

test('不在受信源里拒绝', () => {
  assert.deepEqual(judgeFailover(input({ origin: 'https://elsewhere.example' })), {
    disposition: 'refused',
    reason: 'origin-untrusted',
  })
  assert.deepEqual(judgeFailover(input({ trustedOrigins: [], origin: 'https://origin.example' })), {
    disposition: 'refused',
    reason: 'origin-untrusted',
  })
  assert.equal(judgeFailover(input({ origin: '' })).reason, 'origin-untrusted')
  assert.equal(judgeFailover(input({ trustedOrigins: null })).reason, 'origins-unmeasured')
})

test('退避数组不是 3 个则未判定', () => {
  assert.deepEqual(judgeFailover(input({ failedProbeBackoffMs: [1_000, 2_000] })), {
    disposition: 'unjudged',
    reason: 'backoff-unmeasured',
  })
  assert.equal(
    judgeFailover(input({ failedProbeBackoffMs: [1_000, 2_000, 4_000, 8_000] })).reason,
    'backoff-unmeasured',
  )
  assert.equal(
    judgeFailover(input({ failedProbeBackoffMs: [1_000, -1, 4_000] })).reason,
    'backoff-unmeasured',
  )
  assert.equal(
    judgeFailover(input({ failedProbeBackoffMs: [0, 0, 0], failures: [], lastOpenedAt: null }))
      .reason,
    'within-bounds',
  )
})

test('打开时长未结束则保持打开，没有打开记录可以闭合', () => {
  const nowMs = 10_000
  const openDurationMs = 500
  assert.equal(
    judgeFailover(
      input({
        nowMs,
        openDurationMs,
        failures: [],
        lastOpenedAt: nowMs - openDurationMs + 1,
      }),
    ).reason,
    'open-duration',
  )
  assert.equal(
    judgeFailover(
      input({
        nowMs,
        openDurationMs,
        failures: [],
        lastOpenedAt: nowMs - openDurationMs,
      }),
    ).reason,
    'within-bounds',
  )
  assert.deepEqual(judgeFailover(input({ failures: [], lastOpenedAt: null })), {
    disposition: 'closed',
    reason: 'within-bounds',
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
