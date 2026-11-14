// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 永久保活「纯终态轮次」正交闸门镜像测试(2026-11-15 立)。
 *
 * 器物 scripts/relay-account-keepalive.mjs 新增 IRREVERSIBLE_VERDICTS / alertPlanFor:
 * 判死号首封走超长窗一次性通知,已通知过则 skipThisRound 静默跳过(skipped 单列,不进
 * delivered/suppressed/failed/undetermined)。但器物只追加字段、没改 KEEPALIVE-RESULT state
 * 三态 ⇒ guardian 仍按 state=alert 在 6h 后重派一轮,纯判死轮次空转。
 *
 * 本测试钉住 guardian 侧的**正交**修法:读结论行新增计数做独立终态判定,不碰 state 三态、
 * 不改 keepalive-forever-dispatch.test.mjs 的 T4/T10 断言:
 *   A 纯终态轮次(terminal>0 + 四计数全 0)⇒ 不再重派;
 *   B 可逆失败(旧格式 / terminal=0)⇒ 仍 6h 重派;
 *   C 混合轮次(有判死也有非终态活动)⇒ 仍 6h 重派;
 *   D/E/F 反向牙:字段缺失/非数字 fail-closed、state 三态与 tick 结构不被污染。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as guardian } from '../git-guardian.mjs'

const { sweepKeepAliveForever } = guardian

const HOUR = 60 * 60 * 1000
const NOW = Date.parse('2026-11-15T00:00:00Z')

// 旧格式(器物修好之前):无 terminal / delivered / suppressed / failed / undetermined 字段。
// T4/T10 用的正是这一族 ⇒ 正交判定必须恒不触发。
const LEGACY_ALERT =
  'KEEPALIVE-RESULT state=alert registered=1 refreshed=0 refreshFailed=1 keepalive=1 heartbeat=0 alerts=1 mailed=1'

// 新格式骨架(对齐 relay-account-keepalive.mjs:432-439),各用例只改末尾五个计数。
const NEW = (fields) =>
  'KEEPALIVE-RESULT state=alert registered=2 refreshed=0 refreshFailed=0 keepalive=2 heartbeat=0' +
  ' foreverDeferred=0 alerts=2 mailed=0' +
  ` delivered=${fields.delivered ?? 0} suppressed=${fields.suppressed ?? 0}` +
  ` failed=${fields.failed ?? 0} undetermined=${fields.undetermined ?? 0} terminal=${fields.terminal ?? 0}`

function harness(t, out = LEGACY_ALERT) {
  const dir = mkScratch('keepalive-terminal-dispatch')
  t.after(() => rmScratch(dir))
  const calls = []
  const logs = []
  const mails = []
  const opts = {
    now: NOW,
    tickFile: join(dir, 'tick.json'),
    logger: (m) => logs.push(String(m)),
    notify: (title, body, o) => mails.push({ title, body, dedupKey: o?.dedupKey ?? '' }),
    runner: () => {
      calls.push({ tickWritten: existsSync(join(dir, 'tick.json')) })
      return { ok: true, out, status: 0 }
    },
  }
  return { dir, calls, logs, mails, opts }
}

test('A 纯终态轮次(terminal>0 + 四计数全 0)⇒ 6h 后不再重派', (t) => {
  const h = harness(t, NEW({ terminal: 2 }))
  const first = sweepKeepAliveForever(h.opts)
  assert.equal(first.ran, true, '首轮本就派发了器物')
  assert.equal(first.state, 'alert', 'state 三态一字未动:仍是器物自报的 alert')
  assert.equal(first.ok, false)
  assert.equal(h.mails.length, 0, '纯终态轮次不额外喊人')
  assert.equal(h.calls.length, 1)
  h.opts.now = NOW + 7 * HOUR // 已越过 alert 的 6h 窗口
  const late = sweepKeepAliveForever(h.opts)
  assert.equal(late.ran, false, '判死号已一次性通知过,再派只会空转 ⇒ 不重派')
  assert.ok(String(late.why).includes('纯终态'), 'why 要写明不重派的理由')
  assert.equal(h.calls.length, 1, '7h 后不得再次派生器物')
})

