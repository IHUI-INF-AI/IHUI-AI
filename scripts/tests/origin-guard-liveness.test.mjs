// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 源站守卫存续哨兵的镜像测试(2026-10-30)。
// 判据一律 import 源脚本(§22c 不在测试里复制第二把尺子);端到端那两例走真夹具,
// 证明"降级即翻红"与"修好即复绿"是成对的,不是只测一条分支。
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as G2 } from '../git-guardian.mjs'
import {
  collect,
  isOwnSource,
  judgeGuardLiveness,
  normalizeGuardReading,
  routerLogPrefixOf,
  summarizeProbeEvents,
} from '../check-origin-guard-liveness.mjs'

const started = (g, t = '2026-10-30T01:00:00.000Z') =>
  `{"time":"${t}","level":"info","msg":"router started","listen":"0.0.0.0:8801","edgeGuard":"${g}"}`
const probe = (t, ip, mode = 'enforce') =>
  `{"time":"${t}","level":"warn","msg":"edge guard","mode":"${mode}","reason":"missing","ip":"${ip}","deniedTotal":3}`

// ── 档位归一 ──────────────────────────────────────────────────────────────
test('档位读数:三种正经值 + 带后缀的告警形态都认', () => {
  assert.equal(normalizeGuardReading('enforce'), 'enforce')
  assert.equal(normalizeGuardReading('off'), 'off')
  assert.equal(normalizeGuardReading('observe(缺 IHUI_EDGE_SECRET ⇒ 实际不拦)'), 'observe')
  assert.equal(normalizeGuardReading('weird'), null, '认不出必须 null,不得回落成某一档')
})

// ── L1 存续判据 ───────────────────────────────────────────────────────────
test('L1 enforce ⇒ ok', () => {
  assert.equal(judgeGuardLiveness([started('enforce')]).state, 'ok')
})

test('L1 observe / off ⇒ breach 并点名档位', () => {
  for (const m of ['observe', 'off']) {
    const r = judgeGuardLiveness([started(m)])
    assert.equal(r.state, 'breach')
    assert.equal(r.mode, m)
  }
})

test('L1 只认最近一次启动(旧行不得顶掉新行)', () => {
  assert.equal(judgeGuardLiveness([started('off'), started('enforce')]).state, 'ok')
  assert.equal(judgeGuardLiveness([started('enforce'), started('observe')]).state, 'breach')
  assert.equal(judgeGuardLiveness([started('enforce', '2026-10-29T01:00:00Z'), started('off', '2026-10-30T01:00:00Z')]).at, '2026-10-30T01:00:00Z')
})

test('L1 取不到一律未判定 —— 绝不把"没判"记成绿', () => {
  assert.equal(judgeGuardLiveness([]).state, 'unjudged')
  assert.equal(judgeGuardLiveness([probe('2026-10-30T01:00:00Z', '8.8.8.8')]).state, 'unjudged')
  assert.equal(judgeGuardLiveness(['{"msg":"router started"}']).state, 'unjudged')
  assert.equal(judgeGuardLiveness([started('nonsense')]).state, 'unjudged')
})

// ── 前缀推导(2026-10-30 实测污染那一型)──────────────────────────────────
test('前缀推导不把别的服务卷进来了', () => {
  assert.equal(routerLogPrefixOf('svc-web-router.log'), 'svc-web-router')
  assert.equal(routerLogPrefixOf('svc-web-router-20261029T013137.626.log'), 'svc-web-router')
  assert.notEqual(routerLogPrefixOf('svc-web-router.log'), 'svc-web', '旧写法会连 svc-web-nssm(10MB) 一起读')
  assert.equal(routerLogPrefixOf('svc-web-nssm-20261009T082323.456.log'), 'svc-web-nssm')
})

// ── 自有来源与窗口 ────────────────────────────────────────────────────────
test('回环 / LAN / 私网判为自有,公网不判', () => {
  for (const ip of ['127.0.0.1', '::1', '192.168.1.37', '10.0.0.5', '172.16.9.9']) {
    assert.ok(isOwnSource(ip), `${ip} 应判自有`)
  }
  for (const ip of ['8.8.8.8', '117.85.65.211', '']) assert.ok(!isOwnSource(ip), `${ip} 不该判自有`)
})

test('窗口与去重:同 IP 多次只计一个,窗外/无时刻单列', () => {
  const now = Date.parse('2026-10-30T12:00:00Z')
  const at = (h) => new Date(now - h * 3600_000).toISOString()
  const s = summarizeProbeEvents(
    [
      probe(at(2), '8.8.8.8'),
      probe(at(3), '8.8.8.8'),
      probe(at(1), '9.9.9.9'),
      probe(at(40), '7.7.7.7'),
      probe(at(1), '127.0.0.1'),
      probe(at(1), '192.168.1.37'),
      '{"msg":"edge guard","ip":"6.6.6.6"}',
    ],
    { nowMs: now, windowHours: 24 },
  )
  assert.equal(s.externalDistinct, 2)
  assert.equal(s.droppedUndated, 1)
  assert.equal(s.events, 7)
  assert.equal(s.windowStart, new Date(now - 24 * 3600_000).toISOString())
})

