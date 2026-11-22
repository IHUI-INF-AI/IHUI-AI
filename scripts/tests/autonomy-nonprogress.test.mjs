// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * autonomy-nonprogress.test.mjs —— 「空转记忆」判据的镜像锁(§22c:import 源脚本 __test__,零复算)
 *
 * 钉的是 2026-11-04 那枚真事故的形状:B53 三天 127 个班次、两种失败交替、连败永远清零、封票永远够不着。
 * 变异自证(每档成对):
 *   · 去掉 attemptsSinceProgress 的「其他 action 只跳过不断链」⇒ 交替形立刻归零(即原洞)
 *   · 去掉 parkHardLimit 那一档 ⇒ 终局不出现
 *   · 去掉 cooldown ⇒ 冷却档读不到到期
 * 反向断言同样在册:progress 必须归零、未登记动作不得计数。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as np } from '../lib/autonomy-nonprogress.mjs'
import { __test__ as evolve } from '../auto-evolve.mjs'

const K = 'a'.repeat(16)
const row = (action, extra = {}) => ({
  ticketKey: K,
  action,
  ts: '2026-11-04T00:00:00.000Z',
  ...extra,
})
/** 旧洞的形状:session-failed 与 runner-unavailable 交替 6 对。 */
const alternating = (pairs = 6) => {
  const out = []
  for (let i = 0; i < pairs; i++) out.push(row('session-failed'), row('runner-unavailable'))
  return out
}

test('T1 交替失败不再归零:6 对 = 12 次空转(旧 failureStreakOf 在同形上判 0)', () => {
  const ledger = alternating(6)
  assert.equal(np.attemptsSinceProgress(ledger, K), 12)
  // 尾部恰好是 runner-unavailable ⇒ 旧的"遇其他 action 即断"直接 break 成 0,封票阈值 3 结构上永远够不着。
  assert.equal(
    evolve.failureStreakOf(ledger, K),
    0,
    '旧连败在同形上读成 0 —— 这正是 B53 空转 127 次不被封的成因',
  )
})

test('T2 真推进必须归零(每档成对,不许只写"会数")', () => {
  const ledger = [...alternating(3), row('session-ok'), ...alternating(1)]
  assert.equal(np.attemptsSinceProgress(ledger, K), 2, 'session-ok 之后的两轮计入,之前的清零')
})

test('T3 无票键的轮次行不得污染计数', () => {
  const ledger = [
    row('session-failed'),
    { action: 'no-whitelist-hit' },
    { action: 'budget-exhausted' },
    row('runner-unavailable'),
  ]
  assert.equal(np.attemptsSinceProgress(ledger, K), 2)
})

test('T4 留痕动作本身不自我加码(否则 park 会自己把自己顶到硬顶)', () => {
  const ledger = [
    row('session-failed'),
    row('non-progress-hold', { attempts: 1 }),
    row('non-progress-parked', { attempts: 1 }),
  ]
  assert.equal(
    np.attemptsSinceProgress(ledger, K),
    1,
    'hold/parked 两行既非 progress 也非 non-progress ⇒ 一律不计',
  )
})

test('T5 阶梯四档各命中一次', () => {
  const base = { rotateAt: 4, parkAt: 8, hardAt: 24, cooldownHours: 24, lastStoodAt: null }
  assert.equal(np.decideNonProgress({ ...base, attempts: 3 }).route, 'try')
  assert.equal(np.decideNonProgress({ ...base, attempts: 4 }).route, 'rotate')
  // 冷却中:上次立起时刻 = now-1h < 24h
  const now = Date.parse('2026-11-04T00:00:00.000Z')
  const inCd = np.decideNonProgress({ ...base, attempts: 9, now, lastStoodAt: now - 3600_000 })
  assert.equal(inCd.route, 'cooldown')
  assert.match(inCd.why, /还差 \d+ 分钟/)
  // 冷却到期:上次立起 = 25h 前
  assert.equal(
    np.decideNonProgress({ ...base, attempts: 9, now, lastStoodAt: now - 25 * 3600_000 }).route,
    'try',
  )
  assert.equal(np.decideNonProgress({ ...base, attempts: 24 }).route, 'park')
})