test('B 可逆失败(旧格式 alert,无 terminal 字段)⇒ 仍按 6h 重派', (t) => {
  const h = harness(t, LEGACY_ALERT)
  const first = sweepKeepAliveForever(h.opts)
  assert.equal(first.state, 'alert')
  h.opts.now = NOW + 2 * HOUR
  assert.equal(sweepKeepAliveForever(h.opts).ran, false, '2h 未到 6h 窗口')
  h.opts.now = NOW + 7 * HOUR
  assert.equal(sweepKeepAliveForever(h.opts).ran, true, '满 6h 窗口仍要给下一次机会')
  assert.equal(h.calls.length, 2)
})

test('B2 可逆失败(新格式 terminal=0 + delivered=1)⇒ 仍按 6h 重派', (t) => {
  const h = harness(t, NEW({ terminal: 0, delivered: 1 }))
  sweepKeepAliveForever(h.opts)
  h.opts.now = NOW + 2 * HOUR
  assert.equal(sweepKeepAliveForever(h.opts).ran, false)
  h.opts.now = NOW + 7 * HOUR
  assert.equal(sweepKeepAliveForever(h.opts).ran, true)
})

test('C 混合轮次(有判死也有首封通知 delivered>0)⇒ 仍按 6h 重派', (t) => {
  const h = harness(t, NEW({ terminal: 1, delivered: 1 }))
  sweepKeepAliveForever(h.opts)
  h.opts.now = NOW + 2 * HOUR
  assert.equal(sweepKeepAliveForever(h.opts).ran, false)
  h.opts.now = NOW + 7 * HOUR
  assert.equal(sweepKeepAliveForever(h.opts).ran, true, '混合轮次仍需观察 ⇒ 6h 后重派')
})

test('C2 混合轮次(terminal>0 + suppressed/undetermined 非 0)⇒ 仍按 6h 重派', (t) => {
  const h = harness(t, NEW({ terminal: 2, suppressed: 1, undetermined: 1 }))
  sweepKeepAliveForever(h.opts)
  h.opts.now = NOW + 7 * HOUR
  assert.equal(sweepKeepAliveForever(h.opts).ran, true)
})

test('D 计数为 ? / 字段缺失 ⇒ fail-closed,不得误停保活', (t) => {
  const h = harness(
    t,
    'KEEPALIVE-RESULT state=alert registered=2 alerts=2 mailed=0 delivered=? suppressed=0 failed=0 undetermined=0 terminal=2',
  )
  sweepKeepAliveForever(h.opts)
  h.opts.now = NOW + 7 * HOUR
  assert.equal(
    sweepKeepAliveForever(h.opts).ran,
    true,
    '没判不写成判过 ⇒ 读不到/非数字的计数一律保守保留 6h 重派',
  )
})

test('E 旧格式轮次不写 terminalIdle 字段(节流台账结构不被污染)', (t) => {
  const h = harness(t, LEGACY_ALERT)
  sweepKeepAliveForever(h.opts)
  const rec = JSON.parse(readFileSync(join(h.dir, 'tick.json'), 'utf8'))
  assert.equal(rec.state, 'alert')
  assert.equal(rec.attemptAt, new Date(NOW).toISOString())
  assert.equal('terminalIdle' in rec, false, '正交字段只在纯终态轮次出现')
})

test('F 纯终态轮次把 terminalIdle 独立写进 tick(state 字段值不变)', (t) => {
  const h = harness(t, NEW({ terminal: 2 }))
  sweepKeepAliveForever(h.opts)
  const rec = JSON.parse(readFileSync(join(h.dir, 'tick.json'), 'utf8'))
  assert.equal(rec.state, 'alert', '写入 tick 的 state 值不变')
  assert.equal(rec.attemptAt, new Date(NOW).toISOString())
  assert.equal(rec.terminalIdle, true)
})

