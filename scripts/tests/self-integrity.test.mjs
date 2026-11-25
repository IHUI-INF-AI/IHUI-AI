// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 安全面自完整性判据的形状锁。
//
// 这一层守的是"防线自身的代码有没有被人绕过 git 动过" —— 判错的代价是双向的:
// 报红误伤(把正在干活当成入侵,逼人去跳门)、漏判(被改过却报 ok,防线静默失效)。
// 因此用例钉三件事:① 能判死的必须报红;② 判不了的一律 undetermined,不许冒绿;
// ③ 受管面过滤只认 .mjs 且在登记目录内。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  __test__,
  classifySelfDrift,
  coversPath,
  judgeSelfIntegrity,
  remediationForSelf,
  SELF_INTEGRITY_SCOPE,
} from '../security/lib/self-integrity.mjs'

const { judgeSelfIntegrity: judge2 } = __test__

const A = 'a'.repeat(40)
const B = 'b'.repeat(40)

test('coversPath 只认登记目录内的 .mjs', () => {
  assert.equal(coversPath('scripts/security/check-x.mjs'), true)
  assert.equal(coversPath('scripts/security/lib/y.mjs'), true)
  assert.equal(coversPath('deploy/win/ihui-api-router.mjs'), true)
  assert.equal(coversPath('deploy/win/lib/body-sniff.mjs'), true)
  // 非 .mjs 不在受管面(同目录的 .sql/.ps1 不是运行时判据)
  assert.equal(coversPath('scripts/security/x.sql'), false)
  assert.equal(coversPath('deploy/win/ihui-firewall-hardening.ps1'), false)
  // 目录前缀必须整段匹配,不能被 "scripts/security-other" 蹭上
  assert.equal(coversPath('scripts/security-other/x.mjs'), false)
  assert.equal(coversPath('scripts/other/x.mjs'), false)
  // 反斜杠形态必须归一化后仍认得出(Windows 路径会以 \ 出现)
  assert.equal(coversPath('scripts\\security\\check-x.mjs'), true)
  assert.equal(coversPath(''), false)
  assert.equal(coversPath(null), false)
})

test('受管面登记了脚本面与生产面两条根', () => {
  assert.deepEqual([...SELF_INTEGRITY_SCOPE], ['scripts/security', 'deploy/win'])
})

test('空清单 ⇒ undetermined,不许冒绿', () => {
  for (const empty of [[], null, undefined]) {
    const r = judgeSelfIntegrity(empty)
    assert.equal(r.state, 'undetermined')
    assert.deepEqual(r.drift, [])
    assert.match(r.reason, /清单为空|未枚举/)
  }
})

test('全部逐字节一致 ⇒ ok', () => {
  const r = judgeSelfIntegrity([
    { path: 'scripts/security/a.mjs', head: A, disk: A },
    { path: 'deploy/win/lib/b.mjs', head: B, disk: B },
  ])
  assert.equal(r.state, 'ok')
  assert.equal(r.total, 2)
  assert.deepEqual(r.drift, [])
  assert.match(r.reason, /2 件逐字节一致/)
})

test('大小写差异不该判红(sha 比较前统一小写)', () => {
  const r = judgeSelfIntegrity([{ path: 'scripts/security/a.mjs', head: A.toUpperCase(), disk: A }])
  assert.equal(r.state, 'ok')
})

test('内容不同 ⇒ drift(能判死)', () => {
  const r = judgeSelfIntegrity([
    { path: 'scripts/security/a.mjs', head: A, disk: A },
    { path: 'scripts/security/lib/b.mjs', head: A, disk: B },
  ])
  assert.equal(r.state, 'drift')
  assert.equal(r.drift.length, 1)
  assert.equal(r.drift[0].path, 'scripts/security/lib/b.mjs')
  assert.match(r.reason, /1\/2/)
})

test('盘上缺失 ⇒ drift(基准有、盘上没有 = 能判死)', () => {
  const r = judgeSelfIntegrity([{ path: 'scripts/security/a.mjs', head: A, disk: null }])
  assert.equal(r.state, 'drift')
  assert.equal(r.drift.length, 1)
  const c = classifySelfDrift(r.drift)
  assert.deepEqual(c.missing, ['scripts/security/a.mjs'])
  assert.deepEqual(c.differing, [])
})

test('只有 HEAD 取不到且无漂移 ⇒ undetermined,不冒绿也不冒红', () => {
  const r = judgeSelfIntegrity([
    { path: 'scripts/security/a.mjs', head: A, disk: A },
    { path: 'scripts/security/b.mjs', head: null, disk: B },
  ])
  assert.equal(r.state, 'undetermined')
  assert.deepEqual(r.drift, [])
  assert.match(r.reason, /HEAD 里取不到/)
})

test('HEAD 取不到与已确证漂移同时出现 ⇒ 报 drift,附带未判定说明', () => {
  const r = judgeSelfIntegrity([
    { path: 'scripts/security/a.mjs', head: A, disk: B },
    { path: 'scripts/security/b.mjs', head: null, disk: B },
  ])
  assert.equal(r.state, 'drift')
  assert.equal(r.drift.length, 1)
  assert.match(r.reason, /另 1 件 HEAD 取不到/)
})

test('classifySelfDrift 把缺失与内容不同分开', () => {
  const c = classifySelfDrift([
    { path: 'p1', head: A, disk: null },
    { path: 'p2', head: A, disk: B },
    { path: 'p3', head: A, disk: A },
  ])
  assert.deepEqual(c.missing, ['p1'])
  assert.deepEqual(c.differing, ['p2'])
})

test('remediationForSelf:ok 不给动作,drift 给可执行下一步且点名"先确认是不是你改的"', () => {
  assert.equal(remediationForSelf('ok', []), '')
  const und = remediationForSelf('undetermined', [])
  assert.match(und, /check-self-integrity/)
  const drift = remediationForSelf('drift', [
    { path: 'p1', head: A, disk: null },
    { path: 'p2', head: A, disk: B },
  ])
  assert.match(drift, /盘上缺 1 件/)
  assert.match(drift, /1 件内容不同/)
  // 关键语义:不能直接叫"覆盖",要先问是不是本人改的 —— 否则真被入侵时
  // 会把攻击者的改动当成正当改动备份掉。
  assert.match(drift, /确认是不是你本人正在改/)
})

test('__test__ 与具名导出是同一实现(禁第二份)', () => {
  assert.equal(judge2, judgeSelfIntegrity)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
