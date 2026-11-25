// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 证据编号公开核验的回归网(2026-11-25 立,第二十件)。
 *
 * 这一套最核心的一条不是"函数返回对不对",而是**回执真的能被第三方自证**:
 * 用真实的 makeEntry 造一条,再**只拿回执里的字段、按回执里写的公式**独立算一遍。
 * 如果哪天有人改了 canonical 或字段顺序却没同步改 formula,这条会立刻红 ——
 * 那正是"承诺悬空"重新出现的时刻。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'

import {
  normalizeEv,
  findEntry,
  anchorCovering,
  proofOf,
  buildReceipt,
  buildRangeReceipt,
  RANGE_MAX_SPAN,
  VERIFY_STATE,
} from '../../deploy/win/lib/evidence-verify.mjs'
import { makeEntry, sha256, GENESIS } from '../security/lib/evidence-chain.mjs'

function chainOf(n = 3, refOf = (i) => `EV-${String(i).padStart(10, '0')}`) {
  const out = []
  let prev = GENESIS
  for (let i = 0; i < n; i += 1) {
    const e = makeEntry({
      seq: i,
      prevHash: prev,
      ts: `2026-11-25T00:00:0${i}.000Z`,
      payload: { probe: i },
      ref: refOf(i),
    })
    out.push(e)
    prev = e.hash
  }
  return out
}

/* ── 编号形态 ─────────────────────────────────────────────── */

test('normalizeEv: 合法编号转大写', () => {
  assert.equal(normalizeEv('ev-493307c003'), 'EV-493307C003')
  assert.equal(normalizeEv('  EV-A1B2C3  '), 'EV-A1B2C3')
})

test('normalizeEv: 非法形态一律拒(路径穿越不能混进来)', () => {
  for (const bad of ['../etc/passwd', 'EV-', 'EV-xyz', 'EV-493307C003 extra', '', null, 'EV-493307C0030'.repeat(3)]) {
    assert.equal(normalizeEv(bad), '', `${bad} 应被拒`)
  }
})

/* ── 查找与锚 ─────────────────────────────────────────────── */

test('findEntry: 按下标找到并带上位置', () => {
  const entries = chainOf(3)
  const hit = findEntry(entries, 'EV-0000000001')
  assert.equal(hit.index, 1)
  assert.equal(hit.entry.seq, 1)
})

test('findEntry: 找不到返回 null,不返回空对象', () => {
  assert.equal(findEntry(chainOf(3), 'EV-FFFFFFFF00'), null)
})

test('anchorCovering: 取覆盖该条的最早锚,不是最新的', () => {
  const anchors = [
    { payload: { seq: 10 }, anchorHash: 'a1' },
    { payload: { seq: 20 }, anchorHash: 'a2' },
    { payload: { seq: 30 }, anchorHash: 'a3' },
  ]
  const a = anchorCovering(anchors, 15)
  assert.equal(a.ring, 2)
  assert.equal(a.anchorHash, 'a2')
  /* 目标就在锚点上也算覆盖 */
  assert.equal(anchorCovering(anchors, 10).ring, 1)
})

test('anchorCovering: 没有锚覆盖时返回 null,不编一个', () => {
  assert.equal(anchorCovering([{ payload: { seq: 5 } }], 100), null)
  assert.equal(anchorCovering([], 0), null)
})

/* ── 回执 ─────────────────────────────────────────────────── */

test('buildReceipt: 命中时给出四要素与位置', () => {
  const entries = chainOf(5)
  const anchors = [{ payload: { seq: 4, ts: '2026-11-25T01:00:00Z', chainHead: entries[3].hash, }, anchorHash: 'f1' }]
  const out = buildReceipt({ entries, anchors, ev: 'EV-0000000003' })
  assert.equal(out.state, VERIFY_STATE.FOUND)
  assert.equal(out.receipt.found, true)
  assert.equal(out.receipt.seq, 3)
  assert.equal(out.receipt.position, 3)
  assert.equal(out.receipt.chainLength, 5)
  assert.equal(out.receipt.anchor.ring, 1)
  assert.equal(out.receipt.hash, entries[3].hash)
})

test('buildReceipt: 不回显载荷内容(核验不是二次投递)', () => {
  const entries = chainOf(2)
  const out = buildReceipt({ entries, ev: 'EV-0000000001' })
  const text = JSON.stringify(out)
  assert.ok(!text.includes('probe'), '回执里不得出现原始载荷字段名/内容')
  assert.ok(!('payload' in (out.receipt.proof.fields)))
})

test('buildReceipt: 不存在 ⇒ not_found + found:false', () => {
  const out = buildReceipt({ entries: chainOf(2), ev: 'EV-FFFFFFFF00' })
  assert.equal(out.state, VERIFY_STATE.NOT_FOUND)
  assert.equal(out.receipt.found, false)
})

