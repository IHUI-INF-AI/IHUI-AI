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
  buildForwardHeaders,
  buildRejectionFrame,
  decideUpgradeAdmission,
  normalizeIpLiteral,
  resolveEdgeClientIp,
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

// ── 客户端 IP 归一(2026-10-29 第四层)────────────────────────────────────
//
// 这一族的错法同样是「安静」的:归一写反了(取最左而不是最右、或 match 时仍用 socket),
// 站点照常 200,只是所有按 IP 的限流/风控/审计同时退化成"客户端自己说了算"。

test('normalizeIpLiteral:带端口的 IPv4 / 带方括号的 IPv6 都要认', () => {
  assert.equal(normalizeIpLiteral('1.2.3.4'), '1.2.3.4')
  assert.equal(normalizeIpLiteral('1.2.3.4:8080'), '1.2.3.4')
  assert.equal(normalizeIpLiteral('[::1]:443'), '::1')
  assert.equal(normalizeIpLiteral('::1'), '::1')
  assert.equal(normalizeIpLiteral('  1.2.3.4  '), '1.2.3.4')
  // 反向对照:认不出的必须给空串,绝不能让非法字面量混进限流键。
  assert.equal(normalizeIpLiteral('not-an-ip'), '')
  assert.equal(normalizeIpLiteral('999.1.1.1'), '')
  assert.equal(normalizeIpLiteral(''), '')
  assert.equal(normalizeIpLiteral(undefined), '')
})

test('resolveEdgeClientIp 取 XFF 最右(最近一跳),不是最左(客户端整写)', () => {
  // 最左 1.1.1.1 是攻击者伪造的;最右 2.2.2.2 才是 EdgeOne 追加的真实 IP。
  assert.equal(resolveEdgeClientIp({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }), '2.2.2.2')
  assert.equal(resolveEdgeClientIp({ 'x-forwarded-for': '9.9.9.9' }), '9.9.9.9')
  // 数组形态(Node 会把重复头收成数组)
  assert.equal(resolveEdgeClientIp({ 'x-forwarded-for': ['1.1.1.1', '3.3.3.3'] }), '3.3.3.3')
  // 尾部是垃圾 ⇒ 往前找合法段
  assert.equal(resolveEdgeClientIp({ 'x-forwarded-for': '4.4.4.4, garbage' }), '4.4.4.4')
  assert.equal(resolveEdgeClientIp({ 'x-forwarded-for': '' }), '')
  assert.equal(resolveEdgeClientIp({}), '')
  assert.equal(resolveEdgeClientIp(null), '')
})

test('off 档:仍做 IP 归一(客户端自带的 XFF 不被透传),但不做回源验证', () => {
  // 2026-10-29 改判:原断言"一个头都不许动"让 off 档把客户端自带的 X-Forwarded-For
  // 原样交给上游 —— 限流键与内网判据因此由攻击者指定,比"没装闸"更糟。IP 归一是身份
  // 语义修正,不是闸门行为;off 档仍不做回源验证(不注入 verified)。
  const headers = {
    'x-forwarded-for': '1.1.1.1, 2.2.2.2',
    'cf-connecting-ip': '9.9.9.9',
    'x-real-ip': '8.8.8.8',
  }
  const out = buildForwardHeaders({
    headers,
    remoteAddress: '203.0.113.9',
    edgeMode: 'off',
    edgeReason: 'off',
  })
  assert.equal(out['x-forwarded-for'], '203.0.113.9', 'off 档也只认 TCP 对端')
  assert.equal(out['x-ihui-client-ip'], '203.0.113.9')
  assert.ok(!('x-ihui-edge-verified' in out), 'off 档不做回源验证')
  assert.ok(!('x-real-ip' in out), 'x-real-ip 不透传')
  assert.ok(!('cf-connecting-ip' in out), '非回环对端不采信 cf-connecting-ip')
})

