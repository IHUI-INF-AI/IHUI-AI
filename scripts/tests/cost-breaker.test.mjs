// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `cost-breaker.mjs` 镜像测试。钉:① 滚动窗口切分(1h/24h 各自只算该窗);② 三型上限各自能触发;
 * ③ 类别不串账、未知类别抛而不是当 0 次放行;④ 台账坏行跳过、配置形状锁、退出码 0/3。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

const TOK_CAPS = cb.loadCaps(
  JSON.stringify({ kinds: { session: { tokensPerSession: 1000, tokensPerDay: 2500 } } }),
)
const tk = (minAgo, tokens) => ({ ts: NOW - minAgo * 60_000, kind: 'session', minutes: 1, tokens, note: '' })

test('⑤ token 双闸:单会话闸按单条越线、日闸按 24 小时累计、小时窗只算 60 分钟', () => {
  const single = cb.evaluate({ caps: TOK_CAPS, events: [tk(1, 1500)], kind: 'session', now: NOW })
  assert.equal(single.allowed, false)
  assert.ok(single.breaches.some((b) => /单会话/.test(b)))
  const daily = cb.evaluate({
    caps: TOK_CAPS,
    events: [tk(10, 900), tk(600, 900), tk(900, 800)],
    kind: 'session',
    now: NOW,
  })
  assert.equal(daily.allowed, false)
  assert.ok(daily.breaches.some((b) => /24 小时 2600 tokens/.test(b)))
  const one = cb.evaluate({ caps: TOK_CAPS, events: [tk(10, 900)], kind: 'session', now: NOW })
  assert.equal(one.allowed, true)
  assert.equal(one.used.tokensHour, 900)
  assert.equal(one.used.tokensDay, 900)
})

test('⑥ token 记账:台账读回 tokens,量不到的轮不写 0 冒充', () => {
  const parsed = cb.parseLedger(
    [
      '{"ts":"2026-10-25T11:00:00Z","kind":"session","minutes":1,"tokens":1200}',
      '{"ts":"2026-10-25T11:10:00Z","kind":"session","minutes":2}',
    ].join('\n'),
  )
  assert.equal(parsed[0].tokens, 1200)
  assert.equal(parsed[1].tokens, 0)
  assert.equal(JSON.parse(cb.chargeLine({ kind: 'session', minutes: 1, tokens: 999.9, now: NOW })).tokens, 999)
  assert.ok(!('tokens' in JSON.parse(cb.chargeLine({ kind: 'session', minutes: 1, now: NOW }))))
  assert.throws(() => cb.chargeLine({ kind: 'session', minutes: 1, tokens: -1, now: NOW }), /非负数/)
})

// ── ⑦ 失败轮记账口径(2026-11-01 立)──────────────────────────────────────────
// 新旧行为差异必须逐条钉住,而不是只钉新的那一半:
//   旧:失败轮也按整轮墙钟全额记账 ⇒ 实测近 24h rc=1 共 31 次 / 472 分钟(76%),
//       熔断「墙钟 621.3/480 ⇒ 停转」把生产发布黑成一整天(一次编译错误就够)。
//   新:失败轮按 failChargeCapMinutes 封顶,实墙钟逐字留在 minutesWall;成功轮与未给 outcome
//       的旧调用方完全按旧口径(不改语义 = 不改配额,§5e-1 的"红了能做什么"由次数闸保住)。
const FAIL_CAPS = cb.loadCaps(
  JSON.stringify({ kinds: { deploy: { perHour: 8, perDay: 60, minutesPerDay: 480, failChargeCapMinutes: 10 } } }),
)

