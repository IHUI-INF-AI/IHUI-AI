// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 归一化的判据锁。每条都对应一个真实绕过面,不是形式化断言:
 * 下面这些串在**旧实现(单轮 decodeURIComponent)**下全部判 allow —— 这就是洞。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { decodeChain, decodeOnce, __test__ } from '../normalize-input.mjs'

const MAX_ROUNDS = __test__.MAX_ROUNDS

test('单层百分比解码', () => {
  const r = decodeChain('%27')
  assert.equal(r.text, "'")
  assert.equal(r.rounds, 1)
})

test('双层套娃:%2527 必须还原成单引号(旧实现解一次得 %27 ⇒ 漏判)', () => {
  const r = decodeChain('%2527')
  assert.equal(r.text, "'")
  assert.ok(r.rounds >= 2, `应至少两轮,实际 ${r.rounds}`)
})

test('三层套娃在上限内也能还原', () => {
  const r = decodeChain('%252527')
  assert.equal(r.text, "'")
  assert.equal(r.rounds, MAX_ROUNDS)
})

test('套娃 + 空格编码的 SQL 注入必须还原出可匹配形态', () => {
  const r = decodeChain('%2527%2520union%2520select%25201%252c2')
  assert.match(r.text, /union\s+select/i)
  assert.ok(r.text.includes("'"), '单引号必须还原出来')
})

test('路径穿越的三重编码必须还原成 ../', () => {
  const r = decodeChain('%252e%252e%252fetc%252fpasswd')
  assert.ok(r.text.includes('../'), `实际:${r.text}`)
})

test('HTML 实体与十六进制实体', () => {
  assert.equal(decodeChain('&#39;').text, "'")
  assert.equal(decodeChain('&#x27;').text, "'")
  assert.equal(decodeChain('&lt;script&gt;').text, '<script>')
})

test('反斜杠转义(u 与 x 两种写法)', () => {
  assert.equal(decodeChain('\\u003cscript\\u003e').text, '<script>')
  assert.equal(decodeChain('\\x3cscript\\x3e').text, '<script>')
})

test('全角百分号 + 全角数字:NFKC 折叠后下一轮解出来', () => {
  const r = decodeChain('％２７')
  assert.equal(r.text, "'")
  assert.ok(r.rounds >= 2)
})

test('控制字符与零宽字符被剥掉', () => {
  const r = decodeChain('uni\u0000on\u200b select')
  assert.equal(r.text, 'union select')
})

test('正常中文查询串不被改坏', () => {
  const r = decodeChain('/api/v1/users?page=2&q=%E6%B5%81%E8%A1%A8')
  assert.ok(r.text.includes('流表'), `实际:${r.text}`)
  assert.ok(!r.text.includes('<'))
  assert.ok(!r.text.includes('../'))
  assert.ok(!/union\s+select/i.test(r.text))
})

test('非法编码不抛异常,原文继续下一轮', () => {
  const r = decodeChain('%zz%25zz')
  assert.equal(typeof r.text, 'string')
  assert.ok(r.text.length > 0)
})

test('已最简的串 rounds=0(日志据此区分"没解码"与"解到底")', () => {
  const r = decodeChain('/health')
  assert.equal(r.rounds, 0)
  assert.equal(r.text, '/health')
})

test('幂等:对已收敛结果再解不再变化', () => {
  const once = decodeChain('%2527').text
  const twice = decodeChain(once)
  assert.equal(twice.text, once)
  assert.equal(twice.rounds, 0)
})

test('超长串按 slice 截断并置 truncated', () => {
  const r = decodeChain('a'.repeat(3000), { slice: 100 })
  assert.equal(r.text.length, 100)
  assert.equal(r.truncated, true)
})

test('decodeOnce 对越界码点保留原文而不是吞掉', () => {
  assert.equal(decodeOnce('&#99999999;'), '&#99999999;')
})

test('不把 NFKC 用在没必要的场合:纯 ASCII 原样返回', () => {
  const input = '/api/v1/orders?sku=ABC-123_X'
  assert.equal(decodeChain(input).text, input)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