test('T6 读不到上次冷却起点 ⇒ 放一次并在 why 里点名(不静默放行)', () => {
  const r = np.decideNonProgress({
    attempts: 10,
    rotateAt: 4,
    parkAt: 8,
    hardAt: 24,
    cooldownHours: 24,
    lastStoodAt: null,
  })
  assert.equal(r.route, 'try')
  assert.match(r.why, /读不到上次冷却起点/)
})

test('T7 档位不自洽一律未判定,不猜一档接着跑(§0.3)', () => {
  const cases = [
    { attempts: 5, rotateAt: 0, parkAt: 8, hardAt: 24, cooldownHours: 24 },
    { attempts: 5, rotateAt: 8, parkAt: 8, hardAt: 24, cooldownHours: 24 },
    { attempts: 5, rotateAt: 4, parkAt: 8, hardAt: 8, cooldownHours: 24 },
    { attempts: 5, rotateAt: 4, parkAt: 8, hardAt: 24, cooldownHours: 0 },
    { attempts: 5 },
  ]
  for (const c of cases) {
    const r = np.decideNonProgress(c)
    assert.equal(r.route, 'unjudged', `应判未判定:${JSON.stringify(c)}`)
    assert.ok(r.why.length > 6, '未判定必须点名原因')
  }
})

test('T8 明细归堆停在最近一次推进,并按条数降序', () => {
  const ledger = [
    row('runner-unavailable'),
    row('session-ok'),
    ...Array.from({ length: 5 }, () => row('session-failed')),
    ...Array.from({ length: 3 }, () => row('runner-unavailable')),
    row('no-whitelist-hit'),
  ]
  const bd = np.breakdownNonProgress(ledger, K)
  assert.deepEqual(
    bd,
    [
      { action: 'session-failed', count: 5 },
      { action: 'runner-unavailable', count: 3 },
    ],
    'session-ok 之前那条 runner-unavailable 不得被算进来',
  )
})

test('T9 上次立起时刻只认 non-progress-hold;读不到 ⇒ null', () => {
  assert.equal(
    np.lastNonProgressHoldAt([row('non-progress-hold', { ts: '2026-11-03T10:00:00.000Z' })], K),
    Date.parse('2026-11-03T10:00:00.000Z'),
  )
  assert.equal(np.lastNonProgressHoldAt([row('session-failed')], K), null)
  assert.equal(
    np.lastNonProgressHoldAt([{ action: 'non-progress-hold', ticketKey: 'other' }], K),
    null,
  )
})

test('T10 闸门真档位在真交替形上必须够得着终局(旧形连 3 都到不了)', () => {
  const g = evolve.loadGates()
  assert.ok(
    g.rotateAfterAttempts < g.parkAfterAttempts && g.parkAfterAttempts < g.parkHardLimit,
    '入库档位必须严格递增',
  )
  const attempts = np.attemptsSinceProgress(alternating(Math.ceil(g.parkHardLimit / 2)), K)
  assert.ok(
    attempts >= g.parkHardLimit,
    `B53 那种交替形现在算出 ${attempts} 次,须达硬顶 ${g.parkHardLimit}`,
  )
  assert.equal(
    np.decideNonProgress({
      attempts,
      rotateAt: g.rotateAfterAttempts,
      parkAt: g.parkAfterAttempts,
      hardAt: g.parkHardLimit,
      cooldownHours: g.parkCooldownHours,
    }).route,
    'park',
  )
  assert.ok(
    evolve.failureStreakOf(alternating(Math.ceil(g.parkHardLimit / 2)), K) <= 1,
    '反向对照:旧连败在同形上仍 ≈0 ⇒ 本器是唯一能拦住的轴',
  )
})

