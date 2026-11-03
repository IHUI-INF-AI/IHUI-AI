// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 「派发在动、留痕静默」背离巡检(2026-10-23 立,机主令"要")的镜像测试。
// 判据一律 import 自 `../check-sweeper-liveness.mjs` 与 `../git-guardian.mjs` 的 `__test__`
// 出口(§22c),本文件不重写任何判定;守护层只锁"装车成套 + 节流有牙 + 三态分档"。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as G } from '../git-guardian.mjs'
import { __test__ as P } from '../check-sweeper-liveness.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const GUARDIAN_SRC = readFileSync(fileURLToPath(new URL('../git-guardian.mjs', import.meta.url)), 'utf8')
const PROBE_SRC = readFileSync(fileURLToPath(new URL('../check-sweeper-liveness.mjs', import.meta.url)), 'utf8')

const NOW = Date.parse('2026-10-23T12:00:00Z')
const min = (m) => m * 60000
const hr = (h) => h * 3600000

function harness(extra = {}) {
  const dir = mkScratch('sweeper-liveness-gg-')
  const logs = []
  const calls = []
  const opts = {
    now: NOW,
    intervalMs: 30 * 60 * 1000,
    tickFile: path.join(dir, 'tick.json'),
    logger: (l) => logs.push(String(l)),
    runner: () => {
      calls.push(1)
      return { ok: true, out: JSON.stringify({ ok: true, overall: 'live', families: [] }), status: 0 }
    },
    ...extra,
  }
  return { dir, logs, calls, opts }
}

// ── 装车成套(§0.9:造好没装车 = 没有) ──────────────────────────────────────────
test('装车成套:背离巡检既在巡检轮里被派发,又挂在 __test__ 出口上', () => {
  assert.equal(typeof G.auditSweeperLiveness, 'function', '__test__ 必须导出本层')
  assert.ok(existsSync(fileURLToPath(new URL('../check-sweeper-liveness.mjs', import.meta.url))), '尺子脚本必须在位')
  const dispatch = GUARDIAN_SRC.split('\n').filter((l) => l.trim() === 'if (!CHECK_ONLY) auditSweeperLiveness()')
  assert.equal(dispatch.length, 1, `巡检轮派发点必须恰有一处实调用,实得 ${dispatch.length}`)
  assert.ok(!/^\s*\/\*|^\s*\/\/\s*if/.test(dispatch[0] ?? ''), '派发点不得写在注释里')
})

test('挂点位置:必须排在两把清扫器派发之后(同轮 tick 刚刷新才验得出健康)', () => {
  const lines = GUARDIAN_SRC.split('\n')
  const at = (needle) => lines.findIndex((l) => l.trim() === needle)
  const claim = at('if (!CHECK_ONLY) sweepStaleClaimMarks()')
  const liveness = at('if (!CHECK_ONLY) auditSweeperLiveness()')
  assert.ok(claim >= 0 && liveness > claim, `背离巡检必须排在 sweepStaleClaimMarks 之后(实得 claim@${claim} liveness@${liveness})`)
})

test('只读探针铁律:不改守护退出码、不喊人(§12e 恒红门禁令)', () => {
  const body = GUARDIAN_SRC.slice(
    GUARDIAN_SRC.indexOf('export function auditSweeperLiveness'),
    GUARDIAN_SRC.indexOf('export function auditTunnelLegHealth'),
  )
  assert.ok(!/notifyGuardRed/.test(body), '本格判的是巡检层空转,与提交内容无关 ⇒ 不得 notify')
  assert.ok(!/process\.exit/.test(body), '探针自己不得改退出码')
  assert.ok(/readProbeVerdict/.test(body), '结论必须走 readProbeVerdict 三态分档(rc=1/2 的 stdout 也是结论)')
})

// ── 节流 ─────────────────────────────────────────────────────────────────────
test('节流有牙:同一窗口内第二次派发必须零调用(closed 族存量要跑 H4 尺子,不宜每 2 分钟一遍)', () => {
  const h = harness()
  try {
    const first = G.auditSweeperLiveness(h.opts)
    assert.equal(first.ran, true, '首轮应当派发')
    assert.equal(h.calls.length, 1)
    assert.ok(existsSync(h.opts.tickFile), '先落"已尝试"台账,再派发')
    const second = G.auditSweeperLiveness({ ...h.opts, now: h.opts.now + 60_000 })
    assert.equal(second.ran, false, '未到窗口不得派发')
    assert.equal(second.why, '未到节流窗口')
    assert.equal(h.calls.length, 1, '节流失效 = 每 2 分钟一遍 H4 尺子')
  } finally {
    rmScratch(h.dir)
  }
})

