// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 边缘准入判定的行为锁(2026-10-29)。
 *
 * 这一族的错法全都是「安静」的 —— 代码在、构建过、单测绿,而防护实际不存在:
 *   · upgrade 分支忘了接闸 ⇒ 攻击者改一个请求行就绕开全部边缘防护(本次立因);
 *   · 回源鉴权写成「只要配了密钥就放行」⇒ 等于没装;
 *   · observe 档写成放行且不记 ⇒ 直连攻击者在统计里彻底隐身,永远等不到归零;
 *   · 回环豁免漏掉 ⇒ 部署环与内部调用先被自己限死(加固把自己打瘫);
 *   · 拒绝时只 destroy ⇒ 客户端分不清「等一会儿再来」和「根本不该来」。
 *
 * 故每条正例都配一条反向对照:删掉对应那一行,必须有用例翻红。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  bgStatusVisibleTo,
  buildRejectionFrame,
  decideUpgradeAdmission,
  resolveRouterMaxConnections,
} from '../edge-admission.mjs'

const SECRET = 'unit-test-secret'
const PUBLIC_IP = '203.0.113.9'

/** 建一个永远放行/永远拒绝的限流器,并记录被问过几次。 */
function fakeLimiter(verdict) {
  const calls = []
  return {
    calls,
    check: (ip) => {
      calls.push(ip)
      return verdict
    },
  }
}

// ── 回源鉴权:enforce 档 ────────────────────────────────────────────────

test('enforce 档:公网无密钥 ⇒ 403,且不消耗限流令牌', () => {
  const limiter = fakeLimiter({ allowed: true, retryAfterSec: 0 })
  const r = decideUpgradeAdmission({
    edgeMode: 'enforce',
    edgeSecret: SECRET,
    remoteAddress: PUBLIC_IP,
    headers: {},
    checkRate: limiter.check,
  })
  assert.equal(r.allow, false)
  assert.equal(r.status, 403)
  assert.equal(r.reason, 'edge-guard')
  assert.equal(r.edgeReason, 'missing')
  // 便宜的先做:直连攻击者不该走到令牌桶那一步。
  assert.deepEqual(limiter.calls, [], '被回源鉴权拒绝的握手不该再查限流')
})

test('enforce 档:公网密钥错误 ⇒ 403(对照:正确密钥放行)', () => {
  const wrong = decideUpgradeAdmission({
    edgeMode: 'enforce',
    edgeSecret: SECRET,
    remoteAddress: PUBLIC_IP,
    headers: { 'x-ihui-edge-secret': 'not-the-secret' },
  })
  assert.equal(wrong.allow, false)
  assert.equal(wrong.status, 403)
  assert.equal(wrong.edgeReason, 'mismatch')

  const right = decideUpgradeAdmission({
    edgeMode: 'enforce',
    edgeSecret: SECRET,
    remoteAddress: PUBLIC_IP,
    headers: { 'x-ihui-edge-secret': SECRET },
  })
  assert.equal(right.allow, true)
  assert.equal(right.edgeReason, 'match')
})

test('enforce 档:回环来源免密钥放行(部署脚本/内部服务不被自己拦死)', () => {
  const r = decideUpgradeAdmission({
    edgeMode: 'enforce',
    edgeSecret: SECRET,
    remoteAddress: '::ffff:127.0.0.1',
    headers: {},
  })
  assert.equal(r.allow, true)
  assert.equal(r.edgeReason, 'loopback')
})

test('配了 enforce 却没给密钥 ⇒ 放行(手滑漏填 env 不该让全站 403)', () => {
  const r = decideUpgradeAdmission({
    edgeMode: 'enforce',
    edgeSecret: '',
    remoteAddress: PUBLIC_IP,
    headers: {},
  })
  assert.equal(r.allow, true)
  assert.equal(r.edgeReason, 'no-secret-configured')
})

// ── 回源鉴权:off / observe 档 ─────────────────────────────────────────

test('off 档:完全不校验(默认档必须是「什么都不做」)', () => {
  const r = decideUpgradeAdmission({
    edgeMode: 'off',
    edgeSecret: SECRET,
    remoteAddress: PUBLIC_IP,
    headers: {},
  })
  assert.equal(r.allow, true)
  assert.equal(r.edgeReason, 'off')
})

test('observe 档:放行但把 missing 记进 edgeReason(否则直连 WS 在统计里隐身)', () => {
  const r = decideUpgradeAdmission({
    edgeMode: 'observe',
    edgeSecret: SECRET,
    remoteAddress: PUBLIC_IP,
    headers: {},
  })
  assert.equal(r.allow, true, 'observe 不拦')
  assert.equal(r.edgeReason, 'missing', '但必须留下「这条是直连来的」证据')
})

// ── 限流 ───────────────────────────────────────────────────────────────

