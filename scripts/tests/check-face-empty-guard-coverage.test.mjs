// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/check-face-empty-guard-coverage.mjs` 的镜像测试(元门 B)。
 *
 * 阴性对照:2026-11-07 的真实失效形态 —— "枚举 0 条后直接返回空结论" —— 必须被判成
 * `missing-guard`;阳性对照:"0 条 ⇒ exit 2 / 未判定" 必须不被判红。
 * 只读盘点门不做语义证明,所以这里同时钉住 helper 的运行时行为(0 条必抛)。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  FaceInputUnavailable,
  assertFaceEnumeration,
  assertFaceRead,
  classifyFaceGateSource,
} from '../lib/face-empty-guard.mjs'

test('运行时:枚举 0 条且未声明确实没有 ⇒ 抛取数面不可用', () => {
  assert.throws(
    () => assertFaceEnumeration({ face: 'staged', stage: 'check-x', count: 0 }),
    (e) => e instanceof FaceInputUnavailable && /取数面不可用/.test(e.message),
  )
})

test('运行时:声明 emptyIsReal 必须给 reason,否则仍是未判定', () => {
  assert.throws(() => assertFaceEnumeration({ face: 'head', count: 0, emptyIsReal: true }), /未判定/)
  const ok = assertFaceEnumeration({ face: 'head', count: 0, emptyIsReal: true, reason: '首次新增,HEAD 面确实没有' })
  assert.equal(ok.empty, true)
})

test('运行时:请求 N 条但可读 0 条 ⇒ 抛取数面不可用', () => {
  assert.throws(
    () => assertFaceRead({ face: 'staged', requested: 12, readable: 0 }),
    (e) => e instanceof FaceInputUnavailable && /正文全部取不到/.test(e.message),
  )
  // 部分可读不触发(逐条 null 的合法缺失交给语义判断)
  assert.equal(assertFaceRead({ face: 'staged', requested: 12, readable: 1 }).ok, true)
})

test('阴性对照:枚举 0 后直接返回空结论 ⇒ missing-guard', () => {
  const src = [
    "const face = process.argv.includes('--staged') ? 'staged' : 'head'",
    'const files = listFaceFiles(root, face)',
    'if (files.length === 0) return { violations: [] }',
  ].join('\n')
  assert.equal(classifyFaceGateSource(src).verdict, 'missing-guard')
})

test('阴性对照:枚举 0 后打印一句但继续判绿 ⇒ missing-guard', () => {
  const src = [
    "const staged = process.argv.includes('--staged')",
    'const files = listFaceFiles(root)',
    'if (files.length === 0) {',
    "  console.log('没有文件')",
    '  return',
    '}',
  ].join('\n')
  assert.equal(classifyFaceGateSource(src).verdict, 'missing-guard')
})

test('阳性对照:0 条 ⇒ exit 2 且明说取数面不可用 ⇒ guarded', () => {
  const src = [
    "if (process.argv.includes('--staged')) face = 'staged'",
    'const files = listFaceFiles(root, face)',
    'if (files.length === 0) {',
    "  console.error('未判定:取数面不可用')",
    '  process.exit(2)',
    '}',
  ].join('\n')
  assert.equal(classifyFaceGateSource(src).verdict, 'guarded')
})

test('阳性对照:走统一 helper(assertFaceEnumeration/assertFaceRead)⇒ guarded', () => {
  const src = [
    "const staged = argv.includes('--staged')",
    'const files = listFaceFiles(root, face)',
    'assertFaceEnumeration({ face, count: files.length })',
    'assertFaceRead({ face, requested: files.length, readable: files.length })',
  ].join('\n')
  assert.equal(classifyFaceGateSource(src).verdict, 'guarded')
})

test('分类:无三面旗 ⇒ not-face-gate', () => {
  assert.equal(classifyFaceGateSource('const x = readFaceBatch(root, "head", rels)').verdict, 'not-face-gate')
})

test('分类:有三面旗但无枚举 ⇒ no-enumeration', () => {
  assert.equal(classifyFaceGateSource("const face = argv.includes('--head') ? 'head' : 'worktree'").verdict, 'no-enumeration')
})

test('分类:有枚举但无 0 值判定 ⇒ no-zero-check', () => {
  assert.equal(classifyFaceGateSource("const f = argv.includes('--staged')\nconst files = listFaceFiles(root, face)").verdict, 'no-zero-check')
})

test('分类:注释里的 exit(2) 不得把缺保护的门洗成 guarded', () => {
  const src = [
    "const staged = argv.includes('--staged')",
    'const files = listFaceFiles(root)',
    'if (files.length === 0) return []',
    '// 以前这里会 process.exit(2),后来删了',
    "// console.error('未判定')",
  ].join('\n')
  assert.equal(classifyFaceGateSource(src).verdict, 'missing-guard')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