test('T11 坏 JSON 形状仍按既有 GateShapeError 抛(新增校验没把旧校验挤掉)', () => {
  const reader = (json) => () => json
  const okBase =
    '{"enabled":true,"dailyDispatchBudget":6,"failureStreakLimit":3,"quarantineHours":48,"maxSessionMinutes":45,"sessionCommandTemplate":"","ticketWhitelist":["i18n"]}'
  assert.doesNotThrow(() => evolve.loadGates(reader(okBase)), '缺四个新档 ⇒ 走保守缺省,不得炸')
  const g = evolve.loadGates(reader(okBase))
  assert.deepEqual(
    [g.rotateAfterAttempts, g.parkAfterAttempts, g.parkHardLimit, g.parkCooldownHours],
    [4, 8, 24, 24],
    '缺省值必须与入库档位一致',
  )
  assert.throws(
    () =>
      evolve.loadGates(
        reader(
          okBase.replace('"maxSessionMinutes":45', '"maxSessionMinutes":45,"parkHardLimit":0'),
        ),
      ),
    evolve.GateShapeError,
  )
  assert.throws(
    () =>
      evolve.loadGates(
        reader(
          okBase.replace('"maxSessionMinutes":45', '"maxSessionMinutes":45,"parkCooldownHours":-1'),
        ),
      ),
    evolve.GateShapeError,
  )
})

/**
 * T12–T14 阶梯的行过滤(2026-11-04 独立审抓出的两处自我放水)。
 * 都是"计数器吃自己喂的数据":一轮里对同一票落两行、以及 dry-run 预演行按真班次扣,
 * 任一成立都会让 rotate/park 阈值比账面提前到,而读数看起来一切正常。
 */
const nrow = (action, ts = '2026-11-04T05:00:00.000Z', key = 'k1', mode = 'dispatch') => ({
  action,
  ts,
  ticketKey: key,
  mode,
})

test('T12 同一次班次只计一次:发射端 informational 诊断行不进阶梯/明细(成对反向锁)', () => {
  // 2026-11-04 收口(§8 未闭环第 9 条):旧形是 auto-evolve.mjs 派发结果落 res.action、
  // 发起腿分型又落 runner-unavailable,两行 ts 相差数毫秒 ⇒ rotate4/park8 比账面提前到。
  // 现由发射端给第一行打 informational:true(保留 exitCode/tokens/transcript 供诊断),
  // 阶梯只数 runner-unavailable 那一行。
  const sameShift = [
    { ...nrow('session-failed', '2026-11-04T05:00:00.000Z'), informational: true },
    nrow('runner-unavailable', '2026-11-04T05:00:00.000Z'),
  ]
  assert.equal(np.attemptsSinceProgress(sameShift, 'k1'), 1, '装车后的新形态:两行只算一次班次')
  assert.equal(
    np.breakdownNonProgress(sameShift, 'k1').reduce((a, b) => a + b.count, 0),
    1,
    'escalation 明细与阶梯同口径,不许比判定多算',
  )
  // 反向锁 A:历史行(装车前、无标记)照旧各算一次 ⇒ 不追溯改写旧账。
  const legacy = [nrow('session-failed'), nrow('runner-unavailable')]
  assert.equal(np.attemptsSinceProgress(legacy, 'k1'), 2, '历史/无标记行不得被静默折叠')
  // 反向锁 B:不同轮次的两次真失败照常累加,不许借标记把真空转也抹掉。
  const twoRounds = [
    nrow('session-failed', '2026-11-04T05:00:00.000Z'),
    nrow('runner-unavailable', '2026-11-04T06:00:00.000Z'),
  ]
  assert.equal(np.attemptsSinceProgress(twoRounds, 'k1'), 2, '不同轮照常累加')
})

test('T12b 发起腿故障的诊断留痕不计票连败(与空转阶梯同一口径)', () => {
  const ledger = [
    { ticketKey: K, action: 'session-failed', informational: true, ts: '2026-11-04T05:00:00.000Z' },
    { ticketKey: K, action: 'runner-unavailable', ts: '2026-11-04T05:00:00.001Z' },
  ]
  assert.equal(evolve.failureStreakOf(ledger, K), 0, '发起腿自己的腿断了不该把票推去封禁')
  assert.equal(
    evolve.failureStreakOf([row('session-failed'), row('session-failed')], K),
    2,
    '反向:两次真连败仍照数',
  )
})