// ─────────────────────────────────────────────────────────────────────────────
// 复活探针(2026-11-15 续):terminalIdle 短路带 TTL,到期自动解除并重探。
// 单源取 TTL 值(§22c 零复制),测试内不写死 24h 这个数。
const IDLE_TTL = guardian.KEEPALIVE_FOREVER_TERMINAL_IDLE_TTL_MS

// runner 按调用序号切换结论行,模拟号池在两轮之间变化(新增号 / 人工换票救活);
// outs 用尽后固定停在最后一幕。
function revivalHarness(t, outs) {
  const dir = mkScratch('keepalive-terminal-revival')
  t.after(() => rmScratch(dir))
  const calls = []
  const logs = []
  const mails = []
  let seq = 0
  const opts = {
    now: NOW,
    tickFile: join(dir, 'tick.json'),
    logger: (m) => logs.push(String(m)),
    notify: (title, body, o) => mails.push({ title, body, dedupKey: o?.dedupKey ?? '' }),
    runner: () => {
      calls.push({ at: opts.now, tickWritten: existsSync(join(dir, 'tick.json')) })
      const out = outs[Math.min(seq, outs.length - 1)]
      seq += 1
      return { ok: true, out, status: 0 }
    },
  }
  const tick = () => JSON.parse(readFileSync(join(dir, 'tick.json'), 'utf8'))
  return { dir, calls, logs, mails, opts, tick }
}

const PURE = () => NEW({ terminal: 2 })
const DUE = NOW + IDLE_TTL + HOUR // TTL 到期后 1h(确保越过到期边界)
const NEAR_DUE = NOW + IDLE_TTL - HOUR // TTL 内最后 1h

test('G1 ①② 纯终态写短路后,TTL 内(含越过 6h 窗口)一律不重派', (t) => {
  const h = revivalHarness(t, [PURE(), PURE()])
  const first = sweepKeepAliveForever(h.opts)
  assert.equal(first.ran, true, '首轮本就派发器物')
  assert.equal(first.state, 'alert', 'state 三态一字未动')
  assert.equal(h.tick().terminalIdle, true, '纯终态把独立短路写进 tick')
  // 7h 已越过 alert 的 6h 窗口:若拦的是窗口而非短路,这里就会 ran:true 露出原形
  h.opts.now = NOW + 7 * HOUR
  const overWindow = sweepKeepAliveForever(h.opts)
  assert.equal(overWindow.ran, false, '越过 6h 窗口仍不跑 ⇒ 拦的是终态短路不是节流')
  assert.ok(String(overWindow.why).includes('纯终态'), 'why 点名纯终态短路')
  // 逼近 TTL 边界仍不重探(反向牙:不能因为快到期就提前放跑)
  h.opts.now = NEAR_DUE
  assert.equal(sweepKeepAliveForever(h.opts).ran, false, 'TTL 内(23h)仍不重探')
  assert.equal(h.calls.length, 1, '整个 TTL 期内一次都没再派生(不打扰上游)')
})

test('G2 ③ TTL 到期 ⇒ 自动解除终态短路并重探一轮', (t) => {
  const h = revivalHarness(t, [PURE(), PURE()])
  sweepKeepAliveForever(h.opts) // 首轮短路,起点 NOW
  h.opts.now = NEAR_DUE
  assert.equal(sweepKeepAliveForever(h.opts).ran, false, '反向牙:到期前这一刻仍短路')
  h.opts.now = DUE
  const due = sweepKeepAliveForever(h.opts)
  assert.equal(due.ran, true, 'TTL 到期 ⇒ 短路自动解除,重新派发器物')
  assert.equal(h.calls.length, 2, '到期只重探一轮,没有变成每轮都跑')
  assert.equal(h.tick().attemptAt, new Date(DUE).toISOString(), '重探这一轮真的落笔台账')
})

