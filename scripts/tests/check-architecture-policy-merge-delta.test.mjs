// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 门 103 的合并面回归:表缺陷基线 / X1 无日期例外锚点 / DC 抑制锚点
// 必须从「只看 HEAD」改成「HEAD ∪ MERGE_HEAD」。
// 每条用例都成对:① 合并带入的既有条目不得判红;② 合并里真新增一条必须判红。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as gate } from '../check-architecture-policy.mjs'
import { auditDelta } from '../lib/merge-delta.mjs'

test('表缺陷合并面①:上游那份表已有的缺陷不判红(naive 单父基准会误判)', () => {
  const table = ['M1', 'M2', 'M3'].map((msg) => ({ rule: 'T1', msg, soft: false }))
  const correct = gate.newTableDefects(table, [[], ['M1', 'M2', 'M3']])
  assert.equal(correct.length, 0, '合并带入的表缺陷不得判红')
  const naive = gate.newTableDefects(table, [[]])
  assert.equal(naive.length, 3, '对照:单父基准会把 3 条存量判成新增')
  const d = auditDelta({
    resultKeys: ['M1', 'M2', 'M3'],
    parentKeyLists: [[], ['M1', 'M2', 'M3']],
    naiveKeys: ['M1', 'M2', 'M3'],
  })
  assert.equal(d.onlyNaive.length, 3)
  assert.equal(d.onlyCorrect.length, 0)
})

test('表缺陷合并面②:合并里真新增一条缺陷必须判红', () => {
  const table = ['M1', 'M2', 'M3', 'M4'].map((msg) => ({ rule: 'T1', msg, soft: false }))
  const correct = gate.newTableDefects(table, [[], ['M1', 'M2', 'M3']])
  assert.equal(correct.length, 1)
  assert.equal(correct[0].msg, 'M4')
  const naive = gate.newTableDefects(table, [[]])
  assert.equal(naive.length, 4)
  const d = auditDelta({
    resultKeys: ['M1', 'M2', 'M3', 'M4'],
    parentKeyLists: [[], ['M1', 'M2', 'M3']],
    naiveKeys: ['M1', 'M2', 'M3', 'M4'],
  })
  assert.equal(d.newKeys.length, 1)
  assert.equal(d.onlyNaive.length, 3, '修前会误判 3 条既有缺陷')
})

test('X1 无日期例外合并面:上游已登记的 id 是存量,新登记才判红', () => {
  const parents = [[], ['EX-A']]
  assert.deepEqual([...gate.anchorUndatedWithParents(['EX-A'], parents)], ['EX-A'])
  assert.deepEqual([...gate.anchorUndatedWithParents(['EX-A', 'EX-B'], parents)], ['EX-A'])
  assert.equal(gate.anchorUndatedWithParents(['EX-A'], [[]]).size, 0, '对照:单父基准把它当成新登记')
  assert.equal(gate.anchorUndatedWithParents(['EX-A', 'EX-B'], [[]]).size, 0)
})

test('DC 抑制合并面:上游既有的抑制是存量,叠加一条才判红', () => {
  const one = gate.suppressionKeys('// @ts-ignore\nconst a = 1\n')
  const two = gate.suppressionKeys('// @ts-ignore\n// eslint-disable-next-line\nconst a = 1\n')
  assert.deepEqual(one, ['ts-ignore'])
  assert.equal(two.length, 2)
  assert.equal(gate.suppressionAnchorWithParents(one, [[], ['ts-ignore']]), 1, '合并带入的存量锚点')
  assert.equal(gate.suppressionAnchorWithParents(two, [[], ['ts-ignore']]), 1, '叠加一条后锚点仍是 1')
  assert.equal(gate.suppressionAnchorWithParents(one, [[]]), 0, '对照:单父基准锚点为 0')
  assert.equal(gate.suppressionAnchorWithParents(two, [[]]), 0)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