test('T13 dry-run 预演行不占班次 ⇒ 不进空转计数,也不能把票推向 park', () => {
  const dry = [nrow('artifact-manifest-invalid', '2026-11-04T05:00:00.000Z', 'k1', 'dryrun')]
  assert.equal(np.attemptsSinceProgress(dry, 'k1'), 0)
  const mixed = [
    nrow('artifact-manifest-invalid', '2026-11-04T05:00:00.000Z', 'k1', 'dryrun'),
    nrow('artifact-manifest-stale', '2026-11-04T06:00:00.000Z', 'k1', 'dispatch'),
  ]
  assert.equal(np.attemptsSinceProgress(mixed, 'k1'), 1, '只数真跑那一行')
})

test('T14 分档明细与计数器同口径:escalation 邮件不许比判定多算', () => {
  const ledger = [
    nrow('session-failed'),
    nrow('runner-unavailable'),
    nrow('artifact-manifest-invalid', '2026-11-04T04:00:00.000Z', 'k1', 'dryrun'),
    nrow('artifact-manifest-stale', '2026-11-04T06:00:00.000Z'),
  ]
  const sum = np.breakdownNonProgress(ledger, 'k1').reduce((a, b) => a + b.count, 0)
  assert.equal(
    sum,
    np.attemptsSinceProgress(ledger, 'k1'),
    '明细之和必须等于计数器读数(同一套行过滤)',
  )
  assert.equal(sum, 3, 'dry-run 那行被过滤,其余三行各算一次')
})

/**
 * T15 `session-no-write` 必须计空转(2026-11-04 立)。
 * 为什么单独立一档并钉住:此前 exit 0 一律 `session-ok`,而 session-ok 在 PROGRESS_ACTIONS 里
 * ⇒ 阶梯每轮被"成功"归零 ⇒ 一张永远推不动的票可以无限占班次(实测 9/9 次"成功"零写入、
 * `artifact-committed` 至今为 0)。它一旦漏出非推进集,这条轴就又瞎了。
 */
test('T15 零写入班次计入空转;而真有写盘的 session-ok 仍归零(成对)', () => {
  assert.equal(
    np.attemptsSinceProgress([nrow('session-no-write')], 'k1'),
    1,
    '零写入必须占一次空转',
  )
  assert.equal(
    np.attemptsSinceProgress(
      [nrow('session-no-write'), nrow('session-no-write'), nrow('session-ok')],
      'k1',
    ),
    0,
    '反向:一次真写过盘的成功仍归零,不许把两轴混成一个数',
  )
  const rows = np.breakdownNonProgress([nrow('session-no-write'), nrow('session-no-write')], 'k1')
  assert.equal(
    rows.find((r) => r.action === 'session-no-write')?.count,
    2,
    '分档明细里要点名这一档',
  )
})

