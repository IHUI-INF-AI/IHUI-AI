// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * autonomy-leg-liveness.test.mjs —— 「黑腿探测器」镜像锁(§22c:import 源判据,零复算)
 *
 * 变异自证在册:
 *   · 摘掉"盘上有而登记表没有 ⇒ unregistered"这一维 ⇒ 覆盖面漏格无人知(user-feedback-export 那枚
 *     就是全仓 grep 0 生产者的形态)会读成"一切正常";
 *   · 摘掉登记表取不到 ⇒ unjudged ⇒ 会读成 ok(§0.3 禁忌);
 *   · 摘掉 attemptAt 不可解析 ⇒ 静默量不出会读成"没动=健康"。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as lv } from '../lib/autonomy-leg-liveness.mjs'

const DAY = 86400_000
const NOW = Date.parse('2026-11-04T04:00:00.000Z')
const leg = (stamp, nominalMin, extra = {}) => ({
  stamp,
  nominalIntervalMs: nominalMin * 60_000,
  owner: `dispatch${stamp.slice(0, 4)}`,
  verifiedAt: '2026-11-01',
  ...extra,
})
const fresh = (minAgo) => ({ readable: true, attemptAtMs: NOW - minAgo * 60_000 })

test('L1 容忍窗 = max(名义×倍数, 下限),小节律被下限抬住不致误喊', () => {
  assert.equal(lv.silenceWindowMs(5 * 60_000), lv.MIN_SILENCE_MS, '5min 腿 ×4=20min < 2h 下限 ⇒ 取下限')
  assert.equal(lv.silenceWindowMs(60 * 60_000), 60 * 60_000 * lv.SILENCE_MULTIPLIER)
  assert.equal(lv.silenceWindowMs(0), null, '名义节律坏 ⇒ null,调用方落未判定')
  assert.equal(lv.silenceWindowMs('45'), null)
})

test('L2 静默超窗即 dark,且点名名义节律与容忍窗(可整改,§5e-1)', () => {
  const res = lv.classifyLegs({
    legs: [leg('deploy-feedback-dispatch-last.json', 20)],
    stamps: { 'deploy-feedback-dispatch-last.json': fresh(2173) },
    stampFilesOnDisk: ['deploy-feedback-dispatch-last.json'],
    now: NOW,
  })
  assert.equal(res.state, 'drift')
  const r = res.rows[0]
  assert.equal(r.state, 'dark')
  assert.equal(r.silentMin, 2173)
  assert.match(r.why, /名义节律 20 分钟/)
  assert.match(r.why, /容忍窗 120 分钟/)
})

test('L3 覆盖面自证:盘上有而登记表没有 ⇒ unregistered(摘掉这维就漏格)', () => {
  const res = lv.classifyLegs({
    legs: [leg('a-dispatch-last.json', 5)],
    stamps: { 'a-dispatch-last.json': fresh(1), 'user-feedback-export-dispatch-last.json': fresh(3000) },
    stampFilesOnDisk: ['a-dispatch-last.json', 'user-feedback-export-dispatch-last.json'],
    now: NOW,
  })
  assert.equal(res.state, 'drift')
  assert.ok(res.rows.some((r) => r.id === 'user-feedback-export-dispatch-last.json' && r.state === 'unregistered'))
})

test('L4 登记表取不到/为空 ⇒ 整维未判定,绝不读成"没有黑腿"(§0.3)', () => {
  assert.equal(lv.classifyLegs({ legs: [], stamps: {}, stampFilesOnDisk: [], now: NOW }).state, 'unjudged')
  assert.equal(lv.classifyLegs({ legs: null, stamps: {}, stampFilesOnDisk: [], now: NOW }).state, 'unjudged')
  assert.equal(lv.classifyLegs({ legs: [leg('a-dispatch-last.json', 5)], stamps: {}, stampFilesOnDisk: [], now: null }).state, 'unjudged')
})

