// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 威胁判据纯函数用例(2026-11-24 立)。
 * 钉住三件事:白名单不会误封内网、窗口外的旧事件不参与打分、重犯 TTL 真的翻倍封顶。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SECURITY_POLICY,
  ipv4ToInt,
  inCidr,
  isWhitelisted,
  scoreEvents,
  decideBans,
  expiredEntries,
} from '../security/lib/threat-policy.mjs'

test('ipv4ToInt 合法与非法', () => {
  assert.equal(ipv4ToInt('1.2.3.4'), (1 * 2 ** 24 + 2 * 2 ** 16 + 3 * 2 ** 8 + 4) >>> 0)
  assert.equal(ipv4ToInt('256.1.1.1'), null)
  assert.equal(ipv4ToInt('1.2.3'), null)
  assert.equal(ipv4ToInt('abc'), null)
})

test('inCidr 网段与精确地址', () => {
  assert.equal(inCidr('10.1.2.3', '10.0.0.0/8'), true)
  assert.equal(inCidr('11.1.2.3', '10.0.0.0/8'), false)
  assert.equal(inCidr('172.20.1.1', '172.16.0.0/12'), true)
  assert.equal(inCidr('::1', '::1'), true)
  assert.equal(inCidr('::2', '::1'), false)
})

test('isWhitelisted 不误封内网与额外白名单', () => {
  assert.equal(isWhitelisted('192.168.1.10'), true)
  assert.equal(isWhitelisted('127.0.0.1'), true)
  assert.equal(isWhitelisted('43.175.168.191'), false)
  assert.equal(isWhitelisted('203.0.113.9', ['203.0.113.0/24']), true)
})

test('scoreEvents 窗口/白名单/权重聚合', () => {
  const now = Date.parse('2026-11-24T12:00:00Z')
  const events = [
    { ts: '2026-11-24T11:00:00Z', ip: '43.175.168.191', kind: 'waf', detection: 'Exploit/CVE-2025-55182' },
    { ts: '2026-11-24T10:00:00Z', ip: '43.175.168.191', kind: 'waf', detection: 'Exploit/CVE-2025-55182' },
    { ts: '2026-11-24T09:00:00Z', ip: '10.0.0.5', kind: 'waf' },
    { ts: '2026-11-23T09:00:00Z', ip: '43.174.1.1', kind: 'waf' },
    { ts: '2026-11-24T11:30:00Z', ip: '1.2.3.4', kind: 'edge-guard' },
  ]
  const { aggregates, stats } = scoreEvents(events, { now, policy: SECURITY_POLICY })
  assert.equal(stats.total, 5)
  assert.equal(stats.outsideWindow, 1)
  assert.equal(stats.whitelisted, 1)
  assert.equal(aggregates[0].ip, '43.175.168.191')
  assert.equal(aggregates[0].score, 20)
  assert.deepEqual(aggregates[0].detections, ['Exploit/CVE-2025-55182'])
  const low = aggregates.find((a) => a.ip === '1.2.3.4')
  assert.equal(low.score, 1)
})

test('入口 WAF 单次只拦不封(权重 5),同一 IP 第二次才封', () => {
  const now = Date.parse('2026-11-24T12:00:00Z')
  const once = scoreEvents([{ ts: '2026-11-24T11:59:00Z', ip: '203.0.113.7', kind: 'waf-block' }], { now })
  assert.equal(once.aggregates[0].score, SECURITY_POLICY.weights['waf-block'])
  assert.equal(decideBans(once.aggregates, {}, { now }).filter((x) => x.action === 'ban').length, 0, '单次 5 分不足阈值 10,不得封禁')
  const twice = scoreEvents(
    [
      { ts: '2026-11-24T11:59:00Z', ip: '203.0.113.7', kind: 'waf-block' },
      { ts: '2026-11-24T11:58:30Z', ip: '203.0.113.7', kind: 'waf-block' },
    ],
    { now },
  )
  assert.equal(twice.aggregates[0].score, 10)
  assert.equal(decideBans(twice.aggregates, {}, { now }).filter((x) => x.action === 'ban').length, 1)
})

test('decideBans 达阈值即封,T 重翻倍封顶,未达阈值只观察', () => {
  const now = Date.parse('2026-11-24T12:00:00Z')
  const aggs = [
    { ip: '43.175.168.191', score: 10, hits: 1, detections: ['x'], kinds: { waf: 1 }, paths: [] },
    { ip: '1.2.3.4', score: 1, hits: 1, detections: [], kinds: { 'edge-guard': 1 }, paths: [] },
    { ip: '9.9.9.9', score: 10, hits: 1, detections: [], kinds: { waf: 1 }, paths: [], expiresAt: '2026-11-25T00:00:00Z' },
  ]
  const d = decideBans(aggs, { '9.9.9.9': { expiresAt: '2026-11-25T00:00:00Z', rebanCount: 2 } }, { now })
  const ban = d.find((x) => x.ip === '43.175.168.191')
  assert.equal(ban.action, 'ban')
  assert.equal(ban.ttlHours, 24)
  assert.equal(d.find((x) => x.ip === '1.2.3.4').action, 'observe')
  assert.equal(d.find((x) => x.ip === '9.9.9.9').action, 'refresh')
})

test('重犯 TTL 从 24h 翻到 48h 并封顶 168h', () => {
  const now = Date.parse('2026-11-24T12:00:00Z')
  const aggs = [{ ip: '5.5.5.5', score: 10, hits: 1, detections: [], kinds: { waf: 1 }, paths: [] }]
  const once = decideBans(aggs, { '5.5.5.5': { rebanCount: 0, expiresAt: '2026-11-20T00:00:00Z' } }, { now })[0]
  assert.equal(once.ttlHours, 48)
  const many = decideBans(aggs, { '5.5.5.5': { rebanCount: 9, expiresAt: '2026-11-20T00:00:00Z' } }, { now })[0]
  assert.equal(many.ttlHours, 168)
})

test('单批上限后剩余只标记 batch-limit', () => {
  const now = Date.parse('2026-11-24T12:00:00Z')
  const aggs = Array.from({ length: 55 }, (_, i) => ({
    ip: `100.0.0.${i + 1}`, score: 10, hits: 1, detections: [], kinds: { waf: 1 }, paths: [],
  }))
  const d = decideBans(aggs, {}, { now })
  assert.equal(d.filter((x) => x.action === 'ban').length, SECURITY_POLICY.maxBanBatch)
  assert.equal(d.filter((x) => x.action === 'batch-limit').length, 5)
})

test('expiredEntries 只取到期项', () => {
  const entries = {
    a: { ip: 'a', expiresAt: '2026-11-20T00:00:00Z' },
    b: { ip: 'b', expiresAt: '2026-12-20T00:00:00Z' },
    c: { ip: 'c', expiresAt: null },
  }
  const out = expiredEntries(entries, Date.parse('2026-11-24T12:00:00Z'))
  assert.deepEqual(out.map((e) => e.ip), ['a'])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
