#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 278(回跳落点必须钉 origin)的镜像测试(§22c 房例)。
 *
 * 三条纪律:
 *  1. 判据**从门体 import**,本文件不复算"什么算已钉" —— 复制一份必然漂移,而且门改了
 *     测试还绿,是最贵的一种假绿(跨门判据 check-test-judge-not-replicated)。
 *  2. 夹具由本文件自带,与门体 --self-test 的夹具相互独立:只跑门自己烤的样例等于让被审
 *     对象自己出题。
 *  3. 每条放行都有成对反证(同段文本摘掉 allowedOrigins 必须翻红),并对**真实台账**做形状
 *     与存活期断言 —— 豁免比判据活得久,是本仓记过的那一型失效。
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as gate } from '../check-redirect-target-origin-pinned.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('判据单源:门体必须导出实现,本文件不复制规则', () => {
  assert.equal(typeof gate.judgeOriginPinning, 'function')
  assert.equal(typeof gate.judgeAgainstLedger, 'function')
  assert.equal(typeof gate.declarationSpans, 'function')
})

test('放行与违规:options 字面量含 allowedOrigins 才算钉住', () => {
  const pinned = `const t = resolveSafeRedirectTarget(url, { allowDeepLink: true, allowedOrigins: firstPartyAllowedOrigins() })`
  assert.equal(gate.judgeOriginPinning(pinned).violations.length, 0)
  // 变异自证:摘掉那一键,同一段文本必须翻红。
  const stripped = pinned.replace(', allowedOrigins: firstPartyAllowedOrigins()', '')
  assert.equal(gate.judgeOriginPinning(stripped).violations.length, 1)
  // 单实参(完全没给 options)同样判红 —— 那是 mobile-auth 那一形,只有台账能救。
  assert.equal(
    gate.judgeOriginPinning('if (!isSafeNavigationTarget(redirectUrl)) return').violations.length,
    1,
  )
})

test('遮罩:注释与字符串里的函数名不是调用点', () => {
  const text = `
// 刻意不套 isSafeNavigationTarget:合法第三方 client 的回调域不在本站白名单
const note = 'resolveSafeRedirectTarget(url, {}) 的用法见文档'
`
  const res = gate.judgeOriginPinning(text)
  assert.equal(res.violations.length, 0)
  assert.equal(res.undetermined.length, 0)
})

test('定义体内部转调不算调用点(否则门在自己的源头文件上永久报未判定)', () => {
  const def = `
export function resolveSafeRedirectTarget(target, options) {
  if (isSafeNavigationTarget(target, options)) return target
  return '/'
}
export function isSafeNavigationTarget(target, options) {
  return options === undefined
}
`
  const res = gate.judgeOriginPinning(def)
  assert.equal(res.violations.length, 0)
  assert.equal(res.undetermined.length, 0, '形参转调被读成"未判定"= 本门永久哑掉的前置形态')
})

test('多行调用带尾逗号不得被读成"无 options"(prettier 形态)', () => {
  const multi = `
const target = resolveSafeRedirectTarget(
  resolvePostLoginLanding(user, searchParams.get('redirect')) ?? '/',
  { allowDeepLink: true, allowedOrigins: firstPartyAllowedOrigins() },
)
`
  assert.equal(gate.judgeOriginPinning(multi).violations.length, 0)
  assert.equal(
    gate.judgeOriginPinning(multi.replace(', allowedOrigins: firstPartyAllowedOrigins()', ''))
      .violations.length,
    1,
  )
})

test('options 是变量 ⇒ 未判定,不记绿也不冒红(§0.3)', () => {
  const res = gate.judgeOriginPinning('const t = resolveSafeRedirectTarget(url, buildOpts())')
  assert.equal(res.violations.length, 0)
  assert.equal(res.undetermined.length, 1)
})

test('台账判序:配平放行 · 超出判红 · 不再命中判腐烂 · 到期判红 · 缺字段判未判定', () => {
  const entries = [
    { file: 'a.tsx', bareCalls: 1, reason: '外站回跳是该页的产品契约', until: '2099-01-01' },
  ]
  const hit = [{ line: 3, snippet: 'x' }]
  const today = '2026-11-01'
  assert.equal(
    gate.judgeAgainstLedger(new Map([['a.tsx', hit]]), entries, { today }).violations.length,
    0,
  )
  assert.equal(
    gate.judgeAgainstLedger(new Map([['a.tsx', [hit[0], hit[0]]]]), entries, { today }).violations
      .length,
    1,
  )
  assert.equal(
    gate.judgeAgainstLedger(new Map([['a.tsx', []]]), entries, { today }).stale.length,
    1,
  )
  assert.equal(gate.judgeAgainstLedger(new Map(), entries, { today }).stale.length, 1)
  assert.equal(
    gate.judgeAgainstLedger(new Map([['a.tsx', hit]]), [{ ...entries[0], until: '2020-01-01' }], {
      today,
    }).expired.length,
    1,
  )
  assert.ok(
    gate.judgeAgainstLedger(
      new Map([['a.tsx', hit]]),
      [{ file: 'a.tsx', bareCalls: 1, reason: '太短' }],
      { today },
    ).malformed,
  )
  assert.ok(
    gate.judgeAgainstLedger(
      new Map([['a.tsx', hit]]),
      [{ file: 'a.tsx', bareCalls: 'x', reason: '足够长的原因说明', until: '2099-01-01' }],
      { today },
    ).malformed,
    'bareCalls 不是正整数 ⇒ 未判定(台账形状坏不得静默放行)',
  )
})

test('真实台账形状与存活期:每一条都必须带 reason/until 且未到期', () => {
  const ledger = JSON.parse(readFileSync(join(ROOT, gate.LEDGER_REL), 'utf8'))
  assert.ok(Array.isArray(ledger.entries), 'entries 必须是数组')
  const today = new Date().toISOString().slice(0, 10)
  for (const e of ledger.entries) {
    assert.equal(typeof e.file, 'string')
    assert.ok(Number.isInteger(e.bareCalls) && e.bareCalls >= 1, `${e.file} 的 bareCalls 形态坏`)
    assert.ok(
      typeof e.reason === 'string' && e.reason.trim().length >= 10,
      `${e.file} 的 reason 缺失或过短`,
    )
    assert.ok(typeof e.until === 'string' && e.until >= today, `${e.file} 的豁免已到期(${e.until})`)
  }
})

test('门体自证入口存在(接线锁:--self-test 档必须真的能跑)', () => {
  assert.equal(typeof gate.selfTestRun, 'function')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
