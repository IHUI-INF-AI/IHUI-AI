// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import test from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as p } from '../lib/rn-percent-height-policy.mjs'

const REL = 'apps/mobile-rn/src/screens/SomeSheet.tsx'

test('百分比 maxHeight / minHeight 一律判违规,不给 bounded 容器开后门', () => {
  const src = `const s = StyleSheet.create({ sheet: { maxHeight: '70%', minHeight: '40%' } })`
  const hits = p.findPercentHeightViolations(src, REL).filter((h) => !h.allowed)
  assert.equal(hits.length, 2)
  assert.deepEqual(
    hits.map((h) => h.prop),
    ['maxHeight', 'minHeight'],
  )
  assert.match(hits[0].reason, /Fabric/)
})

test('单引号 / 双引号 / 模板串三种字面量一视同仁', () => {
  for (const q of ["'", '"', '`']) {
    const src = `const s = { sheet: { maxHeight: ${q}85%${q} } }`
    const hits = p.findPercentHeightViolations(src, REL).filter((h) => !h.allowed)
    assert.equal(hits.length, 1, `引号 ${q} 必须被判`)
    assert.equal(hits[0].percent, 85)
  }
})

test("height:'100%' 是撑满形态,放行", () => {
  const src = `const s = { root: { flex: 1, height: '100%' } }`
  assert.deepEqual(p.findPercentHeightViolations(src, REL), [])
})

test('非 100% 的 height 未登记豁免即判违规(含共享层路径)', () => {
  for (const rel of [REL, 'packages/app/src/features/x/Sheet.tsx']) {
    const src = `const s = { sheet: { height: '80%' } }`
    const hits = p.findPercentHeightViolations(src, rel).filter((h) => !h.allowed)
    assert.equal(hits.length, 1, rel)
  }
})

test('四条图片内容比例豁免逐行生效:键名不在邻近即失效', () => {
  for (const e of p.PERCENT_HEIGHT_EXEMPTIONS) {
    const good = `const s = StyleSheet.create({ ${e.key}: { width: '100%', height: '${e.percent}%' } })`
    const hits = p.findPercentHeightViolations(good, e.rel)
    assert.equal(hits.length, 1, e.rel)
    assert.equal(hits[0].allowed, true, e.rel)
    assert.equal(hits[0].exemptionKey, p.exemptionKeyOf(e))

    const bad = `const s = StyleSheet.create({ anotherKey: { width: '100%', height: '${e.percent}%' } })`
    const badHits = p.findPercentHeightViolations(bad, e.rel).filter((h) => !h.allowed)
    assert.equal(badHits.length, 1, `${e.rel} 换键名后必须红`)
  }
})

test('豁免清单腐烂(登记了但审面没命中)必须报出', () => {
  const all = new Set(p.PERCENT_HEIGHT_EXEMPTIONS.map(p.exemptionKeyOf))
  assert.deepEqual(p.exemptionRotCheck(all), [])
  const missing = new Set(all)
  missing.delete(p.exemptionKeyOf(p.PERCENT_HEIGHT_EXEMPTIONS[0]))
  assert.deepEqual(p.exemptionRotCheck(missing), [p.exemptionKeyOf(p.PERCENT_HEIGHT_EXEMPTIONS[0])])
})

test('豁免到期即失效(验过才免且会到期)', () => {
  assert.equal(p.exemptionExpired(new Date('2026-11-06T00:00:00Z')), false)
  assert.equal(p.exemptionExpired(new Date('2028-01-01T00:00:00Z')), true)
})

test('扫描面同时覆盖 RN 端与共享层,扩展名含 ts/tsx/js/jsx', () => {
  assert.deepEqual(p.PERCENT_HEIGHT_SCAN_RELS, ['apps/mobile-rn/src', 'packages/app/src'])
  for (const f of ['a.tsx', 'b.ts', 'c.js', 'd.jsx']) assert.equal(p.SCAN_EXT_RE.test(f), true)
  assert.equal(p.SCAN_EXT_RE.test('a.css'), false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