test('全窗口无外部来源时读 0 是合法结论,不等于未判定', () => {
  const now = Date.parse('2026-10-30T12:00:00Z')
  const s = summarizeProbeEvents([probe(new Date(now - 100_000).toISOString(), '127.0.0.1')], { nowMs: now })
  assert.equal(s.externalDistinct, 0)
})

// ── 端到端成对夹具:真读文件,证明摘掉即翻红 ──────────────────────────────
const dir = mkScratch('origin-guard-liveness')
after(() => rmScratch(dir))

function fixture(lines, name = 'svc-web-router.log') {
  const file = path.join(dir, name)
  writeFileSync(file, `${lines.join('\n')}\n`, 'utf8')
  return file
}

test('端到端:日志自述 enforce ⇒ ok(code 0)', () => {
  const file = fixture([started('off'), started('enforce'), probe('2026-10-30T02:00:00Z', '203.0.113.9')])
  const r = collect({ logPath: file })
  assert.equal(r.liveness.state, 'ok')
  assert.equal(r.probes.externalDistinct, 1)
  assert.equal(r.truncated, false)
})

test('端到端:同一条日志换成 observe ⇒ 立刻 breach(变异自证的正控)', () => {
  const file = fixture([started('enforce'), started('observe'), probe('2026-10-30T02:00:00Z', '203.0.113.9')])
  const r = collect({ logPath: file })
  assert.equal(r.liveness.state, 'breach')
  assert.equal(r.liveness.mode, 'observe')
})

test('端到端:活动文件与轮转副本同族读取,但不吞别的服务', () => {
  fixture([started('enforce')], 'svc-web-router.log')
  fixture([probe('2026-10-30T03:00:00Z', '198.51.100.7')], 'svc-web-router-20261029T013137.626.log')
  fixture([started('off', '2026-10-30T04:00:00Z')], 'svc-web-nssm-20261029T013137.626.log')
  const r = collect({ logPath: path.join(dir, 'svc-web-router.log') })
  const names = r.files.map((f) => f.split(/[\\/]/).pop()).sort()
  assert.deepEqual(names, ['svc-web-router-20261029T013137.626.log', 'svc-web-router.log'])
  assert.equal(r.liveness.state, 'ok', 'nssm 那份的 off 不得污染 router 自己的判据')
  assert.equal(r.probes.externalDistinct, 1)
})

test('端到端:文件不存在 ⇒ 未判定,不冒充 ok', () => {
  const r = collect({ logPath: path.join(dir, 'nope-svc-web-router.log') })
  assert.equal(r.liveness.state, 'unjudged')
})

// ── 接线形状锁(造好没装车 = 没有,守门 89 R4 同一条理由)──────────────────
const HERE = path.dirname(fileURLToPath(import.meta.url))
const GUARDIAN = path.resolve(HERE, '..', 'git-guardian.mjs')
const SRC = readFileSync(GUARDIAN, 'utf8')

test('派发腿已挂上单轮巡检路径', () => {
  assert.match(SRC, /if \(!CHECK_ONLY\) auditOriginGuardLiveness\(\)/)
})

test('派发腿已进 __test__ 出口(否则接线锁只能读字符串)', () => {
  assert.ok(typeof G2.auditOriginGuardLiveness === 'function')
})

test('尺子在位时真跑一轮;并把节流戳写进夹具,不消耗生产 6h 窗口', async () => {
  const lines = []
  const r = await G2.auditOriginGuardLiveness({
    now: Date.parse('2026-10-30T12:00:00Z'),
    logger: (m) => lines.push(m),
    notify: () => {
      throw new Error('ok 档不该发信')
    },
    tickFile: path.join(dir, 'tick.iso'),
    lastFile: path.join(dir, 'last.json'),
  })
  assert.equal(r.ran, true, '尺子在位,应真跑一轮')
  assert.equal(r.judged, true, '真日志应给出结论,不得落未判定')
  assert.equal(r.breaches, 0, `此刻守卫应为 enforce 在位;实读 ${JSON.stringify(r)}`)
  assert.match(lines.join('\n'), /源站守卫存续:enforce 在位/)
  assert.ok(existsSync(path.join(dir, 'tick.iso')), '节流戳必须落下,否则每轮都真跑')
})

test('未到节流窗口 ⇒ 一个子进程都不派生', async () => {
  const tick = path.join(dir, 'tick2.iso')
  writeFileSync(tick, new Date(Date.parse('2026-10-30T11:59:00Z')).toISOString(), 'utf8')
  let notified = 0
  const r = await G2.auditOriginGuardLiveness({
    now: Date.parse('2026-10-30T12:00:00Z'),
    intervalMs: 6 * 60 * 60 * 1000,
    logger: () => {},
    notify: () => {
      notified += 1
    },
    tickFile: tick,
    lastFile: path.join(dir, 'last2.json'),
  })
  assert.equal(r.ran, false)
  assert.equal(notified, 0)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
