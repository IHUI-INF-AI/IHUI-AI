// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import test from 'node:test'
import assert from 'node:assert/strict'
import { GENESIS, makeEntry } from '../security/lib/evidence-chain.mjs'
import { anchorHashOf, anchorPayloadOf } from '../security/evidence-anchor.mjs'
import { AUDIT_STATE, buildMailBody, judgeAudit } from '../security/evidence-audit.mjs'

const NOW = Date.parse('2026-11-25T03:10:00.000Z')

function chainOf(n) {
  const out = []
  for (let i = 0; i < n; i += 1) {
    out.push(makeEntry({ seq: i, prevHash: i === 0 ? GENESIS : out[i - 1].hash, ts: `2026-11-25T00:${String(i % 60).padStart(2, '0')}:00.000Z`, payload: { kind: 'waf-block', i } }))
  }
  return out
}

function anchorRow(entries, prevAnchorHash, ts) {
  const payload = anchorPayloadOf(entries, prevAnchorHash, ts)
  return { payload, anchorHash: anchorHashOf(payload) }
}

test('从未锚过 ⇒ 未判定(不把"没锚"记成绿)', () => {
  const r = judgeAudit({ chain: { entries: chainOf(3), error: null }, anchors: [], now: NOW })
  assert.equal(r.state, AUDIT_STATE.UNDETERMINED)
  assert.equal(r.notes.length > 0, true)
})

test('链读不出来 ⇒ 未判定', () => {
  const r = judgeAudit({ chain: { entries: [], error: 'ENOENT' }, anchors: [anchorRow([], null, '2026-11-25T03:00:00.000Z')], now: NOW })
  assert.equal(r.state, AUDIT_STATE.UNDETERMINED)
})

test('链自洽 + 新鲜锚 ⇒ ok', () => {
  const entries = chainOf(5)
  const r = judgeAudit({ chain: { entries, error: null }, anchors: [anchorRow(entries, null, '2026-11-25T03:00:00.000Z')], now: NOW })
  assert.equal(r.state, AUDIT_STATE.OK)
  assert.equal(r.chainCount, 5)
  assert.equal(r.anchoredCount, 5)
  assert.equal(r.lag, 0)
  assert.equal(r.ageMin, 10)
})

test('链被截断(锚到 10 条,当前只有 5 条)⇒ breach', () => {
  const anchored = chainOf(10)
  const r = judgeAudit({ chain: { entries: chainOf(5), error: null }, anchors: [anchorRow(anchored, null, '2026-11-25T03:00:00.000Z')], now: NOW })
  assert.equal(r.state, AUDIT_STATE.BREACH)
  assert.match(r.notes.join(' '), /截断/)
})

test('已锚位置被改写 ⇒ breach', () => {
  const entries = chainOf(5)
  const anchor = anchorRow(entries, null, '2026-11-25T03:00:00.000Z')
  const forged = chainOf(5)
  forged[4] = makeEntry({ seq: 4, prevHash: forged[3].hash, ts: forged[4].ts, payload: { kind: 'forged' } })
  const r = judgeAudit({ chain: { entries: forged, error: null }, anchors: [anchor], now: NOW })
  assert.equal(r.state, AUDIT_STATE.BREACH)
  assert.match(r.notes.join(' '), /改写/)
})

test('锚链断开(第二锚的 prevAnchor 接不上)⇒ breach', () => {
  const entries = chainOf(5)
  const a1 = anchorRow(entries, null, '2026-11-25T01:00:00.000Z')
  const a2 = anchorRow(entries, 'deadbeef'.repeat(8), '2026-11-25T03:00:00.000Z')
  const r = judgeAudit({ chain: { entries, error: null }, anchors: [a1, a2], now: NOW })
  assert.equal(r.state, AUDIT_STATE.BREACH)
  assert.match(r.notes.join(' '), /断开/)
})

test('锚停摆 180 分钟(节律 60,容忍 120)⇒ stale', () => {
  const entries = chainOf(5)
  const r = judgeAudit({ chain: { entries, error: null }, anchors: [anchorRow(entries, null, '2026-11-25T00:00:00.000Z')], now: NOW })
  assert.equal(r.state, AUDIT_STATE.STALE)
  assert.equal(r.ageMin, 190)
  assert.match(r.notes.join(' '), /锚已停/)
})

test('锚龄正好等于容忍上限 ⇒ 不判 stale(边界只拦"超过")', () => {
  const entries = chainOf(5)
  const r = judgeAudit({ chain: { entries, error: null }, anchors: [anchorRow(entries, null, '2026-11-25T01:10:00.000Z')], now: NOW })
  assert.equal(r.ageMin, 120)
  assert.equal(r.state, AUDIT_STATE.OK)
})

test('锚严重落后(链 5 条,已锚 2 条,容忍 2)⇒ stale', () => {
  const entries = chainOf(5)
  const r = judgeAudit({ chain: { entries, error: null }, anchors: [anchorRow(entries.slice(0, 2), null, '2026-11-25T03:00:00.000Z')], now: NOW, maxLag: 2 })
  assert.equal(r.state, AUDIT_STATE.STALE)
  assert.equal(r.lag, 3)
  assert.match(r.notes.join(' '), /严重落后/)
})

test('落后正好等于容忍上限 ⇒ 不判 stale', () => {
  const entries = chainOf(4)
  const r = judgeAudit({ chain: { entries, error: null }, anchors: [anchorRow(entries.slice(0, 2), null, '2026-11-25T03:00:00.000Z')], now: NOW, maxLag: 2 })
  assert.equal(r.lag, 2)
  assert.equal(r.state, AUDIT_STATE.OK)
})

test('最新锚的时刻读不出来 ⇒ 未判定(不猜它停了还是没停)', () => {
  const entries = chainOf(3)
  const row = anchorRow(entries, null, '2026-11-25T03:00:00.000Z')
  row.payload = { ...row.payload, ts: 'not-a-time' }
  row.anchorHash = anchorHashOf(row.payload)
  const r = judgeAudit({ chain: { entries, error: null }, anchors: [row], now: NOW })
  assert.equal(r.state, AUDIT_STATE.UNDETERMINED)
})

test('告警正文带齐条数/已锚/落后/处置四组信息', () => {
  const body = buildMailBody({ state: AUDIT_STATE.STALE, chainCount: 300, anchoredCount: 155, lag: 145, lastAnchorTs: '2026-11-25T00:00:00.000Z', ageMin: 190, notes: ['锚已停 190 分钟'] })
  assert.match(body, /chainCount: 300/)
  assert.match(body, /anchoredCount: 155/)
  assert.match(body, /lag: 145/)
  assert.match(body, /锚已停 190 分钟/)
  assert.match(body, /怎么处置:/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
