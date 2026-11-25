// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 入口存活判据的回归网(2026-11-25 立)。
 *
 * 钉住的核心分歧点: **4xx 是活着,5xx 才是死**。
 * 这条如果反了,每一次正常限流/404 都会被当成全站宕机而重启生产。
 * 另两条同样容易写错: 连续失败计数的重置,以及「一次抖动不重启」的阈值。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  judgeProbe,
  judgeLiveness,
  healActions,
  remediationForLiveness,
  LIVENESS_STATE,
  HEAL_THRESHOLD,
  DEAD_ERRORS,
} from '../security/lib/endpoint-liveness.mjs'

test('HTTP 200 ⇒ alive', () => {
  const r = judgeProbe({ name: 'a', url: 'u', status: 200 })
  assert.equal(r.verdict, 'alive')
})

test('HTTP 404 ⇒ alive(服务在正常工作)', () => {
  assert.equal(judgeProbe({ name: 'a', url: 'u', status: 404 }).verdict, 'alive')
})

test('HTTP 403 ⇒ alive(限流/拦截都说明还活着)', () => {
  assert.equal(judgeProbe({ name: 'a', url: 'u', status: 403 }).verdict, 'alive')
})

test('HTTP 500 ⇒ dead(服务端自己崩了)', () => {
  const r = judgeProbe({ name: 'a', url: 'u', status: 500 })
  assert.equal(r.verdict, 'dead')
  assert.match(r.reason, /服务端错误/)
})

test('HTTP 503 ⇒ dead', () => {
  assert.equal(judgeProbe({ name: 'a', url: 'u', status: 503 }).verdict, 'dead')
})

test('ECONNREFUSED ⇒ dead', () => {
  const r = judgeProbe({ name: 'a', url: 'u', status: null, error: 'ECONNREFUSED' })
  assert.equal(r.verdict, 'dead')
  assert.match(r.reason, /ECONNREFUSED/)
})

test('ETIMEDOUT ⇒ dead(超时按死判,不按未判定放过)', () => {
  assert.equal(judgeProbe({ name: 'a', url: 'u', status: null, error: 'ETIMEDOUT' }).verdict, 'dead')
})

test('ECONNRESET ⇒ dead', () => {
  assert.equal(judgeProbe({ name: 'a', url: 'u', status: null, error: 'ECONNRESET' }).verdict, 'dead')
})

test('不认识的错误 ⇒ undetermined(不冒死也不冒活)', () => {
  const r = judgeProbe({ name: 'a', url: 'u', status: null, error: 'SOMETHING_WEIRD happened' })
  assert.equal(r.verdict, 'undetermined')
})

test('既无状态码也无错误 ⇒ undetermined', () => {
  assert.equal(judgeProbe({ name: 'a', url: 'u' }).verdict, 'undetermined')
})

test('expectStatus=200 但实际 404 ⇒ undetermined(连接通但不符合期望)', () => {
  const r = judgeProbe({ name: 'a', url: 'u', status: 404, expectStatus: 200 })
  assert.equal(r.verdict, 'undetermined')
  assert.match(r.reason, /期望 200 不符/)
})

test('expectStatus=200 且实际 200 ⇒ alive', () => {
  assert.equal(judgeProbe({ name: 'a', url: 'u', status: 200, expectStatus: 200 }).verdict, 'alive')
})

test('汇总:全应答 ⇒ ok,连续失败清零', () => {
  const r = judgeLiveness([{ name: 'a', status: 200 }, { name: 'b', status: 404 }], { prevConsecutiveFail: 5 })
  assert.equal(r.state, LIVENESS_STATE.OK)
  assert.equal(r.consecutiveFail, 0)
})

test('汇总:有 dead ⇒ breach,连续计数累加', () => {
  const r = judgeLiveness([{ name: 'a', status: 200 }, { name: 'b', status: null, error: 'ECONNREFUSED' }], { prevConsecutiveFail: 1 })
  assert.equal(r.state, LIVENESS_STATE.BREACH)
  assert.deepEqual(r.dead, ['b'])
  assert.equal(r.consecutiveFail, 2)
})

test('汇总:无 dead 但有 undetermined ⇒ undetermined,且计数不累加', () => {
  const r = judgeLiveness([{ name: 'a', status: 200 }, { name: 'b', status: null, error: 'WEIRD' }], { prevConsecutiveFail: 3 })
  assert.equal(r.state, LIVENESS_STATE.UNDETERMINED)
  assert.equal(r.consecutiveFail, 0)
})

test('自愈阈值默认 2,不是 1', () => {
  assert.equal(HEAL_THRESHOLD, 2)
})

test('连续失败 1 次 ⇒ 不动服务(一次抖动不重启生产)', () => {
  const r = judgeLiveness([{ name: 'web-home', status: null, error: 'ECONNREFUSED' }], { prevConsecutiveFail: 0 })
  assert.equal(r.consecutiveFail, 1)
  assert.deepEqual(healActions(r), [])
})

test('连续失败 2 次 ⇒ 才给出重启动作', () => {
  const r = judgeLiveness([{ name: 'web-home', status: null, error: 'ECONNREFUSED' }], { prevConsecutiveFail: 1 })
  assert.equal(r.consecutiveFail, 2)
  const acts = healActions(r)
  assert.equal(acts.length, 1)
  assert.deepEqual(acts[0], { name: 'web-home', action: 'restart-service' })
})

test('ok 状态下永不产生自愈动作', () => {
  assert.deepEqual(healActions({ state: LIVENESS_STATE.OK, consecutiveFail: 99, dead: [] }), [])
})

test('演练端点 counted=false ⇒ 照判显示,但不累计连续失败', () => {
  const r = judgeLiveness(
    [
      { name: 'a', status: 200 },
      { name: 'extra', status: null, error: 'ECONNREFUSED', counted: false },
    ],
    { prevConsecutiveFail: 0 },
  )
  assert.equal(r.state, LIVENESS_STATE.BREACH)
  assert.deepEqual(r.dead, ['extra'])
  assert.equal(r.consecutiveFail, 0)
})

test('死因清单覆盖连接层四类', () => {
  for (const c of ['ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH']) {
    assert.ok(DEAD_ERRORS.includes(c), `${c} 应在死因清单里`)
  }
})

test('每条 dead 都有可执行的下一步', () => {
  const r = judgeLiveness([{ name: 'web-home', status: null, error: 'ECONNREFUSED' }], { prevConsecutiveFail: 0 })
  const steps = remediationForLiveness(r)
  assert.equal(steps.length, 1)
  assert.match(steps[0], /netstat -ano/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
