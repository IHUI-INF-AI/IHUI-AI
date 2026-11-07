// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 111(check-tool-contract-declared)的合并面判据测试:
// 棘轮锚点、TC3 声明台账、TRD「本次触及」三处都随父集变化。
// ① 合并带入的既有违规/上游摘除的契约不判红;② 合并里真新增违规/真摘契约必判红。
//
// 跑法:node --test scripts/tests/check-tool-contract-declared-merge-delta.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { __test__ as gate } from '../check-tool-contract-declared.mjs'
import { removedOccurrences } from '../lib/merge-delta.mjs'

const KEY = 'apps/cli/src/tools/a.ts#alpha'
const ledger = (declared, total = 2) => new Map([[KEY, { total, declared }]])
const v = (n) => Array.from({ length: n }, (_, i) => ({ toolName: 'alpha', line: i + 1, kind: 'TC1-missing-contract' }))

// ---------------------------------------------------------------- 棘轮锚点

test('A1 合并带入的既有违规(HEAD 1 ∪ MERGE_HEAD 2):naive 单父误判 1 条,双父锚点 2 条绿', () => {
  assert.equal(gate.resolveViolationAnchor(2, [1]), 1)
  assert.equal(gate.resolveViolationAnchor(2, [1, 2]), 2)
  // 修前读数:只看 HEAD ⇒ 2 > 1 ⇒ 判红 1 条
  assert.equal(gate.exceedsAnchor(2, gate.resolveViolationAnchor(2, [1])), true)
  // 修后读数:双父锚点 2 ⇒ 0 条
  assert.equal(gate.exceedsAnchor(2, gate.resolveViolationAnchor(2, [1, 2])), false)
})

test('A2 合并里真新增一条违规(结果 3 / 父 1 ∪ 2):双父锚点 2 ⇒ 判红', () => {
  assert.equal(gate.resolveViolationAnchor(3, [1, 2]), 2)
  assert.equal(gate.exceedsAnchor(3, gate.resolveViolationAnchor(3, [1, 2])), true)
})

test('A3 单父(非合并)与旧口径等价:锚点就是 HEAD 读数', () => {
  assert.equal(gate.resolveViolationAnchor(3, [1]), 1)
  assert.equal(gate.resolveViolationAnchor(1, [3]), 3)
})

// ---------------------------------------------------------------- TC3 声明台账

test('B1 上游分支已摘除契约再合并进来:结果面 0 处声明不得判"本次摘除"', () => {
  const r = gate.findDeclarationRemovals({
    parents: [ledger(2), ledger(0)],
    current: ledger(0),
  })
  assert.equal(r.removed.length, 0)
  // 对照:naive 只看 HEAD 会报 1 条摘除(修前误判)
  const naive = gate.findDeclarationRemovals({ head: ledger(2), current: ledger(0) })
  assert.equal(naive.removed.length, 1)
  assert.equal(naive.removed[0].missing, 2)
})

test('B2 两枚父都声明、结果面摘掉:双父基准必判红(并给出摘除枚数)', () => {
  const r = gate.findDeclarationRemovals({
    parents: [ledger(2), ledger(2)],
    current: ledger(0),
  })
  assert.equal(r.removed.length, 1)
  assert.equal(r.removed[0].missing, 2)
  assert.equal(
    removedOccurrences([], [new Array(2).fill(KEY), new Array(2).fill(KEY)]).length,
    2,
  )
})

test('B3 只有一枚父声明、另一枚没声明:结果面 1 处声明归因到有声明的那枚父,不得判摘除', () => {
  const r = gate.findDeclarationRemovals({
    parents: [ledger(1), ledger(2)],
    current: ledger(1),
  })
  assert.equal(r.removed.length, 0)
})

test('B4 整枚工具被删不是"摘除契约"(current 无该身份 ⇒ 放过)', () => {
  const r = gate.findDeclarationRemovals({ parents: [ledger(2), ledger(2)], current: new Map() })
  assert.equal(r.removed.length, 0)
})

// ---------------------------------------------------------------- TRD 本次触及

test('C1 合并未收口:上游改过的工具文件不算本次触及 ⇒ 不判 TRD 红', () => {
  const judged = ['apps/cli/src/tools/upstream.ts', 'apps/cli/src/tools/mine.ts']
  const touched = gate.trdTouchedRels({ merge: true, judged, changedRels: new Set(['apps/cli/src/tools/mine.ts']) })
  assert.deepEqual(touched, ['apps/cli/src/tools/mine.ts'])
  const state = gate.trdState({ today: '2026-11-07' })
  assert.equal(state.enforce, true)
  const perFile = [
    { rel: judged[0], violations: v(2) },
    { rel: judged[1], violations: v(1) },
  ]
  const trdFiles = perFile.filter((f) => touched.includes(f.rel)) // 调用方按触及集筛
  const res = gate.trdAssess({ files: trdFiles, face: 'staged', state })
  assert.equal(res.reds.length, 1) // 只剩 mine.ts,上游那份不判红
  assert.equal(res.reds[0].rel, judged[1])
  const onlyUpstream = gate.trdAssess({ files: [], face: 'staged', state })
  assert.equal(onlyUpstream.reds.length, 0)
})

test('C2 合并里真改动的工具文件必须判 TRD 红;非合并沿用原 judged 清单', () => {
  const judged = ['apps/cli/src/tools/upstream.ts', 'apps/cli/src/tools/mine.ts']
  const touched = gate.trdTouchedRels({ merge: true, judged, changedRels: new Set(['apps/cli/src/tools/mine.ts']) })
  const state = gate.trdState({ today: '2026-11-07' })
  const res = gate.trdAssess({
    files: [{ rel: touched[0], violations: v(1) }],
    face: 'staged',
    state,
  })
  assert.equal(res.reds.length, 1)
  // 非合并:不筛,清单逐字不变
  assert.deepEqual(gate.trdTouchedRels({ merge: false, judged, changedRels: new Set() }), judged)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
