// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号与凭据面判据的回归网(2026-11-25 立)。
 *
 * 钉住三条最容易搞反的边界:
 *   ① 没有基线 ⇒ undetermined,**绝不**把当前快照自动当基线(否则攻击者先写进去就被洗白);
 *   ② 新增 ⇒ breach,消失 ⇒ 只 warn(消失可能是清理,也可能是掩盖痕迹,要人看一眼但不阻断);
 *   ③ 采集到 0 条 ⇒ undetermined,不是"干净"。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  judgeAccountDrift,
  diffClass,
  remediationForAccount,
  normalizeEntry,
  ACCOUNT_STATE,
  ACCOUNT_CLASSES,
} from '../security/lib/account-drift.mjs'

function snap(o = {}) {
  return { 'local-user': [], 'admin-group': [], 'ssh-key': [], ...o }
}

test('没有基线 ⇒ undetermined,不记绿', () => {
  const r = judgeAccountDrift({ baseline: null, current: snap({ 'local-user': ['a'] }) })
  assert.equal(r.state, ACCOUNT_STATE.UNDETERMINED)
  assert.match(r.reason, /没有基线/)
})

test('与基线完全一致 ⇒ ok', () => {
  const b = snap({ 'local-user': ['u1', 'u2'], 'admin-group': ['Administrator'], 'ssh-key': ['k1'] })
  const r = judgeAccountDrift({ baseline: b, current: { ...b } })
  assert.equal(r.state, ACCOUNT_STATE.OK)
  assert.equal(r.addedAll.length, 0)
  assert.equal(r.removedAll.length, 0)
})

test('当前多一条 ⇒ breach(新增)', () => {
  const b = snap({ 'local-user': ['u1'] })
  const c = snap({ 'local-user': ['u1', 'u2'] })
  const r = judgeAccountDrift({ baseline: b, current: c })
  assert.equal(r.state, ACCOUNT_STATE.BREACH)
  assert.deepEqual(r.addedAll, ['local-user:u2'])
})

test('当前少一条 ⇒ 只 warn,判 ok 但点名', () => {
  const b = snap({ 'local-user': ['u1', 'u2'] })
  const c = snap({ 'local-user': ['u1'] })
  const r = judgeAccountDrift({ baseline: b, current: c })
  assert.equal(r.state, ACCOUNT_STATE.OK)
  assert.deepEqual(r.removedAll, ['local-user:u2'])
  assert.match(r.reason, /消失/)
})

test('新增 SSH 公钥 ⇒ breach(攻击者最安静的一条路)', () => {
  const b = snap({ 'ssh-key': ['f1|aa'] })
  const c = snap({ 'ssh-key': ['f1|aa', 'f1|bb'] })
  const r = judgeAccountDrift({ baseline: b, current: c })
  assert.equal(r.state, ACCOUNT_STATE.BREACH)
  assert.deepEqual(r.addedAll, ['ssh-key:f1|bb'])
})

test('新增管理员 ⇒ breach', () => {
  const b = snap({ 'admin-group': ['Administrator'] })
  const c = snap({ 'admin-group': ['Administrator', 'attacker'] })
  const r = judgeAccountDrift({ baseline: b, current: c })
  assert.equal(r.state, ACCOUNT_STATE.BREACH)
  assert.deepEqual(r.addedAll, ['admin-group:attacker'])
})

test('三类同时新增 ⇒ 三条都进 addedAll', () => {
  const b = snap({ 'local-user': ['u1'], 'admin-group': ['Administrator'], 'ssh-key': ['k1'] })
  const c = snap({ 'local-user': ['u1', 'u2'], 'admin-group': ['Administrator', 'x'], 'ssh-key': ['k1', 'k2'] })
  const r = judgeAccountDrift({ baseline: b, current: c })
  assert.equal(r.state, ACCOUNT_STATE.BREACH)
  assert.equal(r.addedAll.length, 3)
})

test('采集到 0 条 ⇒ undetermined,不因为"没有新增"就记绿', () => {
  const r = judgeAccountDrift({ baseline: snap(), current: snap() })
  assert.equal(r.state, ACCOUNT_STATE.UNDETERMINED)
  assert.match(r.reason, /都没采到/)
})

test('归一化:大小写与多空格不影响比对', () => {
  assert.equal(normalizeEntry('  S-1-5  ADM  '), 's-1-5 adm')
  const b = snap({ 'local-user': ['U1'] })
  const c = snap({ 'local-user': ['  u1  '] })
  const r = judgeAccountDrift({ baseline: b, current: c })
  assert.equal(r.state, ACCOUNT_STATE.OK)
  assert.equal(r.addedAll.length, 0)
})

test('diffClass 计数:unchanged 只数交集', () => {
  const d = diffClass(['a', 'b', 'c'], ['b', 'c', 'd'])
  assert.deepEqual(d.added, ['d'])
  assert.deepEqual(d.removed, ['a'])
  assert.equal(d.unchanged, 2)
})

test('三个受管面就是本地用户/管理员组/SSH 公钥', () => {
  assert.deepEqual(ACCOUNT_CLASSES.map((c) => c.id), ['local-user', 'admin-group', 'ssh-key'])
})

test('给 SSH 公钥新增的建议指向具体文件与 grep', () => {
  const r = judgeAccountDrift({ baseline: snap(), current: snap({ 'ssh-key': ['k'] }) })
  const steps = remediationForAccount(r)
  assert.equal(steps.length, 1)
  assert.match(steps[0], /grep -n/)
})

test('给管理员新增的建议是 net localgroup /delete', () => {
  const r = judgeAccountDrift({ baseline: snap(), current: snap({ 'admin-group': ['evil'] }) })
  const steps = remediationForAccount(r)
  assert.match(steps[0], /net localgroup administrators evil \/delete/)
})

test('给本地用户新增的建议带 net user', () => {
  const r = judgeAccountDrift({ baseline: snap(), current: snap({ 'local-user': ['evil'] }) })
  const steps = remediationForAccount(r)
  assert.match(steps[0], /net user evil/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
