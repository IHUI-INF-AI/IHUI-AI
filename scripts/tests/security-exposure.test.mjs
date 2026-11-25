// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 暴露面审计用例(2026-11-24 立)。
 * 判据核心是「WAN 监听 ∧ 无 block 覆盖」才叫暴露 —— 只有监听不算,因为
 * 内网服务绑 0.0.0.0 是 Windows 常态;只有规则也不算,因为规则可能没生效。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  parseNetstat,
  auditExposure,
  isWanHost,
  REQUIRED_ALLOW,
  WAN_DENY_RULES,
} from '../security/check-entry-exposure.mjs'
import { readRouterEvents } from '../security/lib/attack-collect.mjs'

test('parseNetstat 只取 LISTENING 并拆出端口/pid', () => {
  const text = [
    '  TCP    0.0.0.0:8801    0.0.0.0:0    LISTENING    6012',
    '  TCP    127.0.0.1:8802   0.0.0.0:0    LISTENING    7000',
    '  TCP    [::]:22          [::]:0        LISTENING    5020',
    '  TCP    10.0.0.5:5000    1.2.3.4:443  ESTABLISHED  1234',
  ].join('\r\n')
  const out = parseNetstat(text)
  assert.equal(out.length, 3)
  assert.deepEqual(out[0], { host: '0.0.0.0', port: '8801', pid: 6012, state: 'LISTENING' })
  assert.equal(out[1].host, '127.0.0.1')
  assert.deepEqual(out[2], { host: '[::]', port: '22', pid: 5020, state: 'LISTENING' })
})

test('isWanHost 认 0.0.0.0 与 IPv6 通配', () => {
  assert.equal(isWanHost('0.0.0.0'), true)
  assert.equal(isWanHost('::'), true)
  assert.equal(isWanHost('[::]'), true)
  assert.equal(isWanHost('127.0.0.1'), false)
})

function fwAllOk(extra = {}) {
  const fw = {}
  // remoteAny 必须显式给:判据认的是 remoteAny(见 check-entry-exposure.mjs 的 L65),
  // 只造 exists/enabled 会让来源读成 undefined ⇒ 全绿场景里凭空多出一条 fail。
  fw[REQUIRED_ALLOW] = { exists: true, enabled: true, remoteAny: true }
  for (const r of WAN_DENY_RULES) fw[r] = { exists: true, enabled: true }
  return { ...fw, ...extra }
}

test('auditExposure 全绿场景', () => {
  const findings = auditExposure({
    listeners: [{ host: '0.0.0.0', port: '8801', pid: 6012 }],
    fw: fwAllOk(),
    routerStart: { edgeGuard: 'enforce', rateLimit: '500rps/1000burst' },
    blocklist: [],
  })
  assert.equal(findings.filter((f) => f.level === 'fail' || f.level === 'warn').length, 0)
  assert.equal(findings.find((f) => f.id === 'entry-8801').level, 'ok')
})

test('缺 8801 监听与放行规则都判 fail', () => {
  const findings = auditExposure({
    listeners: [],
    fw: fwAllOk({ [REQUIRED_ALLOW]: { exists: false, enabled: false } }),
    routerStart: { edgeGuard: 'enforce', rateLimit: '1rps' },
    blocklist: [],
  })
  assert.equal(findings.find((f) => f.id === 'entry-8801').level, 'fail')
  assert.equal(findings.find((f) => f.id === 'fw-allow-8801').level, 'fail')
})

test('缺 edge secret 判定为形同关闭', () => {
  const findings = auditExposure({
    listeners: [{ host: '0.0.0.0', port: '8801', pid: 1 }],
    fw: fwAllOk(),
    routerStart: { edgeGuard: 'enforce(缺 IHUI_EDGE_SECRET ⇒ 实际不拦)', rateLimit: '1rps' },
    blocklist: [],
  })
  assert.equal(findings.find((f) => f.id === 'edge-guard').level, 'fail')
})

test('router 日志取不到时 edge-guard 落未判定', () => {
  const findings = auditExposure({ listeners: [], fw: {}, routerStart: null, blocklist: [] })
  assert.equal(findings.find((f) => f.id === 'edge-guard').level, 'unjudged')
})

test('WAN 高危端口有 block 覆盖只记 note,无覆盖判 fail', () => {
  const listeners = [{ host: '0.0.0.0', port: '5432', pid: 9 }]
  const covered = auditExposure({
    listeners, fw: fwAllOk(), routerStart: { edgeGuard: 'enforce', rateLimit: '1rps' }, blocklist: [],
  })
  assert.equal(covered.find((f) => f.id === 'port-5432').level, 'note')
  const uncovered = auditExposure({
    listeners,
    fw: { [REQUIRED_ALLOW]: { exists: true, enabled: true } },
    routerStart: { edgeGuard: 'enforce', rateLimit: '1rps' },
    blocklist: [],
  })
  assert.equal(uncovered.find((f) => f.id === 'port-5432').level, 'fail')
})

test('黑名单声称已封但规则缺失 ⇒ warn', () => {
  const findings = auditExposure({
    listeners: [{ host: '0.0.0.0', port: '8801', pid: 1 }],
    fw: fwAllOk({ 'IHUI-DENY-ATK-43-175-168-191': { exists: false, enabled: false } }),
    routerStart: { edgeGuard: 'enforce', rateLimit: '1rps' },
    blocklist: [{ ip: '43.175.168.191', applied: true, ruleName: 'IHUI-DENY-ATK-43-175-168-191' }],
  })
  assert.equal(findings.find((f) => f.id === 'block-drift-43.175.168.191').level, 'warn')
})

test('readRouterEvents 解析 edge guard 与 rate limited,坏行进 unjudged', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-sec-'))
  const file = join(dir, 'router.log')
  writeFileSync(file, [
    JSON.stringify({ time: '2026-11-24T02:00:00Z', msg: 'edge guard', ip: '43.174.176.134', reason: 'missing-secret', mode: 'enforce' }),
    JSON.stringify({ time: '2026-11-24T02:00:01Z', msg: 'rate limited', ip: '1.2.3.4', retryAfterSec: 5 }),
    JSON.stringify({ time: '2026-11-24T02:00:01.500Z', msg: 'waf blocked', ip: '43.175.168.192', rules: 'sqli-union-select', path: '/api/list' }),
    JSON.stringify({ time: '2026-11-24T02:00:02Z', msg: 'proxy error' }),
    '{broken',
  ].join('\n'))
  try {
    const r = readRouterEvents(file)
    assert.equal(r.events.length, 3)
    assert.equal(r.events[0].kind, 'edge-guard')
    assert.equal(r.events[1].kind, 'rate-limit')
    assert.equal(r.events[2].kind, 'waf-block')
    assert.equal(r.events[2].detail, 'sqli-union-select')
    assert.match(r.unjudged.reason, /1 行/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('readRouterEvents 文件不存在时明确未判定', () => {
  const r = readRouterEvents('D:\\no-such-dir\\no-such.log')
  assert.equal(r.events.length, 0)
  assert.equal(r.unjudged.reason, 'file-not-found')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
