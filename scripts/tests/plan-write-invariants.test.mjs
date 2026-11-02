// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:plan-write-invariants-test

/**
 * 写盘不变量库的镜像测试(2026-11-03 立)。六条判据各给正例 + 反例;判据 5 拆成
 * 逐字重复与租约重复两组,两组都各给正反例,避免"只测了一半"。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  WHOLE_DOC_MIN_NONBLANK,
  checkPlanWriteInvariants,
} from '../lib/plan-write-invariants.mjs'

const taskRows = (family, from, to) =>
  Array.from(
    { length: to - from + 1 },
    (_, i) => `- [ ] ${family}-${from + i} 第 ${from + i} 号任务登记行,正文足够长以稳定判据。`,
  )

const BASE = ['# 计划', ...taskRows('G', 1, 12)].join('\n')
const OTHER = ['# 计划(新基线)', ...taskRows('Q', 1, 12)].join('\n')
const lease = (seg = 'G-101~G-120') =>
  `- [x] G-120 〔千段租约〕 本机=M1 段=${seg}(取号器专用行:占用面只取本行主键=段尾号;段内连号自段首起)`

const codes = (res) => res.violations.map((v) => v.code)

test('判据 1 正例:同号不增,新增一条新号行(已声明)⇒ ok', () => {
  const res = checkPlanWriteInvariants({
    before: BASE,
    after: `${BASE}\n- [ ] G-13 新增的第十三号任务,正文足够长以稳定判据。`,
    declaredAdditions: 1,
  })
  assert.equal(res.ok, true, JSON.stringify(res.violations))
})

test('判据 1 反例:同号 after 多于 before ⇒ same-id-grew 并点名新增行号', () => {
  const res = checkPlanWriteInvariants({
    before: BASE,
    after: `${BASE}\n- [ ] G-1 重复登记的同号行,正文与首行不同以免落到逐字重复判据。`,
    declaredAdditions: 1,
  })
  assert.equal(res.ok, false)
  assert.deepEqual(codes(res), ['same-id-grew'])
  assert.deepEqual(res.violations[0].lines, [14])
  assert.match(res.violations[0].message, /G-1/)
})

test('判据 2 正例:空行减少(非空行不变)⇒ ok', () => {
  const res = checkPlanWriteInvariants({ before: `${BASE}\n\n`, after: BASE })
  assert.equal(res.ok, true, JSON.stringify(res.violations))
})

test('判据 2 反例:空行增加 ⇒ blank-grew(稠密格式)', () => {
  const res = checkPlanWriteInvariants({
    before: BASE,
    after: BASE.replace('\n', '\n\n'),
  })
  assert.equal(res.ok, false)
  assert.deepEqual(codes(res), ['blank-grew'])
  assert.ok(res.violations[0].lines.includes(2))
})

test('判据 3 正例:删一行且已声明 ⇒ ok', () => {
  const after = BASE.split('\n')
    .filter((l) => !l.startsWith('- [ ] G-7 '))
    .join('\n')
  const res = checkPlanWriteInvariants({ before: BASE, after, declaredDeletions: 1 })
  assert.equal(res.ok, true, JSON.stringify(res.violations))
})

test('判据 3 反例:删一行未声明 ⇒ undeclared-deletion 点名被删行号', () => {
  const after = BASE.split('\n')
    .filter((l) => !l.startsWith('- [ ] G-7 '))
    .join('\n')
  const res = checkPlanWriteInvariants({ before: BASE, after })
  assert.equal(res.ok, false)
  assert.deepEqual(codes(res), ['undeclared-deletion'])
  assert.deepEqual(res.violations[0].lines, [8])
  assert.match(res.violations[0].message, /非空行 13 → 12/)
})

test('判据 4 正例:加一行且已声明 ⇒ ok', () => {
  const res = checkPlanWriteInvariants({
    before: BASE,
    after: `${BASE}\n- [ ] G-14 新增的第十四号任务,正文足够长以稳定判据。`,
    declaredAdditions: 1,
  })
  assert.equal(res.ok, true, JSON.stringify(res.violations))
})

test('判据 4 反例:加一行未声明 ⇒ undeclared-addition 点名新增行号', () => {
  const res = checkPlanWriteInvariants({
    before: BASE,
    after: `${BASE}\n- [ ] G-14 新增的第十四号任务,正文足够长以稳定判据。`,
  })
  assert.equal(res.ok, false)
  assert.deepEqual(codes(res), ['undeclared-addition'])
  assert.deepEqual(res.violations[0].lines, [14])
})

test('判据 5a 正例:逐字重复组减一份(已声明)⇒ ok', () => {
  const before = `${BASE}\n## 备注\n## 备注`
  const after = `${BASE}\n## 备注`
  const res = checkPlanWriteInvariants({ before, after, declaredDeletions: 1 })
  assert.equal(res.ok, true, JSON.stringify(res.violations))
})

test('判据 5a 反例:逐字重复组增一份 ⇒ verbatim-dup-grew(即使声明新增也不行)', () => {
  const before = `${BASE}\n## 备注`
  const after = `${BASE}\n## 备注\n## 备注`
  const res = checkPlanWriteInvariants({ before, after, declaredAdditions: 1 })
  assert.equal(res.ok, false)
  assert.deepEqual(codes(res), ['verbatim-dup-grew'])
  assert.deepEqual(res.violations[0].lines, [15])
})

test('判据 5b 正例:租约行每键只有一行 ⇒ ok', () => {
  const res = checkPlanWriteInvariants({
    before: BASE,
    after: `${BASE}\n${lease()}`,
    declaredAdditions: 1,
  })
  assert.equal(res.ok, true, JSON.stringify(res.violations))
})

test('判据 5b 反例:租约同 (族,机器,段) 两行 ⇒ lease-dup 点名两行行号', () => {
  const res = checkPlanWriteInvariants({
    before: BASE,
    after: `${BASE}\n${lease()}\n${lease('G-101~G-120')}`,
    declaredAdditions: 2,
  })
  assert.equal(res.ok, false)
  assert.ok(codes(res).includes('lease-dup'), JSON.stringify(res.violations))
  const leaseViolation = res.violations.find((v) => v.code === 'lease-dup')
  assert.deepEqual(leaseViolation.lines, [14, 15])
  assert.equal(leaseViolation.detail.machine, 'M1')
  assert.equal(leaseViolation.detail.segment, 'G:101~120')
})

test('判据 6 正例:整档替换带书面背书 ⇒ ok(新增/删除都如实声明)', () => {
  const res = checkPlanWriteInvariants({
    before: BASE,
    after: OTHER,
    declaredAdditions: 12,
    declaredDeletions: 12,
    wholeDocAttestation: '人工整档换版:来源=旧基线归档件,理由=重排任务域',
  })
  assert.equal(res.ok, true, JSON.stringify(res.violations))
})

test('判据 6 反例:整档替换未背书 ⇒ whole-doc-without-attestation', () => {
  const res = checkPlanWriteInvariants({
    before: BASE,
    after: OTHER,
    declaredAdditions: 12,
    declaredDeletions: 12,
  })
  assert.equal(res.ok, false)
  assert.deepEqual(codes(res), ['whole-doc-without-attestation'])
  assert.ok(res.violations[0].detail.ratio > 0.5)
})

test('判据 6 反例:整档清空未背书 ⇒ whole-doc-without-attestation(wipe)', () => {
  const res = checkPlanWriteInvariants({ before: BASE, after: '', declaredDeletions: 13 })
  assert.equal(res.ok, false)
  assert.deepEqual(codes(res), ['whole-doc-without-attestation'])
  assert.equal(res.violations[0].detail.wipe, true)
})

test('边界:小档(< WHOLE_DOC_MIN_NONBLANK)局部改写不误判整档替换;非法声明记 invalid-input', () => {
  const tiny = '# 计划\n- [ ] G-1 甲'
  const res = checkPlanWriteInvariants({ before: tiny, after: '# 计划' })
  assert.equal(res.ok, false, '删 G-1 未声明仍要红')
  assert.ok(codes(res).includes('undeclared-deletion'))
  assert.ok(!codes(res).includes('whole-doc-without-attestation'))
  assert.ok(tiny.split('\n').filter((l) => l.trim()).length < WHOLE_DOC_MIN_NONBLANK)
  const bad = checkPlanWriteInvariants({ before: BASE, after: BASE, declaredAdditions: -1 })
  assert.deepEqual(codes(bad), ['invalid-input'])
})
