// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试 —— 直接 import 源脚本 `__test__`,不复制判据。
// 钉四件只有源码级锁能防的事:
//   ① **缺陷形态复现**:`transform` 会把 rnSpacing 写进正文;若 import 判据写成"全文含该符号",
//      就永远不会补齐 import ⇒ 落出悬空标识符。实测这一型一次产生 79 文件 / 1386 处 TS2304。
//   ② 档外值/块外键/含 Platform. 的行一律不动(器等值改写是"像素零变化"的前提)。
//   ③ 幂等:对已改写文本再跑一次必须 0 处。
//   ④ 写盘形态:clean → 改 → inject → verify 四步齐备(§5c 禁止对含载荷文件裸改写)。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { __test__ as src } from '../land-rn-style-tiers.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const { transform, ensureImport, hasSymbolImport } = src

const TIER = new Map([
  [2, '2xs'],
  [6, 'xs-loose'],
  [8, 'sm'],
  [10, 'sm-loose'],
  [12, 'md'],
])

const SRC = `
import { StyleSheet } from 'react-native'

const s = StyleSheet.create({
  a: { paddingHorizontal: 10, gap: 6, marginTop: -8 },
  b: { padding: 14, gap: 3 },
  c: { padding: Platform.OS === 'ios' ? 10 : 12 },
  d: { padding: 0 },
})
const cfg = { padding: 10 }
`

test('① 缺陷形态:改写后的正文不得被当成已 import,且补 import 必须真的补上', () => {
  const r = transform(SRC, TIER)
  assert.ok(r.text.includes('rnSpacing'), '夹具前提:改写确实引入了 rnSpacing')
  assert.equal(hasSymbolImport(r.text, 'rnSpacing'), false, '正文提及 ≠ 已 import(这一条错了就会落出 TS2304)')
  const fixed = ensureImport(r.text, 'rnSpacing')
  assert.equal(fixed.added, true)
  assert.equal(hasSymbolImport(fixed.text, 'rnSpacing'), true)
})

test('② 只改等值命中档的间距数(块外/档外/Platform 行/0 都不动)', () => {
  const t = transform(SRC, TIER).text
  assert.ok(t.includes("paddingHorizontal: rnSpacing['sm-loose']"))
  assert.ok(t.includes("gap: rnSpacing['xs-loose']"))
  assert.ok(t.includes('marginTop: -rnSpacing.sm'), '负值保留符号')
  assert.ok(t.includes('padding: 14'), '档外值不得动')
  assert.ok(t.includes('gap: 3'), '档外值不得动')
  assert.ok(t.includes("Platform.OS === 'ios' ? 10 : 12"), '按平台分叉的行整行跳过')
  assert.ok(t.includes('padding: 0'), '0 不改')
  assert.ok(t.includes('const cfg = { padding: 10 }'), 'StyleSheet 块外同名键不动')
})

test('③ 幂等:对已改写文本再跑必须 0 处', () => {
  const once = transform(SRC, TIER).text
  assert.equal(transform(once, TIER).changes.length, 0)
})

test('④ 写盘四步齐备(clean→改→inject→verify 都在源码里,§5c)', () => {
  const body = readFileSync(resolve(ROOT, 'scripts/land-rn-style-tiers.mjs'), 'utf8')
  for (const step of ["watermark('clean'", "watermark('inject'", "watermark('verify'"]) {
    assert.ok(body.includes(step), `缺少 ${step}):对含载荷文件裸改写会毁零宽链`)
  }
  // 归属避让:不得把"脏=我改的"当成可写;必须有 held 桶
  assert.match(body, /report\.held\.push/, '必须保留他人持有跳过面')
  // 悬空标识符落盘后必须按 import 语句复核(多腿按改动集合逐个核)
  assert.match(body, /hasSymbolImport\(after, sym\)/, '落盘后必须按 import 语句复核,不是全文含')
})

