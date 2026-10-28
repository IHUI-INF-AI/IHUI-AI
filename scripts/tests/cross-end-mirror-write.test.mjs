#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 测试需逐条打印用例结论 */

/**
 * 镜像测试:跨端镜像写入纪律与判定台账(两个单源 lib)。
 *
 * §22c:判据全部 import 源脚本的 __test__,本文件**不复制第二份实现** ——
 * 复制出来的那份必然漂移(标记形态改一次,测试还在测旧形态 ⇒ 测试绿而尺子已废)。
 *
 * 钉住的三族失效型:
 * ① 标记形态漂移 —— 写出去的标记必须仍被门 128 的尺子认得(MARK_RE 命中);
 * ② 插入点漂移 —— 标记必须排在版权/溯源横幅之后,不能盖住横幅;
 * ③ 处置权覆盖 —— 该页已被别席声明时,本枚必须拒落(不覆盖别席的声明);
 * ④ 台账语义漂移 —— 坏行不许被静默吞掉(吞了就等于把"读不出来"记成"台账是空")。
 */
import assert from 'node:assert/strict'
import { __test__ as W } from '../lib/cross-end-mirror-write.mjs'
import { __test__ as V } from '../lib/cross-end-verdicts.mjs'
import { __test__ as cov } from '../check-cross-end-screen-coverage.mjs'

const results = []
const test = (name, fn) => results.push({ name, fn })

const SPEC = 'packages/app/src/features/coupon/CouponScreen.tsx'
const OTHER = 'packages/app/src/features/help/HelpScreen.tsx'
const BANNER = [
  '// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top',
  '// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。',
  '// [IHUI-AI-PROVENANCE]:hidden',
  '',
].join('\n')

test('M1 写出的标记必须被门 128 的 MARK_RE 认得(形态不漂移)', () => {
  const text = `${BANNER}import x from 'y'\n`
  const r = W.insertMirrorMarker(text, SPEC)
  assert.equal(r.done, true)
  // 门 128 的尺子必须命中这一行
  const hay = `${r.text}\n`
  const m = [...hay.matchAll(cov.MARK_RE)]
  assert.equal(m.length, 1, 'MARK_RE 应恰好命中一处')
  assert.equal(m[0][1], 'coupon')
  assert.equal(m[0][2], 'Coupon', 'MARK_RE 第二组不含 Screen 后缀')
})

test('M2 标记排在版权横幅之后(不盖住溯源行)', () => {
  const text = `${BANNER}import x from 'y'\n`
  const r = W.insertMirrorMarker(text, SPEC)
  const lines = r.text.split('\n')
  const markIdx = lines.findIndex((l) => l.startsWith(W.MIRROR_MARK_PREFIX))
  const provIdx = lines.findIndex((l) => l.startsWith('// [IHUI-AI-PROVENANCE]'))
  assert.ok(provIdx >= 0, '溯源行必须还在')
  assert.ok(markIdx > provIdx, '标记行必须排在溯源行之后')
  assert.ok(lines.some((l) => l.startsWith('// © 2026 IHUI AI')), '版权行必须还在')
})

test('M3 幂等:已有该标记不重复插(重跑不累积)', () => {
  const once = W.insertMirrorMarker(`${BANNER}import x from 'y'\n`, SPEC)
  const twice = W.insertMirrorMarker(once.text, SPEC)
  assert.equal(twice.done, false)
  assert.equal((twice.text.match(/packages\/app\/src\/features\//g) || []).length, 1)
})

test('M4 该页已被别席声明 ⇒ 拒落(不覆盖别席处置权)', () => {
  const text = `${BANNER}// 镜像 ${OTHER}\n\nimport x from 'y'\n`
  const r = W.insertMirrorMarker(text, SPEC)
  assert.equal(r.done, false)
  assert.match(r.why, /别席|不覆盖/)
  assert.ok(r.text.includes(OTHER), '别席的声明必须原样保留')
})

test('M5 非法 spec 拒收(写出去门 128 也读不到 = 等于没写)', () => {
  const r = W.insertMirrorMarker(`${BANNER}import x from 'y'\n`, 'not/a/spec')
  assert.equal(r.done, false)
  assert.equal(W.isSharedSpec('not/a/spec'), false)
  assert.equal(W.isSharedSpec(SPEC), true)
})

test('V1 台账坏行不许静默吞(读不出来 ≠ 台账是空)', () => {
  const { rows, bad } = V.parseVerdictRows(
    [JSON.stringify({ shared: SPEC, verdict: 'missing', evidence: 'x' }), 'not-json', '{"verdict":"missing"}'].join('\n'),
  )
  assert.equal(rows.length, 1)
  assert.equal(bad.length, 2)
  assert.ok(bad.every((b) => b.why))
})

test('V2 非法 verdict 档不入台账(declare 不进台账,它是代码不是台账)', () => {
  const { rows, bad } = V.parseVerdictRows(JSON.stringify({ shared: SPEC, verdict: 'declare' }))
  assert.equal(rows.length, 0)
  assert.equal(bad.length, 1)
  assert.ok(!V.VERDICT_KINDS.includes('declare'))
})

test('V2b generated 档合法(已造页但数据钩子待补 —— 必须能记账,否则覆盖率替功能缺口背书)', () => {
  assert.ok(V.VERDICT_KINDS.includes('generated'), 'generated 档必须被接受')
  const { rows, bad } = V.parseVerdictRows(JSON.stringify({ shared: SPEC, verdict: 'generated', evidence: 'e' }))
  assert.equal(rows.length, 1)
  assert.equal(bad.length, 0)
})

test('V2c 四档口径齐(missing/generated/not-applicable + declare 不在列)', () => {
  assert.deepEqual([...V.VERDICT_KINDS].sort(), ['generated', 'missing', 'not-applicable'])
})

test('V3 归并:同屏以本批为准,新增计数只算新键', () => {
  const existing = [{ shared: SPEC, verdict: 'missing', evidence: 'old' }]
  const batch = [
    { shared: SPEC, verdict: 'not-applicable', evidence: 'new' },
    { shared: OTHER, verdict: 'missing', evidence: 'fresh' },
  ]
  const m = V.mergeVerdictRows(existing, batch)
  assert.equal(m.added, 1, 'SPEC 是改写不是新增')
  assert.equal(m.total, 2)
  const byKey = V.indexVerdicts(m.rows)
  assert.equal(byKey.get(SPEC).verdict, 'not-applicable', '同屏以本批为准')
})

test('V4 序列化键序固定(同一份台账两次落盘长得一样)', () => {
  const s = V.serializeVerdicts([{ shared: SPEC, verdict: 'missing', evidence: 'e', at: '2026-10-25', source: 'b.json' }])
  assert.equal(s, JSON.stringify({ shared: SPEC, verdict: 'missing', evidence: 'e', at: '2026-10-25', source: 'b.json' }))
})

let failed = 0
for (const { name, fn } of results) {
  try {
    fn()
    console.log(`✅ ${name}`)
  } catch (e) {
    failed++
    console.log(`❌ ${name}\n   ${e && e.message ? e.message : e}`)
  }
}
console.log(`\n${results.length - failed}/${results.length} 通过`)
process.exit(failed === 0 ? 0 : 1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
