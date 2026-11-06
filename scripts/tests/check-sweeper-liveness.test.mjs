// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 「派发在动、留痕静默」背离巡检(2026-10-23 立,机主令"要")的镜像测试。
// 判据一律 import 自 `../check-sweeper-liveness.mjs` 与 `../git-guardian.mjs` 的 `__test__`
// 出口(§22c),本文件不重写任何判定;守护层只锁"装车成套 + 节流有牙 + 三态分档"。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as G } from '../git-guardian.mjs'
import { __test__ as P } from '../check-sweeper-liveness.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const GUARDIAN_SRC = readFileSync(fileURLToPath(new URL('../git-guardian.mjs', import.meta.url)), 'utf8')
const PROBE_SRC = readFileSync(fileURLToPath(new URL('../check-sweeper-liveness.mjs', import.meta.url)), 'utf8')

const NOW = Date.parse('2026-10-23T12:00:00Z')
const MIN = 60000
const min = (m) => m * MIN
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

/**
 * 单函数切片(2026-11-05 修既存红):旧写法用「本函数行首 → 另一个硬编码函数名」取体,
 * 别席往中间插入 auditIndexUnmerged / auditLintStagedPins 之后,切片一下跨了 3 个函数,
 * 邻座的 notifyGuardRed 被算到本探针头上 ⇒ 「只读探针不喊人」恒红(与提交内容无关的红门,§12e)。
 * 改成按 `^export function` 边界只切**一个**函数体:判据没有放宽,只是不再串味。
 */
function oneLegBody(name) {
  const at = GUARDIAN_SRC.indexOf(`export function ${name}(`)
  assert.ok(at >= 0, `找不到 export function ${name}(装车锁该红在这里,不许默认已接线)`)
  const rest = GUARDIAN_SRC.slice(at + 1)
  const nxt = rest.search(/^export function /m)
  assert.ok(nxt > 0, `${name} 之后找不到函数边界 ⇒ 切片不可信,按判红处理`)
  return GUARDIAN_SRC.slice(at, at + 1 + nxt)
}

test('只读探针铁律:不改守护退出码、不喊人(§12e 恒红门禁令)', () => {
  const body = oneLegBody('auditSweeperLiveness')
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
  const body = oneLegBody('auditSweeperLiveness')
  assert.ok(!/planSweep|partitionStaleByProtection|staleClosedVerdict/.test(body), '派发层不该自己算存量(它只负责节流、派发、分档)')
})

test('两族配置与生产端逐字一致:tick/ledger 文件名不许别席改格', () => {
  assert.deepEqual(
    P.FAMILIES.map((f) => [f.id, f.tick, f.ledger, f.ledgerKind]),
    [
      ['closed-stock', 'plan-closed-sweep-last.json', 'plan-row-drop.jsonl', 'stale-closed-sweep'],
      ['claim-marks', 'stale-claim-strip-last.json', 'stale-claim-strip.jsonl', null],
      // 第三族没有这两个输入:键表从 git-guardian.mjs 源码现解析(§0.6),所以 tick/ledger 恒 null
      ['dispatch-parity', null, null, null],
    ],
  )
  // 守护派发点写的 tick 文件名必须同款(改一格 = 探针永远读不到派发心跳)
  assert.match(GUARDIAN_SRC, /plan-closed-sweep-last\.json/)
  assert.match(GUARDIAN_SRC, /stale-claim-strip-last\.json/)
})

// ── 第三族 dispatch-parity(票 RP-74;判据一律 import,本文件不另写一份 §22c)────────
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 造一个"只有一份守护源码 + 一个 state 目录"的夹具仓根,族三的全部输入都在这里现解析/现读。 */
function parityHarness(source) {
  const root = mkScratch('sweeper-parity-')
  mkdirSync(path.join(root, 'scripts'), { recursive: true })
  mkdirSync(path.join(root, '.ihui-agent', 'state'), { recursive: true })
  if (source !== null) writeFileSync(path.join(root, 'scripts', 'git-guardian.mjs'), source, 'utf8')
  return {
    root,
    guardian: (text) => writeFileSync(path.join(root, 'scripts', 'git-guardian.mjs'), text, 'utf8'),
    stamp: (name, atMs) =>
      writeFileSync(
        path.join(root, '.ihui-agent', 'state', name),
        JSON.stringify({ attemptAt: new Date(atMs).toISOString() }),
        'utf8',
      ),
    carrier: (atMs) =>
      writeFileSync(
        path.join(root, '.ihui-agent', 'state', 'git-guardian.lock'),
        `pid=9\nat=${new Date(atMs).toISOString()}\nrole=git-guardian:daemon\n`,
        'utf8',
      ),
    kindOf: (leg) => {
      const v = P.dispatchParityVerdict({ nowMs: NOW, root })
      const hit = (v.items ?? []).find((x) => x.leg === leg)
      return hit ? hit.kind : null
    },
  }
}