test('L5 单枚输入取不到 ⇒ 该枚未判定,不并桶进 ok 也不并桶进 dark', () => {
  const mk = (obs) =>
    lv.classifyLegs({ legs: [leg('a-dispatch-last.json', 5)], stamps: { 'a-dispatch-last.json': obs }, stampFilesOnDisk: ['a-dispatch-last.json'], now: NOW })
      .rows[0].state
  assert.equal(mk({ readable: false }), 'unjudged', '戳读不动')
  assert.equal(mk({ readable: true }), 'unjudged', 'attemptAt 不可解析')
  assert.equal(mk({ readable: true, attemptAtMs: NOW + 3600_000 }), 'unjudged', '戳在未来=时钟失步')
})

test('L6 登记了而戳不在 ⇒ rotting(清单腐烂同红,§0.7)', () => {
  const res = lv.classifyLegs({ legs: [leg('gone-dispatch-last.json', 5)], stamps: {}, stampFilesOnDisk: [], now: NOW })
  assert.equal(res.state, 'drift')
  assert.equal(res.rows[0].state, 'rotting')
})

test('L7 条目超存活期不复确认 ⇒ stale-verification(不许清单冻存)', () => {
  const res = lv.classifyLegs({
    legs: [leg('a-dispatch-last.json', 5, { verifiedAt: new Date(NOW - (lv.ROTATE_DAYS + 30) * DAY).toISOString().slice(0, 10) })],
    stamps: { 'a-dispatch-last.json': fresh(1) },
    stampFilesOnDisk: ['a-dispatch-last.json'],
    now: NOW,
  })
  assert.equal(res.rows[0].state, 'stale-verification')
  assert.match(res.rows[0].why, /复确认/)
})

test('L8 全绿成对档:每枚都在自己窗口内 ⇒ ok,且未判定为 0', () => {
  const legs = [leg('a-dispatch-last.json', 5), leg('b-dispatch-last.json', 60), leg('c-dispatch-last.json', 1440)]
  const stamps = { 'a-dispatch-last.json': fresh(30), 'b-dispatch-last.json': fresh(90), 'c-dispatch-last.json': fresh(2880) }
  const res = lv.classifyLegs({ legs, stamps, stampFilesOnDisk: Object.keys(stamps), now: NOW })
  assert.equal(res.state, 'ok', res.summary)
  assert.equal(res.rows.filter((r) => r.state === 'ok').length, 3)
})

test('L9 到人清单按静默时长降序,且不含 ok/未判定', () => {
  const legs = [leg('x-dispatch-last.json', 20), leg('y-dispatch-last.json', 5), leg('z-dispatch-last.json', 60)]
  const res = lv.classifyLegs({
    legs,
    stamps: { 'x-dispatch-last.json': fresh(600), 'y-dispatch-last.json': fresh(900), 'z-dispatch-last.json': fresh(60) },
    stampFilesOnDisk: ['x-dispatch-last.json', 'y-dispatch-last.json', 'z-dispatch-last.json'],
    now: NOW,
  })
  const act = lv.actionableRows(res)
  assert.deepEqual(act.map((r) => r.id), ['y-dispatch-last.json', 'x-dispatch-last.json'])
})

test('L12 新登记未首跑 = pending(不判腐烂);宽限一过仍无戳 ⇒ 照旧 rotting(成对,宽限不是永久盲区)', () => {
  const now = Date.parse('2026-11-04T04:00:00.000Z')
  const mk = (verifiedAt) =>
    lv.classifyLegs({ legs: [leg('a-dispatch-last.json', 5, { verifiedAt })], stamps: {}, stampFilesOnDisk: [], now }).rows[0].state
  assert.equal(mk('2026-11-04'), 'pending', '当天登记 ⇒ 宽限内,首跑未轮到不判腐烂')
  assert.equal(mk('2026-11-01'), 'rotting', '登记已 3 天仍无戳 ⇒ 真腐烂,宽限会自己过期')
  assert.ok(lv.FIRST_RUN_GRACE_MS <= 24 * 60 * 60 * 1000, '宽限上限就是 24h,不许无限期')
})

