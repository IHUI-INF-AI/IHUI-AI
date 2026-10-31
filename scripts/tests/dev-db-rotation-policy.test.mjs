// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** 票 O69 的镜像测试:轮换派发决定器(判据单源 scripts/lib/dev-db-rotation-policy.mjs)。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as p } from '../lib/dev-db-rotation-policy.mjs'

const NOW = Date.parse('2026-11-01T02:00:00.000Z')

test('无未结清条目 ⇒ 零动作(不许空转假装巡检)', () => {
  const r = p.decideDevDbRotation({ pending: false, livePorts: [], nowMs: NOW })
  assert.equal(r.act, false)
  assert.equal(r.state, 'no-pending')
})

test('窗口探测取不到 ⇒ 未判定且不派生(不把"没看见"当"没有")', () => {
  const r = p.decideDevDbRotation({ pending: true, livePorts: null, nowMs: NOW })
  assert.equal(r.act, false)
  assert.equal(r.state, 'undetermined')
})

test('活服务在场 ⇒ 整轮让路且不记绿(window-busy)', () => {
  const r = p.decideDevDbRotation({ pending: true, livePorts: [8801, 8802], nowMs: NOW })
  assert.equal(r.act, false)
  assert.equal(r.state, 'window-busy')
  assert.match(r.why, /8801/)
})

test('窗口空闲 + 未冷却 ⇒ 派生一次', () => {
  const r = p.decideDevDbRotation({
    pending: true,
    livePorts: [],
    lastAttemptIso: '2026-11-01T00:30:00.000Z',
    nowMs: NOW,
  })
  assert.equal(r.act, true)
  assert.equal(r.state, 'act')
})

test('冷却中 ⇒ 不硬试', () => {
  const r = p.decideDevDbRotation({
    pending: true,
    livePorts: [],
    lastAttemptIso: '2026-11-01T01:30:00.000Z',
    nowMs: NOW,
  })
  assert.equal(r.act, false)
  assert.equal(r.state, 'throttled')
})

test('无上次尝试记录(或坏值)⇒ 视为未冷却', () => {
  for (const lastAttemptIso of [null, 'not-a-date']) {
    const r = p.decideDevDbRotation({ pending: true, livePorts: [], lastAttemptIso, nowMs: NOW })
    assert.equal(r.act, true)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
