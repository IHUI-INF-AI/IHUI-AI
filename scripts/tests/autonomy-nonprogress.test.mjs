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
const row = (action, extra = {}) => ({ ticketKey: K, action, ts: '2026-11-04T00:00:00.000Z', ...extra })
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
  assert.equal(evolve.failureStreakOf(ledger, K), 0, '旧连败在同形上读成 0 —— 这正是 B53 空转 127 次不被封的成因')
})

test('T2 真推进必须归零(每档成对,不许只写"会数")', () => {
  const ledger = [...alternating(3), row('session-ok'), ...alternating(1)]
  assert.equal(np.attemptsSinceProgress(ledger, K), 2, 'session-ok 之后的两轮计入,之前的清零')
})

test('T3 无票键的轮次行不得污染计数', () => {
  const ledger = [row('session-failed'), { action: 'no-whitelist-hit' }, { action: 'budget-exhausted' }, row('runner-unavailable')]
  assert.equal(np.attemptsSinceProgress(ledger, K), 2)
})

test('T4 留痕动作本身不自我加码(否则 park 会自己把自己顶到硬顶)', () => {
  const ledger = [row('session-failed'), row('non-progress-hold', { attempts: 1 }), row('non-progress-parked', { attempts: 1 })]
  assert.equal(np.attemptsSinceProgress(ledger, K), 1, 'hold/parked 两行既非 progress 也非 non-progress ⇒ 一律不计')
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
  assert.equal(np.decideNonProgress({ ...base, attempts: 9, now, lastStoodAt: now - 25 * 3600_000 }).route, 'try')
  assert.equal(np.decideNonProgress({ ...base, attempts: 24 }).route, 'park')
})

test('T6 读不到上次冷却起点 ⇒ 放一次并在 why 里点名(不静默放行)', () => {
  const r = np.decideNonProgress({ attempts: 10, rotateAt: 4, parkAt: 8, hardAt: 24, cooldownHours: 24, lastStoodAt: null })
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
  assert.deepEqual(bd, [
    { action: 'session-failed', count: 5 },
    { action: 'runner-unavailable', count: 3 },
  ], 'session-ok 之前那条 runner-unavailable 不得被算进来')
})

test('T9 上次立起时刻只认 non-progress-hold;读不到 ⇒ null', () => {
  assert.equal(np.lastNonProgressHoldAt([row('non-progress-hold', { ts: '2026-11-03T10:00:00.000Z' })], K), Date.parse('2026-11-03T10:00:00.000Z'))
  assert.equal(np.lastNonProgressHoldAt([row('session-failed')], K), null)
  assert.equal(np.lastNonProgressHoldAt([{ action: 'non-progress-hold', ticketKey: 'other' }], K), null)
})

test('T10 闸门真档位在真交替形上必须够得着终局(旧形连 3 都到不了)', () => {
  const g = evolve.loadGates()
  assert.ok(g.rotateAfterAttempts < g.parkAfterAttempts && g.parkAfterAttempts < g.parkHardLimit, '入库档位必须严格递增')
  const attempts = np.attemptsSinceProgress(alternating(Math.ceil(g.parkHardLimit / 2)), K)
  assert.ok(attempts >= g.parkHardLimit, `B53 那种交替形现在算出 ${attempts} 次,须达硬顶 ${g.parkHardLimit}`)
  assert.equal(np.decideNonProgress({ attempts, rotateAt: g.rotateAfterAttempts, parkAt: g.parkAfterAttempts, hardAt: g.parkHardLimit, cooldownHours: g.parkCooldownHours }).route, 'park')
  assert.ok(evolve.failureStreakOf(alternating(Math.ceil(g.parkHardLimit / 2)), K) <= 1, '反向对照:旧连败在同形上仍 ≈0 ⇒ 本器是唯一能拦住的轴')
})

test('T11 坏 JSON 形状仍按既有 GateShapeError 抛(新增校验没把旧校验挤掉)', () => {
  const reader = (json) => () => json
  const okBase = '{"enabled":true,"dailyDispatchBudget":6,"failureStreakLimit":3,"quarantineHours":48,"maxSessionMinutes":45,"sessionCommandTemplate":"","ticketWhitelist":["i18n"]}'
  assert.doesNotThrow(() => evolve.loadGates(reader(okBase)), '缺四个新档 ⇒ 走保守缺省,不得炸')
  const g = evolve.loadGates(reader(okBase))
  assert.deepEqual(
    [g.rotateAfterAttempts, g.parkAfterAttempts, g.parkHardLimit, g.parkCooldownHours],
    [4, 8, 24, 24],
    '缺省值必须与入库档位一致',
  )
  assert.throws(() => evolve.loadGates(reader(okBase.replace('"maxSessionMinutes":45', '"maxSessionMinutes":45,"parkHardLimit":0'))), evolve.GateShapeError)
  assert.throws(() => evolve.loadGates(reader(okBase.replace('"maxSessionMinutes":45', '"maxSessionMinutes":45,"parkCooldownHours":-1'))), evolve.GateShapeError)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
