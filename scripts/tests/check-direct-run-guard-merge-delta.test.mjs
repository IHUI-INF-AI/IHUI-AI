// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 194 的合并面基准:逐文件命中数用「结果读数 − 本次真正新增数」当锚点。
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ } from '../check-direct-run-guard.mjs'

const { judgeSource, anchorFromParents, decide, readLedger } = __test__
const REL = 'scripts/check-demo.mjs'
const ONE = 'const isDirectRun = process.argv[1]\nfunction main(){}\nmain()\n'
const TWO = `${ONE}main()\n`
const NONE = 'function main(){}\nexport const x = 1\n'
const ledger = readLedger('[]')
const today = '2099-12-31'

const j = (src) => judgeSource(REL, src)

test('M1 合并带入的既有命中 ⇒ 不判红', (t) => {
  const result = j(ONE)
  const head = j(NONE)
  const merge = j(ONE)
  assert.equal(result.hits.length, 1)
  const naive = result.hits.length > head.hits.length
  const anchor = anchorFromParents({ result, parents: [head, merge] })
  assert.equal(naive, true, '单父基准会把上游带入的那 1 处判成本次新增')
  assert.equal(anchor, 1, '双父基准:有效锚点 = 1')
  const d = decide({ judged: [result], anchor: new Map([[REL, anchor]]), ledger, today, face: 'staged' })
  assert.equal(d.violations.length, 0, '合并带入的既有命中不得判红')
  t.diagnostic('naive: 1 > 0 ⇒ red;双父: 1 > 1 不成立 ⇒ green')
})

test('M2 合并里真新增一处顶层裸 main() ⇒ 判红', (t) => {
  const result = j(TWO)
  const head = j(NONE)
  const merge = j(ONE)
  assert.equal(result.hits.length, 2)
  const anchor = anchorFromParents({ result, parents: [head, merge] })
  assert.equal(anchor, 1)
  const d = decide({ judged: [result], anchor: new Map([[REL, anchor]]), ledger, today, face: 'staged' })
  assert.equal(d.violations.length, 1, '超出两父最大值的那一处必须判红')
  assert.match(d.violations[0].why, /本次新增 1 处/)
  t.diagnostic('双父: 2 > 1 ⇒ red(真新增 1 处)')
})

test('M3 非合并提交(父集只有 HEAD)⇒ 有效锚点逐字等于 HEAD 命中数', () => {
  const result = j(TWO)
  const head = j(TWO)
  const anchor = anchorFromParents({ result, parents: [head] })
  assert.equal(anchor, head.hits.length)
  const d = decide({ judged: [result], anchor: new Map([[REL, anchor]]), ledger, today, face: 'staged' })
  assert.equal(d.violations.length, 0)
  assert.equal(d.stock.length, 1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
