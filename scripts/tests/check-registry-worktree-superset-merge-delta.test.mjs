// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 192 的合并面基准:P1/P2 只在「每一枚父提交(HEAD ∪ MERGE_HEAD)都如此」时算本次动作。
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ } from '../check-registry-worktree-superset.mjs'

const { judgeFile, PKG_A, PKG_DROP_B } = __test__
const NO_LEDGER = { ok: new Map(), bad: [], present: false }
const judge = (candText, extraParentTexts) =>
  judgeFile({
    path: 'package.json',
    headText: PKG_A,
    candText,
    candAbsent: false,
    ledger: NO_LEDGER,
    extraParentTexts,
  })

test('M1 P1:上游侧也没有该条目 ⇒ 归因上游,不判红', (t) => {
  const r = judge(PKG_DROP_B, [PKG_DROP_B])
  assert.equal(r.p1.length, 0, '两父都没有 check:b ⇒ 不是本次删除')
  assert.ok(r.attributed.some((x) => x.entry === 'check:b'), '必须点名归因去向')
  t.diagnostic('naive 单父基准: P1=1;双父基准: P1=0(attributed=1)')
})

test('M2 P1:两父都有该条目而候选面整条不见 ⇒ 判红', (t) => {
  const r = judge(PKG_DROP_B, [PKG_A])
  assert.deepEqual(
    r.p1.map((x) => x.entry),
    ['check:b'],
    '每一枚父提交都有 check:b ⇒ 本次真删除',
  )
  assert.equal(r.attributed.length, 0)
  t.diagnostic('双父基准: P1=1')
})

test('M3 P2:候选块与 MERGE_HEAD 逐字相同 ⇒ 归因上游,不判红', (t) => {
  const cand = PKG_A.replace('"check:b": "node 2"', '"check:b": "node 9"')
  const r = judge(cand, [cand])
  assert.equal(r.p2.length, 0, '上游那一枚就是这个写法 ⇒ 不是本次改写')
  assert.ok(r.attributed.some((x) => x.entry === 'check:b'))
  t.diagnostic('naive 单父基准: P2=1;双父基准: P2=0(attributed=1)')
})

test('M4 P2:两父都不是这个值 ⇒ 判红;无额外父时旧行为不变', () => {
  const cand = PKG_A.replace('"check:b": "node 2"', '"check:b": "node 9"')
  const red = judge(cand, [PKG_A])
  assert.deepEqual(
    red.p2.map((x) => x.entry),
    ['check:b'],
  )
  const old = judge(cand, [])
  assert.deepEqual(old.p2.map((x) => x.entry), ['check:b'], '单父面必须与旧判据逐字一致')
  const oldP1 = judge(PKG_DROP_B, [])
  assert.deepEqual(oldP1.p1.map((x) => x.entry), ['check:b'], '单父面 P1 必须与旧判据逐字一致')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
