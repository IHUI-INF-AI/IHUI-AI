// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 回源鉴权守卫的行为锁(2026-10-29)。
 *
 * 这一族的错法都是「上线那一刻才炸」的,所以每条正例都配反向对照:
 *   · 默认不是 off ⇒ 装上去当天全站 403(线上关键路径上新装开关,默认必须什么都不做);
 *   · observe 档误拦 ⇒ 灰度期就把人挡在外面,而 observe 的全部意义就是「先不拦、只看」;
 *   · 漏回环豁免 ⇒ 开启 enforce 的瞬间部署环/健康检查自己先死;
 *   · 缺密钥时选择「全拦」⇒ 一个手滑漏填 env 变成整站故障,而正确方向是放行 + 日志明说。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { decideEdgeGuard, resolveEdgeGuardMode } from '../edge-origin-guard.mjs'

const SECRET = 'a'.repeat(48)

test('默认档:未设 / 认不出的值一律回落 off', () => {
  for (const v of [undefined, null, '', 'off', 'OFF', 'yes', 'true', '1', 'disable']) {
    assert.equal(resolveEdgeGuardMode(v), 'off', String(v))
  }
})

test('档位:只认 observe / enforce(大小写与空白不敏感)', () => {
  assert.equal(resolveEdgeGuardMode('observe'), 'observe')
  assert.equal(resolveEdgeGuardMode(' OBSERVE '), 'observe')
  assert.equal(resolveEdgeGuardMode('enforce'), 'enforce')
  assert.equal(resolveEdgeGuardMode('Enforce'), 'enforce')
})

test('off 档:无论带不带头一律放行', () => {
  for (const headers of [{}, { 'x-ihui-edge-secret': SECRET }, { 'x-ihui-edge-secret': 'wrong' }]) {
    const r = decideEdgeGuard({ mode: 'off', secret: SECRET, loopback: false, headers })
    assert.equal(r.action, 'pass')
  }
})

test('缺密钥:即使配了 enforce 也放行(手滑漏填 env 不该变成整站 403)', () => {
  const r = decideEdgeGuard({ mode: 'enforce', secret: '', loopback: false, headers: {} })
  assert.equal(r.action, 'pass')
  assert.equal(r.reason, 'no-secret-configured')
})

test('回环豁免:本机请求不带头也必须过(否则开启 enforce 部署环自己先死)', () => {
  const r = decideEdgeGuard({ mode: 'enforce', secret: SECRET, loopback: true, headers: {} })
  assert.equal(r.action, 'pass')
  assert.equal(r.reason, 'loopback')
})

test('enforce + 头匹配 ⇒ 放行', () => {
  const r = decideEdgeGuard({
    mode: 'enforce',
    secret: SECRET,
    loopback: false,
    headers: { 'x-ihui-edge-secret': SECRET },
  })
  assert.equal(r.action, 'pass')
  assert.equal(r.reason, 'match')
})

test('enforce + 缺失头 ⇒ 拒绝', () => {
  const r = decideEdgeGuard({ mode: 'enforce', secret: SECRET, loopback: false, headers: {} })
  assert.equal(r.action, 'deny')
  assert.equal(r.reason, 'missing')
})

test('enforce + 头不匹配 ⇒ 拒绝', () => {
  const r = decideEdgeGuard({
    mode: 'enforce',
    secret: SECRET,
    loopback: false,
    headers: { 'x-ihui-edge-secret': 'b'.repeat(48) },
  })
  assert.equal(r.action, 'deny')
  assert.equal(r.reason, 'mismatch')
})

test('observe 档:缺失/不匹配都只记 observe,绝不 deny(灰度期不许拦人)', () => {
  const missing = decideEdgeGuard({ mode: 'observe', secret: SECRET, loopback: false, headers: {} })
  assert.equal(missing.action, 'observe')
  assert.equal(missing.reason, 'missing')
  const bad = decideEdgeGuard({
    mode: 'observe',
    secret: SECRET,
    loopback: false,
    headers: { 'x-ihui-edge-secret': 'wrong' },
  })
  assert.equal(bad.action, 'observe')
  assert.equal(bad.reason, 'mismatch')
})

test('observe 档 + 匹配 ⇒ 放行(不能把正常的也记成 observe)', () => {
  const r = decideEdgeGuard({
    mode: 'observe',
    secret: SECRET,
    loopback: false,
    headers: { 'x-ihui-edge-secret': SECRET },
  })
  assert.equal(r.action, 'pass')
})

test('头名大小写都认(Node 实际给小写,但不假定)', () => {
  const r = decideEdgeGuard({
    mode: 'enforce',
    secret: SECRET,
    loopback: false,
    headers: { 'X-IHUI-Edge-Secret': SECRET },
  })
  assert.equal(r.action, 'pass')
})

test('值两侧空白被裁掉(控制台配置常带尾空格)', () => {
  const r = decideEdgeGuard({
    mode: 'enforce',
    secret: SECRET,
    loopback: false,
    headers: { 'x-ihui-edge-secret': `  ${SECRET}  ` },
  })
  assert.equal(r.action, 'pass')
})

test('长度不同不抛异常,直接拒绝(timingSafeEqual 要求等长)', () => {
  const r = decideEdgeGuard({
    mode: 'enforce',
    secret: SECRET,
    loopback: false,
    headers: { 'x-ihui-edge-secret': 'short' },
  })
  assert.equal(r.action, 'deny')
})

test('非字符串头值不炸(数组/数字/undefined 一律当缺失)', () => {
  for (const v of [undefined, 123, ['a', 'b'], null]) {
    const r = decideEdgeGuard({
      mode: 'enforce',
      secret: SECRET,
      loopback: false,
      headers: { 'x-ihui-edge-secret': v },
    })
    assert.equal(r.action, 'deny', String(v))
  }
})
