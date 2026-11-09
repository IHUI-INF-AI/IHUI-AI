// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 门 90 的合并面回归:未声明缺帧的基線必须从「只看 HEAD」改成「HEAD ∪ MERGE_HEAD」。
// 两条用例缺一不可:① 合并带入的既有缺帧不得判红;② 合并里真新增一个缺帧必须判红。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateDispatchParity } from '../check-sse-dispatch-parity.mjs'
import { auditDelta } from '../lib/merge-delta.mjs'

const data = (extraMissing = {}) => ({
  endpoints: { web: ['apps/web'] },
  baseline: { web: 1 },
  missing: { web: extraMissing },
  toolCallbacks: [],
  groups: {},
})
const hit = { web: new Set(['onA']) }
const undeclaredErrors = (r) => r.errors.filter((e) => e.includes('未注册且未声明理由'))

test('SSE 合并面①:上游带入的既有缺帧不判红(naive 单父基准会误判)', () => {
  const callbacks = ['onA', 'onB', 'onC']
  const parentMissing = [{ web: [] }, { web: ['onB', 'onC'] }]
  const correct = evaluateDispatchParity({ hit, callbacks, known: new Set(callbacks), data: data(), parentMissing })
  assert.equal(undeclaredErrors(correct).length, 0, '合并带入的既有缺帧不得判红')
  const naive = evaluateDispatchParity({ hit, callbacks, known: new Set(callbacks), data: data() })
  assert.equal(undeclaredErrors(naive).length, 1, '对照:单父基准会把两条存量合成一条红色读数')
  const measured = ['onB', 'onC']
  const d = auditDelta({
    resultKeys: measured,
    parentKeyLists: parentMissing.map((m) => m.web),
    naiveKeys: measured,
  })
  assert.equal(d.onlyNaive.length, 2)
  assert.equal(d.onlyCorrect.length, 0)
})

test('SSE 合并面②:合并里真新增一个缺帧必须判红(只红新增的那一个)', () => {
  const callbacks = ['onA', 'onB', 'onC', 'onD']
  const parentMissing = [{ web: [] }, { web: ['onB', 'onC'] }]
  const correct = evaluateDispatchParity({ hit, callbacks, known: new Set(callbacks), data: data(), parentMissing })
  const errs = undeclaredErrors(correct)
  assert.equal(errs.length, 1, '合并里真新增的 onD 必须被判红')
  assert.match(errs[0], /onD/)
  assert.doesNotMatch(errs[0], /onB|onC/, '继承的缺帧不得混进本次新增')
  const naive = evaluateDispatchParity({ hit, callbacks, known: new Set(callbacks), data: data() })
  assert.equal(undeclaredErrors(naive).length, 1)
  const d = auditDelta({
    resultKeys: ['onB', 'onC', 'onD'],
    parentKeyLists: parentMissing.map((m) => m.web),
    naiveKeys: ['onB', 'onC', 'onD'],
  })
  assert.equal(d.newKeys.length, 1, '真正新增只有 1 个')
  assert.equal(d.onlyNaive.length, 2, '修前会误判 2 个既有缺帧')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
