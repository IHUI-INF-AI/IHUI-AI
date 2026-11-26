#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  DEFAULT_REPORT,
  checkQaEvidence,
  fixture,
  selfTest,
} from '../check-qa-evidence.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')

test('原始夹具六判据全绿', () => {
  const result = checkQaEvidence(fixture())
  assert.equal(result.pass, true)
  assert.deepEqual(result.violations, [])
})

test('先例账本 JSON 真源通过，账本文件缺失只 warn 不阻断', () => {
  const doc = JSON.parse(readFileSync(resolve(repoRoot, DEFAULT_REPORT), 'utf8'))
  const result = checkQaEvidence(doc, { repoRoot })
  assert.equal(result.pass, true, result.violations.join('; '))
  assert.ok(Array.isArray(result.warnings))
})

test('B1 三档定义缺失被判红', () => {
  const doc = fixture()
  delete doc.meta.evidence_tier_definition.unknown
  const result = checkQaEvidence(doc)
  assert.equal(result.pass, false)
  assert.ok(result.violations.some((v) => v.startsWith('B1')))
})

test('B3 产品级条目无账本声明被判红', () => {
  const doc = fixture()
  doc.evidence_level_summary.product_loop[0].ledgers = []
  const result = checkQaEvidence(doc)
  assert.equal(result.pass, false)
  assert.ok(result.violations.some((v) => v.startsWith('B3')))
})

test('B4 产品级条目出现未知档措辞被判红', () => {
  const doc = fixture()
  doc.evidence_level_summary.product_loop[0].boundary = '仍属未知'
  const result = checkQaEvidence(doc)
  assert.equal(result.pass, false)
  assert.ok(result.violations.some((v) => v.startsWith('B4')))
})

test('B5 把 401 写成模型闭环被判红', () => {
  const doc = fixture()
  doc.evidence_level_summary.product_loop[0].evidence = '401 即模型闭环输出'
  const result = checkQaEvidence(doc)
  assert.equal(result.pass, false)
  assert.ok(result.violations.some((v) => v.startsWith('B5')))
})

test('B6 phase 快照与模型输出同一段被判红', () => {
  const doc = fixture()
  doc.evidence_level_summary.product_loop[0].phase_snapshot = { value: 'x' }
  doc.evidence_level_summary.product_loop[0].model_output = { value: 'x' }
  const result = checkQaEvidence(doc)
  assert.equal(result.pass, false)
  assert.ok(result.violations.some((v) => v.startsWith('B6')))
})

test('--self-test 六条变异逐条咬合', () => {
  assert.equal(selfTest(), 6)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
