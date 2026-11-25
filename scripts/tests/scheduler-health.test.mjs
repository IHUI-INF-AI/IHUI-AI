// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 调度健康判据的回归网(2026-11-25 立)。
 *
 * 钉住的是四类真实失效的边界,尤其是两处最容易判错的地方:
 *   ① 「有意停用」必须先于返回码检查 —— 否则按计划停掉的任务会被旧返回码反复点成故障;
 *   ② 「尚未运行」必须分开机型与周期型 —— 开机型开机早于注册属正常,周期型超两个间隔才是问题。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  classifyTask,
  judgeSchedulerHealth,
  remediationForScheduler,
  SCHEDULER_STATE,
  STALE_FACTOR,
} from '../security/lib/scheduler-health.mjs'

const NOW = Date.parse('2026-11-25T19:00:00+08:00')
const HOUR = 3600_000
const MIN = 60_000

function t(over) {
  return {
    name: 'X',
    lastResult: 0,
    lastRun: new Date(NOW - 5 * MIN).toISOString(),
    status: 'Ready',
    trigger: 'TimeTrigger',
    intervalMin: 10,
    registeredAt: new Date(NOW - 24 * HOUR).toISOString(),
    bootAt: NOW - 72 * HOUR,
    ...over,
  }
}

test('返回码 0 且新鲜 ⇒ ok', () => {
  const r = classifyTask(t({}), { now: NOW })
  assert.equal(r.verdict, 'ok')
})

test('返回码 1 ⇒ breach', () => {
  const r = classifyTask(t({ lastResult: 1 }), { now: NOW })
  assert.equal(r.verdict, 'breach')
  assert.match(r.reason, /Last Result=1/)
})

test('负数退出码 0xC000013A ⇒ breach', () => {
  const r = classifyTask(t({ lastResult: -1073741510 }), { now: NOW })
  assert.equal(r.verdict, 'breach')
})

test('开机型 + 尚未运行 + 开机早于注册 ⇒ ok(等下次开机)', () => {
  const r = classifyTask(
    t({
      lastResult: 267011,
      lastRun: '1999-11-30T00:00:00+08:00',
      trigger: 'BootTrigger',
      bootAt: NOW - 72 * HOUR,
      registeredAt: NOW - 8 * HOUR,
    }),
    { now: NOW },
  )
  assert.equal(r.verdict, 'ok')
  assert.match(r.reason, /开机早于注册/)
})

test('开机型 + 尚未运行 + 开机晚于注册 ⇒ breach(触发没生效)', () => {
  const r = classifyTask(
    t({
      lastResult: 267011,
      lastRun: '1999-11-30T00:00:00+08:00',
      trigger: 'BootTrigger',
      bootAt: NOW - 1 * HOUR,
      registeredAt: NOW - 8 * HOUR,
    }),
    { now: NOW },
  )
  assert.equal(r.verdict, 'breach')
  assert.match(r.reason, /开机触发未生效/)
})

test('周期型 + 尚未运行 + 注册已超两个间隔 ⇒ breach', () => {
  const r = classifyTask(
    t({
      lastResult: 267011,
      lastRun: '1999-11-30T00:00:00+08:00',
      trigger: 'TimeTrigger',
      intervalMin: 10,
      registeredAt: new Date(NOW - 40 * MIN).toISOString(),
    }),
    { now: NOW },
  )
  assert.equal(r.verdict, 'breach')
  assert.match(r.reason, /仍未运行/)
})

test('周期型 + 尚未运行 + 注册未超两个间隔 ⇒ ok(尚未到首轮)', () => {
  const r = classifyTask(
    t({
      lastResult: 267011,
      lastRun: '1999-11-30T00:00:00+08:00',
      trigger: 'TimeTrigger',
      intervalMin: 10,
      registeredAt: new Date(NOW - 12 * MIN).toISOString(),
    }),
    { now: NOW },
  )
  assert.equal(r.verdict, 'ok')
})

test('有意停用 + 旧失败码 ⇒ ok(停用检查必须排在返回码之前)', () => {
  const r = classifyTask(
    t({ lastResult: 1, status: 'Disabled', disabledIntent: true }),
    { now: NOW },
  )
  assert.equal(r.verdict, 'ok')
  assert.match(r.reason, /有意停用/)
})

test('被禁用但未登记 ⇒ warn(不静默放过)', () => {
  const r = classifyTask(t({ status: 'Disabled', disabledIntent: false }), { now: NOW })
  assert.equal(r.verdict, 'warn')
})

test('过期:距上次运行超 2.5 个间隔 ⇒ breach', () => {
  const r = classifyTask(
    t({ intervalMin: 10, lastRun: new Date(NOW - 30 * MIN).toISOString() }),
    { now: NOW },
  )
  assert.equal(r.verdict, 'breach')
  assert.match(r.reason, /已过期/)
})

test('未过期:距上次运行在 2.5 个间隔内 ⇒ ok', () => {
  const r = classifyTask(
    t({ intervalMin: 10, lastRun: new Date(NOW - 20 * MIN).toISOString() }),
    { now: NOW },
  )
  assert.equal(r.verdict, 'ok')
})

test('取不到 Last Result ⇒ undetermined,不冒绿', () => {
  const r = classifyTask({ name: 'X', lastResult: null }, { now: NOW })
  assert.equal(r.verdict, 'undetermined')
})

test('汇总:有 breach ⇒ 整体 breach 并点名', () => {
  const r = judgeSchedulerHealth([t({ name: 'A' }), t({ name: 'B', lastResult: 1 })], { now: NOW })
  assert.equal(r.state, SCHEDULER_STATE.BREACH)
  assert.deepEqual(r.breaches, ['B'])
  assert.equal(r.total, 2)
})

test('汇总:全 ok ⇒ ok', () => {
  const r = judgeSchedulerHealth([t({ name: 'A' }), t({ name: 'B' })], { now: NOW })
  assert.equal(r.state, SCHEDULER_STATE.OK)
  assert.match(r.reason, /2 条任务全部健康/)
})

test('汇总:无 breach 但有 undetermined ⇒ undetermined', () => {
  const r = judgeSchedulerHealth([t({ name: 'A' }), { name: 'B' }], { now: NOW })
  assert.equal(r.state, SCHEDULER_STATE.UNDETERMINED)
})

test('STALE_FACTOR 是 2.5,不是 2 或 3', () => {
  assert.equal(STALE_FACTOR, 2.5)
})

test('每条 breach 都有可执行的下一步', () => {
  const r = judgeSchedulerHealth([t({ name: 'A', lastResult: 1 })], { now: NOW })
  const steps = remediationForScheduler(r)
  assert.equal(steps.length, 1)
  assert.match(steps[0], /schtasks \/run \/tn "\\A"/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
