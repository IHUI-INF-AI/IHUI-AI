// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 调度健康判据的回归网(2026-11-25 立)。
 *
 * 钉住的是四类真实失效的边界,尤其是两处最容易判错的地方:
 *   ① 「有意停用」必须先于返回码检查 —— 否则按计划停掉的任务会被旧返回码反复点成故障;
 *   ② 「尚未运行」必须分开机型与周期型 —— 开机型开机早于注册属正常,周期型超两个间隔才是问题。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  classifyTask,
  judgeSchedulerHealth,
  remediationForScheduler,
  parseDurationDays,
  judgeRepetition,
  judgeCadence,
  MIN_DURATION_DAYS,
  SCHEDULER_STATE,
  STALE_FACTOR,
} from '../security/lib/scheduler-health.mjs'

const NOW = Date.parse('2026-11-25T19:00:00+08:00')
const HOUR = 3600_000
const MIN = 60_000

function t(over) {
  return {
    name: 'X',
    lastResult: 0,
    lastRun: new Date(NOW - 5 * MIN).toISOString(),
    status: 'Ready',
    trigger: 'TimeTrigger',
    intervalMin: 10,
    registeredAt: new Date(NOW - 24 * HOUR).toISOString(),
    bootAt: NOW - 72 * HOUR,
    ...over,
  }
}

test('返回码 0 且新鲜 ⇒ ok', () => {
  const r = classifyTask(t({}), { now: NOW })
  assert.equal(r.verdict, 'ok')
})

test('返回码 1 ⇒ breach', () => {
  const r = classifyTask(t({ lastResult: 1 }), { now: NOW })
  assert.equal(r.verdict, 'breach')
  assert.match(r.reason, /Last Result=1/)
})

test('负数退出码 0xC000013A ⇒ breach', () => {
  const r = classifyTask(t({ lastResult: -1073741510 }), { now: NOW })
  assert.equal(r.verdict, 'breach')
})

test('开机型 + 尚未运行 + 开机早于注册 ⇒ ok(等下次开机)', () => {
  const r = classifyTask(
    t({
      lastResult: 267011,
      lastRun: '1999-11-30T00:00:00+08:00',
      trigger: 'BootTrigger',
      bootAt: NOW - 72 * HOUR,
      registeredAt: NOW - 8 * HOUR,
    }),
    { now: NOW },
  )
  assert.equal(r.verdict, 'ok')
  assert.match(r.reason, /开机早于注册/)
})

test('开机型 + 尚未运行 + 开机晚于注册 ⇒ breach(触发没生效)', () => {
  const r = classifyTask(
    t({
      lastResult: 267011,
      lastRun: '1999-11-30T00:00:00+08:00',
      trigger: 'BootTrigger',
      bootAt: NOW - 1 * HOUR,
      registeredAt: NOW - 8 * HOUR,
    }),
    { now: NOW },
  )
  assert.equal(r.verdict, 'breach')
  assert.match(r.reason, /开机触发未生效/)
})

test('周期型 + 尚未运行 + 注册已超两个间隔 ⇒ breach', () => {
  const r = classifyTask(
    t({
      lastResult: 267011,
      lastRun: '1999-11-30T00:00:00+08:00',
      trigger: 'TimeTrigger',
      intervalMin: 10,
      registeredAt: new Date(NOW - 40 * MIN).toISOString(),
    }),
    { now: NOW },
  )
  assert.equal(r.verdict, 'breach')
  assert.match(r.reason, /仍未运行/)
})

test('周期型 + 尚未运行 + 注册未超两个间隔 ⇒ ok(尚未到首轮)', () => {
  const r = classifyTask(
    t({
      lastResult: 267011,
      lastRun: '1999-11-30T00:00:00+08:00',
      trigger: 'TimeTrigger',
      intervalMin: 10,
      registeredAt: new Date(NOW - 12 * MIN).toISOString(),
    }),
    { now: NOW },
  )
  assert.equal(r.verdict, 'ok')
})

test('有意停用 + 旧失败码 ⇒ ok(停用检查必须排在返回码之前)', () => {
  const r = classifyTask(
    t({ lastResult: 1, status: 'Disabled', disabledIntent: true }),
    { now: NOW },
  )
  assert.equal(r.verdict, 'ok')
  assert.match(r.reason, /有意停用/)
})

test('被禁用但未登记 ⇒ warn(不静默放过)', () => {
  const r = classifyTask(t({ status: 'Disabled', disabledIntent: false }), { now: NOW })
  assert.equal(r.verdict, 'warn')
})

