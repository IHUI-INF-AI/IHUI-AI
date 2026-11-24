// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDoubaoPayload, extractFullPhone, pickPhoneFromValues } from '../doubao-web-login.mjs'

/**
 * 豆包网页登录加号钉(2026-11-17):
 * 全号只从用户亲手输入的登录页里取,取不到就明确失败,绝不猜号;
 * payload 必须能被号池同一导入通路消费(sessionid 主票 + uid_tt 稳定 uid)。
 */

test('extractFullPhone:从输入/请求体里只取 11 位手机号', () => {
  assert.equal(extractFullPhone('15754320340'), '15754320340')
  assert.equal(extractFullPhone('+86 157 5432 0340'), '15754320340')
  assert.equal(extractFullPhone('mobile=15754320340&code=123456'), '15754320340')
  assert.equal(extractFullPhone('aid=582478&device_id=1976300013104096'), '')
  assert.equal(extractFullPhone(''), '')
})

test('pickPhoneFromValues:多个输入框时优先命中全号', () => {
  assert.equal(pickPhoneFromValues(['', '验证码', '15754320340']), '15754320340')
  assert.equal(pickPhoneFromValues(['123', 'abc']), '')
})

test('buildDoubaoPayload:全号命名 + sessionid 主票 + uid_tt 稳定 uid', () => {
  const cookies = [
    { name: 'sessionid', value: 'abc123', domain: '.doubao.com' },
    { name: 'uid_tt', value: '7350000000000000000', domain: '.doubao.com' },
    { name: 'msToken', value: 'x', domain: '.doubao.com' },
    { name: 'other', value: 'y', domain: '.example.com' },
  ]
  const payload = buildDoubaoPayload({ phone: '15754320340', cookies })
  assert.equal(payload.providerCode, 'doubao')
  const acc = payload.accounts[0]
  assert.equal(acc.name, '15754320340')
  assert.equal(acc.phone, '15754320340')
  assert.equal(acc.token, 'abc123')
  assert.match(acc.uid, /^auto:[0-9a-f]{32}$/)
  assert.equal(acc.keepAliveForever, true)
  assert.ok(acc.cookies.some((c) => c.name === 'sessionid'))
  assert.ok(acc.cookies.some((c) => c.name === 'uid_tt'))
  assert.ok(!acc.cookies.some((c) => c.name === 'other'), '非 doubao 域 cookie 不落池')
  // uid 是稳定摘要,不得回显 uid_tt 原值
  assert.ok(!acc.uid.includes('7350000000000000000'))
})

test('buildDoubaoPayload:同 uid_tt 换 sessionid,uid 不变(覆盖旧行)', () => {
  const a = buildDoubaoPayload({
    phone: '15754320340',
    cookies: [
      { name: 'sessionid', value: 'aaa', domain: '.doubao.com' },
      { name: 'uid_tt', value: '735', domain: '.doubao.com' },
    ],
  })
  const b = buildDoubaoPayload({
    phone: '15754320340',
    cookies: [
      { name: 'sessionid', value: 'bbb', domain: '.doubao.com' },
      { name: 'uid_tt', value: '735', domain: '.doubao.com' },
    ],
  })
  assert.equal(a.accounts[0].uid, b.accounts[0].uid)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
