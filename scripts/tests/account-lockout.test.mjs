// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号锁定 / 失败登录突发判据的回归网(2026-11-26 立)。
 *
 * 钉住三类边界(任务 A4):
 *   (a) 给定事件样本能命中并按三维点名;
 *   (b) 空窗不误报(采到 0 条且采集成功 ⇒ ok,不是 breach);
 *   (c) 取不到事件 ⇒ undetermined 并点名原因,绝不冒充绿(§0.3)。
 *
 * 另钉两处容易判错的口径:
 *   · 窗口外事件不计入突发;零星未达阈值不判 breach;
 *   · 4688 按 ProcessId 兜底补全进程名。
 *
 * 样本数字是固定夹具,不代表现读计数;实现层真读 Security 日志(见 check-account-lockout.mjs)。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  judgeAccountLockout,
  remediationForLockout,
  enrichProcessByPid,
  describeGroup,
  normalizeProcessName,
  parseLockoutThreshold,
  LOCKOUT_STATE,
  LOCKOUT_POLICY,
  DEFAULT_WINDOW_MIN,
  DEFAULT_BURST_THRESHOLD,
} from '../security/lib/account-lockout.mjs'

const NOW = Date.parse('2026-11-26T02:50:00+08:00')
const MIN = 60_000

function fail(over = {}) {
  return {
    kind: '4625',
    ts: NOW - 5 * MIN,
    targetUser: 'root',
    processName: 'C:\\Program Files\\OpenSSH\\sshd-session.exe',
    processId: '0x1',
    logonType: '3',
    status: '0xc000006d',
    ipAddress: '',
    logonProcessName: 'sshd',
    ...over,
  }
}

function lockout(over = {}) {
  return { kind: '4740', ts: NOW - 2 * MIN, targetUser: 'Administrator', ...over }
}

/** 现场样本:sshd-session 类型 3/8 共 102 次,chrome 类型 2 共 11 次,两次 4740。 */
function liveSample() {
  const events = []
  for (let i = 0; i < 60; i += 1) {
    events.push(fail({ targetUser: 'root', logonType: '3', processId: `0x${1000 + i}` }))
  }
  for (let i = 0; i < 42; i += 1) {
    events.push(fail({ targetUser: 'FakeUser', logonType: '8', processId: `0x${2000 + i}` }))
  }
  for (let i = 0; i < 11; i += 1) {
    events.push(
      fail({
        targetUser: 'Administrator',
        processName: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        processId: `0x${3000 + i}`,
        logonType: '2',
        status: '0xc000006d',
        logonProcessName: 'Advapi',
        ts: NOW - (3 - i * 0.1) * MIN,
      }),
    )
  }
  events.push(lockout({ ts: NOW - 21 * MIN }))
  events.push(lockout({ ts: NOW - 2 * MIN }))
  return events
}

test('(a) 命中:4740 + 4625 突发 ⇒ breach,按进程/用户/类型三维点名', () => {
  const r = judgeAccountLockout({ events: liveSample() }, { now: NOW, windowMin: 30 })
  assert.equal(r.state, LOCKOUT_STATE.BREACH)
  assert.equal(r.total4740, 2)
  assert.equal(r.total4625, 113)

  const proc = Object.fromEntries(r.byProcess.map((x) => [x.name, x.count]))
  assert.equal(proc['sshd-session.exe'], 102)
  assert.equal(proc['chrome.exe'], 11)

  const chrome = r.groups.find((g) => g.processName === 'chrome.exe')
  assert.ok(chrome, 'chrome.exe 组必须存在')
  assert.equal(chrome.count, 11)
  assert.equal(chrome.logonType, '2')
  assert.match(chrome.statusLabel, /0xc000006d/)
  assert.match(describeGroup(chrome), /chrome\.exe 11 次 · 类型 2/)

  const sshd = r.groups.filter((g) => g.processName === 'sshd-session.exe')
  assert.equal(sshd.length, 2, '类型 3 与类型 8 各成一组')
  assert.ok(sshd.some((g) => g.logonType === '3'))
  assert.ok(sshd.some((g) => g.logonType === '8'))

  const users = Object.fromEntries(r.byUser.map((x) => [x.name, x.count]))
  assert.ok(users['root'] === 60)
  assert.ok(users['FakeUser'] === 42)
  assert.ok(users['Administrator'] === 11)
})