test('⑦a 失败轮封顶记账,实墙钟留在 minutesWall;成功轮口径不变', () => {
  const cap = cb.failureChargeCap(FAIL_CAPS, 'deploy')
  assert.equal(cap, 10, '配置了就要读得出封顶(单一真相源在 cost-caps.json)')
  const failed = JSON.parse(
    cb.chargeLine({ kind: 'deploy', minutes: 15.5, note: 'rc=1', now: NOW, outcome: 'fail', failureCapMinutes: cap }),
  )
  assert.equal(failed.minutes, 10, '失败轮必须按封顶进账')
  assert.equal(failed.minutesWall, 15.5, '封顶不是免单:实墙钟必须逐字留在账上')
  assert.equal(failed.outcome, 'fail')
  assert.equal(failed.chargeCapped, cb.FAILURE_CAP_KEY, '口径要可追溯(读侧能认出这是封顶点)')
  const ok = JSON.parse(
    cb.chargeLine({ kind: 'deploy', minutes: 15.5, note: 'rc=0', now: NOW, outcome: 'ok', failureCapMinutes: cap }),
  )
  assert.equal(ok.minutes, 15.5, '成功轮一个字节都不许改(否则把真实耗时洗掉)')
  assert.ok(!('chargeCapped' in ok))
  const legacy = JSON.parse(cb.chargeLine({ kind: 'deploy', minutes: 15.5, note: '旧调用方', now: NOW }))
  assert.equal(legacy.minutes, 15.5, '没给 --outcome ⇒ 保持旧口径(静默改语义等于悄悄上调额度)')
  assert.equal(legacy.outcome, 'unknown', '未知不得冒充成功也不得冒充失败(§0.3)')
  assert.throws(
    () => cb.chargeLine({ kind: 'deploy', minutes: 1, now: NOW, outcome: 'boom' }),
    /outcome 非法/,
    '非法口径必须抛,记账器不替调用方猜这一轮成没成',
  )
})

test('⑦b 形状锁:封顶 ≥ 日额即抛(借"记账口径"把配额翻倍是人工阀的事)', () => {
  assert.throws(
    () => cb.loadCaps(JSON.stringify({ kinds: { deploy: { minutesPerDay: 30, failChargeCapMinutes: 30 } } })),
    /必须 < minutesPerDay/,
  )
  assert.throws(
    () => cb.loadCaps(JSON.stringify({ kinds: { deploy: { minutesPerDay: 30, failChargeCapMinutes: -1 } } })),
    /必须是正数/,
  )
  assert.equal(cb.failureChargeCap(cb.loadCaps('{"kinds":{"deploy":{"perDay":5}}}'), 'deploy'), null)
})

test('⑦c 连败仍然撞闸:次数照记(封顶只削墙钟,不削次数)', () => {
  const rows = []
  for (let i = 0; i < 6; i += 1)
    rows.push(
      JSON.parse(
        cb.chargeLine({
          kind: 'deploy',
          minutes: 15,
          now: NOW - i * 60_000,
          outcome: 'fail',
          failureCapMinutes: cb.failureChargeCap(FAIL_CAPS, 'deploy'),
        }),
      ),
    )
  const events = cb.parseLedger(rows.map((r) => JSON.stringify(r)).join('\n'))
  const res = cb.evaluate({ caps: FAIL_CAPS, events, kind: 'deploy', now: NOW })
  assert.equal(res.used.day, 6, '失败轮次数照记(否则连败无人识)')
  assert.equal(res.used.failDay, 6, '失败轮数必须量得到(可整改性判据的输入)')
  assert.equal(res.used.minutesDay, 60, '6 枚 15 分钟失败轮按封顶 = 60 分钟,而不是 90')
  const hourBreak = cb.evaluate({
    caps: cb.loadCaps('{"kinds":{"deploy":{"perHour":5,"minutesPerDay":480,"failChargeCapMinutes":10}}}'),
    events,
    kind: 'deploy',
    now: NOW,
  })
  assert.equal(hourBreak.allowed, false, '同一批连败必须还能被次数闸拦下 ⇒ 红了有得整改')
  assert.ok(hourBreak.breaches.some((b) => /近 60 分钟 6 次 ≥ 上限 5/.test(b)))
})

test('⑦d 接线锁:部署环的记账调用必须带 --outcome(口径不在调用侧漂开)', () => {
  const loopPath = join(import.meta.dirname, '..', '..', 'deploy', 'win', 'ihui-deploy-loop.ps1')
  const text = readFileSync(loopPath, 'utf8')
  const re = /cost-breaker\.mjs'\)\s+--charge[^\r\n]*/g
  const calls = text.match(re) ?? []
  assert.ok(calls.length >= 1, '取不到部署环的记账调用 ⇒ 未判定,不得当已接线')
  for (const c of calls)
    assert.ok(/--outcome\s+\$roundOutcome/.test(c), `记账调用没带 --outcome ⇒ 失败轮仍按整轮墙钟全额进账:${c}`)
  // 摘掉即翻红(有牙证明)
  const muted = text.replace(/--outcome\s+\$roundOutcome\s+/, '')
  assert.notEqual(muted, text)
  assert.equal((( muted.match(re) ?? []).filter((c) => /--outcome/.test(c))).length, 0)
  assert.ok(/if \(\$deployDoneThisRound\) \{ 'ok' \}/.test(text), '成败口径必须来自"本轮真完成"那枚判据')
})
