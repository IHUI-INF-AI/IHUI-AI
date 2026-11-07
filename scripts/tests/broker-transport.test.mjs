// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  BROKER_ASYNC_CAP,
  BROKER_CONCURRENCY,
  BROKER_PRIORITIES,
  BROKER_QUEUE_CAP,
  BROKER_TIMEOUT_MS,
  admitBrokerSlot,
  judgeBrokerTimeout,
} from '../lib/broker-transport.mjs'

function slot(over) {
  return {
    kind: 'sync',
    priority: 'normal',
    inflightSync: 0,
    inflightAsync: 0,
    queued: 0,
    ...over,
  }
}

test('kind 缺失时未判定且不得放行', () => {
  const input = slot()
  delete input.kind
  const verdict = admitBrokerSlot(input)
  assert.deepEqual(verdict, { disposition: 'unjudged', reason: 'kind-unmeasured', admit: false })
  assert.notEqual(verdict.disposition, 'admitted')
  assert.equal(verdict.admit, false)
})

test('priority 不在三档时未判定且不得放行', () => {
  const verdict = admitBrokerSlot(slot({ priority: 'urgent' }))
  assert.deepEqual(verdict, {
    disposition: 'unjudged',
    reason: 'priority-unmeasured',
    admit: false,
  })
  assert.notEqual(verdict.disposition, 'admitted')
  assert.equal(verdict.admit, false)
})

test('计数为 null 时未判定且不得放行', () => {
  for (const key of ['inflightSync', 'inflightAsync', 'queued']) {
    const verdict = admitBrokerSlot(slot({ [key]: null }))
    assert.deepEqual(verdict, {
      disposition: 'unjudged',
      reason: 'count-unmeasured',
      admit: false,
    })
    assert.notEqual(verdict.disposition, 'admitted')
    assert.equal(verdict.admit, false)
  }
})

test('异步 127 且同步 0：异步拒绝，同步仍放行', () => {
  assert.equal(BROKER_ASYNC_CAP, 127)
  assert.equal(BROKER_CONCURRENCY, 128)
  const counts = { inflightSync: 0, inflightAsync: 127, queued: 0 }
  assert.ok(counts.inflightSync + counts.inflightAsync < BROKER_CONCURRENCY)
  assert.deepEqual(admitBrokerSlot(slot({ kind: 'async', ...counts })), {
    disposition: 'refused',
    reason: 'async-cap',
    admit: false,
  })
  assert.deepEqual(admitBrokerSlot(slot({ kind: 'sync', ...counts })), {
    disposition: 'admitted',
    reason: 'slot-free',
    admit: true,
  })
})

test('总数已经 128 时同步请求拒绝', () => {
  const inflightSync = 1
  const inflightAsync = 127
  assert.equal(inflightSync + inflightAsync, BROKER_CONCURRENCY)
  assert.deepEqual(admitBrokerSlot(slot({ kind: 'sync', inflightSync, inflightAsync, queued: 0 })), {
    disposition: 'refused',
    reason: 'concurrency-full',
    admit: false,
  })
})

test('排队达到 8192 时拒绝', () => {
  assert.equal(BROKER_QUEUE_CAP, 8192)
  assert.deepEqual(admitBrokerSlot(slot({ queued: 8192 })), {
    disposition: 'refused',
    reason: 'queue-full',
    admit: false,
  })
})

test('排队 8191 且空闲时放行', () => {
  assert.deepEqual(admitBrokerSlot(slot({ queued: 8191 })), {
    disposition: 'admitted',
    reason: 'slot-free',
    admit: true,
  })
})

test('超时边界：19999 以内、20000 到期、负数与 NaN 未判定', () => {
  assert.equal(BROKER_TIMEOUT_MS, 20000)
  assert.deepEqual(judgeBrokerTimeout(19999), { disposition: 'within', reason: 'before-timeout' })
  assert.deepEqual(judgeBrokerTimeout(20000), { disposition: 'expired', reason: 'timeout' })
  assert.deepEqual(judgeBrokerTimeout(-1), { disposition: 'unjudged', reason: 'time-inverted' })
  assert.deepEqual(judgeBrokerTimeout(Number.NaN), {
    disposition: 'unjudged',
    reason: 'time-unmeasured',
  })
})

test('三档优先级在其余合法时都放行且结果相同', () => {
  assert.deepEqual([...BROKER_PRIORITIES], ['low', 'normal', 'high'])
  const verdicts = BROKER_PRIORITIES.map((priority) => admitBrokerSlot(slot({ priority })))
  const expected = { disposition: 'admitted', reason: 'slot-free', admit: true }
  for (const verdict of verdicts) {
    assert.deepEqual(verdict, expected)
  }
  assert.deepEqual(verdicts[0], verdicts[1])
  assert.deepEqual(verdicts[1], verdicts[2])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
