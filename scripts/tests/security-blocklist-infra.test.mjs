// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 封禁层的"自伤"护栏(2026-11-24 立)。
 *
 * 立因:生产 8801 直连公网,一旦前面套上 CDN/反代,`remoteAddress` 就会变成入口 IP。
 * 自动封禁若照封不误,一条规则就能把整站打下线 —— 防护层变成故障源。
 * 因此 `applyDecisions` 必须先问「这个 IP 是不是本机自己的地址」。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { infraIps, applyDecisions } from '../security/lib/blocklist.mjs'

const baseState = () => ({
  path: 'unused.json',
  version: 1,
  updatedAt: null,
  allowlist: [],
  entries: {},
})

test('infraIps 包含本机回环地址', () => {
  const set = infraIps({})
  assert.ok(set.has('127.0.0.1'), `infraIps 应含 127.0.0.1,实际: ${[...set].join(',')}`)
})

test('infraIps 接受 IHUI_INFRA_IPS 追加', () => {
  const set = infraIps({ IHUI_INFRA_IPS: '172.20.0.9, 100.64.1.2' })
  assert.ok(set.has('172.20.0.9'))
  assert.ok(set.has('100.64.1.2'))
})

test('命中基础设施 IP 的封禁决策被拒绝并点名', () => {
  const ban = { action: 'ban', ip: '10.9.9.9', hits: 3, score: 15, expiresAt: '2026-11-25T00:00:00Z' }
  const r = applyDecisions([ban], baseState(), { dryRun: true, protect: new Set(['10.9.9.9']) })
  assert.equal(r.held.length, 1)
  assert.equal(r.held[0].ip, '10.9.9.9')
  assert.equal(r.held[0].reason, 'infra-ip')
  assert.equal(r.applied.length, 0, '被拒绝的 IP 不能出现在 applied')
})

test('非基础设施 IP 照常进入决策', () => {
  const ban = { action: 'ban', ip: '43.175.168.192', hits: 3, score: 15, expiresAt: '2026-11-25T00:00:00Z' }
  const r = applyDecisions([ban], baseState(), { dryRun: true, protect: new Set(['10.9.9.9']) })
  assert.equal(r.held.length, 0)
  assert.equal(r.applied.length, 1)
  assert.equal(r.applied[0].ip, '43.175.168.192')
})

test('refresh 动作不受基础设施护栏影响(续期不动防火墙)', () => {
  const state = baseState()
  state.entries['10.9.9.9'] = { ip: '10.9.9.9', firstSeen: '2026-11-24T00:00:00Z', applied: true }
  const r = applyDecisions([{ action: 'refresh', ip: '10.9.9.9', hits: 2, score: 12, expiresAt: '2026-11-26T00:00:00Z' }], state, {
    dryRun: true,
    protect: new Set(['10.9.9.9']),
  })
  assert.equal(r.held.length, 0)
  assert.equal(r.applied.length, 1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