test('到窗再派发:跨过 30 分钟节流后必须再次调用尺子', () => {
  const h = harness()
  try {
    G.auditSweeperLiveness(h.opts)
    const later = G.auditSweeperLiveness({ ...h.opts, now: h.opts.now + 31 * 60 * 1000 })
    assert.equal(later.ran, true)
    assert.equal(h.calls.length, 2)
  } finally {
    rmScratch(h.dir)
  }
})

// ── 三态分档(只认尺子 JSON,中文文案不参与判定) ─────────────────────────────────
test('stalled 结论(exit 1 + stdout 整份 JSON)必须被采用,并打 ⚠️ 附 detail', () => {
  const stalledJson = JSON.stringify({
    ok: false,
    overall: 'stalled',
    families: [
      {
        id: 'claim-marks',
        label: '超龄认领牌代摘',
        state: 'stalled',
        tickAgeMin: 1,
        ledgerSilentMin: 200,
        stock: 4,
        detail: '派发在动但摘除留痕已静默 200 分钟',
        stockNote: '待摘 4 枚(护栏③ 未让路)',
      },
    ],
  })
  const h = harness({ runner: () => ({ ok: false, out: stalledJson, status: 1 }) })
  try {
    const r = G.auditSweeperLiveness(h.opts)
    assert.equal(r.ran, true)
    assert.equal(r.overall, 'stalled')
    assert.equal(r.stalled, 1, 'rc=1 不是"尺子坏了",结论在 stdout 里(§5e)')
    assert.ok(
      h.logs.some((l) => l.startsWith('⚠️') && /claim-marks/.test(l) && /静默 200 分钟/.test(l)),
      `日志必须带出静默时长与存量,实得:${h.logs.join(' | ')}`,
    )
  } finally {
    rmScratch(h.dir)
  }
})

test('从未留痕(ledgerSilentMin=null)也要能把"从未写过"说清楚,不得显示成 0 分钟', () => {
  const json = JSON.stringify({
    ok: false,
    overall: 'stalled',
    families: [
      {
        id: 'closed-stock',
        label: '完成即删清扫',
        state: 'stalled',
        tickAgeMin: 1,
        ledgerSilentMin: null,
        stock: 3,
        detail: '摘除成功落地却一行留痕都不写',
        stockNote: '可摘 3 条',
      },
    ],
  })
  const h = harness({ runner: () => ({ ok: false, out: json, status: 1 }) })
  try {
    G.auditSweeperLiveness(h.opts)
    assert.ok(
      h.logs.some((l) => /从未写过/.test(l)),
      `"从未留痕"必须原样说出,实得:${h.logs.join(' | ')}`,
    )
  } finally {
    rmScratch(h.dir)
  }
})

test('尺子没产出 stdout ⇒ 未判定并带原因,不抛也不读成绿(§0.3)', () => {
  const h = harness({ runner: () => ({ ok: false, out: '', err: '尺子起不来', status: null }) })
  try {
    const r = G.auditSweeperLiveness(h.opts)
    assert.equal(r.ran, true)
    assert.equal(r.ok, false, '尺子跑不动必须如实返回')
    assert.ok(
      h.logs.some((l) => l.startsWith('⚠️') && /未判定/.test(l) && /尺子起不来/.test(l)),
      `日志必须带上 rc 与 stderr,实得:${h.logs.join(' | ')}`,
    )
  } finally {
    rmScratch(h.dir)
  }
})

// ── 判据本体(import 探针 __test__,不重写) ─────────────────────────────────────
test('三态判据:live / idle-clean / stalled 的分界逐条钉住', () => {
  assert.equal(P.verdictFor({ tickAt: NOW - min(5), ledgerAt: NOW - min(3), stock: 5, nowMs: NOW }).state, 'live')
  assert.equal(
    P.verdictFor({ tickAt: NOW - min(2), ledgerAt: NOW - hr(10), stock: 0, nowMs: NOW }).state,
    'idle-clean',
    '存量 0 时留痕再静默也不点名(防"护栏必触发"型狼来了)',
  )
  assert.equal(
    P.verdictFor({ tickAt: NOW - min(2), ledgerAt: NOW - hr(3), stock: 7, nowMs: NOW }).state,
    'stalled',
  )
  assert.equal(
    P.verdictFor({ tickAt: NOW - min(1), ledgerAt: null, stock: 4, nowMs: NOW }).state,
    'stalled',
    '从未留痕 = 静默无限久(10-23 形态二)',
  )
})