test('回环对端(cloudflared 隧道):采信 CF-Connecting-IP,否则上游只看到 127.0.0.1', () => {
  // api.aizhs.top 走本机 cloudflared,对端恒为回环;真实客户端 IP 只在 CF-Connecting-IP。
  // 不采信它 ⇒ request.ip 恒 127.0.0.1 ⇒ isPrivateIp 失效(实测公网 /metrics 返回 200)、
  // 全局限流退化为单桶。
  const out = buildForwardHeaders({
    headers: { 'cf-connecting-ip': '198.51.100.23', 'x-forwarded-for': '127.0.0.1' },
    remoteAddress: '127.0.0.1',
    edgeMode: 'observe',
    edgeReason: 'no-secret',
  })
  assert.equal(out['x-forwarded-for'], '198.51.100.23')
  assert.equal(out['x-ihui-client-ip'], '198.51.100.23')
  assert.ok(!('x-ihui-edge-verified' in out), '隧道来源不等于回源鉴权匹配')
})

test('公网对端直连源站:同一个 CF 头不可采信(那是客户端自己写的)', () => {
  const out = buildForwardHeaders({
    headers: { 'cf-connecting-ip': '198.51.100.23' },
    remoteAddress: '203.0.113.7',
    edgeMode: 'observe',
    edgeReason: 'no-secret',
  })
  assert.equal(out['x-forwarded-for'], '203.0.113.7')
  assert.equal(out['x-ihui-client-ip'], '203.0.113.7')
})

test('match 档:采信 XFF 最右,注入 verified,并删掉其余伪造 IP 头', () => {
  const out = buildForwardHeaders({
    headers: {
      'x-forwarded-for': '1.1.1.1, 203.0.113.7',
      'cf-connecting-ip': '9.9.9.9',
      'x-real-ip': '8.8.8.8',
      'true-client-ip': '7.7.7.7',
      forwarded: 'for=6.6.6.6',
    },
    remoteAddress: '10.0.0.1',
    edgeMode: 'enforce',
    edgeReason: 'match',
  })
  assert.equal(out['x-forwarded-for'], '203.0.113.7', '取最右 = EdgeOne 写的真实 IP')
  assert.equal(out['x-ihui-client-ip'], '203.0.113.7')
  assert.equal(out['x-ihui-edge-verified'], '1')
  // 反向对照:伪造头必须全部消失,否则上游换一个头读就又回到"客户端说了算"。
  assert.equal(out['cf-connecting-ip'], undefined)
  assert.equal(out['x-real-ip'], undefined)
  assert.equal(out['true-client-ip'], undefined)
  assert.equal(out.forwarded, undefined)
})

test('match 但 XFF 缺失/全非法 ⇒ 回落 TCP 对端,绝不用伪造的 cf-connecting-ip', () => {
  const out = buildForwardHeaders({
    headers: { 'cf-connecting-ip': '9.9.9.9', 'x-forwarded-for': 'garbage' },
    remoteAddress: '203.0.113.9',
    edgeMode: 'enforce',
    edgeReason: 'match',
  })
  assert.equal(out['x-ihui-client-ip'], '203.0.113.9')
  assert.equal(out['x-forwarded-for'], '203.0.113.9')
  assert.equal(out['cf-connecting-ip'], undefined)
})

test('未匹配(直连):只认 TCP 对端,且不注入 verified', () => {
  const out = buildForwardHeaders({
    headers: { 'x-forwarded-for': '1.2.3.4', 'cf-connecting-ip': '5.6.7.8' },
    remoteAddress: '198.51.100.5',
    edgeMode: 'observe',
    edgeReason: 'missing',
  })
  assert.equal(out['x-ihui-client-ip'], '198.51.100.5', '直连伪造什么都不算数')
  assert.equal(out['x-forwarded-for'], '198.51.100.5')
  assert.equal(out['x-ihui-edge-verified'], undefined, '没验证就绝不发"已验证"标记')
})

