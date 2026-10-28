#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/selftest-registrant.mjs` 的镜像测试(§22c:经导出口裁定,不重述实现)。
 *
 * 为什么单独立文件:这个出口是 ticket-X(自检登记侧"登记不求值"整族)认定的**唯一出路**,
 * 守门 156(check-selftest-registrant-evaluates.mjs)的 R-EXIST 判据把出路指到这里。
 * 出路自己不真判 ⇒ 点名就是空头支票,所以三条成对缺一不可:
 *   真判据通过 / 假判据必失败 / 取不到判未判定(既不恒绿也不恒红)。
 * 另加两条形状锁:求值点只许在消费循环里、pass 判据只许是严格 `=== true`
 * (退回 `!!`/Boolean 强制就等于把 `!!fn` 恒真的老洞重新开回来)。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { makeRegistrar } from '../lib/selftest-registrant.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const LIB = join(ROOT, 'scripts', 'lib', 'selftest-registrant.mjs')

test('T1 真判据通过(成对:thunk 形态与即算即得的值形态)', () => {
  const a = makeRegistrar()
  a.t('thunk 真判据', () => 1 + 1 === 2)
  const ra = a.report()
  assert.equal(ra.pass, 1)
  assert.equal(ra.fail, 0)
  assert.equal(ra.cases[0].pass, true)

  const b = makeRegistrar()
  b.t('值真判据', 2 > 1)
  const rb = b.report()
  assert.equal(rb.pass, 1)
  assert.equal(rb.fail, 0)
  assert.equal(rb.cases[0].pass, true)
})

test('T2 假判据必失败(成对:thunk 与值;一条假不得被真邻居带走,且要记下实得值)', () => {
  const a = makeRegistrar()
  a.t('thunk 假判据', () => 1 === 2)
  const ra = a.report()
  assert.equal(ra.fail, 1)
  assert.equal(ra.cases[0].pass, false)
  assert.equal(ra.cases[0].got, 'false', '失败行必须记下实得值(打印出来就是这条为什么红)')

  const b = makeRegistrar()
  b.t('值假判据', false)
  b.t('真邻居(不得被假邻居带走)', () => true)
  const rb = b.report()
  assert.deepEqual([rb.pass, rb.fail], [1, 1])

  // 第三参 detail:失败行的 got 如实进诊断文本(成功时不打印也不影响判定)
  const c = makeRegistrar()
  c.t('带诊断的假判据', () => 1 === 2, '实得 {a:1}')
  c.t('带诊断的真判据(诊断不得改判)', () => true, '不该出现在任何地方')
  const rc = c.report()
  assert.deepEqual([rc.pass, rc.fail], [1, 1])
  assert.equal(rc.cases[0].got, '实得 {a:1}')
})

test('T3 取不到判未判定:没结论 / 返回的仍是函数 / 抛错 ⇒ 一律失败,绝不记绿', () => {
  const r = makeRegistrar()
  r.t('没给结论(undefined)', () => {})
  r.t('返回的仍是函数(又一个待执行 thunk)', () => () => true)
  r.t('抛错', () => {
    throw new Error('boom')
  })
  const out = r.report()
  assert.equal(out.pass, 0, '"取不到"绝不得记绿')
  assert.equal(out.fail, 3)
  assert.equal(out.cases[0].got, 'undefined')
  assert.equal(out.cases[1].got, 'function(从未求值)', '消费点拿到手仍是函数 ⇒ 断言从未被判过')
  assert.match(out.cases[2].got, /^抛错:boom/)
})

test('T4 pass+fail 与登记条数逐条对账(静默丢例 = 漏判伪装成通过)', () => {
  const r = makeRegistrar()
  r.t('①', () => true)
  r.t('②', false)
  r.t('③', () => {
    throw new Error('x')
  })
  const out = r.report()
  assert.equal(out.cases.length, 3)
  assert.equal(out.pass + out.fail, out.cases.length)
})

test('T5 源码形状锁:thunk 求值点只在消费循环里 + pass 判据只许严格 === true(不得退回 !!)', () => {
  const src = readFileSync(LIB, 'utf8')
  assert.match(
    src,
    /typeof c\.verdict === 'function' \? c\.verdict\(\) : c\.verdict/,
    'thunk 的求值点必须收在 report 的消费循环里(登记侧结构上无法"忘了调用")',
  )
  assert.match(src, /value === true/, 'pass 判据必须是严格 === true')
  assert.ok(
    !/!!\s*c\.verdict|Boolean\(\s*c\.verdict\s*\)/.test(src),
    '登记位不得退回 !!/Boolean 强制 —— 那会把 `!!fn` 恒真的老洞重新开回来',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