test('限流超限 ⇒ 429 + Retry-After,且 edgeReason 一并带出', () => {
  const limiter = fakeLimiter({ allowed: false, retryAfterSec: 7 })
  const r = decideUpgradeAdmission({
    edgeMode: 'off',
    edgeSecret: '',
    remoteAddress: PUBLIC_IP,
    headers: {},
    checkRate: limiter.check,
  })
  assert.equal(r.allow, false)
  assert.equal(r.status, 429)
  assert.equal(r.reason, 'rate-limit')
  assert.equal(r.retryAfterSec, 7)
  assert.deepEqual(limiter.calls, [PUBLIC_IP], '限流 key 必须是 TCP 对端')
})

test('回环豁免:内部服务的握手不进令牌桶', () => {
  const limiter = fakeLimiter({ allowed: false, retryAfterSec: 9 })
  const r = decideUpgradeAdmission({
    edgeMode: 'off',
    edgeSecret: '',
    remoteAddress: '127.0.0.1',
    headers: {},
    checkRate: limiter.check,
  })
  assert.equal(r.allow, true, '回环不能被自己的限流挡住')
  assert.deepEqual(limiter.calls, [])
})

test('限流层未启用(checkRate=null)⇒ 不因缺省而拒绝', () => {
  const r = decideUpgradeAdmission({
    edgeMode: 'off',
    edgeSecret: '',
    remoteAddress: PUBLIC_IP,
    headers: {},
    checkRate: null,
  })
  assert.equal(r.allow, true)
})

test('限流器放行 ⇒ allow,且 reason=ok', () => {
  const limiter = fakeLimiter({ allowed: true, retryAfterSec: 0 })
  const r = decideUpgradeAdmission({
    edgeMode: 'off',
    edgeSecret: '',
    remoteAddress: PUBLIC_IP,
    headers: {},
    checkRate: limiter.check,
  })
  assert.equal(r.allow, true)
  assert.equal(r.reason, 'ok')
  assert.equal(r.status, 0)
})

// ── 拒绝帧 ─────────────────────────────────────────────────────────────

test('拒绝帧是合法 HTTP 响应,且 content-length 按字节数(非字符数)', () => {
  const frame = buildRejectionFrame(403, 'edge-guard')
  const [head, body] = frame.split('\r\n\r\n')
  assert.match(head, /^HTTP\/1\.1 403 Forbidden/)
  assert.match(head, /connection: close/)
  const declared = Number(/content-length: (\d+)/.exec(head)?.[1])
  assert.equal(declared, Buffer.byteLength(body), 'content-length 必须等于 body 字节数')
  assert.deepEqual(JSON.parse(body), { code: 403, message: 'edge-guard' })
})

test('429 帧带 Retry-After;403 帧不带(带 0 等于教客户端立刻重试)', () => {
  assert.match(buildRejectionFrame(429, 'rate-limit', 12), /retry-after: 12/)
  assert.doesNotMatch(buildRejectionFrame(403, 'edge-guard', 0), /retry-after/)
})

// ── 运维探针可见性 ─────────────────────────────────────────────────────

test('/__bg/status 只对回环可见:公网来源一律不可见(实测 8801 曾公网可读)', () => {
  assert.equal(bgStatusVisibleTo('127.0.0.1'), true)
  assert.equal(bgStatusVisibleTo('::1'), true)
  assert.equal(bgStatusVisibleTo('::ffff:127.0.0.1'), true)
  // 反向对照:公网地址必须判不可见,否则等于把活跃色与内部端口贴到公网。
  assert.equal(bgStatusVisibleTo('203.0.113.9'), false)
  assert.equal(bgStatusVisibleTo('10.0.0.5'), false, '私网也非回环:内网横向探测同样不该读到')
  assert.equal(bgStatusVisibleTo(''), false)
  assert.equal(bgStatusVisibleTo(undefined), false)
})

// ── 连接数硬顶 ─────────────────────────────────────────────────────────

test('连接数硬顶:非法值一律回落默认上限,绝不变成无上限', () => {
  assert.equal(resolveRouterMaxConnections(5000), 5000)
  assert.equal(resolveRouterMaxConnections('2048'), 2048)
  assert.equal(resolveRouterMaxConnections(1000.9), 1000, '取整,不产生小数上限')
  // 反向对照:这几种输入若透传成 Infinity/NaN,等于把硬顶变回「没有硬顶」。
  assert.equal(resolveRouterMaxConnections(0), 10_000)
  assert.equal(resolveRouterMaxConnections(-1), 10_000)
  assert.equal(resolveRouterMaxConnections('abc'), 10_000)
  assert.equal(resolveRouterMaxConnections(undefined), 10_000)
  assert.equal(resolveRouterMaxConnections(Infinity), 10_000)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
