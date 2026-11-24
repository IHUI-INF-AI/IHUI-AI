// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/generated-input-pin.mjs` 的 `renderStablePin` 镜像测试(2026-11-11 立)。
 *
 * 为什么必须钉住它:该函数是「生成物自述钉」从 `renderPin` 分出来的**写入侧收敛**实现 ——
 * 输入未变时沿用旧钉的 `sourceCommit` / `generatedAt`,使产物**逐字节不变**。它一旦被改坏,
 * 后果不是"报错"而是**静默复活一条自激链**:产物字节每次必变 ⇒ 新 blobOid ⇒ 落点账本判可收编
 * ⇒ 自动链落一枚「派生产物按 HEAD 面重生成」的提交 ⇒ HEAD 变 ⇒ 下一轮再来(全史已积 209 枚)。
 * 这条链的失效形态是"多出提交",没有任何门会因为"提交变多"而红,所以行为只能靠测试钉。
 *
 * 判据口径(与 AGENTS §0.6 一致):断言直接 import 源脚本,不复制一份哈希/比对的尺子。
 * 本文件只钉 `renderStablePin` 的四个收敛条件与一个兜底,不重复 `renderPin` 自身的渲染形态
 * (那部分由 `check-generated-pin-face.test.mjs` 与门 105 覆盖)。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parsePin, renderPin, renderStablePin } from '../lib/generated-input-pin.mjs'

const GEN = 'apps/web/scripts/generate-ui-routes.mjs'
const OTHER_GEN = 'apps/mobile-rn/scripts/generate-ui-routes.mjs'
const INPUTS = [{ rel: 'apps/web/src/app/page.tsx', text: 'export default function Page() { return null }' }]
const COMMIT_A = 'a'.repeat(40)
const COMMIT_B = 'b'.repeat(40)
const T1 = '2026-11-11T00:00:00.000Z'
const T2 = '2026-11-11T06:00:00.000Z'

/** 造一份"磁盘上已有的产物钉"(渲染成文本,与生成器落盘形态一致:行数组 join 换行)。 */
function pinText({ generator = GEN, sourceCommit = COMMIT_A, inputs = INPUTS, generatedAt = T1 } = {}) {
  return renderPin({ generator, sourceCommit, inputs, generatedAt }).join('\n')
}

test('阳性对照:输入未变 ⇒ 沿用旧钉的 sourceCommit 与 generatedAt,产物逐字节不变', () => {
  const prev = pinText()
  const lines = renderStablePin({
    generator: GEN,
    sourceCommit: COMMIT_B, // 此刻 HEAD 已前移 —— 旧实现在这里必然改字节
    inputs: INPUTS,
    generatedAt: T2,
    existingText: prev,
  })
  // 核心断言:不是"哈希相同",而是**整段文本逐字节相同**(自激链的唯一判据就是字节变没变)
  assert.equal(lines.join('\n'), prev)
  const parsed = parsePin(lines.join('\n'))
  assert.equal(parsed.generator, GEN)
  assert.equal(parsed.sourceCommit, COMMIT_A)
  assert.equal(parsed.generatedAt, T1)
})

test('阴性对照:输入变了 ⇒ 照常渲染新钉,不得沿用旧值', () => {
  const prev = pinText()
  const changed = [{ rel: 'apps/web/src/app/page.tsx', text: 'export default function Page() { return 1 }' }]
  const lines = renderStablePin({
    generator: GEN,
    sourceCommit: COMMIT_B,
    inputs: changed,
    generatedAt: T2,
    existingText: prev,
  })
  const parsed = parsePin(lines.join('\n'))
  assert.equal(parsed.sourceCommit, COMMIT_B)
  assert.equal(parsed.generatedAt, T2)
  assert.notEqual(parsed.digest, parsePin(prev).digest)
})

test('阴性对照:generator 不同名 ⇒ 不沿用(防跨生成器误抄钉)', () => {
  const prev = pinText({ generator: OTHER_GEN })
  const lines = renderStablePin({
    generator: GEN,
    sourceCommit: COMMIT_B,
    inputs: INPUTS,
    generatedAt: T2,
    existingText: prev,
  })
  const parsed = parsePin(lines.join('\n'))
  assert.equal(parsed.generator, GEN)
  assert.equal(parsed.sourceCommit, COMMIT_B)
  assert.equal(parsed.generatedAt, T2)
})

test('边界:existingText 为 null(产物不存在)⇒ 等同 renderPin 首次渲染', () => {
  const lines = renderStablePin({ generator: GEN, sourceCommit: COMMIT_B, inputs: INPUTS, generatedAt: T2 })
  const expected = renderPin({ generator: GEN, sourceCommit: COMMIT_B, inputs: INPUTS, generatedAt: T2 })
  assert.deepEqual(lines, expected)
  assert.equal(parsePin(lines.join('\n')).generatedAt, T2)
})

test('阴性对照:旧钉残缺(malformed)⇒ 判不出就不沿用,照常渲染', () => {
  const broken = [`// IHUI-GEN-PIN-BEGIN`, `// generator: ${GEN}`, `// IHUI-GEN-PIN-END`].join('\n')
  const lines = renderStablePin({
    generator: GEN,
    sourceCommit: COMMIT_B,
    inputs: INPUTS,
    generatedAt: T2,
    existingText: broken,
  })
  const parsed = parsePin(lines.join('\n'))
  assert.equal(parsed.generatedAt, T2)
  assert.equal(parsed.sourceCommit, COMMIT_B)
})

test('边界:旧产物里根本没有钉 ⇒ 不沿用(不是"空 digest 相等"就算命中)', () => {
  const lines = renderStablePin({
    generator: GEN,
    sourceCommit: COMMIT_B,
    inputs: INPUTS,
    generatedAt: T2,
    existingText: 'export const routes = []\n',
  })
  const parsed = parsePin(lines.join('\n'))
  assert.equal(parsed.generatedAt, T2)
  assert.equal(parsed.sourceCommit, COMMIT_B)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