test('buildForwardHeaders 不修改入参(纯函数,重试/多分支共用同一份 headers)', () => {
  const headers = { 'x-forwarded-for': '1.1.1.1', 'cf-connecting-ip': '9.9.9.9' }
  const snapshot = { ...headers }
  buildForwardHeaders({ headers, remoteAddress: '203.0.113.9', edgeMode: 'enforce', edgeReason: 'match' })
  assert.deepEqual(headers, snapshot, '入参被就地改掉会让重试拿到已被删过的头')
})

// ── 内部路由透传 verified(2026-10-29 闭环变更 B)──────────────────────────────
//
// 链路:cloudflared → 8801(公网路由,验 secret 后置 verified)→ 8802(API 路由,只监听回环)
// → API 应用 → ai-service-fetch.ts → ai-service。8802 的对端是回环,decideEdgeGuard 给它
// 的 reason 是 'loopback' 而非 'match' —— 若 buildForwardHeaders 只认 'match',会在这一跳把
// verified 抹掉,ai-service 的 conn_guard 永远回落 TCP 对端(=127.0.0.1),per-user 限流退化成
// 全站共享一个桶(DoS 缺口未真正闭合)。故内部路由(trustInboundVerified=true)必须透传入站 verified。

test('内部路由(只监听回环):透传上游 verified,per-user 限流能拿到真实 IP', () => {
  const out = buildForwardHeaders({
    headers: {
      'x-forwarded-for': '203.0.113.99', // 8801 已归一为真实客户端 IP
      'x-ihui-client-ip': '203.0.113.99',
      'x-ihui-edge-verified': '1',
    },
    remoteAddress: '127.0.0.1', // 8802 的对端是 8801,回环
    edgeMode: 'enforce',
    edgeReason: 'loopback', // 8802 自己比对的是回环连接,结论是 loopback 而非 match
    trustInboundVerified: true,
  })
  assert.equal(out['x-ihui-edge-verified'], '1', '内部路由必须把 8801 的验证结论透传下去')
  assert.equal(out['x-ihui-client-ip'], '203.0.113.99', '真实客户端 IP 一路带到 ai-service')
  assert.equal(out['x-forwarded-for'], '203.0.113.99')
})

test('公网路由(监听 0.0.0.0):绝不信任客户端自带的 verified,只认自己比对的 secret', () => {
  const out = buildForwardHeaders({
    headers: {
      'x-forwarded-for': '1.1.1.1',
      'x-ihui-client-ip': '1.1.1.1',
      'x-ihui-edge-verified': '1', // 攻击者在公网请求里自带,企图骗过
    },
    remoteAddress: '203.0.113.7', // cloudflared 以公网 IP 连入 8801(实际本机但连接对端非回环语义)
    edgeMode: 'enforce',
    edgeReason: 'missing', // 没有合法 secret
    trustInboundVerified: false, // 公网路由不信任入站该头
  })
  assert.equal(out['x-ihui-edge-verified'], undefined, '伪造的 verified 必须被抹掉')
  assert.equal(out['x-ihui-client-ip'], '203.0.113.7', '只认 TCP 对端,不信伪造 IP')
  assert.equal(out['x-forwarded-for'], '203.0.113.7')
})

test('反向对照:内部路由若也置 trustInboundVerified=false,会复现 8802 抹掉 verified 的断链', () => {
  // 删掉透传能力 ⇒ 真实客户端 IP 退化成 127.0.0.1,正是变更 B 要修的 DoS 缺口。
  const out = buildForwardHeaders({
    headers: {
      'x-forwarded-for': '203.0.113.99',
      'x-ihui-client-ip': '203.0.113.99',
      'x-ihui-edge-verified': '1',
    },
    remoteAddress: '127.0.0.1',
    edgeMode: 'enforce',
    edgeReason: 'loopback',
    trustInboundVerified: false,
  })
  assert.equal(out['x-ihui-edge-verified'], undefined, '断链复现:verified 被抹 => conn_guard 回落 127.0.0.1')
  assert.equal(out['x-ihui-client-ip'], '127.0.0.1', '断链复现:IP 退化成回环 => 全站共享一个限流桶')
})
