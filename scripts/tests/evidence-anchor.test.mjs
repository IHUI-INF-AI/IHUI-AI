// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 外锚判据锁。核心是那三条"本机删得掉、外部删不掉"的检测:
 * 截断、整体重写、锚链断裂 —— 每条都必须能判死,否则外锚只是日志。
 *
 * 注意:链的 `seq` 从 0 起,`verifyChain` 要求 `e.seq === i`,所以构造器必须 0 基。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { GENESIS, makeEntry, verifyChain } from '../security/lib/evidence-chain.mjs'
import {
  ANCHOR_STATE,
  anchorPayloadOf,
  anchorHashOf,
  shouldAnchor,
  verifyAnchors,
} from '../security/evidence-anchor.mjs'

function chainOf(n, { forged = false } = {}) {
  const out = []
  for (let i = 0; i < n; i += 1) {
    out.push(
      makeEntry({
        seq: i,
        prevHash: i === 0 ? GENESIS : out[i - 1].hash,
        ts: `2026-11-25T00:${String(i).padStart(2, '0')}:00.000Z`,
        payload: forged ? { forged: true, i } : { kind: 'waf-block', i },
      }),
    )
  }
  return out
}

function anchorRow(entries, prevAnchorHash, ts) {
  const payload = anchorPayloadOf(entries, prevAnchorHash, ts)
  return { payload, anchorHash: anchorHashOf(payload) }
}

test('构造器产出的链本身自证通过(否则后面每一条都在验一条坏链)', () => {
  const v = verifyChain(chainOf(4))
  assert.equal(v.ok, true, v.reason)
  assert.equal(v.head, chainOf(4)[3].hash)
})

test('空链的锚报文用 GENESIS 与 seq=0/count=0', () => {
  const p = anchorPayloadOf([], null, '2026-11-25T00:00:00.000Z')
  assert.equal(p.seq, 0)
  assert.equal(p.chainHead, GENESIS)
  assert.equal(p.count, 0)
  assert.equal(p.prevAnchor, null)
})

test('有链时取末条 seq/hash,count 是真条数', () => {
  const entries = chainOf(3)
  const p = anchorPayloadOf(entries, 'abc', '2026-11-25T01:00:00.000Z')
  assert.equal(p.seq, 2)
  assert.equal(p.count, 3)
  assert.equal(p.chainHead, entries[2].hash)
  assert.equal(p.prevAnchor, 'abc')
})

test('锚哈希对同一报文稳定,字段变化即变', () => {
  const p = anchorPayloadOf(chainOf(2), null, '2026-11-25T00:00:00.000Z')
  assert.equal(anchorHashOf(p), anchorHashOf({ ...p }))
  assert.notEqual(anchorHashOf(p), anchorHashOf({ ...p, count: 3 }))
})

test('节律:从未锚过就该锚;54 分钟不锚;55 分钟锚(留一格 tick 提前量)', () => {
  const now = new Date('2026-11-25T12:00:00.000Z').getTime()
  assert.equal(shouldAnchor({ lastTs: null, now }).due, true)
  assert.equal(shouldAnchor({ lastTs: '2026-11-25T11:06:00.000Z', now, intervalMin: 60 }).due, false)
  assert.equal(shouldAnchor({ lastTs: '2026-11-25T11:05:00.000Z', now, intervalMin: 60 }).due, true)
})

test('节律:上次时刻解析不了按未锚处理(失效方向是多锚一次,不是永不锚)', () => {
  assert.equal(shouldAnchor({ lastTs: 'not-a-date' }).due, true)
})

test('无锚台账 ⇒ undetermined(「从未锚过」不是绿)', () => {
  const v = verifyAnchors({ entries: chainOf(3), error: null }, [])
  assert.equal(v.state, ANCHOR_STATE.UNDETERMINED)
})

test('全链完整 + 锚链相接 ⇒ ok', () => {
  const entries = chainOf(3)
  const a1 = anchorRow(entries, null, '2026-11-25T01:00:00.000Z')
  const a2 = anchorRow(entries, a1.anchorHash, '2026-11-25T02:00:00.000Z')
  const v = verifyAnchors({ entries, error: null }, [a1, a2])
  assert.equal(v.state, ANCHOR_STATE.OK, v.notes.join(' / '))
})

test('锚链断开(中间一封被抹掉)⇒ breach', () => {
  const entries = chainOf(3)
  const a1 = anchorRow(entries, null, '2026-11-25T01:00:00.000Z')
  const a2 = anchorRow(entries, a1.anchorHash, '2026-11-25T02:00:00.000Z')
  const a3 = anchorRow(entries, a2.anchorHash, '2026-11-25T03:00:00.000Z')
  const v = verifyAnchors({ entries, error: null }, [a1, a3])
  assert.equal(v.state, ANCHOR_STATE.BREACH)
  assert.match(v.notes[0], /断开/)
})

test('锚台账自身被改(anchorHash 对不上报文)⇒ breach', () => {
  const entries = chainOf(2)
  const a1 = anchorRow(entries, null, '2026-11-25T01:00:00.000Z')
  const tampered = { ...a1, anchorHash: 'deadbeef'.repeat(8) }
  const v = verifyAnchors({ entries, error: null }, [tampered])
  assert.equal(v.state, ANCHOR_STATE.BREACH)
  assert.match(v.notes[0], /哈希不符/)
})

test('链被截断(条数少于已锚条数)⇒ breach —— 外锚最核心的那条', () => {
  const a1 = anchorRow(chainOf(5), null, '2026-11-25T01:00:00.000Z')
  const v = verifyAnchors({ entries: chainOf(2), error: null }, [a1])
  assert.equal(v.state, ANCHOR_STATE.BREACH)
  assert.match(v.notes[0], /截断|重写/)
})

test('链被整体重写成一条同样自洽的假链 ⇒ breach(链内自证抓不到,只有外锚能抓)', () => {
  const real = chainOf(4)
  const a1 = anchorRow(real, null, '2026-11-25T01:00:00.000Z')
  const rewritten = chainOf(4, { forged: true })
  assert.equal(verifyChain(rewritten).ok, true, '假链自身必须自洽,否则测不到这条判据')
  const v = verifyAnchors({ entries: rewritten, error: null }, [a1])
  assert.equal(v.state, ANCHOR_STATE.BREACH)
  assert.match(v.notes[0], /改写/)
})

test('链自身自证不过 ⇒ breach,且在比对锚之前就判', () => {
  const entries = chainOf(2)
  entries[1] = { ...entries[1], ts: '2026-11-25T09:00:00.000Z' }
  const v = verifyAnchors({ entries, error: null }, [anchorRow(chainOf(2), null, '2026-11-25T01:00:00.000Z')])
  assert.equal(v.state, ANCHOR_STATE.BREACH)
  assert.match(v.notes[0], /链自证不过/)
  assert.equal(verifyChain(entries).ok, false)
})

test('链读不出来 ⇒ undetermined(不猜)', () => {
  const v = verifyAnchors({ entries: [], error: '第 2 行无法解析' }, [{ payload: {}, anchorHash: 'x' }])
  assert.equal(v.state, ANCHOR_STATE.UNDETERMINED)
})

test('锚后链继续增长仍判 ok(增长不是断裂)', () => {
  const short = chainOf(3)
  const a1 = anchorRow(short, null, '2026-11-25T01:00:00.000Z')
  const longer = chainOf(4)
  const v = verifyAnchors({ entries: longer, error: null }, [a1])
  assert.equal(v.state, ANCHOR_STATE.OK, v.notes.join(' / '))
  assert.ok(v.notes.some((n) => n.includes('新增 1 条')))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