test('L13 pending 不得算进到人清单(但必须在读数里看得见)', () => {
  const res = lv.classifyLegs({
    legs: [leg('new-dispatch-last.json', 5, { verifiedAt: '2026-11-04' }), leg('old-dispatch-last.json', 5, { verifiedAt: '2026-11-01' })],
    stamps: {},
    stampFilesOnDisk: [],
    now: Date.parse('2026-11-04T04:00:00.000Z'),
  })
  assert.equal(res.state, 'drift', '宽限外那条必须顶红')
  assert.match(res.summary, /pending=1/)
  assert.deepEqual(lv.actionableRows(res).map((r) => r.id), ['old-dispatch-last.json'])
})

test('L10 真登记表形状可被判定器吃下(现读仓内文件,防两边形状漂移)', async () => {
  const { readFileSync } = await import('node:fs')
  const { resolve } = await import('node:path')
  const reg = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'data', 'autonomy-leg-liveness.json'), 'utf8'))
  assert.ok(Array.isArray(reg.legs) && reg.legs.length >= 12, '登记表至少覆盖已登记的派发腿(现读 12 条)')
  // 「登记当天」这个基准**必须从登记表现读**,不许写死日期(2026-11-07 修):
  // 原先钉在 2026-11-04T04:00Z,而该表此后又加过条目、逐条复核过 verifiedAt ⇒ 有 9 条的
  // verifiedAt 晚于基准,`now - verifiedAt` 变负 ⇒ 宽限判据不成立 ⇒ 整条断言恒红。
  // 那种红不是"判据发现真问题",而是**测试自己腐烂**(§0.5 棘轮锚点纪律的反面),
  // 且会把真正的回归淹没在"反正这条一直是红的"里。
  // 口径 = 表内最晚一次复核时刻,它天然等于"这批条目最后一次被确认的当下"。
  const verifiedMs = reg.legs.map((l) => Date.parse(String(l.verifiedAt ?? '')))
  assert.ok(
    verifiedMs.every(Number.isFinite),
    `登记表每条都必须带可解析的 verifiedAt(不可解析的条目会让宽限判据整条失效):${JSON.stringify(
      reg.legs.filter((_, i) => !Number.isFinite(verifiedMs[i])).map((l) => l.stamp),
    )}`,
  )
  const base = Math.max(...verifiedMs)
  const res = lv.classifyLegs({ legs: reg.legs, stamps: {}, stampFilesOnDisk: [], now: base })
  // 没有 stamps 输入时每条都得有一行读数:要么 rotting(登记已久仍无戳),要么 pending(当天新登记在宽限内);
  // 绝不允许出现 ok/dark —— 那等于把"输入缺失"读成"这条腿健康"。
  assert.equal(res.rows.length, reg.legs.length, '每条登记都必须有一行读数')
  const bad = res.rows.filter((r) => !['rotting', 'pending'].includes(r.state))
  assert.deepEqual(bad.map((r) => [r.id, r.state]), [], `无 stamps 输入只允许 rotting/pending 两态:${JSON.stringify(bad)}`)
  // 宽限两档改成**逐条自证**,不再要求"整表同一刻全 pending":
  // 这张表已跨两批登记(2026-11-04 首批 + 2026-11-07 四条复核),整表同一刻的断言会随
  // 登记节奏自然腐烂 —— 那种红是测试腐烂,不是判据发现真问题,还会把真回归淹掉。
  // 换成与登记节奏解耦的不变量:每条在**自己的** verifiedAt 当刻 pending、越过后必 rotting。
  for (const leg of reg.legs) {
    const at = Date.parse(String(leg.verifiedAt))
    const one = lv.classifyLegs({ legs: [leg], stamps: {}, stampFilesOnDisk: [], now: at })
    assert.equal(one.rows[0].state, 'pending', `${leg.stamp} 在自身 verifiedAt 当刻必须 pending,实为 ${one.rows[0].state}`)
    const past = lv.classifyLegs({
      legs: [leg],
      stamps: {},
      stampFilesOnDisk: [],
      now: at + lv.FIRST_RUN_GRACE_MS + 60 * 60 * 1000,
    })
    assert.equal(past.rows[0].state, 'rotting', `${leg.stamp} 越过宽限必须整体转腐烂,实为 ${past.rows[0].state}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