test('T16 轮级面闸停摆按「轮」计数(RP-66):连续计数、断链清零、混合两型同串', () => {
  const face = (n, from = 0) =>
    Array.from({ length: n }, (_, i) => ({
      action: 'runner-face-stale-disk',
      ts: `2026-11-06T0${from + i}:00:00.000Z`,
    }))
  assert.equal(np.faceRoundStreak(face(3)).count, 3)
  assert.equal(
    np.faceRoundStreak(face(3)).sinceTs,
    '2026-11-06T00:00:00.000Z',
    '串首时刻=去重身份,必须是最老那枚',
  )
  assert.equal(
    np.faceRoundStreak(face(3)).lastTs,
    '2026-11-06T02:00:00.000Z',
    '串尾取最新一枚,不能反向',
  )
  // 断链:中间夹任何一枚别的动作(哪怕同样"没动手")都必须把串断在这里 —— 少算是保守侧
  assert.equal(np.faceRoundStreak([...face(2), { action: 'dispatched' }, ...face(1)]).count, 1)
  // 两型同串:同一道闸的两种形态不许各算一串(否则永远攒不到 N)
  assert.equal(
    np.faceRoundStreak([
      { action: 'runner-face-stale-disk' },
      { action: 'runner-face-undetermined' },
      { action: 'runner-face-stale-disk' },
    ]).count,
    3,
  )
  // 取不到 ⇒ 0,绝不把"读不懂"读成"停摆很久"
  assert.equal(np.faceRoundStreak(undefined).count, 0)
  assert.equal(np.faceRoundStreak([]).count, 0)
  assert.equal(np.faceRoundStreak([null, 'x']).count, 0, '坏行必须断链,不能跳过继续数')
  // 自锁反例(本枚踩到过的形状):终局档那一行是自己写的账,既不能断链、也不许多占一轮
  const withOwnRow = [
    { action: 'runner-face-stale-disk', ts: 'T0' },
    { action: 'runner-face-stale-disk', ts: 'T1' },
    { action: 'runner-face-stale-disk', ts: 'T2' },
    { action: 'runner-face-parked-round', streakSince: 'T0', ts: 'T3' },
    { action: 'runner-face-stale-disk', ts: 'T4' },
  ]
  assert.equal(
    np.faceRoundStreak(withOwnRow).count,
    4,
    '终局行不得把串切断(切断=此后永远数回 1,同串再长也不响)',
  )
  assert.equal(np.faceRoundStreak(withOwnRow).sinceTs, 'T0', '串首仍是面闸行那枚,不是终局行的时刻')
})

test('T17 终局档去重按串、不按时刻;两把尺的词汇表不得漂移(RP-66 成对反向)', () => {
  const s = [
    { action: 'runner-face-stale-disk', ts: 'T0' },
    { action: 'runner-face-parked-round', streakSince: 'T0' },
  ]
  assert.equal(np.parkedRoundAlreadyAnnounced(s, 'T0'), true, '同一串只许喊一次')
  assert.equal(
    np.parkedRoundAlreadyAnnounced(s, 'T9'),
    false,
    '新的一串必须能再喊(否则第二次停摆静默)',
  )
  assert.equal(np.parkedRoundAlreadyAnnounced([], 'T0'), false)
  assert.equal(np.parkedRoundAlreadyAnnounced(s, null), false, '串首取不到 ⇒ 不认已喊,交调用方不发')
  // 词汇表单源:轮级档认定的两枚必须都在票级豁免表里 —— 摘掉豁免而不摘轮级计数,票会被整片推向 park
  for (const a of np.FACE_ROUND_TERMINAL_ACTIONS)
    assert.ok(np.ACTION_EXEMPTIONS[a], `${a} 从票级豁免表被摘掉,而轮级档仍认它是面闸 ⇒ 两把尺互咬`)
  assert.ok(
    np.ACTION_EXEMPTIONS['runner-face-parked-round'],
    '轮级终局档自身必须豁免票级阶梯(它不带 ticketKey)',
  )
})