test('未判定三型:tick 取不到 / tick 陈旧(派发停摆另属一族)/ 存量不可测,都不得读成绿或红', () => {
  assert.equal(P.verdictFor({ tickAt: null, ledgerAt: NOW - min(1), stock: 5, nowMs: NOW }).why, 'tick-unavailable')
  assert.equal(P.verdictFor({ tickAt: NOW - min(45), ledgerAt: NOW - hr(5), stock: 5, nowMs: NOW }).why, 'dispatch-not-moving')
  assert.equal(P.verdictFor({ tickAt: NOW - min(1), ledgerAt: NOW - min(1), stock: NaN, nowMs: NOW }).why, 'stock-unmeasured')
})

test('读数器:attemptAt / 留痕台账按 kind 过滤取最大 at / 文件不在 ⇒ null', () => {
  const dir = mkScratch('sweeper-liveness-readers-')
  try {
    const tickFile = path.join(dir, 'tick.json')
    writeFileSync(tickFile, JSON.stringify({ attemptAt: new Date(NOW - min(4)).toISOString() }), 'utf8')
    assert.equal(P.readTickAt(tickFile), NOW - min(4))
    writeFileSync(path.join(dir, 'bad.json'), '{oops', 'utf8')
    assert.equal(P.readTickAt(path.join(dir, 'bad.json')), null, '畸形 JSON ⇒ null,不猜')
    assert.equal(P.readTickAt(path.join(dir, 'nope.json')), null)

    const led = path.join(dir, 'led.jsonl')
    writeFileSync(
      led,
      [
        JSON.stringify({ at: new Date(NOW - hr(5)).toISOString(), kind: 'stale-closed-sweep' }),
        '{畸形行',
        JSON.stringify({ at: new Date(NOW - min(9)).toISOString(), kind: 'other-kind' }),
        JSON.stringify({ at: new Date(NOW - hr(1)).toISOString(), kind: 'stale-closed-sweep' }),
      ].join('\n') + '\n',
      'utf8',
    )
    assert.equal(P.readLedgerAt(led, 'stale-closed-sweep'), NOW - hr(1))
    assert.equal(P.readLedgerAt(led, 'other-kind'), NOW - min(9))
    assert.equal(P.readLedgerAt(path.join(dir, 'nope.jsonl'), null), null)
  } finally {
    rmScratch(dir)
  }
})

test('存量口径单一真相源:探针 import 生产实现,守护派发层零复算(§0.6/§22c)', () => {
  assert.match(PROBE_SRC, /import\s*\{\s*staleClosedVerdict\s*\}\s*from\s*'\.\/check-plan-closed-stock\.mjs'/)
  assert.match(PROBE_SRC, /closedRows\.partitionStaleByProtection\(/)
  assert.match(PROBE_SRC, /claimMarks\.planSweep\(/)
  assert.match(PROBE_SRC, /claimMarks\.planFaceBlockedBy\(/)
  const body = GUARDIAN_SRC.slice(
    GUARDIAN_SRC.indexOf('export function auditSweeperLiveness'),
    GUARDIAN_SRC.indexOf('export function auditTunnelLegHealth'),
  )
  assert.ok(!/planSweep|partitionStaleByProtection|staleClosedVerdict/.test(body), '派发层不该自己算存量(它只负责节流、派发、分档)')
})

test('两族配置与生产端逐字一致:tick/ledger 文件名不许别席改格', () => {
  assert.deepEqual(
    P.FAMILIES.map((f) => [f.id, f.tick, f.ledger, f.ledgerKind]),
    [
      ['closed-stock', 'plan-closed-sweep-last.json', 'plan-row-drop.jsonl', 'stale-closed-sweep'],
      ['claim-marks', 'stale-claim-strip-last.json', 'stale-claim-strip.jsonl', null],
    ],
  )
  // 守护派发点写的 tick 文件名必须同款(改一格 = 探针永远读不到派发心跳)
  assert.match(GUARDIAN_SRC, /plan-closed-sweep-last\.json/)
  assert.match(GUARDIAN_SRC, /stale-claim-strip-last\.json/)
})