test('buildReceipt: 已开票未入链 ⇒ pending,不与 not_found 混为一谈', () => {
  /* 拦下攻击者那一刻就开票写告知日志,入链由 autoban 每 10 分钟吸收一轮。
     若不给这一态,攻击者拿编号立刻来查会得到 404 —— 那等于告诉他"编号是编的"。 */
  const out = buildReceipt({ entries: chainOf(2), ev: 'EV-69369B24DE', noticedAt: '2026-11-25T15:24:41.000Z' })
  assert.equal(out.state, VERIFY_STATE.PENDING)
  assert.equal(out.receipt.found, false)
  assert.equal(out.receipt.pending, true)
  assert.equal(out.receipt.noticedAt, '2026-11-25T15:24:41.000Z')
})

test('buildReceipt: 链里已有时以链为准,pending 不覆盖 found', () => {
  const entries = chainOf(3)
  const out = buildReceipt({ entries, ev: 'EV-0000000001', noticedAt: '2026-11-25T15:24:41.000Z' })
  assert.equal(out.state, VERIFY_STATE.FOUND)
  assert.equal(out.receipt.found, true)
  assert.ok(!('pending' in out.receipt))
})

test('pending 与 not_found 是两件事,不得互相顶替', () => {
  const noNotice = buildReceipt({ entries: [], ev: 'EV-69369B24DE' })
  const withNotice = buildReceipt({ entries: [], ev: 'EV-69369B24DE', noticedAt: '2026-11-25T15:24:41.000Z' })
  assert.equal(noNotice.state, VERIFY_STATE.NOT_FOUND)
  assert.equal(withNotice.state, VERIFY_STATE.PENDING)
  assert.notEqual(noNotice.state, withNotice.state)
})

test('buildReceipt: 非法编号 ⇒ invalid,不与 not_found 混淆', () => {
  const out = buildReceipt({ entries: chainOf(2), ev: '../etc/passwd' })
  assert.equal(out.state, VERIFY_STATE.INVALID)
  assert.equal(out.receipt, null)
})

/* ── 最核心:回执必须真的能被第三方自证 ─────────────────── */

test('自证:只拿回执字段按回执公式算,必须等于声明 hash', () => {
  const entries = chainOf(3)
  const out = buildReceipt({ entries, ev: 'EV-0000000002' })
  const f = out.receipt.proof.fields
  /* 第三方不会读我们的 canonical;他只会照 formula 那行做 */
  const recomputed = createHash('sha256').update(`${f.seq}|${f.prevHash}|${f.ts}|${f.payloadHash}`).digest('hex')
  assert.equal(recomputed, f.hash)
  assert.equal(recomputed, out.receipt.hash)
})

test('自证:回执里的公式与链实现逐字一致(canonical 改了这里必须一起改)', () => {
  const entries = chainOf(1)
  const out = buildReceipt({ entries, ev: 'EV-0000000000' })
  const f = out.receipt.proof.fields
  /* 用链实现自己的 sha256 算,必须与用回执公式算的一致 */
  assert.equal(sha256(`${f.seq}|${f.prevHash}|${f.ts}|${f.payloadHash}`), f.hash)
  assert.equal(GENESIS, '0'.repeat(64))
  assert.equal(out.receipt.proof.genesis, GENESIS)
})

test('自证:篡改任何一个字段都必须立刻对不上', () => {
  const entries = chainOf(2)
  const out = buildReceipt({ entries, ev: 'EV-0000000001' })
  const f = { ...out.receipt.proof.fields }
  const baseline = createHash('sha256').update(`${f.seq}|${f.prevHash}|${f.ts}|${f.payloadHash}`).digest('hex')
  assert.equal(baseline, f.hash)
  for (const key of ['seq', 'prevHash', 'ts', 'payloadHash']) {
    const bad = { ...f }
    if (key === 'seq') bad.seq = f.seq + 1
    else bad[key] = `${f[key].startsWith('2') ? '3' : '2'}${f[key].slice(1)}`
    const t = createHash('sha256').update(`${bad.seq}|${bad.prevHash}|${bad.ts}|${bad.payloadHash}`).digest('hex')
    assert.notEqual(t, f.hash, `改了 ${key} 之后必须对不上`)
  }
})

test('proofOf: 说明里必须写明从 GENESIS 起逐条串', () => {
  const p = proofOf(chainOf(1)[0])
  assert.match(p.formula, /sha256/)
  assert.match(p.note, /GENESIS/)
  assert.deepEqual(Object.keys(p.fields).sort(), ['hash', 'payloadHash', 'prevHash', 'seq', 'ts'])
})

/* ── 区间核验(第二十一件) ─────────────────────────────── */

test('区间:完整区间必须报 complete:true 且 count===expected', () => {
  const entries = chainOf(5)
  const out = buildRangeReceipt({ entries, from: 1, to: 3 })
  assert.equal(out.state, VERIFY_STATE.FOUND)
  const r = out.receipt
  assert.equal(r.count, 3)
  assert.equal(r.expected, 3)
  assert.equal(r.complete, true)
  assert.deepEqual(r.gaps, [])
  assert.deepEqual(r.broken, [])
  assert.deepEqual(r.rows.map((x) => x.seq), [1, 2, 3])
})

