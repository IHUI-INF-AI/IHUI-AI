// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全事件判据 + 增量游标的回归网(2026-11-26 立,第十九件)。
 *
 * 钉住四类边界:
 *   (a) 事件目录:1102/1100/4719/4697/4732/4740 必须 breach;4672/4720/4946 必须 watch;
 *       未收录 ID 不能抛,按 note 落盘。
 *   (b) 批量判分:空窗 ok;有 breach 命中即 state=breach 且点名;watch 只计数不判红。
 *   (c) 窗口体检:oldest 太新(< 阈值)⇒ warn;oldest 取不到 ⇒ undetermined;
 *       newest 拖后 > 120 分钟 ⇒ undetermined(采集可能已停)。
 *   (d) 增量游标:严格大于游标才留;无 recordId 的一律丢(不猜顺序)。
 *
 * 样本固定,不代表现读日志;实现层真读 Security(见 security-event-intake.mjs)。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  EVENT_CATALOG,
  EVENT_LEVEL,
  INTAKE_EVENT_IDS,
  describeEvent,
  filterAfterCursor,
  judgeEventBatch,
  summarizeWindow,
} from '../security/lib/security-events.mjs'

const NOW = Date.parse('2026-11-26T06:40:00Z')

test('describeEvent:1102 审计日志被清空 ⇒ breach', () => {
  const d = describeEvent(1102)
  assert.equal(d.level, EVENT_LEVEL.BREACH)
  assert.equal(d.name, '审计日志被清空')
  assert.ok(d.why.length > 10)
})

test('describeEvent:未收录 ID 不抛,按 note', () => {
  const d = describeEvent(9999)
  assert.equal(d.level, EVENT_LEVEL.NOTE)
  assert.match(d.name, /9999/)
})

test('describeEvent:提权/持久化/反取证信号全是 breach', () => {
  for (const id of [1102, 1100, 4697, 4732, 4740]) {
    assert.equal(describeEvent(id).level, EVENT_LEVEL.BREACH, `事件 ${id} 应为 breach`)
  }
})

test('describeEvent:4719 归 watch(合法运维也会产,不判红)', () => {
  assert.equal(describeEvent(4719).level, EVENT_LEVEL.WATCH)
  assert.match(describeEvent(4719).why, /补齐器/)
})

test('describeEvent:变更面信号是 watch(不单独判红)', () => {
  for (const id of [4672, 4720, 4946, 4726, 5440, 4719]) {
    assert.equal(describeEvent(id).level, EVENT_LEVEL.WATCH, `事件 ${id} 应为 watch`)
  }
})

test('judgeEventBatch:空批 ⇒ ok,零计数', () => {
  const r = judgeEventBatch([])
  assert.equal(r.state, 'ok')
  assert.equal(r.total, 0)
  assert.deepEqual(r.counts, {})
})

test('judgeEventBatch:非数组入参也按空批', () => {
  assert.equal(judgeEventBatch(null).state, 'ok')
})

test('judgeEventBatch:含 1102 ⇒ breach 且样本带 name/why', () => {
  const r = judgeEventBatch([{ id: 1102, recordId: 100, ts: '2026-11-26T06:00:00Z' }])
  assert.equal(r.state, 'breach')
  assert.equal(r.breaches.length, 1)
  assert.equal(r.breaches[0].name, '审计日志被清空')
  assert.match(r.reason, /审计日志被清空×1/)
})

test('judgeEventBatch:只有 watch/note ⇒ ok 但 watch 计数在', () => {
  const r = judgeEventBatch([
    { id: 4624, recordId: 1, ts: '2026-11-26T06:01:00Z' },
    { id: 4672, recordId: 2, ts: '2026-11-26T06:02:00Z' },
    { id: 4720, recordId: 3, ts: '2026-11-26T06:03:00Z' },
  ])
  assert.equal(r.state, 'ok')
  assert.equal(r.watches.length, 2)
  assert.equal(r.counts[4624], 1)
})

test('judgeEventBatch:maxSample 截断样本但不截断原因汇总', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ id: 4740, recordId: i + 1, ts: '2026-11-26T06:00:00Z' }))
  const r = judgeEventBatch(many, { maxSample: 5 })
  assert.equal(r.state, 'breach')
  assert.equal(r.breaches.length, 5)
  assert.match(r.reason, /账号被锁定×30/)
})

