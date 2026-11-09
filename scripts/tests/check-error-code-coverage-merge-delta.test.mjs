// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 门 94 的合并面回归:R4a 逐文件锚点必须从「只看 HEAD」改成「HEAD ∪ MERGE_HEAD」。
// 两条用例缺一不可:① 合并带入的既有直转站点不得判红;② 合并里真新增一处必须判红。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkEnumCastRatchet } from '../check-error-code-coverage.mjs'
import { auditDelta } from '../lib/merge-delta.mjs'

const REL = 'packages/shared/src/r4-probe.ts'
const PROBE =
  'export function readStatus(row: { status: unknown }) {\n  return row.status as ChatMessageStatus\n}\n'
const KEY = 'as ChatMessageStatus'
const filesWith = (n) => [{ relPath: REL, src: PROBE.repeat(n) }]

test('R4a 合并面①:上游带入的既有直转站点不判红(naive 单父基准会误判)', () => {
  const parentKeyLists = [[], [KEY, KEY, KEY]]
  const correct = checkEnumCastRatchet(filesWith(3), {
    anchorOf: () => 0,
    ratcheted: true,
    parentSiteKeysOf: () => parentKeyLists,
    anchorFace: 'HEAD ∪ MERGE_HEAD',
  })
  assert.equal(correct.problems.length, 0, '合并带入的 3 处存量不得判红')
  const naive = checkEnumCastRatchet(filesWith(3), { anchorOf: () => 0, ratcheted: true })
  assert.equal(naive.problems.length, 1, '对照:单父基准会判红')
  const d = auditDelta({
    resultKeys: [KEY, KEY, KEY],
    parentKeyLists,
    naiveKeys: [KEY, KEY, KEY],
  })
  assert.equal(d.onlyNaive.length, 3)
  assert.equal(d.onlyCorrect.length, 0)
})

test('R4a 合并面②:合并里真新增一处直转必须判红(只红新增的那一处)', () => {
  const parentKeyLists = [[], [KEY, KEY, KEY]]
  const correct = checkEnumCastRatchet(filesWith(4), {
    anchorOf: () => 0,
    ratcheted: true,
    parentSiteKeysOf: () => parentKeyLists,
    anchorFace: 'HEAD ∪ MERGE_HEAD',
  })
  assert.equal(correct.problems.length, 1)
  assert.match(correct.problems[0], /4 处/)
  assert.match(correct.problems[0], /自身存量 3/)
  const naive = checkEnumCastRatchet(filesWith(4), { anchorOf: () => 0, ratcheted: true })
  assert.equal(naive.problems.length, 1)
  const d = auditDelta({
    resultKeys: [KEY, KEY, KEY, KEY],
    parentKeyLists,
    naiveKeys: [KEY, KEY, KEY, KEY],
  })
  assert.equal(d.newKeys.length, 1, '真正新增只有 1 处')
  assert.equal(d.onlyNaive.length, 3, '修前会误判 3 处既有站点')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
