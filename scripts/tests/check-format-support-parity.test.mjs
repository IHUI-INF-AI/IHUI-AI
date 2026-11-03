#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-format-support-parity.test.mjs — 镜像测试(§22c:判据 import 源脚本 __test__,本文件零复制)
 * 数据夹具是本文件的职责;判据(正则/桶/裁决)一律用生产实现。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { __test__ as P } from '../check-format-support-parity.mjs'

const REG = `const EXT_MIME_MAP: Record<string, string[]> = {
  pdf: ['application/pdf'],
  zip: ['application/zip'],
  txt: ['text/plain'],
}`

test('R 面登记解析走生产实现,六面登记表形状锁(1 基准 + 6 实现面)', () => {
  const r = P.parseRegistryMap(REG)
  assert.deepEqual(r.exts.sort(), ['pdf', 'txt', 'zip'])
  assert.equal(r.mimeToExt.get('application/pdf'), 'pdf')
  assert.equal(P.FACES[0].role, 'registry')
  assert.equal(P.FACES.filter((f) => f.role !== 'registry').length, 6)
})

test('空头必须被 buildBuckets 判进②桶(反向锁的根)', () => {
  const reg = P.parseRegistryMap(REG)
  const b = P.buildBuckets(reg.exts, [{ key: 'A', present: true, exts: new Set(['pdf', 'txt']) }])
  assert.deepEqual(b.hollow, ['zip'])
  assert.equal(b.facesBroken.length, 0)
  const v = P.verdict(b, reg.exts.length)
  assert.equal(v.state, 'drift')
  assert.equal(v.exit, P.EXIT.drift)
})

test('面取不到/枚举 0 候选 ⇒ unjudged 顶红,绝不并桶成 drift 或 ok', () => {
  const vb = P.buildBuckets(['pdf'], [{ key: 'M', present: false, exts: [], reason: '读不到' }])
  const v1 = P.verdict(vb, 1)
  assert.equal(v1.state, 'unjudged')
  assert.equal(v1.exit, P.EXIT.unjudged)
  const ve = P.buildBuckets(['pdf'], [{ key: 'M', present: true, exts: new Set() }])
  assert.equal(P.verdict(ve, 1).state, 'unjudged')
})

test('纯排版差异不改判:换序/注释/缩进后的 R 面扩展名集逐字节等值', () => {
  const a = P.parseRegistryMap(REG)
  const b = P.parseRegistryMap(`const EXT_MIME_MAP: Record<string, string[]> = {
  // 注释、换序、别种引号
  txt: ["text/plain"],
  zip: ['application/zip'],
  pdf: ['application/pdf'],
}`)
  assert.deepEqual([...a.exts].sort(), [...b.exts].sort())
})

test('面旗纪律:--staged 被点名拒绝(本尺不进提交链),默认 head', () => {
  assert.ok(P.resolveFace(['--staged']).error.includes('提交链'))
  assert.ok(P.resolveFace(['--staged', '--worktree']).error)
  assert.equal(P.resolveFace([]).face, 'head')
  assert.equal(P.resolveFace(['--worktree']).face, 'worktree')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
