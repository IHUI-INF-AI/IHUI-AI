// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 态势与红队判据锁:指标口径错了比没指标更危险(会让人以为防线很强)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPosture, isIntercepted, median } from '../security/defense-posture.mjs'
import { BLOCK_CASES, probeOnce, runRuleset } from '../security/redteam-selftest.mjs'

const NOW = Date.parse('2026-11-24T12:00:00.000Z')

test('isIntercepted: 只有明确 blocked=true 或拒绝类事件才算拦住', () => {
  assert.equal(isIntercepted({ kind: 'waf', blocked: true }), true)
  assert.equal(isIntercepted({ kind: 'waf-block' }), true)
  assert.equal(isIntercepted({ kind: 'waf', blocked: false }), false)
  assert.equal(isIntercepted({ kind: 'waf' }), false)
})

test('buildPosture: 拦截率只除以 true+false,unknown 不进分母', () => {
  const events = [
    { ts: '2026-11-24T11:00:00Z', ip: '43.1.1.1', kind: 'waf', blocked: true, detection: 'Exploit/CVE-1' },
    { ts: '2026-11-24T10:00:00Z', ip: '43.1.1.2', kind: 'waf', blocked: false, detection: 'Exploit/CVE-1' },
    { ts: '2026-11-24T09:00:00Z', ip: '43.1.1.3', kind: 'waf', detection: 'Exploit/CVE-1' },
  ]
  const p = buildPosture({ events, entries: {}, now: NOW })
  assert.equal(p.interception.wafBlocked.true, 1)
  assert.equal(p.interception.wafBlocked.false, 1)
  assert.equal(p.interception.wafBlocked.unknown, 1)
  assert.equal(p.interception.rate, 0.5)
  assert.match(p.interception.note, /不能当防线强度/)
  assert.equal(p.chain.breached, 1)
})

test('buildPosture: 全 unknown 时拦截率必须是 null,不许拿 0 或 100 冒充', () => {
  const p = buildPosture({ events: [{ ts: '2026-11-24T09:00:00Z', ip: '43.1.1.3', kind: 'waf' }], entries: {}, now: NOW })
  assert.equal(p.interception.rate, null)
})

test('buildPosture: 已到初始访问但未封的 IP 要单列成缺口', () => {
  const p = buildPosture({
    events: [{ ts: '2026-11-24T11:00:00Z', ip: '43.1.1.1', kind: 'waf', blocked: true, detection: 'Exploit/CVE-1' }],
    entries: {},
    now: NOW,
  })
  assert.equal(p.unbannedActive.length, 1)
  assert.equal(p.unbannedActive[0].stage, 'initial-access')
})

test('buildPosture: MTTD 只取近 7 天首见的样本,历史补封不算响应速度', () => {
  const p = buildPosture({
    events: [
      { ts: '2026-11-24T11:00:00Z', ip: '43.1.1.1', kind: 'waf', blocked: true, detection: 'Exploit/CVE-1' },
      { ts: '2026-11-10T00:00:00Z', ip: '43.1.1.9', kind: 'waf', blocked: true, detection: 'Exploit/CVE-1' },
    ],
    entries: {
      '43.1.1.1': { bannedAt: '2026-11-24T11:30:00Z' },
      '43.1.1.9': { bannedAt: '2026-11-24T11:00:00Z' },
    },
    now: NOW,
  })
  assert.equal(p.mttdMinutes.samples, 1)
  assert.equal(p.mttdMinutes.median, 30)
  assert.equal(median([1, 2, 3]), 2)
  assert.equal(median([]), null)
})

test('runRuleset: 11 条必拦 + 5 条不误伤必须全过', () => {
  const r = runRuleset()
  assert.equal(r.ok, true, `失败用例: ${r.failed.map((f) => f.name).join(',')}`)
  assert.equal(r.total, BLOCK_CASES.length + 5)
})

test('runRuleset: 期望规则写错时必须判失败(自测本身不能恒绿)', () => {
  const r = runRuleset({ blockCases: [{ name: 'fake', req: { url: '/?q=1%20union%20select%201' }, expectRule: 'no-such-rule' }], safeCases: [] })
  assert.equal(r.ok, false)
  assert.equal(r.failed.length, 1)
})

test('probeOnce: 非回环目标直接拒绝,绝不对外探测', async () => {
  const r = await probeOnce({ host: '43.174.54.152' })
  assert.equal(r.skipped, true)
  assert.match(r.reason, /非回环/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