test('T18 供给断档必须分两型计数(RP-66 同族第二型):同型攒串、换型断链、无计数行断链、终局行不自锁', () => {
  const hit = (n, ts) => ({ action: 'no-whitelist-hit', openFaceCount: n, ts })
  const open = (ts) => ({ action: 'no-open-tickets', openFaceCount: 0, ts })
  const six = (n = 6) => Array.from({ length: n }, (_, i) => hit(8, 'T' + i))
  // ① 攒到门限:emit 且身份是串首(去重键)
  const a = np.decideSupplyStall(six(6), { streakN: 6 })
  assert.equal(a.emit, true, a.reason)
  assert.equal(a.kind, 'supply-mismatch')
  assert.equal(a.sinceTs, 'T0', '串首时刻是去重身份,取最老那枚')
  assert.equal(a.count, 6)
  // ② 差一轮不响(成对反向:证明真在数行)
  assert.equal(np.decideSupplyStall(six(5), { streakN: 6 }).emit, false)
  // ③ 换型断链:三型不能互相攒串(合写就会诱导人去看错那一侧)
  const mixed = [hit(8, 'T0'), hit(8, 'T1'), open('T2'), hit(8, 'T3'), hit(8, 'T4')]
  const m = np.decideSupplyStall(mixed, { streakN: 3 })
  assert.equal(m.kind, 'supply-mismatch')
  assert.equal(m.count, 2, '中间一轮见底必须断链,不得攒成 4')
  // ④ 取不到派单面计数 ⇒ unknown 且断链(不把"没读到"折进任何一型)
  const noCount = [hit(8, 'T0'), { action: 'no-whitelist-hit', ts: 'T1' }, hit(8, 'T2')]
  const u = np.decideSupplyStall(noCount, { streakN: 2 })
  assert.equal(u.count, 1)
  assert.equal(u.kind, 'supply-mismatch')
  const u2 = np.decideSupplyStall([{ action: 'no-whitelist-hit', ts: 'T0' }], { streakN: 1 })
  assert.equal(u2.kind, 'unknown')
  assert.equal(u2.emit, false, 'unknown 档不得攒够就响')
  // ⑤ 真派发一行断链(供给恢复即刻归零)
  const back = [hit(8, 'T0'), hit(8, 'T1'), { action: 'dispatched', ts: 'T2' }, hit(8, 'T3')]
  assert.equal(np.decideSupplyStall(back, { streakN: 3 }).count, 1)
  // ⑥ 终局行不得切断自己那串(RP-66 踩过的自锁,同型反例必须在这儿也钉一遍)
  const withOwn = [
    ...six(6),
    { action: 'supply-stall-round', streakSince: 'T0', ts: 'T6' },
    hit(8, 'T7'),
  ]
  const w = np.decideSupplyStall(withOwn, { streakN: 6 })
  assert.equal(w.count, 7, '终局行既不断链也不许多占一轮')
  assert.equal(w.sinceTs, 'T0')
  assert.equal(w.emit, false, '同一串只喊一次')
  assert.match(w.reason, /已喊过/)
  // ⑦ 新串会再喊(断裂后重新攒够 = 第二次断档,同样是事故)
  const second = [hit(8, 'S0'), hit(8, 'S1'), hit(8, 'S2')]
  assert.equal(
    np.decideSupplyStall(withOwn.concat([{ action: 'dispatched', ts: 'D' }], second), {
      streakN: 3,
    }).emit,
    true,
  )
  // ⑧ 门限形态:坏值一律不响(与 loadGates 同口径;NaN 会让 count >= NaN 恒假 = 永久静默)
  for (const badV of [0, -2, 1.5, '6', NaN, null]) {
    const r = np.decideSupplyStall(six(20), { streakN: badV })
    assert.equal(r.emit, false, '门限 ' + String(badV) + ' 不是正整数,不得凭缺省值发信')
  }
  // ⑧b 门限**缺省**(undefined)不是"关掉":走文档缺省 6 ⇒ 该响还得响。
  // 反向钉这一格是因为 loadGates 给的就是这条兜底路;若这里改成"缺省不响",
  // 闸门配置文件少写一键就等于把终局档静默停用(与"两套时钟一比,按日上限静默失效"同型)。
  assert.equal(np.decideSupplyStall(six(6)).emit, true, '不传门限 ⇒ 走缺省 6,仍要响')
  // ⑨ 词汇表同源:分型集合里的每一枚都必须在票级豁免表里(摘了豁免而分型仍认它 = 两把尺互咬)
  for (const act of np.SUPPLY_STALL_ROUND_ACTIONS)
    assert.ok(np.ACTION_EXEMPTIONS[act], act + ' 不在票级豁免表')
  assert.ok(np.ACTION_EXEMPTIONS['supply-stall-round'], '轮级终局档自身也必须豁免票级阶梯')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
