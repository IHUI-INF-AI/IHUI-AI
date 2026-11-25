// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 依赖漏洞判据用例(2026-11-24 立)。
 * 重点是「表内按 patch 比、表外高版本放行、表外低版本不安全」这三条边界 ——
 * 失效方向必须偏向「多判一次不安全」。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseVersion, compareVersion, judgeNext, judgeReact, buildFixPlan } from '../security/lib/vuln-policy.mjs'

test('parseVersion 兼容 caret 与 canary 后缀', () => {
  assert.deepEqual(parseVersion('16.4.6'), { major: 16, minor: 4, patch: 6, raw: '16.4.6' })
  assert.equal(parseVersion('^19.2.8').major, 19)
  assert.equal(parseVersion('19.2.8-canary.1').patch, 8)
  assert.equal(parseVersion('latest'), null)
})

test('compareVersion 逐段比较', () => {
  assert.equal(compareVersion('16.0.2', '16.0.11'), -1)
  assert.equal(compareVersion('19.2.8', '19.2.4'), 1)
  assert.equal(compareVersion('1.2.3', '1.2.3'), 0)
})

test('judgeNext 表内低于修复线判不安全', () => {
  const r = judgeNext('16.0.2')
  assert.equal(r.safe, false)
  assert.equal(r.required, '16.0.11')
  assert.equal(judgeNext('15.5.9').required, '15.5.10')
})

test('judgeNext 表内等于/高于修复线判安全', () => {
  assert.equal(judgeNext('16.0.11').safe, true)
  assert.equal(judgeNext('14.2.35').safe, true)
})

test('judgeNext 表外高版本放行、表外低版本不安全', () => {
  assert.equal(judgeNext('16.4.6').safe, true)
  assert.equal(judgeNext('13.0.0').safe, false)
})

test('judgeReact 19.1 线与 19.2 线的修复线', () => {
  assert.equal(judgeReact('19.1.0').safe, false)
  assert.equal(judgeReact('19.1.0').required, '19.1.5')
  assert.equal(judgeReact('19.2.4').safe, true)
  assert.equal(judgeReact('19.2.8').safe, true)
})

test('无法解析时 safe=null,不冒充安全', () => {
  assert.equal(judgeNext('bogus').safe, null)
  assert.equal(judgeReact('').safe, null)
})

test('buildFixPlan 只为不安全项生成命令', () => {
  const plan = buildFixPlan({ next: '16.0.2', react: '19.2.0', reactDom: '19.2.0' })
  assert.deepEqual(plan, [
    'pnpm --filter @ihui/web add next@16.0.11',
    'pnpm --filter @ihui/web add react@19.2.4 react-dom@19.2.4',
  ])
  assert.deepEqual(buildFixPlan({ next: '16.4.6', react: '19.2.8', reactDom: '19.2.8' }), [])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
