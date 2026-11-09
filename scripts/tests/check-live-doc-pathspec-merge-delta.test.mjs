// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 166 的合并面基准:基准行算「本次丢失」⇔ 它在每一枚父提交(HEAD ∪ MERGE_HEAD)都存在。
// 上游分支改写了的那一行归因上游,不记本次丢行。
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ } from '../check-live-doc-pathspec.mjs'

const { judgeDoc } = __test__
const DOC = 'PROJECT_PLAN.md'
const BASE = [
  '# Live Plan',
  '- alpha requirement: the widget pipeline must retry every failed upload exactly three times',
  '- beta requirement: quota accounting uses integer cents and never floating point',
].join('\n')
const CAND = '# Live Plan\n'
const ARCHIVE = { ok: true, set: new Set() }

const judge = (extra) =>
  judgeDoc({
    doc: DOC,
    baseText: BASE,
    candText: CAND,
    archive: ARCHIVE,
    face: 'staged',
    parentTexts: extra,
  })

test('M1 合并带入的既有版本(上游已改写)⇒ 缺失行归因上游,不判红', (t) => {
  const r = judge([CAND])
  assert.equal(r.inScope, true)
  assert.equal(r.attributedToParent, 2, '两行都应归因上游')
  assert.equal(r.lost.length, 0, '不得把上游改写判成本次丢行')
  t.diagnostic('naive 单父基准会判丢失 2 行;双父基准 lost=0 attributed=2')
})

test('M2 合并里真的丢掉每一枚父提交都有的行 ⇒ 判红', (t) => {
  const r = judge([BASE])
  assert.equal(r.attributedToParent, 0, '两父都有的行不得归因上游')
  assert.equal(r.lost.length, 2, '真丢行必须逐条点名')
  t.diagnostic('双父: lost=2(每一枚父提交都有该行)')
})

test('M3 非合并提交(无额外父)⇒ 判定与旧行为逐字一致', () => {
  const r = judge([])
  assert.equal(r.attributedToParent, 0)
  assert.equal(r.lost.length, 2)
  // 只有 HEAD 基准时,旧路径同样把这 2 行判成丢失。
  assert.equal(r.superseded, 0)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
