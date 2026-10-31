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
  // 悬空标识符落盘后必须按 import 语句复核
  assert.match(body, /hasSymbolImport\(after, 'rnSpacing'\)/, '落盘后必须按 import 语句复核,不是全文含')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