test('summarizeWindow:窗口 4.6 小时(<6)⇒ warn', () => {
  const r = summarizeWindow({
    oldestTs: '2026-11-26T01:55:00Z',
    newestTs: '2026-11-26T06:31:00Z',
    now: NOW,
    minHours: 6,
  })
  assert.equal(r.state, 'warn')
  assert.ok(r.hours < 6)
  assert.match(r.reason, /只保留/)
})

test('summarizeWindow:窗口够长 ⇒ ok', () => {
  const r = summarizeWindow({
    oldestTs: '2026-11-25T20:00:00Z',
    newestTs: '2026-11-26T06:31:00Z',
    now: NOW,
    minHours: 6,
  })
  assert.equal(r.state, 'ok')
  assert.ok(r.hours >= 6)
})

test('summarizeWindow:oldest 取不到 ⇒ undetermined(不冒绿)', () => {
  const r = summarizeWindow({ oldestTs: null, newestTs: '2026-11-26T06:31:00Z', now: NOW })
  assert.equal(r.state, 'undetermined')
  assert.equal(r.hours, null)
})

test('summarizeWindow:newest 拖后 >120 分钟 ⇒ undetermined(采集可能已停)', () => {
  const r = summarizeWindow({
    oldestTs: '2026-11-25T20:00:00Z',
    newestTs: '2026-11-26T03:00:00Z',
    now: NOW,
    minHours: 6,
  })
  assert.equal(r.state, 'undetermined')
  assert.match(r.reason, /采集可能已停/)
})

test('summarizeWindow:阈值可覆盖', () => {
  const r = summarizeWindow({
    oldestTs: '2026-11-26T01:55:00Z',
    newestTs: '2026-11-26T06:31:00Z',
    now: NOW,
    minHours: 3,
  })
  assert.equal(r.state, 'ok')
})

test('filterAfterCursor:严格大于游标才留', () => {
  const rows = [
    { recordId: 100 },
    { recordId: 101 },
    { recordId: 99 },
    { recordId: 102 },
  ]
  assert.deepEqual(
    filterAfterCursor(rows, 100).map((r) => r.recordId),
    [101, 102],
  )
  assert.equal(filterAfterCursor(rows, 0).length, 4)
})

test('filterAfterCursor:无/非法 recordId 一律丢', () => {
  const rows = [{ recordId: 5 }, {}, { recordId: 'x' }, { recordId: null }]
  assert.deepEqual(filterAfterCursor(rows, 0).map((r) => r.recordId), [5])
})

test('filterAfterCursor:非数组入参返回空', () => {
  assert.deepEqual(filterAfterCursor(null, 0), [])
})

test('INTAKE_EVENT_IDS:排除 4688 与 4674 两个高频面', () => {
  assert.equal(INTAKE_EVENT_IDS.includes(4688), false)
  assert.equal(INTAKE_EVENT_IDS.includes(4674), false)
  assert.ok(INTAKE_EVENT_IDS.length >= 30)
})

test('INTAKE_EVENT_IDS:全部来自目录且升序', () => {
  for (const id of INTAKE_EVENT_IDS) assert.ok(EVENT_CATALOG[id], `${id} 不在目录里`)
  assert.deepEqual([...INTAKE_EVENT_IDS].sort((a, b) => a - b), [...INTAKE_EVENT_IDS])
})

test('EVENT_CATALOG:每条都有 name/level/why,level 只三档', () => {
  for (const [id, v] of Object.entries(EVENT_CATALOG)) {
    /* why 只要求「给出方向」,不拿字数当质量代理;最模糊的三条(4723/4726/4771)已人工写具体。 */
    assert.ok(v.name && v.name.length >= 2, `${id} 缺 name`)
    assert.ok(v.why && v.why.length >= 3, `${id} 缺 why`)
    assert.ok([EVENT_LEVEL.BREACH, EVENT_LEVEL.WATCH, EVENT_LEVEL.NOTE].includes(v.level), `${id} level 非法`)
  }
  assert.ok(Object.keys(EVENT_CATALOG).length >= 32)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
