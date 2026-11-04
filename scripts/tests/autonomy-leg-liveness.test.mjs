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

test('L10 真登记表形状可被判定器吃下(现读仓内文件,防两边形状漂移)', async () => {
  const { readFileSync } = await import('node:fs')
  const { resolve } = await import('node:path')
  const reg = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'data', 'autonomy-leg-liveness.json'), 'utf8'))
  assert.ok(Array.isArray(reg.legs) && reg.legs.length >= 8, '登记表至少覆盖已登记的派发腿')
  const res = lv.classifyLegs({ legs: reg.legs, stamps: {}, stampFilesOnDisk: [], now: NOW })
  // 没有 stamps 输入时,每条都应落 rotting(不在位)而不是静默消失
  assert.equal(res.rows.length, reg.legs.length, '每条登记都必须有一行读数')
  assert.ok(res.rows.every((r) => r.state === 'rotting'))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