test('区间:中间缺一条必须如实报缺口,不许"过滤掉缺的"冒充完整', () => {
  const entries = chainOf(5)
  /* 挖掉 seq=2,模拟链中间被挖走一段。剩下每条单独看都合法。 */
  const holed = entries.filter((e) => e.seq !== 2)
  const out = buildRangeReceipt({ entries: holed, from: 0, to: 4 })
  const r = out.receipt
  assert.equal(r.count, 4)
  assert.equal(r.expected, 5)
  assert.equal(r.complete, false)
  assert.deepEqual(r.gaps, [2])
  /* 3 的 prevHash 指向上一条(2)的 hash,而 2 不在区间里 ⇒ 必须记成断点 */
  assert.equal(r.broken.length, 1)
  assert.equal(r.broken[0].seq, 3)
  assert.match(out.reason, /缺口|断点/)
})

test('区间:篡改一条的 hash 必须被本层独立验出断点', () => {
  const entries = chainOf(4)
  const tampered = entries.map((e) => (e.seq === 2 ? { ...e, hash: 'f'.repeat(64) } : e))
  const out = buildRangeReceipt({ entries: tampered, from: 0, to: 3 })
  const r = out.receipt
  assert.equal(r.complete, false)
  assert.deepEqual(r.broken.map((b) => b.seq), [3])
})

test('区间:第三方只拿 rows 按公式算,每一条都必须自洽且首尾相接', () => {
  const entries = chainOf(4)
  const out = buildRangeReceipt({ entries, from: 0, to: 3 })
  const r = out.receipt
  for (const row of r.rows) {
    const re = createHash('sha256').update(`${row.seq}|${row.prevHash}|${row.ts}|${row.payloadHash}`).digest('hex')
    assert.equal(re, row.hash, `seq=${row.seq} 自证失败`)
  }
  for (let i = 1; i < r.rows.length; i += 1) {
    assert.equal(r.rows[i].prevHash, r.rows[i - 1].hash, `seq=${r.rows[i].seq} 与上一条接不上`)
  }
  /* 区间首条的 prevHash 必须能被拿去查 from-1 */
  assert.equal(r.headSeq, 0)
  assert.equal(r.headPrevHash, GENESIS)
  assert.equal(r.tailHash, r.rows[r.rows.length - 1].hash)
})

test('区间:from-1 存在时 headPrevHash 必须等于它的 hash(可续接)', () => {
  const entries = chainOf(5)
  const out = buildRangeReceipt({ entries, from: 2, to: 4 })
  assert.equal(out.receipt.headPrevHash, entries[1].hash)
})

test('区间:跨度超限必须拒绝 —— 不设上限等于免费全量导出接口', () => {
  const entries = chainOf(3)
  const out = buildRangeReceipt({ entries, from: 0, to: RANGE_MAX_SPAN + 1 })
  assert.equal(out.state, VERIFY_STATE.INVALID)
  assert.match(out.reason, /跨度/)
})

test('区间:参数不合法必须判 invalid,不许当 0 处理', () => {
  const entries = chainOf(3)
  assert.equal(buildRangeReceipt({ entries, from: 'abc', to: '3' }).state, VERIFY_STATE.INVALID)
  assert.equal(buildRangeReceipt({ entries, from: 3, to: 1 }).state, VERIFY_STATE.INVALID)
  assert.equal(buildRangeReceipt({ entries, from: -1, to: 2 }).state, VERIFY_STATE.INVALID)
  assert.equal(buildRangeReceipt({ entries, from: 1.5, to: 2 }).state, VERIFY_STATE.INVALID)
})

test('区间:锚必须取覆盖 to 的最早一环', () => {
  const entries = chainOf(6)
  const anchors = [
    { payload: { v: 1, ts: '2026-11-25T01:00:00.000Z', count: 3, seq: 2, chainHead: entries[2].hash, prevAnchor: null }, anchorHash: 'a'.repeat(64) },
    { payload: { v: 1, ts: '2026-11-25T02:00:00.000Z', count: 6, seq: 5, chainHead: entries[5].hash, prevAnchor: 'a'.repeat(64) }, anchorHash: 'b'.repeat(64) },
  ]
  assert.equal(buildRangeReceipt({ entries, anchors, from: 0, to: 2 }).receipt.anchor.ring, 1)
  assert.equal(buildRangeReceipt({ entries, anchors, from: 0, to: 5 }).receipt.anchor.ring, 2)
  /* 最后一环也盖不住 ⇒ 如实 null,不编 */
  assert.equal(buildRangeReceipt({ entries, anchors: [], from: 0, to: 1 }).receipt.anchor, null)
})

test('区间:空 entries 仍然如实回 0 条 + 全缺口,而不是崩', () => {
  const out = buildRangeReceipt({ entries: [], from: 0, to: 2 })
  assert.equal(out.state, VERIFY_STATE.FOUND)
  assert.equal(out.receipt.count, 0)
  assert.equal(out.receipt.complete, false)
  assert.deepEqual(out.receipt.gaps, [0, 1, 2])
  assert.equal(out.receipt.headPrevHash, null)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
