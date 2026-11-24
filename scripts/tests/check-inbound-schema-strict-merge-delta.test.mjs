// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 161 的合并面基准:新增集合 = 结果面有且每一枚父提交(HEAD ∪ MERGE_HEAD)都没有。
// 这里只测「锚点怎么算」,门体判据 `读数 > 锚点` 一个字不动。
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ } from '../check-inbound-schema-strict.mjs'

const { judgeFile, inboundAnchors, FIXTURES } = __test__

/** 干净基线:零裸入站契约。 */
const EMPTY = 'const unrelated = 1\n'
/** 合并结果:上游带入一枚裸契约(bareOneConsumer) + 本次真新增一枚。 */
const TWO = `${FIXTURES.bareOneConsumer}
const q2Schema = z.object({ id: z.string() })
const p3 = q2Schema.safeParse(request.headers)`

test('M1 合并带入的既有裸入站契约 ⇒ 锚点上移,不判红', (t) => {
  const result = judgeFile(TWO)
  assert.equal(result.counts.bareInbound, 2, '夹具读数:两枚裸契约')
  assert.equal(result.counts.bareSites, 2, '夹具读数:两个入站消费点')

  const head = judgeFile(EMPTY) // 旧基准:只看 HEAD ⇒ 0
  const merge = judgeFile(TWO) // 上游既有 ⇒ 2
  const naiveRed = result.counts.bareInbound > head.counts.bareInbound
  const cap = inboundAnchors({ result, parents: [head, merge] })
  assert.equal(naiveRed, true, '单父基准会把上游带入的 2 枚判成本次新增')
  assert.equal(cap.bareInbound, 2, '双父基准:有效锚点 = 2')
  assert.equal(cap.bareSites, 2, '双父基准:入站消费点锚点 = 2')
  assert.ok(!(result.counts.bareInbound > cap.bareInbound), '裸契约份数不得判红')
  assert.ok(!(result.counts.bareSites > cap.bareSites), '入站消费点不得判红')
  t.diagnostic('naive: 读数 2 vs 锚点 0 ⇒ red;双父: 读数 2 vs 锚点 2 ⇒ green')
})

test('M2 合并里真新增一枚裸契约 ⇒ 判红', (t) => {
  const result = judgeFile(TWO)
  const head = judgeFile(EMPTY)
  const merge = judgeFile(FIXTURES.bareOneConsumer) // 上游只有 1 枚
  const cap = inboundAnchors({ result, parents: [head, merge] })
  assert.equal(cap.bareInbound, 1)
  assert.equal(cap.bareSites, 1)
  assert.ok(result.counts.bareInbound > cap.bareInbound, '超出两父最大值的那一枚必须判红')
  assert.ok(result.counts.bareSites > cap.bareSites, '多出来的消费点也必须判红')
  t.diagnostic('双父: 读数 2 vs 锚点 1 ⇒ red(真新增 1 枚契约 + 1 个消费点)')
})

test('M3 非合并提交(父集只有 HEAD)⇒ 有效锚点逐字等于 HEAD 读数', () => {
  const result = judgeFile(FIXTURES.bareTwoConsumers)
  const head = judgeFile(FIXTURES.bareOneConsumer)
  const cap = inboundAnchors({ result, parents: [head] })
  assert.equal(cap.bareInbound, head.counts.bareInbound)
  assert.equal(cap.bareSites, head.counts.bareSites)
  // 旧判据的两种结局都保持不变:份数持平 ⇒ 绿;多一个消费点 ⇒ 红。
  assert.ok(!(result.counts.bareInbound > cap.bareInbound))
  assert.ok(result.counts.bareSites > cap.bareSites)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