test('过期:距上次运行超 2.5 个间隔 ⇒ breach', () => {
  const r = classifyTask(
    t({ intervalMin: 10, lastRun: new Date(NOW - 30 * MIN).toISOString() }),
    { now: NOW },
  )
  assert.equal(r.verdict, 'breach')
  assert.match(r.reason, /已过期/)
})

test('未过期:距上次运行在 2.5 个间隔内 ⇒ ok', () => {
  const r = classifyTask(
    t({ intervalMin: 10, lastRun: new Date(NOW - 20 * MIN).toISOString() }),
    { now: NOW },
  )
  assert.equal(r.verdict, 'ok')
})

test('取不到 Last Result ⇒ undetermined,不冒绿', () => {
  const r = classifyTask({ name: 'X', lastResult: null }, { now: NOW })
  assert.equal(r.verdict, 'undetermined')
})

test('汇总:有 breach ⇒ 整体 breach 并点名', () => {
  const r = judgeSchedulerHealth([t({ name: 'A' }), t({ name: 'B', lastResult: 1 })], { now: NOW })
  assert.equal(r.state, SCHEDULER_STATE.BREACH)
  assert.deepEqual(r.breaches, ['B'])
  assert.equal(r.total, 2)
})

test('汇总:全 ok ⇒ ok', () => {
  const r = judgeSchedulerHealth([t({ name: 'A' }), t({ name: 'B' })], { now: NOW })
  assert.equal(r.state, SCHEDULER_STATE.OK)
  assert.match(r.reason, /2 条任务全部健康/)
})

test('汇总:无 breach 但有 undetermined ⇒ undetermined', () => {
  const r = judgeSchedulerHealth([t({ name: 'A' }), { name: 'B' }], { now: NOW })
  assert.equal(r.state, SCHEDULER_STATE.UNDETERMINED)
})

test('STALE_FACTOR 是 2.5,不是 2 或 3', () => {
  assert.equal(STALE_FACTOR, 2.5)
})

test('每条 breach 都有可执行的下一步', () => {
  const r = judgeSchedulerHealth([t({ name: 'A', lastResult: 1 })], { now: NOW })
  const steps = remediationForScheduler(r)
  assert.equal(steps.length, 1)
  assert.match(steps[0], /schtasks \/run \/tn "\\A"/)
})

/* ── 重复窗口的「静默死亡」(第二十二件) ───────────────── */

test('静默死亡:Repetition 带 P1D ⇒ breach(仪表全绿也要报)', () => {
  /* 真实事故现场:Last Result=0、Status=Ready、刚跑过 2 分钟、Repeat: Every 有值,
     唯一异常是 Next Run Time 已经退回 N/A —— 在此之前没有任何判据会报它。 */
  const r = classifyTask(
    t({ repeatEvery: '0 Hour(s), 2 Minute(s)', repeatDuration: '1 Day(s)', nextRun: 'N/A' }),
    { now: NOW },
  )
  assert.equal(r.verdict, 'breach')
  assert.match(r.reason, /Duration/)
  assert.match(r.reason, /永久停摆|静默/)
})

test('静默死亡:无 Duration = 无限重复 ⇒ 不因这一维判死', () => {
  const r = classifyTask(
    t({ repeatEvery: '0 Hour(s), 2 Minute(s)', repeatDuration: 'Disabled', nextRun: '2026/11/25 19:10:00' }),
    { now: NOW },
  )
  assert.equal(r.verdict, 'ok')
})

test('静默死亡:P3650D(10 年)合法,不判', () => {
  const r = classifyTask(
    t({ repeatEvery: '1 Hour(s)', repeatDuration: '3650 Day(s)', nextRun: '2026/11/25 19:15:00' }),
    { now: NOW },
  )
  assert.equal(r.verdict, 'ok')
})

test('静默死亡:重复型但 Next Run Time 为空 ⇒ breach', () => {
  const r = classifyTask(t({ repeatEvery: '0 Hour(s), 5 Minute(s)', repeatDuration: 'Disabled', nextRun: 'N/A' }), {
    now: NOW,
  })
  assert.equal(r.verdict, 'breach')
  assert.match(r.reason, /下一次运行时间/)
})

test('静默死亡:InteractiveToken ⇒ warn 而不是 breach', () => {
  /* 判 breach 会变成恒红门:本机 5 条 InteractiveToken 任务此刻都在正常跑。
     真实语义是「会话一断就起不来」= 有风险不是已失效。 */
  const r = classifyTask(
    t({ repeatEvery: '1 Hour(s)', repeatDuration: 'Disabled', nextRun: '2026/11/25 20:00:00', logonType: 'InteractiveToken' }),
    { now: NOW },
  )
  assert.equal(r.verdict, 'warn')
  assert.match(r.reason, /InteractiveToken/)
  assert.match(r.reason, /0x80070490/)
})