test('(b) 空窗:采到 0 条且采集成功 ⇒ ok,不误报', () => {
  const r = judgeAccountLockout({ events: [] }, { now: NOW, windowMin: 30 })
  assert.equal(r.state, LOCKOUT_STATE.OK)
  assert.equal(r.total4740, 0)
  assert.equal(r.total4625, 0)
  assert.match(r.reason, /空窗/)
})

test('(c) 取不到事件:fetchError ⇒ undetermined,点名原因,不记绿', () => {
  const r = judgeAccountLockout(
    { events: null, fetchError: 'Security 日志拒绝访问(5)' },
    { now: NOW, windowMin: 30 },
  )
  assert.equal(r.state, LOCKOUT_STATE.UNDETERMINED)
  assert.match(r.reason, /取不到 Security 事件/)
  assert.match(r.reason, /拒绝访问/)
})

test('(c) events 不是数组 ⇒ undetermined,不读成空窗', () => {
  const r = judgeAccountLockout({ events: 'not-an-array' }, { now: NOW, windowMin: 30 })
  assert.equal(r.state, LOCKOUT_STATE.UNDETERMINED)
  assert.match(r.reason, /不是数组/)
})

test('零星失败未达突发阈值 ⇒ ok,不 breach', () => {
  const events = [fail(), fail({ targetUser: 'ihui' }), fail({ processId: '0x9' })]
  const r = judgeAccountLockout({ events }, { now: NOW, windowMin: 30, burstThreshold: DEFAULT_BURST_THRESHOLD })
  assert.equal(r.state, LOCKOUT_STATE.OK)
  assert.match(r.reason, /未达突发阈值/)
})

test('窗口外事件不计入突发', () => {
  const events = []
  for (let i = 0; i < 10; i += 1) {
    events.push(fail({ ts: NOW - 40 * MIN }))
  }
  const r = judgeAccountLockout({ events }, { now: NOW, windowMin: 30 })
  assert.equal(r.state, LOCKOUT_STATE.OK)
  assert.equal(r.total4625, 0)
})

test('4688 兜底:ProcessName 为空时按 ProcessId 补全映像名', () => {
  const events = [fail({ processName: '', processId: '0x43f0' })]
  const enriched = enrichProcessByPid(events, { '0x43f0': 'C:\\Program Files\\OpenSSH\\sshd-session.exe' })
  assert.equal(normalizeProcessName(enriched[0].processName), 'sshd-session.exe')
})

test('风暴标注:同一稳定身份 60 分钟内 ≥2 次进 storm 名单', () => {
  const events = [fail(), fail({ processId: '0x2' })]
  const r = judgeAccountLockout({ events }, { now: NOW, windowMin: 30, stormWindowMin: 60, stormThreshold: 2 })
  assert.ok(r.storm.length >= 1)
  assert.match(r.storm[0], /sshd-session\.exe\|root\|3/)
})

test('4740 命中即 breach,不受突发阈值约束', () => {
  const r = judgeAccountLockout({ events: [lockout()] }, { now: NOW, windowMin: 30 })
  assert.equal(r.state, LOCKOUT_STATE.BREACH)
  assert.match(r.reason, /账号被锁定/)
})

test('remediation 对锁定账号给出解锁口径,不补登续期', () => {
  const r = judgeAccountLockout({ events: liveSample() }, { now: NOW, windowMin: 30 })
  const rem = remediationForLockout(r)
  assert.ok(rem.some((s) => s.includes('锁定')))
  assert.ok(rem.some((s) => /sshd/i.test(s)))
})

test('默认窗口与突发阈值为命名常量,不在断言里写死现读计数', () => {
  assert.equal(DEFAULT_WINDOW_MIN, 30)
  assert.ok(DEFAULT_BURST_THRESHOLD >= 2)
})

