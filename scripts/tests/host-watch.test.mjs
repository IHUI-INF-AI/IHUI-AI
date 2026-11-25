// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 主机侧实时的判据锁。核心不是"能不能查",而是三件容易写错的事:
 * ① 同一件事不能被重复报(告警疲劳 = 等于没有告警);
 * ② 未判定时不许推进"已见"(否则这轮没查清会把下一轮的真发现当旧闻);
 * ③ 节律窗口内只积压、到点一封带走,不丢也不刷屏。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { WATCH_STATE, fingerprintOf, diffFindings, shouldAlert } from '../security/host-watch.mjs'

const WSHELL = { type: 'host-webshell', severity: 'high', detail: 'D:\\x\\a.aspx 命中:eval/request', path: 'D:\\x\\a.aspx' }
const C2 = { type: 'host-c2', severity: 'high', detail: '45.9.1.2:4444 ← svchost (C2 端口)' }
const PERSIST = { type: 'host-persistence', severity: 'medium', detail: '新增 service: Foo' }

test('指纹只由 type+detail 决定,同一发现多次复检恒定', () => {
  assert.equal(fingerprintOf({ ...WSHELL }), fingerprintOf({ ...WSHELL }))
  assert.ok(fingerprintOf(WSHELL).startsWith('host-webshell|'))
})

test('指纹不含时刻/序号,不同发现彼此不同', () => {
  const a = fingerprintOf(WSHELL)
  const b = fingerprintOf(C2)
  assert.notEqual(a, b)
  assert.ok(!/\d{4}-\d{2}-\d{2}T/.test(a), '指纹里出现时间戳就意味着每轮换身份')
})

test('缺字段的发现也不会撞成同一个指纹', () => {
  assert.notEqual(fingerprintOf({ type: 'host-c2' }), fingerprintOf({ type: 'host-webshell' }))
  assert.equal(fingerprintOf(null), fingerprintOf(undefined))
})

test('已见 A,当前 A+B ⇒ 只报 B(重复发现不重复告警)', () => {
  const fresh = diffFindings([WSHELL, C2], [fingerprintOf(WSHELL)])
  assert.deepEqual(fresh.map((f) => f.finding.type), ['host-c2'])
})

test('全员新发现 ⇒ 全部报', () => {
  assert.equal(diffFindings([WSHELL, C2, PERSIST], []).length, 3)
})

test('无发现 ⇒ 零新增', () => {
  assert.equal(diffFindings([], []).length, 0)
  assert.equal(diffFindings(null, null).length, 0)
})

test('节律:无积压不发', () => {
  assert.equal(shouldAlert({ pending: [], lastAlertAt: null }).send, false)
})

test('节律:有积压且从未告警 ⇒ 立刻发', () => {
  assert.equal(shouldAlert({ pending: [{}], lastAlertAt: null }).send, true)
})

test('节律:窗口内只积压,到点才发', () => {
  const now = new Date('2026-11-25T12:00:00.000Z').getTime()
  assert.equal(shouldAlert({ pending: [{}], lastAlertAt: '2026-11-25T11:30:00.000Z', now, windowMin: 60 }).send, false)
  assert.equal(shouldAlert({ pending: [{}], lastAlertAt: '2026-11-25T10:58:00.000Z', now, windowMin: 60 }).send, true)
})

test('节律:上次时刻解析不了按未告警处理(宁可多发一封)', () => {
  assert.equal(shouldAlert({ pending: [{}], lastAlertAt: 'garbage' }).send, true)
})

test('三态常量齐备', () => {
  assert.deepEqual(Object.values(WATCH_STATE).sort(), ['new', 'ok', 'undetermined'])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