test('静默死亡:S4U / SYSTEM 不判', () => {
  for (const lt of ['S4U', 'ServiceAccount', '']) {
    const r = classifyTask(
      t({ repeatEvery: '1 Hour(s)', repeatDuration: 'Disabled', nextRun: '2026/11/25 20:00:00', logonType: lt }),
      { now: NOW },
    )
    assert.equal(r.verdict, 'ok', `logonType=${lt} 不该判死`)
  }
})

test('静默死亡:非重复型任务不归本维判(一次性任务 Next Run 为空是正常的)', () => {
  for (const every of ['N/A', '', 'Disabled']) {
    const r = classifyTask(t({ repeatEvery: every, repeatDuration: 'Disabled', nextRun: 'N/A' }), { now: NOW })
    assert.equal(r.verdict, 'ok', `repeatEvery=${every} 不该判死`)
  }
})

test('parseDurationDays:ISO 与显示式都要认', () => {
  assert.equal(parseDurationDays('P1D'), 1)
  assert.equal(parseDurationDays('P3650D'), 3650)
  assert.equal(parseDurationDays('PT2M'), 2 / 1440)
  assert.equal(parseDurationDays('1 Day(s)'), 1)
  assert.equal(parseDurationDays('3650 Day(s)'), 3650)
  assert.equal(parseDurationDays('Disabled'), null)
  assert.equal(parseDurationDays('N/A'), null)
  assert.equal(parseDurationDays(''), null)
})

test('judgeRepetition:返回 null 表示本维不适用,而不是「通过」', () => {
  assert.equal(judgeRepetition({ repeatEvery: 'N/A' }), null)
  assert.equal(judgeRepetition({}), null)
  assert.equal(judgeRepetition({ repeatEvery: '1 Hour(s)', repeatDuration: 'Disabled', nextRun: '2026/11/25 20:00:00' }).verdict, 'ok')
})

test('静默死亡判据排在「过期未跑」之前:刚跑过 2 分钟也必须咬住', () => {
  /* 若判据顺序错了,这一条会先命中「新鲜 ⇒ ok」,于是死掉的任务被读成健康 */
  const r = classifyTask(
    t({ lastRun: new Date(NOW - 2 * MIN).toISOString(), repeatEvery: '0 Hour(s), 2 Minute(s)', repeatDuration: '1 Day(s)', nextRun: 'N/A' }),
    { now: NOW },
  )
  assert.equal(r.verdict, 'breach')
})

/* ── 第二十三件:触发锚点 / 声明节律(2026-11-26) ───────────────────────── */

test('judgeCadence:没登记声明节律的任务返回 null(本维不适用,不冒充通过)', () => {
  assert.equal(judgeCadence({ triggerKinds: ['TimeTrigger'], intervalMin: 5 }), null)
  assert.equal(judgeCadence({}), null)
  assert.equal(judgeCadence({ expectedEveryMin: 0 }), null)
})

test('judgeCadence:声明者被改成登录/开机/事件触发 ⇒ breach', () => {
  for (const kinds of [['LogonTrigger'], ['BootTrigger'], ['LogonTrigger', 'BootTrigger'], ['EventTrigger']]) {
    const r = judgeCadence({ expectedEveryMin: 60, triggerKinds: kinds, repeatEvery: '1 Hour(s)', intervalMin: 60, nextRun: 'N/A' })
    assert.equal(r.verdict, 'breach', `${kinds.join('+')} 不该被判成按点跑`)
    assert.match(r.reason, /没人登录|不登录/)
  }
})

test('judgeCadence:定时型但丢了 Repetition ⇒ breach(只在首次起跳那一刻跑一次)', () => {
  const r = judgeCadence({ expectedEveryMin: 2, triggerKinds: ['TimeTrigger'], repeatEvery: 'Disabled', intervalMin: 2 })
  assert.equal(r.verdict, 'breach')
  assert.match(r.reason, /Repetition/)
})

test('judgeCadence:慢于声明 1.5 倍 ⇒ breach;快于声明不算问题', () => {
  const slow = judgeCadence({ expectedEveryMin: 2, triggerKinds: ['TimeTrigger'], repeatEvery: '0 Hour(s), 30 Minute(s)', intervalMin: 30 })
  assert.equal(slow.verdict, 'breach')
  const fast = judgeCadence({ expectedEveryMin: 30, triggerKinds: ['TimeTrigger'], repeatEvery: '0 Hour(s), 2 Minute(s)', intervalMin: 2 })
  assert.equal(fast.verdict, 'ok')
  const equal = judgeCadence({ expectedEveryMin: 5, triggerKinds: ['TimeTrigger'], repeatEvery: '0 Hour(s), 5 Minute(s)', intervalMin: 5 })
  assert.equal(equal.verdict, 'ok')
})

