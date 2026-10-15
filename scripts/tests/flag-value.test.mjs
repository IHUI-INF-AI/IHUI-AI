// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/lib/flag-value.mjs 的镜像测试(§22c:判据 import 源文件,本文件不复制任何判定式)。
import test from 'node:test'
import assert from 'node:assert/strict'

import { flagValue, isFlagValueToken, requireFlagValue, describeFlagToken } from '../lib/flag-value.mjs'

const R = '--root'

test('没给旗标 ⇒ present:false,调用方按默认档走(这本身不是错误)', () => {
  const f = flagValue(['--staged'], R)
  assert.deepEqual(f, { present: false, valid: false, value: null, token: null })
  const r = requireFlagValue(['--staged'], R, { fallback: 'DEFAULT', noun: '目录参数' })
  assert.equal(r.error, null)
  assert.equal(r.value, 'DEFAULT')
})

test('正例:紧邻的是一个值 ⇒ 原样交出,不加工', () => {
  const r = requireFlagValue(['--root', 'G:/somewhere/else', '--staged'], R, { noun: '目录参数' })
  assert.equal(r.present, true)
  assert.equal(r.error, null)
  assert.equal(r.value, 'G:/somewhere/else')
})

test('反例①:值被下一个旗标顶掉 ⇒ 点名实得 "--staged"', () => {
  const r = requireFlagValue(['--root', '--staged'], R, { fallback: 'DEFAULT', noun: '目录参数' })
  assert.equal(r.present, true)
  assert.equal(r.value, null)
  assert.match(r.error, /--root 需要一个目录参数/)
  assert.match(r.error, /实得:"--staged"/)
})

test('反例②:结尾无值 ⇒ 点名 (其后没有任何参数)', () => {
  const r = requireFlagValue(['--root'], R, { fallback: 'DEFAULT', noun: '目录参数' })
  assert.equal(r.value, null)
  assert.match(r.error, /实得:\(其后没有任何参数\)/)
})

test('反例③:空串 ⇒ 点名 "" —— 这一支旧写法最常静默(`|| \'.\'` 直接吞)', () => {
  const r = requireFlagValue(['--root', ''], R, { fallback: 'DEFAULT', noun: '目录参数' })
  assert.equal(r.value, null)
  assert.match(r.error, /实得:""/)
})

test('三支坏值各自点名不同 token(只断言一支会在另两支留洞)', () => {
  const got = [
    requireFlagValue(['--root', '--staged'], R).error,
    requireFlagValue(['--root'], R).error,
    requireFlagValue(['--root', ''], R).error,
  ]
  assert.equal(new Set(got).size, 3, `三态文案必须互不相同:${got.join(' | ')}`)
})

test('坏值绝不回落默认:present:true 而 value:null,与"没给"可区分', () => {
  for (const argv of [['--root', '--staged'], ['--root'], ['--root', '']]) {
    const r = requireFlagValue(argv, R, { fallback: 'DEFAULT' })
    assert.equal(r.present, true, `${JSON.stringify(argv)} 不该被读成"没给旗标"`)
    assert.notEqual(r.value, 'DEFAULT', `${JSON.stringify(argv)} 落回默认 = 本票要消的那一型`)
  }
})

test('单个连字符开头的短旗标同样算坏值(-x 形态)', () => {
  const r = requireFlagValue(['--root', '-x'], R)
  assert.equal(r.value, null)
  assert.match(r.error, /实得:"-x"/)
})

test('出现多次按第一次取(沿用被替换副本的 indexOf,不得顺手改形)', () => {
  const f = flagValue(['--root', 'G:/first', '--root', 'G:/second'], R)
  assert.equal(f.value, 'G:/first')
})

test('非法输入不炸:list 不是数组 / 紧邻 token 不是字符串 ⇒ 一律算"没给值"', () => {
  assert.equal(flagValue(undefined, R).present, false)
  assert.equal(flagValue(null, R).present, false)
  const f = flagValue(['--root', {}], R)
  assert.equal(f.present, true)
  assert.equal(f.token, null)
  assert.equal(describeFlagToken(f), '(其后没有任何参数)')
})

test('isFlagValueToken 与 flagValue.valid 同一条判据(公共层内部不得两套)', () => {
  for (const t of ['ok', '', '-', '--staged', null, undefined, 1, {}]) {
    const f = flagValue([R, t], R)
    if (typeof t === 'string' && t !== '') assert.equal(f.valid, isFlagValueToken(t), `token=${JSON.stringify(t)}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
