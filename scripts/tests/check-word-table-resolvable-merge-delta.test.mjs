// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 门 74 的合并面回归:锚点必须从「只看 HEAD」改成「HEAD ∪ MERGE_HEAD」。
// 两条用例缺一不可:① 合并带入的既有条目不得判红;② 合并里真新增一条必须判红。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  splitScatteredRatchet,
  splitScatteredRatchetWithParents,
} from '../check-word-table-resolvable.mjs'
import { auditDelta } from '../lib/merge-delta.mjs'

const FILE = 'apps/web/src/demo.tsx'
const bad = (key) => ({ field: 'labelKey', key, line: 1 })
const keyOf = (v) => `${v.field}:${v.key}`
const parentOf = (keys) => keys.map((k) => keyOf(bad(k)))

test('W6 合并面①:上游带入的既有散落键不判红(naive 单父基准会误判)', () => {
  const result = ['a', 'b', 'c'].map(bad)
  const pending = new Map([[FILE, result]])
  const headKeys = [] // HEAD 干净,违规全在 MERGE_HEAD
  const parentKeyLists = [headKeys, parentOf(['a', 'b', 'c'])]
  const correct = splitScatteredRatchetWithParents(pending, () => parentKeyLists)
  assert.equal(correct.fresh.length, 0, '合并带入的既有条目不得判红')
  const naive = splitScatteredRatchet(pending, () => headKeys.length)
  assert.equal(naive.fresh.length, 1, '对照:单父基准确实会把 3 条存量判成新增')
  const d = auditDelta({
    resultKeys: result.map(keyOf),
    parentKeyLists,
    naiveKeys: result.map(keyOf),
  })
  assert.equal(d.onlyNaive.length, 3)
  assert.equal(d.onlyCorrect.length, 0)
})

test('W6 合并面②:合并里真新增一条必须判红(只红新增的那一条)', () => {
  const result = ['a', 'b', 'c', 'd'].map(bad)
  const pending = new Map([[FILE, result]])
  const parentKeyLists = [[], parentOf(['a', 'b', 'c'])]
  const correct = splitScatteredRatchetWithParents(pending, () => parentKeyLists)
  assert.equal(correct.fresh.length, 1)
  assert.equal(correct.fresh[0].tol, 3, '有效锚点 = 4 − 1(本次新增)')
  assert.equal(correct.fresh[0].list.length - correct.fresh[0].tol, 1, '超出部分恰为 1 条')
  const naive = splitScatteredRatchet(pending, () => 0)
  assert.equal(naive.fresh.length, 1)
  const d = auditDelta({
    resultKeys: result.map(keyOf),
    parentKeyLists,
    naiveKeys: result.map(keyOf),
  })
  assert.equal(d.onlyNaive.length, 3, '修前会误判 3 条既有条目')
  assert.equal(d.newKeys.length, 1, '真正新增只有 1 条')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