test('judgeCadence:取不到触发器定义 ⇒ undetermined,绝不记 ok', () => {
  for (const kinds of [null, []]) {
    assert.equal(judgeCadence({ expectedEveryMin: 10, triggerKinds: kinds }).verdict, 'undetermined')
  }
})

test('judgeCadence:日历型(声明每日某时刻)被改成登录触发 ⇒ breach', () => {
  assert.equal(judgeCadence({ expectedDailyAt: '03:30', triggerKinds: ['CalendarTrigger'] }).verdict, 'ok')
  assert.equal(judgeCadence({ expectedDailyAt: '03:30', triggerKinds: ['TimeTrigger'], intervalMin: null }).verdict, 'ok')
  const bad = judgeCadence({ expectedDailyAt: '03:30', triggerKinds: ['LogonTrigger'] })
  assert.equal(bad.verdict, 'breach')
})

test('触发锚点判据排在「过期未跑」之前:任务很新鲜也必须咬住', () => {
  /* 登录触发型任务在有人登录时永远「新鲜」—— 靠距上次运行量不出来 */
  const r = classifyTask(
    t({
      lastRun: new Date(NOW - 2 * MIN).toISOString(),
      lastResult: 0,
      status: 'Ready',
      expectedEveryMin: 60,
      triggerKinds: ['LogonTrigger'],
      repeatEvery: 'Disabled',
      intervalMin: null,
    }),
    { now: NOW },
  )
  assert.equal(r.verdict, 'breach')
  assert.match(r.reason, /登录/)
})

test('未登记声明节律的任务即使真是 LogonTrigger 也不判(恒红门防线)', () => {
  /* DevStack / G-Root-Guardian 这类本来就是登录/开机型;判它们红 = 拿机器形态当判据(§0.2) */
  const r = classifyTask(
    t({ lastRun: new Date(NOW - 2 * MIN).toISOString(), trigger: 'LogonTrigger', triggerKinds: ['LogonTrigger'], repeatEvery: 'Disabled' }),
    { now: NOW },
  )
  assert.equal(r.verdict, 'ok')
})

test('remediation:undetermined 也要给下一步(别让「没判」读成绿)', () => {
  const out = remediationForScheduler({ breaches: [], warns: [], undetermined: ['X'] })
  assert.equal(out.length, 1)
  assert.match(out[0], /未判定/)
})

/* ── 第二十四件:声明在册但本机没有这条任务(2026-11-26) ───────────────── */

test('声明在册但枚举不到 ⇒ breach,不能落进「取不到 Last Result」的 undetermined', () => {
  const r = classifyTask({ name: 'IHUI-Security-Evidence-Intake', declaredButMissing: true }, { now: NOW })
  assert.equal(r.verdict, 'breach')
  assert.match(r.reason, /枚举不到|删除|改名/)
})

test('缺失判据先于「取不到返回码」:缺一条任务不会因为没数据就被读成未判定', () => {
  const missing = classifyTask({ name: 'X', declaredButMissing: true, lastResult: null }, { now: NOW })
  assert.equal(missing.verdict, 'breach')
  /* 对照:不是「声明缺失」的普通条目仍走 undetermined */
  const unknown = classifyTask({ name: 'Y', lastResult: null }, { now: NOW })
  assert.equal(unknown.verdict, 'undetermined')
})

test('缺失条目不污染健康汇总:混在正常任务里也只点它一条', () => {
  const out = judgeSchedulerHealth(
    [t({ name: 'GOOD' }), { name: 'GONE', declaredButMissing: true }],
    { now: NOW },
  )
  assert.equal(out.state, SCHEDULER_STATE.BREACH)
  assert.deepEqual(out.breaches, ['GONE'])
  assert.equal(out.total, 2)
})

test('缺失条目的下一步不是「补跑一条不存在的任务」', () => {
  const out = judgeSchedulerHealth([{ name: 'GONE', declaredButMissing: true }], { now: NOW })
  const steps = remediationForScheduler(out)
  assert.equal(steps.length, 1)
  assert.match(steps[0], /已没有这条任务|改名|重建/)
  assert.doesNotMatch(steps[0], /立即补跑/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
