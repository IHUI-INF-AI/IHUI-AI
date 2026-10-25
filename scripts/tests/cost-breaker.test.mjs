// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `cost-breaker.mjs` 镜像测试。钉:① 滚动窗口切分(1h/24h 各自只算该窗);② 三型上限各自能触发;
 * ③ 类别不串账、未知类别抛而不是当 0 次放行;④ 台账坏行跳过、配置形状锁、退出码 0/3。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as cb } from '../cost-breaker.mjs'

const CAPS = cb.loadCaps(
  JSON.stringify({
    kinds: { deploy: { perHour: 2, perDay: 5, minutesPerDay: 30 }, session: { perHour: 1 } },
  }),
)
const NOW = Date.parse('2026-10-25T12:00:00.000Z')
const ev = (minAgo, kind = 'deploy', minutes = 5) => ({
  ts: NOW - minAgo * 60_000,
  kind,
  minutes,
  note: '',
})

test('① 滚动窗口:近 1h 与近 24h 各自取材', () => {
  const r = cb.evaluate({ caps: CAPS, events: [ev(10), ev(120)], kind: 'deploy', now: NOW })
  assert.equal(r.used.hour, 1)
  assert.equal(r.used.day, 2)
  assert.equal(r.allowed, true)
})

test('② 三型上限各自能触发', () => {
  const hourly = cb.evaluate({ caps: CAPS, events: [ev(1), ev(2)], kind: 'deploy', now: NOW })
  assert.equal(hourly.allowed, false)
  assert.match(hourly.breaches[0], /60 分钟/)
  const daily = cb.evaluate({
    caps: CAPS,
    events: [ev(600), ev(700), ev(800), ev(900), ev(1000)],
    kind: 'deploy',
    now: NOW,
  })
  assert.equal(daily.allowed, false)
  assert.ok(daily.breaches.some((b) => /24 小时/.test(b)))
  const minutes = cb.evaluate({
    caps: CAPS,
    events: [ev(1, 'deploy', 20), ev(2, 'deploy', 15)],
    kind: 'deploy',
    now: NOW,
  })
  assert.equal(minutes.allowed, false)
  assert.ok(minutes.breaches.some((b) => /分钟/.test(b)))
})

test('③ 类别不串账 + 未知类别抛', () => {
  const r = cb.evaluate({ caps: CAPS, events: [ev(1, 'session')], kind: 'deploy', now: NOW })
  assert.equal(r.used.day, 0)
  assert.throws(
    () => cb.evaluate({ caps: CAPS, events: [], kind: 'nope', now: NOW }),
    /未配置的成本类别/,
  )
})

test('④ 台账坏行跳过、配置形状锁、记账行与退出码', () => {
  const parsed = cb.parseLedger(
    [
      '{"ts":"2026-10-25T11:00:00Z","kind":"deploy","minutes":3}',
      'not-json',
      '{"kind":"x"}',
      '',
    ].join('\n'),
  )
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].minutes, 3)
  assert.throws(() => cb.loadCaps('{"kinds":{}}'), /不能为空/)
  assert.throws(() => cb.loadCaps(JSON.stringify({ kinds: { deploy: { perHour: 0 } } })), /正数/)
  const line = JSON.parse(cb.chargeLine({ kind: 'deploy', minutes: 2.5, note: 'x', now: NOW }))
  assert.equal(line.kind, 'deploy')
  assert.equal(line.minutes, 2.5)
  assert.equal(cb.exitCodeOf({ allowed: true }), 0)
  assert.equal(cb.exitCodeOf({ allowed: false }), 3)
})
