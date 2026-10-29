// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// 端到端链路验证：公网 → 8801 公网路由 → 8802 内部路由 → ai-service 的「边缘验证标记 + 真实客户端 IP」透传。
//
// 本文件用真实生产代码（edge-admission.mjs 的 buildForwardHeaders）串联 8801→8802 两跳，
// 固化「变更B：api→ai-service 透传边缘层验证后的真实客户端 IP」的闭环。
//
// 第 3/4 段（ai-service-fetch.ts 写侧 + conn_guard.py 读侧）已由以下既有单测覆盖，此处只做链路衔接断言：
//   - ai-service/tests/test_conn_guard.py：conn_guard 只信 x-ihui-client-ip + x-ihui-edge-verified=1，回落 TCP 对端。
//   - apps/api/src/utils/ai-service-fetch.ts：verified==='1' 时透传 client-ip + edge-verified。

import assert from 'node:assert'
import test from 'node:test'
import { buildForwardHeaders } from '../edge-admission.mjs'

// ── 第 1 跳：8801 公网入口 ────────────────────────────────────────────────
// 客户端带伪造 IP 头，但 TCP 对端是真实公网 IP。cloudflared 以 127.0.0.1 连入，
// 8801 比对 IHUI-Edge-Secret 成功 ⇒ edgeReason='match' ⇒ 注入 verified=1 + 真实对端 IP，
// 并删除所有伪造 IP 头。
test('第1跳 8801 入口：忽略伪造头、注入真实对端 IP + verified 标记', () => {
  const inbound = {
    'x-forwarded-for': '1.1.1.1, 203.0.113.7',
    'cf-connecting-ip': '9.9.9.9',
    'x-real-ip': '8.8.8.8',
  }
  const out = buildForwardHeaders({
    headers: inbound,
    remoteAddress: '203.0.113.7',
    edgeMode: 'enforce',
    edgeReason: 'match',
  })
  assert.equal(out['x-ihui-edge-verified'], '1')
  assert.equal(out['x-ihui-client-ip'], '203.0.113.7')
  assert.equal(out['x-forwarded-for'], '203.0.113.7')
  // 伪造头必须被删除，否则下游会被欺骗
  assert.ok(!('cf-connecting-ip' in out), 'cf-connecting-ip 必须被删除')
  assert.ok(!('x-real-ip' in out), 'x-real-ip 必须被删除')
})

// ── 第 2 跳：8802 内部路由（变更B 核心） ────────────────────────────────
// 8801 的输出作为 8802 的入站。8802 只监听 127.0.0.1（外部不可直达），
// 能带进来的 verified 必是 8801 真验证过的 ⇒ trustInboundVerified=true ⇒ 透传，
// 不回落回环地址。这正是变更B 闭环：ai-service 的 conn_guard 能拿到真实 client-ip + verified。
test('第2跳 8802 内部路由：透传入站 verified + client-ip（变更B 闭环）', () => {
  const inboundFrom8801 = {
    'x-ihui-edge-verified': '1',
    'x-ihui-client-ip': '203.0.113.7',
    'x-forwarded-for': '203.0.113.7',
  }
  const out = buildForwardHeaders({
    headers: inboundFrom8801,
    remoteAddress: '127.0.0.1',
    edgeMode: 'enforce',
    edgeReason: 'loopback',
    trustInboundVerified: true,
  })
  assert.equal(
    out['x-ihui-edge-verified'],
    '1',
    '8802 必须透传 verified，否则 ai-service 的 conn_guard 回落 127.0.0.1 共享桶（DoS 缺口）',
  )
  assert.equal(out['x-ihui-client-ip'], '203.0.113.7', '8802 必须保留真实 client-ip')
  assert.equal(out['x-forwarded-for'], '203.0.113.7')
})

// ── 反例：公网路由角色绝不信任客户端自带 verified ───────────────────────
// cloudflared 本机也以 127.0.0.1 连入 8801，故不能靠 isLoopback 区分。
// 若 trustInboundVerified=false（公网入口角色），客户端自带的 x-ihui-edge-verified 必须被抹掉。
test('反例 公网路由角色：拒绝客户端伪造的 x-ihui-edge-verified', () => {
  const spoofed = { 'x-ihui-edge-verified': '1', 'x-ihui-client-ip': '6.6.6.6' }
  const out = buildForwardHeaders({
    headers: spoofed,
    remoteAddress: '203.0.113.7',
    edgeMode: 'enforce',
    edgeReason: 'loopback',
    trustInboundVerified: false,
  })
  assert.ok(!('x-ihui-edge-verified' in out), '公网入口必须抹掉客户端自带的 verified')
  assert.equal(out['x-ihui-client-ip'], '203.0.113.7', '回落真实 TCP 对端')
})

// ── 反例：edge 未匹配则不注入标记 ──────────────────────────────────────
test('反例 edgeReason!=match 时不注入 verified', () => {
  const out = buildForwardHeaders({
    headers: { 'x-forwarded-for': '1.1.1.1' },
    remoteAddress: '203.0.113.7',
    edgeMode: 'enforce',
    edgeReason: 'no-secret',
  })
  assert.ok(!('x-ihui-edge-verified' in out), '未通过边缘鉴权不应注入 verified')
  assert.equal(out['x-ihui-client-ip'], '203.0.113.7')
})
