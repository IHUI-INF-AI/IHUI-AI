// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * land-miniapp-style-tiers.test.mjs — 小程序落档器的镜像测试(§22c)
 *
 * 判据全部 import 源脚本(`rewriteCss` / `buildReverse`),本文件不复制正则或档值。
 * 钉四件事:①等值才改;②档外值不动;③幂等(改完再跑 0 处);④派生文件 app.css 不在射程。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as land } from '../land-miniapp-style-tiers.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'land-miniapp-style-tiers.mjs')

const SPACING = { none: 0, '2xs': 2, xs: 4, 'xs-loose': 6, sm: 8, 'sm-loose': 10, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40, '5xl': 48, '6xl': 64 }
const TYPE = { badge: 10, caption: 11, label: 12, body: 14, strong: 15, title: 16, subtitle: 18, heading: 20, display: 24, 'display-lg': 30 }
const REV = land.buildReverse(SPACING, TYPE)

test('T1 等值命中才改:24rpx→md / 28rpx→body', () => {
  const a = land.rewriteCss('.a{padding:24rpx}', REV)
  assert.equal(a.out, '.a{padding: var(--spacing-md)}')
  assert.equal(a.changes, 1)
  const b = land.rewriteCss('.b{font-size:28rpx}', REV)
  assert.equal(b.out, '.b{font-size: var(--text-body)}')
})

test('T2 档外值一律不动(26rpx=13px 不在档表)', () => {
  const r = land.rewriteCss('.c{padding:26rpx}', REV)
  assert.equal(r.out, '.c{padding:26rpx}')
  assert.equal(r.changes, 0)
})

test('T3 line-height 不动:多个档可能共享同一行高,反查不是单值', () => {
  const r = land.rewriteCss('.d{line-height:40rpx}', REV)
  assert.equal(r.changes, 0)
})

test('T4 calc / 非 rpx 单位不动(只吃纯 <数>rpx)', () => {
  assert.equal(land.rewriteCss('.e{padding:calc(24rpx + 1px)}', REV).changes, 0)
  assert.equal(land.rewriteCss('.e2{padding:24px}', REV).changes, 0)
  assert.equal(land.rewriteCss('.e3{padding:24rpx 24%;}', REV).changes, 1, '空格分隔的多值时只换命中的那一段')
})

test('T5 幂等:改过的正文再跑必须 0 处', () => {
  const once = land.rewriteCss('.f{padding:24rpx;margin-top:16rpx;font-size:28rpx}', REV)
  assert.equal(once.changes, 3)
  const twice = land.rewriteCss(once.out, REV)
  assert.equal(twice.changes, 0, '不幂等 ⇒ 每轮都会造 diff')
  assert.equal(twice.out, once.out)
})

test('T6 同值多档取首个声明(档表声明序决定),并且是确定性的', () => {
  const r1 = land.buildReverse({ a: 8, b: 8 }, {})
  assert.equal(r1.spacing.get(8), 'a')
  const r2 = land.buildReverse({ b: 8, a: 8 }, {})
  assert.equal(r2.spacing.get(8), 'b')
})

test('T7 派生文件保护:app.css 必须在排除表里(手改会被 sync 洗掉)', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.match(src, /DERIVED_EXCLUDE\s*=\s*new Set\(\[[^\]]*apps\/miniapp-taro\/src\/app\.css/, 'app.css 必须显式排除')
})

test('T8 归属避让在位:工作树脏的文件必须跳过而不是覆盖', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.match(src, /dirtySet\(files\)/, '必须有归属检查')
  assert.match(src, /held\.push\(f\)/, '脏文件必须进 held 而不是被改')
})

test('T9 本文件必须是测试本体,不是落档器的整文件副本', () => {
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  const target = readFileSync(SCRIPT, 'utf8')
  assert.ok(target.length > self.length)
  const copyMarker = ['export', 'function', 'rewriteCss'].join(' ')
  assert.equal(self.includes(copyMarker), false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