test('族三零清单:键表只能来自现解析守护源码,本探针里不许出现第二份腿清单(§0.6)', () => {
  assert.equal(P.FAMILIES[2].id, 'dispatch-parity')
  assert.equal(typeof P.FAMILIES[2].selfVerdict, 'function')
  assert.equal(P.FAMILIES[2].stockOf, undefined, '族三不自算存量,它算的是双链对等')
  // 族三的实现必须"读源码 + 解默认值",不是拿常量数组比名字
  assert.match(PROBE_SRC, /readFileSync\(path\.join\(root,\s*'scripts',\s*'git-guardian\.mjs'\)/)
  assert.match(PROBE_SRC, /intervalMs\\s\*\[:=\]/)
  assert.match(PROBE_SRC, /\[Tt\]ickFile\\s\*\[:=\]/)
  // 本测试文件也不许出现硬编码腿清单:全部经 P.__test__ 取(§22c)
  assert.ok(!/const\s+PARITY_LEGS\s*=/.test(PROBE_SRC), '族三若内置腿清单 = 第二份真相源,必漂')
})

test('族三未判定不记绿:取不到守护源码 ⇒ undetermined 并点名文件(§0.3/§0.4)', () => {
  const h = parityHarness(null)
  try {
    const v = P.dispatchParityVerdict({ nowMs: NOW, root: h.root })
    assert.equal(v.state, 'undetermined')
    assert.equal(v.why, 'guardian-source-unreadable')
    assert.ok(v.detail.includes('scripts/git-guardian.mjs'), `未判定必须点名取不到的那枚输入:${v.detail}`)
    assert.equal(v.stock, 0, '未判定不得折算成"有 N 条背离",也不得折算成 0 条通过')
  } finally {
    rmScratch(h.root)
  }
})

test('族三键表自证:真源码现解析出 ≥90 条腿,两条链都非空(解析到 0 条按未判定处理)', () => {
  const v = P.dispatchParityVerdict({ nowMs: Date.now(), root: REPO_ROOT })
  assert.ok(v.mainFace > 0 && v.tickFace > 0, `两条执行体链都判不出:main=${v.mainFace} tick=${v.tickFace}`)
  assert.ok(v.legsParsed >= 90, `现解析键表只有 ${v.legsParsed} 条(2026-11-05 现读 ≥100)⇒ 解析面塌了`)
  assert.equal(v.why === 'dispatch-key-table-empty', false, '键表 0 条必须落未判定,这里不该成立')
})

test('族三背离有牙:真源码里凡 main-only 的腿都必须挂点旁有具名理由(§0.7 验过才免)', () => {
  const v = P.dispatchParityVerdict({ nowMs: Date.now(), root: REPO_ROOT })
  const naked = (v.items ?? []).filter((x) => x.kind === 'main-only')
  assert.deepEqual(
    naked.map((x) => x.leg),
    [],
    `这些腿只挂在一次性 main 链且挂点旁没有 dispatch-parity-exempt 理由:${naked.map((x) => x.leg).join(', ')}`,
  )
  assert.ok(v.deferred >= 1, `B 档腿一条也没被具名豁免(deferred=${v.deferred})⇒ 标记行被摘了`)
})

test('族三变异自证:摘掉挂点旁的豁免标记行 ⇒ 该腿立刻进背离;补回来 ⇒ 归 deferred', () => {
  // 拿真源码做夹具(只写进 scratch,不碰仓库那枚),证明"豁免"不是白拿的
  const h = parityHarness(GUARDIAN_SRC)
  try {
    const withMark = P.dispatchParityVerdict({ nowMs: Date.now(), root: h.root })
    const nakedBefore = (withMark.items ?? []).filter((x) => x.kind === 'main-only').map((x) => x.leg)
    assert.deepEqual(nakedBefore, [], `基线就该零裸腿,实得:${nakedBefore.join(',')}`)
    const stripped = GUARDIAN_SRC.split(/\r?\n/)
      .filter((l) => !/dispatch-parity-exempt:/.test(l))
      .join('\n')
    assert.ok(stripped.length < GUARDIAN_SRC.length, '夹具没真摘掉标记行 ⇒ 本自证无效')
    h.guardian(stripped)
    const after = P.dispatchParityVerdict({ nowMs: Date.now(), root: h.root })
    const nakedAfter = (after.items ?? []).filter((x) => x.kind === 'main-only').map((x) => x.leg)
    assert.ok(nakedAfter.length >= 1, '摘掉全部豁免标记后仍零背离 ⇒ 这道判据是瞎的(恒绿)')
    assert.ok(
      nakedAfter.includes('ensureS4u') || nakedAfter.includes('ensureGuardDaemonAlive'),
      `摘标记必须点到 B 档那两腿,实得:${nakedAfter.join(', ')}`,
    )
    assert.ok(after.deferred === 0, `标记摘干净了 deferred 还 >0 ⇒ deferred 不是从源码现算的:${after.deferred}`)
  } finally {
    rmScratch(h.root)
  }
})

test('族三冻结戳有牙,且承载面停摆时降级成未判定(不冒名 stalled)', () => {
  const h = parityHarness(GUARDIAN_SRC)
  try {
    h.carrier(NOW - MIN) // 承载面 1 分钟前刚 beat ⇒ 执行体在动
    h.stamp('plan-closed-sweep-last.json', NOW - 60 * 60 * MIN) // 5 分钟节律的腿 60 分钟没动
    assert.equal(h.kindOf('sweepStaleClosedRows'), 'stamp-frozen', '戳冻结却没点名 ⇒ 键表→戳这条路没接上')
    h.carrier(NOW - 4 * 60 * MIN) // 整条执行体停了 4 小时
    assert.equal(
      h.kindOf('sweepStaleClosedRows'),
      'carrier-not-moving',
      '承载面自己没在动时不许把账算到单条腿头上(与 verdictFor 的 dispatch-not-moving 同一纪律)',
    )
    h.carrier(NOW - MIN)
    h.stamp('plan-closed-sweep-last.json', NOW - 4 * MIN) // 刚写过 ⇒ 不点名
    assert.equal(h.kindOf('sweepStaleClosedRows'), null, '新鲜戳被算成背离 ⇒ 判据过严会天天狼来了')
  } finally {
    rmScratch(h.root)
  }
})

/** 最小双链夹具:一条「无戳位」腿(具名声明)+ 一条正常戳位腿。两条链各 ≥20 行(tick 区段形状判据)。 */
function parityFixtureSource() {
  const pad = Array.from({ length: 20 }, (_, i) => `  const pad${i} = ${i}`)
  return [
    'async function main() {',
    '  const CHECK_ONLY = false',
    ...pad,
    '  if (!CHECK_ONLY) auditNoStampLeg()',
    '  if (!CHECK_ONLY) auditStampedLeg()',
    '}',
    'function startDaemon() {',
    '  const CHECK_ONLY = false',
    ...pad,
    '  const tick = () => {',
    '    const q0 = 0',
    ...Array.from({ length: 20 }, (_, i) => `    const q${i + 1} = ${i}`),
    '    if (!CHECK_ONLY) auditNoStampLeg()',
    '    if (!CHECK_ONLY) auditStampedLeg()',
    '  }',
    '  setInterval(tick, 1000)',
    '}',
    '// dispatch-parity-no-stamp: auditNoStampLeg 只在异常时动作,没有可写周期戳的位置',
    'function auditNoStampLeg() {',
    '  return null',
    '}',
    'function auditStampedLeg({ tickFile = STAMPED_TICK, intervalMs = STAMPED_INTERVAL_MS } = {}) {',
    '  return tickFile',
    '}',
    "const STAMPED_TICK = join(STATE_DIR, 'stamped-tick.json')",
    'const STAMPED_INTERVAL_MS = 5 * 60 * 1000',
    '',
  ].join('\n')
}

test('族三无戳位腿:具名声明后保持 undetermined,不折成 stalled/live(§0.3)', () => {
  const h = parityHarness(parityFixtureSource())
  try {
    h.carrier(NOW - MIN) // 承载面在动
    h.stamp('stamped-tick.json', NOW - MIN) // 有戳位的腿新鲜 ⇒ 唯一未判来源只能是那条无戳位腿
    const v = P.dispatchParityVerdict({ nowMs: NOW, root: h.root })
    const item = (v.items ?? []).find((x) => x.leg === 'auditNoStampLeg')
    assert.ok(item, '无戳位腿必须逐条点名,不许静默略过')
    assert.equal(item.kind, 'no-stamp-slot', `无戳位腿被读成了 ${item.kind}(应保持未判定)`)
    assert.match(item.detail, /无戳位，判据不适用/, `理由必须写清"判据不适用":${item.detail}`)
    assert.equal(v.state, 'undetermined', `只有无戳位腿未判时不许读成 ${v.state}(§0.3)`)
    assert.equal(v.stock, 0, '无戳位不是背离,不得计入 stalled 存量')
  } finally {
    rmScratch(h.root)
  }
})

test('族三解析面:曾「无戳位/无节律」的腿全部接上,残留未判定只剩具名无戳位(§0.6)', () => {
  const v = P.dispatchParityVerdict({ nowMs: Date.now(), root: REPO_ROOT })
  const residual = (v.items ?? []).filter((x) =>
    ['tickfile-unresolved', 'interval-unresolved', 'no-fn-body'].includes(x.kind),
  )
  assert.deepEqual(
    residual.map((x) => `${x.leg}[${x.kind}]`),
    [],
    `仍有腿解析不出戳位/节律(2026-11-06 现读应为 0):${residual.map((x) => x.leg).join(', ')}`,
  )
  const noStamp = (v.items ?? []).filter((x) => x.kind === 'no-stamp-slot')
  assert.ok(noStamp.length >= 12, `具名无戳位腿只剩 ${noStamp.length} 条(应为 12)⇒ 标记行被摘了`)
  assert.ok(
    noStamp.every((x) => /无戳位，判据不适用/.test(x.detail)),
    '无戳位腿必须逐条写清「无戳位,判据不适用」',
  )
})

test('族三节流戳读数器:ISO 文本 / epoch 毫秒 / JSON attemptAt 三形态都吃得,读不出不折成 0', () => {
  const dir = mkScratch('sweeper-parity-stamp-')
  try {
    const iso = path.join(dir, 'a.ts')
    writeFileSync(iso, new Date(NOW - 7 * MIN).toISOString(), 'utf8')
    assert.equal(P.readStampMs(iso), NOW - 7 * MIN)
    const ms = path.join(dir, 'b.tick')
    writeFileSync(ms, String(NOW - 3 * MIN), 'utf8')
    assert.equal(P.readStampMs(ms), NOW - 3 * MIN)
    const json = path.join(dir, 'c.json')
    writeFileSync(json, JSON.stringify({ attemptAt: new Date(NOW - MIN).toISOString() }), 'utf8')
    assert.equal(P.readStampMs(json), NOW - MIN)
    const bad = path.join(dir, 'd.json')
    writeFileSync(bad, '{畸形', 'utf8')
    assert.equal(P.readStampMs(bad), null, '形状读不出必须 null,不许猜一个时刻')
    assert.equal(P.readStampMs(path.join(dir, 'nope.json')), 'missing', '文件不在 ⇒ missing(≠ 没跑过就一定红)')
    const lock = path.join(dir, 'git-guardian.lock')
    writeFileSync(lock, `pid=1\nat=${new Date(NOW - 2 * MIN).toISOString()}\nrole=git-guardian:round\n`, 'utf8')
    assert.equal(P.readCarrierAt(lock), NOW - 2 * MIN)
    writeFileSync(path.join(dir, 'bare.lock'), 'pid=1\nrole=x\n', 'utf8')
    assert.equal(P.readCarrierAt(path.join(dir, 'bare.lock')), null, '锁里没有 at= ⇒ 未判定,不读成"刚跳过"')
    assert.equal(P.readCarrierAt(path.join(dir, 'nope.lock')), 'missing')
  } finally {
    rmScratch(dir)
  }
})

test('族三接进 measure():三族齐全、族三不自读节流台账(它没有那两个输入)', () => {
  const m = P.measure({ nowMs: Date.now(), root: REPO_ROOT })
  assert.deepEqual(
    m.families.map((f) => f.id),
    ['closed-stock', 'claim-marks', 'dispatch-parity'],
  )
  const p = m.families.find((f) => f.id === 'dispatch-parity')
  assert.equal(p.tick, null, '族三若还带 tick 文件名,就是又抄了一份派发心跳(§0.6)')
  assert.equal(p.ledger, null)
  assert.ok(p.legsParsed >= 90 && p.bits.length >= 4, `族三读数缺失:${JSON.stringify(p).slice(0, 160)}`)
})