test('G3 ④ 到期重探仍是纯终态 ⇒ 重新写入短路(且短路重新计时)', (t) => {
  const h = revivalHarness(t, [PURE(), PURE()])
  sweepKeepAliveForever(h.opts) // 首轮短路,起点 NOW
  h.opts.now = DUE
  const due = sweepKeepAliveForever(h.opts)
  assert.equal(due.ran, true, '到期重探真跑了一轮')
  assert.equal(h.calls.length, 2)
  const rec = h.tick()
  assert.equal(rec.terminalIdle, true, '仍纯终态 ⇒ 重新写入短路')
  assert.equal(rec.attemptAt, new Date(DUE).toISOString(), '短路按新 attemptAt 重新计时')
  assert.equal(rec.state, 'alert', 'state 三态不变')
  // 反向牙 A:新短路生效 —— 重探后 7h(已过 6h 窗口)仍不跑
  h.opts.now = DUE + 7 * HOUR
  assert.equal(sweepKeepAliveForever(h.opts).ran, false, '重新短路生效,7h 内不再跑')
  assert.equal(h.calls.length, 2)
  // 反向牙 B:不是退回「永久短路」,再一个 TTL 到期仍会再探一次
  h.opts.now = DUE + IDLE_TTL + HOUR
  assert.equal(sweepKeepAliveForever(h.opts).ran, true, '重新短路仍带 TTL,不是永久卡死')
  assert.equal(h.calls.length, 3)
})

test('G4 ⑤ 到期重探出现可逆失败/新号 ⇒ 短路解除、恢复正常 6h 节流', (t) => {
  // 第二幕:新格式 terminal=0 + delivered=1 ⇒ 号池里有非终态活动(新号被巡检/可逆失败)
  const revived = NEW({ terminal: 0, delivered: 1 })
  const h = revivalHarness(t, [PURE(), revived])
  sweepKeepAliveForever(h.opts) // 首轮纯终态短路
  h.opts.now = DUE
  const due = sweepKeepAliveForever(h.opts)
  assert.equal(due.ran, true, '复活号被到期重探重新看到')
  assert.equal(h.calls.length, 2)
  const rec = h.tick()
  assert.equal('terminalIdle' in rec, false, '非纯终态 ⇒ 短路字段被清空')
  assert.equal(rec.state, 'alert', 'state 三态不变,按 alert 档 6h 节流')
  // 反向牙 A:恢复节流,不是每轮都跑 —— 重探后 2h(未到 6h)不跑
  h.opts.now = DUE + 2 * HOUR
  assert.equal(sweepKeepAliveForever(h.opts).ran, false, '复活后回到常规 6h 节流,不是每轮重探')
  assert.equal(h.calls.length, 2)
  // 反向牙 B:满 6h 正常给下一次机会(§22c T10 语义不倒退)
  h.opts.now = DUE + 7 * HOUR
  assert.equal(sweepKeepAliveForever(h.opts).ran, true, '满 6h 窗口正常重派')
  assert.equal(h.calls.length, 3)
})

test('G5 ⑥ 旧格式结论行(无 terminal)⇒ 永不写 terminalIdle,复活重探路径也不误短路', (t) => {
  // 首轮纯终态短路 → 到期重探却拿到旧格式(器物回退 / 结论行无新增计数)
  const h = revivalHarness(t, [PURE(), LEGACY_ALERT])
  sweepKeepAliveForever(h.opts)
  assert.equal(h.tick().terminalIdle, true, '首轮确为纯终态短路')
  h.opts.now = DUE
  assert.equal(sweepKeepAliveForever(h.opts).ran, true, '到期重探照常发生')
  const rec = h.tick()
  assert.equal('terminalIdle' in rec, false, '旧格式 num(terminal)=null ⇒ 正交判定恒 false ⇒ 不写短路')
  assert.equal(rec.state, 'alert', '旧格式 state 三态不变')
  // 反向牙:旧格式按既有 T4/T10 的 6h 重派语义,不退化成永久短路
  h.opts.now = DUE + 7 * HOUR
  assert.equal(sweepKeepAliveForever(h.opts).ran, true, '旧格式仍按 6h 重派(§22c T4/T10 不倒退)')
  assert.equal(h.calls.length, 3)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