// ⑤ 字号/圆角腿(2026-11-02 Phase 2):显式开关才动,且必须保住"字号↔行高"配对。
test('⑤ 字号腿只动无 lineHeight 的对象;圆角同值双档取角色档;默认面不碰这两腿', () => {
  const FIX = `
  const s = StyleSheet.create({
    plain: { fontSize: 14 },
    paired: { fontSize: 16, lineHeight: 24 },
    rounded: { borderRadius: 8 },
  })
  const out = { fontSize: 14 }
  `
  const typeTier = new Map([
    [12, 'label'],
    [14, 'body'],
    [16, 'title'],
  ])
  const radiusTier = new Map([
    [4, 'sm'],
    [8, 'lg'],
  ])
  const def = transform(FIX, TIER)
  assert.ok(def.text.includes('fontSize: 14'), '默认面不得碰字号')
  assert.ok(def.text.includes('borderRadius: 8'), '默认面不得碰圆角')

  const fs = transform(FIX, TIER, { typeByValue: typeTier })
  assert.ok(fs.text.includes('fontSize: rnType.body.size'), '无 lineHeight ⇒ 等值可落档')
  assert.ok(fs.text.includes('fontSize: 16, lineHeight: 24'), '同对象带 lineHeight ⇒ 不动(否则字号跟了行高没跟)')
  assert.ok(fs.text.includes('const out = { fontSize: 14 }'), 'StyleSheet 块外不动')
  assert.equal(transform(fs.text, TIER, { typeByValue: typeTier }).changes.length, 0, '二次改 0 处')

  const rd = transform(FIX, TIER, { radiusByValue: radiusTier })
  assert.ok(rd.text.includes('borderRadius: rnRadius.lg'), '8px 双档名取角色表在用的 lg')
})

// ⑥ 成对腿(2026-11-02 Phase 3):仅当 size 与 lineHeight 同时精确等于同一档才整对象替换
test('⑥ 成对腿:两值同档才换,四种拒绝原因分桶,不得注入 weight', () => {
  const FIX = `
  const s = StyleSheet.create({
    ok: { fontSize: 14, lineHeight: 20 },
    mismatch: { fontSize: 14, lineHeight: 22 },
    nonLiteral: { fontSize: 14, lineHeight: 1.4 * 14 },
    ambiguous: { fontSize: 14, lineHeight: 20, lineHeight: 22 },
    plain: { fontSize: 14 },
  })
  const cfg = { fontSize: 14, lineHeight: 20 }
  `
  const typeTier = new Map([
    [12, 'label'],
    [14, 'body'],
    [16, 'title'],
  ])
  const pairTier = new Map([
    ['12|16', 'label'],
    ['14|20', 'body'],
    ['16|24', 'title'],
  ])
  const opts = { typeByValue: typeTier, pairByValue: pairTier, fontSizePairsOnly: true }
  const r = transform(FIX, TIER, opts)
  assert.ok(r.text.includes('fontSize: rnType.body.size, lineHeight: rnType.body.lineHeight'), '同档两值必须一起换')
  assert.ok(r.text.includes('fontSize: 14, lineHeight: 22'), '行高不等值 ⇒ 整个对象不动')
  assert.ok(r.text.includes('lineHeight: 1.4 * 14'), '行高非字面量 ⇒ 整个对象不动')
  assert.ok(r.text.includes('ambiguous: { fontSize: 14, lineHeight: 20, lineHeight: 22 }'), '顶层多行高 ⇒ 整个对象不动')
  assert.ok(r.text.includes('plain: { fontSize: 14 }'), '无行高的 fontSize 不属本腿')
  assert.ok(r.text.includes('cfg = { fontSize: 14, lineHeight: 20 }'), 'StyleSheet 块外不动')
  assert.ok(!r.text.includes('weight'), '禁止 ...rnType 展开:不得把 weight 注入')
  assert.equal(r.skipped.pairMismatch, 1)
  assert.equal(r.skipped.pairNonLiteral, 1)
  assert.equal(r.skipped.pairAmbiguous, 1)
  assert.equal(r.skipped.pairNoLineHeight, 1)
  assert.equal(transform(r.text, TIER, opts).changes.length, 0, '二次改 0 处')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