/* ---- 锁定策略档(2026-11-26 立):阈值 0 时失败突发不再判红,4740 仍判红 ---- */

test('parseLockoutThreshold: secedit inf 的 LockoutBadCount=0 ⇒ disabled', () => {
  const p = parseLockoutThreshold('[System Access]\r\nLockoutBadCount = 0\r\n')
  assert.equal(p.state, LOCKOUT_POLICY.DISABLED)
  assert.equal(p.threshold, 0)
  assert.equal(p.raw, '0')
})

test('parseLockoutThreshold: LockoutBadCount=10 ⇒ enabled/10,空值 ⇒ undetermined', () => {
  const on = parseLockoutThreshold('LockoutBadCount = 10\n')
  assert.equal(on.state, LOCKOUT_POLICY.ENABLED)
  assert.equal(on.threshold, 10)
  const blank = parseLockoutThreshold('LockoutBadCount = \n')
  assert.equal(blank.state, LOCKOUT_POLICY.UNDETERMINED)
  assert.equal(blank.threshold, null)
})

test('parseLockoutThreshold: net accounts 兜底面(Never / 10)与乱码面都判得出', () => {
  assert.equal(parseLockoutThreshold('Lockout threshold:   Never\n').state, LOCKOUT_POLICY.DISABLED)
  assert.equal(parseLockoutThreshold('Lockout threshold:   10\n').threshold, 10)
  /* GBK 被 utf8 误解的真实形态:整段乱码 ⇒ 未判定,绝不猜成 green */
  assert.equal(parseLockoutThreshold('\uFFFD\uFFFD\uFFFD = 0\n').state, LOCKOUT_POLICY.UNDETERMINED)
})

test('策略 disabled:同组 5 次 4625 只记观测,不判 breach、不产生 breaches', () => {
  const events = []
  for (let i = 0; i < 5; i += 1) events.push(fail({ processId: '0x' + i }))
  const r = judgeAccountLockout(
    { events },
    { now: NOW, windowMin: 30, lockoutPolicy: { state: LOCKOUT_POLICY.DISABLED, threshold: 0 } },
  )
  assert.equal(r.state, LOCKOUT_STATE.OK)
  assert.equal(r.breaches.length, 0)
  assert.ok(r.observations.length >= 1)
  assert.match(r.observations[0], /仅观测/)
  assert.match(r.reason, /永不锁定|仅观测/)
  assert.deepEqual(r.policy, { state: LOCKOUT_POLICY.DISABLED, threshold: 0 })
})

test('策略 enabled:同组 5 次 4625 仍判 breach,并点名远程触发锁定的 DoS 面', () => {
  const events = []
  for (let i = 0; i < 5; i += 1) events.push(fail({ processId: '0x' + i }))
  const r = judgeAccountLockout(
    { events },
    { now: NOW, windowMin: 30, lockoutPolicy: { state: LOCKOUT_POLICY.ENABLED, threshold: 10 } },
  )
  assert.equal(r.state, LOCKOUT_STATE.BREACH)
  assert.ok(r.breaches.length >= 1)
  assert.ok(r.observations.some((s) => /DoS 面/.test(s)))
})

test('策略 disabled 但真出现 4740 ⇒ 仍判 breach(策略被改回时不放过)', () => {
  const r = judgeAccountLockout(
    { events: [lockout()] },
    { now: NOW, windowMin: 30, lockoutPolicy: { state: LOCKOUT_POLICY.DISABLED, threshold: 0 } },
  )
  assert.equal(r.state, LOCKOUT_STATE.BREACH)
  assert.match(r.reason, /账号被锁定/)
})

test('不传 lockoutPolicy ⇒ 按 ENABLED 保守判(策略未判定不能当降噪借口)', () => {
  const events = []
  for (let i = 0; i < 5; i += 1) events.push(fail({ processId: '0x' + i }))
  const r = judgeAccountLockout({ events }, { now: NOW, windowMin: 30 })
  assert.equal(r.state, LOCKOUT_STATE.BREACH)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
